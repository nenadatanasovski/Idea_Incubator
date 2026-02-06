# Implementation Phases

Each phase has explicit pass criteria and verification scripts. **No phase starts until the previous phase passes all criteria.**

---

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
8. Notification center (top left)

**Pass Criteria:**
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run typecheck` passes
- [ ] Dashboard loads at http://localhost:5173
- [ ] All 3 routes render without crash (/, /tasks, /sessions)
- [ ] AgentStatusCard displays 3+ mock agents
- [ ] EventStream shows 5+ mock events
- [ ] Notification center icon visible in header

**Verification Script:** `scripts/verify-phase-01.sh`
```bash
#!/bin/bash
set -e
cd dashboard
npm run build
npm run typecheck
npm run preview &
PID=$!
sleep 3
curl -s http://localhost:4173 | grep -q "Agent Status" || exit 1
curl -s http://localhost:4173/tasks | grep -q "Tasks" || exit 1
curl -s http://localhost:4173/sessions | grep -q "Sessions" || exit 1
kill $PID
echo "✅ Phase 1 PASSED"
```

**Gate:** All criteria checked, script exits 0.

---

## Phase 2: Data Model (Days 3-4)

**Goal:** Database ready with schema and seed data.

**Tasks:**
1. SQLite database setup (better-sqlite3)
2. Run schema.sql (all tables from DATA_MODEL.md)
3. Seed agents table (13 agents)
4. Seed sample task_list with 5 tasks
5. Create all views
6. Query functions for each table

**Pass Criteria:**
- [ ] Database file exists at `data/harness.db`
- [ ] All 25+ tables created (SELECT count(*) FROM sqlite_master WHERE type='table')
- [ ] 13 agents seeded in agents table
- [ ] 5 sample tasks exist
- [ ] All views queryable without error
- [ ] `db.getAgents()` returns 13 agents
- [ ] `db.getTasks()` returns 5 tasks

**Verification Script:** `scripts/verify-phase-02.sh`
```bash
#!/bin/bash
set -e
cd orchestrator
node -e "
const db = require('./dist/db').default;
const agents = db.getAgents();
if (agents.length !== 13) throw new Error('Expected 13 agents, got ' + agents.length);
const tasks = db.getTasks();
if (tasks.length < 5) throw new Error('Expected 5+ tasks, got ' + tasks.length);
const tables = db.query('SELECT count(*) as c FROM sqlite_master WHERE type=\"table\"');
if (tables[0].c < 25) throw new Error('Expected 25+ tables, got ' + tables[0].c);
console.log('✅ Phase 2 PASSED');
"
```

**Gate:** All criteria checked, script exits 0.

---

## Phase 3: Backend API (Days 5-7)

**Goal:** REST API serving real data.

**Tasks:**
1. Express server setup with TypeScript
2. `/api/agents` - GET (list), GET/:id, PATCH/:id
3. `/api/tasks` - GET (list), GET/:id, POST, PATCH/:id, DELETE/:id
4. `/api/sessions` - GET (list), GET/:id, POST/:id/terminate
5. `/api/iterations` - GET/:id, GET/:id/log
6. `/api/events` - GET (list with filters)
7. Error handling middleware
8. CORS config

**Pass Criteria:**
- [ ] Server starts on port 3333
- [ ] GET /api/agents returns 13 agents
- [ ] GET /api/tasks returns 5+ tasks
- [ ] POST /api/tasks creates a task (returns 201)
- [ ] PATCH /api/tasks/:id updates a task
- [ ] DELETE /api/tasks/:id removes a task
- [ ] GET /api/sessions returns array
- [ ] GET /api/events returns array
- [ ] Invalid routes return 404 JSON
- [ ] Server errors return 500 JSON

**Verification Script:** `scripts/verify-phase-03.sh`
```bash
#!/bin/bash
set -e
cd orchestrator && npm run build && npm start &
PID=$!
sleep 3

