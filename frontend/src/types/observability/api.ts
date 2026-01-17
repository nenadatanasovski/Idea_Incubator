/**
 * OBS-207: API Request/Response Types
 *
 * Types for REST API requests and responses.
 */

import type {
  PaginatedResponse,
  TranscriptEntry,
  ExecutionRun,
} from "./transcript";
import type { ToolUse } from "./tool-use";
import type { AssertionResult, AssertionSummary } from "./assertion";
import type {
  MessageBusLogEntry,
  MessageBusSummary,
  MessageBusQuery,
} from "./message-bus";
import type { SkillTrace, SkillsUsageSummary, SkillTraceQuery } from "./skill";

// =============================================================================
// QUERY INTERFACES (defined here for API layer)
// =============================================================================

/**
 * Query parameters for tool uses endpoint.
 */
export interface ToolUseQuery {
  executionId?: string;
  taskId?: string;
  tools?: string[];
  categories?: string[];
  status?: string[];
  isError?: boolean;
  isBlocked?: boolean;
  fromTime?: string;
  toTime?: string;
  includeInputs?: boolean;
  includeOutputs?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Query parameters for assertions endpoint.
 */
export interface AssertionQuery {
  executionId?: string;
  taskId?: string;
  categories?: string[];
  result?: string[];
  chainId?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

// Re-export other query types
export type { MessageBusQuery, SkillTraceQuery };

// =============================================================================
// TRANSCRIPT QUERY
// =============================================================================

/**
 * Query parameters for transcript endpoint.
 */
export interface TranscriptQuery {
  executionId?: string;
  taskId?: string;
  entryTypes?: string[]; // Filter by entry type
  categories?: string[]; // Filter by category
  fromTimestamp?: string; // ISO8601 timestamp
  toTimestamp?: string; // ISO8601 timestamp
  search?: string; // Search in summary
  limit?: number; // Max results (default 500)
  offset?: number;
  cursor?: string; // Pagination cursor
}

// =============================================================================
// ERROR RESPONSE
// =============================================================================

/**
 * API error response.
 */
export interface ApiError {
  error: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Error response (alias for ApiError).
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

// =============================================================================
// EXECUTION RESPONSES
// =============================================================================

/**
 * Execution details response.
 */
export interface ExecutionResponse {
  id: string;
  taskListId: string;
  runNumber: number;
  startTime: string;
  endTime?: string;
  status: ExecutionRun["status"];
  taskCount: number;
  agentCount: number;
  waveCount: number;
  completedCount: number;
  failedCount: number;

  stats: {
    totalToolUses: number;
    totalAssertions: number;
    passRate: number;
    errorCount: number;
    blockedCount: number;
    durationMs?: number;
  };
}

/**
 * Execution list query parameters.
 */
export interface ExecutionListQuery {
  taskListId?: string;
  status?: ExecutionRun["status"][];
  fromTime?: string;
  toTime?: string;
  limit?: number;
  offset?: number;
}

/**
 * Executions list response.
 */
export type ExecutionsListResponse = PaginatedResponse<ExecutionResponse>;

// =============================================================================
// TRANSCRIPT RESPONSES
// =============================================================================

/**
 * Transcript entries response.
 */
export type TranscriptResponse = PaginatedResponse<TranscriptEntry>;

// =============================================================================
// TOOL USE RESPONSES
// =============================================================================

/**
 * Tool uses response.
 */
export type ToolUsesResponse = PaginatedResponse<ToolUse>;

/**
 * Tool usage summary response.
 */
export interface ToolUsageSummaryResponse {
  executionId: string;
  total: number;
  byTool: Record<
    string,
    {
      count: number;
      success: number;
      error: number;
      blocked: number;
      avgDurationMs: number;
    }
  >;
  byCategory: Record<
    string,
    {
      count: number;
      success: number;
      error?: number;
      blocked?: number;
    }
  >;
  byStatus: {
    done: number;
    error: number;
    blocked: number;
  };
  avgDurationMs: number;
  errorRate: number;
  blockRate: number;
  timeline: {
    firstToolUse: string;
    lastToolUse: string;
    totalDurationMs: number;
  };
  errors: Array<{
    toolUseId: string;
    tool: string;
    inputSummary: string;
    errorMessage: string;
    timestamp: string;
  }>;
  blocked: Array<{
    toolUseId: string;
    tool: string;
    inputSummary: string;
    blockReason: string;
    timestamp: string;
  }>;
}

// =============================================================================
// ASSERTION RESPONSES
// =============================================================================

/**
 * Assertions response.
 */
export type AssertionsResponse = PaginatedResponse<AssertionResult>;

/**
 * Assertion summary response.
 */
export interface AssertionSummaryResponse extends AssertionSummary {
  executionId: string;
}

// =============================================================================
// SKILL RESPONSES
// =============================================================================

/**
 * Skill traces response.
 */
export type SkillTracesResponse = PaginatedResponse<SkillTrace>;

/**
 * Skills usage summary response.
 */
export interface SkillsUsageSummaryResponse extends SkillsUsageSummary {
  executionId: string;
}

// =============================================================================
// MESSAGE BUS RESPONSES
// =============================================================================

/**
 * Message bus response.
 */
export type MessageBusResponse = PaginatedResponse<MessageBusLogEntry>;

/**
 * Message bus summary response.
 */
export interface MessageBusSummaryResponse extends MessageBusSummary {
  executionId?: string;
}

// =============================================================================
// COMBINED SUMMARY RESPONSE
// =============================================================================

/**
 * Combined execution summary with all stats.
 */
export interface ExecutionSummaryResponse {
  execution: ExecutionResponse;
  toolStats: ToolUsageSummaryResponse;
  assertionStats: AssertionSummaryResponse;
  skillStats: SkillsUsageSummaryResponse;
  messageBusStats: MessageBusSummaryResponse;

  timeline: {
    startTime: string;
    endTime?: string;
    durationMs?: number;
    waveTimings: Array<{
      waveNumber: number;
      startTime: string;
      endTime?: string;
      durationMs?: number;
    }>;
  };
}

// =============================================================================
// GENERIC API WRAPPER
// =============================================================================

/**
 * Generic API success response wrapper.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Generic API error response wrapper.
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * Generic API response union.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type { PaginatedResponse };
