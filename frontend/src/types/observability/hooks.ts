/**
 * OBS-210: React Hook Types
 *
 * Return types for observability React hooks.
 */

import type { TranscriptEntry } from "./transcript";
import type { ToolUse, ToolUseSummary } from "./tool-use";
import type { AssertionResult, AssertionSummary } from "./assertion";
import type { SkillTrace, SkillTraceQuery, SkillsUsageSummary } from "./skill";
import type {
  MessageBusLogEntry,
  MessageBusQuery,
  MessageBusSummary,
} from "./message-bus";
import type {
  ObservabilityEvent,
  ObservabilityConnectionState,
} from "./websocket";
import type {
  ExecutionResponse,
  TranscriptQuery,
  ExecutionListQuery,
  ToolUseQuery,
  AssertionQuery,
} from "./api";
import type { EntityCrossRefs, RelatedEntitiesResult } from "./cross-refs";

// =============================================================================
// LOADING/ERROR STATE
// =============================================================================

/**
 * Common loading state for all hooks.
 */
export interface LoadingState {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: unknown;
}

// =============================================================================
// EXECUTION HOOKS
// =============================================================================

/**
 * Return type for useExecutionList hook.
 */
export interface UseExecutionListResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: ExecutionResponse[];
  executions: ExecutionResponse[];
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
  filters: ExecutionListQuery;
  setFilters: (filters: Partial<ExecutionListQuery>) => void;
}

/**
 * Return type for useExecution hook.
 */
export interface UseExecutionResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: ExecutionResponse | null;
  execution: ExecutionResponse | null;
  refetch: () => void;
}

/**
 * Return type for useExecutionSummary hook.
 */
export interface UseExecutionSummaryResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: ExecutionResponse | null;
  execution: ExecutionResponse | null;
  toolStats: ToolUseSummary | null;
  assertionStats: AssertionSummary | null;
  skillStats: SkillsUsageSummary | null;
  messageBusStats: MessageBusSummary | null;
  refetch: () => void;
}

// =============================================================================
// TRANSCRIPT HOOKS
// =============================================================================

/**
 * Return type for useTranscript hook.
 */
export interface UseTranscriptResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: TranscriptEntry[];
  entries: TranscriptEntry[];
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
  filters: TranscriptQuery;
  setFilters: (filters: Partial<TranscriptQuery>) => void;
}

/**
 * Return type for useTranscriptEntry hook.
 */
export interface UseTranscriptEntryResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: TranscriptEntry | null;
  entry: TranscriptEntry | null;
  refetch: () => void;
}

// =============================================================================
// TOOL USE HOOKS
// =============================================================================

/**
 * Return type for useToolUses hook.
 */
export interface UseToolUsesResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: ToolUse[];
  toolUses: ToolUse[];
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
  filters: ToolUseQuery;
  setFilters: (filters: Partial<ToolUseQuery>) => void;
}

/**
 * Return type for useToolUse hook.
 */
export interface UseToolUseResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: ToolUse | null;
  toolUse: ToolUse | null;
  refetch: () => void;
}

/**
 * Return type for useToolUseSummary hook.
 */
export interface UseToolUseSummaryResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: ToolUseSummary | null;
  summary: ToolUseSummary | null;
  refetch: () => void;
}

// =============================================================================
// ASSERTION HOOKS
// =============================================================================

/**
 * Return type for useAssertions hook.
 */
export interface UseAssertionsResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: AssertionResult[];
  assertions: AssertionResult[];
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
  filters: AssertionQuery;
  setFilters: (filters: Partial<AssertionQuery>) => void;
}

/**
 * Return type for useAssertion hook.
 */
export interface UseAssertionResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: AssertionResult | null;
  assertion: AssertionResult | null;
  refetch: () => void;
}

/**
 * Return type for useAssertionSummary hook.
 */
export interface UseAssertionSummaryResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: AssertionSummary | null;
  summary: AssertionSummary | null;
  refetch: () => void;
}

