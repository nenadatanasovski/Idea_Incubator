/**
 * UnifiedEventEmitter - Event-agnostic transcript entry emitter
 *
 * Supports events from any source: agent, telegram, script, webhook, user, system, ideation, custom
 */

import { v4 as uuidv4 } from "uuid";
import { getDb, run, query } from "../../../database/db.js";

// Event source types
export type EventSource =
  | "agent"
  | "telegram"
  | "script"
  | "webhook"
  | "user"
  | "system"
  | "ideation"
  | "custom";

// Entry types (extended for all sources)
export type TranscriptEntryType =
  // Agent events
  | "phase_start"
  | "phase_end"
  | "task_start"
  | "task_end"
  | "tool_use"
  | "skill_invoke"
  | "skill_complete"
  | "decision"
  | "validation"
  | "assertion"
  | "discovery"
  | "error"
  | "checkpoint"
  | "lock_acquire"
  | "lock_release"
  // Communication events
  | "message_received"
  | "message_sent"
  | "command_invoked"
  | "notification_sent"
  | "notification_delivered"
  | "notification_failed"
  // Script events
  | "script_started"
  | "script_completed"
  | "script_failed"
  | "cli_invoked"
  | "cron_triggered"
  // User events
  | "button_clicked"
  | "form_submitted"
  | "page_viewed"
  | "modal_opened"
  | "modal_closed"
  | "session_started"
  | "session_ended"
  // Webhook events
  | "webhook_received"
  | "api_called"
  | "api_responded"
  // System events
  | "server_started"
  | "server_stopped"
  | "health_check"
  | "config_changed"
  | "db_migration"
  | "cache_cleared"
  // Ideation events
  | "session_created"
  | "session_resumed"
  | "artifact_created"
  | "artifact_updated"
  | "subagent_spawned"
  | "subagent_completed"
  // Wave events
  | "wave_start"
  | "wave_complete"
  | "execution_complete";

// Entry categories
export type EntryCategory =
  | "lifecycle"
  | "action"
  | "validation"
  | "knowledge"
  | "coordination"
  | "communication"
  | "user_interaction"
  | "external"
  | "system";

// Context by source type
export interface AgentContext {
  executionId: string;
  instanceId: string;
  taskId?: string;
  waveId?: string;
  waveNumber?: number;
}

export interface TelegramContext {
  chatId: string;
  telegramUserId?: string;
  messageId?: string;
}

export interface ScriptContext {
  scriptName: string;
  scriptArgs?: string[];
}

export interface UserContext {
  userId: string;
  sessionId?: string;
  pageUrl?: string;
}

export interface WebhookContext {
  webhookUrl: string;
  webhookMethod?: string;
}

export interface IdeationContext {
  sessionId: string;
  userId?: string;
}

export interface SystemContext {
  component?: string;
}

export interface CustomContext {
  [key: string]: unknown;
}

// Union type for all contexts
export type EventContext = {
  source: EventSource;
  correlationId?: string;
} & (
  | ({ source: "agent" } & AgentContext)
  | ({ source: "telegram" } & TelegramContext)
  | ({ source: "script" } & ScriptContext)
  | ({ source: "user" } & UserContext)
  | ({ source: "webhook" } & WebhookContext)
  | ({ source: "ideation" } & IdeationContext)
  | ({ source: "system" } & SystemContext)
  | ({ source: "custom" } & CustomContext)
);

// Event payload
export interface EventPayload {
  entryType: TranscriptEntryType;
  category: EntryCategory;
  summary: string;
  details?: Record<string, unknown>;
  durationMs?: number;
  tokenEstimate?: number;
}

// Sequence tracking per execution
const sequenceCounters: Map<string, number> = new Map();

/**
 * Get next sequence number for an execution
 */
function getNextSequence(executionId: string): number {
  const current = sequenceCounters.get(executionId) || 0;
  const next = current + 1;
  sequenceCounters.set(executionId, next);
  return next;
}

/**
 * Reset sequence counter for an execution
 */
export function resetSequence(executionId: string): void {
  sequenceCounters.delete(executionId);
}

/**
 * Unified event emitter for observability
 */
