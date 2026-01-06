# Implementation Decisions

**Created:** 2026-01-07
**Status:** Approved by User

These decisions guide all implementation work. Reference this document at the start of each session.

---

## Core Decisions

| # | Question | Decision | Implications |
|---|----------|----------|--------------|
| 1 | Deployment Model | **Single Machine** | SQLite for all persistence, file locking via database, shared filesystem |
| 2 | Human Operator | **Solo + Telegram** | CLI when at desk, Telegram notifications when away |
| 3 | API Budget | **Unlimited** (Claude Code Max) | No throttling needed, budget manager for reporting only |
| 4 | Shared Resources | **Strict Ownership** | First creator owns file, others request changes |
| 5 | Bootstrap | **Incremental (D)** | Build coordination using coordination as it's built |
| 6 | State Storage | **Database Only** | Eliminate test-state.json, single source of truth |
| 7 | Gap Priority | **All in roadmap** | Must Have first, then Should Have, defer Nice to Have |
| 8 | Loop Interaction | **Tight-knit team** | Constant coordination, multiple agents running concurrently |

---

## Detailed Implications

### 1. Single Machine Deployment

- All components run on one Mac/Linux box
- SQLite is the only database (no PostgreSQL)
- File locking handled via database, not OS-level
- No network coordination needed
- Simple deployment: just run Python processes

### 2. Solo + Telegram

- You are the only operator
- CLI (`python3 coding-loops/cli.py`) for direct interaction
- Telegram bot sends push notifications for:
  - Decisions pending
  - Critical alerts
  - Daily summaries (optional)
- Telegram bot receives responses for simple decisions
- Complex decisions require CLI

### 3. Unlimited Budget

- No hard limits on API calls
- Budget Manager tracks usage for reporting
- No throttling or pausing for budget
- Resource warnings are informational only
- Can run all 3 loops at full speed

### 4. Strict Ownership

**File Ownership Rules:**
- First loop to create a file owns it
- Ownership recorded in Resource Registry
- Non-owners cannot modify directly
- Non-owners publish `change_request` event
- PM Agent or human approves changes
- Owner applies approved changes

**Pre-assigned Ownership:**
```yaml
loop-1-critical-path:
  - package.json
  - tsconfig.json
  - types/ideation.ts
  - types/specification.ts
  - types/build.ts
  - types/session.ts
  - server/routes/ideation.ts
  - server/routes/specification.ts
  - server/routes/build.ts
  - database/migrations/0*_ideation_*.sql
  - database/migrations/0*_spec_*.sql
  - database/migrations/0*_build_*.sql

loop-2-infrastructure:
  - types/auth.ts
  - types/credits.ts
  - types/hosting.ts
  - server/routes/auth.ts
  - server/routes/credits.ts
  - server/routes/hosting.ts
  - server/middleware/auth.ts
  - database/migrations/0*_auth_*.sql
  - database/migrations/0*_credits_*.sql

loop-3-polish:
  - types/monitoring.ts
  - types/testing.ts
  - server/routes/health.ts
  - tests/fixtures/**
  - tests/helpers/**
  - tests/e2e/**
```

### 5. Incremental Bootstrap

**Build Order:**
1. **Phase 1:** Message Bus + Verification Gate (manual supervision)
2. **Phase 2:** Use Message Bus to build Monitor + PM
3. **Phase 3:** Use Monitor/PM to build remaining components
4. **Phase 4+:** Full coordination system building actual product

Each phase uses components from previous phase.

### 6. Database Only

- All state in `coordination.db` (SQLite)
- No more `test-state.json` files
- Test state migrated to `tests` table
- CLI has `dump-state` command for human-readable output
- Backup via `sqlite3 coordination.db ".backup backup.db"`

### 7. All Gaps in Roadmap

**Must Have (Phase 1-2):**
- Gap 17: Shared File Mutation → Resource Registry
- Gap 18: Migration Ordering → Migration Allocator
- Gap 19: Package.json Coordination → Owned by Loop 1
- Gap 24: Atomic Operations → Transaction Log
- Gap 25: State Consistency → Solved by Database Only

**Should Have (Phase 3):**
- Gap 20: Build Ownership → Build locks
- Gap 23: Monitor the Monitor → Watchdog Agent
- Gap 28: Context Window Management → Context Manager

**Defer to V2:**
- Gap 21: Priority Inversion → Priority inheritance
- Gap 22: Starvation Prevention → Starvation detection
- Gap 27: Learning From Failures → Pattern learning
- Gap 29: Message Ordering → Lamport timestamps

### 8. Tight-Knit Team

**Interaction Model:**
- Loops constantly check Message Bus for events
- Monitor Agent checks all loops every 30 seconds
- PM Agent responds to conflicts immediately
- Knowledge Base keeps all loops in sync
- File locks prevent stepping on each other
- Semantic Analyzer catches architectural drift

**Concurrency:**
- 3 execution loops run simultaneously
- Monitor Agent runs continuously
- PM Agent runs continuously
- Human Agent polls for decisions
- Watchdog Agent monitors Monitor

---

## Circular Dependencies Resolution

### Session Infrastructure
- **Owner:** Loop 1 defines base `types/session.ts`
- **Extension:** Loop 2 extends with `types/auth-session.ts`
- **Dependency:** Loop 2 waits for Loop 1's session interface

### Database Access
- **Owner:** Loop 1 owns all schema changes
- **Pattern:** Other loops request changes via events
- **Migrations:** Central allocator assigns numbers

### API Middleware
- **Owner:** Loop 2 owns auth middleware
- **Pattern:** Other loops use middleware, don't modify
- **Dependency:** Loop 1 waits for auth middleware before protected routes

### Core Types
- **Owner:** First creator owns the type
- **Registry:** Knowledge Base tracks ownership
- **Pattern:** Split into domain-specific files

---

## Hot Files Mitigation

### server/api.ts
**Problem:** All loops add routes
**Solution:** Split into domain files:
- `server/routes/ideation.ts` (Loop 1)
- `server/routes/auth.ts` (Loop 2)
- `server/api.ts` imports and mounts all

### types/index.ts
**Problem:** All loops add types
**Solution:** Split into domain files:
- `types/ideation.ts` (Loop 1)
- `types/auth.ts` (Loop 2)
- `types/index.ts` re-exports all

### package.json
**Problem:** All loops add dependencies
**Solution:** Loop 1 owns exclusively, others request via events

### database/migrations/
**Problem:** Ordering conflicts
**Solution:** Migration Allocator assigns numbers centrally

---

## Test Infrastructure

**Owner:** Loop 3 (Polish)

**Shared Resources:**
```
tests/
├── fixtures/       # Sample data
├── helpers/        # Test utilities
├── mocks/          # Mock implementations
└── e2e/            # End-to-end tests
```

**Pattern:** Each loop writes own unit tests, uses shared infrastructure for integration/E2E.

---

*Last Updated: 2026-01-07*
