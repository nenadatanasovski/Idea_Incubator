/**
 * Task Appendix Types
 *
 * Types for attachable context for Build Agents (11 appendix types).
 * Part of: Task System V2 Implementation Plan (IMPL-2.2)
 */

/**
 * All supported appendix types
 */
export type AppendixType =
  | 'prd_reference'
  | 'code_context'
  | 'gotcha_list'
  | 'rollback_plan'
  | 'test_context'
  | 'dependency_notes'
  | 'architecture_decision'
  | 'user_story'
  | 'acceptance_criteria'
  | 'research_notes'
  | 'api_contract';

/**
 * Storage type for appendix content
 */
export type AppendixContentType = 'inline' | 'reference';

/**
 * Task Appendix entity
 */
export interface TaskAppendix {
  id: string;
  taskId: string;

  appendixType: AppendixType;
  contentType: AppendixContentType;

  // For inline storage
  content?: string;

  // For reference storage
  referenceId?: string;
  referenceTable?: string;

  position: number;

  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating an appendix
 */
export interface CreateTaskAppendixInput {
  taskId: string;
  appendixType: AppendixType;
  content?: string;
  referenceId?: string;
  referenceTable?: string;
  position?: number;
}

/**
 * Input for updating an appendix
 */
export interface UpdateTaskAppendixInput {
  appendixType?: AppendixType;
  content?: string;
  referenceId?: string;
  referenceTable?: string;
  position?: number;
}

/**
 * Resolved appendix with content loaded
 */
export interface ResolvedAppendix extends TaskAppendix {
  resolvedContent: string;
}

/**
 * Database row representation for task appendices
 */
export interface TaskAppendixRow {
  id: string;
  task_id: string;
  appendix_type: string;
  content_type: string;
  content: string | null;
  reference_id: string | null;
  reference_table: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to TaskAppendix object
 */
export function mapTaskAppendixRow(row: TaskAppendixRow): TaskAppendix {
  return {
    id: row.id,
    taskId: row.task_id,
    appendixType: row.appendix_type as AppendixType,
    contentType: row.content_type as AppendixContentType,
    content: row.content || undefined,
    referenceId: row.reference_id || undefined,
    referenceTable: row.reference_table || undefined,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Appendix type descriptions for UI
 */
export const APPENDIX_TYPE_DESCRIPTIONS: Record<AppendixType, string> = {
  prd_reference: 'Reference to a Product Requirements Document',
  code_context: 'Relevant code snippets and context',
  gotcha_list: 'Known issues and pitfalls to avoid',
  rollback_plan: 'Plan for reverting changes if needed',
  test_context: 'Test scenarios and expected outcomes',
  dependency_notes: 'Notes about dependencies and prerequisites',
  architecture_decision: 'Architecture decision records (ADRs)',
  user_story: 'User story with acceptance criteria',
  acceptance_criteria: 'Explicit acceptance criteria for completion',
  research_notes: 'Research findings and notes',
  api_contract: 'API contract definitions (OpenAPI, GraphQL, etc.)',
};
