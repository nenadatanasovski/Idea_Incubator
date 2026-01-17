/**
 * Project Service
 *
 * Manages project CRUD operations and idea-project linking.
 * Projects bridge Ideas (ideation) and Tasks (execution).
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../database/db.js";
import type {
  Project,
  ProjectWithStats,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectRow,
  ProjectStatsRow,
  ProjectListOptions,
  mapProjectRow,
  mapProjectStatsRow,
} from "../../types/project.js";

// Re-export mappers from types
export { mapProjectRow, mapProjectStatsRow } from "../../types/project.js";

/**
 * Generate a unique project code from name
 * Ensures the code is not already in use
 */
export async function generateProjectCode(name: string): Promise<string> {
  // Get existing codes
  const existing = await query<{ code: string }>("SELECT code FROM projects");
  const existingCodes = new Set(existing.map((r) => r.code));

  // Clean the name: keep only alphanumeric, uppercase
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  // Try progressively shorter codes
  for (let len = 4; len >= 2; len--) {
    const code = cleaned.slice(0, len);
    if (code.length >= 2 && !existingCodes.has(code)) {
      return code;
    }
  }

  // If all simple codes taken, append number
  let counter = 1;
  const base = cleaned.slice(0, 3) || "PRJ";
  while (existingCodes.has(`${base}${counter}`)) {
    counter++;
  }
  return `${base}${counter}`;
}

/**
 * Create a new project
 */
export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const id = uuidv4();

  // Generate slug from name
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Use provided code or generate one
  const code =
    input.code?.toUpperCase() || (await generateProjectCode(input.name));

  await run(
    `INSERT INTO projects (id, slug, code, name, description, idea_id, owner_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      id,
      slug,
      code,
      input.name,
      input.description || null,
      input.ideaId || null,
      input.ownerId || null,
    ],
  );

  await saveDb();

  const project = await getProjectById(id);
  if (!project) {
    throw new Error("Failed to create project");
  }
  return project;
}

/**
 * Get project by ID
 */
export async function getProjectById(id: string): Promise<Project | null> {
  const row = await getOne<ProjectRow>("SELECT * FROM projects WHERE id = ?", [
    id,
  ]);
  if (!row) return null;

  // Import dynamically to avoid circular deps
  const { mapProjectRow: mapper } = await import("../../types/project.js");
  return mapper(row);
}

/**
 * Get project by code (2-4 char code)
 */
export async function getProjectByCode(code: string): Promise<Project | null> {
  const row = await getOne<ProjectRow>(
    "SELECT * FROM projects WHERE code = ?",
    [code.toUpperCase()],
  );
  if (!row) return null;

  const { mapProjectRow: mapper } = await import("../../types/project.js");
  return mapper(row);
}

/**
 * Get project by slug
 */
export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const row = await getOne<ProjectRow>(
    "SELECT * FROM projects WHERE slug = ?",
    [slug],
  );
  if (!row) return null;

  const { mapProjectRow: mapper } = await import("../../types/project.js");
  return mapper(row);
}

/**
 * Get project by idea ID
 */
export async function getProjectByIdeaId(
  ideaId: string,
): Promise<Project | null> {
  const row = await getOne<ProjectRow>(
    "SELECT * FROM projects WHERE idea_id = ?",
    [ideaId],
  );
  if (!row) return null;

  const { mapProjectRow: mapper } = await import("../../types/project.js");
  return mapper(row);
}

/**
 * Resolve project reference (accepts ID, code, or slug)
 * Returns the project ID if found, null otherwise
 */
export async function resolveProjectId(
  projectRef: string,
): Promise<string | null> {
  // Try by ID first
  let project = await getProjectById(projectRef);
  if (project) return project.id;

  // Try by code
  project = await getProjectByCode(projectRef);
  if (project) return project.id;

  // Try by slug
  project = await getProjectBySlug(projectRef);
  if (project) return project.id;

  return null;
}

/**
 * Get all projects with stats
 */
export async function getAllProjects(
  options?: ProjectListOptions,
): Promise<ProjectWithStats[]> {
  let sql = "SELECT * FROM project_stats_view WHERE 1=1";
  const params: (string | number)[] = [];

  if (options?.status) {
    sql += " AND status = ?";
    params.push(options.status);
  }

  if (options?.hasIdea !== undefined) {
    if (options.hasIdea) {
      sql += " AND idea_id IS NOT NULL";
    } else {
      sql += " AND idea_id IS NULL";
    }
  }

  if (options?.ownerId) {
    sql += " AND owner_id = ?";
    params.push(options.ownerId);
  }

  sql += " ORDER BY updated_at DESC";

  if (options?.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += " OFFSET ?";
    params.push(options.offset);
  }

  const rows = await query<ProjectStatsRow>(sql, params);
  const { mapProjectStatsRow: mapper } = await import("../../types/project.js");
  return rows.map(mapper);
}

/**
 * Update project
 */
export async function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<Project | null> {
  const updates: string[] = [];
  const params: (string | null)[] = [];

  if (input.name !== undefined) {
    updates.push("name = ?");
    params.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push("description = ?");
    params.push(input.description);
  }
  if (input.status !== undefined) {
    updates.push("status = ?");
    params.push(input.status);

    if (input.status === "completed") {
      updates.push('completed_at = datetime("now")');
    }
  }
  if (input.ownerId !== undefined) {
    updates.push("owner_id = ?");
    params.push(input.ownerId);
  }

  if (updates.length === 0) {
    return getProjectById(id);
  }

  updates.push('updated_at = datetime("now")');
  params.push(id);

  await run(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`, params);

  await saveDb();

  return getProjectById(id);
}

