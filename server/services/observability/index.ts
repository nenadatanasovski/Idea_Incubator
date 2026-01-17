/**
 * Observability Services
 *
 * Unified event emitter and execution management for
 * Build Agent observability tracking.
 */

export {
  eventEmitter,
  resetSequence,
  type EventSource,
  type TranscriptEntryType,
  type EntryCategory,
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
