/**
 * Observability Services
 *
 * Unified event emitter and execution management for
 * Build Agent observability tracking.
 *
 * OBS-110: Added TranscriptWriter, ToolUseLogger, AssertionRecorder exports
 */

export {
  eventEmitter,
  resetSequence,
  type EventSource,
  type TranscriptEntryType as UnifiedTranscriptEntryType,
  type EntryCategory as UnifiedEntryCategory,
  type EventContext,
  type EventPayload,
  type AgentContext,
  type TelegramContext,
  type ScriptContext,
  type UserContext,
  type WebhookContext,
  type IdeationContext,
  type SystemContext,
  type CustomContext,
} from "./unified-event-emitter.js";

export {
  createExecutionRun,
  completeExecutionRun,
  getExecutionRun,
  createExecutionSession,
  completeExecutionSession,
  updateWaveCount,
  getActiveExecutions,
  type ExecutionStatus,
  type ExecutionRun,
} from "./execution-manager.js";

// OBS-110: TypeScript observability services
export {
  TranscriptWriter,
  type TranscriptEntryType,
  type EntryCategory,
  type TranscriptEntry,
} from "./transcript-writer.js";

export { ToolUseLogger, type ToolCategory } from "./tool-use-logger.js";

export {
  AssertionRecorder,
  type AssertionCategory,
  type AssertionResult,
  type AssertionEvidence,
  type ChainResult,
} from "./assertion-recorder.js";
