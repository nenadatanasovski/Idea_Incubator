# End-to-End Scenarios: Advanced Flows

> 📍 **Navigation:** [Documentation Index](./DOCUMENTATION-INDEX.md) → E2E Advanced

**Created:** 2026-01-10
**Updated:** 2026-01-12
**Purpose:** Advanced system scenarios for complex operations
**Status:** Reference Documentation

---

## Table of Contents

1. [Scenario 4: New Feature (Parallel Agents)](#scenario-4-new-feature-parallel-agents)
2. [Scenario 5: Feature Decommission](#scenario-5-feature-decommission)
3. [Scenario 6: Knowledge Propagation](#scenario-6-knowledge-propagation)

**See Also:** [E2E-SCENARIOS-CORE.md](./E2E-SCENARIOS-CORE.md) for core scenarios (Idea → App, Bug Fix, Stuck Recovery)

---

# Scenario 4: New Feature (Parallel Agents)

**Example:** Adding "habit streaks" feature while bug fix is in progress

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PARALLEL AGENTS - NEW FEATURE                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ INITIAL STATE:                                                               │
│ ├─ Loop 1 (Critical Path): Building "habit streaks" feature                │
│ ├─ Loop 2 (Infrastructure): Idle                                            │
│ └─ Loop 3 (Polish): Running UI tests                                        │
│                                                                              │
│ ════════════════════════════════════════════════════════════════════════════│
│                                                                              │
│ T=0: NEW BUG REPORTED                                                        │
│ ────────────────────                                                         │
│ User reports: "App crashes when creating habit with emoji in name"          │
│                                                                              │
│ 1. PM Agent receives bug report                                              │
│ 2. PM Agent evaluates:                                                       │
│    - Severity: High (crash)                                                 │
│    - Blocking: Yes (affects all users)                                      │
│    - Decision: Assign to idle loop                                          │
│                                                                              │
│ 3. PM Agent assigns to Loop 2:                                               │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ MessageBus.publish({                                                │   │
│    │   event_type: "work.assigned",                                     │   │
│    │   payload: {                                                        │   │
│    │     type: "bugfix",                                                 │   │
│    │     priority: 1,                                                    │   │
│    │     assigned_to: "loop-2-infrastructure",                          │   │
│    │     spec: { bug_id: "BUG-042", description: "Emoji crash" }        │   │
│    │   }                                                                 │   │
│    │ })                                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ ════════════════════════════════════════════════════════════════════════════│
│                                                                              │
│ T=5min: PARALLEL EXECUTION                                                   │
│ ──────────────────────────                                                   │
│                                                                              │
│ ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│ │    LOOP 1           │  │    LOOP 2           │  │    LOOP 3           │  │
│ │  (Critical Path)    │  │  (Infrastructure)   │  │    (Polish)         │  │
│ ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤  │
│ │ Task: T-003         │  │ Task: BUGFIX-001    │  │ Task: UI-TEST-007   │  │
│ │ File: streaks.ts    │  │ File: habits.ts     │  │ File: none (test)   │  │
│ │ Status: executing   │  │ Status: executing   │  │ Status: executing   │  │
│ └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                              │
│ FILE LOCKS (current state):                                                  │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ file_path              │ locked_by          │ expires_at              │  │
│ ├────────────────────────┼────────────────────┼─────────────────────────┤  │
│ │ types/streaks.ts       │ loop-1-critical    │ 2026-01-10T12:30:00Z   │  │
│ │ database/habits.ts     │ loop-2-infra       │ 2026-01-10T12:35:00Z   │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ════════════════════════════════════════════════════════════════════════════│
│                                                                              │
│ T=8min: RESOURCE CONFLICT                                                    │
│ ─────────────────────────                                                    │
│                                                                              │
│ Loop 1 needs to modify habits.ts (for streak tracking)                      │
│ But habits.ts is locked by Loop 2 (for emoji fix)                           │
│                                                                              │
│ 1. Loop 1 attempts lock:                                                     │
│    MessageBus.lockFile("database/habits.ts", owner="loop-1-critical")       │
│    → DENIED (already locked by loop-2-infra)                                │
│                                                                              │
│ 2. Loop 1 records wait:                                                      │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ INSERT INTO wait_graph:                                             │   │
│    │ {                                                                   │   │
│    │   waiter: "loop-1-critical",                                       │   │
│    │   waiting_for: "loop-2-infra",                                     │   │
│    │   resource: "database/habits.ts",                                  │   │
│    │   since: "2026-01-10T12:08:00Z"                                    │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 3. Loop 1 decision: Wait (bugfix is high priority, should finish soon)     │
│    - Continues with other tasks that don't need habits.ts                   │
│    - Or pauses if no other tasks available                                  │
│                                                                              │
│ ════════════════════════════════════════════════════════════════════════════│
│                                                                              │
│ T=12min: BUGFIX COMPLETE, HANDOFF                                            │
│ ─────────────────────────────────                                            │
│                                                                              │
│ 1. Loop 2 completes bugfix:                                                  │
│    - Commits fix to branch                                                  │
│    - Releases lock on habits.ts                                             │
│                                                                              │
│ 2. Lock release triggers notification:                                       │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ MessageBus.publish({                                                │   │
│    │   event_type: "lock.released",                                     │   │
│    │   payload: {                                                        │   │
│    │     file_path: "database/habits.ts",                               │   │
│    │     released_by: "loop-2-infra"                                    │   │
│    │   }                                                                 │   │
│    │ })                                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 3. Loop 1 receives notification (was waiting):                              │
│    - Immediately attempts lock again                                        │
│    - Lock acquired ✓                                                        │
│    - Resumes task execution                                                 │
│                                                                              │
│ 4. But wait - Loop 2 modified habits.ts!                                    │
│    Loop 1 needs to handle this:                                             │
│                                                                              │
│    a) GitManager.detectConflicts()                                          │
│       - Fetch latest from Loop 2's branch                                   │
│       - Check for conflicts with Loop 1's changes                           │
│       - Result: No conflict (different parts of file)                       │
│                                                                              │
│    b) GitManager.rebaseFromBranch("bugfix/emoji-crash")                     │
│       - Incorporate Loop 2's changes                                        │
│       - Continue with Loop 1's work                                         │
│                                                                              │
│ ════════════════════════════════════════════════════════════════════════════│
│                                                                              │
│ T=20min: MERGE PREPARATION                                                   │
│ ──────────────────────────                                                   │
│                                                                              │
│ Both features ready to merge to main:                                        │
│                                                                              │
│ 1. PM Agent coordinates merge order:                                         │
│    - Bugfix has higher priority → merge first                               │
│    - Streak feature → merge second, rebase on bugfix                        │
│                                                                              │
│ 2. Merge sequence:                                                           │
│    a) PR: bugfix/emoji-crash → main                                         │
│       - Auto-merge (all tests pass)                                         │
│       - Main updated                                                        │
│                                                                              │
│    b) Rebase: feature/streaks on main                                       │
│       - GitManager.rebaseFromMain()                                         │
│       - Resolve any conflicts                                               │
│       - Re-run validation                                                   │
│                                                                              │
│    c) PR: feature/streaks → main                                            │
│       - Auto-merge (all tests pass)                                         │
│       - Main updated                                                        │
│                                                                              │
│ ════════════════════════════════════════════════════════════════════════════│
│                                                                              │
│ FINAL STATE:                                                                 │
│ ├─ Main branch: Has both emoji fix AND streak feature                       │
│ ├─ No conflicts resolved manually                                           │
│ ├─ Both loops contributed successfully                                      │
│ └─ SIA recorded: "Parallel work on habits.ts succeeded with coordination"  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Scenario 5: Feature Decommission

