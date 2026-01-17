// agents/sia/index.ts - SIA main entry point
// OBS-108: ObservableSIA class now directly in this file per spec requirement

import { v4 as uuidv4 } from "uuid";
import { ObservableAgent } from "../../server/agents/observable-agent.js";
import {
  analyzeExecution,
  analyzeMultipleExecutions,
  getRecentCompletedBuilds,
} from "./execution-analyzer.js";
import { writeGotcha, writePattern } from "./knowledge-writer.js";
import { createProposal, isEligibleForPromotion } from "./claude-md-updater.js";
import { ExecutionAnalysis, KnowledgeEntry } from "../../types/sia.js";

// Re-export all SIA module components
export * from "./extraction-rules.js";
export * from "./gotcha-extractor.js";
export * from "./pattern-extractor.js";
export * from "./duplicate-detector.js";
export * from "./confidence-tracker.js";
export * from "./knowledge-writer.js";
export * from "./execution-analyzer.js";
export * from "./claude-md-updater.js";
export * from "./db.js";

// ============================================================================
// OBS-108: ObservableSIA class - Self-Improvement Agent with unified observability
// ============================================================================

export interface SIAAnalysisOptions {
  executionId?: string;
  executionIds?: string[];
  autoWriteKnowledge?: boolean;
  autoCreateProposals?: boolean;
}

export interface SIAAnalysisResult {
  analyses: ExecutionAnalysis[];
  knowledgeWritten: number;
  proposalsCreated: number;
  errors: string[];
}

/**
 * Observable Self-Improvement Agent
 * OBS-108: SIA extends ObservableAgent for unified observability (per spec requirement)
 *
 * The SIA analyzes build executions to extract:
 * - Gotchas: Common mistakes and their fixes
 * - Patterns: Successful approaches that should be reused
 *
 * These learnings are written to the Knowledge Base and can be promoted to CLAUDE.md
 */
export class ObservableSIA extends ObservableAgent {
  constructor() {
    // OBS-108: Initialize observability base class
    const executionId = `sia-${uuidv4().slice(0, 8)}`;
    const instanceId = `sia-agent-${uuidv4().slice(0, 8)}`;
    super({
      executionId,
      instanceId,
      agentType: "sia",
    });
  }

