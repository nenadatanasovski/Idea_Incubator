# E2E Testing with Ralph Loop Agent

A CLI-driven autonomous testing system where each agent instance runs ONE test, then hands off to the next agent.

**Browser Automation: agent-browser CLI**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ralph-loop.sh                            │
│                  (Orchestrator Script)                      │
└─────────────────────────────────────────────────────────────┘
                           │
           Reads HANDOFF.md, spawns appropriate agent
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ TEST-AGENT │  │ BUG-FIXER  │  │ VALIDATOR  │
    │            │  │            │  │            │
    │ Runs ONE   │  │ Fixes ONE  │  │ Validates  │
    │ test       │  │ bug        │  │ fix worked │
    └────────────┘  └────────────┘  └────────────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
              Updates state, writes handoff, EXITS
                           │
                           ▼
              Orchestrator spawns next agent
```

## Key Principles

### 1. CLI Isolation

Each agent is spawned via `claude -p` command as a fresh instance. This ensures:

- No context pollution between tests
- Clean token budget for each agent
- Proper isolation of concerns

### 2. Single Responsibility

- **TEST-AGENT**: Runs exactly ONE test
- **BUG-FIXER-AGENT**: Fixes exactly ONE bug
- **VALIDATOR-AGENT**: Validates exactly ONE fix

### 3. Handoff-Driven Flow

After any action, the agent:

1. Updates state files
2. Writes HANDOFF.md with next action
3. **EXITS** (does not continue)

### 4. Bug-First Priority

When a bug is discovered, testing stops and bug-fixing begins.

### 5. No Test Skipping

Tests are never skipped unless explicitly blocked by dependencies.

## Quick Start

### Prerequisites

1. **Servers Running**

   ```bash
   # Terminal 1: Backend
   cd /Users/nenadatanasovski/idea_incurator
   npm run server

   # Terminal 2: Frontend
   cd /Users/nenadatanasovski/idea_incurator/frontend
   npm run dev
   ```

2. **agent-browser CLI**
   The orchestrator uses agent-browser CLI for browser automation.
   Install globally: `npm install -g agent-browser`
   Verify: `agent-browser --version`

3. **Database Ready**
   ```bash
   npm run migrate
   ```

### Start the Loop

```bash
cd /Users/nenadatanasovski/idea_incurator

# Start the orchestrator
./tests/e2e/ralph-loop.sh
```

The orchestrator will:

1. Check servers are running
2. Read HANDOFF.md for next action
3. Spawn appropriate agent via `claude -p`
4. Wait for agent to complete
5. Repeat until all tests pass

### Manual Single Test

```bash
# Run one specific test
echo "Execute test TEST-SL-001 following tests/e2e/RALPH-LOOP-AGENT.md" | claude -p --allowedTools "Bash(agent-browser:*),Read,Write,Edit"
```

## agent-browser Commands

The agents use these CLI commands for browser automation:

| Command                           | Purpose              | Example                                    |
| --------------------------------- | -------------------- | ------------------------------------------ |
| `agent-browser open <url>`        | Navigate to URL      | `agent-browser open http://localhost:3000` |
| `agent-browser snapshot -i`       | Get interactive refs | Returns elements like `@e1`, `@e2`         |
| `agent-browser click @ref`        | Click element        | `agent-browser click @e1`                  |
| `agent-browser fill @ref "text"`  | Fill input field     | `agent-browser fill @e2 "test message"`    |
| `agent-browser select @ref "val"` | Select dropdown      | `agent-browser select @e3 "default"`       |
| `agent-browser hover @ref`        | Hover element        | `agent-browser hover @e4`                  |
| `agent-browser screenshot <path>` | Capture screenshot   | `agent-browser screenshot ./test.png`      |
| `agent-browser eval "js"`         | Run JS in browser    | `agent-browser eval "document.title"`      |
| `agent-browser wait --text "..."` | Wait for text        | `agent-browser wait --text "Success"`      |
| `agent-browser wait --load idle`  | Wait for network     | `agent-browser wait --load networkidle`    |

