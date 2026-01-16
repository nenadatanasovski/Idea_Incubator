# Self-Improvement Agent (SIA) Brief

## Metadata

| Field          | Value                  |
| -------------- | ---------------------- |
| **ID**         | sia                    |
| **Title**      | Self-Improvement Agent |
| **Complexity** | high                   |
| **Author**     | Human                  |
| **Created**    | 2026-01-11             |

---

## Problem

The agent system generates valuable learnings during execution that are currently lost:

1. Build Agent encounters errors and develops workarounds - knowledge not persisted
2. Spec Agent discovers missing requirements - not fed back to templates
3. Validation Agent finds common failure patterns - not shared with Build Agent
4. Each agent rediscovers the same gotchas repeatedly
5. CLAUDE.md becomes stale as patterns evolve
6. No systematic improvement across agent generations

We need an agent that learns from execution, extracts patterns, and improves the system.

---

## Solution

Self-Improvement Agent (SIA) is a learning system that:

1. **Analyzes executions** - Reviews Build Agent task completions and failures
2. **Extracts gotchas** - Identifies mistakes and their solutions
3. **Discovers patterns** - Finds reusable approaches across projects
4. **Updates Knowledge Base** - Persists learnings with confidence scores
5. **Propagates to CLAUDE.md** - Promotes high-confidence universal gotchas
6. **Improves templates** - Suggests Spec Agent template updates

SIA runs asynchronously after agent executions, never blocking the main workflow.

---

## MVP Scope

**In Scope:**

- Execution analyzer (parse Build Agent logs and results)
- Gotcha extractor (identify mistakes and fixes from failures)
- Pattern extractor (find reusable code approaches)
- Knowledge Base writer (persist gotchas and patterns)
- CLAUDE.md updater (promote universal learnings)
- Confidence scoring (track gotcha reliability)
- File pattern tagging (associate gotchas with file types)

**Out of Scope:**

- Real-time learning during execution
- Automated template modification (human approval required)
- Cross-project learning (single codebase only)
- Natural language explanation of learnings
- Automated gotcha validation testing
- Machine learning models (rule-based extraction only)

---

## Constraints

1. Must never modify production code directly
2. Must not block other agent execution
3. Must require human approval for CLAUDE.md changes
4. Must track provenance (which execution spawned which gotcha)
5. Must support confidence decay over time
6. Must not create duplicate gotchas

---

## Success Criteria

1. Successfully extracts gotchas from Build Agent failures
2. Stores gotchas in Knowledge Base with proper tagging
3. Gotchas appear in future Spec Agent task generation
4. High-confidence gotchas are suggested for CLAUDE.md
5. Confidence scores increase when gotchas prevent repeat failures
6. Duplicate detection prevents knowledge bloat
7. Human can review and approve/reject CLAUDE.md updates

---

## Architecture Hints

```
SIA Components:
├── execution-analyzer.ts   - Parse agent execution logs
├── gotcha-extractor.ts     - Extract mistakes and fixes
├── pattern-extractor.ts    - Find reusable approaches
├── knowledge-writer.ts     - Persist to Knowledge Base
├── claude-md-updater.ts    - Propose CLAUDE.md changes
├── confidence-tracker.ts   - Score and decay confidence
└── duplicate-detector.ts   - Prevent knowledge bloat
```

**Knowledge Entry Types:**

```typescript
type KnowledgeEntry = {
  id: string;
  type: "gotcha" | "pattern" | "decision";
  content: string;
  filePatterns: string[]; // e.g., ["*.sql", "server/routes/*"]
  actionTypes: string[]; // e.g., ["CREATE", "UPDATE"]
  confidence: number; // 0.0 - 1.0
  occurrences: number; // Times this prevented errors
  source: {
    executionId: string;
    taskId: string;
    agentType: string;
  };
  createdAt: string;
  updatedAt: string;
};
```

**Execution Flow:**

