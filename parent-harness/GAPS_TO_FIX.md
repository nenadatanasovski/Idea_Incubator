# GAPS TO FIX - Progress Tracker

## FIXED ✅

### Core Infrastructure (Complete)
- ✅ OAuth spawner (uses OpenClaw sessions_spawn - no API keys needed)
- ✅ Multi-turn conversation support
- ✅ Agent CRUD (create, update, status transitions)
- ✅ Task CRUD (create, update, fail with retry_count)
- ✅ Session management
- ✅ Events logging
- ✅ Foreign key constraints
- ✅ Task flow: pending → pending_verification → completed/failed

### Orchestrator (Complete)
- ✅ Tick loop (30s interval, self-starting)
- ✅ Agent health monitoring (stuck detection at 15min)
- ✅ Task assignment to idle agents
- ✅ QA verification every 10th tick
- ✅ Self-improvement retry queue (every 5th tick)
- ✅ Manual tick API for cron (`POST /api/orchestrator/trigger`)

### External Triggers (Complete)
- ✅ Cron job (every 5 min) triggers orchestrator
- ✅ Status API (`GET /api/orchestrator/status`)
- ✅ Summary API (`GET /api/orchestrator/summary`) for Telegram

### E2E Tests (14/16 pass)
- ✅ Database layer tests
- ✅ Agent status transitions
- ✅ Task flow tests
- ✅ Retry tracking
- ✅ Event integrity
- ✅ Concurrent access
- ⚠️ Telegram (needs token)
- ⚠️ OpenClaw gateway (needs running)

---

## REMAINING TO FIX

### MEDIUM Priority

#### M1: Test System Seed Data
**Status:** Tables exist, no seed data
**Fix needed:** Create test_cases, test_steps for phase 1 tasks

#### M2: Clarification Agent
**Status:** DB entry + stub module
**Fix needed:** Implement question-asking flow for vague tasks

#### M3: Human Sim Agent  
**Status:** DB entry + stub module
**Fix needed:** Implement persona-based UI testing

#### M4: Agent Memory
**Status:** Tables exist, not used
**Fix needed:** Write/read agent memories across sessions

#### M5: Planning Agent Intelligence
**Status:** Only analyzes DB stats
**Fix needed:** Read codebase, create specific tasks with file paths

#### M6: Git Integration
**Status:** Not started
**Fix needed:** git add, commit, push workflow

#### M7: Budget/Rate Limiting
**Status:** Not started
**Fix needed:** Token tracking, daily caps

### LOW Priority

#### L1-L4: Polish items
- 404 route handling (done via middleware)
- Task version history
- Traceability service
- LaneGrid in Waves view

---

## Commit History
- `9a5612a` - feat(harness): Orchestrator API + cron trigger
- `19296f1` - fix(harness): OAuth spawner, schema fixes, E2E tests
- `c69669a` - fix(spawner): Use Anthropic SDK
- `dc68813` - feat(dashboard): Vibe Platform UI components

## Start Commands
```bash
# Backend only
cd parent-harness/orchestrator && npm run dev

# Dashboard (separate terminal)
cd parent-harness/dashboard && npm run dev

# Run tests
cd parent-harness/orchestrator && npm test
```

## Cron Jobs
- `76fafe0e-a9e1-4fb1-8e11-b9c679ee66e9`: Orchestrator tick (every 5 min)
- `d2f506d3-ad51-49ae-b81f-b4f2bc0cdee2`: Progress reporter (every 30 min)
