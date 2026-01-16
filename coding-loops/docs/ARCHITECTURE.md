# Multi-Agent Coordination System Architecture

**Version:** 1.0
**Created:** 2026-01-07

---

## System Overview

```
+-----------------------------------------------------------------------+
|                          HUMAN LAYER                                   |
|  +-------------------------------------------------------------------+|
|  |  CLI / Telegram Notifications                                      ||
|  +-------------------------------------------------------------------+|
+-----------------------------------+-----------------------------------+
                                    |
+-----------------------------------v-----------------------------------+
|                       ORCHESTRATION LAYER                              |
|  +----------+ +----------+ +----------+ +----------+ +----------+     |
|  |  Human   | |    PM    | | Monitor  | | Semantic | |Knowledge |     |
|  |  Agent   | |   Agent  | |  Agent   | | Analyzer | |   Base   |     |
|  +----+-----+ +----+-----+ +----+-----+ +----+-----+ +----+-----+     |
|       |            |            |            |            |           |
|  +----v------------v------------v------------v------------v-----+     |
|  |                  MESSAGE BUS (SQLite)                        |     |
|  |  Events | Subscriptions | Locks | Deadlock | Knowledge       |     |
|  +----------------------------------------------+---------------+     |
+-----------------------------------+-----------------------------------+
                                    |
+-----------------------------------v-----------------------------------+
|                        EXECUTION LAYER                                 |
|  +-----------+          +-----------+          +-----------+          |
|  |  Loop 1   |          |  Loop 2   |          |  Loop 3   |          |
|  |  branch   |          |  branch   |          |  branch   |          |
|  +-----+-----+          +-----+-----+          +-----+-----+          |
|        |                      |                      |                |
|  +-----v----------------------v----------------------v-----+          |
|  |              VERIFICATION GATE                          |          |
|  |  TypeScript | Tests | Build | Lint | Regression         |          |
|  +---------------------------------------------------------+          |
+-----------------------------------+-----------------------------------+
                                    |
+-----------------------------------v-----------------------------------+
|                         SAFETY LAYER                                   |
|  +----------+ +----------+ +----------+ +----------+ +----------+     |
|  |Checkpoint| |  Budget  | |  Error   | |Degradation| | Orphan  |     |
|  | Manager  | | Manager  | |Classifier| |  Manager  | | Cleaner |     |
|  +----------+ +----------+ +----------+ +----------+ +----------+     |
+-----------------------------------+-----------------------------------+
                                    |
+-----------------------------------v-----------------------------------+
|                          GIT LAYER                                     |
|  +-------------------------------------------------------------------+|
|  |  Git Manager: Branches | Rebases | PRs | Merges | Conflicts       ||
|  +-------------------------------------------------------------------+|
|                                   |                                    |
|                              +----v----+                               |
|                              |  main   | (protected)                   |
|                              +---------+                               |
+-----------------------------------------------------------------------+
```

---

## Component Responsibilities

### Human Layer

- **CLI:** Direct human interaction via terminal
- **Telegram:** Push notifications when away from desk

### Orchestration Layer

| Component         | Responsibility                                             |
| ----------------- | ---------------------------------------------------------- |
| Human Agent       | Collect decisions, generate summaries, route notifications |
| PM Agent          | Resolve conflicts, manage priorities, redistribute work    |
| Monitor Agent     | Health checks, anomaly detection, alerting                 |
| Semantic Analyzer | Detect semantic conflicts, enforce architecture rules      |
| Knowledge Base    | Cross-agent context, learned facts, decisions              |

### Execution Layer

| Component         | Responsibility                                  |
| ----------------- | ----------------------------------------------- |
| Loop 1            | Critical Path: UFS, Specification, Build agents |
| Loop 2            | Infrastructure: Auth, Credits, Hosting          |
| Loop 3            | Polish: Monitoring, E2E, PWA                    |
| Verification Gate | Independent validation of agent claims          |

