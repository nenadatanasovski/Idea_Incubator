# Vibe Platform — System Architecture Knowledge Graph

**Analysis Date:** 2026-01-25
**Total Artifacts Analyzed:** 18 specs, briefs, and task lists
**System Completion:** 25-30% autonomous (89% Build Agent complete, other agents 0-60%)

---

## Executive Summary

**Vibe** is an AI-powered autonomous multi-agent development platform that guides non-technical users from vague ideas to fully deployed applications through:

1. **Conversational ideation** (Ideation Agent)
2. **Technical specification generation** (Specification Agent)
3. **Parallel code execution** (Build Agent with wave-based parallelism)
4. **Continuous learning** (Self-Improvement Agent / SIA)
5. **Quality assurance** (Validation Agent + UX Testing Agent)
6. **Human oversight** (PM Agent, Monitor Agent, Telegram interface)

### Critical Insight

> "When an agent says 'TEST PASSED', how do we know it actually passed?"
>
> Without independent verification, the agent could be hallucinating. The Verification Gate solves this.

---

## Core Agent System Architecture

### Pipeline Agents (Sequential Handoff)

```
User Idea
    ↓
[IDEATION AGENT] ── outputs: README.md, target-users.md, problem-solution.md, planning/brief.md
    ↓
[SPECIFICATION AGENT] ── outputs: build/spec.md, build/tasks.md, build/decisions.md
    ↓
[BUILD AGENT] ── outputs: git commits, code changes, execution logs
    ↓
[VALIDATION AGENT] ── verifies: coverage, security, spec compliance
    ↓
[UX TESTING AGENT] ── validates: usability, accessibility, performance
    ↓
[DEPLOYED APP]
```

### Infrastructure Agents (Parallel Support)

| Agent                            | Purpose                                                          | Status          |
| -------------------------------- | ---------------------------------------------------------------- | --------------- |
| **Self-Improvement Agent (SIA)** | Diagnoses stuck Build Agents, extracts patterns, improves system | 20% (specified) |
| **Monitor Agent**                | Watches all agents, detects anomalies, triggers alerts           | 20% (partial)   |
| **PM Agent**                     | Coordinates priorities, resolves conflicts, escalates decisions  | 15% (specified) |
| **Verification Gate**            | Independent validation of agent claims                           | 0% (needed)     |
| **Message Bus**                  | Event-driven inter-agent communication                           | 60% (partial)   |
| **Knowledge Base**               | Stores gotchas, patterns, decisions; queried by Build Agent      | 50% (partial)   |
| **Resource Registry**            | Tracks file ownership; prevents concurrent modifications         | 0% (specified)  |

---

## Key Problems Being Solved

### By Agent Type

**Ideation Agent:**

- How to extract coherent product ideas from vague user concepts?
- How to validate ideas before specification work begins?
- How to structure handoff to specification work?

**Specification Agent:**

- How to translate domain knowledge into implementable technical requirements?
- How to break monolithic features into atomic, parallelizable tasks?
- How to capture architectural decisions for future reference?

**Build Agent:**

- How to execute long-running code generation tasks reliably?
- How to recover from failures without human intervention?
- How to parallelize safely without file conflicts?
- How to generate code that passes all validation checks?

**SIA (Self-Improvement Agent):**

- How to detect when an agent is stuck in a loop?
- How to diagnose root causes of repeated failures?
- How to propagate learned patterns to all agents?
- How to improve system without human intervention?

**System Level:**

- How do multiple agents avoid overwriting each other's work?
- How do we know agents aren't hallucinating success?
- How do we detect and recover from cascading failures?
- How do agents learn from mistakes and improve over time?

---

## Critical Dependencies & Execution Order

### Must Be Built First (Foundation)

1. **Message Bus** — All inter-agent communication depends on this
2. **Resource Registry** — Build Agent needs this to prevent file conflicts
3. **Knowledge Base** — SIA and Build Agent need this for learning/gotchas

### Then Build in Sequence

4. **Specification Agent** — Generates tasks for Build Agent
5. **Build Agent Core** — Core value delivery (PIV loop, validation, error recovery)
6. **Parallel Execution** — Wave calculation, conflict detection, multi-agent spawn
7. **SIA Agent** — Enables self-healing
8. **Validation Agent** — Quality assurance gate
9. **UX Testing Agent** — Usability validation
10. **Monitor + PM Agents** — System coordination and oversight

