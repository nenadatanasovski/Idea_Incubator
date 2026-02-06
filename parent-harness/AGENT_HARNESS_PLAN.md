# Autonomous Agent Harness Plan for Vibe Platform

**Created:** 2026-02-06
**Author:** Kai (AI Software Engineer)
**Status:** READY FOR IMPLEMENTATION
**Version:** 2.0 - With Recommendations & Task Dashboard

---

## Executive Summary

This plan describes an **external autonomous agent harness** that orchestrates Vibe platform development without being coupled to the Vibe server process. The system runs on a separate server, uses cron-based scheduling, communicates via Telegram, and includes QA validation cycles.

**Key Differentiators from existing `coding-loops/` system:**
1. **Externalized** - Runs independently of Vibe platform (survives restarts)
2. **Telegram-Native** - Real-time updates on every tool use, file edit
3. **Cron-Orchestrated** - 1-minute heartbeat with task assignment
4. **QA-Validated** - Every 10th cycle runs independent quality checks
5. **Clear Pass Criteria** - Every task has measurable completion criteria
6. **Task Dashboard** - Kanban UI for humans and agents to manage work

---

## Design Decisions (With Recommendations)

### D1: Telegram Channel Architecture
**Decision:** Hybrid - Critical channel + Agent-specific channels

**Recommendation:**
```
@vibe-critical    → All agents post: errors, blocks, completions, human-needed
@vibe-orchestrator → Orchestrator only: coordination, scheduling, health
@vibe-build        → Build Agent: file edits, test results, commits
@vibe-qa           → QA Agent: verification results, reports, recommendations
@vibe-agents       → All agents: verbose logging (tool use, progress)
```

**Why this is right:**
- `@vibe-critical` is your "don't miss this" channel - mute the rest if you want
- Per-agent channels give deep observability without noise
- `@vibe-agents` is your debug channel - full firehose for troubleshooting
- Scales to more agents without restructuring

**Subscription matrix:**
| Channel | Ned | Orchestrator | Build | QA | Task | Others |
|---------|-----|--------------|-------|-----|------|--------|
| @vibe-critical | ✅ | Post | Post | Post | Post | Post |
| @vibe-orchestrator | Optional | Post | Read | Read | Read | Read |
| @vibe-build | Optional | Read | Post | Read | - | - |
| @vibe-qa | ✅ | Read | - | Post | Read | - |
| @vibe-agents | Debug | Post | Post | Post | Post | Post |

---

### D2: Task Source and Authority
**Decision:** Database is single source of truth, agents can create tasks

