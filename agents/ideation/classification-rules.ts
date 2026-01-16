/**
 * Classification Rules
 *
 * Defines document classification rules for phase-based document management.
 * Determines which documents are required, recommended, or optional at each lifecycle stage.
 */

import type { LifecycleStage } from "../../utils/schemas.js";

// ============================================================================
// CLASSIFICATION TYPES
// ============================================================================

/**
 * Document classification levels.
 */
export type Classification = "required" | "recommended" | "optional";

/**
 * Condition for classification rules.
 */
export interface Condition {
  /** Type of condition to check */
  type:
    | "content_contains"
    | "document_exists"
    | "phase_past"
    | "keyword_present";
  /** Value to check against */
  value: string;
  /** Whether to negate the condition */
  negate?: boolean;
}

/**
 * A single classification rule for a document.
 */
export interface ClassificationRule {
  /** Document path (relative to idea folder) */
  document: string;
  /** Classification level */
  classification: Classification;
  /** Optional conditions that must be met for this classification */
  conditions?: Condition[];
}

/**
 * Phase requirements defining required and recommended documents.
 */
export interface PhaseRequirements {
  /** Documents that must be completed before transitioning */
  required: string[];
  /** Documents that are recommended but not required */
  recommended: string[];
}

// ============================================================================
// PHASE REQUIREMENTS
// ============================================================================

/**
 * Phase requirements for all 18 lifecycle stages (plus ABANDONED).
 * Defines which documents are required vs recommended at each stage.
 */
export const PHASE_REQUIREMENTS: Record<LifecycleStage, PhaseRequirements> = {
  // Early stages - minimal requirements
  SPARK: {
    required: ["README.md"],
    recommended: [],
  },
  CLARIFY: {
    required: ["README.md", "development.md"],
    recommended: ["target-users.md"],
  },
  RESEARCH: {
    required: ["README.md", "development.md", "research/market.md"],
    recommended: ["research/competitive.md", "target-users.md"],
  },
  IDEATE: {
    required: ["README.md", "development.md"],
    recommended: ["problem-solution.md", "research/market.md"],
  },
  EVALUATE: {
    required: ["README.md", "development.md", "research/market.md"],
    recommended: [
      "analysis/redteam.md",
      "research/competitive.md",
      "target-users.md",
    ],
  },
  VALIDATE: {
    required: ["README.md", "development.md", "validation/assumptions.md"],
    recommended: ["validation/results.md", "research/user-personas.md"],
  },
  // Design stages - more structure needed
  DESIGN: {
    required: ["README.md", "development.md", "planning/brief.md"],
    recommended: ["planning/architecture.md", "planning/mvp-scope.md"],
  },
  PROTOTYPE: {
    required: ["README.md", "development.md", "planning/mvp-scope.md"],
    recommended: ["build/spec.md", "planning/architecture.md"],
  },
  TEST: {
    required: ["README.md", "development.md", "validation/results.md"],
    recommended: ["build/tasks.md", "planning/mvp-scope.md"],
  },
  REFINE: {
    required: ["README.md", "development.md", "validation/results.md"],
    recommended: ["analysis/feedback.md", "planning/iterations.md"],
  },
  // Build stages - execution focus
  BUILD: {
    required: ["README.md", "development.md", "build/spec.md"],
    recommended: ["build/tasks.md", "build/changelog.md"],
  },
  LAUNCH: {
    required: ["README.md", "development.md", "planning/launch-checklist.md"],
    recommended: ["marketing/positioning.md", "marketing/launch-plan.md"],
  },
  // Growth stages - scaling focus
  GROW: {
    required: ["README.md", "development.md"],
    recommended: ["marketing/growth-strategy.md", "analysis/metrics.md"],
  },
  MAINTAIN: {
    required: ["README.md", "development.md"],
    recommended: ["build/changelog.md", "analysis/metrics.md"],
  },
  // Transition stages
  PIVOT: {
    required: ["README.md", "development.md", "analysis/pivot-rationale.md"],
    recommended: ["research/market.md", "validation/assumptions.md"],
  },
  PAUSE: {
    required: ["README.md"],
    recommended: ["analysis/pause-rationale.md"],
  },
  SUNSET: {
    required: ["README.md", "analysis/sunset-plan.md"],
    recommended: ["analysis/lessons-learned.md"],
  },
  ARCHIVE: {
    required: ["README.md"],
    recommended: ["analysis/lessons-learned.md"],
  },
  ABANDONED: {
    required: ["README.md"],
    recommended: ["analysis/abandonment-reason.md"],
  },
};

// ============================================================================
// CONTENT INFERENCE RULES
// ============================================================================

/**
 * Trigger definition for content-based classification.
 */
export interface ContentTrigger {
  /** Keywords that trigger this rule */
  keywords: string[];
  /** Whether all keywords must be present (default: any) */
  matchAll?: boolean;
}

/**
 * Effect of a content inference rule.
 */
export interface ContentEffect {
  /** Document affected by this rule */
  document: string;
  /** New classification level */
  classification?: Classification;
  /** Additional requirement note */
  requirement?: string;
}

/**
 * Content-based classification rule.
 */
