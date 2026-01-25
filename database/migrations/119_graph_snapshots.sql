-- Migration: 119_graph_snapshots
-- Description: Create graph_snapshots table for memory graph versioning
-- Date: 2026-01-25

-- Graph Snapshots table for storing point-in-time memory graph state
CREATE TABLE IF NOT EXISTS graph_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  block_count INTEGER NOT NULL,
  link_count INTEGER NOT NULL,
  -- JSON blob containing: { blocks: [], links: [], memberships: [] }
  snapshot_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast session lookup
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_session ON graph_snapshots(session_id);

-- Index for ordering by creation time
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_created_at ON graph_snapshots(created_at);
