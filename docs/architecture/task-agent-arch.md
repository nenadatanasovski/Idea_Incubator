# Task Agent Architecture

**Version:** 2.0
**Updated:** 2026-01-12
**Status:** Final Design (Post-Questionnaire)

---

## Executive Summary

The Task Agent is an **always-on autonomous orchestrator** that manages task lists across the Vibe platform. It operates as the proactive driver that:

1. **Analyzes** current state to identify parallel execution opportunities
2. **Suggests** the next task list(s) to execute
3. **Validates** task list readiness (tests, dependencies, completeness)
4. **Hands off** validated task lists to Build Agent(s) for execution
5. **Monitors** execution progress and handles completion/failure

**Key Design Decisions:**
- Task Agent orchestrates, Build Agent executes (Q17)
- Focus on TASK LISTS not individual tasks (Q24)
- Each Telegram chat linked to exactly one task list (Q25)
- DB is single source of truth - no MD files for tasks (Q29)
- Three-level test framework: Codebase, API, UI (Q5, Q26)
- Build Agent determines pass/fail per task, Task Agent determines task list completion (Q27)

---

## Agent Relationship Clarity

### Task Agent vs Build Agent

| Aspect | Task Agent | Build Agent |
|--------|------------|-------------|
| **Role** | Orchestrator | Executor |
| **Always On** | Yes | Spawned per task list |
| **Interface** | Telegram bot | Internal/Events |
| **Works With** | Task Lists | Individual Tasks |
| **Determines** | Task list completion | Task pass/fail |
| **Runs Tests** | No | Yes (iterate/refine loop) |
| **Writes Code** | No | Yes |

### Agent Communication Flow (Q19)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT COMMUNICATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   USER (via Telegram)                                                    │
│        │                                                                 │
│        │ answers/approvals                                               │
│        ▼                                                                 │
│   ┌──────────────┐                                                       │
│   │ TASK AGENT   │ ◄─────────────────────────────────┐                   │
│   │ (Always On)  │                                   │                   │
│   └──────┬───────┘                                   │                   │
│          │                                           │                   │
│          │ tasklist.ready                            │ tasklist.completed│
│          │ (event)                                   │ tasklist.failed   │
│          ▼                                           │                   │
│   ┌──────────────┐      ┌──────────────┐      ┌──────┴───────┐          │
│   │ BUILD AGENT  │      │ BUILD AGENT  │      │ BUILD AGENT  │          │
│   │ (List A)     │      │ (List B)     │      │ (List C)     │          │
│   └──────┬───────┘      └──────┬───────┘      └──────────────┘          │
│          │                     │                                         │
│          │ task:passed         │ task:failed                            │
│          │ task:failed         │ (stays with build agent               │
│          ▼                     │  for iterate/refine)                   │
│   ┌──────────────┐             │                                        │
│   │   TEST       │◄────────────┘                                        │
│   │   RUNNER     │                                                       │
│   └──────────────┘                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Event Bus Events

| Event | Emitter | Receiver | Description |
|-------|---------|----------|-------------|
| `tasklist.ready` | Task Agent | Build Agent | Task list validated, ready to execute |
| `tasklist.completed` | Build Agent | Task Agent | All tasks in list completed |
| `tasklist.failed` | Build Agent | Task Agent | Task list execution failed |
| `task.started` | Build Agent | Task Agent | Individual task started |
| `task.passed` | Build Agent | Task Agent | Task tests passed |
| `task.failed` | Build Agent | Build Agent | Task failed (iterate/refine internally) |
| `task.suggestion` | Task Agent | User (Telegram) | Suggest next action |
| `tasklist.approved` | User (Telegram) | Task Agent | User approved execution |
| `question.asked` | Task Agent | User (Telegram) | Question sent |
| `question.answered` | User (Telegram) | Task Agent | Answer received |

---

## The Continuous Suggestion Loop (Q11, Q23, Q24)

