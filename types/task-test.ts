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
 * Test level descriptions
 */
export const TEST_LEVEL_DESCRIPTIONS: Record<TestLevel, string> = {
  1: 'Syntax/Compile Check',
  2: 'Unit Tests',
  3: 'Integration/E2E Tests',
};

/**
 * Test result entity
 */
export interface TaskTestResult {
  id: string;
  taskId: string;

  testLevel: TestLevel;
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
  levels?: TestLevel[];  // Default: all levels
  executionId?: string;
  agentId?: string;
}

/**
 * Default test configurations by level
 */
export const DEFAULT_TEST_CONFIGS: Record<TestLevel, TaskTestConfig> = {
  1: {
    level: 1,
    command: 'npx tsc --noEmit',
    expectedExitCode: 0,
    timeout: 60000,
    description: 'TypeScript type checking',
  },
  2: {
    level: 2,
    command: 'npm test -- --passWithNoTests',
    expectedExitCode: 0,
    timeout: 120000,
    description: 'Run unit tests',
  },
  3: {
    level: 3,
    command: 'npm run test:e2e -- --passWithNoTests',
    expectedExitCode: 0,
    timeout: 300000,
    description: 'Run integration/E2E tests',
  },
};

/**
 * Database row representation for test results
 */
export interface TaskTestResultRow {
  id: string;
  task_id: string;
  test_level: number;
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
  verifiedAt?: string;
  verifiedBy?: string;
}

/**
 * Acceptance criteria check result
 */
export interface AcceptanceCriteriaResult {
  taskId: string;
  passed: boolean;
  criteria: AcceptanceCriterion[];
  checkedAt: string;
}
