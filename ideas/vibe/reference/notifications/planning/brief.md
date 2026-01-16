---
id: notifications
title: Notification System
complexity: complex
creator: system
created: 2026-01-10
updated: 2026-01-10
---

# Brief: Notification System

## Problem

The Vibe platform has no unified notification system. Users miss important events because:

- There's no in-app notification center
- Email notifications are inconsistent
- Push notifications don't exist
- Real-time updates require page refresh

This leads to:

- Missed agent questions that block progress
- Delayed responses to important events
- Poor user engagement
- Frustration with the platform

## Solution

Implement a comprehensive notification system that:

1. Centralizes all notifications in a unified queue
2. Supports multiple delivery channels (in-app, email, push, Telegram)
3. Provides real-time updates via WebSocket
4. Respects user notification preferences
5. Allows notification batching for digests

### Architecture

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
│             │  In-App  │    │  Email   │    │   Push   │  │Telegram│
│             │ Channel  │    │ Channel  │    │ Channel  │  │Channel││
│             └──────────┘    └──────────┘    └──────────┘  └──────┘│
│                    │                │                   │       │  │
│                    ▼                ▼                   ▼       ▼  │
│             ┌──────────┐    ┌──────────┐    ┌──────────┐  ┌──────┐│
│             │WebSocket │    │   SMTP   │    │   FCM    │  │Bot API││
│             └──────────┘    └──────────┘    └──────────┘  └──────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Database Tables:
┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ notifications  │  │ delivery_status │  │ notification_    │
│                │  │                 │  │ templates        │
└────────────────┘  └─────────────────┘  └──────────────────┘
```

### Database Schema

```sql
-- Core notifications table
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSON,
  priority TEXT DEFAULT 'normal',
  read_at TEXT,
  archived_at TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Delivery tracking per channel
CREATE TABLE notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  delivered_at TEXT,
  read_at TEXT,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(id)
);

-- Notification templates for consistent formatting
CREATE TABLE notification_templates (
  id TEXT PRIMARY KEY,
  type TEXT UNIQUE NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  email_subject TEXT,
  email_body TEXT,
  push_title TEXT,
  push_body TEXT,
  default_channels JSON DEFAULT '["in_app"]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User channel preferences (extends user_preferences)
CREATE TABLE notification_channel_prefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  channels JSON DEFAULT '["in_app"]',
  muted_until TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, notification_type)
);

-- Digest queue for batched notifications
CREATE TABLE notification_digest (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  digest_type TEXT NOT NULL,
  notification_ids JSON NOT NULL,
  scheduled_for TEXT NOT NULL,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_deliveries_status ON notification_deliveries(status, next_retry_at);
CREATE INDEX idx_digest_scheduled ON notification_digest(scheduled_for) WHERE sent_at IS NULL;
```

## MVP Scope

### In Scope

1. **Notification Queue** (`server/notifications/queue.ts`)
   - Event-driven notification creation
   - Priority-based processing
   - Deduplication logic
   - Expiration handling

2. **Dispatcher** (`server/notifications/dispatcher.ts`)
   - Route to appropriate channels
   - Respect user preferences
   - Handle delivery failures
   - Retry logic with backoff

3. **Channels**
   - **In-App** (`server/notifications/channels/in-app.ts`)
     - Store in database
     - Broadcast via WebSocket
   - **Email** (`server/notifications/channels/email.ts`)
     - Use existing EmailSender
     - HTML and plain text templates
   - **Telegram** (`server/notifications/channels/telegram.ts`)
     - Use existing TelegramSender
     - Map notification types to message formats

4. **WebSocket Integration** (`server/notifications/realtime.ts`)
   - New notification events
   - Read/archive status sync
   - Connection state handling

5. **API Endpoints**
   - `GET /api/notifications` - List notifications (paginated)
   - `GET /api/notifications/unread-count` - Get unread count
   - `POST /api/notifications/:id/read` - Mark as read
   - `POST /api/notifications/:id/archive` - Archive notification
   - `POST /api/notifications/read-all` - Mark all as read
   - `GET /api/notifications/preferences` - Get channel preferences
   - `PUT /api/notifications/preferences` - Update preferences

6. **Templates** (seeded via migration)
   - `agent_question` - Agent needs human input
   - `agent_completed` - Agent finished task
   - `agent_error` - Agent encountered error
   - `session_update` - Ideation session update
   - `system_alert` - System-level alert

7. **Database Migrations**
   - Create all notification tables
   - Seed default templates

### Out of Scope

- Push notifications (FCM/APNs setup)
- Notification grouping/collapsing in UI
- Notification sounds/vibration
- Scheduled notifications (beyond digest)
- Notification analytics
- A/B testing of notification content
- Notification center UI component
- Rich media in notifications

### Success Criteria

- [ ] Notifications are created when events occur
- [ ] In-app notifications appear in real-time via WebSocket
- [ ] Email notifications are sent for enabled types
- [ ] Telegram notifications work for configured users
- [ ] User preferences are respected per notification type
- [ ] Failed deliveries are retried with backoff
- [ ] Read/archive status syncs across clients
- [ ] Notification count updates in real-time

### Estimated Effort

- Database migrations: 1 hour
- Notification queue: 3 hours
- Dispatcher: 3 hours
- In-app channel: 2 hours
- Email channel: 2 hours
- Telegram channel: 1 hour
- WebSocket integration: 2 hours
- API endpoints: 3 hours
- Templates: 1 hour
- Testing: 2 hours

**Total: ~20-25 hours**

### Risks

| Risk                           | Mitigation                              |
| ------------------------------ | --------------------------------------- |
| WebSocket disconnections       | Fallback to polling, reconnection logic |
| Email delivery failures        | Retry queue, dead letter handling       |
| Notification spam              | Rate limiting, digest batching          |
| Database growth                | TTL on old notifications, archival      |
| Template changes break clients | Version templates, backward compat      |
