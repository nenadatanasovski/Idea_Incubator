#!/usr/bin/env tsx
/**
 * Evaluation CLI Command
 * Runs AI evaluation on an idea against 30 criteria
 */
import "dotenv/config";
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import {
  logInfo,
  logSuccess,
  logError,
  logWarning,
  logDebug,
} from "../utils/logger.js";
import { query, run, saveDb, closeDb } from "../database/db.js";
import { runMigrations } from "../database/migrate.js";
import { CostTracker } from "../utils/cost-tracker.js";
import { getConfig, updateConfig } from "../config/index.js";
import {
  evaluateIdea,
  formatEvaluationResults,
  type FullEvaluationResult,
  type StructuredEvaluationContext,
  type StructuredAnswerData,
  type PositioningRiskContext,
  type StrategicPositioningContext,
} from "../agents/evaluator.js";
import {
  getAnswersForIdea,
  calculateReadiness,
  calculateCriterionCoverage,
} from "../questions/readiness.js";
import { getQuestionsByIds } from "../questions/loader.js";
import { runAllSpecializedEvaluators } from "../agents/specialized-evaluators.js";
import {
  determineEvaluationFlow,
  estimateEvaluationCost,
  formatCostEstimate,
} from "../agents/orchestrator.js";
import { CATEGORIES, interpretScore } from "../agents/config.js";
import {
  runFullDebate,
  formatDebateResults,
  type FullDebateResult,
} from "../agents/debate.js";
import { createHash, randomUUID } from "crypto";
import { createBroadcaster } from "../utils/broadcast.js";
import { getEvaluationProfileContext } from "./profile.js";
import { extractClaimsFromContent } from "../utils/claims-extractor.js";
import {
  conductPreEvaluationResearch,
  shouldSkipResearch,
  type ResearchResult,
  type CreatorLocation,
} from "../agents/research.js";

const program = new Command();

