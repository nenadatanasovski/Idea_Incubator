/**
 * Observability API Routes
 * Exposes transcript, tool use, assertion, and skill trace data for UI
 *
 * Phase 5: Refactored to use service classes (OBS-308)
 */

import { Router, Request, Response } from "express";
import { query, run } from "../../database/db.js";

// Import service singletons (OBS-300 to OBS-306)
import {
  executionService,
  transcriptService,
  toolUseService,
  assertionService,
  skillService,
  messageBusService,
  crossReferenceService,
} from "../services/observability/index.js";

import type {
  ToolUse,
  SkillTrace,
  AssertionResultEntry,
  MessageBusLogEntry,
  ExecutionRun,
  ToolSummary,
  AssertionSummary,
  CrossReference,
  EntityType,
  ToolName,
  ToolCategory,
  ToolResultStatus,
  AssertionCategory,
  MessageBusCategory,
  Severity,
} from "../types/observability.js";

const router = Router();

// === Overview Dashboard Endpoints ===

/**
 * GET /api/observability/stats
 * Get quick stats for the overview dashboard (uses ExecutionService)
 */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    // Use ExecutionService for execution stats (with fallback for missing tables)
    let execStats = { activeCount: 0, totalRecent: 0, failedRecent: 0 };
    let blockedCount = 0;
    let pendingCount = 0;

    try {
      execStats = await executionService.getExecutionStats();
    } catch {
      // Table may not exist
    }

    try {
      const results = await query<{ blocked_count: number }>(
        `SELECT COUNT(*) as blocked_count FROM build_agent_instances WHERE status = 'blocked'`,
        [],
      );
      blockedCount = results[0]?.blocked_count || 0;
    } catch {
      // Table may not exist
    }

    try {
      const results = await query<{ pending_count: number }>(
        `SELECT COUNT(*) as pending_count FROM blocking_questions WHERE status = 'pending'`,
        [],
      );
      pendingCount = results[0]?.pending_count || 0;
    } catch {
      // Table may not exist
    }

    const errorRate =
      execStats.totalRecent > 0
        ? ((execStats.failedRecent / execStats.totalRecent) * 100).toFixed(1)
        : "0.0";

    res.json({
      success: true,
      data: {
        activeExecutions: execStats.activeCount,
        errorRate: `${errorRate}%`,
        blockedAgents: blockedCount,
        pendingQuestions: pendingCount,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch observability stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

/**
 * GET /api/observability/activity
 * Get recent activity feed from all sources
 */
router.get("/activity", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Get recent activities from multiple sources - handle missing tables
    let executions: Array<{
      id: string;
      status: string;
      run_number: number;
      started_at: string;
      completed_at: string | null;
    }> = [];
    let events: Array<{
      id: string;
      event_type: string;
      session_id: string;
      created_at: string;
      event_data: string;
    }> = [];
    let questions: Array<{
      id: string;
      agent_id: string;
      question: string;
      status: string;
      created_at: string;
    }> = [];

    try {
      executions = await query<(typeof executions)[0]>(
        `SELECT id, status, run_number, started_at, completed_at
         FROM task_list_execution_runs
         ORDER BY started_at DESC
         LIMIT ?`,
        [limit],
      );
    } catch {
      // Table may not exist
    }

    try {
      events = await query<(typeof events)[0]>(
        `SELECT id, event_type, session_id, created_at, event_data
         FROM evaluation_events
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit],
      );
    } catch {
      // Table may not exist
    }

    try {
      questions = await query<(typeof questions)[0]>(
        `SELECT id, agent_id, question, status, created_at
         FROM blocking_questions
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit],
      );
    } catch {
      // Table may not exist
    }

    // Combine and sort all activities
    const activities: Array<{
      id: string;
      type: "execution" | "event" | "question" | "agent";
      title: string;
      description: string;
      timestamp: string;
      status?: string;
      href: string;
    }> = [];

    // Add executions
    for (const exec of executions) {
      const statusText =
        exec.status === "completed"
          ? "completed successfully"
          : exec.status === "failed"
            ? "failed"
            : exec.status === "running"
              ? "started"
              : exec.status;
      activities.push({
        id: exec.id,
        type: "execution",
        title: `Run #${exec.run_number}`,
        description: `Execution ${statusText}`,
        timestamp: exec.completed_at || exec.started_at,
        status: exec.status,
        href: `/observability/executions/${exec.id}`,
      });
    }

    // Add events
    for (const event of events) {
      let description = event.event_type;
      try {
        const data = JSON.parse(event.event_data || "{}");
        if (data.message) {
          description = String(data.message).substring(0, 80);
        }
      } catch {
        // Use event_type as description
      }
      activities.push({
        id: event.id,
        type: "event",
        title: event.event_type,
        description,
        timestamp: event.created_at,
        href: `/observability/events?session=${event.session_id}`,
      });
    }

    // Add questions
    for (const q of questions) {
      activities.push({
        id: q.id,
        type: "question",
        title: `Question from ${q.agent_id}`,
        description: q.question.substring(0, 80),
        timestamp: q.created_at,
        status: q.status,
        href: "/observability/agents",
      });
    }

    // Sort by timestamp descending and limit
    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const limitedActivities = activities.slice(0, limit);

    res.json({
      success: true,
      data: limitedActivities,
    });
  } catch (error) {
    console.error("Failed to fetch activity feed:", error);
    res.status(500).json({ success: false, error: "Failed to fetch activity" });
  }
});

/**
 * GET /api/observability/health
 * Get system health status
 */
