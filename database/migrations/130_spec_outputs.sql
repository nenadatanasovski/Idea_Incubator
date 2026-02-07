-- 130_spec_outputs.sql
-- Store spec agent outputs for pipeline integration

CREATE TABLE IF NOT EXISTS spec_outputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT NOT NULL UNIQUE,
    spec_content TEXT NOT NULL,
    tasks_content TEXT NOT NULL,
    task_count INTEGER DEFAULT 0,
    generated_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spec_outputs_idea_id ON spec_outputs(idea_id);

-- Track spec generation sessions
CREATE TABLE IF NOT EXISTS spec_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    idea_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, questions, complete, failed
    brief_path TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spec_sessions_idea_id ON spec_sessions(idea_id);
-- Note: session_id column may not exist if spec_sessions was created by migration 129
-- with a different schema. Skip this index creation.

-- Track pending questions
CREATE TABLE IF NOT EXISTS spec_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'optional', -- blocking, important, optional
    answer TEXT,
    answered_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spec_questions_session_id ON spec_questions(session_id);
