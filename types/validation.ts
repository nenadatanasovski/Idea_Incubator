// types/validation.ts

export type ValidationLevel = 'QUICK' | 'STANDARD' | 'THOROUGH' | 'RELEASE';
export type ValidationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ValidatorStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ValidationRun {
  id: string;
  buildId: string | null;
  level: ValidationLevel;
  status: ValidationStatus;
  passed: boolean | null;
  startedAt: string;
  completedAt: string | null;
  summaryJson: string | null;
}

export interface ValidatorResult {
  id: string;
  runId: string;
  validatorName: string;
  status: ValidatorStatus;
  passed: boolean | null;
  output: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface ValidatorConfig {
  name: string;
  command: string;
  args: string[];
  required: boolean;
  timeoutMs: number;
}

export interface LevelConfig {
  level: ValidationLevel;
  timeBudgetMs: number;
  validators: ValidatorConfig[];
}

export interface ValidationRunRequest {
  level: ValidationLevel;
  buildId?: string;
  options?: {
    changedFilesOnly?: boolean;
    failFast?: boolean;
  };
}

export interface ValidationSummary {
  validatorsRun: number;
  validatorsPassed: number;
  validatorsFailed: number;
  totalDurationMs: number;
}