```
1. Receive execution completion event (via Message Bus)
2. Load execution logs and results
3. Analyze for failures and unexpected outcomes
4. Extract gotchas from failures (what went wrong, how it was fixed)
5. Extract patterns from successes (reusable approaches)
6. Check for duplicates in Knowledge Base
7. Write new entries with initial confidence
8. Update confidence of existing matching entries
9. If confidence > threshold, propose CLAUDE.md update
10. Notify human of proposed updates via Communication Hub
```

**Gotcha Extraction Rules:**

```
1. TypeScript error → SQL fix = SQLite gotcha
2. Import error → path fix = Module resolution gotcha
3. Runtime error → type change = Type safety gotcha
4. Test failure → code fix = Logic gotcha
5. Retry success → timing issue = Async gotcha
```

---

## Database Schema

```sql
-- Knowledge Base entries
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,  -- gotcha, pattern, decision
    content TEXT NOT NULL,
    file_patterns_json TEXT,  -- ["*.sql", "*.ts"]
    action_types_json TEXT,   -- ["CREATE", "UPDATE"]
    confidence REAL DEFAULT 0.5,
    occurrences INTEGER DEFAULT 0,
    source_execution_id TEXT,
    source_task_id TEXT,
    source_agent_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- CLAUDE.md update proposals
CREATE TABLE IF NOT EXISTS claude_md_proposals (
    id TEXT PRIMARY KEY,
    knowledge_entry_id TEXT NOT NULL,
    proposed_section TEXT NOT NULL,
    proposed_content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, approved, rejected
    reviewed_at TEXT,
    reviewer_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (knowledge_entry_id) REFERENCES knowledge_entries(id)
);

-- Track which gotchas prevented which errors
CREATE TABLE IF NOT EXISTS gotcha_applications (
    id TEXT PRIMARY KEY,
    knowledge_entry_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    prevented_error INTEGER,  -- 1 if gotcha prevented an error
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (knowledge_entry_id) REFERENCES knowledge_entries(id)
);
```

---

## API Design

| Endpoint                       | Method | Description                            |
| ------------------------------ | ------ | -------------------------------------- |
| /api/sia/analyze               | POST   | Trigger analysis of an execution       |
| /api/sia/knowledge             | GET    | Query Knowledge Base                   |
| /api/sia/knowledge/:id         | GET    | Get specific entry                     |
| /api/sia/gotchas               | GET    | Get gotchas (filtered by file pattern) |
| /api/sia/patterns              | GET    | Get patterns                           |
| /api/sia/proposals             | GET    | Get CLAUDE.md update proposals         |
| /api/sia/proposals/:id/approve | POST   | Approve a proposal                     |
| /api/sia/proposals/:id/reject  | POST   | Reject a proposal                      |

---

## Integration Points

1. **Message Bus** - Subscribe to `execution.completed` events
2. **Build Agent** - Read execution logs and task results
3. **Spec Agent** - Provide gotchas for task generation
4. **Communication Hub** - Notify human of proposals
5. **CLAUDE.md** - Write approved updates (with git commit)

---

## Confidence Scoring

```
Initial confidence: 0.5
After first confirmed prevention: 0.7
After 3 confirmed preventions: 0.85
After 5 confirmed preventions: 0.95

Decay: -0.05 per month of inactivity
Promotion threshold: 0.8 (required to propose CLAUDE.md update)
Demotion threshold: 0.3 (entry marked as unreliable)
```

---

## Risk Mitigation

1. **Knowledge bloat**: Aggressive duplicate detection, merge similar gotchas
2. **False positives**: Require multiple occurrences before high confidence
3. **Stale knowledge**: Confidence decay, periodic review prompts
4. **Breaking CLAUDE.md**: Human approval required, git versioning
5. **Circular learning**: Track gotcha lineage, prevent feedback loops
6. **Resource usage**: Process executions in batches, not real-time
