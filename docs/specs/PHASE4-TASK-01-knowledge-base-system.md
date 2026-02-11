# PHASE4-TASK-01: Knowledge Base System for Agent Learning

**Status:** Specification
**Priority:** P1 (High - Phase 4)
**Effort:** Large
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Build a comprehensive Knowledge Base system that enables agents to learn from past execution attempts, store patterns and gotchas, track error recovery strategies, and improve autonomous decision-making through accumulated experience across all sessions and tasks.

**Problem:** Agents currently operate with limited memory - basic short-term context exists (`parent-harness/orchestrator/src/memory/index.ts`) but there's no systematic capture of learnings across sessions. When an agent encounters an error, solves it, and completes a task, that knowledge is lost. Future agents encountering similar issues must rediscover solutions, wasting time and tokens. The existing SIA knowledge-writer (`agents/sia/knowledge-writer.ts`) provides a foundation but is isolated to the Idea Incubator subsystem and not integrated with Parent Harness orchestrator.

**Solution:** Extend the Parent Harness with a unified Knowledge Base system that:

1. Captures patterns, gotchas, and decisions from all agent executions
2. Stores error recovery strategies with confidence tracking
3. Provides similarity matching to retrieve relevant knowledge for current tasks
4. Integrates with existing agent memory system
5. Supports promotion of high-confidence learnings to CLAUDE.md files
6. Enables cross-agent knowledge sharing through centralized storage

---

## Current State Analysis

### Existing Infrastructure ✅

1. **SIA Knowledge Writer** (`agents/sia/knowledge-writer.ts`)
   - ✅ Writes gotchas, patterns, decisions to knowledge base
   - ✅ Confidence tracking with initial/boost/decay logic
   - ✅ Duplicate detection using Jaccard similarity
   - ✅ Memory graph integration for unified storage
   - ✅ Occurrence counting for pattern reinforcement
   - ❌ **Gap:** Isolated to Idea Incubator, not used by Parent Harness agents
   - ❌ **Gap:** No error recovery strategy tracking
   - ❌ **Gap:** No task signature matching for similar-task lookup

2. **Agent Memory System** (`parent-harness/orchestrator/src/memory/index.ts`)
   - ✅ Per-agent memory store with short-term context
   - ✅ Types: context, learning, preference, error_pattern, success_pattern
   - ✅ Access tracking, importance scoring, expiration
   - ✅ Task context (24h expiration)
   - ✅ Success/error learning functions
   - ❌ **Gap:** No cross-agent knowledge sharing
   - ❌ **Gap:** No similarity matching for patterns
   - ❌ **Gap:** No technique effectiveness tracking
   - ❌ **Gap:** No integration with knowledge base

3. **Knowledge Base API** (`server/routes/knowledge.ts`)
   - ✅ REST endpoints: query, stats, search, gotchas, patterns
   - ✅ Promotion candidate detection (high confidence + occurrences)
   - ✅ CLAUDE.md proposal workflow
   - ❌ **Gap:** Only serves Idea Incubator knowledge
   - ❌ **Gap:** No Parent Harness integration

4. **Database Schema** (Idea Incubator)
   - ✅ `memory_blocks` table for unified graph storage
   - ✅ `memory_block_types` for type taxonomy
   - ✅ Confidence scoring, properties JSON
   - ❌ **Gap:** No Parent Harness equivalent tables

5. **Parent Harness Database** (`parent-harness/database/schema.sql`)
   - ✅ `agent_memory` table exists (simple key-value)
   - ❌ **Gap:** No `knowledge_entries` table
   - ❌ **Gap:** No `technique_effectiveness` table
   - ❌ **Gap:** No `error_recovery_strategies` table
   - ❌ **Gap:** No `task_signatures` table for matching

### Gaps Identified

1. **Knowledge Isolation** - Idea Incubator knowledge not accessible to Parent Harness agents
2. **No Error Recovery Tracking** - Solutions to errors not systematically recorded
3. **No Cross-Agent Learning** - Agents can't benefit from other agents' experiences
4. **No Task Similarity Matching** - Can't find "I've seen this before" patterns
5. **No Technique Effectiveness** - No tracking of which fixes work for which errors
6. **Manual Knowledge Transfer** - No auto-promotion of validated learnings to CLAUDE.md
7. **No Pattern Reinforcement** - Successful patterns not boosted, failures not demoted

---

## Requirements

### Functional Requirements

**FR-1: Knowledge Entry Storage**

- MUST store three types of knowledge entries:
  - **Gotchas**: Specific pitfalls with file patterns, action types, fixes
  - **Patterns**: Reusable code templates with usage examples
  - **Decisions**: Architectural choices with context and rationale
- MUST track source metadata: execution_id, task_id, agent_id, timestamp
- MUST support confidence scoring (0.0-1.0) with initial confidence calculation
- MUST track occurrence count (how many times pattern reused)
- MUST link to file patterns (glob patterns like `*.ts`, `database/*`)
- MUST link to action types (CREATE, UPDATE, DELETE, VERIFY, etc.)
- SHOULD support tagging for categorization

**FR-2: Error Recovery Strategy Tracking**

