# Event-Based Waiting Patterns

## The Problem with Time-Based Waits

```javascript
// BAD: Arbitrary waits that waste time and are unreliable
new Promise(resolve => setTimeout(resolve, 3000))
new Promise(resolve => setTimeout(resolve, 5000))
new Promise(resolve => setTimeout(resolve, 10000))
```

**Problems:**
- Wastes time when action completes faster
- Still fails when action takes longer
- No feedback on what's actually happening
- Compounds unpredictably

---

## Event-Based Waiting Patterns

### Pattern 1: Wait for Element to Appear

```javascript
// Wait for message to appear after sending
mcp__puppeteer__puppeteer_evaluate({
  script: `
    (async function() {
      const startTime = Date.now();
      const timeout = 30000; // 30 second max

      while (Date.now() - startTime < timeout) {
        // Check for new message element
        const messages = document.querySelectorAll('[role="log"] > div, .message');
        const lastMessage = messages[messages.length - 1];

        if (lastMessage && lastMessage.textContent.includes('expected text')) {
          return { success: true, waitedMs: Date.now() - startTime };
        }

        // Check for error state
        const error = document.querySelector('.text-red-500, [role="alert"]');
        if (error) {
          return { success: false, error: error.textContent, waitedMs: Date.now() - startTime };
        }

        await new Promise(r => setTimeout(r, 500)); // Poll every 500ms
      }

      return { success: false, error: 'timeout', waitedMs: timeout };
    })()
  `
})
```

### Pattern 2: Wait for Loading to Complete

```javascript
mcp__puppeteer__puppeteer_evaluate({
  script: `
    (async function() {
      const startTime = Date.now();
      const timeout = 30000;

      while (Date.now() - startTime < timeout) {
        // Check loading indicators
        const loading = document.querySelector('.loading, [aria-busy="true"], .spinner');

        if (!loading) {
          // No loading indicator - check if content is ready
          const content = document.querySelector('.session-content, .conversation');
          if (content) {
            return { success: true, waitedMs: Date.now() - startTime };
          }
        }

        await new Promise(r => setTimeout(r, 300));
      }

      return { success: false, error: 'timeout waiting for loading', waitedMs: timeout };
    })()
  `
})
```

### Pattern 3: Wait for URL Change

```javascript
mcp__puppeteer__puppeteer_evaluate({
  script: `
    (async function() {
      const startUrl = window.location.href;
      const startTime = Date.now();
      const timeout = 10000;

      while (Date.now() - startTime < timeout) {
        if (window.location.href !== startUrl) {
          return {
            success: true,
            oldUrl: startUrl,
            newUrl: window.location.href,
            waitedMs: Date.now() - startTime
          };
        }
        await new Promise(r => setTimeout(r, 200));
      }

      return { success: false, error: 'URL did not change', url: startUrl };
    })()
  `
})
```

### Pattern 4: Wait for Network Idle

```javascript
mcp__puppeteer__puppeteer_evaluate({
  script: `
    (async function() {
      return new Promise((resolve) => {
        let pendingRequests = 0;
        let lastActivity = Date.now();
        const idleThreshold = 2000; // 2 seconds of no activity
        const maxWait = 30000;
        const startTime = Date.now();

        // Monitor fetch requests
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
          pendingRequests++;
          lastActivity = Date.now();
          try {
            return await originalFetch(...args);
          } finally {
            pendingRequests--;
            lastActivity = Date.now();
          }
        };

        const checkIdle = () => {
          if (Date.now() - startTime > maxWait) {
            window.fetch = originalFetch;
            resolve({ success: false, error: 'timeout' });
            return;
          }

          if (pendingRequests === 0 && Date.now() - lastActivity > idleThreshold) {
            window.fetch = originalFetch;
            resolve({ success: true, waitedMs: Date.now() - startTime });
            return;
          }

          setTimeout(checkIdle, 500);
        };

        checkIdle();
      });
    })()
  `
})
```

### Pattern 5: Wait for Specific Message Count

```javascript
mcp__puppeteer__puppeteer_evaluate({
  script: `
    (async function() {
      const targetCount = 5; // Expected number of messages
      const startTime = Date.now();
      const timeout = 60000; // Longer timeout for multiple messages

      while (Date.now() - startTime < timeout) {
        const messages = document.querySelectorAll('[role="log"] > div, .message-bubble');

        if (messages.length >= targetCount) {
          return {
            success: true,
            messageCount: messages.length,
            waitedMs: Date.now() - startTime
          };
        }

        await new Promise(r => setTimeout(r, 1000));
      }

      const finalCount = document.querySelectorAll('[role="log"] > div, .message-bubble').length;
      return {
        success: false,
        error: 'timeout',
        messageCount: finalCount,
        expected: targetCount
      };
    })()
  `
})
```

---

## When to Use Each Pattern

| Scenario | Pattern to Use |
|----------|----------------|
| After clicking send | Wait for Element (new message) |
| After starting session | Wait for Loading to Complete |
| After clicking abandon | Wait for URL Change |
| After multiple API calls | Wait for Network Idle |
| Testing message persistence | Wait for Message Count |

---

## Timeout Guidelines

| Action | Recommended Timeout | Why |
|--------|---------------------|-----|
| Button click effect | 5 seconds | Simple UI update |
| Send message + response | 30 seconds | AI generation takes time |
| Session start | 15 seconds | API + greeting generation |
| Page navigation | 10 seconds | Route change + render |
| Full conversation load | 60 seconds | Multiple messages to render |

---

## Error Handling in Waits

Always check for error states during waits:

```javascript
// Check for both success AND failure conditions
const error = document.querySelector('.text-red-500, [role="alert"], .error-message');
if (error) {
  return {
    success: false,
    error: error.textContent,
    errorType: 'ui-error'
  };
}

const unexpectedUrl = window.location.pathname === '/ideate';
if (unexpectedUrl && !expectedHere) {
  return {
    success: false,
    error: 'Unexpected navigation to entry page',
    errorType: 'navigation'
  };
}
```

---

## Combining with Diagnostics

If a wait times out, ALWAYS diagnose:

```javascript
const result = await waitForElement('.expected-element');

if (!result.success) {
  // DON'T just retry - diagnose first

  // 1. Check what IS on the page
  const pageContent = document.body.innerText.slice(0, 500);

  // 2. Check current URL
  const currentUrl = window.location.href;

  // 3. Check for error messages
  const errors = document.querySelectorAll('.error, .text-red-500');

  // 4. Return diagnostic info
  return {
    success: false,
    diagnostic: {
      pageContent,
      currentUrl,
      errors: [...errors].map(e => e.textContent),
      expectedElement: '.expected-element'
    }
  };
}
```

---

## Anti-Pattern: Stacking Timeouts

```javascript
// WRONG: Stacking arbitrary waits
await sleep(3000);
// still loading...
await sleep(5000);
// still loading...
await sleep(10000);
// give up or keep going?
```

```javascript
// RIGHT: Single wait with proper timeout and diagnostics
const result = await waitForElement('.expected', { timeout: 30000 });
if (!result.success) {
  // Collect diagnostics and decide next action
  const diagnostic = await collectDiagnostics();
  if (diagnostic.showsError) {
    // Handle error case
  } else if (diagnostic.showsLoading) {
    // Maybe increase timeout once
  } else {
    // Unknown state - investigate
  }
}
```
