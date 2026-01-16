/**
 * Question Classifier
 *
 * Classify free-form questions to structured YAML question IDs.
 * Uses keyword patterns to map user questions to the question bank.
 */

export interface ClassifiedQuestion {
  originalQuestion: string;
  questionId: string | null;
  confidence: number;
  category: string | null;
}

/**
 * Keyword patterns for each question ID.
 * Each ID maps to an array of regex patterns that match related questions.
 */
const QUESTION_PATTERNS: Record<
  string,
  { patterns: RegExp[]; category: string }
> = {
  // ==========================================
  // PROBLEM CATEGORY (P1-P5)
  // ==========================================

  // P1 - Problem Clarity
  P1_CORE: {
    patterns: [
      /core problem/i,
      /main problem/i,
      /what problem/i,
      /problem.*solving/i,
      /fundamental issue/i,
      /what.*trying to solve/i,
    ],
    category: "problem",
  },
  P1_SCOPE: {
    patterns: [
      /scope/i,
      /how big.*problem/i,
      /widespread/i,
      /how many.*affected/i,
      /scale of.*problem/i,
    ],
    category: "problem",
  },

  // P2 - Problem Severity
  P2_PAIN: {
    patterns: [
      /pain.*sever/i,
      /how.*bad/i,
      /how.*painful/i,
      /frustrat/i,
      /suffer/i,
      /severity/i,
      /how much.*hurt/i,
    ],
    category: "problem",
  },
  P2_COST: {
    patterns: [
      /cost of.*problem/i,
      /how much.*cost/i,
      /price.*pay/i,
      /financial impact/i,
      /money.*losing/i,
      /economic cost/i,
    ],
    category: "problem",
  },

  // P3 - Target User
  P3_WHO: {
    patterns: [
      /target user/i,
      /who.*experience/i,
      /customer.*who/i,
      /who.*problem/i,
      /ideal customer/i,
      /who are.*users/i,
    ],
    category: "problem",
  },
  P3_SEGMENT: {
    patterns: [
      /segment/i,
      /demographic/i,
      /type of user/i,
      /customer profile/i,
      /user persona/i,
    ],
    category: "problem",
  },

  // P4 - Problem Validation
  P4_EVIDENCE: {
    patterns: [
      /evidence/i,
      /validation/i,
      /proof/i,
      /research/i,
      /data.*support/i,
      /verified/i,
    ],
    category: "problem",
  },
  P4_CONVERSATIONS: {
    patterns: [
      /conversation/i,
      /talked to/i,
      /interview/i,
      /spoke with/i,
      /customer.*feedback/i,
      /user research/i,
    ],
    category: "problem",
  },

  // P5 - Problem Uniqueness (existing solutions, not competitors directly)
  P5_EXISTING: {
    patterns: [
      /existing solution/i,
      /current.*solution/i,
      /alternative.*solution/i,
      /current.*solving/i,
      /how.*solved today/i,
      /what.*people.*use.*now/i,
    ],
    category: "problem",
  },
  P5_GAP: {
    patterns: [
      /gap/i,
      /missing/i,
      /fail/i,
      /why.*not work/i,
      /shortcoming/i,
      /limitation/i,
    ],
    category: "problem",
  },

  // ==========================================
  // SOLUTION CATEGORY (S1-S5)
  // ==========================================

  // S1 - Solution Clarity
  S1_WHAT: {
    patterns: [
      /what.*solution/i,
      /solution.*description/i,
      /how.*work/i,
      /describe.*product/i,
      /what.*building/i,
    ],
    category: "solution",
  },
  S1_VALUE_PROP: {
    patterns: [
      /value prop/i,
      /why.*buy/i,
      /benefit/i,
      /value.*offer/i,
      /unique value/i,
      /key benefit/i,
    ],
    category: "solution",
  },

  // S2 - Technical Feasibility
  S2_TECH: {
    patterns: [
      /technology/i,
      /tech stack/i,
      /technical/i,
      /built with/i,
      /architecture/i,
      /infrastructure/i,
    ],
    category: "solution",
  },
  S2_HARD: {
    patterns: [
      /hard.*part/i,
      /difficult/i,
      /challenge/i,
      /complex/i,
      /technical.*risk/i,
      /biggest.*obstacle/i,
    ],
    category: "solution",
  },

  // S3 - Solution Uniqueness
  S3_DIFF: {
    patterns: [
      /different/i,
      /differentiat/i,
      /unique/i,
      /better than/i,
      /stand.*out/i,
      /competitive advantage/i,
    ],
    category: "solution",
  },

  // S4 - Scalability
  S4_SCALE: {
    patterns: [
      /scale/i,
      /grow/i,
      /expand/i,
      /10x/i,
      /scaling/i,
      /growth potential/i,
    ],
    category: "solution",
  },

  // S5 - Defensibility
  S5_MOAT: {
    patterns: [
      /moat/i,
      /defend/i,
      /barrier/i,
      /protect/i,
      /competitive.*advantage/i,
      /hard to copy/i,
    ],
    category: "solution",
  },

  // ==========================================
  // MARKET CATEGORY (M1-M5)
  // ==========================================

  // M1 - Market Size
  M1_TAM: {
    patterns: [
      /market size/i,
      /tam/i,
      /total.*market/i,
      /how big.*market/i,
      /how large.*market/i,
      /target.*market/i,
      /addressable market/i,
    ],
    category: "market",
  },
  M1_SAM: {
    patterns: [
      /sam/i,
      /serviceable/i,
      /available market/i,
      /reachable market/i,
    ],
    category: "market",
  },

  // M2 - Market Growth
  M2_TREND: {
    patterns: [
      /trend/i,
      /grow.*market/i,
      /direction/i,
      /market.*grow/i,
      /market.*trajectory/i,
      /growth rate/i,
    ],
    category: "market",
  },

  // M3 - Competition
  M3_COMPETITORS: {
    patterns: [
      /competitor/i,
      /competition/i,
      /who else/i,
      /rival/i,
      /competitive landscape/i,
      /market player/i,
    ],
    category: "market",
  },

  // M4 - Entry Barriers
  M4_BARRIERS: {
    patterns: [
      /barrier/i,
      /entry/i,
      /hard to enter/i,
      /obstacles/i,
      /entry cost/i,
      /switching cost/i,
    ],
    category: "market",
  },

  // M5 - Timing
  M5_WHY_NOW: {
    patterns: [
      /timing/i,
      /why now/i,
      /right time/i,
      /market timing/i,
      /opportunity now/i,
      /window/i,
    ],
    category: "market",
  },

  // ==========================================
  // FEASIBILITY CATEGORY (F1-F5)
  // ==========================================

  // F1 - Technical Complexity
  F1_MVP: {
    patterns: [
      /mvp/i,
      /minimum.*viable/i,
      /first version/i,
      /prototype/i,
      /initial product/i,
      /v1/i,
    ],
    category: "feasibility",
  },
  F1_COMPONENTS: {
    patterns: [/component/i, /pieces/i, /parts/i, /modules/i, /system.*parts/i],
    category: "feasibility",
  },

  // F2 - Resource Requirements
  F2_COST: {
    patterns: [
      /cost to build/i,
      /budget/i,
      /how much.*build/i,
      /development cost/i,
      /investment needed/i,
      /funding/i,
    ],
    category: "feasibility",
  },
  F2_TEAM: {
    patterns: [/team/i, /hire/i, /people/i, /staff/i, /talent/i, /who.*need/i],
    category: "feasibility",
  },

  // F3 - Skill Availability
  F3_GAP: {
    patterns: [
      /skill.*gap/i,
      /skill.*need/i,
      /what.*learn/i,
      /expertise.*need/i,
      /capability gap/i,
    ],
    category: "feasibility",
  },

  // F4 - Time to Value
  F4_FIRST_VALUE: {
    patterns: [
      /first.*value/i,
      /time to/i,
      /how long/i,
      /timeline/i,
      /when.*launch/i,
      /launch date/i,
    ],
    category: "feasibility",
  },

  // F5 - Dependencies
  F5_DEPS: {
    patterns: [
      /depend/i,
      /rely on/i,
      /third party/i,
      /external/i,
      /vendor/i,
      /partnership/i,
    ],
    category: "feasibility",
  },

  // ==========================================
  // RISK CATEGORY (R1-R5)
  // ==========================================

  R_BIGGEST: {
    patterns: [
      /biggest risk/i,
      /main risk/i,
      /what.*risk/i,
      /primary concern/i,
      /top risk/i,
    ],
    category: "risk",
  },
  R_MITIGATION: {
    patterns: [
      /mitigat/i,
      /handle.*risk/i,
      /reduce.*risk/i,
      /address.*risk/i,
      /manage.*risk/i,
    ],
    category: "risk",
  },
  R_EXECUTION: {
    patterns: [
      /execution risk/i,
      /fail.*build/i,
      /delivery risk/i,
      /operational risk/i,
    ],
    category: "risk",
  },
  R_MARKET: {
    patterns: [/market risk/i, /demand/i, /adoption risk/i, /customer risk/i],
    category: "risk",
  },
  R_TECHNICAL: {
    patterns: [
      /technical risk/i,
      /tech.*fail/i,
      /technology risk/i,
      /implementation risk/i,
    ],
    category: "risk",
  },
  R_FINANCIAL: {
    patterns: [
      /financial risk/i,
      /money.*risk/i,
      /run out/i,
      /cash.*flow/i,
      /funding risk/i,
    ],
    category: "risk",
  },
  R_REGULATORY: {
    patterns: [
      /regulatory/i,
      /compliance/i,
      /legal/i,
      /regulation/i,
      /license/i,
    ],
    category: "risk",
  },

  // ==========================================
  // FIT CATEGORY (FT1-FT5)
  // ==========================================

  // FT1 - Personal Goals
  FT1_GOALS: {
    patterns: [
      /goal/i,
      /why.*this idea/i,
      /motivation/i,
      /align/i,
      /personal objective/i,
      /what.*want to achieve/i,
    ],
    category: "fit",
  },

  // FT2 - Passion
  FT2_PASSION: {
    patterns: [
      /passion/i,
      /interest/i,
      /excited/i,
      /care about/i,
      /love/i,
      /enthusias/i,
    ],
    category: "fit",
  },

  // FT3 - Skills
  FT3_SKILLS: {
    patterns: [
      /skill/i,
      /experience/i,
      /background/i,
      /qualified/i,
      /expertise/i,
      /capable/i,
    ],
    category: "fit",
  },

  // FT4 - Network
  FT4_NETWORK: {
    patterns: [
      /network/i,
      /connection/i,
      /know.*people/i,
      /contact/i,
      /relationship/i,
    ],
    category: "fit",
  },

  // FT5 - Life Stage
  FT5_TIMING: {
    patterns: [
      /life.*stage/i,
      /right time.*life/i,
      /capacity/i,
      /personal situation/i,
      /life circumstance/i,
      /how much time/i,
      /time.*dedicate/i,
      /hours.*week/i,
      /availability/i,
    ],
    category: "fit",
  },
  FT5_RUNWAY: {
    patterns: [
      /runway/i,
      /savings/i,
      /how long.*fund/i,
      /financial.*capacity/i,
      /burn rate/i,
    ],
    category: "fit",
  },
};

