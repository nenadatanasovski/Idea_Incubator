# Task Agent Implementation Tasks

**Created:** 2026-01-12
**Purpose:** Atomic task breakdown for Task Agent implementation
**Status:** Ready for Execution

---

## Overview

This document contains all implementation tasks for the Task Agent, derived from:
- `task-agent-arch.md` - Architecture design
- `task-data-model.md` - Database schema
- `TASK-AGENT-QUESTIONS.md` - 31 design decisions
- `task-agent-test-plan.md` - 10 test flows

**Total Tasks:** 30
**Estimated Sessions:** 8-12

---

## Legend

- **Status**: `[ ]` pending, `[~]` in progress, `[x]` done
- **Priority**: `P1` critical path, `P2` important, `P3` enhancement

---

## Phase 1: Database & Types

> Foundation - must complete before any other phases

| ID | Task | Pri | Status | Notes |
|----|------|-----|--------|-------|
| TSK-001 | Create task_lists table migration | P1 | [ ] | See task-data-model.md |
| TSK-002 | Create tasks table migration | P1 | [ ] | See task-data-model.md |
| TSK-003 | Create task_list_items table migration | P1 | [ ] | Links tasks to lists |
| TSK-004 | Create task_relationships table migration | P1 | [ ] | 11 relationship types |
| TSK-005 | Create types/task-agent.ts | P1 | [ ] | TypeScript interfaces |
| TSK-006 | Run migrations, verify schema | P1 | [ ] | Test with sample data |

**Exit Criteria:**
- [ ] All 4 tables created in SQLite
- [ ] TypeScript types compile without errors
- [ ] Can INSERT/SELECT sample records

**Files to Create:**
```
database/migrations/033_task_agent.sql
types/task-agent.ts
```

---

## Phase 2: Spec Generation (Task Agent Phase 1)

> Triggered by `ideation.completed` - generates spec.md + tasks.md

| ID | Task | Pri | Status | Notes |
|----|------|-----|--------|-------|
| TSK-007 | Implement IdeationCompletedHandler | P1 | [ ] | Event listener |
| TSK-008 | Implement SpecExtractor | P1 | [ ] | Load idea context |
| TSK-009 | Implement TaskGenerator | P1 | [ ] | Claude → spec + tasks |
| TSK-010 | Implement GotchaInjector | P2 | [ ] | Query Knowledge Base |
| TSK-011 | Create API: POST /api/task-lists/generate | P1 | [ ] | Manual trigger |
| TSK-012 | Publish tasklist.generated event | P1 | [ ] | Notify UI |

**Exit Criteria:**
- [ ] Receives `ideation.completed` event
- [ ] Loads README.md, brief.md, development.md from idea folder
- [ ] Generates valid spec.md and tasks.md
- [ ] Injects relevant gotchas from Knowledge Base
- [ ] Creates task_list and tasks in database
- [ ] Publishes `tasklist.generated` event

**Files to Create:**
```
server/services/task-agent/
├── index.ts
├── ideation-completed-handler.ts
├── spec-extractor.ts
├── task-generator.ts
└── gotcha-injector.ts

server/routes/task-agent.ts
```

---

## Phase 3: Orchestration Core (Task Agent Phase 2)

> Always-on service - manages task execution flow

| ID | Task | Pri | Status | Notes |
|----|------|-----|--------|-------|
| TSK-013 | Implement SuggestionEngine | P1 | [ ] | What to do next |
| TSK-014 | Implement PriorityCalculator | P1 | [ ] | BlockedCount×20 + bonuses |
| TSK-015 | Implement DependencyResolver | P2 | [ ] | 11 relationship types |
| TSK-016 | Implement DuplicateDetector | P2 | [ ] | Similarity scoring |
| TSK-017 | Implement TaskListManager | P1 | [ ] | CRUD + status |
| TSK-018 | Create task list APIs | P1 | [ ] | REST endpoints |

**Exit Criteria:**
- [ ] SuggestionEngine returns prioritized next action
- [ ] Priority formula: `BlockedCount × 20 + QuickWinBonus(10) + DeadlineBonus(5-15)`
- [ ] Dependencies tracked and auto-unblocked on completion
- [ ] Duplicate detection with >0.8 similarity threshold
- [ ] Task lists can be created, updated, queried

**Files to Create:**
```
server/services/task-agent/
├── suggestion-engine.ts
├── priority-calculator.ts
├── dependency-resolver.ts
├── duplicate-detector.ts
└── task-list-manager.ts
```

**Priority Formula (from TASK-AGENT-QUESTIONS.md Q9):**
```
priority = (blockedCount × 20)      // How many tasks this unblocks
         + (isQuickWin ? 10 : 0)    // <30 min estimated
         + deadlineBonus            // 15 if ≤1 day, 10 if ≤3 days, 5 if ≤7 days
         + strategicBonus           // From SIA recommendations
```

---

## Phase 4: Telegram Integration

> User interaction via Telegram commands and buttons

| ID | Task | Pri | Status | Notes |
|----|------|-----|--------|-------|
| TSK-019 | Implement TelegramHandler | P1 | [ ] | Command handlers |
| TSK-020 | Implement suggestion notifications | P1 | [ ] | Proactive messages |
| TSK-021 | Implement question delivery | P1 | [ ] | Blocking questions |
| TSK-022 | Implement approval buttons | P1 | [ ] | Inline keyboards |

