-- Idea Incubator Database Schema
-- This is the reference schema. Actual migrations are in migrations/

-- Core ideas table
CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    idea_type TEXT CHECK(idea_type IN ('business', 'creative', 'technical', 'personal', 'research')),
    lifecycle_stage TEXT DEFAULT 'SPARK',
    content_hash TEXT,                    -- MD5 of README.md for staleness detection
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    folder_path TEXT NOT NULL
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT
);

CREATE TABLE IF NOT EXISTS idea_tags (
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (idea_id, tag_id)
);

-- Relationships between ideas
CREATE TABLE IF NOT EXISTS idea_relationships (
    source_idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    target_idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    relationship_type TEXT CHECK(relationship_type IN
        ('parent', 'child', 'related', 'combines', 'conflicts', 'inspired_by')),
    strength TEXT CHECK(strength IN ('strong', 'medium', 'weak')),
    notes TEXT,
    PRIMARY KEY (source_idea_id, target_idea_id, relationship_type)
);

-- Individual criterion evaluations
CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    evaluation_run_id TEXT NOT NULL,
    criterion TEXT NOT NULL,
    category TEXT NOT NULL,
    agent_score INTEGER CHECK(agent_score >= 1 AND agent_score <= 10),
    user_score INTEGER CHECK(user_score >= 1 AND user_score <= 10),
    final_score INTEGER CHECK(final_score >= 1 AND final_score <= 10),
    confidence REAL CHECK(confidence >= 0 AND confidence <= 1),
    reasoning TEXT,
    evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Debate transcripts
CREATE TABLE IF NOT EXISTS debate_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    evaluation_run_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    criterion TEXT NOT NULL,
    challenge_number INTEGER NOT NULL,
    evaluator_claim TEXT,
    redteam_persona TEXT,
    redteam_challenge TEXT,
    evaluator_defense TEXT,
    arbiter_verdict TEXT CHECK(arbiter_verdict IN ('EVALUATOR', 'RED_TEAM', 'DRAW')),
    first_principles_bonus BOOLEAN DEFAULT FALSE,
    score_adjustment INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Red team log (persistent history)
CREATE TABLE IF NOT EXISTS redteam_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    evaluation_run_id TEXT,
    persona TEXT NOT NULL,
    challenge TEXT NOT NULL,
    response TEXT,
    severity TEXT CHECK(severity IN ('CRITICAL', 'MAJOR', 'MINOR', 'ADDRESSED')),
    verdict TEXT CHECK(verdict IN ('EVALUATOR', 'RED_TEAM', 'DRAW')),
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Development log (Q&A history)
CREATE TABLE IF NOT EXISTS development_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL,
    question TEXT,
    answer TEXT,
    source TEXT CHECK(source IN ('user', 'ai', 'research')),
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Final synthesis documents (immutable after creation)
CREATE TABLE IF NOT EXISTS final_syntheses (
    id TEXT PRIMARY KEY,
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    evaluation_run_id TEXT NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_rounds INTEGER NOT NULL,
    overall_score REAL NOT NULL,
    overall_confidence REAL NOT NULL,
    redteam_survival_rate REAL NOT NULL,
    recommendation TEXT CHECK(recommendation IN ('PURSUE', 'REFINE', 'PAUSE', 'ABANDON')),
    recommendation_reasoning TEXT,
    executive_summary TEXT,
    key_strengths TEXT,           -- JSON array
    key_weaknesses TEXT,          -- JSON array
    critical_assumptions TEXT,    -- JSON array
    unresolved_questions TEXT,    -- JSON array
    full_document TEXT,           -- JSON blob of complete document
    lock_reason TEXT CHECK(lock_reason IN ('CONVERGENCE', 'MAX_ROUNDS', 'USER_APPROVED', 'TIMEOUT', 'BUDGET_EXCEEDED')),
    locked BOOLEAN DEFAULT TRUE
);

-- Cost tracking
CREATE TABLE IF NOT EXISTS cost_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_run_id TEXT NOT NULL,
    idea_id TEXT REFERENCES ideas(id),
    operation TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    estimated_cost REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Evaluation events for WebSocket replay
CREATE TABLE IF NOT EXISTS evaluation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    idea_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL,      -- JSON payload
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

-- Score history for trend analysis
CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    criterion TEXT NOT NULL,
    score_before REAL,
    score_after REAL NOT NULL,
    adjustment REAL DEFAULT 0,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ideas_lifecycle ON ideas(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_ideas_type ON ideas(idea_type);
CREATE INDEX IF NOT EXISTS idx_evaluations_idea ON evaluations(idea_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_run ON evaluations(evaluation_run_id);
CREATE INDEX IF NOT EXISTS idx_debate_idea ON debate_rounds(idea_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_idea ON final_syntheses(idea_id);
CREATE INDEX IF NOT EXISTS idx_cost_run ON cost_log(evaluation_run_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON evaluation_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON evaluation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_idea ON evaluation_events(idea_id);
CREATE INDEX IF NOT EXISTS idx_score_history_idea ON score_history(idea_id);
CREATE INDEX IF NOT EXISTS idx_score_history_criterion ON score_history(criterion);

-- User profiles for Personal Fit evaluation context
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,

    -- FT1: Personal Goals
    primary_goals TEXT NOT NULL,               -- JSON array
    success_definition TEXT,

    -- FT2: Passion & Motivation
    interests TEXT,                            -- JSON array
    motivations TEXT,
    domain_connection TEXT,

    -- FT3: Skills & Experience
    technical_skills TEXT,                     -- JSON array
    professional_experience TEXT,
    domain_expertise TEXT,                     -- JSON array
    known_gaps TEXT,

    -- FT4: Network & Connections
    industry_connections TEXT,                 -- JSON array
    professional_network TEXT,
    community_access TEXT,                     -- JSON array
    partnership_potential TEXT,

    -- FT5: Life Stage & Capacity
    employment_status TEXT CHECK(employment_status IN ('employed', 'self-employed', 'unemployed', 'student', 'retired')),
    weekly_hours_available INTEGER,
    financial_runway_months INTEGER,
    risk_tolerance TEXT CHECK(risk_tolerance IN ('low', 'medium', 'high', 'very_high')),
    other_commitments TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idea_profiles (
    idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
    profile_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
    goals_override TEXT,
    passion_notes TEXT,
    relevant_skills TEXT,
    relevant_network TEXT,
    time_commitment TEXT,
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (idea_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_slug ON user_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_idea_profiles_idea ON idea_profiles(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_profiles_profile ON idea_profiles(profile_id);

-- Composite score view
CREATE VIEW IF NOT EXISTS idea_scores AS
SELECT
    i.id,
    i.slug,
    i.title,
    i.lifecycle_stage,
    AVG(e.final_score) as avg_score,
    AVG(e.confidence) as avg_confidence,
    COUNT(DISTINCT e.evaluation_run_id) as evaluation_count,
    MAX(e.evaluated_at) as last_evaluated
FROM ideas i
LEFT JOIN evaluations e ON i.id = e.idea_id
GROUP BY i.id;

-- Category score view
CREATE VIEW IF NOT EXISTS idea_category_scores AS
SELECT
    e.idea_id,
    e.evaluation_run_id,
    e.category,
    AVG(e.final_score) as category_score,
    AVG(e.confidence) as category_confidence
FROM evaluations e
GROUP BY e.idea_id, e.evaluation_run_id, e.category;
