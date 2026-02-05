// server/pipeline/types.ts
// Type definitions for pipeline module

import { IdeaPhase, IdeaState, IdeationProgress, SpecProgress, BuildProgress } from './orchestrator';

// Re-export types from orchestrator
export type { IdeaPhase, IdeaState, IdeationProgress, SpecProgress, BuildProgress };

// API Response types
export interface PipelineStatusResponse {
  state: IdeaState;
  availableTransitions: IdeaPhase[];
  canAutoAdvance: boolean;
}

export interface TransitionRequest {
  targetPhase: IdeaPhase;
  reason?: string;
  force?: boolean;
}

export interface TransitionResponse {
  success: boolean;
  newPhase?: IdeaPhase;
  error?: string;
}

// WebSocket event types
export interface PipelineWebSocketEvent {
  type: 'transition' | 'progress' | 'transitionAvailable' | 'humanReviewRequired';
  ideaId: string;
  data: any;
}

// Handoff types
export interface IdeationToSpecHandoff {
  ideaId: string;
  problemStatement: string;
  solutionDescription: string;
  targetUsers: string;
  artifacts: Array<{ type: string; content: string }>;
  conversationSummary: string;
}

export interface SpecToBuildHandoff {
  ideaId: string;
  specSessionId: string;
  specification: any; // Full spec object
  tasks: TaskDefinition[];
  executionPlan: ExecutionPlan;
}

export interface TaskDefinition {
  id: string;
  specId: string;
  featureId: string;
  name: string;
  description: string;
  type: 'setup' | 'database' | 'api' | 'ui' | 'integration' | 'test';
  dependencies: string[];
  estimatedMinutes: number;
  technicalDetails: string;
  testCriteria: string[];
}

export interface ExecutionPlan {
  phases: ExecutionPhase[];
  dependencies: TaskDependency[];
  estimatedDuration: number;
}

export interface ExecutionPhase {
  name: string;
  taskIds: string[];
  parallel: boolean;
}

export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
}
