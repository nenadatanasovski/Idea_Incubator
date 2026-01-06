-- ============================================================================
-- IDEA RELATIONSHIPS TABLE
-- ============================================================================
-- Stores relationships between ideas for the unified file system.
-- Supports: parent/child, integration, evolution, forking, branching, collaboration

-- Drop old idea_relationships table if it exists (different schema)
DROP TABLE IF EXISTS idea_relationships;

CREATE TABLE idea_relationships (
  id TEXT PRIMARY KEY,                                    -- UUID
  from_user TEXT NOT NULL,                                -- User slug who owns the "from" idea
  from_idea TEXT NOT NULL,                                -- Idea slug of the source idea
  to_user TEXT,                                           -- User slug who owns the "to" idea (NULL for external)
  to_idea TEXT,                                           -- Idea slug of the target idea (NULL for external)
  to_external TEXT,                                       -- External platform/service name (NULL for internal)
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'parent',              -- This idea is a parent of another
    'child',               -- This idea is a child of another
    'integrates_with',     -- This idea integrates with another
    'evolved_from',        -- This idea evolved from another
    'forked_from',         -- This idea was forked from another
    'branched_from',       -- This idea was branched from another
    'collaboration',       -- Collaboration relationship
    'competes_with',       -- AI-detected competition
    'shares_audience_with' -- AI-detected shared audience
  )),
  metadata TEXT,                                          -- JSON metadata for additional context
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT                                         -- User who created this relationship
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_idea_relationships_from_user ON idea_relationships(from_user);
CREATE INDEX IF NOT EXISTS idx_idea_relationships_from_idea ON idea_relationships(from_idea);
CREATE INDEX IF NOT EXISTS idx_idea_relationships_relationship_type ON idea_relationships(relationship_type);
