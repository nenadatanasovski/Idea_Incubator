# Build Agent Implementation - Developer Brief

**Purpose:** Quick-start guide for implementing the Build Agent system
**Time to read:** 5 minutes
**Created:** 2026-01-13

---

## What You're Building

A system where:

```
User (Telegram) → /execute → Task Agent validates → Build Agent spawns → Task completes → Telegram notification
```

The Build Agent is a Python worker that executes code tasks using Claude, validates them, and reports back.

---

## Documents to Read (In Order)

### 1. Start Here (Required)

| Document                                                                        | What You'll Learn                         | Time   |
| ------------------------------------------------------------------------------- | ----------------------------------------- | ------ |
| [BUILD-AGENT-IMPLEMENTATION-PLAN.md](./BUILD-AGENT-IMPLEMENTATION-PLAN.md) §1-3 | Overview, architecture, PIV loop pattern  | 10 min |
| [BUILD-AGENT-IMPLEMENTATION-PLAN.md](./BUILD-AGENT-IMPLEMENTATION-PLAN.md) §13  | **Gap analysis - what's missing and why** | 5 min  |

### 2. Implementation Tasks (Required)

| Document                                                                       | What You'll Learn                                  | Time   |
| ------------------------------------------------------------------------------ | -------------------------------------------------- | ------ |
| [BUILD-AGENT-IMPLEMENTATION-PLAN.md](./BUILD-AGENT-IMPLEMENTATION-PLAN.md) §10 | 100 tasks (BA-001 to BA-100) with pass definitions | 15 min |

**Priority Order:**

1. **Phase 8 (P0):** Python Worker - nothing works without this
2. **Phase 7 (P1):** Telegram `/execute` command
3. **Phase 9 (P1):** Completion feedback to Telegram
4. **Phases 1-6 (P2):** Core infrastructure

### 3. Reference When Needed

| Document                                                                   | Use For                          |
| -------------------------------------------------------------------------- | -------------------------------- |
| [BUILD-AGENT-APPENDIX-A-TYPES.md](./BUILD-AGENT-APPENDIX-A-TYPES.md)       | TypeScript type definitions      |
| [BUILD-AGENT-APPENDIX-B-DATABASE.md](./BUILD-AGENT-APPENDIX-B-DATABASE.md) | SQL schema, migrations, queries  |
| [BUILD-AGENT-APPENDIX-C-PYTHON.md](./BUILD-AGENT-APPENDIX-C-PYTHON.md)     | Python implementation skeleton   |
| [BUILD-AGENT-E2E-TEST-PLAN.md](./BUILD-AGENT-E2E-TEST-PLAN.md)             | 13 E2E test flows for validation |

---

## Critical Context

### The Problem (Why This Matters)

The orchestrator at `server/services/task-agent/build-agent-orchestrator.ts` spawns:

```typescript
spawn('python3', ['coding-loops/agents/build_agent_worker.py', ...])
```

**But `build_agent_worker.py` does not exist.** This is the critical blocker.

### Key Files to Know

| File                                                     | Status      | Purpose                              |
| -------------------------------------------------------- | ----------- | ------------------------------------ |
| `server/services/task-agent/build-agent-orchestrator.ts` | EXISTS      | Spawns Python workers, tracks agents |
| `coding-loops/agents/build_agent_worker.py`              | **MISSING** | Executes tasks via Claude            |
| `server/communication/task-agent-telegram-handler.ts`    | EXISTS      | Needs `/execute` command             |
| `server/communication/telegram-receiver.ts`              | EXISTS      | Needs `execute:*` callback pattern   |

### Worker-Orchestrator Communication

- Worker updates task status **directly in SQLite** (not via API)
- Worker writes heartbeats **directly to database**
- Exit code 0 = success, non-zero = failure
- Orchestrator detects completion via process exit event

---

## Quick Start Checklist

Before starting implementation:

- [ ] Read §1-3 of BUILD-AGENT-IMPLEMENTATION-PLAN.md (architecture)
- [ ] Read §13 (gap analysis - understand what's missing)
- [ ] Understand the 9 phases and 100 tasks
- [ ] Note that Phase 8 is the critical blocker

First tasks to implement:

1. BA-077: Create `coding-loops/agents/build_agent_worker.py`
2. BA-078: CLI argument parsing
3. BA-079: Database connection from Python

---

## Test Your Understanding

You're ready to start when you can answer:

1. What is the PIV loop? (Prime, Iterate, Validate)
2. Why is Phase 8 the critical blocker? (Python worker doesn't exist)
3. How does the worker communicate with the orchestrator? (Direct DB, exit codes)
4. What are the 3 P0 test flows? (Tests 11, 12, 13)

---

## Getting Help

- Architecture questions → [BUILD-AGENT-IMPLEMENTATION-PLAN.md](./BUILD-AGENT-IMPLEMENTATION-PLAN.md) §2
- Database schema → [BUILD-AGENT-APPENDIX-B-DATABASE.md](./BUILD-AGENT-APPENDIX-B-DATABASE.md)
- Python code structure → [BUILD-AGENT-APPENDIX-C-PYTHON.md](./BUILD-AGENT-APPENDIX-C-PYTHON.md)
- Test validation → [BUILD-AGENT-E2E-TEST-PLAN.md](./BUILD-AGENT-E2E-TEST-PLAN.md)