program
  .name("evaluate")
  .description("Run AI evaluation on an idea")
  .argument("<slug>", "Idea slug to evaluate")
  .option("-b, --budget <amount>", "Budget in dollars", "15")
  .option("-f, --force", "Force re-evaluation even if not stale")
  .option(
    "-m, --mode <mode>",
    "Evaluator mode: v1 (sequential) or v2 (parallel)",
    "v2",
  )
  .option("--skip-debate", "Skip debate phase (initial evaluation only)")
  .option(
    "--unlimited",
    "Disable budget limits (run to completion regardless of cost)",
  )
  .option(
    "--debate-rounds <rounds>",
    "Number of debate rounds per criterion (1-3)",
    "1",
  )
  .option("--dry-run", "Show what would happen without running")
  .option("-v, --verbose", "Show detailed output")
  .option("--run-id <id>", "Use a specific run ID (for API integration)")
  .action(async (slug, options) => {
    // Set a maximum execution time failsafe (30 minutes)
    // Full evaluations with debates can take 15-20 minutes
    // This ensures the process exits even if something keeps the event loop alive
    const maxExecutionTimeout = setTimeout(
      () => {
        console.error(
          "\n[FAILSAFE] Maximum execution time exceeded (30 minutes), forcing exit",
        );
        process.exit(0);
      },
      30 * 60 * 1000,
    );
    maxExecutionTimeout.unref(); // Don't prevent exit if everything else completes

    try {
      await runMigrations();

      if (options.verbose) {
        updateConfig({ logging: { level: "debug", transport: "console" } });
      }

      // Set budget
      const budget = parseFloat(options.budget);
      const unlimited = Boolean(options.unlimited);
      if (!unlimited && (isNaN(budget) || budget <= 0)) {
        logError(
          "Invalid budget",
          new Error("Budget must be a positive number"),
        );
        process.exit(1);
      }

      // Set debate rounds (1-3)
      const debateRounds = Math.min(
        3,
        Math.max(1, parseInt(options.debateRounds) || 1),
      );
      if (debateRounds !== 3) {
        // Only update if not using default config value
        updateConfig({
          debate: {
            ...getConfig().debate,
            roundsPerChallenge: debateRounds,
          },
        });
      }

      logInfo(`Starting evaluation for: ${slug}`);
      if (unlimited) {
        logWarning(
          "UNLIMITED MODE: Budget limits disabled. This could result in significant charges.",
        );
      } else {
        logInfo(`Budget: $${budget.toFixed(2)}`);
      }
      logInfo(`Debate rounds per criterion: ${debateRounds}`);

      // Check if idea exists
      const idea = await query<{
        id: string;
        slug: string;
        title: string;
        folder_path: string;
        lifecycle_stage: string;
        content_hash: string | null;
      }>("SELECT * FROM ideas WHERE slug = ?", [slug]);

      if (idea.length === 0) {
        logError("Idea not found", new Error(`No idea with slug: ${slug}`));
        process.exit(1);
      }

      const ideaData = idea[0];
      logInfo(`Found: "${ideaData.title}" (${ideaData.lifecycle_stage})`);

      // Use provided run ID or generate a new one for WebSocket broadcasting
      const runId = options.runId || randomUUID();
      const broadcaster = createBroadcaster(slug, runId);

      // Notify clients that evaluation is starting
      await broadcaster.started(`Starting evaluation for "${ideaData.title}"`);

      // Determine evaluation flow
      const flowState = await determineEvaluationFlow(slug);

      if (
        flowState.hasExistingEvaluation &&
        !flowState.isStale &&
        !options.force
      ) {
        logWarning(
          `Idea was already evaluated on ${flowState.lastEvaluatedAt}`,
        );
        logInfo("Use --force to re-evaluate");

        // Show existing scores
        await showExistingEvaluation(ideaData.id);
        await closeDb();
        return;
      }

      if (flowState.isStale) {
        logWarning(
          "Idea has been modified since last evaluation. Re-evaluating...",
        );
      }

      // Show cost estimate
      const costEstimate = estimateEvaluationCost();
      console.log("\n" + formatCostEstimate(costEstimate));

      if (costEstimate.total > budget) {
        logWarning(
          `Estimated cost ($${costEstimate.total.toFixed(2)}) exceeds budget ($${budget.toFixed(2)})`,
        );
        if (!options.force) {
          logInfo("Use --force to proceed anyway, or increase --budget");
          await closeDb();
          return;
        }
      }

      if (options.dryRun) {
        logInfo("Dry run - would evaluate the idea with the above parameters");
        await closeDb();
        return;
      }

      // Read idea content
      const readmePath = path.join(ideaData.folder_path, "README.md");
      if (!fs.existsSync(readmePath)) {
        logError("Idea README not found", new Error(`Missing: ${readmePath}`));
        process.exit(1);
      }

      let ideaContent = fs.readFileSync(readmePath, "utf-8");
      
      // CRITICAL FIX: Include development.md content if it exists
      // This ensures Q&A from /idea-develop sessions is visible to evaluators
      const developmentPath = path.join(ideaData.folder_path, "development.md");
      if (fs.existsSync(developmentPath)) {
        const developmentContent = fs.readFileSync(developmentPath, "utf-8");
        // Append development notes to idea content
        ideaContent += "\n\n---\n\n# Development Notes\n\n" + developmentContent;
        logInfo("Loaded development.md - Q&A context included in evaluation");
      }
      
      const contentHash = createHash("md5").update(ideaContent).digest("hex");

      // Fetch user profile context for Personal Fit evaluation
      const profileContext = await getEvaluationProfileContext(ideaData.id);
      if (profileContext) {
        logInfo(
          "Found user profile - Personal Fit criteria will be evaluated with full context",
        );
      } else {
        logWarning(
          "No user profile linked - Personal Fit scores will have low confidence",
        );
        logInfo(
          "Link a profile with: npm run profile link " +
            slug +
            " <profile-slug>",
        );
      }

      // Fetch structured answers context from dynamic questioning
      const structuredContext = await getStructuredContext(ideaData.id);
      if (structuredContext && structuredContext.coverage.overall > 0) {
        logInfo(
          `Found structured answers - Coverage: ${Math.round(structuredContext.coverage.overall * 100)}%`,
        );
      } else {
        logInfo(
          "No structured answers available - evaluation will rely on idea content",
        );
        logInfo("Develop the idea with: /idea-develop " + slug);
      }

      // Initialize cost tracker with model-aware pricing
      const config = getConfig();
      const costTracker = new CostTracker(
        budget,
        unlimited,
        undefined,
        config.model,
      );

      // Set up API call callback to broadcast individual API calls with request/response data
      costTracker.setApiCallCallback(
        (operation, inputTokens, outputTokens, cost, request, response) => {
          broadcaster.apiCall(
            operation,
            inputTokens,
            outputTokens,
            cost,
            request,
            response,
          );
        },
      );

      // Validate mode
      const mode = options.mode as "v1" | "v2";
      if (mode !== "v1" && mode !== "v2") {
        logError("Invalid mode", new Error("Mode must be v1 or v2"));
        process.exit(1);
      }

      // Pre-evaluation research phase (for Market and Solution verification)
      let research: ResearchResult | null = null;
      if (!shouldSkipResearch()) {
        console.log("\n--- Starting Research Phase ---\n");

        // Extract creator location from profile for geographic market analysis
        let creatorLocation: CreatorLocation | undefined;
        if (profileContext?.profile?.country) {
          creatorLocation = {
            country: profileContext.profile.country,
            city: profileContext.profile.city,
          };
          logInfo(
            `Creator location: ${creatorLocation.city ? creatorLocation.city + ", " : ""}${creatorLocation.country}`,
          );
        }

        try {
          const userClaims = await extractClaimsFromContent(
            ideaContent,
            costTracker,
          );
          logInfo(
            `Extracted claims: domain="${userClaims.domain}", ${userClaims.competitors.length} competitors, tech: ${userClaims.technology.join(", ")}`,
          );

          research = await conductPreEvaluationResearch(
            ideaContent,
            userClaims,
            costTracker,
            creatorLocation,
          );

          if (research.competitors.discovered.length > 0) {
            logInfo(
              `Research found ${research.competitors.discovered.length} additional competitors`,
            );
          }
          if (research.marketSize.verified) {
            logInfo(`Market size verified: ${research.marketSize.verified}`);
          }
          if (research.techFeasibility.assessment !== "unknown") {
            logInfo(`Tech feasibility: ${research.techFeasibility.assessment}`);
          }

          // Log geographic analysis if available
          if (research.geographicAnalysis) {
            const geo = research.geographicAnalysis;
            if (geo.localMarket?.marketSize.tam) {
              logInfo(
                `Local market (${geo.creatorLocation?.country || "Unknown"}): TAM ${geo.localMarket.marketSize.tam}`,
              );
            }
            if (geo.globalMarket?.marketSize.tam) {
              logInfo(`Global market: TAM ${geo.globalMarket.marketSize.tam}`);
            }
          }

          console.log(
            `Research phase completed (${research.searchesPerformed} searches)\n`,
          );
        } catch (researchError) {
          logWarning("Research phase failed, proceeding without external data");
          logDebug(`Research error: ${researchError}`);
        }
      } else {
        logInfo("Skipping research phase (web search unavailable)");
      }

      // Load full positioning context from Position phase
      let positioningContext: PositioningRiskContext | null = null;
      let strategicContext: StrategicPositioningContext | null = null;

      // Load positioning decisions (strategy selection, timing, approach)
      const positioningDecision = await query<{
        primary_strategy_id: string | null;
        primary_strategy_name: string | null;
        timing_decision: string | null;
        timing_rationale: string | null;
        selected_approach: string | null;
        risk_responses: string | null;
        risk_response_stats: string | null;
        notes: string | null;
      }>(
        `SELECT primary_strategy_id, primary_strategy_name, timing_decision, timing_rationale,
                 selected_approach, risk_responses, risk_response_stats, notes
          FROM positioning_decisions WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1`,
        [ideaData.id],
      );

      // Load financial allocation
      const financialAllocation = await query<{
        allocated_budget: number | null;
        allocated_weekly_hours: number | null;
        allocated_runway_months: number | null;
        target_income_from_idea: number | null;
        income_timeline_months: number | null;
        income_type: string | null;
        validation_budget: number | null;
        kill_criteria: string | null;
        strategic_approach: string | null;
      }>(
        `SELECT allocated_budget, allocated_weekly_hours, allocated_runway_months,
                 target_income_from_idea, income_timeline_months, income_type,
                 validation_budget, kill_criteria, strategic_approach
          FROM idea_financial_allocations WHERE idea_id = ?`,
        [ideaData.id],
      );

      // Load differentiation results (for market opportunities and competitive risks)
      const diffResults = await query<{
        opportunities: string | null;
        competitive_risks: string | null;
        market_timing_analysis: string | null;
        strategic_summary: string | null;
      }>(
        `SELECT opportunities, competitive_risks, market_timing_analysis, strategic_summary
          FROM differentiation_results WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1`,
        [ideaData.id],
      );

      // Build risk context (for backward compatibility)
      if (
        positioningDecision.length > 0 &&
        positioningDecision[0].risk_responses
      ) {
        try {
          positioningContext = {
            riskResponses: JSON.parse(positioningDecision[0].risk_responses),
            riskResponseStats: positioningDecision[0].risk_response_stats
              ? JSON.parse(positioningDecision[0].risk_response_stats)
              : undefined,
          };
          logInfo(
            `Loaded ${positioningContext.riskResponses?.length || 0} risk responses from Position phase`,
          );
        } catch {
          logWarning("Failed to parse positioning risk responses");
        }
      }

      // Build comprehensive strategic context
      const hasPositioningData =
        positioningDecision.length > 0 &&
        positioningDecision[0].primary_strategy_name;
      const hasFinancialData =
        financialAllocation.length > 0 &&
        (financialAllocation[0].allocated_budget ||
          financialAllocation[0].allocated_weekly_hours ||
          financialAllocation[0].target_income_from_idea);
      const hasDiffData = diffResults.length > 0;

      if (hasPositioningData || hasFinancialData || hasDiffData) {
        strategicContext = {};

        // Add selected strategy
        if (
          positioningDecision.length > 0 &&
          positioningDecision[0].primary_strategy_name
        ) {
          const pd = positioningDecision[0];
          strategicContext.selectedStrategy = {
            name: pd.primary_strategy_name!, // Non-null asserted (verified in condition above)
            description: "", // Would need to load from differentiation_results if needed
          };

          // Add strategic approach
          if (pd.selected_approach) {
            strategicContext.strategicApproach = pd.selected_approach as any;
          }

          // Add timing decision
          if (pd.timing_decision) {
            strategicContext.timing = {
              decision: pd.timing_decision as "proceed_now" | "wait" | "urgent",
              rationale: pd.timing_rationale || undefined,
            };
          }
        }

        // Add financial context
        if (financialAllocation.length > 0) {
          const fa = financialAllocation[0];
          if (
            fa.allocated_budget ||
            fa.allocated_weekly_hours ||
            fa.target_income_from_idea
          ) {
            strategicContext.financials = {
              allocatedBudget: fa.allocated_budget || undefined,
              allocatedWeeklyHours: fa.allocated_weekly_hours || undefined,
              allocatedRunwayMonths: fa.allocated_runway_months || undefined,
              targetIncome: fa.target_income_from_idea || undefined,
              incomeTimelineMonths: fa.income_timeline_months || undefined,
              incomeType: fa.income_type as any,
              validationBudget: fa.validation_budget || undefined,
              killCriteria: fa.kill_criteria || undefined,
            };

            // Use financial approach if positioning approach not set
            if (!strategicContext.strategicApproach && fa.strategic_approach) {
              strategicContext.strategicApproach = fa.strategic_approach as any;
            }
          }
        }

        // Add differentiation insights
        if (diffResults.length > 0) {
          const dr = diffResults[0];
          strategicContext.differentiation = {};

          if (dr.opportunities) {
            try {
              const opps = JSON.parse(dr.opportunities);
              strategicContext.differentiation.topOpportunities = opps
                .slice(0, 3)
                .map(
                  (o: any) =>
                    `${o.targetSegment || o.segment || "Unknown"}: ${o.description || "No description"}`,
                );
            } catch {
              /* ignore parse errors */
            }
          }

          if (dr.competitive_risks) {
            try {
              const risks = JSON.parse(dr.competitive_risks);
              strategicContext.differentiation.competitiveRisks = risks
                .slice(0, 3)
                .map((r: any) => r.description || r.risk || "Unknown risk");
            } catch {
              /* ignore parse errors */
            }
          }

          if (dr.market_timing_analysis) {
            try {
              const timing = JSON.parse(dr.market_timing_analysis);
              strategicContext.differentiation.marketTimingAnalysis =
                timing.recommendation ||
                timing.summary ||
                "Market timing analysis available";
            } catch {
              strategicContext.differentiation.marketTimingAnalysis =
                dr.market_timing_analysis;
            }
          }

          if (dr.strategic_summary) {
            strategicContext.differentiation.strategicSummary =
              dr.strategic_summary;
          }
        }

        // Add risk context
        strategicContext.riskContext = positioningContext || undefined;

        logInfo(
          `Loaded Position phase context - Strategy: ${strategicContext.selectedStrategy?.name || "Not set"}, Budget: $${strategicContext.financials?.allocatedBudget || "Not set"}`,
        );
      }

      console.log(
        `\n--- Starting Evaluation (${mode === "v2" ? "Parallel Specialists" : "Sequential Generalist"}) ---\n`,
      );

      // Run evaluation based on mode
      let result: FullEvaluationResult;
      if (mode === "v2") {
        // v2: Parallel specialized evaluators with full context
        const v2Result = await runAllSpecializedEvaluators(
          slug,
          ideaData.id,
          ideaContent,
          costTracker,
          broadcaster,
          profileContext,
          structuredContext,
          research,
          strategicContext, // Pass strategic positioning context
        );
        result = {
          ideaSlug: slug,
          ideaId: ideaData.id,
          ...v2Result,
        };
      } else {
        // v1: Sequential generalist evaluator
        result = await evaluateIdea(
          slug,
          ideaData.id,
          ideaContent,
          costTracker,
          broadcaster,
          profileContext,
          structuredContext,
          positioningContext,
          strategicContext,
        );
      }

      // Run debate phase (unless skipped)
      let finalScore = result.overallScore;
      let debateResult: FullDebateResult | null = null;

      if (!options.skipDebate && result.evaluations.length > 0) {
        console.log("\n--- Starting Debate Phase ---\n");
        console.log("Red Team will challenge the evaluations...\n");

        try {
          debateResult = await runFullDebate(
            slug,
            result.evaluations,
            ideaContent,
            costTracker,
            broadcaster,
          );

          // Update with debate results
          finalScore = debateResult.overallFinalScore;

          console.log("\n" + formatDebateResults(debateResult));
        } catch (debateError) {
          logWarning("Debate phase failed, using initial evaluation scores");
          console.error("Debate error:", debateError);
        }
      } else if (options.skipDebate) {
        console.log("\n[Debate phase skipped]\n");
      }

      // Notify synthesis phase
      await broadcaster.synthesisStarted();

      // Use runId as the session ID for all database operations
      const sessionId = runId;

      // Save evaluation results
      await saveEvaluationResults(ideaData.id, result, contentHash, sessionId);

      // Save debate results if debate was run
      if (debateResult) {
        await saveDebateResults(ideaData.id, sessionId, debateResult);
      }

      // Display results
      console.log("\n" + formatEvaluationResults(result));

      // Show recommendation
      const interpretation = interpretScore(finalScore);

      // Save final synthesis if debate was run
      if (debateResult) {
        await saveFinalSynthesis(
          ideaData.id,
          sessionId,
          debateResult,
          finalScore,
          interpretation.recommendation,
          structuredContext,
        );
      }

      // Generate evaluation.md file
      await generateEvaluationFile(
        ideaData.folder_path,
        result,
        debateResult,
        finalScore,
        interpretation.recommendation,
        research,
      );

      // Notify synthesis complete
      await broadcaster.synthesisComplete(
        finalScore,
        interpretation.recommendation,
      );
      console.log(`\n## Recommendation: ${interpretation.recommendation}`);
      console.log(interpretation.description);

      // Show cost report
      const costReport = costTracker.getReport();
      console.log(`\n## Cost Summary`);
      console.log(`- API Calls: ${costReport.apiCalls}`);
      console.log(
        `- Tokens: ${costReport.inputTokens.toLocaleString()} input, ${costReport.outputTokens.toLocaleString()} output`,
      );
      console.log(`- Estimated Cost: $${costReport.estimatedCost.toFixed(4)}`);
      console.log(
        `- Budget Remaining: $${costReport.budgetRemaining.toFixed(2)}`,
      );

      logSuccess(`Evaluation complete for ${slug}`);

      // Notify debate complete
      await broadcaster.complete(finalScore);

      // Update idea stage if in SPARK
      if (ideaData.lifecycle_stage === "SPARK") {
        await run("UPDATE ideas SET lifecycle_stage = ? WHERE id = ?", [
          "EVALUATE",
          ideaData.id,
        ]);
        logInfo("Updated idea stage to EVALUATE");
      }

      await saveDb();
      await closeDb();

      // Explicitly exit to ensure process terminates cleanly
      process.exit(0);
    } catch (error) {
      logError("Evaluation failed", error as Error);
      // Print full stack trace for debugging
      console.error("Full error:", error);
      // Try to broadcast error if we have broadcaster defined
      try {
        const errorBroadcaster = createBroadcaster(slug, "error");
        await errorBroadcaster.error(
          (error as Error).message || "Evaluation failed",
        );
      } catch {
        // Ignore broadcast errors
      }
      await closeDb();
      process.exit(1);
    }
  });

