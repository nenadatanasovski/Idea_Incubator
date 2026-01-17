/**
 * OBS-304: Skill Service
 *
 * Query skill traces and compute usage summaries.
 * Uses the project's sql.js database wrapper.
 */

import { query, getOne } from "../../../database/db.js";
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
  /**
   * Get skill traces for an execution with filtering.
   */
  async getSkillTraces(
    executionId: string,
    skillQuery: SkillTraceQuery = {},
  ): Promise<PaginatedResponse<SkillTrace>> {
    const limit = skillQuery.limit || 100;
    const offset = skillQuery.offset || 0;
    const conditions: string[] = ["execution_id = ?"];
    const params: (string | number)[] = [executionId];

    // Filter by task
    if (skillQuery.taskId) {
      conditions.push("task_id = ?");
      params.push(skillQuery.taskId);
    }

    // Filter by skill name
    if (skillQuery.skillName) {
      conditions.push("skill_name = ?");
      params.push(skillQuery.skillName);
    }

    // Filter by skill file
    if (skillQuery.skillFile) {
      conditions.push("skill_file = ?");
      params.push(skillQuery.skillFile);
    }

    // Filter by status
    if (skillQuery.status?.length) {
      const placeholders = skillQuery.status.map(() => "?").join(",");
      conditions.push(`status IN (${placeholders})`);
      params.push(...skillQuery.status);
    }

    // Time filters
    if (skillQuery.fromTime) {
      conditions.push("start_time >= ?");
      params.push(skillQuery.fromTime);
    }

    if (skillQuery.toTime) {
      conditions.push("end_time <= ?");
      params.push(skillQuery.toTime);
    }

    const whereClause = conditions.join(" AND ");

    const rows = await query<SkillTraceRow>(
      `SELECT
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
      LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    // Get total count
    const countResult = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count
      FROM skill_traces
      WHERE ${whereClause}`,
      params,
    );
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
  async getSkillTrace(traceId: string): Promise<SkillTrace | null> {
    const row = await getOne<SkillTraceRow>(
      `SELECT
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
      WHERE id = ?`,
      [traceId],
    );

    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * Get skills usage summary for an execution.
   */
  async getSkillsSummary(
    executionId: string,
  ): Promise<SkillsUsageSummaryResponse> {
    // Get overall counts
    const totals = await getOne<{ total: number; uniqueSkills: number }>(
      `SELECT
        COUNT(*) as total,
        COUNT(DISTINCT skill_name) as uniqueSkills
      FROM skill_traces
      WHERE execution_id = ?`,
      [executionId],
    );

    // Get skills with stats
    const skillRows = await query<SkillStatsRow>(
      `SELECT
        skill_name,
        skill_file,
        COUNT(*) as invocationCount,
        SUM(duration_ms) as totalDurationMs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount
      FROM skill_traces
      WHERE execution_id = ?
      GROUP BY skill_name, skill_file
      ORDER BY invocationCount DESC`,
      [executionId],
    );

    const skills: SkillsUsageSummary["skills"] = [];
    for (const row of skillRows) {
      // Get sections used for this skill
      const sections = await query<{ section_title: string; count: number }>(
        `SELECT section_title, COUNT(*) as count
        FROM skill_traces
        WHERE execution_id = ? AND skill_name = ? AND section_title IS NOT NULL
        GROUP BY section_title`,
        [executionId, row.skill_name],
      );

      skills.push({
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
      });
    }

    // Get skill file references
    const fileRefRows = await query<FileRefRow>(
      `SELECT
        skill_file,
        GROUP_CONCAT(DISTINCT line_number) as lines,
        GROUP_CONCAT(DISTINCT section_title) as sections,
        COUNT(*) as invocationCount,
        SUM(duration_ms) as totalDurationMs
      FROM skill_traces
      WHERE execution_id = ?
      GROUP BY skill_file`,
      [executionId],
    );

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
    const byStatusRows = await query<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count
      FROM skill_traces
      WHERE execution_id = ?
      GROUP BY status`,
      [executionId],
    );

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
    const timeline = await getOne<{ firstSkill: string; lastSkill: string }>(
      `SELECT
        MIN(start_time) as firstSkill,
        MAX(COALESCE(end_time, start_time)) as lastSkill
      FROM skill_traces
      WHERE execution_id = ?`,
      [executionId],
    );

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

// Export singleton instance
export const skillService = new SkillService();
