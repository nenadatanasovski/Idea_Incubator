// agents/sia/db.ts - Database operations for SIA

import { getDb } from "../../database/db.js";
import {
  KnowledgeEntry,
  ClaudeMdProposal,
  KnowledgeQuery,
  KnowledgeType,
  ProposalStatus,
} from "../../types/sia.js";

/**
 * Save a new knowledge entry
 */
export async function saveKnowledgeEntry(entry: KnowledgeEntry): Promise<void> {
  const db = await getDb();
  db.run(
    `
    INSERT INTO knowledge_entries (
      id, type, content, file_patterns_json, action_types_json,
      confidence, occurrences, source_execution_id, source_task_id, source_agent_type,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      entry.id,
      entry.type,
      entry.content,
      JSON.stringify(entry.filePatterns),
      JSON.stringify(entry.actionTypes),
      entry.confidence,
      entry.occurrences,
      entry.source.executionId,
      entry.source.taskId,
      entry.source.agentType,
      entry.createdAt,
      entry.updatedAt,
    ],
  );
}

/**
 * Update an existing knowledge entry
 */
export async function updateKnowledgeEntry(
  entry: KnowledgeEntry,
): Promise<void> {
  const db = await getDb();
  db.run(
    `
    UPDATE knowledge_entries SET
      content = ?,
      file_patterns_json = ?,
      action_types_json = ?,
      confidence = ?,
      occurrences = ?,
      updated_at = ?
    WHERE id = ?
  `,
    [
      entry.content,
      JSON.stringify(entry.filePatterns),
      JSON.stringify(entry.actionTypes),
      entry.confidence,
      entry.occurrences,
      entry.updatedAt,
      entry.id,
    ],
  );
}

/**
 * Query knowledge entries with filters
 */
export async function queryKnowledge(
  query: KnowledgeQuery,
): Promise<KnowledgeEntry[]> {
  const db = await getDb();

  let sql = "SELECT * FROM knowledge_entries WHERE 1=1";
  const params: (string | number)[] = [];

  if (query.type) {
    sql += " AND type = ?";
    params.push(query.type);
  }

  if (query.minConfidence !== undefined) {
    sql += " AND confidence >= ?";
    params.push(query.minConfidence);
  }

  sql += " ORDER BY confidence DESC, occurrences DESC";

  if (query.limit) {
    sql += " LIMIT ?";
    params.push(query.limit);
  }

  if (query.offset) {
    sql += " OFFSET ?";
    params.push(query.offset);
  }

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const entries: KnowledgeEntry[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    entries.push(rowToKnowledgeEntry(row));
  }
  stmt.free();

  // Post-filter by file pattern and action type (JSON columns)
  let filtered = entries;

  if (query.filePattern) {
    filtered = filtered.filter((e) =>
      e.filePatterns.some((p) => matchPattern(query.filePattern!, p)),
    );
  }

  if (query.actionType) {
    filtered = filtered.filter((e) =>
      e.actionTypes.includes(query.actionType!),
    );
  }

  return filtered;
}

/**
 * Get a single knowledge entry by ID
 */
export async function getKnowledgeEntry(
  id: string,
): Promise<KnowledgeEntry | null> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM knowledge_entries WHERE id = ?");
  stmt.bind([id]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject();
  stmt.free();

  return rowToKnowledgeEntry(row);
}

/**
 * Save a CLAUDE.md proposal
 */
export async function saveProposal(proposal: ClaudeMdProposal): Promise<void> {
  const db = await getDb();
  db.run(
    `
    INSERT INTO claude_md_proposals (
      id, knowledge_entry_id, proposed_section, proposed_content, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      proposal.id,
      proposal.knowledgeEntryId,
      proposal.proposedSection,
      proposal.proposedContent,
      proposal.status,
      proposal.createdAt,
    ],
  );
}

/**
 * Get proposals with optional status filter
 */
export async function getProposals(
  status?: ProposalStatus,
): Promise<ClaudeMdProposal[]> {
  const db = await getDb();

  let sql = "SELECT * FROM claude_md_proposals";
  const params: string[] = [];

  if (status) {
    sql += " WHERE status = ?";
    params.push(status);
  }

  sql += " ORDER BY created_at DESC";

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const proposals: ClaudeMdProposal[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    proposals.push(rowToProposal(row));
  }
  stmt.free();

  return proposals;
}

/**
 * Get a single proposal by ID
 */
export async function getProposal(
  id: string,
): Promise<ClaudeMdProposal | null> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM claude_md_proposals WHERE id = ?");
  stmt.bind([id]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject();
  stmt.free();

  return rowToProposal(row);
}

/**
 * Update proposal status
 */
export async function updateProposalStatus(
  id: string,
  status: ProposalStatus,
  notes?: string,
): Promise<void> {
  const db = await getDb();
  db.run(
    `
    UPDATE claude_md_proposals SET
      status = ?,
      reviewed_at = datetime('now'),
      reviewer_notes = ?
    WHERE id = ?
  `,
    [status, notes || null, id],
  );
}

/**
 * Get gotchas filtered by file pattern
 */
export async function getGotchasForFile(
  filePattern: string,
): Promise<KnowledgeEntry[]> {
  return queryKnowledge({
    type: "gotcha",
    filePattern,
    minConfidence: 0.3,
  });
}

/**
 * Get patterns filtered by file pattern
 */
export async function getPatternsForFile(
  filePattern: string,
): Promise<KnowledgeEntry[]> {
  return queryKnowledge({
    type: "pattern",
    filePattern,
  });
}

// Helper functions

function rowToKnowledgeEntry(row: Record<string, unknown>): KnowledgeEntry {
  return {
    id: row.id as string,
    type: row.type as KnowledgeType,
    content: row.content as string,
    filePatterns: JSON.parse((row.file_patterns_json as string) || "[]"),
    actionTypes: JSON.parse((row.action_types_json as string) || "[]"),
    confidence: row.confidence as number,
    occurrences: row.occurrences as number,
    source: {
      executionId: (row.source_execution_id as string) || "",
      taskId: (row.source_task_id as string) || "",
      agentType: (row.source_agent_type as string) || "",
    },
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToProposal(row: Record<string, unknown>): ClaudeMdProposal {
  return {
    id: row.id as string,
    knowledgeEntryId: row.knowledge_entry_id as string,
    proposedSection: row.proposed_section as string,
    proposedContent: row.proposed_content as string,
    status: row.status as ProposalStatus,
    reviewedAt: (row.reviewed_at as string) || null,
    reviewerNotes: (row.reviewer_notes as string) || null,
    createdAt: row.created_at as string,
  };
}

function matchPattern(target: string, pattern: string): boolean {
  // Simple glob matching
  if (pattern.startsWith("*.")) {
    return target.endsWith(pattern.slice(1));
  }
  if (pattern.endsWith("/*")) {
    return target.startsWith(pattern.slice(0, -1));
  }
  return target.includes(pattern) || pattern.includes(target);
}
