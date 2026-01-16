/**
 * Task Appendix Service
 *
 * CRUD operations for task appendices (11 appendix types).
 * Part of: Task System V2 Implementation Plan (IMPL-3.2)
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  TaskAppendix,
  CreateTaskAppendixInput,
  UpdateTaskAppendixInput,
  AppendixType,
  ResolvedAppendix,
  TaskAppendixRow,
  mapTaskAppendixRow,
} from "../../../types/task-appendix.js";

/**
 * Task Appendix Service class
 */
export class TaskAppendixService {
  /**
   * Create a new appendix
   */
  async create(input: CreateTaskAppendixInput): Promise<TaskAppendix> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const contentType = input.content ? "inline" : "reference";

    // Get max position for ordering
    const maxPosResult = await getOne<{ max_pos: number | null }>(
      "SELECT MAX(position) as max_pos FROM task_appendices WHERE task_id = ?",
      [input.taskId],
    );
    const position = input.position ?? (maxPosResult?.max_pos ?? -1) + 1;

    await run(
      `INSERT INTO task_appendices (id, task_id, appendix_type, content_type, content, reference_id, reference_table, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.taskId,
        input.appendixType,
        contentType,
        input.content || null,
        input.referenceId || null,
        input.referenceTable || null,
        position,
        now,
        now,
      ],
    );

    await saveDb();

    const created = await this.getById(id);
    if (!created) {
      throw new Error("Failed to create task appendix");
    }
    return created;
  }

  /**
   * Get appendix by ID
   */
  async getById(id: string): Promise<TaskAppendix | null> {
    const row = await getOne<TaskAppendixRow>(
      "SELECT * FROM task_appendices WHERE id = ?",
      [id],
    );
    return row ? mapTaskAppendixRow(row) : null;
  }

  /**
   * Get all appendices for a task
   */
  async getByTaskId(taskId: string): Promise<TaskAppendix[]> {
    const rows = await query<TaskAppendixRow>(
      "SELECT * FROM task_appendices WHERE task_id = ? ORDER BY position",
      [taskId],
    );
    return rows.map(mapTaskAppendixRow);
  }

  /**
   * Get appendices by task ID and type
   */
  async getByTaskIdAndType(
    taskId: string,
    type: AppendixType,
  ): Promise<TaskAppendix[]> {
    const rows = await query<TaskAppendixRow>(
      "SELECT * FROM task_appendices WHERE task_id = ? AND appendix_type = ? ORDER BY position",
      [taskId, type],
    );
    return rows.map(mapTaskAppendixRow);
  }

  /**
   * Update an appendix
   */
  async update(
    id: string,
    updates: UpdateTaskAppendixInput,
  ): Promise<TaskAppendix> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Task appendix ${id} not found`);
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.appendixType !== undefined) {
      fields.push("appendix_type = ?");
      values.push(updates.appendixType);
    }
    if (updates.content !== undefined) {
      fields.push("content = ?");
      fields.push("content_type = ?");
      values.push(updates.content);
      values.push("inline");
    }
    if (updates.referenceId !== undefined) {
      fields.push("reference_id = ?");
      values.push(updates.referenceId);
      if (!updates.content) {
        fields.push("content_type = ?");
        values.push("reference");
      }
    }
    if (updates.referenceTable !== undefined) {
      fields.push("reference_table = ?");
      values.push(updates.referenceTable);
    }
    if (updates.position !== undefined) {
      fields.push("position = ?");
      values.push(updates.position);
    }

    if (fields.length > 0) {
      fields.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(id);

      await run(
        `UPDATE task_appendices SET ${fields.join(", ")} WHERE id = ?`,
        values,
      );
      await saveDb();
    }

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error("Failed to update task appendix");
    }
    return updated;
  }

  /**
   * Delete an appendix
   */
  async delete(id: string): Promise<void> {
    await run("DELETE FROM task_appendices WHERE id = ?", [id]);
    await saveDb();
  }

  /**
   * Resolve an appendix (load content from reference if needed)
   */
  async resolve(appendix: TaskAppendix): Promise<ResolvedAppendix> {
    let resolvedContent: string;

    if (appendix.contentType === "inline") {
      resolvedContent = appendix.content || "";
    } else {
      // Load from reference table
      resolvedContent = await this.resolveReference(
        appendix.referenceTable || "",
        appendix.referenceId || "",
      );
    }

    return {
      ...appendix,
      resolvedContent,
    };
  }

  /**
   * Resolve all appendices for a task
   */
  async resolveAll(taskId: string): Promise<ResolvedAppendix[]> {
    const appendices = await this.getByTaskId(taskId);
    return Promise.all(appendices.map((a) => this.resolve(a)));
  }

  /**
   * Reorder appendices for a task
   */
  async reorder(taskId: string, appendixIds: string[]): Promise<void> {
    for (let i = 0; i < appendixIds.length; i++) {
      await run(
        "UPDATE task_appendices SET position = ?, updated_at = ? WHERE id = ? AND task_id = ?",
        [i, new Date().toISOString(), appendixIds[i], taskId],
      );
    }
    await saveDb();
  }

  /**
   * Attach knowledge base entries as appendices
   */
  async attachFromKnowledgeBase(
    taskId: string,
    kbEntryIds: string[],
  ): Promise<TaskAppendix[]> {
    const results: TaskAppendix[] = [];
    for (const kbId of kbEntryIds) {
      const appendix = await this.create({
        taskId,
        appendixType: "gotcha_list",
        referenceId: kbId,
        referenceTable: "knowledge_base",
      });
      results.push(appendix);
    }
    return results;
  }

  /**
   * Resolve content from reference table
   */
  private async resolveReference(table: string, id: string): Promise<string> {
    if (!table || !id) {
      return "";
    }

    // Handle different reference tables
    switch (table) {
      case "knowledge_base": {
        const row = await getOne<{ content: string; entry_type: string }>(
          "SELECT content, entry_type FROM knowledge_base WHERE id = ?",
          [id],
        );
        return row ? `[${row.entry_type}] ${row.content}` : "";
      }
      case "prds": {
        const row = await getOne<{ title: string; problem_statement: string }>(
          "SELECT title, problem_statement FROM prds WHERE id = ?",
          [id],
        );
        return row ? `# ${row.title}\n\n${row.problem_statement || ""}` : "";
      }
      default:
        return `[Reference: ${table}/${id}]`;
    }
  }
}

// Export singleton instance
export const taskAppendixService = new TaskAppendixService();
export default taskAppendixService;
