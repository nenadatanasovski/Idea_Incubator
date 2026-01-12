# Task Agent Documentation Critical Review

**Created:** 2026-01-12
**Updated:** 2026-01-12
**Purpose:** Identify gaps between questionnaire answers and implemented documentation
**Status:** ✅ RESOLVED - All decisions confirmed

---

## Executive Summary

After analyzing all 31 questionnaire answers against the documents created, I identified:

- **17 items covered well**
- **8 potential gaps or unclear areas** → ✅ All resolved
- **3 agent boundary issues requiring clarification** → ✅ All resolved
- **1 MAJOR architectural inconsistency** → ✅ Resolved

### Confirmed Decisions (2026-01-12)

| # | Decision | Status |
|---|----------|--------|
| 1 | Merge Spec Agent into Task Agent | ✅ Confirmed |
| 2 | Task Agent creates follow-up tasks (never Build Agent) | ✅ Confirmed |
| 3 | Trigger Build Agent on `tasklist.ready` (not `spec.approved`) | ✅ Confirmed |
| 4 | SIA spawned by Task Agent after 3+ failures with no progress | ✅ Confirmed |
| 5 | Build Agent session handoff via Database (not message bus) | ✅ Confirmed |

---

## MAJOR INCONSISTENCY: Build Agent Trigger Source

### The Problem

The existing AGENT-SPECIFICATIONS.md says Build Agent triggers on:
```
Event "spec.approved"
```

But per the questionnaire (Q17, Q18, Q24):
- Task Agent orchestrates TASK LISTS (not specs)
- Task Agent sends approved TASK LISTS to Build Agent
- Build Agent should trigger on `tasklist.ready` from Task Agent

### Current Flow (AGENT-SPECIFICATIONS.md):
```
Spec Agent → spec.approved → Build Agent
```

### Intended Flow (Per Questionnaire):
```
Spec Agent → creates tasks → Task Agent validates/groups → tasklist.ready → Build Agent
```

### Required Fix:
1. Update Build Agent trigger in AGENT-SPECIFICATIONS.md from `spec.approved` to `tasklist.ready`
2. Update Build Agent context loading to load from task_lists table, not spec files
3. Clarify the flow: Spec Agent creates tasks → Tasks go to DB → Task Agent groups into lists → Build Agent executes lists

---

## Gap Analysis: Questionnaire vs Documentation

### Covered Well (17 items)

| Q# | Topic | Status | Notes |
|----|-------|--------|-------|
| Q1 | Task/List Hierarchy | ✓ | Junction table with position |
| Q2 | Task List Scope | ✓ | Hierarchical: Projects > Ideas > Lists |
| Q3 | Relationship Types | ✓ | All 11 types documented |
| Q4 | Graph Visualization | ✓ | D with filtering, types defined |
| Q5 | Ready Definition | ✓ | Three-level tests, approval toggle |
| Q6 | Success Evidence | ✓ | Standard with expand |
| Q15 | Priority Formula | ✓ | BlockedCount×20 + QuickWin + Deadline + Advice |
| Q16 | Persona | ✓ | Approachable, witty, examples provided |
| Q17 | Agent Delineation | ✓ | Task orchestrates, Build executes |
| Q20 | Task Naming | ✓ | Format documented |
| Q21/22 | DB Source of Truth | ✓ | DB only, no MD files |
| Q24 | Task Lists Focus | ✓ | "NEVER individual tasks, ALWAYS task lists" |
| Q25 | One Chat Per List | ✓ | telegram_chat_id on task_lists |
| Q26 | Three-Level Tests | ✓ | Codebase, API, UI |
| Q27 | Test Ownership | ✓ | Build determines task pass/fail |
| Q28 | Test Pass Criteria | ✓ | 100% required |
| Q31 | Task List Entity | ✓ | Comprehensive schema |

### Gaps or Unclear Areas (8 items)

#### Gap 1: Question Timeout Default Wording (Q8)

**Questionnaire Answer:**
> "Critical/High always asked; Medium/Low has toggle per task list, default OFF"

**Documentation Says (task-data-model.md):**
```typescript
type QuestionPriority =
  | 'medium'     // Toggle-controlled (default: ask)
  | 'low';       // Toggle-controlled (default: skip)
```

**Issue:** The comment says "default: ask" but the toggle `auto_answer_medium_low` defaults to 0 (off), which means "always ask". The documentation is **technically correct** but the comment is confusing. The table says:

```sql
auto_answer_medium_low INTEGER NOT NULL DEFAULT 0,   -- Toggle per Q8 (default off)
```

