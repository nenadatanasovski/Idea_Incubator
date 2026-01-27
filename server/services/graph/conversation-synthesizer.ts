/**
 * Conversation Synthesizer
 *
 * Uses AI to synthesize raw conversation messages into meaningful knowledge chunks.
 * Instead of showing individual user/assistant messages, this extracts:
 * - Decisions made
 * - Assumptions identified
 * - Open questions
 * - Key insights and conclusions
 * - Requirements stated
 * - Important context
 *
 * This provides much better signal-to-noise ratio for graph analysis.
 */

import { query } from "../../../database/db.js";

// =============================================================================
// Types
// =============================================================================

export type InsightType =
  | "insight" // Key findings, conclusions, "aha" moments
  | "fact" // Verifiable data points, background context
  | "assumption" // Implicit or explicit assumptions
  | "question" // Open questions, unknowns
  | "decision" // Choices made or pending
  | "action" // Next steps, validation tasks
  | "requirement" // Must-have constraints, specifications
  | "option" // Alternatives being considered
  | "pattern" // Recurring themes or patterns
  | "synthesis" // Conclusions from combining information
  | "meta"; // Notes about the process

export interface ConversationInsight {
  id: string;
  type: InsightType;
  title: string; // 5-10 word summary
  content: string; // Detailed insight
  confidence: number; // 0.0 - 1.0
  sourceContext: string; // Brief context of where this came from
  // NEW: Track decision evolution (supersession)
  supersedes?: {
    insightId: string; // ID of the earlier insight being replaced
    reason: string; // Why this insight supersedes the previous one
  };
}

export interface SynthesisResult {
  insights: ConversationInsight[];
  totalMessages: number;
  synthesisMetadata: Record<InsightType, number>;
}

// Weights for different insight types (higher = more valuable for graph)
export const INSIGHT_TYPE_WEIGHTS: Record<InsightType, number> = {
  decision: 0.95,
  requirement: 0.95,
  assumption: 0.9,
  insight: 0.85,
  synthesis: 0.85,
  pattern: 0.85,
  action: 0.85,
  option: 0.8,
  question: 0.8,
  fact: 0.7,
  meta: 0.6,
};

// Labels for UI display
export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  insight: "Insight",
  fact: "Fact",
  assumption: "Assumption",
  question: "Question",
  decision: "Decision",
  action: "Action",
  requirement: "Requirement",
  option: "Option",
  pattern: "Pattern",
  synthesis: "Synthesis",
  meta: "Meta",
};

// =============================================================================
// Synthesis Prompt
// =============================================================================

const SYNTHESIS_SYSTEM_PROMPT = `You are a knowledge extraction specialist. Your task is to analyze a conversation and extract ALL meaningful knowledge chunks as SEPARATE, GRANULAR insights.

CRITICAL: Extract MANY insights (typically 10-30+ from a substantive conversation). Each distinct piece of knowledge should be its own insight. Do NOT combine multiple concepts into one.

Use ONLY these 11 canonical block types:
1. INSIGHT - Key findings, conclusions, "aha" moments, non-obvious observations
2. FACT - Verifiable data points, statistics, background context, evidence
3. ASSUMPTION - Implicit or explicit assumptions being made
4. QUESTION - Open questions, unknowns, things to investigate
5. DECISION - Choices made or pending decisions
6. ACTION - Next steps, validation tasks, to-dos
7. REQUIREMENT - Must-have constraints, specifications, acceptance criteria
8. OPTION - Alternatives being considered, possible approaches
9. PATTERN - Recurring themes or patterns identified
10. SYNTHESIS - Conclusions drawn from combining multiple pieces of information
11. META - Notes about the process, uncertainties

IMPORTANT: Do NOT use "risk", "opportunity", "context", "key_insight", or "open_question" as types. Use the 11 types above only.

CRITICAL: DECISION EVOLUTION DETECTION
When extracting DECISIONS, you MUST detect when a later statement changes or reverses an earlier decision:

Decision-changing indicators (look for these phrases):
- "actually", "on second thought", "instead", "let's change", "I've decided against"
- "rather than", "forget that", "scratch that", "new plan", "better idea"
- "wait, let's", "never mind", "changed my mind", "I prefer", "let's switch to"
- Direct contradiction of earlier stated preference (same topic, different choice)

When you detect decision evolution:
1. Extract BOTH the original decision AND the new decision as separate insights
2. The NEW decision should include a "supersedes" field referencing the OLD decision
3. Include the reasoning for the change

IMPORTANT: Only mark as superseding when BOTH insights are about the SAME topic/domain and the newer one REPLACES the older one. Do NOT link unrelated decisions.

For EACH extracted insight:
- Create a clear, specific title (5-10 words) that stands alone
- Write self-contained content that captures the full meaning
- Assign confidence (0.0-1.0) based on how clearly stated it was
- Note the brief context where this emerged

EXTRACTION PRINCIPLES:
- Be EXHAUSTIVE: extract every distinct piece of knowledge
- Be GRANULAR: one insight per concept (don't combine unrelated ideas)
- Extract the ESSENCE using first principles reasoning
- Include both explicit statements AND implied knowledge
- Capture what matters for understanding and decision-making

Example: If someone discusses market size, competition, AND pricing, that's THREE separate insights (context, risk, decision) not one.

Return JSON only:
{
  "insights": [
    {
      "id": "insight_1",
      "type": "insight|fact|assumption|question|decision|action|requirement|option|pattern|synthesis|meta",
      "title": "Clear 5-10 word title",
      "content": "Comprehensive description with full context and implications",
      "confidence": 0.85,
      "sourceContext": "Brief note on where this came from"
    },
    {
      "id": "insight_2",
      "type": "decision",
      "title": "Switch to Vue.js for frontend",
      "content": "User decided to use Vue.js instead of React for the frontend",
      "confidence": 0.95,
      "sourceContext": "User reconsidered after discussing simplicity",
      "supersedes": {
        "insightId": "insight_1",
        "reason": "User changed preference due to simpler learning curve"
      }
    }
  ]
}`;

