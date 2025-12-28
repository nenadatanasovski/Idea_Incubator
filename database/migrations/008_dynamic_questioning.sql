-- Migration 008: Dynamic Questioning System
-- Adds question bank, answers tracking, and readiness calculation tables

-- Question definitions (loaded from YAML)
CREATE TABLE IF NOT EXISTS question_bank (
    id TEXT PRIMARY KEY,
    criterion TEXT NOT NULL,           -- P1, P2, S1, M1, etc.
    category TEXT NOT NULL CHECK(category IN ('problem', 'solution', 'feasibility', 'fit', 'market', 'risk', 'business_model')),
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK(question_type IN ('factual', 'analytical', 'reflective')),
    priority TEXT NOT NULL CHECK(priority IN ('critical', 'important', 'nice-to-have')),
    idea_types TEXT,                   -- JSON array: null = all types
    lifecycle_stages TEXT,             -- JSON array: null = all stages
    depends_on TEXT,                   -- JSON array of question IDs
    follow_up_ids TEXT,                -- JSON array of follow-up question IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Answers for each idea
CREATE TABLE IF NOT EXISTS idea_answers (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES question_bank(id),
    answer TEXT NOT NULL,
    answer_source TEXT DEFAULT 'user' CHECK(answer_source IN ('user', 'ai_extracted', 'ai_inferred')),
    confidence REAL DEFAULT 1.0 CHECK(confidence >= 0 AND confidence <= 1),
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(idea_id, question_id)
);

-- Criterion coverage tracking (cached for performance)
CREATE TABLE IF NOT EXISTS idea_readiness (
    idea_id TEXT PRIMARY KEY REFERENCES ideas(id) ON DELETE CASCADE,
    overall_readiness REAL NOT NULL DEFAULT 0 CHECK(overall_readiness >= 0 AND overall_readiness <= 1),
    problem_coverage REAL DEFAULT 0 CHECK(problem_coverage >= 0 AND problem_coverage <= 1),
    solution_coverage REAL DEFAULT 0 CHECK(solution_coverage >= 0 AND solution_coverage <= 1),
    feasibility_coverage REAL DEFAULT 0 CHECK(feasibility_coverage >= 0 AND feasibility_coverage <= 1),
    fit_coverage REAL DEFAULT 0 CHECK(fit_coverage >= 0 AND fit_coverage <= 1),
    market_coverage REAL DEFAULT 0 CHECK(market_coverage >= 0 AND market_coverage <= 1),
    risk_coverage REAL DEFAULT 0 CHECK(risk_coverage >= 0 AND risk_coverage <= 1),
    business_model_coverage REAL DEFAULT 0,
    last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Question sessions (development conversations)
CREATE TABLE IF NOT EXISTS development_sessions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    questions_asked INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    readiness_before REAL,
    readiness_after REAL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_question_bank_criterion ON question_bank(criterion);
CREATE INDEX IF NOT EXISTS idx_question_bank_category ON question_bank(category);
CREATE INDEX IF NOT EXISTS idx_question_bank_priority ON question_bank(priority);
CREATE INDEX IF NOT EXISTS idx_answers_idea ON idea_answers(idea_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON idea_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_sessions_idea ON development_sessions(idea_id);

-- Per-criterion coverage view
CREATE VIEW IF NOT EXISTS idea_criterion_coverage AS
SELECT
    ia.idea_id,
    qb.criterion,
    qb.category,
    COUNT(CASE WHEN ia.answer IS NOT NULL AND ia.answer != '' THEN 1 END) as answered,
    COUNT(*) as total_questions,
    CAST(COUNT(CASE WHEN ia.answer IS NOT NULL AND ia.answer != '' THEN 1 END) AS REAL) /
        NULLIF(COUNT(*), 0) as coverage
FROM question_bank qb
LEFT JOIN idea_answers ia ON ia.question_id = qb.id
GROUP BY ia.idea_id, qb.criterion, qb.category;

-- Idea readiness summary view
CREATE VIEW IF NOT EXISTS idea_readiness_summary AS
SELECT
    i.id as idea_id,
    i.slug,
    i.title,
    i.idea_type,
    i.lifecycle_stage,
    COALESCE(ir.overall_readiness, 0) as readiness,
    CASE
        WHEN COALESCE(ir.overall_readiness, 0) < 0.3 THEN 'SPARK'
        WHEN COALESCE(ir.overall_readiness, 0) < 0.6 THEN 'CLARIFY'
        WHEN COALESCE(ir.overall_readiness, 0) < 0.8 THEN 'READY'
        ELSE 'CONFIDENT'
    END as readiness_level,
    (SELECT COUNT(*) FROM idea_answers WHERE idea_id = i.id) as answers_count
FROM ideas i
LEFT JOIN idea_readiness ir ON ir.idea_id = i.id;