The Task Agent's primary behavior is a continuous loop:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTINUOUS SUGGESTION LOOP                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. ANALYZE CURRENT STATE                                            │
│     • Which task lists are ready?                                    │
│     • Which can run in parallel?                                     │
│     • Any duplicates to merge?                                       │
│     • Any blockers to resolve?                                       │
│          │                                                           │
│          ▼                                                           │
│  2. FORMULATE SUGGESTION                                             │
│     • Identify next best action(s)                                   │
│     • Consider parallel execution opportunities                      │
│     • Apply priority formula                                         │
│          │                                                           │
│          ▼                                                           │
│  3. SEND SUGGESTION (via Telegram)                                   │
│     • One message per task list                                      │
│     • Include reasoning and risk assessment                          │
│     • Provide action buttons                                         │
│          │                                                           │
│          ▼                                                           │
│  4. USER RESPONDS                                                    │
│     • Approve → Execute                                              │
│     • Modify → Adjust and re-suggest                                 │
│     • Reject → Move to next option                                   │
│     • Reprioritize → Update priorities                               │
│          │                                                           │
│          ▼                                                           │
│  5. EXECUTE (hand to Build Agent)                                    │
│     • Spawn Build Agent for task list                                │
│     • Build Agent works through tasks automatically                  │
│     • No per-task approval from Task Agent                           │
│          │                                                           │
│          ▼                                                           │
│  6. REPORT RESULT                                                    │
│     • Task list completed/failed                                     │
│     • Summary of what was accomplished                               │
│     • Any follow-up tasks needed                                     │
│          │                                                           │
│          ▼                                                           │
│  7. BACK TO STEP 1                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Loop Triggering (Q23)

**Hybrid approach:**
- **Active session** (user responded within 30 min): Continuous suggestions
- **Inactive**: Daily summary with top 3 task lists
- **Always**: Immediate notification for blockers/failures

### Suggestion Content

```
📋 SUGGESTED NEXT ACTION

I recommend executing task list: **Infrastructure Setup**
"Set up authentication system and database migrations"

📊 Why: 3 other task lists are blocked by this one + quick win
⚠️ Risk: Low (creates new files, no existing code modified)

Tasks in this list:
1. [INF-001] Create user table migration
2. [INF-002] Add authentication routes
3. [INF-003] Set up JWT middleware

📈 Current state: 3 lists ready | 1 in progress | 5 completed

[✅ Execute Now] [⏸️ Later] [🔄 Show Alternatives] [📄 Details]
```

---

## Parallel Task List Execution (Q18)

The Task Agent identifies when multiple task lists can run simultaneously:

### Criteria for Parallel Execution

1. **No dependency overlap**: Lists don't depend on same tasks
2. **No file conflicts**: Lists don't modify same files
3. **Resource availability**: Sufficient Build Agent capacity
4. **User approval**: User must approve parallel runs

### Example Telegram Message

```
🔀 PARALLEL EXECUTION OPPORTUNITY

I've identified 2 task lists that can run simultaneously:

List A: Frontend Components (4 tasks)
List B: Backend API (5 tasks)

These lists have no overlapping dependencies or file conflicts.

📈 Estimated time savings: ~40% vs sequential

[✅ Run Both] [▶️ Run A Only] [▶️ Run B Only] [📄 Details]
```

---

## Telegram Integration (Q9, Q25)

### One Chat Per Task List

Each task list gets its own Telegram chat/thread:

```
Task Lists → Telegram Chats
─────────────────────────────
Infrastructure Setup  → Chat #123
Frontend Features     → Chat #124
Bug Fixes Sprint 1    → Chat #125
```

**Benefits:**
- Clear context per conversation
- Easy to switch between task lists
- History preserved per list
- Questions clearly linked to their list

### Question Handling (Q8, Q9)

Every question gets a **unique message with unique callback data**:

```typescript
interface TelegramQuestion {
  messageId: string;
  callbackData: string;        // Unique: "q:abc123"
  taskListId: string;
  questionId: string;
  questionType: QuestionType;
  priority: QuestionPriority;
}
```

### Question Priority Timeouts (Q8)

