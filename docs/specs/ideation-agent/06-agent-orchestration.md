# Spec 6: Agent Orchestration & LLM Integration

## Overview

This specification covers the agent orchestration layer, system prompt, response parsing, greeting generation, and web search integration.

## Dependencies

- Spec 1-5: All previous specifications
- Anthropic client from `utils/anthropic-client.ts`

---

## 1. System Prompt

Create file: `agents/ideation/system-prompt.ts`

```typescript
/**
 * IDEATION AGENT SYSTEM PROMPT
 *
 * Defines the agent's behavior, questioning strategy, and output format.
 */

export const IDEATION_AGENT_SYSTEM_PROMPT = `
You are the Ideation Agent — a sophisticated interviewer who helps users discover business ideas by exploring themselves and the market.

## YOUR GOAL
Help the user discover themselves (interests, expertise, impact vision) and the market (gaps, opportunities, timing), then identify realistic overlap to surface viable business ideas.

## CONTEXT LIMIT
You have 100,000 tokens of context. At ~80% usage, you will hand off to a new instance with preserved memory. The handoff will be seamless to the user.

## YOUR METHOD: DUAL-MODE QUESTIONING

### Mode 1: Covert Extraction (for testing, narrowing)
- Extract information without revealing assessment purpose
- Test knowledge/skills through natural conversation
- Narrow possibilities silently based on accumulated signals

### Mode 2: Transparent Inquiry (for context-building)
- Reveal why you're asking when referencing previous answers
- Explain the purpose when clarity helps the user
- Build trust through transparency

**When to reveal purpose:**
- Referencing previous answers → Explain the connection
- Need specific info → Explain why you need it
- User seems confused → Provide context

**Keep covert:**
- Testing domain knowledge
- Assessing skill level
- Internal narrowing decisions

## KEY AREAS TO POPULATE

