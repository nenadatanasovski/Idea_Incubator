-- ============================================================================
-- IDEATION SESSION TABLES
-- ============================================================================

-- Core session tracking
CREATE TABLE IF NOT EXISTS ideation_sessions (
  id TEXT PRIMARY KEY,                                    -- UUID
  profile_id TEXT REFERENCES user_profiles(id),           -- Link to user profile
  entry_mode TEXT NOT NULL DEFAULT 'discover'             -- have_idea|discover (how user started)
    CHECK (entry_mode IN ('have_idea', 'discover')),
  status TEXT NOT NULL DEFAULT 'active'                   -- active|completed|abandoned
    CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  handoff_count INTEGER NOT NULL DEFAULT 0,               -- Number of agent handoffs
  token_count INTEGER NOT NULL DEFAULT 0,                 -- Current token usage
  message_count INTEGER NOT NULL DEFAULT 0,               -- Total messages exchanged
  current_phase TEXT NOT NULL DEFAULT 'exploring'         -- exploring|narrowing|validating|refining
    CHECK (current_phase IN ('exploring', 'narrowing', 'validating', 'refining'))
);

-- Conversation messages
CREATE TABLE IF NOT EXISTS ideation_messages (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  buttons_shown TEXT,                                     -- JSON array of buttons shown
  button_clicked TEXT,                                    -- Button ID if clicked
  form_shown TEXT,                                        -- JSON of form if shown
  form_response TEXT,                                     -- JSON of form response
  web_search_results TEXT,                                -- JSON array of search results cited
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Memory file storage
CREATE TABLE IF NOT EXISTS ideation_memory_files (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN (
    'self_discovery',
    'market_discovery',
    'narrowing_state',
    'conversation_summary',
    'idea_candidate',
    'viability_assessment',
    'handoff_notes'
  )),
  content TEXT NOT NULL,                                  -- Markdown content
  version INTEGER NOT NULL DEFAULT 1,                     -- For tracking changes
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, file_type)                          -- One of each type per session
);

-- Idea candidates (during and after session)
CREATE TABLE IF NOT EXISTS ideation_candidates (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,                                           -- 1-2 sentence summary
  confidence INTEGER NOT NULL DEFAULT 0                   -- 0-100
    CHECK (confidence >= 0 AND confidence <= 100),
  viability INTEGER NOT NULL DEFAULT 100                  -- 0-100
    CHECK (viability >= 0 AND viability <= 100),
  user_suggested BOOLEAN NOT NULL DEFAULT FALSE,          -- Did user suggest this?
  status TEXT NOT NULL DEFAULT 'forming'                  -- forming|active|captured|discarded|saved
    CHECK (status IN ('forming', 'active', 'captured', 'discarded', 'saved')),
  captured_idea_id TEXT REFERENCES ideas(id),             -- Link if captured
  version INTEGER NOT NULL DEFAULT 1,                     -- For tracking refinements
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Viability risk tracking
CREATE TABLE IF NOT EXISTS ideation_viability_risks (
  id TEXT PRIMARY KEY,                                    -- UUID
  candidate_id TEXT NOT NULL REFERENCES ideation_candidates(id) ON DELETE CASCADE,
  risk_type TEXT NOT NULL CHECK (risk_type IN (
    'impossible',        -- Technology doesn't exist
    'unrealistic',       -- Beyond user's capacity
    'too_complex',       -- Too many hard problems
    'too_vague',         -- Can't be validated
    'saturated_market',  -- Too many competitors
    'wrong_timing',      -- Too early or too late
    'resource_mismatch'  -- User lacks required resources
  )),
  description TEXT NOT NULL,                              -- Human-readable description
  evidence_url TEXT,                                      -- Source URL if from web search
  evidence_text TEXT,                                     -- Key quote or finding
  severity TEXT NOT NULL DEFAULT 'medium'                 -- critical|high|medium|low
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  user_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,       -- Has user seen this?
  user_response TEXT,                                     -- What user chose to do
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Web search cache
CREATE TABLE IF NOT EXISTS ideation_searches (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results TEXT NOT NULL,                                  -- JSON array of results
  result_count INTEGER NOT NULL DEFAULT 0,
  purpose TEXT,                                           -- Why search was performed
  searched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Signal extraction log (for debugging and improvement)
CREATE TABLE IF NOT EXISTS ideation_signals (
  id TEXT PRIMARY KEY,                                    -- UUID
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES ideation_messages(id),
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'self_discovery',
    'market_discovery',
    'narrowing',
    'confidence',
    'viability'
  )),
  signal_key TEXT NOT NULL,                               -- e.g., 'frustration', 'expertise'
  signal_value TEXT NOT NULL,                             -- The extracted value
  confidence REAL NOT NULL DEFAULT 0.5                    -- 0.0-1.0 extraction confidence
    CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ideation_sessions_profile ON ideation_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_ideation_sessions_status ON ideation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ideation_messages_session ON ideation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_memory_session ON ideation_memory_files(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_candidates_session ON ideation_candidates(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_risks_candidate ON ideation_viability_risks(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ideation_searches_session ON ideation_searches(session_id);
CREATE INDEX IF NOT EXISTS idx_ideation_signals_session ON ideation_signals(session_id);
