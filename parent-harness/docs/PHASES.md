# Implementation Phases

Each task has its own test record, build steps, pass criteria, and validation query.

**Rule:** A task is only complete when its validation query returns a passed result.

---

## Test System Integration

Every task creates a test record:
```sql
INSERT INTO test_cases (id, suite_id, name, description) 
VALUES ('phase_1_task_1', 'phase_1', 'Vite Setup', '...');
```

After build steps complete, pass criteria are verified and results recorded:
```sql
INSERT INTO test_case_results (case_id, status, ...) 
VALUES ('phase_1_task_1', 'passed', ...);
```

Next task can only start when previous task's validation query succeeds.

---

# Phase 1: Frontend Shell (Days 1-2)

**Goal:** Static dashboard that can be tested independently.

**Test Suite:** `phase_1_frontend_shell`

---

### Task 1.1: Vite + React + TypeScript Setup

**Test Record:** `phase_1_task_1_vite_setup`

**Build Steps:**
- [x] 1.1.1: Run `npm create vite@latest dashboard -- --template react-ts` ✅
- [x] 1.1.2: `cd dashboard && npm install` ✅
- [x] 1.1.3: Verify `npm run dev` starts server ✅

**Pass Criteria:**
- [x] `dashboard/` folder exists ✅
- [x] `dashboard/package.json` contains "vite", "react", "typescript" ✅
- [x] `dashboard/src/main.tsx` exists ✅
- [x] `npm run dev` starts server on port 5173 ✅
- [ ] Browser shows React template page (verified via dev server output)

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_1_task_1_vite_setup' AND status = 'passed';
-- Must return 1 row
```

---

### Task 1.2: Tailwind CSS Configuration

**Test Record:** `phase_1_task_2_tailwind`

**Build Steps:**
- [x] 1.2.1: `npm install -D tailwindcss @tailwindcss/vite` ✅ (Tailwind v4)
- [x] 1.2.2: Configure vite.config.ts with @tailwindcss/vite plugin ✅
- [x] 1.2.3: N/A (Tailwind v4 uses Vite plugin, no tailwind.config.js needed)
- [x] 1.2.4: Add `@import "tailwindcss"` to `src/index.css` ✅
- [x] 1.2.5: Test with a Tailwind class in App.tsx ✅

**Pass Criteria:**
- [x] Tailwind packages installed ✅
- [x] vite.config.ts has tailwindcss plugin ✅
- [x] `src/index.css` contains `@import "tailwindcss"` ✅
- [x] A Tailwind class (e.g., `bg-gray-900`) renders correctly ✅
- [x] `npm run build` succeeds ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_1_task_2_tailwind' AND status = 'passed';
```

---

### Task 1.3: Three-Column Layout

**Test Record:** `phase_1_task_3_layout`

**Build Steps:**
- [x] 1.3.1: Create `src/components/Layout.tsx` ✅
- [x] 1.3.2: Implement header with logo/title ✅
- [x] 1.3.3: Implement three-column grid (left sidebar, main, right sidebar) ✅
- [x] 1.3.4: Add responsive breakpoints (12-col grid: 3-6-3) ✅
- [x] 1.3.5: Export and use in App.tsx ✅

**Pass Criteria:**
- [x] `src/components/Layout.tsx` exists ✅
- [x] Layout has `data-testid="layout-header"` ✅
- [x] Layout has `data-testid="layout-left"` (agent status area) ✅
- [x] Layout has `data-testid="layout-main"` (event stream area) ✅
- [x] Layout has `data-testid="layout-right"` (task queue area) ✅
- [x] CSS grid creates 3 columns ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_1_task_3_layout' AND status = 'passed';
```

---

### Task 1.4: AgentStatusCard Component

**Test Record:** `phase_1_task_4_agent_card`

**Build Steps:**
- [x] 1.4.1: Create `src/components/AgentStatusCard.tsx` ✅
- [x] 1.4.2: Define props interface (id, name, status, currentTask, lastHeartbeat) ✅
- [x] 1.4.3: Implement status badge (idle/working/error/stuck) ✅
- [x] 1.4.4: Add Telegram channel link ✅
- [x] 1.4.5: Create mock data with 7 agents ✅
- [x] 1.4.6: Render cards in Layout left column ✅

**Pass Criteria:**
- [x] `src/components/AgentStatusCard.tsx` exists ✅
- [x] Component has `data-testid="agent-card"` ✅
- [x] Status badge shows correct color per status ✅
- [x] Mock data renders 7 agent cards ✅
- [x] Card displays: name, status, current task (if any) ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_1_task_4_agent_card' AND status = 'passed';
```

