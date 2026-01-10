# PIV Loop Adoption Analysis for Vibe Platform

**Created:** 2026-01-09
**Revised:** 2026-01-10
**Purpose:** First principles analysis of PIV Loop concepts for the Vibe platform
**Status:** Revised based on actual system state

---

## Executive Summary

The Vibe platform is an AI-powered idea-to-product builder with a **mature Ideation Agent** (Phase 1-4 complete), sophisticated context engineering, and an emerging **Unified File System** architecture. The PIV Loop concepts must be evaluated against what Vibe *already has*, not a blank slate.

**Key Finding:** Vibe's Ideation Agent already implements many PIV Loop concepts natively. The opportunity is not to "add PIV" but to **extend the existing patterns** to the Build Agent, Specification Agent, and multi-loop coordination system.

---

## 1. Current Vibe Architecture (Actual State)

### 1.1 What's Implemented

| Component | Status | Sophistication |
|-----------|--------|----------------|
| **Ideation Agent** | ✅ Complete | 25+ modules, 4 phases, streaming, artifacts |
| **Evaluation Pipeline** | ✅ Complete | 30 criteria, red team, synthesis, specialized evaluators |
| **Session Management** | ✅ Complete | Memory, signals, candidates, handoffs |
| **Artifact System** | 🔄 Transitioning | DB → Filesystem (Unified FS in progress) |
| **System Prompts** | ✅ Complete | Dynamic context loading, phase-aware |
| **Sub-Agent System** | ✅ Complete | Parallel task execution |
| **Web Search** | ⚠️ Exists but not integrated | Module complete, evaluation integration pending |
| **Specification Agent** | ❌ Not started | Next critical phase |
| **Build Agent** | ❌ Not started | Code generation, Ralph loops |
| **Multi-Loop Coordination** | 🔄 In progress | Message bus, verification gate building |

### 1.2 Vibe's Existing Context Engineering

The Ideation Agent already has sophisticated context management:

```
User Input
    ↓
buildSystemPrompt() ─→ Merges:
    • Phase-specific instructions (EXPLORING/NARROWING/VALIDATING/REFINING)
    • Conversation memory (recent messages)
    • Extracted signals (decisions, artifacts, risks)
    • User profile (fit context)
    • Idea candidates
    • Web search results (when available)
    ↓
Claude API Call
    ↓
extractSignals() ─→ Parses:
    • Buttons (choices)
    • Forms (structured input)
    • Artifacts (documents)
    • Risks (viability issues)
    • Confidence scores
    ↓
Memory Update + Artifact Storage
```

**This is already a sophisticated implementation of the PIV Loop's "Context Engineering" concept.**

### 1.3 Unified File System (In Progress)

The platform is transitioning to filesystem-based artifacts:

```
users/
└── {user-slug}/
    └── ideas/
        └── {idea-slug}/
            ├── README.md           # Core idea summary
            ├── development.md      # Q&A from development sessions
            ├── target-users.md     # User personas
            ├── problem-solution.md # Problem/solution framing
            ├── evaluation.md       # Evaluation results
            ├── redteam.md          # Red team challenges
            ├── brief.md            # Auto-generated handoff brief
            ├── spec.md             # (Future) Specification document
            ├── tasks.md            # (Future) Implementation tasks
            └── research/
                ├── market.md
                ├── competitive.md
                └── technical.md
```

**This IS the "stable resources" from Layer 1 of PIV Loop - already being implemented.**

---

## 2. First Principles: What PIV Loop Offers vs What Vibe Already Has

### 2.1 PIV Loop Concepts Mapping

| PIV Concept | Vibe Equivalent | Gap Analysis |
|-------------|-----------------|--------------|
| **Layer 1: Project Planning** (PRD.md, CLAUDE.md) | CLAUDE.md + idea folder templates | ✅ Exists - templates define structure |
| **Layer 2: Task Planning** (plan files) | `brief.md` + `tasks.md` in idea folders | 🔄 brief.md in progress, tasks.md planned for Build Agent |
| **Context References** | `system-prompt.ts` + `idea-context-builder.ts` | ✅ Already sophisticated |
| **Atomic Tasks** | Sub-agent system + signal extraction | ⚠️ Exists for ideation, needed for build |
| **Code Templates** | Not present | ❌ Needed for Build Agent only |
| **Multi-Level Validation** | Evaluation pipeline (30 criteria) | ✅ More sophisticated than PIV |
| **Prime Command** | Session resumption + context builder | ✅ Context loading exists |
| **System Review** | Not present | ❌ **Real gap** - learning from failures |

