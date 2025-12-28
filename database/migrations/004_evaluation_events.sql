-- Migration: Add evaluation_events table for WebSocket event persistence
-- Enables replay of evaluation sessions and historical analysis

-- Store WebSocket events for replay
CREATE TABLE IF NOT EXISTS evaluation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    idea_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL,      -- JSON payload
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

-- Store score history for trend analysis
CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    criterion TEXT NOT NULL,
    score_before REAL,
    score_after REAL NOT NULL,
    adjustment REAL DEFAULT 0,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_session ON evaluation_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON evaluation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_idea ON evaluation_events(idea_id);
CREATE INDEX IF NOT EXISTS idx_score_history_idea ON score_history(idea_id);
CREATE INDEX IF NOT EXISTS idx_score_history_criterion ON score_history(criterion);
