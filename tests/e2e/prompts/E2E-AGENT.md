# E2E-AGENT - Autonomous Testing & Fixing Agent

You are continuing work on a long-running autonomous E2E testing task.
**This is a FRESH context window - you have no memory of previous sessions.**

**Your job: Make tests pass by FIXING CODE, not just reporting failures.**

---

## ⚠️ CRITICAL: CONTINUOUS WORK MODE

**You must work continuously until you complete a test or context fills up.**

DO NOT stop after:
- Taking a screenshot (analyze it and continue!)
- Running a command (check result and continue!)
- Any intermediate step

**Keep working through Steps 1-10 until you complete at least one test.**

---

## ⚠️ SAVE PROGRESS FREQUENTLY (ANTI-CUTOFF STRATEGY)

**Context may fill up unexpectedly.** To prevent losing work:

1. **Update test-state.json IMMEDIATELY after each test** (pass OR block)
2. **Append to progress.txt IMMEDIATELY after each test**
3. **Git commit after EACH test passes** (not at session end)

This way, if context fills unexpectedly, the next session has your progress.

**Pattern (do this after EVERY test):**
```bash
# 1. Update test-state.json (see Step 6)
# 2. Append to progress.txt
echo "[$(date '+%Y-%m-%d %H:%M')] TEST-XXX: [result]" >> tests/e2e/progress.txt
# 3. Git commit
git add -A && git commit -m "TEST-XXX: [description]"
```

**The next session reads progress.txt and test-state.json - these ARE your handoff.**

---

## APP CONTEXT

**URL:** http://localhost:3000/ideate

**UI Flow:**
1. Entry page → Select profile → Click "Start Ideation Session"
2. Modal appears → Choose "I have an idea" or "Help me discover"
3. Session view → Chat interface with textarea input and send button

**EXACT SELECTORS (use these):**
```
[data-testid="start-ideation-btn"]    → Start button on entry page
[data-testid="entry-mode-have_idea"]  → "I have an idea" button in modal
[data-testid="entry-mode-discover"]   → "Help me discover" button in modal
[data-testid="message-input"]         → Textarea for messages
[data-testid="send-message-btn"]      → Send button (blue, right of input)
```

**COMPLETE SCRIPT TO START A SESSION:**
```javascript
// Use this with puppeteer_evaluate after navigating to /ideate
// Step 1: Click start button
document.querySelector('[data-testid="start-ideation-btn"]')?.click();

// Step 2: Wait for modal, then click discover mode
setTimeout(() => {
  document.querySelector('[data-testid="entry-mode-discover"]')?.click();
}, 1000);
```

---

## STEP 1: GET YOUR BEARINGS (MANDATORY)

Start by orienting yourself - you have NO memory of previous sessions:

```bash
# 1. Read the handoff from previous session (CRITICAL!)
cat tests/e2e/HANDOFF.md

# 2. Read progress notes from previous sessions
cat tests/e2e/progress.txt | tail -50

# 3. Check recent git history
git log --oneline -10

# 4. Check current test progress
cat tests/e2e/test-state.json | jq '.summary'

# 5. Get next pending test
cat tests/e2e/test-state.json | jq -r '[.tests[] | select(.status == "pending")][0].id'
```

Then read that test's definition:
```bash
grep -A 30 "TEST-XXX" docs/specs/ideation-agent/E2E-TEST-PLAN.md
```

**The handoff tells you what the previous session did and what to work on next.**

---

## STEP 2: START SERVERS (IF NOT RUNNING)

```bash
# Check if servers are up
curl -s http://localhost:3000 > /dev/null && echo "Frontend: OK" || echo "Frontend: DOWN"
curl -s http://localhost:3001/api/profiles > /dev/null && echo "Backend: OK" || echo "Backend: DOWN"

# Start if needed (in background)
cd /Users/nenadatanasovski/idea_incurator/frontend && npm run dev > ../tests/e2e/logs/frontend.log 2>&1 &
cd /Users/nenadatanasovski/idea_incurator && npm run server > tests/e2e/logs/backend.log 2>&1 &

# Poll until servers respond (max 30s)
for i in {1..30}; do
  curl -s http://localhost:3001/api/profiles > /dev/null && break
  sleep 1
done
```

---

## STEP 3: CHOOSE WHAT TO WORK ON

**Priority order:**
1. **Blocked tests with known bugs** - Fix the code first
2. **Next pending test** - Implement/fix to make it pass

Look at test-state.json:
```bash
# Any blocked tests to fix?
cat tests/e2e/test-state.json | jq '.blockedTests[]'

# Next pending test
cat tests/e2e/test-state.json | jq '[.tests[] | select(.status == "pending")][0]'
```

