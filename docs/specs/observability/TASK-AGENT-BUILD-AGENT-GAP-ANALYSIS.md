# Task Agent → Build Agent E2E Flow: Gap Analysis

**Created:** 2026-01-17
**Purpose:** Comprehensive analysis of gaps between architecture spec and current implementation
**Status:** Critical issues identified - requires remediation before execution

---

## Executive Summary

The current Task Agent → Build Agent implementation has **significant gaps** that will prevent successful execution of the Observability Phase 3-5 tasks. While wave-based parallelism and dependency tracking work correctly, the Build Agent lacks per-task validation commands, acceptance criteria enforcement, and proper test execution.

### Severity Rating

| Component               | Status     | Severity |
| ----------------------- | ---------- | -------- |
| Wave Calculation        | ✅ WORKS   | -        |
| Dependency Tracking     | ✅ WORKS   | -        |
| File Conflict Detection | ✅ WORKS   | -        |
| Agent Spawning          | ✅ WORKS   | -        |
| Heartbeat System        | ✅ WORKS   | -        |
| Per-Task Validation     | ❌ MISSING | CRITICAL |
| Acceptance Criteria     | ❌ MISSING | CRITICAL |
| Test Execution (API/UI) | ❌ MISSING | HIGH     |
| Context Handoff         | ❌ MISSING | HIGH     |
| Iterate/Refine Loop     | ❌ MISSING | MEDIUM   |
| SIA Integration         | ❌ MISSING | LOW      |

---

## What Currently Works

### 1. Wave-Based Parallelism ✅

**File:** `server/services/task-agent/parallelism-calculator.ts`

The `calculateWaves()` function correctly:

- Queries `task_relationships` table for dependencies
- Queries `task_file_impacts` for file conflicts
- Groups tasks into parallel execution waves
- Stores wave assignments in `parallel_execution_waves` table

```typescript
// Wave calculation is correct
const waves = await calculateWaves(taskListId);
// Returns: [{ waveNumber: 1, tasks: [...] }, { waveNumber: 2, tasks: [...] }]
```

### 2. Dependency Tracking ✅

**Tables:** `task_relationships`, `tasks`

- `depends_on` relationships are correctly stored
- Build Agent Orchestrator checks dependencies before spawning agents
- Dependent tasks are blocked when a task fails

### 3. File Conflict Detection ✅

**Table:** `task_file_impacts`

- File operations (CREATE, UPDATE, DELETE, READ) are tracked
- Parallelism calculator detects conflicts
- Conflicting tasks are placed in separate waves

### 4. Agent Spawning ✅

**File:** `server/services/task-agent/build-agent-orchestrator.ts`

```typescript
// Spawns Python Build Agent with correct arguments
const agentProcess = spawn("python3", [
  "coding-loops/agents/build_agent_worker.py",
  "--agent-id",
  id,
  "--task-id",
  taskId,
  "--task-list-id",
  taskListId,
]);
```

### 5. Heartbeat System ✅

**File:** `coding-loops/agents/build_agent_worker.py`

- Background thread sends heartbeats every 30 seconds
- Heartbeats recorded in `agent_heartbeats` table
- Orchestrator detects unhealthy agents via missed heartbeats

---

## Critical Gaps

### GAP-001: No Per-Task Validation Commands 🔴 CRITICAL

**Expected Behavior:**
Each task should have its own validation command that runs after code generation:

```yaml
# From task definition
validation:
  command: "python3 -c 'from coding_loops.shared.observable_agent import ObservableAgent'"
  expected: "exit code 0"
```

**Actual Behavior:**
Build Agent Worker hardcodes a single validation command:

```python
# coding-loops/agents/build_agent_worker.py:942
command = "npx tsc --noEmit"  # HARDCODED!
```

**Database Gap:**

- `tasks` table has NO `validation_command` column
- `task_file_impacts` table has NO validation info
- `task_executions.validation_command` is for LOGGING only, not input

**Impact:**

- Python tasks (OBS-100 to OBS-110) will fail validation with TypeScript checker
- SQL migrations will fail validation
- All non-TypeScript tasks will fail

