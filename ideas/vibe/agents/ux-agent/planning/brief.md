# UX Agent Brief

## Metadata

| Field          | Value      |
| -------------- | ---------- |
| **ID**         | ux-agent   |
| **Title**      | UX Agent   |
| **Complexity** | medium     |
| **Author**     | Human      |
| **Created**    | 2026-01-11 |

---

## Problem

After the Build Agent generates code and Validation Agent confirms it compiles and passes tests, there is no automated way to verify:

1. The UI actually renders correctly in a browser
2. User journeys work end-to-end (click flows, form submissions)
3. Accessibility standards are met (WCAG compliance)
4. Visual regressions haven't been introduced
5. Interactive elements behave as expected

Manual testing is slow, inconsistent, and doesn't scale. We need an agent that can validate the user experience through browser automation.

---

## Solution

UX Agent is a browser-based validation system that:

1. **Uses Puppeteer MCP** for headless browser automation
2. **Runs user journeys** (multi-step click/type flows)
3. **Checks accessibility** (WCAG 2.1 Level AA)
4. **Captures screenshots** for visual comparison
5. **Validates interactions** (buttons, forms, navigation)
6. **Reports issues** through Communication Hub

UX Agent validates that what users see and interact with matches expectations.

---

## MVP Scope

**In Scope:**

- Puppeteer MCP integration for browser control
- User journey definition and execution
- Basic accessibility checks (axe-core)
- Screenshot capture on failure
- Element interaction validation (click, type, wait)
- Pass/fail reporting with screenshots
- Integration with Communication Hub

**Out of Scope:**

- Visual regression comparison (baseline diffing) - deferred to v0.2
- Performance metrics (LCP, FID, CLS)
- Cross-browser testing (Chrome only for MVP)
- Mobile viewport testing
- Network mocking
- Auth flow handling (session injection)

---

## Constraints

1. Must use existing Puppeteer MCP tools (mcp**puppeteer**\*)
2. Must not modify application code
3. Must capture screenshots on failures
4. Must complete journeys within timeout (60s default)
5. Must report through Communication Hub
6. Must provide machine-readable results (JSON)
7. Must be idempotent (same journey = same result)

---

## Success Criteria

1. Can navigate to a URL and verify page loads
2. Can click elements and verify state changes
3. Can fill forms and submit
4. Can detect accessibility violations (axe-core)
5. Can capture screenshots on failure
6. Reports issues through Communication Hub
7. Returns structured JSON results with screenshots

---

## Architecture Hints

```
UX Agent Components:
├── ux-orchestrator.ts       - Main entry, journey selection
├── journey-runner.ts        - Execute multi-step journeys
├── journey-definitions.ts   - Define reusable journeys
├── accessibility-checker.ts - axe-core integration
├── screenshot-manager.ts    - Capture and store screenshots
├── element-validator.ts     - Verify element states
├── mcp-bridge.ts            - Puppeteer MCP tool wrapper
└── result-reporter.ts       - Format and report results
```

**Journey Definition Format:**

```typescript
interface Journey {
  id: string;
  name: string;
  description: string;
  steps: JourneyStep[];
  timeout?: number;
}

interface JourneyStep {
  action: "navigate" | "click" | "type" | "wait" | "screenshot" | "assert";
  target?: string; // CSS selector or URL
  value?: string; // Text to type or assertion value
  timeout?: number;
}
```

**Example Journey:**

```typescript
const loginJourney: Journey = {
  id: "login-flow",
  name: "User Login",
  steps: [
    { action: "navigate", target: "http://localhost:3000/login" },
    { action: "type", target: "#email", value: "test@example.com" },
    { action: "type", target: "#password", value: "password123" },
    { action: "click", target: 'button[type="submit"]' },
    { action: "wait", target: ".dashboard" },
    { action: "assert", target: ".welcome-message", value: "Welcome" },
  ],
};
```

**Execution Flow:**

```
1. Load journey definition
2. Navigate to starting URL via MCP
3. For each step:
   a. Execute action via Puppeteer MCP
   b. Wait for result/timeout
   c. Capture screenshot if configured
   d. Record step result
4. Run accessibility check (axe-core)
5. Aggregate results
6. Report through Communication Hub
7. Return results with screenshot paths
```

---

## Database Schema

```sql
-- UX validation run tracking
CREATE TABLE IF NOT EXISTS ux_runs (
    id TEXT PRIMARY KEY,
    build_id TEXT,
    journey_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    passed INTEGER,  -- 0 or 1
    summary_json TEXT
);

-- Individual step results
CREATE TABLE IF NOT EXISTS ux_step_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    status TEXT DEFAULT 'pending',
    passed INTEGER,
    error TEXT,
    screenshot_path TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES ux_runs(id)
);

-- Accessibility issues
CREATE TABLE IF NOT EXISTS ux_accessibility_issues (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    impact TEXT,  -- critical, serious, moderate, minor
    description TEXT,
    selector TEXT,
    help_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES ux_runs(id)
);
```

---

## API Design

| Endpoint                  | Method | Description              |
| ------------------------- | ------ | ------------------------ |
| /api/ux/run               | POST   | Run a journey            |
| /api/ux/:id               | GET    | Get run status           |
| /api/ux/:id/steps         | GET    | Get step results         |
| /api/ux/:id/accessibility | GET    | Get accessibility issues |
| /api/ux/:id/screenshots   | GET    | List screenshots         |
| /api/ux/journeys          | GET    | List available journeys  |
| /api/ux/history           | GET    | Recent run history       |

---

## Risk Mitigation

1. **Flaky selectors**: Prefer data-testid attributes over CSS classes
2. **Timing issues**: Use explicit waits, not sleep
3. **Browser crashes**: Restart browser on failure, retry journey
4. **Large screenshots**: Compress and limit storage
5. **Slow journeys**: Hard timeout per journey (60s default)
6. **Missing elements**: Clear error messages with page screenshot

---

## Dependencies

- Puppeteer MCP tools (mcp**puppeteer**\*)
- axe-core for accessibility (via npm)
- Communication Hub for reporting
- File system for screenshot storage
