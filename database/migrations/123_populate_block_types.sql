-- Populate memory_block_types junction table from existing type column
-- Remap overlapping types: graph dimension names -> canonical block types
-- Remap legacy types: content -> fact, context -> fact, opportunity -> insight

-- 1. Insert canonical types directly (no remapping needed)
INSERT OR IGNORE INTO memory_block_types (block_id, block_type, created_at)
SELECT id, type, created_at FROM memory_blocks
WHERE type IN ('insight', 'fact', 'assumption', 'question', 'decision', 'action', 'requirement', 'option', 'pattern', 'synthesis', 'meta');

-- 2. Remap graph dimension types to 'insight' block type
INSERT OR IGNORE INTO memory_block_types (block_id, block_type, created_at)
SELECT id, 'insight', created_at FROM memory_blocks
WHERE type IN ('risk', 'problem', 'solution', 'market');

-- 3. Ensure graph memberships exist for remapped types
INSERT OR IGNORE INTO memory_graph_memberships (block_id, graph_type, created_at)
SELECT id, type, created_at FROM memory_blocks
WHERE type IN ('risk', 'problem', 'solution', 'market');

-- 4. Remap legacy types
INSERT OR IGNORE INTO memory_block_types (block_id, block_type, created_at)
SELECT id, 'fact', created_at FROM memory_blocks
WHERE type IN ('content', 'context');

-- 5. Remap opportunity -> insight
INSERT OR IGNORE INTO memory_block_types (block_id, block_type, created_at)
SELECT id, 'insight', created_at FROM memory_blocks
WHERE type = 'opportunity';

-- 6. Remaining unmapped types (stakeholder_view, etc.) -> 'fact' as fallback
INSERT OR IGNORE INTO memory_block_types (block_id, block_type, created_at)
SELECT id, 'fact', created_at FROM memory_blocks
WHERE id NOT IN (SELECT block_id FROM memory_block_types);
