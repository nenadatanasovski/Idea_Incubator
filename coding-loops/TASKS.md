# Multi-Agent Coordination System - Task Breakdown

**Created:** 2026-01-07
**Purpose:** Master task list for multi-session implementation
**Status:** Active - Use this to track progress across Claude Code sessions

---

## How to Use This File

1. Each Claude Code session should start by reading this file
2. Find the next `[ ]` (unchecked) task in the current phase
3. Complete tasks in order (they have dependencies)
4. Mark completed tasks with `[x]`
5. If a session runs out of context, note where you stopped in the "Session Log" section

---

## User Decisions (Reference)

| Question | Decision |
|----------|----------|
| Deployment | Single Machine |
| Human Model | Solo + Telegram notifications when away |
| Budget | Unlimited (Claude Code Max) |
| Shared Resources | Strict Ownership with escape hatch |
| Bootstrap | Incremental (D) |
| State | Database Only (eliminate test-state.json) |
| Gap Priority | All gaps in roadmap, prioritized |
| Loop Interaction | Tight-knit team with coordination agents |

---

## File Size Guidelines

**Target: <500 lines per file, <25k tokens total**

If a file exceeds 500 lines:
1. Split into logical submodules
2. Create an `__init__.py` that re-exports public API
3. Keep related functionality together

---

## Session Log

*Record session boundaries here for continuity*

| Session | Date | Tasks Completed | Notes |
|---------|------|-----------------|-------|
| 1 | 2026-01-07 | Phase 0 COMPLETE | All docs, folders, schemas, configuration created |
| 2 | 2026-01-07 | Phase 1 COMPLETE | Database layer: init_db.py, models.py, queries.py, migrate_from_json.py, 41 tests passing |
| 2 | 2026-01-07 | Phase 2 COMPLETE | Message Bus: message_bus.py with pub/sub, locking, wait graph, 36 tests passing |

---

## Phase 0: Foundation Documents (Session 1)

**Goal:** Create all documentation and folder structure

### Documentation
- [x] Create `coding-loops/TASKS.md` (this file)
- [x] Create `coding-loops/docs/` directory structure
- [x] Create `coding-loops/docs/ARCHITECTURE.md` (~300 lines)
- [x] Create `coding-loops/docs/DATABASE-SCHEMA.md` (~200 lines)
- [x] Create `coding-loops/docs/EVENT-CATALOG.md` (~250 lines)
- [x] Create `coding-loops/docs/API-REFERENCE.md` (~400 lines)
- [x] Create `coding-loops/docs/TEST-CATALOG.md` (~500 lines)
- [x] Create `coding-loops/docs/OPERATOR-RUNBOOK.md` (~300 lines)
- [x] Create `coding-loops/docs/IMPLEMENTATION-PHASES.md` (~200 lines)
- [x] Create `coding-loops/docs/DECISIONS.md` (user decisions)

### Configuration
- [x] Create `coding-loops/architecture-rules.yaml`
- [x] Create `coding-loops/system-requirements.yaml`
- [x] Create `coding-loops/requirements.txt`
- [x] Update `coding-loops/README.md` to reference new structure

### Folder Structure
- [x] Create `coding-loops/agents/` directory
- [x] Create `coding-loops/database/` directory
- [x] Create `coding-loops/database/migrations/` directory
- [x] Create `coding-loops/cli_commands/` directory
- [x] Create `coding-loops/tests/` directory

### Skeleton Files (interfaces only, no implementation)
- [x] Create `coding-loops/shared/__init__.py` (update exports)
- [x] Create `coding-loops/agents/__init__.py`
- [x] Create `coding-loops/database/__init__.py`
- [x] Create `coding-loops/cli_commands/__init__.py`
- [x] Create `coding-loops/tests/__init__.py`
- [x] Create `coding-loops/tests/conftest.py` (pytest fixtures)
- [x] Create `coding-loops/database/schema.sql` (complete schema)

