---
id: "notifications"
title: "Notification System"
idea_type: "feature_internal"
creator: "system"
created: "2026-01-10"
updated: "2026-01-10"
status: "approved"
version: "1.0"
complexity: "complex"
---

# Technical Specification: Notification System

## Context References

**Required Reading:**

- [x] `README.md` - Idea overview
- [x] `planning/brief.md` - Feature brief

**Patterns to Follow:**

- Section: "Database Patterns" - Use SQLite with TEXT timestamps
- Section: "API Routes" - Express router patterns
- Section: "WebSocket" - Real-time communication patterns
- Section: "Email" - EmailSender integration

---

## Overview

**Objective:**
Implement a comprehensive notification system that centralizes all notifications, supports multiple delivery channels (in-app, email, Telegram), provides real-time updates via WebSocket, and respects user notification preferences.

**Success Criteria:**

1. Notifications are created when events occur
2. In-app notifications appear in real-time via WebSocket
3. Email notifications are sent for enabled types
4. Telegram notifications work for configured users
5. User preferences are respected per notification type
6. Failed deliveries are retried with exponential backoff
7. Read/archive status syncs across clients
8. Notification count updates in real-time

**Out of Scope:**

- Push notifications (FCM/APNs)
- Notification grouping/collapsing in UI
- Notification sounds/vibration
- Scheduled notifications (beyond digest)
- Notification analytics
- A/B testing
- Notification center UI component
- Rich media in notifications

---

## Functional Requirements

| ID     | Requirement        | Priority | Acceptance Criteria                  | Source |
| ------ | ------------------ | -------- | ------------------------------------ | ------ |
| FR-001 | Notification queue | Must     | Events queued and processed          | Brief  |
| FR-002 | In-app channel     | Must     | Store in DB, broadcast via WebSocket | Brief  |
| FR-003 | Email channel      | Must     | Send via existing EmailSender        | Brief  |
| FR-004 | Telegram channel   | Should   | Send via existing TelegramSender     | Brief  |
| FR-005 | User preferences   | Must     | Respect per-type channel settings    | Brief  |
| FR-006 | Read/archive       | Must     | Mark notifications read/archived     | Brief  |
| FR-007 | Retry logic        | Must     | Retry failed deliveries with backoff | Brief  |
| FR-008 | Templates          | Should   | Consistent notification formatting   | Brief  |
| FR-009 | List API           | Must     | Paginated notification list          | Brief  |
| FR-010 | Unread count       | Must     | Real-time unread count               | Brief  |

### Detailed Requirements

#### FR-001: Notification Queue

**Description:** Event-driven notification creation with priority-based processing and deduplication.

**User Story:** As the system, I want to queue notifications when events occur so they can be processed reliably.

**Acceptance Criteria:**

- [x] Events trigger notification creation
- [x] Priority levels: urgent, high, normal, low
- [x] Duplicate notifications are prevented within 1 hour
- [x] Expired notifications are skipped

#### FR-002: In-App Channel

**Description:** Store notifications in database and broadcast to connected WebSocket clients.

**User Story:** As a user, I want to see notifications in real-time without refreshing the page.

**Acceptance Criteria:**

- [x] Notifications stored in database
- [x] WebSocket broadcast on new notification
- [x] Read status synced via WebSocket
- [x] Unread count broadcast on changes

#### FR-003: Email Channel

**Description:** Send email notifications using existing EmailSender service.

**User Story:** As a user, I want to receive email notifications for important events.

**Acceptance Criteria:**

- [x] Uses existing EmailSender
- [x] HTML and plain text templates
- [x] Respects user email preferences
- [x] Tracks delivery status

#### FR-004: Telegram Channel

**Description:** Send Telegram notifications using existing TelegramSender service.

**User Story:** As a user, I want to receive Telegram notifications on my phone.

**Acceptance Criteria:**

- [x] Uses existing TelegramSender
- [x] Message formatting for Telegram
- [x] Respects user Telegram settings
- [x] Only sends if user has Telegram configured

---

## Non-Functional Requirements

| Category    | Requirement           | Target   | Validation Method |
| ----------- | --------------------- | -------- | ----------------- |
| Performance | Notification dispatch | < 100ms  | Timing logs       |
| Reliability | Delivery success      | 99%      | Delivery tracking |
| Scalability | Queue throughput      | 1000/min | Load test         |
| Latency     | WebSocket broadcast   | < 50ms   | Client timing     |

---

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                      NOTIFICATION SYSTEM                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│   │   Event     │────▶│  Notification   │────▶│   Dispatcher    │  │
│   │  Producer   │     │     Queue       │     │                 │  │
│   └─────────────┘     └─────────────────┘     └────────┬────────┘  │
│                                                         │           │
│                    ┌────────────────────────────────────┼───────┐  │
│                    │                │                   │       │  │
│                    ▼                ▼                   ▼       ▼  │
│             ┌──────────┐    ┌──────────┐    ┌──────────┐  ┌──────┐│
│             │  In-App  │    │  Email   │    │ Telegram │  │Digest││
│             │ Channel  │    │ Channel  │    │ Channel  │  │Queue ││
│             └──────────┘    └──────────┘    └──────────┘  └──────┘│
│                    │                │                   │          │
│                    ▼                ▼                   ▼          │
│             ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│             │WebSocket │    │   SMTP   │    │ Bot API  │          │
│             └──────────┘    └──────────┘    └──────────┘          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### New Files

