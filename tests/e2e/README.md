# E2E Testing with Ralph Loop Agent

A CLI-driven autonomous testing system where each agent instance runs ONE test, then hands off to the next agent.

**Browser Automation: Puppeteer MCP**

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

2. **Puppeteer MCP Server**
   The orchestrator uses Puppeteer MCP tools for browser automation.
   Ensure the Puppeteer MCP server is configured in your Claude Code settings.

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
echo "Execute test TEST-SL-001 following tests/e2e/RALPH-LOOP-AGENT.md" | claude -p --allowedTools "mcp__puppeteer__*,Read,Write,Edit"
```

## Puppeteer MCP Tools

The agents use these tools for browser automation:

| Tool | Purpose | Example |
|------|---------|---------|
| `mcp__puppeteer__puppeteer_navigate` | Navigate to URL | `{"url": "http://localhost:3000/ideate"}` |
| `mcp__puppeteer__puppeteer_screenshot` | Capture screenshot | `{"name": "test-screenshot"}` |
| `mcp__puppeteer__puppeteer_click` | Click element | `{"selector": "button.start-btn"}` |
| `mcp__puppeteer__puppeteer_fill` | Fill input field | `{"selector": "input#message", "value": "test"}` |
| `mcp__puppeteer__puppeteer_select` | Select dropdown | `{"selector": "select#profile", "value": "default"}` |
| `mcp__puppeteer__puppeteer_hover` | Hover element | `{"selector": ".menu-item"}` |
| `mcp__puppeteer__puppeteer_evaluate` | Run JS in browser | `{"script": "document.title"}` |

## Files

| File | Purpose |
|------|---------|
| `ralph-loop.sh` | Main orchestrator script |
| `RALPH-LOOP-AGENT.md` | Agent instructions |
| `test-state.json` | Test progress and results |
| `HANDOFF.md` | Context for next agent |
| `logs/` | Execution logs |

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
- Executes ONE test using Puppeteer MCP
- Updates ONLY that test's status
- Creates handoff for next test OR bug-fixer

### BUG-FIXER-AGENT
- Fixes ONE bug
- Makes minimal code changes
- Creates handoff for validator

### VALIDATOR-AGENT
- Re-runs blocked test using Puppeteer MCP
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

### Puppeteer Browser Issues
1. Check if puppeteer MCP server is running
2. Restart the orchestrator script
3. Check logs for detailed error messages

## Test Plan Reference

Full test definitions: `docs/specs/ideation-agent/E2E-TEST-PLAN.md`

Categories:
- Session Lifecycle (TEST-SL-*): 8 tests
- Conversation Flow (TEST-CF-*): 10 tests
- Button Interactions (TEST-BI-*): 6 tests
- Form Handling (TEST-FH-*): 4 tests
- Candidate Management (TEST-CM-*): 8 tests
- Confidence & Viability (TEST-CV-*): 6 tests
- Memory Persistence (TEST-MP-*): 4 tests
- Error Handling (TEST-EH-*): 6 tests
- UI Components (TEST-UI-*): 8 tests
- End-to-End Journeys (TEST-E2E-*): 4 tests

**Total: 64 tests**