---

### Task 1.5: EventStream Component

**Test Record:** `phase_1_task_5_event_stream`

**Build Steps:**
- [x] 1.5.1: Create `src/components/EventStream.tsx` ✅
- [x] 1.5.2: Define event interface (id, timestamp, type, message, agentId) ✅
- [x] 1.5.3: Implement scrollable list with auto-scroll toggle ✅
- [x] 1.5.4: Add color coding by event type ✅
- [x] 1.5.5: Create mock data with 8 events ✅
- [x] 1.5.6: Render in Layout main column ✅

**Pass Criteria:**
- [x] `src/components/EventStream.tsx` exists ✅
- [x] Component has `data-testid="event-stream"` ✅
- [x] Events have `data-testid="event-item"` ✅
- [x] Mock data renders 8 events ✅
- [x] Events show timestamp, type, message ✅
- [x] Auto-scroll toggle exists ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_1_task_5_event_stream' AND status = 'passed';
```

---

### Task 1.6: TaskCard Component

**Test Record:** `phase_1_task_6_task_card`

**Build Steps:**
- [x] 1.6.1: Create `src/components/TaskCard.tsx` ✅
- [x] 1.6.2: Define props interface (id, displayId, title, status, priority, assignedAgent) ✅
- [x] 1.6.3: Implement priority badge (P0-P4 with colors) ✅
- [x] 1.6.4: Implement status badge ✅
- [x] 1.6.5: Create mock data with 5 tasks ✅
- [x] 1.6.6: Render cards in Layout right column ✅

**Pass Criteria:**
- [x] `src/components/TaskCard.tsx` exists ✅
- [x] Component has `data-testid="task-card"` ✅
- [x] Priority badge shows P0-P4 with correct colors ✅
- [x] Status badge shows correct state ✅
- [x] Mock data renders 5 task cards ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_1_task_6_task_card' AND status = 'passed';
```

---

### Task 1.7: Basic Routing

**Test Record:** `phase_1_task_7_routing`

**Build Steps:**
- [x] 1.7.1: `npm install react-router-dom` ✅
- [x] 1.7.2: Create `src/pages/Dashboard.tsx` (home page) ✅
- [x] 1.7.3: Create `src/pages/Tasks.tsx` (task board) ✅
- [x] 1.7.4: Create `src/pages/Sessions.tsx` (agent sessions) ✅
- [x] 1.7.5: Configure routes in App.tsx ✅
- [x] 1.7.6: Add navigation links in header with active state ✅

**Pass Criteria:**
- [x] `react-router-dom` in package.json ✅
- [x] `/` route renders Dashboard page ✅
- [x] `/tasks` route renders Tasks page ✅
- [x] `/sessions` route renders Sessions page ✅
- [x] Navigation links work without page reload ✅
- [ ] Invalid routes show 404 or redirect (TODO)

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_1_task_7_routing' AND status = 'passed';
```

---

### Task 1.8: Notification Center

**Test Record:** `phase_1_task_8_notifications`

**Build Steps:**
- [x] 1.8.1: Create `src/components/NotificationCenter.tsx` ✅
- [x] 1.8.2: Add bell icon in header (top left as specified) ✅
- [x] 1.8.3: Implement dropdown with notification list ✅
- [x] 1.8.4: Add unread count badge ✅
- [x] 1.8.5: Create mock notifications (3) ✅
- [x] 1.8.6: Add click to dismiss/mark as read functionality ✅

**Pass Criteria:**
- [x] `src/components/NotificationCenter.tsx` exists ✅
- [x] Bell icon visible in header top-left ✅
- [x] Component has `data-testid="notification-center"` ✅
- [x] Dropdown shows on click ✅
- [x] Unread count badge displays ✅
- [x] Mock notifications render ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_1_task_8_notifications' AND status = 'passed';
```

---

## Phase 1 Completion Gate

**All tasks must pass before Phase 2 begins.**

