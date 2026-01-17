/**
 * OBS-305: Cross-Reference Service
 *
 * Entity linking and navigation between observability entities.
 * Uses the project's sql.js database wrapper.
 */

import { query, getOne } from "../../../database/db.js";
import type {
  CrossRefEntityType,
  ToolUseCrossRefs,
  AssertionCrossRefs,
  SkillTraceCrossRefs,
  TranscriptEntryCrossRefs,
  EntityCrossRefs,
  RelatedEntitiesResult,
  RelatedEntitiesRequest,
} from "../../../frontend/src/types/observability/cross-refs.js";
import type { TranscriptEntry } from "../../../frontend/src/types/observability/transcript.js";
import type { ToolUse } from "../../../frontend/src/types/observability/tool-use.js";
import type { AssertionResult } from "../../../frontend/src/types/observability/assertion.js";
import type { SkillTrace } from "../../../frontend/src/types/observability/skill.js";

export class CrossReferenceService {
  /**
   * Get cross-references for any entity type.
   */
  async getCrossReferences(
    entityType: CrossRefEntityType,
    entityId: string,
  ): Promise<EntityCrossRefs | null> {
    switch (entityType) {
      case "toolUse":
        const toolRefs = await this.getToolUseCrossRefs(entityId);
        return toolRefs ? { type: "toolUse", refs: toolRefs } : null;

      case "assertion":
        const assertionRefs = await this.getAssertionCrossRefs(entityId);
        return assertionRefs
          ? { type: "assertion", refs: assertionRefs }
          : null;

      case "skillTrace":
        const skillRefs = await this.getSkillTraceCrossRefs(entityId);
        return skillRefs ? { type: "skillTrace", refs: skillRefs } : null;

      case "transcriptEntry":
        const entryRefs = await this.getTranscriptEntryCrossRefs(entityId);
        return entryRefs ? { type: "transcriptEntry", refs: entryRefs } : null;

      default:
        return null;
    }
  }

  /**
   * Get cross-references for a tool use.
   */
  async getToolUseCrossRefs(
    toolUseId: string,
  ): Promise<ToolUseCrossRefs | null> {
    const row = await getOne<ToolUseRefRow>(
      `SELECT
        transcript_entry_id,
        task_id,
        within_skill,
        parent_tool_use_id
      FROM tool_uses
      WHERE id = ?`,
      [toolUseId],
    );

    if (!row) return null;

    // Get child tool uses
    const childRows = await query<{ id: string }>(
      `SELECT id FROM tool_uses WHERE parent_tool_use_id = ?`,
      [toolUseId],
    );

    // Get related assertions (where this tool use is referenced in evidence)
    const assertionRows = await query<{ id: string }>(
      `SELECT id FROM assertion_results WHERE evidence LIKE ?`,
      [`%${toolUseId}%`],
    );

    return {
      transcriptEntry: row.transcript_entry_id,
      task: row.task_id || undefined,
      skill: row.within_skill || undefined,
      parentToolUse: row.parent_tool_use_id || undefined,
      childToolUses: childRows.map((r) => r.id),
      relatedAssertions: assertionRows.map((r) => r.id),
    };
  }

