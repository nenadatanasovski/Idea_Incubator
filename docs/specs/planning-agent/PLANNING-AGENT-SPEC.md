# Planning Agent Specification

> **Location:** `docs/specs/planning-agent/PLANNING-AGENT-SPEC.md`
> **Purpose:** Complete specification for the Planning Agent
> **Status:** Draft - Ready for review
> **Created:** 2026-01-17

---

## 1. Executive Summary

The Planning Agent is a new Python-based agent positioned between the Ideation Agent and Task Agent in the orchestration pipeline:

```
Ideation Agent → Planning Agent → Task Agent → Build Agent → Loop → SIA Agent
```

### Key Responsibilities

1. **Automatic Detection**: Detect when ideation is "complete enough" to begin planning
2. **PRD Generation**: Create Product Requirements Documents from ideation artifacts
3. **Spec Generation**: Absorb Specification Agent functionality (brief → spec → tasks)
4. **Database Mapping**: Populate `prds`, `prd_task_lists`, and related tables
5. **Task Preparation**: Prepare structured work for Task Agent to expand

### Design Decisions

| Decision | Choice                          | Rationale                                            |
| -------- | ------------------------------- | ---------------------------------------------------- |
| Runtime  | Python worker                   | Consistent with Build Agent, long-running operations |
| Replaces | Specification Agent             | Consolidate planning concerns into one agent         |
| Trigger  | Automatic detection             | No user intervention needed                          |
| Output   | PRD records + linked task lists | Task Agent creates/expands tasks                     |

---

## 2. Agent Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLANNING AGENT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   INPUTS                       CORE                        OUTPUTS          │
│   ──────                       ────                        ───────          │
│                                                                              │
│   ┌──────────────┐      ┌─────────────────────┐      ┌──────────────┐      │
│   │ Ideation     │      │ Readiness Detector  │      │ PRD Record   │      │
│   │ Session      │─────▶│ (auto-detection)    │─────▶│ (prds table) │      │
│   │ Artifacts    │      └──────────┬──────────┘      └──────────────┘      │
│   └──────────────┘                 │                                        │
│                                    ▼                                        │
│   ┌──────────────┐      ┌─────────────────────┐      ┌──────────────┐      │
│   │ Memory       │      │ PRD Generator       │      │ Task List    │      │
│   │ Files        │─────▶│ (Claude API)        │─────▶│ Container    │      │
│   │ (state)      │      └──────────┬──────────┘      │ (empty)      │      │
│   └──────────────┘                 │                 └──────────────┘      │
│                                    ▼                                        │
│   ┌──────────────┐      ┌─────────────────────┐      ┌──────────────┐      │
│   │ User         │      │ Spec Generator      │      │ Spec.md      │      │
│   │ Profile      │─────▶│ (from Spec Agent)   │─────▶│ Tasks.md     │      │
│   └──────────────┘      └─────────────────────┘      │ (files)      │      │
│                                                       └──────────────┘      │
│                                                                              │
│   OBSERVABILITY INTEGRATION                                                 │
│   ─────────────────────────                                                 │
│   ┌─────────────────────────────────────────────────────────────┐          │
│   │ TranscriptWriter │ ToolUseLogger │ SkillTracer │ Assertions │          │
│   └─────────────────────────────────────────────────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 File Structure

```
coding-loops/
├── agents/
│   └── planning_agent/
│       ├── __init__.py              # Package exports
│       ├── worker.py                # Main worker entry point
│       ├── readiness_detector.py    # Auto-detection logic
│       ├── prd_generator.py         # PRD creation
│       ├── spec_generator.py        # Spec/task generation (from TS port)
│       ├── database.py              # Database operations
│       └── prompts/
│           ├── readiness.py         # Prompts for readiness detection
│           ├── prd.py               # Prompts for PRD generation
│           └── spec.py              # Prompts for spec generation
│
├── shared/
│   ├── transcript_writer.py         # Existing - observability
│   ├── tool_use_logger.py           # Existing - observability
│   ├── skill_tracer.py              # Existing - observability
│   └── assertion_recorder.py        # Existing - observability
```

---

## 3. Automatic Detection Criteria

The Planning Agent monitors ideation sessions and detects "planning readiness" based on multiple signals.

### 3.1 Readiness Signals