- MUST record error pattern + recovery technique pairs
- MUST track success/failure outcomes for each technique
- MUST calculate technique effectiveness (success_rate = successes / total_attempts)
- MUST support multi-step recovery strategies
- MUST link strategies to specific error patterns (substring match, regex)
- MUST record execution context (agent type, task category, file type)
- SHOULD recommend best technique for known error patterns
- SHOULD auto-escalate after N failed attempts with same technique

**FR-3: Task Signature Matching**

- MUST generate task signature hash from: title, category, file patterns, dependencies
- MUST support similarity search for "similar tasks I've done before"
- MUST retrieve relevant knowledge based on task signature
- MUST rank results by relevance score (file pattern overlap, category match)
- MUST filter by minimum confidence threshold
- SHOULD support semantic matching (not just exact match)

**FR-4: Cross-Agent Knowledge Sharing**

- MUST make knowledge entries available to ALL agents (not per-agent silos)
- MUST track which agent contributed each learning
- MUST support agent-specific preferences (e.g., "build_agent prefers X pattern")
- MUST prevent duplicate entries across agents (deduplication)
- SHOULD track knowledge reuse (which agents used which entries)

**FR-5: Confidence Management**

- MUST calculate initial confidence based on:
  - Source reliability (human > QA agent > build agent)
  - Prevention vs. reactive (prevented error = higher confidence)
  - Fix applied successfully (higher confidence)
- MUST boost confidence when:
  - Pattern reused successfully (+0.05 per reuse)
  - Multiple agents validate same pattern (+0.1)
  - Error prevented before occurring (+0.15)
- MUST decay confidence when:
  - Pattern fails to apply (-0.1)
  - Entry not accessed for >30 days (-0.01/month)
  - Superseded by better pattern (-0.2)
- MUST cap confidence at max (0.95) and min (0.1)
- MUST support manual confidence override for critical learnings

**FR-6: Knowledge Promotion**

- MUST identify promotion candidates: confidence ≥ 0.8 AND occurrences ≥ 3
- MUST generate CLAUDE.md proposals with markdown formatting
- MUST support approval workflow (pending → approved → rejected)
- MUST append approved entries to relevant CLAUDE.md files
- MUST track promotion history (when, by whom, to which file)
- SHOULD support batch promotion (multiple entries at once)
- SHOULD support rollback (remove promoted entry if it causes issues)

**FR-7: Knowledge Query & Retrieval**

- MUST support query filters: type, file pattern, action type, min confidence
- MUST support full-text search across content
- MUST support "recent entries" view (last 20)
- MUST retrieve gotchas/patterns relevant to specific file being edited
- MUST return results ranked by relevance + confidence
- SHOULD support pagination (limit, offset)
- SHOULD support export to JSON for backup

**FR-8: Integration with Agent Memory**

- MUST bridge agent_memory (short-term) with knowledge_base (long-term)
- MUST auto-promote validated learnings from memory to knowledge base
- MUST preserve agent-specific context while sharing patterns globally
- MUST provide unified API: `agent.learn()` writes to both systems
- SHOULD support memory→knowledge migration on task completion

### Non-Functional Requirements

**NFR-1: Performance**

- Knowledge query MUST complete in <100ms for typical queries (10-50 results)
- Similarity matching MUST complete in <500ms for task signature lookup
- Database writes MUST NOT block agent execution (async)
- Deduplication check MUST complete in <200ms
- MUST support 1000+ knowledge entries without degradation

**NFR-2: Data Integrity**

- Knowledge entries MUST be immutable (append-only, no edits to original)
- Confidence updates MUST be atomic (no race conditions)
- Occurrence increments MUST be transactional
- Database backups MUST run daily (SQLite file copy)
- MUST validate JSON schemas for properties field

**NFR-3: Observability**

- MUST log all knowledge writes with entry ID, agent, timestamp
- MUST track knowledge reuse metrics (queries, retrievals, applications)
- MUST expose metrics endpoint: `/api/knowledge/metrics`
- MUST emit events: `knowledge:created`, `knowledge:promoted`, `pattern:reused`
- SHOULD track token savings from reusing patterns

**NFR-4: Maintainability**

- Database schema MUST use migrations (no direct schema edits)
- Knowledge types MUST be extensible (easy to add new types)
- Confidence formulas MUST be configurable (constants in config file)
- MUST support schema versioning for future changes

---

## Technical Design

### Database Schema Extensions

**New tables for Parent Harness** (`parent-harness/database/schema.sql`):

