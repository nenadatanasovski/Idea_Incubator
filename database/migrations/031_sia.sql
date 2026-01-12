-- SIA (Self-Improvement Agent) Knowledge Base tables
-- Migration: 031_sia.sql

-- Knowledge Base entries (gotchas, patterns, decisions)
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('gotcha', 'pattern', 'decision')),
    content TEXT NOT NULL,
    file_patterns_json TEXT DEFAULT '[]',
    action_types_json TEXT DEFAULT '[]',
    confidence REAL DEFAULT 0.5,
    occurrences INTEGER DEFAULT 0,
    source_execution_id TEXT,
    source_task_id TEXT,
    source_agent_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_entries(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_confidence ON knowledge_entries(confidence);

-- CLAUDE.md update proposals
CREATE TABLE IF NOT EXISTS claude_md_proposals (
    id TEXT PRIMARY KEY,
    knowledge_entry_id TEXT NOT NULL,
    proposed_section TEXT NOT NULL,
    proposed_content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_at TEXT,
    reviewer_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (knowledge_entry_id) REFERENCES knowledge_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON claude_md_proposals(status);

-- Track gotcha applications (when a gotcha prevented an error)
CREATE TABLE IF NOT EXISTS gotcha_applications (
    id TEXT PRIMARY KEY,
    knowledge_entry_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    prevented_error INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (knowledge_entry_id) REFERENCES knowledge_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_applications_entry ON gotcha_applications(knowledge_entry_id);
CREATE INDEX IF NOT EXISTS idx_applications_execution ON gotcha_applications(execution_id);