# Test endpoints
AGENTS=$(curl -s http://localhost:3333/api/agents | jq length)
[ "$AGENTS" -eq 13 ] || exit 1

TASKS=$(curl -s http://localhost:3333/api/tasks | jq '.tasks | length')
[ "$TASKS" -ge 5 ] || exit 1

# Create task
CREATED=$(curl -s -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task","description":"Test"}' | jq -r '.id')
[ -n "$CREATED" ] || exit 1

# Delete task
curl -s -X DELETE http://localhost:3333/api/tasks/$CREATED | jq -e '.success' || exit 1

# 404 test
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/api/notfound)
[ "$STATUS" -eq 404 ] || exit 1

kill $PID
echo "✅ Phase 3 PASSED"
```

**Gate:** All criteria checked, script exits 0.

---

## Phase 4: Frontend + API (Days 8-9)

**Goal:** Dashboard shows real data from API.

**Tasks:**
1. useApi hook with fetch wrapper
2. Connect AgentStatusCard to /api/agents
3. Connect TaskBoard to /api/tasks
4. Connect SessionsView to /api/sessions
5. Connect EventStream to /api/events
6. Loading states for all components
7. Error states for failed fetches

**Pass Criteria:**
- [ ] Dashboard fetches agents from API on load
- [ ] Agent cards show real data (not hardcoded)
- [ ] Tasks page shows tasks from database
- [ ] Sessions page shows sessions from database
- [ ] Loading spinners appear during fetch
- [ ] Error message appears if API is down
- [ ] No console errors in browser

**Verification Script:** `scripts/verify-phase-04.sh`
```bash
#!/bin/bash
set -e
# Start API
cd orchestrator && npm start &
API_PID=$!
sleep 2

# Start frontend
cd ../dashboard && npm run preview &
FE_PID=$!
sleep 3

# Use Playwright to verify
npx playwright test tests/phase-04.spec.ts

kill $API_PID $FE_PID
echo "✅ Phase 4 PASSED"
```

**Playwright Test:** `tests/phase-04.spec.ts`
```typescript
test('dashboard shows real agents', async ({ page }) => {
  await page.goto('http://localhost:4173');
  await expect(page.locator('[data-testid="agent-card"]')).toHaveCount(13);
});

test('tasks page shows real tasks', async ({ page }) => {
  await page.goto('http://localhost:4173/tasks');
  await expect(page.locator('[data-testid="task-card"]')).toHaveCount.greaterThan(0);
});
```

**Gate:** Playwright tests pass, script exits 0.

---

## Phase 5: WebSocket (Days 10-11)

**Goal:** Real-time updates without polling.

**Tasks:**
1. WebSocket server on /ws
2. useHarnessWebSocket hook
3. Broadcast agent:status events
4. Broadcast task:updated events
5. Broadcast event:new events
6. Auto-reconnect on disconnect
7. Connection status indicator in UI

**Pass Criteria:**
- [ ] WebSocket connects at ws://localhost:3333/ws
- [ ] Agent status change in DB broadcasts to clients
- [ ] Task update in DB broadcasts to clients
- [ ] New event in DB broadcasts to clients
- [ ] UI updates without page refresh
- [ ] Reconnects within 5 seconds after disconnect
- [ ] Connection indicator shows green when connected

**Verification Script:** `scripts/verify-phase-05.sh`
```bash
#!/bin/bash
set -e
cd orchestrator && npm start &
PID=$!
sleep 2

# WebSocket test
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3333/ws');
let received = false;
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'agent:status') received = true;
});
ws.on('open', () => {
  // Trigger an agent status change via API
  fetch('http://localhost:3333/api/agents/build_agent', {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({status: 'working'})
  });
});
setTimeout(() => {
  if (!received) process.exit(1);
  console.log('✅ Phase 5 PASSED');
  process.exit(0);
}, 3000);
"

kill $PID
```

**Gate:** WebSocket test passes, script exits 0.

---

## Phase 6: Telegram Bot (Days 12-13)

**Goal:** Messages to Telegram channels.

**Tasks:**
1. Create Telegram bot via @BotFather
2. Create 14 channels and add bot as admin
3. Bot connection logic
4. `sendToChannel(channel, message)` function
5. `sendCritical(message)` function
6. Message formatting with emojis
7. Test message to @vibe-critical on startup

**Pass Criteria:**
- [ ] Bot token configured in .env
- [ ] 14 channel IDs configured
- [ ] `sendToChannel('@vibe-critical', 'Test')` succeeds
- [ ] `sendToChannel('@vibe-build', 'Test')` succeeds
- [ ] Message appears in Telegram channel
- [ ] Emoji formatting renders correctly
- [ ] Startup message sent to @vibe-orchestrator

**Verification Script:** `scripts/verify-phase-06.sh`
```bash
#!/bin/bash
set -e
cd orchestrator

