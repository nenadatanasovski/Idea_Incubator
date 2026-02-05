-- 132_sia_intervention_tables.sql
-- SIA (Self-Improvement Agent) intervention tracking tables

-- ============================================================================
-- SIA ATTEMPTS TABLE
-- Records each intervention attempt by SIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS sia_attempts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    build_id TEXT,
    technique TEXT NOT NULL,        -- decomposition, prompt_restructure, fresh_start, etc.
    result_type TEXT NOT NULL,      -- 'fixed', 'decomposed', 'escalate'
    details TEXT,                   -- JSON: additional details about the attempt
    analysis TEXT,                  -- JSON: failure analysis results
    original_error TEXT,            -- The error that triggered SIA
    attempts_before INTEGER DEFAULT 0,  -- How many failures before SIA intervened
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sia_attempts_task_id ON sia_attempts(task_id);
CREATE INDEX IF NOT EXISTS idx_sia_attempts_technique ON sia_attempts(technique);
CREATE INDEX IF NOT EXISTS idx_sia_attempts_result_type ON sia_attempts(result_type);
CREATE INDEX IF NOT EXISTS idx_sia_attempts_build_id ON sia_attempts(build_id);

-- ============================================================================
-- SIA TASK MEMORY TABLE
-- Tracks per-task intervention history to avoid repeating failed techniques
-- ============================================================================

CREATE TABLE IF NOT EXISTS sia_task_memory (
    task_id TEXT PRIMARY KEY,
    task_signature TEXT,            -- Hash of task definition for similar task matching
    attempts TEXT NOT NULL,         -- JSON array of {technique, result, timestamp}
    techniques_tried TEXT,          -- JSON array of technique names tried
    successful_technique TEXT,      -- Which technique (if any) worked
    total_interventions INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sia_task_memory_signature ON sia_task_memory(task_signature);
CREATE INDEX IF NOT EXISTS idx_sia_task_memory_successful ON sia_task_memory(successful_technique);

-- ============================================================================
-- SIA METRICS VIEW
-- Aggregated view of SIA effectiveness
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_sia_metrics AS
SELECT 
    technique,
    COUNT(*) as total_attempts,
    SUM(CASE WHEN result_type = 'fixed' THEN 1 ELSE 0 END) as fixed_count,
    SUM(CASE WHEN result_type = 'decomposed' THEN 1 ELSE 0 END) as decomposed_count,
    SUM(CASE WHEN result_type = 'escalate' THEN 1 ELSE 0 END) as escalate_count,
    ROUND(100.0 * SUM(CASE WHEN result_type IN ('fixed', 'decomposed') THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM sia_attempts
GROUP BY technique
ORDER BY total_attempts DESC;

-- ============================================================================
-- SIA TECHNIQUE EFFECTIVENESS VIEW
-- Shows which techniques work best for different failure types
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_sia_technique_effectiveness AS
SELECT 
    technique,
    json_extract(analysis, '$.issueType') as issue_type,
    COUNT(*) as attempts,
    SUM(CASE WHEN result_type IN ('fixed', 'decomposed') THEN 1 ELSE 0 END) as successes,
    ROUND(100.0 * SUM(CASE WHEN result_type IN ('fixed', 'decomposed') THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM sia_attempts
WHERE analysis IS NOT NULL
GROUP BY technique, issue_type
ORDER BY success_rate DESC;
