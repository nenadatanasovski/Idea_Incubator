# Agent Memory System Implementation Plan

> **Based on:** CRITICAL_GAPS.md Gap #3
> **Status:** Planning (Phase 0 implemented)
> **Priority:** P2 (Needed for Self-Improvement)
> **Last Updated:** 2026-02-07

---

## Overview

The Agent Memory System enables agents to learn from experience, avoid repeating mistakes, and improve their effectiveness over time. This specification defines how the parent-harness implements persistent agent memory using patterns from the Vibe platform.

---

## Current State (Phase 0 - Already Implemented)

The harness already has a basic memory implementation that serves as the foundation for this plan.

### Existing `agent_memory` Table

**Location:** `parent-harness/orchestrator/src/memory/index.ts`
**API:** `parent-harness/orchestrator/src/api/memory.ts` (REST endpoints at `/api/memory/`)

```sql
-- Created dynamically via ensureMemoryTable() on module load
CREATE TABLE IF NOT EXISTS agent_memory (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    type TEXT NOT NULL,          -- context | learning | preference | error_pattern | success_pattern
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    metadata TEXT,               -- JSON
    importance INTEGER DEFAULT 5, -- 1-10 scale
    access_count INTEGER DEFAULT 0,
    last_accessed TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,              -- TTL support
    UNIQUE(agent_id, type, key)
);
```

**Existing API functions:**
- `remember(agentId, type, key, value, options?)` - Store a memory
- `recall(agentId, type, key)` - Retrieve specific memory (auto-increments access_count)
- `recallAll(agentId, type?)` - Get all memories, sorted by importance + access count
- `forget(agentId, type, key)` - Delete specific memory
- `forgetAll(agentId, type?)` - Bulk delete
- `cleanupExpired()` - Remove TTL-expired memories
- `setTaskContext(agentId, taskId, context)` - Short-term context (24h TTL)
- `learnSuccess(agentId, pattern, details)` - Record success pattern (importance: 7)
- `learnError(agentId, pattern, details)` - Record error pattern (importance: 8)
- `hasSeenError(agentId, pattern)` - Check for known error patterns

### Existing Self-Improvement/Retry System

**Location:** `parent-harness/orchestrator/src/self-improvement/index.ts`

The retry system creates a `task_retry_attempts` table and provides:
- Retry counting (max 5 retries per task)
- Error analysis with pattern matching (TypeScript, test, build, timeout errors)
- Fix approach generation based on error type + previous attempts
- `recordSuccess()` / `processFailedTasks()` lifecycle hooks

**Gap:** The retry system has a TODO to integrate with agent memory (`// TODO: Store successful approach in agent memory for future reference`). This is addressed in Phase 2 below.

### What Phase 0 Lacks (Addressed in This Plan)

| Capability | Phase 0 | This Plan |
|------------|---------|-----------|
| Memory types | 5 basic types | Extended with `decision`, `failure`, `success`, `pattern` |
| Task signature matching | None | Hash-based similar task matching |
| Cross-agent learning | Per-agent only | `technique_effectiveness` table |
| Relevance decay | None (only TTL) | Continuous decay with access boost |
| Memory consolidation | None | Pattern extraction from clusters |
| SIA integration | None | Full integration with `sia_task_memory` |
| Success rate tracking | None | Per-memory effectiveness metrics |
| Memory access logging | None | `memory_access_log` audit trail |

---

## Design Decision: Harness-Specific Tables

**Decision:** Create parent-harness-specific memory tables rather than reusing Vibe tables directly.

**Rationale:**
1. **Isolation** - Harness operates independently from Vibe platform; harness DB is `parent-harness/data/harness.db`, Vibe DB is `database/ideas.db`
2. **Schema control** - Harness needs different memory granularity (agent-focused vs idea/session-focused)
3. **Simplicity** - Avoid complex cross-database queries between SQLite files
4. **Evolution** - Can evolve independently as harness matures
5. **Existing foundation** - Build on the existing `agent_memory` table rather than starting from scratch

**Integration approach:** Learn from Vibe patterns (SIA tables, memory graph), implement locally in harness DB, optionally sync insights back to Vibe later.

**Migration path:** Phase 1 extends the existing `agent_memory` table schema. Phase 2 adds new tables (`technique_effectiveness`, `memory_access_log`). No data migration needed since the existing table uses `CREATE TABLE IF NOT EXISTS`.

