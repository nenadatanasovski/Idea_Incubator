# Backend Specification

Orchestrator and API server for Parent Harness.

## Tech Stack
- Node.js + TypeScript
- Express (REST API)
- WebSocket (ws library)
- SQLite (better-sqlite3)
- Telegram Bot API

## Components

### 1. Orchestrator (Cron Loop)

Runs every 60 seconds (configurable).

**Each tick:**
1. Check agent heartbeats
2. Assign ready tasks to idle agents
3. Update wave progress
4. Emit events to dashboard

**Every 15 minutes (QA cycle):**
1. Check all active iterations
2. Analyze CLI output for stuck agents
3. Validate completed iterations
4. Terminate stuck sessions
5. Record audit results

### 2. REST API

Base URL: `http://localhost:3333/api`

#### Agents

```
GET /agents
  → { agents: Agent[] }

GET /agents/:id
  → Agent

PATCH /agents/:id
  Body: { status?, current_task_id? }
  → Agent
```

#### Tasks

```
GET /tasks
  Query: status, priority, wave, lane, agent, limit, offset
  → { tasks: Task[], total: number }

GET /tasks/:id
  → Task

POST /tasks
  Body: { title, description, priority?, category? }
  → Task

PATCH /tasks/:id
  Body: { status?, assigned_agent_id?, verification_status? }
  → Task

DELETE /tasks/:id
  → { success: true }
```

#### Sessions

```
GET /sessions
  Query: agent_id, run_id, status, limit
  → { sessions: Session[] }

GET /sessions/:id
  → Session with iterations

GET /sessions/:id/iterations
  → { iterations: IterationLog[] }

POST /sessions/:id/terminate
  → { success: true }
```

#### Iterations

```
GET /iterations/:id
  → IterationLog with full log_content

GET /iterations/:id/log
  → { content: string }

POST /iterations/:id/qa
  Body: { result, findings?, recommendations? }
  → IterationQAResult
```

#### Runs & Waves

```
GET /runs
  Query: task_list_id, status
  → { runs: ExecutionRun[] }

GET /runs/:id
  → ExecutionRun with waves

GET /runs/:id/waves
  → { waves: ExecutionWave[] }

POST /runs
  Body: { task_list_id }
  → ExecutionRun (starts execution)
```

#### Events

```
GET /events
  Query: type, agent_id, session_id, severity, since, limit
  → { events: ObservabilityEvent[] }
```

### 3. WebSocket Server

Path: `ws://localhost:3333/ws`

**Server → Client:**
```typescript
// Agent status change
{ type: 'agent:status', agentId: string, status: string, taskId?: string }

// Task update
{ type: 'task:updated', task: Task }

// Iteration lifecycle
{ type: 'iteration:started', sessionId: string, iteration: number }
{ type: 'iteration:completed', sessionId: string, iteration: number, qaResult: string }
{ type: 'iteration:log', sessionId: string, iteration: number, line: string }

// Wave lifecycle
{ type: 'wave:started', runId: string, waveNumber: number }
{ type: 'wave:completed', runId: string, waveNumber: number }

// Generic event
{ type: 'event:new', event: ObservabilityEvent }
```

**Client → Server:**
```typescript
// Subscribe to specific channels
{ type: 'subscribe', channels: ['agents', 'tasks', 'iterations', 'events'] }

// Manual task assignment
{ type: 'task:assign', taskId: string, agentId: string }

// Terminate session
{ type: 'session:terminate', sessionId: string }

// Trigger QA
{ type: 'qa:trigger', iterationId: string }
```

### 4. Telegram Integration

**Bot Setup:**
- Create bot via @BotFather
- Get token, add to `.env`
- Create channels, add bot as admin

**Message Functions:**
```typescript
sendToChannel(channel: string, message: string): Promise<void>
sendCritical(message: string): Promise<void>  // Always to @vibe-critical
sendAgentUpdate(agentId: string, message: string): Promise<void>
```

**Message Formatting:**
```
🔧 Build Agent starting TASK-042
📝 File modified: system-prompt.ts (+26 lines)
✅ TASK-042 completed (3 iterations)
❌ TASK-043 failed: TypeScript error
⚠️ Build Agent stuck for 15 minutes
```

### 5. Agent Spawner

Launches Claude Code instances for each agent.

```typescript
interface AgentSpawnConfig {
  agentId: string;
  taskId: string;
  model: 'haiku' | 'sonnet' | 'opus';
  systemPrompt: string;
  workingDir: string;
}

spawnAgent(config: AgentSpawnConfig): Promise<AgentSession>
terminateAgent(sessionId: string): Promise<void>
getAgentOutput(sessionId: string): Promise<string>
```

**Critical:** Agents must be verbose. All tool calls, file ops, and progress must be logged to `iteration_logs.log_content`.

## Orchestrator Logic

### Task Assignment

```
1. Get idle agents
2. Get ready tasks (status='pending', dependencies met)
3. For each idle agent:
   a. Find matching task (by agent type preference)
   b. Assign task to agent
   c. Create agent_session
   d. Create iteration_log (iteration 1)
   e. Spawn agent process
   f. Emit 'task:assigned' event
```

### Wave Progression

```
1. Check current wave status
2. If all tasks in wave completed/failed:
   a. Mark wave as completed
   b. Emit 'wave:completed' event
   c. Start next wave (if any)
   d. Emit 'wave:started' event
3. If wave has failures:
   a. Check if blocking (critical path)
   b. If blocking, pause run
   c. If not blocking, continue other tasks
```

### QA Validation (every 15 min)

```
1. Get all iterations with qa_result='pending'
2. For each iteration:
   a. Run verification checks
   b. Record result in iteration_qa_results
   c. Update iteration_logs.qa_result
   d. If failed, notify via Telegram
3. Get all 'running' iterations
4. For each:
   a. Check last_heartbeat age
   b. Analyze log_content for progress
   c. If stuck:
      - Terminate session
      - Mark iteration failed
      - Notify @vibe-critical
5. Record audit in qa_audits
```

### Stuck Detection

An agent is stuck if:
- No new tool calls in last 5 minutes
- Same error repeated 3+ times
- No output at all for 10 minutes
- Explicitly requesting human help

## File Structure

```
orchestrator/
├── src/
│   ├── index.ts           # Entry point
│   ├── server.ts          # Express + WebSocket
│   ├── orchestrator.ts    # Cron loop
│   ├── db/
│   │   ├── index.ts       # Database connection
│   │   ├── agents.ts      # Agent queries
│   │   ├── tasks.ts       # Task queries
│   │   ├── sessions.ts    # Session queries
│   │   ├── iterations.ts  # Iteration queries
│   │   └── events.ts      # Event queries
│   ├── api/
│   │   ├── agents.ts      # /api/agents routes
│   │   ├── tasks.ts       # /api/tasks routes
│   │   ├── sessions.ts    # /api/sessions routes
│   │   └── events.ts      # /api/events routes
│   ├── ws/
│   │   └── handler.ts     # WebSocket handler
│   ├── telegram/
│   │   └── bot.ts         # Telegram bot
│   ├── spawner/
│   │   └── agent.ts       # Agent process spawner
│   └── types/
│       └── index.ts       # TypeScript types
├── package.json
└── tsconfig.json
```

## Build Order

1. **Database connection** - SQLite setup, run schema
2. **Basic API** - Agents CRUD, Tasks CRUD
3. **WebSocket** - Connection handling, event broadcast
4. **Telegram bot** - Channel messaging
5. **Orchestrator loop** - Tick logic
6. **Agent spawner** - Process management
7. **QA validation** - 15-min cycle
8. **Wave management** - Parallel execution
