/**
 * Task Impact Types
 *
 * Types for tracking what a task impacts: files, APIs, functions, databases, and types.
 * Part of: Task System V2 Implementation Plan (IMPL-2.1)
 */

/**
 * Impact types representing what a task affects
 */
export type ImpactType = 'file' | 'api' | 'function' | 'database' | 'type';

/**
 * CRUD operations for impacts
 */
export type ImpactOperation = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';

/**
 * Source of impact prediction
 */
export type ImpactSource = 'ai' | 'pattern' | 'user' | 'validated';

/**
 * Task Impact entity
 */
export interface TaskImpact {
  id: string;
  taskId: string;

  impactType: ImpactType;
  operation: ImpactOperation;

  targetPath: string;
  targetName?: string;
  targetSignature?: string;

  confidence: number;  // 0.0 - 1.0
  source: ImpactSource;

  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a task impact
 */
export interface CreateTaskImpactInput {
  taskId: string;
  impactType: ImpactType;
  operation: ImpactOperation;
  targetPath: string;
  targetName?: string;
  targetSignature?: string;
  confidence?: number;
  source?: ImpactSource;
}

/**
 * Input for updating a task impact
 */
export interface UpdateTaskImpactInput {
  impactType?: ImpactType;
  operation?: ImpactOperation;
  targetPath?: string;
  targetName?: string;
  targetSignature?: string;
  confidence?: number;
  source?: ImpactSource;
}

/**
 * Conflict severity levels
 */
export type ConflictSeverity = 'blocking' | 'warning';

/**
 * Conflict detection result
 */
export interface ImpactConflict {
  taskAId: string;
  taskBId: string;
  conflictType: 'write-write' | 'write-delete' | 'delete-delete' | 'delete-read';
  targetPath: string;
  severity: ConflictSeverity;
}

/**
 * Database row representation for task impacts
 */
export interface TaskImpactRow {
  id: string;
  task_id: string;
  impact_type: string;
  operation: string;
  target_path: string;
  target_name: string | null;
  target_signature: string | null;
  confidence: number;
  source: string;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to TaskImpact object
 */
export function mapTaskImpactRow(row: TaskImpactRow): TaskImpact {
  return {
    id: row.id,
    taskId: row.task_id,
    impactType: row.impact_type as ImpactType,
    operation: row.operation as ImpactOperation,
    targetPath: row.target_path,
    targetName: row.target_name || undefined,
    targetSignature: row.target_signature || undefined,
    confidence: row.confidence,
    source: row.source as ImpactSource,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
