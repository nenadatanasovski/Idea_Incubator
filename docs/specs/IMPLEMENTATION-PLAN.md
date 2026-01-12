# Implementation Plan: Specification → Build → Self-Improvement Agents

**Created:** 2026-01-10
**Purpose:** Detailed implementation roadmap
**Status:** Ready for execution

---

## Executive Summary

This plan implements three new agents using concepts from the PIV Loop analysis while preserving Vibe's existing sophistication. Implementation is divided into 5 phases with clear dependencies.

**Total Effort:** ~25-30 coding sessions
**Priority Order:** Infrastructure → Specification Agent → Build Agent → SIA → Integration

---

## Phase Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION PHASES                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: Infrastructure (coding-loops)                                    │
│  ├─ Verification Gate ──────────────────────┐                              │
│  ├─ Git Manager ─────────────────────────────┤                              │
│  ├─ Checkpoint Manager ──────────────────────┼─▶ Build Agent dependencies  │
│  ├─ Resource Registry ───────────────────────┤                              │
│  └─ Knowledge Base ──────────────────────────┘                              │
│                                                                             │
│  PHASE 2: Specification Agent (Vibe)                                       │
│  ├─ Spec extraction from ideation artifacts                                │
│  ├─ Atomic task generation (PIV-style)                                     │
│  └─ Knowledge Base gotcha injection                                         │
│                                                                             │
│  PHASE 3: Build Agent (coding-loops)                                       │
│  ├─ Prime (context loading)                                                 │
│  ├─ Execute (task execution)                                                │
│  ├─ Validate (verification)                                                 │
│  └─ Report (execution summary)                                              │
│                                                                             │
│  PHASE 4: Self-Improvement Agent (coding-loops)                            │
│  ├─ Session capture                                                         │
│  ├─ Divergence analysis                                                     │
│  ├─ Pattern extraction                                                      │
│  └─ System updates                                                          │
│                                                                             │
│  PHASE 5: Integration & Testing                                             │
│  ├─ Event flows                                                             │
│  ├─ E2E testing                                                             │
│  └─ Documentation                                                           │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Infrastructure (coding-loops)

**Location:** `coding-loops/`
**Prerequisites:** Phase 0-2 complete ✅ (Database, Message Bus)
**Sessions:** 8-10

### 1.1 Verification Gate (Session 3)

**File:** `coding-loops/shared/verification_gate.py`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| VER-001 | Create VerificationResult dataclass | Tests pass |
| VER-002 | Implement `verify_test_passed()` | Detects false claims |
| VER-003 | Implement TypeScript check runner | `npx tsc --noEmit` |
| VER-004 | Implement test runner | `npm test` |
| VER-005 | Implement build check | `npm run build` |
| VER-006 | Implement lint check | `npm run lint` |
| VER-007 | Implement regression check | Compare with baseline |

**Tests:** `coding-loops/tests/test_verification.py`

### 1.2 Git Manager (Session 4)

**File:** `coding-loops/shared/git_manager.py`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| GIT-001 | Implement branch creation | Branch exists |
| GIT-002 | Implement checkout | On correct branch |
| GIT-003 | Implement rebase from main | Clean rebase |
| GIT-004 | Implement conflict detection | Conflicts identified |
| GIT-005 | Implement commit changes | Commit created |
| GIT-006 | Implement PR creation (gh) | PR URL returned |

**Tests:** `coding-loops/tests/test_git_manager.py`

### 1.3 Checkpoint Manager (Session 5)

**File:** `coding-loops/shared/checkpoint_manager.py`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| CHK-001 | Implement create checkpoint | Git ref stored |
| CHK-002 | Implement rollback | State restored |
| CHK-003 | Implement conditional rollback | Only if exists |
| CHK-004 | Implement delete checkpoint | Cleaned up |
| CHK-005 | Implement list checkpoints | All visible |
| CHK-006 | Auto-rollback on failure | Integrated with Build Agent |

**Tests:** `coding-loops/tests/test_checkpoint.py`

### 1.4 Resource Registry (Session 6)

**File:** `coding-loops/shared/resource_registry.py`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| RES-001 | Implement register owner | Ownership recorded |
| RES-002 | Implement get owner | Returns correct owner |
| RES-003 | Implement request change | CR created |
| RES-004 | Implement approve change | CR resolved |
| RES-005 | Implement list resources | All visible |
| RES-006 | Integrate with Build Agent | Ownership enforced |

**Tests:** `coding-loops/tests/test_resource_registry.py`

