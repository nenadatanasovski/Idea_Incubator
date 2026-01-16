/**
 * Task Test Service
 *
 * Manages three-level testing: syntax, unit, and e2e.
 * Part of: Task System V2 Implementation Plan (IMPL-3.10)
 */

import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  TaskTestResult,
  TaskTestConfig,
  ValidationResult,
  RunValidationInput,
  TestLevel,
  DEFAULT_TEST_CONFIGS,
  TaskTestResultRow,
  mapTaskTestResultRow,
  AcceptanceCriteriaResult,
} from "../../../types/task-test.js";

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
    context?: { executionId?: string; agentId?: string },
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
   * Check acceptance criteria for a task
   */
  async checkAcceptanceCriteria(
    taskId: string,
  ): Promise<AcceptanceCriteriaResult> {
    // Get acceptance criteria appendix if exists
    const appendix = await getOne<{ content: string }>(
      `SELECT content FROM task_appendices
       WHERE task_id = ? AND appendix_type = 'acceptance_criteria' AND content_type = 'inline'`,
      [taskId],
    );

    const criteria: { id: string; text: string; met: boolean }[] = [];

    if (appendix && appendix.content) {
      // Parse acceptance criteria (assuming one per line)
      const lines = appendix.content.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        criteria.push({
          id: uuidv4(),
          text: line.trim(),
          met: false, // Manual verification needed
        });
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

    return {
      taskId,
      passed: testsPass && criteria.every((c) => c.met),
      criteria,
      checkedAt: new Date().toISOString(),
    };
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
      `INSERT INTO task_test_results (id, task_id, test_level, test_name, command, exit_code, stdout, stderr, duration_ms, passed, execution_id, agent_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        result.taskId,
        result.testLevel,
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
