# Ralph Loop E2E Testing Agent v2.0

A code-fixing system where a single E2E-AGENT **fixes code to make tests pass**.

**Model:** Claude Opus 4.5 (`claude-opus-4-5-20251101`)
**Harness:** Claude Agent SDK (Python)
**Browser Automation:** Puppeteer MCP
**Philosophy:** Fix first, then verify (like auto-build-agent)

---

## Core Principles

### 1. Fix Code, Don't Just Report Failures

**Your job is to make tests pass by writing code fixes.**

The agent is a developer, not a reporter. When a test fails:

- Read the source code
- Understand the bug
- Write a fix
- Verify it works
- Commit the change

### 2. Verification Before New Work

Before working on new tests, verify 1-2 previously passing tests still work.
If you find regressions, fix them BEFORE moving to new work.

### 3. Mandatory Orientation

Every session MUST start by reading:

1. `agent-memory.json` - Schema, patterns, known bugs
2. `test-state.json` - Current progress
3. `HANDOFF.md` - Context from previous session
4. `git log` - Recent changes

### 4. Fix First, Then Verify

```
Test fails → Read source code → Write fix → Verify via browser → Commit
```

**Not:**

```
Test fails → Document failure → Move on
```

### 5. Single Tab / Single Session Discipline (CRITICAL)

- Start ONE browser tab
- Start ONE ideation session
- When something fails: **FIX THE CODE**, don't start a new session
- NEVER navigate to /ideate after a failure

**This was the #1 problem in the original agent.** It created dozens of orphaned sessions because every failure triggered "navigate to /ideate → start new session" instead of "fix code → retry".

### 6. Git Commits

Commit progress after each fix:

```bash
git add -A
git commit -m "Fix TEST-XXX: [description]"
```

---

## File Structure

```
tests/e2e/
├── ralph_loop.py            # Main entry point (Claude Agent SDK)
├── agent.py                 # Agent session logic
├── client.py                # SDK client configuration
├── security.py              # Bash command security hooks
├── requirements.txt         # Python dependencies
├── ralph-loop.sh            # Legacy bash orchestrator
├── agent-memory.json        # Schema cache, patterns, known bugs
├── test-state.json          # Test status (source of truth)
├── HANDOFF.md               # Inter-session context
├── progress.txt             # Running log of sessions
├── prompts/
│   ├── E2E-AGENT.md             # Main agent instructions
│   ├── DIAGNOSTIC-CHECKPOINT.md # How to diagnose failures
│   └── WAITING-PATTERNS.md      # Event-based waiting examples
└── logs/                    # Per-iteration logs
```

---

## Agent Memory System

`agent-memory.json` persists learning across sessions:

```json
{
  "schema": {
    "ideation_sessions": {
      "columns": ["id", "status", "started_at", "message_count"],
      "notes": "Use started_at, NOT created_at"
    },
    "ideation_messages": {
      "columns": ["id", "role", "content", "created_at"],
      "notes": "Use created_at, NOT timestamp"
    }
  },
  "workingPatterns": [
    {
      "pattern": "Use button clicks",
      "reason": "More reliable than form submit"
    }
  ],
  "failingPatterns": [
    { "pattern": "setTimeout stacking", "symptom": "Unpredictable timing" }
  ],
  "knownBugs": [
    { "id": "BUG-001", "symptom": "Silent redirect on expired session" }
  ]
}
```

---

## Diagnostic Checkpoint

When an action fails, complete this before retrying:

### 1. Collect Evidence

```javascript
// Check UI for errors
document.querySelectorAll('.error, .text-red-500, [role="alert"]');

// Check current URL
window.location.href;
```

```bash
# Check database state
sqlite3 database/ideas.db "SELECT id, status FROM ideation_sessions ORDER BY started_at DESC LIMIT 3"

# Check server logs
tail -20 tests/e2e/logs/backend.log | grep -i error
```

### 2. Form Hypothesis

- What failed?
- What evidence did you find?
- Why do you think it happened?
- What will you change to fix it?

### 3. Fix and Verify

- Make minimal code change
- Restart server if needed
- Re-run test

---

## Waiting Patterns

### Wait for Element

