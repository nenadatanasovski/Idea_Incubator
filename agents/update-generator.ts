/**
 * Update Generator Agent
 *
 * Synthesizes ALL information from previous phases to generate
 * AI-suggested updates to the idea description:
 * - Original idea (Capture phase)
 * - Q&A answers (Clarify phase)
 * - Differentiation analysis + user decisions (Position phase)
 * - Financial allocation (Position phase)
 */

import { client } from "../utils/anthropic-client.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { logInfo } from "../utils/logger.js";
import { getConfig } from "../config/index.js";
import { EvaluationParseError } from "../utils/errors.js";
import type {
  DifferentiationAnalysis,
  ProfileContext,
  StrategicApproach,
} from "../types/incubation.js";

const UPDATE_GENERATOR_SYSTEM_PROMPT = `You are an Idea Refinement Agent for idea incubation.

Your job is to synthesize ALL context from previous phases into an improved idea description:

CONTEXT SOURCES (in order of importance):
1. USER'S POSITIONING DECISIONS - Their chosen strategy, timing, and approach
2. FINANCIAL CONSTRAINTS - Budget, time, runway, income goals, kill criteria
3. RISK RESPONSES - How they plan to handle identified risks
4. DIFFERENTIATION ANALYSIS - AI-generated opportunities, strategies, timing
5. Q&A DISCOVERY - Specific insights from clarification questions
6. USER PROFILE - Goals, skills, network, life stage

CRITICAL RULES:
- The user's SELECTED STRATEGY takes precedence over AI recommendations
- Respect financial constraints - don't suggest things beyond their budget/time
- Honor timing decisions (proceed_now/wait/urgent) in the narrative
- Kill criteria should be reflected in success metrics
- Strategic approach (create/copy_improve/localize/etc.) shapes the entire framing

OUTPUT REQUIREMENTS:
- Generate updated title, summary, and detailed content
- Be specific about what changed and why
- Reference specific insights and decisions
- Make the idea actionable within stated constraints
- Preserve the core essence while making it more focused

Output valid JSON only.`;

export interface UpdateSuggestion {
  suggestedTitle: string;
  suggestedSummary: string;
  suggestedContent: string;
  changeRationale: {
    title: string;
    summary: string;
    content: string;
    overall: string;
  };
  keyInsightsIncorporated: string[];
  positioningStrategy: string;
  targetSegment: string;
}

export interface QAContext {
  question: string;
  answer: string;
}

// Risk response types for update context
export interface RiskResponseContext {
  riskId: string;
  riskDescription: string;
  riskSeverity: "high" | "medium" | "low";
  response: "mitigate" | "accept" | "monitor" | "disagree" | "skip";
  disagreeReason?: string;
  reasoning?: string;
  mitigationPlan?: string;
}

// User's strategic decisions from Position phase
export interface PositioningContext {
  primaryStrategyId?: string;
  primaryStrategyName?: string;
  secondaryStrategyName?: string;
  timingDecision?: "proceed_now" | "wait" | "urgent";
  timingRationale?: string;
  strategicApproach?: StrategicApproach;
  notes?: string;
}

// User's financial allocation for this idea
export interface FinancialContext {
  allocatedBudget?: number;
  allocatedWeeklyHours?: number;
  allocatedRunwayMonths?: number;
  targetIncome?: number;
  incomeTimelineMonths?: number;
  incomeType?:
    | "full_replacement"
    | "partial_replacement"
    | "supplement"
    | "wealth_building"
    | "learning";
  validationBudget?: number;
  killCriteria?: string;
  strategicApproach?: StrategicApproach;
  approachRationale?: string;
}

// Extended analysis from differentiation (market timing, roadmap)
export interface ExtendedAnalysisContext {
  marketTimingAnalysis?: {
    currentWindow?: string;
    urgency?: string;
    keyTrends?: string[];
    recommendation?: string;
  };
  executionRoadmap?: {
    phases?: Array<{ name: string; duration: string; activities: string[] }>;
  };
  strategicSummary?: string;
}

