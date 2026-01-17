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

// =============================================================================
// OBS-300 to OBS-306: Phase 5 API Service Classes
// Migrated to use sql.js via database/db.js wrapper
// =============================================================================

// OBS-300: Execution Service
export { ExecutionService, executionService } from "./execution-service.js";

// OBS-301: Transcript Service
export { TranscriptService, transcriptService } from "./transcript-service.js";

// OBS-302: Tool Use Service
export { ToolUseService, toolUseService } from "./tool-use-service.js";

// OBS-303: Assertion Service
export { AssertionService, assertionService } from "./assertion-service.js";

// OBS-304: Skill Service
export { SkillService, skillService } from "./skill-service.js";

// OBS-305: Cross-Reference Service
export {
  CrossReferenceService,
  crossReferenceService,
} from "./cross-reference-service.js";

// OBS-306: Message Bus Service
export { MessageBusService, messageBusService } from "./message-bus-service.js";