**Exit Criteria:** All folders exist, all doc files have headers and TODOs

---

## Phase 1: Database Layer (Session 2) ✓ COMPLETE

**Goal:** SQLite schema and query layer

### Schema
- [x] Create `coding-loops/database/schema.sql` (complete schema)
- [x] Create `coding-loops/database/init_db.py` (database initialization)
- [x] Create `coding-loops/database/queries.py` (common queries as functions)
- [x] Create `coding-loops/database/models.py` (dataclasses for rows)

### Migration from test-state.json
- [x] Create `coding-loops/database/migrate_from_json.py`
- [x] Test migration with existing test-state.json files

### Tests
- [x] Create `coding-loops/tests/test_database.py`
- [x] Verify schema creation
- [x] Verify query functions
- [x] Verify migration

**Exit Criteria:** `python -m pytest coding-loops/tests/test_database.py` passes ✓ (41 tests)

---

## Phase 2: Message Bus (Session 3) ✓ COMPLETE

**Goal:** Event bus for inter-agent communication

### Core Implementation
- [x] Create `coding-loops/shared/message_bus.py`
  - [x] `MessageBus.__init__` - Initialize with DB path
  - [x] `MessageBus.publish` - Publish event
  - [x] `MessageBus.subscribe` - Subscribe to event types
  - [x] `MessageBus.poll` - Poll for unacknowledged events
  - [x] `MessageBus.acknowledge` - Mark event acknowledged
  - [x] `MessageBus.get_timeline` - Query event history
  - [x] `MessageBus.lock_file` - Acquire file lock
  - [x] `MessageBus.unlock_file` - Release file lock
  - [x] `MessageBus.check_lock` - Check lock status
  - [x] `MessageBus.release_expired_locks` - Cleanup expired
  - [x] `MessageBus.release_all_locks` - Release by owner

### Tests
- [x] Create `coding-loops/tests/test_message_bus.py`
  - [x] BUS-001: Publish event
  - [x] BUS-002: Subscribe to events
  - [x] BUS-003: Acknowledge event
  - [x] BUS-004: Timeline query
  - [x] BUS-005: File locking
  - [x] BUS-006: Lock expiry
  - [x] BUS-007: Concurrent access
  - [x] BUS-008: Integration test

**Exit Criteria:** All BUS-* tests pass ✓ (36 tests)

---

## Phase 3: Verification Gate (Session 4)

**Goal:** Independent verification of agent claims

### Core Implementation
- [ ] Create `coding-loops/shared/verification_gate.py`
  - [ ] `VerificationResult` dataclass
  - [ ] `VerificationGate.__init__`
  - [ ] `VerificationGate.verify_test_passed`
  - [ ] `VerificationGate._run_tsc`
  - [ ] `VerificationGate._run_tests`
  - [ ] `VerificationGate._run_build`
  - [ ] `VerificationGate._run_lint`
  - [ ] `VerificationGate._check_regressions`

### Tests
- [ ] Create `coding-loops/tests/test_verification.py`
  - [ ] VER-001: TypeScript check
  - [ ] VER-002: Test execution
  - [ ] VER-003: Build check
  - [ ] VER-004: Lint check
  - [ ] VER-005: Regression check
  - [ ] VER-006: Blocks false pass
  - [ ] VER-007: Confirms true pass

**Exit Criteria:** All VER-* tests pass

---

## Phase 4: Git Manager (Session 5)

**Goal:** Branch-per-loop strategy

### Core Implementation
- [ ] Create `coding-loops/shared/git_manager.py`
  - [ ] `GitManager.__init__`
  - [ ] `GitManager.ensure_branch`
  - [ ] `GitManager.get_branch`
  - [ ] `GitManager.checkout_branch`
  - [ ] `GitManager.rebase_from_main`
  - [ ] `GitManager.detect_conflicts`
  - [ ] `GitManager.create_pr` (if using GitHub)
  - [ ] `GitManager.commit_changes`