| Signal           | Weight | Threshold    | Source                         |
| ---------------- | ------ | ------------ | ------------------------------ |
| Confidence Score | 25%    | ≥ 60%        | `ideation_sessions.confidence` |
| Viability Score  | 20%    | ≥ 50%        | `ideation_sessions.viability`  |
| Candidate Formed | 15%    | Must exist   | `idea_candidates.title`        |
| Problem Defined  | 15%    | Must exist   | `memory_files.self_discovery`  |
| Solution Clarity | 10%    | Must exist   | `memory_files.narrowing_state` |
| No Active Risks  | 10%    | < 2 critical | `ideation_sessions.risks`      |
| Time in Ideation | 5%     | ≥ 10 turns   | `ideation_messages.count`      |

### 3.2 Readiness Score Calculation

```python
def calculate_readiness_score(session: IdeationSession) -> float:
    """
    Calculate planning readiness score (0-100).
    Returns: readiness percentage
    """
    score = 0.0

    # Confidence contribution (25%)
    if session.confidence >= 60:
        score += 25
    elif session.confidence >= 40:
        score += (session.confidence - 40) / 20 * 25

    # Viability contribution (20%)
    if session.viability >= 50:
        score += 20
    elif session.viability >= 30:
        score += (session.viability - 30) / 20 * 20

    # Candidate existence (15%)
    if session.candidate and session.candidate.title:
        score += 15

    # Problem definition (15%)
    if session.self_discovery.frustrations or session.self_discovery.experiences:
        score += 15

    # Solution clarity (10%)
    if session.narrowing_state.product_type.value:
        score += 10

    # Risk assessment (10%)
    critical_risks = [r for r in session.risks if r.severity in ('critical', 'high')]
    if len(critical_risks) < 2:
        score += 10

    # Conversation depth (5%)
    if session.message_count >= 10:
        score += 5

    return score
```

### 3.3 Trigger Threshold

