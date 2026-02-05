# Autonomous Agent Harness Plan for Vibe Platform

**Created:** 2026-02-06
**Author:** Kai (AI Software Engineer)
**Status:** DRAFT - Requires Ned's Input on Critical Questions

---

## Executive Summary

This plan describes an **external autonomous agent harness** that orchestrates Vibe platform development without being coupled to the Vibe server process. The system runs on a separate server, uses cron-based scheduling, communicates via Telegram, and includes QA validation cycles.

**Key Differentiators from existing `coding-loops/` system:**
1. **Externalized** - Runs independently of Vibe platform (survives restarts)
2. **Telegram-Native** - Real-time updates on every tool use, file edit
3. **Cron-Orchestrated** - 1-minute heartbeat with task assignment
4. **QA-Validated** - Every 10th cycle runs independent quality checks
5. **Clear Pass Criteria** - Every task has measurable completion criteria

---

## Critical Questions for Ned (MUST ANSWER BEFORE IMPLEMENTING)

### Q1: Agent-to-Telegram Channel Mapping
Which Telegram channels/groups should each agent post to?

```
Proposed mapping (confirm or modify):
- Orchestrator: @vibe-orchestrator (coordination decisions)
- Ideation Agent (SIA): @vibe-ideation (user conversations, idea captures)
- Specification Agent: @vibe-specs (spec generation, requirement extraction)
- Build Agent: @vibe-build (code generation, file edits, test results)
- Task Agent: @vibe-tasks (task assignment, status changes)
- QA Agent: @vibe-qa (audit results, bottleneck reports)
- Research Agent: @vibe-research (web searches, market data)
```

**Question:** Are these separate channels or one unified channel? Who subscribes to what?

### Q2: Task Source and Assignment Rules
Where do tasks come from and how are they assigned?

**Current options:**
1. **Database-driven:** Tasks from `tasks` table in Vibe SQLite
2. **File-driven:** Tasks from `coding-loops/*/test-state.json`
3. **Hybrid:** Tasks from both, with priority rules
4. **External:** Tasks from Linear/GitHub Issues (like your-claude-engineer)

**Question:** Which source is authoritative? Can agents create their own tasks?

### Q3: Agent Deployment Target
Where does the harness run?

**Options:**
1. **Same machine, different process** - Simple but shares resources
2. **Docker container** - Isolated, portable
3. **Separate VPS** - True isolation, network latency to Vibe DB
4. **Serverless (Lambda/Cloud Run)** - Auto-scaling but cold starts

**Question:** What infrastructure do you want? Budget constraints?

### Q4: Vibe Platform Specification
The task agent "needs to continuously evaluate progress vs specifications as to how the vibe platform should work."

