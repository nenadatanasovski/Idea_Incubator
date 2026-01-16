// agents/validation/result-aggregator.ts

import {
  ValidatorResult,
  ValidationSummary,
  ValidatorConfig,
} from "../../types/validation.js";

export function aggregateResults(
  results: ValidatorResult[],
  validatorConfigs: ValidatorConfig[],
): { passed: boolean; summary: ValidationSummary } {
  const requiredValidators = new Set(
    validatorConfigs.filter((v) => v.required).map((v) => v.name),
  );

  let passed = true;
  let validatorsPassed = 0;
  let validatorsFailed = 0;
  let totalDurationMs = 0;

  for (const result of results) {
    totalDurationMs += result.durationMs || 0;

    if (result.passed) {
      validatorsPassed++;
    } else {
      validatorsFailed++;
      if (requiredValidators.has(result.validatorName)) {
        passed = false;
      }
    }
  }

  return {
    passed,
    summary: {
      validatorsRun: results.length,
      validatorsPassed,
      validatorsFailed,
      totalDurationMs,
    },
  };
}
