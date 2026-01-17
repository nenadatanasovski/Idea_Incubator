# Parallelization-Centric UI Redesign

## First Principles Analysis

### The Core Problem

The current UI treats parallelization as **secondary metadata** rather than the **primary organizing principle**. Users cannot easily answer these fundamental questions:

1. **What's running right now?** - Which tasks are executing in parallel?
2. **What's blocking parallelism?** - Why can't more tasks run concurrently?
3. **What's the execution flow?** - How do tasks progress through waves?
4. **Where are the bottlenecks?** - Which lanes are stalled and why?

### Mental Model: The Assembly Line

Think of task execution like a **multi-lane assembly line**:

```
                    WAVE 1              WAVE 2              WAVE 3
                ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
   LANE A       │  [Task A1]    │ → │  [Task A2]    │ → │  [Task A3]    │
   (Database)   │   ✓ DONE      │   │   ⚡ RUNNING  │   │   ○ PENDING   │
                └───────────────┘   └───────────────┘   └───────────────┘
                ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
   LANE B       │  [Task B1]    │ → │  [Task B2]    │ → │               │
   (API)        │   ✓ DONE      │   │   ⚡ RUNNING  │   │               │
                └───────────────┘   └───────────────┘   └───────────────┘
                ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
   LANE C       │  [Task C1]    │ → │               │ → │  [Task C3]    │
   (UI)         │   ⚡ RUNNING  │   │    (waits)    │   │   ○ PENDING   │
                └───────────────┘   └───────────────┘   └───────────────┘
                        ↓                   ↓                   ↓
                   3 parallel          2 parallel          2 parallel
                      max                 max                 max
```

### The Hierarchy

```
Execution Session (top-level container)
├── Parallel Lanes (vertical swimlanes - can run concurrently)
│   ├── Wave Cells (horizontal bands - sequential phases)
│   │   └── Tasks (individual units of work)
│   │       └── Build Agent (worker executing the task)
│   └── Dependencies (why tasks must wait)
└── Global Status (wave progress, agent pool, conflicts)
```

---

## Design Principles

### 1. Lanes Are Primary, Not Lists

**Current:** Task Lists → Tasks → Parallelism metadata
**Proposed:** Lanes → Waves → Tasks (with list as grouping attribute)

The lane represents **"what can execute independently"**, not just a container for tasks.

### 2. Waves Are Visual, Not Just Sequential

Waves should be **horizontal bands** across all lanes, making temporal ordering immediately visible. Users should see:

- Which wave is currently executing
- How many tasks completed in each wave
- What's blocking wave progression

### 3. Agents Are First-Class Citizens

Build Agents should be visible **where they're working**, not in a separate "agent dashboard":

- Agent avatars on active tasks
- Heartbeat indicators
- Error state prominently displayed

### 4. Conflicts Are Explanatory

When tasks can't run in parallel, users need to **understand why**:

- File conflict visualization
- Dependency chain display
- "Would unblock" indicators

---

## Proposed UI Components

### A. Pipeline Dashboard (New Primary View)

The central hub for understanding parallel execution.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PIPELINE DASHBOARD                                    [Pause] [Settings] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ EXECUTION OVERVIEW                                                   ││
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        ││
│  │ │ 4/12 │ │  3   │ │  5   │ │  2   │ │ 89%  │                        ││
│  │ │Tasks │ │Lanes │ │Waves │ │Agents│ │ Done │                        ││
│  │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                        ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ LANE SWIMLANES                                    Wave 3 of 5        ││
│  │ ─────────────────────────────────────────────────────────────────── ││
│  │        W1 (done)    W2 (done)    W3 (active)   W4 (pending)         ││
│  │ ┌─────┬───────────┬───────────┬───────────┬───────────┐             ││
│  │ │DB   │ ✓ T-001   │ ✓ T-004   │ ⚡ T-007  │ ○ T-010   │ ← Agent 1  ││
│  │ ├─────┼───────────┼───────────┼───────────┼───────────┤             ││
│  │ │API  │ ✓ T-002   │ ✓ T-005   │ ⚡ T-008  │ ○ T-011   │ ← Agent 2  ││
│  │ ├─────┼───────────┼───────────┼───────────┼───────────┤             ││
│  │ │UI   │ ✓ T-003   │ ✓ T-006   │ ◐ blocked │ ○ T-012   │ ← waiting  ││
│  │ └─────┴───────────┴───────────┴───────────┴───────────┘             ││
│  │                                                                      ││
│  │ [◐ = blocked: T-009 waiting on T-007 (file: schema.ts)]             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ AGENT POOL                                                           ││
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  ││
│  │ │ Agent 1      │ │ Agent 2      │ │ Agent 3      │                  ││
│  │ │ ⚡ T-007     │ │ ⚡ T-008     │ │ ○ Idle       │                  ││
│  │ │ ♥ 2s ago     │ │ ♥ 5s ago     │ │              │                  ││
│  │ └──────────────┘ └──────────────┘ └──────────────┘                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

#### Key Features:

1. **Execution Overview Bar** - Glanceable stats
2. **Lane Swimlanes** - The core visualization
3. **Wave Header** - Shows which wave is active
4. **Blocked Indicator** - Explains why tasks can't proceed
5. **Agent Pool** - Shows all agents and their status

### B. Lane Detail Panel (Slide-out)