**Final Validation:**
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed
FROM test_case_results 
WHERE case_id LIKE 'phase_1_task_%';
-- Must return: total = 8, passed = 8
```

**Verification Script:** `scripts/verify-phase-01.sh`
- Runs `npm run build` and `npm run typecheck`
- Starts preview server
- Uses Puppeteer MCP to verify all routes
- Checks all test records in database
- Exits 0 only if all 8 tasks passed

---

# Phase 2: Data Model (Days 3-4)

**Goal:** Database ready with schema and seed data.

**Test Suite:** `phase_2_data_model`

---

### Task 2.1: SQLite Database Setup

**Test Record:** `phase_2_task_1_sqlite_setup`

**Build Steps:**
- [x] 2.1.1: Create `orchestrator/` folder ✅
- [x] 2.1.2: `npm init -y && npm install better-sqlite3 typescript tsx` ✅
- [x] 2.1.3: Create `src/db/index.ts` with connection logic ✅
- [x] 2.1.4: Create `data/` folder for database file ✅
- [x] 2.1.5: Test connection opens successfully ✅

**Pass Criteria:**
- [x] `orchestrator/package.json` exists with better-sqlite3 ✅
- [x] `orchestrator/src/db/index.ts` exists ✅
- [x] `data/harness.db` created on first run ✅
- [x] Connection opens without error ✅
- [x] Can execute simple query (`SELECT 1`) ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_2_task_1_sqlite_setup' AND status = 'passed';
```

---

### Task 2.2: Run Schema

**Test Record:** `phase_2_task_2_schema`

**Build Steps:**
- [x] 2.2.1: Create `src/db/migrate.ts` ✅
- [x] 2.2.2: Read `database/schema.sql` ✅
- [x] 2.2.3: Execute all CREATE TABLE statements ✅
- [x] 2.2.4: Verify all tables created (33 tables) ✅

**Pass Criteria:**
- [x] `src/db/migrate.ts` exists ✅
- [x] 33 tables from schema.sql created ✅
- [x] All indexes created ✅
- [x] `npm run migrate` executes successfully ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_2_task_2_schema' AND status = 'passed';
```

---

### Task 2.3: Seed Agents

**Test Record:** `phase_2_task_3_seed_agents`

**Build Steps:**
- [x] 2.3.1: Create `src/db/seed.ts` ✅
- [x] 2.3.2: Insert 13 agents (from AGENTS.md) ✅
- [x] 2.3.3: Set default status = 'idle' ✅
- [x] 2.3.4: Set telegram_channel for each ✅

**Pass Criteria:**
- [x] 13 rows in `agents` table ✅
- [x] All agent types present ✅
- [x] All have telegram_channel set ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_2_task_3_seed_agents' AND status = 'passed';
```

---

### Task 2.4: Seed Sample Tasks

**Test Record:** `phase_2_task_4_seed_tasks`

**Build Steps:**
- [x] 2.4.1: Create sample task_list ✅
- [x] 2.4.2: Create 5 sample tasks with various priorities ✅
- [x] 2.4.3: Add task relationships (2 dependencies) ✅
- [x] 2.4.4: Set pass_criteria for each task ✅

**Pass Criteria:**
- [x] 1 row in `task_lists` table ✅
- [x] 5 rows in `tasks` table ✅
- [x] 2 task relationships exist ✅
- [x] All tasks have pass_criteria JSON ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_2_task_4_seed_tasks' AND status = 'passed';
```

---

### Task 2.5: Create Query Functions

**Test Record:** `phase_2_task_5_queries`

**Build Steps:**
- [x] 2.5.1: Create `src/db/agents.ts` with getAgents(), getAgent(id), updateAgentStatus() ✅
- [x] 2.5.2: Create `src/db/tasks.ts` with getTasks(), getTask(id), createTask(), updateTask(), deleteTask() ✅
- [x] 2.5.3: Create `src/db/sessions.ts` with getSessions(), getSession(id), createSession(), logIteration() ✅
- [x] 2.5.4: Create `src/db/events.ts` with getEvents(), createEvent(), event helpers ✅
- [x] 2.5.5: TypeScript compiles successfully ✅

**Pass Criteria:**
- [x] All query files exist ✅
- [x] agents.ts, tasks.ts, sessions.ts, events.ts created ✅
- [x] Full CRUD operations for tasks ✅
- [x] Event helpers for common event types ✅
- [x] `npm run typecheck` passes ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_2_task_5_queries' AND status = 'passed';
```

---

### Task 2.6: Create Test System Tables Seed

**Test Record:** `phase_2_task_6_test_seed`

**Build Steps:**
- [x] 2.6.1: Create test_suites for each phase (16 suites) ✅
- [x] 2.6.2: Create test_cases for Phase 1 tasks (8 cases) ✅
- [x] 2.6.3: Create test_steps for each case ✅
- [x] 2.6.4: Create test_assertions for key criteria ✅

**Pass Criteria:**
- [x] 16 rows in `test_suites` (one per phase) ✅
- [x] 8 rows in `test_cases` for phase_1 ✅
- [x] Each test_case has at least 1 test_step ✅
- [x] Key assertions defined ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_2_task_6_test_seed' AND status = 'passed';
```

---

## Phase 2 Completion Gate

**Final Validation:**
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed
FROM test_case_results 
WHERE case_id LIKE 'phase_2_task_%';
-- Must return: total = 6, passed = 6
```

