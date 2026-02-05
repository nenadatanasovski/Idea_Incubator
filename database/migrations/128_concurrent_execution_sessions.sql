-- Migration 128: Add concurrent_execution_sessions table
-- Purpose: The execution-manager.ts expects this table for managing concurrent execution sessions
-- that was never created

CREATE TABLE IF NOT EXISTS concurrent_execution_sessions (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'failed')),
    execution_count INTEGER DEFAULT 0,
    total_wave_count INTEGER DEFAULT 0,
    total_task_count INTEGER DEFAULT 0,
    peak_concurrent_agents INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exec_sessions_status ON concurrent_execution_sessions(status);
CREATE INDEX IF NOT EXISTS idx_exec_sessions_started ON concurrent_execution_sessions(started_at);
