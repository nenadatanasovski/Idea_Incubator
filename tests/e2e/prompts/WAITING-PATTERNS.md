# Event-Based Waiting Patterns

## The Problem with Time-Based Waits

```bash
# BAD: Arbitrary waits that waste time and are unreliable
sleep 3
sleep 5
sleep 10
```

**Problems:**

- Wastes time when action completes faster
- Still fails when action takes longer
- No feedback on what's actually happening
- Compounds unpredictably

---

## Event-Based Waiting with agent-browser

### Pattern 1: Wait for Text to Appear

```bash
# Wait for specific text after sending message
agent-browser wait --text "Your idea sounds interesting"

# With custom timeout (default is 30s)
agent-browser wait --text "Success" --timeout 60000
```

### Pattern 2: Wait for Element to Appear

```bash
# Wait for element by ref (from previous snapshot)
agent-browser wait @e5

# Wait for element by selector
agent-browser wait "[data-testid='message-bubble']"

# Wait with timeout
agent-browser wait @e5 --timeout 15000
```

### Pattern 3: Wait for Loading to Complete

```bash
# Wait for network idle (no pending requests for 500ms)
agent-browser wait --load networkidle

# Wait for DOM content loaded
agent-browser wait --load domcontentloaded

# Wait for full page load
agent-browser wait --load load
```

### Pattern 4: Wait for URL Change

```bash
# Wait for URL to match pattern
agent-browser wait --url "**/dashboard"

# Wait for specific URL
agent-browser wait --url "http://localhost:3000/ideate/session/*"
```

### Pattern 5: Wait with Custom JavaScript

```bash
# Wait for custom condition
agent-browser wait --fn "document.querySelectorAll('.message').length >= 5"

# Wait for app-specific state
agent-browser wait --fn "window.appReady === true"
```

### Pattern 6: Wait Fixed Duration (Use Sparingly)

```bash
# Only when other patterns don't apply
agent-browser wait 2000    # Wait 2 seconds
```

---

## Complete Workflow Examples

### Example 1: Send Message and Wait for Response

```bash
# 1. Navigate and snapshot
agent-browser open http://localhost:3000/ideate
agent-browser snapshot -i

# 2. Fill message input (assume @e2 is the textarea)
agent-browser fill @e2 "I have an idea for a productivity app"

# 3. Click send button (assume @e3 is send button)
agent-browser click @e3

# 4. Wait for AI response
agent-browser wait --text "Tell me more"

# 5. Verify with new snapshot
agent-browser snapshot -i
```

### Example 2: Start Session and Wait for Load

```bash
# 1. Click start button
agent-browser click @e1

# 2. Wait for network to settle
agent-browser wait --load networkidle

# 3. Wait for session content
agent-browser wait --text "Welcome"

# 4. Take screenshot for verification
agent-browser screenshot tests/e2e/screenshots/session-started.png
```

### Example 3: Abandon Session and Wait for Navigation

```bash
# 1. Click abandon button
agent-browser click @abandon-btn

# 2. Confirm in dialog if needed
agent-browser dialog accept

# 3. Wait for URL change back to entry page
agent-browser wait --url "**/ideate"

# 4. Verify we're back
agent-browser get url
```

---

## When to Use Each Pattern

| Scenario                    | Pattern to Use                                |
| --------------------------- | --------------------------------------------- |
| After clicking send         | `wait --text "expected response"`             |
| After starting session      | `wait --load networkidle`                     |
| After clicking abandon      | `wait --url "**/ideate"`                      |
| After multiple API calls    | `wait --load networkidle`                     |
| Testing message persistence | `wait --fn "messages.length >= N"`            |
| Waiting for modal           | `wait @modal-ref` or `wait "[role='dialog']"` |

---

## Timeout Guidelines

| Action                  | Recommended Timeout | Command                                   |
| ----------------------- | ------------------- | ----------------------------------------- |
| Button click effect     | 5 seconds           | `wait --text "..." --timeout 5000`        |
| Send message + response | 30 seconds          | `wait --text "..." --timeout 30000`       |
| Session start           | 15 seconds          | `wait --load networkidle --timeout 15000` |
| Page navigation         | 10 seconds          | `wait --url "..." --timeout 10000`        |
| Full conversation load  | 60 seconds          | `wait --fn "..." --timeout 60000`         |

---

## Error Handling in Waits

After a wait, always check the state:

```bash
# After waiting, verify with eval
agent-browser eval "document.querySelector('.text-red-500')?.textContent || 'no error'"

# Or take snapshot to see current state
agent-browser snapshot -i

# Check for specific error states
agent-browser is visible "[role='alert']"
```

---

## Combining with Diagnostics

If a wait times out, diagnose before retrying:

```bash
# 1. Check what IS on the page
agent-browser eval "document.body.innerText.slice(0, 500)"

# 2. Check current URL
agent-browser get url

# 3. Check for error messages
agent-browser eval "Array.from(document.querySelectorAll('.error, .text-red-500')).map(e => e.textContent)"

# 4. Take screenshot for evidence
agent-browser screenshot tests/e2e/screenshots/timeout-diagnostic.png

# 5. Check console errors
agent-browser errors
```

---

## Anti-Pattern: Stacking Waits

```bash
# WRONG: Stacking arbitrary waits
agent-browser wait 3000
# still loading...
agent-browser wait 5000
# still loading...
agent-browser wait 10000
```

```bash
# RIGHT: Single wait with proper condition
agent-browser wait --text "Expected content" --timeout 30000

# If that fails, diagnose
agent-browser snapshot -i
agent-browser errors
agent-browser eval "document.body.innerText.slice(0, 300)"
```

---

## Quick Reference

```bash
# Navigation
agent-browser open <url>

# Waiting
agent-browser wait @ref                    # Element by ref
agent-browser wait --text "..."            # Text content
agent-browser wait --url "**/path"         # URL pattern
agent-browser wait --load networkidle      # Network idle
agent-browser wait --fn "js expression"    # Custom JS
agent-browser wait 2000                    # Fixed ms (avoid)

# State checks
agent-browser is visible @ref
agent-browser is enabled @ref
agent-browser get text @ref
agent-browser eval "js expression"

# Diagnostics
agent-browser snapshot -i
agent-browser screenshot <path>
agent-browser errors
agent-browser console
```