### Why This Order Matters

- Build Agent can't execute without Specification Agent output
- Parallel execution can't work without Resource Registry
- SIA can't learn without Knowledge Base
- System can't coordinate without Message Bus

---

## Architectural Patterns

### 1. PIV Loop (Prime-Iterate-Validate)

Used by **Build Agent** and **SIA Agent**:

```
PRIME       ← Load all context (spec, tasks, conventions, gotchas)
  ↓
ITERATE     ← Execute tasks with error handling, retries, checkpoints
  ↓
VALIDATE    ← Multi-level testing (syntax → unit tests → integration → performance)
  ↓
COMPLETE    ← Move to next task or escalate
```

### 2. Wave-Based Parallelism

Build Agent executes independent tasks in parallel waves:

```
Wave 0: [Task A] [Task B] [Task C]  ← All 3 execute simultaneously
           ↓
Wave 1:    [Task D] [Task E]  ← These depend on A, B, or C; execute after Wave 0 completes
           ↓
Wave 2:       [Task F]
```

**Benefit:** Provably optimal parallelism, no deadlocks, no file conflicts

### 3. Event-Driven Orchestration

Agents communicate via **Message Bus** events:

```
Spec Agent: "tasklist.generated" → Build Agent spawns
Build Agent: "task.started" → Monitor/PM agents listen
Build Agent: "build.stuck" → SIA spawns for analysis
SIA: "pattern.extracted" → Knowledge Base records for future use
```

**Benefit:** Loose coupling, asynchronous coordination, full audit trail

### 4. Checkpoint & Rollback

On task failure, revert to clean state:

```
Before task: git commit (create checkpoint)
  ↓
Execute task + validate
  ↓
On success: commit changes
On failure: git reset --hard <checkpoint>
```

**Benefit:** Failed tasks don't corrupt codebase; enables safe retries

### 5. Knowledge Sharing Across Agents

**Knowledge Base** stores discovered gotchas, patterns, and decisions:

```
Build Agent encounters error → discovers gotcha
  ↓
SIA records: "Use parameterized queries, not string concat" (confidence: 0.9)
  ↓
Next Build Agent on similar task → queries Knowledge Base
  ↓
Gets back: "Use parameterized queries" (confidence: 0.9)
  ↓
Injects into prompt → avoids repeating mistake
```

**Benefit:** System learns; same errors don't repeat twice

### 6. Independent Verification Gate

**Problem solved:** Agent claims "TEST PASSED" — but is it true?

**Solution:** Separate component verifies:

- Tests actually pass
- Code compiles and type-checks
- Implementation matches specification
- Acceptance criteria met

**Benefit:** Catches hallucinations; enables trust in system

---

## Build Agent Execution Flow (Detailed)

### Prime Phase (Load Context)

```python
Load from database:
  - Task list metadata
  - Tasks in dependency order
  - Execution resumption context (last 500 log lines)

Load from files:
  - build/spec.md (technical specification)
  - CLAUDE.md (conventions, patterns, gotchas)
  - idea README (context about what we're building)

Load from Knowledge Base:
  - Gotchas for file patterns touched by this task
  - Patterns for action type (CREATE/UPDATE/DELETE)
  - Similar past failures and resolutions
```

### Iterate Phase (Execute Tasks)

For each task in assigned wave:

```
1. Can execute? Check:
   - Dependencies complete
   - File ownership (not owned by other agent)
   - File not locked by other agent

2. Load context:
   - Task-specific gotchas from Knowledge Base
   - Code templates from task definition

3. Acquire lock on files this task will modify

4. Create git checkpoint (pre-task state)

5. Build Claude prompt:
   - Task description + requirements
   - Gotchas to avoid (CRITICAL MISTAKES section)
   - Project conventions from CLAUDE.md
   - Code template as starting point
   - Validation command expected to pass

6. Generate code via Claude API

7. Write generated code to file

8. Run validation command (e.g., 'npm test --grep <file>')

9. If validation passes:
   - Commit changes to git
   - Record any discoveries (new gotchas, patterns)
   - Publish task.completed event
   - Release file lock

   If validation fails:
   - Rollback to checkpoint
   - Record error signature
   - Check if this is a retryable error
   - Retry with error context OR mark failed
   - Release file lock
```

