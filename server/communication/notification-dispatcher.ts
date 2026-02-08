// server/communication/notification-dispatcher.ts
// COM-010: Notification Dispatcher - Routes notifications through channels

import { EventEmitter } from "events";
import { TelegramSender } from "./telegram-sender";
import { EmailSender } from "./email-sender";
import { AgentType } from "./types";

interface Database {
  run(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export type NotificationChannel = "telegram" | "email" | "both";
export type NotificationSeverity = "info" | "warning" | "error" | "critical";
export type NotificationCategory =
  | "agent_status"
  | "question_pending"
  | "question_timeout"
  | "approval_needed"
  | "system_health"
  | "error"
  | "progress"
  | "completion";

export interface Notification {
  id: string;
  agentType: AgentType;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channel?: NotificationChannel;
  dedupKey?: string;
  expiresAt?: Date;
}

export interface NotificationResult {
  success: boolean;
  channels: {
    telegram?: { success: boolean; messageId?: number; error?: string };
    email?: { success: boolean; messageId?: string; error?: string };
  };
}

export interface DispatcherConfig {
  defaultChannel: NotificationChannel;
  dedupWindowMs: number;
  quietHoursStart?: number; // Hour (0-23)
  quietHoursEnd?: number;
  escalationDelayMs: number;
}

const DEFAULT_CONFIG: DispatcherConfig = {
  defaultChannel: "telegram",
  dedupWindowMs: 5 * 60 * 1000, // 5 minutes
  escalationDelayMs: 30 * 60 * 1000, // 30 minutes
};

const CATEGORY_CHANNEL: Record<NotificationCategory, NotificationChannel> = {
  agent_status: "telegram",
  question_pending: "telegram",
  question_timeout: "both",
  approval_needed: "both",
  system_health: "telegram",
  error: "telegram",
  progress: "telegram",
  completion: "telegram",
};

export class NotificationDispatcher extends EventEmitter {
  private db: Database;
  private telegramSender: TelegramSender;
  private emailSender: EmailSender | null;
  private config: DispatcherConfig;
  private recentNotifications: Map<string, Date> = new Map();
  private pendingEscalations: Map<string, ReturnType<typeof setTimeout>> =
    new Map();

  constructor(
    db: Database,
    telegramSender: TelegramSender,
    emailSender: EmailSender | null,
    config: Partial<DispatcherConfig> = {},
  ) {
    super();
    this.db = db;
    this.telegramSender = telegramSender;
    this.emailSender = emailSender;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Dispatch a notification through appropriate channels.
   */
  async dispatch(notification: Notification): Promise<NotificationResult> {
    // Check dedup
    if (notification.dedupKey && this.isDuplicate(notification.dedupKey)) {
      console.log(
        `[NotificationDispatcher] Skipping duplicate: ${notification.dedupKey}`,
      );
      return { success: true, channels: {} };
    }

    // Check expiry
    if (notification.expiresAt && new Date() > notification.expiresAt) {
      console.log(
        `[NotificationDispatcher] Skipping expired notification: ${notification.id}`,
      );
      return { success: true, channels: {} };
    }

    // Determine channel
    const channel =
      notification.channel ||
      CATEGORY_CHANNEL[notification.category] ||
      this.config.defaultChannel;

    // Check quiet hours for non-critical notifications
    if (this.isQuietHours() && notification.severity !== "critical") {
      console.log(
        `[NotificationDispatcher] Quiet hours - queueing: ${notification.id}`,
      );
      await this.queueForLater(notification);
      return { success: true, channels: {} };
    }

    const result: NotificationResult = { success: true, channels: {} };

    // Send via Telegram
    if (channel === "telegram" || channel === "both") {
      result.channels.telegram = await this.sendTelegram(notification);
      if (!result.channels.telegram.success) {
        result.success = false;
      }
    }

    // Send via Email
    if ((channel === "email" || channel === "both") && this.emailSender) {
      result.channels.email = await this.sendEmail(notification);
      if (!result.channels.email.success) {
        result.success = false;
      }
    }

    // Fallback: if Telegram failed, try email
    if (
      channel === "telegram" &&
      !result.channels.telegram?.success &&
      this.emailSender
    ) {
      console.log(
        `[NotificationDispatcher] Telegram failed, falling back to email`,
      );
      result.channels.email = await this.sendEmail(notification);
      if (result.channels.email.success) {
        result.success = true;
      }
    }

    // Record for dedup
    if (notification.dedupKey) {
      this.recentNotifications.set(notification.dedupKey, new Date());
    }

    // Store in database
    await this.storeNotification(notification, result);

    // Set up escalation for critical notifications without response
    if (notification.severity === "critical" && result.success) {
      this.scheduleEscalation(notification);
    }

    this.emit("notification:sent", { notification, result });

    return result;
  }

  /**
   * Send multiple notifications at once.
   */
  async dispatchBatch(
    notifications: Notification[],
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const notification of notifications) {
      const result = await this.dispatch(notification);
      results.push(result);
    }

    return results;
  }

  /**
   * Cancel a pending escalation.
   */
  cancelEscalation(notificationId: string): void {
    const timeout = this.pendingEscalations.get(notificationId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingEscalations.delete(notificationId);
      console.log(
        `[NotificationDispatcher] Cancelled escalation: ${notificationId}`,
      );
    }
  }

  /**
   * Clean up resources.
   */
  cleanup(): void {
    // Clear all pending escalations
    for (const timeout of this.pendingEscalations.values()) {
      clearTimeout(timeout);
    }
    this.pendingEscalations.clear();

    // Clear old dedup entries
    const cutoff = new Date(Date.now() - this.config.dedupWindowMs);
    for (const [key, date] of Array.from(this.recentNotifications.entries())) {
      if (date < cutoff) {
        this.recentNotifications.delete(key);
      }
    }
  }

  /**
   * Send notification via Telegram.
   */
  private async sendTelegram(
    notification: Notification,
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      const result = await this.telegramSender.sendNotification(
        notification.agentType,
        notification.title,
        notification.message,
        notification.severity,
      );

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(
        `[NotificationDispatcher] Telegram send failed: ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send notification via Email.
   */
  private async sendEmail(
    notification: Notification,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.emailSender) {
      return { success: false, error: "Email sender not configured" };
    }

    try {
      const result = await this.emailSender.sendNotification(
        notification.title,
        notification.message,
        notification.severity,
      );

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(
        `[NotificationDispatcher] Email send failed: ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if notification is a duplicate.
   */
  private isDuplicate(dedupKey: string): boolean {
    const lastSent = this.recentNotifications.get(dedupKey);
    if (!lastSent) return false;

    return Date.now() - lastSent.getTime() < this.config.dedupWindowMs;
  }

  /**
   * Check if currently in quiet hours.
   */
  private isQuietHours(): boolean {
    if (
      this.config.quietHoursStart === undefined ||
      this.config.quietHoursEnd === undefined
    ) {
      return false;
    }

    const now = new Date();
    const hour = now.getHours();

    if (this.config.quietHoursStart <= this.config.quietHoursEnd) {
      // Same day range (e.g., 9-17)
      return (
        hour >= this.config.quietHoursStart && hour < this.config.quietHoursEnd
      );
    } else {
      // Overnight range (e.g., 22-6)
      return (
        hour >= this.config.quietHoursStart || hour < this.config.quietHoursEnd
      );
    }
  }

  /**
   * Queue notification for later delivery.
   */
  private async queueForLater(notification: Notification): Promise<void> {
    // Calculate when quiet hours end
    const now = new Date();
    const deliverAt = new Date(now);

    if (this.config.quietHoursEnd !== undefined) {
      deliverAt.setHours(this.config.quietHoursEnd, 0, 0, 0);
      if (deliverAt <= now) {
        deliverAt.setDate(deliverAt.getDate() + 1);
      }
    }

    await this.db.run(
      `INSERT INTO notifications (id, agent_type, category, severity, title, message, data, channel, status, scheduled_for, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notification.id,
        notification.agentType,
        notification.category,
        notification.severity,
        notification.title,
        notification.message,
        JSON.stringify(notification.data || {}),
        notification.channel || this.config.defaultChannel,
        "queued",
        deliverAt.toISOString(),
        now.toISOString(),
      ],
    );

    this.emit("notification:queued", { notification, deliverAt });
  }

  /**
   * Schedule an escalation for critical notifications.
   */
  private scheduleEscalation(notification: Notification): void {
    const timeout = setTimeout(async () => {
      console.log(`[NotificationDispatcher] Escalating: ${notification.id}`);

      this.pendingEscalations.delete(notification.id);

      // Re-send with escalation marker
      const escalatedNotification: Notification = {
        ...notification,
        id: `${notification.id}-escalated`,
        title: `[ESCALATED] ${notification.title}`,
        severity: "critical",
        channel: "both",
        dedupKey: undefined, // Don't dedup escalations
      };

      await this.dispatch(escalatedNotification);
      this.emit("notification:escalated", {
        original: notification,
        escalated: escalatedNotification,
      });
    }, this.config.escalationDelayMs);

    this.pendingEscalations.set(notification.id, timeout);
  }

  /**
   * Store notification in database.
   */
  private async storeNotification(
    notification: Notification,
    result: NotificationResult,
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db.run(
      `INSERT INTO notifications (id, agent_type, category, severity, title, message, data, channel, status, telegram_message_id, email_message_id, sent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         telegram_message_id = excluded.telegram_message_id,
         email_message_id = excluded.email_message_id,
         sent_at = excluded.sent_at`,
      [
        notification.id,
        notification.agentType,
        notification.category,
        notification.severity,
        notification.title,
        notification.message,
        JSON.stringify(notification.data || {}),
        notification.channel || this.config.defaultChannel,
        result.success ? "sent" : "failed",
        result.channels.telegram?.messageId ?? null,
        result.channels.email?.messageId ?? null,
        result.success ? now : null,
        now,
      ],
    );
  }

  /**
   * Get pending notifications (for retry/review).
   */
  async getPendingNotifications(): Promise<Notification[]> {
    const rows = await this.db.all<{
      id: string;
      agent_type: string;
      category: string;
      severity: string;
      title: string;
      message: string;
      data: string;
      channel: string;
    }>("SELECT * FROM notifications WHERE status = ? ORDER BY created_at ASC", [
      "queued",
    ]);

    return rows.map((row) => ({
      id: row.id,
      agentType: row.agent_type as AgentType,
      category: row.category as NotificationCategory,
      severity: row.severity as NotificationSeverity,
      title: row.title,
      message: row.message,
      data: JSON.parse(row.data || "{}"),
      channel: row.channel as NotificationChannel,
    }));
  }

  /**
   * Process queued notifications that are ready.
   */
  async processQueuedNotifications(): Promise<number> {
    const now = new Date().toISOString();

    const rows = await this.db.all<{
      id: string;
      agent_type: string;
      category: string;
      severity: string;
      title: string;
      message: string;
      data: string;
      channel: string;
    }>(
      "SELECT * FROM notifications WHERE status = ? AND scheduled_for <= ? ORDER BY scheduled_for ASC",
      ["queued", now],
    );

    let processed = 0;

    for (const row of rows) {
      const notification: Notification = {
        id: row.id,
        agentType: row.agent_type as AgentType,
        category: row.category as NotificationCategory,
        severity: row.severity as NotificationSeverity,
        title: row.title,
        message: row.message,
        data: JSON.parse(row.data || "{}"),
        channel: row.channel as NotificationChannel,
      };

      await this.dispatch(notification);
      processed++;
    }

    return processed;
  }
}
