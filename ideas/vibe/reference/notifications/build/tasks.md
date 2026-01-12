---
id: "notifications"
title: "Notification System"
idea_type: "feature_internal"
creator: "system"
created: "2026-01-10"
updated: "2026-01-10"
spec_version: "1.0"
total_tasks: 24
completed_tasks: 0
status: "pending"
---

# Build Tasks: Notification System

## Summary

**Spec Reference:** `build/spec.md`
**Total Tasks:** 24
**Completed:** 0
**In Progress:** 0
**Failed:** 0
**Blocked:** 0

**Last Updated:** 2026-01-10

---

## Context Loading

### Required Context
- [x] `build/spec.md` - Technical specification
- [x] `CLAUDE.md` - Project conventions (sections: Database, API Routes, WebSocket)
- [x] Knowledge Base gotchas for: SQLite JSON, WebSocket, Email sending

### Idea Context
- [x] `README.md` - Idea overview
- [x] `planning/brief.md` - Feature brief

---

## Phase 1: Database

### Task 1

```yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/027_notifications.sql"
status: pending

requirements:
  - "Create notifications table with all fields"
  - "Create notification_deliveries table for tracking"
  - "Create notification_channel_prefs table"
  - "Create notification_digest table"
  - "Add all indexes for performance"

gotchas:
  - "Use TEXT for timestamps"
  - "Use TEXT for JSON columns (data, channels, notification_ids)"
  - "Add partial index for unread notifications"

validation:
  command: "sqlite3 :memory: < database/migrations/027_notifications.sql && echo 'OK'"
  expected: "OK"

code_template: |
  -- Migration 027: Notification System
  -- Created: 2026-01-10
  -- Purpose: Core notification tables

  CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT,
      priority TEXT DEFAULT 'normal',
      read_at TEXT,
      archived_at TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- ... (rest of schema from spec)

depends_on: []
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 2

```yaml
id: T-002
phase: database
action: CREATE
file: "database/migrations/028_notification_templates.sql"
status: pending

requirements:
  - "Create notification_templates table"
  - "Seed default templates for: agent_question, agent_completed, agent_error, session_update, system_alert"
  - "Include email and telegram variants"

gotchas:
  - "Use INSERT OR IGNORE for idempotent seeding"
  - "Templates use {{variable}} syntax"
  - "default_channels is JSON array as TEXT"

validation:
  command: "sqlite3 :memory: < database/migrations/028_notification_templates.sql && echo 'OK'"
  expected: "OK"

