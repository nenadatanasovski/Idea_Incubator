-- Coordination System Database Schema
-- Version: 1.0
-- Created: 2026-01-07
--
-- This schema defines all tables for the multi-agent coordination system.
-- Single source of truth - replaces test-state.json files.

-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

--------------------------------------------------------------------------------
-- LOOP REGISTRATION
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loops (
    id TEXT PRIMARY KEY,                    -- e.g., 'loop-1-critical-path'
    name TEXT NOT NULL,                     -- Human-readable name
    priority INTEGER NOT NULL DEFAULT 5,    -- 1 = highest priority
    branch TEXT,                            -- Git branch name
    status TEXT NOT NULL DEFAULT 'stopped', -- running, stopped, paused, error
    current_test_id TEXT,                   -- Currently working on
    pid INTEGER,                            -- Process ID when running
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

--------------------------------------------------------------------------------
-- TEST STATE (replaces test-state.json)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tests (
    id TEXT PRIMARY KEY,                    -- e.g., 'CP-UFS-001'
    loop_id TEXT NOT NULL,                  -- Which loop owns this test
    category TEXT NOT NULL,                 -- e.g., 'ufs', 'specification', 'build'
    status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, passed, failed, blocked, skipped
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_result TEXT,                       -- pass, fail, blocked
    depends_on TEXT,                        -- Test ID this depends on
    automatable INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    spec_content TEXT,                      -- The actual specification
    last_attempt_at TEXT,
    passed_at TEXT,
    verified_at TEXT,                       -- When verification gate confirmed
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (loop_id) REFERENCES loops(id)
);

CREATE INDEX IF NOT EXISTS idx_tests_loop ON tests(loop_id);
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);
CREATE INDEX IF NOT EXISTS idx_tests_depends ON tests(depends_on);

--------------------------------------------------------------------------------
-- EVENT BUS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,                    -- UUID
    timestamp TEXT NOT NULL,                -- ISO8601
    source TEXT NOT NULL,                   -- loop-1, monitor, pm, human, etc.
    event_type TEXT NOT NULL,               -- test_started, file_locked, etc.
    payload TEXT NOT NULL,                  -- JSON
    correlation_id TEXT,                    -- For related events
    priority INTEGER NOT NULL DEFAULT 5,    -- 1 = highest
    acknowledged INTEGER NOT NULL DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_unack ON events(acknowledged) WHERE acknowledged = 0;
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);

--------------------------------------------------------------------------------
-- SUBSCRIPTIONS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    subscriber TEXT NOT NULL,               -- Who is subscribing
    event_types TEXT NOT NULL,              -- JSON array of types
    filter_sources TEXT,                    -- JSON array (null = all)
    last_poll_at TEXT,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active) WHERE active = 1;

--------------------------------------------------------------------------------
-- FILE LOCKS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS file_locks (
    file_path TEXT PRIMARY KEY,
    locked_by TEXT NOT NULL,                -- Loop ID
    locked_at TEXT NOT NULL,
    lock_reason TEXT,
    expires_at TEXT,                        -- TTL-based expiry
    test_id TEXT                            -- Which test acquired the lock
);

CREATE INDEX IF NOT EXISTS idx_locks_owner ON file_locks(locked_by);
CREATE INDEX IF NOT EXISTS idx_locks_expires ON file_locks(expires_at);

--------------------------------------------------------------------------------
-- WAIT GRAPH (for deadlock detection)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wait_graph (
    waiter TEXT NOT NULL,                   -- Loop waiting
    holder TEXT NOT NULL,                   -- Loop holding resource
    resource TEXT NOT NULL,                 -- File path or resource ID
    waiting_since TEXT NOT NULL,
    PRIMARY KEY (waiter, holder, resource)
);

