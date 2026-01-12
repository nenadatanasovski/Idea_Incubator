# Agent Architecture: Specification → Build → Self-Improvement

**Created:** 2026-01-10
**Purpose:** System architecture for new agent types
**Status:** Implementation Guide

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VIBE PLATFORM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │  Ideation   │────▶│Specification│────▶│   Build     │                  │
│   │   Agent     │     │    Agent    │     │   Agent     │                  │
│   │ (existing)  │     │   (new)     │     │   (new)     │                  │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                  │
│          │                   │                   │                          │
│          │    artifacts/     │    spec.md/       │    code/                 │
│          │    brief.md       │    tasks.md       │    commits               │
│          ▼                   ▼                   ▼                          │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                 Unified File System                              │      │
│   │   users/{user}/ideas/{idea}/                                     │      │
│   │   ├── README.md, development.md, target-users.md, ...           │      │
│   │   ├── planning/brief.md                                          │      │
│   │   └── build/spec.md, tasks.md                                    │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ API calls + Events
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CODING LOOPS (Python)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                      Shared Infrastructure                       │      │
│   │   MessageBus │ VerificationGate │ KnowledgeBase │ ResourceRegistry │   │
│   └─────────────────────────────────────────────────────────────────┘      │
│                            ▲                                                 │
│                            │ uses                                            │
│   ┌────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│   │  Monitor   │    │     PM       │    │    SIA       │                   │
│   │   Agent    │    │    Agent     │    │   (new)      │                   │
│   │ (existing) │    │  (existing)  │    │Self-Improve  │                   │
│   └────────────┘    └──────────────┘    └──────────────┘                   │
│                                                                              │
│   ┌────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│   │   Loop 1   │    │    Loop 2    │    │   Loop 3     │                   │
│   │  Critical  │    │Infrastructure│    │   Polish     │                   │
│   └────────────┘    └──────────────┘    └──────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Agent Responsibilities

### 2.1 Specification Agent (TypeScript, lives in Vibe)

**Location:** `agents/specification/`

**Purpose:** Transform ideation artifacts into executable specifications

**Inputs:**
- `planning/brief.md` - Handoff brief from Ideation
- `development.md` - Q&A from development sessions
- `target-users.md` - User personas
- `problem-solution.md` - Problem framing
- `research/*.md` - Market, competitive, technical research

**Outputs:**
- `build/spec.md` - Technical specification with requirements
- `build/tasks.md` - Atomic task breakdown (PIV-style)
- `build/decisions.md` - Architecture decisions log

**Key Behaviors:**
1. Extract requirements from ideation artifacts
2. Design data models and API contracts
3. Break work into atomic tasks with:
   - Action (CREATE/UPDATE/ADD/DELETE)
   - File path
   - Requirements
   - Gotchas (from Knowledge Base)
   - Validation command
   - Code template (when appropriate)
4. Identify dependencies between tasks
5. Request ownership registration for new files

### 2.2 Build Agent (Python, lives in coding-loops)

**Location:** `coding-loops/agents/build_agent.py`

**Purpose:** Execute task files generated by Specification Agent

**Inputs:**
- `build/spec.md` - Technical specification
- `build/tasks.md` - Atomic task breakdown
- Knowledge Base gotchas for relevant topics
- ResourceRegistry ownership information

**Outputs:**
- Code changes (committed to branch)
- Updated `tasks.md` (status updates)
- Knowledge Base entries (discoveries, gotchas)
- Execution reports

**Key Behaviors:**
1. **Prime:** Load context (spec, tasks, CLAUDE.md, gotchas)
2. **Execute:** For each task:
   - Check ownership (ResourceRegistry)
   - Acquire file lock (MessageBus)
   - Execute task with code template guidance
   - Run validation command
   - Record discoveries in Knowledge Base
3. **Validate:** Run full verification suite
4. **Report:** Generate execution summary

### 2.3 Self-Improvement Agent (SIA) (Python, lives in coding-loops)

**Location:** `coding-loops/agents/sia_agent.py`

**Purpose:** Learn from agent failures and improve the system

**Inputs:**
- Session logs from all agents
- Git diffs (plan vs actual)
- Test results
- Knowledge Base entries

