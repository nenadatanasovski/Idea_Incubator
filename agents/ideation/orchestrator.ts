import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../../config/index.js";
import { client as anthropicClient } from "../../utils/anthropic-client.js";
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
  IdeaTypeSelectionState,
  IdeaTypeSelection,
} from "../../types/ideation.js";
// sessionManager import removed - not currently used
import { messageStore } from "./message-store.js";
import { memoryManager } from "./memory-manager.js";
import { candidateManager } from "./candidate-manager.js";
import {
  extractSignals,
  ParsedAgentResponse,
  AgentArtifact,
  AgentArtifactUpdate,
} from "./signal-extractor.js";
import { calculateConfidence } from "./confidence-calculator.js";
import { calculateViability } from "./viability-calculator.js";
import { calculateTokenUsage } from "./token-counter.js";
import { prepareHandoff } from "./handoff.js";
import { buildSystemPrompt, ArtifactSummary } from "./system-prompt.js";
import { artifactStore } from "./artifact-store.js";
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from "../../utils/ideation-defaults.js";
// web-search-service imports removed - not currently used
import { query } from "../../database/db.js";

/**
 * AGENT ORCHESTRATOR
 *
 * Coordinates agent calls, response parsing, signal extraction,
 * and state updates.
 */

export interface AgentContext {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
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
  webSearchQueries?: string[]; // Queries to execute asynchronously
  webSearchResults?: WebSearchResult[]; // Results from executed web searches
  artifact?: AgentArtifact; // Visual artifact (mermaid diagram, code, etc.)
  artifactUpdate?: AgentArtifactUpdate; // Update to existing artifact
  isQuickAck: boolean; // True if this is a quick acknowledgment (no Claude call)
  subAgentTasks?: SubAgentTask[]; // Tasks to execute in background after quick ack
  acknowledgmentText?: string; // Custom acknowledgment text if different from reply
  userMessageId?: string; // ID of stored user message
  assistantMessageId?: string; // ID of stored assistant message
}

export interface SubAgentTask {
  id: string;
  type: "action-plan" | "pitch-refine" | "architecture-explore" | "custom";
  label: string;
  prompt?: string;
  status: "pending" | "running" | "completed" | "failed";
}

export interface SubAgentTaskSignal {
  id: string;
  type: "action-plan" | "pitch-refine" | "architecture-explore" | "custom";
  label: string;
  prompt?: string;
}

export interface TaskSelectionResult {
  isTaskSelection: boolean;
  selectedTasks: number[];
  rawSelection: string;
  selectAll: boolean;
}