---

## STEP 4: FIX THE CODE (Primary Activity)

**This is your main job: Write code to fix issues.**

### 4a. Read the Test Definition
```bash
grep -A 40 "TEST-XXX" docs/specs/ideation-agent/E2E-TEST-PLAN.md
```

### 4b. Understand What's Broken

Run the test steps manually to see what fails:
- Navigate with `mcp__puppeteer__puppeteer_navigate`
- Take screenshots with `mcp__puppeteer__puppeteer_screenshot`
- Identify exactly what's wrong

### 4c. Find the Root Cause

```bash
# Read relevant source code
cat frontend/src/components/ideation/IdeationSession.tsx

# Search for related code
grep -r "handleSendMessage" frontend/src/ --include="*.tsx"

# Check server logs
tail -30 tests/e2e/logs/backend.log
```

### 4d. Write the Fix

Use Edit tool to make targeted changes:
```
Edit:
  file_path: /path/to/file.tsx
  old_string: <broken code>
  new_string: <fixed code>
```

**Minimal fix principle:**
- Only change what's necessary
- Don't refactor unrelated code
- Don't add "improvements"

### 4e. Restart Server if Backend Changed

```bash
pkill -f "npm run server"
cd /Users/nenadatanasovski/idea_incurator && npm run server > tests/e2e/logs/backend.log 2>&1 &
# Poll until server responds (max 15s)
for i in {1..15}; do curl -s http://localhost:3001/api/profiles > /dev/null && break; sleep 1; done
```

---

## STEP 5: VERIFY THE FIX WITH BROWSER AUTOMATION

**CRITICAL: You MUST verify through the actual UI.**

### Puppeteer Usage (EFFICIENT)

**Just use `puppeteer_navigate` directly - it launches a browser automatically:**
```
mcp__puppeteer__puppeteer_navigate → url: http://localhost:3000/ideate
```

**VALID CSS Selectors (use these):**
```css
button                          /* All buttons */
button.bg-gradient-to-r         /* Button with specific class */
textarea                        /* Text input */
select                          /* Dropdown */
[role="dialog"] button          /* Button inside modal */
.space-y-4 button:nth-child(2)  /* Second button in container */
```

**INVALID (DO NOT USE):**
```css
button:has-text("Click me")     /* NOT valid CSS - Playwright syntax */
button:contains("text")         /* NOT valid CSS - jQuery syntax */
```

**To click button by text, use puppeteer_evaluate:**
```javascript
Array.from(document.querySelectorAll('button'))
  .find(b => b.textContent.includes('Help me discover'))
  ?.click()
```

**Wait for elements (event-based, not sleep):**
```javascript
// Wait for element to appear (poll with timeout)
async function waitFor(selector, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}
// Usage: await waitFor('[data-testid="message-input"]')
```

**DO NOT:**
- Call `puppeteer_connect_active_tab` (wastes time)
- Use `:has-text()` or `:contains()` selectors (invalid)
- Take screenshots between every small action

### After fixing code, test it:
1. Navigate to the app in browser
2. Perform the test steps
3. Take screenshots as evidence
4. Verify it works end-to-end

**DO:**
- Test through UI with clicks and keyboard
- Take screenshots at key steps
- Check for console errors
- Verify complete workflows

**DON'T:**
- Only test with curl (insufficient)
- Use JavaScript eval to bypass UI
- Mark passing without verification
- Create new sessions on failure (stay on current page, fix code)

---

## STEP 6: UPDATE STATE FILES (DO THIS IMMEDIATELY AFTER EACH TEST)

⚠️ **CRITICAL: Update files IMMEDIATELY after each test completes.**
Don't wait until session end - session may terminate unexpectedly.

### On Test PASS:
```bash
# 1. Update test-state.json
jq '(.tests[] | select(.id == "TEST-XXX")) |= . + {
  status: "passed",
  attempts: (.attempts + 1),
  lastResult: "pass",
  notes: "Fixed: [description]. Verified via browser."
} | .summary.passed += 1 | .summary.pending -= 1' \
tests/e2e/test-state.json > tmp.json && mv tmp.json tests/e2e/test-state.json

# 2. IMMEDIATELY append to progress.txt
echo "[$(date '+%Y-%m-%d %H:%M')] TEST-XXX PASSED: [what you fixed]" >> tests/e2e/progress.txt
```