### 1.5 Knowledge Base (Session 7-8)

**File:** `coding-loops/shared/knowledge_base.py`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| KB-001 | Implement record_fact | Stored in DB |
| KB-002 | Implement record_decision | ADR format |
| KB-003 | Implement record_pattern | Usage tracking |
| KB-004 | Implement record_gotcha | With file pattern |
| KB-005 | Implement query by topic | Returns relevant |
| KB-006 | Implement get_gotchas_for_file | Pattern matching |
| KB-007 | Implement supersede | Replaces old entry |
| KB-008 | Implement conflict detection | Warns on contradictions |

**Tests:** `coding-loops/tests/test_knowledge.py`

### 1.6 Database Migration (Session 8)

**File:** `coding-loops/database/migrations/025_spec_build_sia_tables.sql`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| MIG-001 | Apply migration 025 | Tables created |
| MIG-002 | Add query functions | CRUD operations work |
| MIG-003 | Add model classes | Type-safe access |
| MIG-004 | Update tests | All pass |

---

## Phase 2: Specification Agent (Vibe)

**Location:** `agents/specification/`
**Prerequisites:** Phase 1.5 (Knowledge Base)
**Sessions:** 4-5

### 2.1 Module Structure (Session 9)

```
agents/specification/
├── index.ts                # Public API
├── spec-extractor.ts       # Extract specs from ideation artifacts
├── task-generator.ts       # Generate atomic tasks
├── gotcha-injector.ts      # Inject gotchas from Knowledge Base
├── context-resolver.ts     # Resolve context references
├── template-renderer.ts    # Render spec.md and tasks.md
└── validation.ts           # Validate generated specs
```

### 2.2 Spec Extractor (Session 9-10)

**File:** `agents/specification/spec-extractor.ts`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| SPEC-001 | Read ideation artifacts | All docs loaded |
| SPEC-002 | Extract requirements from development.md | FRs identified |
| SPEC-003 | Extract user context from target-users.md | Personas available |
| SPEC-004 | Extract architecture hints from brief.md | High-level design |
| SPEC-005 | Identify dependencies | External deps listed |
| SPEC-006 | Generate spec.md | Valid template output |

### 2.3 Task Generator (Session 10-11)

**File:** `agents/specification/task-generator.ts`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| TASK-001 | Parse requirements into tasks | Tasks created |
| TASK-002 | Assign phases (db, types, api, ui, tests) | Phases correct |
| TASK-003 | Determine dependencies | DAG created |
| TASK-004 | Add validation commands | Commands runnable |
| TASK-005 | Generate code templates | Templates useful |
| TASK-006 | Render tasks.md | Valid YAML in md |

### 2.4 Gotcha Injector (Session 11)

**File:** `agents/specification/gotcha-injector.ts`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| GOTCHA-001 | Query Knowledge Base by file pattern | Gotchas returned |
| GOTCHA-002 | Query by action type | CREATE/UPDATE gotchas |
| GOTCHA-003 | Inject into task definitions | Visible in tasks.md |
| GOTCHA-004 | Track gotcha usage | Analytics available |

### 2.5 API Integration (Session 12)

**File:** `server/routes/specification.ts`

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| API-001 | POST /api/specs/generate | Generates spec + tasks |
| API-002 | GET /api/specs/:id | Returns spec status |
| API-003 | POST /api/specs/:id/approve | Triggers build |
| API-004 | Publish tasklist.generated event | Event visible |

---

## Phase 3: Build Agent (coding-loops)

**Location:** `coding-loops/agents/build_agent.py`
**Prerequisites:** Phase 1 (all), Phase 2
**Sessions:** 5-6

### 3.1 Core Structure (Session 13)

```python
# coding-loops/agents/build_agent.py

class BuildAgent:
    def __init__(self, loop_id: str, db_path: str):
        self.loop_id = loop_id
        self.message_bus = MessageBus(db_path)
        self.verification = VerificationGate(...)
        self.git = GitManager(...)
        self.checkpoint = CheckpointManager(...)
        self.resources = ResourceRegistry(...)
        self.knowledge = KnowledgeBase(...)

    async def prime(self, spec_id: str) -> PrimeResult:
        """Load context for execution."""

    async def execute(self, task: AtomicTask) -> TaskResult:
        """Execute a single task."""

    async def validate(self) -> ValidationResult:
        """Run full validation suite."""

    async def report(self, execution_id: str) -> ExecutionReport:
        """Generate execution summary."""

    async def run(self, spec_id: str) -> BuildResult:
        """Full build execution loop."""
```