---

## Database Schema

### 1. agent_memories Table

**Purpose:** Per-agent long-term memory storage

```sql
CREATE TABLE IF NOT EXISTS agent_memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK(memory_type IN (
        'decision',    -- Architectural/design decisions made
        'failure',     -- What didn't work
        'success',     -- What worked well
        'preference',  -- Agent preferences for approaches
        'pattern'      -- Recognized patterns in tasks/errors
    )),
    content TEXT NOT NULL,

    -- Context for matching similar scenarios
    task_signature TEXT,           -- Hash of task characteristics
    error_pattern TEXT,             -- Regex or signature of error
    context_tags TEXT,              -- JSON array: ['typescript', 'api', 'database']

    -- Relevance tracking
    relevance_score REAL DEFAULT 1.0,    -- Decays over time
    access_count INTEGER DEFAULT 0,
    last_accessed TEXT,

    -- Effectiveness tracking
    times_applied INTEGER DEFAULT 0,
    times_successful INTEGER DEFAULT 0,
    success_rate REAL,                   -- Calculated: times_successful / times_applied

    -- Metadata
    session_id TEXT,                     -- Session where memory was created
    task_id TEXT,                        -- Task that generated this memory
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX idx_agent_memories_agent ON agent_memories(agent_id);
CREATE INDEX idx_agent_memories_type ON agent_memories(memory_type);
CREATE INDEX idx_agent_memories_signature ON agent_memories(task_signature);
CREATE INDEX idx_agent_memories_relevance ON agent_memories(relevance_score DESC);
CREATE INDEX idx_agent_memories_success_rate ON agent_memories(success_rate DESC);
```

**Example entries:**

```json
{
  "id": "mem_001",
  "agent_id": "build_agent",
  "memory_type": "failure",
  "content": "Using regex in SQLite WHERE clauses fails. Use GLOB or LIKE instead.",
  "error_pattern": ".*near \"REGEXP\".*",
  "context_tags": ["database", "sqlite", "query"],
  "relevance_score": 0.95,
  "success_rate": 1.0,
  "times_applied": 3
}
```

```json
{
  "id": "mem_002",
  "agent_id": "build_agent",
  "memory_type": "success",
  "content": "For TypeScript migration tasks, always update tsconfig.json first, then fix files one directory at a time.",
  "task_signature": "typescript_migration_*",
  "context_tags": ["typescript", "refactor", "migration"],
  "success_rate": 0.9,
  "times_applied": 10
}
```

---

### 2. technique_effectiveness Table

**Purpose:** Cross-agent learning - track which techniques work for which error patterns

```sql
CREATE TABLE IF NOT EXISTS technique_effectiveness (
    id TEXT PRIMARY KEY,
    technique TEXT NOT NULL,           -- decomposition, prompt_restructure, etc.
    error_pattern TEXT,                -- Regex or signature of error type
    error_category TEXT,               -- compile_error, test_failure, timeout, etc.

    -- Effectiveness metrics
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    total_attempts INTEGER DEFAULT 0,
    success_rate REAL,                 -- Calculated: success_count / total_attempts

    -- Context
    applies_to_agent_types TEXT,       -- JSON array: ['build', 'spec', 'qa']
    task_categories TEXT,              -- JSON array: ['feature', 'bug', 'refactor']

    -- Sample data for learning
    example_task_ids TEXT,             -- JSON array of task IDs where this worked
    example_failures TEXT,             -- JSON array of task IDs where this failed

    -- Metadata
    first_used TEXT DEFAULT (datetime('now')),
    last_used TEXT,
    last_success TEXT,
    last_failure TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_technique_eff_technique ON technique_effectiveness(technique);
CREATE INDEX idx_technique_eff_category ON technique_effectiveness(error_category);
CREATE INDEX idx_technique_eff_success_rate ON technique_effectiveness(success_rate DESC);
CREATE UNIQUE INDEX idx_technique_eff_unique ON technique_effectiveness(technique, error_pattern);
```

**Example entries:**

```json
{
  "id": "tech_001",
  "technique": "decomposition",
  "error_pattern": ".*Task too complex.*",
  "error_category": "complexity_error",
  "success_rate": 0.85,
  "total_attempts": 20,
  "applies_to_agent_types": ["build", "spec"],
  "task_categories": ["feature", "epic"]
}
```