**Outputs:**
- Pattern extraction (reusable approaches)
- Gotcha entries (mistakes to avoid)
- CLAUDE.md updates (universal patterns)
- Template improvements
- Improvement metrics

**Key Behaviors:**
1. **Capture:** Collect session outcomes
2. **Analyze:** Compare plan vs actual, classify divergences
3. **Extract:** Identify patterns and gotchas
4. **Propagate:** Update Knowledge Base, CLAUDE.md, templates
5. **Track:** Log metrics for improvement over time

---

## 3. Data Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                      │
└────────────────────────────────────────────────────────────────────────────┘

User Idea
    │
    ▼
┌─────────────┐
│  Ideation   │ ──▶ artifacts/ (README.md, development.md, ...)
│   Agent     │ ──▶ planning/brief.md
└──────┬──────┘
       │
       │ Handoff trigger (phase transition)
       ▼
┌─────────────┐
│Specification│ ──▶ build/spec.md (requirements)
│   Agent     │ ──▶ build/tasks.md (atomic tasks)
│             │ ──▶ build/decisions.md (ADRs)
│             │ ◀── Knowledge Base (gotchas for task generation)
└──────┬──────┘
       │
       │ Spec approved (user or auto)
       ▼
┌─────────────┐
│   Build     │ ──▶ Git commits (code changes)
│   Agent     │ ──▶ Knowledge Base (discoveries)
│             │ ──▶ MessageBus (events)
│             │ ◀── ResourceRegistry (ownership checks)
│             │ ◀── VerificationGate (validation)
└──────┬──────┘
       │
       │ Session complete (success or failure)
       ▼
┌─────────────┐
│    SIA      │ ──▶ Knowledge Base (patterns, gotchas)
│   Agent     │ ──▶ CLAUDE.md (universal patterns)
│             │ ──▶ Templates (structural improvements)
│             │ ──▶ Metrics DB (improvement tracking)
└─────────────┘
```

---

## 4. Cross-Agent Communication

### 4.1 Event Types

| Event | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `tasklist.generated` | Specification Agent | Build Agent, PM Agent | `{idea_slug, spec_path, task_count}` |
| `spec.approved` | User/Auto | Build Agent | `{idea_slug, approved_by}` |
| `task.started` | Build Agent | Monitor, SIA | `{task_id, file_path}` |
| `task.completed` | Build Agent | Monitor, SIA | `{task_id, duration, success}` |
| `task.failed` | Build Agent | Monitor, SIA, PM | `{task_id, error, attempt}` |
| `build.completed` | Build Agent | SIA | `{idea_slug, tasks_completed, duration}` |
| `gotcha.discovered` | Build Agent | Knowledge Base | `{topic, gotcha, source}` |
| `pattern.extracted` | SIA | Knowledge Base | `{pattern, usage, confidence}` |
| `system.improved` | SIA | All Agents | `{improvement_type, details}` |

### 4.2 Knowledge Base Queries

| Query | Caller | Response |
|-------|--------|----------|
| `gotchas_for_file(path)` | Build Agent | List of gotchas for file/type |
| `patterns_for_task(action)` | Spec Agent | Known patterns for action type |
| `decisions_for_domain(domain)` | Spec Agent | Relevant architectural decisions |
| `similar_failures(error)` | SIA | Similar past failures and resolutions |

---

## 5. File System Integration

### 5.1 Unified File System Structure

```
users/
└── {user-slug}/
    └── ideas/
        └── {idea-slug}/
            ├── README.md                    # Core idea (Ideation)
            ├── development.md               # Q&A sessions (Ideation)
            ├── target-users.md              # User personas (Ideation)
            ├── problem-solution.md          # Problem framing (Ideation)
            │
            ├── research/
            │   ├── market.md                # Market research (Ideation)
            │   ├── competitive.md           # Competitive analysis (Ideation)
            │   └── technical.md             # Technical feasibility (Ideation)
            │
            ├── planning/
            │   ├── brief.md                 # Handoff brief (Ideation → Spec)
            │   ├── mvp-scope.md             # MVP definition (Ideation)
            │   ├── architecture.md          # High-level architecture (Spec)
            │   └── action-plan.md           # Action items (Ideation)
            │
            ├── build/                       # NEW: Spec + Build Agent territory
            │   ├── spec.md                  # Technical spec (Spec Agent)
            │   ├── tasks.md                 # Atomic tasks (Spec Agent)
            │   ├── decisions.md             # ADRs (Spec Agent)
            │   └── execution-log.md         # Build progress (Build Agent)
            │
            ├── analysis/
            │   ├── redteam.md               # Red team challenges (Evaluation)
            │   └── risk-mitigation.md       # Risk responses (Evaluation)
            │
            └── .metadata/
                ├── index.json               # File index
                ├── relationships.json       # Cross-references
                └── timeline.json            # Activity log
