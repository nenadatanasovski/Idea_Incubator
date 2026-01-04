-- ============================================================================
-- IDEATION SUB-AGENTS TABLE
-- Persists sub-agent state so it can be restored when resuming a session
-- ============================================================================

CREATE TABLE IF NOT EXISTS ideation_subagents (
  id TEXT PRIMARY KEY,                                    -- Task ID (e.g., artifact_xxx)
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                                     -- Task type: action-plan, pitch-refine, etc.
  name TEXT NOT NULL,                                     -- Human-readable label
  status TEXT NOT NULL DEFAULT 'pending'                  -- pending, spawning, running, completed, failed
    CHECK (status IN ('pending', 'spawning', 'running', 'completed', 'failed')),
  result TEXT,                                            -- Result content if completed
  error TEXT,                                             -- Error message if failed
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_ideation_subagents_session ON ideation_subagents(session_id);
