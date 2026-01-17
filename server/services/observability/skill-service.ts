/**
 * OBS-304: Skill Service
 *
 * Query skill traces and compute usage summaries.
 */

import Database from "better-sqlite3";
import type {
  SkillTraceQuery,
  SkillsUsageSummaryResponse,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type {
  SkillTrace,
  SkillsUsageSummary,
  SkillFileReference,
} from "../../../frontend/src/types/observability/skill.js";

export class SkillService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Get skill traces for an execution with filtering.
   */
  getSkillTraces(
    executionId: string,
    query: SkillTraceQuery = {},
  ): PaginatedResponse<SkillTrace> {
    const limit = query.limit || 100;
    const offset = query.offset || 0;
    const conditions: string[] = ["execution_id = ?"];
    const params: (string | number)[] = [executionId];

    // Filter by task
    if (query.taskId) {
      conditions.push("task_id = ?");
      params.push(query.taskId);
    }

    // Filter by skill name
    if (query.skillName) {
      conditions.push("skill_name = ?");
      params.push(query.skillName);
    }

    // Filter by skill file
    if (query.skillFile) {
      conditions.push("skill_file = ?");
      params.push(query.skillFile);
    }

    // Filter by status
    if (query.status?.length) {
      const placeholders = query.status.map(() => "?").join(",");
      conditions.push(`status IN (${placeholders})`);
      params.push(...query.status);
    }

    // Time filters
    if (query.fromTime) {
      conditions.push("start_time >= ?");
      params.push(query.fromTime);
    }

    if (query.toTime) {
      conditions.push("end_time <= ?");
      params.push(query.toTime);
    }

    const whereClause = conditions.join(" AND ");

    const sql = `
      SELECT
        id,
        execution_id,
        task_id,
        skill_name,
        skill_file,
        line_number,
        section_title,
        input_summary,
        output_summary,
        start_time,
        end_time,
        duration_ms,
        token_estimate,
        status,
        error_message,
        tool_calls,
        sub_skills,
        created_at
      FROM skill_traces
      WHERE ${whereClause}
      ORDER BY start_time ASC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db
      .prepare(sql)
      .all(...params, limit, offset) as SkillTraceRow[];

    // Get total count
    const countParams = params.slice();
    const countSql = `
      SELECT COUNT(*) as count
      FROM skill_traces
      WHERE ${whereClause}
    `;
    const countResult = this.db.prepare(countSql).get(...countParams) as {
      count: number;
    };
    const total = countResult?.count || 0;

    const data = rows.map((row) => this.mapRow(row));

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Get a single skill trace by ID.
   */
  getSkillTrace(traceId: string): SkillTrace | null {
    const sql = `
      SELECT
        id,
        execution_id,
        task_id,
        skill_name,
        skill_file,
        line_number,
        section_title,
        input_summary,
        output_summary,
        start_time,
        end_time,
        duration_ms,
        token_estimate,
        status,
        error_message,
        tool_calls,
        sub_skills,
        created_at
      FROM skill_traces
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(traceId) as SkillTraceRow | undefined;
    if (!row) return null;

    return this.mapRow(row);
  }

  /**
   * Get skills usage summary for an execution.
   */
  getSkillsSummary(executionId: string): SkillsUsageSummaryResponse {
    // Get overall counts
    const totals = this.db
      .prepare(
        `
        SELECT
          COUNT(*) as total,
          COUNT(DISTINCT skill_name) as uniqueSkills
        FROM skill_traces
        WHERE execution_id = ?
      `,
      )
      .get(executionId) as { total: number; uniqueSkills: number } | undefined;

    // Get skills with stats
    const skillRows = this.db
      .prepare(
        `
        SELECT
          skill_name,
          skill_file,
          COUNT(*) as invocationCount,
          SUM(duration_ms) as totalDurationMs,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount
        FROM skill_traces
        WHERE execution_id = ?
        GROUP BY skill_name, skill_file
        ORDER BY invocationCount DESC
      `,
      )
      .all(executionId) as SkillStatsRow[];

    const skills: SkillsUsageSummary["skills"] = skillRows.map((row) => {
      // Get sections used for this skill
      const sections = this.db
        .prepare(
          `
          SELECT section_title, COUNT(*) as count
          FROM skill_traces
          WHERE execution_id = ? AND skill_name = ? AND section_title IS NOT NULL
          GROUP BY section_title
        `,
        )
        .all(executionId, row.skill_name) as {
        section_title: string;
        count: number;
      }[];

      return {
        skillName: row.skill_name,
        skillFile: row.skill_file,
        invocationCount: row.invocationCount,
        totalDurationMs: row.totalDurationMs || 0,
        successRate:
          row.invocationCount > 0 ? row.successCount / row.invocationCount : 0,
        sections: sections.map((s) => ({
          section: s.section_title,
          count: s.count,
        })),
      };
    });

    // Get skill file references
    const fileRefRows = this.db
      .prepare(
        `
        SELECT
          skill_file,
          GROUP_CONCAT(DISTINCT line_number) as lines,
          GROUP_CONCAT(DISTINCT section_title) as sections,
          COUNT(*) as invocationCount,
          SUM(duration_ms) as totalDurationMs
        FROM skill_traces
        WHERE execution_id = ?
        GROUP BY skill_file
      `,
      )
      .all(executionId) as FileRefRow[];

    const skillFileReferences: SkillFileReference[] = fileRefRows.map(
      (row) => ({
        file: row.skill_file,
        linesReferenced: row.lines
          ? row.lines
              .split(",")
              .map((l) => parseInt(l, 10))
              .filter((l) => !isNaN(l))
          : [],
        sectionsUsed: row.sections
          ? row.sections.split(",").filter(Boolean)
          : [],
        invocationCount: row.invocationCount,
        totalDurationMs: row.totalDurationMs || 0,
      }),
    );

    // Get by status
    const byStatusRows = this.db
      .prepare(
        `
        SELECT status, COUNT(*) as count
        FROM skill_traces
        WHERE execution_id = ?
        GROUP BY status
      `,
      )
      .all(executionId) as { status: string; count: number }[];

    const byStatus: SkillsUsageSummary["byStatus"] = {
      success: 0,
      partial: 0,
      failed: 0,
    };

    for (const row of byStatusRows) {
      if (row.status === "success") byStatus.success = row.count;
      else if (row.status === "partial") byStatus.partial = row.count;
      else if (row.status === "failed") byStatus.failed = row.count;
    }

    // Get timeline
    const timeline = this.db
      .prepare(
        `
        SELECT
          MIN(start_time) as firstSkill,
          MAX(COALESCE(end_time, start_time)) as lastSkill
        FROM skill_traces
        WHERE execution_id = ?
      `,
      )
      .get(executionId) as
      | { firstSkill: string; lastSkill: string }
      | undefined;

    return {
      executionId,
      totalSkillInvocations: totals?.total || 0,
      uniqueSkillsUsed: totals?.uniqueSkills || 0,
      skills,
      skillFileReferences,
      byStatus,
      timeline: {
        firstSkill: timeline?.firstSkill || "",
        lastSkill: timeline?.lastSkill || "",
      },
    };
  }

  /**
   * Map database row to SkillTrace.
   */
  private mapRow(row: SkillTraceRow): SkillTrace {
    return {
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
      toolCalls: this.parseJson(row.tool_calls),
      subSkills: this.parseJson(row.sub_skills),
      createdAt: row.created_at,
    };
  }

  /**
   * Safely parse JSON string.
   */
  private parseJson<T>(json: string | null): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }

  close(): void {
    this.db.close();
  }
}

// Internal row types
interface SkillTraceRow {
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
}

interface SkillStatsRow {
  skill_name: string;
  skill_file: string;
  invocationCount: number;
  totalDurationMs: number;
  successCount: number;
}

interface FileRefRow {
  skill_file: string;
  lines: string;
  sections: string;
  invocationCount: number;
  totalDurationMs: number;
}