### Self-Discovery
- Impact Vision (world/country/city/community)
- Frustrations (specific, personal)
- Expertise (what they know others don't)
- Interests (what energizes them)
- Skills (tested through conversation)
- Constraints (location, time, capital, risk)

### Market Discovery
- Competitors (who's playing)
- Gaps (what's missing)
- Timing (why now)
- Failed attempts (what didn't work)
- Location context (local opportunities)

### Narrowing Dimensions (track internally)
- Product type: Digital/Physical/Hybrid/Service
- Customer type: B2B/B2C/B2B2C/Marketplace
- Geography: Local/National/Global
- Scale: Lifestyle/Growth/Venture
- Technical depth: No-code/Low-code/Full custom

## USER-SUGGESTED IDEAS

Users can suggest ideas at any time. When they do:
1. Acknowledge positively but neutrally
2. Connect to prior conversation
3. Ask targeted follow-up questions
4. Run market validation
5. Continue naturally (don't restart)

Example:
USER: "What about a marketplace for vintage synthesizers?"
YOU: "That's a concrete idea — let's explore it. What drew you to this specifically? Personal experience with buying/selling, or something you observed?"

## DUAL METERING SYSTEM

### Confidence (how well-defined)
Track internally. When > 30%, an idea candidate appears in the UI.
Components: Problem definition, Target user, Solution direction, Differentiation, User fit

### Viability (how realistic)
Based on web search evidence. Monitor continuously.
- 75-100%: Healthy — continue
- 50-74%: Caution — mention concerns
- 25-49%: Warning — pause and discuss
- 0-24%: Critical — must address

Risk factors (flag these):
- Impossible: Technology doesn't exist
- Unrealistic: Beyond user's capacity
- Too Complex: Too many hard problems
- Too Vague: Can't be validated
- Saturated Market: Too many competitors
- Wrong Timing: Too early or late

## VIABILITY INTERVENTION

When viability drops below 50%, pause and explain:

"I want to pause here and share something important.

Based on what I'm finding, this direction has some significant challenges:

1. [Specific concern with source URL]
2. [Specific concern with source URL]

This doesn't mean the idea is bad — but these are real obstacles.

[Present options as buttons]"

Options to offer:
- Explore how to address these challenges
- Pivot to a related but more viable direction
- Continue anyway — I understand the risks
- Discard and start fresh

## BUTTON USAGE

Present multiple choice options as buttons. Format:

When asking about customer type:
BUTTONS: [Individual consumers] [Small businesses] [Enterprise] [I'm not sure]

For viability interventions:
BUTTONS: [Address challenges] [Pivot direction] [Continue anyway] [Start fresh]

Always include an "unsure" or "skip" option.

## FORM USAGE

For multi-question efficient collection:
FORM:
- field: geography, type: radio, options: [My city only, National, Global, Flexible]
- field: product_type, type: checkbox, options: [Digital, Physical, Service, Marketplace]
- field: hours_per_week, type: slider, min: 0, max: 40

## WEB SEARCH

Use web search to:
- Validate market exists
- Find competitors
- Check for failed attempts
- Verify timing signals
- Support viability assessment

Always cite sources when sharing findings.

If search returns no data:
"I searched for [query] but found limited data. This could mean:
1. Emerging opportunity (first-mover or premature)
2. Different terminology exists
3. Primary research needed

Sources checked: [list]
My reasoning: [analysis]"

## CONVERSATION RULES

1. One question or focused form at a time
2. Mix question types to maintain engagement
3. Reference previous answers when relevant (explain why)
4. Include occasional witty one-liner (~10% of responses)
5. Keep tone neutral and curious
6. Never over-praise or be effusive
7. Be honest about challenges

**Witty interjections (use sparingly):**
- "Ah, the classic 'surely someone's solved this' moment. Usually they haven't, or they've done it poorly."
- "That's either a terrible idea or a brilliant one. Often the same thing."
- "Most people say 'everyone' when asked who'd use their idea. You didn't. That's good."

## WHAT NOT TO DO

- Don't always hide question purpose (reveal when helpful)
- Don't over-structure ("Question 7 of 20...")
- Don't push toward specific ideas
- Don't ignore user-suggested ideas
- Don't skip viability warnings
- Don't make users type when buttons work
- Don't re-ask profile questions (already captured)
- Don't get into implementation details (for Development phase)

## OUTPUT FORMAT

Your response must be valid JSON in this structure:
{
  "text": "Your conversational reply",
  "buttons": [
    {"id": "btn_1", "label": "Option 1", "value": "option_1", "style": "primary"},
    {"id": "btn_2", "label": "Option 2", "value": "option_2", "style": "secondary"}
  ] | null,
  "form": { ... } | null,
  "webSearchNeeded": ["query 1", "query 2"] | null,
  "candidateUpdate": {
    "title": "Idea title",
    "summary": "Brief summary"
  } | null,
  "signals": {
    "selfDiscovery": { ... },
    "marketDiscovery": { ... },
    "narrowing": { ... }
  }
}

## USER PROFILE
{{USER_PROFILE}}

## MEMORY FILES (if handoff)
{{MEMORY_FILES}}
`;

export const USER_PROFILE_PLACEHOLDER = "{{USER_PROFILE}}";
export const MEMORY_FILES_PLACEHOLDER = "{{MEMORY_FILES}}";
```

---

## 2. Agent Orchestrator

Create file: `agents/ideation/orchestrator.ts`

````typescript
import Anthropic from "@anthropic-ai/sdk";
import { getConfig } from "../../config/index.js";
import { getAnthropicClient } from "../../utils/anthropic-client.js";
import {
  IdeationSession,
  IdeationMessage,
  ButtonOption,
  FormDefinition,
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
} from "../../types/ideation.js";
import { sessionManager } from "./session-manager.js";
import { messageStore } from "./message-store.js";
import { memoryManager } from "./memory-manager.js";
import { extractSignals, ParsedAgentResponse } from "./signal-extractor.js";
import { calculateConfidence } from "./confidence-calculator.js";
import { calculateViability } from "./viability-calculator.js";
import { calculateTokenUsage } from "./token-counter.js";
import { prepareHandoff } from "./handoff.js";
import {
  IDEATION_AGENT_SYSTEM_PROMPT,
  USER_PROFILE_PLACEHOLDER,
  MEMORY_FILES_PLACEHOLDER,
} from "./system-prompt.js";

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
  requiresIntervention: boolean;
  handoffOccurred: boolean;
}

export class AgentOrchestrator {
  private client: Anthropic;

  constructor() {
    this.client = getAnthropicClient();
  }

  /**
   * Process a user message and return the agent's response.
   */
  async processMessage(
    session: IdeationSession,
    userMessage: string,
    userProfile: Record<string, unknown>,
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
    const context = await this.buildContext(
      session,
      messages,
      userProfile,
      handoffOccurred,
    );

    // Add user message to context
    context.messages.push({ role: "user", content: userMessage });

    // Call Claude
    const response = await this.client.messages.create({
      model: getConfig().model || "claude-sonnet-4-20250514",
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

    // Calculate meters
    const confidenceResult = calculateConfidence({
      selfDiscovery: selfDiscovery as SelfDiscoveryState,
      marketDiscovery: marketDiscovery as MarketDiscoveryState,
      narrowingState: narrowingState as NarrowingState,
      candidate: parsed.candidateTitle
        ? { title: parsed.candidateTitle, summary: parsed.candidateSummary }
        : null,
      userConfirmations: this.countConfirmations(messages),
    });

    const viabilityResult = calculateViability({
      selfDiscovery: selfDiscovery as SelfDiscoveryState,
      marketDiscovery: marketDiscovery as MarketDiscoveryState,
      narrowingState: narrowingState as NarrowingState,
      webSearchResults: [], // Populated from web search if available
      candidate: parsed.candidateTitle
        ? { id: "", title: parsed.candidateTitle }
        : null,
    });

    // Update memory files
    await memoryManager.updateAll(session.id, {
      selfDiscovery: selfDiscovery as SelfDiscoveryState,
      marketDiscovery: marketDiscovery as MarketDiscoveryState,
      narrowingState: narrowingState as NarrowingState,
      candidate: parsed.candidateTitle
        ? {
            id: "",
            sessionId: session.id,
            title: parsed.candidateTitle,
            summary: parsed.candidateSummary || null,
            confidence: confidenceResult.total,
            viability: viabilityResult.total,
            userSuggested: false,
            status: "forming",
            capturedIdeaId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : null,
      viability: { total: viabilityResult.total, risks: viabilityResult.risks },
    });

    return {
      reply: parsed.reply,
      buttons: parsed.buttons || null,
      form: (parsed.formFields as FormDefinition) || null,
      candidateUpdate: parsed.candidateTitle
        ? {
            title: parsed.candidateTitle,
            summary: parsed.candidateSummary,
          }
        : null,
      confidence: confidenceResult.total,
      viability: viabilityResult.total,
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
    isHandoff: boolean,
  ): Promise<AgentContext> {
    let systemPrompt = IDEATION_AGENT_SYSTEM_PROMPT;

    // Insert user profile
    systemPrompt = systemPrompt.replace(
      USER_PROFILE_PLACEHOLDER,
      JSON.stringify(userProfile, null, 2),
    );

    // Insert memory files if handoff
    if (isHandoff || session.handoffCount > 0) {
      const memoryFiles = await memoryManager.getAll(session.id);
      const memoryContent = memoryFiles
        .map((f) => `## ${f.fileType}\n${f.content}`)
        .join("\n\n");
      systemPrompt = systemPrompt.replace(
        MEMORY_FILES_PLACEHOLDER,
        memoryContent,
      );
    } else {
      systemPrompt = systemPrompt.replace(
        MEMORY_FILES_PLACEHOLDER,
        "No previous handoff.",
      );
    }

    // Convert messages to API format
    const apiMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    return { messages: apiMessages, systemPrompt };
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

    // Try to parse as JSON
    try {
      // Find JSON in response (may be wrapped in markdown code blocks)
      const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || [
        null,
        text,
      ];
      const jsonStr = jsonMatch[1] || text;

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
    // In a full implementation, this would parse the memory files
    // For now, return empty state
    return {
      selfDiscovery: {},
      marketDiscovery: {},
      narrowing: {},
    };
  }

  /**
   * Merge existing state with new signals.
   */
  private mergeState<T extends Record<string, unknown>>(
    existing: Partial<T>,
    updates: Partial<T>,
  ): Partial<T> {
    return { ...existing, ...updates };
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
    messages: IdeationMessage[],
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
}

// Singleton
export const agentOrchestrator = new AgentOrchestrator();
````

---

## 3. Greeting Generator

Create file: `agents/ideation/greeting-generator.ts`

```typescript
import { ButtonOption } from "../../types/ideation.js";

/**
 * GREETING GENERATOR
 *
 * Creates a personalized opening message based on user profile.
 */

export interface UserProfile {
  name?: string;
  skills?: string[];
  interests?: string[];
  experience?: {
    industries?: string[];
    years?: number;
  };
  location?: {
    city?: string;
    country?: string;
  };
}

export interface GreetingWithButtons {
  text: string;
  buttons: ButtonOption[];
}

/**
 * Generate personalized greeting based on user profile.
 */
export function generateGreeting(profile: UserProfile): string {
  const parts: string[] = [];

  // Opening
  parts.push(
    "Welcome! I'm here to help you discover a business idea that's genuinely right for you.",
  );

  // Process explanation
  parts.push(`
Here's how this works: We'll have a conversation where I ask questions, you answer, and together we'll explore what excites you and what the market needs. As we go, I'll be looking for where those two things overlap.

When I spot a promising idea, it'll appear in the panel on the right. I'll also let you know if I see significant challenges — better to know early than waste time on something that won't work.

Feel free to suggest any ideas you've been thinking about — I'll help you explore and validate them.`);

  // Profile-based personalization
  const personalizations: string[] = [];

  // Technical skills
  const technicalSkills =
    profile.skills?.filter((s) =>
      [
        "programming",
        "software",
        "development",
        "engineering",
        "data",
        "design",
      ].some((t) => s.toLowerCase().includes(t)),
    ) || [];

  if (technicalSkills.length > 0) {
    personalizations.push(
      `technical background in ${technicalSkills.slice(0, 2).join(" and ")}`,
    );
  }

  // Domain experience
  if (
    profile.experience?.industries &&
    profile.experience.industries.length > 0
  ) {
    personalizations.push(
      `experience in ${profile.experience.industries.slice(0, 2).join(" and ")}`,
    );
  }

  // Interests from profile
  if (profile.interests && profile.interests.length > 0) {
    personalizations.push(
      `interest in ${profile.interests.slice(0, 2).join(" and ")}`,
    );
  }

  // Location
  if (profile.location?.city) {
    personalizations.push(`based in ${profile.location.city}`);
  }

  if (personalizations.length > 0) {
    parts.push(
      `\nI've loaded your profile, so I know you have ${personalizations.join(", ")}. Let's use that as our starting point.`,
    );
  } else {
    parts.push(
      `\nI've loaded your profile. Let's use what I know about you as our starting point.`,
    );
  }

  // Opening question
  parts.push(`
What's been occupying your mind lately? Any problems you've noticed, frustrations you've had, or opportunities you've wondered about?`);

  return parts.join("\n");
}

/**
 * Generate greeting with buttons for common starting points.
 */
export function generateGreetingWithButtons(
  profile: UserProfile,
): GreetingWithButtons {
  return {
    text: generateGreeting(profile),
    buttons: [
      {
        id: "btn_frustration",
        label: "Something frustrates me",
        value:
          "There's something that frustrates me that I think could be better",
        style: "secondary",
      },
      {
        id: "btn_idea",
        label: "I have a rough idea",
        value: "I have a rough idea I've been thinking about",
        style: "secondary",
      },
      {
        id: "btn_explore",
        label: "Help me explore",
        value: "I don't have anything specific, help me explore",
        style: "secondary",
      },
    ],
  };
}

/**
 * Generate a greeting for a returning user.
 */
export function generateReturningGreeting(
  profile: UserProfile,
  lastSessionSummary?: string,
): string {
  let greeting = `Welcome back${profile.name ? `, ${profile.name}` : ""}! `;

  if (lastSessionSummary) {
    greeting += `Last time, ${lastSessionSummary}\n\n`;
    greeting += `Would you like to continue where we left off, or start fresh with something new?`;
  } else {
    greeting += `Ready to explore some ideas?\n\n`;
    greeting += generateGreeting(profile).split("\n\n").slice(-1)[0];
  }

  return greeting;
}
```

---

## 3a. Streaming Response Handler

Create file: `agents/ideation/streaming.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "events";

/**
 * STREAMING RESPONSE HANDLER
 *
 * Implements Server-Sent Events (SSE) for real-time chat experience.
 * Streams text tokens as they're generated, with final JSON parse.
 */

export interface StreamEvent {
  type: "text_delta" | "message_complete" | "error" | "tool_use";
  data: string | AgentResponse | Error | ToolUseBlock;
}

interface ToolUseBlock {
  id: string;
  name: string;
  input: unknown;
}

export interface AgentResponse {
  text: string;
  buttons: ButtonOption[] | null;
  form: FormDefinition | null;
  webSearchNeeded: string[] | null;
  candidateUpdate: { title: string; summary: string } | null;
  signals: ExtractedSignals;
}

export interface ButtonOption {
  id: string;
  label: string;
  value: string;
  style: "primary" | "secondary" | "danger";
}

export interface FormDefinition {
  fields: FormField[];
  submitLabel: string;
}

export interface FormField {
  id: string;
  label: string;
  type: "text" | "radio" | "checkbox" | "slider" | "select";
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
}

export interface ExtractedSignals {
  selfDiscovery?: Partial<SelfDiscoveryState>;
  marketDiscovery?: Partial<MarketDiscoveryState>;
  narrowing?: Partial<NarrowingState>;
}

import {
  SelfDiscoveryState,
  MarketDiscoveryState,
  NarrowingState,
} from "../../types/ideation.js";

export class StreamingResponseHandler extends EventEmitter {
  private accumulatedText: string = "";
  private client: Anthropic;
  private isStreaming: boolean = false;

  constructor(client: Anthropic) {
    super();
    this.client = client;
  }

  /**
   * Stream a message and emit events as tokens arrive.
   */
  async streamMessage(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    systemPrompt: string,
    tools?: Anthropic.Tool[],
  ): Promise<AgentResponse> {
    this.isStreaming = true;
    this.accumulatedText = "";

    try {
      const stream = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools,
        stream: true,
      });

      for await (const event of stream) {
        if (!this.isStreaming) break;

        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            const textDelta = event.delta.text;
            this.accumulatedText += textDelta;
            this.emit("stream", {
              type: "text_delta",
              data: textDelta,
            } as StreamEvent);
          }
        } else if (event.type === "content_block_start") {
          if (event.content_block.type === "tool_use") {
            this.emit("stream", {
              type: "tool_use",
              data: {
                id: event.content_block.id,
                name: event.content_block.name,
                input: {},
              },
            } as StreamEvent);
          }
        } else if (event.type === "message_stop") {
          // Message complete, parse the full response
          const response = this.parseResponse(this.accumulatedText);
          this.emit("stream", {
            type: "message_complete",
            data: response,
          } as StreamEvent);
          return response;
        }
      }

      // Fallback if stream ends without message_stop
      return this.parseResponse(this.accumulatedText);
    } catch (error) {
      this.emit("stream", {
        type: "error",
        data: error as Error,
      } as StreamEvent);
      throw error;
    } finally {
      this.isStreaming = false;
    }
  }

  /**
   * Cancel the current stream.
   */
  cancel(): void {
    this.isStreaming = false;
    this.emit("stream", {
      type: "error",
      data: new Error("Stream cancelled by user"),
    } as StreamEvent);
  }

  /**
   * Parse the accumulated text into structured response.
   */
  private parseResponse(text: string): AgentResponse {
    // Try to extract JSON from the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // No JSON found, return text-only response
      return {
        text: text.trim(),
        buttons: null,
        form: null,
        webSearchNeeded: null,
        candidateUpdate: null,
        signals: {},
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        text: parsed.text || "",
        buttons: parsed.buttons || null,
        form: parsed.form || null,
        webSearchNeeded: parsed.webSearchNeeded || null,
        candidateUpdate: parsed.candidateUpdate || null,
        signals: parsed.signals || {},
      };
    } catch (e) {
      // JSON parse failed, return text-only
      return {
        text: text.trim(),
        buttons: null,
        form: null,
        webSearchNeeded: null,
        candidateUpdate: null,
        signals: {},
      };
    }
  }
}

/**
 * SSE encoder for server-side streaming.
 */
export function encodeSSE(event: string, data: unknown): string {
  const dataStr = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${dataStr}\n\n`;
}

/**
 * Create SSE stream for Express response.
 */
export function createSSEStream(res: any): {
  send: (event: string, data: unknown) => void;
  end: () => void;
} {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  return {
    send: (event: string, data: unknown) => {
      res.write(encodeSSE(event, data));
    },
    end: () => {
      res.write(encodeSSE("done", {}));
      res.end();
    },
  };
}
```

---

## 3b. Web Search Service

Create file: `agents/ideation/web-search.ts`

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * WEB SEARCH SERVICE
 *
 * Performs web searches during ideation to validate markets,
 * find competitors, and check timing signals.
 */

export interface WebSearchResult {
  query: string;
  results: SearchResultItem[];
  timestamp: string;
  error?: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface SearchPurpose {
  type:
    | "competitor_check"
    | "market_validation"
    | "timing_signal"
    | "failed_attempts"
    | "general";
  context: string;
}

/**
 * Perform a web search using Claude CLI with WebSearch tool.
 */
export async function performWebSearch(
  query: string,
  purpose: SearchPurpose,
): Promise<WebSearchResult> {
  const timestamp = new Date().toISOString();

  try {
    // Use Claude CLI with WebSearch tool
    const prompt = buildSearchPrompt(query, purpose);
    const result = await runClaudeCliWithSearch(prompt);

    return {
      query,
      results: parseSearchResults(result),
      timestamp,
    };
  } catch (error) {
    return {
      query,
      results: [],
      timestamp,
      error: (error as Error).message,
    };
  }
}

/**
 * Build a search prompt based on purpose.
 */
function buildSearchPrompt(query: string, purpose: SearchPurpose): string {
  const purposeInstructions: Record<SearchPurpose["type"], string> = {
    competitor_check: `Search for competitors and alternatives in this space. Focus on: company names, their offerings, pricing models, and market position.`,
    market_validation: `Validate if there's a real market for this. Look for: market size data, user demand signals, industry reports.`,
    timing_signal: `Check if the timing is right for this idea. Look for: recent trends, regulatory changes, technology shifts, market events.`,
    failed_attempts: `Search for failed or pivoted companies in this space. Look for: post-mortems, lessons learned, common failure modes.`,
    general: `Perform a general search to understand the landscape.`,
  };

  return `
${purposeInstructions[purpose.type]}

Context: ${purpose.context}

Search query: "${query}"

Please search for this and return:
1. Key findings (3-5 bullet points)
2. Source URLs with titles
3. Any concerns or red flags
4. Opportunities identified
`;
}

/**
 * Execute Claude CLI with WebSearch tool.
 */
async function runClaudeCliWithSearch(prompt: string): Promise<string> {
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, "\\n");

  try {
    const { stdout } = await execAsync(
      `claude --allowedTools WebSearch --print "${escapedPrompt}"`,
      {
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
      },
    );

    return stdout;
  } catch (error) {
    throw new Error(`Web search failed: ${(error as Error).message}`);
  }
}

/**
 * Parse search results from Claude CLI output.
 */
function parseSearchResults(output: string): SearchResultItem[] {
  const results: SearchResultItem[] = [];

  // Extract URLs with markdown link pattern [title](url)
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(output)) !== null) {
    results.push({
      title: match[1],
      url: match[2],
      snippet: extractSnippet(output, match.index),
      source: new URL(match[2]).hostname,
    });
  }

  // Also check for bare URLs
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  while ((match = urlPattern.exec(output)) !== null) {
    if (!results.some((r) => r.url === match[1])) {
      results.push({
        title: "Source",
        url: match[1],
        snippet: extractSnippet(output, match.index),
        source: new URL(match[1]).hostname,
      });
    }
  }

  return results.slice(0, 10); // Limit to 10 results
}

/**
 * Extract snippet around a URL match.
 */
function extractSnippet(text: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - 150);
  const end = Math.min(text.length, matchIndex + 150);
  let snippet = text.slice(start, end).trim();

  // Clean up and add ellipsis
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet.replace(/\[.*?\]\(.*?\)/g, "").trim();
}

/**
 * Search strategy for ideation agent.
 * Determines what to search based on current state.
 */
export interface SearchStrategy {
  queries: string[];
  purposes: SearchPurpose[];
}

export function determineSearchStrategy(
  candidateTitle: string,
  narrowingState: {
    productType?: string;
    customerType?: string;
    geography?: string;
  },
): SearchStrategy {
  const queries: string[] = [];
  const purposes: SearchPurpose[] = [];

  // Always check for competitors
  queries.push(`${candidateTitle} competitors alternatives`);
  purposes.push({
    type: "competitor_check",
    context: `Looking for direct competitors to: ${candidateTitle}`,
  });

  // Check market validation
  queries.push(`${candidateTitle} market size demand`);
  purposes.push({
    type: "market_validation",
    context: `Validating market demand for: ${candidateTitle}`,
  });

  // Check for failed attempts if B2C
  if (narrowingState.customerType === "B2C") {
    queries.push(`${candidateTitle} startup failed shutdown`);
    purposes.push({
      type: "failed_attempts",
      context: `Looking for previous failed attempts in: ${candidateTitle}`,
    });
  }

  // Add geography-specific search if local
  if (narrowingState.geography === "local") {
    queries.push(`${candidateTitle} australia local market`);
    purposes.push({
      type: "market_validation",
      context: `Checking Australian/local market for: ${candidateTitle}`,
    });
  }

  return { queries, purposes };
}

/**
 * Batch execute searches with rate limiting.
 */
export async function executeSearchBatch(
  strategy: SearchStrategy,
): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];

  for (let i = 0; i < strategy.queries.length; i++) {
    const result = await performWebSearch(
      strategy.queries[i],
      strategy.purposes[i],
    );
    results.push(result);

    // Rate limit: wait 1 second between searches
    if (i < strategy.queries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
```

---

## 3c. Witty Interjection System

Create file: `agents/ideation/witty-interjections.ts`

```typescript
/**
 * WITTY INTERJECTION SYSTEM
 *
 * Adds occasional personality to agent responses (~10% of the time).
 * Contextual one-liners that feel natural, not forced.
 */

export interface WittyInterjection {
  text: string;
  category:
    | "self_awareness"
    | "market_reality"
    | "encouragement"
    | "gentle_push";
  triggers: string[];
}

// Interjection library
const INTERJECTIONS: WittyInterjection[] = [
  // Self-awareness
  {
    text: "Ah, the classic 'surely someone's solved this' moment. Usually they haven't, or they've done it poorly.",
    category: "self_awareness",
    triggers: ["surely", "someone must have", "already exists", "been done"],
  },
  {
    text: "That's either a terrible idea or a brilliant one. Often the same thing.",
    category: "self_awareness",
    triggers: [
      "crazy idea",
      "might be dumb",
      "sounds weird",
      "probably stupid",
    ],
  },
  {
    text: "Most people say 'everyone' when asked who'd use their idea. You didn't. That's good.",
    category: "self_awareness",
    triggers: ["specific audience", "niche", "particular group"],
  },
  {
    text: "The graveyard of startups is full of 'obvious' ideas no one could make work.",
    category: "self_awareness",
    triggers: ["obvious", "easy", "simple", "straightforward"],
  },
  {
    text: "Passion and patience are both P-words. You'll need both.",
    category: "self_awareness",
    triggers: ["passionate", "love this", "excited about"],
  },

  // Market reality
  {
    text: "Competition can be good news — it means people are actually paying for solutions.",
    category: "market_reality",
    triggers: ["competitor", "competition", "already doing this"],
  },
  {
    text: "The difference between a feature and a product is often just marketing.",
    category: "market_reality",
    triggers: ["just a feature", "too small", "add-on"],
  },
  {
    text: "Timing is the silent killer of good ideas. Right idea, wrong decade.",
    category: "market_reality",
    triggers: ["too early", "too late", "timing", "market ready"],
  },
  {
    text: "The best businesses solve problems people didn't know they'd pay to fix.",
    category: "market_reality",
    triggers: ["pain point", "frustration", "annoyance"],
  },

  // Encouragement
  {
    text: "Naivety is an asset in early stages. Experts often can't see the obvious gaps.",
    category: "encouragement",
    triggers: ["don't know enough", "no experience", "not an expert"],
  },
  {
    text: "The best founders often come from outside the industry they disrupt.",
    category: "encouragement",
    triggers: ["outsider", "never worked in", "different background"],
  },
  {
    text: "Constraints breed creativity. Limited time or money can be a feature, not a bug.",
    category: "encouragement",
    triggers: ["limited time", "no money", "bootstrap", "part-time"],
  },

  // Gentle push
  {
    text: "Ideas are cheap. Execution is expensive. Let's make sure this one's worth the price.",
    category: "gentle_push",
    triggers: ["many ideas", "could do anything", "options"],
  },
  {
    text: "Shall we dig deeper, or is this comfortable surface-level chat?",
    category: "gentle_push",
    triggers: ["maybe", "could be", "not sure", "possibly"],
  },
  {
    text: "I notice you're hedging. What would it take to commit to exploring this seriously?",
    category: "gentle_push",
    triggers: ["might work", "could try", "not sure if"],
  },
];

/**
 * Decide if we should inject a witty interjection.
 * Target: ~10% of responses.
 */
export function shouldInjectWit(): boolean {
  return Math.random() < 0.1;
}

/**
 * Find a contextually appropriate interjection.
 */
export function findRelevantInterjection(
  userMessage: string,
  agentReply: string,
): WittyInterjection | null {
  const combinedText = `${userMessage} ${agentReply}`.toLowerCase();

  // Find interjections with matching triggers
  const matches = INTERJECTIONS.filter((interjection) =>
    interjection.triggers.some((trigger) =>
      combinedText.includes(trigger.toLowerCase()),
    ),
  );

  if (matches.length === 0) return null;

  // Return random match
  return matches[Math.floor(Math.random() * matches.length)];
}

/**
 * Inject witty interjection into response if appropriate.
 */
export function maybeInjectWit(
  userMessage: string,
  agentReply: string,
): string {
  // Check probability
  if (!shouldInjectWit()) return agentReply;

  // Find relevant interjection
  const interjection = findRelevantInterjection(userMessage, agentReply);
  if (!interjection) return agentReply;

  // Inject at natural break point
  return injectAtNaturalBreak(agentReply, interjection.text);
}

/**
 * Inject text at a natural break point in the response.
 */
function injectAtNaturalBreak(text: string, injection: string): string {
  // Look for paragraph breaks
  const paragraphs = text.split("\n\n");

  if (paragraphs.length >= 2) {
    // Insert after first paragraph
    paragraphs.splice(1, 0, `*${injection}*`);
    return paragraphs.join("\n\n");
  }

  // Look for sentence breaks
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length >= 2) {
    // Insert after first sentence
    sentences.splice(1, 0, `*${injection}*`);
    return sentences.join(" ");
  }

  // Just append with emphasis
  return `${text}\n\n*${injection}*`;
}

/**
 * Get random interjection by category for explicit use.
 */
export function getRandomByCategory(
  category: WittyInterjection["category"],
): string {
  const matches = INTERJECTIONS.filter((i) => i.category === category);
  return matches[Math.floor(Math.random() * matches.length)].text;
}

/**
 * Track used interjections to avoid repetition in session.
 */
export class InterjectionTracker {
  private usedInSession: Set<string> = new Set();

  reset(): void {
    this.usedInSession.clear();
  }

  getUnused(candidates: WittyInterjection[]): WittyInterjection | null {
    const unused = candidates.filter((c) => !this.usedInSession.has(c.text));
    if (unused.length === 0) return null;

    const selected = unused[Math.floor(Math.random() * unused.length)];
    this.usedInSession.add(selected.text);
    return selected;
  }

  markUsed(text: string): void {
    this.usedInSession.add(text);
  }
}
```

---

## 4. Test Plan

Create file: `tests/ideation/orchestrator.test.ts`

```typescript
import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  generateGreeting,
  generateGreetingWithButtons,
  generateReturningGreeting,
} from "../../agents/ideation/greeting-generator.js";

describe("GreetingGenerator", () => {
  describe("generateGreeting", () => {
    test("PASS: Includes welcome message", () => {
      const greeting = generateGreeting({});

      expect(greeting).toContain("Welcome");
    });

    test("PASS: Includes process explanation", () => {
      const greeting = generateGreeting({});

      expect(greeting).toContain("We'll have a conversation");
      expect(greeting).toContain("panel on the right");
    });

    test("PASS: Includes opening question", () => {
      const greeting = generateGreeting({});

      expect(greeting).toContain("What's been occupying your mind");
    });

    test("PASS: Personalizes for technical skills", () => {
      const greeting = generateGreeting({
        skills: ["programming", "software development", "marketing"],
      });

      expect(greeting).toContain("technical background");
      expect(greeting).toContain("programming");
    });

    test("PASS: Personalizes for industry experience", () => {
      const greeting = generateGreeting({
        experience: {
          industries: ["healthcare", "fintech"],
        },
      });

      expect(greeting).toContain("experience in");
      expect(greeting).toContain("healthcare");
    });

    test("PASS: Personalizes for interests", () => {
      const greeting = generateGreeting({
        interests: ["sustainability", "AI"],
      });

      expect(greeting).toContain("interest in");
      expect(greeting).toContain("sustainability");
    });

    test("PASS: Personalizes for location", () => {
      const greeting = generateGreeting({
        location: { city: "Sydney" },
      });

      expect(greeting).toContain("based in Sydney");
    });

    test("PASS: Combines multiple personalizations", () => {
      const greeting = generateGreeting({
        skills: ["data engineering"],
        experience: { industries: ["fintech"] },
        location: { city: "Melbourne" },
      });

      expect(greeting).toContain("data engineering");
      expect(greeting).toContain("fintech");
      expect(greeting).toContain("Melbourne");
    });

    test("PASS: Works with empty profile", () => {
      const greeting = generateGreeting({});

      expect(greeting).toContain("Welcome");
      expect(greeting).toContain("I've loaded your profile");
    });
  });

  describe("generateGreetingWithButtons", () => {
    test("PASS: Returns greeting text", () => {
      const result = generateGreetingWithButtons({});

      expect(result.text).toContain("Welcome");
    });

    test("PASS: Returns three starting buttons", () => {
      const result = generateGreetingWithButtons({});

      expect(result.buttons.length).toBe(3);
    });

    test("PASS: Includes frustration button", () => {
      const result = generateGreetingWithButtons({});

      const frustrationBtn = result.buttons.find(
        (b) => b.id === "btn_frustration",
      );
      expect(frustrationBtn).toBeDefined();
      expect(frustrationBtn!.label).toContain("frustrates");
    });

    test("PASS: Includes idea button", () => {
      const result = generateGreetingWithButtons({});

      const ideaBtn = result.buttons.find((b) => b.id === "btn_idea");
      expect(ideaBtn).toBeDefined();
      expect(ideaBtn!.label).toContain("idea");
    });

    test("PASS: Includes explore button", () => {
      const result = generateGreetingWithButtons({});

      const exploreBtn = result.buttons.find((b) => b.id === "btn_explore");
      expect(exploreBtn).toBeDefined();
      expect(exploreBtn!.label).toContain("explore");
    });

    test("PASS: All buttons have required fields", () => {
      const result = generateGreetingWithButtons({});

      for (const button of result.buttons) {
        expect(button.id).toBeDefined();
        expect(button.label).toBeDefined();
        expect(button.value).toBeDefined();
        expect(button.style).toBeDefined();
      }
    });
  });

  describe("generateReturningGreeting", () => {
    test("PASS: Includes welcome back", () => {
      const greeting = generateReturningGreeting({});

      expect(greeting).toContain("Welcome back");
    });

    test("PASS: Uses name if provided", () => {
      const greeting = generateReturningGreeting({ name: "Alex" });

      expect(greeting).toContain("Alex");
    });

    test("PASS: Includes session summary if provided", () => {
      const greeting = generateReturningGreeting(
        {},
        "we explored ideas around coworking spaces",
      );

      expect(greeting).toContain("coworking spaces");
      expect(greeting).toContain("continue");
    });

    test("PASS: Works without session summary", () => {
      const greeting = generateReturningGreeting({ name: "Jordan" });

      expect(greeting).toContain("Ready to explore");
    });
  });
});
```

### Streaming Response Handler Tests

Create file: `tests/ideation/streaming.test.ts`

```typescript
import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  StreamingResponseHandler,
  encodeSSE,
  createSSEStream,
} from "../../agents/ideation/streaming.js";

describe("StreamingResponseHandler", () => {
  describe("parseResponse", () => {
    test("PASS: Parses valid JSON response", () => {
      const handler = new (StreamingResponseHandler as any)({});
      const response = handler.parseResponse(`
        {"text": "Hello", "buttons": null, "signals": {}}
      `);

      expect(response.text).toBe("Hello");
      expect(response.buttons).toBeNull();
    });

    test("PASS: Handles text-only response", () => {
      const handler = new (StreamingResponseHandler as any)({});
      const response = handler.parseResponse("Just plain text without JSON");

      expect(response.text).toBe("Just plain text without JSON");
      expect(response.buttons).toBeNull();
    });

    test("PASS: Extracts JSON from mixed content", () => {
      const handler = new (StreamingResponseHandler as any)({});
      const response = handler.parseResponse(`
        Some preamble text
        {"text": "The actual response", "buttons": [{"id": "1", "label": "Option"}]}
        Some postamble
      `);

      expect(response.text).toBe("The actual response");
      expect(response.buttons).toHaveLength(1);
    });

    test("PASS: Handles malformed JSON gracefully", () => {
      const handler = new (StreamingResponseHandler as any)({});
      const response = handler.parseResponse('{"text": "incomplete');

      expect(response.text).toContain("incomplete");
    });
  });

  describe("encodeSSE", () => {
    test("PASS: Encodes string data", () => {
      const encoded = encodeSSE("text_delta", "Hello");

      expect(encoded).toBe("event: text_delta\ndata: Hello\n\n");
    });

    test("PASS: Encodes object data as JSON", () => {
      const encoded = encodeSSE("message_complete", { text: "Hello" });

      expect(encoded).toContain("event: message_complete");
      expect(encoded).toContain('{"text":"Hello"}');
    });
  });

  describe("createSSEStream", () => {
    test("PASS: Sets correct headers", () => {
      const mockRes = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      createSSEStream(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream",
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "no-cache",
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Connection",
        "keep-alive",
      );
      expect(mockRes.flushHeaders).toHaveBeenCalled();
    });

    test("PASS: Send writes to response", () => {
      const mockRes = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      const stream = createSSEStream(mockRes);
      stream.send("test", "data");

      expect(mockRes.write).toHaveBeenCalled();
    });

    test("PASS: End sends done event", () => {
      const mockRes = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      };

      const stream = createSSEStream(mockRes);
      stream.end();

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining("done"),
      );
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
```

### Web Search Service Tests

Create file: `tests/ideation/web-search.test.ts`

```typescript
import { describe, test, expect, vi } from "vitest";
import {
  determineSearchStrategy,
  parseSearchResults,
  buildSearchPrompt,
} from "../../agents/ideation/web-search.js";

describe("WebSearchService", () => {
  describe("determineSearchStrategy", () => {
    test("PASS: Always includes competitor check", () => {
      const strategy = determineSearchStrategy("AI writing assistant", {});

      expect(strategy.queries.some((q) => q.includes("competitors"))).toBe(
        true,
      );
      expect(strategy.purposes.some((p) => p.type === "competitor_check")).toBe(
        true,
      );
    });

    test("PASS: Always includes market validation", () => {
      const strategy = determineSearchStrategy("AI writing assistant", {});

      expect(strategy.queries.some((q) => q.includes("market size"))).toBe(
        true,
      );
      expect(
        strategy.purposes.some((p) => p.type === "market_validation"),
      ).toBe(true);
    });

    test("PASS: Adds failed attempts for B2C", () => {
      const strategy = determineSearchStrategy("Consumer app", {
        customerType: "B2C",
      });

      expect(strategy.queries.some((q) => q.includes("failed"))).toBe(true);
      expect(strategy.purposes.some((p) => p.type === "failed_attempts")).toBe(
        true,
      );
    });

    test("PASS: Does not add failed attempts for B2B", () => {
      const strategy = determineSearchStrategy("Enterprise tool", {
        customerType: "B2B",
      });

      expect(strategy.purposes.some((p) => p.type === "failed_attempts")).toBe(
        false,
      );
    });

    test("PASS: Adds geography-specific search for local", () => {
      const strategy = determineSearchStrategy("Local service", {
        geography: "local",
      });

      expect(strategy.queries.some((q) => q.includes("australia"))).toBe(true);
    });
  });

  describe("parseSearchResults", () => {
    test("PASS: Extracts markdown links", () => {
      const output =
        "Check out [Example Site](https://example.com) for more info.";
      const results = parseSearchResults(output);

      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Example Site");
      expect(results[0].url).toBe("https://example.com");
    });

    test("PASS: Extracts bare URLs", () => {
      const output = "Visit https://example.com for details.";
      const results = parseSearchResults(output);

      expect(results.length).toBe(1);
      expect(results[0].url).toBe("https://example.com");
    });

    test("PASS: Deduplicates URLs", () => {
      const output =
        "[Site](https://example.com) and https://example.com again";
      const results = parseSearchResults(output);

      expect(results.length).toBe(1);
    });

    test("PASS: Limits to 10 results", () => {
      const output = Array(15)
        .fill(null)
        .map((_, i) => `[Site${i}](https://example${i}.com)`)
        .join(" ");
      const results = parseSearchResults(output);

      expect(results.length).toBeLessThanOrEqual(10);
    });

    test("PASS: Extracts source hostname", () => {
      const output = "[Article](https://www.techcrunch.com/article)";
      const results = parseSearchResults(output);

      expect(results[0].source).toBe("www.techcrunch.com");
    });
  });

  describe("buildSearchPrompt", () => {
    test("PASS: Includes query in prompt", () => {
      const prompt = buildSearchPrompt("AI startups", {
        type: "competitor_check",
        context: "Test context",
      });

      expect(prompt).toContain("AI startups");
    });

    test("PASS: Includes purpose-specific instructions", () => {
      const prompt = buildSearchPrompt("test", {
        type: "competitor_check",
        context: "Test",
      });

      expect(prompt).toContain("competitors");
      expect(prompt).toContain("alternatives");
    });

    test("PASS: Includes context", () => {
      const prompt = buildSearchPrompt("test", {
        type: "general",
        context: "Specific context for this search",
      });

      expect(prompt).toContain("Specific context for this search");
    });
  });
});
```

### Witty Interjection Tests

Create file: `tests/ideation/witty-interjections.test.ts`

```typescript
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shouldInjectWit,
  findRelevantInterjection,
  maybeInjectWit,
  injectAtNaturalBreak,
  InterjectionTracker,
} from "../../agents/ideation/witty-interjections.js";

describe("WittyInterjections", () => {
  describe("shouldInjectWit", () => {
    test("PASS: Returns boolean", () => {
      const result = shouldInjectWit();
      expect(typeof result).toBe("boolean");
    });

    test("PASS: Approximately 10% true rate over many calls", () => {
      const results = Array(1000)
        .fill(null)
        .map(() => shouldInjectWit());
      const trueCount = results.filter((r) => r).length;

      // Allow 5-15% range for statistical variance
      expect(trueCount).toBeGreaterThan(50);
      expect(trueCount).toBeLessThan(150);
    });
  });

  describe("findRelevantInterjection", () => {
    test("PASS: Finds interjection for matching trigger", () => {
      const interjection = findRelevantInterjection(
        "surely someone has built this before",
        "Let's check",
      );

      expect(interjection).not.toBeNull();
      expect(interjection!.triggers).toContain("surely");
    });

    test("PASS: Returns null when no triggers match", () => {
      const interjection = findRelevantInterjection(
        "The weather is nice today",
        "Indeed it is",
      );

      expect(interjection).toBeNull();
    });

    test("PASS: Matches triggers in agent reply too", () => {
      const interjection = findRelevantInterjection(
        "I want to build something",
        "You mentioned this is for a niche market",
      );

      expect(interjection).not.toBeNull();
    });

    test("PASS: Case-insensitive matching", () => {
      const interjection = findRelevantInterjection("SURELY this exists", "");

      expect(interjection).not.toBeNull();
    });
  });

  describe("injectAtNaturalBreak", () => {
    test("PASS: Injects after first paragraph", () => {
      const text = "First paragraph.\n\nSecond paragraph.";
      const result = injectAtNaturalBreak(text, "Witty comment");

      expect(result).toContain("First paragraph.");
      expect(result).toContain("*Witty comment*");
      expect(result).toContain("Second paragraph.");
      expect(result.indexOf("*Witty comment*")).toBeGreaterThan(
        result.indexOf("First"),
      );
      expect(result.indexOf("*Witty comment*")).toBeLessThan(
        result.indexOf("Second"),
      );
    });

    test("PASS: Injects after first sentence if no paragraphs", () => {
      const text = "First sentence. Second sentence.";
      const result = injectAtNaturalBreak(text, "Witty comment");

      expect(result).toContain("First sentence.");
      expect(result).toContain("*Witty comment*");
    });

    test("PASS: Appends if no natural breaks", () => {
      const text = "Short text";
      const result = injectAtNaturalBreak(text, "Witty comment");

      expect(result).toContain("Short text");
      expect(result).toContain("*Witty comment*");
    });
  });

  describe("InterjectionTracker", () => {
    test("PASS: Tracks used interjections", () => {
      const tracker = new InterjectionTracker();
      const candidates = [
        { text: "First", category: "self_awareness" as const, triggers: [] },
        { text: "Second", category: "self_awareness" as const, triggers: [] },
      ];

      const first = tracker.getUnused(candidates);
      expect(first).not.toBeNull();

      const second = tracker.getUnused(candidates);
      expect(second).not.toBeNull();
      expect(second!.text).not.toBe(first!.text);
    });

    test("PASS: Returns null when all used", () => {
      const tracker = new InterjectionTracker();
      const candidates = [
        { text: "Only", category: "self_awareness" as const, triggers: [] },
      ];

      tracker.getUnused(candidates);
      const result = tracker.getUnused(candidates);

      expect(result).toBeNull();
    });

    test("PASS: Reset clears tracking", () => {
      const tracker = new InterjectionTracker();
      const candidates = [
        { text: "Only", category: "self_awareness" as const, triggers: [] },
      ];

      tracker.getUnused(candidates);
      tracker.reset();
      const result = tracker.getUnused(candidates);

      expect(result).not.toBeNull();
    });
  });
});
```

---

## 5. Implementation Checklist

- [ ] Create `agents/ideation/system-prompt.ts`
- [ ] Create `agents/ideation/orchestrator.ts`
- [ ] Create `agents/ideation/greeting-generator.ts`
- [ ] Create `agents/ideation/streaming.ts`
- [ ] Create `agents/ideation/web-search.ts`
- [ ] Create `agents/ideation/witty-interjections.ts`
- [ ] Create `tests/ideation/orchestrator.test.ts`
- [ ] Create `tests/ideation/streaming.test.ts`
- [ ] Create `tests/ideation/web-search.test.ts`
- [ ] Create `tests/ideation/witty-interjections.test.ts`
- [ ] Run tests: `npm test -- tests/ideation/`
- [ ] Verify all tests pass

---

## 6. Success Criteria

| Test Category               | Expected Pass |
| --------------------------- | ------------- |
| generateGreeting            | 9             |
| generateGreetingWithButtons | 6             |
| generateReturningGreeting   | 4             |
| StreamingResponseHandler    | 7             |
| WebSearchService            | 11            |
| WittyInterjections          | 10            |
| **Total**                   | **47**        |