code_template: |
  -- Migration 028: Notification Templates
  -- Created: 2026-01-10
  -- Purpose: Seed default notification templates

  CREATE TABLE IF NOT EXISTS notification_templates (
      id TEXT PRIMARY KEY,
      type TEXT UNIQUE NOT NULL,
      title_template TEXT NOT NULL,
      body_template TEXT NOT NULL,
      email_subject TEXT,
      email_body TEXT,
      telegram_text TEXT,
      default_channels TEXT DEFAULT '["in_app"]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO notification_templates (id, type, title_template, body_template, email_subject, email_body, telegram_text, default_channels) VALUES
  ('tmpl-agent-question', 'agent_question', 'Agent needs your input', '{{agentName}} has a question: {{question}}', '[Vibe] Agent Question', '<p>{{agentName}} is waiting for your input.</p><p>{{question}}</p>', '🤖 *{{agentName}}* needs your input:\n{{question}}', '["in_app", "email", "telegram"]'),
  ('tmpl-agent-completed', 'agent_completed', 'Agent completed task', '{{agentName}} finished: {{taskName}}', '[Vibe] Task Completed', '<p>{{agentName}} completed {{taskName}}.</p>', '✅ *{{agentName}}* completed: {{taskName}}', '["in_app"]'),
  ('tmpl-agent-error', 'agent_error', 'Agent encountered an error', '{{agentName}} failed: {{error}}', '[Vibe] Agent Error', '<p>{{agentName}} encountered an error:</p><pre>{{error}}</pre>', '❌ *{{agentName}}* error:\n{{error}}', '["in_app", "email"]'),
  ('tmpl-session-update', 'session_update', 'Session Update', '{{sessionName}}: {{update}}', '[Vibe] Session Update', '<p>{{sessionName}}</p><p>{{update}}</p>', '📝 *{{sessionName}}*: {{update}}', '["in_app"]'),
  ('tmpl-system-alert', 'system_alert', 'System Alert', '{{message}}', '[Vibe] System Alert', '<p>{{message}}</p>', '⚠️ {{message}}', '["in_app", "email"]');

depends_on: ["T-001"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 2: Types & Interfaces

### Task 3

```yaml
id: T-003
phase: types
action: CREATE
file: "types/notification.ts"
status: pending

requirements:
  - "Define NotificationPriority type"
  - "Define NotificationChannel type"
  - "Define DeliveryStatus type"
  - "Define Notification interface"
  - "Define NotificationDelivery interface"
  - "Define NotificationTemplate interface"
  - "Define ChannelPreference interface"
  - "Define CreateNotificationInput interface"
  - "Define NotificationListResult interface"

gotchas:
  - "Use string unions for enums"
  - "data field is Record<string, any> | null"
  - "defaultChannels is array of NotificationChannel"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Types for Notification System
   */

  export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';
  export type NotificationChannel = 'in_app' | 'email' | 'telegram';
  export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped';

  export interface Notification {
    id: string;
    userId: string;
    type: string;
    category: string;
    title: string;
    body: string;
    data: Record<string, any> | null;
    priority: NotificationPriority;
    readAt: string | null;
    archivedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  }

  // ... (rest from spec)

depends_on: []
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 3: Database Queries

### Task 4

```yaml
id: T-004
phase: database
action: UPDATE
file: "database/db.ts"
status: pending

requirements:
  - "Add createNotification function"
  - "Add getNotifications function with filters"
  - "Add getNotificationById function"
  - "Add markNotificationRead function"
  - "Add markNotificationArchived function"
  - "Add getUnreadCount function"

gotchas:
  - "Parse JSON data field when reading"
  - "Stringify JSON data when writing"
  - "Handle null data gracefully"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing file
  import { Notification, CreateNotificationInput } from '../types/notification.js';

  export function createNotification(input: CreateNotificationInput): Notification {
    const id = generateId('notif');
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, type, category, title, body, data, priority, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, input.userId, input.type, input.category,
      input.title, input.body, JSON.stringify(input.data || null),
      input.priority || 'normal', input.expiresAt || null, now
    );
    return getNotificationById(id)!;
  }

depends_on: ["T-001", "T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 5

```yaml
id: T-005
phase: database
action: UPDATE
file: "database/db.ts"
status: pending

requirements:
  - "Add createDelivery function"
  - "Add updateDeliveryStatus function"
  - "Add getFailedDeliveries function for retry"
  - "Add markDeliveryForRetry function"

gotchas:
  - "Calculate next_retry_at based on retry_count"
  - "Exponential backoff: 1, 5, 15, 60 minutes"
  - "Max 4 retries before giving up"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing file

  export function createDelivery(notificationId: string, channel: string): NotificationDelivery {
    const id = generateId('deliv');
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO notification_deliveries (id, notification_id, channel, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `);
    stmt.run(id, notificationId, channel, now);
    return getDeliveryById(id)!;
  }

  export function getFailedDeliveries(): NotificationDelivery[] {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      SELECT * FROM notification_deliveries
      WHERE status = 'failed'
        AND retry_count < 4
        AND next_retry_at <= ?
      ORDER BY next_retry_at ASC
      LIMIT 100
    `);
    return (stmt.all(now) as any[]).map(mapDeliveryRow);
  }

depends_on: ["T-001", "T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 6

```yaml
id: T-006
phase: database
action: UPDATE
file: "database/db.ts"
status: pending

requirements:
  - "Add getTemplate function"
  - "Add getUserChannelPrefs function"
  - "Add setUserChannelPrefs function"
  - "Add getEffectiveChannels function (merge prefs with defaults)"

gotchas:
  - "Parse JSON channels array"
  - "Return default if no user pref exists"
  - "Check mutedUntil before returning channels"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing file

  export function getTemplate(type: string): NotificationTemplate | null {
    const stmt = db.prepare('SELECT * FROM notification_templates WHERE type = ?');
    const row = stmt.get(type) as any;
    if (!row) return null;
    return {
      ...row,
      defaultChannels: JSON.parse(row.default_channels)
    };
  }

  export function getEffectiveChannels(userId: string, type: string): NotificationChannel[] {
    const pref = getUserChannelPref(userId, type);
    if (pref) {
      if (pref.mutedUntil && new Date(pref.mutedUntil) > new Date()) {
        return [];
      }
      return pref.channels;
    }
    const template = getTemplate(type);
    return template?.defaultChannels || ['in_app'];
  }

depends_on: ["T-001", "T-002", "T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 4: Core Services

### Task 7

```yaml
id: T-007
phase: services
action: CREATE
file: "server/notifications/templates.ts"
status: pending

requirements:
  - "Create renderTemplate function"
  - "Support {{variable}} substitution"
  - "Handle missing variables gracefully"
  - "Support nested data paths (e.g., {{user.name}})"

gotchas:
  - "Use regex for simple substitution"
  - "Escape HTML in email templates"
  - "Return original string if variable missing"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Template Rendering
   */

  export function renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = getNestedValue(data, path);
      return value !== undefined ? String(value) : match;
    });
  }

  function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

depends_on: ["T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 8

```yaml
id: T-008
phase: services
action: CREATE
file: "server/notifications/queue.ts"
status: pending

requirements:
  - "Create NotificationQueue class"
  - "Add enqueue method for new notifications"
  - "Support priority-based ordering"
  - "Implement deduplication (same user+type+data within 1 hour)"
  - "Check expiration before processing"
  - "Emit events for new notifications"

gotchas:
  - "Use EventEmitter for internal events"
  - "Dedupe key = hash of userId + type + JSON.stringify(data)"
  - "Check expiresAt before processing"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Notification Queue
   * Handles notification creation with deduplication
   */
  import { EventEmitter } from 'events';
  import { createNotification, getTemplate } from '../../database/db.js';
  import { CreateNotificationInput, Notification } from '../../types/notification.js';
  import { renderTemplate } from './templates.js';

  class NotificationQueue extends EventEmitter {
    private dedupeCache = new Map<string, number>();
    private DEDUPE_TTL = 60 * 60 * 1000; // 1 hour

    async enqueue(input: CreateNotificationInput): Promise<Notification | null> {
      // Check dedupe
      const dedupeKey = this.getDedupeKey(input);
      const lastSent = this.dedupeCache.get(dedupeKey);
      if (lastSent && Date.now() - lastSent < this.DEDUPE_TTL) {
        return null; // Duplicate
      }

      // Get template and render
      const template = getTemplate(input.type);
      if (!template) {
        throw new Error(`Unknown notification type: ${input.type}`);
      }

      const title = renderTemplate(template.titleTemplate, input.data || {});
      const body = renderTemplate(template.bodyTemplate, input.data || {});

      const notification = createNotification({
        ...input,
        title,
        body,
        category: this.getCategoryFromType(input.type)
      });

      this.dedupeCache.set(dedupeKey, Date.now());
      this.emit('notification', notification);
      return notification;
    }

    private getDedupeKey(input: CreateNotificationInput): string {
      return `${input.userId}:${input.type}:${JSON.stringify(input.data || {})}`;
    }

    private getCategoryFromType(type: string): string {
      if (type.startsWith('agent_')) return 'agent';
      if (type.startsWith('session_')) return 'session';
      return 'system';
    }
  }

  export const notificationQueue = new NotificationQueue();

depends_on: ["T-004", "T-007"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 9

```yaml
id: T-009
phase: services
action: CREATE
file: "server/notifications/preferences.ts"
status: pending

requirements:
  - "Create NotificationPreferences class"
  - "Get effective channels for user+type"
  - "Cache preferences for performance"
  - "Support muting notifications"
  - "Invalidate cache on preference update"

gotchas:
  - "Cache key = userId:type"
  - "Check mutedUntil timestamp"
  - "Return empty array if muted"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Notification Preferences
   */
  import { getEffectiveChannels, setUserChannelPrefs, getUserChannelPrefs } from '../../database/db.js';
  import { NotificationChannel, ChannelPreference } from '../../types/notification.js';

  class NotificationPreferences {
    private cache = new Map<string, NotificationChannel[]>();

    getChannels(userId: string, type: string): NotificationChannel[] {
      const cacheKey = `${userId}:${type}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!;
      }
      const channels = getEffectiveChannels(userId, type);
      this.cache.set(cacheKey, channels);
      return channels;
    }

    setPreference(userId: string, type: string, channels: NotificationChannel[], mutedUntil?: string): void {
      setUserChannelPrefs(userId, type, channels, mutedUntil);
      this.cache.delete(`${userId}:${type}`);
    }

    clearCache(userId?: string): void {
      if (userId) {
        for (const key of this.cache.keys()) {
          if (key.startsWith(userId + ':')) {
            this.cache.delete(key);
          }
        }
      } else {
        this.cache.clear();
      }
    }
  }

  export const notificationPreferences = new NotificationPreferences();

