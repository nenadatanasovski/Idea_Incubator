import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../../config/index.js';
import { client as anthropicClient } from '../../utils/anthropic-client.js';
import {
  IdeationSession,
  IdeationMessage,
  ButtonOption,
  FormDefinition,
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
  ViabilityRisk,
  WebSearchResult,
} from '../../types/ideation.js';
import { sessionManager } from './session-manager.js';
import { messageStore } from './message-store.js';
import { memoryManager } from './memory-manager.js';
import { candidateManager } from './candidate-manager.js';
import { extractSignals, ParsedAgentResponse, AgentArtifact, AgentArtifactUpdate } from './signal-extractor.js';
import { calculateConfidence } from './confidence-calculator.js';
import { calculateViability } from './viability-calculator.js';
import { calculateTokenUsage } from './token-counter.js';
import { prepareHandoff } from './handoff.js';
import { buildSystemPrompt, ArtifactSummary } from './system-prompt.js';
import { artifactStore } from './artifact-store.js';
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from '../../utils/ideation-defaults.js';
import {
  performWebSearch,
  SearchPurpose,
} from './web-search-service.js';

/**
 * AGENT ORCHESTRATOR
 *
 * Coordinates agent calls, response parsing, signal extraction,
 * and state updates.
 */

export interface AgentContext {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt: string;
}

export interface OrchestratorResponse {
  reply: string;
  buttons: ButtonOption[] | null;
  form: FormDefinition | null;
  candidateUpdate: {
    title: string;
    summary?: string;
  } | null;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  requiresIntervention: boolean;
  handoffOccurred: boolean;
  webSearchQueries?: string[];  // Queries to execute asynchronously
  artifact?: AgentArtifact;     // Visual artifact (mermaid diagram, code, etc.)
  artifactUpdate?: AgentArtifactUpdate; // Update to existing artifact
  isQuickAck: boolean;          // True if this is a quick acknowledgment (no Claude call)
  subAgentTasks?: SubAgentTask[]; // Tasks to execute in background after quick ack
  acknowledgmentText?: string;  // Custom acknowledgment text if different from reply
  userMessageId?: string;       // ID of stored user message
  assistantMessageId?: string;  // ID of stored assistant message
}

export interface SubAgentTask {
  id: string;
  type: 'action-plan' | 'pitch-refine' | 'architecture-explore' | 'custom';
  label: string;
  prompt?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface SubAgentTaskSignal {
  id: string;
  type: 'action-plan' | 'pitch-refine' | 'architecture-explore' | 'custom';
  label: string;
  prompt?: string;
}

export interface TaskSelectionResult {
  isTaskSelection: boolean;
  selectedTasks: number[];
  rawSelection: string;
  selectAll: boolean;
}

export class AgentOrchestrator {
  private client: typeof anthropicClient;

  constructor() {
    this.client = anthropicClient;
  }

