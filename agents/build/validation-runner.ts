/**
 * Validation Runner for Build Agent
 *
 * Executes validation commands and checks expected output.
 */

import { spawn } from 'child_process';
import { ValidationRunnerInterface } from './task-executor.js';

const DEFAULT_TIMEOUT = 60000; // 60 seconds

export interface ValidationResult {
  success: boolean;
  output: string;
  exitCode: number;
  error?: string;
}

export interface ValidationRunnerOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export class ValidationRunner implements ValidationRunnerInterface {
  private timeout: number;
  private cwd: string;
  private env: Record<string, string>;

  constructor(options: ValidationRunnerOptions = {}) {
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.cwd = options.cwd || process.cwd();
    this.env = options.env || {};
  }

  /**
   * Run a validation command and check expected output
   */
  async run(command: string, expected: string): Promise<ValidationResult> {
    try {
      const result = await this.execute(command);

      // Check if expected output matches
      const success = this.checkExpected(result.output, expected, result.exitCode);

      return {
        ...result,
        success
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute a command and capture output
   */
  async execute(command: string): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const proc = spawn('sh', ['-c', command], {
        cwd: this.cwd,
        env: { ...process.env, ...this.env },
        timeout: this.timeout
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        const output = (stdout + stderr).trim();
        resolve({
          output,
          exitCode: code ?? 0
        });
      });

      proc.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
          reject(new Error(`Command timed out after ${this.timeout}ms`));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Check if output matches expected
   */
  checkExpected(output: string, expected: string, exitCode: number): boolean {
    // If expected is empty, success is based on exit code
    if (expected.trim() === '') {
      return exitCode === 0;
    }

    // Handle exit code expectations
    if (expected.toLowerCase().includes('exit code 0')) {
      return exitCode === 0;
    }

    if (expected.toLowerCase().includes('exit code')) {
      const match = expected.match(/exit code (\d+)/i);
      if (match) {
        const expectedCode = parseInt(match[1], 10);
        return exitCode === expectedCode;
      }
    }

    // Handle "OK" or similar success indicators
    if (expected.toLowerCase() === 'ok') {
      return output.toLowerCase().includes('ok') && exitCode === 0;
    }

    // Handle "all tests pass" or similar
    if (expected.toLowerCase().includes('all tests pass')) {
      return exitCode === 0;
    }

    // Exact or contains match
    if (output.includes(expected)) {
      return true;
    }

    // Case-insensitive contains match
    if (output.toLowerCase().includes(expected.toLowerCase())) {
      return true;
    }

    return false;
  }

  /**
   * Run multiple validations in sequence
   */
  async runMultiple(validations: Array<{ command: string; expected: string }>): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const validation of validations) {
      const result = await this.run(validation.command, validation.expected);
      results.push(result);

      // Stop on first failure
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Set timeout
   */
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  /**
   * Get timeout
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Set working directory
   */
  setCwd(cwd: string): void {
    this.cwd = cwd;
  }

  /**
   * Get working directory
   */
  getCwd(): string {
    return this.cwd;
  }

  /**
   * Set environment variables
   */
  setEnv(env: Record<string, string>): void {
    this.env = env;
  }

  /**
   * Get environment variables
   */
  getEnv(): Record<string, string> {
    return { ...this.env };
  }
}

/**
 * Create a validation runner instance
 */
export function createValidationRunner(options?: ValidationRunnerOptions): ValidationRunner {
  return new ValidationRunner(options);
}
