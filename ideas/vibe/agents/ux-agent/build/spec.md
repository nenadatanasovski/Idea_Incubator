# UX Agent Technical Specification

## Overview

UX Agent validates user experience through browser automation using Puppeteer MCP. It executes user journeys, checks accessibility, and captures screenshots.

---

## Context References

- Brief: `ideas/vibe/agents/ux-agent/planning/brief.md`
- Validation Agent (similar pattern): `agents/validation/`
- SIA Agent (similar pattern): `agents/sia/`

---

## File Structure

```
agents/ux/
├── orchestrator.ts          - Main entry point
├── journey-runner.ts        - Execute journey steps
├── journey-definitions.ts   - Define standard journeys
├── accessibility-checker.ts - axe-core integration
├── screenshot-manager.ts    - Capture and store screenshots
├── mcp-bridge.ts            - Puppeteer MCP wrapper
├── db.ts                    - Database operations
└── index.ts                 - Public exports

server/routes/ux.ts          - API routes
database/migrations/032_ux_agent.sql
types/ux.ts                  - TypeScript types
tests/ux-agent.test.ts       - Unit tests
```

---

## Type Definitions

```typescript
// types/ux.ts

export type JourneyStepAction =
  | 'navigate'
  | 'click'
  | 'type'
  | 'wait'
  | 'screenshot'
  | 'assert'
  | 'select';

export interface JourneyStep {
  action: JourneyStepAction;
  target?: string;      // CSS selector or URL
  value?: string;       // Text to type or expected value
  timeout?: number;     // Step timeout in ms
  description?: string; // Human-readable description
}

export interface Journey {
  id: string;
  name: string;
  description: string;
  startUrl: string;
  steps: JourneyStep[];
  timeout?: number;     // Journey timeout in ms (default 60000)
  tags?: string[];
}

export interface StepResult {
  stepIndex: number;
  action: JourneyStepAction;
  target?: string;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  screenshotPath?: string;
  durationMs: number;
}

export interface AccessibilityIssue {
  ruleId: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  selector: string;
  helpUrl: string;
}

export interface UXRunResult {
  id: string;
  journeyId: string;
  status: 'completed' | 'failed' | 'timeout';
  passed: boolean;
  steps: StepResult[];
  accessibilityIssues: AccessibilityIssue[];
  screenshots: string[];
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

// Database row types
export interface UXRun {
  id: string;
  buildId: string | null;
  journeyId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  passed: number;
  summaryJson: string;
}

export interface UXStepResult {
  id: string;
  runId: string;
  stepIndex: number;
  action: string;
  target: string | null;
  status: string;
  passed: number;
  error: string | null;
  screenshotPath: string | null;
  durationMs: number;
  createdAt: string;
}

export interface UXAccessibilityIssue {
  id: string;
  runId: string;
  ruleId: string;
  impact: string;
  description: string;
  selector: string;
  helpUrl: string;
  createdAt: string;
}
```

---

## Component Specifications

### 1. MCP Bridge (`agents/ux/mcp-bridge.ts`)

Wraps Puppeteer MCP tools for easier use.

```typescript
export interface MCPBridge {
  // Store MCP tool functions (injected at runtime)
  setTools(tools: MCPTools): void;

  // Navigation
  navigate(url: string): Promise<void>;

  // Interactions
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  select(selector: string, value: string): Promise<void>;

  // Screenshots
  screenshot(name: string): Promise<string>; // returns path

  // Waiting
  waitForSelector(selector: string, timeout?: number): Promise<boolean>;

  // Evaluation
  evaluate(script: string): Promise<unknown>;

  // Page info
  getPageText(): Promise<string>;
}
```

**Implementation notes:**
- Store reference to MCP tools passed from caller
- Each method wraps corresponding mcp__puppeteer__* tool
- Handle errors and timeouts gracefully
- Return standardized results

### 2. Journey Runner (`agents/ux/journey-runner.ts`)

Executes journey step by step.

```typescript
export async function runJourney(
  journey: Journey,
  bridge: MCPBridge,
  options?: {
    screenshotOnFailure?: boolean;
    screenshotDir?: string;
  }
): Promise<UXRunResult>;

// Internal functions
function executeStep(
  step: JourneyStep,
  bridge: MCPBridge,
  screenshotManager: ScreenshotManager
): Promise<StepResult>;

function executeNavigate(target: string, bridge: MCPBridge): Promise<void>;
function executeClick(target: string, bridge: MCPBridge): Promise<void>;
function executeType(target: string, value: string, bridge: MCPBridge): Promise<void>;
function executeWait(target: string, timeout: number, bridge: MCPBridge): Promise<void>;
function executeAssert(target: string, value: string, bridge: MCPBridge): Promise<void>;
```

**Execution flow:**
1. Initialize result tracking
2. Navigate to startUrl
3. For each step:
   - Execute step action
   - Record duration
   - Capture screenshot on failure (if enabled)
   - Record result (pass/fail)
   - Stop on first failure (fail-fast)
4. Return aggregated results

### 3. Journey Definitions (`agents/ux/journey-definitions.ts`)

Standard journeys for common flows.

