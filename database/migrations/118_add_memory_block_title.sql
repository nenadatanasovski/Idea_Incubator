-- Add title column to memory_blocks
-- Short 3-5 word summary for display; content field holds full description

-- Add title column (nullable for backwards compatibility)
ALTER TABLE memory_blocks ADD COLUMN title TEXT;

-- Create index for title searches
CREATE INDEX IF NOT EXISTS idx_memory_blocks_title ON memory_blocks(title);