# Test Telegram connection
node -e "
const telegram = require('./dist/telegram').default;
await telegram.sendToChannel('@vibe-critical', '🧪 Phase 6 verification test');
await telegram.sendToChannel('@vibe-build', '🧪 Phase 6 verification test');
console.log('✅ Phase 6 PASSED');
"
```

**Gate:** Messages appear in Telegram, script exits 0.

---

## Phase 7: Orchestrator Loop (Days 14-16)

**Goal:** Automated cron loop with clarification gate.

**Tasks:**
1. Cron loop (60s interval)
2. Clarification gate check
3. Get idle agents query
4. Get ready tasks query
5. Task assignment logic
6. Create sessions + iterations
7. Emit events
8. Telegram notifications

**Pass Criteria:**
- [ ] Orchestrator starts and logs tick every 60s
- [ ] Idle agents detected correctly
- [ ] Ready tasks (dependencies met + clarified) detected
- [ ] Task assigned to agent → agent status = 'working'
- [ ] Session created with iteration 1
- [ ] Event emitted for task:assigned
- [ ] Telegram message sent to agent channel
- [ ] Unclarified tasks NOT assigned (gate works)

**Verification Script:** `scripts/verify-phase-07.sh`
```bash
#!/bin/bash
set -e
cd orchestrator && npm start &
PID=$!
sleep 5