**Recommendation:**
- Primary: `harness.db` SQLite (harness-owned, not Vibe's)
- Sync: Import from `coding-loops/test-state.json` on startup
- Creation: Both UI and agents can create tasks via API
- Hierarchy: Epic → Story → Task → Bug (standard agile)

**Why this is right:**
- Database is queryable, indexable, auditable
- Powers the Task Dashboard UI
- Agents need to create subtasks during decomposition
- Separate from Vibe DB = survives Vibe restarts, no coupling
- Sync from coding-loops preserves existing work

**Task schema:**
```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    display_id TEXT UNIQUE NOT NULL,  -- EPIC-001, STORY-042, TASK-123, BUG-007
    type TEXT CHECK(type IN ('epic', 'story', 'task', 'bug')) NOT NULL,
    parent_id TEXT REFERENCES tasks(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN (
        'backlog', 'ready', 'in_progress', 'review', 
        'blocked', 'done', 'cancelled'
    )) DEFAULT 'backlog',
    priority TEXT CHECK(priority IN ('P0', 'P1', 'P2', 'P3')) DEFAULT 'P2',
    assigned_agent TEXT,
    assigned_human TEXT,
    created_by TEXT NOT NULL,  -- 'user', 'task_agent', 'qa_agent', etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    estimated_hours REAL,
    actual_hours REAL,
    pass_criteria TEXT,  -- JSON array of criteria
    verification_status TEXT CHECK(verification_status IN (
        'pending', 'passed', 'failed', 'needs_revision'
    )),
    labels TEXT,  -- JSON array
    spec_link TEXT,
    pr_link TEXT
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_agent);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
```

---

### D3: Deployment Architecture
**Decision:** Docker Compose on same machine, designed for VPS migration

**Recommendation:**
```yaml
# docker-compose.yml
version: '3.8'
services:
  orchestrator:
    build: ./orchestrator
    volumes:
      - ./data:/app/data
      - /home/ned/Documents/Idea_Incubator:/workspace:ro
    environment:
      - VIBE_WORKSPACE=/workspace
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    restart: unless-stopped
    
  task-dashboard:
    build: ./dashboard
    ports:
      - "3333:3333"
    volumes:
      - ./data:/app/data
    depends_on:
      - orchestrator
    restart: unless-stopped
    
  # Cron runs inside orchestrator container
```

**Why this is right:**
- Docker = isolated, reproducible, portable
- Same machine initially = fast iteration, no network latency
- Volume mount to Vibe workspace = read code, run tests
- Designed for VPS: just change volume mounts to network paths
- Separate dashboard service = can restart independently

**Migration path to VPS:**
1. Push image to registry
2. Set up VPS with Docker
3. Mount Vibe workspace via NFS/SSHFS or use git clone
4. Same compose file, different env vars

---

### D4: Specification Source
**Decision:** Living MASTER_SPEC.md + linked PRDs + tests as executable spec

**Recommendation:**
Create `MASTER_SPEC.md` that:
- Defines Vibe's core value proposition and user journeys
- Links to detailed PRDs in `ideas/vibe/`
- Links to test-state files in `coding-loops/`
- Is auto-updated by Spec Agent when PRDs change

**Structure:**
```markdown
# Vibe Platform Master Specification

## Vision
[One paragraph: what Vibe is and why it exists]

## User Journeys
1. Ideation Journey: User → Idea → Validated Concept
2. Specification Journey: Idea → PRD → Task List
3. Build Journey: Task → Code → Deployed Feature

## Feature Areas
### Ideation (SIA)
- PRD: [link to ideas/vibe/ideation-prd.md]
- Tests: [link to coding-loops/loop-1/test-state.json#ideation]
- Status: 45/60 tests passing

### Specification Agent
- PRD: [link]
- Tests: [link]
- Status: 12/30 tests passing

[etc.]

## Architecture Decisions
[Link to ADRs]

## Non-Functional Requirements
- Performance: <2s page load
- Reliability: 99% uptime
- Security: OAuth, rate limiting
```

**Why this is right:**
- Single entry point for "what should Vibe do"
- Links to details without duplicating
- Tests ARE the spec (executable)
- Spec Agent updates it = always current
- Agents can query it for context

---

### D5: Inter-Agent Communication
**Decision:** Message bus (SQLite) + Orchestrator coordination

**Recommendation:**
- **Message Bus:** SQLite table for events (not Telegram - that's for humans)
- **Orchestrator:** Coordinates task assignment, not message routing
- **Direct reads:** Agents can read each other's status, not send commands

**Why this is right:**
- Message bus is queryable, persistent, auditable
- Orchestrator prevents chaos (no agent-to-agent commands)
- Agents can observe state without coupling
- Scales: add new agent = subscribe to bus

**Schema:**
```sql
CREATE TABLE message_bus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source_agent TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSON NOT NULL,
    target_agent TEXT,  -- NULL = broadcast
    consumed_by JSON DEFAULT '[]',
    expires_at DATETIME
);

-- Event types:
-- task_assigned, task_completed, task_blocked
-- file_modified, test_result, build_status
-- agent_started, agent_stopped, agent_stuck
-- qa_report, human_needed, approval_granted
```

---

### D6: Human Approval Gates
**Decision:** Required for high-risk, auto-approve for low-risk, timeout pauses

**Recommendation:**

| Action | Risk | Approval |
|--------|------|----------|
| DB schema change | 🔴 High | Human required |
| API breaking change | 🔴 High | Human required |
| Deploy to production | 🔴 High | Human required |
| Delete files | 🟡 Medium | QA can approve |
| New dependency | 🟡 Medium | QA can approve |
| Code changes | 🟢 Low | Auto on test pass |
| Documentation | 🟢 Low | Auto on lint pass |
| Style/formatting | 🟢 Low | Auto |

**Timeout behavior:**
- Human approval request → Telegram @vibe-critical
- 1 hour timeout → Task paused, not abandoned
- Daily summary of pending approvals
- Emergency override: reply "APPROVE ALL" in Telegram

**Why this is right:**
- Prevents catastrophic mistakes (DB, API, deploy)
- Doesn't block routine work
- QA agent as "senior developer" for medium-risk
- Timeout pauses, doesn't fail = resumable
- Batch approval for busy days

---

### D7: Git Workflow
**Decision:** Branch per task, auto-merge to dev, human review to main

**Recommendation:**
```
main (protected)
  └── dev (auto-merge target)
        ├── task/TASK-001-implement-feature
        ├── task/TASK-002-fix-bug
        └── task/TASK-003-add-tests
```

**Flow:**
1. Agent picks up task → creates `task/TASK-XXX-slug` branch
2. Agent works, commits with conventional messages
3. Agent marks complete → PR to `dev` created
4. QA Agent runs verification on PR
5. QA passes → auto-merge to `dev`
6. Daily: Human reviews `dev` → merges to `main`

**Conflict handling:**
1. Orchestrator checks for conflicts before assignment
2. If file locked by another task → wait or pick different task
3. If conflict on merge → notify human, pause task

**Why this is right:**
- Isolation: each task in its own branch
- Automation: QA pass = merge to dev
- Safety: main requires human review
- Traceability: branch name = task ID
- Conflicts caught early by orchestrator

---

### D8: Budget and Rate Limits
**Decision:** Per-agent daily limits, tiered models, alert thresholds

**Recommendation:**

| Agent | Model | Daily Token Limit | Cost Cap |
|-------|-------|-------------------|----------|
| Orchestrator | Haiku | 500K | $1.50 |
| Build Agent | Opus | 2M | $60.00 |
| Spec Agent | Opus | 1M | $30.00 |
| QA Agent | Opus | 500K | $15.00 |
| Task Agent | Sonnet | 500K | $7.50 |
| Research Agent | Sonnet | 300K | $4.50 |
| Ideation (SIA) | Opus | 1M | $30.00 |
| **Daily Total** | - | ~6M | ~$150 |

**Thresholds:**
- 50% → Info log
- 80% → Warning to @vibe-critical
- 95% → Alert, slow down (2x delay between tasks)
- 100% → Pause agent, notify human

**Why this is right:**
- Haiku for coordination (cheap, fast)
- Opus for reasoning-heavy (build, spec, QA)
- Sonnet for structured tasks (task management, research)
- Daily limits prevent runaway costs
- Graduated response: warn → slow → stop
- $150/day = $4,500/month cap (adjust as needed)

**Cost tracking:**
```sql
CREATE TABLE token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    agent_id TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL,
    task_id TEXT
);

CREATE INDEX idx_usage_agent_date ON token_usage(agent_id, date(timestamp));
```

---

## Task Dashboard / Kanban System

### Overview
A web-based dashboard for managing the entire task hierarchy. Both humans and agents interact through the same system.

### Features

#### Kanban Board View
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│   BACKLOG   │    READY    │ IN PROGRESS │   REVIEW    │    DONE     │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │
│ │EPIC-001 │ │ │TASK-042 │ │ │TASK-039 │ │ │TASK-037 │ │ │TASK-035 │ │
│ │Ideation │ │ │Fix bug  │ │ │🤖 Build │ │ │🔍 QA    │ │ │✅ Done  │ │
│ │ ├─STORY │ │ │P1 🔴    │ │ │Agent    │ │ │Verify   │ │ │2h ago   │ │
│ │ ├─STORY │ │ └─────────┘ │ └─────────┘ │ └─────────┘ │ └─────────┘ │
│ │ └─STORY │ │ ┌─────────┐ │ ┌─────────┐ │             │ ┌─────────┐ │
│ └─────────┘ │ │TASK-043 │ │ │TASK-040 │ │             │ │TASK-034 │ │
│ ┌─────────┐ │ │Add API  │ │ │🤖 Spec  │ │             │ │✅ Done  │ │
│ │EPIC-002 │ │ │P2 🟡    │ │ │Agent    │ │             │ │5h ago   │ │
│ │Build    │ │ └─────────┘ │ └─────────┘ │             │ └─────────┘ │
│ └─────────┘ │             │             │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

#### Task Creation Modal
```
┌─────────────────────────────────────────────────────────────────────┐
│ Create New Task                                              [X]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Type:     [Epic ▼]  [Story ▼]  [Task ▼]  [Bug ▼]                   │
│                                                                     │
│ Parent:   [Select parent epic/story...           ▼]                │
│                                                                     │
│ Title:    [________________________________________________]        │
│                                                                     │
│ Description:                                                        │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │                                                                 ││
│ │                                                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ Priority: [P0 🔴] [P1 🟠] [P2 🟡] [P3 🟢]                           │
│                                                                     │
│ Assign to: [○ Agent: Build ▼] [○ Human: Ned]                       │
│                                                                     │
│ Pass Criteria (one per line):                                       │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ - [ ] Tests pass                                                ││
│ │ - [ ] No TypeScript errors                                      ││
│ │ - [ ] Documentation updated                                     ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ Labels:   [ideation] [backend] [urgent] [+ Add]                    │
│                                                                     │
│ Link to Spec: [ideas/vibe/ideation-prd.md                    ] 📎  │
│                                                                     │
│                              [Cancel]  [Create Task]                │
└─────────────────────────────────────────────────────────────────────┘
```

#### Task Detail View
```
┌─────────────────────────────────────────────────────────────────────┐
│ TASK-042: Fix candidateUpdate not triggering                        │
├─────────────────────────────────────────────────────────────────────┤
│ Type: Bug          Priority: P1 🔴        Status: In Progress       │
│ Created: 2h ago    Assigned: Build Agent  Est: 2h   Actual: 1.5h   │
├─────────────────────────────────────────────────────────────────────┤
│ Description:                                                        │
│ During E2E testing, ideas weren't appearing in the right panel.     │
│ The AI responded but candidateUpdate wasn't in JSON output.         │
├─────────────────────────────────────────────────────────────────────┤
│ Pass Criteria:                                          Progress    │
│ ☑ Strengthen system prompt instructions                    ✅       │
│ ☑ Add explicit candidateUpdate examples                    ✅       │
│ ☐ Verify with E2E test                                     ⏳       │
│ ☐ QA Agent confirms fix                                    ⏳       │
├─────────────────────────────────────────────────────────────────────┤
│ Activity Timeline:                                                  │
│ 10:15 🤖 Build Agent: Started working on task                       │
│ 10:18 🔧 Tool: edit_file → system-prompt.ts (+26 lines)            │
│ 10:19 📝 Commit: "fix: strengthen candidateUpdate instructions"     │
│ 10:20 🤖 Build Agent: Marked criteria 1 & 2 complete               │
│ 10:25 🔍 QA Agent: Scheduled for verification                       │
├─────────────────────────────────────────────────────────────────────┤
│ Links:                                                              │
│ 📄 Spec: ideas/vibe/ideation-prd.md#candidate-tracking             │
│ 🔗 PR: #127 (pending)                                               │
│ 💬 Telegram: @vibe-build/1234                                       │
├─────────────────────────────────────────────────────────────────────┤
│ [Edit] [Assign] [Add Criteria] [Block] [Cancel] [Mark Done]        │
└─────────────────────────────────────────────────────────────────────┘
```

#### Filters and Views
- **By Type:** Epics | Stories | Tasks | Bugs | All
- **By Status:** Backlog | Ready | In Progress | Review | Done | Blocked
- **By Agent:** Build | Spec | QA | Task | Unassigned
- **By Priority:** P0 | P1 | P2 | P3
- **By Label:** Custom tags
- **Search:** Full-text search across title, description

#### Epic/Story Hierarchy View
```
EPIC-001: Ideation System (SIA)                          [=====>    ] 45%
├── STORY-001: Session Management                        [========= ] 90%
│   ├── TASK-001: Create session API ✅
│   ├── TASK-002: Session persistence ✅
│   ├── TASK-003: Session resume ✅
│   └── TASK-004: Session handoff ⏳
├── STORY-002: Idea Capture                              [====>     ] 40%
│   ├── TASK-005: candidateUpdate parsing ✅
│   ├── TASK-006: Right panel display ✅
│   ├── TASK-007: Idea persistence 🔄
│   └── TASK-008: Idea editing ⏳
└── STORY-003: Web Search Integration                    [=         ] 10%
    ├── TASK-009: Search API ✅
    ├── TASK-010: Result parsing ⏳
    └── TASK-011: Artifact display ⏳
```

### Dashboard API

```typescript
// Task CRUD
POST   /api/tasks              // Create task
GET    /api/tasks              // List tasks (with filters)
GET    /api/tasks/:id          // Get task detail
PATCH  /api/tasks/:id          // Update task
DELETE /api/tasks/:id          // Delete task

// Bulk operations
POST   /api/tasks/bulk-update  // Update multiple tasks
POST   /api/tasks/bulk-move    // Move tasks between statuses

// Hierarchy
GET    /api/tasks/:id/children // Get child tasks
POST   /api/tasks/:id/children // Create child task

// Agent operations
POST   /api/tasks/:id/assign   // Assign to agent
POST   /api/tasks/:id/complete // Mark complete (triggers QA)
POST   /api/tasks/:id/block    // Mark blocked with reason

// Pass criteria
POST   /api/tasks/:id/criteria         // Add criteria
PATCH  /api/tasks/:id/criteria/:idx    // Update criteria
DELETE /api/tasks/:id/criteria/:idx    // Remove criteria

// Activity
GET    /api/tasks/:id/activity // Get activity timeline

// Analytics
GET    /api/analytics/velocity        // Tasks completed per day
GET    /api/analytics/agent-load      // Tasks per agent
GET    /api/analytics/bottlenecks     // Blocked tasks analysis
GET    /api/analytics/burndown        // Epic progress over time
```

### Real-time Updates (WebSocket)
```typescript
// Client subscribes to task updates
ws.send({ type: 'subscribe', filters: { status: ['in_progress', 'review'] }});

// Server pushes updates
ws.onmessage = (event) => {
  const { type, task } = JSON.parse(event.data);
  // type: 'task_created', 'task_updated', 'task_moved', 'activity_added'
  updateBoard(task);
};
```

### Agent Integration
Agents interact with tasks via the same API:

```python
# Task Agent creates a new task
response = requests.post(f"{DASHBOARD_URL}/api/tasks", json={
    "type": "task",
    "parent_id": "STORY-002",
    "title": "Implement candidateUpdate validation",
    "description": "Ensure candidateUpdate JSON is validated before processing",
    "priority": "P2",
    "assigned_agent": "build_agent",
    "pass_criteria": [
        "JSON schema validation added",
        "Invalid updates rejected with error",
        "Tests cover edge cases"
    ],
    "labels": ["backend", "validation"],
    "created_by": "task_agent"
})

# Build Agent marks criteria complete
requests.patch(f"{DASHBOARD_URL}/api/tasks/TASK-042/criteria/0", json={
    "completed": True,
    "evidence": "Commit abc123: Added schema validation"
})

# Build Agent marks task complete (triggers QA)
requests.post(f"{DASHBOARD_URL}/api/tasks/TASK-042/complete", json={
    "notes": "All criteria met, ready for verification",
    "pr_link": "https://github.com/org/repo/pull/127"
})
```

---

## Observability & Agent Logs UI (CRITICAL)

> **This is the most important part of the UI.** Inspired by Vibe's PipelineDashboard, AgentsTab, and AgentSessionsView components.

### Overview

The Observability UI provides real-time visibility into:
1. **Agent Status** - Health, current task, metrics
2. **Event Stream** - Live feed of all events with filtering
3. **Agent Sessions** - Loop iterations, log previews, checkpoints
4. **Log Viewer** - Full log files with search and highlighting

### Main Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AGENT HARNESS DASHBOARD                              🟢 Connected   [⟳]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Kanban] [Observability] [Analytics] [Settings]                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─── OBSERVABILITY TAB ─────────────────────────────────────────────────┐  │
│  │  [Agent Status] [Event Stream] [Sessions] [Logs]                      │  │
│  │                                                                        │  │
│  │  ... content based on selected sub-tab ...                            │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sub-Tab 1: Agent Status Cards

Real-time health cards for each agent (like AgentsTab monitoring view):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AGENT STATUS                                     Last updated: 10:45:32    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ 🤖 ORCHESTRATOR │  │ 🔨 BUILD AGENT  │  │ 📋 SPEC AGENT   │              │
│  │ Status: 🟢 Active│  │ Status: 🟢 Working│ │ Status: ⚪ Idle  │              │
│  │ Model: Haiku    │  │ Model: Opus     │  │ Model: Opus     │              │
│  │                 │  │                 │  │                 │              │
│  │ Current Task:   │  │ Current Task:   │  │ Waiting for     │              │
│  │ Tick #142       │  │ TASK-042        │  │ assignment      │              │
│  │                 │  │ Fix candidate..  │  │                 │              │
│  │ ─────────────── │  │ ─────────────── │  │ ─────────────── │              │
│  │ Tasks: 0        │  │ Tasks: 12 ✅ 2 ❌│  │ Tasks: 8 ✅ 0 ❌ │              │
│  │ Tokens: 45K/500K│  │ Tokens: 1.2M/2M │  │ Tokens: 400K/1M │              │
│  │ Cost: $0.12     │  │ Cost: $42.50    │  │ Cost: $12.00    │              │
│  │ Heartbeat: 5s   │  │ Heartbeat: 12s  │  │ Heartbeat: 45s  │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ 🔍 QA AGENT     │  │ 📊 TASK AGENT   │  │ 🔬 RESEARCH     │              │
│  │ Status: 🟡 Queue│  │ Status: 🟢 Working│ │ Status: ⚪ Idle  │              │
│  │ Model: Opus     │  │ Model: Sonnet   │  │ Model: Sonnet   │              │
│  │                 │  │                 │  │                 │              │
│  │ Queued:         │  │ Current Task:   │  │ No active       │              │
│  │ Verify TASK-042 │  │ Decompose       │  │ research        │              │
│  │ (in 2 ticks)    │  │ EPIC-003        │  │ requests        │              │
│  │ ─────────────── │  │ ─────────────── │  │ ─────────────── │              │
│  │ Verified: 15    │  │ Created: 24     │  │ Searches: 8     │              │
│  │ Rejected: 2     │  │ Decomposed: 5   │  │ Reports: 4      │              │
│  │ Tokens: 380K/500K│ │ Tokens: 200K/500K│ │ Tokens: 50K/300K│              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │ 💡 SIA (Ideation)│                                                       │
│  │ Status: 🔴 Error │  ⚠️ IntentClassifier API key issue                    │
│  │ Model: Opus     │  Using fallback (not blocking)                         │
│  │ ─────────────── │                                                        │
│  │ Sessions: 3     │  [View Logs] [Restart Agent]                           │
│  │ Ideas: 2        │                                                        │
│  └─────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sub-Tab 2: Event Stream (Real-Time)

Live feed of all events, inspired by ExecutionStream component:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EVENT STREAM                                    [Auto-scroll: ON] [Clear]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filter: [All ▼] [Tasks ▼] [Agents ▼] [Tools ▼] [Errors ▼]   🔍 Search...  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  10:45:32  🟢 task:assigned     TASK-042 → Build Agent                      │
│  10:45:33  🔧 tool:started      Build Agent: read_file                      │
│                                 → agents/ideation/system-prompt.ts          │
│  10:45:34  🔧 tool:completed    Build Agent: read_file (1.2s, 2.4KB)        │
│  10:45:35  🔧 tool:started      Build Agent: edit_file                      │
│                                 → agents/ideation/system-prompt.ts          │
│  10:45:38  🔧 tool:completed    Build Agent: edit_file (+26 lines)          │
│  10:45:38  📝 file:modified     system-prompt.ts                            │
│                                 Diff: +26 / -0 lines [View Diff]            │
│  10:45:39  🔧 tool:started      Build Agent: exec                           │
│                                 → npm run typecheck                         │
│  10:45:45  🔧 tool:completed    Build Agent: exec (exit 0, 6.1s)            │
│  10:45:46  ✅ criteria:passed   TASK-042 criteria[0]: "System prompt..."    │
│  10:45:46  ✅ criteria:passed   TASK-042 criteria[1]: "Add examples..."     │
│  10:45:47  📋 task:progress     TASK-042: 2/4 criteria complete             │
│  10:45:48  💬 telegram:sent     @vibe-build: "✏️ File Modified..."          │
│  10:45:50  🔧 tool:started      Build Agent: exec                           │
│                                 → git add -A && git commit -m "fix: ..."    │
│  10:45:52  🔧 tool:completed    Build Agent: exec (exit 0, 2.1s)            │
│  10:45:52  📝 git:commit        3af31af: "fix: strengthen candidateUpdate"  │
│  10:45:53  💬 telegram:sent     @vibe-build: "📝 Commit: 3af31af..."        │
│  10:46:00  ⏰ cron:tick         Tick #143: 3 agents working, 1 idle         │
│  10:46:01  🔍 qa:scheduled      QA verification for TASK-042 (next tick)    │
│                                                                              │
│  ─────────────────────────── End of stream ───────────────────────────────  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Event Types:**
| Category | Events |
|----------|--------|
| Task | `task:assigned`, `task:started`, `task:completed`, `task:failed`, `task:blocked`, `task:progress` |
| Agent | `agent:started`, `agent:idle`, `agent:error`, `agent:heartbeat` |
| Tool | `tool:started`, `tool:completed`, `tool:error` |
| File | `file:read`, `file:modified`, `file:created`, `file:deleted` |
| Git | `git:commit`, `git:push`, `git:branch`, `git:pr` |
| QA | `qa:scheduled`, `qa:started`, `qa:passed`, `qa:failed` |
| Cron | `cron:tick`, `cron:qa_cycle` |
| Telegram | `telegram:sent`, `telegram:error` |

### Sub-Tab 3: Agent Sessions View

Loop iterations with expandable logs, inspired by AgentSessionsView:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AGENT SESSIONS                                          [Refresh] [Export] │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filter: [All Agents ▼] [Running ▼] [Last 24h ▼]         🔍 Search...      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ▼ SESSION-001: Build Agent Alpha                                           │
│    Status: 🟢 Running    Started: 2h ago    Tasks: 12 ✅ 2 ❌               │
│    Task List: API Implementation    Current: Iteration 3                    │
│                                                                              │
│    Loop Iterations:                                                          │
│    ┌──────┬──────────┬────────┬───────┬────────────────────────────────────┐│
│    │ Iter │ Status   │ Tasks  │ Time  │ Log Preview                        ││
│    ├──────┼──────────┼────────┼───────┼────────────────────────────────────┤│
│    │  1   │ ✅ Done  │ 5/5    │ 10min │ ✓ Created endpoint /api/users     ││
│    │      │          │        │       │ ✓ Added validation middleware     ││
│    │      │          │        │       │ ✓ Generated types                 ││
│    │      │          │        │       │ [View Full Log]                   ││
│    ├──────┼──────────┼────────┼───────┼────────────────────────────────────┤│
│    │  2   │ ❌ Failed│ 3/5    │ 13min │ ✓ Updated database schema         ││
│    │      │          │        │       │ ✗ Test suite failed               ││
│    │      │          │        │       │ TypeError: Cannot read 'id'...    ││
│    │      │          │        │       │ [View Full Log] [View Errors]     ││
│    ├──────┼──────────┼────────┼───────┼────────────────────────────────────┤│
│    │  3   │ 🔄 Active│ 4/?    │ 8min  │ ✓ Fixed auth.ts type error        ││
│    │      │          │        │       │ ✓ Updated test mocks              ││
│    │      │          │        │       │ ▶ Running integration tests...    ││
│    │      │          │        │       │ [View Live Log]                   ││
│    └──────┴──────────┴────────┴───────┴────────────────────────────────────┘│
│                                                                              │
│  ▶ SESSION-002: Spec Agent                                                  │
│    Status: ✅ Completed    Duration: 45min    Tasks: 8 ✅ 0 ❌              │
│                                                                              │
│  ▶ SESSION-003: QA Agent                                                    │
│    Status: 🟡 Queued    Waiting: Verify TASK-042                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sub-Tab 4: Log Viewer Modal

Full log viewing with search and syntax highlighting:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LOG: Build Agent - Session 001 - Iteration 3                    [X Close] │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔍 Search: [candidateUpdate          ]  [Prev] [Next]  Matches: 3         │
│  Filter: [All ▼]   [Show timestamps ☑]  [Wrap lines ☑]  [Download]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [10:42:15] === ITERATION 3 STARTED ===                                     │
│  [10:42:15] Task: TASK-042 - Fix candidateUpdate not triggering            │
│  [10:42:15] Pass Criteria:                                                  │
│  [10:42:15]   [ ] Strengthen system prompt instructions                    │
│  [10:42:15]   [ ] Add explicit candidateUpdate examples                    │
│  [10:42:15]   [ ] Verify with E2E test                                     │
│  [10:42:15]   [ ] QA Agent confirms fix                                    │
│  [10:42:16]                                                                 │
│  [10:42:16] > Reading file: agents/ideation/system-prompt.ts               │
│  [10:42:17] < File read: 24,892 bytes                                      │
│  [10:42:18]                                                                 │
│  [10:42:18] Analyzing current candidateUpdate instructions...              │ ← HIGHLIGHTED
│  [10:42:19] Found: candidateUpdate mentioned but no usage guidelines       │ ← HIGHLIGHTED
│  [10:42:20]                                                                 │
│  [10:42:20] > Editing file: agents/ideation/system-prompt.ts               │
│  [10:42:21] + Added section: "CANDIDATE UPDATE — WHEN TO USE"              │
│  [10:42:21] + Added 26 lines of instructions and examples                  │
│  [10:42:22] < Edit complete: +26 / -0 lines                                │
│  [10:42:23]                                                                 │
│  [10:42:23] > Running: npm run typecheck                                   │
│  [10:42:29] < Exit 0 (6.1s) - No TypeScript errors                         │
│  [10:42:30]                                                                 │
│  [10:42:30] ✅ Criteria[0] PASSED: System prompt strengthened              │
│  [10:42:30] ✅ Criteria[1] PASSED: Examples added                          │
│  [10:42:31]                                                                 │
│  [10:42:31] > Running: git add -A && git commit -m "fix: strengthen..."    │
│  [10:42:33] < Commit: 3af31af                                              │
│  [10:42:34]                                                                 │
│  [10:42:34] Progress: 2/4 criteria complete                                │
│  [10:42:35] Notifying Telegram: @vibe-build                                │
│  [10:42:36]                                                                 │
│  [10:42:36] Next: Run E2E test to verify fix...                            │
│  [10:42:37] ▶ ITERATION CONTINUING...                                      │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Lines: 156   Size: 12.4KB   Updated: 3s ago   [Auto-refresh: ON]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### WebSocket Events Schema

```typescript
// WebSocket connection
const ws = new WebSocket('ws://localhost:3333/ws/observability');

// Subscribe to specific event types
ws.send(JSON.stringify({
  type: 'subscribe',
  filters: {
    eventTypes: ['task:*', 'agent:*', 'tool:*'],
    agents: ['build_agent', 'qa_agent'],
    severity: ['info', 'warning', 'error']
  }
}));

// Incoming events
interface ObservabilityEvent {
  id: string;
  timestamp: string;
  eventType: string;
  agentId: string;
  agentName: string;
  taskId?: string;
  sessionId?: string;
  iterationNumber?: number;
  severity: 'debug' | 'info' | 'warning' | 'error';
  payload: {
    message: string;
    details?: Record<string, unknown>;
    duration?: number;
    exitCode?: number;
    filePath?: string;
    diff?: { added: number; removed: number };
    error?: string;
    stackTrace?: string;
  };
}

// Agent status update
interface AgentStatusUpdate {
  type: 'agent:status';
  agentId: string;
  status: 'idle' | 'working' | 'error' | 'stuck';
  currentTask?: string;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    tokensUsed: number;
    tokenLimit: number;
    costUsd: number;
    lastHeartbeat: string;
  };
}

// Log stream (for live log viewing)
interface LogChunk {
  type: 'log:chunk';
  sessionId: string;
  iteration: number;
  timestamp: string;
  line: string;
  level: 'debug' | 'info' | 'warning' | 'error';
}
```

### Observability API Endpoints

```typescript
// Event stream (paginated)
GET  /api/observability/events?limit=100&before=<cursor>&types=task:*,agent:*

// Agent status
GET  /api/observability/agents              // All agents
GET  /api/observability/agents/:id          // Single agent
GET  /api/observability/agents/:id/metrics  // Agent metrics

// Sessions
GET  /api/observability/sessions            // All sessions (paginated)
GET  /api/observability/sessions/:id        // Session detail
GET  /api/observability/sessions/:id/iterations  // Iterations
GET  /api/observability/sessions/:id/iterations/:num/log  // Full log

// Live log streaming
GET  /api/observability/sessions/:id/log/stream  // SSE stream

// Search
GET  /api/observability/search?q=candidateUpdate&agent=build_agent

// Analytics
GET  /api/observability/analytics/events-per-minute
GET  /api/observability/analytics/agent-activity
GET  /api/observability/analytics/error-rate
```

### Database Schema for Observability

```sql
-- Events table (append-only, high-write)
CREATE TABLE observability_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    task_id TEXT,
    session_id TEXT,
    iteration_number INTEGER,
    severity TEXT CHECK(severity IN ('debug', 'info', 'warning', 'error')),
    message TEXT NOT NULL,
    payload JSON,
    telegram_message_id TEXT
);

CREATE INDEX idx_events_timestamp ON observability_events(timestamp);
CREATE INDEX idx_events_type ON observability_events(event_type);
CREATE INDEX idx_events_agent ON observability_events(agent_id);
CREATE INDEX idx_events_session ON observability_events(session_id);

-- Agent sessions
CREATE TABLE agent_sessions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    status TEXT CHECK(status IN ('running', 'completed', 'failed', 'paused')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    current_iteration INTEGER DEFAULT 1,
    total_iterations INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    parent_session_id TEXT,
    task_id TEXT,
    metadata JSON
);

-- Iteration logs
CREATE TABLE iteration_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    iteration_number INTEGER NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT CHECK(status IN ('running', 'completed', 'failed')),
    log_content TEXT,  -- Full log text
    log_preview TEXT,  -- First 500 chars
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    errors JSON,
    checkpoints JSON,
    FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
    UNIQUE(session_id, iteration_number)
);

CREATE INDEX idx_logs_session ON iteration_logs(session_id);
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL HARNESS SERVER                           │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         TASK DASHBOARD (port 3333)                     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │ │
│  │  │ Kanban   │ │ Task     │ │ Epic     │ │Analytics │ │ Settings │     │ │
│  │  │ Board    │ │ Detail   │ │ Tree     │ │Dashboard │ │          │     │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │ │
│  │                              │                                         │ │
│  │  ┌───────────────────────────▼─────────────────────────────────────┐  │ │
│  │  │                    REST API + WebSocket                          │  │ │
│  │  └───────────────────────────┬─────────────────────────────────────┘  │ │
│  └──────────────────────────────┼────────────────────────────────────────┘ │
│                                 │                                           │
│  ┌──────────────────────────────▼────────────────────────────────────────┐ │
│  │                    ORCHESTRATOR (cron every 1 min)                     │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │  1. Check agent health                                          │   │ │
│  │  │  2. Query tasks ready for work                                  │   │ │
│  │  │  3. Assign tasks to idle agents                                 │   │ │
│  │  │  4. Check progress on active tasks                              │   │ │
│  │  │  5. Every 10th tick: spawn QA Agent                             │   │ │
│  │  │  6. Post summary to Telegram                                    │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────┬───────────────────────────────────────┘ │
│                                  │                                          │
│         ┌────────────────────────┼────────────────────────┐                │
│         │                        │                        │                │
│    ┌────▼────┐            ┌──────▼──────┐          ┌──────▼──────┐        │
│    │   SIA   │            │    SPEC     │          │   BUILD     │        │
│    │  Agent  │            │    Agent    │          │   Agent     │        │
│    │ (Opus)  │            │   (Opus)    │          │   (Opus)    │        │
│    └────┬────┘            └──────┬──────┘          └──────┬──────┘        │
│         │                        │                        │                │
│    ┌────▼────┐            ┌──────▼──────┐          ┌──────▼──────┐        │
│    │  TASK   │            │  RESEARCH   │          │     QA      │        │
│    │  Agent  │            │    Agent    │          │   Agent     │        │
│    │(Sonnet) │            │  (Sonnet)   │          │   (Opus)    │        │
│    └─────────┘            └─────────────┘          └─────────────┘        │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                       SHARED INFRASTRUCTURE                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │ Message  │ │ Telegram │ │  Token   │ │   Git    │ │Checkpoint│ │   │
│  │  │   Bus    │ │ Notifier │ │ Tracker  │ │ Manager  │ │ Manager  │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                       │                                    │
│  ┌────────────────────────────────────▼────────────────────────────────┐  │
│  │                          HARNESS DATABASE (SQLite)                   │  │
│  │  • tasks (epics, stories, tasks, bugs)                               │  │
│  │  • agent_status (health, current work)                               │  │
│  │  • message_bus (inter-agent events)                                  │  │
│  │  • execution_log (full audit trail)                                  │  │
│  │  • token_usage (cost tracking)                                       │  │
│  │  • qa_results (verification outcomes)                                │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ File system access (volume mount)
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                             VIBE PLATFORM (separate)                          │
│  • Source code: /home/ned/Documents/Idea_Incubator/Idea_Incubator            │
│  • Can restart independently                                                  │
│  • Agents read/write files, run tests                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Parallelism, Waves & Loop Validation

> **Critical for observability:** Every loop (iteration) done by an agent must be validated. This mirrors how Vibe's Observability → Agents → Sessions tab works.

### Execution Hierarchy

```
Execution Run (one run of a task list)
├── Wave 1 (parallel group)
│   ├── Lane: database
│   │   ├── Task A → Agent Session → Iteration 1 ✅ QA Passed
│   │   │                          → Iteration 2 ✅ QA Passed
│   │   └── Task B → Agent Session → Iteration 1 ❌ QA Failed
│   │                              → Iteration 2 ✅ QA Passed
│   └── Lane: api
│       └── Task C → Agent Session → Iteration 1 ✅ QA Passed
├── Wave 2 (starts after Wave 1 completes)
│   ├── Lane: ui
│   │   └── Task D → Agent Session → ...
│   └── Lane: tests
│       └── Task E → Agent Session → ...
└── Wave 3
    └── ...
```

### Waves

**Definition:** A wave is a group of tasks that CAN run in parallel (no dependencies between them).

**Rules:**
1. All tasks in Wave N must complete before Wave N+1 starts
2. Tasks within a wave can run simultaneously
3. Wave number is calculated based on dependency graph
4. Failed tasks in a wave may block the entire wave

**Database:** `execution_waves` table

### Lanes (Swimlanes)

**Definition:** A lane is a category grouping for tasks based on file patterns.

**Categories:**
- `database` - migrations, schema changes
- `types` - TypeScript types, interfaces
- `api` - backend routes, controllers
- `ui` - frontend components, pages
- `tests` - test files
- `infrastructure` - config, CI/CD
- `other` - everything else

**Why Lanes Matter:**
1. Visual organization in UI (swimlane view)
2. Conflict detection (same lane = potential file conflicts)
3. Agent specialization (Build Agent might prefer `api` lane)

**Database:** `execution_lanes`, `lane_tasks` tables

### Agent Sessions & Iterations

**Session:** One execution run of an agent on a task.

**Iteration (Loop):** Each attempt within a session. An agent might take multiple iterations to complete a task.

```
Agent Session
├── Iteration 1: Attempted fix, tests failed
├── Iteration 2: Fixed bug, tests still failing
├── Iteration 3: All tests pass ✅
└── Session Complete
```

**What's tracked per iteration:**
- `tasks_attempted`, `tasks_completed`, `tasks_failed`
- `files_modified` (JSON array)
- `commits` (JSON array)
- `log_content` (full CLI output)
- `tool_calls` (JSON array of all tool invocations)
- `skill_uses` (JSON array of Claude skill uses)
- `errors` (JSON array)
- `checkpoints` (for rollback)

### Loop-by-Loop QA Validation

**Every single iteration must be validated by QA.** This is critical.

**Validation Flow:**
```
1. Agent completes an iteration
2. Iteration status → 'qa_pending'
3. QA Agent picks up pending iterations
4. QA runs verification:
   - TypeScript compiles?
   - Tests pass?
   - No regressions?
   - Lint passes?
5. QA records result:
   - 'passed' → iteration verified
   - 'failed' → needs revision
6. Iteration status updated with QA result
```

**Database:** `iteration_logs.qa_result`, `iteration_qa_results` table

### Stuck Detection (Every 15 Minutes)

**QA Agent audits all active sessions every 15 minutes:**

1. Check CLI output (`log_content`) for each active iteration
2. Look for signs of being stuck:
   - No new tool calls in last 5 minutes
   - Repeating the same action
   - Error loop
   - No output at all
3. If genuinely stuck:
   - Terminate the session
   - Mark iteration as failed
   - Notify Telegram @vibe-critical
   - Free up the agent for new work

**Why verbose output matters:**
```
# Good: Easy to detect progress
10:45:32 🔧 tool:read_file → system-prompt.ts
10:45:33 🔧 tool:edit_file → system-prompt.ts (+26 lines)
10:45:34 🔧 tool:exec → npm run typecheck (exit 0)
10:45:35 ✅ Criteria 1 passed

# Bad: Impossible to know if stuck
... silence for 10 minutes ...
```

**Agents MUST log:**
- Every tool call with parameters
- Every skill use
- Every file read/write
- Every command execution
- Progress on criteria

### Session Grouping in UI

**Sessions View (like Vibe's Observability → Agents → Sessions):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ AGENT SESSIONS                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ▼ Run #42: Task List "API Implementation"                   [Wave 2 of 3]  │
│   │                                                                         │
│   ├─ Wave 1 (completed)                                                     │
│   │   ├── Build Agent: TASK-001 [3 iterations] ✅ All QA Passed            │
│   │   ├── Build Agent: TASK-002 [1 iteration]  ✅ QA Passed                │
│   │   └── Spec Agent:  TASK-003 [2 iterations] ✅ All QA Passed            │
│   │                                                                         │
│   ├─ Wave 2 (active)                                                        │
│   │   ├── Build Agent: TASK-004 [Iteration 2]  🔄 Running                  │
│   │   │   └── [View Live Log] [View Iteration 1 QA: ✅]                    │
│   │   └── Build Agent: TASK-005 [Iteration 1]  ⏳ QA Pending               │
│   │       └── [View Log] [Trigger QA]                                       │
│   │                                                                         │
│   └─ Wave 3 (pending)                                                       │
│       └── 5 tasks waiting                                                   │
│                                                                              │
│ ▶ Run #41: Task List "Database Migrations"                  [Completed]    │
│ ▶ Run #40: Task List "UI Components"                        [Completed]    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Iteration Detail (expandable):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TASK-004 Iteration 2                                        [🔄 Running]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Started: 10:42:15    Duration: 8m 32s    Agent: Build Agent                │
│                                                                              │
│ Previous Iterations:                                                         │
│ ┌──────┬────────┬────────┬────────────────────────────────────────────────┐│
│ │ #    │ Status │ QA     │ Summary                                         ││
│ ├──────┼────────┼────────┼────────────────────────────────────────────────┤│
│ │ 1    │ Done   │ ✅     │ Created endpoint, tests failed (auth issue)     ││
│ └──────┴────────┴────────┴────────────────────────────────────────────────┘│
│                                                                              │
│ Current Iteration Log:                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 10:42:15 ▶ Starting iteration 2                                         ││
│ │ 10:42:16 🔧 tool:read_file → server/routes/api.ts                       ││
│ │ 10:42:18 🔧 tool:edit_file → server/routes/api.ts (+15 lines)           ││
│ │ 10:42:20 🔧 tool:exec → npm test (running...)                           ││
│ │ 10:50:47 ▶ Waiting for test completion...                               ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│ Tool Calls: 3    Files Modified: 1    Commits: 0                            │
│ [View Full Log] [View Diff] [Trigger QA] [Terminate Session]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Definitions

### 1. Orchestrator Agent
**Purpose:** Coordinate all other agents, assign tasks, detect issues
**Model:** Haiku (fast, cheap decisions)
**Telegram:** Posts to @vibe-orchestrator, @vibe-critical (errors only)

**Responsibilities:**
- Read current system state every cron tick
- Query dashboard for ready tasks
- Match tasks to available agents
- Detect stuck/blocked agents (>30 min no progress)
- Spawn QA agent every 10th tick
- Escalate to human via @vibe-critical

**Pass Criteria:**
```
✅ Orchestrator tick PASSES if:
- All idle agents assigned work OR no tasks available
- No agent stuck >30 min without alert
- QA spawned on schedule (tick % 10 == 0)
- Critical issues posted to Telegram within 60s
```

### 2. Ideation Agent (SIA)
**Purpose:** Continue ideation sessions, capture ideas
**Model:** Opus (complex reasoning, user empathy)
**Telegram:** Posts to @vibe-agents (verbose), @vibe-critical (blocks)

**Task Types:** `ideation_session`, `idea_capture`, `follow_up`

**Pass Criteria:**
```
✅ Ideation task PASSES if:
- User message responded within 30s
- candidateUpdate emitted when idea direction emerges
- Response is valid JSON (no parse errors)
- Session state persisted to database
```

### 3. Specification Agent
**Purpose:** Generate specifications from captured ideas
**Model:** Opus (detailed technical writing)
**Telegram:** Posts to @vibe-agents, @vibe-critical

**Task Types:** `generate_prd`, `extract_requirements`, `create_acceptance_criteria`

**Pass Criteria:**
```
✅ Spec task PASSES if:
- PRD contains: Problem, Solution, Requirements, Acceptance Criteria
- All acceptance criteria are testable (specific, measurable)
- Requirements linked to source (ideation transcript)
- Child tasks created in dashboard
```

### 4. Build Agent
**Purpose:** Implement code from specifications
**Model:** Opus (coding, reasoning)
**Telegram:** Posts to @vibe-build (all), @vibe-critical (failures)

**Task Types:** `implement_feature`, `fix_bug`, `write_tests`, `refactor`

**Pass Criteria:**
```
✅ Build task PASSES if:
- TypeScript compiles without errors
- All new tests pass
- No regression in existing tests
- Commit message follows conventional commits
- PR created with task ID in title
```

### 5. Task Agent
**Purpose:** Manage task lifecycle, decomposition, prioritization
**Model:** Sonnet (structured reasoning)
**Telegram:** Posts to @vibe-agents, @vibe-critical

**Task Types:** `decompose_epic`, `prioritize_backlog`, `update_status`

**Pass Criteria:**
```
✅ Task management PASSES if:
- Epics decomposed into ≤10 stories
- Stories decomposed into ≤5 tasks
- Each task has pass criteria
- Priority reflects dependencies and value
```

### 6. Research Agent
**Purpose:** Gather external information for other agents
**Model:** Sonnet (search + synthesis)
**Telegram:** Posts to @vibe-agents

**Task Types:** `market_research`, `competitor_analysis`, `technical_feasibility`

**Pass Criteria:**
```
✅ Research task PASSES if:
- Query relevant to request
- Results synthesized (not raw dumps)
- Sources cited with URLs
- Findings actionable for requesting agent
```

### 7. QA Agent
**Purpose:** Independent verification of all agent work
**Model:** Opus (critical analysis)
**Telegram:** Posts to @vibe-qa (reports), @vibe-critical (failures)
**Schedule:** Every 10th cron tick + on-demand for task verification

**Task Types:** `verify_build`, `verify_spec`, `audit_agent`, `bottleneck_report`

**Pass Criteria:**
```
✅ QA verification PASSES if:
- Tests actually executed (not just claimed)
- Build succeeds independently
- Spec meets quality checklist
- Report generated with actionable items
```

---

## Verification Scripts

### Build Verification
```bash
#!/bin/bash
# scripts/verify-build.sh
set -e

TASK_ID=$1
WORKSPACE=/workspace

cd $WORKSPACE

echo "=== TypeScript Compile ==="
npm run typecheck
if [ $? -ne 0 ]; then
    echo "FAIL: TypeScript errors"
    exit 1
fi

echo "=== Unit Tests ==="
npm test -- --run
if [ $? -ne 0 ]; then
    echo "FAIL: Tests failed"
    exit 1
fi

echo "=== Regression Check ==="
npm run test:regression 2>/dev/null || true

echo "=== Lint ==="
npm run lint
if [ $? -ne 0 ]; then
    echo "WARN: Lint issues (non-blocking)"
fi

echo "PASS: Build verification complete"
exit 0
```

### Spec Verification
```bash
#!/bin/bash
# scripts/verify-spec.sh
set -e

SPEC_FILE=$1

echo "=== Required Sections ==="
SECTIONS=("Problem Statement" "Solution" "Requirements" "Acceptance Criteria")
for section in "${SECTIONS[@]}"; do
    if ! grep -qi "$section" "$SPEC_FILE"; then
        echo "FAIL: Missing section: $section"
        exit 1
    fi
done

echo "=== Acceptance Criteria Count ==="
AC_COUNT=$(grep -c "^\s*-\s*\[" "$SPEC_FILE" || echo 0)
if [ "$AC_COUNT" -lt 3 ]; then
    echo "FAIL: Need at least 3 acceptance criteria (found $AC_COUNT)"
    exit 1
fi

echo "=== Testability Check ==="
# Check for vague words
VAGUE_WORDS="should|might|could|possibly|etc|various"
if grep -Ei "$VAGUE_WORDS" "$SPEC_FILE" | grep -i "acceptance"; then
    echo "WARN: Acceptance criteria may contain vague language"
fi

echo "PASS: Spec verification complete"
exit 0
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-3)
- [ ] Create `agent-harness/` repository
- [ ] Docker Compose setup with orchestrator container
- [ ] Harness database schema (tasks, agents, events)
- [ ] Telegram bot with channel posting
- [ ] Basic cron tick (health check only)

**Test:** `docker-compose up` → cron runs → Telegram receives "Harness online"

### Phase 2: Task Dashboard (Days 4-7)
- [ ] React dashboard with Kanban board
- [ ] Task CRUD API
- [ ] WebSocket for real-time updates
- [ ] Task creation modal (all types)
- [ ] Epic/Story hierarchy view

**Test:** Create epic → add stories → add tasks → drag to columns → see updates

### Phase 3: Single Agent (Days 8-10)
- [ ] Build Agent implementation
- [ ] Task assignment from dashboard
- [ ] File edit with Telegram notification
- [ ] Git branch creation
- [ ] PR creation on completion

**Test:** Assign task to Build Agent → edits file → commits → PR created → Telegram shows progress

### Phase 4: QA Validation (Days 11-13)
- [ ] QA Agent implementation
- [ ] Verification scripts
- [ ] Pass/fail determination
- [ ] Auto-merge on pass
- [ ] Rejection flow (needs_revision)

**Test:** Build Agent completes → QA verifies → passes → auto-merge to dev

### Phase 5: Multi-Agent (Days 14-18)
- [ ] All 7 agents implemented
- [ ] Orchestrator task assignment logic
- [ ] Inter-agent message bus
- [ ] Stuck detection and recovery
- [ ] Human approval gates

**Test:** Full flow: Task created → Spec Agent writes PRD → Tasks created → Build Agent implements → QA verifies

### Phase 6: Resilience & Observability (Days 19-21)
- [ ] Token tracking and budget enforcement
- [ ] Checkpoint/rollback for agents
- [ ] Analytics dashboard (velocity, burndown)
- [ ] Error taxonomy and handling
- [ ] 24-hour unattended test

**Test:** Run overnight → tasks completed → no crashes → budget respected → morning report accurate

---

## File Structure

```
agent-harness/
├── README.md
├── docker-compose.yml
├── .env.example
│
├── orchestrator/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # Entry point
│   ├── cron.py                 # Cron tick logic
│   ├── state_manager.py        # System state
│   ├── task_assigner.py        # Match tasks to agents
│   └── health_checker.py       # Stuck detection
│
├── agents/
│   ├── base_agent.py           # Base class
│   ├── ideation_agent.py
│   ├── spec_agent.py
│   ├── build_agent.py
│   ├── task_agent.py
│   ├── research_agent.py
│   └── qa_agent.py
│
├── dashboard/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskDetail.tsx
│   │   │   ├── TaskModal.tsx
│   │   │   ├── EpicTree.tsx
│   │   │   └── Analytics.tsx
│   │   ├── api/
│   │   │   ├── tasks.ts
│   │   │   └── websocket.ts
│   │   └── types/
│   │       └── task.ts
│   └── server/
│       ├── index.ts            # Express + WebSocket
│       ├── routes/
│       │   ├── tasks.ts
│       │   └── analytics.ts
│       └── db.ts               # SQLite connection
│
├── shared/
│   ├── database/
│   │   ├── schema.sql
│   │   └── migrations/
│   ├── telegram/
│   │   ├── bot.py
│   │   └── formatters.py
│   ├── git/
│   │   └── manager.py
│   └── verification/
│       ├── scripts/
│       │   ├── verify-build.sh
│       │   └── verify-spec.sh
│       └── runner.py
│
├── prompts/
│   ├── orchestrator.md
│   ├── build_agent.md
│   ├── spec_agent.md
│   ├── qa_agent.md
│   └── [other agents].md
│
├── config/
│   ├── agents.yaml
│   ├── budgets.yaml
│   └── telegram.yaml
│
└── tests/
    ├── test_orchestrator.py
    ├── test_agents.py
    ├── test_dashboard.py
    └── test_verification.py
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Task completion rate | >70% auto-verified | QA pass / total completed |
| Mean time to completion | <4 hours | assigned_at → verified_at |
| Human intervention rate | <15% | escalations / total tasks |
| False positive rate | <5% | QA rejections / agent "done" claims |
| Dashboard latency | <100ms | API response time p95 |
| Telegram latency | <5s | event → message delivered |
| Budget adherence | 100% | daily spend ≤ daily cap |
| Uptime | >99% | successful cron ticks / expected |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Agent hallucinates completion | High | High | QA independent verification |
| Budget overrun | Medium | Medium | Per-agent limits, thresholds |
| Agent stuck in loop | Medium | Medium | 30-min timeout, intervention |
| Git conflicts | Medium | Low | Branch isolation, conflict detection |
| Telegram rate limits | Low | Low | Batch messages, respect limits |
| Database corruption | Low | High | Regular backups, WAL mode |
| Vibe server unavailable | Medium | Medium | Graceful degradation, retry |

---

## Next Steps

**Immediate (Today):**
1. Create `agent-harness/` directory in Idea_Incubator
2. Initialize Docker Compose structure
3. Set up harness database schema
4. Create Telegram bot and test connectivity

**This Week:**
1. Task Dashboard MVP (Kanban + CRUD)
2. Build Agent + QA Agent
3. First end-to-end task completion

**Measure Success By:**
- Can create task in dashboard
- Task assigned to Build Agent
- Build Agent edits code
- Telegram shows progress
- QA verifies
- Task marked done

---

*This plan is ready for implementation. No blockers, no open questions. Let's build it.*