/**
 * Build structured context from dynamic questioning answers
 */
async function getStructuredContext(
  ideaId: string,
): Promise<StructuredEvaluationContext | null> {
  try {
    // Get all answers for this idea
    const answers = await getAnswersForIdea(ideaId);
    if (answers.length === 0) {
      return null;
    }

    // Get readiness and coverage data
    const readiness = await calculateReadiness(ideaId);
    const criterionCoverage = await calculateCriterionCoverage(ideaId);

    // Build structured answer data from question answers
    const structuredAnswers: StructuredAnswerData = {};

    // Create a mapping from question ID to structured field
    const questionIdMapping: Record<string, (answer: string) => void> = {
      // Problem category - P1 (Problem Clarity)
      P1_CORE: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.core_problem = a;
      },
      P1_SCOPE: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.problem_scope = a;
      },
      P1_WHEN: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.problem_triggers = a;
      },

      // Problem category - P2 (Problem Severity)
      P2_PAIN: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.pain_severity = a;
      },
      P2_COST: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.pain_cost = a;
      },
      P2_FREQUENCY: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.pain_frequency = a;
      },
      P2_ALTERNATIVES: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.current_workarounds = a;
      },

      // Problem category - P3 (Target User)
      P3_WHO: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.target_user = a;
      },
      P3_SEGMENT: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.user_segment = a;
      },
      P3_SIZE: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.user_size = a;
      },
      P3_ACCESS: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.user_access = a;
      },

      // Problem category - P4 (Problem Validation)
      P4_EVIDENCE: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.validation = a;
      },
      P4_CONVERSATIONS: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.user_conversations = a;
      },
      P4_WILLINGNESS: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.willingness_to_pay = a;
      },

      // Problem category - P5 (Problem Uniqueness)
      P5_EXISTING: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.existing_solutions = a;
      },
      P5_GAP: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.solution_gaps = a;
      },
      P5_ANGLE: (a) => {
        structuredAnswers.problem = structuredAnswers.problem || {};
        structuredAnswers.problem.unique_angle = a;
      },

      // Solution category - S1 (Solution Clarity)
      S1_WHAT: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.description = a;
      },
      S1_VALUE_PROP: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.value_proposition = a;
      },
      S1_HOW: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.user_flow = a;
      },

      // Solution category - S2 (Solution Feasibility)
      S2_TECH: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.technology = a;
      },
      S2_PROVEN: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.proven_approach = a;
      },
      S2_HARD: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.hard_parts = a;
      },

      // Solution category - S3 (Solution Uniqueness)
      S3_DIFF: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.differentiation = a;
      },
      S3_WHY_BETTER: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.why_better = a;
      },
      S3_SECRET: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.secret_insight = a;
      },

      // Solution category - S4 (Solution Scalability)
      S4_SCALE: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.scale_bottlenecks = a;
      },
      S4_MARGINAL: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.marginal_costs = a;
      },

      // Solution category - S5 (Solution Defensibility)
      S5_MOAT: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.moat = a;
      },
      S5_PROTECTION: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.ip_protection = a;
      },
      S5_NETWORK: (a) => {
        structuredAnswers.solution = structuredAnswers.solution || {};
        structuredAnswers.solution.network_effects = a;
      },

      // Feasibility category - F1 (Technical Complexity)
      F1_MVP: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.mvp = a;
      },
      F1_COMPONENTS: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.components = a;
      },
      F1_UNKNOWNS: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.unknowns = a;
      },

      // Feasibility category - F2 (Resource Requirements)
      F2_COST: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.cost_estimate = a;
      },
      F2_TEAM: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.team_requirements = a;
      },
      F2_TOOLS: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.tools_needed = a;
      },

      // Feasibility category - F3 (Skill Availability)
      F3_GAP: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.skill_gaps = a;
      },
      F3_ACQUIRE: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.skill_acquisition = a;
      },

      // Feasibility category - F4 (Time to Value)
      F4_FIRST_VALUE: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.time_to_feedback = a;
      },
      F4_FIRST_REVENUE: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.time_to_revenue = a;
      },

      // Feasibility category - F5 (Dependency Risk)
      F5_DEPS: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.dependencies = a;
      },
      F5_CONTROL: (a) => {
        structuredAnswers.feasibility = structuredAnswers.feasibility || {};
        structuredAnswers.feasibility.dependency_control = a;
      },

      // Market category - M1 (Market Size)
      M1_TAM: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.tam = a;
      },
      M1_SAM: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.sam = a;
      },
      M1_SOM: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.som = a;
      },

      // Market category - M2 (Market Growth)
      M2_TREND: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.trends = a;
      },
      M2_DRIVERS: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.trend_drivers = a;
      },

      // Market category - M3 (Competition)
      M3_COMPETITORS: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.competitors = a;
      },
      M3_LANDSCAPE: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.competitive_landscape = a;
      },
      M3_COMP_WEAKNESS: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.competitor_weaknesses = a;
      },

      // Market category - M4 (Entry Barriers)
      M4_BARRIERS: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.barriers = a;
      },
      M4_OVERCOME: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.barrier_strategy = a;
      },

      // Market category - M5 (Timing)
      M5_WHY_NOW: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.timing = a;
      },
      M5_CATALYST: (a) => {
        structuredAnswers.market = structuredAnswers.market || {};
        structuredAnswers.market.timing_catalyst = a;
      },

      // Risk category
      R_BIGGEST: (a) => {
        structuredAnswers.risk = structuredAnswers.risk || {};
        structuredAnswers.risk.biggest_risk = a;
      },
      R_MITIGATION: (a) => {
        structuredAnswers.risk = structuredAnswers.risk || {};
        structuredAnswers.risk.mitigation = a;
      },
      R_EXECUTION: (a) => {
        structuredAnswers.risk = structuredAnswers.risk || {};
        structuredAnswers.risk.execution_risk = a;
      },
      R_MARKET: (a) => {
        structuredAnswers.risk = structuredAnswers.risk || {};
        structuredAnswers.risk.market_risk = a;
      },
      R_TECHNICAL: (a) => {
        structuredAnswers.risk = structuredAnswers.risk || {};
        structuredAnswers.risk.technical_risk = a;
      },
      R_FINANCIAL: (a) => {
        structuredAnswers.risk = structuredAnswers.risk || {};
        structuredAnswers.risk.financial_risk = a;
      },
      R_REGULATORY: (a) => {
        structuredAnswers.risk = structuredAnswers.risk || {};
        structuredAnswers.risk.regulatory_risk = a;
      },
      R_KILL: (a) => {
        structuredAnswers.risk = structuredAnswers.risk || {};
        structuredAnswers.risk.kill_conditions = a;
      },
      R_PREMORTEM: (a) => {
        structuredAnswers.risk = structuredAnswers.risk || {};
        structuredAnswers.risk.premortem = a;
      },

      // Business model category
      BM_MODEL: (a) => {
        structuredAnswers.business_model =
          structuredAnswers.business_model || {};
        structuredAnswers.business_model.revenue_model = a;
      },
      BM_PRICE: (a) => {
        structuredAnswers.business_model =
          structuredAnswers.business_model || {};
        structuredAnswers.business_model.pricing = a;
      },
      BM_CAC: (a) => {
        structuredAnswers.business_model =
          structuredAnswers.business_model || {};
        structuredAnswers.business_model.cac = a;
      },
      BM_LTV: (a) => {
        structuredAnswers.business_model =
          structuredAnswers.business_model || {};
        structuredAnswers.business_model.ltv = a;
      },
      BM_GTM: (a) => {
        structuredAnswers.business_model =
          structuredAnswers.business_model || {};
        structuredAnswers.business_model.gtm = a;
      },
      BM_REVENUE: (a) => {
        structuredAnswers.business_model =
          structuredAnswers.business_model || {};
        structuredAnswers.business_model.revenue_projection = a;
      },

      // Fit category - FT1 (Personal Fit / Goal Alignment)
      FT1_GOALS: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.goal_alignment = a;
      },
      FT1_WHY_THIS: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.why_this_idea = a;
      },
      FT1_SUCCESS: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.success_definition = a;
      },

      // Fit category - FT2 (Passion Alignment)
      FT2_PASSION: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.passion = a;
      },
      FT2_EXPERIENCE: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.personal_experience = a;
      },
      FT2_LONG_TERM: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.long_term_interest = a;
      },

      // Fit category - FT3 (Skill Match)
      FT3_SKILLS: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.skills = a;
      },
      FT3_UNIQUE: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.unique_advantage = a;
      },
      FT3_LEARN: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.skills_to_learn = a;
      },

      // Fit category - FT4 (Network Leverage)
      FT4_NETWORK: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.network = a;
      },
      FT4_ACCESS: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.customer_access = a;
      },
      FT4_COMMUNITY: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.community = a;
      },

      // Fit category - FT5 (Life Stage Fit)
      FT5_TIMING: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.life_timing = a;
      },
      FT5_CAPACITY: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.time_capacity = a;
      },
      FT5_RUNWAY: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.financial_runway = a;
      },
      FT5_RISK: (a) => {
        structuredAnswers.fit = structuredAnswers.fit || {};
        structuredAnswers.fit.risk_tolerance = a;
      },
    };

    // Batch load ALL questions at once (fixes N+1 query problem)
    const questionIds = answers.map((a) => a.questionId);
    const questions = await getQuestionsByIds(questionIds);
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Map answers to structured categories using the mapping
    for (const answer of answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) continue;

      const mapper = questionIdMapping[question.id];
      if (mapper) {
        mapper(answer.answer);
      } else {
        // Log unmapped question IDs for debugging
        logDebug(`Unmapped question ID: ${question.id}`);
      }
    }

    // Build coverage data
    const byCriterion: Record<string, number> = {};
    for (const cov of criterionCoverage) {
      byCriterion[cov.criterion] = cov.coverage;
    }

    return {
      answers: structuredAnswers,
      coverage: {
        overall: readiness.overall,
        byCategory: readiness.byCategory,
        byCriterion,
      },
    };
  } catch (error) {
    logWarning(`Failed to fetch structured context: ${error}`);
    return null;
  }
}