### Tests
- [ ] Create `coding-loops/tests/test_git_manager.py`
  - [ ] GIT-001: Branch creation
  - [ ] GIT-002: Rebase from main
  - [ ] GIT-003: Conflict detection
  - [ ] GIT-004: PR creation
  - [ ] GIT-005: PR blocks on review
  - [ ] GIT-006: Main stays clean

**Exit Criteria:** All GIT-* tests pass

---

## Phase 5: Checkpoint Manager (Session 6)

**Goal:** Git-based checkpoints and rollback

### Core Implementation
- [ ] Create `coding-loops/shared/checkpoint_manager.py`
  - [ ] `CheckpointManager.__init__`
  - [ ] `CheckpointManager.create_checkpoint`
  - [ ] `CheckpointManager.rollback`
  - [ ] `CheckpointManager.rollback_if_exists`
  - [ ] `CheckpointManager.delete_checkpoint`
  - [ ] `CheckpointManager.list_checkpoints`

### Tests
- [ ] Create `coding-loops/tests/test_checkpoint.py`
  - [ ] CHK-001: Create checkpoint
  - [ ] CHK-002: Rollback
  - [ ] CHK-003: Delete checkpoint
  - [ ] CHK-004: List checkpoints
  - [ ] CHK-005: Integration
  - [ ] CHK-006: Auto-rollback

**Exit Criteria:** All CHK-* tests pass

---

## Phase 6: Resource Management (Session 7)

**Goal:** Shared resource ownership and migration ordering

### Resource Registry
- [ ] Create `coding-loops/shared/resource_registry.py`
  - [ ] `ResourceRegistry.__init__`
  - [ ] `ResourceRegistry.register_owner`
  - [ ] `ResourceRegistry.get_owner`
  - [ ] `ResourceRegistry.request_change`
  - [ ] `ResourceRegistry.approve_change`
  - [ ] `ResourceRegistry.list_resources`

### Migration Allocator
- [ ] Create `coding-loops/shared/migration_allocator.py`
  - [ ] `MigrationAllocator.__init__`
  - [ ] `MigrationAllocator.allocate_number`
  - [ ] `MigrationAllocator.register_migration`
  - [ ] `MigrationAllocator.get_pending`
  - [ ] `MigrationAllocator.mark_applied`

### Budget Manager (for reporting even if unlimited)
- [ ] Create `coding-loops/shared/budget_manager.py`
  - [ ] `BudgetManager.__init__`
  - [ ] `BudgetManager.record_usage`
  - [ ] `BudgetManager.get_report`
  - [ ] `BudgetManager.check_budget` (always returns OK)

### Tests
- [ ] Create `coding-loops/tests/test_resource_registry.py`
- [ ] Create `coding-loops/tests/test_migration.py`
- [ ] Create `coding-loops/tests/test_budget.py`
  - [ ] BUD-001 through BUD-005

**Exit Criteria:** All resource management tests pass

---

## Phase 7: Knowledge Base (Session 8)

**Goal:** Cross-agent context sharing

### Core Implementation
- [ ] Create `coding-loops/shared/knowledge_base.py`
  - [ ] `KnowledgeItem` dataclass
  - [ ] `KnowledgeBase.__init__`
  - [ ] `KnowledgeBase.record_fact`
  - [ ] `KnowledgeBase.record_decision`
  - [ ] `KnowledgeBase.record_pattern`
  - [ ] `KnowledgeBase.query`
  - [ ] `KnowledgeBase.get_context_for_test`
  - [ ] `KnowledgeBase.supersede`

### Tests
- [ ] Create `coding-loops/tests/test_knowledge.py`
  - [ ] KB-001: Record fact
  - [ ] KB-002: Record decision
  - [ ] KB-003: Query by topic
  - [ ] KB-004: Context injection
  - [ ] KB-005: Consistency
  - [ ] KB-006: Conflict detection

