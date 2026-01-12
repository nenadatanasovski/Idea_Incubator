-- Migration 025: API Call Counter
-- Created: 2026-01-11
-- Purpose: Track API calls for usage monitoring

CREATE TABLE IF NOT EXISTS api_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_calls_endpoint ON api_calls(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_calls_user ON api_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_created ON api_calls(created_at);