/**
 * Classify a question to its YAML question ID.
 *
 * @param question - The free-form question text
 * @returns The question ID if matched, null otherwise
 */
export function classifyQuestionToId(question: string): string | null {
  const lowerQ = question.toLowerCase();

  for (const [questionId, config] of Object.entries(QUESTION_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(lowerQ)) {
        return questionId;
      }
    }
  }

  return null; // No match found
}

/**
 * Classify a question with detailed result including confidence and category.
 *
 * @param question - The free-form question text
 * @returns Classification result with ID, confidence, and category
 */
export function classifyQuestion(question: string): ClassifiedQuestion {
  const lowerQ = question.toLowerCase();
  let bestMatch: { id: string; category: string; matchCount: number } | null =
    null;

  for (const [questionId, config] of Object.entries(QUESTION_PATTERNS)) {
    let matchCount = 0;
    for (const pattern of config.patterns) {
      if (pattern.test(lowerQ)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      if (!bestMatch || matchCount > bestMatch.matchCount) {
        bestMatch = {
          id: questionId,
          category: config.category,
          matchCount,
        };
      }
    }
  }

  if (bestMatch) {
    // Confidence based on number of pattern matches
    const confidence = Math.min(0.9, 0.5 + bestMatch.matchCount * 0.1);
    return {
      originalQuestion: question,
      questionId: bestMatch.id,
      confidence,
      category: bestMatch.category,
    };
  }

  return {
    originalQuestion: question,
    questionId: null,
    confidence: 0,
    category: null,
  };
}

/**
 * Get all available question IDs organized by category.
 */
export function getQuestionIdsByCategory(): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [questionId, config] of Object.entries(QUESTION_PATTERNS)) {
    if (!result[config.category]) {
      result[config.category] = [];
    }
    result[config.category].push(questionId);
  }

  return result;
}

/**
 * Get the category for a question ID.
 */
export function getCategoryForQuestionId(questionId: string): string | null {
  const config = QUESTION_PATTERNS[questionId];
  return config?.category ?? null;
}
