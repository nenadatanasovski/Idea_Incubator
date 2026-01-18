/**
 * Decomposition Agent Types
 *
 * Type definitions for the AI-powered task decomposition system.
 */

import type { Task, TaskCategory, TaskEffort } from "../../types/task-agent.js";

/**
 * Context loaded for decomposition analysis
 */
export interface DecompositionContext {
  task: Task;
  appendices: TaskAppendixContext[];
  linkedPrds: PrdContext[];
  relatedTasks: RelatedTaskContext[];
  fileImpacts: FileImpactContext[];
  gotchas: GotchaContext[];
}

/**
 * Task appendix context for decomposition
 */
export interface TaskAppendixContext {
  id: string;
  appendixType: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * PRD context for decomposition
 */
export interface PrdContext {
  id: string;
  title: string;
  problemStatement?: string;
  functionalDescription?: string;
  successCriteria?: string[];
}

/**
 * Related task context
 */
export interface RelatedTaskContext {
  id: string;
  displayId: string;
  title: string;
  relationshipType: string;
  status: string;
}

/**
 * File impact context
 */
export interface FileImpactContext {
  targetPath: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "READ";
  impactType: "file" | "api" | "function" | "database" | "type";
  confidence: number;
}

/**
 * Gotcha context from knowledge base
 */
export interface GotchaContext {
  id: string;
  content: string;
  filePattern?: string;
  confidence: number;
}

/**
 * AI decomposition analysis result
 */
export interface AIDecompositionResult {
  /** Whether the task should be decomposed */
  shouldDecompose: boolean;
  /** Overall reasoning for the decomposition decision */
  reasoning: string;
  /** Proposed subtasks */
  subtasks: AISubtaskProposal[];
  /** Warnings or considerations */
  warnings?: string[];
  /** Confidence in the decomposition (0-1) */
  confidence: number;
}

/**
 * Proposed subtask from AI analysis
 */
export interface AISubtaskProposal {
  /** Subtask title */
  title: string;
  /** Detailed description */
  description: string;
  /** Task category */
  category: TaskCategory;
  /** Estimated effort */
  effort: TaskEffort;
  /** Acceptance criteria for this subtask */
  acceptanceCriteria: string[];
  /** Test commands to run */
  testCommands: string[];
  /** Predicted file impacts */
  fileImpacts: {
    targetPath: string;
    operation: "CREATE" | "UPDATE" | "DELETE" | "READ";
    impactType: "file" | "api" | "function" | "database" | "type";
  }[];
  /** Index of subtask this depends on (0-based) */
  dependsOnIndex?: number;
  /** Reasoning for why this subtask was created */
  rationale: string;
  /** Which parent acceptance criteria this addresses (by index) */
  addressesCriteria?: number[];
}

/**
 * Decomposition execution result
 */
export interface DecompositionExecutionResult {
  /** Parent task that was decomposed */
  parentTaskId: string;
  /** Unique ID grouping all subtasks from this decomposition */
  decompositionId: string;
  /** Created subtasks */
  subtasks: Task[];
  /** Token usage for AI calls */
  tokensUsed: number;
}

/**
 * Options for decomposition agent
 */
export interface DecompositionAgentOptions {
  /** Claude model to use */
  model?: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Max retry attempts */
  maxRetries?: number;
  /** Base delay for retries in ms */
  baseDelay?: number;
}
