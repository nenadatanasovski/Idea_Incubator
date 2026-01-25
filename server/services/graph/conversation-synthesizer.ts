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
  | "decision" // Something that was decided
  | "assumption" // An assumption being made
  | "open_question" // A question that remains unanswered
  | "key_insight" // Important observation or conclusion
  | "requirement" // Explicitly stated requirement
  | "context" // Important background information
  | "risk" // Identified risk or concern
  | "opportunity"; // Identified opportunity

export interface ConversationInsight {
  id: string;
  type: InsightType;
  title: string; // 5-10 word summary
  content: string; // Detailed insight
  confidence: number; // 0.0 - 1.0
  sourceContext: string; // Brief context of where this came from
}

export interface SynthesisResult {
  insights: ConversationInsight[];
  totalMessages: number;
  synthesisMetadata: {
    decisionCount: number;
    assumptionCount: number;
    questionCount: number;
    insightCount: number;
    requirementCount: number;
    contextCount: number;
    riskCount: number;
    opportunityCount: number;
  };
}

// Weights for different insight types (higher = more valuable for graph)
export const INSIGHT_TYPE_WEIGHTS: Record<InsightType, number> = {
  decision: 0.95, // Decisions are critical
  requirement: 0.95, // Requirements are ground truth
  assumption: 0.9, // Assumptions need tracking
  risk: 0.9, // Risks need attention
  key_insight: 0.85, // Important observations
  opportunity: 0.85, // Opportunities worth noting
  open_question: 0.8, // Questions drive exploration
  context: 0.7, // Background info
};

// Labels for UI display
export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  decision: "Decision",
  requirement: "Requirement",
  assumption: "Assumption",
  risk: "Risk",
  key_insight: "Key Insight",
  opportunity: "Opportunity",
  open_question: "Open Question",
  context: "Context",
};

// =============================================================================
// Synthesis Prompt
// =============================================================================

const SYNTHESIS_SYSTEM_PROMPT = `You are a knowledge extraction specialist. Your task is to analyze a conversation and extract ALL meaningful knowledge chunks as SEPARATE, GRANULAR insights.

CRITICAL: Extract MANY insights (typically 10-30+ from a substantive conversation). Each distinct piece of knowledge should be its own insight. Do NOT combine multiple concepts into one.

Categories to extract (aim for multiple per category where applicable):
1. DECISIONS - Each decision or conclusion made (even implicit ones)
2. ASSUMPTIONS - Each belief or premise being taken as true
3. OPEN QUESTIONS - Each question that remains unanswered or needs exploration
4. KEY INSIGHTS - Each important observation, conclusion, or realization
5. REQUIREMENTS - Each explicitly stated must-have or constraint
6. CONTEXT - Each piece of important background information
7. RISKS - Each identified concern, challenge, or potential problem
8. OPPORTUNITIES - Each identified potential benefit or possibility

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
      "type": "decision|assumption|open_question|key_insight|requirement|context|risk|opportunity",
      "title": "Clear 5-10 word title",
      "content": "Comprehensive description with full context and implications",
      "confidence": 0.85,
      "sourceContext": "Brief note on where this came from"
    },
    {
      "id": "insight_2",
      ...
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
        decisionCount: 0,
        assumptionCount: 0,
        questionCount: 0,
        insightCount: 0,
        requirementCount: 0,
        contextCount: 0,
        riskCount: 0,
        opportunityCount: 0,
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

Be exhaustive - a typical conversation should yield 10-30+ distinct insights across categories (decisions, assumptions, questions, insights, requirements, context, risks, opportunities).

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
    const insights = parseInsightsResponse(textContent.text);

    if (!insights || insights.length === 0) {
      console.warn(`[ConversationSynthesizer] Failed to parse insights`);
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

    // Validate and normalize insights
    return parsed.insights
      .filter((insight: any) => {
        return (
          insight.id &&
          insight.type &&
          insight.title &&
          insight.content &&
          typeof insight.confidence === "number"
        );
      })
      .map((insight: any) => ({
        id: insight.id,
        type: normalizeInsightType(insight.type),
        title: insight.title,
        content: insight.content,
        confidence: Math.min(1, Math.max(0, insight.confidence)),
        sourceContext: insight.sourceContext || "",
      }));
  } catch (error) {
    console.error(`[ConversationSynthesizer] Failed to parse insights:`, error);
    return [];
  }
}

function normalizeInsightType(type: string): InsightType {
  const validTypes: InsightType[] = [
    "decision",
    "assumption",
    "open_question",
    "key_insight",
    "requirement",
    "context",
    "risk",
    "opportunity",
  ];

  const normalized = type.toLowerCase().replace(/\s+/g, "_");

  if (validTypes.includes(normalized as InsightType)) {
    return normalized as InsightType;
  }

  // Map common variations
  if (normalized.includes("question")) return "open_question";
  if (normalized.includes("insight")) return "key_insight";
  if (normalized.includes("decide") || normalized.includes("conclusion"))
    return "decision";
  if (normalized.includes("assume")) return "assumption";
  if (normalized.includes("require") || normalized.includes("must"))
    return "requirement";
  if (normalized.includes("risk") || normalized.includes("concern"))
    return "risk";
  if (normalized.includes("opportun")) return "opportunity";

  return "context"; // Default fallback
}

function calculateMetadata(insights: ConversationInsight[]): {
  decisionCount: number;
  assumptionCount: number;
  questionCount: number;
  insightCount: number;
  requirementCount: number;
  contextCount: number;
  riskCount: number;
  opportunityCount: number;
} {
  const counts = {
    decisionCount: 0,
    assumptionCount: 0,
    questionCount: 0,
    insightCount: 0,
    requirementCount: 0,
    contextCount: 0,
    riskCount: 0,
    opportunityCount: 0,
  };

  for (const insight of insights) {
    switch (insight.type) {
      case "decision":
        counts.decisionCount++;
        break;
      case "assumption":
        counts.assumptionCount++;
        break;
      case "open_question":
        counts.questionCount++;
        break;
      case "key_insight":
        counts.insightCount++;
        break;
      case "requirement":
        counts.requirementCount++;
        break;
      case "context":
        counts.contextCount++;
        break;
      case "risk":
        counts.riskCount++;
        break;
      case "opportunity":
        counts.opportunityCount++;
        break;
    }
  }

  return counts;
}

function createEmptyResult(totalMessages: number): SynthesisResult {
  return {
    insights: [],
    totalMessages,
    synthesisMetadata: {
      decisionCount: 0,
      assumptionCount: 0,
      questionCount: 0,
      insightCount: 0,
      requirementCount: 0,
      contextCount: 0,
      riskCount: 0,
      opportunityCount: 0,
    },
  };
}

// =============================================================================
// Initialization
// =============================================================================

console.log(`[ConversationSynthesizer] Initialized`);
