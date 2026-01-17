-- Migration 107: Link task lists to specs
-- Part of: Ideation Agent Spec Generation Implementation (SPEC-008-B)

-- Add source_spec_id column to task_lists_v2 to link task lists to their source spec
ALTER TABLE task_lists_v2 ADD COLUMN source_spec_id TEXT REFERENCES prds(id) ON DELETE SET NULL;

-- Create index for fast lookups by source spec
CREATE INDEX IF NOT EXISTS idx_task_lists_source_spec ON task_lists_v2(source_spec_id);

-- Add view to easily see task lists with their source specs
CREATE VIEW IF NOT EXISTS task_list_spec_view AS
SELECT
    tl.id AS task_list_id,
    tl.name AS task_list_name,
    tl.status AS task_list_status,
    tl.created_at AS task_list_created,
    p.id AS spec_id,
    p.title AS spec_title,
    p.workflow_state AS spec_workflow_state,
    p.readiness_score AS spec_readiness_score
FROM task_lists_v2 tl
LEFT JOIN prds p ON tl.source_spec_id = p.id;
