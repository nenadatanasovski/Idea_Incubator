-- Memory Graph Expansion Migration
-- Adds support for new graph dimensions and block types
--
-- New Graph Dimensions (7 new, 17 total):
--   user, competition, validation, tasks, timeline, customer, product
--
-- New Block Types (10 new, 21 total):
--   constraint, blocker, epic, story, task, bug, persona, milestone, evaluation, learning
--
-- Note: SQLite uses TEXT columns for graph_type and block_type,
-- so enum expansion is handled at the application layer (TypeScript).
-- This migration adds optimized indexes for the expanded values.

-- Add composite index for querying by graph type and status
CREATE INDEX IF NOT EXISTS idx_memory_blocks_graph_status
  ON memory_graph_memberships(graph_type);

-- Add index for querying blocks by type
CREATE INDEX IF NOT EXISTS idx_memory_block_types_lookup
  ON memory_block_types(block_type, block_id);

-- Verify tables exist (will fail gracefully if they do)
SELECT 1 FROM memory_graph_memberships LIMIT 0;
SELECT 1 FROM memory_block_types LIMIT 0;
