# UX Agent Tasks

## Task List

### Phase: Database

#### T-UX-001: Create database migration
```yaml
id: T-UX-001
phase: database
action: CREATE
file: database/migrations/032_ux_agent.sql
status: pending

requirements:
  - Create ux_runs table
  - Create ux_step_results table
  - Create ux_accessibility_issues table
  - Add indexes for run_id foreign keys

validation:
  command: "sqlite3 database/ideas.db '.tables' | grep -c ux_"
  expected: "3"

depends_on: []
```

### Phase: Types

#### T-UX-002: Create TypeScript types
```yaml
id: T-UX-002
phase: types
action: CREATE
file: types/ux.ts
status: pending

requirements:
  - Define JourneyStepAction type
  - Define JourneyStep interface
  - Define Journey interface
  - Define StepResult interface
  - Define AccessibilityIssue interface
  - Define UXRunResult interface
  - Define database row types (UXRun, UXStepResult, UXAccessibilityIssue)

validation:
  command: "npx tsc --noEmit types/ux.ts"
  expected: "exit code 0"

depends_on: [T-UX-001]
```

### Phase: Implementation

#### T-UX-003: Create MCP bridge
```yaml
id: T-UX-003
phase: implementation
action: CREATE
file: agents/ux/mcp-bridge.ts
status: pending

requirements:
  - Create MCPBridge class
  - Implement setTools() for runtime injection
  - Implement navigate() wrapper
  - Implement click() wrapper
  - Implement type() wrapper
  - Implement select() wrapper
  - Implement screenshot() wrapper
  - Implement waitForSelector() wrapper
  - Implement evaluate() wrapper
  - Handle errors gracefully

gotchas:
  - MCP tools not available at import time, must inject at runtime
  - Each method should have proper error handling

validation:
  command: "npx tsc --noEmit agents/ux/mcp-bridge.ts"
  expected: "exit code 0"

depends_on: [T-UX-002]
```

#### T-UX-004: Create screenshot manager
```yaml
id: T-UX-004
phase: implementation
action: CREATE
file: agents/ux/screenshot-manager.ts
status: pending

requirements:
  - Create ScreenshotManager class
  - Implement capture() method
  - Implement getScreenshots() method
  - Implement cleanup() method
  - Create directory structure if not exists
  - Generate unique filenames

gotchas:
  - Screenshots are async, wait for file to be written
  - Use path.join for cross-platform paths

validation:
  command: "npx tsc --noEmit agents/ux/screenshot-manager.ts"
  expected: "exit code 0"

depends_on: [T-UX-003]
```

#### T-UX-005: Create journey definitions
```yaml
id: T-UX-005
phase: implementation
action: CREATE
file: agents/ux/journey-definitions.ts
status: pending

requirements:
  - Define STANDARD_JOURNEYS array
  - Create homepage-load journey
  - Create idea-list journey
  - Implement getJourney() function
  - Implement getJourneysByTag() function
  - Implement registerJourney() function

validation:
  command: "npx tsc --noEmit agents/ux/journey-definitions.ts"
  expected: "exit code 0"

depends_on: [T-UX-002]
```

#### T-UX-006: Create journey runner
```yaml
id: T-UX-006
phase: implementation
action: CREATE
file: agents/ux/journey-runner.ts
status: pending

requirements:
  - Implement runJourney() function
  - Implement executeStep() for each action type
  - Implement executeNavigate()
  - Implement executeClick()
  - Implement executeType()
  - Implement executeWait()
  - Implement executeAssert()
  - Capture screenshots on failure
  - Aggregate step results
  - Fail-fast on first failure

gotchas:
  - Timeouts stack, be careful with step + wait timeouts
  - Selectors may be flaky, clear error messages

validation:
  command: "npx tsc --noEmit agents/ux/journey-runner.ts"
  expected: "exit code 0"

depends_on: [T-UX-003, T-UX-004, T-UX-005]
```

#### T-UX-007: Create accessibility checker
```yaml
id: T-UX-007
phase: implementation
action: CREATE
file: agents/ux/accessibility-checker.ts
status: pending

requirements:
  - Implement checkAccessibility() function
  - Implement injectAxe() to load axe-core
  - Implement runAxe() to execute checks
  - Implement parseAxeResults() to standardize
  - Filter by impact threshold
  - Return AccessibilityIssue[]

gotchas:
  - axe-core must be injected via evaluate(), can't import directly
  - Use CDN or bundled axe-core script

validation:
  command: "npx tsc --noEmit agents/ux/accessibility-checker.ts"
  expected: "exit code 0"

depends_on: [T-UX-003]
```

