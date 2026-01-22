-- Memory Graph Changes Table
-- Logs all changes to the Memory Graph for observability and auditing

CREATE TABLE IF NOT EXISTS memory_graph_changes (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('created', 'modified', 'superseded', 'linked', 'unlinked', 'deleted')),
    block_id TEXT NOT NULL,
    block_type TEXT NOT NULL,
    block_label TEXT,
    property_changed TEXT,
    old_value TEXT,
    new_value TEXT,
    triggered_by TEXT NOT NULL CHECK (triggered_by IN ('user', 'ai_auto', 'ai_confirmed', 'cascade', 'system')),
    context_source TEXT NOT NULL,
    session_id TEXT NOT NULL,
    cascade_depth INTEGER DEFAULT 0,
    affected_blocks TEXT,  -- JSON array of block IDs
    FOREIGN KEY (session_id) REFERENCES ideation_sessions(id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_graph_changes_session ON memory_graph_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_graph_changes_timestamp ON memory_graph_changes(timestamp);
CREATE INDEX IF NOT EXISTS idx_graph_changes_block ON memory_graph_changes(block_id);
CREATE INDEX IF NOT EXISTS idx_graph_changes_type ON memory_graph_changes(change_type);
CREATE INDEX IF NOT EXISTS idx_graph_changes_trigger ON memory_graph_changes(triggered_by);