  /**
   * Process a user message and return the agent's response.
   * @param displayMessage - Optional display version of the message (e.g., button label instead of value)
   */
  async processMessage(
    session: IdeationSession,
    userMessage: string,
    userProfile: Record<string, unknown>,
    displayMessage?: string
  ): Promise<OrchestratorResponse> {
    // Get existing messages
    const messages = await messageStore.getBySession(session.id);

    // Check for task selection (quick acknowledgment pattern)
    // If user selected from numbered options, return immediately without calling Claude
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
    const taskSelection = this.detectTaskSelection(userMessage, lastAssistantMessage);

    if (taskSelection.isTaskSelection && lastAssistantMessage?.buttonsShown) {
      return this.handleQuickAcknowledgment(session, userMessage, taskSelection, lastAssistantMessage);
    }

    // Check token usage
    const tokenUsage = calculateTokenUsage(messages, userMessage);

    // Handle handoff if needed
    let handoffOccurred = false;
    if (tokenUsage.shouldHandoff) {
      await this.performHandoff(session, messages);
      handoffOccurred = true;
    }

    // Build context (pass current message so we can extract artifact references)
    const context = await this.buildContext(session, messages, userProfile, handoffOccurred, userMessage);

    // Add user message to context
    context.messages.push({ role: 'user', content: userMessage });

    // Store user message BEFORE calling Claude so it can be edited if Claude times out
    const userMsg = await messageStore.add({
      sessionId: session.id,
      role: 'user',
      content: displayMessage || userMessage,
      tokenCount: Math.ceil((displayMessage || userMessage).length / 4),
    });

    // Call Claude
    const response = await this.client.messages.create({
      model: getConfig().model || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: context.systemPrompt,
      messages: context.messages,
    });

    // Parse response
    const parsed = this.parseResponse(response);

    // Extract signals
    const currentState = await this.loadSessionState(session.id);
    const signals = extractSignals(userMessage, parsed, currentState);

    // Update states
    const selfDiscovery = this.mergeState(currentState.selfDiscovery, signals.selfDiscovery);
    const marketDiscovery = this.mergeState(currentState.marketDiscovery, signals.marketDiscovery);
    const narrowingState = this.mergeState(currentState.narrowing, signals.narrowing);

    // Load existing candidate if current response doesn't have one
    const existingCandidate = await candidateManager.getActiveForSession(session.id);
    const candidateForCalculation = parsed.candidateTitle
      ? { title: parsed.candidateTitle, summary: parsed.candidateSummary }
      : existingCandidate
        ? { title: existingCandidate.title, summary: existingCandidate.summary || undefined }
        : null;

    // Calculate meters
    const confidenceResult = calculateConfidence({
      selfDiscovery: selfDiscovery as SelfDiscoveryState,
      marketDiscovery: marketDiscovery as MarketDiscoveryState,
      narrowingState: narrowingState as NarrowingState,
      candidate: candidateForCalculation,
      userConfirmations: this.countConfirmations(messages),
    });

    // Track if web search was requested (will be handled asynchronously)
    let webSearchResults: WebSearchResult[] = [];
    const webSearchRequested = parsed.webSearchNeeded && parsed.webSearchNeeded.length > 0;

    // NOTE: Web search is now handled asynchronously via a separate endpoint.
    // The response is returned immediately without waiting for search results.
    // If webSearchNeeded is set, the frontend should call the search endpoint
    // and display results in the artifact panel.

    const viabilityResult = calculateViability({
      selfDiscovery: selfDiscovery as SelfDiscoveryState,
      marketDiscovery: marketDiscovery as MarketDiscoveryState,
      narrowingState: narrowingState as NarrowingState,
      webSearchResults: webSearchResults,
      candidate: candidateForCalculation ? { id: existingCandidate?.id || '', title: candidateForCalculation.title } : null,
    });

    // Determine candidate for memory update - preserve existing if no new one
    const candidateForMemory = parsed.candidateTitle ? {
      id: existingCandidate?.id || '',
      sessionId: session.id,
      title: parsed.candidateTitle,
      summary: parsed.candidateSummary || existingCandidate?.summary || null,
      confidence: confidenceResult.total,
      viability: viabilityResult.total,
      userSuggested: existingCandidate?.userSuggested || false,
      status: existingCandidate?.status || 'forming' as const,
      capturedIdeaId: existingCandidate?.capturedIdeaId || null,
      version: (existingCandidate?.version || 0) + 1,
      createdAt: existingCandidate?.createdAt || new Date(),
      updatedAt: new Date(),
    } : existingCandidate ? {
      ...existingCandidate,
      confidence: confidenceResult.total,
      viability: viabilityResult.total,
      updatedAt: new Date(),
    } : null;

    // Update memory files
    await memoryManager.updateAll(session.id, {
      selfDiscovery: selfDiscovery as SelfDiscoveryState,
      marketDiscovery: marketDiscovery as MarketDiscoveryState,
      narrowingState: narrowingState as NarrowingState,
      candidate: candidateForMemory,
      viability: { total: viabilityResult.total, risks: viabilityResult.risks },
    });

    // Save candidate to database
    if (parsed.candidateTitle) {
      // New candidate or update
      if (existingCandidate) {
        // Update existing candidate
        await candidateManager.update(existingCandidate.id, {
          title: parsed.candidateTitle,
          summary: parsed.candidateSummary || existingCandidate.summary || undefined,
          confidence: confidenceResult.total,
          viability: viabilityResult.total,
        });
      } else {
        // Create new candidate
        await candidateManager.create({
          sessionId: session.id,
          title: parsed.candidateTitle,
          summary: parsed.candidateSummary,
          confidence: confidenceResult.total,
          viability: viabilityResult.total,
        });
      }
    } else if (existingCandidate) {
      // Update confidence/viability for existing candidate
      await candidateManager.update(existingCandidate.id, {
        confidence: confidenceResult.total,
        viability: viabilityResult.total,
      });
    }

    // Store assistant message (user message was stored earlier, before Claude call)
    const assistantMsg = await messageStore.add({
      sessionId: session.id,
      role: 'assistant',
      content: parsed.reply,
      buttonsShown: parsed.buttons || null,
      formShown: parsed.formFields as FormDefinition || null,
      tokenCount: Math.ceil(parsed.reply.length / 4),
    });

    return {
      reply: parsed.reply,
      buttons: parsed.buttons || null,
      form: parsed.formFields as FormDefinition || null,
      candidateUpdate: candidateForCalculation ? {
        title: candidateForCalculation.title,
        summary: candidateForCalculation.summary,
      } : null,
      confidence: confidenceResult.total,
      viability: viabilityResult.total,
      risks: viabilityResult.risks || [],
      requiresIntervention: viabilityResult.requiresIntervention,
      handoffOccurred,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
      webSearchQueries: webSearchRequested ? parsed.webSearchNeeded : undefined,
      artifact: parsed.artifact,
      artifactUpdate: parsed.artifactUpdate,
      isQuickAck: false,
    };
  }

