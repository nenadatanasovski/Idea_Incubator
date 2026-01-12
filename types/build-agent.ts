/**
 * Build Agent Types
 */

export type BuildStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type TaskStatus = 'pending' | 'running' | 'validating' | 'completed' | 'failed' | 'skipped';

export interface BuildExecution {
  id: string;
  specId: string;
  specPath: string;
  status: BuildStatus;
  currentTaskId: string | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface TaskExecution {
  id: string;
  buildId: string;
  taskId: string;
  attempt: number;
  status: TaskStatus;
  startedAt: string;
  completedAt: string | null;
  generatedCode: string | null;
  validationOutput: string | null;
  errorMessage: string | null;
}

export interface BuildCheckpoint {
  id: string;
  buildId: string;
  taskId: string;
  stateJson: string;
  createdAt: string;
}

export interface BuildOptions {
  autoCommit?: boolean;
  maxRetries?: number;
  skipValidation?: boolean;
  dryRun?: boolean;
  tokenLimit?: number;
}

export interface AtomicTask {
  id: string;
  phase: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  file: string;
  status: string;
  requirements: string[];
  gotchas: string[];
  validation: {
    command: string;
    expected: string;
  };
  codeTemplate?: string;
  dependsOn: string[];
}

export interface Gotcha {
  id: string;
  content: string;
  filePattern: string;
  actionType: string;
  severity: string;
}

export interface TaskContext {
  task: AtomicTask;
  specSections: string[];
  dependencyOutputs: Record<string, string>;
  conventions: string;
  relatedFiles: Record<string, string>;
  gotchas: Gotcha[];
  tokenCount: number;
}
