-- Migration 012: Add strategic approach to differentiation results
-- Extends differentiation_results to track which approach was used

-- ============================================================================
-- 1. Add strategic_approach column
-- ============================================================================

ALTER TABLE differentiation_results
ADD COLUMN strategic_approach TEXT DEFAULT NULL
CHECK(strategic_approach IS NULL OR strategic_approach IN ('create', 'copy_improve', 'combine', 'localize', 'specialize', 'time'));

-- ============================================================================
-- 2. Add strategic_summary column (JSON object)
-- ============================================================================

ALTER TABLE differentiation_results
ADD COLUMN strategic_summary TEXT DEFAULT NULL;

-- ============================================================================
-- 3. Create index for approach-based queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_diff_results_approach ON differentiation_results(strategic_approach);
