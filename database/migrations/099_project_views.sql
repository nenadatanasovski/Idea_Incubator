-- Migration: 099_project_views.sql
-- Purpose: Create useful views for project queries
-- Part of: Project Entity Formalization

-- View: project_stats_view
-- Provides project statistics including task counts and idea linkage
CREATE VIEW IF NOT EXISTS project_stats_view AS
SELECT
  p.id,
  p.slug,
  p.code,
  p.name,
  p.description,
  p.status,
  p.owner_id,
  p.idea_id,
  p.created_at,
  p.updated_at,
  p.started_at,
  p.completed_at,

  -- Idea details (if linked)
  i.slug AS idea_slug,
  i.title AS idea_title,
  i.lifecycle_stage AS idea_lifecycle_stage,
  i.incubation_phase AS idea_incubation_phase,

  -- Task statistics
  COUNT(DISTINCT t.id) AS total_tasks,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
  SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed_tasks,
  SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
  SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_tasks,
  SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked_tasks,
  SUM(CASE WHEN t.queue = 'evaluation' THEN 1 ELSE 0 END) AS evaluation_queue_tasks,

  -- Task list statistics
  COUNT(DISTINCT tl.id) AS total_task_lists,
  SUM(CASE WHEN tl.status = 'completed' THEN 1 ELSE 0 END) AS completed_task_lists,
  SUM(CASE WHEN tl.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_task_lists,

  -- PRD statistics
  COUNT(DISTINCT prd.id) AS total_prds,

  -- Compute completion percentage
  CASE
    WHEN COUNT(DISTINCT t.id) = 0 THEN 0
    ELSE ROUND(
      (SUM(CASE WHEN t.status = 'completed' THEN 1.0 ELSE 0 END) / COUNT(DISTINCT t.id)) * 100,
      1
    )
  END AS completion_percentage

FROM projects p
LEFT JOIN ideas i ON p.idea_id = i.id
LEFT JOIN tasks t ON (t.project_id = p.id OR t.project_id = p.code)
LEFT JOIN task_lists_v2 tl ON (tl.project_id = p.id OR tl.project_id = p.code)
LEFT JOIN prds prd ON (prd.project_id = p.id OR prd.project_id = p.code)
GROUP BY p.id;


-- View: idea_project_view
-- Maps ideas to their projects (if any)
CREATE VIEW IF NOT EXISTS idea_project_view AS
SELECT
  i.id AS idea_id,
  i.slug AS idea_slug,
  i.title AS idea_title,
  i.summary AS idea_summary,
  i.idea_type,
  i.lifecycle_stage,
  i.incubation_phase,
  i.status AS idea_status,
  i.created_at AS idea_created_at,
  i.updated_at AS idea_updated_at,

  -- Project details (NULL if no project linked)
  p.id AS project_id,
  p.slug AS project_slug,
  p.code AS project_code,
  p.name AS project_name,
  p.status AS project_status,
  p.created_at AS project_created_at,

  -- Has project flag
  CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS has_project

FROM ideas i
LEFT JOIN projects p ON p.idea_id = i.id;


-- View: active_projects_view
-- Shows only active projects with basic stats
CREATE VIEW IF NOT EXISTS active_projects_view AS
SELECT
  p.id,
  p.slug,
  p.code,
  p.name,
  p.description,
  p.idea_id,
  i.title AS idea_title,
  p.created_at,
  p.updated_at,

  -- Quick task counts
  (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id OR t.project_id = p.code) AS task_count,
  (SELECT COUNT(*) FROM tasks t WHERE (t.project_id = p.id OR t.project_id = p.code) AND t.status = 'completed') AS completed_count,
  (SELECT COUNT(*) FROM tasks t WHERE (t.project_id = p.id OR t.project_id = p.code) AND t.status = 'in_progress') AS active_count

FROM projects p
LEFT JOIN ideas i ON p.idea_id = i.id
WHERE p.status = 'active'
ORDER BY p.updated_at DESC;


-- View: project_task_list_summary
-- Shows task lists grouped by project
CREATE VIEW IF NOT EXISTS project_task_list_summary AS
SELECT
  p.id AS project_id,
  p.code AS project_code,
  p.name AS project_name,
  tl.id AS task_list_id,
  tl.name AS task_list_name,
  tl.status AS task_list_status,
  tl.total_tasks,
  tl.completed_tasks,
  tl.failed_tasks,
  tl.created_at AS task_list_created_at,

  -- Completion percentage
  CASE
    WHEN tl.total_tasks = 0 THEN 0
    ELSE ROUND((tl.completed_tasks * 100.0) / tl.total_tasks, 1)
  END AS completion_percentage

FROM projects p
INNER JOIN task_lists_v2 tl ON (tl.project_id = p.id OR tl.project_id = p.code)
ORDER BY p.name, tl.created_at;
