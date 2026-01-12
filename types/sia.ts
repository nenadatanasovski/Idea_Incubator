// types/sia.ts - Self-Improvement Agent types

export type KnowledgeType = 'gotcha' | 'pattern' | 'decision';
export type ProposalStatus = 'pending' | 'approved' | 'rejected';

export interface KnowledgeEntry {
  id: string;
  type: KnowledgeType;
  content: string;
  filePatterns: string[];
  actionTypes: string[];
  confidence: number;
  occurrences: number;
  source: {
    executionId: string;
    taskId: string;
    agentType: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ClaudeMdProposal {
  id: string;
  knowledgeEntryId: string;
  proposedSection: string;
  proposedContent: string;
  status: ProposalStatus;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  createdAt: string;
}

export interface GotchaApplication {
  id: string;
  knowledgeEntryId: string;
  executionId: string;
  taskId: string;
  preventedError: boolean;
  createdAt: string;
}

// Execution analysis types
export interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  taskId?: string;
  data?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'failed' | 'skipped';
  file: string;
  action: string;
  errorMessage?: string;
  retryCount: number;
  durationMs: number;
  codeWritten?: string;
}

export interface FailureInfo {
  taskId: string;
  file: string;
  action: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  fixApplied?: string;
}

export interface RetryInfo {
  taskId: string;
  attempts: number;
  finalStatus: 'success' | 'failed';
  errors: string[];
}

export interface ExtractedGotcha {
  errorType: string;
  errorMessage: string;
  fix: string;
  filePattern: string;
  actionType: string;
  taskId: string;
}

export interface ExtractedPattern {
  description: string;
  codeTemplate: string;
  filePattern: string;
  actionType: string;
  taskId: string;
}

export interface ExecutionAnalysis {
  executionId: string;
  agentType: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  retriedTasks: number;
  extractedGotchas: ExtractedGotcha[];
  extractedPatterns: ExtractedPattern[];
  analyzedAt: string;
}

// Query types
export interface KnowledgeQuery {
  type?: KnowledgeType;
  filePattern?: string;
  actionType?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface AnalyzeRequest {
  executionId: string;
}

export interface AnalyzeResponse {
  analysis: ExecutionAnalysis;
  newGotchas: KnowledgeEntry[];
  newPatterns: KnowledgeEntry[];
  updatedEntries: string[];
}