### 3.2 Prime Implementation (Session 13)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| PRIME-001 | Load spec.md | Parsed successfully |
| PRIME-002 | Load tasks.md | Tasks extracted |
| PRIME-003 | Load CLAUDE.md sections | Conventions loaded |
| PRIME-004 | Load relevant gotchas | Injected into context |
| PRIME-005 | Load idea artifacts | Context complete |
| PRIME-006 | Create execution record | DB entry created |

### 3.3 Execute Implementation (Session 14)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| EXEC-001 | Check task dependencies | Blocks if unmet |
| EXEC-002 | Check file ownership | ResourceRegistry query |
| EXEC-003 | Acquire file lock | MessageBus lock |
| EXEC-004 | Create checkpoint | Git ref saved |
| EXEC-005 | Execute task (invoke Claude) | Code written |
| EXEC-006 | Run validation command | Check passes |
| EXEC-007 | Record discoveries | Knowledge Base entry |
| EXEC-008 | Update task status | DB updated |
| EXEC-009 | Rollback on failure | Checkpoint restored |

### 3.4 Validate Implementation (Session 15)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| VAL-001 | Run TypeScript check | No errors |
| VAL-002 | Run tests | All pass |
| VAL-003 | Run lint | No errors |
| VAL-004 | Check regressions | None introduced |
| VAL-005 | Generate validation report | Summary available |

### 3.5 Report Implementation (Session 15)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| RPT-001 | Summarize task results | Counts accurate |
| RPT-002 | List discoveries | Gotchas/patterns |
| RPT-003 | List git commits | SHAs listed |
| RPT-004 | Calculate metrics | Duration, success rate |
| RPT-005 | Publish build.completed event | Event visible |

### 3.6 Integration (Session 16)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| INT-001 | Subscribe to spec.approved | Triggers build |
| INT-002 | Update tasks.md on progress | File updated |
| INT-003 | Publish task events | Events visible |
| INT-004 | Handle interrupts | Graceful stop |

---

## Phase 4: Self-Improvement Agent (coding-loops)

**Location:** `coding-loops/agents/sia_agent.py`
**Prerequisites:** Phase 3
**Sessions:** 4-5

### 4.1 Core Structure (Session 17)

```python
# coding-loops/agents/sia_agent.py

class SelfImprovementAgent:
    def __init__(self, db_path: str):
        self.knowledge = KnowledgeBase(db_path)
        self.message_bus = MessageBus(db_path)

    async def capture(self, session: SessionData) -> CaptureResult:
        """Capture session outcome data."""

    async def analyze(self, capture: CaptureResult) -> AnalysisResult:
        """Analyze divergences between plan and actual."""

    async def extract(self, analysis: AnalysisResult) -> ExtractionResult:
        """Extract patterns and gotchas."""

    async def propagate(self, extraction: ExtractionResult) -> PropagationResult:
        """Update Knowledge Base, CLAUDE.md, templates."""

    async def track(self, propagation: PropagationResult) -> None:
        """Log improvement metrics."""

    async def review(self, session_id: str) -> ReviewResult:
        """Full review pipeline."""
```

### 4.2 Capture Implementation (Session 17)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| CAP-001 | Load session outcome | Success/failure known |
| CAP-002 | Load spec (planned) | Original plan |
| CAP-003 | Load git diff (actual) | Changes made |
| CAP-004 | Load test results | Pass/fail counts |
| CAP-005 | Load execution log | Task-by-task |

### 4.3 Analyze Implementation (Session 18)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| ANA-001 | Compare planned vs actual files | Diff identified |
| ANA-002 | Identify divergences | List of changes |
| ANA-003 | Classify divergences | Good vs bad |
| ANA-004 | Identify root causes | Why explanations |
| ANA-005 | Score outcome | Numeric rating |

### 4.4 Extract Implementation (Session 18-19)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| EXT-001 | Extract patterns from success | Reusable approaches |
| EXT-002 | Extract gotchas from failure | Mistakes to avoid |
| EXT-003 | Extract decisions | ADRs |
| EXT-004 | Assign confidence scores | High/medium/low |
| EXT-005 | Detect similar past entries | Deduplication |