### 2.2 What Vibe Has That PIV Loop Doesn't

| Vibe Feature | PIV Equivalent | Advantage |
|--------------|----------------|-----------|
| **4-Phase Ideation** | Single-shot planning | Vibe guides users through discovery |
| **Signal Extraction** | None | Real-time understanding of conversation |
| **Viability Calculator** | None | Risk detection during ideation |
| **Candidate Tracking** | None | Multiple ideas tracked simultaneously |
| **Red Team + Arbiter** | Code review only | More rigorous validation |
| **Streaming** | None | Real-time UX |

---

## 3. Real Gaps to Address

### 3.1 Tier 1: Critical Gaps

| Gap | Why Critical | Where Needed |
|-----|--------------|--------------|
| **System Review / Learning Loop** | No mechanism to improve from failures | All agents |
| **Build Agent Atomic Tasks** | Specification → Code requires structured tasks | Build Agent |
| **Code Templates in Specs** | Build Agent needs executable plans | Build Agent |
| **Cross-Agent Knowledge Sharing** | Discoveries in ideation don't flow to build | Knowledge Base |

### 3.2 Tier 2: High Value

| Gap | Why Valuable | Where Needed |
|-----|--------------|--------------|
| **Ownership Boundaries** | Multi-loop coordination needs clear ownership | Coding Loops |
| **Gotchas Database** | Repeated mistakes waste time | All agents |
| **Validation Commands in Specs** | Automated verification | Build Agent |

### 3.3 NOT Gaps (Already Addressed)

| PIV Feature | Vibe Implementation |
|-------------|---------------------|
| Context loading | `buildSystemPrompt()` + `idea-context-builder.ts` |
| Task planning | `brief.md` generation (handoff-generator.ts) |
| Documentation structure | Unified File System templates |
| Validation | 30-criteria evaluation + red team |
| Memory | `memory-manager.ts` + session persistence |

---

## 4. Adoption Strategy

### 4.1 Where PIV Concepts Should Apply

| Vibe Component | PIV Adoption | Rationale |
|----------------|--------------|-----------|
| **Ideation Agent** | Minimal | Already sophisticated |
| **Specification Agent** | Moderate | Use PIV-style atomic task extraction |
| **Build Agent** | Heavy | PIV's execute + validate pattern fits perfectly |
| **Coding Loops** | Heavy | Multi-agent coordination benefits most |
| **Self-Improvement Agent (SIA)** | Critical | IS the system review concept |

### 4.2 Implementation by Agent Type

#### Ideation Agent (Already Complete)
- **No changes needed** - Context engineering already mature
- **Add:** System review to capture learnings after sessions complete

#### Specification Agent (Not Started)
```
Spec Agent should produce:
├── spec.md                    # Full requirements document
├── tasks.md                   # PIV-style atomic tasks
│   ├── Feature metadata
│   ├── Context references (from idea folder)
│   ├── Patterns to follow (from CLAUDE.md)
│   └── Step-by-step tasks with:
│       • Action (CREATE/UPDATE/ADD)
│       • File path
│       • Requirements
│       • Gotchas
│       • Validation command
│       • Code template (if appropriate)
└── validation-plan.md         # Test strategy
```

#### Build Agent (Not Started)
```
Build Agent workflow:
1. /prime ─→ Load spec.md + tasks.md + CLAUDE.md + context
2. For each task in tasks.md:
   a. Check ownership (ResourceRegistry)
   b. Acquire file lock
   c. Execute task
   d. Run validation command
   e. Update knowledge base with discoveries
3. /validate ─→ Run full verification
4. /system-review ─→ Compare plan vs actual, extract learnings
```

#### Self-Improvement Agent (Not Started)
**This IS the PIV System Review concept:**
```
SIA responsibilities:
1. Monitor agent failures
2. Analyze divergences (plan vs actual)
3. Extract patterns and gotchas
4. Update CLAUDE.md with learnings
5. Propose template/prompt improvements
6. Track improvement metrics
```

