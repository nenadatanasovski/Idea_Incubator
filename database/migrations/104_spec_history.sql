-- Migration 104: Create spec_history table
-- Purpose: Track spec changes and workflow transitions for versioning
-- Part of: Ideation Agent Spec Generation Implementation (SPEC-001-C)

CREATE TABLE IF NOT EXISTS spec_history (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES prds(id) ON DELETE CASCADE,

  -- Version at time of change
  version INTEGER NOT NULL,

  -- JSON object describing what changed
  -- Format: { field: { old: value, new: value }, ... }
  changes_json TEXT NOT NULL DEFAULT '{}',

  -- Who triggered the change
  changed_by TEXT,

  -- Workflow transition (if applicable)
  from_state TEXT,
  to_state TEXT,

  -- Reason for change (optional)
  reason TEXT,

  -- Timestamp of change
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for history lookups by spec
CREATE INDEX IF NOT EXISTS idx_spec_history_spec_id ON spec_history(spec_id);

-- Index for chronological ordering
CREATE INDEX IF NOT EXISTS idx_spec_history_changed_at ON spec_history(changed_at);

-- Index for version lookups
CREATE INDEX IF NOT EXISTS idx_spec_history_version ON spec_history(spec_id, version);

-- Trigger to auto-record spec changes
CREATE TRIGGER IF NOT EXISTS trg_spec_version_increment
AFTER UPDATE ON prds
FOR EACH ROW
WHEN OLD.version != NEW.version OR OLD.workflow_state != NEW.workflow_state
BEGIN
  INSERT INTO spec_history (id, spec_id, version, changes_json, from_state, to_state, changed_at)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.id,
    NEW.version,
    json_object(
      'workflow_state', json_object('old', OLD.workflow_state, 'new', NEW.workflow_state),
      'version', json_object('old', OLD.version, 'new', NEW.version)
    ),
    OLD.workflow_state,
    NEW.workflow_state,
    datetime('now')
  );
END;