### Validate Phase (Multi-Level Testing)

```
Level 1 (always): TypeScript compilation, linting
  └─ Stop if fails

Level 2 (if server/ files modified): Unit tests, API tests, migrations

Level 3 (if frontend/ files modified): Component tests, UI tests

Level 4 (optional): Performance tests, security scans, load tests
```

### Error Handling & Retry

```
Classify error type:
  - SYNTAX_ERROR → Retry with error context (max 3 attempts)
  - VALIDATION_FAILED → Retry (max 2 attempts)
  - MISSING_DEPENDENCY → Install and retry
  - CONFLICT → Rebase and retry
  - Unknown → Escalate to SIA

Exponential backoff: [1s, 5s, 15s]
```

### SIA Escalation Criteria

```
If task has:
  - 3+ failed execution attempts AND
  - No progress detected (same error, no git commits, no file changes)

Then:
  1. Build Agent publishes "build.stuck" event
  2. Task Agent spawns SIA with failure context
  3. SIA analyzes execution logs, error patterns, code state
  4. SIA proposes: fix approach OR task decomposition
  5. Task Agent creates follow-up tasks from SIA output
  6. Task Agent re-queues task list for Build Agent retry
```

---

## Self-Improvement Agent (SIA) Workflow

### When Does SIA Activate?

```
By Build Agent when:
  ✓ Task has 3+ failed execution attempts
  ✓ Same error message repeating
  ✓ No new git commits between attempts
  ✓ No files modified
  ✓ Validation score not improving
```

### What Does SIA Do?

```
1. LOAD CONTEXT
   - Execution record (all task results)
   - Spec & tasks files (planned approach)
   - Git diff (what actually changed)
   - Test results (what failed)
   - Previous similar reviews (patterns)

2. ANALYZE
   - Compare plan vs actual (divergences)
   - Extract error patterns (what's repeating?)
   - Identify root causes (why is it stuck?)
   - Look for similar past failures

3. DECIDE
   - Is this a GOOD divergence? (enhancement, optimization)
   - Is this a BAD divergence? (mistake, shortcut, deviation)
   - Should we record a gotcha? (to prevent repeating)
   - Should we update CLAUDE.md? (universal pattern?)

4. PROPOSE
   - Fix approach: "Try decomposing into sub-tasks"
   - Alternative strategy: "Use different library/pattern"
   - Root cause fix: "The real problem is X, not Y"

5. PROPAGATE
   - Record gotcha in Knowledge Base (high confidence)
   - Update CLAUDE.md with universal patterns
   - Suggest template improvements
   - Create follow-up tasks for Task Agent
```

### SIA Output Example

```
FAILURE: Task "Build user authentication" failed 3 times
Same error: "password reset endpoint returns 404"

ANALYSIS:
- Spec treats as single monolithic task
- Actually 5 interdependent components: registration, login, reset, 2FA, recovery
- Agent trying to build all 5 simultaneously
- One component incomplete → others fail

DECISION: Decompose into 5 atomic sub-tasks

GOTCHA RECORDED:
  "Auth features are interdependent. Build sequentially:
   registration → login → email verify → password reset → recovery"
  (confidence: 0.95, applies to: **/auth/**  files)

FOLLOW-UP TASKS:
  - Sub-task 1: Build registration endpoint
  - Sub-task 2: Build login endpoint
  - Sub-task 3: Build email verification
  - Sub-task 4: Build password reset
  - Sub-task 5: Build recovery codes
```

---

## Constraints & Gotchas

### Critical System Constraints

| Constraint                               | Impact                          | Mitigation                           |
| ---------------------------------------- | ------------------------------- | ------------------------------------ |
| **API costs scale with agent execution** | Can burn credits quickly        | Budget Manager needed                |
| **File conflicts prevent parallelism**   | Complex tasks can't parallelize | Pre-execution conflict detection     |
| **Task atomicity determines speed**      | Poor boundaries block agents    | Specification Agent quality critical |
| **Knowledge Base grows unbounded**       | Queries get slow over time      | Index optimization needed            |
| **Agent output quality varies**          | Some tasks fail validation      | Validation Agent provides gate       |

### Build Agent Gotchas (Must Avoid!)

1. **Gotchas must be injected into prompt BEFORE execution**
   - Discovering after failure reduces effectiveness
   - Build Agent should load gotchas in Prime phase