// =============================================================================
// Synthesis Function
// =============================================================================

export async function synthesizeConversation(
  sessionId: string,
  conversationLimit: number = 50,
): Promise<SynthesisResult> {
  console.log(
    `[ConversationSynthesizer] Starting synthesis for session: ${sessionId}`,
  );

  // Fetch raw messages
  const messages = await query<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>(
    `SELECT id, role, content, created_at FROM ideation_messages
     WHERE session_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [sessionId, conversationLimit],
  );

  if (messages.length === 0) {
    console.log(`[ConversationSynthesizer] No messages to synthesize`);
    return {
      insights: [],
      totalMessages: 0,
      synthesisMetadata: {
        insight: 0,
        fact: 0,
        assumption: 0,
        question: 0,
        decision: 0,
        action: 0,
        requirement: 0,
        option: 0,
        pattern: 0,
        synthesis: 0,
        meta: 0,
      },
    };
  }

  console.log(
    `[ConversationSynthesizer] Synthesizing ${messages.length} messages`,
  );

  // Build conversation text
  const conversationText = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n---\n\n");

  // Estimate if we need to truncate
  const charLimit = 60000; // ~15k tokens for context
  let truncatedConversation = conversationText;
  if (conversationText.length > charLimit) {
    truncatedConversation =
      conversationText.slice(0, charLimit) +
      "\n\n[... CONVERSATION TRUNCATED FOR ANALYSIS ...]";
    console.log(
      `[ConversationSynthesizer] Truncated conversation from ${conversationText.length} to ${charLimit} chars`,
    );
  }

  // Call AI for synthesis
  try {
    const { client: anthropicClient } =
      await import("../../../utils/anthropic-client.js");

    const response = await anthropicClient.messages.create({
      model: "claude-haiku-3-5-latest",
      max_tokens: 32768,
      system: SYNTHESIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this conversation thoroughly and extract ALL meaningful knowledge as SEPARATE insights.

Be exhaustive - a typical conversation should yield 10-30+ distinct insights across the 11 canonical types (insight, fact, assumption, question, decision, action, requirement, option, pattern, synthesis, meta).

CONVERSATION TO ANALYZE:
---
${truncatedConversation}
---

Extract every distinct piece of knowledge. Return JSON with the insights array.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.warn(`[ConversationSynthesizer] No text content in AI response`);
      return createEmptyResult(messages.length);
    }

    // Parse response
    console.log(
      `[ConversationSynthesizer] Raw AI response length: ${textContent.text.length} chars`,
    );
    console.log(
      `[ConversationSynthesizer] Raw AI response preview: ${textContent.text.slice(0, 500)}...`,
    );

    const insights = parseInsightsResponse(textContent.text);

    if (!insights || insights.length === 0) {
      console.warn(`[ConversationSynthesizer] Failed to parse insights`);
      console.warn(
        `[ConversationSynthesizer] Full raw response: ${textContent.text}`,
      );
      return createEmptyResult(messages.length);
    }

    // Calculate metadata
    const metadata = calculateMetadata(insights);

    console.log(
      `[ConversationSynthesizer] Extracted ${insights.length} insights from ${messages.length} messages`,
    );
    console.log(`[ConversationSynthesizer] Breakdown:`, metadata);

    return {
      insights,
      totalMessages: messages.length,
      synthesisMetadata: metadata,
    };
  } catch (error) {
    console.error(`[ConversationSynthesizer] AI synthesis failed:`, error);
    return createEmptyResult(messages.length);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function parseInsightsResponse(responseText: string): ConversationInsight[] {
  try {
    // Clean up response - remove markdown code blocks if present
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
    }

    const parsed = JSON.parse(jsonText);

    if (!parsed.insights || !Array.isArray(parsed.insights)) {
      console.error(
        `[ConversationSynthesizer] Invalid response structure: missing insights array`,
      );
      return [];
    }

    console.log(
      `[ConversationSynthesizer] Found ${parsed.insights.length} raw insights in AI response`,
    );

    // Validate and normalize insights
    const validInsights = parsed.insights.filter((insight: any) => {
      const isValid =
        insight.id &&
        insight.type &&
        insight.title &&
        insight.content &&
        typeof insight.confidence === "number";
      if (!isValid) {
        console.log(
          `[ConversationSynthesizer] Filtering out invalid insight: ${JSON.stringify(insight).slice(0, 200)}`,
        );
      }
      return isValid;
    });

    console.log(
      `[ConversationSynthesizer] ${validInsights.length} insights passed validation`,
    );

    return validInsights.map((insight: any) => {
      const baseInsight: ConversationInsight = {
        id: insight.id,
        type: normalizeInsightType(insight.type),
        title: insight.title,
        content: insight.content,
        confidence: Math.min(1, Math.max(0, insight.confidence)),
        sourceContext: insight.sourceContext || "",
      };

      // Handle supersession field if present
      if (insight.supersedes && insight.supersedes.insightId) {
        baseInsight.supersedes = {
          insightId: insight.supersedes.insightId,
          reason: insight.supersedes.reason || "Decision changed",
        };
      }

      return baseInsight;
    });
  } catch (error) {
    console.error(`[ConversationSynthesizer] Failed to parse insights:`, error);
    return [];
  }
}

function normalizeInsightType(type: string): InsightType {
  const validTypes: InsightType[] = [
    "insight",
    "fact",
    "assumption",
    "question",
    "decision",
    "action",
    "option",
    "requirement",
    "pattern",
    "synthesis",
    "meta",
  ];

  const normalized = type.toLowerCase().replace(/\s+/g, "_");

  if (validTypes.includes(normalized as InsightType)) {
    return normalized as InsightType;
  }

  // Map legacy types to canonical
  if (normalized === "key_insight" || normalized.includes("insight"))
    return "insight";
  if (normalized === "open_question" || normalized.includes("question"))
    return "question";
  if (normalized === "context" || normalized.includes("context")) return "fact";
  if (
    normalized === "risk" ||
    normalized.includes("risk") ||
    normalized.includes("concern")
  )
    return "insight";
  if (normalized === "opportunity" || normalized.includes("opportun"))
    return "insight";
  if (normalized.includes("decide") || normalized.includes("conclusion"))
    return "decision";
  if (normalized.includes("assume")) return "assumption";
  if (normalized.includes("require") || normalized.includes("must"))
    return "requirement";

  return "fact"; // Default fallback
}

function calculateMetadata(
  insights: ConversationInsight[],
): Record<InsightType, number> {
  const counts: Record<InsightType, number> = {
    insight: 0,
    fact: 0,
    assumption: 0,
    question: 0,
    decision: 0,
    action: 0,
    requirement: 0,
    option: 0,
    pattern: 0,
    synthesis: 0,
    meta: 0,
  };

  for (const insight of insights) {
    if (insight.type in counts) {
      counts[insight.type]++;
    }
  }

  return counts;
}

function createEmptyResult(totalMessages: number): SynthesisResult {
  return {
    insights: [],
    totalMessages,
    synthesisMetadata: {
      insight: 0,
      fact: 0,
      assumption: 0,
      question: 0,
      decision: 0,
      action: 0,
      requirement: 0,
      option: 0,
      pattern: 0,
      synthesis: 0,
      meta: 0,
    },
  };
}

// =============================================================================
// Initialization
// =============================================================================

console.log(`[ConversationSynthesizer] Initialized`);
