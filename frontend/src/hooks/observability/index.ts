/**
 * Observability Hooks - Consolidated Exports (OBS-715)
 *
 * Clean export interface for all observability hooks.
 * Import from '@/hooks/observability' or 'frontend/src/hooks/observability'
 */

// === API Hooks ===
export {
  useExecutions,
  useExecution,
  useTranscript,
  useToolUses,
  useAssertions,
  useSkillTraces,
  useToolSummary,
  useAssertionSummary,
  useMessageBusLogs,
  useCrossRefs,
  useDiscoveries,
  // Debounced hooks
  useToolUsesDebounced,
  useTranscriptDebounced,
  // Task-scoped hooks
  useTaskObservability,
  useTaskTimeline,
  // Error classes
  NotFoundError,
  ApiError,
} from "../useObservability";

// === WebSocket Hooks ===
export { useObservabilityStream } from "../useObservabilityStream";
export { default as useObservabilityConnection } from "../useObservabilityConnection";

// === Real-Time Fusion Hooks ===
export {
  useRealtimeTranscript,
  useRealtimeToolUses,
  useRealtimeAssertions,
} from "../useRealtimeObservability";

// === Stats Hooks ===
export {
  useQuickStats,
  useToolCallRate,
  useAssertionPassRate,
  useErrorCount,
} from "../useObservabilityStats";

// === Infinite Scroll Hooks ===
export {
  useInfiniteTranscript,
  useInfiniteToolUses,
  useInfiniteAssertions,
  useInfiniteSkillTraces,
  useInfiniteMessageBusLogs,
} from "../useInfiniteObservability";

// === Filter Hooks ===
export {
  useTranscriptFilters,
  useToolUseFilters,
  useAssertionFilters,
  useMessageBusFilters,
  useObservabilityFiltersAll,
} from "../useObservabilityFilters";

// === Navigation Hooks ===
export {
  useObservabilityNavigation,
  useObservabilityBreadcrumbs,
} from "../useObservabilityNavigation";

// === Re-export Types ===
export type {
  TranscriptEntry,
  ToolUse,
  AssertionResultEntry,
  SkillTrace,
  MessageBusLogEntry,
  ExecutionRun,
  ToolSummary,
  AssertionSummary,
  ObservabilityEvent,
  ObservabilityEventType,
  TranscriptEntryType,
  ToolCategory,
  ToolResultStatus,
  AssertionResult,
  Severity,
  EntityType,
  PaginatedResponse,
  CrossReference,
  TranscriptFilters,
  ToolUseFilters,
  AssertionFilters,
  MessageBusFilters,
} from "../../types/observability";
