-- =============================================================================
-- Migration: 088_transcript_multi_source.sql
-- Purpose: Add multi-source support to transcript_entries for unified observability
-- Created: 2026-01-16
-- Reference: docs/specs/observability/TASK-AGENT-OBSERVABILITY-INTEGRATION-PLAN.md
-- =============================================================================

-- Add missing columns for multi-source support
-- Note: SQLite doesn't support ALTER COLUMN, so we add columns and handle nullability at app level

-- Telegram context columns
ALTER TABLE transcript_entries ADD COLUMN chat_id TEXT;
ALTER TABLE transcript_entries ADD COLUMN telegram_user_id TEXT;
ALTER TABLE transcript_entries ADD COLUMN message_id TEXT;

-- Script context columns
ALTER TABLE transcript_entries ADD COLUMN script_name TEXT;
ALTER TABLE transcript_entries ADD COLUMN script_args TEXT;

-- User context columns
ALTER TABLE transcript_entries ADD COLUMN user_id TEXT;
ALTER TABLE transcript_entries ADD COLUMN session_id TEXT;
ALTER TABLE transcript_entries ADD COLUMN page_url TEXT;

-- Webhook context columns
ALTER TABLE transcript_entries ADD COLUMN webhook_url TEXT;
ALTER TABLE transcript_entries ADD COLUMN webhook_method TEXT;

-- Cross-source correlation
ALTER TABLE transcript_entries ADD COLUMN correlation_id TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_transcript_chat ON transcript_entries(chat_id);
CREATE INDEX IF NOT EXISTS idx_transcript_user ON transcript_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_transcript_session ON transcript_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_transcript_correlation ON transcript_entries(correlation_id);
CREATE INDEX IF NOT EXISTS idx_transcript_source ON transcript_entries(source);

-- Note: execution_id, instance_id, sequence have NOT NULL constraints in original schema
-- For system/telegram/etc events, we use placeholder values:
-- - execution_id: 'system' or 'telegram-{chatId}' or 'script-{name}'
-- - instance_id: 'system' or the source identifier
-- - sequence: 0 for non-agent events (no sequencing needed)