**Resolution:** Clarify comments - "default: 0" means "auto-answer is OFF" which means "always ask user"

#### Gap 2: Stale Threshold and Daily Summary Time Not Configurable (Q11)

**Questionnaire Answer:**
> Stale threshold (days): ____________________________________
> Daily summary time: ________________________________________

**Issue:** These were left blank by user but I hardcoded:
- Stale threshold: 7 days (mentioned in test plan)
- Daily summary: not explicitly configurable

**Resolution:** Add to TaskAgentConfig:
```typescript
staleness: {
  thresholdDays: number;  // Default: 7
};
suggestionLoop: {
  dailySummaryTime: string;  // Default: "09:00"
};
```

#### Gap 3: Follow-Up Task Creation on Test Failure (Q14)

**Questionnaire Answer:**
> "A - with the important option to create a new task focused on the remaining test that needs to pass"

**Documentation Says:**
- "If still failing, option to create new follow-up task"
- But doesn't specify WHO creates it

**Issue:** Unclear whether Task Agent or Build Agent creates follow-up tasks.

**Resolution:** Add clarity - Task Agent creates follow-up tasks because:
1. Task Agent owns task lifecycle
2. Build Agent should stay focused on execution
3. Task Agent has context to properly categorize the new task

#### Gap 4: Build Agent Auto-Iteration Clarity (Q18)

**Questionnaire Answer:**
> "Build Agent works through task list task per task automatically without needing the Task Agent to tell the build agent to go to the next task"

**Documentation Says:**
- "Build Agent works through tasks automatically"
- "No per-task approval from Task Agent"

**Issue:** While mentioned, this critical behavior could be more explicit.

**Resolution:** Add explicit statement:
```
BUILD AGENT AUTONOMY: Once Task Agent hands off a task list, the Build Agent:
1. Executes tasks sequentially without prompting Task Agent
2. Handles failures internally (iterate/refine loop)
3. Only communicates back on list completion OR critical failure
4. Does NOT ask Task Agent "what next?" between tasks
```

#### Gap 5: Task Agent Advice Factor Details (Q15)

**Questionnaire Answer:**
> "+Task Agent advice based on their understanding on best practice"

**Documentation Says:**
- TaskAgentAdvice: +0 to +20 based on best practices analysis

**Issue:** "Best practices analysis" is vague. What exactly does this mean?

**Resolution:** Define specific advice factors:
```typescript
taskAgentAdvice: {
  technicalDebtImpact: number;     // +5 if reduces tech debt
  testCoverageBoost: number;       // +5 if improves coverage
  codeQualitySignal: number;       // +5 if addresses known issues
  userActivityPattern: number;     // +5 if aligns with user's work hours
}
```

#### Gap 6: Telegram Chat Switching UX (Q25)

**Questionnaire Answer:**
> "if multiple task lists are running in parallel, we need to make sure that the user can switch between different chats to answer questions deriving from different task lists"

**Issue:** Documentation mentions one chat per list but doesn't describe how user navigates between them.

**Resolution:** Add UX note:
```
PARALLEL LIST NAVIGATION:
- Main Telegram chat shows summary of all active lists
- Each list has dedicated chat thread
- /lists command shows all active chats with quick-switch links
- Questions clearly identify which list they belong to
```

#### Gap 7: "Reprioritize" Option Implementation (Q10)

**Questionnaire Answer:**
> "There should be an option 'reprioritise' with a free text to specify how/why/when"

**Documentation Says:**
- Listed in defer options
- Has API endpoint: `/api/questions/:id/reprioritize`

**Issue:** What happens with the free text? How does it affect the task?

**Resolution:** Add clarity:
```typescript
// Reprioritize creates a note on the task
interface ReprioritizeAction {
  taskId: string;
  reason: string;              // Free text from user
  newPosition?: number;        // Optional: reorder in list
  effectivePriority: number;   // Computed after reprioritize
}
```

#### Gap 8: Task Agent vs Spec Agent Relationship

**Issue:** The questionnaire focused on Task Agent but didn't clarify:
- Does Spec Agent still exist?
- Does Spec Agent create tasks or just specs?
- How do tasks get from Spec Agent output to Task Agent input?

**Current Understanding (implied):**
1. Spec Agent generates spec.md with requirements
2. Spec Agent (or Task Agent?) creates tasks from spec
3. Tasks go into DB
4. Task Agent groups tasks into task lists
5. Task Agent validates and suggests lists
6. Build Agent executes approved lists

**Resolution Needed:** Clarify the Spec Agent → Task Agent handoff:
- Option A: Spec Agent creates tasks directly in DB
- Option B: Task Agent parses spec.md and creates tasks
- Option C: New "Task Creation" step between Spec and Task Agent

