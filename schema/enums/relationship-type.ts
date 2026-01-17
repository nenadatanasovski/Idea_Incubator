/**
 * Task Relationship Type Enum
 */

export const relationshipTypes = [
  "depends_on",
  "blocks",
  "related_to",
  "duplicate_of",
  "parent_of",
  "child_of",
  "supersedes",
  "implements",
  "conflicts_with",
  "enables",
  "inspired_by",
  "tests",
] as const;

export type RelationshipType = (typeof relationshipTypes)[number];