**Exit Criteria:** All KB-* tests pass

---

## Phase 8: Error Handling (Session 9)

**Goal:** Error classification and atomic operations

### Error Classifier
- [ ] Create `coding-loops/shared/error_classifier.py`
  - [ ] `ErrorCategory` enum
  - [ ] `ErrorHandling` dataclass
  - [ ] `ErrorClassifier.classify`
  - [ ] `ErrorClassifier.get_handling`

### Atomic Operations
- [ ] Create `coding-loops/shared/atomic_operations.py`
  - [ ] `TransactionLog.__init__`
  - [ ] `TransactionLog.begin`
  - [ ] `TransactionLog.record_step`
  - [ ] `TransactionLog.commit`
  - [ ] `TransactionLog.rollback`
  - [ ] `TransactionLog.replay_incomplete`

### Tests
- [ ] Create `coding-loops/tests/test_error.py`
  - [ ] ERR-001 through ERR-006
- [ ] Create `coding-loops/tests/test_atomic.py`

**Exit Criteria:** All error handling tests pass

---

## Phase 9: Detection Systems (Session 10)

**Goal:** Regression, deadlock, and semantic analysis

### Regression Monitor
- [ ] Create `coding-loops/shared/regression_monitor.py`
  - [ ] `Regression` dataclass
  - [ ] `BlameResult` dataclass
  - [ ] `RegressionMonitor.__init__`
  - [ ] `RegressionMonitor.record_passing`
  - [ ] `RegressionMonitor.check_regressions`
  - [ ] `RegressionMonitor.get_blame`

### Deadlock Detector
- [ ] Create `coding-loops/shared/deadlock_detector.py`
  - [ ] `DeadlockDetector.__init__`
  - [ ] `DeadlockDetector.record_wait`
  - [ ] `DeadlockDetector._has_cycle`
  - [ ] `DeadlockDetector._choose_victim`
  - [ ] `DeadlockDetector._resolve_deadlock`

### Semantic Analyzer
- [ ] Create `coding-loops/shared/semantic_analyzer.py`
  - [ ] `SemanticReport` dataclass
  - [ ] `SemanticConflict` dataclass
  - [ ] `SemanticAnalyzer.analyze_changes`
  - [ ] `SemanticAnalyzer.detect_conflicts`
  - [ ] `SemanticAnalyzer.check_architecture_compliance`

### Tests
- [ ] Create `coding-loops/tests/test_regression.py`
  - [ ] REG-001 through REG-006
- [ ] Create `coding-loops/tests/test_deadlock.py`
  - [ ] DLK-001 through DLK-005
- [ ] Create `coding-loops/tests/test_semantic.py`
  - [ ] SEM-001 through SEM-005

**Exit Criteria:** All detection system tests pass

---

## Phase 10: Resilience (Session 11)

**Goal:** Degradation and cleanup

### Degradation Manager
- [ ] Create `coding-loops/shared/degradation_manager.py`
  - [ ] `DegradedMode` dataclass
  - [ ] `DegradationManager.__init__`
  - [ ] `DegradationManager.heartbeat`
  - [ ] `DegradationManager.check_components`
  - [ ] `DegradationManager.get_degraded_behavior`

### Orphan Cleaner
- [ ] Create `coding-loops/shared/orphan_cleaner.py`
  - [ ] `CleanupResult` dataclass
  - [ ] `OrphanCleaner.__init__`
  - [ ] `OrphanCleaner.cleanup_expired_locks`
  - [ ] `OrphanCleaner.cleanup_stale_checkpoints`
  - [ ] `OrphanCleaner.detect_partial_writes`
  - [ ] `OrphanCleaner.cleanup_dead_loop`

