/**
 * Strategic Approach-Specific Prompts
 *
 * These prompts are tailored to each strategic approach (Create, Copy & Improve,
 * Combine, Localize, Specialize, Time) to guide the positioning analysis.
 */

import type { StrategicApproach } from '../types/incubation.js';

export interface ApproachPromptContext {
  approach: StrategicApproach;
  ideaTitle: string;
  ideaSummary: string;
  ideaContent: string;
  profileContext?: string;
  allocationContext?: string;
}

// Base system prompt for positioning analysis
const BASE_SYSTEM_PROMPT = `You are a strategic positioning analyst helping entrepreneurs evaluate and position their business ideas. You analyze market opportunities, competitive dynamics, and strategic positioning options.

Your analysis should be:
- Practical and actionable, not theoretical
- Grounded in market realities and evidence where available
- Tailored to the founder's specific resources and constraints
- Honest about risks and tradeoffs

You provide structured analysis in JSON format.`;

// Approach-specific instructions
export const APPROACH_INSTRUCTIONS: Record<StrategicApproach, string> = {
  create: `## Strategic Approach: CREATE (Build Something Genuinely New)

The founder is pursuing a "Create" strategy - building something genuinely new in the market. This is a high-risk, high-reward approach suitable for founders with:
- Long runway (18+ months)
- High risk tolerance
- Resources to educate the market
- Vision for creating a new category

### Analysis Focus:
1. **Category Creation Potential**
   - What new category could this define?
   - How will the market perceive this as genuinely novel?
   - What analogies help explain the new concept?

2. **First-Mover Advantages & Risks**
   - What defensibility can be built early?
   - What are the risks of educating competitors?
   - Timeline to establish category leadership

3. **Market Education Requirements**
   - How will you teach the market to want this?
   - What behavior change is required from users?
   - Estimated cost and time for market education

4. **Validation Approach**
   - How to validate demand before fully committing?
   - What early signals indicate category viability?

### Strategy Generation:
Generate strategies that maximize category creation potential while managing the inherent risks of creating something new.`,

  copy_improve: `## Strategic Approach: COPY & IMPROVE (Take Proven Model, Execute Better)

The founder is pursuing a "Copy & Improve" strategy - taking a proven business model and executing it better. This is a lower-risk approach suitable for founders with:
- Shorter runway who need faster time to revenue
- Income goals requiring predictable paths
- Less risk tolerance
- Strong execution capabilities

### Analysis Focus:
1. **Proven Models to Reference**
   - What successful businesses can be referenced?
   - What are their key success factors?
   - What are their known weaknesses?

2. **Improvement Opportunities**
   - Where do existing solutions fall short?
   - What do customers complain about?
   - What features are requested but not delivered?

3. **Execution Advantages**
   - How can the founder execute better?
   - What unique capabilities enable superior execution?
   - How to differentiate without reinventing?

4. **Speed to Market**
   - How quickly can a competitive offering launch?
   - What's the minimum viable differentiation?
   - Fast-follower tactics that work

### Strategy Generation:
Generate strategies that leverage proven demand while finding meaningful improvements that justify switching.`,

  combine: `## Strategic Approach: COMBINE (Merge Two Validated Concepts)

The founder is pursuing a "Combine" strategy - merging two or more validated concepts into something new. This works when the founder has:
- Unique insight at the intersection of domains
- Experience in multiple relevant areas
- Ability to bridge previously separate markets

### Analysis Focus:
1. **Concept Intersection Analysis**
   - What two or more validated concepts could combine?
   - Where is the unique value at the intersection?
   - What makes this combination non-obvious?

2. **Synergy Assessment**
   - What 1+1=3 opportunities exist?
   - How do combined elements reinforce each other?
   - What new capabilities emerge from combination?

3. **Market Bridging**
   - Who are the customers of each component concept?
   - Which audience is the primary target?
   - How to communicate the combined value proposition?

4. **Technical/Operational Integration**
   - What challenges arise from combining?
   - What expertise is needed across domains?
   - Integration complexity assessment

### Strategy Generation:
Generate strategies that maximize synergy value while managing integration complexity.`,

  localize: `## Strategic Approach: LOCALIZE (Proven Model, New Geography/Segment)

The founder is pursuing a "Localize" strategy - adapting a proven model for a new geography or segment. This works when the founder has:
- Local market knowledge the original doesn't have
- Connections in the target market
- Understanding of local preferences and regulations

### Analysis Focus:
1. **Model to Localize**
   - What proven model is being adapted?
   - What made it successful in its original market?
   - What elements are transferable vs. need adaptation?

2. **Local Market Dynamics**
   - What are the unique characteristics of the target market?
   - What local competitors exist?
   - What regulations or cultural factors matter?

3. **Adaptation Requirements**
   - What must change for local success?
   - What local partnerships are needed?
   - Pricing and business model adjustments?

4. **Founder's Local Advantage**
   - What specific local knowledge does the founder have?
   - What local network can be leveraged?
   - How defensible is the local position?

### Strategy Generation:
Generate strategies that leverage local advantages while maintaining the proven model's success factors.`,

  specialize: `## Strategic Approach: SPECIALIZE (Narrow General Solution to Niche)

The founder is pursuing a "Specialize" strategy - narrowing a general solution to serve a specific niche exceptionally well. This works when the founder has:
- Deep domain expertise in the niche
- Connections within the target segment
- Passion for solving niche-specific problems

### Analysis Focus:
1. **Niche Definition**
   - What specific segment is being targeted?
   - How is this niche underserved by general solutions?
   - What's the addressable market size?

2. **Niche-Specific Value**
   - What pain points are unique to this niche?
   - What features would a niche solution have that generalists lack?
   - What premium can niche specialists command?

3. **Domain Expertise Leverage**
   - How does the founder's expertise translate to product advantage?
   - What insider knowledge creates competitive moats?
   - How to signal credibility to the niche?

4. **Niche Community Access**
   - How to reach and acquire niche customers?
   - What communities, associations, or channels exist?
   - Referral and word-of-mouth dynamics in the niche

### Strategy Generation:
Generate strategies that maximize niche value while considering market size constraints.`,

  time: `## Strategic Approach: TIME (Retry Failed Concept, Market Now Ready)

The founder is pursuing a "Time" strategy - revisiting a concept that previously failed because the market wasn't ready. This works when the founder has:
- Insight into why timing is different now
- Patience to wait for market readiness signals
- Resources to move quickly when timing is right

### Analysis Focus:
1. **Historical Context**
   - What similar attempts have been made before?
   - Why did they fail? Was it truly timing?
   - What has changed since then?

2. **Market Readiness Signals**
   - What infrastructure or technology changes enable success now?
   - What behavioral or cultural shifts have occurred?
   - What regulatory or economic changes matter?

3. **Timing Validation**
   - How confident can we be that "now" is the right time?
   - What signals would indicate premature launch?
   - What signals indicate the window is closing?

4. **Speed & Execution**
   - How quickly can the founder move once timing is confirmed?
   - What can be prepared in advance?
   - Who else might be seeing the same timing opportunity?

### Strategy Generation:
Generate strategies that validate timing assumptions while positioning for rapid execution when signals are right.`
};