```

### 5.2 Ownership Map

| Path Pattern | Owner | Reason |
|--------------|-------|--------|
| `README.md`, `development.md` | Ideation Agent | Core ideation artifacts |
| `target-users.md`, `problem-solution.md` | Ideation Agent | User/problem framing |
| `research/*.md` | Ideation Agent | Research artifacts |
| `planning/brief.md` | Ideation Agent | Handoff document |
| `planning/architecture.md` | Specification Agent | System design |
| `build/spec.md` | Specification Agent | Technical spec |
| `build/tasks.md` | Specification Agent | Task breakdown |
| `build/decisions.md` | Specification Agent | ADRs |
| `build/execution-log.md` | Build Agent | Execution tracking |
| `analysis/*.md` | Evaluation Agent | Analysis artifacts |
| `.metadata/*` | System | Auto-managed |

---

## 6. API Contracts

### 6.1 Specification Agent API

```typescript
// POST /api/ideation/sessions/:sessionId/generate-spec
interface GenerateSpecRequest {
  ideaSlug: string;
  userSlug: string;
  options?: {
    includeTechnicalDebt?: boolean;
    targetComplexity?: 'mvp' | 'full';
  };
}

interface GenerateSpecResponse {
  specPath: string;
  tasksPath: string;
  taskCount: number;
  estimatedComplexity: 'low' | 'medium' | 'high';
  missingInputs: string[];  // Documents that should be completed
}
```

### 6.2 Build Agent API (via MessageBus)

```python
# Event: build.request
class BuildRequest:
    idea_slug: str
    user_slug: str
    spec_path: str
    tasks_path: str
    branch_name: str
    options: dict  # dry_run, skip_validation, etc.

# Event: build.status
class BuildStatus:
    idea_slug: str
    status: Literal["running", "completed", "failed", "blocked"]
    current_task: Optional[str]
    completed_tasks: int
    total_tasks: int
    errors: List[dict]
```

### 6.3 SIA API (Internal)

```python
# Called after each session completes
class SessionReview:
    agent_type: str  # ideation, spec, build
    session_id: str
    idea_slug: str
    outcome: Literal["success", "failure", "partial"]
    git_diff: Optional[str]
    test_results: Optional[dict]

class ReviewResult:
    patterns_found: int
    gotchas_found: int
    claude_md_updates: List[str]
    template_updates: List[str]
```

---

## 7. Database Additions

### 7.1 New Tables (coding-loops/database/schema.sql)

```sql
-- Specifications table
CREATE TABLE IF NOT EXISTS specifications (
    id TEXT PRIMARY KEY,
    idea_slug TEXT NOT NULL,
    user_slug TEXT NOT NULL,
    spec_path TEXT NOT NULL,
    tasks_path TEXT NOT NULL,
    task_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',  -- draft, approved, in_progress, complete
    created_at TEXT DEFAULT (datetime('now')),
    approved_at TEXT,
    completed_at TEXT
);

-- Build executions table
CREATE TABLE IF NOT EXISTS build_executions (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    loop_id TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, running, completed, failed
    current_task_id TEXT,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    execution_log TEXT,  -- JSON array of task results
    FOREIGN KEY (spec_id) REFERENCES specifications(id)
);

-- Atomic tasks table (mirrors tasks.md but queryable)
CREATE TABLE IF NOT EXISTS atomic_tasks (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    phase TEXT NOT NULL,
    action TEXT NOT NULL,  -- CREATE, UPDATE, ADD, DELETE
    file_path TEXT NOT NULL,
    requirements TEXT,  -- JSON array
    gotchas TEXT,  -- JSON array
    validation_command TEXT,
    code_template TEXT,
    status TEXT DEFAULT 'pending',
    execution_id TEXT,
    completed_at TEXT,
    notes TEXT,
    FOREIGN KEY (spec_id) REFERENCES specifications(id)
);

-- System reviews table (SIA)
CREATE TABLE IF NOT EXISTS system_reviews (
    id TEXT PRIMARY KEY,
    agent_type TEXT NOT NULL,
    session_id TEXT,
    idea_slug TEXT,
    outcome TEXT NOT NULL,
    divergences TEXT,  -- JSON array of plan vs actual differences
    patterns_found TEXT,  -- JSON array
    gotchas_found TEXT,  -- JSON array
    improvements_made TEXT,  -- JSON array of changes made
    reviewed_at TEXT DEFAULT (datetime('now'))
);

-- Improvement metrics table
CREATE TABLE IF NOT EXISTS improvement_metrics (
    id TEXT PRIMARY KEY,
    metric_type TEXT NOT NULL,  -- first_pass_success, repeated_gotcha, etc.
    value REAL NOT NULL,
    context TEXT,  -- JSON with additional context
    recorded_at TEXT DEFAULT (datetime('now'))
);
```

### 7.2 Knowledge Base Extensions

```sql
-- Already exists in knowledge table, add these item_types:
-- 'gotcha' - Mistakes to avoid
-- 'pattern' - Reusable approaches
-- 'decision' - Architectural decisions

-- Add columns for better querying
ALTER TABLE knowledge ADD COLUMN file_pattern TEXT;  -- e.g., "*.ts", "server/routes/*"
ALTER TABLE knowledge ADD COLUMN action_type TEXT;   -- CREATE, UPDATE, etc.
ALTER TABLE knowledge ADD COLUMN discovered_by TEXT; -- agent that discovered it
```

---

## 8. Integration Points

### 8.1 Vibe Platform → coding-loops

| Trigger | Vibe Action | coding-loops Response |
|---------|-------------|----------------------|
| Spec generated | POST to API / publish event | Registers spec in DB |
| Spec approved | Publish `spec.approved` event | Build Agent starts execution |
| Build requested | Publish `build.request` event | Assigns to available loop |

### 8.2 coding-loops → Vibe Platform

| Trigger | coding-loops Action | Vibe Response |
|---------|---------------------|---------------|
| Build complete | Publish `build.completed` event | Update idea status |
| Task failed | Publish `task.failed` event | Show in UI |
| Gotcha discovered | Record in Knowledge Base | Available for next spec |

### 8.3 Shared Knowledge Base Access

```python
# coding-loops/shared/knowledge_base.py

class KnowledgeBase:
    def get_gotchas_for_file(self, file_path: str) -> List[Gotcha]:
        """Get gotchas relevant to a file path pattern."""

    def get_patterns_for_action(self, action: str) -> List[Pattern]:
        """Get patterns for CREATE, UPDATE, etc."""

    def record_gotcha(self, gotcha: Gotcha) -> str:
        """Record a new gotcha discovered during build."""

    def record_pattern(self, pattern: Pattern) -> str:
        """Record a new pattern from successful builds."""
```

---

## 9. Implementation Order

### Phase 1: Infrastructure (coding-loops Phases 3-7)
1. Verification Gate - Build Agent needs this
2. Git Manager - Branch management for builds
3. Checkpoint Manager - Rollback on failures
4. Resource Registry - Ownership tracking
5. Knowledge Base - Cross-agent learning

### Phase 2: Specification Agent (Vibe)
1. Create `agents/specification/` module
2. Implement spec extraction from ideation artifacts
3. Implement atomic task generation
4. Integrate with Knowledge Base for gotchas
5. Create API endpoints

### Phase 3: Build Agent (coding-loops)
1. Create `agents/build_agent.py`
2. Implement prime (context loading)
3. Implement execute (task execution)
4. Implement validate (verification)
5. Implement report (execution summary)

### Phase 4: Self-Improvement Agent (coding-loops)
1. Create `agents/sia_agent.py`
2. Implement session capture
3. Implement divergence analysis
4. Implement pattern extraction
5. Implement system updates

### Phase 5: Integration
1. Wire up event flows
2. E2E testing
3. Documentation

---

*Next: See IMPLEMENTATION-PLAN.md for detailed task breakdown*
