-- Memory Block Sources Junction Table
-- Maps memory blocks (nodes) to their contributing sources
-- Each block can have multiple sources (chat messages, artifacts, memory files, etc.)

CREATE TABLE IF NOT EXISTS memory_block_sources (
    id TEXT PRIMARY KEY,
    block_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('conversation', 'conversation_insight', 'artifact', 'memory_file', 'user_block', 'external')),

    -- Source metadata for display
    source_title TEXT,
    source_content_snippet TEXT, -- First ~500 chars of source content for preview

    -- AI mapping metadata
    relevance_score REAL, -- 0.0-1.0 how relevant this source is to the block
    mapping_reason TEXT, -- AI's explanation for why this source contributes to this block

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Foreign key to blocks
    FOREIGN KEY (block_id) REFERENCES memory_blocks(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_block_sources_block ON memory_block_sources(block_id);
CREATE INDEX IF NOT EXISTS idx_block_sources_source ON memory_block_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_block_sources_type ON memory_block_sources(source_type);

-- Unique constraint to prevent duplicate mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_block_sources_unique ON memory_block_sources(block_id, source_id);