```sql
-- ============================================
-- KNOWLEDGE BASE SYSTEM
-- ============================================

-- Knowledge Entries (patterns, gotchas, decisions)
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('gotcha', 'pattern', 'decision')),
    content TEXT NOT NULL,
    file_patterns TEXT, -- JSON array: ["*.ts", "database/*"]
    action_types TEXT, -- JSON array: ["CREATE", "UPDATE"]
    confidence REAL NOT NULL DEFAULT 0.5 CHECK(confidence >= 0.0 AND confidence <= 1.0),
    occurrences INTEGER DEFAULT 1,
    source_execution_id TEXT,
    source_task_id TEXT,
    source_agent_id TEXT NOT NULL,
    tags TEXT, -- JSON array for categorization
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    superseded_by TEXT REFERENCES knowledge_entries(id)
);

CREATE INDEX idx_knowledge_type ON knowledge_entries(type);
CREATE INDEX idx_knowledge_confidence ON knowledge_entries(confidence);
CREATE INDEX idx_knowledge_agent ON knowledge_entries(source_agent_id);
CREATE INDEX idx_knowledge_updated ON knowledge_entries(updated_at);

-- Error Recovery Strategies
CREATE TABLE IF NOT EXISTS error_recovery_strategies (
    id TEXT PRIMARY KEY,
    error_pattern TEXT NOT NULL, -- Substring or regex to match error message
    error_type TEXT, -- "TypeError", "ReferenceError", "API Error", etc.
    recovery_technique TEXT NOT NULL, -- Description of fix
    steps TEXT, -- JSON array of recovery steps
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    effectiveness REAL GENERATED ALWAYS AS (
        CASE
            WHEN (success_count + failure_count) = 0 THEN 0.5
            ELSE CAST(success_count AS REAL) / (success_count + failure_count)
        END
    ) STORED,
    context TEXT, -- JSON: {agent_type, task_category, file_type}
    knowledge_entry_id TEXT REFERENCES knowledge_entries(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_strategy_error_type ON error_recovery_strategies(error_type);
CREATE INDEX idx_strategy_effectiveness ON error_recovery_strategies(effectiveness);

-- Strategy Attempts (track each application)
CREATE TABLE IF NOT EXISTS strategy_attempts (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL REFERENCES error_recovery_strategies(id),
    task_id TEXT,
    session_id TEXT,
    agent_id TEXT NOT NULL,
    error_message TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK(outcome IN ('success', 'failure', 'partial')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Task Signatures (for similarity matching)
CREATE TABLE IF NOT EXISTS task_signatures (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id),
    signature_hash TEXT NOT NULL, -- Hash of: title + category + file_patterns
    title_normalized TEXT NOT NULL, -- Lowercase, stripped
    category TEXT NOT NULL,
    file_patterns TEXT, -- JSON array
    dependency_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_task_sig_hash ON task_signatures(signature_hash);
CREATE INDEX idx_task_sig_category ON task_signatures(category);

-- Knowledge Reuse Tracking
CREATE TABLE IF NOT EXISTS knowledge_reuse (
    id TEXT PRIMARY KEY,
    knowledge_entry_id TEXT NOT NULL REFERENCES knowledge_entries(id),
    task_id TEXT REFERENCES tasks(id),
    agent_id TEXT NOT NULL,
    match_type TEXT CHECK(match_type IN ('exact', 'similar', 'suggested')),
    applied INTEGER DEFAULT 0, -- 1 if agent used it, 0 if just viewed
    outcome TEXT CHECK(outcome IN ('success', 'failure', 'partial', 'not_applied')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_reuse_entry ON knowledge_reuse(knowledge_entry_id);
CREATE INDEX idx_reuse_task ON knowledge_reuse(task_id);

-- CLAUDE.md Promotion Proposals
CREATE TABLE IF NOT EXISTS knowledge_promotions (
    id TEXT PRIMARY KEY,
    knowledge_entry_id TEXT NOT NULL REFERENCES knowledge_entries(id),
    target_file TEXT NOT NULL, -- e.g., "parent-harness/orchestrator/src/agents/CLAUDE.md"
    proposed_content TEXT NOT NULL, -- Markdown formatted
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    review_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT,
    promoted_at TEXT
);
```

### Core Modules

#### 1. Knowledge Writer (`parent-harness/orchestrator/src/knowledge/writer.ts`)

Adapts Idea Incubator's knowledge-writer for Parent Harness:

```typescript
import { v4 as uuid } from "uuid";
import { query, run, getOne } from "../db/index.js";

export interface KnowledgeEntry {
  id: string;
  type: "gotcha" | "pattern" | "decision";
  content: string;
  file_patterns: string[];
  action_types: string[];
  confidence: number;
  occurrences: number;
  source_execution_id?: string;
  source_task_id?: string;
  source_agent_id: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  superseded_by?: string;
}

/**
 * Write a gotcha to the knowledge base
 */
export async function writeGotcha(params: {
  fix: string;
  filePattern: string;
  actionType: string;
  taskId?: string;
  executionId?: string;
  agentId: string;
}): Promise<KnowledgeEntry> {
  // Check for duplicates using similarity
  const existing = query<KnowledgeEntry>(
    "SELECT * FROM knowledge_entries WHERE type = ?",
    ["gotcha"],
  );

  const duplicate = findSimilar(params.fix, existing);

  if (duplicate) {
    // Merge: increment occurrences, boost confidence
    return mergeEntry(duplicate, params);
  }

  // Create new entry
  const entry: KnowledgeEntry = {
    id: uuid(),
    type: "gotcha",
    content: params.fix,
    file_patterns: [params.filePattern],
    action_types: [params.actionType],
    confidence: calculateInitialConfidence("gotcha", params),
    occurrences: 1,
    source_execution_id: params.executionId,
    source_task_id: params.taskId,
    source_agent_id: params.agentId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  run(
    `
    INSERT INTO knowledge_entries
    (id, type, content, file_patterns, action_types, confidence, occurrences,
     source_execution_id, source_task_id, source_agent_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      entry.id,
      entry.type,
      entry.content,
      JSON.stringify(entry.file_patterns),
      JSON.stringify(entry.action_types),
      entry.confidence,
      entry.occurrences,
      entry.source_execution_id,
      entry.source_task_id,
      entry.source_agent_id,
      entry.created_at,
      entry.updated_at,
    ],
  );

  return entry;
}

