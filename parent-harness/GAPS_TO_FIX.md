# GAPS TO FIX - Comprehensive List

Everything I failed to implement properly from the plan.

---

## CRITICAL: Agent Spawning Is Broken

### Gap C1: No Tools for Agents
**Plan says:** Agents should be able to read/write files, run commands
**Reality:** Spawner does single API call with no tools - agents can't actually DO anything

**Fix:** Add tool use to spawner with:
- File read/write tools
- Shell execution
- Browser automation (for UI tasks)

### Gap C2: No Multi-Turn Conversation
**Plan says:** Agents work in loops, can ask questions, iterate
**Reality:** Single API call, response discarded

**Fix:** Implement conversation loop with tool execution

### Gap C3: Agent Output Not Applied
**Plan says:** Agent edits files, commits code
**Reality:** Agent response is just logged to DB, nothing happens to codebase

**Fix:** Parse agent tool calls, execute them, apply changes

---

## HIGH: Missing Core Features

### Gap H1: QA Verification Not Implemented
**Plan says:** "QA Agent verifies every 10th tick, runs tests independently"
**Reality:** QA agent exists in DB but never runs, doesn't verify anything

**Fix:** Implement QA agent that:
- Runs actual npm test/build commands
- Verifies Build Agent claims
- Creates fix tasks for failures

### Gap H2: Task Completion Flow Wrong
**Plan says:** "Agent claims → pending_verification → QA verifies → completed"
**Reality:** Tasks go straight to 'completed' without verification

**Fix:** Implement proper state machine:
- pending → in_progress → pending_verification → completed/needs_revision

### Gap H3: Telegram Notifications Missing
**Plan says:** "Every tool use, file edit → post to Telegram"
**Reality:** Basic events posted, no tool/file granularity

**Fix:** Add tool-use and file-edit event types, post to Telegram

### Gap H4: Self-Healing Loop Not Implemented
**Plan says:** "Test fails → Agent analyzes → Fixes → Retry (up to 5x)"
**Reality:** Failures just logged, no retry/fix loop

**Fix:** Implement retry logic with analysis

---

## MEDIUM: Incomplete Features

### Gap M1: Test System Incomplete
**Seeded:** 16 test_suites
**Missing:** test_cases, test_steps, test_assertions for phases

### Gap M2: Clarification Agent Not Implemented
**Plan says:** Vague tasks get clarifying questions before execution
**Reality:** Just a DB entry, no implementation

### Gap M3: Human Sim Agent Not Implemented
**Plan says:** Multiple personas test UI after build
**Reality:** Just a DB entry, no implementation

### Gap M4: Agent Memory Not Used
**Plan says:** Agents learn from past failures
**Reality:** agent_memory table exists, never written to or read from

### Gap M5: Planning Agent Doesn't Read Codebase
**Plan says:** Planning analyzes codebase, creates specific tasks
**Reality:** Just analyzes DB stats, creates generic tasks

### Gap M6: No Git Integration
**Plan says:** Commits, branches, merge handling
**Reality:** No git operations at all

### Gap M7: No Budget/Rate Limiting
**Plan says:** Daily caps, per-agent limits
**Reality:** Nothing implemented

---

## LOW: Missing Polish

### Gap L1: No 404 Route Handling
Task 1.7 incomplete

### Gap L2: No Task Version History
**Plan mentions:** task_versions table, rollback support
**Reality:** Not implemented

### Gap L3: No Traceability Service
**Plan mentions:** PRD → Spec → Task → Code linking
**Reality:** Not implemented

### Gap L4: Missing Wave-Based Visualization in Waves Mode
Dashboard has Cards/Waves toggle but Waves mode doesn't show LaneGrid properly

---

## FIX ORDER

1. **C1-C3:** Fix spawner to actually work (tools + execution)
2. **H1-H2:** QA verification and proper task flow
3. **H3:** Telegram notifications for tools/files
4. **H4:** Self-healing retry loop
5. **M1-M7:** Remaining features
6. **L1-L4:** Polish

---

## Current Status vs Plan

| Phase | Plan | Implemented |
|-------|------|-------------|
| 1 Frontend | 8 tasks | ✅ Done |
| 2 Data Model | 6 tasks | ⚠️ Missing test seeding |
| 3 Backend API | 7 tasks | ✅ Done |
| 4 Frontend+API | 7 tasks | ✅ Done |
| 5 WebSocket | 7 tasks | ✅ Done |
| 6 Telegram | 7 tasks | ⚠️ Basic only |
| 7 Orchestrator | 8 tasks | ⚠️ No real spawning |
| 8 Clarification | 6 tasks | ❌ Not started |
| 9 Spawner | 7 tasks | ⚠️ Broken |
| 10 Memory | 5 tasks | ❌ Not started |
| 11 QA Validation | 6 tasks | ❌ Not started |
| 12 Human Sim | 6 tasks | ❌ Not started |
| 13 Wave Execution | 6 tasks | ⚠️ UI only |
| 14 Planning | 6 tasks | ⚠️ Basic only |
| 15 Self-Improvement | 5 tasks | ❌ Not started |
| 16 Polish | 9 tasks | ⚠️ Partial |

**Honest assessment:** ~40% actually working, 60% is theater