depends_on: ["T-006"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 5: Channels

### Task 10

```yaml
id: T-010
phase: services
action: CREATE
file: "server/notifications/channels/in-app.ts"
status: pending

requirements:
  - "Create InAppChannel class"
  - "Store notification in database (already done by queue)"
  - "Broadcast via WebSocket"
  - "Update delivery status"

gotchas:
  - "WebSocket broadcast is fire-and-forget"
  - "Mark delivery as 'sent' immediately"
  - "Read status updates from WebSocket events"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * In-App Notification Channel
   */
  import { Notification, NotificationDelivery } from '../../../types/notification.js';
  import { createDelivery, updateDeliveryStatus } from '../../../database/db.js';
  import { broadcastToUser } from '../../websocket.js';

  export class InAppChannel {
    async send(notification: Notification): Promise<NotificationDelivery> {
      const delivery = createDelivery(notification.id, 'in_app');

      try {
        // Broadcast via WebSocket
        broadcastToUser(notification.userId, 'notification:new', notification);
        updateDeliveryStatus(delivery.id, 'sent');
        return { ...delivery, status: 'sent' };
      } catch (error) {
        updateDeliveryStatus(delivery.id, 'failed', String(error));
        return { ...delivery, status: 'failed', error: String(error) };
      }
    }
  }

  export const inAppChannel = new InAppChannel();

depends_on: ["T-003", "T-005"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 11

```yaml
id: T-011
phase: services
action: CREATE
file: "server/notifications/channels/email.ts"
status: pending

requirements:
  - "Create EmailChannel class"
  - "Use existing EmailSender"
  - "Render email subject and body from template"
  - "Track delivery status"
  - "Handle sending errors"

gotchas:
  - "Email sending is async - don't block"
  - "Use template.emailSubject and template.emailBody"
  - "Fall back to title/body if no email template"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Email Notification Channel
   */
  import { Notification, NotificationDelivery } from '../../../types/notification.js';
  import { createDelivery, updateDeliveryStatus, getTemplate, getUserEmail } from '../../../database/db.js';
  import { emailSender } from '../../services/email-sender.js';
  import { renderTemplate } from '../templates.js';

  export class EmailChannel {
    async send(notification: Notification): Promise<NotificationDelivery> {
      const delivery = createDelivery(notification.id, 'email');

      try {
        const email = getUserEmail(notification.userId);
        if (!email) {
          updateDeliveryStatus(delivery.id, 'skipped', 'No email address');
          return { ...delivery, status: 'skipped', error: 'No email address' };
        }

        const template = getTemplate(notification.type);
        const subject = template?.emailSubject
          ? renderTemplate(template.emailSubject, notification.data || {})
          : notification.title;
        const body = template?.emailBody
          ? renderTemplate(template.emailBody, notification.data || {})
          : notification.body;

        await emailSender.send({
          to: email,
          subject,
          html: body,
          text: notification.body
        });

        updateDeliveryStatus(delivery.id, 'sent');
        return { ...delivery, status: 'sent' };
      } catch (error) {
        updateDeliveryStatus(delivery.id, 'failed', String(error));
        return { ...delivery, status: 'failed', error: String(error) };
      }
    }
  }

  export const emailChannel = new EmailChannel();

depends_on: ["T-003", "T-005", "T-007"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 12

```yaml
id: T-012
phase: services
action: CREATE
file: "server/notifications/channels/telegram.ts"
status: pending

requirements:
  - "Create TelegramChannel class"
  - "Use existing TelegramSender"
  - "Render Telegram message from template"
  - "Check if user has Telegram configured"
  - "Track delivery status"

gotchas:
  - "User must have telegram_chat_id"
  - "Use Markdown formatting for Telegram"
  - "Handle rate limiting gracefully"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Telegram Notification Channel
   */
  import { Notification, NotificationDelivery } from '../../../types/notification.js';
  import { createDelivery, updateDeliveryStatus, getTemplate, getUserTelegram } from '../../../database/db.js';
  import { telegramSender } from '../../services/telegram-sender.js';
  import { renderTemplate } from '../templates.js';

  export class TelegramChannel {
    async send(notification: Notification): Promise<NotificationDelivery> {
      const delivery = createDelivery(notification.id, 'telegram');

      try {
        const telegramId = getUserTelegram(notification.userId);
        if (!telegramId) {
          updateDeliveryStatus(delivery.id, 'skipped', 'No Telegram configured');
          return { ...delivery, status: 'skipped', error: 'No Telegram configured' };
        }

        const template = getTemplate(notification.type);
        const text = template?.telegramText
          ? renderTemplate(template.telegramText, notification.data || {})
          : `*${notification.title}*\n${notification.body}`;

        await telegramSender.send(telegramId, text, { parse_mode: 'Markdown' });

        updateDeliveryStatus(delivery.id, 'sent');
        return { ...delivery, status: 'sent' };
      } catch (error) {
        updateDeliveryStatus(delivery.id, 'failed', String(error));
        return { ...delivery, status: 'failed', error: String(error) };
      }
    }
  }

  export const telegramChannel = new TelegramChannel();

depends_on: ["T-003", "T-005", "T-007"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 13

```yaml
id: T-013
phase: services
action: CREATE
file: "server/notifications/dispatcher.ts"
status: pending

requirements:
  - "Create NotificationDispatcher class"
  - "Listen to queue events"
  - "Get effective channels for user"
  - "Dispatch to each channel"
  - "Handle channel failures independently"

gotchas:
  - "One channel failure shouldn't block others"
  - "Log all dispatches for debugging"
  - "Skip channels not in user preferences"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Notification Dispatcher
   * Routes notifications to appropriate channels
   */
  import { Notification } from '../../types/notification.js';
  import { notificationPreferences } from './preferences.js';
  import { inAppChannel } from './channels/in-app.js';
  import { emailChannel } from './channels/email.js';
  import { telegramChannel } from './channels/telegram.js';

  class NotificationDispatcher {
    private channels = {
      in_app: inAppChannel,
      email: emailChannel,
      telegram: telegramChannel
    };

    async dispatch(notification: Notification): Promise<void> {
      const channels = notificationPreferences.getChannels(
        notification.userId,
        notification.type
      );

      if (channels.length === 0) {
        console.log(`Notification ${notification.id} skipped - no active channels`);
        return;
      }

      // Dispatch to all channels in parallel
      const results = await Promise.allSettled(
        channels.map(channel => this.channels[channel]?.send(notification))
      );

      // Log results
      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          console.error(`Channel ${channels[idx]} failed:`, result.reason);
        }
      });
    }
  }

  export const notificationDispatcher = new NotificationDispatcher();

