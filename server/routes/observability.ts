/**
 * Observability API Routes
 * Exposes transcript, tool use, assertion, and skill trace data for UI
 */

import { Router, Request, Response } from "express";
import { query } from "../../database/db.js";
import type {
  TranscriptEntry,
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
} from "../types/observability.js";

const router = Router();

// === Overview Dashboard Endpoints ===

/**
 * GET /api/observability/stats
 * Get quick stats for the overview dashboard
 */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    // Safely query each table - handle missing tables gracefully
    let execStats = { active_count: 0, total_recent: 0, failed_recent: 0 };
    let blockedCount = 0;
    let pendingCount = 0;

    try {
      const results = await query<{
        active_count: number;
        total_recent: number;
        failed_recent: number;
      }>(
        `SELECT
          (SELECT COUNT(*) FROM task_list_execution_runs WHERE status = 'running') as active_count,
          (SELECT COUNT(*) FROM task_list_execution_runs WHERE started_at > datetime('now', '-24 hours')) as total_recent,
          (SELECT COUNT(*) FROM task_list_execution_runs WHERE status = 'failed' AND started_at > datetime('now', '-24 hours')) as failed_recent`,
        [],
      );
      execStats = results[0] || execStats;
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
      execStats.total_recent > 0
        ? ((execStats.failed_recent / execStats.total_recent) * 100).toFixed(1)
        : "0.0";

    res.json({
      success: true,
      data: {
        activeExecutions: execStats.active_count,
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

function parseJsonSafe<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function buildPagination(req: Request): { limit: number; offset: number } {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  return { limit, offset };
}

// === Executions ===

/**
 * GET /api/observability/executions
 * List all execution runs with optional filtering
 */
router.get("/executions", async (req: Request, res: Response) => {
  try {
    const { limit, offset } = buildPagination(req);
    const status = req.query.status as string | undefined;
    const taskListId = req.query.taskListId as string | undefined;

    let whereClause = "1=1";
    const params: (string | number | boolean)[] = [];

    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }
    if (taskListId) {
      whereClause += " AND task_list_id = ?";
      params.push(taskListId);
    }

    const [rows, countResult] = await Promise.all([
      query<{
        id: string;
        task_list_id: string;
        run_number: number;
        status: string;
        started_at: string;
        completed_at: string | null;
        session_id: string | null;
      }>(
        `SELECT id, task_list_id, run_number, status, started_at, completed_at, session_id
         FROM task_list_execution_runs
         WHERE ${whereClause}
         ORDER BY started_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      query<{ count: number }>(
        `SELECT COUNT(*) as count FROM task_list_execution_runs WHERE ${whereClause}`,
        params,
      ),
    ]);

    const total = countResult[0]?.count || 0;

    const executions: ExecutionRun[] = rows.map((row) => ({
      id: row.id,
      taskListId: row.task_list_id,
      runNumber: row.run_number,
      status: row.status as ExecutionRun["status"],
      startedAt: row.started_at,
      completedAt: row.completed_at,
      sessionId: row.session_id,
      waveCount: 0,
      taskCount: 0,
      completedCount: 0,
      failedCount: 0,
    }));

    res.json({
      success: true,
      data: {
        data: executions,
        total,
        limit,
        offset,
        hasMore: offset + executions.length < total,
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
 * GET /api/observability/executions/:id
 * Get a single execution with stats
 */
router.get("/executions/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rows = await query<{
      id: string;
      task_list_id: string;
      run_number: number;
      status: string;
      started_at: string;
      completed_at: string | null;
      session_id: string | null;
    }>(
      `SELECT id, task_list_id, run_number, status, started_at, completed_at, session_id
       FROM task_list_execution_runs
       WHERE id = ?`,
      [id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Execution not found" });
    }

    const row = rows[0];

    // Get wave/task counts
    const stats = await query<{
      wave_count: number;
      task_count: number;
      completed_count: number;
      failed_count: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM parallel_execution_waves WHERE execution_run_id = ?) as wave_count,
        (SELECT COUNT(DISTINCT wta.task_id) FROM wave_task_assignments wta
         JOIN parallel_execution_waves pew ON pew.id = wta.wave_id
         WHERE pew.execution_run_id = ?) as task_count,
        (SELECT COUNT(*) FROM transcript_entries WHERE execution_id = ? AND entry_type = 'task_end') as completed_count,
        (SELECT COUNT(*) FROM transcript_entries WHERE execution_id = ? AND entry_type = 'error') as failed_count`,
      [id, id, id, id],
    );

    const s = stats[0] || {
      wave_count: 0,
      task_count: 0,
      completed_count: 0,
      failed_count: 0,
    };

    const execution: ExecutionRun = {
      id: row.id,
      taskListId: row.task_list_id,
      runNumber: row.run_number,
      status: row.status as ExecutionRun["status"],
      startedAt: row.started_at,
      completedAt: row.completed_at,
      sessionId: row.session_id,
      waveCount: s.wave_count,
      taskCount: s.task_count,
      completedCount: s.completed_count,
      failedCount: s.failed_count,
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
 * GET /api/observability/executions/:id/transcript
 * Get transcript entries for an execution
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

      let whereClause = "execution_id = ?";
      const params: (string | number | boolean)[] = [id];

      if (entryType) {
        whereClause += " AND entry_type = ?";
        params.push(entryType);
      }
      if (category) {
        whereClause += " AND category = ?";
        params.push(category);
      }
      if (taskId) {
        whereClause += " AND task_id = ?";
        params.push(taskId);
      }

      const [rows, countResult] = await Promise.all([
        query<{
          id: string;
          timestamp: string;
          sequence: number;
          execution_id: string;
          task_id: string | null;
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
         WHERE ${whereClause}
         ORDER BY sequence ASC
         LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        ),
        query<{ count: number }>(
          `SELECT COUNT(*) as count FROM transcript_entries WHERE ${whereClause}`,
          params,
        ),
      ]);

      const total = countResult[0]?.count || 0;

      const entries: TranscriptEntry[] = rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        sequence: row.sequence,
        executionId: row.execution_id,
        taskId: row.task_id,
        instanceId: row.instance_id,
        waveNumber: row.wave_number,
        entryType: row.entry_type as TranscriptEntry["entryType"],
        category: row.category as TranscriptEntry["category"],
        summary: row.summary,
        details: parseJsonSafe(row.details),
        skillRef: parseJsonSafe(row.skill_ref),
        toolCalls: parseJsonSafe(row.tool_calls),
        assertions: parseJsonSafe(row.assertions),
        durationMs: row.duration_ms,
        tokenEstimate: row.token_estimate,
        createdAt: row.created_at,
      }));

      res.json({
        success: true,
        data: {
          data: entries,
          total,
          limit,
          offset,
          hasMore: offset + entries.length < total,
        },
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
 * GET /api/observability/executions/:id/tool-uses
 * Get tool uses for an execution
 */
router.get("/executions/:id/tool-uses", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = buildPagination(req);
    const tool = req.query.tool as string | undefined;
    const category = req.query.category as string | undefined;
    const status = req.query.status as string | undefined;
    const isError = req.query.isError as string | undefined;

    let whereClause = "execution_id = ?";
    const params: (string | number | boolean)[] = [id];

    if (tool) {
      whereClause += " AND tool = ?";
      params.push(tool);
    }
    if (category) {
      whereClause += " AND tool_category = ?";
      params.push(category);
    }
    if (status) {
      whereClause += " AND result_status = ?";
      params.push(status);
    }
    if (isError === "true") {
      whereClause += " AND is_error = 1";
    }

    const [rows, countResult] = await Promise.all([
      query<{
        id: string;
        execution_id: string;
        task_id: string | null;
        transcript_entry_id: string;
        tool: string;
        tool_category: string;
        input: string;
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
         WHERE ${whereClause}
         ORDER BY start_time ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      query<{ count: number }>(
        `SELECT COUNT(*) as count FROM tool_uses WHERE ${whereClause}`,
        params,
      ),
    ]);

    const total = countResult[0]?.count || 0;

    const toolUses: ToolUse[] = rows.map((row) => ({
      id: row.id,
      executionId: row.execution_id,
      taskId: row.task_id,
      transcriptEntryId: row.transcript_entry_id,
      tool: row.tool as ToolName,
      toolCategory: row.tool_category as ToolCategory,
      input: parseJsonSafe(row.input) || {},
      inputSummary: row.input_summary,
      resultStatus: row.result_status as ToolResultStatus,
      output: parseJsonSafe(row.output),
      outputSummary: row.output_summary,
      isError: row.is_error === 1,
      isBlocked: row.is_blocked === 1,
      errorMessage: row.error_message,
      blockReason: row.block_reason,
      startTime: row.start_time,
      endTime: row.end_time,
      durationMs: row.duration_ms,
      withinSkill: row.within_skill,
      parentToolUseId: row.parent_tool_use_id,
      createdAt: row.created_at,
    }));

    res.json({
      success: true,
      data: {
        data: toolUses,
        total,
        limit,
        offset,
        hasMore: offset + toolUses.length < total,
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
 * GET /api/observability/executions/:id/assertions
 * Get assertions for an execution
 */
router.get(
  "/executions/:id/assertions",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { limit, offset } = buildPagination(req);
      const result = req.query.result as string | undefined;
      const category = req.query.category as string | undefined;

      let whereClause = "execution_id = ?";
      const params: (string | number | boolean)[] = [id];

      if (result) {
        whereClause += " AND result = ?";
        params.push(result);
      }
      if (category) {
        whereClause += " AND category = ?";
        params.push(category);
      }

      const [rows, countResult] = await Promise.all([
        query<{
          id: string;
          task_id: string;
          execution_id: string;
          category: string;
          description: string;
          result: string;
          evidence: string;
          chain_id: string | null;
          chain_position: number | null;
          timestamp: string;
          duration_ms: number | null;
          transcript_entry_id: string | null;
          created_at: string;
        }>(
          `SELECT * FROM assertion_results
         WHERE ${whereClause}
         ORDER BY timestamp ASC
         LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        ),
        query<{ count: number }>(
          `SELECT COUNT(*) as count FROM assertion_results WHERE ${whereClause}`,
          params,
        ),
      ]);

      const total = countResult[0]?.count || 0;

      const assertions: AssertionResultEntry[] = rows.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        executionId: row.execution_id,
        category: row.category as AssertionCategory,
        description: row.description,
        result: row.result as AssertionResultEntry["result"],
        evidence: parseJsonSafe(row.evidence) || {},
        chainId: row.chain_id,
        chainPosition: row.chain_position,
        timestamp: row.timestamp,
        durationMs: row.duration_ms,
        transcriptEntryId: row.transcript_entry_id,
        createdAt: row.created_at,
      }));

      res.json({
        success: true,
        data: {
          data: assertions,
          total,
          limit,
          offset,
          hasMore: offset + assertions.length < total,
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
 * GET /api/observability/executions/:id/skills
 * Get skill traces for an execution
 */
router.get("/executions/:id/skills", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = buildPagination(req);

    const [rows, countResult] = await Promise.all([
      query<{
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
         WHERE execution_id = ?
         ORDER BY start_time ASC
         LIMIT ? OFFSET ?`,
        [id, limit, offset],
      ),
      query<{ count: number }>(
        `SELECT COUNT(*) as count FROM skill_traces WHERE execution_id = ?`,
        [id],
      ),
    ]);

    const total = countResult[0]?.count || 0;

    const skills: SkillTrace[] = rows.map((row) => ({
      id: row.id,
      executionId: row.execution_id,
      taskId: row.task_id,
      skillName: row.skill_name,
      skillFile: row.skill_file,
      lineNumber: row.line_number,
      sectionTitle: row.section_title,
      inputSummary: row.input_summary,
      outputSummary: row.output_summary,
      startTime: row.start_time,
      endTime: row.end_time,
      durationMs: row.duration_ms,
      tokenEstimate: row.token_estimate,
      status: row.status as SkillTrace["status"],
      errorMessage: row.error_message,
      toolCalls: parseJsonSafe(row.tool_calls),
      subSkills: parseJsonSafe(row.sub_skills),
      createdAt: row.created_at,
    }));

    res.json({
      success: true,
      data: {
        data: skills,
        total,
        limit,
        offset,
        hasMore: offset + skills.length < total,
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
 * GET /api/observability/executions/:id/tool-summary
 * Get aggregated tool use statistics
 */
router.get(
  "/executions/:id/tool-summary",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [byTool, byCategory, byStatus, totals] = await Promise.all([
        query<{ tool: string; count: number }>(
          `SELECT tool, COUNT(*) as count FROM tool_uses WHERE execution_id = ? GROUP BY tool`,
          [id],
        ),
        query<{ tool_category: string; count: number }>(
          `SELECT tool_category, COUNT(*) as count FROM tool_uses WHERE execution_id = ? GROUP BY tool_category`,
          [id],
        ),
        query<{ result_status: string; count: number }>(
          `SELECT result_status, COUNT(*) as count FROM tool_uses WHERE execution_id = ? GROUP BY result_status`,
          [id],
        ),
        query<{
          total: number;
          avg_duration: number;
          error_count: number;
          block_count: number;
        }>(
          `SELECT
          COUNT(*) as total,
          AVG(duration_ms) as avg_duration,
          SUM(is_error) as error_count,
          SUM(is_blocked) as block_count
         FROM tool_uses
         WHERE execution_id = ?`,
          [id],
        ),
      ]);

      const t = totals[0] || {
        total: 0,
        avg_duration: 0,
        error_count: 0,
        block_count: 0,
      };

      const summary: ToolSummary = {
        total: t.total,
        byTool: Object.fromEntries(
          byTool.map((r) => [r.tool, r.count]),
        ) as Record<ToolName, number>,
        byCategory: Object.fromEntries(
          byCategory.map((r) => [r.tool_category, r.count]),
        ) as Record<ToolCategory, number>,
        byStatus: Object.fromEntries(
          byStatus.map((r) => [r.result_status, r.count]),
        ) as Record<ToolResultStatus, number>,
        avgDurationMs: Math.round(t.avg_duration || 0),
        errorRate: t.total > 0 ? (t.error_count || 0) / t.total : 0,
        blockRate: t.total > 0 ? (t.block_count || 0) / t.total : 0,
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
 * Get aggregated assertion statistics
 */
router.get(
  "/executions/:id/assertion-summary",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const [byResult, byCategory, chainStats] = await Promise.all([
        query<{ result: string; count: number }>(
          `SELECT result, COUNT(*) as count FROM assertion_results WHERE execution_id = ? GROUP BY result`,
          [id],
        ),
        query<{ category: string; total: number; passed: number }>(
          `SELECT
          category,
          COUNT(*) as total,
          SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed
         FROM assertion_results
         WHERE execution_id = ?
         GROUP BY category`,
          [id],
        ),
        query<{ overall_result: string; count: number }>(
          `SELECT overall_result, COUNT(*) as count FROM assertion_chains WHERE execution_id = ? GROUP BY overall_result`,
          [id],
        ),
      ]);

      const resultCounts = Object.fromEntries(
        byResult.map((r) => [r.result, r.count]),
      );
      const total = Object.values(resultCounts).reduce((a, b) => a + b, 0);
      const passed = resultCounts["pass"] || 0;

      const chainCounts = Object.fromEntries(
        chainStats.map((r) => [r.overall_result, r.count]),
      );
      const chainTotal = Object.values(chainCounts).reduce((a, b) => a + b, 0);

      const summary: AssertionSummary = {
        total,
        passed,
        failed: resultCounts["fail"] || 0,
        skipped: resultCounts["skip"] || 0,
        warned: resultCounts["warn"] || 0,
        passRate: total > 0 ? passed / total : 0,
        byCategory: Object.fromEntries(
          byCategory.map((r) => [
            r.category,
            { total: r.total, passed: r.passed },
          ]),
        ) as Record<AssertionCategory, { total: number; passed: number }>,
        chains: {
          total: chainTotal,
          passed: chainCounts["pass"] || 0,
          failed: chainCounts["fail"] || 0,
          partial: chainCounts["partial"] || 0,
        },
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
 * GET /api/observability/logs/message-bus
 * Get message bus log entries
 */
router.get("/logs/message-bus", async (req: Request, res: Response) => {
  try {
    const { limit, offset } = buildPagination(req);
    const executionId = req.query.executionId as string | undefined;
    const severity = req.query.severity as string | undefined;
    const category = req.query.category as string | undefined;
    const source = req.query.source as string | undefined;

    let whereClause = "1=1";
    const params: (string | number | boolean)[] = [];

    if (executionId) {
      whereClause += " AND execution_id = ?";
      params.push(executionId);
    }
    if (severity) {
      whereClause += " AND severity = ?";
      params.push(severity);
    }
    if (category) {
      whereClause += " AND category = ?";
      params.push(category);
    }
    if (source) {
      whereClause += " AND source = ?";
      params.push(source);
    }

    const [rows, countResult] = await Promise.all([
      query<{
        id: string;
        event_id: string;
        timestamp: string;
        source: string;
        event_type: string;
        correlation_id: string | null;
        human_summary: string;
        severity: string;
        category: string;
        transcript_entry_id: string | null;
        task_id: string | null;
        execution_id: string | null;
        payload: string | null;
        created_at: string;
      }>(
        `SELECT * FROM message_bus_log
         WHERE ${whereClause}
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      query<{ count: number }>(
        `SELECT COUNT(*) as count FROM message_bus_log WHERE ${whereClause}`,
        params,
      ),
    ]);

    const total = countResult[0]?.count || 0;

    const logs: MessageBusLogEntry[] = rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      timestamp: row.timestamp,
      source: row.source,
      eventType: row.event_type,
      correlationId: row.correlation_id,
      humanSummary: row.human_summary,
      severity: row.severity as MessageBusLogEntry["severity"],
      category: row.category as MessageBusLogEntry["category"],
      transcriptEntryId: row.transcript_entry_id,
      taskId: row.task_id,
      executionId: row.execution_id,
      payload: parseJsonSafe(row.payload),
      createdAt: row.created_at,
    }));

    res.json({
      success: true,
      data: {
        data: logs,
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error("Failed to fetch message bus logs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch logs" });
  }
});

/**
 * GET /api/observability/cross-refs/:entityType/:entityId
 * Get cross-references for an entity
 */
router.get(
  "/cross-refs/:entityType/:entityId",
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const related: CrossReference["relatedTo"] = [];

      switch (entityType as EntityType) {
        case "tool_use": {
          // Get related transcript entry, task, skill
          const toolUse = await query<{
            transcript_entry_id: string;
            task_id: string | null;
            within_skill: string | null;
            execution_id: string;
          }>(
            `SELECT transcript_entry_id, task_id, within_skill, execution_id FROM tool_uses WHERE id = ?`,
            [entityId],
          );
          if (toolUse.length > 0) {
            const t = toolUse[0];
            related.push({ type: "execution", id: t.execution_id });
            related.push({ type: "transcript", id: t.transcript_entry_id });
            if (t.task_id) related.push({ type: "task", id: t.task_id });
            if (t.within_skill)
              related.push({ type: "skill_trace", id: t.within_skill });
          }
          break;
        }
        case "assertion": {
          const assertion = await query<{
            task_id: string;
            execution_id: string;
            chain_id: string | null;
            transcript_entry_id: string | null;
          }>(
            `SELECT task_id, execution_id, chain_id, transcript_entry_id FROM assertion_results WHERE id = ?`,
            [entityId],
          );
          if (assertion.length > 0) {
            const a = assertion[0];
            related.push({ type: "execution", id: a.execution_id });
            related.push({ type: "task", id: a.task_id });
            if (a.chain_id)
              related.push({ type: "assertion_chain", id: a.chain_id });
            if (a.transcript_entry_id)
              related.push({ type: "transcript", id: a.transcript_entry_id });
          }
          break;
        }
        case "skill_trace": {
          const skill = await query<{
            execution_id: string;
            task_id: string;
            tool_calls: string | null;
          }>(
            `SELECT execution_id, task_id, tool_calls FROM skill_traces WHERE id = ?`,
            [entityId],
          );
          if (skill.length > 0) {
            const s = skill[0];
            related.push({ type: "execution", id: s.execution_id });
            related.push({ type: "task", id: s.task_id });
            const toolCalls = parseJsonSafe<string[]>(s.tool_calls);
            if (toolCalls) {
              toolCalls.forEach((id) => related.push({ type: "tool_use", id }));
            }
          }
          break;
        }
        case "transcript": {
          const entry = await query<{
            execution_id: string;
            task_id: string | null;
            skill_ref: string | null;
            tool_calls: string | null;
          }>(
            `SELECT execution_id, task_id, skill_ref, tool_calls FROM transcript_entries WHERE id = ?`,
            [entityId],
          );
          if (entry.length > 0) {
            const e = entry[0];
            related.push({ type: "execution", id: e.execution_id });
            if (e.task_id) related.push({ type: "task", id: e.task_id });
            // Tool uses
            const toolCalls = parseJsonSafe<Array<{ toolUseId: string }>>(
              e.tool_calls,
            );
            if (toolCalls) {
              toolCalls.forEach((tc) =>
                related.push({ type: "tool_use", id: tc.toolUseId }),
              );
            }
          }
          break;
        }
        default:
          return res
            .status(400)
            .json({ success: false, error: "Unknown entity type" });
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

export default router;
