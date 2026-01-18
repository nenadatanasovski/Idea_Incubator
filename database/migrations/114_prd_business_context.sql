-- Migration: Add business_context field to PRDs
-- This field stores non-functional items that should NOT be analyzed for task coverage
-- Examples: budget constraints, resource limitations, marketing constraints, business KPIs

-- Add the new column
ALTER TABLE prds ADD COLUMN business_context TEXT NOT NULL DEFAULT '[]';

-- Note: Existing constraint items that are business-related (like "Solo founder with 15-20 hours/week")
-- should be manually moved to business_context via the UI or a separate data migration