**Example:** Removing the "social sharing" feature that was never adopted

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FEATURE DECOMMISSION                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. DECISION TO DECOMMISSION                                                  │
│    ├─ Source: Product decision, usage analytics, or cost analysis           │
│    ├─ Feature: Social sharing (share habits with friends)                   │
│    └─ Reason: <5% usage, maintenance burden                                 │
│                                                                              │
│ 2. TASK AGENT - DECOMM SPEC (Phase 1)                                       │
│    ├─ Analyze feature scope:                                                │
│    │   - Files created for feature                                          │
│    │   - Database tables                                                    │
│    │   - API endpoints                                                      │
│    │   - UI components                                                      │
│    │   - Tests                                                              │
│    │                                                                         │
│    ├─ ResourceRegistry.getResourcesByFeature("social-sharing"):             │
│    │   ┌──────────────────────────────────────────────────────────────┐    │
│    │   │ RESOURCES OWNED:                                              │    │
│    │   │ - database/migrations/015_social_shares.sql                  │    │
│    │   │ - types/social.ts                                             │    │
│    │   │ - server/routes/social.ts                                     │    │
│    │   │ - components/ShareButton.tsx                                  │    │
│    │   │ - components/FriendsList.tsx                                  │    │
│    │   │ - tests/social.test.ts                                        │    │
│    │   └──────────────────────────────────────────────────────────────┘    │
│    │                                                                         │
│    ├─ Analyze dependencies:                                                 │
│    │   - What imports social.ts?                                            │
│    │   - What uses the social tables?                                       │
│    │   - External integrations?                                             │
│    │                                                                         │
│    └─ Generate decomm spec:                                                 │
│        ┌──────────────────────────────────────────────────────────────┐    │
│        │ build/spec-decomm-social.md                                   │    │
│        │                                                               │    │
│        │ # Decommission: Social Sharing Feature                       │    │
│        │                                                               │    │
│        │ ## Scope                                                      │    │
│        │ - 6 files to delete                                          │    │
│        │ - 1 migration to add (drop tables)                           │    │
│        │ - 3 files to modify (remove imports)                         │    │
│        │                                                               │    │
│        │ ## Risk Assessment                                            │    │
│        │ - Data loss: Yes (social_shares table)                       │    │
│        │ - User impact: Minimal (5% usage)                            │    │
│        │ - Rollback: Possible within 30 days (backup)                 │    │
│        │                                                               │    │
│        │ ## Pre-requisites                                             │    │
│        │ - [ ] Export social_shares data for affected users           │    │
│        │ - [ ] Notify users via email                                 │    │
│        │ - [ ] Feature flag: disable social UI                        │    │
│        └──────────────────────────────────────────────────────────────┘    │
│                                                                              │
│ 3. HUMAN APPROVAL REQUIRED                                                   │
│    ├─ Decomm involves data deletion → requires explicit approval            │
│    ├─ Telegram notification sent                                            │
│    └─ Human approves with confirmation code                                 │
│                                                                              │
│ 4. BUILD AGENT - DECOMM EXECUTION                                            │
│                                                                              │
│    Phase 1: Preparation (reversible)                                         │
│    ├─ T-001: Disable feature flag                                           │
│    ├─ T-002: Export user data to backup                                     │
│    └─ T-003: Remove UI components (feature flagged)                         │
│                                                                              │
│    Phase 2: API Removal                                                      │
│    ├─ T-004: Remove social routes from api.ts                               │
│    ├─ T-005: Delete server/routes/social.ts                                 │
│    └─ T-006: Remove social types                                            │
│                                                                              │
│    Phase 3: Database Cleanup                                                 │
│    ├─ T-007: Create drop migration                                          │
│    │   ┌──────────────────────────────────────────────────────────────┐    │
│    │   │ -- Migration 042: Drop social sharing tables                 │    │
│    │   │ -- WARNING: Data loss - ensure backup exists                 │    │
│    │   │                                                               │    │
│    │   │ DROP TABLE IF EXISTS social_shares;                          │    │
│    │   │ DROP TABLE IF EXISTS social_friends;                         │    │
│    │   │                                                               │    │
│    │   │ -- Remove social-related columns from users                  │    │
│    │   │ ALTER TABLE users DROP COLUMN social_enabled;                │    │
│    │   └──────────────────────────────────────────────────────────────┘    │
│    └─ T-008: Run migration (with backup verification)                       │
│                                                                              │
│    Phase 4: Cleanup                                                          │
│    ├─ T-009: Delete test files                                              │
│    ├─ T-010: Update documentation                                           │
│    └─ T-011: Remove from ResourceRegistry                                   │
│                                                                              │
│ 5. VALIDATION                                                                │
│    ├─ All tests pass (social tests removed)                                 │
│    ├─ No orphan imports                                                     │
│    ├─ No references to deleted files                                        │
│    └─ App functions without social feature                                  │
│                                                                              │
│ 6. SIA REVIEW                                                                │
│    ├─ Record: Feature decomm completed                                      │
│    ├─ Pattern: "Decomm sequence: UI → API → DB"                            │
│    └─ Gotcha: "Always export data before dropping tables"                   │
│                                                                              │
│ 7. POST-DECOMM                                                               │
│    ├─ Data backup retained for 30 days                                      │
│    ├─ Rollback procedure documented                                         │
│    └─ Metrics: Code reduced by 1,200 lines, bundle size -45KB              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Scenario 6: Knowledge Propagation

