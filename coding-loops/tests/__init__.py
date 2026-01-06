"""
Coordination System Test Suite

Test categories:
- test_database.py: Database layer tests
- test_message_bus.py: BUS-001 through BUS-008
- test_verification.py: VER-001 through VER-007
- test_git_manager.py: GIT-001 through GIT-006
- test_checkpoint.py: CHK-001 through CHK-006
- test_budget.py: BUD-001 through BUD-005
- test_resource_registry.py: Resource ownership tests
- test_migration.py: Migration ordering tests
- test_knowledge.py: KB-001 through KB-006
- test_error.py: ERR-001 through ERR-006
- test_atomic.py: Atomic operation tests
- test_regression.py: REG-001 through REG-006
- test_deadlock.py: DLK-001 through DLK-005
- test_semantic.py: SEM-001 through SEM-005
- test_degradation.py: DEG-001 through DEG-005
- test_orphan.py: ORP-001 through ORP-005
- test_context.py: Context management tests
- test_telegram.py: Telegram notification tests
- test_monitor.py: MON-001 through MON-008
- test_pm.py: PM-001 through PM-008
- test_human.py: HUM-001 through HUM-008
- test_watchdog.py: Watchdog tests
- test_integration.py: INT-001 through INT-007
- test_e2e.py: E2E-001 through E2E-005
- test_acceptance.py: SAT-001 through SAT-010

Run all tests:
    python3 -m pytest coding-loops/tests/ -v

Run specific test file:
    python3 -m pytest coding-loops/tests/test_message_bus.py -v
"""