depends_on: ["T-009", "T-010", "T-011", "T-012"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 14

```yaml
id: T-014
phase: services
action: CREATE
file: "server/notifications/retry.ts"
status: pending

requirements:
  - "Create RetryProcessor class"
  - "Query failed deliveries due for retry"
  - "Calculate exponential backoff"
  - "Retry delivery"
  - "Mark as permanent failure after max retries"

gotchas:
  - "Backoff: 1, 5, 15, 60 minutes"
  - "Max 4 retries"
  - "Run on interval, not for each notification"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Retry Processor
   * Handles failed notification retries with exponential backoff
   */
  import { getFailedDeliveries, getNotificationById, markDeliveryForRetry, updateDeliveryStatus } from '../../database/db.js';
  import { inAppChannel } from './channels/in-app.js';
  import { emailChannel } from './channels/email.js';
  import { telegramChannel } from './channels/telegram.js';

  const BACKOFF_MINUTES = [1, 5, 15, 60];
  const MAX_RETRIES = 4;

  class RetryProcessor {
    private intervalId: NodeJS.Timer | null = null;
    private channels = { in_app: inAppChannel, email: emailChannel, telegram: telegramChannel };

    start(intervalMs = 60000): void {
      this.intervalId = setInterval(() => this.processRetries(), intervalMs);
    }

    stop(): void {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }

    async processRetries(): Promise<void> {
      const deliveries = getFailedDeliveries();

      for (const delivery of deliveries) {
        const notification = getNotificationById(delivery.notificationId);
        if (!notification) continue;

        const channel = this.channels[delivery.channel as keyof typeof this.channels];
        if (!channel) continue;

        try {
          await channel.send(notification);
        } catch (error) {
          if (delivery.retryCount >= MAX_RETRIES - 1) {
            updateDeliveryStatus(delivery.id, 'failed', `Max retries exceeded: ${error}`);
          } else {
            const nextRetry = new Date(Date.now() + BACKOFF_MINUTES[delivery.retryCount] * 60000);
            markDeliveryForRetry(delivery.id, nextRetry.toISOString());
          }
        }
      }
    }
  }

  export const retryProcessor = new RetryProcessor();

depends_on: ["T-005", "T-010", "T-011", "T-012"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 6: WebSocket Integration

### Task 15

```yaml
id: T-015
phase: services
action: CREATE
file: "server/notifications/realtime.ts"
status: pending

requirements:
  - "Create NotificationRealtime class"
  - "Handle notification:read events from clients"
  - "Broadcast unread count updates"
  - "Integrate with notification queue"

gotchas:
  - "Broadcast to all user's connections"
  - "Update unread count after read/archive"
  - "Subscribe to queue events"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Real-time Notification Updates
   */
  import { notificationQueue } from './queue.js';
  import { notificationDispatcher } from './dispatcher.js';
  import { getUnreadCount, markNotificationRead } from '../../database/db.js';
  import { broadcastToUser, onUserEvent } from '../websocket.js';

  class NotificationRealtime {
    init(): void {
      // Listen for new notifications
      notificationQueue.on('notification', async (notification) => {
        await notificationDispatcher.dispatch(notification);
      });

      // Listen for client read events
      onUserEvent('notification:mark-read', async (userId, data) => {
        const notification = markNotificationRead(data.notificationId);
        if (notification) {
          broadcastToUser(userId, 'notification:read', { id: notification.id, readAt: notification.readAt });
          this.broadcastUnreadCount(userId);
        }
      });
    }

    async broadcastUnreadCount(userId: string): Promise<void> {
      const count = getUnreadCount(userId);
      broadcastToUser(userId, 'notification:unread-count', { count });
    }
  }

  export const notificationRealtime = new NotificationRealtime();

depends_on: ["T-004", "T-008", "T-013"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 16

```yaml
id: T-016
phase: services
action: UPDATE
file: "server/websocket.ts"
status: pending

requirements:
  - "Add broadcastToUser helper function"
  - "Add onUserEvent subscription function"
  - "Track user connections by userId"
  - "Handle notification-specific events"

gotchas:
  - "User may have multiple connections"
  - "Broadcast to all user connections"
  - "Clean up on disconnect"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing websocket.ts

  const userConnections = new Map<string, Set<WebSocket>>();
  const eventHandlers = new Map<string, (userId: string, data: any) => void>();

  export function broadcastToUser(userId: string, event: string, data: any): void {
    const connections = userConnections.get(userId);
    if (!connections) return;

    const message = JSON.stringify({ event, data });
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  export function onUserEvent(event: string, handler: (userId: string, data: any) => void): void {
    eventHandlers.set(event, handler);
  }

  // In connection handler, track by userId
  // In message handler, route to eventHandlers

depends_on: []
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 7: API Routes

### Task 17

```yaml
id: T-017
phase: api
action: CREATE
file: "server/routes/notifications.ts"
status: pending

requirements:
  - "Create GET /api/notifications endpoint"
  - "Support query params: limit, offset, unread"
  - "Return notifications with total and unread count"
  - "Require authentication"

gotchas:
  - "Default limit 20, max 100"
  - "Parse unread as boolean"
  - "Order by created_at DESC"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Notification API Routes
   */
  import { Router } from 'express';
  import { getNotifications, getUnreadCount } from '../../database/db.js';
  import { requireAuth } from '../middleware/auth.js';

  const router = Router();

  // GET /api/notifications
  router.get('/', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const unreadOnly = req.query.unread === 'true';

      const notifications = getNotifications(userId, { limit, offset, unreadOnly });
      const total = getNotificationCount(userId, { unreadOnly });
      const unreadCount = getUnreadCount(userId);

      res.json({ notifications, total, unreadCount });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  export default router;

depends_on: ["T-004"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 18

```yaml
id: T-018
phase: api
action: UPDATE
file: "server/routes/notifications.ts"
status: pending

requirements:
  - "Add GET /api/notifications/unread-count endpoint"
  - "Add POST /api/notifications/:id/read endpoint"
  - "Add POST /api/notifications/:id/archive endpoint"
  - "Add POST /api/notifications/read-all endpoint"

gotchas:
  - "Verify notification belongs to user"
  - "Return 404 if notification not found"
  - "Broadcast updates via WebSocket"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing notifications.ts

  // GET /api/notifications/unread-count
  router.get('/unread-count', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const count = getUnreadCount(userId);
    res.json({ count });
  });

  // POST /api/notifications/:id/read
  router.post('/:id/read', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const notification = getNotificationById(req.params.id);

    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = markNotificationRead(req.params.id);
    notificationRealtime.broadcastUnreadCount(userId);
    res.json(updated);
  });

  // POST /api/notifications/:id/archive
  router.post('/:id/archive', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const notification = getNotificationById(req.params.id);

    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = markNotificationArchived(req.params.id);
    res.json(updated);
  });

  // POST /api/notifications/read-all
  router.post('/read-all', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const count = markAllNotificationsRead(userId);
    notificationRealtime.broadcastUnreadCount(userId);
    res.json({ count });
  });

depends_on: ["T-004", "T-015", "T-017"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 19

```yaml
id: T-019
phase: api
action: UPDATE
file: "server/routes/notifications.ts"
status: pending

requirements:
  - "Add GET /api/notifications/preferences endpoint"
  - "Add PUT /api/notifications/preferences endpoint"
  - "Return all user channel preferences"
  - "Accept array of preference updates"

gotchas:
  - "Initialize missing preferences from template defaults"
  - "Clear preference cache after update"
  - "Validate channel values"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing notifications.ts

  // GET /api/notifications/preferences
  router.get('/preferences', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const preferences = getAllUserChannelPrefs(userId);
    res.json({ preferences });
  });

  // PUT /api/notifications/preferences
  router.put('/preferences', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const updates = req.body.preferences as ChannelPreference[];

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'preferences must be an array' });
    }

    for (const pref of updates) {
      if (!pref.notificationType || !Array.isArray(pref.channels)) {
        return res.status(400).json({ error: 'Invalid preference format' });
      }
      notificationPreferences.setPreference(
        userId,
        pref.notificationType,
        pref.channels,
        pref.mutedUntil
      );
    }

    const preferences = getAllUserChannelPrefs(userId);
    res.json({ preferences });
  });