---

# Phase 3: Backend API (Days 5-7)

**Goal:** REST API serving real data.

**Test Suite:** `phase_3_backend_api`

---

### Task 3.1: Express Server Setup

**Test Record:** `phase_3_task_1_express`

**Build Steps:**
- [x] 3.1.1: `npm install express cors` ✅
- [x] 3.1.2: `npm install -D @types/express @types/cors` ✅
- [x] 3.1.3: Create `src/server.ts` with Express app ✅
- [x] 3.1.4: Configure CORS middleware ✅
- [x] 3.1.5: Add health check endpoint `/health` ✅
- [x] 3.1.6: Start server on port 3333 ✅

**Pass Criteria:**
- [x] `src/server.ts` exists ✅
- [x] Server starts on port 3333 ✅
- [x] `GET /health` returns `{"status": "ok"}` ✅
- [x] CORS headers present in response ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_3_task_1_express' AND status = 'passed';
```

---

### Task 3.2: Agents API Endpoints

**Test Record:** `phase_3_task_2_agents_api`

**Build Steps:**
- [x] 3.2.1: Create `src/api/agents.ts` router ✅
- [x] 3.2.2: Implement `GET /api/agents` (list all) ✅
- [x] 3.2.3: Implement `GET /api/agents/:id` (get one) ✅
- [x] 3.2.4: Implement `PATCH /api/agents/:id` (update status) ✅
- [x] 3.2.5: Implement `POST /api/agents/:id/heartbeat` ✅

**Pass Criteria:**
- [x] `GET /api/agents` returns 13 agents ✅
- [x] `GET /api/agents/build_agent` returns single agent ✅
- [x] `GET /api/agents/invalid` returns 404 ✅
- [x] `PATCH /api/agents/build_agent` updates status ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_3_task_2_agents_api' AND status = 'passed';
```

---

### Task 3.3: Tasks API Endpoints

**Test Record:** `phase_3_task_3_tasks_api`

**Build Steps:**
- [x] 3.3.1: Create `src/api/tasks.ts` router ✅
- [x] 3.3.2: Implement `GET /api/tasks` (list with filters) ✅
- [x] 3.3.3: Implement `GET /api/tasks/:id` (get one) ✅
- [x] 3.3.4: Implement `POST /api/tasks` (create) ✅
- [x] 3.3.5: Implement `PATCH /api/tasks/:id` (update) ✅
- [x] 3.3.6: Implement `DELETE /api/tasks/:id` (delete) ✅
- [x] 3.3.7: Implement `POST /api/tasks/:id/assign|complete|fail` ✅

**Pass Criteria:**
- [x] `GET /api/tasks` returns tasks array ✅
- [x] `GET /api/tasks?status=pending` filters correctly ✅
- [x] `POST /api/tasks` creates and returns 201 ✅
- [x] `PATCH /api/tasks/:id` updates and returns task ✅
- [x] `DELETE /api/tasks/:id` removes and returns success ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_3_task_3_tasks_api' AND status = 'passed';
```

---

### Task 3.4: Sessions API Endpoints

**Test Record:** `phase_3_task_4_sessions_api`

**Build Steps:**
- [x] 3.4.1: Create `src/api/sessions.ts` router ✅
- [x] 3.4.2: Implement `GET /api/sessions` (list with filters) ✅
- [x] 3.4.3: Implement `GET /api/sessions/:id` (get with iterations) ✅
- [x] 3.4.4: Implement `POST /api/sessions/:id/iterations` (log iteration) ✅
- [x] 3.4.5: Implement `POST /api/sessions/:id/terminate` (terminate session) ✅

**Pass Criteria:**
- [x] `GET /api/sessions` returns sessions array ✅
- [x] `GET /api/sessions/:id` includes iterations ✅
- [x] `POST /api/sessions/:id/iterations` logs iteration ✅
- [x] `POST /api/sessions/:id/terminate` updates status ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_3_task_4_sessions_api' AND status = 'passed';
```

---

### Task 3.5: Events API Endpoints

**Test Record:** `phase_3_task_5_events_api`

**Build Steps:**
- [x] 3.5.1: Create `src/api/events.ts` router ✅
- [x] 3.5.2: Implement `GET /api/events` (list with filters) ✅
- [x] 3.5.3: Support filters: type, agent_id, session_id, severity, since, limit ✅
- [x] 3.5.4: Implement pagination (offset/limit) ✅

