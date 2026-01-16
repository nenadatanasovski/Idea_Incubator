// tests/validation-agent.test.ts

import { describe, it, expect } from "vitest";
import {
  getLevelConfig,
  LEVEL_CONFIGS,
} from "../agents/validation/level-configs.js";
import { aggregateResults } from "../agents/validation/result-aggregator.js";
import { ValidatorResult, ValidatorConfig } from "../types/validation.js";
import {
  parseThresholds,
  checkThresholds,
  formatCoverageOutput,
  CoverageMetrics,
  CoverageReport,
} from "../agents/validation/validators/coverage-analyzer.js";

describe("Validation Agent", () => {
  describe("Level Configs", () => {
    it("should have 4 validation levels", () => {
      expect(Object.keys(LEVEL_CONFIGS)).toHaveLength(4);
    });

    it("should return correct config for QUICK level", () => {
      const config = getLevelConfig("QUICK");
      expect(config.level).toBe("QUICK");
      expect(config.timeBudgetMs).toBe(30000);
      expect(config.validators).toHaveLength(1);
      expect(config.validators[0].name).toBe("typescript");
    });

    it("should return correct config for STANDARD level", () => {
      const config = getLevelConfig("STANDARD");
      expect(config.level).toBe("STANDARD");
      expect(config.timeBudgetMs).toBe(120000);
      expect(config.validators).toHaveLength(2);
    });

    it("should return correct config for THOROUGH level", () => {
      const config = getLevelConfig("THOROUGH");
      expect(config.level).toBe("THOROUGH");
      expect(config.validators).toHaveLength(4); // typescript, vitest, security, coverage
    });

    it("should return correct config for RELEASE level", () => {
      const config = getLevelConfig("RELEASE");
      expect(config.level).toBe("RELEASE");
      expect(config.timeBudgetMs).toBe(0); // No limit
      expect(config.validators).toHaveLength(4); // typescript, vitest, security, coverage
    });
  });

  describe("Result Aggregator", () => {
    const createResult = (
      name: string,
      passed: boolean,
      durationMs: number = 1000,
    ): ValidatorResult => ({
      id: `id-${name}`,
      runId: "run-1",
      validatorName: name,
      status: "completed",
      passed,
      output: "",
      durationMs,
      createdAt: new Date().toISOString(),
    });

    const createConfig = (
      name: string,
      required: boolean,
    ): ValidatorConfig => ({
      name,
      command: "",
      args: [],
      required,
      timeoutMs: 1000,
    });

    it("should pass when all required validators pass", () => {
      const results = [
        createResult("typescript", true, 1000),
        createResult("vitest", true, 2000),
      ];
      const configs = [
        createConfig("typescript", true),
        createConfig("vitest", true),
      ];

      const { passed, summary } = aggregateResults(results, configs);
      expect(passed).toBe(true);
      expect(summary.validatorsPassed).toBe(2);
      expect(summary.validatorsFailed).toBe(0);
      expect(summary.totalDurationMs).toBe(3000);
    });

    it("should fail when required validator fails", () => {
      const results = [createResult("typescript", false, 1000)];
      const configs = [createConfig("typescript", true)];

      const { passed, summary } = aggregateResults(results, configs);
      expect(passed).toBe(false);
      expect(summary.validatorsFailed).toBe(1);
    });

    it("should pass when optional validator fails", () => {
      const results = [
        createResult("typescript", true, 1000),
        createResult("security", false, 500),
      ];
      const configs = [
        createConfig("typescript", true),
        createConfig("security", false),
      ];

      const { passed, summary } = aggregateResults(results, configs);
      expect(passed).toBe(true);
      expect(summary.validatorsPassed).toBe(1);
      expect(summary.validatorsFailed).toBe(1);
    });

    it("should fail when one of multiple required validators fails", () => {
      const results = [
        createResult("typescript", true, 1000),
        createResult("vitest", false, 2000),
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

    it("should calculate total duration correctly", () => {
      const results = [
        createResult("typescript", true, 5000),
        createResult("vitest", true, 10000),
        createResult("security", true, 3000),
      ];
      const configs = [
        createConfig("typescript", true),
        createConfig("vitest", true),
        createConfig("security", false),
      ];

      const { summary } = aggregateResults(results, configs);
      expect(summary.totalDurationMs).toBe(18000);
      expect(summary.validatorsRun).toBe(3);
    });

    it("should handle empty results", () => {
      const { passed, summary } = aggregateResults([], []);
      expect(passed).toBe(true);
      expect(summary.validatorsRun).toBe(0);
      expect(summary.validatorsPassed).toBe(0);
      expect(summary.validatorsFailed).toBe(0);
    });
  });

  describe("Coverage Analyzer", () => {
    const createMetrics = (pct: number): CoverageMetrics => ({
      lines: { total: 100, covered: pct, skipped: 0, pct },
      statements: { total: 100, covered: pct, skipped: 0, pct },
      branches: { total: 50, covered: pct / 2, skipped: 0, pct },
      functions: { total: 20, covered: pct / 5, skipped: 0, pct },
    });

    describe("parseThresholds", () => {
      it("should parse line threshold", () => {
        const thresholds = parseThresholds(["--lines=80"]);
        expect(thresholds.lines?.pct).toBe(80);
      });

      it("should parse multiple thresholds", () => {
        const thresholds = parseThresholds([
          "--lines=80",
          "--branches=70",
          "--functions=75",
        ]);
        expect(thresholds.lines?.pct).toBe(80);
        expect(thresholds.branches?.pct).toBe(70);
        expect(thresholds.functions?.pct).toBe(75);
      });

      it("should ignore invalid args", () => {
        const thresholds = parseThresholds(["--invalid=50", "not-a-flag"]);
        expect(Object.keys(thresholds)).toHaveLength(0);
      });
    });

    describe("checkThresholds", () => {
      it("should pass when all thresholds are met", () => {
        const metrics = createMetrics(85);
        const thresholds = parseThresholds(["--lines=80", "--branches=80"]);
        const { passed, failures } = checkThresholds(metrics, thresholds);
        expect(passed).toBe(true);
        expect(failures).toHaveLength(0);
      });

      it("should fail when threshold not met", () => {
        const metrics = createMetrics(70);
        const thresholds = parseThresholds(["--lines=80"]);
        const { passed, failures } = checkThresholds(metrics, thresholds);
        expect(passed).toBe(false);
        expect(failures).toHaveLength(1);
        expect(failures[0]).toContain("Lines");
        expect(failures[0]).toContain("70%");
        expect(failures[0]).toContain("80%");
      });

      it("should pass with no thresholds", () => {
        const metrics = createMetrics(50);
        const { passed, failures } = checkThresholds(metrics, {});
        expect(passed).toBe(true);
        expect(failures).toHaveLength(0);
      });
    });

    describe("formatCoverageOutput", () => {
      it("should format coverage summary", () => {
        const report: CoverageReport = {
          total: createMetrics(75),
          files: {},
        };
        const output = formatCoverageOutput(report, []);
        expect(output).toContain("Lines:");
        expect(output).toContain("75.00%");
        expect(output).toContain("Statements:");
        expect(output).toContain("Branches:");
        expect(output).toContain("Functions:");
      });

      it("should include threshold failures", () => {
        const report: CoverageReport = {
          total: createMetrics(70),
          files: {},
        };
        const failures = ["Lines: 70% < 80% threshold"];
        const output = formatCoverageOutput(report, failures);
        expect(output).toContain("Threshold Failures");
        expect(output).toContain("Lines: 70% < 80% threshold");
      });

      it("should list low coverage files", () => {
        const report: CoverageReport = {
          total: createMetrics(75),
          files: {
            "src/lowCoverage.ts": createMetrics(30),
            "src/highCoverage.ts": createMetrics(90),
          },
        };
        const output = formatCoverageOutput(report, []);
        expect(output).toContain("Low Coverage");
        expect(output).toContain("lowCoverage.ts");
        expect(output).not.toContain("highCoverage.ts");
      });
    });

    describe("Level Configs with Coverage", () => {
      it("THOROUGH level should include coverage validator", () => {
        const config = getLevelConfig("THOROUGH");
        const coverageValidator = config.validators.find(
          (v) => v.name === "coverage",
        );
        expect(coverageValidator).toBeDefined();
        expect(coverageValidator?.required).toBe(false);
      });

      it("RELEASE level should require coverage", () => {
        const config = getLevelConfig("RELEASE");
        const coverageValidator = config.validators.find(
          (v) => v.name === "coverage",
        );
        expect(coverageValidator).toBeDefined();
        expect(coverageValidator?.required).toBe(true);
      });
    });
  });
});