**Commands to Implement:**
```
/start      - Link chat to task list
/status     - Show current execution status
/lists      - Show active task lists
/suggest    - Get next suggested action
/execute    - Start execution of suggested list
/pause      - Pause current execution
/resume     - Resume paused execution
/questions  - Show pending questions
/help       - Show available commands
```

**Exit Criteria:**
- [ ] All commands respond correctly
- [ ] Suggestions sent proactively (5 min minimum interval)
- [ ] Questions block execution until answered
- [ ] Inline buttons work (Execute Now / Later / Details)

**Files to Create:**
```
server/services/task-agent/
├── telegram-handler.ts
└── telegram-commands/
    ├── start.ts
    ├── status.ts
    ├── suggest.ts
    ├── execute.ts
    └── help.ts
```

**Uses Existing Infrastructure:**
- `server/communication/telegram-sender.ts`
- `server/communication/telegram-receiver.ts`
- `server/communication/bot-registry.ts`

---

## Phase 5: Build Agent Coordination

> Dispatch approved task lists to Build Agent

| ID | Task | Pri | Status | Notes |
|----|------|-----|--------|-------|
| TSK-023 | Create approval API | P1 | [ ] | POST /api/task-lists/:id/approve |
| TSK-024 | Publish tasklist.ready event | P1 | [ ] | Build Agent trigger |
| TSK-025 | Implement Build Agent dispatch | P1 | [ ] | Start execution |
| TSK-026 | Implement execution tracking | P1 | [ ] | Status updates |

**Exit Criteria:**
- [ ] Approval API validates task list is ready
- [ ] `tasklist.ready` event published with task_list_id
- [ ] Build Agent receives and starts execution
- [ ] Task statuses update in real-time
- [ ] Completion/failure reported via Telegram

**Integration with Existing Code:**
- Leverages `server/services/task-executor.ts` (1001 lines)
- Uses existing Build Agent event subscriptions

---

## Phase 6: Testing (Human-in-the-Loop)

> Validate all flows per task-agent-test-plan.md

| ID | Task | Pri | Status | Notes |
|----|------|-----|--------|-------|
| TSK-027 | Test flow 1: Full cycle | P1 | [ ] | Create → Execute → Complete |
| TSK-028 | Test flow 2: Duplicate detection | P1 | [ ] | Detect → Merge decision |
| TSK-029 | Test flows 3-6 | P2 | [ ] | Dependencies, priorities |
| TSK-030 | Test flows 7-10 | P2 | [ ] | Edge cases, parallel |

**Test Flows (from task-agent-test-plan.md):**
1. Full cycle (create → validate → approve → execute → complete)
2. Duplicate detection → merge decision
3. Dependency chain → automatic unblocking
4. Priority calculation verification
5. Build failure → retry/skip/escalate
6. Stale task detection → notification
7. Parallel task lists
8. Telegram command edge cases
9. Question timeout handling
10. Integration with SIA (learning)

**Exit Criteria:**
- [ ] All 10 test flows pass
- [ ] Telegram interactions work as documented
- [ ] No critical bugs in core flows

---

## Dependency Graph

```
Phase 1 (Database)
    │
    ▼
Phase 2 (Spec Generation) ──────────┐
    │                               │
    ▼                               │
Phase 3 (Orchestration) ◄───────────┤
    │                               │
    ▼                               │
Phase 4 (Telegram) ◄────────────────┤
    │                               │
    ▼                               │
Phase 5 (Build Coordination) ◄──────┘
    │
    ▼
Phase 6 (Testing)
```

---

## Summary

| Phase | Tasks | P1 | P2 | Status |
|-------|-------|----|----|--------|
| 1. Database & Types | 6 | 6 | 0 | [ ] Not started |
| 2. Spec Generation | 6 | 5 | 1 | [ ] Not started |
| 3. Orchestration Core | 6 | 4 | 2 | [ ] Not started |
| 4. Telegram Integration | 4 | 4 | 0 | [ ] Not started |
| 5. Build Coordination | 4 | 4 | 0 | [ ] Not started |
| 6. Testing | 4 | 2 | 2 | [ ] Not started |
| **Total** | **30** | **25** | **5** | |

---

## Quick Reference

**Location:** `server/services/task-agent/`

**Events:**
- Subscribes: `ideation.completed`, `task.completed`, `task.failed`, `build.completed`
- Publishes: `tasklist.generated`, `tasklist.ready`, `task.started`

**APIs:**
- `POST /api/task-lists/generate` - Generate from ideation
- `GET /api/task-lists` - List all
- `GET /api/task-lists/:id` - Get details
- `POST /api/task-lists/:id/approve` - Approve for execution
- `GET /api/tasks` - Query tasks
- `GET /api/tasks/:id` - Task details

**Telegram Bot:** Uses existing `@vibeai_spec_bot` or dedicated Task Agent bot

---

## Related Documents

- [task-agent-arch.md](./task-agent-arch.md) - Full architecture
- [task-data-model.md](./task-data-model.md) - Database schema
- [TASK-AGENT-QUESTIONS.md](./TASK-AGENT-QUESTIONS.md) - Design decisions
- [task-agent-test-plan.md](./task-agent-test-plan.md) - Test scenarios
- [TASK-AGENT-REVIEW.md](./TASK-AGENT-REVIEW.md) - Critical review