/**
 * Save evaluation results to database
 */
async function saveEvaluationResults(
  ideaId: string,
  result: FullEvaluationResult,
  contentHash: string,
  sessionId: string,
): Promise<void> {
  logDebug("Saving evaluation results to database");
  await run(
    `INSERT INTO evaluation_sessions
     (id, idea_id, content_hash, overall_score, overall_confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      ideaId,
      contentHash,
      result.overallScore,
      result.overallConfidence,
      result.timestamp,
    ],
  );

  // Save individual evaluations
  for (const eval_ of result.evaluations) {
    await run(
      `INSERT INTO evaluations
       (idea_id, evaluation_run_id, criterion, category, agent_score, final_score,
        confidence, reasoning, session_id, criterion_id, criterion_name, initial_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ideaId,
        sessionId, // Use session ID as run ID for compatibility
        eval_.criterion.name,
        eval_.criterion.category,
        eval_.score, // agent_score
        eval_.score, // final_score same as initial until debate
        eval_.confidence,
        eval_.reasoning,
        sessionId,
        eval_.criterion.id,
        eval_.criterion.name,
        eval_.score,
        result.timestamp,
      ],
    );
  }

  // Log cost
  await run(
    `INSERT INTO cost_log
     (evaluation_run_id, idea_id, operation, input_tokens, output_tokens, estimated_cost)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      ideaId,
      `evaluate:${result.ideaSlug}`,
      result.tokensUsed.input,
      result.tokensUsed.output,
      (result.tokensUsed.input * 15 + result.tokensUsed.output * 75) /
        1_000_000,
    ],
  );

  logDebug("Evaluation results saved");
}

/**
 * Save debate rounds to database
 */
async function saveDebateResults(
  ideaId: string,
  sessionId: string,
  debateResult: FullDebateResult,
): Promise<void> {
  logDebug("Saving debate results to database");

  for (const debate of debateResult.debates) {
    // Save each round for this criterion
    for (let roundIdx = 0; roundIdx < debate.rounds.length; roundIdx++) {
      const round = debate.rounds[roundIdx];

      // Save each challenge/verdict in the round
      for (
        let challengeIdx = 0;
        challengeIdx < round.verdicts.length;
        challengeIdx++
      ) {
        const verdict = round.verdicts[challengeIdx];
        const challenge = debate.challenges[challengeIdx];

        await run(
          `INSERT INTO debate_rounds
           (idea_id, evaluation_run_id, round_number, criterion, challenge_number,
            evaluator_claim, redteam_persona, redteam_challenge, evaluator_defense,
            arbiter_verdict, first_principles_bonus, score_adjustment, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ideaId,
            sessionId,
            roundIdx + 1,
            debate.criterion.name,
            challengeIdx + 1,
            debate.originalReasoning,
            challenge?.persona || "unknown",
            challenge?.challenge || "",
            verdict.reasoning || "",
            verdict.winner,
            verdict.firstPrinciplesBonus ? 1 : 0,
            verdict.scoreAdjustment,
            new Date().toISOString(),
          ],
        );
      }
    }

    // Save red team challenges to redteam_log
    for (const challenge of debate.challenges) {
      await run(
        `INSERT INTO redteam_log
         (idea_id, evaluation_run_id, persona, challenge, severity, logged_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          ideaId,
          sessionId,
          challenge.persona,
          challenge.challenge,
          ["CRITICAL", "MAJOR", "MINOR", "ADDRESSED"].includes(
            challenge.severity,
          )
            ? challenge.severity
            : "MAJOR",
          new Date().toISOString(),
        ],
      );
    }

    // First principles: Update evaluations.final_score with post-debate adjustment
    // This ensures the evaluations table contains the true final score after debate
    // Uses MAX/MIN to clamp to valid range [1, 10] to respect CHECK constraint
    const adjustment = debate.finalScore - debate.originalScore;
    await run(
      `UPDATE evaluations
       SET final_score = MAX(1, MIN(10, COALESCE(initial_score, final_score) + ?))
       WHERE idea_id = ?
         AND evaluation_run_id = ?
         AND criterion = ?`,
      [adjustment, ideaId, sessionId, debate.criterion.name],
    );
    logDebug(
      `Updated ${debate.criterion.name} final_score: ${debate.originalScore} → ${debate.finalScore} (adj: ${adjustment > 0 ? "+" : ""}${adjustment})`,
    );
  }

  logDebug("Debate results saved");
}

/**
 * Extract actual unresolved questions based on coverage gaps
 */
function getActualUnresolvedQuestions(
  structuredContext: StructuredEvaluationContext | null,
): string[] {
  if (!structuredContext) {
    return ["Complete the development questions to get specific feedback"];
  }

  const gaps: string[] = [];
  const coverage = structuredContext.coverage.byCategory;

  if ((coverage.problem ?? 0) < 0.5) {
    gaps.push("Problem definition needs more detail");
  }
  if ((coverage.solution ?? 0) < 0.5) {
    gaps.push("Solution approach needs clarification");
  }
  if ((coverage.market ?? 0) < 0.5) {
    gaps.push("Market analysis is incomplete");
  }
  if ((coverage.feasibility ?? 0) < 0.5) {
    gaps.push("Feasibility assessment needs more information");
  }
  if ((coverage.risk ?? 0) < 0.5) {
    gaps.push("Risk identification is incomplete");
  }
  if ((coverage.fit ?? 0) < 0.5) {
    gaps.push("Personal fit assessment is incomplete");
  }

  return gaps;
}

/**
 * Save final synthesis to database
 */
async function saveFinalSynthesis(
  ideaId: string,
  sessionId: string,
  debateResult: FullDebateResult,
  finalScore: number,
  recommendation: string,
  structuredContext: StructuredEvaluationContext | null,
): Promise<void> {
  logDebug("Saving final synthesis to database");

  const synthesisId = randomUUID();

  // Calculate actual readiness from structured context
  const readinessPercent = structuredContext?.coverage.overall ?? 0;

  // Extract actual unresolved questions based on coverage
  const unresolvedQuestions = getActualUnresolvedQuestions(structuredContext);

  // Collect insights from all debates
  const keyStrengths: string[] = [];
  const keyWeaknesses: string[] = [];
  const criticalAssumptions: string[] = [];

  for (const debate of debateResult.debates) {
    if (debate.finalScore >= 7) {
      keyStrengths.push(
        `${debate.criterion.name}: Strong (${debate.finalScore}/10)`,
      );
    } else if (debate.finalScore <= 4) {
      keyWeaknesses.push(
        `${debate.criterion.name}: Weak (${debate.finalScore}/10)`,
      );
    }

    // Add insights as assumptions/questions
    for (const insight of debate.summary.keyInsights) {
      if (
        insight.toLowerCase().includes("assume") ||
        insight.toLowerCase().includes("if ")
      ) {
        criticalAssumptions.push(insight);
      }
    }
  }

  // Calculate red team survival rate
  let totalChallenges = 0;
  let survivedChallenges = 0;
  for (const debate of debateResult.debates) {
    for (const round of debate.rounds) {
      for (const verdict of round.verdicts) {
        totalChallenges++;
        if (verdict.winner === "EVALUATOR") {
          survivedChallenges++;
        }
      }
    }
  }
  const survivalRate =
    totalChallenges > 0 ? survivedChallenges / totalChallenges : 0;

  // Calculate confidence based on data completeness
  const confidenceFromData = structuredContext
    ? Math.min(0.9, 0.5 + structuredContext.coverage.overall * 0.4)
    : 0.5;

  // Generate executive summary with readiness info
  const executiveSummary =
    `Evaluation completed with overall score of ${finalScore.toFixed(1)}/10. ` +
    `Data completeness: ${Math.round(readinessPercent * 100)}%. ` +
    `Red team survival rate: ${(survivalRate * 100).toFixed(0)}%. ` +
    `Recommendation: ${recommendation}. ` +
    `${keyStrengths.length} strong areas, ${keyWeaknesses.length} areas needing improvement.`;

  await run(
    `INSERT INTO final_syntheses
     (id, idea_id, evaluation_run_id, completed_at, total_rounds, overall_score,
      overall_confidence, redteam_survival_rate, recommendation, recommendation_reasoning,
      executive_summary, key_strengths, key_weaknesses, critical_assumptions,
      unresolved_questions, lock_reason, locked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      synthesisId,
      ideaId,
      sessionId,
      new Date().toISOString(),
      debateResult.totalRounds,
      finalScore,
      confidenceFromData,
      survivalRate,
      recommendation,
      `Based on overall score of ${finalScore.toFixed(1)}/10 with ${Math.round(readinessPercent * 100)}% data completeness`,
      executiveSummary,
      JSON.stringify(keyStrengths),
      JSON.stringify(keyWeaknesses),
      JSON.stringify(criticalAssumptions),
      JSON.stringify(unresolvedQuestions),
      "CONVERGENCE",
      1,
    ],
  );

  logDebug("Final synthesis saved");
}

