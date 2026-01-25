-- Memory Graph Source Attribution
-- Adds source tracking columns to memory_graph_changes for multi-source analysis

-- Add source_id column (which message, artifact, or block the change originated from)
ALTER TABLE memory_graph_changes ADD COLUMN source_id TEXT;

-- Add source_type column (conversation, artifact, memory_file, user_block, external)
ALTER TABLE memory_graph_changes ADD COLUMN source_type TEXT CHECK (source_type IN ('conversation', 'artifact', 'memory_file', 'user_block', 'external', NULL));

-- Add source_weight column (reliability weight 0.0-1.0)
ALTER TABLE memory_graph_changes ADD COLUMN source_weight REAL;

-- Add corroborations column (JSON array of corroborating sources)
ALTER TABLE memory_graph_changes ADD COLUMN corroborations TEXT;

-- Index for source tracking queries
CREATE INDEX IF NOT EXISTS idx_graph_changes_source_type ON memory_graph_changes(source_type);
CREATE INDEX IF NOT EXISTS idx_graph_changes_source_id ON memory_graph_changes(source_id);
