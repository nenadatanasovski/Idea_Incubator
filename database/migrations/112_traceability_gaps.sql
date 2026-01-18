-- Traceability gap analysis results
-- Used by AI gap analyzer to store detected gaps and suggestions

CREATE TABLE IF NOT EXISTS traceability_gaps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gap_type TEXT NOT NULL CHECK(gap_type IN ('uncovered', 'weak_coverage', 'orphan', 'mismatch')),
  entity_type TEXT CHECK(entity_type IN ('requirement', 'task')),
  entity_ref TEXT, -- 'success_criteria[0]' or task_id
  severity TEXT CHECK(severity IN ('critical', 'warning', 'info')) DEFAULT 'warning',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggestions TEXT, -- JSON array of suggestion strings
  status TEXT CHECK(status IN ('open', 'resolved', 'ignored')) DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT -- 'user' or 'ai'
);

-- Indexes for gap queries
CREATE INDEX IF NOT EXISTS idx_traceability_gaps_project ON traceability_gaps(project_id);
CREATE INDEX IF NOT EXISTS idx_traceability_gaps_status ON traceability_gaps(status);
CREATE INDEX IF NOT EXISTS idx_traceability_gaps_type ON traceability_gaps(gap_type);
CREATE INDEX IF NOT EXISTS idx_traceability_gaps_severity ON traceability_gaps(severity);

-- Dismissed orphan tasks (intentionally unlinked)
CREATE TABLE IF NOT EXISTS dismissed_orphans (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reason TEXT,
  dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed_by TEXT,
  UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_orphans_project ON dismissed_orphans(project_id);