### Safety Layer

| Component           | Responsibility                             |
| ------------------- | ------------------------------------------ |
| Checkpoint Manager  | Git-based snapshots, rollback capability   |
| Budget Manager      | Usage tracking and reporting               |
| Error Classifier    | Categorize errors for appropriate handling |
| Degradation Manager | Graceful handling of component failures    |
| Orphan Cleaner      | Cleanup orphaned resources                 |

### Git Layer

| Component   | Responsibility                              |
| ----------- | ------------------------------------------- |
| Git Manager | Branch-per-loop, rebase, conflict detection |

---

## Data Flow

### Test Execution Flow

```
1. Loop picks next pending test from database
2. Loop publishes 'test_started' event
3. Loop acquires file locks for files it will modify
4. Loop builds context (Knowledge Base + spec)
5. Loop runs Claude agent
6. Loop claims pass/fail
7. Verification Gate independently verifies
8. If verified: update database, publish 'test_passed'
9. If not verified: increment attempts, publish 'test_failed'
10. Release file locks
11. Delete checkpoint (if passed) or keep (if failed)
```

### Conflict Resolution Flow

```
1. Loop A locks file X
2. Loop B tries to lock file X, fails
3. DeadlockDetector records wait: B -> A
4. Monitor detects conflict (or deadlock)
5. PM Agent receives 'file_conflict' event
6. PM decides winner based on priority
7. PM publishes 'pause_requested' to loser
8. Loser pauses, releases locks
9. Winner continues
10. PM publishes 'resume_requested' when safe
```

### Human Decision Flow

```
1. Agent encounters ambiguous situation
2. Agent publishes 'decision_needed' event
3. Human Agent receives event
4. Human Agent sends Telegram notification
5. Human responds via CLI or Telegram
6. Human Agent publishes 'human_message' event
7. PM Agent applies decision
8. Affected loops receive updated priority/instructions
```

---

## Key Design Decisions

### Single Machine

- SQLite for all persistence (simple, reliable)
- File locking via database (not OS-level)
- Shared filesystem for all components

### Branch-per-Loop

- Each loop works on its own Git branch
- Main branch is protected
- PM Agent triggers merges after milestones
- Human reviews PRs before merge

### Strict Ownership

- Files are owned by their first creator
- Non-owners must request changes
- PM Agent or human approves change requests

### Database-Only State

- No JSON files for state (eliminated test-state.json)
- Single source of truth in SQLite
- CLI can dump human-readable state

### Verification Gate

- Never trust agent claims blindly
- Independent TypeScript, build, test, lint checks
- Test not marked passed until verification passes

### Telegram + CLI

- CLI for when at desk
- Telegram notifications when away
- Same decision interface, different notification channels

---

## File Locations

| Category              | Location                                            |
| --------------------- | --------------------------------------------------- |
| Shared infrastructure | `coding-loops/shared/`                              |
| Agents                | `coding-loops/agents/`                              |
| Database              | `coding-loops/database/`                            |
| CLI                   | `coding-loops/cli.py`, `coding-loops/cli_commands/` |
| Tests                 | `coding-loops/tests/`                               |
| Loop 1                | `coding-loops/loop-1-critical-path/`                |
| Loop 2                | `coding-loops/loop-2-infrastructure/`               |
| Loop 3                | `coding-loops/loop-3-polish/`                       |
| Documentation         | `coding-loops/docs/`                                |
| SQLite database       | `coding-loops/coordination.db`                      |

---

## See Also

- [DATABASE-SCHEMA.md](DATABASE-SCHEMA.md) - SQLite table definitions
- [EVENT-CATALOG.md](EVENT-CATALOG.md) - Event types and payloads
- [API-REFERENCE.md](API-REFERENCE.md) - Component APIs
- [OPERATOR-RUNBOOK.md](OPERATOR-RUNBOOK.md) - Troubleshooting guide
