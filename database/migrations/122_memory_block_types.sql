-- Memory Block Types junction table
-- Allows blocks to have multiple block types (many-to-many)

CREATE TABLE IF NOT EXISTS memory_block_types (
  block_id TEXT NOT NULL REFERENCES memory_blocks(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (block_id, block_type)
);

CREATE INDEX IF NOT EXISTS idx_memory_block_types_type ON memory_block_types(block_type);