| Priority | Timeout | Action |
|----------|---------|--------|
| Critical | No timeout | Block until answered |
| High | No timeout | Block until answered |
| Medium | Configurable (default: no auto) | Per task list toggle |
| Low | Configurable (default: no auto) | Per task list toggle |

### Defer Options (Q10)

```
[1 hour] [4 hours] [Tomorrow] [Next week] [Reprioritize]

Reprioritize opens free text:
"Why should this be deprioritized?"
```

---

## Priority Formula (Q15)

**No user-set priority** - computed automatically:

```
Score = (BlockedCount × 20) + QuickWinBonus + DeadlineBonus + TaskAgentAdvice

Where:
- BlockedCount: Number of tasks/lists blocked by this
- QuickWinBonus: +15 if estimated < 1 hour
- DeadlineBonus: +30 if deadline within 3 days
- TaskAgentAdvice: +0 to +20 based on best practices analysis
```

### Task Agent Advice Factors

- Code complexity analysis
- Test coverage impact
- Technical debt implications
- User activity patterns
- Historical success rates for similar tasks

---

## Three-Level Test Framework (Q5, Q26, Q28)

### Test Levels

| Level | What It Tests | Tools | When Required |
|-------|---------------|-------|---------------|
| Codebase | Syntax, types, lint, unit tests | `tsc`, `eslint`, `vitest` | ALL tasks |
| API | HTTP endpoints, responses, errors | `supertest`, custom | Tasks touching `server/` |
| UI | User flows, visual elements | Puppeteer (MCP) | Tasks touching frontend |

### Test Pass Criteria (Q14, Q28)

**100% tests must pass** for task completion.

If tests fail:
1. Build Agent attempts iterate/refine
2. If still failing, option to create new follow-up task
3. Task marked as failed with specific test failures noted

### Test Ownership (Q27)

| Actor | Defines Tests | Runs Tests | Determines Pass/Fail |
|-------|---------------|------------|---------------------|
| User | Can add custom | No | Reviews failures |
| Task Agent | Auto-generates from criteria | Triggers execution | Task LIST completion |
| Build Agent | No | Yes (loop) | Individual TASK pass/fail |
| Test Executor | No | Executes all levels | Returns raw results |

---

## Validation Gate

### Task List "Ready" Criteria (Q5)

A task list is ready to execute when:

| Condition | Required | Toggle |
|-----------|----------|--------|
| All tasks validated | Yes | - |
| All dependencies satisfied | Yes | - |
| All tasks have codebase tests | Yes | - |
| API tests defined (if backend) | Yes | - |
| UI tests defined (if frontend) | Yes | - |
| No `conflicts_with` tasks running | Yes | - |
| User approval | Per list | `user_approval_required` |

### Blocking vs Non-Blocking Issues

**Blocking (cannot execute):**
- Missing required tests
- Unresolved dependencies
- Ambiguous acceptance criteria
- Circular dependency detected
- Conflicting task list running

**Warnings (can proceed):**
- Missing effort estimates
- Potential duplicate detected
- Low test coverage

---

## Agent Persona (Q16)

**Name:** Task Agent

**Personality:**
- Approachable and fun
- Occasional witty remarks based on context
- Helpful and insightful
- Proactive (suggests before being asked)

**Example Messages:**

