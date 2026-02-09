/**
 * PRD Service
 *
 * CRUD operations for Product Requirements Documents.
 * Part of: Task System V2 Implementation Plan (IMPL-3.3)
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../database/db.js";
import {
  PRD,
  PRDWithRelations,
  CreatePrdInput,
  UpdatePrdInput,
  PrdStatus,
  PrdRow,
  mapPrdRow,
  PrdTaskListLinkRow,
  PrdTaskLinkRow,
  mapPrdTaskListLinkRow,
  mapPrdTaskLinkRow,
} from "../../types/prd.js";

/**
 * Generate a URL-friendly slug from a title
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

/**
 * PRD Service class
 */
export class PrdService {
  /**
   * Create a new PRD
   */
  async create(input: CreatePrdInput, userId: string): Promise<PRD> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const slug =
      input.slug || (await this.generateSlug(input.title, input.projectId));

    await run(
      `INSERT INTO prds (id, slug, title, user_id, project_id, parent_prd_id, problem_statement, target_users, functional_description, success_criteria, constraints, out_of_scope, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        slug,
        input.title,
        userId,
        input.projectId || null,
        input.parentPrdId || null,
        input.problemStatement || null,
        input.targetUsers || null,
        input.functionalDescription || null,
        JSON.stringify(input.successCriteria || []),
        JSON.stringify(input.constraints || []),
        JSON.stringify(input.outOfScope || []),
        "draft",
        now,
        now,
      ],
    );

    await saveDb();

    const created = await this.getById(id);
    if (!created) {
      throw new Error("Failed to create PRD");
    }
    return created;
  }

  /**
   * Get PRD by ID
   */
  async getById(id: string): Promise<PRD | null> {
    const row = await getOne<PrdRow>("SELECT * FROM prds WHERE id = ?", [id]);
    return row ? mapPrdRow(row) : null;
  }

  /**
   * Get PRD by slug
   */
  async getBySlug(slug: string): Promise<PRD | null> {
    const row = await getOne<PrdRow>("SELECT * FROM prds WHERE slug = ?", [
      slug,
    ]);
    return row ? mapPrdRow(row) : null;
  }

  /**
   * Get PRDs by user ID
   */
  async getByUserId(userId: string): Promise<PRD[]> {
    const rows = await query<PrdRow>(
      "SELECT * FROM prds WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );
    return rows.map(mapPrdRow);
  }

  /**
   * Get PRDs by project ID
   */
  async getByProjectId(projectId: string): Promise<PRD[]> {
    const rows = await query<PrdRow>(
      "SELECT * FROM prds WHERE project_id = ? ORDER BY created_at DESC",
      [projectId],
    );
    return rows.map(mapPrdRow);
  }

  /**
   * Update a PRD
   */
  async update(id: string, updates: UpdatePrdInput): Promise<PRD> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`PRD ${id} not found`);
    }

    const fields: string[] = [];
    const values: (string | null)[] = [];

    if (updates.title !== undefined) {
      fields.push("title = ?");
      values.push(updates.title);
    }
    if (updates.slug !== undefined) {
      fields.push("slug = ?");
      values.push(updates.slug);
    }
    if (updates.parentPrdId !== undefined) {
      fields.push("parent_prd_id = ?");
      values.push(updates.parentPrdId);
    }
    if (updates.problemStatement !== undefined) {
      fields.push("problem_statement = ?");
      values.push(updates.problemStatement);
    }
    if (updates.targetUsers !== undefined) {
      fields.push("target_users = ?");
      values.push(updates.targetUsers);
    }
    if (updates.functionalDescription !== undefined) {
      fields.push("functional_description = ?");
      values.push(updates.functionalDescription);
    }
    if (updates.successCriteria !== undefined) {
      fields.push("success_criteria = ?");
      values.push(JSON.stringify(updates.successCriteria));
    }
    if (updates.constraints !== undefined) {
      fields.push("constraints = ?");
      values.push(JSON.stringify(updates.constraints));
    }
    if (updates.outOfScope !== undefined) {
      fields.push("out_of_scope = ?");
      values.push(JSON.stringify(updates.outOfScope));
    }
    if (updates.businessContext !== undefined) {
      fields.push("business_context = ?");
      values.push(JSON.stringify(updates.businessContext));
    }
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }

    if (fields.length > 0) {
      fields.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(id);

      await run(`UPDATE prds SET ${fields.join(", ")} WHERE id = ?`, values);
      await saveDb();
    }

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error("Failed to update PRD");
    }
    return updated;
  }

  /**
   * Delete a PRD
   */
  async delete(id: string): Promise<void> {
    await run("DELETE FROM prds WHERE id = ?", [id]);
    await saveDb();
  }

  /**
   * Get children PRDs
   */
  async getChildren(prdId: string): Promise<PRD[]> {
    const rows = await query<PrdRow>(
      "SELECT * FROM prds WHERE parent_prd_id = ? ORDER BY created_at",
      [prdId],
    );
    return rows.map(mapPrdRow);
  }

  /**
   * Get parent PRD
   */
  async getParent(prdId: string): Promise<PRD | null> {
    const prd = await this.getById(prdId);
    if (!prd || !prd.parentPrdId) {
      return null;
    }
    return this.getById(prd.parentPrdId);
  }

  /**
   * Get PRD with full hierarchy
   */
  async getHierarchy(prdId: string): Promise<PRDWithRelations> {
    const prd = await this.getById(prdId);
    if (!prd) {
      throw new Error(`PRD ${prdId} not found`);
    }

    const parentPrd = await this.getParent(prdId);
    const childPrds = await this.getChildren(prdId);

    // Get linked task lists
    const taskListRows = await query<PrdTaskListLinkRow>(
      "SELECT * FROM prd_task_lists WHERE prd_id = ? ORDER BY position",
      [prdId],
    );
    const taskLists = taskListRows.map(mapPrdTaskListLinkRow);

    // Get linked tasks
    const taskRows = await query<PrdTaskLinkRow>(
      "SELECT * FROM prd_tasks WHERE prd_id = ?",
      [prdId],
    );
    const tasks = taskRows.map(mapPrdTaskLinkRow);

    return {
      ...prd,
      parentPrd: parentPrd || undefined,
      childPrds,
      taskLists,
      tasks,
    };
  }

  /**
   * Update PRD status
   */
  async updateStatus(
    id: string,
    status: PrdStatus,
    userId?: string,
  ): Promise<PRD> {
    const updates: UpdatePrdInput = { status };

    if (status === "approved" && userId) {
      await run(
        "UPDATE prds SET status = ?, approved_at = ?, approved_by = ?, updated_at = ? WHERE id = ?",
        [
          status,
          new Date().toISOString(),
          userId,
          new Date().toISOString(),
          id,
        ],
      );
      await saveDb();
      const updated = await this.getById(id);
      if (!updated) throw new Error("Failed to update PRD");
      return updated;
    }

    return this.update(id, updates);
  }

  /**
   * Approve a PRD
   */
  async approve(id: string, userId: string): Promise<PRD> {
    return this.updateStatus(id, "approved", userId);
  }

  /**
   * Generate a unique slug for a PRD
   */
  async generateSlug(title: string, _projectId?: string): Promise<string> {
    const baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.getBySlug(slug);
      if (!existing) {
        break;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * List all PRDs with optional filters
   */
  async list(filters?: {
    status?: PrdStatus;
    projectId?: string;
    userId?: string;
  }): Promise<PRD[]> {
    let sql = "SELECT * FROM prds WHERE 1=1";
    const params: string[] = [];

    if (filters?.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    if (filters?.projectId) {
      sql += " AND project_id = ?";
      params.push(filters.projectId);
    }
    if (filters?.userId) {
      sql += " AND user_id = ?";
      params.push(filters.userId);
    }

    sql += " ORDER BY created_at DESC";

    const rows = await query<PrdRow>(sql, params);
    return rows.map(mapPrdRow);
  }
}

// Export singleton instance
export const prdService = new PrdService();
export default prdService;
