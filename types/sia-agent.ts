// types/sia-agent.ts - SIA Intervention Agent Types

import { AtomicTask, TaskContext } from "./build-agent.js";

/**
 * Issue types that SIA can identify
 */
export type IssueType = "complexity" | "clarity" | "environment" | "dependency" | "unknown";

/**
 * Possible results of SIA intervention
 */
export type SIAResultType = "fixed" | "decomposed" | "escalate";

/**
 * Request for SIA intervention
 */
export interface SIARequest {
  task: AtomicTask;
  lastError: string | null;
  attempts: number;
  context: TaskContext;
  buildId?: string;
  history?: SIAAttemptRecord[];
}

/**
 * Result of SIA intervention
 */
export interface SIAResult {
  type: SIAResultType;
  technique?: string;
  modifiedTask?: AtomicTask;
  subtasks?: AtomicTask[];
  reason?: string;
}

/**
 * Analysis of a task failure
 */
export interface FailureAnalysis {
  rootCause: string;
  issueType: IssueType;
  suggestedApproaches: string[];
  confidence: number;
  errorPatterns: string[];
}

/**
 * Record of an SIA attempt (from task memory)
 */
export interface SIAAttemptRecord {
  technique: string;
  result: SIAResultType;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Task memory for tracking intervention history
 */
export interface TaskMemory {
  taskId: string;
  taskSignature: string;
  attempts: SIAAttemptRecord[];
  techniquesTried: string[];
  successfulTechnique: string | null;
  totalInterventions: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * SIA technique interface
 */
export interface Technique {
  name: string;
  description: string;
  
  /**
   * Score how suitable this technique is for the failure
   * @returns Score between 0-1
   */
  scoreSuitability(analysis: FailureAnalysis): number;
  
  /**
   * Apply the technique to the task
   */
  apply(
    task: AtomicTask,
    context: TaskContext,
    analysis: FailureAnalysis
  ): Promise<SIAResult>;
}

/**
 * Database row for sia_attempts
 */
export interface DbSiaAttempt {
  id: string;
  task_id: string;
  build_id: string | null;
  technique: string;
  result_type: string;
  details: string | null;
  analysis: string | null;
  original_error: string | null;
  attempts_before: number;
  created_at: string;
}

/**
 * Database row for sia_task_memory
 */
export interface DbSiaTaskMemory {
  task_id: string;
  task_signature: string | null;
  attempts: string;  // JSON
  techniques_tried: string | null;  // JSON
  successful_technique: string | null;
  total_interventions: number;
  created_at: string;
  updated_at: string;
}

/**
 * SIA metrics summary
 */
export interface SIAMetrics {
  totalInterventions: number;
  successRate: number;
  mostEffectiveTechnique: string | null;
  techniqueBreakdown: Array<{
    technique: string;
    totalAttempts: number;
    fixedCount: number;
    decomposedCount: number;
    escalateCount: number;
    successRate: number;
  }>;
}
