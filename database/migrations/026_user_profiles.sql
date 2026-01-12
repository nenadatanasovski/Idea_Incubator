-- Migration 026: Account Profiles (authenticated user settings)
-- Created: 2026-01-11
-- Purpose: User profile settings, preferences, and linked accounts
-- Note: Named "account_*" to avoid conflict with existing "user_profiles" table

CREATE TABLE IF NOT EXISTS account_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    display_name TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    avatar_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    theme TEXT DEFAULT 'system',
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    email_notifications INTEGER DEFAULT 1,
    push_notifications INTEGER DEFAULT 1,
    weekly_digest INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS linked_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_username TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_account_profiles_user ON account_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_account_preferences_user ON account_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_provider ON linked_accounts(provider, provider_user_id);
