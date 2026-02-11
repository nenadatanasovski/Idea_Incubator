# Frontend Specification

Dashboard for monitoring and controlling the Parent Harness.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- WebSocket for real-time updates

## Pages

### 1. Main Dashboard (`/`)

Three-column layout:

- **Left:** Agent Status Cards
- **Center:** Event Stream (live)
- **Right:** Task Queue / Active Work

### 2. Task Board (`/tasks`)

Kanban-style board:

- Columns: Backlog | Ready | In Progress | QA | Done | Failed
- Drag-and-drop task movement
- Filter by: agent, priority, wave, lane

### 3. Sessions View (`/sessions`)

Grouped by execution run:

- Expandable: Run → Wave → Lane → Task → Session → Iterations
- Each iteration shows QA status
- Click to view full log

### 4. Log Viewer (`/logs/:sessionId`)

Full iteration log with:

- Tool calls highlighted
- File modifications
- Git commits
- Errors in red
- QA result badge

## Components

### AgentStatusCard

Shows per-agent:

- Status badge (idle/working/error/stuck)
- Current task (if any)
- Iteration count
- Last heartbeat time
- Link to Telegram channel

### EventStream

Real-time scrolling feed:

- Filter by: agent, event type, severity
- Color-coded by type
- Auto-scroll toggle
- Search

### TaskCard

Compact task display:

- Display ID (e.g., TASK-042)
- Title
- Priority badge
- Status
- Assigned agent
- Wave/Lane badges

### IterationRow

Shows one iteration:

- Iteration number
- Duration
- Tasks completed/failed
- QA status (✅/❌/⏳)
- Expand for log preview

### WaveProgress

Visual wave indicator:

- Wave number
- Task count
- Progress bar
- Status (pending/active/complete)

## WebSocket Events

Connect to: `ws://localhost:3333/ws`

### Inbound Events (server → client)

```typescript
type WSEvent =
  | { type: "agent:status"; agentId: string; status: string }
  | { type: "task:updated"; task: Task }
  | { type: "iteration:started"; sessionId: string; iteration: number }
  | {
      type: "iteration:completed";
      sessionId: string;
      iteration: number;
      qaResult: string;
    }
  | { type: "event:new"; event: ObservabilityEvent }
  | { type: "wave:started"; runId: string; waveNumber: number }
  | { type: "wave:completed"; runId: string; waveNumber: number };
```

### Outbound Events (client → server)

```typescript
type WSCommand =
  | { type: "subscribe"; channels: string[] }
  | { type: "task:assign"; taskId: string; agentId: string }
  | { type: "session:terminate"; sessionId: string }
  | { type: "qa:trigger"; iterationId: string };
```

## API Endpoints (consumed by frontend)

See `BACKEND.md` for full API spec.

Key endpoints:

- `GET /api/agents` - All agents with status
- `GET /api/tasks` - Tasks with filters
- `GET /api/sessions` - Sessions grouped by run
- `GET /api/sessions/:id/iterations` - Iteration history
- `GET /api/iterations/:id/log` - Full log content
- `GET /api/events` - Recent events (paginated)

## Build Order

1. **Static layout** - Header, three-column grid
2. **AgentStatusCard** - Hardcoded data first
3. **WebSocket hook** - `useHarnessWebSocket()`
4. **Live agent status** - Connect cards to WS
5. **EventStream** - Real-time feed
6. **TaskCard + Board** - Kanban view
7. **Sessions view** - Grouped iterations
8. **Log viewer** - Full iteration details

## File Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── AgentStatusCard.tsx
│   │   ├── EventStream.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskBoard.tsx
│   │   ├── IterationRow.tsx
│   │   ├── SessionsView.tsx
│   │   ├── LogViewer.tsx
│   │   └── WaveProgress.tsx
│   ├── hooks/
│   │   ├── useHarnessWebSocket.ts
│   │   └── useApi.ts
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Tasks.tsx
│   │   ├── Sessions.tsx
│   │   └── LogView.tsx
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```
