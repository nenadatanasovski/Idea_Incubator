-- 131_build_interventions.sql
-- Track human (SIA) interventions during build process

CREATE TABLE IF NOT EXISTS build_interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    resolution TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_build_interventions_session_id ON build_interventions(session_id);
CREATE INDEX IF NOT EXISTS idx_build_interventions_task_id ON build_interventions(task_id);