  /**
   * Build context for agent call.
   */
  private async buildContext(
    session: IdeationSession,
    messages: IdeationMessage[],
    userProfile: Record<string, unknown>,
    isHandoff: boolean,
    currentUserMessage?: string
  ): Promise<AgentContext> {
    let memoryFiles: { fileType: string; content: string }[] | undefined;

    // Load memory files if handoff or returning session
    if (isHandoff || session.handoffCount > 0) {
      const files = await memoryManager.getAll(session.id);
      memoryFiles = files.map(f => ({
        fileType: f.fileType,
        content: f.content,
      }));
    }

    // Load artifacts for context so agent can reference and edit them
    const storedArtifacts = await artifactStore.getBySession(session.id);
    console.log('[BuildContext] Stored artifacts in DB:', storedArtifacts.map(a => ({ id: a.id, type: a.type, title: a.title })));

    // Extract artifact IDs referenced in the current user message
    const referencedIds = new Set<string>();
    const messageToCheck = currentUserMessage || '';
    const matches = messageToCheck.matchAll(/@artifact:([a-zA-Z0-9_-]+)/g);
    for (const match of matches) {
      referencedIds.add(match[1]);
    }
    console.log('[BuildContext] Referenced artifact IDs:', Array.from(referencedIds));

    // Warn if a referenced artifact doesn't exist in the database
    for (const refId of referencedIds) {
      if (!storedArtifacts.find(a => a.id === refId)) {
        console.warn(`[BuildContext] WARNING: Referenced artifact ${refId} not found in database!`);
      }
    }

    // Only include full content for explicitly referenced artifacts
    const artifactSummaries: ArtifactSummary[] = storedArtifacts.map(a => {
      const isReferenced = referencedIds.has(a.id);

      // Log artifact content details for debugging
      if (isReferenced) {
        const contentPreview = typeof a.content === 'string'
          ? a.content.substring(0, 300)
          : JSON.stringify(a.content).substring(0, 300);
        console.log(`[BuildContext] REFERENCED artifact "${a.id}" (${a.title}):`);
        console.log(`[BuildContext]   - Content length: ${typeof a.content === 'string' ? a.content.length : JSON.stringify(a.content).length}`);
        console.log(`[BuildContext]   - Content preview: "${contentPreview}..."`);
      }

      return {
        id: a.id,
        type: a.type,
        title: a.title,
        identifier: a.identifier,
        // Only include content if this artifact was referenced by the user
        content: isReferenced ? a.content : undefined,
      };
    });

    const systemPrompt = buildSystemPrompt(userProfile, memoryFiles, artifactSummaries);

    // Convert messages to API format
    const apiMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    return { messages: apiMessages, systemPrompt };
  }