```json
{
  "id": "tech_002",
  "technique": "fresh_start",
  "error_pattern": ".*Context limit exceeded.*",
  "error_category": "context_overflow",
  "success_rate": 0.95,
  "total_attempts": 12,
  "applies_to_agent_types": ["build", "research"]
}
```

---

### 3. memory_access_log Table (Optional)

**Purpose:** Track when memories are retrieved and applied (for debugging and metrics)

```sql
CREATE TABLE IF NOT EXISTS memory_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    session_id TEXT,
    task_id TEXT,

    access_type TEXT NOT NULL CHECK(access_type IN (
        'query',      -- Memory was queried/retrieved
        'applied',    -- Memory was actively used
        'updated',    -- Memory was modified based on new data
        'invalidated' -- Memory was marked as no longer valid
    )),

    was_helpful INTEGER,               -- Boolean: Did this memory help?
    outcome TEXT,                      -- What happened after applying

    timestamp TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (memory_id) REFERENCES agent_memories(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_memory_access_agent ON memory_access_log(agent_id);
CREATE INDEX idx_memory_access_memory ON memory_access_log(memory_id);
CREATE INDEX idx_memory_access_timestamp ON memory_access_log(timestamp);
```

---

## Integration with Existing Tables

### Leverage Vibe's SIA Tables

The parent-harness already has these SIA-related tables from Vibe:

#### sia_task_memory
```sql
-- From database/migrations/132_sia_intervention_tables.sql
CREATE TABLE sia_task_memory (
    task_id TEXT PRIMARY KEY,
    task_signature TEXT,
    attempts TEXT NOT NULL,         -- JSON: [{technique, result, timestamp}]
    techniques_tried TEXT,          -- JSON: array of technique names
    successful_technique TEXT,
    total_interventions INTEGER DEFAULT 0
);
```

**Usage:** Track per-task SIA intervention history to avoid repeating failed techniques.

#### sia_attempts
```sql
CREATE TABLE sia_attempts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    technique TEXT NOT NULL,
    result_type TEXT NOT NULL,      -- 'fixed', 'decomposed', 'escalate'
    details TEXT,
    analysis TEXT,
    original_error TEXT,
    attempts_before INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
```

**Usage:** Log every SIA intervention attempt for effectiveness analysis.

#### Views for Metrics
```sql
-- Already exists in 132_sia_intervention_tables.sql
CREATE VIEW v_sia_metrics AS
SELECT
    technique,
    COUNT(*) as total_attempts,
    SUM(CASE WHEN result_type = 'fixed' THEN 1 ELSE 0 END) as fixed_count,
    ROUND(100.0 * SUM(CASE WHEN result_type IN ('fixed', 'decomposed') THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM sia_attempts
GROUP BY technique;
```

**Integration strategy:**
- Use `sia_task_memory` and `sia_attempts` for SIA-specific interventions
- Use `agent_memories` for broader agent learning (not just SIA)
- Use `technique_effectiveness` for cross-agent pattern learning

---

## Memory Lifecycle

### 1. Memory Creation

**When:**
- Task completes successfully → Create 'success' memory
- Task fails after retries → Create 'failure' memory
- Agent makes architectural decision → Create 'decision' memory
- SIA intervenes → Create entry in sia_attempts + update sia_task_memory

