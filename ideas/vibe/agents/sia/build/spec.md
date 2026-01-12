# Self-Improvement Agent (SIA) Specification

## Status: APPROVED

---

## Context References

- `ideas/vibe/agents/sia/planning/brief.md` - SIA brief
- `CLAUDE.md` - Project conventions and gotchas
- `docs/bootstrap/TASK-LIST.md` - Task definitions
- `agents/build/` - Build Agent implementation (reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Self-Improvement Agent (SIA)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Execution   │───▶│    Gotcha    │───▶│  Knowledge   │       │
│  │  Analyzer    │    │  Extractor   │    │   Writer     │       │
│  └──────────────┘    └──────────────┘    └──────┬───────┘       │
│         │                                        │               │
│         │            ┌──────────────┐            │               │
│         └───────────▶│   Pattern    │────────────┘               │
│                      │  Extractor   │                            │
│                      └──────────────┘                            │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Confidence  │◀───│  Duplicate   │◀───│  CLAUDE.md   │       │
│  │   Tracker    │    │  Detector    │    │   Updater    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │        Knowledge Base         │
              │  (gotchas, patterns, decisions)│
              └───────────────────────────────┘
```

---

## Functional Requirements

### FR-1: Execution Analysis
- FR-1.1: Parse Build Agent execution logs
- FR-1.2: Extract task results (success/failure)
- FR-1.3: Identify error messages and stack traces
- FR-1.4: Detect retry patterns (fail then succeed)
- FR-1.5: Track file modifications per task

### FR-2: Gotcha Extraction
- FR-2.1: Identify error-fix pairs from failures
- FR-2.2: Categorize gotchas by error type
- FR-2.3: Tag gotchas with file patterns
- FR-2.4: Tag gotchas with action types (CREATE, UPDATE, DELETE)
- FR-2.5: Generate human-readable gotcha descriptions

### FR-3: Pattern Extraction
- FR-3.1: Identify successful code patterns
- FR-3.2: Detect reusable approaches across tasks
- FR-3.3: Extract code templates from successes
- FR-3.4: Tag patterns with context (file type, action)

### FR-4: Knowledge Base Management
- FR-4.1: Store entries with unique IDs
- FR-4.2: Track confidence scores per entry
- FR-4.3: Record occurrence counts
- FR-4.4: Maintain source provenance
- FR-4.5: Support querying by file pattern and action type

### FR-5: Duplicate Detection
- FR-5.1: Compare new entries against existing
- FR-5.2: Use semantic similarity for matching
- FR-5.3: Merge similar gotchas (increase confidence)
- FR-5.4: Prevent knowledge base bloat

### FR-6: Confidence Management
- FR-6.1: Assign initial confidence (0.5)
- FR-6.2: Increase confidence on confirmed prevention
- FR-6.3: Apply time-based decay
- FR-6.4: Track promotion/demotion thresholds

### FR-7: CLAUDE.md Updates
- FR-7.1: Generate update proposals for high-confidence gotchas
- FR-7.2: Target appropriate CLAUDE.md section
- FR-7.3: Require human approval via Communication Hub
- FR-7.4: Apply approved changes with git commit
- FR-7.5: Track proposal status (pending/approved/rejected)

### FR-8: API Endpoints
- FR-8.1: POST /api/sia/analyze - Trigger execution analysis
- FR-8.2: GET /api/sia/knowledge - Query knowledge base
- FR-8.3: GET /api/sia/gotchas - Get gotchas with filters
- FR-8.4: GET /api/sia/patterns - Get patterns with filters
- FR-8.5: GET /api/sia/proposals - List CLAUDE.md proposals
- FR-8.6: POST /api/sia/proposals/:id/approve - Approve proposal
- FR-8.7: POST /api/sia/proposals/:id/reject - Reject proposal

---

## Non-Functional Requirements

### NFR-1: Performance
- Analysis completes within 30 seconds per execution
- Knowledge Base queries return within 100ms
- No impact on main agent execution flow

### NFR-2: Reliability
- Graceful handling of malformed execution logs
- Idempotent analysis (re-running produces same results)
- Transaction safety for knowledge writes

### NFR-3: Maintainability
- Modular extractor design (easy to add new extractors)
- Clear separation between analysis and storage
- Comprehensive logging for debugging

---

## Data Models

### KnowledgeEntry
```typescript
interface KnowledgeEntry {
  id: string;
  type: 'gotcha' | 'pattern' | 'decision';
  content: string;
  filePatterns: string[];
  actionTypes: string[];
  confidence: number;
  occurrences: number;
  source: {
    executionId: string;
    taskId: string;
    agentType: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

### ClaudeMdProposal
```typescript
interface ClaudeMdProposal {
  id: string;
  knowledgeEntryId: string;
  proposedSection: string;
  proposedContent: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null;
  reviewerNotes: string | null;
  createdAt: string;
}
```

### GotchaApplication
```typescript
interface GotchaApplication {
  id: string;
  knowledgeEntryId: string;
  executionId: string;
  taskId: string;
  preventedError: boolean;
  createdAt: string;
}
```

### ExecutionAnalysis
```typescript
interface ExecutionAnalysis {
  executionId: string;
  agentType: string;
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  retriedTasks: number;
  extractedGotchas: ExtractedGotcha[];
  extractedPatterns: ExtractedPattern[];
  analyzedAt: string;
}

interface ExtractedGotcha {
  errorType: string;
  errorMessage: string;
  fix: string;
  filePattern: string;
  actionType: string;
  taskId: string;
}

interface ExtractedPattern {
  description: string;
  codeTemplate: string;
  filePattern: string;
  actionType: string;
  taskId: string;
}
```

---

## Database Schema

```sql
-- Knowledge Base entries
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('gotcha', 'pattern', 'decision')),
    content TEXT NOT NULL,
    file_patterns_json TEXT DEFAULT '[]',
    action_types_json TEXT DEFAULT '[]',
    confidence REAL DEFAULT 0.5,
    occurrences INTEGER DEFAULT 0,
    source_execution_id TEXT,
    source_task_id TEXT,
    source_agent_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_entries(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_confidence ON knowledge_entries(confidence);

-- CLAUDE.md update proposals
CREATE TABLE IF NOT EXISTS claude_md_proposals (
    id TEXT PRIMARY KEY,
    knowledge_entry_id TEXT NOT NULL,
    proposed_section TEXT NOT NULL,
    proposed_content TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_at TEXT,
    reviewer_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (knowledge_entry_id) REFERENCES knowledge_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON claude_md_proposals(status);

-- Track gotcha applications
CREATE TABLE IF NOT EXISTS gotcha_applications (
    id TEXT PRIMARY KEY,
    knowledge_entry_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    prevented_error INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (knowledge_entry_id) REFERENCES knowledge_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_applications_entry ON gotcha_applications(knowledge_entry_id);
```

---

## Component Details

### 1. Execution Analyzer (`agents/sia/execution-analyzer.ts`)
```typescript
interface ExecutionAnalyzer {
  analyze(executionId: string): Promise<ExecutionAnalysis>;
  loadLogs(executionId: string): Promise<ExecutionLog[]>;
  parseTaskResults(logs: ExecutionLog[]): TaskResult[];
  identifyFailures(results: TaskResult[]): FailureInfo[];
  identifyRetries(results: TaskResult[]): RetryInfo[];
}
```

### 2. Gotcha Extractor (`agents/sia/gotcha-extractor.ts`)
```typescript
interface GotchaExtractor {
  extract(failures: FailureInfo[]): ExtractedGotcha[];
  categorizeError(error: string): ErrorCategory;
  inferFilePattern(filePath: string): string;
  inferActionType(taskAction: string): string;
  generateDescription(gotcha: ExtractedGotcha): string;
}
```

### 3. Pattern Extractor (`agents/sia/pattern-extractor.ts`)
```typescript
interface PatternExtractor {
  extract(successes: TaskResult[]): ExtractedPattern[];
  identifyReusableCode(code: string): CodePattern | null;
  generateTemplate(pattern: CodePattern): string;
}
```

### 4. Knowledge Writer (`agents/sia/knowledge-writer.ts`)
```typescript
interface KnowledgeWriter {
  writeGotcha(gotcha: ExtractedGotcha): Promise<KnowledgeEntry>;
  writePattern(pattern: ExtractedPattern): Promise<KnowledgeEntry>;
  updateEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<void>;
  incrementOccurrences(id: string): Promise<void>;
}
```

### 5. Duplicate Detector (`agents/sia/duplicate-detector.ts`)
```typescript
interface DuplicateDetector {
  findDuplicate(content: string, type: string): Promise<KnowledgeEntry | null>;
  calculateSimilarity(a: string, b: string): number;
  shouldMerge(similarity: number): boolean;
  merge(existing: KnowledgeEntry, newContent: string): KnowledgeEntry;
}
```

### 6. Confidence Tracker (`agents/sia/confidence-tracker.ts`)
```typescript
interface ConfidenceTracker {
  recordPrevention(entryId: string, executionId: string, taskId: string): Promise<void>;
  updateConfidence(entryId: string): Promise<number>;
  applyDecay(): Promise<void>;
  getPromotionCandidates(): Promise<KnowledgeEntry[]>;
  getDemotionCandidates(): Promise<KnowledgeEntry[]>;
}

const CONFIDENCE_CONFIG = {
  initial: 0.5,
  preventionBoost: 0.15,
  maxConfidence: 0.95,
  monthlyDecay: 0.05,
  promotionThreshold: 0.8,
  demotionThreshold: 0.3,
};
```

### 7. CLAUDE.md Updater (`agents/sia/claude-md-updater.ts`)
```typescript
interface ClaudeMdUpdater {
  createProposal(entry: KnowledgeEntry): Promise<ClaudeMdProposal>;
  determineSection(entry: KnowledgeEntry): string;
  formatContent(entry: KnowledgeEntry): string;
  applyProposal(proposalId: string): Promise<void>;
  rejectProposal(proposalId: string, notes: string): Promise<void>;
}

const SECTION_MAPPING = {
  sql: '## Database Conventions',
  api: '## API Conventions',
  typescript: '## Coding Loops Infrastructure',
  test: '## Common Commands',
};
```

---

## API Specifications

### POST /api/sia/analyze
```typescript
// Request
{ executionId: string }

// Response
{
  analysis: ExecutionAnalysis;
  newGotchas: KnowledgeEntry[];
  newPatterns: KnowledgeEntry[];
  updatedEntries: string[];  // IDs of entries with increased confidence
}
```

### GET /api/sia/knowledge
```typescript
// Query params
{
  type?: 'gotcha' | 'pattern' | 'decision';
  filePattern?: string;
  actionType?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

// Response
{
  entries: KnowledgeEntry[];
  total: number;
}
```

### GET /api/sia/gotchas
```typescript
// Query params
{
  filePattern?: string;  // e.g., "*.sql"
  actionType?: string;   // e.g., "CREATE"
  minConfidence?: number;
}

// Response
{
  gotchas: KnowledgeEntry[];
}
```

### GET /api/sia/proposals
```typescript
// Query params
{ status?: 'pending' | 'approved' | 'rejected' }

// Response
{
  proposals: ClaudeMdProposal[];
}
```

### POST /api/sia/proposals/:id/approve
```typescript
// Request
{ notes?: string }

// Response
{ success: boolean; appliedContent: string }
```

### POST /api/sia/proposals/:id/reject
```typescript
// Request
{ notes: string }

// Response
{ success: boolean }
```

---

## Gotcha Extraction Rules

```typescript
const EXTRACTION_RULES = [
  {
    name: 'sqlite-date-type',
    errorPattern: /datetime|timestamp|date/i,
    filePattern: '*.sql',
    fix: 'Use TEXT for dates in SQLite, not DATETIME',
  },
  {
    name: 'import-extension',
    errorPattern: /Cannot find module|ERR_MODULE_NOT_FOUND/,
    filePattern: '*.ts',
    fix: 'Add .js extension to imports for ES modules',
  },
  {
    name: 'async-await',
    errorPattern: /Promise.*is not assignable|await.*Promise/,
    filePattern: '*.ts',
    fix: 'Ensure async functions are awaited',
  },
  {
    name: 'sql-js-api',
    errorPattern: /prepare|run|get.*not a function/,
    filePattern: '*.ts',
    fix: 'Use sql.js API: db.run() for writes, db.prepare().bind().step() for reads',
  },
  {
    name: 'foreign-key-pragma',
    errorPattern: /FOREIGN KEY constraint failed/,
    filePattern: '*.sql',
    fix: 'Enable PRAGMA foreign_keys = ON before foreign key operations',
  },
];
```

---

## Integration Points

### Message Bus Events

**Subscribe to:**
- `execution.completed` - Trigger analysis
- `task.failed` - Real-time gotcha extraction
- `task.retried` - Track retry patterns

**Publish:**
- `sia.analysis.completed` - Analysis finished
- `sia.gotcha.extracted` - New gotcha found
- `sia.proposal.created` - CLAUDE.md update proposed

### Communication Hub

- Send proposal notifications to human
- Receive approval/rejection responses
- Support inline review in Telegram

---

## File Structure

```
agents/sia/
├── index.ts                  # Main exports
├── execution-analyzer.ts     # Parse execution logs
├── gotcha-extractor.ts       # Extract gotchas from failures
├── pattern-extractor.ts      # Extract patterns from successes
├── knowledge-writer.ts       # Write to Knowledge Base
├── duplicate-detector.ts     # Prevent duplicates
├── confidence-tracker.ts     # Manage confidence scores
├── claude-md-updater.ts      # Propose CLAUDE.md changes
├── extraction-rules.ts       # Predefined extraction rules
└── db.ts                     # Database operations

server/routes/
└── sia.ts                    # API routes

database/migrations/
└── 030_sia.sql               # SIA database schema

types/
└── sia.ts                    # TypeScript interfaces
```

---

## Validation Commands

```bash
# TypeScript compilation
npx tsc --noEmit

# Run SIA tests
npm test -- tests/sia.test.ts

# Test knowledge query
curl http://localhost:3000/api/sia/gotchas?filePattern=*.sql

# Test proposal flow
curl -X POST http://localhost:3000/api/sia/analyze -d '{"executionId":"test-123"}'
```

---

## Gotchas (from existing knowledge)

1. **SQLite dates**: Use TEXT for dates, not DATETIME
2. **ES module imports**: Always include .js extension
3. **sql.js API**: Different from better-sqlite3, use prepare().bind().step()
4. **Async getDb()**: Always await getDb() before database operations
5. **Express routes**: Use `Promise<void>` return type and explicit `return` after response
