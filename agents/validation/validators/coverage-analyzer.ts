// agents/validation/validators/coverage-analyzer.ts - Code coverage analysis

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuid } from 'uuid';
import { ValidatorResult } from '../../../types/validation.js';

const COVERAGE_JSON_PATH = 'coverage/coverage-summary.json';

export interface CoverageMetrics {
  lines: CoverageDetail;
  statements: CoverageDetail;
  functions: CoverageDetail;
  branches: CoverageDetail;
}

export interface CoverageDetail {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface CoverageReport {
  total: CoverageMetrics;
  files: Record<string, CoverageMetrics>;
}

/**
 * Run coverage analysis as a validator
 */
export async function runCoverageAnalyzer(
  runId: string,
  args: string[],
  timeoutMs: number
): Promise<ValidatorResult> {
  const startTime = Date.now();
  const id = uuid();

  try {
    // Run vitest with coverage (output not used, we parse JSON file instead)
    await runCoverageCommand(timeoutMs);

    // Parse coverage report
    const report = await parseCoverageReport();

    if (!report) {
      return {
        id,
        runId,
        validatorName: 'coverage',
        status: 'completed',
        passed: false,
        output: 'Coverage report not found. Run `npm run test:coverage` first.',
        durationMs: Date.now() - startTime,
        createdAt: new Date().toISOString(),
      };
    }

    // Check thresholds
    const thresholds = parseThresholds(args);
    const { passed, failures } = checkThresholds(report.total, thresholds);

    // Format output
    const formattedOutput = formatCoverageOutput(report, failures);

    return {
      id,
      runId,
      validatorName: 'coverage',
      status: 'completed',
      passed,
      output: formattedOutput,
      durationMs: Date.now() - startTime,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id,
      runId,
      validatorName: 'coverage',
      status: 'completed',
      passed: false,
      output: `Coverage analysis failed: ${(error as Error).message}`,
      durationMs: Date.now() - startTime,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Run vitest coverage command
 */
async function runCoverageCommand(timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'test:coverage'], {
      shell: true,
      cwd: process.cwd(),
    });

    let output = '';
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      proc.kill();
      reject(new Error('Coverage command timed out'));
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', () => {
      clearTimeout(timeout);
      if (killed) return;

      // vitest exits with code 1 if tests fail, but coverage still works
      resolve(output);
    });

    proc.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Parse the JSON coverage report
 */
export async function parseCoverageReport(): Promise<CoverageReport | null> {
  if (!existsSync(COVERAGE_JSON_PATH)) {
    return null;
  }

  try {
    const content = await readFile(COVERAGE_JSON_PATH, 'utf-8');
    const data = JSON.parse(content);

    // Extract total coverage
    const total = data.total as CoverageMetrics;

    // Extract per-file coverage
    const files: Record<string, CoverageMetrics> = {};
    for (const [path, metrics] of Object.entries(data)) {
      if (path !== 'total') {
        files[path] = metrics as CoverageMetrics;
      }
    }

    return { total, files };
  } catch (error) {
    console.error('Failed to parse coverage report:', error);
    return null;
  }
}

/**
 * Parse coverage thresholds from args
 * Format: --lines=80 --branches=70 --functions=80 --statements=80
 */
export function parseThresholds(args: string[]): Partial<CoverageMetrics> {
  const thresholds: Partial<CoverageMetrics> = {};

  for (const arg of args) {
    const match = arg.match(/^--(\w+)=(\d+)$/);
    if (match) {
      const [, metric, value] = match;
      if (['lines', 'branches', 'functions', 'statements'].includes(metric)) {
        (thresholds as Record<string, CoverageDetail>)[metric] = {
          pct: parseInt(value, 10),
        } as CoverageDetail;
      }
    }
  }

  return thresholds;
}

/**
 * Check if coverage meets thresholds
 */
export function checkThresholds(
  actual: CoverageMetrics,
  thresholds: Partial<CoverageMetrics>
): { passed: boolean; failures: string[] } {
  const metricNames = ['lines', 'branches', 'functions', 'statements'] as const;
  const failures: string[] = [];

  for (const metric of metricNames) {
    const threshold = thresholds[metric];
    if (threshold && actual[metric].pct < threshold.pct) {
      const label = metric.charAt(0).toUpperCase() + metric.slice(1);
      failures.push(`${label}: ${actual[metric].pct}% < ${threshold.pct}% threshold`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Format coverage output for display
 */
export function formatCoverageOutput(
  report: CoverageReport,
  failures: string[]
): string {
  const { total } = report;

  let output = `Coverage Summary:
  Lines:      ${total.lines.pct.toFixed(2)}% (${total.lines.covered}/${total.lines.total})
  Statements: ${total.statements.pct.toFixed(2)}% (${total.statements.covered}/${total.statements.total})
  Branches:   ${total.branches.pct.toFixed(2)}% (${total.branches.covered}/${total.branches.total})
  Functions:  ${total.functions.pct.toFixed(2)}% (${total.functions.covered}/${total.functions.total})
`;

  if (failures.length > 0) {
    output += `\nThreshold Failures:\n`;
    for (const failure of failures) {
      output += `  - ${failure}\n`;
    }
  }

  // Add low coverage files
  const lowCoverageFiles = Object.entries(report.files)
    .filter(([, metrics]) => metrics.lines.pct < 50)
    .sort((a, b) => a[1].lines.pct - b[1].lines.pct)
    .slice(0, 5);

  if (lowCoverageFiles.length > 0) {
    output += `\nFiles with Low Coverage (<50%):\n`;
    for (const [path, metrics] of lowCoverageFiles) {
      output += `  ${metrics.lines.pct.toFixed(1)}% - ${path}\n`;
    }
  }

  return output;
}

/**
 * Get coverage for specific files (useful for incremental checks)
 */
export async function getCoverageForFiles(
  filePaths: string[]
): Promise<Record<string, CoverageMetrics>> {
  const report = await parseCoverageReport();
  if (!report) return {};

  const result: Record<string, CoverageMetrics> = {};
  for (const path of filePaths) {
    // Try exact match and partial match
    const match = Object.entries(report.files).find(
      ([key]) => key.endsWith(path) || key.includes(path)
    );
    if (match) {
      result[path] = match[1];
    }
  }

  return result;
}
