-- Migration 086: Add auto_approve_reviews column to task_lists_v2
-- Purpose: Control cascade auto-approval at task list level
-- Part of: Task System V2 Implementation Plan (IMPL-1.9)

ALTER TABLE task_lists_v2
ADD COLUMN auto_approve_reviews INTEGER NOT NULL DEFAULT 0;