---

## Agent Boundary Analysis

### Issue 1: Who Creates Tasks?

| Current System | Task Agent System |
|----------------|-------------------|
| Spec Agent creates tasks in tasks.md | Tasks live in DB only |
| Build Agent executes from tasks.md | Build Agent executes from task_lists |

**Gap:** Spec Agent still references tasks.md but Task Agent expects DB.

**Resolution:** Update Spec Agent to:
1. Create tasks directly in DB (not MD)
2. Optionally group into initial task list
3. Notify Task Agent via event

### Issue 2: Stale vs Stuck Detection Overlap

| Detection | Owner | Threshold | Action |
|-----------|-------|-----------|--------|
| Stale (no activity) | Task Agent | 7+ days | Notify user, suggest action |
| Stuck (running too long) | Monitor Agent | 30+ min | Alert, possible interrupt |

**Analysis:** These are different concepts:
- Stale = Task sitting in pending, nobody working on it
- Stuck = Task started but not completing

**Verdict:** No overlap - clear distinction ✓

### Issue 3: Task Completion Marking

| Action | Owner | Rationale |
|--------|-------|-----------|
| Mark individual task complete | Build Agent | After tests pass |
| Mark task list complete | Task Agent | After all tasks done |
| Create follow-up task | Task Agent | Task lifecycle ownership |
| Retry failed task | Build Agent | Internal iteration loop |
| Escalate blocked task | Task Agent | User communication |

**Verdict:** Clear boundaries ✓

---

## First Principles Analysis: Are the Agent Boundaries Correct?

### Principle 1: Single Responsibility

Each agent should have ONE primary job:

| Agent | Primary Job | Secondary Jobs | Assessment |
|-------|-------------|----------------|------------|
| Task Agent | Orchestrate work | Validate, suggest, track | ✓ Focused |
| Build Agent | Execute code | Run tests, iterate | ✓ Focused |
| SIA | Learn from outcomes | Extract patterns | ✓ Focused |
| Monitor Agent | Watch health | Alert on issues | ✓ Focused |
| PM Agent | Resolve conflicts | Assign work | ✓ Focused |
| Spec Agent | Generate specs | Create tasks? | ? Unclear |

**Issue:** Spec Agent's relationship to Task Agent needs clarification.

### Principle 2: Information Hiding

Each agent should only know what it needs:

| Agent | Knows About | Should NOT Know |
|-------|-------------|-----------------|
| Task Agent | All tasks, lists, dependencies | Code implementation details |
| Build Agent | Current task list, code | Other lists, user preferences |
| SIA | Execution outcomes | User decisions |
| Monitor Agent | Component health | Task content |
| PM Agent | Resource conflicts | Task implementation |

**Assessment:** Clean boundaries ✓

### Principle 3: Minimal Communication

Agents should communicate through well-defined events, not shared state:

| Communication | Type | Assessment |
|---------------|------|------------|
| Task Agent → Build Agent | Event (tasklist.ready) | ✓ Clean |
| Build Agent → Task Agent | Event (tasklist.completed) | ✓ Clean |
| Build Agent → SIA | Event (build.completed) | ✓ Clean |
| Monitor → PM Agent | Event (alert.stuck) | ✓ Clean |
| User → Task Agent | Telegram messages | ✓ Clean |

**Assessment:** Event-driven communication ✓

### Principle 4: Failure Isolation

Failure in one agent shouldn't cascade:

| Failure | Impact | Isolation |
|---------|--------|-----------|
| Task Agent crash | Lists stop, Build continues | ✓ Build can finish current list |
| Build Agent crash | One list fails | ✓ Other lists unaffected |
| Telegram disconnect | No suggestions | ✓ Execution continues |

**Assessment:** Good isolation ✓

---

## Recommendations

### Priority 1: Fix Major Inconsistency

Update AGENT-SPECIFICATIONS.md Build Agent section:
```diff
- TRIGGER: Event "spec.approved"
+ TRIGGER: Event "tasklist.ready"
+          OR: Event "tasklist.retry"
```

### Priority 2: Clarify Spec Agent → Task Agent Flow

Document the handoff:
```
1. Spec Agent generates specification
2. Spec Agent creates tasks in DB (not MD)
3. Spec Agent publishes "tasks.created" event
4. Task Agent receives event
5. Task Agent validates tasks
6. Task Agent groups into task lists
7. Task Agent suggests lists to user
```

### Priority 3: Add Missing Configuration

