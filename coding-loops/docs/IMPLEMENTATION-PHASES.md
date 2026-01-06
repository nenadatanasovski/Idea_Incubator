# Implementation Phases

**Version:** 1.0
**Total Sessions:** ~18
**See Also:** `TASKS.md` for detailed checklist

---

## Phase Overview

```
Phase 0: Foundation     [Session 1]     ████████░░ 80%
Phase 1: Database       [Session 2]     ░░░░░░░░░░ 0%
Phase 2: Message Bus    [Session 3]     ░░░░░░░░░░ 0%
Phase 3: Verification   [Session 4]     ░░░░░░░░░░ 0%
Phase 4: Git Manager    [Session 5]     ░░░░░░░░░░ 0%
Phase 5: Checkpoint     [Session 6]     ░░░░░░░░░░ 0%
Phase 6: Resources      [Session 7]     ░░░░░░░░░░ 0%
Phase 7: Knowledge      [Session 8]     ░░░░░░░░░░ 0%
Phase 8: Errors         [Session 9]     ░░░░░░░░░░ 0%
Phase 9: Detection      [Session 10]    ░░░░░░░░░░ 0%
Phase 10: Resilience    [Session 11]    ░░░░░░░░░░ 0%
Phase 11: Monitor       [Session 12]    ░░░░░░░░░░ 0%
Phase 12: PM Agent      [Session 13]    ░░░░░░░░░░ 0%
Phase 13: Human         [Session 14]    ░░░░░░░░░░ 0%
Phase 14: Integration   [Session 15]    ░░░░░░░░░░ 0%
Phase 15: E2E           [Session 16]    ░░░░░░░░░░ 0%
Phase 16: Polish        [Session 17-18] ░░░░░░░░░░ 0%
```

---

## Phase 0: Foundation Documents

**Goal:** Documentation, folder structure, configuration
**Sessions:** 1 (partial remaining)
**Status:** 80% complete

### Deliverables
- [x] TASKS.md - Master task list
- [x] ARCHITECTURE.md - System design
- [x] EVENT-CATALOG.md - Event definitions
- [x] OPERATOR-RUNBOOK.md - Operations guide
- [x] DECISIONS.md - User decisions
- [x] database/schema.sql - SQLite schema
- [x] architecture-rules.yaml
- [x] system-requirements.yaml
- [x] requirements.txt
- [x] Folder structure
- [x] Skeleton __init__.py files
- [ ] DATABASE-SCHEMA.md
- [ ] API-REFERENCE.md
- [ ] TEST-CATALOG.md
- [ ] README.md update

### Exit Criteria
- All docs have content (not just TODOs)
- All folders exist
- Schema can be applied to fresh database

---

## Phase 1: Database Layer

**Goal:** SQLite infrastructure
**Sessions:** 1
**Dependencies:** Phase 0

### Deliverables
- database/init_db.py - Database initialization
- database/queries.py - Common query functions
- database/models.py - Dataclasses for rows
- database/migrate_from_json.py - Migration script
- tests/test_database.py

### Exit Criteria
- `python -m pytest tests/test_database.py` passes
- Can migrate existing test-state.json files
- Schema validation works

---

## Phase 2: Message Bus

**Goal:** Event bus for inter-agent communication
**Sessions:** 1
**Dependencies:** Phase 1

### Deliverables
- shared/message_bus.py
- tests/test_message_bus.py
- BUS-001 through BUS-008 passing

### Exit Criteria
- Events can be published and polled
- File locking works
- Lock expiry works
- Concurrent access is safe

---

## Phase 3: Verification Gate

**Goal:** Independent verification of agent claims
**Sessions:** 1
**Dependencies:** Phase 1

### Deliverables
- shared/verification_gate.py
- tests/test_verification.py
- VER-001 through VER-007 passing

### Exit Criteria
- TypeScript check works
- Build check works
- Lint check works
- Regression check works
- False passes are blocked

---

## Phase 4: Git Manager

**Goal:** Branch-per-loop strategy
**Sessions:** 1
**Dependencies:** Phase 1

### Deliverables
- shared/git_manager.py
- tests/test_git_manager.py
- GIT-001 through GIT-006 passing

### Exit Criteria
- Each loop has dedicated branch
- Rebase from main works
- Conflict detection works

---

## Phase 5: Checkpoint Manager

**Goal:** Git-based checkpoints and rollback
**Sessions:** 1
**Dependencies:** Phase 4

### Deliverables
- shared/checkpoint_manager.py
- tests/test_checkpoint.py
- CHK-001 through CHK-006 passing

### Exit Criteria
- Checkpoints can be created
- Rollback restores state
- Checkpoints can be deleted

---

## Phase 6: Resource Management

**Goal:** Ownership, migrations, budget
**Sessions:** 1
**Dependencies:** Phase 2

### Deliverables
- shared/resource_registry.py
- shared/migration_allocator.py
- shared/budget_manager.py
- tests/test_resource_registry.py
- tests/test_migration.py
- tests/test_budget.py

### Exit Criteria
- Resource ownership is tracked
- Migration numbers are allocated correctly
- Usage is recorded

---

