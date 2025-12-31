-- Migration 013: Risk Response Capture System
-- Adds structured risk response tracking to positioning decisions

-- ============================================================================
-- 1. Add risk_responses column to positioning_decisions (JSON array)
-- ============================================================================

ALTER TABLE positioning_decisions
ADD COLUMN risk_responses TEXT DEFAULT '[]';

-- ============================================================================
-- 2. Add risk_response_stats for quick lookups (JSON object)
-- ============================================================================

ALTER TABLE positioning_decisions
ADD COLUMN risk_response_stats TEXT DEFAULT NULL;

-- ============================================================================
-- 3. Create risk_response_log table for analytics/learning
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_response_log (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL,
    risk_id TEXT NOT NULL,
    risk_description TEXT NOT NULL,
    risk_severity TEXT NOT NULL CHECK(risk_severity IN ('high', 'medium', 'low')),
    response_type TEXT NOT NULL CHECK(response_type IN ('mitigate', 'accept', 'monitor', 'disagree', 'skip')),
    disagree_reason TEXT CHECK(disagree_reason IS NULL OR disagree_reason IN ('not_applicable', 'already_addressed', 'low_likelihood', 'insider_knowledge', 'other')),
    reasoning TEXT,
    mitigation_plan TEXT,
    strategic_approach TEXT CHECK(strategic_approach IS NULL OR strategic_approach IN ('create', 'copy_improve', 'combine', 'localize', 'specialize', 'time')),
    positioning_decision_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idea_id) REFERENCES ideas(id),
    FOREIGN KEY (positioning_decision_id) REFERENCES positioning_decisions(id)
);

-- ============================================================================
-- 4. Indexes for analytics queries
-- ============================================================================

-- Index for analyzing disagreement patterns
CREATE INDEX IF NOT EXISTS idx_risk_response_log_type
ON risk_response_log(response_type);

CREATE INDEX IF NOT EXISTS idx_risk_response_log_disagree
ON risk_response_log(response_type, disagree_reason)
WHERE response_type = 'disagree';

-- Index for per-idea queries
CREATE INDEX IF NOT EXISTS idx_risk_response_log_idea
ON risk_response_log(idea_id, created_at DESC);

-- Index for per-decision queries
CREATE INDEX IF NOT EXISTS idx_risk_response_log_decision
ON risk_response_log(positioning_decision_id);

-- ============================================================================
-- 5. View for risk response analytics
-- ============================================================================

CREATE VIEW IF NOT EXISTS risk_response_analytics AS
SELECT
    idea_id,
    response_type,
    disagree_reason,
    strategic_approach,
    COUNT(*) as count,
    risk_severity
FROM risk_response_log
GROUP BY idea_id, response_type, disagree_reason, strategic_approach, risk_severity;
