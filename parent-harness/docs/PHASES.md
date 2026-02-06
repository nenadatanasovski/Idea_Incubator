# Implementation Phases

Build order designed for incremental testing.

## Phase 1: Frontend Shell (Days 1-2)

**Goal:** Static dashboard that can be tested independently.

**Tasks:**
1. Vite + React + TypeScript setup
2. Tailwind CSS config
3. Three-column layout (header, main grid)
4. AgentStatusCard component (hardcoded data)
5. EventStream component (mock events)
6. TaskCard component (mock tasks)
7. Basic routing (/, /tasks, /sessions)

**Test:** Can view dashboard with fake data.

**Deliverable:** `dashboard/` folder with working static UI.

## Phase 2: Data Model (Days 3-4)

**Goal:** Database ready with schema and seed data.

**Tasks:**
1. SQLite database setup
2. Run schema.sql
3. Seed agents table (10 agents)
4. Seed sample task_list, tasks
5. Create views
6. Basic query functions (db/*.ts)

**Test:** Can query agents, tasks via Node REPL.

**Deliverable:** `data/harness.db` with schema + seeds.

## Phase 3: Backend API (Days 5-7)

**Goal:** REST API serving real data.

**Tasks:**
1. Express server setup
2. `/api/agents` endpoints
3. `/api/tasks` endpoints
4. `/api/sessions` endpoints
5. `/api/events` endpoints
6. Error handling middleware
7. CORS config

**Test:** curl commands return real data.

**Deliverable:** API at `localhost:3333/api`.

## Phase 4: Frontend + API (Days 8-9)

**Goal:** Dashboard shows real data.

**Tasks:**
1. useApi hook for data fetching
2. Connect AgentStatusCard to `/api/agents`
3. Connect TaskBoard to `/api/tasks`
4. Connect SessionsView to `/api/sessions`
5. Connect EventStream to `/api/events`

**Test:** Dashboard shows database data.

## Phase 5: WebSocket (Days 10-11)

**Goal:** Real-time updates.

**Tasks:**
1. WebSocket server setup
2. useHarnessWebSocket hook
3. Broadcast agent status changes
4. Broadcast task updates
5. Broadcast new events
6. Auto-reconnect logic

**Test:** Changes in DB appear in UI instantly.

## Phase 6: Telegram Bot (Days 12-13)

**Goal:** Messages to Telegram channels.

**Tasks:**
1. Create Telegram bot via @BotFather
2. Create test channels
3. Bot connection logic
4. sendToChannel function
5. sendCritical function
6. Message formatting (emojis, markdown)

**Test:** API call triggers Telegram message.

## Phase 7: Orchestrator Loop (Days 14-16)

**Goal:** Automated task assignment.

**Tasks:**
1. Cron loop (60s interval)
2. Check idle agents
3. Get ready tasks
4. Assignment logic
5. Create sessions + iterations
6. Emit events
7. Telegram notifications

**Test:** Create task → auto-assigned to agent → Telegram notified.

**Note:** Agent spawning stubbed (just creates records).

## Phase 8: Agent Spawner (Days 17-19)

**Goal:** Actually run Claude Code instances.

**Tasks:**
1. Claude Code CLI integration
2. Process spawning
3. Output capture to iteration_logs
4. Heartbeat monitoring
5. Graceful termination
6. Error handling

**Test:** Task assigned → Claude Code runs → output captured.

## Phase 9: QA Validation (Days 20-22)

**Goal:** Every iteration validated.

**Tasks:**
1. QA Agent system prompt
2. Verification script runner
3. 15-minute cron cycle
4. Stuck detection logic
5. Session termination
6. QA results recording
7. Telegram alerts

**Test:** Agent completes iteration → QA validates → result recorded.

## Phase 10: Wave Execution (Days 23-25)

**Goal:** Parallel task execution.

**Tasks:**
1. Wave calculation from dependencies
2. Lane assignment by file patterns
3. Wave lifecycle management
4. Parallel agent spawning
5. Wave progress tracking
6. UI wave visualization

**Test:** Task list with deps → runs in correct wave order → parallelizes within waves.

## Phase 11: Polish (Days 26-28)

**Goal:** Production ready.

**Tasks:**
1. Error boundary components
2. Loading states
3. Empty states
4. Log viewer modal
5. Task detail modal
6. Session detail view
7. Full iteration history
8. Filters and search
9. Docker optimization
10. Documentation

## Summary

| Phase | Focus | Days | Testable Deliverable |
|-------|-------|------|---------------------|
| 1 | Frontend Shell | 1-2 | Static UI with mock data |
| 2 | Data Model | 3-4 | Database with schema |
| 3 | Backend API | 5-7 | REST endpoints |
| 4 | Frontend + API | 8-9 | UI with real data |
| 5 | WebSocket | 10-11 | Real-time updates |
| 6 | Telegram Bot | 12-13 | Channel messaging |
| 7 | Orchestrator | 14-16 | Auto task assignment |
| 8 | Agent Spawner | 17-19 | Claude Code execution |
| 9 | QA Validation | 20-22 | Per-iteration validation |
| 10 | Wave Execution | 23-25 | Parallel execution |
| 11 | Polish | 26-28 | Production ready |

**Total:** ~28 days

## Build Dependencies

```
Phase 1 (Frontend) ──┐
                     ├──► Phase 4 (Connect)
Phase 2 (Data) ──────┤
                     │
Phase 3 (API) ───────┘
                     │
                     ▼
              Phase 5 (WebSocket)
                     │
                     ▼
              Phase 6 (Telegram)
                     │
                     ▼
              Phase 7 (Orchestrator)
                     │
                     ▼
              Phase 8 (Spawner)
                     │
                     ▼
              Phase 9 (QA)
                     │
                     ▼
              Phase 10 (Waves)
                     │
                     ▼
              Phase 11 (Polish)
```

**Key insight:** Frontend, Data Model, and Backend can be built in parallel by different agents.
