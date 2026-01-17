/**
 * Project Types
 *
 * Represents a formal project that bridges Ideas (ideation) and Tasks (execution).
 * Projects provide the organizational container for continuous development,
 * linking an idea's journey from conception through implementation.
 */

/**
 * Project status values
 */
export type ProjectStatus = "active" | "paused" | "completed" | "archived";

/**
 * Core Project interface
 */
export interface Project {
  id: string;
  slug: string;
  code: string; // 2-4 char uppercase code for display IDs (e.g., "IDEA", "VIBE")
  name: string;
  description?: string;
  ideaId?: string;
  ownerId?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Project with statistics (from project_stats_view)
 */
export interface ProjectWithStats extends Project {
  // Idea details (if linked)
  ideaSlug?: string;
  ideaTitle?: string;
  ideaLifecycleStage?: string;
  ideaIncubationPhase?: string;

  // Task statistics
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  evaluationQueueTasks: number;

  // Task list statistics
  totalTaskLists: number;
  completedTaskLists: number;
  inProgressTaskLists: number;

  // PRD statistics
  totalPrds: number;

  // Computed
  completionPercentage: number;
}

/**
 * Create project input
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
  code?: string; // Auto-generated if not provided
  ideaId?: string;
  ownerId?: string;
}

/**
 * Update project input
 */
export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  ownerId?: string;
}

/**
 * Link idea to project input
 */
export interface LinkIdeaToProjectInput {
  ideaId: string;
  projectId?: string; // If not provided, creates new project from idea
}

/**
 * Project list query options
 */
export interface ProjectListOptions {
  status?: ProjectStatus;
  hasIdea?: boolean;
  ownerId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Project creation response
 */
export interface CreateProjectResponse {
  project: Project;
  isNew: boolean; // false if project already existed (e.g., from idea)
}

/**
 * Database row type for mapping
 */
export interface ProjectRow {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  idea_id: string | null;
  owner_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Database row type for stats view
 */
export interface ProjectStatsRow extends ProjectRow {
  idea_slug: string | null;
  idea_title: string | null;
  idea_lifecycle_stage: string | null;
  idea_incubation_phase: string | null;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  in_progress_tasks: number;
  pending_tasks: number;
  blocked_tasks: number;
  evaluation_queue_tasks: number;
  total_task_lists: number;
  completed_task_lists: number;
  in_progress_task_lists: number;
  total_prds: number;
  completion_percentage: number;
}

/**
 * Map database row to Project
 */
export function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    name: row.name,
    description: row.description || undefined,
    ideaId: row.idea_id || undefined,
    ownerId: row.owner_id || undefined,
    status: row.status as ProjectStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
  };
}

/**
 * Map database row to ProjectWithStats
 */
export function mapProjectStatsRow(row: ProjectStatsRow): ProjectWithStats {
  return {
    ...mapProjectRow(row),
    ideaSlug: row.idea_slug || undefined,
    ideaTitle: row.idea_title || undefined,
    ideaLifecycleStage: row.idea_lifecycle_stage || undefined,
    ideaIncubationPhase: row.idea_incubation_phase || undefined,
    totalTasks: row.total_tasks || 0,
    completedTasks: row.completed_tasks || 0,
    failedTasks: row.failed_tasks || 0,
    inProgressTasks: row.in_progress_tasks || 0,
    pendingTasks: row.pending_tasks || 0,
    blockedTasks: row.blocked_tasks || 0,
    evaluationQueueTasks: row.evaluation_queue_tasks || 0,
    totalTaskLists: row.total_task_lists || 0,
    completedTaskLists: row.completed_task_lists || 0,
    inProgressTaskLists: row.in_progress_task_lists || 0,
    totalPrds: row.total_prds || 0,
    completionPercentage: row.completion_percentage || 0,
  };
}