2. **Validation commands must be idempotent and fast (< 30s)**
   - Slow validation kills iteration speed
   - Idempotent = running twice = same result

3. **Checkpoint must be created BEFORE task execution**
   - Post-execution checkpoints are useless
   - Must: commit → execute → validate → rollback if needed

4. **File locks must be released even on failure**
   - Locked files block dependent tasks forever
   - Always release in finally block

5. **Exit codes determine success/failure**
   - Exit 0 = success, non-zero = failure
   - Task status comes from exit code, not log messages

### SIA Gotchas (Must Avoid!)

1. **SIA triggers on 3+ failures AND no progress**
   - Too early: wastes resources on fixable issues
   - Too late: blocks too long waiting for escalation

2. **Pattern extraction requires multiple occurrences**
   - Single error is NOT a pattern
   - Don't pollute Knowledge Base with rare issues

3. **Circular dependencies in decomposition create loops**
   - SIA must detect before proposing
   - Verify new tasks don't depend on each other circularly

4. **CLAUDE.md updates are global**
   - Changes affect ALL future agents
   - Only record high-confidence (0.9+) patterns

### Specification Agent Gotchas

1. **Task boundaries are critical to parallelism**
   - Too fine: overhead kills speed
   - Too coarse: loses parallelism benefits

2. **Task dependencies must be explicit**
   - Implicit dependencies cause deadlocks
   - Specify `depends_on: [task_id, ...]`

3. **Code templates must be valid starting points**
   - Incomplete templates confuse code generation
   - Template must compile if passed to Build Agent

4. **File ownership must be registered before Build Agent**
   - Unregistered files cause conflicts
   - Register in Resource Registry during spec phase

### Deployment Constraints

| Constraint              | Details                                                                | Workaround                      |
| ----------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| **Reagraph version**    | 4.30.7 breaks with "Cannot read properties of undefined (reading 'S')" | Pin to 4.18.1                   |
| **Python version**      | Must use python3, not python                                           | Use python3 explicitly in spawn |
| **Database migrations** | Must be idempotent (safe to run twice)                                 | Always use IF NOT EXISTS        |
| **Git commits**         | Build Agent commits need valid author                                  | Use bot email in git config     |
| **Timeouts**            | No async operations >30min                                             | Need longer timeout strategy    |

---

## Timeline & Implementation Phases

### Vibe 90-Day Action Plan

| Period         | Focus        | Key Deliverables                                                     |
| -------------- | ------------ | -------------------------------------------------------------------- |
| **Days 1-30**  | Foundation   | Ideation agent polish, collaboration framework, orchestrator routing |
| **Days 31-60** | Core loop    | Specification agent, Build Agent foundation, SIA v1                  |
| **Days 61-90** | Launch ready | Hosting, credit system, UX polish, soft launch                       |
| **Post-90**    | Scale phase  | Based on traction: either accelerate or reassess                     |

### Implementation Order (Dependency-Driven)

**Phase 1 (1-2 weeks):** Foundation

- Message Bus infrastructure
- Resource Registry implementation
- Knowledge Base storage + query APIs

**Phase 2 (1-2 weeks):** Specification Agent

- API endpoints for spec generation
- Atomic task breakdown
- Dependency analysis

**Phase 3 (2-3 weeks):** Build Agent Core

- Python worker implementation
- PIV loop (Prime, Iterate, Validate)
- Checkpoint/rollback mechanism

**Phase 4 (1-2 weeks):** Parallel Execution

- Wave calculation from DAG
- Multi-agent spawn/coordination
- File conflict detection

**Phase 5 (1-2 weeks):** Error Recovery & SIA

- Retry logic with backoff
- SIA implementation
- Pattern propagation

**Phase 6 (1 week):** Monitoring & PM Agent

- Monitor Agent implementation
- PM Agent coordination
- Health alerts

**Phase 7 (1-2 weeks):** Quality Assurance

- Validation Agent (test generation, security scanning)
- UX Testing Agent (Puppeteer-based journeys)
- Independent verification

**Phase 8 (1-2 weeks):** Human Interface & Integration

- Telegram command interface
- Web dashboard
- E2E testing

### Current Implementation Status