/**
 * Format risk responses for inclusion in the update prompt
 */
function formatRiskResponseContext(
  riskResponses: RiskResponseContext[],
): string {
  if (!riskResponses || riskResponses.length === 0) return "";

  const formatted = riskResponses
    .filter((r) => r.response !== "skip")
    .map((r) => {
      switch (r.response) {
        case "mitigate":
          return `USER WILL MITIGATE: "${r.riskDescription}"
  Plan: ${r.mitigationPlan || "Not specified"}
  → Suggest content that supports this mitigation strategy`;

        case "disagree":
          return `USER DISAGREES WITH RISK: "${r.riskDescription}"
  Reason: ${r.disagreeReason || "Not specified"}
  Explanation: ${r.reasoning || "None provided"}
  → Do NOT emphasize this risk in updates. User has context we don't.`;

        case "monitor":
          return `USER WILL MONITOR: "${r.riskDescription}"
  ${r.mitigationPlan ? `Notes: ${r.mitigationPlan}` : ""}
  → Include monitoring checkpoints in suggested timeline`;

        case "accept":
          return `USER ACCEPTS RISK: "${r.riskDescription}"
  ${r.reasoning ? `Notes: ${r.reasoning}` : ""}
  → Acknowledge but don't over-emphasize`;

        default:
          return null;
      }
    })
    .filter(Boolean);

  if (formatted.length === 0) return "";

  return `
USER'S RISK ASSESSMENT:
The user has reviewed the competitive risks and provided their perspective:

${formatted.join("\n\n")}

Use this context to tailor your update suggestions. Respect user's insider
knowledge when they disagree with AI-identified risks.`;
}

/**
 * Format positioning decisions for the prompt
 */
function formatPositioningContext(ctx: PositioningContext | undefined): string {
  if (!ctx) return "";

  const parts: string[] = [];

  if (ctx.primaryStrategyName) {
    parts.push(`PRIMARY STRATEGY: ${ctx.primaryStrategyName}`);
  }
  if (ctx.secondaryStrategyName) {
    parts.push(`BACKUP STRATEGY: ${ctx.secondaryStrategyName}`);
  }

  if (ctx.timingDecision) {
    const timingLabels = {
      proceed_now: "PROCEED NOW - User is ready to execute",
      wait: "WAIT - User wants to delay execution",
      urgent: "URGENT - Time-sensitive opportunity",
    };
    parts.push(`TIMING DECISION: ${timingLabels[ctx.timingDecision]}`);
    if (ctx.timingRationale) {
      parts.push(`  Rationale: ${ctx.timingRationale}`);
    }
  }

  if (ctx.strategicApproach) {
    const approachLabels: Record<string, string> = {
      create:
        "CREATE - Building something genuinely new (high risk, long timeline)",
      copy_improve:
        "COPY & IMPROVE - Take proven model, execute better (low risk, fast)",
      combine: "COMBINE - Merge two validated concepts (medium risk)",
      localize: "LOCALIZE - Proven model, new geography/segment (low risk)",
      specialize: "SPECIALIZE - Narrow general solution to niche (low risk)",
      time: "TIME - Retry failed concept, market now ready (variable)",
    };
    parts.push(
      `STRATEGIC APPROACH: ${approachLabels[ctx.strategicApproach] || ctx.strategicApproach}`,
    );
  }

  if (ctx.notes) {
    parts.push(`USER NOTES: ${ctx.notes}`);
  }

  if (parts.length === 0) return "";

  return `
USER'S POSITIONING DECISIONS:
${parts.join("\n")}

Frame the idea according to these decisions. The selected strategy and timing are the user's choices.`;
}

/**
 * Format financial context for the prompt
 */