```javascript
(async function () {
  const timeout = 30000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(".expected");
    if (el) return { success: true };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { success: false, error: "timeout" };
})();
```

### Wait for Loading Complete

```javascript
(async function () {
  const timeout = 30000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const loading = document.querySelector('.loading, [aria-busy="true"]');
    if (!loading) return { success: true };
    await new Promise((r) => setTimeout(r, 300));
  }
  return { success: false };
})();
```

---

## Test Execution Flow

```
1. GET BEARINGS
   └── Read agent-memory.json, test-state.json, HANDOFF.md

2. VERIFY SERVERS
   └── curl localhost:3000 and localhost:3001

3. EXECUTE TEST
   ├── Navigate to page
   ├── Take screenshot (start)
   ├── Perform actions
   ├── Wait for results (event-based)
   ├── Take screenshot (end)
   └── Verify all pass criteria

4. ON SUCCESS
   ├── Update test-state.json (status: "passed")
   ├── Update progress.txt
   └── Update HANDOFF.md for next session

5. ON FAILURE
   ├── DIAGNOSTIC CHECKPOINT
   │   ├── Collect evidence
   │   ├── Form hypothesis
   │   └── Identify fix
   ├── Apply fix
   ├── Restart server if needed
   └── Re-run test

6. AFTER 3 FIX ATTEMPTS
   ├── Mark test as "blocked"
   ├── Document thoroughly
   └── Move to next test
```

---

## State File Format

### test-state.json

```json
{
  "tests": [
    {
      "id": "TEST-XXX",
      "status": "pending|passed|blocked",
      "attempts": 0,
      "lastResult": "pass|fail",
      "notes": "Description of result"
    }
  ],
  "blockedTests": [
    {
      "testId": "TEST-XXX",
      "bugId": "BUG-XXX",
      "description": "What is broken"
    }
  ],
  "summary": {
    "total": 64,
    "passed": 16,
    "blocked": 1,
    "pending": 47
  }
}
```

---

## Anti-Patterns to Avoid

| Anti-Pattern            | Problem                   | Correct Pattern            |
| ----------------------- | ------------------------- | -------------------------- |
| `setTimeout` stacking   | Wastes time, unreliable   | Event-based polling        |
| Screenshot spam         | Fills context, no insight | 4 screenshots max per test |
| Blind retries           | Never fixes root cause    | Diagnose → Fix → Retry     |
| New session per failure | Tab proliferation         | Reuse single tab           |
| Wrong schema columns    | Query errors              | Check agent-memory.json    |
| Skip orientation        | Repeat past mistakes      | ALWAYS read memory first   |

---

## Running the Loop

### Prerequisites

```bash
cd /Users/nenadatanasovski/idea_incurator

# Install Python dependencies (one-time)
pip install -r tests/e2e/requirements.txt

# Servers will be auto-started by the orchestrator
```

### Run with Claude Agent SDK (Recommended)

```bash
cd tests/e2e
python ralph_loop.py

# With options:
python ralph_loop.py --max-iterations 10
python ralph_loop.py --model claude-opus-4-5-20251101
```

### Legacy Bash Script

```bash
./tests/e2e/ralph-loop.sh
```

---

## Completion Criteria

The test suite is complete when:

- [ ] All 64 tests attempted
- [ ] All automatable tests passed or blocked (with documented bugs)
- [ ] Summary shows 0 pending

---

## Quick Reference

### Schema (from agent-memory.json)

```sql
-- Sessions
SELECT id, status, started_at, message_count FROM ideation_sessions;
-- NOT created_at!

-- Messages
SELECT id, role, content, created_at FROM ideation_messages;
-- NOT timestamp!
```

### Key Selectors

```
Profile dropdown:  select
Start button:      button.bg-gradient-to-r
Message input:     textarea
Send button:       button[type="submit"]
Messages:          [role="log"] > div
Option buttons:    button.bg-gray-100
Error messages:    .text-red-500, [role="alert"]
```

### API Endpoints

```
POST /api/ideation/start     - Start session
POST /api/ideation/message   - Send message
GET  /api/ideation/session/:id - Get session
POST /api/ideation/session/:id/abandon - Abandon
GET  /api/profiles           - List profiles
```