**How:**
```typescript
async function createMemory(params: {
  agentId: string;
  memoryType: MemoryType;
  content: string;
  taskSignature?: string;
  errorPattern?: string;
  contextTags?: string[];
  sessionId?: string;
  taskId?: string;
}): Promise<string> {
  const memoryId = generateId('mem');

  await db.run(`
    INSERT INTO agent_memories (
      id, agent_id, memory_type, content,
      task_signature, error_pattern, context_tags,
      session_id, task_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    memoryId, params.agentId, params.memoryType, params.content,
    params.taskSignature, params.errorPattern,
    JSON.stringify(params.contextTags || []),
    params.sessionId, params.taskId
  ]);

  return memoryId;
}
```

---

### 2. Memory Retrieval

**When:**
- Agent starts new task → Query relevant memories
- Agent encounters error → Query failure memories matching error pattern
- SIA analyzes failure → Query sia_task_memory and sia_attempts

**How:**
```typescript
async function queryMemories(params: {
  agentId: string;
  taskSignature?: string;
  errorPattern?: string;
  contextTags?: string[];
  memoryTypes?: MemoryType[];
  limit?: number;
}): Promise<AgentMemory[]> {
  // 1. Start with relevance-based filtering
  let query = `
    SELECT * FROM agent_memories
    WHERE agent_id = ?
    AND relevance_score > 0.3
  `;
  const queryParams: any[] = [params.agentId];

  // 2. Filter by memory type
  if (params.memoryTypes?.length) {
    query += ` AND memory_type IN (${params.memoryTypes.map(() => '?').join(',')})`;
    queryParams.push(...params.memoryTypes);
  }

  // 3. Match task signature (exact or prefix match)
  if (params.taskSignature) {
    query += ` AND (task_signature = ? OR task_signature LIKE ?)`;
    queryParams.push(params.taskSignature, `${params.taskSignature}%`);
  }

  // 4. Match error pattern (if error-related query)
  if (params.errorPattern) {
    query += ` AND error_pattern IS NOT NULL`;
    // Filter in application code using regex
  }

  // 5. Sort by relevance and success rate
  query += ` ORDER BY relevance_score * success_rate DESC`;
  query += ` LIMIT ${params.limit || 10}`;

  const memories = await db.all(query, queryParams);

  // 6. Update access tracking
  for (const memory of memories) {
    await updateMemoryAccess(memory.id, params.agentId);
  }

  return memories;
}
```

---

### 3. Memory Application

**When:**
- Agent retrieves memories → Inject into system prompt or task context
- Memory suggests alternative approach → Agent uses it

**How:**
```typescript
async function applyMemory(
  memoryId: string,
  agentId: string,
  sessionId: string,
  wasHelpful: boolean,
  outcome: string
): Promise<void> {
  // Log the application
  await db.run(`
    INSERT INTO memory_access_log (
      memory_id, agent_id, session_id,
      access_type, was_helpful, outcome
    ) VALUES (?, ?, ?, 'applied', ?, ?)
  `, [memoryId, agentId, sessionId, wasHelpful ? 1 : 0, outcome]);

  // Update memory statistics
  await db.run(`
    UPDATE agent_memories
    SET
      times_applied = times_applied + 1,
      times_successful = times_successful + ?,
      success_rate = CAST(times_successful AS REAL) / times_applied,
      last_accessed = datetime('now')
    WHERE id = ?
  `, [wasHelpful ? 1 : 0, memoryId]);
}
```

---

### 4. Memory Decay

**Purpose:** Old, less-used memories become less relevant over time

**Implementation:**
```typescript
async function decayMemories(): Promise<void> {
  // Run periodically (e.g., daily cron job)

  const DECAY_FACTOR = 0.99;  // 1% decay per day
  const MIN_RELEVANCE = 0.1;

  await db.run(`
    UPDATE agent_memories
    SET
      relevance_score = MAX(?, relevance_score * ?),
      updated_at = datetime('now')
    WHERE relevance_score > ?
  `, [MIN_RELEVANCE, DECAY_FACTOR, MIN_RELEVANCE]);

  // Archive very old, unused memories
  await db.run(`
    UPDATE agent_memories
    SET relevance_score = 0.05
    WHERE
      relevance_score < 0.2
      AND julianday('now') - julianday(last_accessed) > 90  -- 90 days unused
  `);
}
```

**Boost on access:**
```typescript
async function updateMemoryAccess(memoryId: string, agentId: string): Promise<void> {
  const BOOST_FACTOR = 1.05;  // 5% boost on access

  await db.run(`
    UPDATE agent_memories
    SET
      access_count = access_count + 1,
      relevance_score = MIN(1.0, relevance_score * ?),
      last_accessed = datetime('now')
    WHERE id = ?
  `, [BOOST_FACTOR, memoryId]);
}
```

---

### 5. Memory Consolidation

**Purpose:** Merge similar memories, identify patterns

**When:** Run periodically (weekly) or when memory count exceeds threshold

```typescript
async function consolidateMemories(): Promise<void> {
  // 1. Find similar memories
  const memories = await db.all(`
    SELECT
      agent_id,
      memory_type,
      task_signature,
      COUNT(*) as count,
      GROUP_CONCAT(id) as memory_ids
    FROM agent_memories
    WHERE memory_type IN ('success', 'failure')
    GROUP BY agent_id, memory_type, task_signature
    HAVING count > 3
  `);

  // 2. For each cluster, create consolidated memory
  for (const cluster of memories) {
    const ids = cluster.memory_ids.split(',');
    const details = await db.all(`
      SELECT content, times_applied, times_successful
      FROM agent_memories
      WHERE id IN (${ids.map(() => '?').join(',')})
    `, ids);

    // 3. Create pattern memory
    const pattern = analyzePattern(details);
    await createMemory({
      agentId: cluster.agent_id,
      memoryType: 'pattern',
      content: pattern.description,
      taskSignature: cluster.task_signature,
      contextTags: pattern.tags
    });

    // 4. Reduce relevance of individual memories (but don't delete)
    await db.run(`
      UPDATE agent_memories
      SET relevance_score = relevance_score * 0.5
      WHERE id IN (${ids.map(() => '?').join(',')})
    `, ids);
  }
}
```

---

## Integration Points

### 1. Agent System Prompts

**Inject relevant memories into agent system prompts:**

```typescript
async function buildAgentPrompt(
  agentId: string,
  task: Task
): Promise<string> {
  const basePrompt = getBasePromptForAgent(agentId);

  // Query relevant memories
  const memories = await queryMemories({
    agentId,
    taskSignature: computeTaskSignature(task),
    contextTags: task.category ? [task.category] : [],
    memoryTypes: ['success', 'failure', 'preference', 'pattern'],
    limit: 5
  });

  if (memories.length === 0) {
    return basePrompt;
  }

  // Format memories section
  const memoriesSection = `

## Relevant Experience

Based on similar past tasks, keep these lessons in mind:

${memories.map((m, i) => `
${i + 1}. **${m.memory_type.toUpperCase()}** (success rate: ${(m.success_rate * 100).toFixed(0)}%)
   ${m.content}
`).join('\n')}

---
`;

  return basePrompt + memoriesSection;
}
```

---

### 2. SIA Intervention Flow

**Enhanced SIA with memory-aware technique selection:**

```typescript
async function selectSIATechnique(
  task: Task,
  error: string,
  attempts: number
): Promise<string> {
  // 1. Check sia_task_memory for this specific task
  const taskMemory = await db.get(`
    SELECT techniques_tried, successful_technique
    FROM sia_task_memory
    WHERE task_id = ?
  `, task.id);

  const triedTechniques = taskMemory ?
    JSON.parse(taskMemory.techniques_tried) : [];

  // 2. Query technique_effectiveness for error pattern
  const errorSignature = computeErrorSignature(error);
  const effectiveTechniques = await db.all(`
    SELECT technique, success_rate
    FROM technique_effectiveness
    WHERE error_pattern LIKE ?
    ORDER BY success_rate DESC
    LIMIT 3
  `, `%${errorSignature}%`);

  // 3. Select best untried technique
  for (const tech of effectiveTechniques) {
    if (!triedTechniques.includes(tech.technique)) {
      return tech.technique;
    }
  }

  // 4. Fallback to default technique ladder
  const defaultLadder = [
    'prompt_restructure',
    'decomposition',
    'fresh_start',
    'escalate'
  ];

  for (const tech of defaultLadder) {
    if (!triedTechniques.includes(tech)) {
      return tech;
    }
  }

  return 'escalate';  // All techniques tried
}
```

---

### 3. Post-Task Memory Creation

**After task completion, extract learnings:**

```typescript
async function onTaskComplete(
  task: Task,
  session: AgentSession,
  result: 'success' | 'failure'
): Promise<void> {
  const agent = await getAgent(session.agent_id);

  if (result === 'success') {
    // Extract success patterns
    const iterationLogs = await getIterationLogs(session.id);
    const patterns = analyzeSuccessPatterns(iterationLogs);

    for (const pattern of patterns) {
      await createMemory({
        agentId: agent.id,
        memoryType: 'success',
        content: pattern.description,
        taskSignature: computeTaskSignature(task),
        contextTags: extractTags(task),
        sessionId: session.id,
        taskId: task.id
      });
    }

  } else {
    // Extract failure patterns
    const lastError = await getLastError(session.id);

    await createMemory({
      agentId: agent.id,
      memoryType: 'failure',
      content: `Task failed: ${task.title}. Error: ${lastError}`,
      taskSignature: computeTaskSignature(task),
      errorPattern: computeErrorSignature(lastError),
      contextTags: extractTags(task),
      sessionId: session.id,
      taskId: task.id
    });
  }

  // Update technique effectiveness if SIA was involved
  const siaAttempts = await db.all(`
    SELECT technique, result_type
    FROM sia_attempts
    WHERE task_id = ?
  `, task.id);

  for (const attempt of siaAttempts) {
    await updateTechniqueEffectiveness(
      attempt.technique,
      computeErrorSignature(lastError),
      attempt.result_type === 'fixed'
    );
  }
}
```

---

## Utility Functions

### Task Signature Computation

```typescript
function computeTaskSignature(task: Task): string {
  // Create a signature for matching similar tasks
  const components = [
    task.category,
    task.owner,
    task.effort
  ];

  // Extract key terms from title
  const titleTerms = task.title
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 3)
    .slice(0, 3)
    .sort()
    .join('_');

  return `${components.join('_')}_${titleTerms}`;
}
```

### Error Pattern Computation

```typescript
function computeErrorSignature(error: string): string {
  // Normalize error for pattern matching
  return error
    .replace(/line \d+/gi, 'line N')          // Line numbers
    .replace(/\d+/g, 'N')                      // All numbers
    .replace(/['"`]/g, '')                     // Quotes
    .replace(/\s+/g, ' ')                      // Whitespace
    .substring(0, 200);                        // Limit length
}
```

### Context Tags Extraction

```typescript
function extractTags(task: Task): string[] {
  const tags: Set<string> = new Set();

  // Add category
  if (task.category) tags.add(task.category);

  // Extract from title/description
  const text = `${task.title} ${task.description}`.toLowerCase();

  const techKeywords = [
    'typescript', 'javascript', 'react', 'node',
    'database', 'sql', 'api', 'frontend', 'backend',
    'test', 'e2e', 'unit', 'integration',
    'migration', 'refactor', 'feature', 'bug'
  ];

  for (const keyword of techKeywords) {
    if (text.includes(keyword)) {
      tags.add(keyword);
    }
  }

  return Array.from(tags);
}
```

---

## Observability & Metrics

### Memory System Dashboard

**Track memory system health:**

```sql
-- Memory count by agent
SELECT
  agent_id,
  memory_type,
  COUNT(*) as count,
  AVG(relevance_score) as avg_relevance,
  AVG(success_rate) as avg_success_rate
FROM agent_memories
GROUP BY agent_id, memory_type;

-- Most effective memories
SELECT
  agent_id,
  memory_type,
  content,
  times_applied,
  success_rate,
  relevance_score
FROM agent_memories
WHERE times_applied >= 3
ORDER BY success_rate DESC, times_applied DESC
LIMIT 10;

-- Technique effectiveness summary
SELECT
  technique,
  total_attempts,
  success_rate,
  last_used
FROM technique_effectiveness
ORDER BY success_rate DESC;

-- Memory access patterns
SELECT
  DATE(timestamp) as date,
  access_type,
  COUNT(*) as count
FROM memory_access_log
WHERE timestamp > datetime('now', '-30 days')
GROUP BY date, access_type
ORDER BY date DESC;
```

---

## Migration Plan

### Phase 1: Core Tables (Priority: P1)

1. Create `agent_memories` table
2. Create `technique_effectiveness` table
3. Create indexes
4. Add migration to parent-harness/database/migrations/

**Estimated effort:** 1 day

### Phase 2: Basic Integration (Priority: P1)

1. Implement memory creation on task completion
2. Implement memory retrieval for agents
3. Add memory section to agent prompts
4. Wire up SIA with technique_effectiveness

**Estimated effort:** 2-3 days

### Phase 3: Advanced Features (Priority: P2)

1. Implement memory decay system
2. Add memory consolidation
3. Create `memory_access_log` for detailed tracking
4. Build dashboard views

**Estimated effort:** 2 days

### Phase 4: Optimization (Priority: P3)

1. Add memory caching layer
2. Implement similarity search (embeddings)
3. Add memory export/import for cross-harness learning
4. Build memory analytics

**Estimated effort:** 3-4 days

---

## Success Metrics

**Measure memory system effectiveness:**

1. **Repeat failure reduction** - Same error should happen less over time
2. **Technique success rate improvement** - Techniques become more effective
3. **Memory retrieval accuracy** - Retrieved memories are actually helpful
4. **Agent learning curve** - New agents learn faster by leveraging memory
5. **SIA intervention success** - Higher fix rate when using memory

**Target metrics (3 months post-deployment):**
- 30% reduction in repeated failures
- 70%+ memory application helpfulness rate
- 85%+ SIA intervention success rate (up from baseline)
- Memory retrieval latency < 100ms

---

## Future Enhancements

### 1. Semantic Search

Use embeddings for better memory matching:

```typescript
interface MemoryEmbedding {
  memory_id: string;
  embedding: Float32Array;  // 1536-dim vector
  model: string;            // 'text-embedding-ada-002'
}

async function semanticMemorySearch(
  query: string,
  agentId: string,
  limit: number = 5
): Promise<AgentMemory[]> {
  // 1. Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // 2. Compute cosine similarity with all memories
  const memories = await db.all(`
    SELECT * FROM agent_memories WHERE agent_id = ?
  `, agentId);

  const scored = memories.map(m => ({
    memory: m,
    similarity: cosineSimilarity(queryEmbedding, m.embedding)
  }));

  // 3. Return top matches
  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(s => s.memory);
}
```

### 2. Memory Sharing Across Harnesses

Enable learning across multiple harness instances:

```typescript
interface SharedMemory {
  harness_id: string;
  agent_type: string;
  memory: AgentMemory;
  upvotes: number;
  downvotes: number;
}

// Export high-value memories
async function exportMemoriesToSharedPool(): Promise<void> {
  const valuableMemories = await db.all(`
    SELECT * FROM agent_memories
    WHERE
      success_rate > 0.8
      AND times_applied > 5
      AND relevance_score > 0.7
  `);

  for (const memory of valuableMemories) {
    await sharedMemoryAPI.publish(memory);
  }
}

// Import memories from other harnesses
async function importMemoriesFromSharedPool(): Promise<void> {
  const sharedMemories = await sharedMemoryAPI.query({
    agentTypes: ['build', 'spec', 'qa'],
    minUpvotes: 3
  });

  for (const shared of sharedMemories) {
    await createMemory({
      ...shared.memory,
      content: `[SHARED] ${shared.memory.content}`,
      relevance_score: 0.6  // Start lower for imported memories
    });
  }
}
```

### 3. Memory Explanation Generation

Generate human-readable explanations of why certain memories are retrieved:

```typescript
async function explainMemorySelection(
  memories: AgentMemory[],
  task: Task
): Promise<string> {
  const explanations = memories.map(m =>
    `- Retrieved "${m.content.substring(0, 50)}..." because:
       • ${m.success_rate > 0.8 ? 'High success rate' : 'Relevant experience'}
       • Applied ${m.times_applied} times before
       • Matches task signature: ${m.task_signature}`
  );

  return `Retrieved ${memories.length} relevant memories:\n${explanations.join('\n')}`;
}
```

---

## Related Documentation

- [CRITICAL_GAPS.md](./CRITICAL_GAPS.md) - Gap #3: Agent Memory System
- [DATA_MODEL.md](./DATA_MODEL.md) - Database schema overview
- [AGENTS.md](./AGENTS.md) - Agent definitions and roles
- [SIA Integration Guide](../../docs/implementation-guide/05-SIA-INTEGRATION.md)
- [Vibe SIA Tables](../../database/migrations/132_sia_intervention_tables.sql)
- [Memory Graph](../../database/migrations/115_memory_graph_tables.sql)

---

## Appendix: Vibe Platform Comparison

### What Vibe Has That We're Adapting

| Vibe Feature | Harness Equivalent | Notes |
|--------------|-------------------|-------|
| `sia_task_memory` | Same table | Reuse as-is for SIA interventions |
| `sia_attempts` | Same table | Reuse as-is for tracking |
| `memory_blocks` | `agent_memories` | Simplified, harness-specific |
| `memory_links` | Not needed yet | Too complex for Phase 1 |
| `knowledge_entries` | `agent_memories` | Merged concept |
| `v_sia_metrics` | Same view | Reuse as-is |

### What We're Adding

1. **Per-agent memories** - Vibe's memory is session/idea-focused, ours is agent-focused
2. **Technique effectiveness** - Cross-agent learning not in Vibe
3. **Memory decay** - Relevance management over time
4. **Memory consolidation** - Pattern extraction from multiple memories

### Integration Path

**Now:** Standalone harness memory system
**Later:** Optionally sync high-value learnings back to Vibe's knowledge base
**Future:** Unified memory layer across Vibe + Harness