#### T-UX-008: Create database operations
```yaml
id: T-UX-008
phase: implementation
action: CREATE
file: agents/ux/db.ts
status: pending

requirements:
  - Implement saveUXRun()
  - Implement saveStepResults()
  - Implement saveAccessibilityIssues()
  - Implement getUXRun()
  - Implement getStepResults()
  - Implement getAccessibilityIssues()
  - Implement getRecentRuns()
  - Use sql.js async API pattern

gotchas:
  - Use TEXT for dates in SQLite
  - Use as unknown as TypeName for sql.js types

validation:
  command: "npx tsc --noEmit agents/ux/db.ts"
  expected: "exit code 0"

depends_on: [T-UX-001, T-UX-002]
```

#### T-UX-009: Create orchestrator
```yaml
id: T-UX-009
phase: implementation
action: CREATE
file: agents/ux/orchestrator.ts
status: pending

requirements:
  - Create UXOrchestrator class
  - Implement runJourney() by ID
  - Implement runCustomJourney()
  - Implement checkAccessibility()
  - Implement runJourneysByTag()
  - Coordinate all components
  - Save results to database

validation:
  command: "npx tsc --noEmit agents/ux/orchestrator.ts"
  expected: "exit code 0"

depends_on: [T-UX-006, T-UX-007, T-UX-008]
```

#### T-UX-010: Create index exports
```yaml
id: T-UX-010
phase: implementation
action: CREATE
file: agents/ux/index.ts
status: pending

requirements:
  - Export UXOrchestrator
  - Export journey types and functions
  - Export MCPBridge
  - Export ScreenshotManager

validation:
  command: "npx tsc --noEmit agents/ux/index.ts"
  expected: "exit code 0"

depends_on: [T-UX-009]
```

### Phase: API

#### T-UX-011: Create API routes
```yaml
id: T-UX-011
phase: api
action: CREATE
file: server/routes/ux.ts
status: pending

requirements:
  - POST /api/ux/run - Start journey
  - GET /api/ux/:id - Get run status
  - GET /api/ux/:id/steps - Get step results
  - GET /api/ux/:id/accessibility - Get accessibility issues
  - GET /api/ux/journeys - List journeys
  - GET /api/ux/history - Recent history
  - Proper error handling
  - Return Promise<void> from handlers

gotchas:
  - Express routes need explicit return after res.json()
  - Use Promise<void> return type

validation:
  command: "npx tsc --noEmit server/routes/ux.ts"
  expected: "exit code 0"

depends_on: [T-UX-010]
```

### Phase: Tests

#### T-UX-012: Create unit tests
```yaml
id: T-UX-012
phase: tests
action: CREATE
file: tests/ux-agent.test.ts
status: pending

requirements:
  - Test journey definitions
  - Test step result aggregation
  - Test accessibility issue parsing
  - Test screenshot path generation
  - Mock MCP bridge for unit tests
  - At least 15 tests

validation:
  command: "npx vitest run tests/ux-agent.test.ts"
  expected: "Tests pass"

depends_on: [T-UX-011]
```

---

## Dependency Graph

```
T-UX-001 (migration)
    ↓
T-UX-002 (types)
    ↓
    ├── T-UX-003 (mcp-bridge)
    │       ↓
    │       ├── T-UX-004 (screenshot-manager)
    │       ├── T-UX-007 (accessibility-checker)
    │       └── [T-UX-006]
    │
    ├── T-UX-005 (journey-definitions)
    │       ↓
    │       └── [T-UX-006]
    │
    └── T-UX-008 (db)
            ↓
            └── [T-UX-009]

T-UX-006 (journey-runner) ← T-UX-003, T-UX-004, T-UX-005
    ↓
T-UX-009 (orchestrator) ← T-UX-006, T-UX-007, T-UX-008
    ↓
T-UX-010 (index)
    ↓
T-UX-011 (routes)
    ↓
T-UX-012 (tests)
```

---

## Execution Order

1. T-UX-001 - Database migration
2. T-UX-002 - Types
3. T-UX-003 - MCP bridge
4. T-UX-004 - Screenshot manager
5. T-UX-005 - Journey definitions
6. T-UX-006 - Journey runner
7. T-UX-007 - Accessibility checker
8. T-UX-008 - Database operations
9. T-UX-009 - Orchestrator
10. T-UX-010 - Index exports
11. T-UX-011 - API routes
12. T-UX-012 - Unit tests