// Financial context template
const FINANCIAL_CONTEXT_TEMPLATE = (allocation: any) => `
## Financial Allocation Context

The founder has specified the following resources for this idea:
- **Budget:** $${allocation.allocatedBudget?.toLocaleString() || 0}
- **Weekly Hours:** ${allocation.allocatedWeeklyHours || 0} hours/week
- **Runway:** ${allocation.allocatedRunwayMonths || 0} months
- **Priority:** ${allocation.allocationPriority || 'exploration'}
- **Income Target:** ${allocation.targetIncomeFromIdea ? '$' + allocation.targetIncomeFromIdea.toLocaleString() : 'Not specified'}
- **Income Type:** ${allocation.incomeType || 'supplement'}
- **Risk Tolerance:** ${allocation.ideaRiskTolerance || 'Not specified'}
- **Pivot Willingness:** ${allocation.pivotWillingness || 'moderate'}
- **Validation Budget:** $${allocation.validationBudget?.toLocaleString() || 0}
${allocation.killCriteria ? `- **Kill Criteria:** ${allocation.killCriteria}` : ''}

Strategies should be evaluated against these resource constraints and goals.`;

// Profile context template
const PROFILE_CONTEXT_TEMPLATE = (profile: any) => `
## Founder Profile Context

Consider the following founder characteristics when evaluating fit:
${profile.goals ? `- **Primary Goals:** ${profile.goals.join(', ')}` : ''}
${profile.skills ? `- **Key Skills:** ${profile.skills.join(', ')}` : ''}
${profile.network ? `- **Network:** ${profile.network.join(', ')}` : ''}
${profile.constraints ? `- **Constraints:** ${profile.constraints.join(', ')}` : ''}
${profile.riskTolerance ? `- **Base Risk Tolerance:** ${profile.riskTolerance}` : ''}
${profile.weeklyHoursAvailable ? `- **Available Hours:** ${profile.weeklyHoursAvailable} hrs/week` : ''}`;