| File Path                                            | Purpose               | Owner       |
| ---------------------------------------------------- | --------------------- | ----------- |
| `database/migrations/027_notifications.sql`          | Notification tables   | Build Agent |
| `database/migrations/028_notification_templates.sql` | Seed templates        | Build Agent |
| `types/notification.ts`                              | TypeScript interfaces | Build Agent |
| `server/notifications/queue.ts`                      | Notification queue    | Build Agent |
| `server/notifications/dispatcher.ts`                 | Route to channels     | Build Agent |
| `server/notifications/channels/in-app.ts`            | In-app channel        | Build Agent |
| `server/notifications/channels/email.ts`             | Email channel         | Build Agent |
| `server/notifications/channels/telegram.ts`          | Telegram channel      | Build Agent |
| `server/notifications/realtime.ts`                   | WebSocket integration | Build Agent |
| `server/notifications/templates.ts`                  | Template rendering    | Build Agent |
| `server/notifications/preferences.ts`                | Preference manager    | Build Agent |
| `server/notifications/retry.ts`                      | Retry logic           | Build Agent |
| `server/routes/notifications.ts`                     | API endpoints         | Build Agent |
| `server/notifications/index.ts`                      | Module exports        | Build Agent |

### Modified Files

| File Path             | Changes                   | Owner       |
| --------------------- | ------------------------- | ----------- |
| `server/api.ts`       | Mount notification routes | Build Agent |
| `server/websocket.ts` | Add notification events   | Build Agent |

### Files to Avoid

| File Path                            | Reason                        | Owner         |
| ------------------------------------ | ----------------------------- | ------------- |
| `server/services/email-sender.ts`    | Existing service, just use it | Email team    |
| `server/services/telegram-sender.ts` | Existing service, just use it | Telegram team |

---

## API Design

### Endpoints

| Endpoint                          | Method | Description          | Auth     | Request        | Response         |
| --------------------------------- | ------ | -------------------- | -------- | -------------- | ---------------- |
| `/api/notifications`              | GET    | List notifications   | Required | Query params   | NotificationList |
| `/api/notifications/unread-count` | GET    | Get unread count     | Required | -              | { count }        |
| `/api/notifications/:id/read`     | POST   | Mark as read         | Required | -              | Notification     |
| `/api/notifications/:id/archive`  | POST   | Archive notification | Required | -              | Notification     |
| `/api/notifications/read-all`     | POST   | Mark all read        | Required | -              | { count }        |
| `/api/notifications/preferences`  | GET    | Get preferences      | Required | -              | ChannelPrefs[]   |
| `/api/notifications/preferences`  | PUT    | Update preferences   | Required | ChannelPrefs[] | ChannelPrefs[]   |

### Request/Response Examples

#### GET /api/notifications

**Request:**

```
GET /api/notifications?limit=20&offset=0&unread=true
```

**Response:**

```json
{
  "notifications": [
    {
      "id": "notif-123",
      "type": "agent_question",
      "category": "agent",
      "title": "Agent needs your input",
      "body": "The Spec Agent has a question about the database schema.",
      "data": { "sessionId": "sess-456", "agentId": "spec-agent" },
      "priority": "high",
      "readAt": null,
      "archivedAt": null,
      "createdAt": "2026-01-10T12:00:00Z"
    }
  ],
  "total": 45,
  "unreadCount": 12
}
```

#### GET /api/notifications/unread-count

**Response:**

```json
{
  "count": 12
}
```

#### POST /api/notifications/:id/read

**Response:**

```json
{
  "id": "notif-123",
  "readAt": "2026-01-10T12:05:00Z"
}
```

#### GET /api/notifications/preferences

**Response:**

```json
{
  "preferences": [
    {
      "notificationType": "agent_question",
      "channels": ["in_app", "email", "telegram"],
      "mutedUntil": null
    },
    {
      "notificationType": "agent_completed",
      "channels": ["in_app"],
      "mutedUntil": null
    }
  ]
}
```

### WebSocket Events

| Event                       | Direction     | Payload        | Description       |
| --------------------------- | ------------- | -------------- | ----------------- |
| `notification:new`          | Server→Client | Notification   | New notification  |
| `notification:read`         | Server→Client | { id, readAt } | Notification read |
| `notification:unread-count` | Server→Client | { count }      | Count updated     |

---

## Data Models

### Database Schema

