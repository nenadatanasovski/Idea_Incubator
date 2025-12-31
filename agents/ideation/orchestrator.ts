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
} from '../../types/ideation.js';
import { sessionManager } from './session-manager.js';
import { messageStore } from './message-store.js';
import { memoryManager } from './memory-manager.js';
import { candidateManager } from './candidate-manager.js';
import { extractSignals, ParsedAgentResponse } from './signal-extractor.js';
import { calculateConfidence } from './confidence-calculator.js';
import { calculateViability } from './viability-calculator.js';
import { calculateTokenUsage } from './token-counter.js';
import { prepareHandoff } from './handoff.js';
import { buildSystemPrompt } from './system-prompt.js';
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from '../../utils/ideation-defaults.js';

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
}

export class AgentOrchestrator {
  private client: typeof anthropicClient;

  constructor() {
    this.client = anthropicClient;
  }

  /**
   * Process a user message and return the agent's response.
   */
  async processMessage(
    session: IdeationSession,
    userMessage: string,
    userProfile: Record<string, unknown>
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

    // Build context
    const context = await this.buildContext(session, messages, userProfile, handoffOccurred);

    // Add user message to context
    context.messages.push({ role: 'user', content: userMessage });

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

    const viabilityResult = calculateViability({
      selfDiscovery: selfDiscovery as SelfDiscoveryState,
      marketDiscovery: marketDiscovery as MarketDiscoveryState,
      narrowingState: narrowingState as NarrowingState,
      webSearchResults: [], // Populated from web search if available
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

    // Store messages
    await messageStore.add({
      sessionId: session.id,
      role: 'user',
      content: userMessage,
      tokenCount: Math.ceil(userMessage.length / 4),
    });

    await messageStore.add({
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
    };
  }

  /**
   * Build context for agent call.
   */
  private async buildContext(
    session: IdeationSession,
    messages: IdeationMessage[],
    userProfile: Record<string, unknown>,
    isHandoff: boolean
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

    const systemPrompt = buildSystemPrompt(userProfile, memoryFiles);

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

    // Try to parse as JSON
    try {
      // Find JSON in response (may be wrapped in markdown code blocks)
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { reply: text };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        reply: parsed.text || text,
        buttons: parsed.buttons,
        formFields: parsed.form,
        signals: parsed.signals,
        candidateTitle: parsed.candidateUpdate?.title,
        candidateSummary: parsed.candidateUpdate?.summary,
      };
    } catch {
      // If JSON parsing fails, treat entire response as text
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
