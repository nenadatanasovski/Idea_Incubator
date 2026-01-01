# E2E-AGENT - Autonomous Testing & Fixing Agent

Fresh context window. Read `progress.txt` and `test-state.json` first.
**Your job: Make tests pass by FIXING CODE, not just reporting failures.**

⚠️ **COMMIT AFTER EVERY CODE CHANGE** - Run `git add -A && git commit -m "..."` immediately after any edit.
Uncommitted work is LOST when session ends.

---

## WORKFLOW (8 Steps)

```
1. GET BEARINGS   → Read progress.txt, test-state.json, git log
2. START SERVERS  → Ensure frontend/backend running
3. PICK WORK      → Blocked bugs first, then pending tests
4. FIX CODE       → Read source, understand bug, write fix
5. VERIFY         → Test through browser, take screenshots
6. UPDATE STATE   → Mark passed/blocked, append to progress.txt
7. GIT COMMIT     → Commit after EACH test (not at session end)
8. REPEAT         → Continue with next test until context fills
```

**Commit after EACH test** - this preserves progress if context fills mid-session.

---

## STEP 1: GET BEARINGS

```bash
# 1. Read what the PREVIOUS SESSION was doing when it ended (CRITICAL!)
cat tests/e2e/logs/transcript.log | tail -50

# 2. Read progress notes
cat tests/e2e/progress.txt | tail -30

# 3. Check test state
cat tests/e2e/test-state.json | jq '.summary'
git log --oneline -5
```

**The transcript.log shows the previous session's final actions** - continue from where it left off!

---

## STEP 2: START SERVERS (IF NOT RUNNING)

```bash
curl -s http://localhost:3000 > /dev/null && echo "Frontend: OK" || echo "Frontend: DOWN"
curl -s http://localhost:3001/api/profiles > /dev/null && echo "Backend: OK" || echo "Backend: DOWN"

# Start if needed
cd /Users/nenadatanasovski/idea_incurator/frontend && npm run dev > ../tests/e2e/logs/frontend.log 2>&1 &
cd /Users/nenadatanasovski/idea_incurator && npm run server > tests/e2e/logs/backend.log 2>&1 &

# Wait for backend
for i in {1..30}; do curl -s http://localhost:3001/api/profiles > /dev/null && break; sleep 1; done
```

---

## STEP 3: PICK WORK

**Priority order:**
1. **BLOCKED tests first** - These have known bugs to fix
2. Then pending tests

```bash
# Check for blocked tests FIRST
cat tests/e2e/test-state.json | jq '[.tests[] | select(.status == "blocked")] | length'

# If blocked > 0, work on first blocked test:
cat tests/e2e/test-state.json | jq '[.tests[] | select(.status == "blocked")][0]'

# Only if no blocked tests, get next pending:
cat tests/e2e/test-state.json | jq '[.tests[] | select(.status == "pending")][0]'
```

---

## STEP 4: FIX CODE

1. Read test definition: `grep -A 40 "TEST-XXX" docs/specs/ideation-agent/E2E-TEST-PLAN.md`
2. Navigate browser, take screenshot, identify what's broken
3. Read source code, find root cause
4. Use Edit tool to make targeted fix (minimal changes only)
5. Restart backend if changed: `pkill -f "npm run server" && cd /Users/nenadatanasovski/idea_incurator && npm run server > tests/e2e/logs/backend.log 2>&1 &`

---

## STEP 5: VERIFY FIX

**Puppeteer auto-launches a browser. Just call navigate:**
```
mcp__puppeteer__puppeteer_navigate → url: http://localhost:3000/ideate
```

**DO NOT:**
- Call `puppeteer_connect_active_tab` (causes errors, wastes 5+ tool calls)
- Try to start Chrome manually (`open -a "Google Chrome"`)
- Search for debugging ports

**Click elements:**
```javascript
// By selector
mcp__puppeteer__puppeteer_click → selector: [data-testid="start-ideation-btn"]

// By text (use evaluate)
Array.from(document.querySelectorAll('button'))
  .find(b => b.textContent.includes('Help me discover'))?.click()
```

Take screenshots at key steps. Test through UI, not just curl.

---

## STEP 6: UPDATE STATE (IMMEDIATELY)

**On PASS:**
```bash
jq '(.tests[] | select(.id == "TEST-XXX")) |= . + {
  status: "passed", attempts: (.attempts + 1), lastResult: "pass",
  notes: "Fixed: [description]"
} | .summary.passed += 1 | .summary.pending -= 1' \
tests/e2e/test-state.json > tmp.json && mv tmp.json tests/e2e/test-state.json

echo "[$(date '+%Y-%m-%d %H:%M')] TEST-XXX PASSED: [description]" >> tests/e2e/progress.txt
```

**On BLOCKED (after 3 attempts):**
```bash
jq '(.tests[] | select(.id == "TEST-XXX")) |= . + {
  status: "blocked", notes: "BUG: [description]"
} | .summary.blocked += 1 | .summary.pending -= 1' \
tests/e2e/test-state.json > tmp.json && mv tmp.json tests/e2e/test-state.json

echo "[$(date '+%Y-%m-%d %H:%M')] TEST-XXX BLOCKED: [why]" >> tests/e2e/progress.txt
```

---

## STEP 7: GIT COMMIT

```bash
git add -A && git commit -m "TEST-XXX: [description]"
```

---

## STEP 8: REPEAT

Continue with next pending test. Stop when context fills or all tests done.

---

## APP CONTEXT

**URL:** http://localhost:3000/ideate

**Selectors:**
```
[data-testid="start-ideation-btn"]    → Start button
[data-testid="entry-mode-have_idea"]  → "I have an idea"
[data-testid="entry-mode-discover"]   → "Help me discover"
[data-testid="message-input"]         → Textarea
[data-testid="send-message-btn"]      → Send button
```

**Schema:**
```sql
SELECT id, status, started_at, message_count FROM ideation_sessions;
SELECT id, role, content, created_at FROM ideation_messages;
```

---

## CRITICAL RULES

1. **Commit immediately after ANY code edit** - `git add -A && git commit` right after Edit tool
2. **Fix code, don't just report** - Your job is to make tests pass
3. **Single browser session** - Don't restart browser on failure, fix code instead
4. **Minimal fixes** - Only change what's necessary
5. **No sleep/waits** - Puppeteer waits automatically

---

## ANTI-PATTERNS

```
BAD: sleep 1, sleep 2, setTimeout(3000)
DO:  Poll for elements - puppeteer waits automatically

BAD: "Test failed" → update state → move on
DO:  Fix code → verify → THEN update state

BAD: Failed → navigate to /ideate → new session
DO:  Stay on page → diagnose → fix code → retry

BAD: Using alert(), confirm(), prompt() for debugging
DO:  Use console.log() - alerts block UI and puppeteer can't dismiss them
```

**NEVER use `sleep` or arbitrary waits.** Puppeteer tools wait for elements automatically.
After click/navigate, just take screenshot or interact with next element - no sleep needed.

---

Begin with STEP 1 (Get Your Bearings).
