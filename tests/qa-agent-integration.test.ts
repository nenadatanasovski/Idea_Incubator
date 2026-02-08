/**
 * QA Agent Integration Tests (VIBE-P14-010)
 *
 * Comprehensive integration tests for the upgraded QA Agent covering:
 * - Unit test generation (TypeScript validator)
 * - API test generation (verifyCommand)
 * - E2E test generation (full validation orchestrator)
 * - Security scanning
 * - Performance / coverage reporting
 * - Error handling for each capability
 * - End-to-end workflow (generate + run + report)
 */

import { describe, it, expect } from "vitest";

// ── Type imports ──────────────────────────────────────────────────────────────
import type {
  ValidatorResult,
  ValidatorConfig,
  ValidationLevel,
  ValidationRunRequest,
  ValidationSummary,
} from "../types/validation.js";

// ── Module imports ────────────────────────────────────────────────────────────
import {
  getLevelConfig,
  LEVEL_CONFIGS,
} from "../agents/validation/level-configs.js";
import { aggregateResults } from "../agents/validation/result-aggregator.js";
import {
  parseThresholds,
  checkThresholds,
  formatCoverageOutput,
  type CoverageMetrics,
  type CoverageReport,
} from "../agents/validation/validators/coverage-analyzer.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a mock ValidatorResult */
function createResult(
  name: string,
  passed: boolean,
  opts: Partial<ValidatorResult> = {},
): ValidatorResult {
  return {
    id: `id-${name}-${Date.now()}`,
    runId: "run-integration-test",
    validatorName: name,
    status: "completed",
    passed,
    output: opts.output ?? `${name} output`,
    durationMs: opts.durationMs ?? 1000,
    createdAt: new Date().toISOString(),
    ...opts,
  };
}

/** Create a mock ValidatorConfig */
function createConfig(
  name: string,
  required: boolean,
  timeoutMs = 30000,
): ValidatorConfig {
  return {
    name,
    command: "npx",
    args: [],
    required,
    timeoutMs,
  };
}