### Workflow Pattern

```bash
# 1. Navigate
agent-browser open http://localhost:3000/ideate

# 2. Get element refs
agent-browser snapshot -i
# Output: button "Start" [ref=e1], textbox "Message" [ref=e2]

# 3. Interact using refs
agent-browser click @e1
agent-browser fill @e2 "My idea..."

# 4. Wait and verify
agent-browser wait --text "Response received"
agent-browser screenshot ./evidence.png
```

## Files

| File                  | Purpose                   |
| --------------------- | ------------------------- |
| `ralph-loop.sh`       | Main orchestrator script  |
| `RALPH-LOOP-AGENT.md` | Agent instructions        |
| `test-state.json`     | Test progress and results |
| `HANDOFF.md`          | Context for next agent    |
| `logs/`               | Execution logs            |

## State Management

### test-state.json

```json
{
  "currentTestIndex": 0,
  "runNumber": 0,
  "tests": [
    {"id": "TEST-SL-001", "status": "pending", ...}
  ],
  "summary": {
    "passed": 0, "failed": 0, "blocked": 0, "pending": 64
  }
}
```

### Test Status Values

- `pending` - Not yet attempted
- `passed` - All criteria met
- `blocked` - Bug discovered, needs fix
- `skipped` - Dependency not met

## Monitoring

### Watch Progress

```bash
# In another terminal
watch -n 5 'cat tests/e2e/test-state.json | jq ".summary"'
```

### View Logs

```bash
# Latest log
ls -t tests/e2e/logs/*.log | head -1 | xargs cat

# All recent logs
tail -f tests/e2e/logs/*.log
```

### Check Current State

```bash
cat tests/e2e/HANDOFF.md
cat tests/e2e/test-state.json | jq '{current: .currentTestIndex, summary: .summary}'
```

## Reset

```bash
cd /Users/nenadatanasovski/idea_incurator

# Full reset
rm -f tests/e2e/bootstrap-marker.txt
rm -rf tests/e2e/logs/*

# Reset test-state.json to all pending
# Reset HANDOFF.md to initial state
```

## Agent Types

### TEST-AGENT

- Executes ONE test using agent-browser CLI
- Updates ONLY that test's status
- Creates handoff for next test OR bug-fixer

### BUG-FIXER-AGENT

- Fixes ONE bug
- Makes minimal code changes
- Creates handoff for validator

### VALIDATOR-AGENT

- Re-runs blocked test using agent-browser CLI
- Validates fix worked
- Creates handoff for next test or another fix attempt

## Troubleshooting

### Agent Stuck

```bash
# Kill and restart
Ctrl+C
./tests/e2e/ralph-loop.sh
```

### Servers Not Running

```bash
# Check and start
curl http://localhost:3000 || (cd frontend && npm run dev &)
curl http://localhost:3001/api/profiles || npm run server &
```

### Browser Issues

1. Verify agent-browser is installed: `agent-browser --version`
2. Close any existing browser: `agent-browser close`
3. Restart with headed mode for debugging: `agent-browser open <url> --headed`
4. Check logs for detailed error messages

## Test Plan Reference

Full test definitions: `docs/specs/ideation-agent/E2E-TEST-PLAN.md`

Categories:

- Session Lifecycle (TEST-SL-\*): 8 tests
- Conversation Flow (TEST-CF-\*): 10 tests
- Button Interactions (TEST-BI-\*): 6 tests
- Form Handling (TEST-FH-\*): 4 tests
- Candidate Management (TEST-CM-\*): 8 tests
- Confidence & Viability (TEST-CV-\*): 6 tests
- Memory Persistence (TEST-MP-\*): 4 tests
- Error Handling (TEST-EH-\*): 6 tests
- UI Components (TEST-UI-\*): 8 tests
- End-to-End Journeys (TEST-E2E-\*): 4 tests

**Total: 64 tests**
