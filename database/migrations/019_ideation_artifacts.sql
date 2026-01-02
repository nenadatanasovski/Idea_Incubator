-- ============================================================================
-- IDEATION ARTIFACTS TABLE
-- ============================================================================
-- Stores artifacts (research results, mermaid diagrams, etc.) for sessions
-- so they can be restored when resuming a session.

CREATE TABLE IF NOT EXISTS ideation_artifacts (
  id TEXT PRIMARY KEY,                                    -- UUID or artifact_timestamp
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'research',       -- Web search results with synthesis
    'mermaid',        -- Mermaid diagrams
    'markdown',       -- Markdown content
    'code',           -- Code snippets
    'analysis',       -- Structured analysis
    'comparison',     -- Side-by-side comparisons
    'idea-summary'    -- Idea summaries
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,                                  -- JSON string for structured content, plain text otherwise
  language TEXT,                                          -- For code artifacts
  queries TEXT,                                           -- JSON array of search queries (for research type)
  identifier TEXT,                                        -- Auto-generated reference name
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('pending', 'loading', 'ready', 'error')),
  error TEXT,                                             -- Error message if status is error
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Index for fast session lookup
CREATE INDEX IF NOT EXISTS idx_ideation_artifacts_session ON ideation_artifacts(session_id);
