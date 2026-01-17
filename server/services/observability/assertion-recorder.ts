/**
 * AssertionRecorder - Records test assertions with evidence linking
 *
 * Supports assertion chains that group related assertions,
 * tracking pass/fail counts and computing overall results.
 *
 * OBS-110: Phase 3 TypeScript Observability Services
 */

import { v4 as uuidv4 } from "uuid";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import path from "path";
import { run } from "../../../database/db.js";
import { TranscriptWriter } from "./transcript-writer.js";

const execAsync = promisify(exec);

export type AssertionCategory =
  | "file_created"
  | "file_modified"
  | "file_deleted"
  | "typescript_compiles"
  | "lint_passes"
  | "tests_pass"
  | "api_responds"
  | "schema_valid"
  | "dependency_met"
  | "custom";

export type AssertionResult = "pass" | "fail" | "skip" | "warn";

export interface AssertionEvidence {
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  filePath?: string;
  fileExists?: boolean;
  errorMessage?: string;
  // OBS-108: Allow additional custom properties for agent-specific evidence
  [key: string]: unknown;
}

export interface ChainResult {
  overallResult: string;
  passCount: number;
  failCount: number;
  firstFailureId?: string;
}

/**
 * AssertionRecorder for TypeScript agents
 */
export class AssertionRecorder {
  private transcript: TranscriptWriter;
  private executionId: string;
  private currentChainId?: string;
  private chainPassCount: number = 0;
  private chainFailCount: number = 0;
  private firstFailureId?: string;
  private chainPosition: number = 0;
  private projectRoot: string;

  constructor(
    transcriptWriter: TranscriptWriter,
    executionId: string,
    projectRoot?: string,
  ) {
    this.transcript = transcriptWriter;
    this.executionId = executionId;
    this.projectRoot = projectRoot || path.resolve(process.cwd());
  }

  /**
   * Start an assertion chain
   */
  async startChain(taskId: string, description: string): Promise<string> {
    const chainId = uuidv4();
    this.currentChainId = chainId;
    this.chainPassCount = 0;
    this.chainFailCount = 0;
    this.firstFailureId = undefined;
    this.chainPosition = 0;

    try {
      await run(
        `INSERT INTO assertion_chains (
          id, task_id, execution_id, description,
          overall_result, pass_count, fail_count,
          started_at, wave_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          chainId,
          taskId,
          this.executionId,
          description,
          "pending",
          0,
          0,
          new Date().toISOString(),
          (this.transcript as any).waveId || null,
        ],
      );
    } catch (error) {
      console.error("Failed to start assertion chain:", error);
    }

    return chainId;
  }

  /**
   * End chain and compute overall result
   */
  async endChain(chainId: string): Promise<ChainResult> {
    let overall: string;
    if (this.chainFailCount > 0) {
      overall = "fail";
    } else if (this.chainPassCount > 0) {
      overall = "pass";
    } else {
      overall = "skip";
    }

    try {
      await run(
        `UPDATE assertion_chains SET
          overall_result = ?,
          pass_count = ?,
          fail_count = ?,
          first_failure_id = ?,
          completed_at = ?
        WHERE id = ?`,
        [
          overall,
          this.chainPassCount,
          this.chainFailCount,
          this.firstFailureId || null,
          new Date().toISOString(),
          chainId,
        ],
      );
    } catch (error) {
      console.error("Failed to end assertion chain:", error);
    }

    const result: ChainResult = {
      overallResult: overall,
      passCount: this.chainPassCount,
      failCount: this.chainFailCount,
      firstFailureId: this.firstFailureId,
    };

    this.currentChainId = undefined;
    return result;
  }

  /**
   * Record a single assertion result
   */
  private async recordAssertion(
    taskId: string,
    category: string,
    description: string,
    result: AssertionResult,
    evidence: AssertionEvidence,
  ): Promise<string> {
    const assertionId = uuidv4();

    // Update chain counts
    if (result === "pass") {
      this.chainPassCount++;
    } else if (result === "fail") {
      this.chainFailCount++;
      if (!this.firstFailureId) {
        this.firstFailureId = assertionId;
      }
    }

    const position = this.chainPosition;
    this.chainPosition++;

    // Write transcript entry
    await this.transcript.write({
      entryType: "assertion",
      category: "validation",
      taskId,
      summary: `Assertion ${result}: ${description.slice(0, 150)}`,
      details: {
        category,
        result,
        evidence,
      },
    });

    // Insert assertion result
    try {
      await run(
        `INSERT INTO assertion_results (
          id, task_id, execution_id, category,
          description, result, evidence, chain_id,
          chain_position, timestamp, wave_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assertionId,
          taskId,
          this.executionId,
          category,
          description,
          result,
          JSON.stringify(evidence),
          this.currentChainId || null,
          position,
          new Date().toISOString(),
          (this.transcript as any).waveId || null,
        ],
      );
    } catch (error) {
      console.error("Failed to record assertion:", error);
    }

    return assertionId;
  }

  /**
   * Assert a file was created
   */
  async assertFileCreated(taskId: string, filePath: string): Promise<string> {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);

    const exists = existsSync(fullPath);
    const evidence: AssertionEvidence = {
      filePath,
      fileExists: exists,
    };