depends_on: ["T-009", "T-017"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 20

```yaml
id: T-020
phase: api
action: UPDATE
file: "server/api.ts"
status: pending

requirements:
  - "Import notifications router"
  - "Mount at /api/notifications"
  - "Initialize notification system on startup"

gotchas:
  - "Initialize realtime before routes"
  - "Start retry processor"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add imports
  import notificationsRouter from './routes/notifications.js';
  import { notificationRealtime } from './notifications/realtime.js';
  import { retryProcessor } from './notifications/retry.js';

  // Initialize notification system
  notificationRealtime.init();
  retryProcessor.start();

  // Mount routes
  app.use('/api/notifications', notificationsRouter);

depends_on: ["T-15", "T-14", "T-17", "T-18", "T-19"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 8: Module Exports

### Task 21

```yaml
id: T-021
phase: exports
action: CREATE
file: "server/notifications/index.ts"
status: pending

requirements:
  - "Export all notification components"
  - "Export main notify function for external use"
  - "Re-export types"

gotchas:
  - "Provide simple notify() function for common use case"
  - "Export queue for advanced usage"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Notification System Exports
   */
  export { notificationQueue } from './queue.js';
  export { notificationDispatcher } from './dispatcher.js';
  export { notificationPreferences } from './preferences.js';
  export { notificationRealtime } from './realtime.js';
  export { retryProcessor } from './retry.js';
  export { renderTemplate } from './templates.js';

  // Convenience function
  export async function notify(
    userId: string,
    type: string,
    data?: Record<string, any>,
    priority?: 'urgent' | 'high' | 'normal' | 'low'
  ) {
    const { notificationQueue } = await import('./queue.js');
    return notificationQueue.enqueue({ userId, type, data, priority });
  }

depends_on: ["T-008", "T-009", "T-013", "T-14", "T-15"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 9: Tests

### Task 22

```yaml
id: T-022
phase: tests
action: CREATE
file: "tests/notification-queue.test.ts"
status: pending

requirements:
  - "Test notification creation"
  - "Test deduplication within 1 hour"
  - "Test priority ordering"
  - "Test template rendering"
  - "Test expiration handling"

gotchas:
  - "Mock time for dedup tests"
  - "Clean up between tests"
  - "Use test database"

validation:
  command: "npm test -- --grep 'notification-queue'"
  expected: "all tests pass"

code_template: |
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { notificationQueue } from '../server/notifications/queue.js';

  describe('Notification Queue', () => {
    beforeEach(() => {
      // Clear dedup cache
    });

    it('should create notification from template', async () => {
      const notification = await notificationQueue.enqueue({
        userId: 'user-1',
        type: 'agent_question',
        data: { agentName: 'Spec Agent', question: 'What database?' }
      });

      expect(notification).toBeDefined();
      expect(notification!.title).toBe('Agent needs your input');
      expect(notification!.body).toContain('Spec Agent');
    });

    it('should deduplicate within 1 hour', async () => {
      const first = await notificationQueue.enqueue({
        userId: 'user-1',
        type: 'agent_question',
        data: { agentName: 'Test', question: 'Same?' }
      });
      const second = await notificationQueue.enqueue({
        userId: 'user-1',
        type: 'agent_question',
        data: { agentName: 'Test', question: 'Same?' }
      });

      expect(first).toBeDefined();
      expect(second).toBeNull(); // Deduplicated
    });
  });

depends_on: ["T-008"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 23

```yaml
id: T-023
phase: tests
action: CREATE
file: "tests/notification-channels.test.ts"
status: pending

requirements:
  - "Test in-app channel creates delivery"
  - "Test email channel sends email"
  - "Test telegram channel sends message"
  - "Test channel skips if user not configured"
  - "Test delivery status tracking"

gotchas:
  - "Mock email and telegram senders"
  - "Mock WebSocket broadcast"
  - "Test both success and failure paths"

validation:
  command: "npm test -- --grep 'notification-channels'"
  expected: "all tests pass"

code_template: |
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { inAppChannel } from '../server/notifications/channels/in-app.js';
  import { emailChannel } from '../server/notifications/channels/email.js';

  vi.mock('../server/websocket.js', () => ({
    broadcastToUser: vi.fn()
  }));

  vi.mock('../server/services/email-sender.js', () => ({
    emailSender: { send: vi.fn().mockResolvedValue(true) }
  }));

  describe('Notification Channels', () => {
    const mockNotification = {
      id: 'notif-1',
      userId: 'user-1',
      type: 'agent_question',
      category: 'agent',
      title: 'Test',
      body: 'Test body',
      data: null,
      priority: 'normal' as const,
      readAt: null,
      archivedAt: null,
      expiresAt: null,
      createdAt: new Date().toISOString()
    };

    it('should send in-app notification', async () => {
      const delivery = await inAppChannel.send(mockNotification);
      expect(delivery.status).toBe('sent');
      expect(delivery.channel).toBe('in_app');
    });
  });

depends_on: ["T-010", "T-011", "T-012"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 24

```yaml
id: T-024
phase: tests
action: CREATE
file: "tests/notification-api.test.ts"
status: pending

requirements:
  - "Test GET /api/notifications"
  - "Test GET /api/notifications/unread-count"
  - "Test POST /api/notifications/:id/read"
  - "Test POST /api/notifications/read-all"
  - "Test preference endpoints"
  - "Test authentication required"

gotchas:
  - "Mock authentication middleware"
  - "Set up test notifications"
  - "Clean up after tests"

validation:
  command: "npm test -- --grep 'notification-api'"
  expected: "all tests pass"

code_template: |
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import request from 'supertest';
  import { app } from '../server/api.js';

  describe('Notification API', () => {
    const testUserId = 'api-test-user';
    let authToken: string;

    beforeEach(async () => {
      // Create test user and get token
      // Create test notifications
    });

    afterEach(async () => {
      // Clean up
    });

    it('should list notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toBeDefined();
      expect(res.body.total).toBeDefined();
      expect(res.body.unreadCount).toBeDefined();
    });

    it('should return unread count', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.count).toBe('number');
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });
  });

depends_on: ["T-17", "T-18", "T-19"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Execution Log

| Task | Status | Started | Completed | Duration | Notes |
|------|--------|---------|-----------|----------|-------|
| | | | | | |

---

## Discoveries

### Patterns Discovered

| Pattern | Context | Confidence |
|---------|---------|------------|
| | | |

### Gotchas Discovered

| Gotcha | Context | Should Propagate? |
|--------|---------|-------------------|
| | | |

---

## Validation Results

### TypeScript Check

```
[output of npx tsc --noEmit]
```

### Test Results

```
[output of npm test]
```

---

## Completion Checklist

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] No TypeScript errors
- [ ] Tests passing
- [ ] Discoveries recorded in Knowledge Base
- [ ] Execution log updated

---

## Sign-off

**Completed By:**
**Completed At:**
**Final Status:**
**Commits:**

---

*Generated for Spec Agent reference*
*Executed by Build Agent*