export interface ContentRule {
  /** Trigger conditions */
  trigger: ContentTrigger;
  /** Effect when triggered */
  effect: ContentEffect;
}

/**
 * Content inference rules that upgrade document classifications
 * based on conversation context and keywords.
 */
export const CONTENT_INFERENCE_RULES: ContentRule[] = [
  // Competition-related triggers
  {
    trigger: { keywords: ["competitor", "competition", "alternative"] },
    effect: {
      document: "research/competitive.md",
      classification: "recommended",
    },
  },
  {
    trigger: { keywords: ["competitive advantage", "differentiation", "moat"] },
    effect: { document: "research/competitive.md", classification: "required" },
  },

  // B2B/B2C signals
  {
    trigger: { keywords: ["B2B", "enterprise", "business customer"] },
    effect: {
      document: "target-users.md",
      requirement: "needs company segments section",
    },
  },
  {
    trigger: { keywords: ["B2C", "consumer", "individual user"] },
    effect: {
      document: "target-users.md",
      requirement: "needs demographic profiles",
    },
  },

  // Funding and investor signals
  {
    trigger: { keywords: ["funding", "investor", "raise", "investment"] },
    effect: {
      document: "planning/investor-pitch.md",
      classification: "recommended",
    },
  },
  {
    trigger: { keywords: ["pitch deck", "Series A", "seed round", "VC"] },
    effect: {
      document: "planning/investor-pitch.md",
      classification: "required",
    },
  },

  // Technical complexity signals
  {
    trigger: { keywords: ["API", "integration", "technical", "architecture"] },
    effect: {
      document: "planning/architecture.md",
      classification: "recommended",
    },
  },
  {
    trigger: {
      keywords: [
        "scalability",
        "infrastructure",
        "distributed",
        "microservices",
      ],
    },
    effect: {
      document: "planning/architecture.md",
      classification: "required",
    },
  },

  // Legal and regulatory signals
  {
    trigger: { keywords: ["legal", "compliance", "regulation", "GDPR"] },
    effect: {
      document: "research/legal-compliance.md",
      classification: "recommended",
    },
  },
  {
    trigger: { keywords: ["healthcare", "HIPAA", "financial", "FDA"] },
    effect: {
      document: "research/legal-compliance.md",
      classification: "required",
    },
  },

  // Marketing signals
  {
    trigger: { keywords: ["marketing", "brand", "positioning", "messaging"] },
    effect: {
      document: "marketing/positioning.md",
      classification: "recommended",
    },
  },
  {
    trigger: { keywords: ["go-to-market", "GTM", "launch strategy"] },
    effect: {
      document: "marketing/launch-plan.md",
      classification: "recommended",
    },
  },

  // User research signals
  {
    trigger: {
      keywords: ["user research", "interviews", "personas", "user testing"],
    },
    effect: {
      document: "research/user-personas.md",
      classification: "recommended",
    },
  },
  {
    trigger: { keywords: ["customer discovery", "validation interviews"] },
    effect: {
      document: "validation/assumptions.md",
      classification: "recommended",
    },
  },

  // Risk signals
  {
    trigger: { keywords: ["risk", "threat", "vulnerability", "failure mode"] },
    effect: {
      document: "analysis/risk-mitigation.md",
      classification: "recommended",
    },
  },
  {
    trigger: { keywords: ["critical risk", "existential threat", "blocker"] },
    effect: {
      document: "analysis/risk-mitigation.md",
      classification: "required",
    },
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the requirements for a specific lifecycle stage.
 */
export function getPhaseRequirements(stage: LifecycleStage): PhaseRequirements {
  return PHASE_REQUIREMENTS[stage];
}

/**
 * Get all lifecycle stages that have a specific document as required.
 */
export function getStagesRequiringDocument(document: string): LifecycleStage[] {
  return (Object.keys(PHASE_REQUIREMENTS) as LifecycleStage[]).filter((stage) =>
    PHASE_REQUIREMENTS[stage].required.includes(document),
  );
}

/**
 * Check if there are any duplicate documents between required and recommended
 * for a given stage. Returns empty array if no duplicates.
 */
export function findDuplicatesInStage(stage: LifecycleStage): string[] {
  const requirements = PHASE_REQUIREMENTS[stage];
  return requirements.required.filter((doc) =>
    requirements.recommended.includes(doc),
  );
}

/**
 * Validate that all stages have no duplicates between required and recommended.
 * Returns a map of stages to their duplicates (only stages with issues).
 */
export function validatePhaseRequirements(): Record<LifecycleStage, string[]> {
  const issues: Partial<Record<LifecycleStage, string[]>> = {};

  for (const stage of Object.keys(PHASE_REQUIREMENTS) as LifecycleStage[]) {
    const duplicates = findDuplicatesInStage(stage);
    if (duplicates.length > 0) {
      issues[stage] = duplicates;
    }
  }

  return issues as Record<LifecycleStage, string[]>;
}

/**
 * Get all unique lifecycle stages.
 */
export function getAllLifecycleStages(): LifecycleStage[] {
  return Object.keys(PHASE_REQUIREMENTS) as LifecycleStage[];
}