class UnifiedEventEmitter {
  /**
   * Emit a transcript entry
   */
  async emit(context: EventContext, payload: EventPayload): Promise<string> {
    const entryId = uuidv4();
    const timestamp = new Date().toISOString();

    // Get sequence for agent events, use 0 for non-agent events
    let sequence = 0;
    let executionId = `${context.source}-event`;
    let instanceId: string = context.source;

    if (context.source === "agent" && "executionId" in context) {
      sequence = getNextSequence((context as AgentContext).executionId);
      executionId = (context as AgentContext).executionId;
      instanceId = (context as AgentContext).instanceId;
    } else if (context.source === "telegram" && "chatId" in context) {
      executionId = `telegram-${(context as TelegramContext).chatId}`;
      instanceId = "telegram";
    } else if (context.source === "script" && "scriptName" in context) {
      executionId = `script-${(context as ScriptContext).scriptName}`;
      instanceId = "script";
    } else if (context.correlationId) {
      executionId = context.correlationId;
    }

    // Build the insert data
    const data = {
      id: entryId,
      timestamp,
      sequence,
      source: context.source,
      // Required fields (use computed values from above)
      execution_id: executionId,
      instance_id: instanceId,
      // Agent-specific context
      task_id:
        context.source === "agent" ? (context as AgentContext).taskId : null,
      wave_id:
        context.source === "agent" ? (context as AgentContext).waveId : null,
      wave_number:
        context.source === "agent"
          ? (context as AgentContext).waveNumber
          : null,
      // Telegram context
      chat_id:
        context.source === "telegram"
          ? (context as TelegramContext).chatId
          : null,
      telegram_user_id:
        context.source === "telegram"
          ? (context as TelegramContext).telegramUserId
          : null,
      message_id:
        context.source === "telegram"
          ? (context as TelegramContext).messageId
          : null,
      // Script context
      script_name:
        context.source === "script"
          ? (context as ScriptContext).scriptName
          : null,
      script_args:
        context.source === "script" && (context as ScriptContext).scriptArgs
          ? JSON.stringify((context as ScriptContext).scriptArgs)
          : null,
      // User context
      user_id:
        context.source === "user" || context.source === "ideation"
          ? (context as UserContext | IdeationContext).userId
          : null,
      session_id:
        context.source === "user" || context.source === "ideation"
          ? (context as UserContext | IdeationContext).sessionId
          : null,
      page_url:
        context.source === "user" ? (context as UserContext).pageUrl : null,
      // Webhook context
      webhook_url:
        context.source === "webhook"
          ? (context as WebhookContext).webhookUrl
          : null,
      webhook_method:
        context.source === "webhook"
          ? (context as WebhookContext).webhookMethod
          : null,
      // Cross-source
      correlation_id: context.correlationId || null,
      // Event data
      entry_type: payload.entryType,
      category: payload.category,
      summary: payload.summary.slice(0, 200),
      details: payload.details ? JSON.stringify(payload.details) : null,
      duration_ms: payload.durationMs || null,
      token_estimate: payload.tokenEstimate || null,
    };

    try {
      await run(
        `INSERT INTO transcript_entries (
          id, timestamp, sequence, source, execution_id, task_id, instance_id,
          wave_id, wave_number, chat_id, telegram_user_id, message_id,
          script_name, script_args, user_id, session_id, page_url,
          webhook_url, webhook_method, correlation_id,
          entry_type, category, summary, details, duration_ms, token_estimate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.timestamp,
          data.sequence,
          data.source,
          data.execution_id,
          data.task_id,
          data.instance_id,
          data.wave_id,
          data.wave_number,
          data.chat_id,
          data.telegram_user_id,
          data.message_id,
          data.script_name,
          data.script_args,
          data.user_id,
          data.session_id,
          data.page_url,
          data.webhook_url,
          data.webhook_method,
          data.correlation_id,
          data.entry_type,
          data.category,
          data.summary,
          data.details,
          data.duration_ms,
          data.token_estimate,
        ],
      );
    } catch (error) {
      console.error("Failed to emit transcript entry:", error);
    }

    return entryId;
  }

  /**
   * Emit a system event
   */
  async emitSystem(
    entryType: TranscriptEntryType,
    summary: string,
    details?: Record<string, unknown>,
    correlationId?: string,
  ): Promise<string> {
    return this.emit(
      { source: "system", correlationId },
      { entryType, category: "system", summary, details },
    );
  }

  /**
   * Emit a wave lifecycle event
   */
  async emitWaveEvent(
    executionId: string,
    entryType: "wave_start" | "wave_complete" | "execution_complete",
    waveNumber: number,
    details: Record<string, unknown>,
  ): Promise<string> {
    return this.emit(
      {
        source: "system",
        correlationId: executionId,
      },
      {
        entryType,
        category: "lifecycle",
        summary: `${entryType.replace("_", " ")}: wave ${waveNumber}`,
        details: { ...details, waveNumber, executionId },
      },
    );
  }
}

// Singleton instance
export const eventEmitter = new UnifiedEventEmitter();

// Default export
export default UnifiedEventEmitter;