  /**
   * Attempt to repair common JSON formatting issues from LLM output.
   * Handles unescaped newlines and control characters in string values.
   */
  private repairJsonString(jsonStr: string): string {
    // This is tricky because we need to escape newlines ONLY inside string values
    // Strategy: Process character by character, tracking if we're inside a string
    let result = '';
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        result += char;
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }

      if (inString) {
        // Escape control characters inside strings
        if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else {
          result += char;
        }
      } else {
        result += char;
      }
    }

    return result;
  }

  /**
   * Parse agent response from Claude.
   */
  private parseResponse(response: Anthropic.Message): ParsedAgentResponse {
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return { reply: 'I apologize, but I encountered an issue. Could you repeat that?' };
    }

    const text = textContent.text;
    console.log('[Orchestrator] Raw LLM response (first 500 chars):', text.slice(0, 500));

    // Try to parse as JSON
    try {
      // Find JSON in response (may be wrapped in markdown code blocks)
      // Strategy: Try multiple extraction methods, use whichever produces valid JSON

      // Method 1: Greedy code block match (captures until LAST ```) - handles artifacts with code blocks
      const greedyCodeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*)```/);
      // Method 2: Non-greedy code block match (original) - works for simple cases
      const simpleCodeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      // Method 3: Raw JSON extraction - find outermost { }
      const rawJsonMatch = text.match(/(\{[\s\S]*\})/);

      // Try each method in order until one produces valid JSON
      const candidates = [greedyCodeBlockMatch, simpleCodeBlockMatch, rawJsonMatch].filter(Boolean);

      if (candidates.length === 0) {
        console.log('[Orchestrator] No JSON found in response, treating as plain text');
        return { reply: text };
      }

      let jsonStr: string | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: any = null;

      for (const match of candidates) {
        const candidate = match![1] || match![0];
        try {
          const repaired = this.repairJsonString(candidate);
          parsed = JSON.parse(repaired);
          jsonStr = repaired;
          console.log('[Orchestrator] Successfully parsed JSON using method', candidates.indexOf(match) + 1);
          break;
        } catch {
          // Try next method
          continue;
        }
      }

      if (!parsed || !jsonStr) {
        throw new Error('All JSON extraction methods failed');
      }

      console.log('[Orchestrator] Parsed JSON - webSearchNeeded:', parsed.webSearchNeeded, 'artifact:', parsed.artifact?.type, 'artifactUpdate:', JSON.stringify(parsed.artifactUpdate));

      // Validate artifactUpdate has required fields
      if (parsed.artifactUpdate) {
        if (!parsed.artifactUpdate.content) {
          console.error('[Orchestrator] ERROR: artifactUpdate missing content field! Agent provided ID but no content.');
          console.error('[Orchestrator] artifactUpdate received:', JSON.stringify(parsed.artifactUpdate));
        } else {
          console.log('[Orchestrator] artifactUpdate content length:', parsed.artifactUpdate.content.length);
        }
      }

      // IMPORTANT: When JSON is successfully parsed, ONLY use parsed.text
      // Never fall back to raw text which may contain preamble or the JSON itself
      const reply = parsed.text || 'I processed your request.';

      // Detect if agent accidentally included JSON in its text field
      if (reply.includes('"text":') || reply.includes('"buttons":')) {
        console.warn('[Orchestrator] WARNING: Agent may have included JSON structure in text field');
        // Try to extract just the intended message
        const cleanMatch = reply.match(/^([^{]*?)(?:\s*\{|$)/);
        if (cleanMatch && cleanMatch[1].trim()) {
          console.log('[Orchestrator] Extracted clean text:', cleanMatch[1].trim().slice(0, 100));
          return {
            reply: cleanMatch[1].trim(),
            buttons: parsed.buttons,
            formFields: parsed.form,
            signals: parsed.signals,
            candidateTitle: parsed.candidateUpdate?.title,
            candidateSummary: parsed.candidateUpdate?.summary,
            webSearchNeeded: parsed.webSearchNeeded,
            artifact: parsed.artifact,
            artifactUpdate: parsed.artifactUpdate,
          };
        }
      }

      return {
        reply,
        buttons: parsed.buttons,
        formFields: parsed.form,
        signals: parsed.signals,
        candidateTitle: parsed.candidateUpdate?.title,
        candidateSummary: parsed.candidateUpdate?.summary,
        webSearchNeeded: parsed.webSearchNeeded,
        artifact: parsed.artifact,
        artifactUpdate: parsed.artifactUpdate,
      };
    } catch (e) {
      // If JSON parsing fails, try to extract meaningful content
      console.log('[Orchestrator] JSON parsing failed, treating as plain text. Error:', e);

      // Try to extract preamble text before any code block (which likely contains malformed JSON)
      const preambleMatch = text.match(/^([\s\S]*?)(?:```|$)/);
      if (preambleMatch && preambleMatch[1].trim()) {
        const preamble = preambleMatch[1].trim();
        console.log('[Orchestrator] Extracted preamble text:', preamble.slice(0, 200));

        // If preamble is just introducing an artifact, provide a cleaner message
        if (preamble.toLowerCase().includes('artifact') || preamble.toLowerCase().includes('create')) {
          return { reply: 'I encountered an issue creating the artifact. Please try again with a simpler request.' };
        }
        return { reply: preamble };
      }

      // Last resort: return a generic message instead of raw JSON
      return { reply: 'I processed your request but encountered a formatting issue. Please try again.' };
    }
  }

  /**
   * Load current session state from memory files.
   */
  private async loadSessionState(sessionId: string): Promise<{
    selfDiscovery: Partial<SelfDiscoveryState>;
    marketDiscovery: Partial<MarketDiscoveryState>;
    narrowing: Partial<NarrowingState>;
  }> {
    // Load from memory manager
    const state = await memoryManager.loadState(sessionId);

    return {
      selfDiscovery: state.selfDiscovery || createDefaultSelfDiscoveryState(),
      marketDiscovery: state.marketDiscovery || createDefaultMarketDiscoveryState(),
      narrowing: state.narrowingState || createDefaultNarrowingState(),
    };
  }

  /**
   * Merge existing state with new signals.
   */
  private mergeState<T extends Record<string, unknown>>(existing: Partial<T>, updates: Partial<T>): Partial<T> {
    const merged = { ...existing };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        const existingValue = merged[key as keyof T];

        // Handle array merging - both must be arrays
        if (Array.isArray(value) && Array.isArray(existingValue)) {
          (merged as Record<string, unknown>)[key] = [
            ...(existingValue as unknown[]),
            ...value,
          ];
        }
        // Skip if existing is array but update is not (don't overwrite arrays with objects)
        else if (Array.isArray(existingValue) && !Array.isArray(value)) {
          // Keep existing array, don't overwrite with object
          continue;
        }
        // Deep merge objects - both must be non-array objects
        else if (typeof value === 'object' && !Array.isArray(value) &&
                 typeof existingValue === 'object' && !Array.isArray(existingValue)) {
          (merged as Record<string, unknown>)[key] = {
            ...(existingValue as Record<string, unknown> || {}),
            ...value,
          };
        }
        // Simple value replacement
        else {
          (merged as Record<string, unknown>)[key] = value;
        }
      }
    }

    return merged;
  }

  /**
   * Count user confirmations in conversation.
   */
  private countConfirmations(messages: IdeationMessage[]): number {
    const confirmationPatterns = [
      /yes/i,
      /exactly/i,
      /that's (right|correct)/i,
      /makes sense/i,
      /I agree/i,
    ];

    return messages
      .filter(m => m.role === 'user')
      .filter(m => confirmationPatterns.some(p => p.test(m.content)))
      .length;
  }

  /**
   * Perform handoff preparation.
   */
  private async performHandoff(session: IdeationSession, messages: IdeationMessage[]): Promise<void> {
    const state = await this.loadSessionState(session.id);

    await prepareHandoff(session, {
      selfDiscovery: state.selfDiscovery as SelfDiscoveryState,
      marketDiscovery: state.marketDiscovery as MarketDiscoveryState,
      narrowingState: state.narrowing as NarrowingState,
      candidate: null,
      confidence: 0,
      viability: 100,
      risks: [],
    });
  }

  /**
   * Detect if user message is a task selection from numbered options.
   * Handles patterns like "1", "1 and 3", "all", "first one", "1, 2", etc.
   */
  private detectTaskSelection(
    userMessage: string,
    lastAssistantMessage: IdeationMessage | undefined
  ): TaskSelectionResult {
    const defaultResult: TaskSelectionResult = {
      isTaskSelection: false,
      selectedTasks: [],
      rawSelection: userMessage,
      selectAll: false,
    };

    // Check if last assistant message had numbered buttons/tasks
    if (!lastAssistantMessage?.buttonsShown || !this.hasNumberedTasks(lastAssistantMessage.buttonsShown)) {
      return defaultResult;
    }

    // Check if user input looks like a selection
    if (!this.isSelectionInput(userMessage)) {
      return defaultResult;
    }

    const maxTasks = lastAssistantMessage.buttonsShown.length;
    const { tasks, selectAll } = this.parseTaskSelection(userMessage, maxTasks);

    if (tasks.length === 0 && !selectAll) {
      return defaultResult;
    }

    return {
      isTaskSelection: true,
      selectedTasks: selectAll ? Array.from({ length: maxTasks }, (_, i) => i + 1) : tasks,
      rawSelection: userMessage,
      selectAll,
    };
  }

  /**
   * Parse user selection into task numbers.
   */
  private parseTaskSelection(
    selection: string,
    maxTasks: number
  ): { tasks: number[]; selectAll: boolean } {
    const normalized = selection.toLowerCase().trim();

    // Check for "all" or "all of them"
    if (/^(all|all of them|everything|do all|run all|both|do both)$/i.test(normalized)) {
      return { tasks: [], selectAll: true };
    }

    // Check for ordinal words
    const ordinalMap: Record<string, number> = {
      'first': 1, 'first one': 1, '1st': 1,
      'second': 2, 'second one': 2, '2nd': 2,
      'third': 3, 'third one': 3, '3rd': 3,
      'fourth': 4, 'fourth one': 4, '4th': 4,
      'fifth': 5, 'fifth one': 5, '5th': 5,
      'last': maxTasks, 'last one': maxTasks,
    };

    // Direct ordinal match
    if (ordinalMap[normalized]) {
      const num = ordinalMap[normalized];
      return { tasks: num <= maxTasks ? [num] : [], selectAll: false };
    }

    // Extract numbers from input (handles "1", "1 and 3", "1, 2, 3", "1 2 3", etc.)
    const numbers: number[] = [];

    // Match standalone numbers
    const numberMatches = normalized.match(/\b(\d+)\b/g);
    if (numberMatches) {
      for (const match of numberMatches) {
        const num = parseInt(match, 10);
        if (num >= 1 && num <= maxTasks && !numbers.includes(num)) {
          numbers.push(num);
        }
      }
    }

    // Also check for ordinals mixed with numbers ("first and 3")
    for (const [word, num] of Object.entries(ordinalMap)) {
      if (normalized.includes(word) && num <= maxTasks && !numbers.includes(num)) {
        numbers.push(num);
      }
    }

    return { tasks: numbers.sort((a, b) => a - b), selectAll: false };
  }

  /**
   * Check if buttons represent numbered tasks.
   */
  private hasNumberedTasks(buttons: ButtonOption[] | null): boolean {
    if (!buttons || buttons.length === 0) return false;

    // Check if buttons have numeric labels or are task-like
    // Tasks typically have labels like "1. Create action plan" or values like "task_1"
    return buttons.some(b =>
      /^\d+[\.\)]?\s/.test(b.label) ||  // Starts with number
      /^task[_-]?\d+$/i.test(b.value) ||  // Value like task_1
      b.value.startsWith('option_')  // Generic option format
    );
  }

  /**
   * Check if input looks like a task selection.
   */
  private isSelectionInput(input: string): boolean {
    const normalized = input.toLowerCase().trim();

    // Very short input with just numbers
    if (/^\d+(\s*(,|and|\+|&)\s*\d+)*$/.test(normalized)) {
      return true;
    }

    // Ordinal words
    if (/^(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)(\s+one)?$/i.test(normalized)) {
      return true;
    }

    // "all" variations
    if (/^(all|all of them|everything|do all|run all|both|do both)$/i.test(normalized)) {
      return true;
    }

    // Mixed patterns like "1 and 3", "first and second"
    if (/^((\d+|first|second|third|fourth|fifth)\s*(,|and|&|\+)\s*)+(\d+|first|second|third|fourth|fifth)$/i.test(normalized)) {
      return true;
    }

    // Single number with optional confirmation
    if (/^\d+\s*(please|thanks|ok|okay)?$/i.test(normalized)) {
      return true;
    }

    return false;
  }

  /**
   * Handle quick acknowledgment for task selection.
   * Returns immediately with "On it..." and includes tasks for background execution.
   */
  private async handleQuickAcknowledgment(
    session: IdeationSession,
    userMessage: string,
    taskSelection: TaskSelectionResult,
    lastAssistantMessage: IdeationMessage
  ): Promise<OrchestratorResponse> {
    const buttons = lastAssistantMessage.buttonsShown || [];

    // Build list of selected tasks
    const selectedTasks: SubAgentTask[] = taskSelection.selectedTasks
      .filter(num => num >= 1 && num <= buttons.length)
      .map((num, index) => {
        const button = buttons[num - 1];
        return {
          id: `task_${Date.now()}_${index}`,
          type: this.inferTaskType(button.value, button.label),
          label: button.label,
          prompt: button.value,
          status: 'pending' as const,
        };
      });

    if (selectedTasks.length === 0) {
      // No valid tasks selected, fall through to normal processing
      // This shouldn't happen if detectTaskSelection worked correctly
      return {
        reply: "I couldn't identify which tasks you selected. Could you clarify?",
        buttons: null,
        form: null,
        candidateUpdate: null,
        confidence: 0,
        viability: 0,
        risks: [],
        requiresIntervention: false,
        handoffOccurred: false,
        isQuickAck: false,
      };
    }

    // Build acknowledgment message
    const acknowledgmentText = selectedTasks.length === 1
      ? `On it...`
      : `Working on ${selectedTasks.length} tasks...`;

    // Store user message
    const userMsg = await messageStore.add({
      sessionId: session.id,
      role: 'user',
      content: userMessage,
      tokenCount: Math.ceil(userMessage.length / 4),
    });

    // Store quick ack message
    const assistantMsg = await messageStore.add({
      sessionId: session.id,
      role: 'assistant',
      content: acknowledgmentText,
      tokenCount: Math.ceil(acknowledgmentText.length / 4),
    });

    // Load current state for confidence/viability
    const existingCandidate = await candidateManager.getActiveForSession(session.id);

    return {
      reply: acknowledgmentText,
      buttons: null,
      form: null,
      candidateUpdate: existingCandidate ? {
        title: existingCandidate.title,
        summary: existingCandidate.summary || undefined,
      } : null,
      confidence: existingCandidate?.confidence || 0,
      viability: existingCandidate?.viability || 100,
      risks: [],
      requiresIntervention: false,
      handoffOccurred: false,
      isQuickAck: true,
      subAgentTasks: selectedTasks,
      acknowledgmentText,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
    };
  }

  /**
   * Infer task type from button value and label.
   */
  private inferTaskType(value: string, label: string): SubAgentTask['type'] {
    const combined = `${value} ${label}`.toLowerCase();

    if (combined.includes('action') || combined.includes('plan') || combined.includes('roadmap')) {
      return 'action-plan';
    }
    if (combined.includes('pitch') || combined.includes('refine') || combined.includes('elevator')) {
      return 'pitch-refine';
    }
    if (combined.includes('architecture') || combined.includes('technical') || combined.includes('system')) {
      return 'architecture-explore';
    }
    return 'custom';
  }
}

// Singleton
export const agentOrchestrator = new AgentOrchestrator();
