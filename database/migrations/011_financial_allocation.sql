-- Migration 011: Financial Allocation and Positioning Decisions
-- Adds per-idea financial allocation and positioning decision tracking

-- ============================================================================
-- 1. Create idea_financial_allocations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS idea_financial_allocations (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL UNIQUE,  -- One allocation per idea

    -- Resource Allocation
    allocated_budget REAL DEFAULT 0,
    allocated_weekly_hours REAL DEFAULT 0,
    allocated_runway_months INTEGER DEFAULT 0,
    allocation_priority TEXT DEFAULT 'exploration'
        CHECK (allocation_priority IN ('primary', 'secondary', 'exploration', 'parked')),

    -- Idea-Specific Goals
    target_income_from_idea REAL,
    income_timeline_months INTEGER,
    income_type TEXT DEFAULT 'supplement'
        CHECK (income_type IN ('full_replacement', 'partial_replacement', 'supplement', 'wealth_building', 'learning')),
    exit_intent INTEGER DEFAULT 0,

    -- Idea-Specific Risk
    idea_risk_tolerance TEXT
        CHECK (idea_risk_tolerance IN ('low', 'medium', 'high', 'very_high')),
    max_acceptable_loss REAL,
    pivot_willingness TEXT DEFAULT 'moderate'
        CHECK (pivot_willingness IN ('rigid', 'moderate', 'flexible', 'very_flexible')),

    -- Validation Budget
    validation_budget REAL DEFAULT 0,
    max_time_to_validate_months INTEGER,
    kill_criteria TEXT,

    -- Strategic Approach
    strategic_approach TEXT
        CHECK (strategic_approach IN ('create', 'copy_improve', 'combine', 'localize', 'specialize', 'time')),
    approach_rationale TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

-- ============================================================================
-- 2. Create positioning_decisions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS positioning_decisions (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL,

    -- Strategy Selection
    primary_strategy_id TEXT,
    primary_strategy_name TEXT,
    secondary_strategy_id TEXT,
    secondary_strategy_name TEXT,

    -- Risk Acknowledgment (JSON array of risk IDs)
    acknowledged_risk_ids TEXT DEFAULT '[]',

    -- Timing Decision
    timing_decision TEXT CHECK (timing_decision IN ('proceed_now', 'wait', 'urgent')),
    timing_rationale TEXT,

    -- Strategic Approach
    selected_approach TEXT
        CHECK (selected_approach IN ('create', 'copy_improve', 'combine', 'localize', 'specialize', 'time')),

    -- Notes
    notes TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. Add financial fields to user_profiles table
-- ============================================================================

-- Extended financial fields for portfolio-level context
ALTER TABLE user_profiles ADD COLUMN current_annual_income REAL;
ALTER TABLE user_profiles ADD COLUMN monthly_burn_rate REAL;
ALTER TABLE user_profiles ADD COLUMN has_alternative_income INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN total_investment_capacity REAL;
ALTER TABLE user_profiles ADD COLUMN debt_tolerance TEXT
    CHECK (debt_tolerance IN ('none', 'low', 'moderate', 'high'));
ALTER TABLE user_profiles ADD COLUMN willingness_to_raise_funding INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN lifestyle_income_target REAL;

-- ============================================================================
-- 4. Update incubation_phase check constraint to include 'position'
-- ============================================================================

-- SQLite doesn't support ALTER COLUMN, so we need to work around this
-- The 'position' phase replaces 'differentiation' but we keep both for backward compat
-- The application layer will handle the migration

-- ============================================================================
-- 5. Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_idea_allocations_idea_id ON idea_financial_allocations(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_allocations_priority ON idea_financial_allocations(allocation_priority);
CREATE INDEX IF NOT EXISTS idx_positioning_decisions_idea ON positioning_decisions(idea_id);
CREATE INDEX IF NOT EXISTS idx_positioning_decisions_latest ON positioning_decisions(idea_id, created_at DESC);

-- ============================================================================
-- 6. Create trigger to update updated_at timestamp
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_allocation_timestamp
    AFTER UPDATE ON idea_financial_allocations
BEGIN
    UPDATE idea_financial_allocations
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_decision_timestamp
    AFTER UPDATE ON positioning_decisions
BEGIN
    UPDATE positioning_decisions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