When clicking a lane, shows full lane context:

```
┌─────────────────────────────────────────────────┐
│ LANE: Database Migrations                        │
│ Status: 2/4 tasks complete                      │
├─────────────────────────────────────────────────┤
│                                                  │
│ Wave 1: ✓ Complete                              │
│ ├── T-001: Create users table          ✓ 2m    │
│                                                  │
│ Wave 2: ✓ Complete                              │
│ ├── T-004: Add auth columns            ✓ 1m    │
│                                                  │
│ Wave 3: ⚡ Active                                │
│ ├── T-007: Create sessions table       ⚡ 45s   │
│ │   └── Agent: build-agent-1                    │
│ │   └── Heartbeat: 2s ago                       │
│                                                  │
│ Wave 4: ○ Pending                               │
│ ├── T-010: Add indexes                 ○        │
│     └── Depends on: T-007                       │
│                                                  │
│ ─────────────────────────────────────────────── │
│ FILES IN THIS LANE:                             │
│ • database/migrations/*.sql (CREATE)            │
│ • database/schema.ts (UPDATE)                   │
└─────────────────────────────────────────────────┘
```

### C. Wave Progress Indicator (Top-level)

A horizontal timeline showing wave progression:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Wave 1         Wave 2         Wave 3         Wave 4         Wave 5     │
│  ████████████   ████████████   ████░░░░░░░░   ░░░░░░░░░░░░   ░░░░░░░░░  │
│  3/3 ✓          3/3 ✓          2/3 ⚡         0/2 ○          0/1 ○       │
│                                 ↑ CURRENT                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### D. Conflict Matrix View (Debug/Analysis)

Shows why tasks cannot run in parallel:

```
┌───────────────────────────────────────────────────────────────┐
│ CONFLICT MATRIX                                                │
├───────────────────────────────────────────────────────────────┤
│              T-007      T-008      T-009      T-010           │
│  T-007         -         ✓          ✗          ✗              │
│  T-008         ✓         -          ✓          ✓              │
│  T-009         ✗         ✓          -          ✓              │
│  T-010         ✗         ✓          ✓          -              │
│                                                                │
│  ✗ = Conflict (hover for details)                             │
│  ✓ = Can run in parallel                                      │
│                                                                │
│  T-007 ✗ T-009: Both UPDATE database/schema.ts                │
│  T-007 ✗ T-010: T-010 depends_on T-007                        │
└───────────────────────────────────────────────────────────────┘
```

### E. Real-time Execution Stream

Live updates of what's happening:

```
┌───────────────────────────────────────────────────────────────┐
│ EXECUTION STREAM                              [Auto-scroll ✓] │
├───────────────────────────────────────────────────────────────┤
│ 14:32:15  Wave 3 started                                      │
│ 14:32:15  Agent 1 → T-007 (Database Lane)                     │
│ 14:32:15  Agent 2 → T-008 (API Lane)                          │
│ 14:32:16  T-009 blocked: waiting for T-007                    │
│ 14:33:02  T-008 completed (47s)                               │
│ 14:33:02  Agent 2 idle - no eligible tasks in Wave 3          │
│ 14:33:45  T-007 completed (90s)                               │
│ 14:33:45  T-009 unblocked → Agent 2                           │
│ 14:33:46  Agent 1 → T-010 (Database Lane)                     │
└───────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### New Components to Create

| Component               | Purpose                             | Location               |
| ----------------------- | ----------------------------------- | ---------------------- |
| `PipelineDashboard.tsx` | Main parallel execution view        | `pages/`               |
| `LaneSwimlane.tsx`      | Single lane visualization           | `components/pipeline/` |
| `LaneGrid.tsx`          | Grid of all lanes with waves        | `components/pipeline/` |
| `WaveProgressBar.tsx`   | Horizontal wave timeline            | `components/pipeline/` |
| `WaveCell.tsx`          | Task cell at lane/wave intersection | `components/pipeline/` |
| `AgentBadge.tsx`        | Agent indicator on active tasks     | `components/pipeline/` |
| `ConflictMatrix.tsx`    | Debug view for conflicts            | `components/pipeline/` |
| `ExecutionStream.tsx`   | Real-time event log                 | `components/pipeline/` |
| `LaneDetailPanel.tsx`   | Slide-out lane details              | `components/pipeline/` |
| `BlockedIndicator.tsx`  | Explains why task is blocked        | `components/pipeline/` |
| `DependencyChain.tsx`   | Visual dependency links             | `components/pipeline/` |

### Components to Refactor

| Current Component     | Changes                                    |
| --------------------- | ------------------------------------------ |
| `ParallelismView.tsx` | Extract wave visualization into `WaveCard` |
| `TaskListPage.tsx`    | Add "View in Pipeline" action              |
| `AgentDashboard.tsx`  | Link to agent locations in pipeline        |
| `TaskListBrowser.tsx` | Add lane assignment column                 |

---

## Data Requirements

### New API Endpoints

```typescript
// GET /api/pipeline/status
interface PipelineStatus {
  sessionId: string;
  status: "idle" | "running" | "paused";
  lanes: Lane[];
  waves: Wave[];
  activeWaveNumber: number;
  agents: AgentStatus[];
  conflicts: Conflict[];
}