/**
 * Generate evaluation.md file for the idea
 */
async function generateEvaluationFile(
  folderPath: string,
  result: FullEvaluationResult,
  debateResult: FullDebateResult | null,
  finalScore: number,
  recommendation: string,
  research: ResearchResult | null,
): Promise<void> {
  logDebug("Generating evaluation.md file");

  const lines: string[] = [
    "---",
    `evaluated_at: ${new Date().toISOString().split("T")[0]}`,
    `overall_score: ${finalScore.toFixed(1)}`,
    `recommendation: ${recommendation}`,
    "---",
    "",
    "# Evaluation Results",
    "",
    `**Overall Score:** ${finalScore.toFixed(1)}/10`,
    `**Recommendation:** ${recommendation}`,
    `**Evaluated:** ${new Date().toLocaleDateString()}`,
    "",
    "## Category Scores",
    "",
    "| Category | Score | Confidence |",
    "|----------|-------|------------|",
  ];

  // Group evaluations by category
  const byCategory = new Map<string, typeof result.evaluations>();
  for (const eval_ of result.evaluations) {
    const cat = eval_.criterion.category;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
    }
    byCategory.get(cat)!.push(eval_);
  }

  for (const category of CATEGORIES) {
    const catEvals = byCategory.get(category) || [];
    if (catEvals.length > 0) {
      const avgScore =
        catEvals.reduce((sum, e) => sum + e.score, 0) / catEvals.length;
      const avgConf =
        catEvals.reduce((sum, e) => sum + e.confidence, 0) / catEvals.length;
      lines.push(
        `| ${category.charAt(0).toUpperCase() + category.slice(1)} | ${avgScore.toFixed(1)}/10 | ${(avgConf * 100).toFixed(0)}% |`,
      );
    }
  }

  lines.push("", "## Detailed Scores", "");

  for (const category of CATEGORIES) {
    const catEvals = byCategory.get(category) || [];
    if (catEvals.length > 0) {
      lines.push(
        `### ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        "",
      );

      for (const eval_ of catEvals) {
        lines.push(`**${eval_.criterion.name}:** ${eval_.score}/10`);
        lines.push(`> ${eval_.reasoning}`, "");
      }
    }
  }

  // Add debate results if available
  if (debateResult) {
    lines.push("## Debate Summary", "");
    lines.push(`- **Total Rounds:** ${debateResult.totalRounds}`);
    lines.push(
      `- **Initial Score:** ${debateResult.overallOriginalScore.toFixed(1)}/10`,
    );
    lines.push(
      `- **Final Score:** ${debateResult.overallFinalScore.toFixed(1)}/10`,
    );
    lines.push(
      `- **Score Change:** ${debateResult.overallFinalScore - debateResult.overallOriginalScore >= 0 ? "+" : ""}${(debateResult.overallFinalScore - debateResult.overallOriginalScore).toFixed(1)}`,
      "",
    );

    // Significant changes
    const significantChanges = debateResult.debates
      .filter((d) => Math.abs(d.finalScore - d.originalScore) >= 1)
      .sort(
        (a, b) =>
          Math.abs(b.finalScore - b.originalScore) -
          Math.abs(a.finalScore - a.originalScore),
      );

    if (significantChanges.length > 0) {
      lines.push("### Score Adjustments from Debate", "");
      for (const debate of significantChanges) {
        const change = debate.finalScore - debate.originalScore;
        const emoji = change > 0 ? "+" : "";
        lines.push(
          `- **${debate.criterion.name}:** ${debate.originalScore} → ${debate.finalScore} (${emoji}${change.toFixed(1)})`,
        );
      }
      lines.push("");
    }

    // Key insights
    const allInsights = debateResult.debates
      .flatMap((d) => d.summary.keyInsights)
      .filter((v, i, a) => a.indexOf(v) === i);

    if (allInsights.length > 0) {
      lines.push("### Key Insights from Debate", "");
      for (const insight of allInsights.slice(0, 10)) {
        lines.push(`- ${insight}`);
      }
      lines.push("");
    }
  }

  // Add research sources section - show if research was conducted
  if (research && research.searchesPerformed > 0) {
    lines.push("## External Research", "");
    lines.push(`*Research conducted: ${research.timestamp.split("T")[0]}*`, "");

    // Collect all unique sources
    const allSources = new Set<string>(
      [
        ...research.marketSize.sources,
        ...research.competitors.sources,
        ...research.trends.sources,
        ...research.techFeasibility.sources,
      ].filter((s) => s && s.startsWith("http")),
    );

    if (allSources.size > 0) {
      lines.push("### Sources Referenced", "");
      for (const source of allSources) {
        lines.push(`- ${source}`);
      }
      lines.push("");
    }

    // Show verified market data
    if (research.marketSize.verified) {
      lines.push("### Market Research Findings", "");
      lines.push(
        `**Verified Market Size:** ${research.marketSize.verified}`,
        "",
      );
      if (research.marketSize.userClaim) {
        lines.push(`*User claimed: ${research.marketSize.userClaim}*`, "");
      }
      lines.push("");
    }

    // Show market trends
    if (research.trends.direction !== "unknown") {
      lines.push("### Market Trends", "");
      lines.push(`**Direction:** ${research.trends.direction}`, "");
      if (research.trends.evidence) {
        lines.push(`**Evidence:** ${research.trends.evidence}`, "");
      }
      lines.push("");
    }

    // Show discovered competitors
    if (research.competitors.discovered.length > 0) {
      lines.push("### Additional Competitors Discovered", "");
      for (const comp of research.competitors.discovered) {
        lines.push(`- ${comp}`);
      }
      lines.push("");
    }

    // Show tech feasibility
    if (research.techFeasibility.assessment !== "unknown") {
      lines.push("### Technology Feasibility", "");
      lines.push(`**Assessment:** ${research.techFeasibility.assessment}`, "");
      if (research.techFeasibility.examples.length > 0) {
        lines.push("**Production Examples:**");
        for (const ex of research.techFeasibility.examples) {
          lines.push(`- ${ex}`);
        }
      }
      lines.push("");
    }

    lines.push(`*${research.searchesPerformed} web searches performed*`, "");
  }

  const content = lines.join("\n");
  const evalPath = path.join(folderPath, "evaluation.md");
  fs.writeFileSync(evalPath, content, "utf-8");

  logInfo(`Generated evaluation file: ${evalPath}`);
}

/**
 * Show existing evaluation scores
 */
async function showExistingEvaluation(ideaId: string): Promise<void> {
  const scores = await query<{
    category: string;
    criterion_name: string;
    final_score: number;
    confidence: number;
  }>(
    `SELECT category, criterion_name, final_score, confidence
     FROM evaluations
     WHERE idea_id = ?
     ORDER BY category, criterion_name`,
    [ideaId],
  );

  if (scores.length === 0) {
    logInfo("No existing evaluation data found");
    return;
  }

  console.log("\n## Existing Evaluation Scores\n");

  let currentCategory = "";
  for (const score of scores) {
    if (score.category !== currentCategory) {
      currentCategory = score.category;
      console.log(`\n### ${currentCategory.toUpperCase()}`);
    }
    const confidence = (score.confidence * 100).toFixed(0);
    console.log(
      `  ${score.criterion_name}: ${score.final_score}/10 (${confidence}% confidence)`,
    );
  }

  // Calculate and show overall
  const categoryAvgs = CATEGORIES.map((cat) => {
    const catScores = scores.filter((s) => s.category === cat);
    return (
      catScores.reduce((sum, s) => sum + s.final_score, 0) / catScores.length
    );
  });

  const config = getConfig();
  const weights = Object.values(config.categoryWeights);
  const overall = categoryAvgs.reduce(
    (sum, avg, i) => sum + avg * weights[i],
    0,
  );

  console.log(`\n**Overall Score: ${overall.toFixed(2)}/10**`);
}

// Use parseAsync to properly handle async actions
// This ensures the process waits for the action to complete before exiting
program.parseAsync().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
