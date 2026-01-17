/**
 * OBS-203: Skill Trace Types
 *
 * Types for tracking skill invocations and their nested operations.
 */

import type { TranscriptEntry, SkillRef } from "./transcript";
import type { ToolCallRef } from "./tool-use";
import type { AssertionRef } from "./assertion";

// =============================================================================
// SKILL STATUS
// =============================================================================

/**
 * Status of a skill invocation.
 */
export type SkillStatus = "success" | "partial" | "failed";

// =============================================================================
// SKILL REFERENCE (Extended)
// =============================================================================

/**
 * Full skill reference with source location.
 */
export interface SkillReference {
  // === IDENTITY ===
  skillName: string; // Skill identifier
  skillFile: string; // Path to skill definition file

  // === SOURCE LOCATION ===
  lineNumber: number | null; // Line in skill file
  sectionTitle: string | null; // Section heading in skill file

  // === INVOCATION ===
  inputSummary: string | null; // Summarized inputs (max 500 chars)
  outputSummary: string | null; // Summarized outputs (max 500 chars)

  // === METRICS ===
  startTime: string; // ISO8601
  endTime: string | null; // ISO8601
  tokenEstimate: number | null; // Estimated tokens used

  // === OUTCOME ===
  status: SkillStatus;
  errorMessage: string | null;
}

// =============================================================================
// SKILL TRACE
// =============================================================================

/**
 * Full trace of a skill invocation.
 * Matches the database schema for obs_skill_traces.
 */
export interface SkillTrace {
  // === IDENTITY ===
  id: string; // Trace ID
  executionId: string; // Parent execution
  taskId: string; // Task that invoked skill

  // === SKILL IDENTITY ===
  skillName: string;
  skillFile: string;
  lineNumber: number | null;
  sectionTitle: string | null;

  // === INVOCATION ===
  inputSummary: string | null;
  outputSummary: string | null;

  // === TIMING ===
  startTime: string;
  endTime: string | null;
  durationMs: number | null;

  // === METRICS ===
  tokenEstimate: number | null;

  // === OUTCOME ===
  status: SkillStatus;
  errorMessage: string | null;

  // === NESTED OPERATIONS (IDs only in DB) ===
  toolCalls: string[] | null; // Tool use IDs
  subSkills: string[] | null; // Nested skill trace IDs

  // === METADATA ===
  createdAt: string;
}

/**
 * Skill trace with expanded nested operations.
 */
export interface SkillTraceExpanded extends Omit<
  SkillTrace,
  "toolCalls" | "subSkills"
> {
  toolCalls: ToolCallRef[];
  subSkills: SkillTraceExpanded[];
  entries: TranscriptEntry[];
  assertions: AssertionRef[];
}

/**
 * Input for creating a skill trace.
 */
export interface SkillTraceInput {
  taskId: string;
  skillName: string;
  skillFile: string;
  lineNumber?: number;
  sectionTitle?: string;
  inputSummary?: string;
}

// =============================================================================
// SKILL FILE REFERENCE
// =============================================================================

/**
 * Reference to a skill file with usage stats.
 */
export interface SkillFileReference {
  file: string;
  linesReferenced: number[];
  sectionsUsed: string[];
  invocationCount: number;
  totalDurationMs: number;
}

// =============================================================================
// AGGREGATION TYPES
// =============================================================================

/**
 * Summary of all skill usage in an execution.
 */
export interface SkillsUsageSummary {
  executionId: string;
  totalSkillInvocations: number;
  uniqueSkillsUsed: number;

  skills: Array<{
    skillName: string;
    skillFile: string;
    invocationCount: number;
    totalDurationMs: number;
    successRate: number;
    sections: Array<{
      section: string;
      count: number;
    }>;
  }>;

  skillFileReferences: SkillFileReference[];

  byStatus: {
    success: number;
    partial: number;
    failed: number;
  };

  timeline: {
    firstSkill: string;
    lastSkill: string;
  };
}

// =============================================================================
// QUERY TYPES
// =============================================================================

/**
 * Query parameters for skill traces endpoint.
 */
export interface SkillTraceQuery {
  executionId?: string;
  taskId?: string;
  skillName?: string;
  skillFile?: string;
  status?: SkillStatus[];
  fromTime?: string;
  toTime?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type { SkillRef };
