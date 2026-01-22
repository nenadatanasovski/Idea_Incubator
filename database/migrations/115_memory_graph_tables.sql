-- Memory Graph Tables for Idea Incubator
-- Stores structured knowledge blocks and their relationships

-- ============================================================================
-- memory_blocks: Stores all graph nodes/blocks
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_blocks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id),
  idea_id TEXT REFERENCES ideas(id),
  type TEXT NOT NULL, -- content, link, meta, synthesis, pattern, decision, option, derived, assumption, cycle, placeholder, stakeholder_view, topic, external, action
  content TEXT NOT NULL,
  properties JSON,
  status TEXT DEFAULT 'active', -- draft, active, validated, superseded, abandoned
  confidence REAL,
  abstraction_level TEXT, -- vision, strategy, tactic, implementation
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  extracted_from_message_id TEXT REFERENCES ideation_messages(id),
  artifact_id TEXT -- bidirectional link to artifact
);

CREATE INDEX IF NOT EXISTS idx_memory_blocks_session ON memory_blocks(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_blocks_idea ON memory_blocks(idea_id);
CREATE INDEX IF NOT EXISTS idx_memory_blocks_type ON memory_blocks(type);
CREATE INDEX IF NOT EXISTS idx_memory_blocks_status ON memory_blocks(status);
CREATE INDEX IF NOT EXISTS idx_memory_blocks_artifact ON memory_blocks(artifact_id);

-- ============================================================================
-- memory_links: Stores relationships between blocks (edges)
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_links (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ideation_sessions(id),
  source_block_id TEXT NOT NULL REFERENCES memory_blocks(id) ON DELETE CASCADE,
  target_block_id TEXT NOT NULL REFERENCES memory_blocks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL, -- addresses, creates, requires, conflicts, supports, depends_on, enables, suggests, supersedes, validates, invalidates, references, evidence_for, elaborates, refines, specializes, alternative_to, instance_of, constrained_by, derived_from, measured_by
  degree TEXT, -- full, partial, minimal
  confidence REAL,
  reason TEXT,
  status TEXT DEFAULT 'active', -- active, superseded, removed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_links_session ON memory_links(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_source ON memory_links(source_block_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_target ON memory_links(target_block_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_type ON memory_links(link_type);

-- ============================================================================
-- memory_graph_memberships: Junction table for block-to-graph-type assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_graph_memberships (
  block_id TEXT NOT NULL REFERENCES memory_blocks(id) ON DELETE CASCADE,
  graph_type TEXT NOT NULL, -- problem, solution, market, risk, fit, business, spec
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (block_id, graph_type)
);

CREATE INDEX IF NOT EXISTS idx_memory_graph_memberships_graph ON memory_graph_memberships(graph_type);