// GET /api/pipeline/lanes
interface Lane {
  id: string;
  name: string;
  category: string; // 'database' | 'api' | 'ui' | 'tests' | etc.
  tasks: TaskInLane[];
  filePatterns: string[]; // Files this lane touches
  currentAgent?: AgentStatus;
  status: "idle" | "active" | "blocked" | "complete";
  blockReason?: string;
}

// GET /api/pipeline/waves/:waveNumber
interface Wave {
  waveNumber: number;
  status: "pending" | "active" | "complete";
  tasks: TaskInWave[];
  startedAt?: string;
  completedAt?: string;
  parallelism: number; // How many ran concurrently
  maxPossibleParallelism: number;
}

// GET /api/pipeline/conflicts
interface Conflict {
  taskA: string;
  taskB: string;
  reason: "file_conflict" | "dependency" | "resource_lock";
  details: string; // e.g., "Both UPDATE database/schema.ts"
}

// WebSocket: /ws?pipeline=stream
interface PipelineEvent {
  type:
    | "wave:started"
    | "wave:completed"
    | "task:started"
    | "task:completed"
    | "task:blocked"
    | "agent:assigned"
    | "agent:idle"
    | "agent:error"
    | "conflict:detected"
    | "dependency:resolved";
  timestamp: string;
  payload: object;
}
```

### Database Additions

```sql
-- Lane assignments for tasks
ALTER TABLE tasks ADD COLUMN lane_id TEXT;
ALTER TABLE tasks ADD COLUMN lane_position INTEGER;

-- Lane definitions
CREATE TABLE IF NOT EXISTS execution_lanes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  file_patterns TEXT, -- JSON array
  status TEXT DEFAULT 'idle',
  block_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES execution_sessions(id)
);