---

## 5. Unified File System Integration

The Unified File System already addresses much of PIV's "stable resources" concept:

### 5.1 Current Template Structure

| Document | Purpose | PIV Equivalent |
|----------|---------|----------------|
| `README.md` | Idea overview | Feature Overview |
| `development.md` | Q&A answers | Context captured |
| `target-users.md` | User personas | User Story context |
| `problem-solution.md` | Problem framing | Problem/Solution section |
| `brief.md` | Handoff document | Plan summary |
| `spec.md` | Requirements (planned) | **Full PIV plan** |
| `tasks.md` | Atomic tasks (planned) | **Step-by-step tasks** |

### 5.2 Additions Needed

```yaml
# Add to spec.md template (when Specification Agent creates it)

---
# SPECIFICATION: {idea-name}
version: "1.0"
created: {date}
status: draft | approved | in-progress | complete

# ─────────────────────────────────────────────
# CONTEXT REFERENCES
# ─────────────────────────────────────────────
context:
  idea_folder: "users/{user}/ideas/{idea-slug}/"
  required_reading:
    - README.md
    - problem-solution.md
    - target-users.md
    - research/competitive.md

  patterns:
    source: CLAUDE.md
    sections:
      - "Database Conventions"
      - "API Patterns"
      - "Error Handling"

  dependencies:
    - name: "Auth System"
      owner: "loop-2-infrastructure"
      status: pending
      blocks: ["user-facing routes"]

# ─────────────────────────────────────────────
# FEATURE REQUIREMENTS
# ─────────────────────────────────────────────
requirements:
  functional:
    - id: FR-001
      description: "User can create habit with name and frequency"
      acceptance: "Habit appears in list after creation"
    - id: FR-002
      # ...

  non_functional:
    - performance: "< 200ms response time"
    - security: "Input validation on all user data"

# ─────────────────────────────────────────────
# ARCHITECTURE
# ─────────────────────────────────────────────
architecture:
  new_files:
    - path: "server/routes/habits.ts"
      purpose: "REST endpoints for habits"
    - path: "database/migrations/001_habits.sql"
      purpose: "Habits table schema"

  modified_files:
    - path: "server/api.ts"
      changes: "Import and mount habits router"

  avoid_files:
    - "server/routes/auth.ts"  # Owned by loop-2

# ─────────────────────────────────────────────
# VALIDATION STRATEGY
# ─────────────────────────────────────────────
validation:
  unit_tests:
    - "tests/habits.test.ts"
  integration_tests:
    - "tests/integration/habits.test.ts"
  commands:
    - "npx tsc --noEmit"
    - "npm test"
    - "npm run lint"
---
```

### 5.3 Tasks.md Template (For Build Agent)

```yaml
# Add to tasks.md template

---
# TASKS: {idea-name}
spec_version: "1.0"
total_tasks: 12
completed: 0

# ─────────────────────────────────────────────
# PHASE 1: DATABASE
# ─────────────────────────────────────────────
tasks:
  - id: 1
    phase: database
    action: CREATE
    file: "database/migrations/001_habits.sql"

    requirements:
      - "Create habits table with id, name, frequency, user_id"
      - "Add created_at and updated_at timestamps"
      - "Foreign key to users table"

    gotchas:
      - "Use TEXT for dates in SQLite, not DATETIME"
      - "Always include IF NOT EXISTS"

    validation:
      command: "sqlite3 :memory: < database/migrations/001_habits.sql"
      expected: "exit code 0"

    code_template: |
      CREATE TABLE IF NOT EXISTS habits (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          frequency TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id)
      );

    status: pending  # pending | in_progress | complete | blocked
    completed_at: null
    notes: null

  - id: 2
    phase: database
    action: UPDATE
    file: "database/migrate.ts"
    # ... etc

# ─────────────────────────────────────────────
# COMPLETION CHECKLIST
# ─────────────────────────────────────────────
checklist:
  - "[ ] All tasks completed"
  - "[ ] All validation commands pass"
  - "[ ] No TypeScript errors"
  - "[ ] No lint errors"
  - "[ ] Tests passing"
  - "[ ] Knowledge base updated with discoveries"
---
```

