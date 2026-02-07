/**
 * Task Test Service
 *
 * Manages three-level testing: syntax, unit, and e2e.
 * Part of: Task System V2 Implementation Plan (IMPL-3.10)
 */

import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";
import { query, run, saveDb } from "../../../database/db.js";
import {
  TaskTestResult,
  TaskTestConfig,
  ValidationResult,
  RunValidationInput,
  TestLevel,
  TestScope,
  DEFAULT_TEST_CONFIGS,
  TaskTestResultRow,
  mapTaskTestResultRow,
  AcceptanceCriteriaResult,
  AcceptanceCriterion,
  AcceptanceCriterionResult,
  AcceptanceCriterionResultRow,
  mapAcceptanceCriterionResultRow,
  VerifiedByType,
  RecordResultInput,
  RecordedResult,
} from "../../../types/task-test.js";
import type { AppendixMetadata } from "../../../types/task-appendix.js";

/**
 * Task Test Service class
 */
export class TaskTestService {
  private testConfigs: Map<string, TaskTestConfig[]> = new Map();

  /**
   * Set test configuration for a task
   */
  async setTestConfig(
    taskId: string,
    configs: TaskTestConfig[],
  ): Promise<void> {
    this.testConfigs.set(taskId, configs);
  }

  /**
   * Get test configuration for a task
   */
  async getTestConfig(taskId: string): Promise<TaskTestConfig[]> {
    // Return custom config if set, otherwise defaults
    const custom = this.testConfigs.get(taskId);
    if (custom) {
      return custom;
    }

    // Return default configs for all levels
    return [
      DEFAULT_TEST_CONFIGS[1],
      DEFAULT_TEST_CONFIGS[2],
      DEFAULT_TEST_CONFIGS[3],
    ];
  }

  /**
   * Record a validation result directly (without running commands)
   */
  async recordResult(input: RecordResultInput): Promise<RecordedResult> {
    const id = uuidv4();
    const now = new Date().toISOString();

    // Save each level result to the database
    for (const levelResult of input.levels) {
      await this.saveResult({
        taskId: input.taskId,
        testLevel: levelResult.level,
        testName: `Level ${levelResult.level} test`,
        command: "",
        exitCode: levelResult.passed ? 0 : 1,
        stdout: undefined,
        stderr: levelResult.errorMessage,
        durationMs: levelResult.duration,
        passed: levelResult.passed,
      });
    }

    return {
      id,
      taskId: input.taskId,
      overallPassed: input.overallPassed,
      totalDuration: input.totalDuration,
      levels: input.levels,
      createdAt: now,
    };
  }

  /**
   * Run validation for a task
   */
  async runValidation(input: RunValidationInput): Promise<ValidationResult> {
    const levels = input.levels || [1, 2, 3];
    const results: ValidationResult["levels"] = [];
    let totalDuration = 0;
    let overallPassed = true;

    for (const level of levels) {
      const levelResults: TaskTestResult[] = [];
      const result = await this.runLevel(input.taskId, level, {
        executionId: input.executionId,
        agentId: input.agentId,
      });

      levelResults.push(result);
      totalDuration += result.durationMs;

      const levelPassed = result.passed;
      if (!levelPassed) {
        overallPassed = false;
      }

      results.push({
        level,
        passed: levelPassed,
        results: levelResults,
      });

      // Stop on first failure if this is level 1 (syntax check must pass)
      if (level === 1 && !levelPassed) {
        break;
      }
    }

    return {
      taskId: input.taskId,
      overallPassed,
      totalDuration,
      levels: results,
    };
  }