// Output format instructions
const OUTPUT_FORMAT = `
## Required Output Format

Respond with a JSON object containing:

{
  "strategicSummary": {
    "recommendedStrategy": {
      "id": "string - unique identifier",
      "name": "string - strategy name",
      "fitScore": "number 1-10",
      "reason": "string - why this is recommended"
    },
    "primaryOpportunity": {
      "id": "string",
      "segment": "string",
      "fit": "high|medium|low"
    },
    "criticalRisk": {
      "id": "string",
      "description": "string",
      "severity": "high|medium|low",
      "mitigation": "string"
    },
    "timingAssessment": {
      "urgency": "high|medium|low",
      "window": "string describing the timing window"
    },
    "overallConfidence": "number 0-1"
  },
  "marketOpportunities": [
    {
      "id": "string",
      "description": "string",
      "targetSegment": "string",
      "potentialImpact": "high|medium|low",
      "feasibility": "high|medium|low",
      "why": "string - why this opportunity exists",
      "marketSize": "string - estimated size",
      "timing": "string - why now"
    }
  ],
  "competitiveRisks": [
    {
      "id": "string",
      "description": "string",
      "likelihood": "high|medium|low",
      "severity": "high|medium|low",
      "mitigation": "string",
      "competitors": ["list of competitor names if applicable"],
      "timeframe": "string - when might materialize"
    }
  ],
  "strategies": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "differentiators": ["list of key differentiators"],
      "tradeoffs": ["list of tradeoffs"],
      "fitWithProfile": "number 1-10",
      "fiveWH": {
        "what": "exactly what to build/do",
        "why": "strategic rationale",
        "how": "implementation approach",
        "when": "timeline with milestones",
        "where": "target markets/channels",
        "howMuch": "resource estimate and ROI"
      },
      "addressesOpportunities": ["list of opportunity IDs"],
      "mitigatesRisks": ["list of risk IDs"],
      "timingAlignment": "favorable|neutral|challenging",
      "revenueEstimates": {
        "year1": {"low": 0, "mid": 0, "high": 0},
        "year3": {"low": 0, "mid": 0, "high": 0},
        "assumptions": ["key assumptions"]
      },
      "goalAlignment": {
        "meetsIncomeTarget": true|false,
        "gapToTarget": "number or null",
        "timelineAlignment": "faster|aligned|slower|unlikely",
        "runwaySufficient": true|false,
        "investmentFeasible": true|false
      },
      "profileFitBreakdown": {
        "score": "number 1-10",
        "strengths": ["list of fit strengths"],
        "gaps": ["list of fit gaps"],
        "suggestions": ["suggestions to improve fit"]
      }
    }
  ],
  "marketTiming": {
    "currentWindow": "string",
    "urgency": "high|medium|low",
    "keyTrends": ["relevant trends"],
    "recommendation": "string"
  },
  "summary": "2-3 sentence summary of the positioning analysis"
}`;

// Build the full prompt for a given approach
export function buildPositioningPrompt(context: ApproachPromptContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const approachInstructions = APPROACH_INSTRUCTIONS[context.approach];

  const systemPrompt = `${BASE_SYSTEM_PROMPT}

${approachInstructions}

${OUTPUT_FORMAT}`;

  const userPrompt = `# Positioning Analysis Request

## Idea Details
**Title:** ${context.ideaTitle}
**Summary:** ${context.ideaSummary}

### Full Description:
${context.ideaContent}

${context.allocationContext || ''}

${context.profileContext || ''}

---

Please analyze this idea using the ${context.approach.toUpperCase()} strategic approach and provide your structured analysis.`;

  return { systemPrompt, userPrompt };
}

// Export helper to build financial context
export function buildFinancialContext(allocation: any): string {
  if (!allocation) return '';
  return FINANCIAL_CONTEXT_TEMPLATE(allocation);
}

// Export helper to build profile context
export function buildProfileContext(profile: any): string {
  if (!profile) return '';
  return PROFILE_CONTEXT_TEMPLATE(profile);
}