- **Auto-trigger**: Readiness score ≥ 75%
- **Suggest to user**: Readiness score ≥ 60% (show "Ready to plan?" button)
- **Block planning**: Readiness score < 40% (show what's missing)

---

## 4. PRD Generation

### 4.1 PRD Structure

The Planning Agent generates PRDs that map to the existing `prds` table schema:

```python
@dataclass
class GeneratedPRD:
    # Core identity
    slug: str                    # Auto-generated from title
    title: str                   # From idea candidate

    # Ownership
    user_id: str                 # From ideation session
    project_id: Optional[str]    # Optional project grouping

    # Core content
    problem_statement: str       # From self_discovery.frustrations
    target_users: str            # From narrowing_state.customer_type
    functional_description: str  # From candidate.summary + solution

    # Structured data
    success_criteria: List[str]  # Derived from viability factors
    constraints: List[str]       # From risks + limitations
    out_of_scope: List[str]      # Explicitly excluded features

    # Metadata
    source_session_id: str       # Link back to ideation session
```

### 4.2 Extraction Logic

```python
class PRDGenerator:
    """Generate PRD from ideation session state."""

    async def generate(self, session: IdeationSession) -> GeneratedPRD:
        # 1. Load all memory files
        memory = await self.load_memory_files(session.id)

        # 2. Load artifacts (pitch decks, diagrams, etc.)
        artifacts = await self.load_artifacts(session.id)

        # 3. Build Claude prompt
        prompt = self.build_extraction_prompt(session, memory, artifacts)

        # 4. Call Claude for structured extraction
        response = await self.claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=PRD_EXTRACTION_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

        # 5. Parse and validate PRD
        prd = self.parse_prd_response(response)

        # 6. Enrich with derived fields
        prd = self.enrich_prd(prd, session)

        return prd
```

### 4.3 Database Operations

```python
async def save_prd(self, prd: GeneratedPRD) -> str:
    """Save PRD to database and return ID."""
    prd_id = str(uuid.uuid4())

    await self.db.execute("""
        INSERT INTO prds (
            id, slug, title, user_id, project_id,
            problem_statement, target_users, functional_description,
            success_criteria, constraints, out_of_scope,
            status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))
    """, (
        prd_id, prd.slug, prd.title, prd.user_id, prd.project_id,
        prd.problem_statement, prd.target_users, prd.functional_description,
        json.dumps(prd.success_criteria),
        json.dumps(prd.constraints),
        json.dumps(prd.out_of_scope)
    ))

    return prd_id
```

---

## 5. Spec Generation (Ported from TypeScript)

The Planning Agent absorbs the Specification Agent functionality, porting key components to Python.

### 5.1 Components to Port

| TypeScript Component | Python Equivalent           | Purpose               |
| -------------------- | --------------------------- | --------------------- |
| `SpecAgent` class    | `spec_generator.py`         | Main orchestrator     |
| `BriefParser`        | `brief_parser.py`           | Parse brief.md files  |
| `TaskGenerator`      | `task_generator.py`         | Generate atomic tasks |
| `GotchaInjector`     | `gotcha_injector.py`        | Inject KB gotchas     |
| `ClaudeClient`       | Use shared anthropic client | API calls             |

### 5.2 Brief Generation

Before spec generation, Planning Agent creates a `planning/brief.md` from the PRD:

```python
async def generate_brief(self, prd: GeneratedPRD) -> str:
    """Generate brief.md content from PRD."""

    brief_content = f"""---
id: {prd.slug}
title: {prd.title}
complexity: {self.estimate_complexity(prd)}
prd_id: {prd.id}
---

# {prd.title}

## Problem
{prd.problem_statement}

## Solution
{prd.functional_description}

## Target Users
{prd.target_users}

## Success Criteria
{chr(10).join(f"- {c}" for c in prd.success_criteria)}

## Constraints
{chr(10).join(f"- {c}" for c in prd.constraints)}

## Out of Scope
{chr(10).join(f"- {c}" for c in prd.out_of_scope)}
"""
    return brief_content
```

### 5.3 Task List Creation

The Planning Agent creates an empty task list container that Task Agent will populate:

```python
async def create_task_list(self, prd_id: str, prd: GeneratedPRD) -> str:
    """Create task list container linked to PRD."""

    task_list_id = str(uuid.uuid4())

    # Create task list
    await self.db.execute("""
        INSERT INTO task_lists_v2 (id, slug, title, description, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
    """, (
        task_list_id,
        f"{prd.slug}-tasks",
        f"Tasks for {prd.title}",
        f"Implementation tasks for PRD: {prd.title}"
    ))

    # Link to PRD
    await self.db.execute("""
        INSERT INTO prd_task_lists (id, prd_id, task_list_id, position)
        VALUES (?, ?, ?, 0)
    """, (str(uuid.uuid4()), prd_id, task_list_id))

    return task_list_id
```

---

## 6. Observability Integration

The Planning Agent follows the standard observability pattern from `AGENT-INTEGRATION-TEMPLATE.md`.

### 6.1 Base Class

```python
# coding-loops/agents/planning_agent/worker.py

from shared.transcript_writer import TranscriptWriter
from shared.tool_use_logger import ToolUseLogger
from shared.skill_tracer import SkillTracer
from shared.assertion_recorder import AssertionRecorder

class PlanningAgentWorker:
    """
    Planning Agent worker following ObservableAgent pattern.
    """

    def __init__(self, execution_id: str, session_id: str):
        self.execution_id = execution_id
        self.session_id = session_id
        self.instance_id = str(uuid.uuid4())

        # Initialize observability
        self.transcript = TranscriptWriter(execution_id, self.instance_id)
        self.tool_logger = ToolUseLogger(self.transcript)
        self.skill_tracer = SkillTracer(self.transcript, self.tool_logger)
        self.assertions = AssertionRecorder(self.transcript, execution_id)

        # Initialize components
        self.readiness_detector = ReadinessDetector()
        self.prd_generator = PRDGenerator()
        self.spec_generator = SpecGenerator()
```

### 6.2 Lifecycle Events

```python
async def execute(self) -> int:
    """Main execution flow with observability."""

    try:
        # Phase 1: Readiness Detection
        self.log_phase_start("detect", "Checking planning readiness")
        readiness = await self.readiness_detector.check(self.session_id)
        self.log_phase_end("detect", "success" if readiness.score >= 75 else "partial")

        if readiness.score < 75:
            return 0  # Not ready yet

        # Phase 2: PRD Generation
        self.log_phase_start("prd", "Generating Product Requirements Document")
        prd = await self.prd_generator.generate(self.session_id)
        prd_id = await self.save_prd(prd)
        self.log_phase_end("prd", "success")

        # Phase 3: Brief Generation
        self.log_phase_start("brief", "Generating implementation brief")
        brief = await self.generate_brief(prd)
        await self.save_brief(brief, prd)
        self.log_phase_end("brief", "success")

        # Phase 4: Task List Creation
        self.log_phase_start("tasklist", "Creating task list container")
        task_list_id = await self.create_task_list(prd_id, prd)
        self.log_phase_end("tasklist", "success")

        # Phase 5: Handoff to Task Agent
        self.log_phase_start("handoff", "Preparing handoff to Task Agent")
        await self.prepare_task_agent_handoff(prd_id, task_list_id)
        self.log_phase_end("handoff", "success")

        return 0

    except Exception as e:
        self.log_error(e, {"phase": self.current_phase})
        return 1

    finally:
        self.transcript.flush()
        self.transcript.close()
```

### 6.3 Event Types

| Event             | Entry Type    | When                    |
| ----------------- | ------------- | ----------------------- |
| Start             | `phase_start` | Beginning each phase    |
| End               | `phase_end`   | Completing each phase   |
| PRD Created       | `discovery`   | PRD saved to database   |
| Brief Generated   | `checkpoint`  | Brief file written      |
| Task List Created | `discovery`   | Task list linked to PRD |
| Error             | `error`       | Any exception           |

---

## 7. Integration Points

### 7.1 Ideation Agent → Planning Agent

The Planning Agent is triggered by:

1. **Periodic Check**: Background job checks all active sessions every 5 minutes
2. **On Message**: After each ideation message, check readiness score
3. **User Request**: User clicks "Start Planning" button when available

```python
# server/services/planning-trigger.ts (TypeScript orchestrator)

async function checkPlanningReadiness(sessionId: string): Promise<void> {
    const readiness = await planningClient.checkReadiness(sessionId);

    if (readiness.score >= 75) {
        // Auto-spawn Planning Agent
        await spawnPlanningAgent(sessionId);
    } else if (readiness.score >= 60) {
        // Show suggestion in UI
        await notifyUser(sessionId, {
            type: 'planning_ready',
            score: readiness.score,
            missing: readiness.missing
        });
    }
}
```

### 7.2 Planning Agent → Task Agent

After PRD and task list creation, Planning Agent signals Task Agent:

```python
async def prepare_task_agent_handoff(self, prd_id: str, task_list_id: str):
    """Signal Task Agent to begin task expansion."""

    # Update task list status
    await self.db.execute("""
        UPDATE task_lists_v2
        SET status = 'ready_for_expansion'
        WHERE id = ?
    """, (task_list_id,))

    # Create handoff event
    await self.emit_event("planning:handoff", {
        "prd_id": prd_id,
        "task_list_id": task_list_id,
        "session_id": self.session_id,
        "ready_at": datetime.now().isoformat()
    })
```

---

## 8. API Endpoints

### 8.1 New Endpoints

| Endpoint                             | Method | Purpose                   |
| ------------------------------------ | ------ | ------------------------- |
| `/api/planning/readiness/:sessionId` | GET    | Check planning readiness  |
| `/api/planning/start/:sessionId`     | POST   | Manually trigger planning |
| `/api/planning/status/:executionId`  | GET    | Get planning status       |
| `/api/planning/prds/:prdId`          | GET    | Get PRD details           |
| `/api/planning/prds/:prdId/brief`    | GET    | Get generated brief       |

### 8.2 WebSocket Events

| Event                        | Direction       | Payload                       |
| ---------------------------- | --------------- | ----------------------------- |
| `planning:readiness_changed` | Server → Client | `{ sessionId, score, ready }` |
| `planning:started`           | Server → Client | `{ sessionId, executionId }`  |
| `planning:prd_created`       | Server → Client | `{ prdId, title }`            |
| `planning:completed`         | Server → Client | `{ prdId, taskListId }`       |
| `planning:error`             | Server → Client | `{ error, phase }`            |

---

## 9. Migration Plan

### 9.1 Phase 1: Create Planning Agent (Week 1)

- [ ] Create `coding-loops/agents/planning_agent/` directory
- [ ] Implement `worker.py` with observability integration
- [ ] Implement `readiness_detector.py`
- [ ] Implement `prd_generator.py`
- [ ] Create database migration for `planning_agent_executions` table
- [ ] Add API endpoints

### 9.2 Phase 2: Port Specification Agent (Week 2)

- [ ] Port `BriefParser` to Python
- [ ] Port `TaskGenerator` to Python
- [ ] Port `GotchaInjector` to Python
- [ ] Implement `spec_generator.py`
- [ ] Test spec generation matches TypeScript output

### 9.3 Phase 3: Integration (Week 3)

- [ ] Wire up Ideation → Planning trigger
- [ ] Wire up Planning → Task Agent handoff
- [ ] Update UI to show planning status
- [ ] Add planning progress indicators

### 9.4 Phase 4: Deprecation (Week 4)

- [ ] Update all Specification Agent references to Planning Agent
- [ ] Remove TypeScript Specification Agent files
- [ ] Update CLAUDE.md with new agent flow
- [ ] Update documentation

---

## 10. Database Changes

### 10.1 New Table: `planning_agent_executions`

```sql
-- Migration XXX: Planning Agent execution tracking

CREATE TABLE IF NOT EXISTS planning_agent_executions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,

    -- Readiness state at trigger
    readiness_score REAL NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto', 'manual', 'periodic')),

    -- Output references
    prd_id TEXT REFERENCES prds(id),
    task_list_id TEXT REFERENCES task_lists_v2(id),
    brief_path TEXT,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT,

    -- Timing
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,

    UNIQUE(session_id, execution_id)
);

CREATE INDEX IF NOT EXISTS idx_planning_executions_session ON planning_agent_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_planning_executions_status ON planning_agent_executions(status);
```

### 10.2 New Column: `ideation_sessions.planning_status`

```sql
-- Migration XXX: Add planning status to ideation sessions

ALTER TABLE ideation_sessions
ADD COLUMN planning_status TEXT DEFAULT 'not_ready'
CHECK (planning_status IN ('not_ready', 'ready', 'in_progress', 'completed'));

ALTER TABLE ideation_sessions
ADD COLUMN planning_readiness_score REAL DEFAULT 0;

ALTER TABLE ideation_sessions
ADD COLUMN planning_execution_id TEXT;
```

---

## 11. Success Criteria

### 11.1 Functional Requirements

- [ ] Planning Agent auto-detects readiness with ≥90% accuracy
- [ ] PRD generation completes in <30 seconds
- [ ] Generated PRDs have all required fields populated
- [ ] Task lists are correctly linked to PRDs
- [ ] Observability data flows to all tables

### 11.2 Non-Functional Requirements

- [ ] No user intervention required for auto-trigger
- [ ] Graceful handling of ideation session changes during planning
- [ ] Clear error messages when planning fails
- [ ] Rollback capability if planning partially completes

### 11.3 Validation Commands

```bash
# Test readiness detection
python3 coding-loops/agents/planning_agent/worker.py --check-readiness --session-id <id>

# Test PRD generation
python3 coding-loops/agents/planning_agent/worker.py --generate-prd --session-id <id>

# Test full flow
python3 coding-loops/agents/planning_agent/worker.py --execute --session-id <id>

# Verify database
sqlite3 database/ideas.db "SELECT * FROM prds WHERE slug LIKE 'test-%'"
```

---

## 12. Related Documents

| Document                                                                                    | Purpose                       |
| ------------------------------------------------------------------------------------------- | ----------------------------- |
| [SPEC.md](../observability/SPEC.md)                                                         | Observability system spec     |
| [AGENT-INTEGRATION-TEMPLATE.md](../observability/AGENT-INTEGRATION-TEMPLATE.md)             | Agent integration pattern     |
| [BUILD-AGENT-GAP-REMEDIATION-PLAN.md](../observability/BUILD-AGENT-GAP-REMEDIATION-PLAN.md) | Build Agent improvements      |
| [agents/specification/core.ts](../../../agents/specification/core.ts)                       | TypeScript Spec Agent to port |

---

## 13. Open Questions

1. **Complexity Estimation**: How should Planning Agent estimate complexity for brief generation?
   - Option A: Use Claude to analyze PRD
   - Option B: Heuristic based on success criteria count
   - Option C: User input during ideation

2. **Partial Progress**: If ideation continues after planning starts, should Planning Agent re-run?
   - Option A: Lock ideation during planning
   - Option B: Track version and re-run if changed
   - Option C: Ignore changes, user can manually re-plan

3. **Multi-PRD Support**: Can one ideation session produce multiple PRDs?
   - Option A: One session = one PRD
   - Option B: Support child PRDs for feature ideas
   - Option C: User-triggered split

---

_The Planning Agent bridges the gap between exploration and execution._