/**
 * Write a pattern to the knowledge base
 */
export async function writePattern(params: {
  description: string;
  codeTemplate: string;
  filePattern: string;
  actionType: string;
  taskId?: string;
  agentId: string;
}): Promise<KnowledgeEntry> {
  const content = `${params.description}\n\n\`\`\`typescript\n${params.codeTemplate}\n\`\`\``;

  // Similar duplicate detection + merge logic
  const existing = query<KnowledgeEntry>(
    "SELECT * FROM knowledge_entries WHERE type = ?",
    ["pattern"],
  );

  const duplicate = findSimilar(content, existing);
  if (duplicate) return mergeEntry(duplicate, params);

  // Create new pattern entry (similar structure to gotcha)
  // ...
}

/**
 * Write a decision to the knowledge base
 */
export async function writeDecision(params: {
  decision: string;
  context: string;
  taskId: string;
  agentId: string;
}): Promise<KnowledgeEntry> {
  // Decisions are always new (no deduplication)
  // ...
}

/**
 * Find similar entries using Jaccard similarity
 */
function findSimilar(
  content: string,
  entries: KnowledgeEntry[],
): KnowledgeEntry | null {
  for (const entry of entries) {
    const similarity = calculateJaccardSimilarity(content, entry.content);
    if (similarity > 0.8) return entry;
  }
  return null;
}

/**
 * Merge duplicate entry (increment occurrence, boost confidence)
 */
function mergeEntry(existing: KnowledgeEntry, newData: any): KnowledgeEntry {
  const newOccurrences = existing.occurrences + 1;
  const newConfidence = Math.min(0.95, existing.confidence + 0.05);

  run(
    `
    UPDATE knowledge_entries
    SET occurrences = ?, confidence = ?, updated_at = datetime('now')
    WHERE id = ?
  `,
    [newOccurrences, newConfidence, existing.id],
  );

  return {
    ...existing,
    occurrences: newOccurrences,
    confidence: newConfidence,
  };
}

/**
 * Calculate initial confidence based on source and context
 */
function calculateInitialConfidence(type: string, params: any): number {
  let confidence = 0.5; // Base

  // Boost for QA agent (more reliable than build agent)
  if (params.agentId === "qa_agent") confidence += 0.1;

  // Boost for patterns (more structured than gotchas)
  if (type === "pattern") confidence += 0.05;

  // Boost if fix was applied (not just theoretical)
  if (params.fixApplied) confidence += 0.1;

  return Math.min(0.95, confidence);
}

/**
 * Jaccard similarity: intersection / union of word sets
 */
function calculateJaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}
```

#### 2. Error Recovery Tracker (`parent-harness/orchestrator/src/knowledge/error-recovery.ts`)

```typescript
import { query, run } from "../db/index.js";
import { v4 as uuid } from "uuid";

export interface RecoveryStrategy {
  id: string;
  error_pattern: string;
  error_type: string;
  recovery_technique: string;
  steps: string[];
  success_count: number;
  failure_count: number;
  effectiveness: number;
  context: { agent_type?: string; task_category?: string; file_type?: string };
}

/**
 * Record a successful error recovery
 */
export function recordRecoverySuccess(params: {
  errorMessage: string;
  errorType: string;
  technique: string;
  steps: string[];
  agentId: string;
  taskId?: string;
  sessionId?: string;
}): void {
  const strategy = findOrCreateStrategy(params);

  run(
    `
    UPDATE error_recovery_strategies
    SET success_count = success_count + 1, updated_at = datetime('now')
    WHERE id = ?
  `,
    [strategy.id],
  );

  // Record attempt
  run(
    `
    INSERT INTO strategy_attempts (id, strategy_id, task_id, session_id, agent_id, error_message, outcome)
    VALUES (?, ?, ?, ?, ?, ?, 'success')
  `,
    [
      uuid(),
      strategy.id,
      params.taskId,
      params.sessionId,
      params.agentId,
      params.errorMessage,
    ],
  );
}

/**
 * Record a failed error recovery attempt
 */
export function recordRecoveryFailure(params: {
  errorMessage: string;
  errorType: string;
  technique: string;
  agentId: string;
  taskId?: string;
  notes?: string;
}): void {
  const strategy = findOrCreateStrategy(params);

  run(
    `
    UPDATE error_recovery_strategies
    SET failure_count = failure_count + 1, updated_at = datetime('now')
    WHERE id = ?
  `,
    [strategy.id],
  );

  // Record attempt with notes
  run(
    `
    INSERT INTO strategy_attempts (id, strategy_id, task_id, agent_id, error_message, outcome, notes)
    VALUES (?, ?, ?, ?, ?, 'failure', ?)
  `,
    [
      uuid(),
      strategy.id,
      params.taskId,
      params.agentId,
      params.errorMessage,
      params.notes,
    ],
  );
}

/**
 * Get recommended strategy for an error
 */
export function getRecommendedStrategy(
  errorMessage: string,
  errorType: string,
): RecoveryStrategy | null {
  // Find strategies matching error pattern
  const strategies = query<RecoveryStrategy>(
    `
    SELECT * FROM error_recovery_strategies
    WHERE error_type = ? AND effectiveness > 0.5
    ORDER BY effectiveness DESC, success_count DESC
    LIMIT 1
  `,
    [errorType],
  );

  return strategies.length > 0 ? strategies[0] : null;
}