```typescript
interface TaskAgentConfig {
  staleness: {
    thresholdDays: number;      // Default: 7
    checkIntervalHours: number; // Default: 6
  };
  suggestionLoop: {
    dailySummaryTime: string;   // Default: "09:00"
  };
  taskAgentAdvice: {
    maxBonus: number;           // Default: 20
    factors: string[];          // Listed factors
  };
}
```

### Priority 4: Update Test Plan

Add test case for:
- Build Agent autonomy (no Task Agent prompts between tasks)
- Follow-up task creation on failure
- Parallel list navigation in Telegram

---

## Summary

The documentation is **largely complete** with strong coverage of:
- Database schema
- API endpoints
- Event communication
- Telegram integration
- Priority formula

The main gaps are:
1. **Architectural inconsistency** between old spec.approved flow and new tasklist.ready flow
2. **Unclear Spec Agent → Task Agent handoff**
3. **Minor configuration gaps** (stale threshold, summary time)
4. **Implicit behaviors** that should be explicit (Build Agent autonomy)

None of these gaps prevent implementation, but they should be addressed before development begins.

---

## RESOLVED DECISIONS (2026-01-12)

### Decision 1: Merge Spec Agent into Task Agent ✅

**Rationale:**
- Spec Agent's task creation responsibility overlaps with Task Agent's task orchestration
- Eliminates unclear handoff between Spec Agent and Task Agent
- Single agent owns entire task lifecycle: creation → validation → grouping → suggestion → execution oversight

**New Task Agent Two-Phase Design:**

```
┌──────────────────────────────────────────────────────────────────┐
│                      MERGED TASK AGENT                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PHASE 1: SPECIFICATION (formerly Spec Agent)                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                       │
│  Input: Ideation artifacts (brief.md, research/, analysis/)       │
│  Process:                                                         │
│    1. Parse requirements from ideation documents                  │
│    2. Generate technical specification                            │
│    3. Decompose spec into atomic tasks                            │
│    4. Store tasks directly in database                            │
│  Output: Tasks in DB (not MD files)                               │
│                                                                   │
│  PHASE 2: ORCHESTRATION (existing Task Agent)                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                     │
│  Input: Tasks in DB                                               │
│  Process:                                                         │
│    1. Validate task completeness                                  │
│    2. Group tasks into task lists                                 │
│    3. Suggest task lists via Telegram                             │
│    4. Hand off approved lists to Build Agent                      │
│    5. Monitor execution, handle failures                          │
│  Output: Completed task lists, follow-up tasks                    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Decision 2: Task Agent Creates Follow-Up Tasks ✅

**Rationale:**
- Task Agent owns task lifecycle (not Build Agent)
- Build Agent stays focused on code execution
- Task Agent has context to categorize and prioritize new tasks

**Flow:**
```
Build Agent detects failure (3+ attempts, no progress)
    ↓
Build Agent publishes "task.failed" event with details
    ↓
Task Agent receives event
    ↓
Task Agent spawns SIA for analysis (see Decision 4)
    ↓
Task Agent creates follow-up task based on SIA output
    ↓
Follow-up task added to DB, queued for next list
```

### Decision 3: Trigger Build Agent on `tasklist.ready` ✅

**Rationale:**
- "Approved" is just one criterion for readiness
- Other criteria: dependencies resolved, tests defined, no blockers
- `tasklist.ready` is more semantically accurate

**Updated Trigger:**
```
OLD: Event "spec.approved"
NEW: Event "tasklist.ready" OR Event "tasklist.retry"
```

### Decision 4: SIA Spawned by Task Agent After 3+ Failures ✅

**Spawn Criteria:**
- Task has 3 or more failed execution attempts
- No progress detected between attempts

**"No Progress" Definition:**
- Same error message repeating
- No new Git commits between attempts
- No files modified
- Validation score not improving

**SIA Spawn Flow:**
```
Task Agent monitors task_execution_log
    ↓
IF (attempts >= 3) AND (no_progress):
    ↓
Task Agent spawns SIA Agent
    ↓
SIA analyzes: execution logs, error patterns, code state
    ↓
SIA proposes: fix approach OR task decomposition
    ↓
Task Agent creates follow-up tasks from SIA output
    ↓
