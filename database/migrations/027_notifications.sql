-- Migration 027: User Notification System
-- Created: 2026-01-10
-- Purpose: Core notification tables for user notifications (inbox)
-- Note: Distinct from 'notifications' table in 030_communication_tables.sql which is for agent deliveries

-- Main user notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    read_at TEXT,
    archived_at TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Index for user notifications list (most common query)
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
    ON user_notifications(user_id, created_at DESC);

-- Index for unread notifications (badge count)
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
    ON user_notifications(user_id) WHERE read_at IS NULL;

-- Index for cleanup of expired notifications
CREATE INDEX IF NOT EXISTS idx_user_notifications_expires
    ON user_notifications(expires_at) WHERE expires_at IS NOT NULL;

-- User notification deliveries table (tracks delivery status per channel)
CREATE TABLE IF NOT EXISTS user_notification_deliveries (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'telegram')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TEXT,
    sent_at TEXT,
    delivered_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (notification_id) REFERENCES user_notifications(id) ON DELETE CASCADE
);

-- Index for delivery status lookup
CREATE INDEX IF NOT EXISTS idx_user_deliveries_notification
    ON user_notification_deliveries(notification_id);

-- Index for retry processing
CREATE INDEX IF NOT EXISTS idx_user_deliveries_retry
    ON user_notification_deliveries(status, next_retry_at)
    WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Channel preferences table (per-user, per-notification-type)
CREATE TABLE IF NOT EXISTS notification_channel_prefs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    channels TEXT NOT NULL DEFAULT '["in_app"]',
    muted_until TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, notification_type)
);

-- Index for user preferences lookup
CREATE INDEX IF NOT EXISTS idx_channel_prefs_user
    ON notification_channel_prefs(user_id);

-- Notification digest table (for batched email digests)
CREATE TABLE IF NOT EXISTS notification_digests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    digest_type TEXT NOT NULL CHECK (digest_type IN ('hourly', 'daily', 'weekly')),
    notification_ids TEXT NOT NULL,
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Index for digest processing
CREATE INDEX IF NOT EXISTS idx_digests_user_type
    ON notification_digests(user_id, digest_type);