/**
 * Find existing strategy or create new one
 */
function findOrCreateStrategy(params: any): RecoveryStrategy {
  // Extract error pattern (first 50 chars of error message)
  const errorPattern = params.errorMessage.substring(0, 50);

  // Check if strategy exists
  const existing = getOne<RecoveryStrategy>(
    `
    SELECT * FROM error_recovery_strategies
    WHERE error_pattern = ? AND recovery_technique = ?
  `,
    [errorPattern, params.technique],
  );

  if (existing) return existing;

  // Create new strategy
  const id = uuid();
  run(
    `
    INSERT INTO error_recovery_strategies
    (id, error_pattern, error_type, recovery_technique, steps, context)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      errorPattern,
      params.errorType,
      params.technique,
      JSON.stringify(params.steps || []),
      JSON.stringify({ agent_type: params.agentId }),
    ],
  );

  return getOne<RecoveryStrategy>(
    "SELECT * FROM error_recovery_strategies WHERE id = ?",
    [id],
  )!;
}
```

#### 3. Task Signature Matcher (`parent-harness/orchestrator/src/knowledge/task-matcher.ts`)

```typescript
import crypto from "crypto";
import { query, run } from "../db/index.js";

export interface TaskSignature {
  id: string;
  task_id: string;
  signature_hash: string;
  title_normalized: string;
  category: string;
  file_patterns: string[];
  dependency_count: number;
}

/**
 * Generate task signature for similarity matching
 */
export function generateTaskSignature(task: {
  id: string;
  title: string;
  category: string;
  file_patterns?: string[];
  dependencies?: string[];
}): TaskSignature {
  const titleNorm = task.title.toLowerCase().trim();
  const filePatterns = task.file_patterns || [];
  const depCount = task.dependencies?.length || 0;

  // Hash combines title + category + file patterns
  const hashInput = `${titleNorm}|${task.category}|${filePatterns.join(",")}`;
  const signatureHash = crypto
    .createHash("sha256")
    .update(hashInput)
    .digest("hex");

  const signature: TaskSignature = {
    id: crypto.randomUUID(),
    task_id: task.id,
    signature_hash: signatureHash,
    title_normalized: titleNorm,
    category: task.category,
    file_patterns: filePatterns,
    dependency_count: depCount,
  };

  run(
    `
    INSERT OR REPLACE INTO task_signatures
    (id, task_id, signature_hash, title_normalized, category, file_patterns, dependency_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [
      signature.id,
      signature.task_id,
      signature.signature_hash,
      signature.title_normalized,
      signature.category,
      JSON.stringify(signature.file_patterns),
      signature.dependency_count,
    ],
  );

  return signature;
}

/**
 * Find similar tasks based on signature
 */
export function findSimilarTasks(
  taskId: string,
  limit: number = 5,
): TaskSignature[] {
  const current = query<TaskSignature>(
    "SELECT * FROM task_signatures WHERE task_id = ?",
    [taskId],
  )[0];

  if (!current) return [];

  // Find exact hash matches first
  const exactMatches = query<TaskSignature>(
    `
    SELECT * FROM task_signatures
    WHERE signature_hash = ? AND task_id != ?
    LIMIT ?
  `,
    [current.signature_hash, taskId, limit],
  );

  if (exactMatches.length >= limit) return exactMatches;

  // Find category + file pattern overlaps
  const similar = query<TaskSignature>(
    `
    SELECT * FROM task_signatures
    WHERE category = ? AND task_id != ?
    ORDER BY dependency_count DESC
    LIMIT ?
  `,
    [current.category, taskId, limit - exactMatches.length],
  );

  return [...exactMatches, ...similar];
}

/**
 * Get knowledge entries relevant to a task signature
 */
export function getRelevantKnowledge(
  taskId: string,
  minConfidence: number = 0.5,
): any[] {
  const signature = query<TaskSignature>(
    "SELECT * FROM task_signatures WHERE task_id = ?",
    [taskId],
  )[0];

  if (!signature) return [];

  // Find knowledge entries matching file patterns
  return query(
    `
    SELECT k.* FROM knowledge_entries k
    WHERE k.confidence >= ?
      AND (
        json_extract(k.file_patterns, '$') LIKE '%' || ? || '%'
        OR k.tags LIKE '%' || ? || '%'
      )
    ORDER BY k.confidence DESC, k.occurrences DESC
    LIMIT 10
  `,
    [minConfidence, signature.category, signature.category],
  );
}
```

#### 4. Knowledge API (`parent-harness/orchestrator/src/api/knowledge.ts`)

```typescript
import { Router } from "express";
import { query, run } from "../db/index.js";
import {
  writeGotcha,
  writePattern,
  writeDecision,
} from "../knowledge/writer.js";
import { getRecommendedStrategy } from "../knowledge/error-recovery.js";
import { getRelevantKnowledge } from "../knowledge/task-matcher.js";

export const knowledgeRouter = Router();

/**
 * POST /api/knowledge/gotcha - Record a gotcha
 */
knowledgeRouter.post("/gotcha", async (req, res) => {
  const { fix, filePattern, actionType, taskId, agentId } = req.body;

  const entry = await writeGotcha({
    fix,
    filePattern,
    actionType,
    taskId,
    agentId,
  });

  res.json(entry);
});

/**
 * POST /api/knowledge/pattern - Record a pattern
 */
knowledgeRouter.post("/pattern", async (req, res) => {
  const {
    description,
    codeTemplate,
    filePattern,
    actionType,
    taskId,
    agentId,
  } = req.body;

  const entry = await writePattern({
    description,
    codeTemplate,
    filePattern,
    actionType,
    taskId,
    agentId,
  });

  res.json(entry);
});

/**
 * GET /api/knowledge/relevant/:taskId - Get knowledge for task
 */
knowledgeRouter.get("/relevant/:taskId", (req, res) => {
  const { taskId } = req.params;
  const minConfidence = parseFloat(req.query.minConfidence as string) || 0.5;

  const knowledge = getRelevantKnowledge(taskId, minConfidence);
  res.json({ entries: knowledge, count: knowledge.length });
});

/**
 * GET /api/knowledge/strategy/:errorType - Get recovery strategy
 */
knowledgeRouter.get("/strategy/:errorType", (req, res) => {
  const { errorType } = req.params;
  const errorMessage = (req.query.message as string) || "";

  const strategy = getRecommendedStrategy(errorMessage, errorType);
  res.json(strategy || { message: "No known strategy for this error" });
});

/**
 * GET /api/knowledge/stats - Get knowledge base statistics
 */
knowledgeRouter.get("/stats", (req, res) => {
  const stats = {
    total_entries: query("SELECT COUNT(*) as count FROM knowledge_entries")[0]
      .count,
    by_type: query(`
      SELECT type, COUNT(*) as count
      FROM knowledge_entries
      GROUP BY type
    `),
    high_confidence: query(`
      SELECT COUNT(*) as count
      FROM knowledge_entries
      WHERE confidence >= 0.8
    `)[0].count,
    promotion_candidates: query(`
      SELECT COUNT(*) as count
      FROM knowledge_entries
      WHERE confidence >= 0.8 AND occurrences >= 3
    `)[0].count,
  };

  res.json(stats);
});
```

### Integration Points

#### 1. Agent Spawner Integration

When spawning agents, inject relevant knowledge:

```typescript
// In parent-harness/orchestrator/src/spawner/index.ts
import { getRelevantKnowledge } from "../knowledge/task-matcher.js";

export async function spawnAgent(
  taskId: string,
  agentType: string,
): Promise<void> {
  // Get relevant knowledge for task
  const knowledge = getRelevantKnowledge(taskId, 0.7);

  // Inject into agent context
  const context = {
    task_id: taskId,
    relevant_gotchas: knowledge.filter((k) => k.type === "gotcha"),
    relevant_patterns: knowledge.filter((k) => k.type === "pattern"),
  };

  // Spawn with enriched context
  await spawn({ agentType, taskId, context });
}
```

#### 2. QA Agent Integration

After task completion, extract learnings:

```typescript
// In parent-harness/orchestrator/src/qa/index.ts
import { writeGotcha, writePattern } from "../knowledge/writer.js";

export async function validateTaskCompletion(
  taskId: string,
  sessionId: string,
): Promise<void> {
  // Get session logs
  const logs = await getSessionLogs(sessionId);

  // Extract patterns from successful execution
  const patterns = extractPatternsFromLogs(logs);

  for (const pattern of patterns) {
    await writePattern({
      description: pattern.description,
      codeTemplate: pattern.code,
      filePattern: pattern.filePattern,
      actionType: "CREATE",
      taskId,
      agentId: "qa_agent",
    });
  }

  // Extract gotchas from error recovery
  const gotchas = extractGotchasFromErrors(logs);

  for (const gotcha of gotchas) {
    await writeGotcha({
      fix: gotcha.fix,
      filePattern: gotcha.filePattern,
      actionType: gotcha.actionType,
      taskId,
      agentId: "qa_agent",
    });
  }
}
```

#### 3. Error Handler Integration

When errors occur, suggest recovery strategies:

```typescript
// In parent-harness/orchestrator/src/events/stuck-agent-handler.ts
import {
  getRecommendedStrategy,
  recordRecoverySuccess,
  recordRecoveryFailure,
} from "../knowledge/error-recovery.js";

export async function handleStuckAgent(
  sessionId: string,
  error: any,
): Promise<void> {
  const errorType = error.constructor.name;
  const strategy = getRecommendedStrategy(error.message, errorType);

  if (strategy) {
    console.log(
      `[StuckAgent] Attempting known recovery: ${strategy.recovery_technique}`,
    );
    console.log(
      `[StuckAgent] Effectiveness: ${(strategy.effectiveness * 100).toFixed(1)}%`,
    );

    try {
      await applyRecoveryStrategy(sessionId, strategy);
      recordRecoverySuccess({
        errorMessage: error.message,
        errorType,
        technique: strategy.recovery_technique,
        steps: strategy.steps,
        agentId: "system",
        sessionId,
      });
    } catch (recoveryError) {
      recordRecoveryFailure({
        errorMessage: error.message,
        errorType,
        technique: strategy.recovery_technique,
        agentId: "system",
        notes: recoveryError.message,
      });
    }
  } else {
    console.log(`[StuckAgent] No known recovery strategy for ${errorType}`);
  }
}
```

---

## Pass Criteria

### Database Schema

1. ✅ **Tables created** - knowledge_entries, error_recovery_strategies, strategy_attempts, task_signatures, knowledge_reuse, knowledge_promotions
2. ✅ **Indexes created** - All performance-critical indexes present
3. ✅ **Constraints valid** - CHECK constraints, foreign keys, unique constraints
4. ✅ **Migration tested** - Schema applies cleanly to existing database

### Core Functionality

5. ✅ **Knowledge writing works** - writeGotcha, writePattern, writeDecision create entries
6. ✅ **Duplicate detection works** - Similar entries merged, not duplicated
7. ✅ **Confidence tracking works** - Initial calculation, boosts, decays
8. ✅ **Error recovery tracking works** - Success/failure recorded, effectiveness calculated
9. ✅ **Task signature matching works** - Similar tasks found, relevant knowledge retrieved
10. ✅ **Cross-agent sharing works** - All agents can access all knowledge

### API Endpoints

11. ✅ **POST /api/knowledge/gotcha** - Returns created entry with ID
12. ✅ **POST /api/knowledge/pattern** - Returns created entry
13. ✅ **GET /api/knowledge/relevant/:taskId** - Returns 5+ entries when matches exist
14. ✅ **GET /api/knowledge/strategy/:errorType** - Returns strategy or null
15. ✅ **GET /api/knowledge/stats** - Returns counts by type, confidence

### Integration

16. ✅ **Spawner integration** - Agents receive relevant knowledge on spawn
17. ✅ **QA integration** - Patterns extracted from successful tasks
18. ✅ **Error handler integration** - Recovery strategies suggested for known errors
19. ✅ **Memory bridge** - Agent memory promotes to knowledge base

### Performance

20. ✅ **Query performance** - Knowledge queries complete in <100ms (100 entries)
21. ✅ **Similarity matching** - Task signature lookup completes in <500ms
22. ✅ **No blocking writes** - Knowledge writes don't delay agent execution

### Testing

23. ✅ **Unit tests pass** - All modules tested in isolation
24. ✅ **Integration test** - Complete flow: error → recovery → knowledge → reuse
25. ✅ **Load test** - System handles 1000+ knowledge entries

---

## Dependencies

**Upstream (Must Complete First):**

- ✅ PHASE2-TASK-01: Database schema foundation
- ✅ PHASE3-TASK-01: Task queue persistence
- ✅ Agent memory system (EXISTS: `parent-harness/orchestrator/src/memory/index.ts`)

**Downstream (Depends on This):**

- PHASE4-TASK-02: Planning Agent (uses knowledge base for improvement suggestions)
- PHASE6-TASK-01: Self-improvement loop (promotes validated knowledge to CLAUDE.md)

**Parallel Work (Can Develop Concurrently):**

- PHASE4-TASK-03: Technique effectiveness dashboard
- PHASE5-TASK-02: Pattern recognition ML model

---

## Implementation Plan

### Phase 1: Database Schema & Migrations (3 hours)

1. Create migration file: `002_knowledge_base.sql`
2. Define all 6 tables with indexes
3. Write rollback script
4. Test migration on dev database
5. Seed with sample entries for testing

### Phase 2: Knowledge Writer Module (4 hours)

6. Implement `writer.ts`: writeGotcha, writePattern, writeDecision
7. Implement duplicate detection with Jaccard similarity
8. Implement confidence calculation logic
9. Add merge logic for duplicates
10. Unit test all functions

### Phase 3: Error Recovery Tracker (3 hours)

11. Implement `error-recovery.ts`: recordSuccess, recordFailure
12. Implement getRecommendedStrategy with effectiveness ranking
13. Add findOrCreateStrategy logic
14. Test with realistic error scenarios

### Phase 4: Task Signature Matcher (3 hours)

15. Implement `task-matcher.ts`: generateTaskSignature
16. Implement findSimilarTasks with hash + category matching
17. Implement getRelevantKnowledge with file pattern matching
18. Test similarity matching accuracy

### Phase 5: Knowledge API (2 hours)

19. Create `api/knowledge.ts` router
20. Implement POST /gotcha, /pattern, /decision
21. Implement GET /relevant/:taskId, /strategy/:errorType, /stats
22. Add input validation and error handling

### Phase 6: Integration (4 hours)

23. Integrate with spawner (inject relevant knowledge)
24. Integrate with QA agent (extract patterns post-completion)
25. Integrate with error handler (suggest recovery strategies)
26. Bridge agent_memory with knowledge_entries

### Phase 7: Testing & Documentation (3 hours)

27. Write unit tests for all modules
28. Write integration test: error → recovery → knowledge → reuse
29. Load test with 1000+ entries
30. Document API endpoints in README

**Total Estimated Effort:** 22 hours (~3 days)

---

## Testing Strategy

### Unit Tests

```typescript
// knowledge/writer.test.ts
describe('Knowledge Writer', () => {
  test('writeGotcha creates new entry', async () => {
    const entry = await writeGotcha({
      fix: 'Use TEXT for dates in SQLite',
      filePattern: '*.sql',
      actionType: 'CREATE',
      agentId: 'build_agent',
    });

    expect(entry.id).toBeDefined();
    expect(entry.type).toBe('gotcha');
    expect(entry.confidence).toBeGreaterThan(0.4);
  });

  test('duplicate gotchas are merged', async () => {
    const entry1 = await writeGotcha({ fix: 'Use TEXT for dates', ... });
    const entry2 = await writeGotcha({ fix: 'Use TEXT datatype for dates', ... });

    expect(entry2.id).toBe(entry1.id);
    expect(entry2.occurrences).toBe(2);
    expect(entry2.confidence).toBeGreaterThan(entry1.confidence);
  });
});

// knowledge/error-recovery.test.ts
describe('Error Recovery Tracker', () => {
  test('records successful recovery', () => {
    recordRecoverySuccess({
      errorMessage: 'TypeError: Cannot read property',
      errorType: 'TypeError',
      technique: 'Add null check before access',
      steps: ['Check if object exists', 'Use optional chaining'],
      agentId: 'build_agent',
    });

    const strategy = getRecommendedStrategy('TypeError: Cannot read property', 'TypeError');
    expect(strategy).toBeDefined();
    expect(strategy?.success_count).toBe(1);
  });

  test('effectiveness calculation works', () => {
    recordRecoverySuccess({ ... }); // 1 success
    recordRecoverySuccess({ ... }); // 2 successes
    recordRecoveryFailure({ ... }); // 1 failure

    const strategy = getRecommendedStrategy(...);
    expect(strategy?.effectiveness).toBeCloseTo(0.666, 2); // 2/3
  });
});
```

### Integration Tests

```typescript
// integration/knowledge-flow.test.ts
describe("Knowledge Base Integration", () => {
  test("complete flow: error → recovery → knowledge → reuse", async () => {
    // 1. Task encounters error
    const error = new TypeError('Cannot read property "x" of undefined');

    // 2. Recovery attempted and succeeds
    recordRecoverySuccess({
      errorMessage: error.message,
      errorType: "TypeError",
      technique: "Add null check",
      steps: ["if (obj) { ... }"],
      agentId: "build_agent",
      taskId: "task-1",
    });

    // 3. Knowledge entry created
    const gotcha = await writeGotcha({
      fix: "Always check for null before accessing nested properties",
      filePattern: "*.ts",
      actionType: "UPDATE",
      taskId: "task-1",
      agentId: "build_agent",
    });

    expect(gotcha.confidence).toBeGreaterThan(0.5);

    // 4. Later task spawns and retrieves knowledge
    const knowledge = getRelevantKnowledge("task-2", 0.5);
    expect(knowledge).toContainEqual(
      expect.objectContaining({ id: gotcha.id }),
    );

    // 5. Strategy recommended for similar error
    const strategy = getRecommendedStrategy(error.message, "TypeError");
    expect(strategy?.recovery_technique).toBe("Add null check");
  });
});
```

### Manual Testing

1. **Knowledge Creation Flow:**
   - Spawn build agent with task
   - Trigger error in execution
   - Verify error recovery strategy logged
   - Complete task successfully
   - Verify pattern extracted and stored

2. **Knowledge Retrieval Flow:**
   - Create task similar to previous one
   - Spawn agent
   - Verify relevant knowledge injected into context
   - Check agent logs for "Found 3 relevant patterns" message

3. **Promotion Flow:**
   - Run 5 tasks that use same pattern
   - Query promotion candidates: `GET /api/knowledge/stats`
   - Verify pattern has confidence ≥ 0.8 and occurrences ≥ 3
   - Approve promotion
   - Verify CLAUDE.md updated

---

## Success Metrics

**Operational:**

- Knowledge base contains 50+ entries after 1 week
- 80%+ of duplicate entries correctly merged
- Error recovery strategies have 60%+ average effectiveness
- Task signature matching finds similar tasks in <500ms

**Agent Performance:**

- Agents reuse knowledge 30%+ of the time when available
- Time to fix known errors reduces by 50% (knowledge vs. no knowledge)
- Agent failure rate decreases by 20% after 100+ knowledge entries

**Quality:**

- 90%+ of promoted knowledge validated as useful by human review
- Confidence scores correlate with actual success (Pearson r > 0.7)
- No duplicate entries with >0.8 similarity

---

## Rollback Plan

If knowledge base causes performance issues:

1. **Disable knowledge injection:**
   - Set config flag: `ENABLE_KNOWLEDGE_INJECTION=false`
   - Agents spawn without knowledge context
   - System continues working without learning

2. **Revert database migration:**
   - Run rollback script: `002_knowledge_base_rollback.sql`
   - Drops all 6 knowledge tables
   - Agent memory system remains intact

3. **Remove API routes:**
   - Comment out knowledge router in `server.ts`
   - Dashboard remains functional

---

## Future Enhancements (Out of Scope)

1. **Semantic search** - Use embeddings for similarity matching (not just Jaccard)
2. **Knowledge graphs** - Visualize connections between patterns, gotchas, tasks
3. **Collaborative filtering** - "Agents who used X also used Y"
4. **Auto-categorization** - ML model to tag entries automatically
5. **Knowledge pruning** - Automatic archival of low-confidence, unused entries
6. **Cross-project sharing** - Share knowledge across multiple Vibe instances

---

## References

- `agents/sia/knowledge-writer.ts`: Existing knowledge writer for Idea Incubator
- `parent-harness/orchestrator/src/memory/index.ts`: Current agent memory system
- `server/routes/knowledge.ts`: Knowledge API for Idea Incubator
- STRATEGIC_PLAN.md: Phase 4 memory & learning requirements
- PHASE4-TASK-02: Planning Agent (downstream consumer)