// =============================================================================
// SKILL HOOKS
// =============================================================================

/**
 * Return type for useSkillTraces hook.
 */
export interface UseSkillTracesResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: SkillTrace[];
  skillTraces: SkillTrace[];
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
  filters: SkillTraceQuery;
  setFilters: (filters: Partial<SkillTraceQuery>) => void;
}

/**
 * Return type for useSkillTrace hook.
 */
export interface UseSkillTraceResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: SkillTrace | null;
  skillTrace: SkillTrace | null;
  refetch: () => void;
}

/**
 * Return type for useSkillsSummary hook.
 */
export interface UseSkillsSummaryResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: SkillsUsageSummary | null;
  summary: SkillsUsageSummary | null;
  refetch: () => void;
}

// =============================================================================
// MESSAGE BUS HOOKS
// =============================================================================

/**
 * Return type for useMessageBusLogs hook.
 */
export interface UseMessageBusLogsResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: MessageBusLogEntry[];
  logs: MessageBusLogEntry[];
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
  filters: MessageBusQuery;
  setFilters: (filters: Partial<MessageBusQuery>) => void;
}

/**
 * Return type for useMessageBusSummary hook.
 */
export interface UseMessageBusSummaryResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: MessageBusSummary | null;
  summary: MessageBusSummary | null;
  refetch: () => void;
}

// =============================================================================
// WEBSOCKET HOOKS
// =============================================================================

/**
 * Return type for useObservabilityStream hook.
 */
export interface UseObservabilityStreamResult {
  // Connection state
  isConnected: boolean;
  connectionState: ObservabilityConnectionState;

  // Events
  events: ObservabilityEvent[];
  latestEvent?: ObservabilityEvent;

  // Subscriptions
  subscriptions: string[];
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;

  // Control
  clearEvents: () => void;
  connect: () => void;
  disconnect: () => void;

  // Errors
  error: Error | null;
}

/**
 * Return type for useObservabilityEvents hook (filtered stream).
 */
export interface UseObservabilityEventsResult<T extends ObservabilityEvent> {
  events: T[];
  latestEvent?: T;
  isConnected: boolean;
  clearEvents: () => void;
}

// =============================================================================
// CROSS-REFERENCE HOOKS
// =============================================================================

/**
 * Return type for useCrossReferences hook.
 */
export interface UseCrossReferencesResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: EntityCrossRefs | null;
  refs: EntityCrossRefs | null;
  relatedEntities: RelatedEntitiesResult | null;
  refetch: () => void;
}

/**
 * Return type for useRelatedEntities hook.
 */
export interface UseRelatedEntitiesResult {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: RelatedEntitiesResult | null;
  entities: RelatedEntitiesResult | null;
  refetch: () => void;
}

// =============================================================================
// FILTER HOOKS
// =============================================================================

/**
 * Return type for useFilters hook (generic filter state management).
 */
export interface UseFiltersResult<T extends Record<string, unknown>> {
  filters: T;
  setFilters: (filters: Partial<T>) => void;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

// =============================================================================
// PAGINATION HOOKS
// =============================================================================

/**
 * Return type for usePagination hook.
 */
export interface UsePaginationResult {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: () => void;
  prevPage: () => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  offset: number;
}

// =============================================================================
// AUTO-REFRESH HOOKS
// =============================================================================

/**
 * Return type for useAutoRefresh hook.
 */
export interface UseAutoRefreshResult {
  isEnabled: boolean;
  interval: number;
  enable: () => void;
  disable: () => void;
  setInterval: (ms: number) => void;
  lastRefreshTime?: Date;
}

// =============================================================================
// SEARCH HOOKS
// =============================================================================

/**
 * Return type for useSearch hook.
 */
export interface UseSearchResult<T> {
  loading: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  error: Error | null;
  data: T[];
  results: T[];
  query: string;
  setQuery: (query: string) => void;
  clearResults: () => void;
  isSearching: boolean;
}