export interface DirectArtifactRequest {
  isDirectRequest: boolean;
  artifacts: Array<{
    label: string;
    type: SubAgentTask["type"];
  }>;
  contextText: string; // The idea/context preceding the artifact list
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
    displayMessage?: string,
  ): Promise<OrchestratorResponse> {
    console.log("\n\n========== ORCHESTRATOR processMessage ==========");
    console.log("[Orchestrator] userMessage:", userMessage.substring(0, 100));

    // Get existing messages
    const messages = await messageStore.getBySession(session.id);
    console.log("[Orchestrator] Total messages in session:", messages.length);

    // Check for task selection (quick acknowledgment pattern)
    // If user selected from numbered options, return immediately without calling Claude
    const lastAssistantMessage = messages
      .filter((m) => m.role === "assistant")
      .pop();
    const taskSelection = this.detectTaskSelection(
      userMessage,
      lastAssistantMessage,
    );

    if (taskSelection.isTaskSelection && lastAssistantMessage) {
      console.log("[Orchestrator] QUICK ACK PATH - returning immediately");
      return this.handleQuickAcknowledgment(
        session,
        userMessage,
        taskSelection,
        lastAssistantMessage,
      );
    }

    // Check for direct multi-artifact request (e.g., "create 4 artifacts: 1) X, 2) Y...")
    // This allows users to request parallel artifact generation without selecting from options
    const directArtifactRequest = this.detectDirectArtifactRequest(userMessage);
    if (directArtifactRequest.isDirectRequest) {
      console.log(
        "[Orchestrator] Direct artifact request detected:",
        directArtifactRequest.artifacts.length,
        "artifacts",
      );
      return this.handleDirectArtifactRequest(
        session,
        userMessage,
        directArtifactRequest,
      );
    }

    // NOTE: Idea type classification flow removed - idea type starts as "draft"
    // and evolves naturally as the conversation progresses. This allows Claude
    // to proactively explore the idea from the first message rather than
    // interrupting with a "what type of idea is this?" question.

    // Check token usage
    const tokenUsage = calculateTokenUsage(messages, userMessage);

    // Handle handoff if needed
    let handoffOccurred = false;
    if (tokenUsage.shouldHandoff) {
      await this.performHandoff(session, messages);
      handoffOccurred = true;
    }

    // Build context (pass current message so we can extract artifact references)
    const context = await this.buildContext(
      session,
      messages,
      userProfile,
      handoffOccurred,
      userMessage,
    );

    // Add user message to context
    context.messages.push({ role: "user", content: userMessage });

    // Store user message BEFORE calling Claude so it can be edited if Claude times out
    const userMsg = await messageStore.add({
      sessionId: session.id,
      role: "user",
      content: displayMessage || userMessage,
      tokenCount: Math.ceil((displayMessage || userMessage).length / 4),
    });

    // Call Claude
    const response = await this.client.messages.create({
      model: getConfig().model || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: context.systemPrompt,
      messages: context.messages,
    });

    // Parse response (cast to handle SDK type variations)
    const parsed = this.parseResponse(response as Anthropic.Message);

    // Extract signals
    const currentState = await this.loadSessionState(session.id);
    const signals = extractSignals(userMessage, parsed, currentState);

    // Update states
    const selfDiscovery = this.mergeState(
      currentState.selfDiscovery,
      signals.selfDiscovery,
    );
    const marketDiscovery = this.mergeState(
      currentState.marketDiscovery,
      signals.marketDiscovery,
    );
    const narrowingState = this.mergeState(
      currentState.narrowing,
      signals.narrowing,
    );

    // Load existing candidate if current response doesn't have one
    const existingCandidate = await candidateManager.getActiveForSession(
      session.id,
    );
    const candidateForCalculation = parsed.candidateTitle
      ? { title: parsed.candidateTitle, summary: parsed.candidateSummary }
      : existingCandidate
        ? {
            title: existingCandidate.title,
            summary: existingCandidate.summary || undefined,
          }
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
    const webSearchRequested =
      parsed.webSearchNeeded && parsed.webSearchNeeded.length > 0;

    // NOTE: Web search is now handled asynchronously via a separate endpoint.
    // The response is returned immediately without waiting for search results.
    // If webSearchNeeded is set, the frontend should call the search endpoint
    // and display results in the artifact panel.

    const viabilityResult = calculateViability({
      selfDiscovery: selfDiscovery as SelfDiscoveryState,
      marketDiscovery: marketDiscovery as MarketDiscoveryState,
      narrowingState: narrowingState as NarrowingState,
      webSearchResults: webSearchResults,
      candidate: candidateForCalculation
        ? {
            id: existingCandidate?.id || "",
            title: candidateForCalculation.title,
          }
        : null,
    });

    // Determine candidate for memory update - preserve existing if no new one
    const candidateForMemory = parsed.candidateTitle
      ? {
          id: existingCandidate?.id || "",
          sessionId: session.id,
          title: parsed.candidateTitle,
          summary:
            parsed.candidateSummary || existingCandidate?.summary || null,
          confidence: confidenceResult.total,
          viability: viabilityResult.total,
          userSuggested: existingCandidate?.userSuggested || false,
          status: existingCandidate?.status || ("forming" as const),
          capturedIdeaId: existingCandidate?.capturedIdeaId || null,
          version: (existingCandidate?.version || 0) + 1,
          createdAt: existingCandidate?.createdAt || new Date(),
          updatedAt: new Date(),
        }
      : existingCandidate
        ? {
            ...existingCandidate,
            confidence: confidenceResult.total,
            viability: viabilityResult.total,
            updatedAt: new Date(),
          }
        : null;

    // Update memory files
    // Map ViabilityRisk to ViabilityRiskSummary format expected by memory manager
    const riskSummaries = viabilityResult.risks.map((r) => ({
      type: r.riskType,
      description: r.description,
      severity: r.severity,
    }));
    await memoryManager.updateAll(session.id, {
      selfDiscovery: selfDiscovery as SelfDiscoveryState,
      marketDiscovery: marketDiscovery as MarketDiscoveryState,
      narrowingState: narrowingState as NarrowingState,
      candidate: candidateForMemory,
      viability: { total: viabilityResult.total, risks: riskSummaries },
    });

    // Save candidate to database
    if (parsed.candidateTitle) {
      // New candidate or update
      if (existingCandidate) {
        // Update existing candidate
        await candidateManager.update(existingCandidate.id, {
          title: parsed.candidateTitle,
          summary:
            parsed.candidateSummary || existingCandidate.summary || undefined,
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
      role: "assistant",
      content: parsed.reply,
      buttonsShown: parsed.buttons || null,
      formShown: (parsed.formFields as FormDefinition) || null,
      tokenCount: Math.ceil(parsed.reply.length / 4),
    });

    return {
      reply: parsed.reply,
      buttons: parsed.buttons || null,
      form: (parsed.formFields as FormDefinition) || null,
      candidateUpdate: candidateForCalculation
        ? {
            title: candidateForCalculation.title,
            summary: candidateForCalculation.summary,
          }
        : null,
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
    currentUserMessage?: string,
  ): Promise<AgentContext> {
    let memoryFiles: { fileType: string; content: string }[] | undefined;

    // Load memory files if handoff or returning session
    if (isHandoff || session.handoffCount > 0) {
      const files = await memoryManager.getAll(session.id);
      memoryFiles = files.map((f) => ({
        fileType: f.fileType,
        content: f.content,
      }));
    }

    // Load artifacts for context so agent can reference and edit them
    const storedArtifacts = await artifactStore.getBySession(session.id);
    console.log(
      "[BuildContext] Stored artifacts in DB:",
      storedArtifacts.map((a) => ({ id: a.id, type: a.type, title: a.title })),
    );

    // Extract artifact IDs referenced in the current user message
    const referencedIds = new Set<string>();
    const messageToCheck = currentUserMessage || "";
    const matches = messageToCheck.matchAll(/@artifact:([a-zA-Z0-9_-]+)/g);
    for (const match of matches) {
      referencedIds.add(match[1]);
    }
    console.log(
      "[BuildContext] Referenced artifact IDs:",
      Array.from(referencedIds),
    );

    // Warn if a referenced artifact doesn't exist in the database
    for (const refId of referencedIds) {
      if (!storedArtifacts.find((a) => a.id === refId)) {
        console.warn(
          `[BuildContext] WARNING: Referenced artifact ${refId} not found in database!`,
        );
      }
    }

    // Only include full content for explicitly referenced artifacts
    const artifactSummaries: ArtifactSummary[] = storedArtifacts.map((a) => {
      const isReferenced = referencedIds.has(a.id);

      // Log artifact content details for debugging
      if (isReferenced) {
        const contentPreview =
          typeof a.content === "string"
            ? a.content.substring(0, 300)
            : JSON.stringify(a.content).substring(0, 300);
        console.log(
          `[BuildContext] REFERENCED artifact "${a.id}" (${a.title}):`,
        );
        console.log(
          `[BuildContext]   - Content length: ${typeof a.content === "string" ? a.content.length : JSON.stringify(a.content).length}`,
        );
        console.log(
          `[BuildContext]   - Content preview: "${contentPreview}..."`,
        );
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

    const systemPrompt = buildSystemPrompt(
      userProfile,
      memoryFiles,
      artifactSummaries,
    );

    // Convert messages to API format
    const apiMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
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
    let result = "";
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
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
        if (char === "\n") {
          result += "\\n";
        } else if (char === "\r") {
          result += "\\r";
        } else if (char === "\t") {
          result += "\\t";
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
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return {
        reply:
          "I apologize, but I encountered an issue. Could you repeat that?",
      };
    }

    const text = textContent.text;
    console.log(
      "[Orchestrator] Raw LLM response (first 500 chars):",
      text.slice(0, 500),
    );

    // Try to parse as JSON
    try {
      // Find JSON in response (may be wrapped in markdown code blocks)
      // Strategy: Try multiple extraction methods, use whichever produces valid JSON

      // Method 1: Greedy code block match (captures until LAST ```) - handles artifacts with code blocks
      const greedyCodeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*)```/);
      // Method 2: Non-greedy code block match (original) - works for simple cases
      const simpleCodeBlockMatch = text.match(
        /```(?:json)?\n?([\s\S]*?)\n?```/,
      );
      // Method 3: Raw JSON extraction - find outermost { }
      const rawJsonMatch = text.match(/(\{[\s\S]*\})/);

      // Try each method in order until one produces valid JSON
      const candidates = [
        greedyCodeBlockMatch,
        simpleCodeBlockMatch,
        rawJsonMatch,
      ].filter(Boolean);

      if (candidates.length === 0) {
        console.log(
          "[Orchestrator] No JSON found in response, treating as plain text",
        );
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
          console.log(
            "[Orchestrator] Successfully parsed JSON using method",
            candidates.indexOf(match) + 1,
          );
          break;
        } catch {
          // Try next method
          continue;
        }
      }

      if (!parsed || !jsonStr) {
        throw new Error("All JSON extraction methods failed");
      }

      console.log(
        "[Orchestrator] Parsed JSON - webSearchNeeded:",
        parsed.webSearchNeeded,
        "artifact:",
        parsed.artifact?.type,
        "artifactUpdate:",
        JSON.stringify(parsed.artifactUpdate),
      );

      // Validate artifactUpdate has required fields
      if (parsed.artifactUpdate) {
        if (!parsed.artifactUpdate.content) {
          console.error(
            "[Orchestrator] ERROR: artifactUpdate missing content field! Agent provided ID but no content.",
          );
          console.error(
            "[Orchestrator] artifactUpdate received:",
            JSON.stringify(parsed.artifactUpdate),
          );
        } else {
          console.log(
            "[Orchestrator] artifactUpdate content length:",
            parsed.artifactUpdate.content.length,
          );
        }
      }

      // IMPORTANT: When JSON is successfully parsed, ONLY use parsed.text
      // Never fall back to raw text which may contain preamble or the JSON itself
      const reply = parsed.text || "I processed your request.";

      // Detect if agent accidentally included JSON in its text field
      if (reply.includes('"text":') || reply.includes('"buttons":')) {
        console.warn(
          "[Orchestrator] WARNING: Agent may have included JSON structure in text field",
        );
        // Try to extract just the intended message
        const cleanMatch = reply.match(/^([^{]*?)(?:\s*\{|$)/);
        if (cleanMatch && cleanMatch[1].trim()) {
          console.log(
            "[Orchestrator] Extracted clean text:",
            cleanMatch[1].trim().slice(0, 100),
          );
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
      console.log(
        "[Orchestrator] JSON parsing failed, treating as plain text. Error:",
        e,
      );

      // Try to extract preamble text before any code block (which likely contains malformed JSON)
      const preambleMatch = text.match(/^([\s\S]*?)(?:```|$)/);
      if (preambleMatch && preambleMatch[1].trim()) {
        const preamble = preambleMatch[1].trim();
        console.log(
          "[Orchestrator] Extracted preamble text:",
          preamble.slice(0, 200),
        );

        // If preamble is just introducing an artifact, provide a cleaner message
        if (
          preamble.toLowerCase().includes("artifact") ||
          preamble.toLowerCase().includes("create")
        ) {
          return {
            reply:
              "I encountered an issue creating the artifact. Please try again with a simpler request.",
          };
        }
        return { reply: preamble };
      }

      // Last resort: return a generic message instead of raw JSON
      return {
        reply:
          "I processed your request but encountered a formatting issue. Please try again.",
      };
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
      marketDiscovery:
        state.marketDiscovery || createDefaultMarketDiscoveryState(),
      narrowing: state.narrowingState || createDefaultNarrowingState(),
    };
  }

  /**
   * Merge existing state with new signals.
   */
  private mergeState<T extends Record<string, unknown>>(
    existing: Partial<T>,
    updates: Partial<T>,
  ): Partial<T> {
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
        else if (
          typeof value === "object" &&
          !Array.isArray(value) &&
          typeof existingValue === "object" &&
          !Array.isArray(existingValue)
        ) {
          (merged as Record<string, unknown>)[key] = {
            ...((existingValue as Record<string, unknown>) || {}),
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
      .filter((m) => m.role === "user")
      .filter((m) => confirmationPatterns.some((p) => p.test(m.content)))
      .length;
  }

  /**
   * Perform handoff preparation.
   */
  private async performHandoff(
    session: IdeationSession,
    _messages: IdeationMessage[],
  ): Promise<void> {
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
   *
   * IMPORTANT: Numbered options may be in the message TEXT (not buttons array).
   * Example: "1. Update summary\n2. Create action plan\n3. Refine pitch"
   */
  private detectTaskSelection(
    userMessage: string,
    lastAssistantMessage: IdeationMessage | undefined,
  ): TaskSelectionResult {
    const defaultResult: TaskSelectionResult = {
      isTaskSelection: false,
      selectedTasks: [],
      rawSelection: userMessage,
      selectAll: false,
    };

    console.log(
      "[Orchestrator] Checking task selection for:",
      userMessage.substring(0, 80),
    );

    if (!lastAssistantMessage) {
      console.log("[Orchestrator] No last assistant message");
      return defaultResult;
    }

    // Extract numbered options from the message TEXT content
    console.log(
      "[Orchestrator] Last assistant message (last 500 chars):",
      lastAssistantMessage.content.slice(-500),
    );
    const numberedOptions = this.extractNumberedOptions(
      lastAssistantMessage.content,
    );
    console.log(
      "[Orchestrator] Found numbered options in text:",
      numberedOptions.length,
    );

    if (numberedOptions.length === 0) {
      // Fall back to checking buttonsShown
      if (
        lastAssistantMessage.buttonsShown &&
        this.hasNumberedTasks(lastAssistantMessage.buttonsShown)
      ) {
        console.log("[Orchestrator] Using buttonsShown instead");
        // Use buttons - convert to options format
        numberedOptions.push(
          ...lastAssistantMessage.buttonsShown.map((b, i) => ({
            number: i + 1,
            text: b.label,
            value: b.value,
          })),
        );
      }
    }

    if (numberedOptions.length === 0) {
      console.log("[Orchestrator] No numbered options found");
      return defaultResult;
    }

    console.log(
      "[Orchestrator] Options:",
      numberedOptions.map((o) => `${o.number}. ${o.text.substring(0, 30)}...`),
    );

    // Check if user input looks like a selection
    if (!this.isSelectionInput(userMessage)) {
      console.log("[Orchestrator] Input not a selection pattern");
      return defaultResult;
    }

    const maxTasks = numberedOptions.length;
    const { tasks, selectAll } = this.parseTaskSelection(userMessage, maxTasks);
    console.log(
      "[Orchestrator] Parsed tasks:",
      tasks,
      "selectAll:",
      selectAll,
      "maxTasks:",
      maxTasks,
    );

    if (tasks.length === 0 && !selectAll) {
      console.log("[Orchestrator] No tasks parsed");
      return defaultResult;
    }

    console.log("[Orchestrator] Task selection DETECTED!");
    return {
      isTaskSelection: true,
      selectedTasks: selectAll
        ? Array.from({ length: maxTasks }, (_, i) => i + 1)
        : tasks,
      rawSelection: userMessage,
      selectAll,
      // Store the extracted options for use in handleQuickAcknowledgment
      _numberedOptions: numberedOptions,
    } as TaskSelectionResult & {
      _numberedOptions: Array<{ number: number; text: string; value?: string }>;
    };
  }

  /**
   * Extract numbered options from message text.
   * Looks for patterns like "1. Do something" or "1) Do something"
   */
  private extractNumberedOptions(
    content: string,
  ): Array<{ number: number; text: string; value?: string }> {
    const options: Array<{ number: number; text: string; value?: string }> = [];

    // Match patterns like "1. Text here" or "1) Text here" at start of line or after newline
    // Also handles markdown bold like "**1.** Text"
    const regex =
      /(?:^|\n)\s*(?:\*\*)?(\d+)[.\)]\*?\*?\s+(.+?)(?=\n\s*(?:\*\*)?\d+[.\)]|\n\n|$)/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
      const num = parseInt(match[1], 10);
      const text = match[2].trim();

      // Only include reasonable option numbers (1-9)
      if (num >= 1 && num <= 9 && text.length > 0) {
        options.push({
          number: num,
          text: text,
          value: `option_${num}`,
        });
      }
    }

    return options;
  }

  /**
   * Parse user selection into task numbers.
   */
  private parseTaskSelection(
    selection: string,
    maxTasks: number,
  ): { tasks: number[]; selectAll: boolean } {
    const normalized = selection.toLowerCase().trim();

    // Check for "all" variations - including "all 3", "all three points", "do all"
    if (
      /\b(do\s+)?all(\s+\d+)?(\s+(points?|options?|tasks?|of\s+(them|the\s+above)))?\b/i.test(
        normalized,
      )
    ) {
      console.log('[Orchestrator] parseTaskSelection: matched "all" pattern');
      return { tasks: [], selectAll: true };
    }

    // Check for "everything" or "both" with context (not just "both" alone which could be a button label)
    // "both" alone is often an answer option, not a command to execute all tasks
    // Requires context like "do both", "both of them", "both options", "let's do both"
    if (
      /\b(everything|do\s+both|both\s+(of\s+(them|those|the\s+above)|options?|tasks?))\b/i.test(
        normalized,
      )
    ) {
      console.log(
        "[Orchestrator] parseTaskSelection: matched everything/both-with-context",
      );
      return { tasks: [], selectAll: true };
    }

    // Check for ordinal words
    const ordinalMap: Record<string, number> = {
      first: 1,
      "first one": 1,
      "1st": 1,
      second: 2,
      "second one": 2,
      "2nd": 2,
      third: 3,
      "third one": 3,
      "3rd": 3,
      fourth: 4,
      "fourth one": 4,
      "4th": 4,
      fifth: 5,
      "fifth one": 5,
      "5th": 5,
      last: maxTasks,
      "last one": maxTasks,
    };

    // Direct ordinal match (exact)
    if (ordinalMap[normalized]) {
      const num = ordinalMap[normalized];
      return { tasks: num <= maxTasks ? [num] : [], selectAll: false };
    }

    // Extract numbers from input (handles "1", "1 and 3", "1, 2, 3", "1 2 3", etc.)
    const numbers: number[] = [];

    // Match standalone numbers (but not things like "R12" or large numbers)
    const numberMatches = normalized.match(/\b(\d+)\b/g);
    if (numberMatches) {
      for (const match of numberMatches) {
        const num = parseInt(match, 10);
        // Only consider numbers 1-9 as task selections (ignore R12, R14, etc.)
        if (
          num >= 1 &&
          num <= Math.min(maxTasks, 9) &&
          !numbers.includes(num)
        ) {
          numbers.push(num);
        }
      }
    }

    // Also check for ordinals mixed with numbers ("first and 3")
    for (const [word, num] of Object.entries(ordinalMap)) {
      if (
        normalized.includes(word) &&
        num <= maxTasks &&
        !numbers.includes(num)
      ) {
        numbers.push(num);
      }
    }

    console.log("[Orchestrator] parseTaskSelection: parsed numbers:", numbers);
    return { tasks: numbers.sort((a, b) => a - b), selectAll: false };
  }

  /**
   * Check if buttons represent numbered tasks.
   */
  private hasNumberedTasks(buttons: ButtonOption[] | null): boolean {
    if (!buttons || buttons.length === 0) return false;

    // Check if buttons have numeric labels or are task-like
    // Tasks typically have labels like "1. Create action plan" or values like "task_1"
    // This should NOT match simple answer options like "Personal experience", "Both"
    const hasNumberedLabels = buttons.some(
      (b) =>
        /^\d+[\.\)]?\s/.test(b.label) || // Starts with number like "1. Create plan"
        /^task[_-]?\d+$/i.test(b.value) || // Value like task_1
        b.value.startsWith("option_"), // Generic option format
    );

    // Check if buttons look like actionable tasks (contain action verbs)
    const actionVerbs =
      /\b(create|build|research|analyze|develop|explore|define|validate|design|implement|start|do|make|write|generate)\b/i;
    const hasActionButtons = buttons.some((b) => actionVerbs.test(b.label));

    // Only treat as numbered tasks if buttons are explicitly numbered OR contain action verbs
    // Simple answer options like "Yes", "No", "Both" should NOT trigger quick-ack
    return hasNumberedLabels || (hasActionButtons && buttons.length >= 2);
  }

  /**
   * Check if input looks like a task selection.
   * More flexible - looks for patterns WITHIN the message, not exact match.
   */
  private isSelectionInput(input: string): boolean {
    const normalized = input.toLowerCase().trim();

    // Short input with just numbers (exact match)
    if (/^\d+(\s*(,|and|\+|&)\s*\d+)*$/.test(normalized)) {
      console.log("[Orchestrator] Task selection: just numbers");
      return true;
    }

    // Ordinal words (exact match for short inputs)
    if (
      /^(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)(\s+one)?$/i.test(
        normalized,
      )
    ) {
      console.log("[Orchestrator] Task selection: ordinal word");
      return true;
    }

    // "all" variations (exact match)
    if (
      /^(all|all of them|everything|do all|run all|both|do both)$/i.test(
        normalized,
      )
    ) {
      console.log("[Orchestrator] Task selection: all exact");
      return true;
    }

    // Single number with optional confirmation (exact match)
    if (/^\d+\s*(please|thanks|ok|okay)?$/i.test(normalized)) {
      console.log("[Orchestrator] Task selection: single number");
      return true;
    }

    // --- FLEXIBLE PATTERNS (search within message) ---

    // "all 3", "all three", "all of the above", "do all 3 points"
    if (
      /\b(do\s+)?(all\s*(\d+|three|four)?(\s+points?|\s+options?|\s+tasks?|\s+of\s+(them|the\s+above))?)\b/i.test(
        normalized,
      )
    ) {
      console.log("[Orchestrator] Task selection: all N pattern");
      return true;
    }

    // "1, 2, and 3" or "1 2 3" within longer text
    if (
      /\b(\d+\s*(,|and|&|\s)\s*)+\d+\b/.test(normalized) &&
      normalized.length < 200
    ) {
      console.log("[Orchestrator] Task selection: number list in text");
      return true;
    }

    // "options 1 and 2", "tasks 1, 2, 3", "points 1 2 3"
    if (
      /\b(options?|tasks?|points?|items?)\s+(\d+\s*(,|and|&|\s)\s*)*\d+\b/i.test(
        normalized,
      )
    ) {
      console.log("[Orchestrator] Task selection: labeled number list");
      return true;
    }

    // "the first and third", "first, second, and third"
    if (
      /\b(first|second|third|fourth|fifth)\s*(,|and|&)\s*(first|second|third|fourth|fifth)/i.test(
        normalized,
      )
    ) {
      console.log("[Orchestrator] Task selection: ordinal list");
      return true;
    }

    console.log(
      "[Orchestrator] Not a task selection:",
      normalized.substring(0, 50),
    );
    return false;
  }

  /**
   * Detect direct multi-artifact requests in user messages.
   * Patterns like "create 4 artifacts: 1) elevator pitch, 2) personas..."
   */
  private detectDirectArtifactRequest(
    userMessage: string,
  ): DirectArtifactRequest {
    const defaultResult: DirectArtifactRequest = {
      isDirectRequest: false,
      artifacts: [],
      contextText: "",
    };

    // Pattern 1: "create N artifacts" followed by numbered list
    // Example: "create 4 artifacts: 1) elevator pitch, 2) personas, 3) competitive analysis, 4) MVP features"
    const createArtifactsMatch = userMessage.match(
      /(?:create|generate|make|build|produce)\s+(\d+)\s+artifacts?\s*[:;]?\s*([\s\S]+)/i,
    );

    if (createArtifactsMatch) {
      // Parse count for validation (currently unused but may be used in future)
      void parseInt(createArtifactsMatch[1], 10);
      const listPart = createArtifactsMatch[2];

      // Extract numbered items: "1) item" or "1. item" or just comma-separated
      const numberedPattern =
        /(?:^|\s)(\d+)[.\)]\s*([^,\d]+?)(?=(?:\s*\d+[.\)])|,|$)/g;
      const artifacts: DirectArtifactRequest["artifacts"] = [];

      let match;
      while ((match = numberedPattern.exec(listPart)) !== null) {
        const label = match[2].trim().replace(/^and\s+/i, "");
        if (label.length > 2) {
          artifacts.push({
            label,
            type: this.inferTaskType("", label),
          });
        }
      }

      // If numbered extraction didn't work, try comma-separated
      if (artifacts.length < 2) {
        const commaSplit = listPart.split(/,\s*(?:and\s+)?/i);
        for (const item of commaSplit) {
          const cleaned = item.replace(/^\d+[.\)]\s*/, "").trim();
          if (cleaned.length > 2 && !cleaned.match(/^\d+$/)) {
            artifacts.push({
              label: cleaned,
              type: this.inferTaskType("", cleaned),
            });
          }
        }
      }

      if (artifacts.length >= 2) {
        console.log(
          "[Orchestrator] Direct artifact request detected:",
          artifacts.length,
          "artifacts",
        );
        // Extract context (the idea description before "create N artifacts")
        const contextMatch = userMessage.match(
          /^([\s\S]+?)(?:please\s+)?(?:create|generate|make)/i,
        );
        return {
          isDirectRequest: true,
          artifacts,
          contextText: contextMatch ? contextMatch[1].trim() : "",
        };
      }
    }

    // Pattern 2: "generate these:" or "create these artifacts:" followed by list
    const theseArtifactsMatch = userMessage.match(
      /(?:create|generate|make)\s+(?:these|the\s+following)\s*(?:artifacts?)?\s*[:;]\s*([\s\S]+)/i,
    );

    if (theseArtifactsMatch) {
      const listPart = theseArtifactsMatch[1];
      const artifacts: DirectArtifactRequest["artifacts"] = [];

      // Try numbered extraction first
      const numberedPattern = /(?:^|\n|\s)(\d+)[.\)]\s*([^\n,]+)/g;
      let match;
      while ((match = numberedPattern.exec(listPart)) !== null) {
        const label = match[2].trim();
        if (label.length > 2) {
          artifacts.push({
            label,
            type: this.inferTaskType("", label),
          });
        }
      }

      // Fall back to comma/newline separated
      if (artifacts.length < 2) {
        const items = listPart
          .split(/[,\n]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 2);
        for (const item of items) {
          const cleaned = item
            .replace(/^\d+[.\)]\s*/, "")
            .replace(/^[-*]\s*/, "");
          if (cleaned.length > 2) {
            artifacts.push({
              label: cleaned,
              type: this.inferTaskType("", cleaned),
            });
          }
        }
      }

      if (artifacts.length >= 2) {
        console.log(
          "[Orchestrator] Direct artifact request (these) detected:",
          artifacts.length,
          "artifacts",
        );
        const contextMatch = userMessage.match(
          /^([\s\S]+?)(?:please\s+)?(?:create|generate|make)/i,
        );
        return {
          isDirectRequest: true,
          artifacts,
          contextText: contextMatch ? contextMatch[1].trim() : "",
        };
      }
    }

    return defaultResult;
  }

  /**
   * Handle direct artifact request - spawn sub-agents for parallel artifact creation.
   */
  private async handleDirectArtifactRequest(
    session: IdeationSession,
    userMessage: string,
    artifactRequest: DirectArtifactRequest,
  ): Promise<OrchestratorResponse> {
    console.log(
      "[Orchestrator] handleDirectArtifactRequest - artifacts:",
      artifactRequest.artifacts.length,
    );

    // Build sub-agent tasks from artifact list
    const subAgentTasks: SubAgentTask[] = artifactRequest.artifacts.map(
      (artifact, index) => ({
        id: `artifact_${Date.now()}_${index}`,
        type: artifact.type,
        label: artifact.label,
        prompt: `Create artifact: ${artifact.label}. Context: ${artifactRequest.contextText}`,
        status: "pending" as const,
      }),
    );

    // Build acknowledgment message
    const acknowledgmentText =
      subAgentTasks.length === 1
        ? `On it...`
        : `Working on ${subAgentTasks.length} artifacts in parallel...`;

    // Store user message
    const userMsg = await messageStore.add({
      sessionId: session.id,
      role: "user",
      content: userMessage,
      tokenCount: Math.ceil(userMessage.length / 4),
    });

    // Store quick ack message
    const assistantMsg = await messageStore.add({
      sessionId: session.id,
      role: "assistant",
      content: acknowledgmentText,
      tokenCount: Math.ceil(acknowledgmentText.length / 4),
    });

    // Load current state for confidence/viability
    const existingCandidate = await candidateManager.getActiveForSession(
      session.id,
    );

    return {
      reply: acknowledgmentText,
      buttons: null,
      form: null,
      candidateUpdate: existingCandidate
        ? {
            title: existingCandidate.title,
            summary: existingCandidate.summary || undefined,
          }
        : null,
      confidence: existingCandidate?.confidence || 0,
      viability: existingCandidate?.viability || 100,
      risks: [],
      requiresIntervention: false,
      handoffOccurred: false,
      isQuickAck: true,
      subAgentTasks,
      acknowledgmentText,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
    };
  }

  /**
   * Handle quick acknowledgment for task selection.
   * Returns immediately with "On it..." and includes tasks for background execution.
   */
  private async handleQuickAcknowledgment(
    session: IdeationSession,
    userMessage: string,
    taskSelection: TaskSelectionResult & {
      _numberedOptions?: Array<{
        number: number;
        text: string;
        value?: string;
      }>;
    },
    lastAssistantMessage: IdeationMessage,
  ): Promise<OrchestratorResponse> {
    // Use extracted numbered options from text, or fall back to buttons
    const options =
      taskSelection._numberedOptions ||
      (lastAssistantMessage.buttonsShown || []).map((b, i) => ({
        number: i + 1,
        text: b.label,
        value: b.value,
      }));

    console.log(
      "[Orchestrator] handleQuickAcknowledgment - options:",
      options.length,
    );
    console.log(
      "[Orchestrator] handleQuickAcknowledgment - selectedTasks:",
      taskSelection.selectedTasks,
    );

    // Build list of selected tasks
    const selectedTasks: SubAgentTask[] = taskSelection.selectedTasks
      .filter((num) => num >= 1 && num <= options.length)
      .map((num, index) => {
        const option =
          options.find((o) => o.number === num) || options[num - 1];
        if (!option) return null;
        return {
          id: `task_${Date.now()}_${index}`,
          type: this.inferTaskType(option.value || "", option.text),
          label: option.text,
          prompt: option.value || option.text,
          status: "pending" as const,
        } as SubAgentTask;
      })
      .filter((t): t is SubAgentTask => t !== null);

    console.log(
      "[Orchestrator] handleQuickAcknowledgment - built tasks:",
      selectedTasks.length,
    );

    if (selectedTasks.length === 0) {
      // No valid tasks selected, fall through to normal processing
      console.log(
        "[Orchestrator] handleQuickAcknowledgment - no tasks, returning error",
      );
      return {
        reply:
          "I couldn't identify which tasks you selected. Could you clarify?",
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
    const acknowledgmentText =
      selectedTasks.length === 1
        ? `On it...`
        : `Working on ${selectedTasks.length} tasks...`;

    // Store user message
    const userMsg = await messageStore.add({
      sessionId: session.id,
      role: "user",
      content: userMessage,
      tokenCount: Math.ceil(userMessage.length / 4),
    });

    // Store quick ack message
    const assistantMsg = await messageStore.add({
      sessionId: session.id,
      role: "assistant",
      content: acknowledgmentText,
      tokenCount: Math.ceil(acknowledgmentText.length / 4),
    });

    // Load current state for confidence/viability
    const existingCandidate = await candidateManager.getActiveForSession(
      session.id,
    );

    return {
      reply: acknowledgmentText,
      buttons: null,
      form: null,
      candidateUpdate: existingCandidate
        ? {
            title: existingCandidate.title,
            summary: existingCandidate.summary || undefined,
          }
        : null,
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
  private inferTaskType(value: string, label: string): SubAgentTask["type"] {
    const combined = `${value} ${label}`.toLowerCase();

    if (
      combined.includes("action") ||
      combined.includes("plan") ||
      combined.includes("roadmap")
    ) {
      return "action-plan";
    }
    if (
      combined.includes("pitch") ||
      combined.includes("refine") ||
      combined.includes("elevator")
    ) {
      return "pitch-refine";
    }
    if (
      combined.includes("architecture") ||
      combined.includes("technical") ||
      combined.includes("system")
    ) {
      return "architecture-explore";
    }
    return "custom";
  }

  // ============================================================================
  // IDEA TYPE CLASSIFICATION FLOW
  // ============================================================================

  /**
   * The idea type buttons shown to the user at session start.
   */
  private getIdeaTypeButtons(): ButtonOption[] {
    return [
      {
        id: "idea_type_business",
        label: "New business idea",
        value: "idea_type:business",
        style: "primary",
      },
      {
        id: "idea_type_feature_internal",
        label: "Feature for my existing idea",
        value: "idea_type:feature_internal",
        style: "secondary",
      },
      {
        id: "idea_type_feature_external",
        label: "Feature for external platform",
        value: "idea_type:feature_external",
        style: "secondary",
      },
      {
        id: "idea_type_service",
        label: "Service business",
        value: "idea_type:service",
        style: "secondary",
      },
      {
        id: "idea_type_pivot",
        label: "Pivoting an existing idea",
        value: "idea_type:pivot",
        style: "secondary",
      },
    ];
  }

  /**
   * Generate buttons for selecting an existing idea as parent.
   */
  private async getExistingIdeaButtons(): Promise<ButtonOption[]> {
    // Get existing ideas from database
    const ideas = await query<{ slug: string; title: string }>(
      "SELECT slug, title FROM ideas ORDER BY updated_at DESC LIMIT 10",
    );

    const buttons: ButtonOption[] = ideas.map((idea, index) => ({
      id: `parent_idea_${index}`,
      label:
        idea.title.substring(0, 40) + (idea.title.length > 40 ? "..." : ""),
      value: `parent_idea:${idea.slug}`,
      style: "secondary" as const,
    }));

    // Add option to type manually
    buttons.push({
      id: "parent_idea_none",
      label: "None of these / Create without parent",
      value: "parent_idea:none",
      style: "outline",
    });

    return buttons;
  }

  /**
   * Handle idea type classification flow at session start.
   * Returns a response if in classification flow, null to continue normal processing.
   */
  private async handleIdeaTypeClassification(
    session: IdeationSession,
    userMessage: string,
    messages: IdeationMessage[],
    lastAssistantMessage: IdeationMessage | undefined,
  ): Promise<OrchestratorResponse | null> {
    // Load current idea type selection state
    const ideaTypeState = await memoryManager.loadIdeaTypeSelection(session.id);
    console.log(
      "[Orchestrator] Idea type state:",
      JSON.stringify(ideaTypeState),
    );

    // If idea type is already selected and all follow-ups are complete, skip this flow
    if (
      ideaTypeState.ideaTypeSelected &&
      !ideaTypeState.parentSelectionNeeded
    ) {
      console.log(
        "[Orchestrator] Idea type already selected, skipping classification flow",
      );
      return null;
    }

    // If parent selection is needed and completed, skip this flow
    if (ideaTypeState.parentSelectionNeeded && ideaTypeState.parentSelected) {
      console.log(
        "[Orchestrator] Parent already selected, skipping classification flow",
      );
      return null;
    }

    // Check if the last message was asking for idea type selection
    const lastMessageAskedIdeaType =
      lastAssistantMessage?.buttonsShown?.some((b) =>
        b.value.startsWith("idea_type:"),
      ) || false;

    // Check if the last message was asking for parent selection
    const lastMessageAskedParent =
      lastAssistantMessage?.buttonsShown?.some(
        (b) =>
          b.value.startsWith("parent_idea:") ||
          b.value.startsWith("parent_platform:"),
      ) || false;

    // Case 1: User is responding to idea type question
    if (lastMessageAskedIdeaType && userMessage.startsWith("idea_type:")) {
      return this.handleIdeaTypeSelection(session, userMessage, ideaTypeState);
    }

    // Case 2: User is responding to parent selection question
    if (
      lastMessageAskedParent &&
      (userMessage.startsWith("parent_idea:") ||
        userMessage.startsWith("parent_platform:") ||
        ideaTypeState.parentSelectionNeeded)
    ) {
      return this.handleParentSelection(session, userMessage, ideaTypeState);
    }

    // Case 3: This is a new session (only greeting message exists) - ask idea type
    // The greeting is the first assistant message, so if we only have 1 assistant message
    // and the user just sent their first response, we should ask about idea type
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const userMessages = messages.filter((m) => m.role === "user");

    // Only trigger idea type question if:
    // 1. There's only the initial greeting (1 assistant message)
    // 2. No user messages yet (this is their first message)
    // 3. Idea type hasn't been asked yet
    if (
      assistantMessages.length === 1 &&
      userMessages.length === 0 &&
      !ideaTypeState.ideaTypeSelected
    ) {
      return this.askIdeaTypeQuestion(session, userMessage);
    }

    // Not in classification flow
    return null;
  }

  /**
   * Ask the user about the type of idea they want to explore.
   */
  private async askIdeaTypeQuestion(
    session: IdeationSession,
    userMessage: string,
  ): Promise<OrchestratorResponse> {
    // Store the user's first message
    const userMsg = await messageStore.add({
      sessionId: session.id,
      role: "user",
      content: userMessage,
      tokenCount: Math.ceil(userMessage.length / 4),
    });

    // Generate the idea type question
    const responseText = `Thanks for sharing! Before we dive deeper, let me understand what type of idea you're exploring. This helps me tailor my questions and analysis.

What kind of idea is this?`;

    const buttons = this.getIdeaTypeButtons();

    // Store the assistant message with idea type buttons
    const assistantMsg = await messageStore.add({
      sessionId: session.id,
      role: "assistant",
      content: responseText,
      buttonsShown: buttons,
      tokenCount: Math.ceil(responseText.length / 4),
    });

    return {
      reply: responseText,
      buttons,
      form: null,
      candidateUpdate: null,
      confidence: 0,
      viability: 100,
      risks: [],
      requiresIntervention: false,
      handoffOccurred: false,
      isQuickAck: false,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
    };
  }

  /**
   * Handle the user's idea type selection.
   */
  private async handleIdeaTypeSelection(
    session: IdeationSession,
    userMessage: string,
    currentState: IdeaTypeSelectionState,
  ): Promise<OrchestratorResponse> {
    // Parse the idea type from the button value
    const ideaType = userMessage.replace("idea_type:", "") as IdeaTypeSelection;
    console.log("[Orchestrator] User selected idea type:", ideaType);

    // Determine if parent selection is needed
    const needsParent = [
      "feature_internal",
      "feature_external",
      "pivot",
    ].includes(ideaType);

    // Update the state
    const updatedState: IdeaTypeSelectionState = {
      ...currentState,
      ideaTypeSelected: true,
      ideaType,
      parentSelectionNeeded: needsParent,
      parentSelected: !needsParent, // Mark as selected if not needed
    };

    // Persist the state
    await memoryManager.updateIdeaTypeSelection(session.id, updatedState);

    // Store the user message (showing the button label)
    const buttonLabel =
      this.getIdeaTypeButtons().find((b) => b.value === userMessage)?.label ||
      userMessage;
    const userMsg = await messageStore.add({
      sessionId: session.id,
      role: "user",
      content: buttonLabel,
      tokenCount: Math.ceil(buttonLabel.length / 4),
    });

    // If parent selection is needed, ask the follow-up question
    if (needsParent) {
      return this.askParentSelectionQuestion(session, ideaType, userMsg.id);
    }

    // Otherwise, confirm selection and proceed
    const confirmText = this.getIdeaTypeConfirmation(ideaType);

    const assistantMsg = await messageStore.add({
      sessionId: session.id,
      role: "assistant",
      content: confirmText,
      tokenCount: Math.ceil(confirmText.length / 4),
    });

    return {
      reply: confirmText,
      buttons: null,
      form: null,
      candidateUpdate: null,
      confidence: 0,
      viability: 100,
      risks: [],
      requiresIntervention: false,
      handoffOccurred: false,
      isQuickAck: false,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
    };
  }

  /**
   * Ask the follow-up question for parent selection.
   */
  private async askParentSelectionQuestion(
    session: IdeationSession,
    ideaType: IdeaTypeSelection,
    userMsgId: string,
  ): Promise<OrchestratorResponse> {
    let questionText: string;
    let buttons: ButtonOption[];

    if (ideaType === "feature_internal") {
      questionText = `Got it - you want to add a feature to one of your existing ideas. Which idea is this feature for?`;
      buttons = await this.getExistingIdeaButtons();
    } else if (ideaType === "feature_external") {
      questionText = `Interesting! You want to build something that extends an external platform. What platform or product would this feature be for?

You can type the name of the platform (e.g., "Shopify", "Slack", "Notion") or select from common options:`;
      buttons = [
        {
          id: "platform_shopify",
          label: "Shopify",
          value: "parent_platform:shopify",
          style: "secondary",
        },
        {
          id: "platform_slack",
          label: "Slack",
          value: "parent_platform:slack",
          style: "secondary",
        },
        {
          id: "platform_notion",
          label: "Notion",
          value: "parent_platform:notion",
          style: "secondary",
        },
        {
          id: "platform_wordpress",
          label: "WordPress",
          value: "parent_platform:wordpress",
          style: "secondary",
        },
        {
          id: "platform_other",
          label: "Other (I'll type it)",
          value: "parent_platform:other",
          style: "outline",
        },
      ];
    } else if (ideaType === "pivot") {
      questionText = `I see - you're looking to pivot an existing idea. Which idea are you pivoting from?`;
      buttons = await this.getExistingIdeaButtons();
    } else {
      // Should not reach here, but handle gracefully
      questionText = `Let's continue exploring your idea.`;
      buttons = [];
    }

    const assistantMsg = await messageStore.add({
      sessionId: session.id,
      role: "assistant",
      content: questionText,
      buttonsShown: buttons,
      tokenCount: Math.ceil(questionText.length / 4),
    });

    return {
      reply: questionText,
      buttons,
      form: null,
      candidateUpdate: null,
      confidence: 0,
      viability: 100,
      risks: [],
      requiresIntervention: false,
      handoffOccurred: false,
      isQuickAck: false,
      userMessageId: userMsgId,
      assistantMessageId: assistantMsg.id,
    };
  }

  /**
   * Handle the user's parent selection.
   */
  private async handleParentSelection(
    session: IdeationSession,
    userMessage: string,
    currentState: IdeaTypeSelectionState,
  ): Promise<OrchestratorResponse> {
    console.log("[Orchestrator] Processing parent selection:", userMessage);

    let parentType: "internal" | "external" | null = null;
    let parentSlug: string | null = null;
    let parentName: string | null = null;
    let buttonLabel = userMessage;

    if (userMessage.startsWith("parent_idea:")) {
      const slug = userMessage.replace("parent_idea:", "");
      if (slug !== "none") {
        parentType = "internal";
        parentSlug = slug;
        // Get the title for display
        const ideas = await query<{ title: string }>(
          "SELECT title FROM ideas WHERE slug = ?",
          [slug],
        );
        buttonLabel = ideas[0]?.title || slug;
      } else {
        buttonLabel = "None of these / Create without parent";
      }
    } else if (userMessage.startsWith("parent_platform:")) {
      const platform = userMessage.replace("parent_platform:", "");
      if (platform !== "other") {
        parentType = "external";
        parentName = platform.charAt(0).toUpperCase() + platform.slice(1); // Capitalize
        buttonLabel = parentName;
      } else {
        buttonLabel = "Other (I'll type it)";
      }
    } else {
      // User typed a custom platform name
      parentType = "external";
      parentName = userMessage;
      buttonLabel = userMessage;
    }

    // Update the state
    const updatedState: IdeaTypeSelectionState = {
      ...currentState,
      parentSelected: true,
      parentType,
      parentSlug,
      parentName,
    };

    // Persist the state
    await memoryManager.updateIdeaTypeSelection(session.id, updatedState);

    // Store the user message
    const userMsg = await messageStore.add({
      sessionId: session.id,
      role: "user",
      content: buttonLabel,
      tokenCount: Math.ceil(buttonLabel.length / 4),
    });

    // Generate confirmation and continue
    const confirmText = this.getParentSelectionConfirmation(
      currentState.ideaType!,
      parentType,
      parentSlug,
      parentName,
    );

    const assistantMsg = await messageStore.add({
      sessionId: session.id,
      role: "assistant",
      content: confirmText,
      tokenCount: Math.ceil(confirmText.length / 4),
    });

    return {
      reply: confirmText,
      buttons: null,
      form: null,
      candidateUpdate: null,
      confidence: 0,
      viability: 100,
      risks: [],
      requiresIntervention: false,
      handoffOccurred: false,
      isQuickAck: false,
      userMessageId: userMsg.id,
      assistantMessageId: assistantMsg.id,
    };
  }

  /**
   * Get confirmation text for idea type selection.
   */
  private getIdeaTypeConfirmation(ideaType: IdeaTypeSelection): string {
    switch (ideaType) {
      case "business":
        return `Perfect - we're exploring a new business idea. I'll focus on market opportunity, target customers, and viability.

Now, tell me more about what you're thinking. What problem are you trying to solve, or what opportunity have you spotted?`;
      case "service":
        return `Great - a service business. I'll focus on your unique skills, target clients, and how to package and price your offering.

What kind of service are you thinking about? What makes you well-suited to offer it?`;
      default:
        return `Got it. Let's explore this idea together.

What's the core concept you're working with?`;
    }
  }

  /**
   * Get confirmation text for parent selection.
   */
  private getParentSelectionConfirmation(
    ideaType: IdeaTypeSelection,
    _parentType: "internal" | "external" | null,
    parentSlug: string | null,
    parentName: string | null,
  ): string {
    if (ideaType === "feature_internal" && parentSlug) {
      return `Perfect - you're adding a feature to your existing idea. I'll keep that context in mind as we explore.

What feature are you thinking about adding? What problem would it solve?`;
    }

    if (ideaType === "feature_external" && parentName) {
      return `Got it - you want to build something for ${parentName}. I'll consider platform constraints and ecosystem dynamics as we explore.

What would this feature or extension do? What gap does it fill?`;
    }

    if (ideaType === "pivot" && parentSlug) {
      return `I see - you're pivoting from an existing idea. Understanding what worked and didn't will be valuable here.

What's driving the pivot? What did you learn from the original direction?`;
    }

    // No parent selected or fallback
    return `Alright, let's explore this idea together.

Tell me more about what you're thinking. What's the core concept?`;
  }
}

// Singleton
export const agentOrchestrator = new AgentOrchestrator();