  /**
   * Run a specific test level
   */
  async runLevel(
    taskId: string,
    level: TestLevel,
    context?: { executionId?: string; agentId?: string; scope?: TestScope },
  ): Promise<TaskTestResult> {
    const configs = await this.getTestConfig(taskId);
    const config =
      configs.find((c) => c.level === level) || DEFAULT_TEST_CONFIGS[level];

    const startTime = Date.now();
    let exitCode: number;
    let stdout = "";
    let stderr = "";

    try {
      const result = await this.executeCommand(config.command, config.timeout);
      exitCode = result.exitCode;
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      exitCode = -1;
      stderr = error instanceof Error ? error.message : "Unknown error";
    }

    const durationMs = Date.now() - startTime;
    const passed = exitCode === config.expectedExitCode;

    // Save result to database
    const testResult = await this.saveResult({
      taskId,
      testLevel: level,
      testScope: context?.scope,
      testName: config.description,
      command: config.command,
      exitCode,
      stdout,
      stderr,
      durationMs,
      passed,
      executionId: context?.executionId,
      agentId: context?.agentId,
    });

    return testResult;
  }

  /**
   * Get all results for a task
   */
  async getResults(taskId: string): Promise<TaskTestResult[]> {
    const rows = await query<TaskTestResultRow>(
      "SELECT * FROM task_test_results WHERE task_id = ? ORDER BY created_at DESC",
      [taskId],
    );
    return rows.map(mapTaskTestResultRow);
  }

  /**
   * Get latest results for a task
   */
  async getLatestResults(taskId: string): Promise<ValidationResult | null> {
    const results = await this.getResults(taskId);
    if (results.length === 0) {
      return null;
    }

    // Group by level and take most recent
    const byLevel = new Map<TestLevel, TaskTestResult[]>();
    for (const result of results) {
      const existing = byLevel.get(result.testLevel) || [];
      existing.push(result);
      byLevel.set(result.testLevel, existing);
    }

    const levels: ValidationResult["levels"] = [];
    let overallPassed = true;
    let totalDuration = 0;

    for (const [level, levelResults] of byLevel) {
      const latest = levelResults[0]; // Results are ordered by created_at DESC
      const passed = latest.passed;
      if (!passed) overallPassed = false;
      totalDuration += latest.durationMs;

      levels.push({
        level,
        passed,
        results: [latest],
      });
    }

    return {
      taskId,
      overallPassed,
      totalDuration,
      levels: levels.sort((a, b) => a.level - b.level),
    };
  }

  /**
   * Get results by execution ID
   */
  async getResultsByExecution(executionId: string): Promise<TaskTestResult[]> {
    const rows = await query<TaskTestResultRow>(
      "SELECT * FROM task_test_results WHERE execution_id = ? ORDER BY created_at",
      [executionId],
    );
    return rows.map(mapTaskTestResultRow);
  }

