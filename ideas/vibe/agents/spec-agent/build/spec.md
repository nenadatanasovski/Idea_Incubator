---
id: unknown
title: Untitled
complexity: complex
status: draft
version: 1.0.0
generated: 2026-01-12
---

# Untitled

## Overview

**Problem:** After ideation and development sessions, ideas have rich context spread across multiple documents (README.md, development.md, target-users.md, research/*.md, planning/brief.md) but no structured implementation plan. Developers must:

1. Read all context documents manually
2. Synthesize requirements from scattered information
3. Design architecture without guidance
4. Create task lists from scratch
5. Guess at potential gotchas and pitfalls
6. Manually ensure consistency between documents

This manual specification process is time-consuming, inconsistent, and often misses important details hidden in the context files.

---

**Solution:** Specification Agent is an AI-powered system that:

1. **Loads context** from the unified file system (all ideation artifacts)
2. **Parses briefs** to extract structured requirements
3. **Analyzes with Claude** to understand requirements deeply
4. **Generates specifications** following consistent templates
5. **Creates atomic tasks** with dependencies, gotchas, and validation
6. **Injects known gotchas** from the Knowledge Base
7. **Asks clarifying questions** when requirements are ambiguous

Spec Agent transforms messy ideation output into clean, actionable implementation specs that Build Agent can execute.

---

## Functional Requirements

- **[FR-001]** Load context from unified file system (README.md, development.md, target-users.md, research/*.md, planning/brief.md) _(must)_
- **[FR-002]** Parse brief.md to extract structured fields (title, ID, complexity, problem, solution, MVP scope, success criteria, architecture) _(must)_
- **[FR-003]** Integrate with Claude API for requirement analysis using structured prompts _(must)_
- **[FR-004]** Generate spec.md following standard template with YAML frontmatter and markdown sections _(must)_
- **[FR-005]** Generate tasks.md with atomic PIV-style tasks including id, phase, action, file, status, requirements, gotchas, validation, code_template, and depends_on _(must)_
- **[FR-006]** Query Knowledge Base for relevant gotchas based on file patterns and action types _(must)_
- **[FR-007]** Inject hardcoded gotchas from known list (G-001 through G-015) _(must)_
- **[FR-008]** Generate clarifying questions when requirements are ambiguous or incomplete _(must)_
- **[FR-009]** Support multiple complexity levels (simple, medium, complex) _(must)_
- **[FR-010]** Validate task dependencies form a valid DAG (no cycles) _(must)_
- **[FR-011]** Validate all YAML frontmatter is parseable _(must)_
- **[FR-012]** Record specification runs in specifications table with metadata (tokens_used, task_count, status) _(must)_
- **[FR-013]** Store generated questions in questions table with agent_type='spec' _(should)_
- **[FR-014]** Phase ordering enforcement: database → types → api → ui → tests _(must)_
- **[FR-015]** Include context references listing all source documents in generated spec _(must)_
- **[FR-016]** Include validation commands for each task to verify implementation _(must)_

## Architecture

# Specification Agent - Technical Architecture

## System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Unified File System                             │
│  users/{user}/ideas/{idea}/                                         │
│  ├── README.md, development.md, target-users.md                     │
│  ├── research/*.md                                                  │
│  ├── planning/brief.md, mvp-scope.md                                │
│  └── build/ (OUTPUT)                                                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Specification Agent                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. Context Loader                                            │  │
│  │    - Reads all ideation artifacts                            │  │
│  │    - Validates brief.md exists                               │  │
│  │    - Loads CLAUDE.md conventions                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 2. Brief Parser                                              │  │
│  │    - Extracts problem/solution/requirements                  │  │
│  │    - Identifies ambiguities                                  │  │
│  │    - Generates clarifying questions                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 3. Claude Analyzer (Anthropic SDK)                           │  │
│  │    - Understands requirements deeply                         │  │
│  │    - Infers technical architecture                           │  │
│  │    - Identifies file ownership boundaries                    │  │
│  │    - Queries Knowledge Base for gotchas                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 4. Spec Generator                                            │  │
│  │    - Creates build/spec.md (requirements, arch, validation)  │  │
│  │    - Creates build/tasks.md (PIV-style atomic tasks)         │  │
│  │    - Injects gotchas from Knowledge Base                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 5. Database Recorder                                         │  │
│  │    - Records specification run in specifications table       │  │
│  │    - Stores questions in questions table                     │  │
│  │    - Tracks token usage                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Knowledge Base                               │
│  - Query gotchas by file pattern (*.sql, server/routes/*, etc.)    │
│  - Inject into task templates                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Build Agent (Consumer)                        │
│  - Reads build/spec.md and build/tasks.md                          │
│  - Executes atomic tasks with validation                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## New Files

| Path | Purpose |
|------|---------|
| `agents/specification-agent/core.py` | Main agent class implementing PRIME loop |
| `agents/specification-agent/context_loader.py` | Reads and validates ideation artifacts |
| `agents/specification-agent/brief_parser.py` | Parses brief.md into structured data |
| `agents/specification-agent/claude_analyzer.py` | Claude SDK wrapper for requirement analysis |
| `agents/specification-agent/spec_generator.py` | Generates spec.md from analysis |
| `agents/specification-agent/task_generator.py` | Generates tasks.md with PIV structure |
| `agents/specification-agent/templates/spec.md.jinja2` | Template for build/spec.md |
| `agents/specification-agent/templates/tasks.md.jinja2` | Template for build/tasks.md |
| `agents/specification-agent/run.py` | CLI entry point for running agent |
| `server/routes/specifications.ts` | Express router for spec management |
| `server/routes/spec-questions.ts` | Express router for clarifying questions |
| `shared/types/specification.ts` | TypeScript interfaces for specs |
| `templates/planning/brief.md` | Template for handoff briefs |
| `tests/unit/agents/specification_agent_test.py` | Unit tests for agent |
| `tests/e2e/spec_to_build_loop.py` | E2E test (Spec Agent → Build Agent) |

---

## Modified Files

| Path | Changes |
|------|---------|
| `database/schema.sql` | Add `spec_tasks` table for task tracking |
| `database/sync.js` | Add sync logic for build/*.md files |
| `package.json` | Add `npm run spec <idea-slug>` command |
| `CLAUDE.md` | Add Specification Agent section with conventions |
| `coding-loops/shared/knowledge_base.py` | Add `query_gotchas_by_pattern()` method |
| `coding-loops/shared/resource_registry.py` | Add `build/*.md` ownership for Spec Agent |

---

## Database Schema

```sql
-- Existing: specifications table (already in schema)
-- CREATE TABLE IF NOT EXISTS specifications (
--     id TEXT PRIMARY KEY,
--     idea_slug TEXT NOT NULL,
--     user_slug TEXT NOT NULL,
--     spec_path TEXT NOT NULL,
--     tasks_path TEXT NOT NULL,
--     task_count INTEGER DEFAULT 0,
--     status TEXT DEFAULT 'draft',  -- draft, approved, in_progress, completed
--     tokens_used INTEGER DEFAULT 0,
--     created_at TEXT DEFAULT (datetime('now')),
--     approved_at TEXT,
--     completed_at TEXT
-- );

-- NEW: Task tracking table
CREATE TABLE IF NOT EXISTS spec_tasks (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    task_id TEXT NOT NULL,  -- e.g., T-001, T-002
    phase TEXT NOT NULL,     -- database | types | api | ui | tests
    action TEXT NOT NULL,    -- CREATE | UPDATE | ADD | DELETE | VERIFY
    file_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending | in_progress | complete | failed | blocked
    requirements TEXT,       -- JSON array of requirements
    gotchas TEXT,            -- JSON array of gotchas
    validation_command TEXT,
    validation_expected TEXT,
    depends_on TEXT,         -- JSON array of task IDs
    assigned_to TEXT,        -- Agent ID (for Build Agent)
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (spec_id) REFERENCES specifications(id) ON DELETE CASCADE
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_spec_tasks_spec_id ON spec_tasks(spec_id);
CREATE INDEX IF NOT EXISTS idx_spec_tasks_status ON spec_tasks(status);
CREATE INDEX IF NOT EXISTS idx_spec_tasks_phase ON spec_tasks(phase);

-- Existing: questions table (reused for spec clarifications)
-- Questions with agent_type = 'spec' are spec clarifications
-- CREATE TABLE IF NOT EXISTS questions (
--     id TEXT PRIMARY KEY,
--     idea_slug TEXT NOT NULL,
--     user_slug TEXT NOT NULL,
--     agent_type TEXT,  -- 'spec' for Specification Agent
--     question TEXT NOT NULL,
--     answer TEXT,
--     status TEXT DEFAULT 'pending',
--     created_at TEXT DEFAULT (datetime('now')),
--     answered_at TEXT
-- );
```

---

## TypeScript Interfaces

```typescript
// shared/types/specification.ts

export interface Specification {
  id: string;
  ideaSlug: string;
  userSlug: string;
  specPath: string;
  tasksPath: string;
  taskCount: number;
  status: 'draft' | 'approved' | 'in_progress' | 'completed';
  tokensUsed: number;
  createdAt: string;  // ISO timestamp
  approvedAt?: string;
  completedAt?: string;
}

export interface SpecTask {
  id: string;
  specId: string;
  taskId: string;  // T-001, T-002, etc.
  phase: 'database' | 'types' | 'api' | 'ui' | 'tests';
  action: 'CREATE' | 'UPDATE' | 'ADD' | 'DELETE' | 'VERIFY';
  filePath: string;
  status: 'pending' | 'in_progress' | 'complete' | 'failed' | 'blocked';
  requirements: string[];  // Stored as JSON in DB
  gotchas: string[];       // Stored as JSON in DB
  validationCommand?: string;
  validationExpected?: string;
  dependsOn: string[];     // Task IDs
  assignedTo?: string;     // Agent ID
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface SpecQuestion {
  id: string;
  ideaSlug: string;
  userSlug: string;
  agentType: 'spec';
  question: string;
  answer?: string;
  status: 'pending' | 'answered';
  createdAt: string;
  answeredAt?: string;
}

export interface CreateSpecRequest {
  ideaSlug: string;
  userSlug: string;
  budgetDollars?: number;  // Default: $5
  autoApprove?: boolean;   // Default: false
}

export interface CreateSpecResponse {
  specId: string;
  specPath: string;
  tasksPath: string;
  taskCount: number;
  tokensUsed: number;
  questionsGenerated: number;
  status: 'draft' | 'approved';
}

export interface ApproveSpecRequest {
  specId: string;
  answers?: Record<string, string>;  // questionId -> answer
}

export interface GetSpecTasksResponse {
  specId: string;
  tasks: SpecTask[];
  byPhase: Record<string, SpecTask[]>;
}
```

---

## API Endpoints

### Specifications Router (`/api/specifications`)

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| POST | `/api/specifications` | Create new spec from brief | `CreateSpecRequest` | `CreateSpecResponse` |
| GET | `/api/specifications/:specId` | Get spec details | - | `Specification` |
| POST | `/api/specifications/:specId/approve` | Approve spec (start build) | `ApproveSpecRequest` | `Specification` |
| GET | `/api/specifications/:specId/tasks` | Get all tasks for spec | - | `GetSpecTasksResponse` |
| GET | `/api/specifications/:specId/questions` | Get clarifying questions | - | `SpecQuestion[]` |
| POST | `/api/specifications/:specId/regenerate` | Regenerate spec with answers | `ApproveSpecRequest` | `CreateSpecResponse` |

### Example API Usage

```bash
# 1. Create specification from brief
curl -X POST http://localhost:3000/api/specifications \
  -H "Content-Type: application/json" \
  -d '{
    "ideaSlug": "spec-agent",
    "userSlug": "nenad",
    "budgetDollars": 5
  }'

# Response:
# {
#   "specId": "550e8400-e29b-41d4-a716-446655440000",
#   "specPath": "users/nenad/ideas/spec-agent/build/spec.md",
#   "tasksPath": "users/nenad/ideas/spec-agent/build/tasks.md",
#   "taskCount": 12,
#   "tokensUsed": 8432,
#   "questionsGenerated": 3,
#   "status": "draft"
# }

# 2. Get clarifying questions
curl http://localhost:3000/api/specifications/550e8400.../questions

# 3. Approve spec with answers
curl -X POST http://localhost:3000/api/specifications/550e8400.../approve \
  -H "Content-Type: application/json" \
  -d '{
    "answers": {
      "q-001": "Use Express.js with TypeScript",
      "q-002": "SQLite with existing schema",
      "q-003": "Claude 3.5 Sonnet via Anthropic SDK"
    }
  }'

# 4. Get task breakdown
curl http://localhost:3000/api/specifications/550e8400.../tasks
```

---

## Key Architectural Decisions

### 1. **Brief-First Approach**
- Spec Agent expects `planning/brief.md` to exist
- Brief must contain: Problem, Solution, Requirements, Existing Schema Hint
- If brief is missing, agent fails with actionable error

### 2. **Question-Driven Clarification**
- Agent generates questions when requirements are ambiguous
- Questions stored in existing `questions` table with `agent_type = 'spec'`
- User must answer questions before spec approval
- Regeneration incorporates answers into spec

### 3. **Knowledge Base Integration**
- Agent queries gotchas by file pattern (`*.sql`, `server/routes/*`, etc.)
- Gotchas injected into task templates automatically
- Confidence scoring ensures only high-quality gotchas are used

### 4. **PIV-Style Task Format**
- Tasks follow existing PIV conventions (id, phase, action, file, status)
- Dependencies explicit (`depends_on` array)
- Validation commands included (e.g., `npx tsc --noEmit`)
- Code templates provide implementation guidance

### 5. **Two-Phase Approval**
- **Draft**: Spec generated, questions surfaced, awaiting user review
- **Approved**: User approves spec, Build Agent can start execution
- `status` field tracks state transition

### 6. **Database-First Schema**
- Tasks table mirrors PIV structure for queryability
- JSON fields for arrays (requirements, gotchas, dependsOn)
- Foreign key constraints maintain referential integrity

### 7. **File Ownership**
- Spec Agent owns `build/spec.md` and `build/tasks.md`
- Registered in ResourceRegistry to prevent conflicts
- Build Agent reads (not writes) these files

---

## Error Handling Strategy

| Error Condition | HTTP Status | Response | Recovery |
|-----------------|-------------|----------|----------|
| Brief missing | 400 | `{ error: "brief.md not found at ..." }` | User creates brief |
| Invalid brief format | 400 | `{ error: "Brief missing required section: Problem" }` | User fixes brief |
| Spec already exists | 409 | `{ error: "Spec already exists, use regenerate" }` | Use regenerate endpoint |
| Claude API error | 500 | `{ error: "Claude API failed", details: "..." }` | Retry with backoff |
| Budget exceeded | 400 | `{ error: "Estimated cost $X exceeds budget $Y" }` | Increase budget |
| Unanswered questions | 400 | `{ error: "3 questions pending, cannot approve" }` | Answer questions |
| Database error | 500 | `{ error: "Database write failed", details: "..." }` | Check schema, retry |

---

## Validation Strategy

### Spec Validation
- ✅ All context files loaded successfully
- ✅ Brief parsed without errors
- ✅ Requirements extracted and structured
- ✅ File ownership boundaries identified
- ✅ Gotchas injected from Knowledge Base
- ✅ Validation commands specified for each task

### Task Validation
- ✅ Each task has unique ID (T-001, T-002, ...)
- ✅ Dependencies form a DAG (no cycles)
- ✅ Phase order respected (database → types → api → ui → tests)
- ✅ File paths absolute and valid
- ✅ Action matches file operation (CREATE for new files, UPDATE for existing)

### Database Validation
```bash
# Verify spec recorded
sqlite3 database/ideas.db "SELECT * FROM specifications WHERE idea_slug = 'spec-agent'"

# Verify tasks recorded
sqlite3 database/ideas.db "SELECT task_id, phase, status FROM spec_tasks WHERE spec_id = '...'"

# Verify questions recorded
sqlite3 database/ideas.db "SELECT question FROM questions WHERE agent_type = 'spec' AND idea_slug = 'spec-agent'"
```

### End-to-End Validation
```bash
# Full E2E test
python3 tests/e2e/spec_to_build_loop.py

# Expected flow:
# 1. Create brief.md
# 2. Run Spec Agent
# 3. Answer questions
# 4. Approve spec
# 5. Build Agent executes tasks
# 6. Verify all tasks complete
```

---

## Gotchas & Pitfalls

### From Knowledge Base (Injected Automatically)

**Database Tasks:**
- ❌ Don't use `DATETIME` type in SQLite (use `TEXT`)
- ❌ Don't forget `PRAGMA foreign_keys = ON` before queries
- ❌ Don't use `datetime()` without `'now'` argument
- ✅ Always include `IF NOT EXISTS` in CREATE statements

**TypeScript Tasks:**
- ❌ Don't store dates as `Date` type (use `string`)
- ❌ Don't forget to export interfaces
- ❌ Don't use implicit `any` types
- ✅ Always define IDs as `string` (UUIDs)

**API Route Tasks:**
- ❌ Don't forget `try/catch` in async handlers
- ❌ Don't skip input validation
- ❌ Don't return 200 for errors
- ✅ Always use appropriate status codes (404, 400, 500)

**General:**
- ❌ Don't modify files owned by other agents
- ❌ Don't skip validation commands
- ❌ Don't create circular dependencies
- ✅ Always check file ownership in ResourceRegistry

### Specification-Specific

**Context Loading:**
- ❌ Don't assume all context files exist (check first)
- ❌ Don't fail silently if brief is malformed
- ✅ Provide actionable errors with file paths

**Task Generation:**
- ❌ Don't create tasks without clear validation criteria
- ❌ Don't assume Build Agent knows project conventions
- ✅ Include code templates for non-obvious tasks
- ✅ Make dependencies explicit (no implicit ordering)

**Question Generation:**
- ❌ Don't ask questions that can be inferred from context
- ❌ Don't generate vague questions ("What about X?")
- ✅ Ask specific, actionable questions with context
- ✅ Limit to 3-5 questions max (avoid question fatigue)

**Approval Flow:**
- ❌ Don't auto-approve specs without user consent
- ❌ Don't allow approval with unanswered questions
- ✅ Regenerate spec when answers change requirements
- ✅ Preserve original spec in Git history

---

## Token Budget Estimation

| Phase | Estimated Tokens | Cost (Sonnet 4.0) |
|-------|------------------|-------------------|
| Context Loading | 2,000 | $0.01 |
| Brief Parsing | 1,000 | $0.005 |
| Claude Analysis | 15,000 | $0.15 |
| Spec Generation | 5,000 | $0.05 |
| Task Generation | 8,000 | $0.08 |
| Question Generation | 2,000 | $0.02 |
| **Total** | **33,000** | **~$0.32** |

**Default Budget:** $5 (allows ~15 iterations)

---

## Future Enhancements

1. **Spec Diff View** - Compare draft vs approved spec
2. **Task Estimation** - Time/complexity estimates per task
3. **Auto-Dependency Detection** - Infer dependencies from file imports
4. **Spec Versioning** - Track spec changes over time
5. **Multi-Agent Specs** - Coordinate specs across multiple agents
6. **Spec Templates** - Common patterns (CRUD API, Auth, etc.)
7. **Interactive Clarification** - Chat-based Q&A instead of batch questions

---

## CLI Commands

```bash
# Create specification from brief
npm run spec <idea-slug>

# With custom budget
npm run spec <idea-slug> --budget=10

# Auto-approve (skip questions)
npm run spec <idea-slug> --auto-approve

# Regenerate with answers
npm run spec <idea-slug> --regenerate

# Show spec details
npm run spec:show <spec-id>

# List all specs
npm run spec:list

# Approve spec
npm run spec:approve <spec-id>
```

---

## Summary

The Specification Agent transforms unstructured ideation artifacts into structured, actionable implementation plans. It:

- **Loads context** from unified file system
- **Parses briefs** into structured requirements
- **Analyzes with Claude** to infer architecture
- **Generates specs** with validation criteria
- **Creates atomic tasks** with PIV structure
- **Injects gotchas** from Knowledge Base
- **Asks clarifying questions** when ambiguous

Output is consumed by Build Agent for execution. The agent follows existing project patterns (SQLite TEXT timestamps, Express routers, TypeScript interfaces) and integrates with existing infrastructure (Knowledge Base, Resource Registry, questions table).

## API Design

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/unknown | GET | List all |
| /api/unknown/:id | GET | Get by ID |
| /api/unknown | POST | Create new |
| /api/unknown/:id | PUT | Update |
| /api/unknown/:id | DELETE | Delete |

## Data Models

```typescript
export interface Unknown {
  id: string;
  // Add fields based on requirements
  created_at: string;
  updated_at: string;
}
```

```sql
-- Specification runs (existing in specifications table)
CREATE TABLE IF NOT EXISTS specifications (
    id TEXT PRIMARY KEY,
    idea_slug TEXT NOT NULL,
    user_slug TEXT NOT NULL,
    spec_path TEXT NOT NULL,
    tasks_path TEXT NOT NULL,
    task_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    tokens_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    approved_at TEXT,
    completed_at TEXT
);

-- Spec Agent questions (uses existing questions table)
-- Questions generated during spec creation
-- stored with agent_type = 'spec'
```

## Known Gotchas

- **SQL-001:** Always use parameterized queries to prevent SQL injection
- **SQL-002:** Use TEXT type for timestamps in SQLite, not DATETIME
- **SQL-003:** Add created_at and updated_at columns to all tables

## Validation Strategy

1. **Unit Tests:** Test individual functions
2. **Integration Tests:** Test API endpoints
3. **TypeScript:** Compile without errors
