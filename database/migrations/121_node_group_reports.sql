-- Migration: 121_node_group_reports.sql
-- Description: Create node_group_reports table for AI-synthesized reports on connected node groups

CREATE TABLE IF NOT EXISTS node_group_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,

  -- Group identification
  node_ids TEXT NOT NULL,           -- JSON array of node IDs in this group
  group_hash TEXT NOT NULL,         -- SHA256 of sorted node_ids for quick lookup
  group_name TEXT,                  -- AI-generated name for the group

  -- Report sections (AI-generated)
  overview TEXT,                    -- 1-2 paragraph summary
  key_themes TEXT,                  -- JSON array of theme bullets
  story TEXT,                       -- Multi-paragraph narrative with node references
  relationships_to_groups TEXT,     -- JSON: [{groupHash, groupName, relationship}]
  open_questions TEXT,              -- JSON array of gaps/tensions detected
  nodes_summary TEXT,               -- JSON: [{nodeId, title, oneLiner}]

  -- Metadata
  status TEXT NOT NULL DEFAULT 'current',  -- 'current' | 'stale'
  node_count INTEGER NOT NULL,
  edge_count INTEGER NOT NULL,
  generated_at TEXT DEFAULT (datetime('now')),
  generation_duration_ms INTEGER,
  model_used TEXT,

  -- Constraints
  FOREIGN KEY (session_id) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  CHECK (status IN ('current', 'stale'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_node_group_reports_session ON node_group_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_node_group_reports_status ON node_group_reports(status);
CREATE INDEX IF NOT EXISTS idx_node_group_reports_hash ON node_group_reports(group_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_node_group_reports_unique ON node_group_reports(session_id, group_hash);