  /**
   * Check acceptance criteria for a task (loads persisted results)
   */
  async checkAcceptanceCriteria(
    taskId: string,
  ): Promise<AcceptanceCriteriaResult> {
    // Get all acceptance criteria appendices with their IDs
    const appendices = await query<{
      id: string;
      content: string;
      metadata: string | null;
    }>(
      `SELECT id, content, metadata FROM task_appendices
       WHERE task_id = ? AND appendix_type = 'acceptance_criteria' AND content_type = 'inline'`,
      [taskId],
    );

    // Get all persisted AC results for this task
    const persistedResults = await this.getAcceptanceCriteriaResults(taskId);
    const resultsByKey = new Map<string, AcceptanceCriterionResult>();
    for (const result of persistedResults) {
      const key = `${result.appendixId}:${result.criterionIndex}`;
      resultsByKey.set(key, result);
    }

    const criteria: AcceptanceCriterion[] = [];

    for (const appendix of appendices) {
      // Parse metadata for scope
      let metadata: AppendixMetadata | undefined;
      if (appendix.metadata) {
        try {
          metadata = JSON.parse(appendix.metadata) as AppendixMetadata;
        } catch {
          // Invalid JSON, ignore metadata
        }
      }
      const scope = metadata?.scope;

      if (appendix.content) {
        // Parse acceptance criteria (assuming one per line)
        const lines = appendix.content.split("\n").filter((l) => l.trim());
        for (let index = 0; index < lines.length; index++) {
          const line = lines[index];
          const key = `${appendix.id}:${index}`;
          const persisted = resultsByKey.get(key);

          criteria.push({
            id: persisted?.id || `${appendix.id}:${index}`,
            text: line.trim(),
            met: persisted?.met ?? false,
            scope,
            verifiedAt: persisted?.verifiedAt,
            verifiedBy: persisted?.verifiedBy,
          });
        }
      }
    }

    // Check if all tests pass as base criteria
    const testResults = await this.getLatestResults(taskId);
    const testsPass = testResults?.overallPassed ?? false;

    if (criteria.length === 0) {
      // If no explicit criteria, use test results
      criteria.push({
        id: "tests",
        text: "All tests pass",
        met: testsPass,
      });
    }

    // Determine which configured test levels have results
    const configs = await this.getTestConfig(taskId);
    const coveredLevels = new Set<TestLevel>();
    if (testResults) {
      for (const levelResult of testResults.levels) {
        coveredLevels.add(levelResult.level);
      }
    }
    const missingLevels: TestLevel[] = configs
      .map((c) => c.level)
      .filter((level) => !coveredLevels.has(level));

    const allPassing = testsPass && criteria.every((c) => c.met) && missingLevels.length === 0;

    return {
      taskId,
      passed: testsPass && criteria.every((c) => c.met),
      allPassing,
      missingLevels,
      criteria,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all persisted acceptance criteria results for a task
   */
  async getAcceptanceCriteriaResults(
    taskId: string,
  ): Promise<AcceptanceCriterionResult[]> {
    const rows = await query<AcceptanceCriterionResultRow>(
      `SELECT * FROM acceptance_criteria_results WHERE task_id = ? ORDER BY appendix_id, criterion_index`,
      [taskId],
    );
    return rows.map(mapAcceptanceCriterionResultRow);
  }

  /**
   * Get a single acceptance criterion result
   */
  async getAcceptanceCriterionResult(
    appendixId: string,
    criterionIndex: number,
  ): Promise<AcceptanceCriterionResult | null> {
    const rows = await query<AcceptanceCriterionResultRow>(
      `SELECT * FROM acceptance_criteria_results WHERE appendix_id = ? AND criterion_index = ?`,
      [appendixId, criterionIndex],
    );
    return rows.length > 0 ? mapAcceptanceCriterionResultRow(rows[0]) : null;
  }

  /**
   * Update (or create) acceptance criterion verification status
   */
  async updateAcceptanceCriterionStatus(
    taskId: string,
    appendixId: string,
    criterionIndex: number,
    met: boolean,
    verifiedBy: VerifiedByType = "user",
    notes?: string,
  ): Promise<AcceptanceCriterionResult> {
    // Get criterion text from the appendix
    const appendix = await query<{ content: string; metadata: string | null }>(
      `SELECT content, metadata FROM task_appendices WHERE id = ?`,
      [appendixId],
    );

    if (appendix.length === 0) {
      throw new Error(`Appendix ${appendixId} not found`);
    }

    const lines = appendix[0].content.split("\n").filter((l) => l.trim());
    if (criterionIndex < 0 || criterionIndex >= lines.length) {
      throw new Error(`Invalid criterion index ${criterionIndex}`);
    }

    const criterionText = lines[criterionIndex].trim();

    // Parse scope from metadata
    let scope: TestScope | undefined;
    if (appendix[0].metadata) {
      try {
        const metadata = JSON.parse(appendix[0].metadata) as AppendixMetadata;
        scope = metadata.scope;
      } catch {
        // Invalid JSON, ignore
      }
    }

    const now = new Date().toISOString();

    // Check if result already exists
    const existing = await this.getAcceptanceCriterionResult(
      appendixId,
      criterionIndex,
    );

    if (existing) {
      // Update existing result
      await run(
        `UPDATE acceptance_criteria_results
         SET met = ?, verified_at = ?, verified_by = ?, notes = ?, criterion_text = ?, scope = ?
         WHERE id = ?`,
        [
          met ? 1 : 0,
          now,
          verifiedBy,
          notes || null,
          criterionText,
          scope || null,
          existing.id,
        ],
      );
      await saveDb();

      return {
        ...existing,
        met,
        verifiedAt: now,
        verifiedBy,
        notes,
        criterionText,
        scope,
        updatedAt: now,
      };
    } else {
      // Create new result
      const id = uuidv4();

      await run(
        `INSERT INTO acceptance_criteria_results (id, task_id, appendix_id, criterion_index, criterion_text, met, scope, verified_at, verified_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          taskId,
          appendixId,
          criterionIndex,
          criterionText,
          met ? 1 : 0,
          scope || null,
          now,
          verifiedBy,
          notes || null,
        ],
      );
      await saveDb();

      return {
        id,
        taskId,
        appendixId,
        criterionIndex,
        criterionText,
        met,
        scope,
        verifiedAt: now,
        verifiedBy,
        notes,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  /**
   * Bulk update acceptance criteria statuses
   */
  async bulkUpdateAcceptanceCriteria(
    taskId: string,
    updates: {
      appendixId: string;
      criterionIndex: number;
      met: boolean;
      notes?: string;
    }[],
    verifiedBy: VerifiedByType = "user",
  ): Promise<AcceptanceCriterionResult[]> {
    const results: AcceptanceCriterionResult[] = [];

    for (const update of updates) {
      const result = await this.updateAcceptanceCriterionStatus(
        taskId,
        update.appendixId,
        update.criterionIndex,
        update.met,
        verifiedBy,
        update.notes,
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Reset all acceptance criteria for a task (mark all as not met)
   */
  async resetAcceptanceCriteria(taskId: string): Promise<void> {
    await run(
      `UPDATE acceptance_criteria_results SET met = 0, verified_at = NULL, verified_by = NULL WHERE task_id = ?`,
      [taskId],
    );
    await saveDb();
  }

  /**
   * Delete all acceptance criteria results for a task
   */
  async deleteAcceptanceCriteriaResults(taskId: string): Promise<void> {
    await run(`DELETE FROM acceptance_criteria_results WHERE task_id = ?`, [
      taskId,
    ]);
    await saveDb();
  }

  /**
   * Execute a command and return results
   */
  private executeCommand(
    command: string,
    timeout: number,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const [cmd, ...args] = command.split(" ");
      const proc = spawn(cmd, args, {
        shell: true,
        cwd: process.cwd(),
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGKILL");
      }, timeout);

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new Error(`Command timed out after ${timeout}ms`));
        } else {
          resolve({
            exitCode: code ?? -1,
            stdout: stdout.substring(0, 10000), // Limit output size
            stderr: stderr.substring(0, 10000),
          });
        }
      });

      proc.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Save test result to database
   */
  private async saveResult(
    result: Omit<TaskTestResult, "id" | "createdAt">,
  ): Promise<TaskTestResult> {
    const id = uuidv4();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO task_test_results (id, task_id, test_level, test_scope, test_name, command, exit_code, stdout, stderr, duration_ms, passed, execution_id, agent_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        result.taskId,
        result.testLevel,
        result.testScope || null,
        result.testName || null,
        result.command,
        result.exitCode,
        result.stdout || null,
        result.stderr || null,
        result.durationMs,
        result.passed ? 1 : 0,
        result.executionId || null,
        result.agentId || null,
        now,
      ],
    );

    await saveDb();

    return {
      ...result,
      id,
      createdAt: now,
    };
  }
}

// Export singleton instance
export const taskTestService = new TaskTestService();
export default taskTestService;