  /**
   * Get cross-references for an assertion.
   */
  async getAssertionCrossRefs(
    assertionId: string,
  ): Promise<AssertionCrossRefs | null> {
    const row = await getOne<AssertionRefRow>(
      `SELECT
        task_id,
        chain_id,
        chain_position,
        transcript_entry_id
      FROM assertion_results
      WHERE id = ?`,
      [assertionId],
    );

    if (!row) return null;

    // Get related transcript entries (via chain or same task)
    const transcriptRows = await query<{ id: string }>(
      `SELECT id FROM transcript_entries
      WHERE entry_type = 'assertion' AND task_id = ?
      ORDER BY sequence`,
      [row.task_id],
    );

    // Get tool uses referenced in evidence
    const assertion = await getOne<{ evidence: string }>(
      `SELECT evidence FROM assertion_results WHERE id = ?`,
      [assertionId],
    );

    const toolUseIds: string[] = [];
    if (assertion?.evidence) {
      // Parse evidence for tool use references
      try {
        const evidence = JSON.parse(assertion.evidence);
        if (evidence.toolUseId) toolUseIds.push(evidence.toolUseId);
        if (evidence.relatedEntities) {
          for (const entity of evidence.relatedEntities) {
            if (entity.type === "tool_use") toolUseIds.push(entity.id);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Get previous/next in chain
    let previousInChain: string | undefined;
    let nextInChain: string | undefined;

    if (row.chain_id && row.chain_position !== null) {
      const prev = await getOne<{ id: string }>(
        `SELECT id FROM assertion_results
        WHERE chain_id = ? AND chain_position = ?`,
        [row.chain_id, row.chain_position - 1],
      );
      if (prev) previousInChain = prev.id;

      const next = await getOne<{ id: string }>(
        `SELECT id FROM assertion_results
        WHERE chain_id = ? AND chain_position = ?`,
        [row.chain_id, row.chain_position + 1],
      );
      if (next) nextInChain = next.id;
    }

    return {
      task: row.task_id,
      chain: row.chain_id || undefined,
      transcriptEntries: transcriptRows.map((r) => r.id),
      toolUses: toolUseIds,
      previousInChain,
      nextInChain,
    };
  }

  /**
   * Get cross-references for a skill trace.
   */
  async getSkillTraceCrossRefs(
    traceId: string,
  ): Promise<SkillTraceCrossRefs | null> {
    const row = await getOne<SkillTraceRefRow>(
      `SELECT
        task_id,
        tool_calls,
        sub_skills
      FROM skill_traces
      WHERE id = ?`,
      [traceId],
    );

    if (!row) return null;

    // Get transcript entries during this skill
    const transcriptRows = await query<{ id: string }>(
      `SELECT te.id
      FROM transcript_entries te
      JOIN skill_traces st ON st.execution_id = te.execution_id
      WHERE st.id = ?
        AND te.timestamp >= st.start_time
        AND (st.end_time IS NULL OR te.timestamp <= st.end_time)
      ORDER BY te.sequence`,
      [traceId],
    );

    // Get tool uses during this skill
    const toolRows = await query<{ id: string }>(
      `SELECT id FROM tool_uses WHERE within_skill = ?`,
      [traceId],
    );

    // Get assertions made by this skill
    const assertionRows = await query<{ id: string }>(
      `SELECT ar.id
      FROM assertion_results ar
      JOIN skill_traces st ON st.task_id = ar.task_id
      WHERE st.id = ?
        AND ar.timestamp >= st.start_time
        AND (st.end_time IS NULL OR ar.timestamp <= st.end_time)`,
      [traceId],
    );

    // Parse sub-skills and find parent skill
    const subSkills: string[] = row.sub_skills
      ? this.parseJson<string[]>(row.sub_skills) || []
      : [];

    // Check if this skill has a parent
    const parent = await getOne<{ id: string }>(
      `SELECT id FROM skill_traces WHERE sub_skills LIKE ?`,
      [`%${traceId}%`],
    );

    return {
      task: row.task_id,
      transcriptEntries: transcriptRows.map((r) => r.id),
      toolUses: toolRows.map((r) => r.id),
      assertions: assertionRows.map((r) => r.id),
      parentSkill: parent?.id,
      childSkills: subSkills,
    };
  }

  /**
   * Get cross-references for a transcript entry.
   */
  async getTranscriptEntryCrossRefs(
    entryId: string,
  ): Promise<TranscriptEntryCrossRefs | null> {
    const row = await getOne<TranscriptEntryRefRow>(
      `SELECT
        execution_id,
        task_id,
        entry_type,
        sequence,
        tool_calls,
        skill_ref
      FROM transcript_entries
      WHERE id = ?`,
      [entryId],
    );

    if (!row) return null;

    // Get associated tool use (if tool_use entry)
    let toolUse: string | undefined;
    if (row.entry_type === "tool_use") {
      const toolUseRow = await getOne<{ id: string }>(
        `SELECT id FROM tool_uses WHERE transcript_entry_id = ?`,
        [entryId],
      );
      toolUse = toolUseRow?.id;
    }

    // Get associated skill (if skill_invoke entry)
    let skill: string | undefined;
    if (row.entry_type === "skill_invoke" && row.skill_ref) {
      try {
        const skillRef = JSON.parse(row.skill_ref);
        // Find matching skill trace
        const skillRow = await getOne<{ id: string }>(
          `SELECT id FROM skill_traces
          WHERE execution_id = ? AND skill_name = ?
          ORDER BY start_time DESC
          LIMIT 1`,
          [row.execution_id, skillRef.skillName],
        );
        skill = skillRow?.id;
      } catch {
        // Ignore parse errors
      }
    }

    // Get associated assertion (if assertion entry)
    let assertion: string | undefined;
    if (row.entry_type === "assertion") {
      const assertionRow = await getOne<{ id: string }>(
        `SELECT id FROM assertion_results WHERE transcript_entry_id = ?`,
        [entryId],
      );
      assertion = assertionRow?.id;
    }

    // Get previous/next entries
    const prev = await getOne<{ id: string }>(
      `SELECT id FROM transcript_entries
      WHERE execution_id = ? AND sequence = ?`,
      [row.execution_id, row.sequence - 1],
    );

    const next = await getOne<{ id: string }>(
      `SELECT id FROM transcript_entries
      WHERE execution_id = ? AND sequence = ?`,
      [row.execution_id, row.sequence + 1],
    );

    return {
      execution: row.execution_id,
      task: row.task_id || undefined,
      toolUse,
      skill,
      assertion,
      previousEntry: prev?.id,
      nextEntry: next?.id,
    };
  }

  /**
   * Get fully loaded related entities.
   */
  async getRelatedEntities(
    request: RelatedEntitiesRequest,
  ): Promise<RelatedEntitiesResult> {
    const result: RelatedEntitiesResult = {
      transcriptEntries: [],
      toolUses: [],
      assertions: [],
      skillTraces: [],
    };

    const crossRefs = await this.getCrossReferences(
      request.entityType,
      request.entityId,
    );
    if (!crossRefs) return result;

    // Load transcript entries if requested
    if (request.includeTranscript) {
      let entryIds: string[] = [];
      if (crossRefs.type === "toolUse") {
        entryIds = [crossRefs.refs.transcriptEntry];
      } else if (crossRefs.type === "assertion") {
        entryIds = crossRefs.refs.transcriptEntries;
      } else if (crossRefs.type === "skillTrace") {
        entryIds = crossRefs.refs.transcriptEntries;
      }

      if (entryIds.length > 0) {
        const placeholders = entryIds.map(() => "?").join(",");
        const rows = await query<TranscriptEntryRow>(
          `SELECT * FROM transcript_entries WHERE id IN (${placeholders})`,
          entryIds,
        );
        result.transcriptEntries = rows.map((r) => this.mapTranscriptEntry(r));
      }
    }

    // Load tool uses if requested
    if (request.includeToolUses) {
      let toolUseIds: string[] = [];
      if (crossRefs.type === "assertion") {
        toolUseIds = crossRefs.refs.toolUses;
      } else if (crossRefs.type === "skillTrace") {
        toolUseIds = crossRefs.refs.toolUses;
      } else if (crossRefs.type === "toolUse") {
        toolUseIds = crossRefs.refs.childToolUses;
        if (crossRefs.refs.parentToolUse) {
          toolUseIds.push(crossRefs.refs.parentToolUse);
        }
      }

      if (toolUseIds.length > 0) {
        const placeholders = toolUseIds.map(() => "?").join(",");
        const rows = await query<ToolUseRow>(
          `SELECT * FROM tool_uses WHERE id IN (${placeholders})`,
          toolUseIds,
        );
        result.toolUses = rows.map((r) => this.mapToolUse(r));
      }
    }

    // Load assertions if requested
    if (request.includeAssertions) {
      let assertionIds: string[] = [];
      if (crossRefs.type === "toolUse") {
        assertionIds = crossRefs.refs.relatedAssertions;
      } else if (crossRefs.type === "skillTrace") {
        assertionIds = crossRefs.refs.assertions;
      }

      if (assertionIds.length > 0) {
        const placeholders = assertionIds.map(() => "?").join(",");
        const rows = await query<AssertionRow>(
          `SELECT * FROM assertion_results WHERE id IN (${placeholders})`,
          assertionIds,
        );
        result.assertions = rows.map((r) => this.mapAssertion(r));
      }
    }

    // Load skill traces if requested
    if (request.includeSkills) {
      let skillIds: string[] = [];
      if (crossRefs.type === "toolUse" && crossRefs.refs.skill) {
        skillIds = [crossRefs.refs.skill];
      } else if (crossRefs.type === "skillTrace") {
        skillIds = crossRefs.refs.childSkills;
        if (crossRefs.refs.parentSkill) {
          skillIds.push(crossRefs.refs.parentSkill);
        }
      }

      if (skillIds.length > 0) {
        const placeholders = skillIds.map(() => "?").join(",");
        const rows = await query<SkillTraceRow>(
          `SELECT * FROM skill_traces WHERE id IN (${placeholders})`,
          skillIds,
        );
        result.skillTraces = rows.map((r) => this.mapSkillTrace(r));
      }
    }

    return result;
  }

  /**
   * Map database row to TranscriptEntry.
   */
  private mapTranscriptEntry(row: TranscriptEntryRow): TranscriptEntry {
    return {
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
      details: this.parseJson(row.details),
      skillRef: this.parseJson(row.skill_ref),
      toolCalls: this.parseJson(row.tool_calls),
      assertions: this.parseJson(row.assertions),
      durationMs: row.duration_ms,
      tokenEstimate: row.token_estimate,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to ToolUse.
   */
  private mapToolUse(row: ToolUseRow): ToolUse {
    return {
      id: row.id,
      executionId: row.execution_id,
      taskId: row.task_id,
      transcriptEntryId: row.transcript_entry_id,
      tool: row.tool,
      toolCategory: row.tool_category as ToolUse["toolCategory"],
      input: this.parseJson(row.input) || {},
      inputSummary: row.input_summary,
      resultStatus: row.result_status as ToolUse["resultStatus"],
      output: this.parseJson(row.output),
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
    };
  }

  /**
   * Map database row to AssertionResult.
   */
  private mapAssertion(row: AssertionRow): AssertionResult {
    return {
      id: row.id,
      taskId: row.task_id,
      executionId: row.execution_id,
      chainId: row.chain_id,
      chainPosition: row.chain_position,
      category: row.category as AssertionResult["category"],
      description: row.description,
      result: row.result as AssertionResult["result"],
      evidence: this.parseJson(row.evidence) || {},
      timestamp: row.timestamp,
      durationMs: row.duration_ms,
      transcriptEntryId: row.transcript_entry_id,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to SkillTrace.
   */
  private mapSkillTrace(row: SkillTraceRow): SkillTrace {
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
  private parseJson<T>(json: string | null | undefined): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }
}

// Internal row types
interface ToolUseRefRow {
  transcript_entry_id: string;
  task_id: string | null;
  within_skill: string | null;
  parent_tool_use_id: string | null;
}

interface AssertionRefRow {
  task_id: string;
  chain_id: string | null;
  chain_position: number | null;
  transcript_entry_id: string | null;
}

interface SkillTraceRefRow {
  task_id: string;
  tool_calls: string | null;
  sub_skills: string | null;
}

interface TranscriptEntryRefRow {
  execution_id: string;
  task_id: string | null;
  entry_type: string;
  sequence: number;
  tool_calls: string | null;
  skill_ref: string | null;
}

// Full row types for mapping
interface TranscriptEntryRow {
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
}

interface ToolUseRow {
  id: string;
  execution_id: string;
  task_id: string | null;
  transcript_entry_id: string;
  tool: string;
  tool_category: string;
  input?: string;
  input_summary: string;
  result_status: string;
  output?: string;
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
}

interface AssertionRow {
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
}

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

// Export singleton instance
export const crossReferenceService = new CrossReferenceService();