**Question:** Where is this specification? Options:
1. The PRD files in `ideas/vibe/` folder
2. The test-state files in `coding-loops/`
3. A master SPEC.md document (doesn't exist yet?)
4. Implicit in code (tests define spec)

### Q5: Inter-Agent Communication
How do agents coordinate?

**Options:**
1. **Through orchestrator only** - Central hub
2. **Message bus (SQLite events)** - As planned in multi-agent-coordination-system-FINAL.md
3. **Telegram channels** - Read each other's messages
4. **Direct API calls** - Agent-to-agent

**Question:** Should agents talk directly or always through orchestrator?

### Q6: Human Approval Gates
Some changes are high-risk (e.g., DB schema changes, API breaking changes).

**Question:** Do you want explicit approval gates? If yes:
- Which task types require approval?
- Timeout behavior if no response?
- Can QA agent auto-approve low-risk items?

### Q7: Git Workflow
Agents will modify code.

**Question:**
- One branch per agent? Per task? Direct to main?
- Who merges? Auto-merge on pass? Human review?
- How to handle conflicts?

### Q8: Budget and Rate Limits
Running multiple agents consumes API credits.

**Question:**
- Daily/monthly budget cap?
- Per-agent token limits?
- Model allocation (Opus for what? Haiku for what?)
- What happens when budget exhausted?

---

## First Principles Analysis

### What Problem Are We Solving?

**Pain Point:** Vibe platform development requires constant human oversight. Agents exist but:
1. Run inside the platform (die when it restarts)
2. Don't communicate with each other
3. Don't validate their own work
4. Don't keep humans informed
5. Tasks aren't tracked systematically

**Goal:** A system where you wake up and find features implemented, tested, and documented - with a clear audit trail of what happened.

### Core Requirements (Non-Negotiable)

| Requirement | Rationale |
|------------|-----------|
| **External to Vibe** | Platform restarts constantly during dev |
| **Cron-based heartbeat** | Ensures agents work even when no one is watching |
| **Telegram updates** | Real-time visibility without opening dashboards |
| **Task tracking** | Know what's done, what's in progress, what's blocked |
| **Pass criteria** | Unambiguous completion definition |
| **QA validation** | Independent verification (agents lie/hallucinate) |

### What Cole Medin's Architecture Teaches Us

From `your-claude-engineer`:

1. **Orchestrator pattern works** - One agent coordinates, subagents execute
2. **Per-agent model selection** - Haiku for coordination, Sonnet/Opus for coding
3. **Linear integration** - Task tracking with status transitions
4. **Session handoff** - META issue tracks progress across sessions
5. **Isolated git repos** - Each project in own directory
6. **MCP for integrations** - Arcade gateway for external services

**Key insight:** The orchestrator reads state, decides action, delegates to subagent, updates state. Loop continues.

### What Vibe's Existing Plan Adds

From `20260107-multi-agent-coordination-system-FINAL.md`:

1. **Message bus** - Events with subscriptions, persistence
2. **Verification gate** - Independent test execution
3. **Deadlock detection** - Prevents agents waiting forever
4. **Regression monitoring** - Catches when agents break things
5. **Knowledge base** - Cross-agent context sharing
6. **Checkpoint/rollback** - Recovery from bad changes

**Key insight:** 116 tests already defined with pass criteria. Use this.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL HARNESS SERVER                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                              CRON (every 1 min)                         ││
│  │  ┌───────────────────────────────────────────────────────────────────┐  ││
│  │  │                    ORCHESTRATOR AGENT                             │  ││
│  │  │  1. Read system state (tasks, agent status, health)               │  ││
│  │  │  2. Decide: assign task / check progress / intervene              │  ││
│  │  │  3. Dispatch to appropriate agent                                 │  ││
│  │  │  4. Every 10th run: spawn QA agent                                │  ││
│  │  └───────────────────────────────────────────────────────────────────┘  ││
│  │                                    │                                     ││
│  │         ┌──────────────────────────┼──────────────────────────┐         ││
│  │         │                          │                          │         ││
│  │    ┌────▼────┐              ┌──────▼──────┐            ┌──────▼──────┐  ││
│  │    │   SIA   │              │    SPEC     │            │   BUILD     │  ││
│  │    │  Agent  │              │    Agent    │            │   Agent     │  ││
│  │    └────┬────┘              └──────┬──────┘            └──────┬──────┘  ││
│  │         │                          │                          │         ││
│  │    ┌────▼────┐              ┌──────▼──────┐            ┌──────▼──────┐  ││
│  │    │  TASK   │              │  RESEARCH   │            │     QA      │  ││
│  │    │  Agent  │              │    Agent    │            │   Agent     │  ││
│  │    └─────────┘              └─────────────┘            └─────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       │                                      │
│  ┌────────────────────────────────────▼────────────────────────────────────┐│
│  │                         TELEGRAM NOTIFIER                               ││
│  │  • Tool use → post to channel                                           ││
│  │  • File edit → post to channel with diff preview                        ││
│  │  • Task state change → post to channel                                  ││
│  │  • Error/block → post to channel with context                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       │                                      │
│  ┌────────────────────────────────────▼────────────────────────────────────┐│
│  │                          STATE STORE (SQLite)                           ││
│  │  • agent_status: which agent doing what                                 ││
│  │  • task_assignments: task → agent mapping                               ││
│  │  • execution_logs: full audit trail                                     ││
│  │  • qa_results: validation outcomes                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTP/DB access
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                             VIBE PLATFORM SERVER                             │
│  • Database (ideas, sessions, tasks, etc.)                                   │
│  • File system (ideas/, specs/, code)                                        │
│  • API (for status checks, data queries)                                     │
│  • Can restart independently                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Definitions

### 1. Orchestrator Agent
**Purpose:** Coordinate all other agents, assign tasks, detect issues
**Model:** Haiku (fast, cheap decisions)
**Telegram Channel:** @vibe-orchestrator

**Responsibilities:**
- Read current system state every cron tick
- Decide which agent should work on what
- Detect stuck/blocked agents
- Spawn QA agent every 10th tick
- Escalate to human when needed

**Pass Criteria for Orchestrator:**
```
✅ PASS if:
- No agent idle when tasks available
- No task stuck >30 mins without progress
- QA agent spawned on schedule
- Human notified of blocks within 5 mins
```

### 2. Ideation Agent (SIA)
**Purpose:** Continue ideation sessions, capture ideas
**Model:** Opus (complex reasoning, user empathy)
**Telegram Channel:** @vibe-ideation

**Responsibilities:**
- Resume active ideation sessions
- Respond to user messages
- Capture ideas (candidateUpdate)
- Generate follow-up questions

**Pass Criteria:**
```
✅ PASS if:
- User message responded to within session timeout
- candidateUpdate emitted when idea emerges
- No JSON parsing errors in response
- Session state saved to database
```

### 3. Specification Agent
**Purpose:** Generate specifications from captured ideas
**Model:** Opus (detailed technical writing)
**Telegram Channel:** @vibe-specs

**Responsibilities:**
- Extract requirements from ideation transcripts
- Generate PRD documents
- Create acceptance criteria
- Link specs to tasks

**Pass Criteria:**
```
✅ PASS if:
- PRD generated with all required sections
- Acceptance criteria parseable and testable
- Cross-references to ideation source included
- No orphan requirements (all linked to tasks)
```

### 4. Build Agent
**Purpose:** Implement code from specifications
**Model:** Opus (coding, reasoning)
**Telegram Channel:** @vibe-build

**Responsibilities:**
- Implement features based on tasks
- Write and run tests
- Commit changes with descriptive messages
- Report build/test results

**Pass Criteria:**
```
✅ PASS if:
- Tests pass (verified by QA, not self-reported)
- Build succeeds (TypeScript compiles)
- Commit message follows convention
- No regressions introduced
```

### 5. Task Agent
**Purpose:** Manage task lifecycle and assignments
**Model:** Sonnet (structured reasoning)
**Telegram Channel:** @vibe-tasks

**Responsibilities:**
- Create tasks from specs
- Prioritize task queue
- Track task progress
- Mark tasks complete when verified

**Pass Criteria:**
```
✅ PASS if:
- Task created with all required fields
- Priority assigned based on rules
- Completion only marked after verification
- Dependencies tracked and enforced
```

### 6. Research Agent
**Purpose:** Gather external information
**Model:** Haiku (simple queries) or Sonnet (complex synthesis)
**Telegram Channel:** @vibe-research

**Responsibilities:**
- Web searches for market data
- Competitor analysis
- Technical feasibility checks
- Report findings to requesting agent

**Pass Criteria:**
```
✅ PASS if:
- Search queries relevant to request
- Results synthesized (not raw dumps)
- Sources cited
- Findings actionable
```

### 7. QA Agent (Special)
**Purpose:** Independent validation of all agent work
**Model:** Opus (critical analysis)
**Telegram Channel:** @vibe-qa
**Schedule:** Every 10th cron tick (every 10 minutes)

**Responsibilities:**
- Verify Build Agent claims (actually run tests)
- Check Spec Agent output quality
- Detect circular work / no progress
- Identify bottlenecks and blockers
- Generate improvement recommendations

**Pass Criteria:**
```
✅ PASS if:
- All claims verified or disputed with evidence
- Bottlenecks identified with root cause
- Recommendations actionable
- Report generated within time limit
```

---

## Cron Orchestration Logic

```python
# Pseudocode for cron job (runs every minute)

def cron_tick():
    tick_number = get_current_tick()
    state = load_system_state()
    
    # Every 10th tick: QA cycle
    if tick_number % 10 == 0:
        spawn_qa_agent(state)
        return
    
    # Check agent health
    for agent in state.agents:
        if agent.stuck_duration > STUCK_THRESHOLD:
            notify_telegram(f"⚠️ {agent.name} stuck for {agent.stuck_duration}")
            consider_intervention(agent)
    
    # Assign tasks to idle agents
    for agent in state.agents:
        if agent.status == "idle":
            task = find_suitable_task(agent)
            if task:
                assign_task(agent, task)
                notify_telegram(f"📋 Assigned {task.id} to {agent.name}")
    
    # Check task progress
    for task in state.active_tasks:
        progress = check_task_progress(task)
        if progress.new_update:
            notify_telegram(f"📈 {task.id}: {progress.summary}")
        if progress.completed:
            verify_completion(task)  # QA will confirm
    
    # Save state
    save_system_state(state)
```

---

## Telegram Notification Format

### Tool Use Notification
```
🔧 [BUILD AGENT] Tool: edit_file
📁 File: server/routes/ideation.ts
📝 Change: Added candidateUpdate handling
⏱️ Duration: 2.3s
```

### File Edit Notification
```
✏️ [BUILD AGENT] File Modified
📁 agents/ideation/orchestrator.ts
📊 +15 / -3 lines
```diff
+ // Handle candidate update from JSON response
+ if (parsed.candidateUpdate) {
+   await candidateManager.update(...)
+ }
```
```

### Task State Change
```
📋 [TASK AGENT] Task Update
🆔 TASK-042: Implement idea capture
📊 Status: in_progress → completed
✅ Verified by: QA Agent at 10:15
⏱️ Duration: 45 mins
```

### QA Report (Every 10 Ticks)
```
📊 [QA AGENT] 10-Minute Report

✅ Build Agent: 3 tasks verified
⚠️ Spec Agent: 1 task needs revision (missing acceptance criteria)
❌ Ideation: Blocked - API key issue in IntentClassifier
⏸️ Research: Idle (no requests)

🔍 Bottleneck Identified:
IntentClassifier falling back on every call.
Recommendation: Fix Claude CLI auth or add API key.

📈 Progress: 12/45 tasks complete (27%)
```

---

## Pass Criteria and Completion Checks

### Task Completion Flow
```
1. Agent claims completion
   └─► Task marked "pending_verification"
       └─► QA Agent scheduled to verify
           └─► QA runs tests independently
               ├─► PASS: Task marked "completed"
               │        └─► Telegram: ✅ Task verified
               └─► FAIL: Task marked "needs_revision"
                        └─► Telegram: ❌ Verification failed: {reason}
                        └─► Task reassigned to agent
```

### Test Evaluation Scripts

Each task type has an evaluation script:

```bash
# scripts/verify-build-task.sh
#!/bin/bash
TASK_ID=$1

# Run TypeScript compile
npm run typecheck
if [ $? -ne 0 ]; then
    echo "FAIL: TypeScript compilation errors"
    exit 1
fi

# Run tests
npm test
if [ $? -ne 0 ]; then
    echo "FAIL: Tests failed"
    exit 1
fi

# Check for regressions
npm run test:regression
if [ $? -ne 0 ]; then
    echo "FAIL: Regressions detected"
    exit 1
fi

echo "PASS: All checks passed"
exit 0
```

```bash
# scripts/verify-spec-task.sh
#!/bin/bash
SPEC_FILE=$1

# Check required sections exist
REQUIRED_SECTIONS=("Problem Statement" "Requirements" "Acceptance Criteria")
for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -q "$section" "$SPEC_FILE"; then
        echo "FAIL: Missing section: $section"
        exit 1
    fi
done

# Check acceptance criteria are testable
CRITERIA_COUNT=$(grep -c "^- \[ \]" "$SPEC_FILE")
if [ "$CRITERIA_COUNT" -lt 3 ]; then
    echo "FAIL: Fewer than 3 acceptance criteria"
    exit 1
fi

echo "PASS: Spec meets requirements"
exit 0
```

---

## Database Schema (Harness State)

```sql
-- Agent status tracking
CREATE TABLE agent_status (
    agent_id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    status TEXT CHECK(status IN ('idle', 'working', 'stuck', 'error')) DEFAULT 'idle',
    current_task_id TEXT,
    last_heartbeat DATETIME,
    model TEXT,
    telegram_channel TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Task assignments
CREATE TABLE task_assignments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    status TEXT CHECK(status IN ('assigned', 'in_progress', 'pending_verification', 'completed', 'failed', 'needs_revision')),
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    verification_result TEXT,
    verified_by TEXT,
    FOREIGN KEY (agent_id) REFERENCES agent_status(agent_id)
);

-- Execution log (audit trail)
CREATE TABLE execution_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,  -- 'tool_use', 'file_edit', 'task_update', 'error', 'telegram_sent'
    event_data JSON,
    task_id TEXT,
    telegram_message_id TEXT
);

-- QA results
CREATE TABLE qa_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qa_run_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    agent_id TEXT NOT NULL,
    task_id TEXT,
    check_type TEXT NOT NULL,
    result TEXT CHECK(result IN ('pass', 'fail', 'warning')),
    details TEXT,
    recommendation TEXT
);

-- Cron tick tracking
CREATE TABLE cron_ticks (
    tick_number INTEGER PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    actions_taken JSON,
    duration_ms INTEGER
);
```

---

## File Structure

```
agent-harness/
├── README.md
├── requirements.txt
├── .env.example
│
├── orchestrator/
│   ├── main.py                 # Entry point for cron
│   ├── state_manager.py        # Load/save system state
│   ├── task_assigner.py        # Match tasks to agents
│   └── health_checker.py       # Detect stuck agents
│
├── agents/
│   ├── base_agent.py           # Base class with Telegram reporting
│   ├── ideation_agent.py       # SIA wrapper
│   ├── spec_agent.py           # Specification generation
│   ├── build_agent.py          # Code implementation
│   ├── task_agent.py           # Task management
│   ├── research_agent.py       # Web searches
│   └── qa_agent.py             # Quality assurance
│
├── notifications/
│   ├── telegram.py             # Telegram bot client
│   └── formatters.py           # Message formatting
│
├── verification/
│   ├── scripts/
│   │   ├── verify-build-task.sh
│   │   ├── verify-spec-task.sh
│   │   └── verify-ideation-task.sh
│   └── runner.py               # Script execution
│
├── database/
│   ├── schema.sql
│   ├── migrations/
│   └── db.py                   # SQLite wrapper
│
├── prompts/
│   ├── orchestrator.md
│   ├── ideation_agent.md
│   ├── spec_agent.md
│   ├── build_agent.md
│   ├── task_agent.md
│   ├── research_agent.md
│   └── qa_agent.md
│
├── config/
│   ├── agents.yaml             # Agent definitions, models, channels
│   ├── tasks.yaml              # Task types, assignment rules
│   └── thresholds.yaml         # Timeouts, limits, budgets
│
├── scripts/
│   ├── setup.sh                # Initial setup
│   ├── install-cron.sh         # Add to crontab
│   └── test-telegram.py        # Verify Telegram connectivity
│
└── tests/
    ├── test_orchestrator.py
    ├── test_agents.py
    ├── test_verification.py
    └── test_telegram.py
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up external harness server
- [ ] Database schema and migrations
- [ ] Telegram bot with test notifications
- [ ] Basic orchestrator shell (cron tick logic)
- [ ] Agent base class with Telegram reporting

**Test:** `cron tick runs, sends Telegram "heartbeat ok"`

### Phase 2: Single Agent (Week 2)
- [ ] Build Agent implementation
- [ ] Task assignment from database
- [ ] File edit notifications
- [ ] Verification script runner

**Test:** `Build Agent picks task, edits file, reports to Telegram, task marked pending_verification`

### Phase 3: QA Validation (Week 3)
- [ ] QA Agent implementation
- [ ] Every-10th-tick scheduling
- [ ] Independent test execution
- [ ] Bottleneck detection

**Test:** `QA Agent verifies Build Agent claim, posts report to Telegram`

### Phase 4: Multi-Agent (Week 4)
- [ ] All 7 agents implemented
- [ ] Inter-agent task handoff
- [ ] Conflict detection
- [ ] Stuck agent recovery

**Test:** `Full flow: Ideation → Spec → Build → QA verified`

### Phase 5: Resilience (Week 5)
- [ ] Checkpoint/rollback
- [ ] Error recovery
- [ ] Rate limiting / budget enforcement
- [ ] Human approval gates

**Test:** `Agent crash recovery, budget limit enforcement`

### Phase 6: Production (Week 6)
- [ ] Monitoring dashboard
- [ ] Performance tuning
- [ ] Documentation
- [ ] Handoff to autonomous operation

**Test:** `24-hour unattended run with tasks completed`

---

## What's Missing? (Self-Critique)

### Known Gaps

1. **No Live Demo Yet** - This is a plan, not working code
2. **Vibe DB Access** - How does harness access Vibe's SQLite if on different server?
3. **Git Strategy** - Branch management not fully specified
4. **Error Taxonomy** - Need clear categories for different failure modes
5. **Metrics Dashboard** - Telegram is real-time, but need historical view
6. **Cost Tracking** - No API usage monitoring yet
7. **Secrets Management** - How are tokens stored securely?
8. **Deployment Automation** - Manual setup currently

### Open Technical Questions

1. **Claude Agent SDK vs API** - Should agents use SDK (sessions) or raw API?
2. **MCP Integration** - Use Arcade gateway like your-claude-engineer?
3. **Parallel Execution** - Multiple agents at once or sequential?
4. **Context Window Management** - How to handle long sessions?

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Task completion rate | >70% auto-verified | QA pass / total assigned |
| Time to completion | <2 hours average | assignment → verification |
| Human intervention rate | <10% of tasks | escalations / total tasks |
| False completion claims | <5% | QA rejections / total claims |
| Telegram latency | <5s | event → message delivered |
| Uptime | >99% | cron ticks executed / expected |

---

## Next Steps

**For Ned:**
1. Answer the 8 critical questions above
2. Confirm or modify agent-channel mapping
3. Decide on deployment target
4. Approve Phase 1 scope

**For Kai:**
1. Await Ned's answers
2. Set up harness repository
3. Implement Phase 1 foundation
4. First working cron tick with Telegram

---

*This plan synthesizes patterns from your-claude-engineer, the existing multi-agent-coordination-system-FINAL.md, and Ned's requirements for external, Telegram-native, QA-validated autonomous development.*