--------------------------------------------------------------------------------
-- KNOWLEDGE BASE
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS knowledge (
    id TEXT PRIMARY KEY,
    loop_id TEXT NOT NULL,                  -- Who recorded this
    item_type TEXT NOT NULL,                -- fact, decision, pattern, warning
    topic TEXT,                             -- For querying
    content TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    evidence TEXT,                          -- Supporting evidence
    affected_areas TEXT,                    -- JSON array of file patterns
    superseded_by TEXT,                     -- ID of newer knowledge
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (loop_id) REFERENCES loops(id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(item_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON knowledge(topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_loop ON knowledge(loop_id);

--------------------------------------------------------------------------------
-- RESOURCE REGISTRY (ownership tracking)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS resources (
    path TEXT PRIMARY KEY,                  -- File path or resource identifier
    owner_loop TEXT NOT NULL,               -- Which loop owns this
    resource_type TEXT NOT NULL,            -- file, type, interface, endpoint, migration
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (owner_loop) REFERENCES loops(id)
);

CREATE INDEX IF NOT EXISTS idx_resources_owner ON resources(owner_loop);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);

--------------------------------------------------------------------------------
-- CHANGE REQUESTS (for non-owner modifications)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS change_requests (
    id TEXT PRIMARY KEY,
    resource_path TEXT NOT NULL,
    requestor_loop TEXT NOT NULL,
    owner_loop TEXT NOT NULL,
    request_type TEXT NOT NULL,             -- modify, extend, delete
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, applied
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by TEXT,                       -- human or pm
    FOREIGN KEY (resource_path) REFERENCES resources(path),
    FOREIGN KEY (requestor_loop) REFERENCES loops(id),
    FOREIGN KEY (owner_loop) REFERENCES loops(id)
);

CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);

--------------------------------------------------------------------------------
-- MIGRATIONS (ordering)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS migrations (
    number INTEGER PRIMARY KEY,             -- Migration number
    name TEXT NOT NULL,                     -- e.g., 'add_user_email'
    loop_id TEXT NOT NULL,                  -- Who created it
    file_path TEXT NOT NULL,                -- Path to migration file
    status TEXT NOT NULL DEFAULT 'pending', -- pending, applied, failed
    allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
    applied_at TEXT,
    FOREIGN KEY (loop_id) REFERENCES loops(id)
);

--------------------------------------------------------------------------------
-- CHECKPOINTS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    loop_id TEXT NOT NULL,
    test_id TEXT NOT NULL,
    git_ref TEXT NOT NULL,                  -- Branch or commit hash
    checkpoint_type TEXT NOT NULL,          -- branch, stash, tag
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (loop_id) REFERENCES loops(id),
    FOREIGN KEY (test_id) REFERENCES tests(id)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_loop ON checkpoints(loop_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_test ON checkpoints(test_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_active ON checkpoints(deleted_at) WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- PASSING TESTS (for regression detection)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS passing_tests (
    test_id TEXT NOT NULL,
    commit_hash TEXT NOT NULL,
    passed_at TEXT NOT NULL,
    PRIMARY KEY (test_id, commit_hash),
    FOREIGN KEY (test_id) REFERENCES tests(id)
);

CREATE INDEX IF NOT EXISTS idx_passing_commit ON passing_tests(commit_hash);

--------------------------------------------------------------------------------
-- DECISIONS (human decisions)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    decision_type TEXT NOT NULL,            -- conflict, stuck, architecture, etc.
    summary TEXT NOT NULL,
    options TEXT NOT NULL,                  -- JSON array of options
    default_option TEXT,
    context TEXT,                           -- JSON with additional context
    timeout_minutes INTEGER DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, decided, auto_resolved, expired
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    requested_by TEXT NOT NULL,             -- Which agent requested
    decided_at TEXT,
    decided_by TEXT,                        -- human or auto
    choice TEXT,
    comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_pending ON decisions(status) WHERE status = 'pending';

--------------------------------------------------------------------------------
-- USAGE TRACKING
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usage (
    id TEXT PRIMARY KEY,
    loop_id TEXT NOT NULL,
    test_id TEXT,
    tokens_estimated INTEGER,
    duration_seconds INTEGER,
    files_modified TEXT,                    -- JSON array
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (loop_id) REFERENCES loops(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_loop ON usage(loop_id);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage(recorded_at);

--------------------------------------------------------------------------------
-- COMPONENT HEALTH (for degradation detection)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS component_health (
    component TEXT PRIMARY KEY,             -- monitor, pm, human, loop-1, etc.
    last_heartbeat TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown', -- healthy, degraded, dead, unknown
    metadata TEXT                           -- JSON with component-specific info
);

--------------------------------------------------------------------------------
-- ALERTS
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL,                 -- info, warning, error, critical
    alert_type TEXT NOT NULL,               -- stuck, conflict, digression, resource, regression
    source TEXT NOT NULL,                   -- Which component raised it
    message TEXT NOT NULL,
    context TEXT,                           -- JSON
    acknowledged INTEGER NOT NULL DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_unack ON alerts(acknowledged) WHERE acknowledged = 0;

--------------------------------------------------------------------------------
-- TRANSACTION LOG (for atomic operations)
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transaction_log (
    id TEXT PRIMARY KEY,
    operation TEXT NOT NULL,                -- test_pass, file_write, etc.
    loop_id TEXT NOT NULL,
    steps TEXT NOT NULL,                    -- JSON array of steps
    status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, committed, rolled_back
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (loop_id) REFERENCES loops(id)
);

CREATE INDEX IF NOT EXISTS idx_tx_status ON transaction_log(status);
CREATE INDEX IF NOT EXISTS idx_tx_incomplete ON transaction_log(status) WHERE status = 'in_progress';