```
// Task list completed
🎉 Nice! Infrastructure Setup is done.
4 tasks, zero drama. Your auth system is ready to go.

[Next: Frontend Features]

// Suggesting next action
Hey! While you were away, I crunched some numbers.
Frontend Features would unblock 3 other lists - shall we tackle it?

// Error occurred
Hmm, ran into a snag with INF-003.
The JWT middleware test is failing (expected 401, got 500).
Build Agent is on it - retry #2 incoming...

// Duplicate detected
Déjà vu? FEA-005 looks suspiciously like FEA-002.
Want me to merge them or keep both?
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TASK AGENT SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                          ┌─────────────────────┐                         │
│                          │   Telegram Bot      │                         │
│                          │   "Task Agent"      │                         │
│                          └──────────┬──────────┘                         │
│                                     │                                    │
│        ┌────────────────────────────┼────────────────────────────┐       │
│        │                            │                            │       │
│        ▼                            ▼                            ▼       │
│  ┌───────────────┐     ┌─────────────────────┐     ┌───────────────┐    │
│  │  Suggestion   │     │   Question Queue    │     │   Analytics   │    │
│  │  Engine       │     │   Manager           │     │   Engine      │    │
│  └───────┬───────┘     └──────────┬──────────┘     └───────┬───────┘    │
│          │                        │                        │            │
│          └────────────────────────┼────────────────────────┘            │
│                                   │                                     │
│                                   ▼                                     │
│                    ┌─────────────────────────────┐                      │
│                    │      Task List Manager      │                      │
│                    │  • Validation Gate          │                      │
│                    │  • Parallel Run Detection   │                      │
│                    │  • Priority Calculator      │                      │
│                    │  • Deduplication Engine     │                      │
│                    └─────────────┬───────────────┘                      │
│                                  │                                      │
│                                  ▼                                      │
│                    ┌─────────────────────────────┐                      │
│                    │      SQLite Database        │                      │
│                    │   (Single Source of Truth)  │                      │
│                    └─────────────┬───────────────┘                      │
│                                  │                                      │
│        ┌─────────────────────────┼─────────────────────────┐            │
│        │                         │                         │            │
│        ▼                         ▼                         ▼            │
│  ┌───────────────┐    ┌───────────────────┐    ┌───────────────┐       │
│  │  Message Bus  │    │    REST API       │    │   WebSocket   │       │
│  │  (Events)     │    │    (CRUD)         │    │   (Real-time) │       │
│  └───────────────┘    └───────────────────┘    └───────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Task Lists

```
POST   /api/task-lists                    Create task list
GET    /api/task-lists                    List task lists
GET    /api/task-lists/:id                Get task list details
PUT    /api/task-lists/:id                Update task list
DELETE /api/task-lists/:id                Delete task list

POST   /api/task-lists/:id/validate       Run validation gate
POST   /api/task-lists/:id/execute        Start execution (spawn Build Agent)
POST   /api/task-lists/:id/pause          Pause execution
POST   /api/task-lists/:id/resume         Resume execution
POST   /api/task-lists/:id/cancel         Cancel execution

GET    /api/task-lists/:id/progress       Get execution progress
GET    /api/task-lists/:id/questions      Get pending questions
```

### Tasks

```
POST   /api/tasks                         Create task
GET    /api/tasks                         List tasks
GET    /api/tasks/:id                     Get task details
PUT    /api/tasks/:id                     Update task
DELETE /api/tasks/:id                     Delete task

POST   /api/tasks/:id/validate            Validate single task
GET    /api/tasks/:id/similar             Find similar tasks
POST   /api/tasks/:id/duplicate           Mark as duplicate
```

### Questions

```
GET    /api/questions/pending             Get pending questions
POST   /api/questions/:id/answer          Submit answer
POST   /api/questions/:id/defer           Defer question
POST   /api/questions/:id/reprioritize    Reprioritize with reason
```

### Analytics

```
GET    /api/analytics/ready-lists         Lists ready to execute
GET    /api/analytics/parallel-options    Parallel execution opportunities
GET    /api/analytics/blocked             Blocked items
GET    /api/analytics/velocity            Completion velocity
GET    /api/analytics/duplicates          Potential duplicates
```

---

## WebSocket Events

```typescript
// Task list lifecycle
'tasklist:created'
'tasklist:updated'
'tasklist:validated'
'tasklist:execution_started'
'tasklist:task_started'
'tasklist:task_completed'
'tasklist:task_failed'
'tasklist:completed'
'tasklist:failed'
'tasklist:paused'
'tasklist:resumed'

// Suggestions
'suggestion:new'
'suggestion:approved'
'suggestion:rejected'
'suggestion:deferred'

// Questions
'question:new'
'question:answered'
'question:expired'
'question:deferred'