  /**
   * Analyze a single execution and extract learnings
   * OBS-108: Full observability integration
   */
  async analyzeSingleExecution(
    executionId: string,
    options: SIAAnalysisOptions = {},
  ): Promise<SIAAnalysisResult> {
    const taskId = `sia-analyze-${executionId}`;
    const errors: string[] = [];

    // OBS-108: Log task start
    await this.logTaskStart(taskId, `Analyze execution ${executionId}`);

    try {
      // OBS-108: Phase 1 - Load and analyze
      await this.logPhaseStart("analyze", { executionId });

      const analysis = await analyzeExecution(executionId);

      await this.logPhaseEnd("analyze", {
        totalTasks: analysis.totalTasks,
        successfulTasks: analysis.successfulTasks,
        failedTasks: analysis.failedTasks,
        gotchasFound: analysis.extractedGotchas.length,
        patternsFound: analysis.extractedPatterns.length,
      });

      // OBS-108: Phase 2 - Write knowledge (if enabled)
      let knowledgeWritten = 0;
      const writtenEntries: KnowledgeEntry[] = [];

      if (options.autoWriteKnowledge !== false) {
        await this.logPhaseStart("knowledge", {
          gotchaCount: analysis.extractedGotchas.length,
          patternCount: analysis.extractedPatterns.length,
        });

        // Write gotchas as knowledge entries
        for (const gotcha of analysis.extractedGotchas) {
          try {
            const entry = await writeGotcha(gotcha, executionId, "sia");
            knowledgeWritten++;
            writtenEntries.push(entry);

            // OBS-108: Log discovery
            await this.logDiscovery(
              "gotcha",
              gotcha.fix,
              entry.confidence,
              taskId,
              { filePattern: gotcha.filePattern },
            );
          } catch (error) {
            errors.push(
              `Failed to write gotcha: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Write patterns as knowledge entries
        for (const pattern of analysis.extractedPatterns) {
          try {
            const entry = await writePattern(pattern, executionId, "sia");
            knowledgeWritten++;
            writtenEntries.push(entry);

            // OBS-108: Log discovery
            await this.logDiscovery(
              "pattern",
              pattern.description,
              entry.confidence,
              taskId,
              { filePattern: pattern.filePattern },
            );
          } catch (error) {
            errors.push(
              `Failed to write pattern: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        await this.logPhaseEnd("knowledge", { written: knowledgeWritten });
      }

      // OBS-108: Phase 3 - Create CLAUDE.md proposals (if enabled)
      let proposalsCreated = 0;
      if (options.autoCreateProposals && writtenEntries.length > 0) {
        await this.logPhaseStart("proposals");

        for (const entry of writtenEntries) {
          if (isEligibleForPromotion(entry)) {
            try {
              await createProposal(entry);
              proposalsCreated++;
            } catch (error) {
              errors.push(
                `Failed to create proposal: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        await this.logPhaseEnd("proposals", { created: proposalsCreated });
      }

      // OBS-108: Start assertion chain for SIA analysis
      const chainId = await this.startAssertionChain(
        taskId,
        `SIA Analysis: ${executionId}`,
      );

      // Record assertion for execution analysis
      await this.assertManual(
        taskId,
        "analysis",
        `Execution ${executionId} analyzed`,
        true,
        {
          totalTasks: analysis.totalTasks,
          gotchasExtracted: analysis.extractedGotchas.length,
          patternsExtracted: analysis.extractedPatterns.length,
        },
      );

      // Record assertion for knowledge writing
      await this.assertManual(
        taskId,
        "knowledge",
        `Knowledge entries written`,
        knowledgeWritten > 0 || analysis.extractedGotchas.length === 0,
        { written: knowledgeWritten },
      );

      await this.endAssertionChain(chainId);

      // OBS-108: Log task completion
      await this.logTaskEnd(taskId, "complete", {
        analysisCount: 1,
        knowledgeWritten,
        proposalsCreated,
        errorCount: errors.length,
      });

      return {
        analyses: [analysis],
        knowledgeWritten,
        proposalsCreated,
        errors,
      };
    } catch (error) {
      // OBS-108: Log error
      await this.logError(
        error instanceof Error ? error.message : String(error),
        taskId,
      );
      await this.logTaskEnd(taskId, "failed");
      throw error;
    } finally {
      // OBS-108: Cleanup
      await this.close();
    }
  }

  /**
   * Analyze multiple executions and aggregate learnings
   * OBS-108: Full observability integration
   */
  async analyzeMultiple(
    executionIds: string[],
    options: SIAAnalysisOptions = {},
  ): Promise<SIAAnalysisResult> {
    const taskId = `sia-batch-${uuidv4().slice(0, 8)}`;
    const errors: string[] = [];

    // OBS-108: Log task start
    await this.logTaskStart(
      taskId,
      `Analyze ${executionIds.length} executions`,
    );

    try {
      // OBS-108: Phase 1 - Analyze all executions
      await this.logPhaseStart("analyze", { count: executionIds.length });

      const { analyses, aggregatedGotchas, aggregatedPatterns } =
        await analyzeMultipleExecutions(executionIds);

      await this.logPhaseEnd("analyze", {
        analyzedCount: analyses.length,
        aggregatedGotchas: aggregatedGotchas.length,
        aggregatedPatterns: aggregatedPatterns.length,
      });

      // OBS-108: Phase 2 - Write aggregated knowledge
      let knowledgeWritten = 0;
      if (options.autoWriteKnowledge !== false) {
        await this.logPhaseStart("knowledge", {
          gotchaCount: aggregatedGotchas.length,
          patternCount: aggregatedPatterns.length,
        });

        for (const gotcha of aggregatedGotchas) {
          try {
            await writeGotcha(gotcha, `batch:${executionIds.length}`, "sia");
            knowledgeWritten++;
          } catch (error) {
            errors.push(
              `Failed to write gotcha: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        for (const pattern of aggregatedPatterns) {
          try {
            await writePattern(pattern, `batch:${executionIds.length}`, "sia");
            knowledgeWritten++;
          } catch (error) {
            errors.push(
              `Failed to write pattern: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        await this.logPhaseEnd("knowledge", { written: knowledgeWritten });
      }

      // OBS-108: Log task completion
      await this.logTaskEnd(taskId, "complete", {
        analysisCount: analyses.length,
        knowledgeWritten,
        errorCount: errors.length,
      });

      return {
        analyses,
        knowledgeWritten,
        proposalsCreated: 0,
        errors,
      };
    } catch (error) {
      // OBS-108: Log error
      await this.logError(
        error instanceof Error ? error.message : String(error),
        taskId,
      );
      await this.logTaskEnd(taskId, "failed");
      throw error;
    } finally {
      // OBS-108: Cleanup
      await this.close();
    }
  }

  /**
   * Analyze recent completed builds
   * OBS-108: Convenience method with observability
   */
  async analyzeRecentBuilds(
    limit: number = 10,
    options: SIAAnalysisOptions = {},
  ): Promise<SIAAnalysisResult> {
    // OBS-108: Log phase for fetching builds
    await this.logPhaseStart("fetch", { limit });

    const builds = await getRecentCompletedBuilds(limit);
    const executionIds = builds.map((b) => b.id);

    await this.logPhaseEnd("fetch", { found: executionIds.length });

    if (executionIds.length === 0) {
      return {
        analyses: [],
        knowledgeWritten: 0,
        proposalsCreated: 0,
        errors: [],
      };
    }

    return this.analyzeMultiple(executionIds, options);
  }
}

/**
 * Create an observable SIA instance
 */
export function createObservableSIA(): ObservableSIA {
  return new ObservableSIA();
}

// Also export as SIA for shorter name
export { ObservableSIA as SIA };