```typescript
export const STANDARD_JOURNEYS: Journey[] = [
  {
    id: 'homepage-load',
    name: 'Homepage Load',
    description: 'Verify homepage loads correctly',
    startUrl: 'http://localhost:5173',
    steps: [
      { action: 'wait', target: 'body', timeout: 5000 },
      { action: 'screenshot', description: 'Homepage loaded' },
    ],
  },
  {
    id: 'idea-list',
    name: 'Idea List Navigation',
    description: 'Navigate to ideas list and verify it loads',
    startUrl: 'http://localhost:5173',
    steps: [
      { action: 'wait', target: 'body' },
      { action: 'click', target: '[data-testid="ideas-link"]' },
      { action: 'wait', target: '[data-testid="ideas-list"]' },
      { action: 'screenshot', description: 'Ideas list' },
    ],
  },
];

export function getJourney(id: string): Journey | undefined;
export function getJourneysByTag(tag: string): Journey[];
export function registerJourney(journey: Journey): void;
```

### 4. Accessibility Checker (`agents/ux/accessibility-checker.ts`)

Runs axe-core accessibility checks via browser evaluation.

```typescript
export async function checkAccessibility(
  bridge: MCPBridge,
  options?: {
    rules?: string[];       // Specific rules to run
    impactThreshold?: 'critical' | 'serious' | 'moderate' | 'minor';
  }
): Promise<AccessibilityIssue[]>;

// Inject axe-core into page and run
async function injectAxe(bridge: MCPBridge): Promise<void>;
async function runAxe(bridge: MCPBridge): Promise<AxeResult>;
function parseAxeResults(results: AxeResult): AccessibilityIssue[];
```

**Implementation notes:**
- Inject axe-core script via evaluate()
- Run axe.run() and parse results
- Filter by impact threshold
- Return standardized AccessibilityIssue[]

### 5. Screenshot Manager (`agents/ux/screenshot-manager.ts`)

Manages screenshot capture and storage.

```typescript
export class ScreenshotManager {
  constructor(baseDir?: string);

  // Capture screenshot with unique name
  capture(bridge: MCPBridge, name: string): Promise<string>;

  // Get all screenshots for a run
  getScreenshots(runId: string): string[];

  // Clean up old screenshots
  cleanup(olderThanDays: number): Promise<number>;
}
```

**Storage format:**
```
screenshots/
  ux-runs/
    {run-id}/
      001-homepage-loaded.png
      002-click-failed.png
```

### 6. Orchestrator (`agents/ux/orchestrator.ts`)

Main entry point coordinating all components.

```typescript
export class UXOrchestrator {
  constructor(bridge: MCPBridge);

  // Run a journey by ID
  async runJourney(journeyId: string, options?: RunOptions): Promise<UXRunResult>;

  // Run a custom journey
  async runCustomJourney(journey: Journey, options?: RunOptions): Promise<UXRunResult>;

  // Run accessibility check on current page
  async checkAccessibility(url: string): Promise<AccessibilityIssue[]>;

  // Run all journeys with a tag
  async runJourneysByTag(tag: string): Promise<UXRunResult[]>;
}

interface RunOptions {
  buildId?: string;
  screenshotOnFailure?: boolean;
  runAccessibility?: boolean;
  timeout?: number;
}
```

### 7. Database Operations (`agents/ux/db.ts`)

```typescript
export async function saveUXRun(run: UXRun): Promise<void>;
export async function saveStepResults(runId: string, steps: StepResult[]): Promise<void>;
export async function saveAccessibilityIssues(runId: string, issues: AccessibilityIssue[]): Promise<void>;
export async function getUXRun(id: string): Promise<UXRun | null>;
export async function getStepResults(runId: string): Promise<UXStepResult[]>;
export async function getAccessibilityIssues(runId: string): Promise<UXAccessibilityIssue[]>;
export async function getRecentRuns(limit?: number): Promise<UXRun[]>;
```

---

## API Routes

### POST /api/ux/run
Start a UX journey run.

**Request:**
```json
{
  "journeyId": "homepage-load",
  "buildId": "build-123",
  "options": {
    "screenshotOnFailure": true,
    "runAccessibility": true
  }
}
```

**Response:**
```json
{
  "runId": "ux-run-456",
  "status": "started"
}
```

### GET /api/ux/:id
Get run status and results.

### GET /api/ux/:id/steps
Get detailed step results.

### GET /api/ux/:id/accessibility
Get accessibility issues.

### GET /api/ux/journeys
List available journeys.

### GET /api/ux/history
Get recent run history.

---

## Database Migration

```sql
-- database/migrations/032_ux_agent.sql

CREATE TABLE IF NOT EXISTS ux_runs (
    id TEXT PRIMARY KEY,
    build_id TEXT,
    journey_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    passed INTEGER,
    summary_json TEXT
);

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

CREATE TABLE IF NOT EXISTS ux_accessibility_issues (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    impact TEXT,
    description TEXT,
    selector TEXT,
    help_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (run_id) REFERENCES ux_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_ux_step_results_run_id ON ux_step_results(run_id);
CREATE INDEX IF NOT EXISTS idx_ux_accessibility_issues_run_id ON ux_accessibility_issues(run_id);
```

---

## Gotchas

1. **MCP tools not available at import time** - Must inject via setTools() at runtime
2. **axe-core must be injected** - Can't import directly, must evaluate in browser context
3. **Screenshots are async** - Wait for file to be written before continuing
4. **Selectors may be flaky** - Prefer data-testid over class selectors
5. **Timeouts stack** - Step timeout + wait timeout can exceed journey timeout
6. **Browser state persists** - Each journey should start from a clean state

---

## Testing Strategy

Unit tests for:
- Journey step execution logic
- Result aggregation
- Accessibility issue parsing
- Screenshot path generation

Integration tests (require browser):
- Full journey execution
- Accessibility checking
- Screenshot capture

Mock MCP bridge for unit tests.