router.get("/health", async (_req: Request, res: Response) => {
  try {
    // Safely query each table - handle missing tables gracefully
    let failedRecent = 0;
    let blockedAgents = 0;
    let staleQuestions = 0;

    try {
      const results = await query<{ failed_count: number }>(
        `SELECT COUNT(*) as failed_count
         FROM task_list_execution_runs
         WHERE status = 'failed' AND started_at > datetime('now', '-1 hour')`,
        [],
      );
      failedRecent = results[0]?.failed_count || 0;
    } catch {
      // Table may not exist
    }

    try {
      const results = await query<{ blocked_count: number }>(
        `SELECT COUNT(*) as blocked_count FROM build_agent_instances WHERE status = 'blocked'`,
        [],
      );
      blockedAgents = results[0]?.blocked_count || 0;
    } catch {
      // Table may not exist
    }

    try {
      const results = await query<{ stale_count: number }>(
        `SELECT COUNT(*) as stale_count
         FROM blocking_questions
         WHERE status = 'pending' AND created_at < datetime('now', '-30 minutes')`,
        [],
      );
      staleQuestions = results[0]?.stale_count || 0;
    } catch {
      // Table may not exist
    }

    // Determine overall health
    let status: "healthy" | "degraded" | "critical" = "healthy";
    const issues: string[] = [];

    if (failedRecent >= 3) {
      status = "critical";
      issues.push(`${failedRecent} executions failed in last hour`);
    } else if (failedRecent >= 1) {
      if (status === "healthy") status = "degraded";
      issues.push(`${failedRecent} execution(s) failed recently`);
    }

    if (blockedAgents >= 3) {
      status = "critical";
      issues.push(`${blockedAgents} agents are blocked`);
    } else if (blockedAgents >= 1) {
      if (status === "healthy") status = "degraded";
      issues.push(`${blockedAgents} agent(s) blocked`);
    }

    if (staleQuestions >= 5) {
      status = "critical";
      issues.push(`${staleQuestions} questions pending > 30min`);
    } else if (staleQuestions >= 1) {
      if (status === "healthy") status = "degraded";
      issues.push(`${staleQuestions} stale question(s)`);
    }

    res.json({
      success: true,
      data: {
        status,
        issues,
        metrics: {
          failedExecutionsLastHour: failedRecent,
          blockedAgents,
          staleQuestions,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch health status:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch health status" });
  }
});

// === Helper Functions ===

function buildPagination(req: Request): { limit: number; offset: number } {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  return { limit, offset };
}

// === Executions (using ExecutionService) ===

/**
 * GET /api/observability/executions
 * List all execution runs with optional filtering
 */
router.get("/executions", async (req: Request, res: Response) => {
  try {
    const { limit, offset } = buildPagination(req);
    const status = req.query.status as string | undefined;
    const taskListId = req.query.taskListId as string | undefined;

    // Use ExecutionService
    const result = await executionService.listExecutions({
      status: status ? [status as ExecutionRun["status"]] : undefined,
      taskListId,
      limit,
      offset,
    });

    // Map service response to route response format
    const executions: ExecutionRun[] = result.data.map((exec) => ({
      id: exec.id,
      taskListId: exec.taskListId,
      runNumber: exec.runNumber,
      status: exec.status as ExecutionRun["status"],
      startedAt: exec.startTime,
      completedAt: exec.endTime || null,
      sessionId: null, // Not exposed by service
      waveCount: exec.waveCount || 0,
      taskCount: exec.taskCount || 0,
      completedCount: exec.completedCount || 0,
      failedCount: exec.failedCount || 0,
    }));

    res.json({
      success: true,
      data: {
        data: executions,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Failed to fetch executions:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch executions" });
  }
});

/**
 * GET /api/observability/executions/recent
 * Get recent executions for dashboard (using ExecutionService)
 * NOTE: This route MUST be defined before /executions/:id to avoid
 * Express matching "recent" as an :id parameter
 */
router.get("/executions/recent", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Use ExecutionService
    const executions = await executionService.getRecentExecutions(limit);

    res.json({ success: true, data: executions });
  } catch (error) {
    console.error("Failed to fetch recent executions:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch recent executions" });
  }
});

/**
 * GET /api/observability/executions/:id
 * Get a single execution with stats
 */
router.get("/executions/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Use ExecutionService
    const exec = await executionService.getExecution(id);

    if (!exec) {
      return res
        .status(404)
        .json({ success: false, error: "Execution not found" });
    }

    const execution: ExecutionRun = {
      id: exec.id,
      taskListId: exec.taskListId,
      runNumber: exec.runNumber,
      status: exec.status as ExecutionRun["status"],
      startedAt: exec.startTime,
      completedAt: exec.endTime || null,
      sessionId: null, // Not exposed by service
      waveCount: exec.waveCount || 0,
      taskCount: exec.taskCount || 0,
      completedCount: exec.completedCount || 0,
      failedCount: exec.failedCount || 0,
    };

    return res.json({ success: true, data: execution });
  } catch (error) {
    console.error("Failed to fetch execution:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch execution" });
  }
});

/**
 * GET /api/observability/executions/:id/tasks/:taskId
 * Get a single task by ID (for deep linking)
 */
router.get(
  "/executions/:id/tasks/:taskId",
  async (req: Request, res: Response) => {
    try {
      const { id: executionId, taskId } = req.params;

      // Query task details from the tasks table
      const rows = await query<{
        id: string;
        display_id: string;
        title: string;
        status: string;
        started_at: string | null;
        completed_at: string | null;
        wave_number: number | null;
      }>(
        `SELECT
          t.id,
          t.display_id,
          t.title,
          t.status,
          t.started_at,
          t.completed_at,
          pew.wave_number
        FROM tasks t
        LEFT JOIN parallel_execution_waves pew ON t.id = pew.task_id
        WHERE t.id = ?`,
        [taskId],
      );

      if (!rows || rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Task not found" });
      }

      const taskRow = rows[0];

      // Calculate duration
      let durationMs: number | undefined;
      if (taskRow.started_at && taskRow.completed_at) {
        durationMs =
          new Date(taskRow.completed_at).getTime() -
          new Date(taskRow.started_at).getTime();
      }

      // Get tool use count for this task
      const toolUsesResult = await toolUseService.getToolUses(executionId, {
        taskId,
        limit: 1,
        offset: 0,
      });

      // Get assertion count for this task
      const assertionsResult = await assertionService.getAssertions(
        executionId,
        {
          taskId,
          limit: 1,
          offset: 0,
        },
      );

      // Count passed assertions
      const passedAssertionsResult = await assertionService.getAssertions(
        executionId,
        {
          taskId,
          result: ["pass"],
          limit: 1,
          offset: 0,
        },
      );

      return res.json({
        success: true,
        data: {
          id: taskRow.id,
          displayId: taskRow.display_id,
          title: taskRow.title,
          status: taskRow.status,
          startedAt: taskRow.started_at,
          completedAt: taskRow.completed_at,
          durationMs,
          waveNumber: taskRow.wave_number,
          toolUseCount: toolUsesResult.total,
          assertionCount: assertionsResult.total,
          passedAssertions: passedAssertionsResult.total,
        },
      });
    } catch (error) {
      console.error("Failed to fetch task:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch task" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/waves/:waveNum
 * Get wave details by wave number (for deep linking)
 */
router.get(
  "/executions/:id/waves/:waveNum",
  async (req: Request, res: Response) => {
    try {
      const { id: executionId, waveNum } = req.params;
      const waveNumber = parseInt(waveNum, 10);

      if (isNaN(waveNumber)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid wave number" });
      }

      // Query wave details from parallel_execution_waves
      const waveRows = await query<{
        id: string;
        wave_number: number;
        status: string;
        started_at: string | null;
        completed_at: string | null;
        max_parallel_agents: number;
      }>(
        `SELECT
          id,
          wave_number,
          status,
          started_at,
          completed_at,
          max_parallel_agents
        FROM parallel_execution_waves
        WHERE execution_id = ? AND wave_number = ?
        GROUP BY wave_number`,
        [executionId, waveNumber],
      );

      if (!waveRows || waveRows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "Wave not found" });
      }

      const waveRow = waveRows[0];

      // Calculate duration
      let durationMs: number | undefined;
      if (waveRow.started_at && waveRow.completed_at) {
        durationMs =
          new Date(waveRow.completed_at).getTime() -
          new Date(waveRow.started_at).getTime();
      }

      // Get tasks in this wave
      const taskRows = await query<{
        id: string;
        display_id: string;
        status: string;
      }>(
        `SELECT
          t.id,
          t.display_id,
          t.status
        FROM tasks t
        INNER JOIN parallel_execution_waves pew ON t.id = pew.task_id
        WHERE pew.execution_id = ? AND pew.wave_number = ?`,
        [executionId, waveNumber],
      );

      // Get agents assigned to this wave
      const agentRows = await query<{
        id: string;
        name: string | null;
        status: string;
      }>(
        `SELECT DISTINCT
          ba.id,
          ba.agent_id as name,
          ba.status
        FROM build_agent_instances ba
        WHERE ba.execution_id = ? AND ba.current_wave = ?`,
        [executionId, waveNumber],
      );

      // Get total wave count for navigation
      const maxWaveResult = await query<{ max_wave: number }>(
        `SELECT MAX(wave_number) as max_wave
        FROM parallel_execution_waves
        WHERE execution_id = ?`,
        [executionId],
      );
      const maxWave = maxWaveResult[0]?.max_wave || waveNumber;

      return res.json({
        success: true,
        data: {
          wave: {
            id: waveRow.id,
            status: waveRow.status,
            startedAt: waveRow.started_at,
            completedAt: waveRow.completed_at,
            durationMs,
            taskCount: taskRows.length,
            maxParallelAgents: waveRow.max_parallel_agents || 1,
          },
          tasks: taskRows.map((t) => ({
            id: t.id,
            displayId: t.display_id,
            status: t.status,
          })),
          agents: agentRows.map((a) => ({
            id: a.id,
            name: a.name,
            status: a.status,
          })),
          navigation: {
            current: waveNumber,
            total: maxWave,
            hasPrevious: waveNumber > 1,
            hasNext: waveNumber < maxWave,
          },
        },
      });
    } catch (error) {
      console.error("Failed to fetch wave:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch wave" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/transcript
 * Get transcript entries for an execution (using TranscriptService)
 */
router.get(
  "/executions/:id/transcript",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { limit, offset } = buildPagination(req);
      const entryType = req.query.entryType as string | undefined;
      const category = req.query.category as string | undefined;
      const taskId = req.query.taskId as string | undefined;

      // Use TranscriptService - returns frontend-compatible TranscriptEntry[]
      const result = await transcriptService.getTranscript(id, {
        entryTypes: entryType ? [entryType] : undefined,
        categories: category ? [category] : undefined,
        taskId,
        limit,
        offset,
      });

      // Pass through service response directly (already properly typed)
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Failed to fetch transcript:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch transcript" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/transcript/:entryId
 * Get a single transcript entry by ID (for deep linking)
 */
router.get(
  "/executions/:id/transcript/:entryId",
  async (req: Request, res: Response) => {
    try {
      const { id: executionId, entryId } = req.params;

      // Use TranscriptService to get single entry
      const entry = await transcriptService.getEntry(entryId);

      if (!entry || entry.executionId !== executionId) {
        return res
          .status(404)
          .json({ success: false, error: "Transcript entry not found" });
      }

      // Find adjacent entries by sequence
      const allEntries = await transcriptService.getTranscript(executionId, {
        limit: 500,
        offset: 0,
      });

      const sortedEntries = allEntries.data.sort(
        (a, b) => a.sequence - b.sequence,
      );
      const currentIdx = sortedEntries.findIndex((e) => e.id === entryId);

      const previous =
        currentIdx > 0
          ? {
              id: sortedEntries[currentIdx - 1].id,
              sequence: sortedEntries[currentIdx - 1].sequence,
              entryType: sortedEntries[currentIdx - 1].entryType,
            }
          : null;

      const next =
        currentIdx < sortedEntries.length - 1
          ? {
              id: sortedEntries[currentIdx + 1].id,
              sequence: sortedEntries[currentIdx + 1].sequence,
              entryType: sortedEntries[currentIdx + 1].entryType,
            }
          : null;

      return res.json({
        success: true,
        data: {
          entry,
          previous,
          next,
        },
      });
    } catch (error) {
      console.error("Failed to fetch transcript entry:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch transcript entry" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/tool-uses
 * Get tool uses for an execution (using ToolUseService)
 */
router.get("/executions/:id/tool-uses", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = buildPagination(req);
    const tool = req.query.tool as string | undefined;
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;
    const isError = req.query.isError as string | undefined;

    // Use ToolUseService
    const result = await toolUseService.getToolUses(id, {
      tools: tool ? [tool] : undefined,
      categories: category ? [category] : undefined,
      status: status ? [status] : undefined,
      isError: isError === "true" ? true : undefined,
      limit,
      offset,
      includeInputs: true,
      includeOutputs: false,
    });

    // Map service response to route response format
    const toolUses: ToolUse[] = result.data.map((tu) => ({
      id: tu.id,
      executionId: tu.executionId,
      taskId: tu.taskId,
      transcriptEntryId: tu.transcriptEntryId,
      tool: tu.tool as ToolName,
      toolCategory: tu.toolCategory as ToolCategory,
      input: tu.input || {},
      inputSummary: tu.inputSummary,
      resultStatus: tu.resultStatus as ToolResultStatus,
      output: tu.output,
      outputSummary: tu.outputSummary,
      isError: tu.isError,
      isBlocked: tu.isBlocked,
      errorMessage: tu.errorMessage,
      blockReason: tu.blockReason,
      startTime: tu.startTime,
      endTime: tu.endTime,
      durationMs: tu.durationMs,
      withinSkill: tu.withinSkill,
      parentToolUseId: tu.parentToolUseId,
      createdAt: tu.createdAt,
    }));

    res.json({
      success: true,
      data: {
        data: toolUses,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Failed to fetch tool uses:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch tool uses" });
  }
});

/**
 * GET /api/observability/executions/:id/tool-uses/:toolId
 * Get a single tool use by ID (for deep linking)
 */
router.get(
  "/executions/:id/tool-uses/:toolId",
  async (req: Request, res: Response) => {
    try {
      const { id: executionId, toolId } = req.params;

      // Use ToolUseService to get single tool use (with payloads)
      const toolUse = await toolUseService.getToolUse(toolId, true);

      if (!toolUse || toolUse.executionId !== executionId) {
        return res
          .status(404)
          .json({ success: false, error: "Tool use not found" });
      }

      return res.json({ success: true, data: toolUse });
    } catch (error) {
      console.error("Failed to fetch tool use:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch tool use" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/assertions
 * Get assertions for an execution (using AssertionService)
 */
router.get(
  "/executions/:id/assertions",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { limit, offset } = buildPagination(req);
      const result = req.query.result as string | undefined;
      const category = req.query.category as string | undefined;

      // Use AssertionService
      const assertionResult = await assertionService.getAssertions(id, {
        result: result ? [result] : undefined,
        categories: category ? [category] : undefined,
        limit,
        offset,
      });

      // Map service response to route response format
      const assertions: AssertionResultEntry[] = assertionResult.data.map(
        (a) => ({
          id: a.id,
          taskId: a.taskId,
          executionId: a.executionId,
          category: a.category as AssertionCategory,
          description: a.description,
          result: a.result as AssertionResultEntry["result"],
          evidence: a.evidence || {},
          chainId: a.chainId,
          chainPosition: a.chainPosition,
          timestamp: a.timestamp,
          durationMs: a.durationMs,
          transcriptEntryId: a.transcriptEntryId,
          createdAt: a.createdAt,
        }),
      );

      res.json({
        success: true,
        data: {
          data: assertions,
          total: assertionResult.total,
          limit: assertionResult.limit,
          offset: assertionResult.offset,
          hasMore: assertionResult.hasMore,
        },
      });
    } catch (error) {
      console.error("Failed to fetch assertions:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch assertions" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/assertions/:assertId
 * Get a single assertion by ID (for deep linking)
 */
router.get(
  "/executions/:id/assertions/:assertId",
  async (req: Request, res: Response) => {
    try {
      const { id: executionId, assertId } = req.params;

      // Use AssertionService to get single assertion
      const assertion = await assertionService.getAssertion(assertId);

      if (!assertion || assertion.executionId !== executionId) {
        return res
          .status(404)
          .json({ success: false, error: "Assertion not found" });
      }

      // Get chain info for navigation
      let chainInfo = null;
      if (assertion.chainId) {
        const chainAssertions = await assertionService.getAssertions(
          executionId,
          {
            chainId: assertion.chainId,
            limit: 100,
            offset: 0,
          },
        );

        const sorted = chainAssertions.data.sort(
          (a, b) => (a.chainPosition || 0) - (b.chainPosition || 0),
        );
        const currentIdx = sorted.findIndex((a) => a.id === assertId);

        chainInfo = {
          position: currentIdx + 1,
          total: sorted.length,
          previousId: currentIdx > 0 ? sorted[currentIdx - 1].id : undefined,
          nextId:
            currentIdx < sorted.length - 1
              ? sorted[currentIdx + 1].id
              : undefined,
        };
      }

      return res.json({
        success: true,
        data: {
          assertion: {
            id: assertion.id,
            taskId: assertion.taskId,
            executionId: assertion.executionId,
            category: assertion.category,
            description: assertion.description,
            result: assertion.result,
            evidence: assertion.evidence || {},
            chainId: assertion.chainId,
            chainPosition: assertion.chainPosition,
            timestamp: assertion.timestamp,
            durationMs: assertion.durationMs,
            transcriptEntryId: assertion.transcriptEntryId,
            createdAt: assertion.createdAt,
          },
          chainInfo,
        },
      });
    } catch (error) {
      console.error("Failed to fetch assertion:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch assertion" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/skills
 * Get skill traces for an execution (using SkillService)
 */
router.get("/executions/:id/skills", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = buildPagination(req);

    // Use SkillService
    const result = await skillService.getSkillTraces(id, {
      limit,
      offset,
    });

    // Map service response to route response format
    const skills: SkillTrace[] = result.data.map((s) => ({
      id: s.id,
      executionId: s.executionId,
      taskId: s.taskId,
      skillName: s.skillName,
      skillFile: s.skillFile,
      lineNumber: s.lineNumber,
      sectionTitle: s.sectionTitle,
      inputSummary: s.inputSummary,
      outputSummary: s.outputSummary,
      startTime: s.startTime,
      endTime: s.endTime,
      durationMs: s.durationMs,
      tokenEstimate: s.tokenEstimate,
      status: s.status as SkillTrace["status"],
      errorMessage: s.errorMessage,
      toolCalls: s.toolCalls,
      subSkills: s.subSkills,
      createdAt: s.createdAt,
    }));

    res.json({
      success: true,
      data: {
        data: skills,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Failed to fetch skill traces:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch skill traces" });
  }
});

/**
 * GET /api/observability/executions/:id/skills/:skillId
 * Get a single skill trace by ID (for deep linking)
 */
router.get(
  "/executions/:id/skills/:skillId",
  async (req: Request, res: Response) => {
    try {
      const { id: executionId, skillId } = req.params;

      // Use SkillService to get single skill trace
      const skillTrace = await skillService.getSkillTrace(skillId);

      if (!skillTrace || skillTrace.executionId !== executionId) {
        return res
          .status(404)
          .json({ success: false, error: "Skill trace not found" });
      }

      // Get related tool calls using within_skill field
      const toolCallRows = await query<{
        id: string;
        tool: string;
        input_summary: string;
        result_status: string;
        duration_ms: number;
      }>(
        `SELECT id, tool, input_summary, result_status, duration_ms
        FROM tool_uses
        WHERE execution_id = ? AND within_skill = ?
        LIMIT 50`,
        [executionId, skillId],
      );

      const toolCalls = toolCallRows.map((tu) => ({
        toolUseId: tu.id,
        tool: tu.tool,
        inputSummary: tu.input_summary || "",
        resultStatus: tu.result_status,
        durationMs: tu.duration_ms,
      }));

      // Get related assertions (by task if skill has a task)
      let assertions: Array<{
        id: string;
        category: string;
        description: string;
        result: string;
      }> = [];

      if (skillTrace.taskId) {
        const assertionsResult = await assertionService.getAssertions(
          executionId,
          {
            taskId: skillTrace.taskId,
            limit: 50,
            offset: 0,
          },
        );

        assertions = assertionsResult.data.map((a) => ({
          id: a.id,
          category: a.category,
          description: a.description,
          result: a.result,
        }));
      }

      return res.json({
        success: true,
        data: {
          skill: {
            id: skillTrace.id,
            executionId: skillTrace.executionId,
            taskId: skillTrace.taskId,
            skillName: skillTrace.skillName,
            skillFile: skillTrace.skillFile,
            lineNumber: skillTrace.lineNumber,
            sectionTitle: skillTrace.sectionTitle,
            inputSummary: skillTrace.inputSummary,
            outputSummary: skillTrace.outputSummary,
            startTime: skillTrace.startTime,
            endTime: skillTrace.endTime,
            durationMs: skillTrace.durationMs,
            tokenEstimate: skillTrace.tokenEstimate,
            status: skillTrace.status,
            errorMessage: skillTrace.errorMessage,
          },
          taskId: skillTrace.taskId,
          toolCalls,
          assertions,
        },
      });
    } catch (error) {
      console.error("Failed to fetch skill trace:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch skill trace" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/tool-summary
 * Get aggregated tool use statistics (using ToolUseService)
 */
router.get(
  "/executions/:id/tool-summary",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Use ToolUseService
      const summaryData = await toolUseService.getToolSummary(id);

      // Transform service response - byTool/byCategory contain objects with stats,
      // but ToolSummary expects simple count numbers
      const byToolCounts: Record<string, number> = {};
      for (const [tool, stats] of Object.entries(summaryData.byTool)) {
        byToolCounts[tool] = stats.count;
      }

      const byCategoryCounts: Record<string, number> = {};
      for (const [cat, stats] of Object.entries(summaryData.byCategory)) {
        byCategoryCounts[cat] = stats.count;
      }

      const summary: ToolSummary = {
        total: summaryData.total,
        byTool: byToolCounts as Record<ToolName, number>,
        byCategory: byCategoryCounts as Record<ToolCategory, number>,
        byStatus: summaryData.byStatus as unknown as Record<
          ToolResultStatus,
          number
        >,
        avgDurationMs: summaryData.avgDurationMs,
        errorRate: summaryData.errorRate,
        blockRate: summaryData.blockRate,
      };

      res.json({ success: true, data: summary });
    } catch (error) {
      console.error("Failed to fetch tool summary:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch tool summary" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/assertion-summary
 * Get aggregated assertion statistics (using AssertionService)
 */
router.get(
  "/executions/:id/assertion-summary",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Use AssertionService
      const summaryData = await assertionService.getAssertionSummary(id);

      const summary: AssertionSummary = {
        total: summaryData.summary.totalAssertions,
        passed: summaryData.summary.passed,
        failed: summaryData.summary.failed,
        skipped: summaryData.summary.skipped,
        warned: summaryData.summary.warnings,
        passRate: summaryData.summary.passRate,
        byCategory: Object.fromEntries(
          Object.entries(summaryData.byCategory).map(([cat, stats]) => [
            cat,
            { total: stats.total, passed: stats.passed },
          ]),
        ) as Record<AssertionCategory, { total: number; passed: number }>,
        chains: summaryData.chains,
      };

      res.json({ success: true, data: summary });
    } catch (error) {
      console.error("Failed to fetch assertion summary:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch assertion summary" });
    }
  },
);

/**
 * GET /api/observability/executions/:id/skills-summary
 * Get aggregated skill usage statistics (using SkillService)
 */
router.get(
  "/executions/:id/skills-summary",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Use SkillService
      const summaryData = await skillService.getSkillsSummary(id);

      res.json({ success: true, data: summaryData });
    } catch (error) {
      console.error("Failed to fetch skills summary:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch skills summary" });
    }
  },
);

/**
 * GET /api/observability/logs/message-bus/summary
 * Get message bus summary statistics (using MessageBusService)
 */
router.get("/logs/message-bus/summary", async (req: Request, res: Response) => {
  try {
    const executionId = req.query.executionId as string | undefined;

    // Use MessageBusService
    const summary = await messageBusService.getSummary(executionId);

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("Failed to fetch message bus summary:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch message bus summary" });
  }
});

/**
 * GET /api/observability/logs/message-bus/correlated/:correlationId
 * Get correlated events by correlation ID (using MessageBusService)
 */
router.get(
  "/logs/message-bus/correlated/:correlationId",
  async (req: Request, res: Response) => {
    try {
      const { correlationId } = req.params;

      // Use MessageBusService
      const correlatedEvents =
        await messageBusService.getCorrelatedEvents(correlationId);

      if (!correlatedEvents) {
        return res
          .status(404)
          .json({ success: false, error: "Correlation ID not found" });
      }

      return res.json({ success: true, data: correlatedEvents });
    } catch (error) {
      console.error("Failed to fetch correlated events:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch correlated events" });
    }
  },
);

/**
 * GET /api/observability/logs/message-bus
 * Get message bus log entries (using MessageBusService)
 */
router.get("/logs/message-bus", async (req: Request, res: Response) => {
  try {
    const { limit, offset } = buildPagination(req);
    const executionId = req.query.executionId as string | undefined;
    const severity = req.query.severity as string | undefined;
    const category = req.query.category as string | undefined;
    const source = req.query.source as string | undefined;

    // Use MessageBusService - cast string query params to proper enum types
    const result = await messageBusService.getLogs({
      executionId,
      severity: severity ? [severity as Severity] : undefined,
      category: category ? [category as MessageBusCategory] : undefined,
      source,
      limit,
      offset,
    });

    // Map service response to route response format
    const logs: MessageBusLogEntry[] = result.data.map((log) => ({
      id: log.id,
      eventId: log.eventId,
      timestamp: log.timestamp,
      source: log.source,
      eventType: log.eventType,
      correlationId: log.correlationId,
      humanSummary: log.humanSummary,
      severity: log.severity as MessageBusLogEntry["severity"],
      category: log.category as MessageBusLogEntry["category"],
      transcriptEntryId: log.transcriptEntryId,
      taskId: log.taskId,
      executionId: log.executionId,
      payload: log.payload,
      createdAt: log.createdAt,
    }));

    res.json({
      success: true,
      data: {
        data: logs,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Failed to fetch message bus logs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch logs" });
  }
});

/**
 * GET /api/observability/cross-refs/:entityType/:entityId
 * Get cross-references for an entity (using CrossReferenceService)
 */
router.get(
  "/cross-refs/:entityType/:entityId",
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;

      // Map route entity types to service entity types
      const entityTypeMap: Record<string, string> = {
        tool_use: "toolUse",
        assertion: "assertion",
        skill_trace: "skillTrace",
        transcript: "transcriptEntry",
      };

      const serviceEntityType = entityTypeMap[entityType];
      if (!serviceEntityType) {
        return res
          .status(400)
          .json({ success: false, error: "Unknown entity type" });
      }

      // Use CrossReferenceService
      const crossRefs = await crossReferenceService.getCrossReferences(
        serviceEntityType as
          | "toolUse"
          | "assertion"
          | "skillTrace"
          | "transcriptEntry",
        entityId,
      );

      if (!crossRefs) {
        return res
          .status(404)
          .json({ success: false, error: "Entity not found" });
      }

      // Convert service response to route response format
      const related: CrossReference["relatedTo"] = [];

      if (crossRefs.type === "toolUse") {
        const refs = crossRefs.refs;
        related.push({ type: "transcript", id: refs.transcriptEntry });
        if (refs.task) related.push({ type: "task", id: refs.task });
        if (refs.skill) related.push({ type: "skill_trace", id: refs.skill });
        if (refs.parentToolUse)
          related.push({ type: "tool_use", id: refs.parentToolUse });
        refs.childToolUses.forEach((id) =>
          related.push({ type: "tool_use", id }),
        );
        refs.relatedAssertions.forEach((id) =>
          related.push({ type: "assertion", id }),
        );
      } else if (crossRefs.type === "assertion") {
        const refs = crossRefs.refs;
        related.push({ type: "task", id: refs.task });
        if (refs.chain)
          related.push({ type: "assertion_chain", id: refs.chain });
        refs.transcriptEntries.forEach((id) =>
          related.push({ type: "transcript", id }),
        );
        refs.toolUses.forEach((id) => related.push({ type: "tool_use", id }));
      } else if (crossRefs.type === "skillTrace") {
        const refs = crossRefs.refs;
        related.push({ type: "task", id: refs.task });
        refs.transcriptEntries.forEach((id) =>
          related.push({ type: "transcript", id }),
        );
        refs.toolUses.forEach((id) => related.push({ type: "tool_use", id }));
        refs.assertions.forEach((id) =>
          related.push({ type: "assertion", id }),
        );
        if (refs.parentSkill)
          related.push({ type: "skill_trace", id: refs.parentSkill });
        refs.childSkills.forEach((id) =>
          related.push({ type: "skill_trace", id }),
        );
      } else if (crossRefs.type === "transcriptEntry") {
        const refs = crossRefs.refs;
        related.push({ type: "execution", id: refs.execution });
        if (refs.task) related.push({ type: "task", id: refs.task });
        if (refs.toolUse) related.push({ type: "tool_use", id: refs.toolUse });
        if (refs.skill) related.push({ type: "skill_trace", id: refs.skill });
        if (refs.assertion)
          related.push({ type: "assertion", id: refs.assertion });
      }

      const crossRef: CrossReference = {
        entityType: entityType as EntityType,
        entityId,
        relatedTo: related,
      };

      return res.json({ success: true, data: crossRef });
    } catch (error) {
      console.error("Failed to fetch cross references:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch cross references" });
    }
  },
);

/**
 * GET /api/observability/cross-refs/:entityType/:entityId/related
 * Get fully loaded related entities for an entity (using CrossReferenceService)
 */
router.get(
  "/cross-refs/:entityType/:entityId/related",
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const executionId = req.query.executionId as string | undefined;
      const includeTranscript = req.query.transcript === "true";
      const includeToolUses = req.query.toolUses === "true";
      const includeAssertions = req.query.assertions === "true";
      const includeSkills = req.query.skills === "true";

      // Map route entity types to service entity types
      const entityTypeMap: Record<string, string> = {
        tool_use: "toolUse",
        assertion: "assertion",
        skill_trace: "skillTrace",
        transcript: "transcriptEntry",
      };

      const serviceEntityType = entityTypeMap[entityType];
      if (!serviceEntityType) {
        return res
          .status(400)
          .json({ success: false, error: "Unknown entity type" });
      }

      // Use CrossReferenceService - executionId is optional for the service
      // but required by the type, so we'll provide an empty string as fallback
      const relatedEntities = await crossReferenceService.getRelatedEntities({
        entityType: serviceEntityType as
          | "toolUse"
          | "assertion"
          | "skillTrace"
          | "transcriptEntry",
        entityId,
        executionId: executionId || "", // Required by type but not used by service
        includeTranscript,
        includeToolUses,
        includeAssertions,
        includeSkills,
      });

      return res.json({ success: true, data: relatedEntities });
    } catch (error) {
      console.error("Failed to fetch related entities:", error);
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch related entities" });
    }
  },
);

// === Unified Search Endpoint ===

/**
 * GET /api/observability/search
 * Unified search across all observability data
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!q.trim()) {
      return res.json({
        success: true,
        data: {
          results: [],
          total: 0,
          limit,
          offset,
        },
      });
    }

    const searchTerm = `%${q.toLowerCase()}%`;
    const results: Array<{
      type: "event" | "execution" | "tool-use" | "agent" | "error";
      id: string;
      title: string;
      subtitle: string;
      timestamp: string;
      href: string;
    }> = [];

    // Search events
    try {
      const events = await query<{
        id: string;
        event_type: string;
        session_id: string;
        event_data: string;
        created_at: string;
      }>(
        `SELECT id, event_type, session_id, event_data, created_at
         FROM evaluation_events
         WHERE LOWER(event_type) LIKE ? OR LOWER(event_data) LIKE ?
         ORDER BY created_at DESC
         LIMIT 10`,
        [searchTerm, searchTerm],
      );
      for (const e of events) {
        let subtitle = e.event_type;
        try {
          const data = JSON.parse(e.event_data || "{}");
          if (data.message) subtitle = String(data.message).substring(0, 60);
        } catch {
          /* ignore */
        }
        results.push({
          type: "event",
          id: e.id,
          title: e.event_type,
          subtitle,
          timestamp: e.created_at,
          href: `/observability/events?session=${e.session_id}`,
        });
      }
    } catch {
      /* table may not exist */
    }

    // Search executions
    try {
      const executions = await query<{
        id: string;
        run_number: number;
        status: string;
        started_at: string;
        task_list_id: string;
      }>(
        `SELECT id, run_number, status, started_at, task_list_id
         FROM task_list_execution_runs
         WHERE CAST(run_number AS TEXT) LIKE ? OR LOWER(status) LIKE ? OR id LIKE ?
         ORDER BY started_at DESC
         LIMIT 10`,
        [searchTerm, searchTerm, searchTerm],
      );
      for (const e of executions) {
        results.push({
          type: "execution",
          id: e.id,
          title: `Run #${e.run_number}`,
          subtitle: `Status: ${e.status}`,
          timestamp: e.started_at,
          href: `/observability/executions/${e.id}`,
        });
      }
    } catch {
      /* table may not exist */
    }

    // Search tool uses
    try {
      const toolUses = await query<{
        id: string;
        tool: string;
        input_summary: string;
        output_summary: string;
        start_time: string;
        execution_id: string;
      }>(
        `SELECT id, tool, input_summary, output_summary, start_time, execution_id
         FROM tool_uses
         WHERE LOWER(tool) LIKE ? OR LOWER(input_summary) LIKE ? OR LOWER(output_summary) LIKE ?
         ORDER BY start_time DESC
         LIMIT 10`,
        [searchTerm, searchTerm, searchTerm],
      );
      for (const t of toolUses) {
        results.push({
          type: "tool-use",
          id: t.id,
          title: t.tool,
          subtitle: t.input_summary?.substring(0, 60) || "Tool call",
          timestamp: t.start_time,
          href: `/observability/executions/${t.execution_id}`,
        });
      }
    } catch {
      /* table may not exist */
    }

    // Search agents
    try {
      const agents = await query<{
        id: string;
        name: string;
        type: string;
        status: string;
        last_heartbeat: string;
      }>(
        `SELECT id, name, type, status, last_heartbeat
         FROM build_agent_instances
         WHERE LOWER(name) LIKE ? OR LOWER(type) LIKE ? OR id LIKE ?
         ORDER BY last_heartbeat DESC
         LIMIT 10`,
        [searchTerm, searchTerm, searchTerm],
      );
      for (const a of agents) {
        results.push({
          type: "agent",
          id: a.id,
          title: a.name || a.id,
          subtitle: `${a.type} - ${a.status}`,
          timestamp: a.last_heartbeat,
          href: `/observability/agents/${a.id}`,
        });
      }
    } catch {
      /* table may not exist */
    }

    // Search errors (failed assertions and tool errors)
    try {
      const errors = await query<{
        id: string;
        description: string;
        category: string;
        timestamp: string;
        execution_id: string;
      }>(
        `SELECT id, description, category, timestamp, execution_id
         FROM assertion_results
         WHERE result = 'fail' AND (LOWER(description) LIKE ? OR LOWER(category) LIKE ?)
         ORDER BY timestamp DESC
         LIMIT 10`,
        [searchTerm, searchTerm],
      );
      for (const e of errors) {
        results.push({
          type: "error",
          id: e.id,
          title: `Failed: ${e.category}`,
          subtitle: e.description?.substring(0, 60) || "Assertion failed",
          timestamp: e.timestamp,
          href: `/observability/executions/${e.execution_id}`,
        });
      }
    } catch {
      /* table may not exist */
    }

    // Sort by timestamp descending
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Apply pagination
    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return res.json({
      success: true,
      data: {
        results: paginatedResults,
        total,
        limit,
        offset,
        hasMore: offset + paginatedResults.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to search observability data:", error);
    return res.status(500).json({ success: false, error: "Failed to search" });
  }
});

// === Task-Scoped Endpoints (OBS-708 Support) ===

/**
 * GET /api/observability/tasks/:taskId/transcript
 * Get transcript entries for a specific task across all executions
 */
router.get("/tasks/:taskId/transcript", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { limit, offset } = buildPagination(req);

    // Query transcript entries filtered by task_id
    const entries = await query<{
      id: string;
      timestamp: string;
      sequence: number;
      execution_id: string;
      task_id: string;
      instance_id: string;
      wave_number: number | null;
      entry_type: string;
      category: string;
      summary: string;
      details: string | null;
      skill_ref: string | null;
      tool_calls: string | null;
      assertions: string | null;
      duration_ms: number | null;
      token_estimate: number | null;
      created_at: string;
    }>(
      `SELECT * FROM transcript_entries
       WHERE task_id = ?
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [taskId, limit, offset],
    );

    const countResult = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM transcript_entries WHERE task_id = ?`,
      [taskId],
    );
    const total = countResult[0]?.total || 0;

    const data = entries.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      sequence: e.sequence,
      executionId: e.execution_id,
      taskId: e.task_id,
      instanceId: e.instance_id,
      waveNumber: e.wave_number,
      entryType: e.entry_type,
      category: e.category,
      summary: e.summary,
      details: e.details ? JSON.parse(e.details) : null,
      skillRef: e.skill_ref ? JSON.parse(e.skill_ref) : null,
      toolCalls: e.tool_calls ? JSON.parse(e.tool_calls) : null,
      assertions: e.assertions ? JSON.parse(e.assertions) : null,
      durationMs: e.duration_ms,
      tokenEstimate: e.token_estimate,
      createdAt: e.created_at,
    }));

    res.json({
      success: true,
      data: {
        data,
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to fetch task transcript:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch task transcript" });
  }
});

/**
 * GET /api/observability/tasks/:taskId/tool-uses
 * Get tool uses for a specific task across all executions
 */
router.get("/tasks/:taskId/tool-uses", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { limit, offset } = buildPagination(req);

    const toolUses = await query<{
      id: string;
      execution_id: string;
      task_id: string;
      transcript_entry_id: string;
      tool: string;
      tool_category: string;
      input: string | null;
      input_summary: string;
      result_status: string;
      output: string | null;
      output_summary: string;
      is_error: number;
      is_blocked: number;
      error_message: string | null;
      block_reason: string | null;
      start_time: string;
      end_time: string;
      duration_ms: number;
      within_skill: string | null;
      parent_tool_use_id: string | null;
      created_at: string;
    }>(
      `SELECT * FROM tool_uses
       WHERE task_id = ?
       ORDER BY start_time DESC
       LIMIT ? OFFSET ?`,
      [taskId, limit, offset],
    );

    const countResult = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM tool_uses WHERE task_id = ?`,
      [taskId],
    );
    const total = countResult[0]?.total || 0;

    const data: ToolUse[] = toolUses.map((tu) => ({
      id: tu.id,
      executionId: tu.execution_id,
      taskId: tu.task_id,
      transcriptEntryId: tu.transcript_entry_id,
      tool: tu.tool as ToolName,
      toolCategory: tu.tool_category as ToolCategory,
      input: tu.input ? JSON.parse(tu.input) : {},
      inputSummary: tu.input_summary,
      resultStatus: tu.result_status as ToolResultStatus,
      output: tu.output ? JSON.parse(tu.output) : null,
      outputSummary: tu.output_summary,
      isError: tu.is_error === 1,
      isBlocked: tu.is_blocked === 1,
      errorMessage: tu.error_message,
      blockReason: tu.block_reason,
      startTime: tu.start_time,
      endTime: tu.end_time,
      durationMs: tu.duration_ms,
      withinSkill: tu.within_skill,
      parentToolUseId: tu.parent_tool_use_id,
      createdAt: tu.created_at,
    }));

    res.json({
      success: true,
      data: {
        data,
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to fetch task tool uses:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch task tool uses" });
  }
});

/**
 * GET /api/observability/tasks/:taskId/assertions
 * Get assertions for a specific task across all executions
 */
router.get("/tasks/:taskId/assertions", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { limit, offset } = buildPagination(req);

    const assertions = await query<{
      id: string;
      task_id: string;
      execution_id: string;
      category: string;
      description: string;
      result: string;
      evidence: string | null;
      chain_id: string | null;
      chain_position: number | null;
      timestamp: string;
      duration_ms: number | null;
      transcript_entry_id: string | null;
      created_at: string;
    }>(
      `SELECT * FROM assertion_results
       WHERE task_id = ?
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [taskId, limit, offset],
    );

    const countResult = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM assertion_results WHERE task_id = ?`,
      [taskId],
    );
    const total = countResult[0]?.total || 0;

    const data: AssertionResultEntry[] = assertions.map((a) => ({
      id: a.id,
      taskId: a.task_id,
      executionId: a.execution_id,
      category: a.category as AssertionCategory,
      description: a.description,
      result: a.result as AssertionResultEntry["result"],
      evidence: a.evidence ? JSON.parse(a.evidence) : {},
      chainId: a.chain_id,
      chainPosition: a.chain_position,
      timestamp: a.timestamp,
      durationMs: a.duration_ms,
      transcriptEntryId: a.transcript_entry_id,
      createdAt: a.created_at,
    }));

    res.json({
      success: true,
      data: {
        data,
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to fetch task assertions:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch task assertions" });
  }
});

/**
 * GET /api/observability/tasks/:taskId/skills
 * Get skill traces for a specific task across all executions
 */
router.get("/tasks/:taskId/skills", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { limit, offset } = buildPagination(req);

    const skills = await query<{
      id: string;
      execution_id: string;
      task_id: string;
      skill_name: string;
      skill_file: string;
      line_number: number | null;
      section_title: string | null;
      input_summary: string | null;
      output_summary: string | null;
      start_time: string;
      end_time: string | null;
      duration_ms: number | null;
      token_estimate: number | null;
      status: string;
      error_message: string | null;
      tool_calls: string | null;
      sub_skills: string | null;
      created_at: string;
    }>(
      `SELECT * FROM skill_traces
       WHERE task_id = ?
       ORDER BY start_time DESC
       LIMIT ? OFFSET ?`,
      [taskId, limit, offset],
    );

    const countResult = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM skill_traces WHERE task_id = ?`,
      [taskId],
    );
    const total = countResult[0]?.total || 0;

    const data: SkillTrace[] = skills.map((s) => ({
      id: s.id,
      executionId: s.execution_id,
      taskId: s.task_id,
      skillName: s.skill_name,
      skillFile: s.skill_file,
      lineNumber: s.line_number,
      sectionTitle: s.section_title,
      inputSummary: s.input_summary,
      outputSummary: s.output_summary,
      startTime: s.start_time,
      endTime: s.end_time,
      durationMs: s.duration_ms,
      tokenEstimate: s.token_estimate,
      status: s.status as SkillTrace["status"],
      errorMessage: s.error_message,
      toolCalls: s.tool_calls ? JSON.parse(s.tool_calls) : null,
      subSkills: s.sub_skills ? JSON.parse(s.sub_skills) : null,
      createdAt: s.created_at,
    }));

    res.json({
      success: true,
      data: {
        data,
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to fetch task skills:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch task skills" });
  }
});

// === Analytics Endpoints ===

/**
 * GET /api/observability/analytics/tool-usage
 * Get aggregated tool usage data with time-based filtering
 */
router.get("/analytics/tool-usage", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "24h";
    const timeFilter = getTimeFilter(range);

    // Get tool usage aggregates
    let toolData: Array<{
      tool: string;
      count: number;
      errors: number;
      avg_duration: number;
    }> = [];
    try {
      toolData = await query<(typeof toolData)[0]>(
        `SELECT
          tool,
          COUNT(*) as count,
          SUM(is_error) as errors,
          AVG(duration_ms) as avg_duration
         FROM tool_uses
         WHERE start_time > datetime('now', ?)
         GROUP BY tool
         ORDER BY count DESC`,
        [timeFilter],
      );
    } catch {
      // Table may not exist
    }

    // Get total stats
    let totals = { total: 0, errors: 0, blocked: 0 };
    try {
      const result = await query<{
        total: number;
        errors: number;
        blocked: number;
      }>(
        `SELECT
          COUNT(*) as total,
          SUM(is_error) as errors,
          SUM(is_blocked) as blocked
         FROM tool_uses
         WHERE start_time > datetime('now', ?)`,
        [timeFilter],
      );
      totals = result[0] || totals;
    } catch {
      // Table may not exist
    }

    res.json({
      success: true,
      data: {
        tools: toolData.map((t) => ({
          name: t.tool,
          count: t.count,
          errors: t.errors || 0,
          avgDurationMs: Math.round(t.avg_duration || 0),
        })),
        summary: {
          total: totals.total || 0,
          errors: totals.errors || 0,
          blocked: totals.blocked || 0,
          errorRate:
            totals.total > 0
              ? (((totals.errors || 0) / totals.total) * 100).toFixed(1)
              : "0.0",
        },
        range,
      },
    });
  } catch (error) {
    console.error("Failed to fetch tool usage analytics:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch tool usage analytics" });
  }
});

/**
 * GET /api/observability/analytics/assertions
 * Get assertion trends data with time-based filtering
 */
router.get("/analytics/assertions", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "24h";
    const timeFilter = getTimeFilter(range);

    // Get assertion stats
    let stats = { total: 0, passed: 0, failed: 0, skipped: 0, warned: 0 };
    try {
      const result = await query<{
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        warned: number;
      }>(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN result = 'skip' THEN 1 ELSE 0 END) as skipped,
          SUM(CASE WHEN result = 'warn' THEN 1 ELSE 0 END) as warned
         FROM assertion_results
         WHERE timestamp > datetime('now', ?)`,
        [timeFilter],
      );
      stats = result[0] || stats;
    } catch {
      // Table may not exist
    }

    // Get by category
    let byCategory: Array<{ category: string; total: number; passed: number }> =
      [];
    try {
      byCategory = await query<(typeof byCategory)[0]>(
        `SELECT
          category,
          COUNT(*) as total,
          SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed
         FROM assertion_results
         WHERE timestamp > datetime('now', ?)
         GROUP BY category
         ORDER BY total DESC`,
        [timeFilter],
      );
    } catch {
      // Table may not exist
    }

    const passRate =
      stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : "0.0";

    res.json({
      success: true,
      data: {
        summary: {
          total: stats.total || 0,
          passed: stats.passed || 0,
          failed: stats.failed || 0,
          skipped: stats.skipped || 0,
          warned: stats.warned || 0,
          passRate: `${passRate}%`,
        },
        byCategory: byCategory.map((c) => ({
          category: c.category,
          total: c.total,
          passed: c.passed,
          passRate:
            c.total > 0 ? ((c.passed / c.total) * 100).toFixed(1) : "0.0",
        })),
        range,
      },
    });
  } catch (error) {
    console.error("Failed to fetch assertion analytics:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch assertion analytics" });
  }
});

/**
 * GET /api/observability/analytics/durations
 * Get execution duration statistics
 */
router.get("/analytics/durations", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "24h";
    const timeFilter = getTimeFilter(range);

    // Get duration stats
    let stats = { avg: 0, min: 0, max: 0, p95: 0, count: 0 };
    try {
      const result = await query<{
        avg_duration: number;
        min_duration: number;
        max_duration: number;
        count: number;
      }>(
        `SELECT
          AVG(julianday(completed_at) - julianday(started_at)) * 86400 as avg_duration,
          MIN(julianday(completed_at) - julianday(started_at)) * 86400 as min_duration,
          MAX(julianday(completed_at) - julianday(started_at)) * 86400 as max_duration,
          COUNT(*) as count
         FROM task_list_execution_runs
         WHERE completed_at IS NOT NULL
           AND started_at > datetime('now', ?)`,
        [timeFilter],
      );
      if (result[0]) {
        stats = {
          avg: Math.round(result[0].avg_duration || 0),
          min: Math.round(result[0].min_duration || 0),
          max: Math.round(result[0].max_duration || 0),
          p95: 0, // Would need percentile calculation
          count: result[0].count || 0,
        };
      }
    } catch {
      // Table may not exist
    }

    // Get recent executions for trend
    let recentExecutions: Array<{
      id: string;
      duration: number;
      status: string;
      started_at: string;
    }> = [];
    try {
      recentExecutions = await query<(typeof recentExecutions)[0]>(
        `SELECT
          id,
          (julianday(completed_at) - julianday(started_at)) * 86400 as duration,
          status,
          started_at
         FROM task_list_execution_runs
         WHERE completed_at IS NOT NULL
           AND started_at > datetime('now', ?)
         ORDER BY started_at ASC
         LIMIT 50`,
        [timeFilter],
      );
    } catch {
      // Table may not exist
    }

    res.json({
      success: true,
      data: {
        summary: {
          avgSeconds: stats.avg,
          minSeconds: stats.min,
          maxSeconds: stats.max,
          p95Seconds: stats.p95,
          totalExecutions: stats.count,
        },
        trend: recentExecutions.map((e) => ({
          id: e.id,
          durationSeconds: Math.round(e.duration || 0),
          status: e.status,
          startedAt: e.started_at,
        })),
        range,
      },
    });
  } catch (error) {
    console.error("Failed to fetch duration analytics:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch duration analytics" });
  }
});

/**
 * GET /api/observability/analytics/errors
 * Get error hotspots
 */
router.get("/analytics/errors", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "24h";
    const timeFilter = getTimeFilter(range);

    // Get error locations from tool uses
    let toolErrors: Array<{
      tool: string;
      count: number;
      sample_error: string;
    }> = [];
    try {
      toolErrors = await query<(typeof toolErrors)[0]>(
        `SELECT
          tool,
          COUNT(*) as count,
          MAX(error_message) as sample_error
         FROM tool_uses
         WHERE is_error = 1
           AND start_time > datetime('now', ?)
         GROUP BY tool
         ORDER BY count DESC
         LIMIT 10`,
        [timeFilter],
      );
    } catch {
      // Table may not exist
    }

    // Get failed assertions
    let assertionFailures: Array<{
      category: string;
      count: number;
      sample_description: string;
    }> = [];
    try {
      assertionFailures = await query<(typeof assertionFailures)[0]>(
        `SELECT
          category,
          COUNT(*) as count,
          MAX(description) as sample_description
         FROM assertion_results
         WHERE result = 'fail'
           AND timestamp > datetime('now', ?)
         GROUP BY category
         ORDER BY count DESC
         LIMIT 10`,
        [timeFilter],
      );
    } catch {
      // Table may not exist
    }

    // Get failed executions
    let failedExecutions: Array<{
      id: string;
      started_at: string;
      run_number: number;
    }> = [];
    try {
      failedExecutions = await query<(typeof failedExecutions)[0]>(
        `SELECT id, started_at, run_number
         FROM task_list_execution_runs
         WHERE status = 'failed'
           AND started_at > datetime('now', ?)
         ORDER BY started_at DESC
         LIMIT 10`,
        [timeFilter],
      );
    } catch {
      // Table may not exist
    }

    res.json({
      success: true,
      data: {
        toolErrors: toolErrors.map((e) => ({
          tool: e.tool,
          count: e.count,
          sampleError: e.sample_error,
        })),
        assertionFailures: assertionFailures.map((f) => ({
          category: f.category,
          count: f.count,
          sampleDescription: f.sample_description,
        })),
        failedExecutions: failedExecutions.map((e) => ({
          id: e.id,
          runNumber: e.run_number,
          startedAt: e.started_at,
        })),
        range,
      },
    });
  } catch (error) {
    console.error("Failed to fetch error analytics:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch error analytics" });
  }
});

// === Data Producer Endpoints (Python API Client Support) ===

/**
 * POST /api/observability/executions
 * Create a new execution run (called by Python agents)
 */
router.post("/executions", async (req: Request, res: Response) => {
  try {
    const { taskListId, source, sessionId } = req.body;

    if (!taskListId) {
      res.status(400).json({
        success: false,
        error: "taskListId is required",
      });
      return;
    }

    // Import createExecutionRun from execution-manager
    const { createExecutionRun } =
      await import("../services/observability/execution-manager.js");

    const executionId = await createExecutionRun(taskListId, sessionId);

    // Optionally track source for analytics
    if (source) {
      try {
        await run(
          `UPDATE task_list_execution_runs SET source = ? WHERE id = ?`,
          [source, executionId],
        );
      } catch {
        // source column may not exist
      }
    }

    res.json({
      success: true,
      data: { executionId },
    });
  } catch (error) {
    console.error("Failed to create execution run:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create execution run",
    });
  }
});

/**
 * PUT /api/observability/executions/:id/complete
 * Complete an execution run
 */
router.put("/executions/:id/complete", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, summary } = req.body;

    if (!status || !["completed", "failed", "cancelled"].includes(status)) {
      res.status(400).json({
        success: false,
        error: "status must be 'completed', 'failed', or 'cancelled'",
      });
      return;
    }

    const { completeExecutionRun } =
      await import("../services/observability/execution-manager.js");

    await completeExecutionRun(id, status, summary);

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to complete execution run:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete execution run",
    });
  }
});

/**
 * POST /api/observability/executions/:id/heartbeat
 * Record a heartbeat for an agent instance
 */
router.post(
  "/executions/:id/heartbeat",
  async (req: Request, res: Response) => {
    try {
      const { id: executionId } = req.params;
      const { instanceId, status, metadata } = req.body;

      if (!instanceId) {
        res.status(400).json({
          success: false,
          error: "instanceId is required",
        });
        return;
      }

      // Update agent instance heartbeat
      const { run } = await import("../../database/db.js");
      await run(
        `INSERT INTO build_agent_instances (id, execution_id, status, metadata, last_heartbeat)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         metadata = excluded.metadata,
         last_heartbeat = excluded.last_heartbeat`,
        [
          instanceId,
          executionId,
          status || "running",
          JSON.stringify(metadata || {}),
        ],
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to record heartbeat:", error);
      res.status(500).json({
        success: false,
        error: "Failed to record heartbeat",
      });
    }
  },
);

/**
 * POST /api/observability/executions/:id/tool-uses
 * Log a tool use (start or complete)
 */
router.post(
  "/executions/:id/tool-uses",
  async (req: Request, res: Response) => {
    try {
      const { id: executionId } = req.params;
      const { tool, input, output, isError, durationMs, taskId, complete } =
        req.body;

      if (!tool) {
        res.status(400).json({
          success: false,
          error: "tool is required",
        });
        return;
      }

      const toolUseId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Summarize input/output
      const summarize = (data: unknown, maxLen = 500): string => {
        if (!data) return "";
        const s =
          typeof data === "object" ? JSON.stringify(data) : String(data);
        return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s;
      };

      const { run } = await import("../../database/db.js");

      if (complete) {
        // Insert complete record
        await run(
          `INSERT INTO tool_uses (
          id, execution_id, task_id, tool, tool_category,
          input, input_summary, output, output_summary,
          is_error, result_status, start_time, end_time, duration_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            toolUseId,
            executionId,
            taskId || null,
            tool,
            "custom",
            JSON.stringify(input || {}),
            summarize(input, 200),
            JSON.stringify(output || {}),
            summarize(output, 200),
            isError ? 1 : 0,
            isError ? "error" : "success",
            now,
            now,
            durationMs || 0,
            now,
          ],
        );
      } else {
        // Insert start record (will be completed later)
        await run(
          `INSERT INTO tool_uses (
          id, execution_id, task_id, tool, tool_category,
          input, input_summary, result_status, start_time, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            toolUseId,
            executionId,
            taskId || null,
            tool,
            "custom",
            JSON.stringify(input || {}),
            summarize(input, 200),
            "pending",
            now,
            now,
          ],
        );
      }

      res.json({
        success: true,
        data: { toolUseId },
      });
    } catch (error) {
      console.error("Failed to log tool use:", error);
      res.status(500).json({
        success: false,
        error: "Failed to log tool use",
      });
    }
  },
);

/**
 * PUT /api/observability/tool-uses/:id/complete
 * Complete a tool use record
 */
router.put("/tool-uses/:id/complete", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { output, isError, durationMs } = req.body;

    const summarize = (data: unknown, maxLen = 500): string => {
      if (!data) return "";
      const s = typeof data === "object" ? JSON.stringify(data) : String(data);
      return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s;
    };

    const { run } = await import("../../database/db.js");
    const now = new Date().toISOString();

    await run(
      `UPDATE tool_uses SET
       output = ?,
       output_summary = ?,
       is_error = ?,
       result_status = ?,
       end_time = ?,
       duration_ms = COALESCE(?, (strftime('%s', ?) - strftime('%s', start_time)) * 1000)
     WHERE id = ?`,
      [
        JSON.stringify(output || {}),
        summarize(output, 200),
        isError ? 1 : 0,
        isError ? "error" : "success",
        now,
        durationMs || null,
        now,
        id,
      ],
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to complete tool use:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete tool use",
    });
  }
});

/**
 * POST /api/observability/executions/:id/assertion-chains
 * Start an assertion chain
 */
router.post(
  "/executions/:id/assertion-chains",
  async (req: Request, res: Response) => {
    try {
      const { id: executionId } = req.params;
      const { taskId, name } = req.body;

      if (!taskId || !name) {
        res.status(400).json({
          success: false,
          error: "taskId and name are required",
        });
        return;
      }

      const chainId = crypto.randomUUID();
      const now = new Date().toISOString();

      const { run } = await import("../../database/db.js");

      await run(
        `INSERT INTO assertion_chains (
        id, execution_id, task_id, name, status, started_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [chainId, executionId, taskId, name, "running", now, now],
      );

      res.json({
        success: true,
        data: { chainId },
      });
    } catch (error) {
      console.error("Failed to start assertion chain:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start assertion chain",
      });
    }
  },
);

/**
 * POST /api/observability/assertion-chains/:id/assertions
 * Record an assertion result
 */
router.post(
  "/assertion-chains/:id/assertions",
  async (req: Request, res: Response) => {
    try {
      const { id: chainId } = req.params;
      const { description, passed, evidence, category } = req.body;

      if (!description) {
        res.status(400).json({
          success: false,
          error: "description is required",
        });
        return;
      }

      const assertionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const { run, query } = await import("../../database/db.js");

      // Get next position in chain
      const posResult = await query<{ max_pos: number }>(
        `SELECT COALESCE(MAX(chain_position), 0) as max_pos FROM assertion_results WHERE chain_id = ?`,
        [chainId],
      );
      const position = (posResult[0]?.max_pos || 0) + 1;

      // Get execution_id and task_id from chain
      const chainInfo = await query<{ execution_id: string; task_id: string }>(
        `SELECT execution_id, task_id FROM assertion_chains WHERE id = ?`,
        [chainId],
      );

      if (chainInfo.length === 0) {
        res.status(404).json({
          success: false,
          error: "Assertion chain not found",
        });
        return;
      }

      await run(
        `INSERT INTO assertion_results (
        id, execution_id, task_id, chain_id, chain_position,
        category, description, result, evidence, timestamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assertionId,
          chainInfo[0].execution_id,
          chainInfo[0].task_id,
          chainId,
          position,
          category || "validation",
          description,
          passed ? "pass" : "fail",
          JSON.stringify(evidence || {}),
          now,
          now,
        ],
      );

      res.json({
        success: true,
        data: { assertionId },
      });
    } catch (error) {
      console.error("Failed to record assertion:", error);
      res.status(500).json({
        success: false,
        error: "Failed to record assertion",
      });
    }
  },
);

/**
 * PUT /api/observability/assertion-chains/:id/complete
 * Complete an assertion chain
 */
router.put(
  "/assertion-chains/:id/complete",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { passed, summary } = req.body;

      const { run } = await import("../../database/db.js");
      const now = new Date().toISOString();

      await run(
        `UPDATE assertion_chains SET
       status = ?,
       summary = ?,
       completed_at = ?
     WHERE id = ?`,
        [passed ? "passed" : "failed", summary || null, now, id],
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to complete assertion chain:", error);
      res.status(500).json({
        success: false,
        error: "Failed to complete assertion chain",
      });
    }
  },
);

/**
 * POST /api/observability/executions/:id/phases
 * Log the start of an execution phase
 */
router.post("/executions/:id/phases", async (req: Request, res: Response) => {
  try {
    const { id: executionId } = req.params;
    const { name, metadata } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        error: "name is required",
      });
      return;
    }

    const phaseId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { run } = await import("../../database/db.js");

    // Insert as transcript entry with phase type
    await run(
      `INSERT INTO transcript_entries (
        id, execution_id, entry_type, category, summary, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        phaseId,
        executionId,
        "phase_start",
        "system",
        `Phase: ${name}`,
        JSON.stringify({ name, metadata: metadata || {} }),
        now,
      ],
    );

    res.json({
      success: true,
      data: { phaseId },
    });
  } catch (error) {
    console.error("Failed to log phase start:", error);
    res.status(500).json({
      success: false,
      error: "Failed to log phase start",
    });
  }
});

/**
 * PUT /api/observability/phases/:id/complete
 * Complete an execution phase
 */
router.put("/phases/:id/complete", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, summary } = req.body;

    const { run } = await import("../../database/db.js");
    const now = new Date().toISOString();

    // Insert phase completion as new transcript entry
    await run(
      `INSERT INTO transcript_entries (
        id, execution_id, entry_type, category, summary, details, created_at
      ) SELECT
        ?,
        execution_id,
        'phase_complete',
        'system',
        ?,
        ?,
        ?
      FROM transcript_entries WHERE id = ?`,
      [
        crypto.randomUUID(),
        `Phase completed: ${status || "completed"}`,
        JSON.stringify({ phaseId: id, status: status || "completed", summary }),
        now,
        id,
      ],
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to complete phase:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete phase",
    });
  }
});

/**
 * Helper function to convert time range to SQLite datetime modifier
 */
function getTimeFilter(range: string): string {
  switch (range) {
    case "1h":
      return "-1 hour";
    case "6h":
      return "-6 hours";
    case "24h":
      return "-24 hours";
    case "7d":
      return "-7 days";
    default:
      return "-24 hours";
  }
}

// Mount memory graph observability routes
import { memoryGraphRouter } from "./observability/memory-graph-routes.js";
router.use("/memory-graph", memoryGraphRouter);

export default router;
