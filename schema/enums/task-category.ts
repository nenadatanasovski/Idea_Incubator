/**
 * Task Category Enum
 *
 * Category values for classifying tasks.
 */

export const taskCategories = [
  "feature",
  "bug",
  "task",
  "story",
  "epic",
  "spike",
  "improvement",
  "documentation",
  "test",
  "devops",
  "design",
  "research",
  "infrastructure",
  "security",
  "performance",
  "other",
] as const;

export type TaskCategory = (typeof taskCategories)[number];

/**
 * Category to 3-letter code mapping for display IDs
 */
export const CATEGORY_CODES: Record<TaskCategory, string> = {
  feature: "FEA",
  bug: "BUG",
  task: "TSK",
  story: "STY",
  epic: "EPC",
  spike: "SPK",
  improvement: "IMP",
  documentation: "DOC",
  test: "TST",
  devops: "OPS",
  design: "DSN",
  research: "RSH",
  infrastructure: "INF",
  security: "SEC",
  performance: "PRF",
  other: "OTH",
};
