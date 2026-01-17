/**
 * Idea Type Enum
 */

export const ideaTypes = [
  "business",
  "creative",
  "technical",
  "personal",
  "research",
] as const;

export type IdeaType = (typeof ideaTypes)[number];
