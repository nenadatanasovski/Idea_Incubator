// agents/validation/orchestrator.ts

import { v4 as uuid } from 'uuid';
import { ValidationRun, ValidatorResult, ValidationRunRequest } from '../../types/validation';
import { getLevelConfig } from './level-configs';
import { runTypescriptValidator } from './validators/typescript-validator';
import { runTestRunner } from './validators/test-runner';
import { runSecurityScanner } from './validators/security-scanner';
import { runCoverageAnalyzer } from './validators/coverage-analyzer';
import { aggregateResults } from './result-aggregator';

type ValidatorFunction = (runId: string, args: string[], timeoutMs: number) => Promise<ValidatorResult>;

const VALIDATOR_MAP: Record<string, ValidatorFunction> = {
  typescript: runTypescriptValidator,
  vitest: runTestRunner,
  security: runSecurityScanner,
  coverage: runCoverageAnalyzer,
};

export class ValidationOrchestrator {
  async run(request: ValidationRunRequest): Promise<{
    run: ValidationRun;
    results: ValidatorResult[];
  }> {
    const runId = uuid();
    const config = getLevelConfig(request.level);
    const startedAt = new Date().toISOString();

    const results: ValidatorResult[] = [];

    for (const validatorConfig of config.validators) {
      const validator = VALIDATOR_MAP[validatorConfig.name];
      if (validator) {
        const result = await validator(
          runId,
          validatorConfig.args,
          validatorConfig.timeoutMs
        );
        results.push(result);

        // Fail fast if required validator fails and option set
        if (request.options?.failFast && !result.passed && validatorConfig.required) {
          break;
        }
      }
    }

    const { passed, summary } = aggregateResults(results, config.validators);

    const run: ValidationRun = {
      id: runId,
      buildId: request.buildId || null,
      level: request.level,
      status: 'completed',
      passed,
      startedAt,
      completedAt: new Date().toISOString(),
      summaryJson: JSON.stringify(summary),
    };

    return { run, results };
  }
}