**Fix Required:**

1. Add `validation_command` column to `tasks` table
2. Modify Build Agent Worker to read and execute task-specific validation
3. Populate validation commands for all observability tasks

---

### GAP-002: No Acceptance Criteria Enforcement 🔴 CRITICAL

**Expected Behavior:**
Each task should have acceptance criteria that must pass:

```yaml
acceptance_criteria:
  - "ObservableAgent class exists in observable_agent.py"
  - "Class has emit_event() method"
  - "Unit tests pass"
```

**Actual Behavior:**
Build Agent Worker only uses `title` and `description`:

```python
# coding-loops/agents/build_agent_worker.py:529-540
row = self.db.query_one("""
    SELECT t.id, t.display_id, t.title, t.description, ...
    FROM tasks t WHERE t.id = ?
""")
# NO acceptance_criteria field!
```

**Database Gap:**

- `task_appendices` table CAN store 'acceptance_criteria' type
- But Build Agent Worker doesn't query `task_appendices`
- No structured acceptance criteria in `tasks` table

**Impact:**

- Tasks complete without verifying acceptance criteria
- No way to know if generated code actually meets requirements
- False positives: tasks marked "completed" that don't actually work

**Fix Required:**

1. Query `task_appendices` for acceptance_criteria in Build Agent Worker
2. Run acceptance criteria checks after validation
3. Fail task if any acceptance criterion is not met

---

### GAP-003: No 3-Level Test Execution 🟠 HIGH

**Expected Behavior (from architecture doc):**
| Level | What It Tests | Tools | When Required |
|-------|--------------|-------|---------------|
| Codebase | Syntax, types, lint, unit tests | `tsc`, `eslint`, `vitest` | ALL tasks |
| API | HTTP endpoints, responses | `supertest` | Tasks touching `server/` |
| UI | User flows, visual elements | Puppeteer (MCP) | Tasks touching frontend |

**Actual Behavior:**
Only TypeScript compilation runs:

```python
# coding-loops/agents/build_agent_worker.py:942
command = "npx tsc --noEmit"  # ONLY THIS RUNS
```

**Missing:**

- No `vitest` unit test execution
- No API endpoint testing via `supertest`
- No UI testing via Puppeteer MCP
- No detection of which test level is needed

**Impact:**

- Unit tests never run
- API routes never tested for correctness
- UI components never visually validated
- Bugs slip through to "completed" tasks

**Fix Required:**