// Analytics
'parallel:opportunity_detected'
'duplicate:detected'
'blocker:resolved'
```

---

## Telegram Commands

```
/start                           Initialize bot connection
/status                          Current system status
/lists                           Show active task lists
/list <id>                       Show task list details
/suggest                         Get next suggestion
/execute <list-id>               Execute a task list
/pause <list-id>                 Pause execution
/resume <list-id>                Resume execution
/questions                       Show pending questions
/answer <question-id> <answer>   Answer a question
/parallel                        Show parallel opportunities
/duplicates                      Show potential duplicates
/help                            Show available commands
```

---

## Configuration

```typescript
interface TaskAgentConfig {
  // Suggestion loop
  suggestionLoop: {
    activeSessionTimeout: number;    // 30 min default
    batchFrequencyInactive: string;  // "daily" | "weekly"
    dailySummaryTime: string;        // "09:00"
  };

  // Validation
  validation: {
    requireCodebaseTests: boolean;   // true
    requireApiTests: 'always' | 'if_backend';
    requireUiTests: 'always' | 'if_frontend';
  };

  // Deduplication
  deduplication: {
    enabled: boolean;
    threshold: number;               // 0.92
    autoMerge: boolean;              // false - always ask
  };

  // Telegram
  telegram: {
    enabled: boolean;
    botToken: string;
    oneChatPerList: boolean;         // true
  };

  // Execution
  execution: {
    maxParallelLists: number;        // 3 default
    defaultApprovalRequired: boolean; // true initially
  };

  // Persona
  persona: {
    name: string;                    // "Task Agent"
    style: 'witty' | 'professional' | 'minimal';
    useEmoji: boolean;               // true
  };
}
```

---

## Build Agent Session Handoff

When Build Agent 1 ends (timeout, completion, or interruption), Build Agent 2 needs to get their bearings. This is NOT done via message bus (which is for real-time events only).

### Execution ID = Lane Isolation

The **execution_id** is critical for parallel Build Agent operation:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 EXECUTION ID = LANE ISOLATION                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  When multiple Build Agents run in parallel, each stays in their lane:   │
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │ Build Agent A   │    │ Build Agent B   │    │ Build Agent C   │      │
│  │ exec-id: abc123 │    │ exec-id: def456 │    │ exec-id: ghi789 │      │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘      │
│           │                      │                      │               │
│           ▼                      ▼                      ▼               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │ Task List A     │    │ Task List B     │    │ Task List C     │      │
│  │ execution log   │    │ execution log   │    │ execution log   │      │
│  │ (abc123 lane)   │    │ (def456 lane)   │    │ (ghi789 lane)   │      │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘      │
│                                                                          │
│  Each Build Agent ONLY reads/writes to their execution_id lane.          │
│  No cross-lane interference when running in parallel.                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- **execution_id** scopes all operations to one task list execution
- Multiple Build Agents can run simultaneously without interference
- When Build Agent 2 takes over from Build Agent 1, they use the SAME execution_id
- Sequential handoffs within a lane, parallel isolation across lanes

### Handoff via Execution Log

Build Agents use the **task_execution_log** table with a **line-based log** for session handoff:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BUILD AGENT SESSION HANDOFF                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  BUILD AGENT 1 (Ending Session - Lane: exec-abc123)                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                      │
│  Continuously appends to log_content for exec-abc123:                    │
│  [timestamp] ACTION: Created file server/services/user.ts                │
│  [timestamp] ACTION: Added UserService class                             │
│  [timestamp] TEST PASS: tsc --noEmit                                     │
│  [timestamp] GIT: Committed abc123                                       │
│  [timestamp] SESSION END: interrupted                                    │
│  [timestamp] REMAINING: logout() method                                  │
│                                                                          │
│  ═══════════════════════════════════════════════════════════════════════ │
│                                                                          │
│  BUILD AGENT 2 (Starting Session - SAME Lane: exec-abc123)               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                    │
│  1. Receive execution_id (exec-abc123) from Task Agent                   │
│  2. Query execution log WHERE id = 'exec-abc123'                         │
│  3. Read LAST 500 LINES of that execution's log_content                  │
│  4. Parse what was done, what remains                                    │
│  5. Resume from where Agent 1 left off                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why 500 Lines?

- Enough context to understand recent session(s)
- Covers typical Build Agent session output
- Keeps context loading fast
- SIA reads full log for deeper analysis

### Execution Log Uses

| Reader | What They Read | Scoped By | Purpose |
|--------|----------------|-----------|---------|
| **Build Agent 2** | Last 500 lines | execution_id | Get bearings, resume work |
| **SIA** | Full history | task_id (all executions) | Pattern analysis, failure diagnosis |
| **Task Agent** | Summary/status | task_list_id | Track progress, detect stuck |
| **Human** | Any portion | Any | Debugging, review |

---

## SIA Agent Spawn (On Failure)

SIA is NOT a background service. It is spawned ON-DEMAND by Task Agent when:

1. Task has 3+ failed execution attempts
2. No progress detected between attempts

### "No Progress" Detection

```python
def has_progress(logs: List[ExecutionLog]) -> bool:
    """Check if any progress was made between attempts."""
    if len(logs) < 2:
        return True  # Not enough data

    last = logs[-1]
    prev = logs[-2]

    # Check for different error messages
    if last.last_error != prev.last_error:
        return True

    # Check for new commits
    if set(last.git_commits) - set(prev.git_commits):
        return True

    # Check for new files modified
    if set(last.files_modified) - set(prev.files_modified):
        return True

    return False