---

## 6. Knowledge Sharing Between Agents

### 6.1 Current State

| Agent | Produces | Consumes |
|-------|----------|----------|
| Ideation Agent | Artifacts in idea folder | User input, web search |
| Evaluation Agent | Scores, red team challenges | Idea artifacts |
| Development Agent | Q&A in development.md | User input |

**Gap:** No cross-agent learning. Discoveries don't flow between agents.

### 6.2 Proposed Knowledge Flow

```
                    ┌─────────────────────────┐
                    │     Knowledge Base      │
                    │  (coding-loops/shared)  │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   Ideation    │      │ Specification │      │    Build      │
│    Agent      │      │    Agent      │      │    Agent      │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                       │                       │
        │ PUBLISH:              │ PUBLISH:              │ PUBLISH:
        │ - User patterns       │ - Requirement gotchas │ - Implementation patterns
        │ - Market insights     │ - Architecture        │ - Code gotchas
        │ - Risk discoveries    │   decisions           │ - Test discoveries
        │                       │                       │
        └───────────────────────┴───────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │  Self-Improvement Agent │
                    │  (System Review)        │
                    │                         │
                    │  - Analyzes failures    │
                    │  - Extracts patterns    │
                    │  - Updates CLAUDE.md    │
                    │  - Proposes improvements│
                    └─────────────────────────┘
```

### 6.3 Knowledge Types

| Type | Source | Used By | Example |
|------|--------|---------|---------|
| `gotcha` | Build Agent failures | All agents | "SQLite TEXT for dates" |
| `pattern` | Successful implementations | Build Agent | "API route registration pattern" |
| `decision` | Architecture choices | All agents | "Use sql.js not better-sqlite3" |
| `market_insight` | Ideation + Web Search | Spec Agent | "Competitors use weekly streaks" |
| `user_pattern` | Ideation conversations | All agents | "Users prefer simple UI" |

---

## 7. System Review Implementation

### 7.1 When to Trigger

| Trigger | Agent | Review Focus |
|---------|-------|--------------|
| Session complete | Ideation | User patterns, market insights |
| Spec approved | Specification | Requirement extraction quality |
| Task complete | Build | Implementation vs plan divergence |
| Test failure | Build | Failure pattern extraction |
| Evaluation complete | Evaluation | Scoring accuracy |

### 7.2 Review Process

```
SYSTEM REVIEW PROCESS
─────────────────────
1. CAPTURE
   - What was planned? (spec/tasks)
   - What actually happened? (git diff, logs)
   - What failed/succeeded? (test results)

2. ANALYZE
   - Divergences: plan vs actual
   - Classify: Good (better approach) vs Bad (shortcut)
   - Root cause: Why did this happen?

3. EXTRACT
   - Patterns: Reusable approaches
   - Gotchas: Mistakes to avoid
   - Decisions: Architectural choices made

4. PROPAGATE
   - Update Knowledge Base
   - Update CLAUDE.md if pattern is universal
   - Update templates if structural change needed
   - Update gotchas in similar task specs

5. TRACK
   - Log review in system_reviews table
   - Track improvement metrics over time
```

### 7.3 Integration with Coding Loops

The coding loops already have most infrastructure:

```python
# Already exists in coding-loops/database/queries.py:
KnowledgeQueries.record()      # Store discoveries
EventQueries.publish()         # Broadcast findings
AlertQueries.create()          # Flag important patterns

# Add:
SystemReviewQueries.create()   # Store review results
SystemReviewQueries.get_learnings_for_topic()  # Query past learnings
```

---

## 8. Revised Implementation Roadmap

### 8.1 Phase Alignment

| Vibe Phase | PIV Adoption | Priority |
|------------|--------------|----------|
| Phase 1.2: Unified FS | Already aligned | ✅ In progress |
| Phase 2: Spec Agent | Add PIV task structure | **HIGH** |
| Phase 3: Build Agent | Full PIV (prime/execute/validate/review) | **CRITICAL** |
| Phase 4: SIA | IS the system review concept | **CRITICAL** |
| Coding Loops | Continue current work | **HIGH** |

### 8.2 New Tasks for TASKS.md