function formatFinancialContext(ctx: FinancialContext | undefined): string {
  if (!ctx) return "";

  const parts: string[] = [];

  // Resource allocation
  if (ctx.allocatedBudget !== undefined && ctx.allocatedBudget > 0) {
    parts.push(`- Allocated Budget: $${ctx.allocatedBudget.toLocaleString()}`);
  }
  if (ctx.allocatedWeeklyHours !== undefined && ctx.allocatedWeeklyHours > 0) {
    parts.push(`- Weekly Hours: ${ctx.allocatedWeeklyHours}h/week`);
  }
  if (
    ctx.allocatedRunwayMonths !== undefined &&
    ctx.allocatedRunwayMonths > 0
  ) {
    parts.push(`- Runway: ${ctx.allocatedRunwayMonths} months`);
  }

  // Income goals
  if (ctx.targetIncome !== undefined && ctx.targetIncome > 0) {
    const timeline = ctx.incomeTimelineMonths
      ? ` within ${ctx.incomeTimelineMonths} months`
      : "";
    parts.push(
      `- Target Income: $${ctx.targetIncome.toLocaleString()}/year${timeline}`,
    );
  }
  if (ctx.incomeType) {
    const incomeLabels: Record<string, string> = {
      full_replacement: "Full income replacement (must generate living wage)",
      partial_replacement:
        "Partial income replacement (supplementing other income)",
      supplement: "Supplemental income (extra money)",
      wealth_building: "Wealth building (equity play, income later)",
      learning: "Learning focused (income not primary goal)",
    };
    parts.push(
      `- Income Type: ${incomeLabels[ctx.incomeType] || ctx.incomeType}`,
    );
  }

  // Validation constraints
  if (ctx.validationBudget !== undefined && ctx.validationBudget > 0) {
    parts.push(
      `- Validation Budget: $${ctx.validationBudget.toLocaleString()}`,
    );
  }
  if (ctx.killCriteria) {
    parts.push(`- Kill Criteria: ${ctx.killCriteria}`);
  }

  if (parts.length === 0) return "";

  return `
FINANCIAL CONSTRAINTS:
${parts.join("\n")}

IMPORTANT: Tailor suggestions to fit within these constraints. Don't suggest
approaches that exceed budget or time allocation. Kill criteria should inform
success metrics and go/no-go decision points.`;
}

/**
 * Format extended analysis (market timing, roadmap)
 */
function formatExtendedAnalysis(
  ctx: ExtendedAnalysisContext | undefined,
): string {
  if (!ctx) return "";

  const parts: string[] = [];

  if (ctx.strategicSummary) {
    parts.push(`STRATEGIC SUMMARY: ${ctx.strategicSummary}`);
  }

  if (ctx.marketTimingAnalysis) {
    const mt = ctx.marketTimingAnalysis;
    if (mt.currentWindow || mt.urgency) {
      parts.push(`MARKET TIMING:`);
      if (mt.currentWindow) parts.push(`  Window: ${mt.currentWindow}`);
      if (mt.urgency) parts.push(`  Urgency: ${mt.urgency}`);
      if (mt.keyTrends?.length)
        parts.push(`  Trends: ${mt.keyTrends.join(", ")}`);
      if (mt.recommendation)
        parts.push(`  Recommendation: ${mt.recommendation}`);
    }
  }

  if (ctx.executionRoadmap?.phases?.length) {
    parts.push(`EXECUTION ROADMAP:`);
    ctx.executionRoadmap.phases.forEach((phase, i) => {
      parts.push(`  Phase ${i + 1}: ${phase.name} (${phase.duration})`);
    });
  }

  if (parts.length === 0) return "";

  return `
EXTENDED ANALYSIS:
${parts.join("\n")}`;
}

/**
 * Generate suggested updates to the idea based on ALL context from previous phases
 */