Task Agent re-queues task list for Build Agent
```

### Decision 5: Build Agent Session Handoff via Execution Log ✅

**Key Insight:**
- Message bus is for **real-time events**, NOT session handoff
- **Execution log** (line-based) is what Build Agents use for handoff
- **execution_id** = "lane" that keeps parallel Build Agents isolated
- Build Agent 2 reads the **last 500 lines** of their execution_id lane to get bearings
- SIA reads the **full log** for pattern analysis

**Lane Isolation for Parallel Execution:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Build Agent A   │    │ Build Agent B   │    │ Build Agent C   │
│ exec-id: abc123 │    │ exec-id: def456 │    │ exec-id: ghi789 │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Task List A     │    │ Task List B     │    │ Task List C     │
│ (abc123 lane)   │    │ (def456 lane)   │    │ (ghi789 lane)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘

Each Build Agent ONLY reads/writes to their execution_id lane.
When Build Agent 2 takes over from Build Agent 1, they use the SAME execution_id.
```

**Handoff Mechanism:**

| Component | Purpose | Reader |
|-----------|---------|--------|
| **task_execution_log.log_content** | Line-based log of all actions taken | Build Agent (last 500 lines), SIA (full) |
| **tasks table** | Current status of each task | Build Agent |
| **knowledge_entries** | Discoveries and gotchas | Build Agent, SIA |
| **Git state** | Committed code changes | Build Agent |
| **file_locks** | File ownership | Build Agent |

**Execution Log Format (line-based):**
```
[2026-01-12T10:00:00Z] SESSION START: agent-session-abc
[2026-01-12T10:00:01Z] TASK: TU-PROJ-FEA-003 - Create user service
[2026-01-12T10:00:05Z] ACTION: Creating file server/services/user.ts
[2026-01-12T10:00:10Z] ACTION: Added UserService class skeleton
[2026-01-12T10:00:15Z] ACTION: Implemented login() method
[2026-01-12T10:00:20Z] TEST: Running codebase tests...
[2026-01-12T10:00:25Z] TEST PASS: tsc --noEmit (0 errors)
[2026-01-12T10:00:35Z] PROGRESS: login() complete, logout() remaining
[2026-01-12T10:00:40Z] GIT: Committed "feat: add UserService with login method" (abc123)
[2026-01-12T10:00:45Z] SESSION END: interrupted (timeout)
[2026-01-12T10:00:45Z] REMAINING: logout() method, session validation
```

**Build Agent 2 Startup (reads last 500 lines):**
```python
def get_bearings(task_id: str) -> str:
    """Read last 500 lines of execution log to understand current state."""
    log = db.query("""
        SELECT log_content FROM task_execution_log
        WHERE task_id = ?
        ORDER BY started_at DESC
        LIMIT 1
    """, [task_id])

    lines = log.log_content.split('\n')
    last_500 = lines[-500:]  # Last 500 lines for context
    return '\n'.join(last_500)
```

**SIA Analysis (reads full log for pattern detection):**
```python
def analyze_failures(task_id: str) -> FailureAnalysis:
    """SIA reads full execution log to identify failure patterns."""
    logs = db.query("""
        SELECT log_content, last_error, attempts
        FROM task_execution_log
        WHERE task_id = ?
        ORDER BY started_at ASC
    """, [task_id])

    # Concatenate all logs for pattern analysis
    full_history = '\n---SESSION BOUNDARY---\n'.join(
        [log.log_content for log in logs]
    )

    return {
        'repeated_errors': find_repeated_errors(logs),
        'stuck_points': identify_stuck_points(full_history),
        'suggested_fix': propose_fix(full_history)
    }
```

**New Table: task_execution_log**
```sql
CREATE TABLE task_execution_log (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_list_id TEXT NOT NULL,
  agent_session_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,  -- 'running', 'completed', 'failed', 'interrupted'

  -- Structured metadata
  attempts INTEGER DEFAULT 1,
  last_error TEXT,
  files_modified TEXT,      -- JSON array
  git_commits TEXT,         -- JSON array of commit SHAs

  -- LINE-BASED LOG (KEY for handoff)
  -- Build Agent 2 reads last 500 lines to get bearings
  -- SIA reads full log for pattern analysis
  log_content TEXT NOT NULL DEFAULT '',

  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (task_list_id) REFERENCES task_lists(id)
);
```

---

## Next Steps

1. [x] Update AGENT-SPECIFICATIONS.md Section 5 (Build Agent) with new trigger ✅
2. [x] Update AGENT-SPECIFICATIONS.md Section 6 (SIA) with spawn criteria ✅
3. [x] Add task_execution_log table to task-data-model.md ✅
4. [x] Update task-agent-arch.md with Build Agent handoff + SIA spawn ✅
5. [x] Add deprecation note to Spec Agent in AGENT-SPECIFICATIONS.md ✅
6. [x] Clarify execution_id as "lane" for parallel Build Agent isolation ✅

All documentation updates complete. Ready for implementation.
