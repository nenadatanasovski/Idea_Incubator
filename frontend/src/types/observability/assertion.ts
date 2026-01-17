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
 * Categories of assertions (9 categories).
 */
export type AssertionCategory =
  | "file_created" // File exists after CREATE
  | "file_modified" // File changed after UPDATE
  | "file_deleted" // File removed after DELETE
  | "typescript_compiles" // tsc --noEmit passes (also tsc_compiles)
  | "lint_passes" // Linting passes
  | "tests_pass" // Unit tests pass (also test_passes)
  | "api_responds" // API endpoint responds correctly
  | "schema_valid" // Database schema valid
  | "dependency_met" // Dependency requirements satisfied
  | "build_succeeds" // Build succeeds
  | "custom"; // Custom assertion

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
// QUERY/FILTER TYPES
// =============================================================================

/**
 * Query parameters for assertions endpoint.
 */
export interface AssertionQuery {
  executionId?: string;
  taskId?: string;
  categories?: AssertionCategory[];
  result?: AssertionResultType[];
  chainId?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
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