    const result: AssertionResult = exists ? "pass" : "fail";
    return this.recordAssertion(
      taskId,
      "file_created",
      `File created: ${filePath}`,
      result,
      evidence,
    );
  }

  /**
   * Assert a file was modified (exists)
   */
  async assertFileModified(taskId: string, filePath: string): Promise<string> {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);

    const exists = existsSync(fullPath);
    const evidence: AssertionEvidence = {
      filePath,
      fileExists: exists,
    };

    const result: AssertionResult = exists ? "pass" : "fail";
    return this.recordAssertion(
      taskId,
      "file_modified",
      `File modified: ${filePath}`,
      result,
      evidence,
    );
  }

  /**
   * Assert a file was deleted (does not exist)
   */
  async assertFileDeleted(taskId: string, filePath: string): Promise<string> {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);

    const exists = existsSync(fullPath);
    const evidence: AssertionEvidence = {
      filePath,
      fileExists: exists,
    };

    const result: AssertionResult = !exists ? "pass" : "fail";
    return this.recordAssertion(
      taskId,
      "file_deleted",
      `File deleted: ${filePath}`,
      result,
      evidence,
    );
  }

  /**
   * Assert TypeScript compilation passes
   */
  async assertTypescriptCompiles(taskId: string): Promise<string> {
    let evidence: AssertionEvidence;
    let status: AssertionResult;

    try {
      const { stdout, stderr } = await execAsync("npx tsc --noEmit", {
        cwd: this.projectRoot,
        timeout: 120000,
      });
      evidence = {
        command: "npx tsc --noEmit",
        exitCode: 0,
        stdout: stdout?.slice(0, 2000),
        stderr: stderr?.slice(0, 2000),
      };
      status = "pass";
    } catch (error: any) {
      evidence = {
        command: "npx tsc --noEmit",
        exitCode: error.code || 1,
        stdout: error.stdout?.slice(0, 2000),
        stderr: error.stderr?.slice(0, 2000),
        errorMessage: error.message,
      };
      status = "fail";
    }

    return this.recordAssertion(
      taskId,
      "typescript_compiles",
      "TypeScript compilation",
      status,
      evidence,
    );
  }

  /**
   * Assert linting passes
   */
  async assertLintPasses(taskId: string): Promise<string> {
    let evidence: AssertionEvidence;
    let status: AssertionResult;

    try {
      const { stdout, stderr } = await execAsync("npm run lint", {
        cwd: this.projectRoot,
        timeout: 60000,
      });
      evidence = {
        command: "npm run lint",
        exitCode: 0,
        stdout: stdout?.slice(0, 2000),
        stderr: stderr?.slice(0, 2000),
      };
      status = "pass";
    } catch (error: any) {
      evidence = {
        command: "npm run lint",
        exitCode: error.code || 1,
        stdout: error.stdout?.slice(0, 2000),
        stderr: error.stderr?.slice(0, 2000),
        errorMessage: error.message,
      };
      status = "fail";
    }

    return this.recordAssertion(
      taskId,
      "lint_passes",
      "Lint check",
      status,
      evidence,
    );
  }

  /**
   * Assert tests pass
   */
  async assertTestsPass(taskId: string, pattern?: string): Promise<string> {
    const cmd = pattern ? `npm test -- ${pattern}` : "npm test";

    let evidence: AssertionEvidence;
    let status: AssertionResult;

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.projectRoot,
        timeout: 180000,
      });
      evidence = {
        command: cmd,
        exitCode: 0,
        stdout: stdout?.slice(0, 2000),
        stderr: stderr?.slice(0, 2000),
      };
      status = "pass";
    } catch (error: any) {
      evidence = {
        command: cmd,
        exitCode: error.code || 1,
        stdout: error.stdout?.slice(0, 2000),
        stderr: error.stderr?.slice(0, 2000),
        errorMessage: error.message,
      };
      status = "fail";
    }

    return this.recordAssertion(
      taskId,
      "tests_pass",
      `Tests pass${pattern ? ": " + pattern : ""}`,
      status,
      evidence,
    );
  }

  /**
   * Run a custom assertion via command
   */
  async assertCustom(
    taskId: string,
    category: string,
    description: string,
    command: string,
    timeout: number = 60000,
  ): Promise<string> {
    let evidence: AssertionEvidence;
    let status: AssertionResult;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectRoot,
        timeout,
        shell: "/bin/bash",
      });
      evidence = {
        command,
        exitCode: 0,
        stdout: stdout?.slice(0, 2000),
        stderr: stderr?.slice(0, 2000),
      };
      status = "pass";
    } catch (error: any) {
      evidence = {
        command,
        exitCode: error.code || 1,
        stdout: error.stdout?.slice(0, 2000),
        stderr: error.stderr?.slice(0, 2000),
        errorMessage: error.message,
      };
      status = "fail";
    }

    return this.recordAssertion(
      taskId,
      category,
      description,
      status,
      evidence,
    );
  }

  /**
   * Record a manual assertion result
   */
  async assertManual(
    taskId: string,
    category: string,
    description: string,
    passed: boolean,
    evidenceDetails?: Partial<AssertionEvidence>,
  ): Promise<string> {
    const evidence: AssertionEvidence = evidenceDetails || {};
    const result: AssertionResult = passed ? "pass" : "fail";
    return this.recordAssertion(
      taskId,
      category,
      description,
      result,
      evidence,
    );
  }
}

export default AssertionRecorder;