### Context Manager
- [ ] Create `coding-loops/shared/context_manager.py`
  - [ ] `ContextBudget` dataclass
  - [ ] `ContextManager.__init__`
  - [ ] `ContextManager.estimate_tokens`
  - [ ] `ContextManager.prioritize_context`
  - [ ] `ContextManager.build_context`

### Tests
- [ ] Create `coding-loops/tests/test_degradation.py`
  - [ ] DEG-001 through DEG-005
- [ ] Create `coding-loops/tests/test_orphan.py`
  - [ ] ORP-001 through ORP-005
- [ ] Create `coding-loops/tests/test_context.py`

**Exit Criteria:** All resilience tests pass

---

## Phase 11: Monitor Agent (Session 12)

**Goal:** Health monitoring and alerting

### Core Implementation
- [ ] Create `coding-loops/agents/monitor_agent.py`
  - [ ] `MonitorAgent.__init__`
  - [ ] `MonitorAgent.run` (main loop)
  - [ ] `MonitorAgent._check_health`
  - [ ] `MonitorAgent._check_progress`
  - [ ] `MonitorAgent._check_conflicts`
  - [ ] `MonitorAgent._check_digressions`
  - [ ] `MonitorAgent._check_regressions`
  - [ ] `MonitorAgent._publish_alert`

### Watchdog
- [ ] Create `coding-loops/agents/watchdog_agent.py`
  - [ ] `WatchdogAgent.__init__`
  - [ ] `WatchdogAgent.run`
  - [ ] `WatchdogAgent._check_monitor`
  - [ ] `WatchdogAgent._restart_monitor`

### Tests
- [ ] Create `coding-loops/tests/test_monitor.py`
  - [ ] MON-001 through MON-008
- [ ] Create `coding-loops/tests/test_watchdog.py`

**Exit Criteria:** All monitor tests pass

---

## Phase 12: PM Agent (Session 13)

**Goal:** Coordination and conflict resolution

### Core Implementation
- [ ] Create `coding-loops/agents/pm_agent.py`
  - [ ] `PMAgent.__init__`
  - [ ] `PMAgent.run` (main loop)
  - [ ] `PMAgent._handle_conflict`
  - [ ] `PMAgent._resolve_conflict`
  - [ ] `PMAgent._track_dependencies`
  - [ ] `PMAgent._escalate_decision`
  - [ ] `PMAgent._apply_decision`
  - [ ] `PMAgent._redistribute_work`

### Tests
- [ ] Create `coding-loops/tests/test_pm.py`
  - [ ] PM-001 through PM-008

**Exit Criteria:** All PM tests pass

---

## Phase 13: Human Interface (Session 14)

**Goal:** CLI and Telegram notifications

### Telegram Notifier
- [ ] Create `coding-loops/shared/telegram_notifier.py`
  - [ ] `TelegramNotifier.__init__`
  - [ ] `TelegramNotifier.send_alert`
  - [ ] `TelegramNotifier.send_decision_request`
  - [ ] `TelegramNotifier.poll_responses`
  - [ ] `TelegramNotifier.format_status`

### Human Agent
- [ ] Create `coding-loops/agents/human_agent.py`
  - [ ] `HumanAgent.__init__`
  - [ ] `HumanAgent.run`
  - [ ] `HumanAgent._format_decision`
  - [ ] `HumanAgent._wait_for_response`
  - [ ] `HumanAgent._generate_summary`

### CLI Core
- [ ] Create `coding-loops/cli.py` (entry point)

### CLI Commands
- [ ] Create `coding-loops/cli_commands/status.py`
  - [ ] `status` command
  - [ ] `health` command
  - [ ] `timeline` command
- [ ] Create `coding-loops/cli_commands/control.py`
  - [ ] `pause` command
  - [ ] `resume` command
  - [ ] `skip` command
  - [ ] `reset` command
  - [ ] `rollback` command
  - [ ] `restart` command
- [ ] Create `coding-loops/cli_commands/locks.py`
  - [ ] `locks` command
  - [ ] `force-unlock` command
  - [ ] `deadlocks` command
