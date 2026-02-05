-- 129_pipeline_state.sql
-- Pipeline Orchestrator: Idea lifecycle state management

-- Pipeline state for each idea
CREATE TABLE IF NOT EXISTS idea_pipeline_state (
    idea_id TEXT PRIMARY KEY REFERENCES ideas(id) ON DELETE CASCADE,
    
    -- Phase state
    current_phase TEXT NOT NULL DEFAULT 'ideation' CHECK(current_phase IN (
        'ideation', 'ideation_ready', 'specification', 'spec_ready',
        'building', 'build_review', 'deployed', 'paused', 'failed'
    )),
    previous_phase TEXT CHECK(previous_phase IN (
        'ideation', 'ideation_ready', 'specification', 'spec_ready',
        'building', 'build_review', 'deployed', 'paused', 'failed'
    )),
    last_transition DATETIME,
    transition_reason TEXT,
    
    -- User preferences
    auto_advance BOOLEAN DEFAULT 1,
    human_review_required BOOLEAN DEFAULT 0,
    
    -- Ideation progress
    ideation_completion_score REAL DEFAULT 0,
    ideation_blocker_count INTEGER DEFAULT 0,
    ideation_confidence_score REAL DEFAULT 0,
    ideation_milestones TEXT,  -- JSON: { problemDefined, solutionClear, targetUserKnown, etc }
    
    -- Spec progress (nullable until spec phase)
    spec_session_id TEXT,
    spec_sections_complete INTEGER,
    spec_sections_total INTEGER,
    spec_pending_questions TEXT,  -- JSON array
    spec_generated_tasks INTEGER,
    
    -- Build progress (nullable until build phase)
    build_session_id TEXT,
    build_tasks_complete INTEGER,
    build_tasks_total INTEGER,
    build_current_task TEXT,
    build_failed_tasks INTEGER DEFAULT 0,
    build_sia_interventions INTEGER DEFAULT 0,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pipeline transition history
CREATE TABLE IF NOT EXISTS pipeline_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    from_phase TEXT NOT NULL,
    to_phase TEXT NOT NULL,
    reason TEXT,
    triggered_by TEXT,  -- 'auto' | 'user' | 'system'
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Spec sessions table
CREATE TABLE IF NOT EXISTS spec_sessions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN (
        'active', 'pending_input', 'complete', 'failed'
    )),
    
    -- Specification data
    current_draft TEXT,  -- JSON: full specification object
    draft_version INTEGER DEFAULT 0,
    
    -- Questions
    pending_questions TEXT,   -- JSON array
    answered_questions TEXT,  -- JSON array
    
    -- Generated output
    tasks TEXT,  -- JSON array of TaskDefinition
    
    -- Handoff data from ideation
    handoff_data TEXT,  -- JSON: IdeationToSpecHandoff
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Build sessions table (if not exists from earlier migrations)
CREATE TABLE IF NOT EXISTS build_sessions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    spec_session_id TEXT REFERENCES spec_sessions(id),
    
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN (
        'active', 'paused', 'complete', 'failed', 'human_needed'
    )),
    
    -- Tasks
    tasks TEXT NOT NULL,  -- JSON array
    current_task_index INTEGER DEFAULT 0,
    completed_tasks TEXT,  -- JSON array of task IDs
    failed_tasks TEXT,     -- JSON array of task IDs
    
    -- Execution state
    current_attempt INTEGER DEFAULT 0,
    last_error TEXT,
    sia_interventions INTEGER DEFAULT 0,
    
    -- Output
    generated_files TEXT,  -- JSON array
    git_commits TEXT,      -- JSON array
    
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SIA intervention attempts
CREATE TABLE IF NOT EXISTS sia_interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_session_id TEXT REFERENCES build_sessions(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    technique TEXT NOT NULL,
    result_type TEXT NOT NULL CHECK(result_type IN ('fixed', 'decomposed', 'escalate')),
    details TEXT,  -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_state_phase ON idea_pipeline_state(current_phase);
CREATE INDEX IF NOT EXISTS idx_pipeline_transitions_idea ON pipeline_transitions(idea_id);
CREATE INDEX IF NOT EXISTS idx_spec_sessions_idea ON spec_sessions(idea_id);
CREATE INDEX IF NOT EXISTS idx_build_sessions_idea ON build_sessions(idea_id);
CREATE INDEX IF NOT EXISTS idx_build_sessions_status ON build_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sia_interventions_build ON sia_interventions(build_session_id);

-- Trigger to initialize pipeline state when idea is created
CREATE TRIGGER IF NOT EXISTS init_pipeline_state_on_idea_insert
AFTER INSERT ON ideas
BEGIN
    INSERT OR IGNORE INTO idea_pipeline_state (idea_id) VALUES (NEW.id);
END;

-- View for idea status overview
CREATE VIEW IF NOT EXISTS idea_pipeline_overview AS
SELECT
    i.id,
    i.slug,
    i.title,
    p.current_phase,
    p.auto_advance,
    p.ideation_completion_score,
    p.spec_sections_complete,
    p.spec_sections_total,
    p.build_tasks_complete,
    p.build_tasks_total,
    p.build_sia_interventions,
    p.updated_at as last_activity
FROM ideas i
LEFT JOIN idea_pipeline_state p ON i.id = p.idea_id;
