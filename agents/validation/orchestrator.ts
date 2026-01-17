// agents/validation/orchestrator.ts
// OBS-106: Extended ObservableAgent for unified observability

import { v4 as uuid } from "uuid";
import {
  ValidationRun,
  ValidatorResult,
  ValidationRunRequest,
} from "../../types/validation";
import { getLevelConfig } from "./level-configs";
import { runTypescriptValidator } from "./validators/typescript-validator";
import { runTestRunner } from "./validators/test-runner";
import { runSecurityScanner } from "./validators/security-scanner";
import { runCoverageAnalyzer } from "./validators/coverage-analyzer";
import { aggregateResults } from "./result-aggregator";
import { ObservableAgent } from "../../server/agents/observable-agent.js";

type ValidatorFunction = (
  runId: string,
  args: string[],
  timeoutMs: number,
) => Promise<ValidatorResult>;

const VALIDATOR_MAP: Record<string, ValidatorFunction> = {
  typescript: runTypescriptValidator,
  vitest: runTestRunner,
  security: runSecurityScanner,
  coverage: runCoverageAnalyzer,
};

/**
 * OBS-106: ValidationOrchestrator extends ObservableAgent for unified observability
 */
export class ValidationOrchestrator extends ObservableAgent {
  constructor() {
    // OBS-106: Initialize ObservableAgent base class
    const executionId = `validation-${uuid().slice(0, 8)}`;
    const instanceId = `validation-agent-${uuid().slice(0, 8)}`;
    super({
      executionId,
      instanceId,
      agentType: "validation-agent",
    });
  }

  async run(request: ValidationRunRequest): Promise<{
    run: ValidationRun;
    results: ValidatorResult[];
  }> {
    const runId = uuid();
    const taskId = `validation-${runId.slice(0, 8)}`;
    const config = getLevelConfig(request.level);
    const startedAt = new Date().toISOString();

    // OBS-106: Log task start
    await this.logTaskStart(taskId, `Validation Level ${request.level}`, {
      level: request.level,
      buildId: request.buildId,
      validatorCount: config.validators.length,
    });

    // OBS-106: Start assertion chain for validation
    const chainId = await this.startAssertionChain(
      taskId,
      `Validation Suite: Level ${request.level}`,
    );

    const results: ValidatorResult[] = [];

    try {
      for (const validatorConfig of config.validators) {
        const validator = VALIDATOR_MAP[validatorConfig.name];
        if (validator) {
          // OBS-106: Log phase for each validator
          await this.logPhaseStart(validatorConfig.name, {
            required: validatorConfig.required,
            timeoutMs: validatorConfig.timeoutMs,
          });

          const result = await validator(
            runId,
            validatorConfig.args,
            validatorConfig.timeoutMs,
          );
          results.push(result);

          // OBS-106: Record assertion for each validator
          await this.assertManual(
            taskId,
            "validator",
            `${validatorConfig.name} validator`,
            result.passed ?? false,
            {
              validatorName: validatorConfig.name,
              required: validatorConfig.required,
              output: result.output?.substring(0, 500),
            },
          );

          await this.logPhaseEnd(validatorConfig.name, {
            passed: result.passed,
            outputLength: result.output?.length || 0,
          });

          // Fail fast if required validator fails and option set
          if (
            request.options?.failFast &&
            !result.passed &&
            validatorConfig.required
          ) {
            break;
          }
        }
      }

      const { passed, summary } = aggregateResults(results, config.validators);

      // OBS-106: End assertion chain
      const chainResult = await this.endAssertionChain(chainId);

      const run: ValidationRun = {
        id: runId,
        buildId: request.buildId || null,
        level: request.level,
        status: "completed",
        passed,
        startedAt,
        completedAt: new Date().toISOString(),
        summaryJson: JSON.stringify(summary),
      };

      // OBS-106: Log task completion
      await this.logTaskEnd(taskId, passed ? "complete" : "failed", {
        passed,
        validatorsRun: results.length,
        assertionsPassed: chainResult?.passCount,
        assertionsFailed: chainResult?.failCount,
      });

      return { run, results };
    } catch (error) {
      // OBS-106: Log error
      await this.logError(
        error instanceof Error ? error.message : String(error),
        taskId,
      );
      await this.endAssertionChain(chainId);
      await this.logTaskEnd(taskId, "failed");
      throw error;
    } finally {
      // OBS-106: Cleanup
      await this.close();
    }
  }
}