# Create a clarified task
TASK_ID=$(curl -s -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test","clarification_status":"complete"}' | jq -r '.id')

# Wait for orchestrator tick
sleep 65

# Check task was assigned
STATUS=$(curl -s http://localhost:3333/api/tasks/$TASK_ID | jq -r '.status')
[ "$STATUS" = "in_progress" ] || exit 1

# Check session was created
SESSIONS=$(curl -s "http://localhost:3333/api/sessions?task_id=$TASK_ID" | jq length)
[ "$SESSIONS" -ge 1 ] || exit 1

kill $PID
echo "✅ Phase 7 PASSED"
```

**Gate:** Orchestrator assigns task correctly, script exits 0.

---

## Phase 8: Clarification Agent (Days 17-18)

**Goal:** Proactive question-asking for vague tasks.

**Tasks:**
1. Clarification Agent system prompt
2. Question generation logic
3. Telegram interaction (ask in @vibe-clarification)
4. Answer processing
5. Task enrichment
6. Timeout handling (24h)

**Pass Criteria:**
- [ ] New user task triggers Clarification Agent
- [ ] Agent asks at least 2 clarifying questions
- [ ] Questions appear in @vibe-clarification
- [ ] User answer updates task description
- [ ] Task status changes to clarification_status='complete'
- [ ] Clarified task enters normal queue
- [ ] Timeout after 24h proceeds with assumptions

**Verification Script:** `scripts/verify-phase-08.sh`
```bash
#!/bin/bash
set -e
cd orchestrator && npm start &
PID=$!
sleep 3

# Create vague task
TASK_ID=$(curl -s -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Add auth","description":"Add authentication"}' | jq -r '.id')

# Wait for clarification to start
sleep 10

# Check clarification session exists
CLAR=$(curl -s "http://localhost:3333/api/clarifications?task_id=$TASK_ID" | jq length)
[ "$CLAR" -ge 1 ] || exit 1

# Simulate answer
curl -s -X POST http://localhost:3333/api/clarifications/$TASK_ID/answer \
  -H "Content-Type: application/json" \
  -d '{"answer":"OAuth with Google, protect /api/* routes, use JWT"}'

# Check task was enriched
sleep 5
DESC=$(curl -s http://localhost:3333/api/tasks/$TASK_ID | jq -r '.description')
echo "$DESC" | grep -q "OAuth" || exit 1

kill $PID
echo "✅ Phase 8 PASSED"
```

**Gate:** Clarification flow completes, script exits 0.

---

## Phase 9: Agent Spawner (Days 19-21)

**Goal:** Actually run Claude Code instances.

**Tasks:**
1. Claude Code CLI integration
2. Process spawning with config
3. Transcript capture to transcript_entries
4. Output parsing for tool calls
5. Heartbeat monitoring
6. Graceful termination
7. Error handling

**Pass Criteria:**
- [ ] Claude Code process spawns for assigned task
- [ ] Output captured to transcript_entries table
- [ ] Tool calls parsed and stored
- [ ] Heartbeat updates agent.last_heartbeat
- [ ] Process terminates cleanly on task complete
- [ ] Failed process updates iteration status
- [ ] Memory usage stays under 2GB per agent

**Verification Script:** `scripts/verify-phase-09.sh`
```bash
#!/bin/bash
set -e
cd orchestrator && npm start &
PID=$!
sleep 3

# Create and assign a simple task
TASK_ID=$(curl -s -X POST http://localhost:3333/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Create test file",
    "description":"Create a file called test.txt with content Hello",
    "clarification_status":"complete",
    "pass_criteria":["test.txt exists","test.txt contains Hello"]
  }' | jq -r '.id')

# Wait for agent to complete (max 5 min)
for i in {1..60}; do
  STATUS=$(curl -s http://localhost:3333/api/tasks/$TASK_ID | jq -r '.status')
  [ "$STATUS" = "completed" ] && break
  sleep 5
done

[ "$STATUS" = "completed" ] || exit 1

# Check transcript exists
TRANS=$(curl -s "http://localhost:3333/api/transcripts?task_id=$TASK_ID" | jq length)
[ "$TRANS" -ge 1 ] || exit 1

kill $PID
echo "✅ Phase 9 PASSED"
```

**Gate:** Agent spawns, completes task, transcript captured.

---

## Phase 10: Agent Memory (Days 22-23)

**Goal:** Agents remember and learn from experience.

**Tasks:**
1. Memory creation on task completion
2. Memory retrieval before task start
3. Memory decay (reduce relevance over time)
4. SIA task memory (technique tracking)
5. Technique effectiveness tracking

**Pass Criteria:**
- [ ] Successful task creates memory entry
- [ ] Failed task creates failure memory
- [ ] Memory injected into agent system prompt
- [ ] Old memories (>30 days) pruned
- [ ] Similar task matches by signature
- [ ] Technique effectiveness calculated
- [ ] Agent avoids previously failed techniques

**Verification Script:** `scripts/verify-phase-10.sh`
```bash
#!/bin/bash
set -e
cd orchestrator

node -e "
const db = require('./dist/db').default;
const memory = require('./dist/memory').default;

// Create test memory
await memory.create({
  agentId: 'build_agent',
  memoryType: 'success_pattern',
  content: 'Always run typecheck before commit',
  taskSignature: 'test-sig-123'
});

// Retrieve memory
const memories = await memory.getRelevant('build_agent', {signature: 'test-sig-123'});
if (memories.length < 1) throw new Error('Memory not retrieved');

// Check technique effectiveness
const eff = await memory.getTechniqueEffectiveness('decomposition');
console.log('Technique effectiveness:', eff);

console.log('✅ Phase 10 PASSED');
"
```

**Gate:** Memory CRUD works, script exits 0.

---

## Phase 11: QA Validation (Days 24-26)

**Goal:** Every iteration validated + stuck detection.

**Tasks:**
1. QA Agent system prompt
2. Per-iteration validation checks
3. 15-minute audit cycle
4. Stuck detection logic
5. Build interventions recording
6. SIA arbitration for disputes

**Pass Criteria:**
- [ ] Completed iteration triggers QA validation
- [ ] QA runs typecheck, tests, lint
- [ ] Validation result stored in iteration_logs
- [ ] 15-min audit detects stuck agents
- [ ] Stuck agent terminated after detection
- [ ] Build intervention recorded when QA/SIA fixes
- [ ] SIA called for agent disputes

**Verification Script:** `scripts/verify-phase-11.sh`
```bash
#!/bin/bash
set -e
cd orchestrator && npm start &
PID=$!
sleep 3

# Complete a task and trigger QA
# ... (simulate completed iteration)

# Wait for QA cycle
sleep 60

# Check QA result exists
QA=$(curl -s "http://localhost:3333/api/qa-audits?limit=1" | jq length)
[ "$QA" -ge 1 ] || exit 1

kill $PID
echo "✅ Phase 11 PASSED"
```

**Gate:** QA validation runs, script exits 0.

---

## Phase 12: Human Sim Agent (Days 27-30)

**Goal:** Usability testing with multiple personas.

**Tasks:**
1. Human Sim Agent system prompt
2. Persona system (5 personas)
3. Playwright integration
4. Multi-instance spawning
5. Results aggregation
6. Fix task creation

**Pass Criteria:**
- [ ] Human Sim spawns for completed UI task
- [ ] All 5 personas defined and loadable
- [ ] Playwright navigates to test URL
- [ ] Screenshots captured
- [ ] Findings recorded in human_sim_results
- [ ] Fix tasks created for issues found
- [ ] Multiple personas run in parallel

**Verification Script:** `scripts/verify-phase-12.sh`
```bash
#!/bin/bash
set -e
cd orchestrator

node -e "
const humanSim = require('./dist/agents/human-sim').default;

// Test persona loading
const personas = humanSim.getPersonas();
if (Object.keys(personas).length !== 5) throw new Error('Expected 5 personas');

// Test single run (mock)
const result = await humanSim.runTest({
  taskId: 'test-task',
  persona: 'casual',
  testUrl: 'http://localhost:4173'
});

if (!result.findings) throw new Error('No findings returned');

console.log('✅ Phase 12 PASSED');
"
```

**Gate:** Human Sim runs with personas, script exits 0.

---

## Phase 13: Wave Execution (Days 31-33)

**Goal:** Parallel task execution in waves.

**Tasks:**
1. Wave calculation from dependencies
2. Lane assignment by file patterns
3. Wave lifecycle management
4. Parallel agent spawning
5. Wave progress tracking
6. File impact analysis

**Pass Criteria:**
- [ ] Task list generates correct wave numbers
- [ ] Tasks assigned to lanes by category
- [ ] Wave N+1 only starts after Wave N completes
- [ ] Multiple agents work in parallel within wave
- [ ] Wave progress visible in dashboard
- [ ] File conflicts detected between parallel tasks

**Verification Script:** `scripts/verify-phase-13.sh`
```bash
#!/bin/bash
set -e
cd orchestrator

node -e "
const waves = require('./dist/waves').default;

// Create test task list with dependencies
const tasks = [
  {id: 'a', deps: []},
  {id: 'b', deps: []},
  {id: 'c', deps: ['a']},
  {id: 'd', deps: ['a', 'b']},
  {id: 'e', deps: ['c', 'd']}
];

const waveMap = waves.calculate(tasks);

// Validate wave assignments
if (waveMap.get('a') !== 1) throw new Error('Task a should be wave 1');
if (waveMap.get('b') !== 1) throw new Error('Task b should be wave 1');
if (waveMap.get('c') !== 2) throw new Error('Task c should be wave 2');
if (waveMap.get('d') !== 2) throw new Error('Task d should be wave 2');
if (waveMap.get('e') !== 3) throw new Error('Task e should be wave 3');

console.log('✅ Phase 13 PASSED');
"
```

**Gate:** Wave calculation correct, script exits 0.

---

## Phase 14: Planning Agent (Days 34-36)

**Goal:** Strategic brain that creates improvement tasks.

**Tasks:**
1. Planning Agent system prompt with vision
2. Project state analyzer
3. Task creation logic
4. Vision alignment check
5. Cron schedule (every 2 hours)
6. Telegram reporting

**Pass Criteria:**
- [ ] Planning Agent runs on cron schedule
- [ ] Analyzes project state (codebase, tests, coverage)
- [ ] Creates improvement tasks in database
- [ ] Tasks have proper category='improvement'
- [ ] Vision alignment score calculated
- [ ] Results stored in planning_evaluations
- [ ] Report sent to @vibe-planning

**Verification Script:** `scripts/verify-phase-14.sh`
```bash
#!/bin/bash
set -e
cd orchestrator && npm start &
PID=$!

# Wait for planning cycle (or trigger manually)
curl -s -X POST http://localhost:3333/api/planning/evaluate

sleep 30

# Check evaluation exists
EVAL=$(curl -s "http://localhost:3333/api/planning/evaluations?limit=1" | jq length)
[ "$EVAL" -ge 1 ] || exit 1

# Check tasks were created
TASKS=$(curl -s "http://localhost:3333/api/tasks?category=improvement" | jq '.tasks | length')
[ "$TASKS" -ge 1 ] || exit 1

kill $PID
echo "✅ Phase 14 PASSED"
```

**Gate:** Planning Agent creates improvement tasks.

---

## Phase 15: Self-Improvement (Days 37-39)

**Goal:** System improves from failures.

**Tasks:**
1. Failure pattern detection
2. Learning analysis
3. Technique recommendation
4. Harness self-modification
5. Modification audit logging

**Pass Criteria:**
- [ ] Repeated failure (3+) triggers learning
- [ ] Learning identifies failure pattern
- [ ] Technique with highest success rate recommended
- [ ] Harness code modification logged
- [ ] harness_modifications table updated
- [ ] Modification can be reverted

**Verification Script:** `scripts/verify-phase-15.sh`
```bash
#!/bin/bash
set -e
cd orchestrator

node -e "
const learning = require('./dist/learning').default;
const db = require('./dist/db').default;

// Simulate repeated failures
for (let i = 0; i < 3; i++) {
  await db.createFailure({
    taskId: 'test-task',
    errorPattern: 'TypeScript error: Cannot find module',
    technique: 'direct_fix'
  });
}

// Trigger learning
const result = await learning.analyze('test-task');

if (!result.recommendation) throw new Error('No recommendation');
if (!result.modificationProposed) throw new Error('No modification proposed');

// Check audit log
const mods = await db.getHarnessModifications();
console.log('Modifications:', mods.length);

console.log('✅ Phase 15 PASSED');
"
```

**Gate:** Learning triggers modification, script exits 0.

---

## Phase 16: Polish (Days 40-43)

**Goal:** Production ready.

**Tasks:**
1. Error boundary components
2. Loading/empty states
3. Log viewer modal
4. Task/session detail views
5. Filters and search
6. Docker optimization
7. Priority escalation
8. Acceptance criteria tracking
9. Documentation

**Pass Criteria:**
- [ ] No unhandled errors crash the dashboard
- [ ] All loading states implemented
- [ ] Log viewer shows full iteration content
- [ ] Search works for tasks and events
- [ ] Docker build succeeds
- [ ] P0 tasks preempt lower priority
- [ ] Pass criteria tracked per-criterion
- [ ] README.md complete with setup instructions

**Verification Script:** `scripts/verify-phase-16.sh`
```bash
#!/bin/bash
set -e

# Docker build
docker-compose build

# Start all services
docker-compose up -d
sleep 10

# Health check
curl -s http://localhost:3333/health | jq -e '.status == "ok"' || exit 1
curl -s http://localhost:3333 | grep -q "Dashboard" || exit 1

# Cleanup
docker-compose down

echo "✅ Phase 16 PASSED"
echo "🎉 ALL PHASES COMPLETE - HARNESS READY"
```

**Gate:** Docker builds and runs, all checks pass.

---

## Summary

| Phase | Focus | Days | Gate Script |
|-------|-------|------|-------------|
| 1 | Frontend Shell | 1-2 | verify-phase-01.sh |
| 2 | Data Model | 3-4 | verify-phase-02.sh |
| 3 | Backend API | 5-7 | verify-phase-03.sh |
| 4 | Frontend + API | 8-9 | verify-phase-04.sh |
| 5 | WebSocket | 10-11 | verify-phase-05.sh |
| 6 | Telegram Bot | 12-13 | verify-phase-06.sh |
| 7 | Orchestrator | 14-16 | verify-phase-07.sh |
| 8 | Clarification Agent | 17-18 | verify-phase-08.sh |
| 9 | Agent Spawner | 19-21 | verify-phase-09.sh |
| 10 | Agent Memory | 22-23 | verify-phase-10.sh |
| 11 | QA Validation | 24-26 | verify-phase-11.sh |
| 12 | Human Sim Agent | 27-30 | verify-phase-12.sh |
| 13 | Wave Execution | 31-33 | verify-phase-13.sh |
| 14 | Planning Agent | 34-36 | verify-phase-14.sh |
| 15 | Self-Improvement | 37-39 | verify-phase-15.sh |
| 16 | Polish | 40-43 | verify-phase-16.sh |

**Total:** 43 days

**Rule:** Phase N cannot start until `verify-phase-{N-1}.sh` exits 0.

---

## Agents

| Agent | Phase | Purpose |
|-------|-------|---------|
| Clarification Agent | 8 | Ask users clarifying questions |
| Human Sim Agent | 12 | Usability testing with 5 personas |
| Planning Agent | 14 | Strategic brain, creates improvement tasks |

**Total agents:** 13

## Key Design Decisions

| Decision | Answer | Impact |
|----------|--------|--------|
| Agent instances | Unlimited | Can spawn multiple Build Agents |
| Harness self-mod | Autonomous + logged | Agents can improve harness code |
| Agent disputes | SIA arbitrates → human | Clear resolution path |
| Human involvement | Only when stuck | Minimal interruptions |
| Database | Separate from Vibe | Independent operation |
| Retention | 2 weeks logs, 30 days memory | Manageable storage |