-- Lane-task mapping with wave position
CREATE TABLE IF NOT EXISTS lane_tasks (
  lane_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  wave_number INTEGER NOT NULL,
  position_in_wave INTEGER DEFAULT 0,
  PRIMARY KEY (lane_id, task_id),
  FOREIGN KEY (lane_id) REFERENCES execution_lanes(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

---

## Implementation Phases

### Phase 1: Core Lane Visualization (MVP) ✅ COMPLETE

**Goal:** Replace task-list-centric view with lane-centric view

- [x] Create `PipelineDashboard.tsx` as new route `/pipeline`
- [x] Create `LaneGrid.tsx` with basic swimlane layout
- [x] Create `WaveProgressBar.tsx` for timeline
- [x] Create `WaveCell.tsx` for lane/wave intersections
- [x] API: `/api/pipeline/status` endpoint
- [x] Database migration for `execution_lanes`, `lane_tasks`, `execution_waves`, `task_conflicts`, `pipeline_events`

**Deliverables:**

- ✅ Users can see tasks organized by lanes and waves
- ✅ Visual indication of current wave
- ✅ Basic lane status (active/blocked/complete)

### Phase 2: Agent Integration ✅ COMPLETE

**Goal:** Show agents where they're working

- [x] Create `AgentBadge.tsx` component
- [x] Integrate agent status into lane cells (via WaveCell)
- [x] Real-time agent heartbeat display
- [x] Create `AgentPool.tsx` view at bottom of dashboard

**Deliverables:**

- ✅ Agents visible on active tasks
- ✅ Health indicators (heartbeat age)
- ✅ Agent → Task mapping clear

### Phase 3: Conflict Visualization ✅ COMPLETE

**Goal:** Make blocking reasons visible

- [x] Create `BlockedIndicator.tsx` component
- [x] Create `ConflictMatrix.tsx` debug view
- [x] Add "why blocked" tooltips (BlockedTooltip)
- [x] Dependency chain visualization (in LaneDetailPanel)

**Deliverables:**

- ✅ Users understand why tasks can't run in parallel
- ✅ Debug view for complex conflict scenarios
- ✅ Dependency chains visible

### Phase 4: Real-time Streaming ✅ COMPLETE

**Goal:** Live execution updates

- [x] Create `ExecutionStream.tsx` component
- [x] WebSocket integration for pipeline events (`usePipelineWebSocket` hook)
- [x] Auto-refresh lane grid on events
- [x] Filter events by type

**Deliverables:**

- ✅ Live event stream
- ✅ No manual refresh needed
- ✅ Immediate visibility into execution

### Phase 5: Lane Detail & Analytics ✅ COMPLETE

**Goal:** Deep dive into individual lanes

- [x] Create `LaneDetailPanel.tsx` slide-out
- [x] Lane-specific task history (grouped by wave)
- [x] File impact summary per lane
- [x] Timing analytics (avg task duration, total duration)

**Deliverables:**

- ✅ Click lane → see full detail
- ✅ Historical context
- ✅ Performance insights

---

## Test Scripts and Pass Definitions

### Test Infrastructure Setup

```bash
# Test file locations
tests/e2e/pipeline-ui/           # Puppeteer E2E tests
tests/unit/pipeline/             # Unit tests for pipeline components
tests/integration/pipeline-api/  # API integration tests
```

### Phase 1 Tests: Core Lane Visualization

#### Unit Tests (`tests/unit/pipeline/lane-grid.test.ts`)

```typescript
describe("LaneGrid Component", () => {
  it("renders correct number of lanes from props", () => {
    // PASS: lanes.length === rendered lane rows
  });

  it("renders correct number of wave columns", () => {
    // PASS: waves.length === rendered column headers
  });

  it("places tasks in correct lane/wave intersection", () => {
    // PASS: task T-001 with lane=db, wave=1 renders at grid[db][1]
  });

  it("highlights active wave column", () => {
    // PASS: wave column with status='active' has .wave-active class
  });

  it("shows empty cell for lane/wave with no task", () => {
    // PASS: empty cells render with .wave-cell-empty class
  });
});

describe("WaveProgressBar Component", () => {
  it("shows correct completion percentage per wave", () => {
    // PASS: wave with 2/3 complete shows 66% fill
  });

  it("marks current wave with indicator", () => {
    // PASS: active wave has 'CURRENT' badge visible
  });

  it("updates when wave completes", () => {
    // PASS: transitioning wave to complete changes fill to 100%
  });
});
```

#### API Tests (`tests/integration/pipeline-api/status.test.ts`)

```typescript
describe("GET /api/pipeline/status", () => {
  it("returns pipeline status with all required fields", () => {
    // PASS: response includes sessionId, status, lanes, waves, activeWaveNumber, agents, conflicts
  });

  it("returns lanes sorted by category", () => {
    // PASS: lanes array sorted: database, types, api, ui, tests
  });

  it("returns only tasks assigned to execution session", () => {
    // PASS: no tasks from other sessions appear
  });
});

describe("GET /api/pipeline/lanes", () => {
  it("includes file patterns for each lane", () => {
    // PASS: each lane has filePatterns array with >=1 pattern
  });

  it("includes current agent if lane is active", () => {
    // PASS: active lane has currentAgent object with id, heartbeat
  });
});
```

#### Pass Criteria Phase 1

| Test Suite                | Pass Threshold   | Command                                                 |
| ------------------------- | ---------------- | ------------------------------------------------------- |
| Unit: LaneGrid            | 100% (8/8 tests) | `npm test -- tests/unit/pipeline/lane-grid.test.ts`     |
| Unit: WaveProgressBar     | 100% (5/5 tests) | `npm test -- tests/unit/pipeline/wave-progress.test.ts` |
| Integration: Pipeline API | 100% (6/6 tests) | `npm test -- tests/integration/pipeline-api/`           |
| E2E: Basic Rendering      | 100% (3/3 tests) | `npm run test:e2e -- pipeline-basic`                    |

---

### Phase 2 Tests: Agent Integration

#### Unit Tests (`tests/unit/pipeline/agent-badge.test.ts`)

```typescript
describe("AgentBadge Component", () => {
  it("shows agent name on active task", () => {
    // PASS: agent badge visible with correct agent ID
  });

  it("shows heartbeat indicator with time ago", () => {
    // PASS: heartbeat shows "2s ago" format
  });

  it("shows warning state when heartbeat > 30s", () => {
    // PASS: badge has .heartbeat-warning class when stale
  });

  it("shows error state when agent has error", () => {
    // PASS: badge has .agent-error class with error icon
  });
});

describe("AgentPool Component", () => {
  it("renders all agents in pool", () => {
    // PASS: 3 agents in data = 3 agent cards rendered
  });

  it("shows idle agents distinctly", () => {
    // PASS: idle agents have .agent-idle class and "Idle" label
  });

  it("links agent card to task in grid", () => {
    // PASS: clicking agent card scrolls to and highlights task
  });
});
```

#### Pass Criteria Phase 2

| Test Suite         | Pass Threshold   | Command                                               |
| ------------------ | ---------------- | ----------------------------------------------------- |
| Unit: AgentBadge   | 100% (6/6 tests) | `npm test -- tests/unit/pipeline/agent-badge.test.ts` |
| Unit: AgentPool    | 100% (4/4 tests) | `npm test -- tests/unit/pipeline/agent-pool.test.ts`  |
| E2E: Agent Display | 100% (4/4 tests) | `npm run test:e2e -- pipeline-agents`                 |

---

### Phase 3 Tests: Conflict Visualization

#### Unit Tests (`tests/unit/pipeline/conflict-matrix.test.ts`)

```typescript
describe("ConflictMatrix Component", () => {
  it("renders NxN matrix for N tasks", () => {
    // PASS: 4 tasks = 4x4 grid with self-diagonal marked
  });

  it("shows conflict symbol for conflicting pairs", () => {
    // PASS: tasks with file conflict show ✗ at intersection
  });

  it("shows compatible symbol for parallel-safe pairs", () => {
    // PASS: non-conflicting tasks show ✓ at intersection
  });

  it("shows conflict reason on hover", () => {
    // PASS: hovering ✗ shows tooltip with reason text
  });

  it("highlights row/column on cell hover", () => {
    // PASS: hovering cell highlights full row and column
  });
});

describe("BlockedIndicator Component", () => {
  it("shows blocked reason text", () => {
    // PASS: "Waiting on T-007" text visible
  });

  it("links to blocking task", () => {
    // PASS: clicking blocking task ID navigates to it
  });

  it("shows file conflict details", () => {
    // PASS: "file: schema.ts" visible when file conflict
  });
});
```

#### Pass Criteria Phase 3

| Test Suite             | Pass Threshold   | Command                                                     |
| ---------------------- | ---------------- | ----------------------------------------------------------- |
| Unit: ConflictMatrix   | 100% (7/7 tests) | `npm test -- tests/unit/pipeline/conflict-matrix.test.ts`   |
| Unit: BlockedIndicator | 100% (5/5 tests) | `npm test -- tests/unit/pipeline/blocked-indicator.test.ts` |
| E2E: Conflict Display  | 100% (5/5 tests) | `npm run test:e2e -- pipeline-conflicts`                    |

---

### Phase 4 Tests: Real-time Streaming

#### Integration Tests (`tests/integration/pipeline-api/websocket.test.ts`)

```typescript
describe("WebSocket: /ws?pipeline=stream", () => {
  it("receives wave:started event when wave begins", () => {
    // PASS: event received within 100ms of wave start
  });

  it("receives task:completed event with duration", () => {
    // PASS: event includes taskId, duration, status
  });

  it("receives agent:assigned event when agent picks up task", () => {
    // PASS: event includes agentId, taskId, timestamp
  });

  it("reconnects automatically on disconnect", () => {
    // PASS: connection re-established within 5s after drop
  });

  it("buffers events during reconnect", () => {
    // PASS: no events lost during brief disconnect
  });
});

describe("ExecutionStream Component", () => {
  it("displays events in chronological order", () => {
    // PASS: newest event at bottom, oldest at top
  });

  it("auto-scrolls to newest event when enabled", () => {
    // PASS: scroll position at bottom after new event
  });

  it("pauses auto-scroll when user scrolls up", () => {
    // PASS: scroll position preserved when user scrolls
  });

  it("filters events by type", () => {
    // PASS: selecting "tasks only" hides agent events
  });
});
```

#### Pass Criteria Phase 4

| Test Suite             | Pass Threshold   | Command                                                        |
| ---------------------- | ---------------- | -------------------------------------------------------------- |
| Integration: WebSocket | 100% (8/8 tests) | `npm test -- tests/integration/pipeline-api/websocket.test.ts` |
| Unit: ExecutionStream  | 100% (6/6 tests) | `npm test -- tests/unit/pipeline/execution-stream.test.ts`     |
| E2E: Real-time Updates | 100% (5/5 tests) | `npm run test:e2e -- pipeline-realtime`                        |

---

### Phase 5 Tests: Lane Detail & Analytics

#### Unit Tests (`tests/unit/pipeline/lane-detail.test.ts`)

```typescript
describe("LaneDetailPanel Component", () => {
  it("shows all tasks in lane grouped by wave", () => {
    // PASS: tasks grouped under wave headers
  });

  it("shows task duration for completed tasks", () => {
    // PASS: "✓ 2m" format for completed tasks
  });

  it("shows dependency chain for pending tasks", () => {
    // PASS: "Depends on: T-007" visible
  });

  it("shows file impact summary", () => {
    // PASS: file patterns listed with operation type
  });

  it("shows timing analytics", () => {
    // PASS: avg duration, total wait time visible
  });
});
```

#### Pass Criteria Phase 5

| Test Suite            | Pass Threshold   | Command                                               |
| --------------------- | ---------------- | ----------------------------------------------------- |
| Unit: LaneDetailPanel | 100% (8/8 tests) | `npm test -- tests/unit/pipeline/lane-detail.test.ts` |
| E2E: Lane Detail      | 100% (4/4 tests) | `npm run test:e2e -- pipeline-lane-detail`            |

---

### Full Suite Pass Definition

```bash
# Run all pipeline tests
npm run test:pipeline

# Expected output for PASS:
# ✓ Unit tests: 44/44 passed
# ✓ Integration tests: 14/14 passed
# ✓ E2E tests: 21/21 passed
#
# Total: 79/79 tests passed
# Coverage: >80% for new components
```

---

## UI Confirmation Steps (Puppeteer/Chrome)

### Test File: `tests/e2e/pipeline-ui/pipeline-visual.test.ts`

```typescript
import puppeteer, { Browser, Page } from "puppeteer";

describe("Pipeline Dashboard Visual Verification", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: false }); // visible for verification
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
  });

  afterAll(async () => {
    await browser.close();
  });
});
```

### Confirmation Step 1: Dashboard Loads Correctly

```typescript
test("Pipeline Dashboard renders with all sections", async () => {
  // Navigate to pipeline
  await page.goto("http://localhost:5173/pipeline");
  await page.waitForSelector('[data-testid="pipeline-dashboard"]', {
    timeout: 5000,
  });

  // CONFIRM: Execution Overview Bar visible
  const overviewBar = await page.$('[data-testid="execution-overview"]');
  expect(overviewBar).not.toBeNull();
  await page.screenshot({ path: "screenshots/pipeline-01-overview.png" });

  // CONFIRM: Lane Grid visible with lanes
  const laneGrid = await page.$('[data-testid="lane-grid"]');
  expect(laneGrid).not.toBeNull();
  const laneRows = await page.$$('[data-testid^="lane-row-"]');
  expect(laneRows.length).toBeGreaterThan(0);
  await page.screenshot({ path: "screenshots/pipeline-02-lane-grid.png" });

  // CONFIRM: Wave Progress Bar visible
  const waveProgress = await page.$('[data-testid="wave-progress-bar"]');
  expect(waveProgress).not.toBeNull();
  await page.screenshot({ path: "screenshots/pipeline-03-wave-progress.png" });

  // CONFIRM: Agent Pool visible
  const agentPool = await page.$('[data-testid="agent-pool"]');
  expect(agentPool).not.toBeNull();
  await page.screenshot({ path: "screenshots/pipeline-04-agent-pool.png" });

  console.log("✓ VISUAL CHECK: Dashboard has all 4 main sections");
});
```

### Confirmation Step 2: Lane Grid Displays Tasks Correctly

```typescript
test("Lane Grid shows tasks in correct positions", async () => {
  await page.goto("http://localhost:5173/pipeline");
  await page.waitForSelector('[data-testid="lane-grid"]');

  // CONFIRM: Tasks appear in wave cells
  const waveCells = await page.$$('[data-testid^="wave-cell-"]');
  expect(waveCells.length).toBeGreaterThan(0);

  // CONFIRM: Active wave is highlighted
  const activeWave = await page.$('[data-testid="wave-active"]');
  expect(activeWave).not.toBeNull();
  const activeClass = await page.evaluate(
    (el) => el?.classList.contains("wave-active"),
    activeWave,
  );
  expect(activeClass).toBe(true);
  await page.screenshot({
    path: "screenshots/pipeline-05-active-wave-highlight.png",
  });

  // CONFIRM: Completed tasks show checkmark
  const completedTask = await page.$('[data-testid="task-status-complete"]');
  if (completedTask) {
    const hasCheckmark = await page.evaluate(
      (el) => el?.textContent?.includes("✓"),
      completedTask,
    );
    expect(hasCheckmark).toBe(true);
  }
  await page.screenshot({
    path: "screenshots/pipeline-06-completed-tasks.png",
  });

  console.log("✓ VISUAL CHECK: Tasks positioned correctly in grid");
});
```

### Confirmation Step 3: Agent Badges Display on Active Tasks

```typescript
test("Agent badges visible on running tasks", async () => {
  await page.goto("http://localhost:5173/pipeline");
  await page.waitForSelector('[data-testid="lane-grid"]');

  // CONFIRM: Running tasks have agent badge
  const runningTask = await page.$('[data-testid="task-status-running"]');
  if (runningTask) {
    const agentBadge = await runningTask.$('[data-testid="agent-badge"]');
    expect(agentBadge).not.toBeNull();
    await page.screenshot({
      path: "screenshots/pipeline-07-agent-badge.png",
    });

    // CONFIRM: Heartbeat indicator visible
    const heartbeat = await agentBadge?.$(
      '[data-testid="heartbeat-indicator"]',
    );
    expect(heartbeat).not.toBeNull();
    await page.screenshot({
      path: "screenshots/pipeline-08-heartbeat.png",
    });
  }

  // CONFIRM: Agent pool shows agents
  const agentCards = await page.$$('[data-testid^="agent-card-"]');
  expect(agentCards.length).toBeGreaterThan(0);
  await page.screenshot({
    path: "screenshots/pipeline-09-agent-pool-cards.png",
  });

  console.log("✓ VISUAL CHECK: Agent badges display correctly");
});
```

### Confirmation Step 4: Blocked Tasks Show Reason

```typescript
test("Blocked tasks display blocking reason", async () => {
  await page.goto("http://localhost:5173/pipeline");
  await page.waitForSelector('[data-testid="lane-grid"]');

  // CONFIRM: Blocked task has amber styling
  const blockedTask = await page.$('[data-testid="task-status-blocked"]');
  if (blockedTask) {
    const hasBlockedClass = await page.evaluate(
      (el) => el?.classList.contains("task-blocked"),
      blockedTask,
    );
    expect(hasBlockedClass).toBe(true);
    await page.screenshot({
      path: "screenshots/pipeline-10-blocked-task.png",
    });

    // CONFIRM: Hover shows blocked reason
    await blockedTask.hover();
    await page.waitForSelector('[data-testid="blocked-tooltip"]', {
      timeout: 2000,
    });
    const tooltip = await page.$('[data-testid="blocked-tooltip"]');
    expect(tooltip).not.toBeNull();
    await page.screenshot({
      path: "screenshots/pipeline-11-blocked-tooltip.png",
    });
  }

  console.log("✓ VISUAL CHECK: Blocked state displays correctly");
});
```

### Confirmation Step 5: Conflict Matrix Renders

```typescript
test("Conflict Matrix shows task conflicts", async () => {
  // Navigate to conflict matrix view
  await page.goto("http://localhost:5173/pipeline/conflicts");
  await page.waitForSelector('[data-testid="conflict-matrix"]', {
    timeout: 5000,
  });

  // CONFIRM: Matrix grid renders
  const matrixGrid = await page.$('[data-testid="conflict-matrix-grid"]');
  expect(matrixGrid).not.toBeNull();
  await page.screenshot({
    path: "screenshots/pipeline-12-conflict-matrix.png",
  });

  // CONFIRM: Conflict cells show ✗
  const conflictCells = await page.$$('[data-testid="conflict-cell-conflict"]');
  await page.screenshot({
    path: "screenshots/pipeline-13-conflict-cells.png",
  });

  // CONFIRM: Hovering conflict shows reason
  if (conflictCells.length > 0) {
    await conflictCells[0].hover();
    await page.waitForSelector('[data-testid="conflict-reason-tooltip"]', {
      timeout: 2000,
    });
    await page.screenshot({
      path: "screenshots/pipeline-14-conflict-reason.png",
    });
  }

  console.log("✓ VISUAL CHECK: Conflict matrix renders correctly");
});
```

### Confirmation Step 6: Real-time Updates Work

```typescript
test("Dashboard updates in real-time via WebSocket", async () => {
  await page.goto("http://localhost:5173/pipeline");
  await page.waitForSelector('[data-testid="lane-grid"]');

  // Record initial state
  const initialWaveText = await page.$eval(
    '[data-testid="wave-progress-bar"]',
    (el) => el.textContent,
  );
  await page.screenshot({ path: "screenshots/pipeline-15-before-update.png" });

  // Trigger a task completion via API (simulated)
  await page.evaluate(async () => {
    await fetch("/api/test/simulate-task-complete", { method: "POST" });
  });

  // Wait for WebSocket update
  await page.waitForFunction(
    (initial) => {
      const current = document.querySelector(
        '[data-testid="wave-progress-bar"]',
      )?.textContent;
      return current !== initial;
    },
    { timeout: 5000 },
    initialWaveText,
  );
  await page.screenshot({ path: "screenshots/pipeline-16-after-update.png" });

  // CONFIRM: Execution stream shows new event
  const streamEvents = await page.$$('[data-testid^="stream-event-"]');
  expect(streamEvents.length).toBeGreaterThan(0);
  await page.screenshot({
    path: "screenshots/pipeline-17-execution-stream.png",
  });

  console.log("✓ VISUAL CHECK: Real-time updates working");
});
```

### Confirmation Step 7: Lane Detail Panel Opens

```typescript
test("Clicking lane opens detail panel", async () => {
  await page.goto("http://localhost:5173/pipeline");
  await page.waitForSelector('[data-testid="lane-grid"]');

  // Click on a lane header
  const laneHeader = await page.$('[data-testid^="lane-header-"]');
  expect(laneHeader).not.toBeNull();
  await laneHeader?.click();

  // CONFIRM: Detail panel slides in
  await page.waitForSelector('[data-testid="lane-detail-panel"]', {
    timeout: 2000,
  });
  const detailPanel = await page.$('[data-testid="lane-detail-panel"]');
  expect(detailPanel).not.toBeNull();
  await page.screenshot({
    path: "screenshots/pipeline-18-lane-detail-open.png",
  });

  // CONFIRM: Panel shows lane name
  const laneName = await page.$('[data-testid="lane-detail-name"]');
  expect(laneName).not.toBeNull();

  // CONFIRM: Panel shows tasks grouped by wave
  const waveGroups = await page.$$('[data-testid^="lane-wave-group-"]');
  expect(waveGroups.length).toBeGreaterThan(0);
  await page.screenshot({
    path: "screenshots/pipeline-19-lane-wave-groups.png",
  });

  // CONFIRM: Panel shows file impacts
  const fileImpacts = await page.$('[data-testid="lane-file-impacts"]');
  expect(fileImpacts).not.toBeNull();
  await page.screenshot({
    path: "screenshots/pipeline-20-lane-file-impacts.png",
  });

  // Close panel
  const closeButton = await page.$('[data-testid="lane-detail-close"]');
  await closeButton?.click();
  await page.waitForSelector('[data-testid="lane-detail-panel"]', {
    hidden: true,
  });

  console.log("✓ VISUAL CHECK: Lane detail panel works correctly");
});
```

### Confirmation Step 8: Wave Navigation Works

```typescript
test("Wave progress bar allows navigation", async () => {
  await page.goto("http://localhost:5173/pipeline");
  await page.waitForSelector('[data-testid="wave-progress-bar"]');

  // CONFIRM: Clicking a wave segment highlights it
  const waveSegments = await page.$$('[data-testid^="wave-segment-"]');
  expect(waveSegments.length).toBeGreaterThan(1);

  // Click on a non-active wave
  await waveSegments[0].click();
  await page.screenshot({ path: "screenshots/pipeline-21-wave-click.png" });

  // CONFIRM: Grid scrolls/highlights that wave
  const selectedWave = await page.$('[data-testid="wave-selected"]');
  expect(selectedWave).not.toBeNull();
  await page.screenshot({ path: "screenshots/pipeline-22-wave-selected.png" });

  console.log("✓ VISUAL CHECK: Wave navigation works");
});
```

### Running UI Confirmation Tests

```bash
# Run all visual confirmation tests
npm run test:e2e:visual

# Run with visible browser for manual verification
HEADLESS=false npm run test:e2e:visual

# Generate screenshot report
npm run test:e2e:visual:report

# Expected output:
# ✓ Pipeline Dashboard renders with all sections
# ✓ Lane Grid shows tasks in correct positions
# ✓ Agent badges visible on running tasks
# ✓ Blocked tasks display blocking reason
# ✓ Conflict Matrix shows task conflicts
# ✓ Dashboard updates in real-time via WebSocket
# ✓ Clicking lane opens detail panel
# ✓ Wave progress bar allows navigation
#
# Screenshots saved to: screenshots/pipeline-*.png
# Visual report: reports/pipeline-visual-report.html
```

### Screenshot Verification Checklist

After running UI tests, manually verify these screenshots:

| Screenshot                              | What to Verify                                      |
| --------------------------------------- | --------------------------------------------------- |
| `pipeline-01-overview.png`              | Stats bar shows Tasks, Lanes, Waves, Agents, % Done |
| `pipeline-02-lane-grid.png`             | Grid has rows for each lane, columns for each wave  |
| `pipeline-03-wave-progress.png`         | Timeline shows wave progression with fill levels    |
| `pipeline-04-agent-pool.png`            | Agent cards visible with status indicators          |
| `pipeline-05-active-wave-highlight.png` | Current wave column has distinct background color   |
| `pipeline-06-completed-tasks.png`       | Completed tasks show green checkmark                |
| `pipeline-07-agent-badge.png`           | Running task shows agent name badge                 |
| `pipeline-08-heartbeat.png`             | Heartbeat shows "Xs ago" with pulse animation       |
| `pipeline-09-agent-pool-cards.png`      | All agents visible in pool section                  |
| `pipeline-10-blocked-task.png`          | Blocked task has amber background                   |
| `pipeline-11-blocked-tooltip.png`       | Tooltip shows blocking reason                       |
| `pipeline-12-conflict-matrix.png`       | NxN matrix renders for N tasks                      |
| `pipeline-13-conflict-cells.png`        | ✗ symbols visible for conflicts                     |
| `pipeline-14-conflict-reason.png`       | Hover tooltip explains conflict                     |
| `pipeline-15-before-update.png`         | Initial state captured                              |
| `pipeline-16-after-update.png`          | State changed after WebSocket event                 |
| `pipeline-17-execution-stream.png`      | Event log shows new entry                           |
| `pipeline-18-lane-detail-open.png`      | Slide-out panel visible                             |
| `pipeline-19-lane-wave-groups.png`      | Tasks grouped under wave headers                    |
| `pipeline-20-lane-file-impacts.png`     | File patterns listed                                |
| `pipeline-21-wave-click.png`            | Click registered on wave segment                    |
| `pipeline-22-wave-selected.png`         | Selected wave highlighted in grid                   |

---

## Navigation Changes

### New Route Structure

```
/pipeline                    → PipelineDashboard (NEW PRIMARY VIEW)
/pipeline/lanes/:laneId      → LaneDetailPanel
/pipeline/waves/:waveNum     → WaveDetail
/pipeline/conflicts          → ConflictMatrix
/pipeline/stream             → ExecutionStream (fullscreen)

/tasks                       → TaskListBrowser (existing, add lane column)
/tasks/kanban               → KanbanBoard (existing)
/agents                      → AgentDashboard (link to pipeline locations)
```

### Sidebar Updates

```
EXECUTION
├── Pipeline Dashboard  ← NEW PRIMARY
├── Lanes
├── Waves
└── Agents

PLANNING
├── Task Lists
├── Evaluation Queue
└── Kanban Board
```

---

## Visual Design Guidelines

### Color Coding

| State    | Color            | Usage                  |
| -------- | ---------------- | ---------------------- |
| Pending  | Gray (#6B7280)   | Task not yet started   |
| Active   | Blue (#3B82F6)   | Currently executing    |
| Complete | Green (#10B981)  | Successfully finished  |
| Failed   | Red (#EF4444)    | Error state            |
| Blocked  | Amber (#F59E0B)  | Waiting on dependency  |
| Conflict | Purple (#8B5CF6) | File/resource conflict |

### Lane Category Colors

| Category       | Color  | Icon             |
| -------------- | ------ | ---------------- |
| Database       | Indigo | Database icon    |
| API            | Green  | Server icon      |
| UI             | Blue   | Layout icon      |
| Tests          | Purple | CheckSquare icon |
| Infrastructure | Orange | Settings icon    |
| Types          | Teal   | Code icon        |

### Animation Guidelines

- Wave transitions: 300ms ease-in-out
- Task status changes: 200ms
- Agent heartbeat: Subtle pulse animation
- Blocked state: Slow amber pulse
- Completion: Brief green flash

---

## Success Metrics

### User Experience

1. **Time to understand state** - How quickly can user answer "what's running?"
2. **Blocked task discovery** - Are blocked tasks immediately visible?
3. **Agent location clarity** - Can user find where agents are working?

### Technical

1. **Real-time latency** - WebSocket update < 100ms
2. **Initial load time** - Dashboard loads < 2s
3. **Conflict calculation** - Matrix computed < 500ms for 100 tasks

---

## Migration Path

### For Existing Users

1. **Week 1:** Pipeline Dashboard available at `/pipeline` (opt-in)
2. **Week 2:** Add "View in Pipeline" links from existing views
3. **Week 3:** Pipeline becomes default, old views accessible
4. **Week 4:** Full integration, old views deprecated

### Data Migration

1. Auto-assign lanes based on file impact patterns
2. Backfill lane_id for existing tasks
3. Calculate historical wave assignments

---

## Open Questions

1. **Lane Granularity:** How many lanes is too many? Should we auto-merge?
2. **Wave Calculation:** Dynamic vs pre-computed waves?
3. **Conflict Resolution:** Should UI allow manual conflict override?
4. **Mobile View:** How to represent lanes on small screens?
5. **History View:** How far back to show completed waves?

---

## Appendix: Wireframes

See attached Figma link (TODO) or ASCII art above for visual reference.

---

_Document created: 2026-01-16_
_Author: Claude Code_
_Status: DRAFT - Pending Review_