```

### SIA Spawn Flow

```
Task Agent detects: 3+ failures AND no_progress
    ↓
Task Agent spawns SIA Agent with:
  - Full execution log history
  - Task specification
  - Related knowledge entries
    ↓
SIA analyzes patterns:
  - Repeated errors
  - Stuck points
  - Missing dependencies
    ↓
SIA outputs:
  - Fix approach OR
  - Task decomposition proposal
    ↓
Task Agent creates follow-up tasks from SIA output
    ↓
Task Agent re-queues updated task list for Build Agent
```

---

## Recovery Strategies (Q30)

| Failure | Recovery |
|---------|----------|
| Task Agent crash | Restart, resume from DB state |
| Build Agent fails task | Build Agent iterate/refine, then create follow-up task |
| Telegram disconnects | Auto-reconnect, queue messages, retry delivery |
| DB corrupted | Restore from backup (DB is only source of truth now) |
| User unresponsive | Daily reminder → weekly reminder → auto-pause list |

---

## Graph Visualization (Q4)

Full graph with filtering:

**Nodes:**
- Tasks
- Task Lists
- Ideas
- Projects

**Filters:**
- By Project (show only one project)
- By Idea (show only one idea's tasks)
- By Status (active, blocked, completed)
- By Depth (direct relationships only)
- By Relationship Type

**Implementation:** See `task-data-model.md` for `GraphNode`, `GraphEdge`, `GraphFilter` types.

---

## Rollout Strategy

### Phase 1: Foundation
1. Create DB schema (task-data-model.md)
2. Migrate existing MD tasks to DB
3. Implement Task Agent core service
4. Basic Telegram bot connection

### Phase 2: Suggestion Loop
1. Implement suggestion engine
2. Add priority calculator
3. Add parallel detection
4. Telegram suggestion UI

### Phase 3: Build Agent Integration
1. Implement task list handoff
2. Build Agent spawning
3. Event-based communication
4. Progress tracking

### Phase 4: Intelligence
1. Deduplication engine
2. Similarity search
3. Test auto-generation
4. Analytics dashboard

### Phase 5: Polish
1. Agent persona refinement
2. Graph visualization
3. Recovery mechanisms
4. Performance optimization

---

## Related Documents

- `task-data-model.md` - Database schema and types
- `TAK-TASK-AGENT.md` - Implementation task breakdown
- `task-agent-test-plan.md` - Human-in-loop test scenarios
- `AGENT-SPECIFICATIONS-PIPELINE.md` - Pipeline agents (Ideation, Task, Build)
- `AGENT-SPECIFICATIONS-INFRASTRUCTURE.md` - Support agents (SIA, Monitor, PM)
