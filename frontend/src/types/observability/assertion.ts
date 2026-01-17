/**
 * OBS-204: Assertion Types
 *
 * Types for tracking test assertions and validation results.
 */

import type { AssertionRef } from "./transcript";

// =============================================================================
// ASSERTION ENUMS
// =============================================================================

/**
 * Categories of assertions (14 total).
 */
export enum AssertionCategory {
  file_created = "file_created",
  file_modified = "file_modified",
  file_deleted = "file_deleted",
  tsc_compiles = "tsc_compiles",
  typescript_compiles = "typescript_compiles",
  test_passes = "test_passes",
  tests_pass = "tests_pass",
  lint_passes = "lint_passes",
  build_succeeds = "build_succeeds",
  api_responds = "api_responds",
  schema_valid = "schema_valid",
  dependency_met = "dependency_met",
  runtime_check = "runtime_check",
  custom = "custom",
}

/**
 * Assertion result status.
 */
export type AssertionResultType = "pass" | "fail" | "skip" | "warn";

// =============================================================================
// ASSERTION EVIDENCE
// =============================================================================

/**
 * Evidence supporting an assertion result.
 */
export interface AssertionEvidence {
  // === COMMAND EVIDENCE ===
  command?: string; // Command executed
  exitCode?: number; // Exit code
  stdout?: string; // Stdout (truncated)
  stderr?: string; // Stderr (truncated)

  // === FILE EVIDENCE ===
  filePath?: string; // File in question
  fileExists?: boolean; // Does file exist
  fileSizeBefore?: number; // Size before (for UPDATE)
  fileSizeAfter?: number; // Size after
  diffPath?: string; // Path to diff file

  // === EXPECTATION EVIDENCE ===
  expected?: string; // Expected value
  actual?: string; // Actual value
  diff?: string; // Diff between expected and actual

  // === API EVIDENCE ===
  endpoint?: string; // API endpoint tested
  statusCode?: number; // HTTP status
  responseTime?: number; // Response time in ms
  responseBodySample?: string; // Sample of response

  // === TIMING EVIDENCE ===
  durationMs?: number; // Duration in milliseconds

  // === FILE DIFF EVIDENCE ===
  fileDiff?: string; // File diff content (inline)

  // === RELATIONSHIP EVIDENCE ===
  relatedEntities?: Array<{
    type: string;
    id: string;
    summary?: string;
  }>; // Related entities for cross-referencing

  // === CUSTOM EVIDENCE ===
  custom?: Record<string, unknown>; // Category-specific evidence
}

// =============================================================================
// ASSERTION RESULT
// =============================================================================

/**
 * Result of a single assertion.
 * Matches the database schema for obs_assertion_results.
 */
export interface AssertionResult {
  // === IDENTITY ===
  id: string; // Assertion ID
  taskId: string; // Task being validated
  executionId: string; // Execution context
  chainId: string | null; // Assertion chain ID
  chainPosition: number | null; // Position in chain

  // === ASSERTION ===
  category: AssertionCategory;
  description: string; // What we're asserting

  // === RESULT ===
  result: AssertionResultType;

  // === EVIDENCE ===
  evidence: AssertionEvidence;

  // === METADATA ===
  timestamp: string;
  durationMs: number | null;
  transcriptEntryId: string | null;
  createdAt: string;
}

/**
 * Input for creating an assertion result.
 */
export interface AssertionResultInput {
  taskId: string;
  category: AssertionCategory;
  description: string;
  result: AssertionResultType;
  evidence: AssertionEvidence;
  chainId?: string;
  durationMs?: number;
}

// =============================================================================
// ASSERTION CHAIN
// =============================================================================

/**
 * Ordered chain of assertions for a task.
 * Matches the database schema for obs_assertion_chains.
 */
export interface AssertionChain {
  id: string;
  taskId: string;
  executionId: string;
  description: string; // What this chain validates

  // === CHAIN RESULT ===
  overallResult: "pass" | "fail" | "partial";
  passCount: number;
  failCount: number;
  skipCount: number;

  // === FAILURE ANALYSIS ===
  firstFailureId: string | null;

  // === TIMING ===
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/**
 * Chain with inline assertions.
 */
export interface AssertionChainWithResults extends AssertionChain {
  assertions: AssertionResult[];
  firstFailure?: {
    assertionId: string;
    description: string;
    evidence: AssertionEvidence;
  };
}

// =============================================================================
// AGGREGATION TYPES
// =============================================================================

/**
 * Summary of all assertions in an execution.
 */
export interface AssertionSummary {
  executionId: string;

  summary: {
    totalAssertions: number;
    passed: number;
    failed: number;
    skipped: number;
    warnings: number;
    passRate: number;
  };

  byCategory: Partial<
    Record<
      AssertionCategory,
      {
        total: number;
        passed: number;
        failed?: number;
        skipped?: number;
      }
    >
  >;

  chains: {
    total: number;
    passed: number;
    failed: number;
    partial: number;
  };

  failures: Array<{
    assertionId: string;
    taskId: string;
    category: AssertionCategory;
    description: string;
    evidence: AssertionEvidence;
    transcriptRef: string | null;
    timestamp: string;
  }>;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type { AssertionRef };