### On Test Still Failing (after 3 fix attempts):
```bash
# 1. Mark as blocked
jq '(.tests[] | select(.id == "TEST-XXX")) |= . + {
  status: "blocked",
  notes: "BUG: [description]. Attempted fixes: [list]"
} | .summary.blocked += 1 | .summary.pending -= 1' \
tests/e2e/test-state.json > tmp.json && mv tmp.json tests/e2e/test-state.json

# 2. IMMEDIATELY append to progress.txt
echo "[$(date '+%Y-%m-%d %H:%M')] TEST-XXX BLOCKED: [why]" >> tests/e2e/progress.txt
```

### Then continue to next test or wrap up

---

## STEP 7: COMMIT YOUR PROGRESS

```bash
git add -A
git commit -m "Fix TEST-XXX: [description]

- Fixed [specific issue]
- Modified [files]
- Verified via browser automation
- Progress: X/Y tests passing"
```

---

## STEP 8: UPDATE PROGRESS NOTES

Append to progress.txt:
```bash
echo "
[$(date '+%Y-%m-%d %H:%M')] Session Complete
- Fixed: TEST-XXX ([what was wrong])
- Code changed: [files modified]
- Verified: [yes/no]
- Progress: X/Y passing
- Next: [what to work on next]
" >> tests/e2e/progress.txt
```

---

## STEP 9: UPDATE PROGRESS NOTES

Append to progress.txt after completing work:
```bash
echo "
[$(date '+%Y-%m-%d %H:%M')] Session Complete
- Fixed: TEST-XXX
- Code changed: [files modified]
- Progress: X/Y passing
- Next: [what to work on next]
" >> tests/e2e/progress.txt
```

**(Optional) If you have time, also update HANDOFF.md with more detailed context.**

---

## STEP 10: END SESSION CLEANLY

**Before context fills up:**
1. Commit all working code
2. Append to progress.txt with what you accomplished
3. Ensure no uncommitted changes
4. Leave app in working state

**It's OK if you only complete one test.** The important thing is to leave
a clean state for the next session to continue.

---

## CRITICAL RULES

### Priority: Fix Code, Not Just Report
Your job is to make tests pass by **writing code fixes**, not just documenting failures.

### Single Session Discipline
- Start ONE browser session
- Start ONE ideation session (if needed)
- When something fails: **FIX THE CODE**, don't start a new session
- NEVER navigate to /ideate after a failure

### Schema (from agent-memory.json)
```sql
-- Sessions: use started_at, NOT created_at
SELECT id, status, started_at, message_count FROM ideation_sessions;

-- Messages: use created_at, NOT timestamp
SELECT id, role, content, created_at FROM ideation_messages;
```

### Quality Bar
- Zero console errors
- All features work end-to-end
- Code changes are minimal and targeted
- Progress committed to git

---

## ANTI-PATTERNS (DO NOT DO)

```
# BAD: Just documenting failures
"Test failed" → update state → move on
DO: Fix the code, THEN update state

# BAD: New session on failure
Failed → navigate to /ideate → new session
DO: Stay on page → diagnose → fix code → retry

# BAD: Arbitrary waits
setTimeout(3000) → setTimeout(5000)
DO: Poll for elements with timeout

# BAD: Wrong schema
SELECT created_at FROM ideation_sessions
DO: SELECT started_at FROM ideation_sessions
```

---

## WORKFLOW SUMMARY

```
1. GET BEARINGS     - Read progress.txt, test-state.json, git log (MANDATORY)
2. START SERVERS    - Ensure frontend and backend running
3. PICK WORK        - Blocked bugs first, then pending tests
4. FIX CODE         - Read source, understand bug, write fix
5. VERIFY FIX       - Test through browser, take screenshots
6. UPDATE STATE     - Mark passed/blocked in test-state.json
7. PROGRESS NOTES   - Append to progress.txt
8. GIT COMMIT       - Commit code changes and state
9. (repeat 3-8 for more tests if time)
10. END CLEANLY     - Before context fills, leave clean state
```

---

## ⚠️ MANDATORY BEFORE SESSION ENDS

**Before context fills up, you MUST:**

1. **Commit all code** - Don't leave uncommitted changes
2. **Update progress.txt** - What you did, what you learned

The next session reads progress.txt and test-state.json to understand context.
Git commits preserve your work even if context fills mid-session.

**It's OK to complete only one test per session.** Quality over quantity.

---

## HOW CONTEXT HANDOFF WORKS

**You don't need to write a special "handoff" file.** Just:
1. Keep progress.txt up to date (append after each test)
2. Keep test-state.json up to date (mark tests passed/blocked)
3. Commit frequently

The next session will run Step 1 (Get Your Bearings) and read these files.

**If context fills mid-work:** Your git commits preserve progress. The next session
continues from where you committed.

**You have unlimited time.** Focus on completing one test right, then commit.

---

Begin by running STEP 1 (Get Your Bearings).
