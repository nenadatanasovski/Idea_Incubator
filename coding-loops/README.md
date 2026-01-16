# Coding Loop Harnesses

**Created:** 2026-01-07
**Purpose:** Parallel autonomous development using Ralph loops
**Status:** Level 1 (Configurable, Queryable)

---

## Overview

This directory contains 3 independent coding loop harnesses that can run in parallel,
each implementing a different stream of the Vibe platform development.

```
coding-loops/
├── README.md                          # This file
├── TASKS.md                           # Master task list for implementation
├── coordination.db                    # SQLite database (auto-created)
│
├── docs/                              # Documentation
│   ├── ARCHITECTURE.md                # System design
│   ├── DATABASE-SCHEMA.md             # SQLite tables
│   ├── EVENT-CATALOG.md               # Event types
│   ├── API-REFERENCE.md               # Component APIs
│   ├── TEST-CATALOG.md                # All 116+ tests
│   ├── OPERATOR-RUNBOOK.md            # Operations guide
│   ├── IMPLEMENTATION-PHASES.md       # Phase breakdown
│   └── DECISIONS.md                   # User decisions
│
├── shared/                            # Shared infrastructure
│   ├── ralph_loop_base.py             # Ralph loop base class
│   ├── message_bus.py                 # Event bus (TODO)
│   ├── verification_gate.py           # Independent verification (TODO)
│   ├── git_manager.py                 # Branch strategy (TODO)
│   └── ...                            # See TASKS.md for full list
│
├── agents/                            # Autonomous agents
│   ├── monitor_agent.py               # Health monitoring (TODO)
│   ├── pm_agent.py                    # Project management (TODO)
│   └── human_agent.py                 # Human interface (TODO)
│
├── database/                          # Database layer
│   ├── schema.sql                     # SQLite schema
│   └── migrations/                    # Schema migrations
│
├── cli.py                             # CLI entry point (TODO)
├── cli_commands/                      # CLI subcommands (TODO)
│
├── tests/                             # Test suite
│   ├── conftest.py                    # Pytest fixtures
│   └── test_*.py                      # Component tests (TODO)
│
├── loop-1-critical-path/              # Loop 1: UFS → Spec → Build
├── loop-2-infrastructure/             # Loop 2: Auth → Credits → Hosting
└── loop-3-polish/                     # Loop 3: Monitoring → E2E → PWA
```

---

## Architecture Maturity

The coding loop system implements Level 1 of a 4-level architecture:

| Level  | Description                                                              | Status  |
| ------ | ------------------------------------------------------------------------ | ------- |
| **L1** | Configurable, queryable (config files, schema validation, health checks) | Done    |
| **L2** | Orchestrator-ready (loop registry, control API, webhooks)                | Planned |
| **L3** | Self-healing (auto-unblock, checkpoint/resume, SIA integration)          | Planned |
| **L4** | Fully autonomous (monitor agent, refinement agent, PM agent)             | Planned |

See `20260107-coding-loop-architecture-critique.md` for detailed gap analysis.

### Level 4 Implementation Plan

A comprehensive plan for building the full multi-agent coordination system is available:

**`20260107-multi-agent-coordination-system-FINAL.md`**

This plan includes:

- 16 components (Message Bus, Monitor Agent, PM Agent, Human Interface, Verification Gate, Git Manager, etc.)
- 116 test cases with explicit pass definitions
- 6-week phased implementation plan
- Operator runbook
- Full architecture diagram

The plan is ready for handoff to a coding agent with MCP Puppeteer for execution.

---

## Configuration

Each loop has a `config.json` file with validated configuration:

```json
{
  "name": "Loop 1: Critical Path",
  "specs_dir": "coding-loops/loop-1-critical-path/specs",
  "test_state_file": "test-state.json",
  "model": "claude-opus-4-5-20251101",
  "max_attempts": 3,
  "auto_continue_delay": 3,
  "priority": 1,
  "health_check": {
    "enabled": true,
    "interval_seconds": 30,
    "file": "health.json"
  }
}
```

### Environment Variables

- `CODING_LOOP_PROJECT_DIR` - Override project root directory

### Command Line Options

```bash
# Run with config
python coding-loops/loop-1-critical-path/run_loop.py

# Limit iterations
python run_loop.py --max-iterations 10

# Override model
python run_loop.py --model claude-sonnet-4-20250514

# Custom config path
python run_loop.py --config /path/to/config.json
```

---

## The Three Loops

### Loop 1: Critical Path (UFS -> Spec -> Build)

**Priority:** 1 (CRITICAL)
**Review:** Daily

Implements the core user journey:

1. Complete Unified File System (remaining SC, PH, UI tests)
2. Specification Agent (extract requirements from ideation)
3. Build Agent (generate code via Ralph loop)

```bash
python3 coding-loops/loop-1-critical-path/run_loop.py
```

### Loop 2: Infrastructure (Auth -> Credits -> Hosting)

**Priority:** 2 (HIGH)
**Review:** Every 2-3 days

Builds foundational infrastructure:

1. Authentication (user registration, login, sessions)
2. Credit System (balance tracking, Stripe, consumption)
3. Hosting (app deployment to Railway/Render/Vercel)

```bash
python3 coding-loops/loop-2-infrastructure/run_loop.py
```

### Loop 3: Polish (Monitoring -> E2E -> PWA)

**Priority:** 3 (MEDIUM)
**Review:** Weekly