1. Detect task type from file*impacts (is it server/*, frontend/\_, etc.)
2. Run appropriate test level(s) based on task type
3. Add test runner integration (vitest, supertest, Puppeteer MCP)

---

### GAP-004: No Context Handoff Between Agents 🟠 HIGH

**Expected Behavior (from architecture doc):**
When Build Agent 1 ends and Build Agent 2 takes over:

1. Build Agent 2 receives `execution_id` from Task Agent
2. Queries `task_execution_log` WHERE id = 'execution_id'
3. Reads LAST 500 LINES of that execution's log_content
4. Parses what was done, what remains
5. Resumes from where Agent 1 left off

**Actual Behavior:**
Build Agent Worker does NOT read any previous execution logs:

```python
# coding-loops/agents/build_agent_worker.py
# NO code to read previous execution logs
# NO execution_id lane isolation
# Each agent starts completely fresh
```

**Database Gap:**

- `task_execution_log` table doesn't exist
- `task_executions` stores per-task results, not continuous logs
- No "last 500 lines" mechanism

**Impact:**

- If agent times out mid-task, progress is lost
- New agent restarts from scratch
- No learning from previous attempts
- Context limit issues cause repeated work

**Fix Required:**

1. Create `task_execution_log` table with line-based logging
2. Build Agent Worker writes continuous logs during execution
3. Build Agent Worker reads previous logs on startup
4. Implement execution_id lane isolation for parallel agents

---

### GAP-005: No Iterate/Refine Loop 🟡 MEDIUM

**Expected Behavior (from architecture doc):**
When a task fails:

1. Build Agent attempts iterate/refine
2. Analyzes error message
3. Adjusts approach
4. Retries with improvements
5. If still failing, creates follow-up task

**Actual Behavior:**
Single attempt, then fail:

```python
# coding-loops/agents/build_agent_worker.py:468-489
if not result.success:
    self._record_failure(result.error_message)
    return 1  # IMMEDIATE FAIL - no retry!
```

**Impact:**

- Simple errors cause task failure
- No learning from validation errors
- Human must manually retry
- Lower success rate than possible

**Fix Required:**

1. Add retry loop with max_retries (config exists: `max_retries = 3`)
2. On validation failure, analyze error and adjust prompt
3. Include previous error in next generation attempt
4. Only fail after exhausting retries

---

### GAP-006: SIA Integration Missing 🟢 LOW

**Expected Behavior (from architecture doc):**
After 3+ failed attempts with no progress:

1. Task Agent spawns SIA Agent
2. SIA analyzes full execution log history
3. SIA outputs fix approach or task decomposition
4. Task Agent creates follow-up tasks

**Actual Behavior:**

- No SIA spawn mechanism
- No "no progress" detection
- No automatic task decomposition

**Impact:**

- Stuck tasks remain stuck
- No automatic learning/improvement
- Human must diagnose repeated failures

**Fix Required:**

1. Implement "no progress" detection in Task Agent
2. Create SIA spawn API endpoint
3. SIA reads execution history and proposes fixes
4. Task Agent creates follow-up tasks from SIA output

---

## Data Gaps in Observability Tasks

The tasks inserted in migration `090_observability_phases_3_4_5_tasks.sql` are missing:

### Missing Data Per Task

| Field               | Status           | Example Value Needed             |
| ------------------- | ---------------- | -------------------------------- |
| validation_command  | ❌ NOT IN SCHEMA | `python3 -c 'import ...'`        |
| acceptance_criteria | ❌ NOT IN SCHEMA | `["Class exists", "Tests pass"]` |
| code_template       | ❌ NOT IN SCHEMA | Boilerplate code                 |
| test_commands       | ❌ NOT IN SCHEMA | `pytest tests/unit/...`          |

### Required Schema Changes

```sql
-- Add to tasks table
ALTER TABLE tasks ADD COLUMN validation_command TEXT;
ALTER TABLE tasks ADD COLUMN test_commands TEXT; -- JSON array
```

Or use `task_appendices` table which already supports:

- `'acceptance_criteria'` type
- `'code_template'` type (add this)
- `'test_commands'` type (add this)

---

## Recommended Fix Order

### Phase 1: Critical Fixes (Must Have)

1. **Add validation_command to tasks** - 1 hour
   - Add column to tasks table
   - Modify Build Agent Worker to read and execute
   - Populate for observability tasks

2. **Add acceptance_criteria support** - 2 hours
   - Query task_appendices in Build Agent Worker
   - Create simple acceptance criteria checker
   - Fail task if criteria not met

### Phase 2: High Priority Fixes (Should Have)

3. **Multi-level test execution** - 4 hours
   - Detect task type from file paths
   - Run vitest for unit tests
   - Run supertest for API tests
   - Integrate Puppeteer MCP for UI tests

4. **Context handoff mechanism** - 4 hours
   - Create task_execution_log table
   - Write continuous logs during execution
   - Read previous logs on agent startup

### Phase 3: Medium Priority Fixes (Nice to Have)

5. **Iterate/refine loop** - 2 hours
   - Add retry logic in Build Agent Worker
   - Include previous error in retry prompts
   - Track retry attempts

6. **SIA integration** - 4 hours
   - Implement no-progress detection
   - Create SIA spawn mechanism
   - Task decomposition from SIA output

---

## Conclusion

**The Task Agent → Build Agent E2E flow will NOT work correctly for Observability Phase 3-5 tasks without fixes.**

Key blockers:

1. All Python tasks will fail TypeScript validation
2. No acceptance criteria enforcement
3. No proper test execution

Estimated time to reach minimum viable execution: **7-8 hours**

The wave-based parallelism, dependency tracking, and file conflict detection are solid foundations. The gaps are in the "last mile" execution logic within the Build Agent Worker.
