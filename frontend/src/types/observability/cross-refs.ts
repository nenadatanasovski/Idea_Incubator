/**
 * OBS-208: Cross-Reference Types
 *
 * Types for entity linking and navigation between observability entities.
 */

import type { TranscriptEntry } from "./transcript";
import type { ToolUse } from "./tool-use";
import type { AssertionResult } from "./assertion";
import type { SkillTrace } from "./skill";

// =============================================================================
// DEEP LINK PATTERNS
// =============================================================================

/**
 * Deep link URL patterns.
 */
export const DEEP_LINK_PATTERNS = {
  // Execution-level views
  execution: "/observability/executions/{executionId}",
  executionTimeline: "/observability/executions/{executionId}/timeline",
  executionToolUses: "/observability/executions/{executionId}/tool-uses",
  executionAssertions: "/observability/executions/{executionId}/assertions",
  executionSkills: "/observability/executions/{executionId}/skills",
  executionMessageBus: "/observability/executions/{executionId}/message-bus",

  // Entity-level views
  transcriptEntry:
    "/observability/executions/{executionId}/transcript/{entryId}",
  toolUse: "/observability/executions/{executionId}/tool-uses/{toolUseId}",
  assertion: "/observability/executions/{executionId}/assertions/{assertionId}",
  skillTrace: "/observability/executions/{executionId}/skills/{skillTraceId}",

  // Cross-reference views
  toolUseInContext:
    "/observability/executions/{executionId}/tool-uses/{toolUseId}?context=transcript",
  assertionWithEvidence:
    "/observability/executions/{executionId}/assertions/{assertionId}?expand=evidence",

  // Message bus
  messageBusEvent: "/observability/message-bus/{eventId}",
  messageBusCorrelated:
    "/observability/message-bus?correlationId={correlationId}",

  // Task-scoped views
  taskTranscript:
    "/observability/executions/{executionId}/tasks/{taskId}/transcript",
  taskToolUses:
    "/observability/executions/{executionId}/tasks/{taskId}/tool-uses",
  taskAssertions:
    "/observability/executions/{executionId}/tasks/{taskId}/assertions",
} as const;

/**
 * Type for deep link pattern keys.
 */
export type DeepLinkPattern = keyof typeof DEEP_LINK_PATTERNS;

/**
 * Build a deep link URL from a pattern and parameters.
 */
export function buildDeepLink(
  pattern: DeepLinkPattern,
  params: Record<string, string>,
): string {
  let url: string = DEEP_LINK_PATTERNS[pattern];
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`{${key}}`, encodeURIComponent(value));
  }
  return url;
}

// =============================================================================
// ENTITY TYPES
// =============================================================================

/**
 * Entity type for cross-referencing.
 */
export type CrossRefEntityType =
  | "transcriptEntry"
  | "toolUse"
  | "assertion"
  | "skillTrace"
  | "execution"
  | "task"
  | "assertionChain"
  | "messageBus";

// =============================================================================
// CROSS-REFERENCE TYPES
// =============================================================================

/**
 * Cross-references for a tool use.
 */
export interface ToolUseCrossRefs {
  transcriptEntry: string; // Transcript entry that logged this
  task?: string; // Task it belongs to
  skill?: string; // Skill that invoked it (if any)
  parentToolUse?: string; // Parent tool use (if nested)
  childToolUses: string[]; // Child tool uses (if parent)
  relatedAssertions: string[]; // Assertions using this as evidence
}

/**
 * Cross-references for an assertion.
 */
export interface AssertionCrossRefs {
  task: string; // Task being validated
  chain?: string; // Assertion chain it belongs to
  transcriptEntries: string[]; // Related transcript entries
  toolUses: string[]; // Tool uses that provide evidence
  previousInChain?: string; // Previous assertion in chain
  nextInChain?: string; // Next assertion in chain
}

/**
 * Cross-references for a skill trace.
 */
export interface SkillTraceCrossRefs {
  task: string; // Task that invoked skill
  transcriptEntries: string[]; // All entries during skill
  toolUses: string[]; // All tool uses during skill
  assertions: string[]; // Assertions made by skill
  parentSkill?: string; // Parent skill (if nested)
  childSkills: string[]; // Child skills (if parent)
}

/**
 * Cross-references for a transcript entry.
 */
export interface TranscriptEntryCrossRefs {
  execution: string; // Execution it belongs to
  task?: string; // Task (if applicable)
  toolUse?: string; // Tool use (if tool_use entry)
  skill?: string; // Skill (if skill_invoke entry)
  assertion?: string; // Assertion (if assertion entry)
  previousEntry?: string; // Previous in sequence
  nextEntry?: string; // Next in sequence
}

// =============================================================================
// ENTITY CROSS-REFS UNION
// =============================================================================

/**
 * Union of all cross-reference types (discriminated).
 */
export type EntityCrossRefs =
  | { type: "toolUse"; refs: ToolUseCrossRefs }
  | { type: "assertion"; refs: AssertionCrossRefs }
  | { type: "skillTrace"; refs: SkillTraceCrossRefs }
  | { type: "transcriptEntry"; refs: TranscriptEntryCrossRefs };

// =============================================================================
// RELATED ENTITIES
// =============================================================================

/**
 * Related entities result for full entity loading.
 */
export interface RelatedEntitiesResult {
  transcriptEntries: TranscriptEntry[];
  toolUses: ToolUse[];
  assertions: AssertionResult[];
  skillTraces: SkillTrace[];
}

/**
 * Request for related entities.
 */
export interface RelatedEntitiesRequest {
  entityType: CrossRefEntityType;
  entityId: string;
  executionId: string;
  includeTranscript?: boolean;
  includeToolUses?: boolean;
  includeAssertions?: boolean;
  includeSkills?: boolean;
  depth?: number; // How many levels of relations to follow
}

// =============================================================================
// NAVIGATION CONTEXT
// =============================================================================

/**
 * Navigation context for UI breadcrumbs.
 */
export interface NavigationContext {
  execution: {
    id: string;
    runNumber: number;
    taskListId: string;
  };
  task?: {
    id: string;
    displayId: string;
    title: string;
  };
  currentEntity: {
    type: CrossRefEntityType;
    id: string;
    summary: string;
  };
  breadcrumbs: Array<{
    type: CrossRefEntityType;
    id: string;
    label: string;
    href: string;
  }>;
}

// =============================================================================
// HELPER TYPES
// =============================================================================

/**
 * Generic cross-reference with metadata.
 */
export interface CrossReference {
  entityType: CrossRefEntityType;
  entityId: string;
  relatedTo: Array<{
    type: CrossRefEntityType;
    id: string;
    summary?: string;
  }>;
}

/**
 * Entity summary for quick display.
 */
export interface EntitySummary {
  type: CrossRefEntityType;
  id: string;
  summary: string;
  timestamp: string;
  status?: string;
}
