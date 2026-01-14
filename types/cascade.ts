/**
 * Cascade Types
 *
 * Types for change propagation and cascade effects.
 * Part of: Task System V2 Implementation Plan (IMPL-2.5)
 */

/**
 * Types of changes that trigger cascade
 */
export type CascadeTrigger =
  | 'file_impact_changed'
  | 'api_impact_changed'
  | 'function_impact_changed'
  | 'database_impact_changed'
  | 'type_impact_changed'
  | 'status_changed'
  | 'dependency_changed'
  | 'priority_changed';

/**
 * Impact type for cascade effects
 */
export type CascadeImpactType = 'direct' | 'transitive';

/**
 * Suggested action for cascade effect
 */
export type CascadeSuggestedAction = 'review' | 'auto_update' | 'block' | 'notify';

/**
 * Cascade effect on a related task
 */
export interface CascadeEffect {
  affectedTaskId: string;
  affectedTaskDisplayId: string;

  trigger: CascadeTrigger;
  reason: string;

  impactType: CascadeImpactType;
  depth: number;  // 1 = direct, 2+ = transitive

  suggestedAction: CascadeSuggestedAction;
  autoApprovable: boolean;
}

/**
 * Cascade analysis result
 */
export interface CascadeAnalysis {
  sourceTaskId: string;
  changeType: CascadeTrigger;

  directEffects: CascadeEffect[];
  transitiveEffects: CascadeEffect[];

  totalAffected: number;
  requiresReview: number;
  autoApprovable: number;

  taskListAutoApprove: boolean;  // From task_lists_v2.auto_approve_reviews
}

/**
 * Cascade execution result
 */
export interface CascadeExecutionResult {
  sourceTaskId: string;

  applied: {
    taskId: string;
    action: string;
    success: boolean;
  }[];

  flaggedForReview: string[];  // Task IDs
  failed: {
    taskId: string;
    error: string;
  }[];
}

/**
 * Input for cascade analysis
 */
export interface CascadeAnalysisInput {
  taskId: string;
  changeType: CascadeTrigger;
  changes: Record<string, unknown>;
}

/**
 * Input for cascade execution
 */
export interface CascadeExecutionInput {
  analysis: CascadeAnalysis;
  approveAll?: boolean;
  selectedTaskIds?: string[];
}

/**
 * Cascade configuration for task list
 */
export interface CascadeConfig {
  taskListId: string;
  autoApproveReviews: boolean;
  maxDepth: number;
  notifyOnCascade: boolean;
}

/**
 * Default cascade configuration
 */
export const DEFAULT_CASCADE_CONFIG: Omit<CascadeConfig, 'taskListId'> = {
  autoApproveReviews: false,
  maxDepth: 3,
  notifyOnCascade: true,
};

/**
 * Cascade trigger to human-readable description
 */
export const CASCADE_TRIGGER_DESCRIPTIONS: Record<CascadeTrigger, string> = {
  file_impact_changed: 'File impact changed',
  api_impact_changed: 'API impact changed',
  function_impact_changed: 'Function impact changed',
  database_impact_changed: 'Database impact changed',
  type_impact_changed: 'Type impact changed',
  status_changed: 'Task status changed',
  dependency_changed: 'Task dependency changed',
  priority_changed: 'Task priority changed',
};