```markdown
## Phase 17: Specification Agent PIV Integration (Session 18-19)

**Goal:** Spec Agent outputs PIV-style task files

### Tasks
- [ ] Create `templates/spec.md` with PIV structure
- [ ] Create `templates/tasks.md` with atomic task format
- [ ] Implement spec extraction from ideation artifacts
- [ ] Add context references resolver
- [ ] Add architecture analysis for new/modified files

**Exit Criteria:** Spec Agent generates tasks.md compatible with Build Agent

---

## Phase 18: Build Agent PIV Integration (Session 20-22)

**Goal:** Build Agent executes PIV workflow

### Tasks
- [ ] Create `/prime` skill for Build Agent context loading
- [ ] Create task executor with ownership checks
- [ ] Integrate validation commands execution
- [ ] Add gotcha injection from Knowledge Base
- [ ] Create execution report generator

**Exit Criteria:** Build Agent can execute tasks.md with full validation

---

## Phase 19: Self-Improvement Agent (Session 23-25)

**Goal:** Implement system review and learning loop

### Tasks
- [ ] Create `agents/sia/system-review.ts`
- [ ] Create divergence analyzer
- [ ] Create pattern extractor
- [ ] Implement CLAUDE.md updater
- [ ] Add improvement tracking metrics

**Exit Criteria:** SIA captures learnings and improves system over time

---

## Phase 20: Knowledge Flow Integration (Session 26-27)

**Goal:** Connect all agents through Knowledge Base

### Tasks
- [ ] Define knowledge types for each agent
- [ ] Implement cross-agent knowledge queries
- [ ] Add gotcha injection into task specs
- [ ] Create knowledge dashboard for visibility

**Exit Criteria:** Discoveries flow between agents automatically
```

---

## 9. Comparison: PIV Loop vs Vibe Platform

### 9.1 Final Assessment

| Aspect | PIV Loop | Vibe Platform | Winner |
|--------|----------|---------------|--------|
| **Context Loading** | `/prime` command | `buildSystemPrompt()` + `idea-context-builder.ts` | **Vibe** (more sophisticated) |
| **Planning** | Plan files with atomic tasks | `brief.md` + `tasks.md` (emerging) | **Tie** |
| **Validation** | Multi-level commands | 30-criteria evaluation + red team | **Vibe** (much more rigorous) |
| **Code Templates** | In plan files | Not yet implemented | **PIV** (needed for Build Agent) |
| **System Review** | `/system-review` command | Not implemented | **PIV** (critical gap in Vibe) |
| **Multi-Agent** | Single agent | Full agent ecosystem | **Vibe** |
| **UX** | CLI only | Streaming UI + WebSocket | **Vibe** |

### 9.2 Key Takeaway

> **Vibe should NOT adopt PIV wholesale. Instead:**
> 1. **Keep** existing Ideation/Evaluation sophistication
> 2. **Add** PIV's atomic task structure to Specification Agent output
> 3. **Add** PIV's execute workflow to Build Agent
> 4. **Add** PIV's system review as the Self-Improvement Agent
> 5. **Extend** Knowledge Base to enable cross-agent learning

---

## 10. Success Metrics (Revised)

| Metric | Current | Target | How PIV Helps |
|--------|---------|--------|---------------|
| Build Agent first-pass success | N/A | 80% | Atomic tasks with code templates |
| Repeated gotchas | Untracked | Zero | Knowledge Base propagation |
| Time to resume context | Manual | < 30s | `/prime` context loading |
| Cross-agent learning | None | Automatic | System review → Knowledge Base |
| Spec quality | N/A | Tasks executable without questions | PIV task structure |

---

## 11. Conclusion

The PIV Loop's value for Vibe is **selective, not comprehensive**:

1. **Ideation Agent** - Already superior; add system review only
2. **Specification Agent** - Adopt PIV task structure for output
3. **Build Agent** - Adopt full PIV workflow (prime → execute → validate → review)
4. **Self-Improvement Agent** - IS the system review concept; build it
5. **Coding Loops** - Continue current architecture; it's already solid

The real gap is **learning from failures** - the system review / SIA concept. This should be prioritized alongside the Build Agent work.

---

*Analysis revised based on actual Vibe platform state. Previous version incorrectly assumed a blank slate.*