- [ ] Create `coding-loops/cli_commands/decisions.py`
  - [ ] `decisions` command
  - [ ] `decide` command
- [ ] Create `coding-loops/cli_commands/analysis.py`
  - [ ] `summary` command
  - [ ] `conflicts` command
  - [ ] `stuck` command
  - [ ] `regressions` command
  - [ ] `dump-state` command

### Tests
- [ ] Create `coding-loops/tests/test_telegram.py`
- [ ] Create `coding-loops/tests/test_human.py`
  - [ ] HUM-001 through HUM-008

**Exit Criteria:** All human interface tests pass

---

## Phase 14: Loop Integration (Session 15)

**Goal:** Update existing loops to use coordination system

### Ralph Loop Base Updates
- [ ] Update `coding-loops/shared/ralph_loop_base.py`
  - [ ] Add MessageBus integration
  - [ ] Add VerificationGate integration
  - [ ] Add GitManager integration
  - [ ] Add CheckpointManager integration
  - [ ] Add KnowledgeBase integration
  - [ ] Add ResourceRegistry integration
  - [ ] Add pause/resume handling
  - [ ] Add event publishing
  - [ ] Remove test-state.json dependency

### Loop Runner Updates
- [ ] Update `loop-1-critical-path/run_loop.py`
- [ ] Update `loop-2-infrastructure/run_loop.py`
- [ ] Update `loop-3-polish/run_loop.py`

### Tests
- [ ] Create `coding-loops/tests/test_integration.py`
  - [ ] INT-001 through INT-007

**Exit Criteria:** All loops run with coordination system

---

## Phase 15: End-to-End Testing (Session 16)

**Goal:** Full system validation

### E2E Scenarios
- [ ] Create `coding-loops/tests/test_e2e.py`
  - [ ] E2E-001: Basic concurrent operation
  - [ ] E2E-002: Conflict resolution
  - [ ] E2E-003: Stuck loop recovery
  - [ ] E2E-004: Rollback on break
  - [ ] E2E-005: Extended operation (1 hour)

### Acceptance Tests
- [ ] Create `coding-loops/tests/test_acceptance.py`
  - [ ] SAT-001: 3 loops, 1 hour
  - [ ] SAT-002: Conflict injection
  - [ ] SAT-003: Loop death recovery
  - [ ] SAT-004: Monitor death recovery
  - [ ] SAT-005: PM death recovery
  - [ ] SAT-006: Extended run (when ready for 24h)
  - [ ] SAT-007: Rollback effectiveness
  - [ ] SAT-008: Human decision flow
  - [ ] SAT-009: Budget enforcement (reports only)
  - [ ] SAT-010: Zero data loss

**Exit Criteria:** All E2E and SAT tests pass

---

## Phase 16: Documentation & Polish (Session 17)

**Goal:** Complete documentation and final polish

### Documentation Completion
- [ ] Complete `docs/ARCHITECTURE.md`
- [ ] Complete `docs/OPERATOR-RUNBOOK.md`
- [ ] Complete `docs/API-REFERENCE.md`
- [ ] Update `README.md` with final instructions

### Final Polish
- [ ] Code review all files for consistency
- [ ] Add docstrings where missing
- [ ] Verify all TODOs resolved
- [ ] Run full test suite
- [ ] Performance testing

**Exit Criteria:** System ready for production use

---

## Deferred to V2

These gaps are documented but deferred:

- [ ] Priority inversion (Gap 21) - add priority inheritance
- [ ] Starvation prevention (Gap 22) - add starvation detection
- [ ] Learning from failures (Gap 27) - add pattern learning
- [ ] Message ordering (Gap 29) - add Lamport timestamps

---

## Circular Dependencies Strategy