```sql
-- Migration 027: Notification System
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

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    delivered_at TEXT,
    read_at TEXT,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (notification_id) REFERENCES notifications(id)
);

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

CREATE TABLE IF NOT EXISTS notification_channel_prefs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    channels TEXT DEFAULT '["in_app"]',
    muted_until TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, notification_type)
);

CREATE TABLE IF NOT EXISTS notification_digest (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    digest_type TEXT NOT NULL,
    notification_ids TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON notification_deliveries(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_digest_scheduled ON notification_digest(scheduled_for) WHERE sent_at IS NULL;
```

### TypeScript Interfaces

```typescript
export type NotificationPriority = "urgent" | "high" | "normal" | "low";
export type NotificationChannel = "in_app" | "email" | "telegram";
export type DeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "skipped";

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

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  deliveredAt: string | null;
  readAt: string | null;
  error: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  type: string;
  titleTemplate: string;
  bodyTemplate: string;
  emailSubject: string | null;
  emailBody: string | null;
  telegramText: string | null;
  defaultChannels: NotificationChannel[];
  createdAt: string;
  updatedAt: string;
}

export interface ChannelPreference {
  id: string;
  userId: string;
  notificationType: string;
  channels: NotificationChannel[];
  mutedUntil: string | null;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  data?: Record<string, any>;
  priority?: NotificationPriority;
  expiresAt?: string;
}

export interface NotificationListResult {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}
```

---

## Dependencies

### Internal Dependencies

| Dependency       | Status | Blocks | Owner    |
| ---------------- | ------ | ------ | -------- |
| Database (db.ts) | Ready  | None   | Core     |
| Express app      | Ready  | None   | Core     |
| WebSocket server | Ready  | None   | Core     |
| EmailSender      | Ready  | None   | Email    |
| TelegramSender   | Ready  | None   | Telegram |
| Users table      | Ready  | None   | Auth     |

### External Dependencies

| Package | Version | Purpose                  |
| ------- | ------- | ------------------------ |
| express | ^4.18   | Web framework (existing) |
| ws      | ^8.x    | WebSocket (existing)     |

---

## Known Gotchas

| ID    | Gotcha                                          | Source         | Confidence |
| ----- | ----------------------------------------------- | -------------- | ---------- |
| G-001 | Use TEXT for SQLite timestamps                  | Knowledge Base | High       |
| G-002 | JSON columns store as TEXT in SQLite            | Knowledge Base | High       |
| G-003 | Parse JSON when reading, stringify when writing | Experience     | High       |
| G-004 | WebSocket may disconnect - handle reconnection  | Experience     | High       |
| G-005 | Email sending is async - don't block on it      | Experience     | High       |
| G-006 | Telegram rate limits - batch if needed          | Experience     | Medium     |
| G-007 | Exponential backoff: 1min, 5min, 15min, 1hr     | Experience     | High       |

---

## Validation Strategy

### Unit Tests

| Test File                               | Coverage Target | Priority |
| --------------------------------------- | --------------- | -------- |
| `tests/notification-queue.test.ts`      | 85%             | High     |
| `tests/notification-dispatcher.test.ts` | 80%             | High     |
| `tests/notification-channels.test.ts`   | 75%             | Medium   |
| `tests/notification-api.test.ts`        | 80%             | High     |

### Validation Commands

```bash
# TypeScript check
npx tsc --noEmit

# Run tests
npm test -- --grep "notification"

# Manual validation
curl http://localhost:3000/api/notifications -H "Authorization: Bearer $TOKEN" | jq
```

### Manual Validation

- [ ] Create notification, verify WebSocket broadcast
- [ ] Mark notification read, verify sync across clients
- [ ] Trigger email notification, verify delivery
- [ ] Trigger Telegram notification, verify delivery
- [ ] Update preferences, verify respected on next notification
- [ ] Simulate failure, verify retry with backoff

---

## Risk Assessment

| Risk                     | Likelihood | Impact | Mitigation                           |
| ------------------------ | ---------- | ------ | ------------------------------------ |
| WebSocket disconnections | Medium     | Medium | Reconnection logic, fallback polling |
| Email delivery failures  | Low        | Medium | Retry queue, dead letter handling    |
| Notification spam        | Medium     | Low    | Rate limiting, digest batching       |
| Database growth          | Medium     | Low    | TTL on old notifications             |
| Template changes break   | Low        | Medium | Version templates                    |

---

## Implementation Notes

1. Queue uses in-memory processing with database persistence
2. Dispatcher runs as background task, processes queue every 100ms
3. Channels are independent - one failure doesn't block others
4. Retry uses exponential backoff: 1min, 5min, 15min, 1hr, then give up
5. WebSocket broadcasts are fire-and-forget
6. Templates use simple {{variable}} substitution
7. Preferences are cached for performance

---

## Approval

- [x] **Approved** - Complex feature reviewed

**Approved By:** System
**Approved At:** 2026-01-10
**Notes:** Complex feature, well-defined scope, proper channel abstraction

---

_Generated for Spec Agent reference_
_See `tasks.md` for implementation breakdown_