export async function generateUpdateSuggestions(
  originalIdea: {
    title: string;
    summary: string;
    content: string;
  },
  differentiationAnalysis: DifferentiationAnalysis,
  selectedStrategyIndex: number | null,
  profile: ProfileContext,
  qaContext: QAContext[],
  costTracker: CostTracker,
  riskResponses?: RiskResponseContext[],
  positioningContext?: PositioningContext,
  financialContext?: FinancialContext,
  extendedAnalysis?: ExtendedAnalysisContext,
): Promise<UpdateSuggestion> {
  const config = getConfig();

  logInfo("Generating idea update suggestions...");

  // Get the selected strategy - prioritize user's stored selection over index
  const strategies = differentiationAnalysis.differentiationStrategies || [];
  if (strategies.length === 0) {
    throw new EvaluationParseError(
      "No differentiation strategies available. Run differentiation analysis first.",
    );
  }

  // Find strategy by ID if user selected one in Position phase, otherwise use index or first
  let selectedStrategy = strategies[0];
  if (positioningContext?.primaryStrategyId) {
    const byId = strategies.find(
      (s: any) => s.id === positioningContext.primaryStrategyId,
    );
    if (byId) selectedStrategy = byId;
  } else if (
    selectedStrategyIndex !== null &&
    selectedStrategyIndex < strategies.length
  ) {
    selectedStrategy = strategies[selectedStrategyIndex];
  }

  // Get top opportunities with defensive checks (handle both field naming conventions)
  const opportunities = differentiationAnalysis.marketOpportunities || [];
  const topOpportunities = opportunities
    .slice(0, 3)
    .map(
      (o) =>
        `${o.targetSegment || (o as any).segment || "Unknown segment"}: ${o.description || "No description"}`,
    );

  const hasBasicProfile = profile.goals?.length || profile.skills?.length;
  const hasExtendedProfile =
    profile.motivations || profile.domainConnection || profile.riskTolerance;

  const profileText =
    hasBasicProfile || hasExtendedProfile
      ? `
USER PROFILE CONTEXT:
${profile.goals?.length ? `- Goals: ${profile.goals.join(", ")}` : ""}
${profile.successDefinition ? `- Success Definition: ${profile.successDefinition}` : ""}
${profile.skills?.length ? `- Technical Skills: ${profile.skills.join(", ")}` : ""}
${profile.domainExpertise?.length ? `- Domain Expertise: ${profile.domainExpertise.join(", ")}` : ""}
${profile.interests?.length ? `- Interests: ${profile.interests.join(", ")}` : ""}
${profile.motivations ? `- Motivations: ${profile.motivations}` : ""}
${profile.domainConnection ? `- Domain Connection: ${profile.domainConnection}` : ""}
${profile.professionalExperience ? `- Experience: ${profile.professionalExperience}` : ""}
${profile.knownGaps ? `- Known Gaps: ${profile.knownGaps}` : ""}
${profile.industryConnections?.length ? `- Industry Connections: ${profile.industryConnections.join(", ")}` : ""}
${profile.professionalNetwork ? `- Network: ${profile.professionalNetwork}` : ""}
${profile.employmentStatus ? `- Employment: ${profile.employmentStatus}` : ""}
${profile.weeklyHoursAvailable ? `- Available Hours/Week: ${profile.weeklyHoursAvailable}` : ""}
${profile.riskTolerance ? `- Risk Tolerance: ${profile.riskTolerance}` : ""}`
          .split("\n")
          .filter((line) => line.trim() && !line.trim().startsWith("-:"))
          .join("\n")
      : "";

  // Build Q&A context from Clarify phase
  const qaText =
    qaContext.length > 0
      ? `
CLARIFICATION Q&A (from discovery phase):
${qaContext
  .map(
    (qa, i) => `Q${i + 1}: ${qa.question}
A${i + 1}: ${qa.answer}`,
  )
  .join("\n\n")}`
      : "";

  // Build context from Position phase
  const riskContext = formatRiskResponseContext(riskResponses || []);
  const positioningText = formatPositioningContext(positioningContext);
  const financialText = formatFinancialContext(financialContext);
  const extendedText = formatExtendedAnalysis(extendedAnalysis);

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 4000,
    system: UPDATE_GENERATOR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate an updated version of this idea incorporating ALL context from previous phases:

=== ORIGINAL IDEA (from Capture) ===
Title: ${originalIdea.title}
Summary: ${originalIdea.summary || "None provided"}
Content:
${originalIdea.content || "None provided"}

=== DIFFERENTIATION ANALYSIS (AI-generated insights) ===
Summary: ${differentiationAnalysis.summary}

SELECTED POSITIONING STRATEGY:
Name: ${selectedStrategy.name || (selectedStrategy as any).approach || "Unnamed Strategy"}
Description: ${selectedStrategy.description || "No description"}
Key Differentiators: ${(selectedStrategy.differentiators || (selectedStrategy as any).alignedWith || []).join(", ") || "Not specified"}
Fit Score: ${selectedStrategy.fitWithProfile || "N/A"}/10
${
  selectedStrategy.fiveWH
    ? `
Implementation Details (5W+H):
- What: ${selectedStrategy.fiveWH.what || "Not specified"}
- Why: ${selectedStrategy.fiveWH.why || "Not specified"}
- How: ${selectedStrategy.fiveWH.how || "Not specified"}
- When: ${selectedStrategy.fiveWH.when || "Not specified"}
- Where: ${selectedStrategy.fiveWH.where || "Not specified"}
- Resources: ${selectedStrategy.fiveWH.howMuch || "Not specified"}
`
    : ""
}
${selectedStrategy.tradeoffs?.length ? `Tradeoffs: ${selectedStrategy.tradeoffs.join("; ")}` : ""}

TOP MARKET OPPORTUNITIES:
${topOpportunities.map((o, i) => `${i + 1}. ${o}`).join("\n")}
${extendedText}
${positioningText}
${financialText}
${riskContext}
${profileText}
${qaText}

=== GENERATION REQUIREMENTS ===
Create an improved version that:
1. Reflects the USER'S SELECTED STRATEGY (not just AI recommendations)
2. Fits within FINANCIAL CONSTRAINTS (budget, hours, runway)
3. Honors TIMING DECISION (${positioningContext?.timingDecision || "not specified"})
4. Incorporates KILL CRITERIA as success/failure metrics
5. Aligns with STRATEGIC APPROACH (${positioningContext?.strategicApproach || financialContext?.strategicApproach || "not specified"})
6. Addresses RISK RESPONSES appropriately
7. Leverages insights from Q&A DISCOVERY
8. Matches USER PROFILE (goals, skills, constraints)

Respond in JSON:
{
  "suggestedTitle": "Compelling title reflecting positioning and approach",
  "suggestedSummary": "2-3 sentence summary with value proposition, target market, and key differentiator",
  "suggestedContent": "Full updated idea description (markdown) including:\\n- Problem statement\\n- Solution with key differentiators\\n- Target market segment\\n- Competitive positioning\\n- Why now (market timing)\\n- Resource requirements (aligned with allocation)\\n- Success metrics (aligned with kill criteria)\\n- Key risks and mitigation",
  "changeRationale": {
    "title": "Why the title was changed",
    "summary": "Why the summary was updated",
    "content": "Key content changes and additions, referencing specific inputs used",
    "overall": "How these changes make the idea more actionable within stated constraints"
  },
  "keyInsightsIncorporated": ["Specific insight 1 from Position/Clarify phases", "Insight 2", "..."],
  "positioningStrategy": "The positioning strategy being adopted",
  "targetSegment": "The primary target segment"
}`,
      },
    ],
  });

  costTracker.track(response.usage, "update-generation");

  const content = response.content[0];
  if (content.type !== "text") {
    throw new EvaluationParseError(
      "Unexpected response type from update generator",
    );
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError(
      "Could not parse update suggestion response",
    );
  }

  let parsed: UpdateSuggestion;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new EvaluationParseError(
      "Invalid JSON in update suggestion response",
    );
  }

  logInfo("Update suggestions generated successfully");

  return parsed;
}