### Session Infrastructure
- **Owner:** Loop 1 (Critical Path)
- **Interface:** `types/session.ts` - Loop 1 defines base session interface
- **Extension:** Loop 2 adds auth-specific fields via `types/auth-session.ts`
- **Resolution:** Loop 2 depends on CP-SPEC-003 (session table exists)

### Database Access
- **Owner:** Loop 1 (Critical Path)
- **Pattern:** All schema changes through Loop 1
- **Other Loops:** Request schema changes via `change_request` event
- **Resolution:** Migration allocator ensures ordered migrations

### API Middleware
- **Owner:** Loop 2 (Infrastructure - auth)
- **Pattern:** Auth middleware defined by Loop 2
- **Other Loops:** Use middleware, don't modify
- **Resolution:** Loop 1 waits for INF-AUTH-001 before using protected routes

### Core Types
- **Owner:** First creator
- **Registry:** Knowledge Base tracks type ownership
- **Pattern:** `types/{domain}.ts` (e.g., `types/ideation.ts`, `types/auth.ts`)
- **Resolution:** ResourceRegistry enforces ownership

---

## Hot Files Mitigation

### server/api.ts
**Problem:** All loops add routes
**Solution:** Split into:
- `server/routes/ideation.ts` (Loop 1)
- `server/routes/auth.ts` (Loop 2)
- `server/routes/credits.ts` (Loop 2)
- `server/routes/hosting.ts` (Loop 2)
- `server/api.ts` imports and mounts all

### types/index.ts
**Problem:** All loops add types
**Solution:** Split into:
- `types/ideation.ts` (Loop 1)
- `types/specification.ts` (Loop 1)
- `types/build.ts` (Loop 1)
- `types/auth.ts` (Loop 2)
- `types/credits.ts` (Loop 2)
- `types/index.ts` re-exports all

### package.json
**Problem:** All loops add dependencies
**Solution:**
- Owner: Loop 1
- Others: Publish `dependency_request` event
- PM Agent batches and applies

### database/migrations/
**Problem:** Ordering conflicts
**Solution:** Migration allocator assigns numbers centrally

### utils/
**Problem:** Shared utilities
**Solution:**
- Owner: First creator (tracked in ResourceRegistry)
- Others: Request changes or create new utils

---

## Test Infrastructure

### Shared Test Resources (Owner: Loop 3)
```
tests/
├── fixtures/
│   ├── sample-idea.json
│   ├── sample-user.json
│   └── sample-session.json
├── helpers/
│   ├── db.py          # Test database setup/teardown
│   ├── mock_claude.py # Mock Claude responses
│   └── assertions.py  # Custom assertions
└── mocks/
    ├── message_bus.py
    └── verification.py
```

### Per-Loop Test Pattern
```
loop-N/
└── tests/
    ├── unit/           # Fast, no deps
    ├── integration/    # With DB
    └── e2e/            # Full stack
```

---

## Estimated Session Counts

| Phase | Sessions | Cumulative |
|-------|----------|------------|
| Phase 0: Foundation | 1 | 1 |
| Phase 1: Database | 1 | 2 |
| Phase 2: Message Bus | 1 | 3 |
| Phase 3: Verification | 1 | 4 |
| Phase 4: Git Manager | 1 | 5 |
| Phase 5: Checkpoint | 1 | 6 |
| Phase 6: Resources | 1 | 7 |
| Phase 7: Knowledge | 1 | 8 |
| Phase 8: Errors | 1 | 9 |
| Phase 9: Detection | 1.5 | 10.5 |
| Phase 10: Resilience | 1 | 11.5 |
| Phase 11: Monitor | 1 | 12.5 |
| Phase 12: PM Agent | 1 | 13.5 |
| Phase 13: Human | 1.5 | 15 |
| Phase 14: Integration | 1 | 16 |
| Phase 15: E2E | 1 | 17 |
| Phase 16: Polish | 1 | 18 |

**Total: ~18 sessions**

---

*Last updated: 2026-01-07*
*Next: Complete Phase 0 tasks*