| Component           | Status       | Percentage                               |
| ------------------- | ------------ | ---------------------------------------- |
| Build Agent         | Implementing | 89% (100 tasks defined, mostly complete) |
| Specification Agent | Not started  | 0%                                       |
| SIA Agent           | Specified    | 20%                                      |
| Validation Agent    | Specified    | 30%                                      |
| UX Testing Agent    | Specified    | 25%                                      |
| Monitor Agent       | Partial      | 20%                                      |
| PM Agent            | Specified    | 15%                                      |
| Message Bus         | Partial      | 60%                                      |
| Knowledge Base      | Partial      | 50%                                      |
| Resource Registry   | Specified    | 0%                                       |

---

## Success Criteria

### Build Agent P0 (Critical Path)

- [ ] Test 11: Telegram `/execute` command shows approval
- [ ] Test 12: Python worker executes task, exits with correct code
- [ ] Test 13: Task completion triggers Telegram notification

### Build Agent P1 (Core Functionality)

- [ ] Single task execution (pending → completed)
- [ ] Multi-task sequential execution with dependencies
- [ ] Parallel execution (2+ agents in Wave 0 simultaneously)
- [ ] Failure and retry (3 retries with exponential backoff)
- [ ] SIA escalation (build.stuck event triggers analysis)
- [ ] Heartbeat monitoring (30s intervals, stale detection)
- [ ] Full pipeline E2E (Telegram → grouping → execution → completion)

### System-Level Success

- [ ] Build Agent 80%+ first-pass success rate
- [ ] 3+ tasks execute in parallel without conflicts
- [ ] SIA fixes stuck Build Agent within 3 attempts
- [ ] Validation Agent catches 90%+ of bugs
- [ ] UX Testing Agent identifies usability issues
- [ ] Full flow: idea → spec → code → deployed app
- [ ] System learns: same error doesn't repeat twice

---

## Key Insights & Unresolved Questions

### Critical Realizations

✅ **Without independent verification, agents can claim success without proof** — the Verification Gate is essential, not optional

✅ **Task atomicity is fundamental** — poor task boundaries make parallel execution impossible

✅ **Knowledge Base is the learning mechanism** — without it, same errors repeat forever

✅ **Wave-based parallelism is provably optimal** — better than other execution strategies

✅ **SIA only helps with consistent failures** — it cannot diagnose one-off issues

### Architectural Insights

✅ Event-driven orchestration > synchronous RPC (enables late binding, loose coupling)

✅ Checkpoint/rollback > perfect code generation (allows safe retries)

✅ Message Bus with timeline > blackboard (enables auditability and causality)

✅ Confidence-scored gotchas > all gotchas (prevents low-quality entries from polluting)

✅ Wave calculation is deterministic (no need for heuristics)

### Unresolved Questions

❓ How to handle tasks requiring domain expertise Build Agent lacks?

❓ How to prevent SIA from oscillating between two failing approaches?

❓ How to validate generated code actually solves user's problem (not just tech requirements)?

❓ How to cost-optimize API calls at scale?

❓ How to handle async operations taking >30 minutes?

---

## Document References

This analysis synthesizes insights from 18 artifacts:

**Core Specifications:**

- `docs/specs/AGENT-ARCHITECTURE.md`
- `docs/specs/BUILD-AGENT-IMPLEMENTATION-PLAN.md` (100 tasks, 89% complete)
- `docs/specs/VALIDATION-AND-UX-AGENTS.md`
- `docs/specs/AGENT-SPECIFICATIONS-INFRASTRUCTURE.md`
- `docs/specs/PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md`

**System Design:**

- `coding-loops/20260107-multi-agent-coordination-system-FINAL.md` (15 components, 116 tests)
- `coding-loops/20260107-coding-loop-architecture-critique.md` (gap analysis)

**Product Direction:**

- `ideas/vibe/action-plan.md` (90-day timeline)
- `ideas/vibe/sia-loop-architecture.md`
- `ideas/vibe/autonomous-agent-system.md`
- `ideas/vibe/technical-architecture.md`

**Reference Materials:**

- `CLAUDE.md` (project rules)
- Build Agent appendices (types, database, Python skeleton, E2E tests)
- E2E scenario documentation

---

**Next Steps:**

1. Build Message Bus + Resource Registry (foundation)
2. Implement Specification Agent (generates tasks)
3. Complete Build Agent (execute tasks)
4. Add Parallel Execution (waves + conflict detection)
5. Implement SIA (self-healing)
