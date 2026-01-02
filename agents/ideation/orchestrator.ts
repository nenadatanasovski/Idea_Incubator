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
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { reply: text };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

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

      return {
        reply: parsed.text || text,
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
      // If JSON parsing fails, treat entire response as text
      console.log('[Orchestrator] JSON parsing failed, treating as plain text. Error:', e);
      return { reply: text };
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
}

// Singleton
export const agentOrchestrator = new AgentOrchestrator();