**Pass Criteria:**
- [x] `GET /api/events` returns events array ✅
- [x] `GET /api/events?type=task:assigned` filters correctly ✅
- [x] `GET /api/events?limit=10&offset=0` paginates ✅
- [x] Events ordered by timestamp desc ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_3_task_5_events_api' AND status = 'passed';
```

---

### Task 3.6: Test Results API Endpoints

**Test Record:** `phase_3_task_6_tests_api`

**Build Steps:**
- [x] 3.6.1: Create `src/api/tests.ts` router ✅
- [x] 3.6.2: Implement `GET /api/tests/suites` (list suites) ✅
- [x] 3.6.3: Implement `GET /api/tests/runs` (list runs) ✅
- [x] 3.6.4: Implement `GET /api/tests/runs/:id` (run with results) ✅
- [x] 3.6.5: Implement `POST /api/tests/runs` (trigger test run) ✅

**Pass Criteria:**
- [x] `GET /api/tests/suites` returns 16 suites ✅
- [x] `GET /api/tests/runs` returns runs array ✅
- [x] `POST /api/tests/runs` creates test run ✅
- [x] Results include suite/case results ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_3_task_6_tests_api' AND status = 'passed';
```

---

### Task 3.7: Error Handling Middleware

**Test Record:** `phase_3_task_7_error_handling`

**Build Steps:**
- [x] 3.7.1: Create `src/middleware/error-handler.ts` ✅
- [x] 3.7.2: Handle 404 for unknown routes ✅
- [x] 3.7.3: Handle 500 for server errors ✅
- [x] 3.7.4: Return consistent JSON error format ✅
- [x] 3.7.5: Log errors to console ✅

**Pass Criteria:**
- [x] Unknown route returns `{"error": "Not found", "status": 404}` ✅
- [x] Server error returns `{"error": "...", "status": 500}` ✅
- [x] All errors have consistent JSON structure ✅
- [x] Errors logged to console ✅

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_3_task_7_error_handling' AND status = 'passed';
```

---

## Phase 3 Completion Gate

**Final Validation:**
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed
FROM test_case_results 
WHERE case_id LIKE 'phase_3_task_%';
-- Must return: total = 7, passed = 7
```

---

# Phases 4-16: Structure Template

Each remaining phase follows the same structure:

```
# Phase N: Name (Days X-Y)

**Goal:** [description]

**Test Suite:** `phase_N_name`

---

### Task N.1: [Task Name]

**Test Record:** `phase_N_task_1_[slug]`

**Build Steps:**
- [ ] N.1.1: [step description]
- [ ] N.1.2: [step description]
...

**Pass Criteria:**
- [ ] [criterion 1]
- [ ] [criterion 2]
...

**Validation Query:**
```sql
SELECT * FROM test_case_results 
WHERE case_id = 'phase_N_task_1_[slug]' AND status = 'passed';
```

---

## Phase N Completion Gate

**Final Validation:**
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed
FROM test_case_results 
WHERE case_id LIKE 'phase_N_task_%';
```
```

---

# Summary

| Phase | Name | Tasks | Days |
|-------|------|-------|------|
| 1 | Frontend Shell | 8 | 1-2 |
| 2 | Data Model | 6 | 3-4 |
| 3 | Backend API | 7 | 5-7 |
| 4 | Frontend + API | 7 | 8-9 |
| 5 | WebSocket | 7 | 10-11 |
| 6 | Telegram Bot | 7 | 12-13 |
| 7 | Orchestrator | 8 | 14-16 |
| 8 | Clarification Agent | 6 | 17-18 |
| 9 | Agent Spawner | 7 | 19-21 |
| 10 | Agent Memory | 5 | 22-23 |
| 11 | QA Validation | 6 | 24-26 |
| 12 | Human Sim Agent | 6 | 27-30 |
| 13 | Wave Execution | 6 | 31-33 |
| 14 | Planning Agent | 6 | 34-36 |
| 15 | Self-Improvement | 5 | 37-39 |
| 16 | Polish | 9 | 40-43 |

**Total:** 106 tasks across 16 phases over 43 days

---

# Test System Flow

```
1. Agent starts task N.X
2. Creates test_case_results record with status='running'
3. Executes build steps (checking off as completed)
4. For each pass criterion:
   a. Creates test_step_results record
   b. Runs verification
   c. Creates test_assertion_results record
5. If all pass → status='passed'
6. If any fail → status='failed', triggers fix loop
7. Next task checks validation query before starting
```

---

# Browser Testing

- **Primary:** Agent Browser (Vercel Claude Code skill)
- **Fallback:** Puppeteer MCP

Used for E2E tests and UI verification.