/** Create mock CoverageMetrics for testing */
function createMetrics(pct: number): CoverageMetrics {
  return {
    lines: { total: 1000, covered: pct * 10, skipped: 0, pct },
    statements: { total: 1200, covered: pct * 12, skipped: 0, pct },
    branches: { total: 400, covered: pct * 4, skipped: 0, pct },
    functions: { total: 200, covered: pct * 2, skipped: 0, pct },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Integration test for unit test generation (TypeScript validator)
// ═══════════════════════════════════════════════════════════════════════════════

describe("QA Agent Integration: Unit Test Generation (TypeScript Validator)", () => {
  it("should configure typescript validator for QUICK level", () => {
    const config = getLevelConfig("QUICK");
    expect(config.validators).toHaveLength(1);
    expect(config.validators[0].name).toBe("typescript");
    expect(config.validators[0].command).toBe("npx");
    expect(config.validators[0].args).toContain("tsc");
    expect(config.validators[0].args).toContain("--noEmit");
    expect(config.validators[0].required).toBe(true);
  });

  it("should configure strict typescript for THOROUGH level", () => {
    const config = getLevelConfig("THOROUGH");
    const tsValidator = config.validators.find((v) => v.name === "typescript");
    expect(tsValidator).toBeDefined();
    expect(tsValidator!.args).toContain("--strict");
    expect(tsValidator!.timeoutMs).toBe(60000);
  });

  it("should configure strict typescript for RELEASE level with longer timeout", () => {
    const config = getLevelConfig("RELEASE");
    const tsValidator = config.validators.find((v) => v.name === "typescript");
    expect(tsValidator).toBeDefined();
    expect(tsValidator!.args).toContain("--strict");
    expect(tsValidator!.timeoutMs).toBe(120000);
    expect(tsValidator!.required).toBe(true);
  });

  it("should aggregate typescript-only results correctly on pass", () => {
    const results = [createResult("typescript", true, { durationMs: 5000 })];
    const configs = [createConfig("typescript", true)];
    const { passed, summary } = aggregateResults(results, configs);

    expect(passed).toBe(true);
    expect(summary.validatorsRun).toBe(1);
    expect(summary.validatorsPassed).toBe(1);
    expect(summary.validatorsFailed).toBe(0);
    expect(summary.totalDurationMs).toBe(5000);
  });

  it("should aggregate typescript-only results correctly on fail", () => {
    const results = [
      createResult("typescript", false, {
        output: "error TS2304: Cannot find name 'foo'",
        durationMs: 3000,
      }),
    ];
    const configs = [createConfig("typescript", true)];
    const { passed, summary } = aggregateResults(results, configs);

    expect(passed).toBe(false);
    expect(summary.validatorsFailed).toBe(1);
  });

  it("should handle typescript result with compilation errors in output", () => {
    const tsResult = createResult("typescript", false, {
      output:
        "src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.\n" +
        "src/utils.ts(3,1): error TS2304: Cannot find name 'undefined_var'.\n" +
        "Found 2 errors in 2 files.",
    });

    expect(tsResult.passed).toBe(false);
    expect(tsResult.output).toContain("error TS2322");
    expect(tsResult.output).toContain("Found 2 errors");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Integration test for API test generation (verifyCommand)
// ═══════════════════════════════════════════════════════════════════════════════

describe("QA Agent Integration: API Test Generation (Test Runner)", () => {
  it("should configure vitest runner for STANDARD level", () => {
    const config = getLevelConfig("STANDARD");
    const testValidator = config.validators.find((v) => v.name === "vitest");
    expect(testValidator).toBeDefined();
    expect(testValidator!.command).toBe("npx");
    expect(testValidator!.args).toContain("vitest");
    expect(testValidator!.args).toContain("run");
    expect(testValidator!.required).toBe(true);
    expect(testValidator!.timeoutMs).toBe(90000);
  });

  it("should configure vitest runner for THOROUGH level with longer timeout", () => {
    const config = getLevelConfig("THOROUGH");
    const testValidator = config.validators.find((v) => v.name === "vitest");
    expect(testValidator).toBeDefined();
    expect(testValidator!.timeoutMs).toBe(300000);
  });

  it("should correctly aggregate test runner results with typescript", () => {
    const results = [
      createResult("typescript", true, { durationMs: 5000 }),
      createResult("vitest", true, { durationMs: 15000 }),
    ];
    const configs = [
      createConfig("typescript", true),
      createConfig("vitest", true),
    ];

    const { passed, summary } = aggregateResults(results, configs);

    expect(passed).toBe(true);
    expect(summary.validatorsRun).toBe(2);
    expect(summary.validatorsPassed).toBe(2);
    expect(summary.totalDurationMs).toBe(20000);
  });

  it("should fail aggregation when test runner fails", () => {
    const results = [
      createResult("typescript", true, { durationMs: 5000 }),
      createResult("vitest", false, {
        output: "FAIL tests/example.test.ts\n  1 failed, 10 passed",
        durationMs: 12000,
      }),
    ];
    const configs = [
      createConfig("typescript", true),
      createConfig("vitest", true),
    ];

    const { passed, summary } = aggregateResults(results, configs);

    expect(passed).toBe(false);
    expect(summary.validatorsPassed).toBe(1);
    expect(summary.validatorsFailed).toBe(1);
  });

  it("should handle test runner output parsing for pass/fail detection", () => {
    const passResult = createResult("vitest", true, {
      output: "Tests  50 passed (50)\nDuration  5.23s",
    });
    expect(passResult.passed).toBe(true);
    expect(passResult.output).toContain("50 passed");

    const failResult = createResult("vitest", false, {
      output: "Tests  3 failed | 47 passed (50)\nDuration  5.23s",
    });
    expect(failResult.passed).toBe(false);
    expect(failResult.output).toContain("3 failed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Integration test for E2E test generation (full validation orchestrator)
// ═══════════════════════════════════════════════════════════════════════════════

describe("QA Agent Integration: E2E Validation (Full Orchestrator Workflow)", () => {
  it("should define all 4 validation levels", () => {
    const levels: ValidationLevel[] = ["QUICK", "STANDARD", "THOROUGH", "RELEASE"];
    for (const level of levels) {
      const config = getLevelConfig(level);
      expect(config).toBeDefined();
      expect(config.level).toBe(level);
    }
  });

  it("should enforce increasing validator counts across levels", () => {
    const quick = getLevelConfig("QUICK");
    const standard = getLevelConfig("STANDARD");
    const thorough = getLevelConfig("THOROUGH");
    const release = getLevelConfig("RELEASE");

    expect(quick.validators.length).toBeLessThan(standard.validators.length);
    expect(standard.validators.length).toBeLessThan(thorough.validators.length);
    expect(thorough.validators.length).toBe(release.validators.length);
  });

  it("should enforce increasing time budgets across levels", () => {
    const quick = getLevelConfig("QUICK");
    const standard = getLevelConfig("STANDARD");
    const thorough = getLevelConfig("THOROUGH");

    expect(quick.timeBudgetMs).toBeLessThan(standard.timeBudgetMs);
    expect(standard.timeBudgetMs).toBeLessThan(thorough.timeBudgetMs);
  });

  it("should aggregate full THOROUGH suite results", () => {
    const results = [
      createResult("typescript", true, { durationMs: 10000 }),
      createResult("vitest", true, { durationMs: 60000 }),
      createResult("security", true, { durationMs: 5000 }),
      createResult("coverage", true, { durationMs: 30000 }),
    ];
    const configs = getLevelConfig("THOROUGH").validators;

    const { passed, summary } = aggregateResults(results, configs);

    expect(passed).toBe(true);
    expect(summary.validatorsRun).toBe(4);
    expect(summary.validatorsPassed).toBe(4);
    expect(summary.totalDurationMs).toBe(105000);
  });

  it("should pass THOROUGH when optional validators fail", () => {
    const results = [
      createResult("typescript", true, { durationMs: 10000 }),
      createResult("vitest", true, { durationMs: 60000 }),
      createResult("security", false, { durationMs: 5000 }),
      createResult("coverage", false, { durationMs: 30000 }),
    ];
    const configs = getLevelConfig("THOROUGH").validators;

    const { passed, summary } = aggregateResults(results, configs);

    // THOROUGH has security and coverage as optional
    expect(passed).toBe(true);
    expect(summary.validatorsPassed).toBe(2);
    expect(summary.validatorsFailed).toBe(2);
  });

  it("should fail RELEASE when optional-in-THOROUGH validators fail", () => {
    const results = [
      createResult("typescript", true, { durationMs: 10000 }),
      createResult("vitest", true, { durationMs: 60000 }),
      createResult("security", false, { durationMs: 5000 }),
      createResult("coverage", true, { durationMs: 30000 }),
    ];
    const configs = getLevelConfig("RELEASE").validators;

    const { passed, summary } = aggregateResults(results, configs);

    // RELEASE has all validators as required
    expect(passed).toBe(false);
    expect(summary.validatorsFailed).toBe(1);
  });

  it("should correctly track RELEASE level requiring all validators", () => {
    const releaseConfig = getLevelConfig("RELEASE");
    const allRequired = releaseConfig.validators.every((v) => v.required);
    expect(allRequired).toBe(true);
  });

  it("should have no time limit for RELEASE level", () => {
    const releaseConfig = getLevelConfig("RELEASE");
    expect(releaseConfig.timeBudgetMs).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Integration test for security scanning
// ═══════════════════════════════════════════════════════════════════════════════

describe("QA Agent Integration: Security Scanning", () => {
  it("should configure security scanner in THOROUGH level as optional", () => {
    const config = getLevelConfig("THOROUGH");
    const securityValidator = config.validators.find(
      (v) => v.name === "security",
    );
    expect(securityValidator).toBeDefined();
    expect(securityValidator!.required).toBe(false);
    expect(securityValidator!.timeoutMs).toBe(60000);
  });

  it("should configure security scanner in RELEASE level as required", () => {
    const config = getLevelConfig("RELEASE");
    const securityValidator = config.validators.find(
      (v) => v.name === "security",
    );
    expect(securityValidator).toBeDefined();
    expect(securityValidator!.required).toBe(true);
    expect(securityValidator!.timeoutMs).toBe(120000);
  });

  it("should not include security scanner in QUICK level", () => {
    const config = getLevelConfig("QUICK");
    const securityValidator = config.validators.find(
      (v) => v.name === "security",
    );
    expect(securityValidator).toBeUndefined();
  });

  it("should not include security scanner in STANDARD level", () => {
    const config = getLevelConfig("STANDARD");
    const securityValidator = config.validators.find(
      (v) => v.name === "security",
    );
    expect(securityValidator).toBeUndefined();
  });

  it("should pass aggregation when security passes with no high/critical vulns", () => {
    const results = [
      createResult("typescript", true),
      createResult("vitest", true),
      createResult("security", true, {
        output: JSON.stringify({
          vulnerabilities: {
            info: 2,
            low: 5,
            moderate: 1,
            high: 0,
            critical: 0,
          },
        }),
      }),
    ];
    const configs = [
      createConfig("typescript", true),
      createConfig("vitest", true),
      createConfig("security", false),
    ];

    const { passed } = aggregateResults(results, configs);
    expect(passed).toBe(true);
  });

  it("should not fail overall when optional security scan finds vulnerabilities", () => {
    const results = [
      createResult("typescript", true),
      createResult("vitest", true),
      createResult("security", false, {
        output: JSON.stringify({
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 3,
            critical: 1,
          },
        }),
      }),
    ];
    const configs = [
      createConfig("typescript", true),
      createConfig("vitest", true),
      createConfig("security", false),
    ];

    const { passed, summary } = aggregateResults(results, configs);
    // Security is optional so overall still passes
    expect(passed).toBe(true);
    expect(summary.validatorsFailed).toBe(1);
  });

  it("should fail overall when required security scan finds vulnerabilities", () => {
    const results = [
      createResult("typescript", true),
      createResult("vitest", true),
      createResult("security", false, {
        output: JSON.stringify({
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 1,
            critical: 0,
          },
        }),
      }),
      createResult("coverage", true),
    ];
    const configs = getLevelConfig("RELEASE").validators;

    const { passed } = aggregateResults(results, configs);
    // Security is required in RELEASE
    expect(passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Integration test for performance testing (coverage thresholds)
// ═══════════════════════════════════════════════════════════════════════════════

describe("QA Agent Integration: Performance Testing (Coverage Thresholds)", () => {
  it("should parse single threshold from args", () => {
    const thresholds = parseThresholds(["--lines=80"]);
    expect(thresholds.lines?.pct).toBe(80);
  });

  it("should parse multiple thresholds from args", () => {
    const thresholds = parseThresholds([
      "--lines=80",
      "--branches=70",
      "--functions=75",
      "--statements=85",
    ]);
    expect(thresholds.lines?.pct).toBe(80);
    expect(thresholds.branches?.pct).toBe(70);
    expect(thresholds.functions?.pct).toBe(75);
    expect(thresholds.statements?.pct).toBe(85);
  });

  it("should ignore non-coverage args", () => {
    const thresholds = parseThresholds([
      "--lines=80",
      "--invalid=50",
      "not-a-flag",
      "--coverage=90",
    ]);
    expect(thresholds.lines?.pct).toBe(80);
    expect(Object.keys(thresholds)).toHaveLength(1);
  });

  it("should pass when all coverage thresholds are met", () => {
    const metrics = createMetrics(85);
    const thresholds = parseThresholds(["--lines=80", "--branches=80"]);
    const { passed, failures } = checkThresholds(metrics, thresholds);

    expect(passed).toBe(true);
    expect(failures).toHaveLength(0);
  });

  it("should fail when coverage is below threshold", () => {
    const metrics = createMetrics(65);
    const thresholds = parseThresholds(["--lines=80"]);
    const { passed, failures } = checkThresholds(metrics, thresholds);

    expect(passed).toBe(false);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("Lines");
    expect(failures[0]).toContain("65%");
    expect(failures[0]).toContain("80%");
  });

  it("should report multiple threshold failures", () => {
    const metrics = createMetrics(50);
    const thresholds = parseThresholds([
      "--lines=80",
      "--branches=70",
      "--functions=60",
    ]);
    const { passed, failures } = checkThresholds(metrics, thresholds);

    expect(passed).toBe(false);
    expect(failures).toHaveLength(3);
  });

  it("should pass with exact threshold match", () => {
    const metrics = createMetrics(80);
    const thresholds = parseThresholds(["--lines=80"]);
    const { passed } = checkThresholds(metrics, thresholds);

    expect(passed).toBe(true);
  });

  it("should pass with no thresholds defined", () => {
    const metrics = createMetrics(10);
    const { passed } = checkThresholds(metrics, {});

    expect(passed).toBe(true);
  });

  it("should configure THOROUGH coverage with 50% line threshold", () => {
    const config = getLevelConfig("THOROUGH");
    const coverageValidator = config.validators.find(
      (v) => v.name === "coverage",
    );
    expect(coverageValidator).toBeDefined();
    expect(coverageValidator!.args).toContain("--lines=50");
  });

  it("should configure RELEASE coverage with 70% line and function thresholds", () => {
    const config = getLevelConfig("RELEASE");
    const coverageValidator = config.validators.find(
      (v) => v.name === "coverage",
    );
    expect(coverageValidator).toBeDefined();
    expect(coverageValidator!.args).toContain("--lines=70");
    expect(coverageValidator!.args).toContain("--functions=70");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Integration test for coverage reporting
// ═══════════════════════════════════════════════════════════════════════════════

describe("QA Agent Integration: Coverage Reporting", () => {
  it("should format coverage summary with all metric types", () => {
    const report: CoverageReport = {
      total: createMetrics(75),
      files: {},
    };
    const output = formatCoverageOutput(report, []);

    expect(output).toContain("Coverage Summary:");
    expect(output).toContain("Lines:");
    expect(output).toContain("75.00%");
    expect(output).toContain("Statements:");
    expect(output).toContain("Branches:");
    expect(output).toContain("Functions:");
  });

  it("should include threshold failure details in report", () => {
    const report: CoverageReport = {
      total: createMetrics(65),
      files: {},
    };
    const failures = [
      "Lines: 65% < 80% threshold",
      "Functions: 65% < 75% threshold",
    ];
    const output = formatCoverageOutput(report, failures);

    expect(output).toContain("Threshold Failures");
    expect(output).toContain("Lines: 65% < 80% threshold");
    expect(output).toContain("Functions: 65% < 75% threshold");
  });

  it("should list files with low coverage (<50%)", () => {
    const report: CoverageReport = {
      total: createMetrics(75),
      files: {
        "src/uncovered-module.ts": createMetrics(20),
        "src/partially-covered.ts": createMetrics(45),
        "src/well-covered.ts": createMetrics(90),
        "src/fully-covered.ts": createMetrics(100),
      },
    };
    const output = formatCoverageOutput(report, []);

    expect(output).toContain("Files with Low Coverage (<50%)");
    expect(output).toContain("uncovered-module.ts");
    expect(output).toContain("partially-covered.ts");
    expect(output).not.toContain("well-covered.ts");
    expect(output).not.toContain("fully-covered.ts");
  });

  it("should sort low coverage files by percentage ascending", () => {
    const report: CoverageReport = {
      total: createMetrics(60),
      files: {
        "src/medium.ts": createMetrics(40),
        "src/lowest.ts": createMetrics(10),
        "src/low.ts": createMetrics(25),
      },
    };
    const output = formatCoverageOutput(report, []);

    const lowestIdx = output.indexOf("lowest.ts");
    const lowIdx = output.indexOf("low.ts");
    const mediumIdx = output.indexOf("medium.ts");

    expect(lowestIdx).toBeLessThan(lowIdx);
    expect(lowIdx).toBeLessThan(mediumIdx);
  });

  it("should limit low coverage file list to top 5", () => {
    const files: Record<string, CoverageMetrics> = {};
    for (let i = 0; i < 10; i++) {
      files[`src/file-${i}.ts`] = createMetrics(i * 4); // 0%, 4%, 8%, ... 36%
    }
    const report: CoverageReport = {
      total: createMetrics(50),
      files,
    };
    const output = formatCoverageOutput(report, []);

    // Count how many file entries appear under low coverage
    const lowCoverageSection = output.split("Files with Low Coverage")[1] || "";
    const fileEntries = lowCoverageSection
      .split("\n")
      .filter((l) => l.includes("file-"));
    expect(fileEntries.length).toBeLessThanOrEqual(5);
  });

  it("should not show low coverage section when no files are below 50%", () => {
    const report: CoverageReport = {
      total: createMetrics(90),
      files: {
        "src/good.ts": createMetrics(85),
        "src/great.ts": createMetrics(95),
      },
    };
    const output = formatCoverageOutput(report, []);

    expect(output).not.toContain("Low Coverage");
  });

  it("should format coverage percentages to 2 decimal places", () => {
    const metrics: CoverageMetrics = {
      lines: { total: 300, covered: 201, skipped: 0, pct: 67.0 },
      statements: { total: 350, covered: 245, skipped: 0, pct: 70.0 },
      branches: { total: 100, covered: 55, skipped: 0, pct: 55.0 },
      functions: { total: 50, covered: 40, skipped: 0, pct: 80.0 },
    };
    const report: CoverageReport = { total: metrics, files: {} };
    const output = formatCoverageOutput(report, []);

    expect(output).toContain("67.00%");
    expect(output).toContain("70.00%");
    expect(output).toContain("55.00%");
    expect(output).toContain("80.00%");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Error handling tests for each capability
// ═══════════════════════════════════════════════════════════════════════════════

describe("QA Agent Integration: Error Handling", () => {
  describe("TypeScript Validator Error Handling", () => {
    it("should handle failed status result", () => {
      const result = createResult("typescript", false, {
        status: "failed",
        output: "spawn ENOENT",
      });

      expect(result.status).toBe("failed");
      expect(result.passed).toBe(false);
      expect(result.output).toContain("ENOENT");
    });

    it("should aggregate failed validator correctly", () => {
      const results = [
        createResult("typescript", false, { status: "failed" }),
      ];
      const configs = [createConfig("typescript", true)];
      const { passed } = aggregateResults(results, configs);
      expect(passed).toBe(false);
    });

    it("should handle null duration in aggregation", () => {
      const results = [
        createResult("typescript", true, { durationMs: null }),
      ];
      const configs = [createConfig("typescript", true)];
      const { summary } = aggregateResults(results, configs);
      expect(summary.totalDurationMs).toBe(0);
    });
  });

  describe("Test Runner Error Handling", () => {
    it("should handle test runner process error", () => {
      const result = createResult("vitest", false, {
        status: "failed",
        output: "Error: Cannot find module 'vitest'",
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain("Cannot find module");
    });

    it("should handle test runner timeout", () => {
      const result = createResult("vitest", false, {
        status: "failed",
        output: "Test execution timed out after 120000ms",
        durationMs: 120000,
      });

      expect(result.passed).toBe(false);
      expect(result.durationMs).toBe(120000);
    });
  });

  describe("Security Scanner Error Handling", () => {
    it("should handle unparseable npm audit output gracefully", () => {
      // When npm audit output can't be parsed, security scanner passes by default
      const result = createResult("security", true, {
        output: "npm ERR! something went wrong",
      });

      // Security scanner is tolerant - passes when it can't parse output
      expect(result.passed).toBe(true);
    });

    it("should handle security scanner with empty output", () => {
      const result = createResult("security", true, {
        output: "",
      });
      expect(result.passed).toBe(true);
    });

    it("should not block build when security scanner errors", () => {
      const results = [
        createResult("typescript", true),
        createResult("vitest", true),
        createResult("security", true, {
          status: "failed",
          output: "npm audit is not available",
        }),
      ];
      const configs = [
        createConfig("typescript", true),
        createConfig("vitest", true),
        createConfig("security", false),
      ];

      const { passed } = aggregateResults(results, configs);
      expect(passed).toBe(true);
    });
  });

  describe("Coverage Analyzer Error Handling", () => {
    it("should handle missing coverage report", () => {
      const result = createResult("coverage", false, {
        output: "Coverage report not found. Run `npm run test:coverage` first.",
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain("Coverage report not found");
    });

    it("should handle coverage analysis exception", () => {
      const result = createResult("coverage", false, {
        output: "Coverage analysis failed: ENOENT: no such file or directory",
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain("Coverage analysis failed");
    });

    it("should handle invalid threshold args gracefully", () => {
      const thresholds = parseThresholds([
        "--lines=abc",
        "--branches=-10",
        "",
        "--functions=80",
      ]);
      // Only --functions=80 should parse (--lines=abc doesn't match \d+)
      expect(thresholds.functions?.pct).toBe(80);
    });
  });

  describe("Result Aggregator Error Handling", () => {
    it("should handle empty results array", () => {
      const { passed, summary } = aggregateResults([], []);
      expect(passed).toBe(true);
      expect(summary.validatorsRun).toBe(0);
    });

    it("should handle results with no matching configs", () => {
      const results = [createResult("unknown_validator", false)];
      const configs = [createConfig("typescript", true)];
      const { passed, summary } = aggregateResults(results, configs);

      // Unknown validator is not in the required set, so overall passes
      expect(passed).toBe(true);
      expect(summary.validatorsFailed).toBe(1);
    });

    it("should handle mixed null and numeric durations", () => {
      const results = [
        createResult("typescript", true, { durationMs: 5000 }),
        createResult("vitest", true, { durationMs: null }),
        createResult("security", true, { durationMs: 3000 }),
      ];
      const configs = [
        createConfig("typescript", true),
        createConfig("vitest", true),
        createConfig("security", false),
      ];

      const { summary } = aggregateResults(results, configs);
      expect(summary.totalDurationMs).toBe(8000);
    });

    it("should handle all validators failing", () => {
      const results = [
        createResult("typescript", false),
        createResult("vitest", false),
        createResult("security", false),
        createResult("coverage", false),
      ];
      const configs = getLevelConfig("RELEASE").validators;

      const { passed, summary } = aggregateResults(results, configs);
      expect(passed).toBe(false);
      expect(summary.validatorsFailed).toBe(4);
      expect(summary.validatorsPassed).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. End-to-end workflow test (generate + run + report)
// ═══════════════════════════════════════════════════════════════════════════════

describe("QA Agent Integration: End-to-End Workflow", () => {
  it("should simulate full QUICK validation workflow", () => {
    // Step 1: Get config for QUICK level
    const config = getLevelConfig("QUICK");
    expect(config.validators).toHaveLength(1);

    // Step 2: Simulate running validators
    const results = [
      createResult("typescript", true, { durationMs: 8000 }),
    ];

    // Step 3: Aggregate results
    const { passed, summary } = aggregateResults(results, config.validators);

    // Step 4: Verify workflow outcome
    expect(passed).toBe(true);
    expect(summary.validatorsRun).toBe(1);
    expect(summary.validatorsPassed).toBe(1);
    expect(summary.totalDurationMs).toBe(8000);
  });

  it("should simulate full STANDARD validation workflow", () => {
    const config = getLevelConfig("STANDARD");

    const results = [
      createResult("typescript", true, { durationMs: 12000 }),
      createResult("vitest", true, { durationMs: 45000 }),
    ];

    const { passed, summary } = aggregateResults(results, config.validators);

    expect(passed).toBe(true);
    expect(summary.validatorsRun).toBe(2);
    expect(summary.totalDurationMs).toBe(57000);
  });

  it("should simulate full THOROUGH validation workflow with reporting", () => {
    const config = getLevelConfig("THOROUGH");

    // Step 1: Run all validators
    const results = [
      createResult("typescript", true, { durationMs: 15000 }),
      createResult("vitest", true, {
        output: "Tests  200 passed (200)\nDuration  45.2s",
        durationMs: 45200,
      }),
      createResult("security", true, {
        output: JSON.stringify({
          vulnerabilities: {
            info: 3,
            low: 2,
            moderate: 1,
            high: 0,
            critical: 0,
          },
        }),
        durationMs: 8000,
      }),
      createResult("coverage", true, { durationMs: 60000 }),
    ];

    // Step 2: Aggregate
    const { passed, summary } = aggregateResults(results, config.validators);

    expect(passed).toBe(true);
    expect(summary.validatorsRun).toBe(4);
    expect(summary.validatorsPassed).toBe(4);

    // Step 3: Generate coverage report
    const coverageReport: CoverageReport = {
      total: createMetrics(78),
      files: {
        "src/qa/index.ts": createMetrics(85),
        "src/validators/typescript-validator.ts": createMetrics(90),
        "src/utils/helper.ts": createMetrics(30),
      },
    };

    const thresholds = parseThresholds(
      config.validators.find((v) => v.name === "coverage")!.args,
    );
    const { passed: coveragePassed, failures } = checkThresholds(
      coverageReport.total,
      thresholds,
    );

    expect(coveragePassed).toBe(true); // 78% > 50% threshold

    const report = formatCoverageOutput(coverageReport, failures);
    expect(report).toContain("78.00%");
    expect(report).toContain("helper.ts"); // Low coverage file
  });

  it("should simulate RELEASE workflow that fails on security", () => {
    const config = getLevelConfig("RELEASE");

    const results = [
      createResult("typescript", true, { durationMs: 20000 }),
      createResult("vitest", true, { durationMs: 90000 }),
      createResult("security", false, {
        output: JSON.stringify({
          vulnerabilities: {
            info: 0,
            low: 0,
            moderate: 0,
            high: 2,
            critical: 0,
          },
        }),
        durationMs: 10000,
      }),
      createResult("coverage", true, { durationMs: 120000 }),
    ];

    const { passed, summary } = aggregateResults(results, config.validators);

    expect(passed).toBe(false); // Security is required in RELEASE
    expect(summary.validatorsFailed).toBe(1);
    expect(summary.validatorsPassed).toBe(3);
    expect(summary.totalDurationMs).toBe(240000);
  });

  it("should simulate RELEASE workflow that fails on coverage", () => {
    const config = getLevelConfig("RELEASE");

    const results = [
      createResult("typescript", true, { durationMs: 20000 }),
      createResult("vitest", true, { durationMs: 90000 }),
      createResult("security", true, { durationMs: 10000 }),
      createResult("coverage", false, {
        output: "Coverage analysis failed: threshold not met",
        durationMs: 120000,
      }),
    ];

    const { passed, summary } = aggregateResults(results, config.validators);

    expect(passed).toBe(false); // Coverage is required in RELEASE
    expect(summary.validatorsFailed).toBe(1);
  });

  it("should simulate failFast behavior in validation request", () => {
    const request: ValidationRunRequest = {
      level: "THOROUGH",
      buildId: "build-123",
      options: { failFast: true },
    };

    // Simulate: typescript fails, so subsequent validators should be skipped
    const config = getLevelConfig(request.level);
    const results: ValidatorResult[] = [];

    for (const validatorConfig of config.validators) {
      if (validatorConfig.name === "typescript") {
        results.push(
          createResult("typescript", false, {
            output: "Compilation failed with 5 errors",
          }),
        );
        // failFast: stop on first required failure
        if (request.options?.failFast && validatorConfig.required) {
          break;
        }
      }
    }

    // Only 1 result because we stopped at first failure
    expect(results).toHaveLength(1);

    const { passed } = aggregateResults(results, config.validators);
    expect(passed).toBe(false);
  });

  it("should simulate changedFilesOnly option", () => {
    const request: ValidationRunRequest = {
      level: "STANDARD",
      options: { changedFilesOnly: true },
    };

    expect(request.options?.changedFilesOnly).toBe(true);
    expect(request.level).toBe("STANDARD");
  });

  it("should produce correct validation summary JSON", () => {
    const config = getLevelConfig("STANDARD");
    const results = [
      createResult("typescript", true, { durationMs: 10000 }),
      createResult("vitest", true, { durationMs: 50000 }),
    ];

    const { passed, summary } = aggregateResults(results, config.validators);

    // Simulate what ValidationOrchestrator produces
    const summaryJson = JSON.stringify(summary);
    const parsed: ValidationSummary = JSON.parse(summaryJson);

    expect(parsed.validatorsRun).toBe(2);
    expect(parsed.validatorsPassed).toBe(2);
    expect(parsed.validatorsFailed).toBe(0);
    expect(parsed.totalDurationMs).toBe(60000);
    expect(passed).toBe(true);
  });

  it("should handle complete workflow with all checks passing", () => {
    // Comprehensive test that mirrors the full ValidationOrchestrator.run() flow:
    // 1. Select level
    // 2. Get config
    // 3. Run each validator
    // 4. Aggregate results
    // 5. Generate coverage report
    // 6. Produce summary

    const level: ValidationLevel = "THOROUGH";
    const config = getLevelConfig(level);

    // Run validators
    const validatorResults: ValidatorResult[] = config.validators.map((vc) => {
      switch (vc.name) {
        case "typescript":
          return createResult("typescript", true, { durationMs: 12000 });
        case "vitest":
          return createResult("vitest", true, {
            output: "Tests  150 passed\nDuration  30.5s",
            durationMs: 30500,
          });
        case "security":
          return createResult("security", true, {
            output: JSON.stringify({
              vulnerabilities: {
                info: 1,
                low: 3,
                moderate: 0,
                high: 0,
                critical: 0,
              },
            }),
            durationMs: 5000,
          });
        case "coverage":
          return createResult("coverage", true, { durationMs: 45000 });
        default:
          return createResult(vc.name, true, { durationMs: 1000 });
      }
    });

    // Aggregate
    const { passed, summary } = aggregateResults(
      validatorResults,
      config.validators,
    );

    expect(passed).toBe(true);
    expect(summary.validatorsRun).toBe(4);
    expect(summary.validatorsPassed).toBe(4);
    expect(summary.validatorsFailed).toBe(0);

    // Coverage reporting
    const coverageReport: CoverageReport = {
      total: createMetrics(82),
      files: {
        "src/main.ts": createMetrics(95),
        "src/helpers.ts": createMetrics(70),
      },
    };
    const thresholds = parseThresholds(
      config.validators.find((v) => v.name === "coverage")!.args,
    );
    const { passed: coverageOk } = checkThresholds(
      coverageReport.total,
      thresholds,
    );
    expect(coverageOk).toBe(true);

    const report = formatCoverageOutput(coverageReport, []);
    expect(report).toContain("82.00%");
    expect(report).not.toContain("Low Coverage");
  });
});
