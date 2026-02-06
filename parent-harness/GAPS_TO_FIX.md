# GAPS TO FIX - Progress Tracker

## FIXED ✅

### C1-C3: Agent Spawning (Commit `6c0661e`)
- ✅ Added file read/write/list tools
- ✅ Added shell command execution
- ✅ Added task_complete/task_failed signal tools
- ✅ Implemented multi-turn conversation loop (20 iterations max)
- ✅ Tool calls executed and results returned to Claude
- ✅ Files modified tracked
- ✅ Tokens and tool calls counted

### H1-H2: QA Verification (Commit `b975373`)
- ✅ QA module verifies task completion claims
- ✅ Runs TypeScript, build, and test checks
- ✅ Creates fix tasks for failures
- ✅ Integrated into orchestrator (every 10th tick)
- ✅ Proper task flow: pending → pending_verification → completed/failed

---

## REMAINING TO FIX

### HIGH Priority

#### H3: Telegram Notifications for Tools/Files
**Status:** Partially done - events created but not sent to Telegram
**Fix needed:** Update telegram/index.ts to format and send tool:use and file:edit events

#### H4: Self-Healing Retry Loop
**Status:** Not started
**Fix needed:** When task fails, analyze error, create fix task, retry up to 5x

### MEDIUM Priority

#### M1: Test System Seed Data
**Status:** Suites exist, cases/steps/assertions missing
**Fix needed:** Create test_cases, test_steps for phase 1 tasks

#### M2: Clarification Agent
**Status:** DB entry only
**Fix needed:** Implement question-asking flow for vague tasks

#### M3: Human Sim Agent
**Status:** DB entry only
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
- 404 route handling
- Task version history
- Traceability service
- LaneGrid in Waves view

---

## Current Commit History
- `b975373` - feat(qa): QA verification system
- `6c0661e` - fix(spawner): Real tool execution loop
- `c69669a` - fix(spawner): Use Anthropic SDK
- `dc68813` - feat(dashboard): Vibe Platform UI components

## Test Commands
```bash
# Enable real agent spawning and QA
cd parent-harness/orchestrator
ANTHROPIC_API_KEY=<key> HARNESS_SPAWN_AGENTS=true HARNESS_RUN_QA=true npm run dev
```