/**
 * Link idea to project
 */
export async function linkIdeaToProject(
  ideaId: string,
  projectId: string,
): Promise<Project | null> {
  // Verify idea exists
  const idea = await getOne<{ id: string }>(
    "SELECT id FROM ideas WHERE id = ?",
    [ideaId],
  );
  if (!idea) {
    throw new Error("Idea not found");
  }

  // Verify project exists
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  // Check if idea is already linked to another project
  const existingLink = await getProjectByIdeaId(ideaId);
  if (existingLink && existingLink.id !== projectId) {
    throw new Error("Idea is already linked to another project");
  }

  await run(
    'UPDATE projects SET idea_id = ?, updated_at = datetime("now") WHERE id = ?',
    [ideaId, projectId],
  );

  await saveDb();

  return getProjectById(projectId);
}

/**
 * Unlink idea from project
 */
export async function unlinkIdeaFromProject(
  projectId: string,
): Promise<Project | null> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  await run(
    'UPDATE projects SET idea_id = NULL, updated_at = datetime("now") WHERE id = ?',
    [projectId],
  );

  await saveDb();

  return getProjectById(projectId);
}

/**
 * Create project from idea
 * Automatically links the project to the idea
 */
export async function createProjectFromIdea(ideaId: string): Promise<Project> {
  // Get idea details
  const idea = await getOne<{ id: string; slug: string; title: string }>(
    "SELECT id, slug, title FROM ideas WHERE id = ?",
    [ideaId],
  );

  if (!idea) {
    throw new Error("Idea not found");
  }

  // Check if project already exists for this idea
  const existing = await getProjectByIdeaId(ideaId);
  if (existing) {
    return existing;
  }

  // Create new project from idea
  return createProject({
    name: idea.title,
    ideaId: idea.id,
  });
}

/**
 * Get project by idea slug
 */
export async function getProjectByIdeaSlug(
  ideaSlug: string,
): Promise<Project | null> {
  // First get idea ID from slug
  const idea = await getOne<{ id: string }>(
    "SELECT id FROM ideas WHERE slug = ?",
    [ideaSlug],
  );

  if (!idea) {
    return null;
  }

  return getProjectByIdeaId(idea.id);
}

/**
 * Delete project
 */
export async function deleteProject(id: string): Promise<boolean> {
  const project = await getProjectById(id);
  if (!project) {
    return false;
  }

  await run("DELETE FROM projects WHERE id = ?", [id]);
  await saveDb();

  return true;
}

/**
 * Get project stats by ID
 */
export async function getProjectStats(
  id: string,
): Promise<ProjectWithStats | null> {
  const row = await getOne<ProjectStatsRow>(
    "SELECT * FROM project_stats_view WHERE id = ?",
    [id],
  );
  if (!row) return null;

  const { mapProjectStatsRow: mapper } = await import("../../types/project.js");
  return mapper(row);
}

/**
 * Check if a project code is available
 */
export async function isCodeAvailable(code: string): Promise<boolean> {
  const existing = await getOne<{ code: string }>(
    "SELECT code FROM projects WHERE code = ?",
    [code.toUpperCase()],
  );
  return existing === null;
}

/**
 * Update project started_at timestamp when first task starts
 */
export async function markProjectStarted(projectId: string): Promise<void> {
  await run(
    `UPDATE projects
     SET started_at = datetime("now"), updated_at = datetime("now")
     WHERE id = ? AND started_at IS NULL`,
    [projectId],
  );
  await saveDb();
}

/**
 * Mark project as completed
 */
export async function markProjectCompleted(projectId: string): Promise<void> {
  await run(
    `UPDATE projects
     SET status = 'completed', completed_at = datetime("now"), updated_at = datetime("now")
     WHERE id = ?`,
    [projectId],
  );
  await saveDb();
}

// Default export for convenience
export default {
  createProject,
  getProjectById,
  getProjectByCode,
  getProjectBySlug,
  getProjectByIdeaId,
  getProjectByIdeaSlug,
  resolveProjectId,
  getAllProjects,
  updateProject,
  linkIdeaToProject,
  unlinkIdeaFromProject,
  createProjectFromIdea,
  deleteProject,
  getProjectStats,
  generateProjectCode,
  isCodeAvailable,
  markProjectStarted,
  markProjectCompleted,
};
