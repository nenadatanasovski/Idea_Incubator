/**
 * PRD (Product Requirements Document) Types
 *
 * Types for PRD management with hierarchical linking.
 * Part of: Task System V2 Implementation Plan (IMPL-2.3)
 */

/**
 * PRD status lifecycle
 */
export type PrdStatus = 'draft' | 'review' | 'approved' | 'archived';

/**
 * PRD link types for task relationships
 */
export type PrdLinkType = 'implements' | 'tests' | 'related';

/**
 * Product Requirements Document entity
 */
export interface PRD {
  id: string;
  slug: string;
  title: string;

  userId: string;
  projectId?: string;
  parentPrdId?: string;

  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;

  successCriteria: string[];
  constraints: string[];
  outOfScope: string[];

  status: PrdStatus;

  approvedAt?: string;
  approvedBy?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * PRD with resolved relationships
 */
export interface PRDWithRelations extends PRD {
  parentPrd?: PRD;
  childPrds: PRD[];
  taskLists: PrdTaskListLink[];
  tasks: PrdTaskLink[];
}

/**
 * PRD to Task List junction
 */
export interface PrdTaskListLink {
  id: string;
  prdId: string;
  taskListId: string;
  position: number;
  createdAt: string;
}

/**
 * PRD to Task junction
 */
export interface PrdTaskLink {
  id: string;
  prdId: string;
  taskId: string;
  requirementRef?: string;
  linkType: PrdLinkType;
  createdAt: string;
}

/**
 * Input for creating a PRD
 */
export interface CreatePrdInput {
  title: string;
  slug?: string;  // Auto-generated if not provided
  projectId?: string;
  parentPrdId?: string;
  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;
  successCriteria?: string[];
  constraints?: string[];
  outOfScope?: string[];
}

/**
 * Input for updating a PRD
 */
export interface UpdatePrdInput {
  title?: string;
  slug?: string;
  parentPrdId?: string;
  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;
  successCriteria?: string[];
  constraints?: string[];
  outOfScope?: string[];
  status?: PrdStatus;
}

/**
 * PRD coverage statistics
 */
export interface PrdCoverage {
  prdId: string;
  totalRequirements: number;
  coveredRequirements: number;
  coveragePercent: number;

  bySection: {
    successCriteria: { total: number; covered: number };
    constraints: { total: number; verified: number };
  };

  linkedTaskLists: number;
  linkedTasks: number;
  completedTasks: number;
}

/**
 * Database row representation for PRDs
 */
export interface PrdRow {
  id: string;
  slug: string;
  title: string;
  user_id: string;
  project_id: string | null;
  parent_prd_id: string | null;
  problem_statement: string | null;
  target_users: string | null;
  functional_description: string | null;
  success_criteria: string;  // JSON array
  constraints: string;  // JSON array
  out_of_scope: string;  // JSON array
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to PRD object
 */
export function mapPrdRow(row: PrdRow): PRD {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    userId: row.user_id,
    projectId: row.project_id || undefined,
    parentPrdId: row.parent_prd_id || undefined,
    problemStatement: row.problem_statement || undefined,
    targetUsers: row.target_users || undefined,
    functionalDescription: row.functional_description || undefined,
    successCriteria: JSON.parse(row.success_criteria),
    constraints: JSON.parse(row.constraints),
    outOfScope: JSON.parse(row.out_of_scope),
    status: row.status as PrdStatus,
    approvedAt: row.approved_at || undefined,
    approvedBy: row.approved_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Database row for PRD-Task List junction
 */
export interface PrdTaskListLinkRow {
  id: string;
  prd_id: string;
  task_list_id: string;
  position: number;
  created_at: string;
}

/**
 * Map database row to PrdTaskListLink
 */
export function mapPrdTaskListLinkRow(row: PrdTaskListLinkRow): PrdTaskListLink {
  return {
    id: row.id,
    prdId: row.prd_id,
    taskListId: row.task_list_id,
    position: row.position,
    createdAt: row.created_at,
  };
}

/**
 * Database row for PRD-Task junction
 */
export interface PrdTaskLinkRow {
  id: string;
  prd_id: string;
  task_id: string;
  requirement_ref: string | null;
  link_type: string;
  created_at: string;
}

/**
 * Map database row to PrdTaskLink
 */
export function mapPrdTaskLinkRow(row: PrdTaskLinkRow): PrdTaskLink {
  return {
    id: row.id,
    prdId: row.prd_id,
    taskId: row.task_id,
    requirementRef: row.requirement_ref || undefined,
    linkType: row.link_type as PrdLinkType,
    createdAt: row.created_at,
  };
}