## Phase 7: Knowledge Base

**Goal:** Cross-agent context sharing
**Sessions:** 1
**Dependencies:** Phase 1

### Deliverables
- shared/knowledge_base.py
- tests/test_knowledge.py
- KB-001 through KB-006 passing

### Exit Criteria
- Facts can be recorded
- Decisions can be recorded
- Queries return relevant knowledge
- Knowledge can be injected into prompts

---

## Phase 8: Error Handling

**Goal:** Error classification and atomic operations
**Sessions:** 1
**Dependencies:** Phase 1

### Deliverables
- shared/error_classifier.py
- shared/atomic_operations.py
- tests/test_error.py
- tests/test_atomic.py

### Exit Criteria
- Errors are classified correctly
- Transaction log works
- Incomplete transactions can be replayed

---

## Phase 9: Detection Systems

**Goal:** Regression, deadlock, semantic analysis
**Sessions:** 1.5
**Dependencies:** Phase 2, Phase 4

### Deliverables
- shared/regression_monitor.py
- shared/deadlock_detector.py
- shared/semantic_analyzer.py
- tests/test_regression.py
- tests/test_deadlock.py
- tests/test_semantic.py

### Exit Criteria
- Regressions are detected with blame
- Deadlocks are detected and resolved
- Semantic conflicts are detected

---

## Phase 10: Resilience

**Goal:** Degradation and cleanup
**Sessions:** 1
**Dependencies:** Phase 2, Phase 5

### Deliverables
- shared/degradation_manager.py
- shared/orphan_cleaner.py
- shared/context_manager.py
- tests/test_degradation.py
- tests/test_orphan.py
- tests/test_context.py

### Exit Criteria
- Component failures are detected
- Loops switch to degraded mode
- Orphaned resources are cleaned up

---

## Phase 11: Monitor Agent

**Goal:** Health monitoring and alerting
**Sessions:** 1
**Dependencies:** Phase 2, Phase 9, Phase 10

### Deliverables
- agents/monitor_agent.py
- agents/watchdog_agent.py
- tests/test_monitor.py
- tests/test_watchdog.py
- MON-001 through MON-008 passing

### Exit Criteria
- Monitor detects stuck loops
- Monitor detects conflicts
- Monitor publishes alerts
- Watchdog monitors the monitor

---

## Phase 12: PM Agent

**Goal:** Coordination and conflict resolution
**Sessions:** 1
**Dependencies:** Phase 11

### Deliverables
- agents/pm_agent.py
- tests/test_pm.py
- PM-001 through PM-008 passing

### Exit Criteria
- PM receives conflicts
- PM resolves conflicts
- PM escalates to human
- PM applies human decisions

---

## Phase 13: Human Interface

**Goal:** CLI and Telegram notifications
**Sessions:** 1.5
**Dependencies:** Phase 12

### Deliverables
- shared/telegram_notifier.py
- agents/human_agent.py
- cli.py
- cli_commands/*.py
- tests/test_telegram.py
- tests/test_human.py
- HUM-001 through HUM-008 passing

### Exit Criteria
- CLI commands work
- Telegram notifications send
- Decisions can be made via CLI
- Summaries are generated

---

## Phase 14: Loop Integration

**Goal:** Update loops to use coordination system
**Sessions:** 1
**Dependencies:** Phase 13

### Deliverables
- Updated shared/ralph_loop_base.py
- Updated loop-*/run_loop.py
- tests/test_integration.py
- INT-001 through INT-007 passing

### Exit Criteria
- Loops publish events
- Loops use verification gate
- Loops use checkpoints
- Loops use knowledge base
- Loops respond to pause/resume

---

## Phase 15: End-to-End Testing

**Goal:** Full system validation
**Sessions:** 1
**Dependencies:** Phase 14

### Deliverables
- tests/test_e2e.py
- tests/test_acceptance.py
- E2E-001 through E2E-005 passing
- SAT-001 through SAT-010 passing

### Exit Criteria
- 3 loops run concurrently
- Conflicts are resolved
- Rollback works
- System runs for 1 hour without issues

---

## Phase 16: Polish

**Goal:** Documentation completion and final testing
**Sessions:** 1-2
**Dependencies:** Phase 15

### Deliverables
- Complete all documentation
- Code review
- Performance testing
- 24-hour stability test

### Exit Criteria
- All tests pass
- All docs complete
- System runs 24 hours without human intervention

---

## Incremental Bootstrap Strategy

The system builds itself incrementally:

```
Week 1: Build Message Bus + Verification Gate
        (Manual supervision, no coordination)
             │
             ▼
Week 2: Use Message Bus to build Monitor + PM
        (Basic event coordination)
             │
             ▼
Week 3-4: Use Monitor/PM to build remaining
          (Partial autonomous coordination)
             │
             ▼
Week 5-6: Full system builds actual product
          (Full autonomous operation)
```

---

## Risk Checkpoints

After each phase, verify:

1. All tests pass
2. No regressions in previous phases
3. Database integrity check passes
4. Can restart all components cleanly

If any checkpoint fails, fix before proceeding.

---

*See TASKS.md for detailed task checklist.*