### 4.5 Propagate Implementation (Session 19)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| PROP-001 | Record in Knowledge Base | Entries created |
| PROP-002 | Identify CLAUDE.md updates | Universal patterns |
| PROP-003 | Apply CLAUDE.md updates | File updated |
| PROP-004 | Identify template updates | Structural changes |
| PROP-005 | Apply template updates | Files updated |
| PROP-006 | Notify relevant agents | Events published |

### 4.6 Track Implementation (Session 20)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| TRK-001 | Log review in DB | Record created |
| TRK-002 | Calculate improvement metrics | Values computed |
| TRK-003 | Store metrics | DB entries |
| TRK-004 | Generate trends | Historical view |

---

## Phase 5: Integration & Testing

**Prerequisites:** Phases 1-4
**Sessions:** 4-5

### 5.1 Event Flow Wiring (Session 21)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| EVT-001 | Vibe publishes tasklist.generated | Event visible in coding-loops |
| EVT-002 | User approves → spec.approved | Build Agent triggers |
| EVT-003 | Build Agent publishes task events | Monitor sees them |
| EVT-004 | build.completed → SIA triggers | Review runs |
| EVT-005 | SIA publishes improvements | All agents see them |

### 5.2 E2E Testing (Session 22-23)

| Test | Description | Exit Criteria |
|------|-------------|---------------|
| E2E-001 | Full pipeline test | Idea → Spec → Build → Review |
| E2E-002 | Failure recovery | Build fails, rollback works |
| E2E-003 | Knowledge propagation | Gotcha discovered, used in next spec |
| E2E-004 | Multi-idea | Two ideas built concurrently |
| E2E-005 | Interruption recovery | Build interrupted, resumes |

### 5.3 Documentation (Session 24)

| Task | Description | Exit Criteria |
|------|-------------|---------------|
| DOC-001 | Update ARCHITECTURE.md | Current state |
| DOC-002 | Update OPERATOR-RUNBOOK.md | New commands |
| DOC-003 | Update API-REFERENCE.md | New endpoints |
| DOC-004 | Update CLAUDE.md | New conventions |
| DOC-005 | Create agent-specific docs | Per-agent guides |

---

## Dependency Graph

```
                                    ┌─────────────────┐
                                    │  Database Layer │
                                    │   (Complete ✅) │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   Message Bus   │
                                    │   (Complete ✅) │
                                    └────────┬────────┘
                                             │
           ┌─────────────────────────────────┼─────────────────────────────────┐
           │                                 │                                 │
  ┌────────▼────────┐               ┌────────▼────────┐               ┌────────▼────────┐
  │  Verification   │               │   Git Manager   │               │   Checkpoint    │
  │      Gate       │               │                 │               │    Manager      │
  └────────┬────────┘               └────────┬────────┘               └────────┬────────┘
           │                                 │                                 │
           └─────────────────────────────────┼─────────────────────────────────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        │                    │                    │
               ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
               │    Resource     │  │   Knowledge     │  │   Migration     │
               │    Registry     │  │     Base        │  │      025        │
               └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
                        │                    │                    │
                        └────────────────────┼────────────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  SPECIFICATION  │
                                    │     AGENT       │
                                    │     (Vibe)      │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │     BUILD       │
                                    │     AGENT       │
                                    │ (coding-loops)  │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │      SIA        │
                                    │     AGENT       │
                                    │ (coding-loops)  │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   INTEGRATION   │
                                    │    & TESTING    │
                                    └─────────────────┘
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Build first-pass success | 80% | `tasks_completed / tasks_total` on first try |
| Repeated gotchas | 0 | Same gotcha discovered twice |
| Time to resume context | < 30s | Prime phase duration |
| Cross-agent learning | Automatic | Gotcha in spec from different idea |
| Spec quality | No clarification needed | Build Agent completes without questions |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Infrastructure delays | Medium | High | Strict phase gates, don't start Phase 2 until Phase 1 complete |
| Spec→Build format mismatch | Medium | Medium | Use strict YAML validation, shared schema |
| SIA over-propagation | Low | Medium | Confidence thresholds, human review for CLAUDE.md |
| Knowledge Base noise | Medium | Low | Deduplication, expiry for low-confidence entries |

---

## Next Steps

1. **Immediate:** Continue coding-loops Phase 3 (Verification Gate)
2. **Short-term:** Complete Phases 3-7 of coding-loops infrastructure
3. **Medium-term:** Build Specification Agent in Vibe
4. **Long-term:** Build Agent, SIA, Integration

---

*See AGENT-ARCHITECTURE.md for detailed system design*
*See PIV-LOOP-ADOPTION-ANALYSIS.md for background analysis*