Implements quality infrastructure:

1. Error Monitoring (Sentry integration)
2. E2E Testing (journey tests, CI/CD)
3. PWA/Mobile (manifest, service worker, responsive)

```bash
python3 coding-loops/loop-3-polish/run_loop.py
```

---

## How It Works

Each loop uses the Ralph loop pattern:

1. Load and validate config from `config.json`
2. Load and validate test state from `test-state.json`
3. Write health check file (`health.json`)
4. Find next pending test with dependencies met
5. Build prompt with spec content and previous transcripts
6. Run Claude Agent SDK session
7. Parse result (PASSED, BLOCKED, or continue)
8. Update test state and save transcripts
9. Update health check file
10. Repeat until all tests complete or blocked

### Test States

- `pending` - Not yet attempted
- `passed` - Successfully implemented
- `failed` - Failed but may retry
- `blocked` - Cannot proceed (max attempts or dependency blocked)

### Health Checks

Each loop writes a `health.json` file every 30 seconds:

```json
{
  "loop_name": "Loop 1: Critical Path",
  "status": "running",
  "current_test": "CP-SPEC-005",
  "progress": { "passed": 12, "total": 45 },
  "last_heartbeat": "2026-01-07T09:15:00Z",
  "pid": 12345
}
```

Status values: `starting`, `running`, `stopped`, `error`

### Schema Validation

Both `config.json` and `test-state.json` are validated against JSON schemas:

- `shared/config_schema.json`
- `shared/test_state_schema.json`

If `jsonschema` is installed (`pip install jsonschema`), full validation is performed.
Otherwise, basic required field validation is used as fallback.

---

## Running Loops in Parallel

Run all 3 loops simultaneously in separate terminals:

```bash
# Terminal 1
python3 coding-loops/loop-1-critical-path/run_loop.py

# Terminal 2
python3 coding-loops/loop-2-infrastructure/run_loop.py

# Terminal 3
python3 coding-loops/loop-3-polish/run_loop.py
```

### Resource Considerations

- Each loop uses one Claude API connection
- ~15-20 hours/week founder time for review
- Loop 1 requires daily review (critical path)
- Loop 2 requires review every 2-3 days
- Loop 3 can be reviewed weekly

### Dependencies Between Loops

- **Loop 1 -> Loop 2:** Credits should wait for spec mode (shared session infrastructure)
- **Loop 2 -> Loop 3:** Some E2E tests need auth (but can start monitoring immediately)
- **Loop 1 and Loop 3:** No direct dependencies (can run fully parallel)

---

## Monitoring Progress

### Check Health Status

```bash
cat coding-loops/loop-1-critical-path/specs/health.json | jq
cat coding-loops/loop-2-infrastructure/specs/health.json | jq
cat coding-loops/loop-3-polish/specs/health.json | jq
```

### Check Test State

```bash
cat coding-loops/loop-1-critical-path/specs/test-state.json | jq '.summary'
cat coding-loops/loop-2-infrastructure/specs/test-state.json | jq '.summary'
cat coding-loops/loop-3-polish/specs/test-state.json | jq '.summary'
```

### View Recent Transcripts

```bash
tail -100 coding-loops/loop-1-critical-path/specs/logs/transcripts/global-transcript.log
```

### Reset a Blocked Test

Edit `test-state.json` and change:

```json
{
  "id": "TEST-ID",
  "status": "pending",
  "attempts": 0
}
```

---

## Adding New Tests

1. Edit the relevant `test-state.json`
2. Add a new test object:

```json
{
  "id": "NEW-TEST-001",
  "category": "category",
  "status": "pending",
  "attempts": 0,
  "lastResult": null,
  "dependsOn": "PREVIOUS-TEST-ID",
  "automatable": true,
  "notes": "Description of what to implement"
}
```

3. Update the `summary.total` count
4. Add corresponding spec content if needed

---

## Troubleshooting

### Loop Stuck on Same Test

- Check `test-state.json` for attempt count
- Review transcripts for repeated errors
- Consider resetting the test or adjusting the spec

### All Tests Blocked

- Check dependency chain - a blocked test blocks dependents
- Review the first blocked test for root cause
- May need manual intervention to unblock

### Agent Not Making Progress

- Check if spec content is clear
- Review previous attempt transcripts
- Consider adding more context to the spec

### Loop Not Responding

- Check `health.json` for last heartbeat time
- If stale (>2 minutes), the loop may be hung
- Check terminal for errors or Claude API issues

---

## Extending the System

### Creating a New Loop

1. Create a new directory: `coding-loops/loop-N-name/`
2. Create `config.json` from template:

```json
{
  "name": "Loop N: Name",
  "specs_dir": "coding-loops/loop-N-name/specs",
  "test_state_file": "test-state.json",
  "model": "claude-opus-4-5-20251101",
  "priority": 5
}
```

3. Create `run_loop.py` extending `RalphLoopRunner`:

```python
from ralph_loop_base import RalphLoopRunner, load_config

class MyLoop(RalphLoopRunner):
    def get_spec_content(self, test_id: str) -> str:
        # Return spec content for the test
        pass

    def build_system_prompt(self) -> str:
        # Return system prompt for the agent
        pass
```

4. Create `specs/test-state.json` with tests
5. Create `specs/00-overview.md` with specs

---

_Created: 2026-01-07_
_Last Updated: 2026-01-07_