**Example:** Gotcha discovered in one build helps prevent error in another

````
┌─────────────────────────────────────────────────────────────────────────────┐
│ KNOWLEDGE PROPAGATION                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ BUILD 1: Habit Tracker (January 10)                                         │
│ ════════════════════════════════════                                         │
│                                                                              │
│ 1. Build Agent executes task: Create habits migration                       │
│                                                                              │
│ 2. First attempt FAILS:                                                      │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ Error: SQLITE_ERROR: near "DATETIME": syntax error                 │   │
│    │                                                                     │   │
│    │ Code that failed:                                                   │   │
│    │ CREATE TABLE habits (                                               │   │
│    │   id TEXT PRIMARY KEY,                                              │   │
│    │   created_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- WRONG!         │   │
│    │ );                                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 3. Build Agent self-corrects:                                               │
│    - Recognizes SQL syntax error                                            │
│    - Searches for SQLite date patterns                                      │
│    - Fixes: DATETIME → TEXT, CURRENT_TIMESTAMP → datetime('now')            │
│                                                                              │
│ 4. Second attempt SUCCEEDS                                                   │
│                                                                              │
│ 5. Build Agent records discovery:                                            │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ KnowledgeBase.recordGotcha({                                        │   │
│    │   content: "SQLite does not support DATETIME type. Use TEXT and   │   │
│    │             datetime('now') instead of CURRENT_TIMESTAMP",         │   │
│    │   file_pattern: "*.sql",                                            │   │
│    │   action_type: "CREATE",                                            │   │
│    │   topic: "sqlite",                                                  │   │
│    │   confidence: 0.95,  // High - directly observed failure           │   │
│    │   evidence: "SQLITE_ERROR in migration 001_habits.sql",            │   │
│    │   discovered_by: "loop-1-critical-path"                             │   │
│    │ })                                                                  │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 6. SIA reviews and PROMOTES gotcha:                                          │
│    - High confidence (0.95)                                                 │
│    - Universal applicability (all SQL files)                                │
│    - Decision: Add to CLAUDE.md                                             │
│                                                                              │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ CLAUDE.md update:                                                   │   │
│    │                                                                     │   │
│    │ ## Database Conventions                                             │   │
│    │                                                                     │   │
│    │ ### SQLite Best Practices                                           │   │
│    │ - Use `TEXT` for dates, not `DATETIME`  ← NEW                      │   │
│    │ - Use `datetime('now')` not `CURRENT_TIMESTAMP`  ← NEW             │   │
│    │ - Always include `IF NOT EXISTS`                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ ════════════════════════════════════════════════════════════════════════════│
│                                                                              │
│ BUILD 2: Task Manager (January 15, different idea)                          │
│ ══════════════════════════════════════════════════                          │
│                                                                              │
│ 1. Task Agent generates spec for "Task Manager" idea (Phase 1)              │
│                                                                              │
│ 2. Task Agent queries Knowledge Base for SQL gotchas:                       │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ SELECT * FROM knowledge                                             │   │
│    │ WHERE item_type = 'gotcha'                                          │   │
│    │   AND file_pattern = '*.sql'                                        │   │
│    │ ORDER BY confidence DESC                                            │   │
│    │                                                                     │   │
│    │ RETURNS:                                                            │   │
│    │ [                                                                   │   │
│    │   {                                                                 │   │
│    │     id: "gotcha-001",                                               │   │
│    │     content: "SQLite does not support DATETIME type...",           │   │
│    │     confidence: 0.95                                                │   │
│    │   },                                                                │   │
│    │   {                                                                 │   │
│    │     id: "gotcha-002",                                               │   │
│    │     content: "Always include IF NOT EXISTS",                       │   │
│    │     confidence: 0.90                                                │   │
│    │   }                                                                 │   │
│    │ ]                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 3. Task Agent INJECTS gotchas into task:                                    │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ tasks.md:                                                           │   │
│    │                                                                     │   │
│    │ ### Task 1                                                          │   │
│    │ ```yaml                                                             │   │
│    │ id: T-001                                                           │   │
│    │ action: CREATE                                                      │   │
│    │ file: "database/migrations/001_tasks.sql"                          │   │
│    │                                                                     │   │
│    │ requirements:                                                       │   │
│    │   - "Create tasks table with id, title, due_date"                  │   │
│    │                                                                     │   │
│    │ gotchas:                                                            │   │
│    │   - "SQLite does not support DATETIME. Use TEXT and datetime()"   │ ← INJECTED
│    │   - "Always include IF NOT EXISTS"                                 │ ← INJECTED
│    │                                                                     │   │
│    │ code_template: |                                                    │   │
│    │   CREATE TABLE IF NOT EXISTS tasks (                               │   │
│    │       id TEXT PRIMARY KEY,                                          │   │
│    │       title TEXT NOT NULL,                                          │   │
│    │       due_date TEXT,  -- NOTE: TEXT not DATETIME                   │   │
│    │       created_at TEXT DEFAULT (datetime('now'))                    │   │
│    │   );                                                                │   │
│    │ ```                                                                 │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 4. Build Agent executes task:                                               │
│    - Sees gotchas in task definition                                        │
│    - Claude uses code_template as guidance                                  │
│    - Generates correct SQL on FIRST attempt                                 │
│                                                                              │
│ 5. RESULT: No failure, no retry                                              │
│    - Build 1 failure prevented Build 2 failure                              │
│    - Knowledge successfully propagated                                      │
│                                                                              │
│ 6. SIA records improvement metric:                                           │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ INSERT INTO improvement_metrics:                                    │   │
│    │ {                                                                   │   │
│    │   metric_type: "gotcha_prevented_failure",                         │   │
│    │   value: 1,                                                         │   │
│    │   context: {                                                        │   │
│    │     gotcha_id: "gotcha-001",                                       │   │
│    │     original_failure: "habit-tracker/T-001",                       │   │
│    │     prevented_in: "task-manager/T-001"                             │   │
│    │   }                                                                 │   │
│    │ }                                                                   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ 7. OVER TIME:                                                                │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │ IMPROVEMENT TREND:                                                  │   │
│    │                                                                     │   │
│    │ Week 1:  First-pass success: 65%  | Failures: 35%                  │   │
│    │ Week 2:  First-pass success: 75%  | Failures: 25%  (+10%)         │   │
│    │ Week 3:  First-pass success: 82%  | Failures: 18%  (+7%)          │   │
│    │ Week 4:  First-pass success: 88%  | Failures: 12%  (+6%)          │   │
│    │                                                                     │   │
│    │ Gotchas in Knowledge Base: 47                                      │   │
│    │ Patterns in Knowledge Base: 23                                     │   │
│    │ CLAUDE.md updates: 8                                               │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
````

