-- Migration 103: Create spec_sections table
-- Purpose: Store structured spec content in separate editable sections
-- Part of: Ideation Agent Spec Generation Implementation (SPEC-001-B)

CREATE TABLE IF NOT EXISTS spec_sections (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES prds(id) ON DELETE CASCADE,

  -- Section type (determines editor type in UI)
  section_type TEXT NOT NULL CHECK (section_type IN (
    'problem',
    'target_users',
    'functional_desc',
    'success_criteria',
    'constraints',
    'out_of_scope',
    'risks',
    'assumptions'
  )),

  -- Section content (text or JSON for list types)
  content TEXT NOT NULL DEFAULT '',

  -- Display order within the spec
  order_index INTEGER NOT NULL DEFAULT 0,

  -- Confidence score from generation (0-100)
  confidence_score INTEGER DEFAULT 0,

  -- Flag for low-confidence sections needing review
  needs_review INTEGER DEFAULT 0,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast section lookups by spec
CREATE INDEX IF NOT EXISTS idx_spec_sections_spec_id ON spec_sections(spec_id);

-- Index for ordering sections
CREATE INDEX IF NOT EXISTS idx_spec_sections_order ON spec_sections(spec_id, order_index);

-- Unique constraint: one section type per spec
CREATE UNIQUE INDEX IF NOT EXISTS idx_spec_sections_unique_type ON spec_sections(spec_id, section_type);
