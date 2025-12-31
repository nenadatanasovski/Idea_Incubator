# Diagnostic Checkpoint Protocol

## WHEN TO USE THIS

Before ANY retry of a failed action, you MUST complete this diagnostic checkpoint.
Do NOT retry blindly - diagnose first, then fix, then retry.

---

## MANDATORY DIAGNOSTIC STEPS

### Step 1: Collect Evidence

```javascript
// 1. Check browser console for errors
mcp__puppeteer__puppeteer_evaluate({
  script: `
    (function() {
      const errors = [];
      // Check for any error elements on page
      document.querySelectorAll('.text-red-500, [role="alert"], .error').forEach(el => {
        errors.push({type: 'ui-error', text: el.textContent.trim()});
      });
      // Check current URL
      errors.push({type: 'url', text: window.location.href});
      return JSON.stringify(errors, null, 2);
    })()
  `
})
```

### Step 2: Check API State

```bash
# Check if session exists in database
sqlite3 database/ideas.db "SELECT id, status, message_count FROM ideation_sessions WHERE id LIKE '<session-id-prefix>%'"

# Check recent messages
sqlite3 database/ideas.db "SELECT id, role, substr(content, 1, 50), created_at FROM ideation_messages WHERE session_id = '<session-id>' ORDER BY created_at DESC LIMIT 5"
```

### Step 3: Check Server Status

```bash
# Verify backend is responding
curl -s http://localhost:3001/api/profiles | head -20

# Check for server errors in logs
tail -20 tests/e2e/logs/backend.log 2>/dev/null || echo "No backend log"
```

### Step 4: Form Hypothesis

Before proceeding, write down:

```markdown
## Diagnostic Results

**Symptom:** [What failed - be specific]

**Evidence Collected:**
- Console errors: [yes/no - list if yes]
- UI errors visible: [yes/no - describe]
- API state: [describe DB state]
- Server status: [running/error]
- Current URL: [where is browser?]

**Root Cause Hypothesis:**
[Your best guess at why this failed]

**Planned Fix:**
[What you will change to fix it]
```

---

## DECISION TREE

```
Action Failed?
    │
    ├── First failure?
    │       │
    │       └── Complete diagnostic checkpoint
    │               │
    │               ├── Found code bug?
    │               │       │
    │               │       └── Fix the code, then retry
    │               │
    │               ├── Found data issue?
    │               │       │
    │               │       └── Clean up data, then retry
    │               │
    │               ├── Found infra issue (server down)?
    │               │       │
    │               │       └── Restart server, then retry
    │               │
    │               └── Cause unknown?
    │                       │
    │                       └── Read source code to understand
    │
    └── Already diagnosed + attempted fix?
            │
            ├── Fix attempt 1 failed?
            │       │
            │       └── Re-diagnose (hypothesis was wrong)
            │
            ├── Fix attempt 2 failed?
            │       │
            │       └── Try different approach
            │
            └── Fix attempt 3 failed?
                    │
                    └── Mark as BLOCKED, document thoroughly, move on
```

---

## ANTI-PATTERNS TO AVOID

### DO NOT do this:

```
Action failed → Wait longer → Retry same action → Wait longer → Retry → ...
```

### DO NOT do this:

```
Action failed → Take screenshot → Take another screenshot → Retry → Screenshot → ...
```

### DO NOT do this:

```
Action failed → Start new session → Action failed → Start new session → ...
```

---

## CORRECT PATTERN

```
Action failed
    → Stop immediately
    → Collect evidence (console, DB, server)
    → Read relevant source code
    → Form hypothesis
    → Make targeted fix
    → Retry once
    → If still fails, re-diagnose (hypothesis was wrong)
```

---

## EVIDENCE COLLECTION QUICK REFERENCE

| Check | Command/Tool | What to Look For |
|-------|--------------|------------------|
| Console errors | puppeteer_evaluate | TypeError, NetworkError, undefined |
| UI errors | puppeteer_screenshot | Red text, error messages, unexpected state |
| Database state | sqlite3 query | Missing records, wrong status, orphaned data |
| Server logs | tail logs/backend.log | Stack traces, connection errors |
| Network | curl API endpoint | 4xx/5xx responses, timeouts |
| Source code | Read tool | Logic errors, missing error handling |

---

## SCHEMA QUICK REFERENCE

**DO NOT** query columns that don't exist. Use these column names:

```sql
-- ideation_sessions
SELECT id, profile_id, entry_mode, status, started_at, ended_at, message_count
FROM ideation_sessions;

-- ideation_messages
SELECT id, session_id, role, content, buttons, created_at, sequence
FROM ideation_messages;

-- NOTE: There is NO 'timestamp' column. Use 'created_at'.
-- NOTE: There is NO 'created_at' in sessions. Use 'started_at'.
```

---

## RECORDING OUTCOMES

After every significant action, record the outcome:

```json
{
  "action": "Click send button",
  "expected": "Message appears in chat",
  "actual": "Redirect to entry page",
  "outcome": "FAILURE",
  "diagnostic": "Session state lost - React unmounted component",
  "fix": "Check session validity before sending"
}
```

This builds a pattern database for future sessions.
