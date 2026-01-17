/**
 * Lifecycle Stage Enum
 *
 * Ideas progress through these stages.
 */

export const lifecycleStages = [
  "SPARK",
  "CLARIFY",
  "RESEARCH",
  "IDEATE",
  "EVALUATE",
  "VALIDATE",
  "DESIGN",
  "PROTOTYPE",
  "TEST",
  "REFINE",
  "BUILD",
  "LAUNCH",
  "GROW",
  "MAINTAIN",
  "PIVOT",
  "PAUSE",
  "SUNSET",
  "ARCHIVE",
  "ABANDONED",
] as const;

export type LifecycleStage = (typeof lifecycleStages)[number];
