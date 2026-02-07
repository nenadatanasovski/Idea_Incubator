/**
 * Task Test Types
 *
 * Types for three-level testing: syntax, unit, and e2e.
 * Part of: Task System V2 Implementation Plan (IMPL-2.4)
 */

/**
 * Test levels
 * 1 = Syntax/compile check
 * 2 = Unit tests
 * 3 = Integration/E2E tests
 */
export type TestLevel = 1 | 2 | 3;

/**
 * Test scopes - what part of the system is being tested
 */
export type TestScope = "codebase" | "api" | "ui" | "database" | "integration";

/**
 * Test scope configuration for UI display
 */
export const TEST_SCOPE_CONFIG: Record<
  TestScope,
  { label: string; description: string; color: string; bgColor: string }
> = {
  codebase: {
    label: "Codebase",
    description: "File existence, compilation, code structure",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
  database: {
    label: "Database",
    description: "Schema validation, migrations",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  api: {
    label: "API",
    description: "Endpoint tests, contract validation",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  ui: {
    label: "UI",
    description: "Component tests, rendering",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  integration: {
    label: "Integration",
    description: "Cross-system tests, E2E flows",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
};

/**
 * Ordered list of scopes for consistent display
 */
export const TEST_SCOPE_ORDER: TestScope[] = [
  "codebase",
  "database",
  "api",
  "ui",
  "integration",
];

/**
 * Test level descriptions
 */
export const TEST_LEVEL_DESCRIPTIONS: Record<TestLevel, string> = {
  1: "Syntax/Compile Check",
  2: "Unit Tests",
  3: "Integration/E2E Tests",
};

/**
 * Test result entity
 */
export interface TaskTestResult {
  id: string;
  taskId: string;

  testLevel: TestLevel;
  testScope?: TestScope;
  testName?: string;

  command: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  durationMs: number;

  passed: boolean;

  executionId?: string;
  agentId?: string;

  createdAt: string;
}

/**
 * Test configuration for a task
 */
export interface TaskTestConfig {
  level: TestLevel;
  command: string;
  expectedExitCode: number;
  timeout: number;
  description: string;
}

/**
 * Validation result summary
 */
export interface ValidationResult {
  taskId: string;
  overallPassed: boolean;
  totalDuration: number;

  levels: {
    level: TestLevel;
    passed: boolean;
    results: TaskTestResult[];
  }[];
}

/**
 * Input for running validation
 */
export interface RunValidationInput {
  taskId: string;
  levels?: TestLevel[]; // Default: all levels
  executionId?: string;
  agentId?: string;
}

/**
 * Default test configurations by level
 */
export const DEFAULT_TEST_CONFIGS: Record<TestLevel, TaskTestConfig> = {
  1: {
    level: 1,
    command: "npx tsc --noEmit",
    expectedExitCode: 0,
    timeout: 60000,
    description: "TypeScript type checking",
  },
  2: {
    level: 2,
    command: "npm test -- --passWithNoTests",
    expectedExitCode: 0,
    timeout: 120000,
    description: "Run unit tests",
  },
  3: {
    level: 3,
    command: "npm run test:e2e -- --passWithNoTests",
    expectedExitCode: 0,
    timeout: 300000,
    description: "Run integration/E2E tests",
  },
};

/**
 * Database row representation for test results
 */
export interface TaskTestResultRow {
  id: string;
  task_id: string;
  test_level: number;
  test_scope: string | null;
  test_name: string | null;
  command: string;
  exit_code: number;
  stdout: string | null;
  stderr: string | null;
  duration_ms: number;
  passed: number;
  execution_id: string | null;
  agent_id: string | null;
  created_at: string;
}

/**
 * Map database row to TaskTestResult object
 */
export function mapTaskTestResultRow(row: TaskTestResultRow): TaskTestResult {
  return {
    id: row.id,
    taskId: row.task_id,
    testLevel: row.test_level as TestLevel,
    testScope: (row.test_scope as TestScope) || undefined,
    testName: row.test_name || undefined,
    command: row.command,
    exitCode: row.exit_code,
    stdout: row.stdout || undefined,
    stderr: row.stderr || undefined,
    durationMs: row.duration_ms,
    passed: row.passed === 1,
    executionId: row.execution_id || undefined,
    agentId: row.agent_id || undefined,
    createdAt: row.created_at,
  };
}

/**
 * Acceptance criterion
 */
export interface AcceptanceCriterion {
  id: string;
  text: string;
  met: boolean;
  scope?: TestScope;
  verifiedAt?: string;
  verifiedBy?: string;
}

/**
 * Acceptance criteria check result
 */
export interface AcceptanceCriteriaResult {
  taskId: string;
  passed: boolean;
  allPassing: boolean;
  missingLevels: TestLevel[];
  criteria: AcceptanceCriterion[];
  checkedAt: string;
}

/**
 * Actor types for AC verification
 */
export type VerifiedByType = "user" | "agent" | "system";

/**
 * Persisted acceptance criterion result
 */
export interface AcceptanceCriterionResult {
  id: string;
  taskId: string;
  appendixId: string;
  criterionIndex: number;
  criterionText: string;
  met: boolean;
  scope?: TestScope;
  verifiedAt?: string;
  verifiedBy?: VerifiedByType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for recording a validation result
 */
export interface RecordResultInput {
  taskId: string;
  overallPassed: boolean;
  totalDuration: number;
  levels: {
    level: TestLevel;
    passed: boolean;
    duration: number;
    errorMessage?: string;
  }[];
}

/**
 * Recorded result (persisted validation result with ID)
 */
export interface RecordedResult {
  id: string;
  taskId: string;
  overallPassed: boolean;
  totalDuration: number;
  levels: {
    level: TestLevel;
    passed: boolean;
    duration: number;
    errorMessage?: string;
  }[];
  createdAt: string;
}

/**
 * Input for updating acceptance criterion status
 */
export interface UpdateAcceptanceCriterionInput {
  met: boolean;
  verifiedBy?: VerifiedByType;
  notes?: string;
}

/**
 * Input for bulk updating multiple criteria
 */
export interface BulkUpdateAcceptanceCriteriaInput {
  taskId: string;
  updates: {
    appendixId: string;
    criterionIndex: number;
    met: boolean;
    notes?: string;
  }[];
  verifiedBy?: VerifiedByType;
}

/**
 * Database row representation for acceptance criteria results
 */
export interface AcceptanceCriterionResultRow {
  id: string;
  task_id: string;
  appendix_id: string;
  criterion_index: number;
  criterion_text: string;
  met: number;
  scope: string | null;
  verified_at: string | null;
  verified_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to AcceptanceCriterionResult object
 */
export function mapAcceptanceCriterionResultRow(
  row: AcceptanceCriterionResultRow,
): AcceptanceCriterionResult {
  return {
    id: row.id,
    taskId: row.task_id,
    appendixId: row.appendix_id,
    criterionIndex: row.criterion_index,
    criterionText: row.criterion_text,
    met: row.met === 1,
    scope: (row.scope as TestScope) || undefined,
    verifiedAt: row.verified_at || undefined,
    verifiedBy: (row.verified_by as VerifiedByType) || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