---

## Summary: Key Mechanisms

| Mechanism                 | Purpose                          | Tables/Events Involved                          |
| ------------------------- | -------------------------------- | ----------------------------------------------- |
| **Phase Transitions**     | Guide ideation through discovery | `ideation_sessions.phase`, `ideation_artifacts` |
| **Handoff Brief**         | Transfer context between agents  | `planning/brief.md`, `ideation.completed` event |
| **Gotcha Injection**      | Prevent repeated failures        | `knowledge` table, Task Agent queries           |
| **File Locking**          | Prevent concurrent edits         | `file_locks` table, `wait_graph`                |
| **Checkpoints**           | Enable rollback on failure       | `checkpoints` table, Git refs                   |
| **Event Bus**             | Coordinate between agents        | `events` table, pub/sub                         |
| **Knowledge Propagation** | Learn from failures              | `knowledge`, `improvement_metrics`              |
| **System Review**         | Extract learnings                | `system_reviews`, SIA analysis                  |

---

## Related Documents

- [E2E-SCENARIOS-CORE.md](./E2E-SCENARIOS-CORE.md) - Core scenarios (Idea → App, Bug Fix, Stuck Recovery)
- `AGENT-ARCHITECTURE.md` - Implementation details
- `IMPLEMENTATION-PLAN.md` - Development roadmap

---

_This document provides concrete examples of advanced system flows. For core flows, see E2E-SCENARIOS-CORE.md._
