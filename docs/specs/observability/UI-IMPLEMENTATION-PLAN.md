# Observability UI Implementation Plan

> **Purpose:** Comprehensive implementation plan for the Observability UI components
> **Created:** 2026-01-16
> **Based on:** First principles analysis of [SPEC.md](./SPEC.md) and [ui/README.md](./ui/README.md)

---

## Executive Summary

This plan implements a complete observability UI for the Idea Incubator's agent system. The implementation follows a strict dependency order: **Types → Backend API → Hooks → Base Components → Composite Components → Integration**.

**Current State:**

- [x] Database schema exists (migrations 087, 088)
- [x] Backend services exist (`server/services/observability/`)
- [x] API routes for observability data (10 endpoints complete)
- [x] Backend types (`server/types/observability.ts`)
- [ ] Frontend types for observability
- [ ] Frontend hooks for data fetching
- [ ] Frontend components

**Target State:**

- [ ] Full observability dashboard integrated into Agent Dashboard
- [ ] Real-time updates via WebSocket
- [ ] Deep linking for all entities
- [ ] Rich visualizations (timeline, heat map, sparklines, flow diagram)

---

## First Principles Analysis

### Core Problem

Humans need to verify and understand what agents are doing. The system must transform raw observability data into human-reviewable insights.

### Key Constraints

1. **Real-time updates** - WebSocket streaming required
2. **Deep linking** - Every entity addressable via URL
3. **Progressive disclosure** - Summary → Detail drill-down
4. **Cross-referencing** - No context switching between related entities
5. **Integration** - Must work within existing Agent Dashboard

### Critical Path Dependencies

```
Types (shared contract)
    └── API Routes (data exposure)
            └── Frontend Types (mirrored)
                    └── Hooks (data fetching abstraction)
                            └── Base Components (atomic UI pieces)
                                    └── Composite Components (assembled views)
                                            └── Integration (Agent Dashboard tab)
                                                    └── WebSocket (real-time layer)
```

---

## Phase 1: Foundation (Types & API)

### 1.1 Backend Types

- [x] **File:** `server/types/observability.ts`
- **Effort:** Low
- **Dependencies:** None

**Tasks:**

- [x] Create `TranscriptEntry` and `TranscriptEntryType` interfaces
- [x] Create `ToolUse`, `ToolResultStatus`, `ToolName`, `ToolCategory` interfaces
- [x] Create `SkillTrace` and `SkillReference` interfaces
- [x] Create `AssertionResult`, `AssertionCategory`, `AssertionEvidence`, `AssertionChain` interfaces
- [x] Create `MessageBusLogEntry` interface
- [x] Create query/filter types for each endpoint
- [x] Export all types from barrel file

**Validation:**

```bash
# Pass Criteria: TypeScript compiles without errors
npx tsc --noEmit server/types/observability.ts
# Expected: exit code 0, no errors
```

### 1.2 API Routes

- [x] **File:** `server/routes/observability.ts`
- **Effort:** Medium
- **Dependencies:** 1.1

**Tasks:**

| Endpoint                                                  | Method | Status |
| --------------------------------------------------------- | ------ | ------ |
| [x] `/api/observability/executions`                       | GET    | ✅     |
| [x] `/api/observability/executions/:id`                   | GET    | ✅     |
| [x] `/api/observability/executions/:id/transcript`        | GET    | ✅     |
| [x] `/api/observability/executions/:id/tool-uses`         | GET    | ✅     |
| [x] `/api/observability/executions/:id/assertions`        | GET    | ✅     |
| [x] `/api/observability/executions/:id/skills`            | GET    | ✅     |
| [x] `/api/observability/executions/:id/tool-summary`      | GET    | ✅     |
| [x] `/api/observability/executions/:id/assertion-summary` | GET    | ✅     |
| [x] `/api/logs/message-bus`                               | GET    | ✅     |
| [x] `/api/observability/cross-refs/:entityType/:entityId` | GET    | ✅     |

**Validation:**

```bash
# Pass Criteria: All API endpoints respond correctly
python3 tests/e2e/test-obs-phase1-api.py
# Expected: All 10 endpoints return 200 OK with valid JSON schema
```

### 1.3 Register Routes

- [x] **File:** `server/api.ts` (line 89, 177)
- **Effort:** Low
- **Dependencies:** 1.2

**Tasks:**

- [x] Import observability router
- [x] Register at `/api/observability` path
- [x] Verify route mounting in server logs

**Validation:**

```bash
# Pass Criteria: Routes appear in server log on startup
npm run dev 2>&1 | grep -i "observability"
# Expected: Route registration messages visible
```

### Phase 1 Completion Criteria

```bash
# Run all Phase 1 tests
npm run test:phase1:obs

# Individual test scripts:
python3 tests/e2e/test-obs-phase1-api.py          # API endpoint tests
npx tsc --noEmit server/types/observability.ts    # Type compilation
curl http://localhost:3001/api/observability/executions | jq .  # Smoke test
```

**Phase 1 Pass/Fail Gate:**

- [x] All 10 API endpoints return valid responses
- [x] TypeScript types compile without errors
- [x] Routes registered in server

---

## Phase 2: Frontend Types & Hooks

### 2.1 Frontend Types

- [ ] **File:** `frontend/src/types/observability.ts`
- **Effort:** Low
- **Dependencies:** 1.1

**Tasks:**

- [ ] Mirror all backend entity types
- [ ] Create API response wrapper types
- [ ] Create component prop types
- [ ] Create WebSocket event types
- [ ] Export all types from barrel

**Validation:**

```bash
# Pass Criteria: Frontend TypeScript compiles
cd frontend && npx tsc --noEmit src/types/observability.ts
# Expected: exit code 0
```

### 2.2 Data Fetching Hooks

- [ ] **File:** `frontend/src/hooks/useObservability.ts`
- **Effort:** Medium
- **Dependencies:** 2.1

**Tasks:**

- [ ] `useExecutions(filters?)` - List executions
- [ ] `useExecution(id)` - Single execution
- [ ] `useTranscript(executionId, filters?)` - Transcript entries
- [ ] `useToolUses(executionId, filters?)` - Tool uses
- [ ] `useAssertions(executionId, filters?)` - Assertions
- [ ] `useSkillTraces(executionId)` - Skill traces
- [ ] `useToolSummary(executionId)` - Aggregated tool stats
- [ ] `useAssertionSummary(executionId)` - Assertion statistics
- [ ] `useCrossRefs(entityType, entityId)` - Cross-references

**Validation:**

```bash
# Pass Criteria: Hooks unit tests pass
cd frontend && npm run test -- --testPathPattern="useObservability"
# Expected: All hook tests pass
```

### 2.3 WebSocket Hook

- [ ] **File:** `frontend/src/hooks/useObservabilityStream.ts`
- **Effort:** Medium
- **Dependencies:** 2.1

**Tasks:**

- [ ] Create WebSocket connection with auto-reconnect
- [ ] Implement exponential backoff (1s, 2s, 4s, 8s, max 30s)
- [ ] Topic subscription/unsubscription methods
- [ ] Event buffer (last 1000 events with FIFO eviction)
- [ ] Connection status indicator
- [ ] Cleanup on unmount

**Validation:**

```bash
# Pass Criteria: WebSocket hook tests pass
cd frontend && npm run test -- --testPathPattern="useObservabilityStream"
# Expected: Connection, reconnection, and event handling tests pass
```

### Phase 2 Completion Criteria

```bash
# Run all Phase 2 tests
npm run test:phase2:obs

# Individual test scripts:
cd frontend && npx tsc --noEmit                           # Type compilation
cd frontend && npm run test -- --testPathPattern="Obs"    # Hook unit tests
```

**Phase 2 Pass/Fail Gate:**

- [x] Frontend types compile without errors
- [x] All 9 data hooks implemented and tested
- [x] WebSocket hook handles reconnection correctly

---

## Phase 3: Base Components

### 3.1 QuickStats

- [ ] **File:** `frontend/src/components/observability/QuickStats.tsx`
- **Effort:** Low
- **Dependencies:** 2.2

**Tasks:**

- [ ] Display active executions count
- [ ] Display tool calls per minute
- [ ] Display pass rate percentage
- [ ] Display error count
- [ ] Display blocked count
- [ ] Display discoveries count
- [ ] Add loading skeleton state
- [ ] Add error state

**Validation:**

```bash
# Pass Criteria: Component renders with mock data
cd frontend && npm run test -- --testPathPattern="QuickStats"
# Expected: Snapshot and unit tests pass
```

### 3.2 ViewSelector

- [ ] **File:** `frontend/src/components/observability/ViewSelector.tsx`
- **Effort:** Low
- **Dependencies:** None (pure UI)

**Tasks:**

- [ ] Tab for Timeline view
- [ ] Tab for Tool Uses view
- [ ] Tab for Assertions view
- [ ] Tab for Skills view
- [ ] Tab for Logs view
- [ ] Active state styling
- [ ] onClick handler for tab switching

**Validation:**

```bash
# Pass Criteria: Component renders and handles clicks
cd frontend && npm run test -- --testPathPattern="ViewSelector"
# Expected: Tab switching tests pass
```

### 3.3 Breadcrumb

- [ ] **File:** `frontend/src/components/observability/Breadcrumb.tsx`
- **Effort:** Low
- **Dependencies:** None (pure UI)

**Tasks:**

- [ ] Accept path segments as prop
- [ ] Render clickable links for each segment
- [ ] Highlight current (last) segment
- [ ] Handle navigation on click

**Validation:**

```bash
# Pass Criteria: Navigation works correctly
cd frontend && npm run test -- --testPathPattern="Breadcrumb"
# Expected: Navigation tests pass
```

### 3.4 StatusBadge

- [ ] **File:** `frontend/src/components/observability/StatusBadge.tsx`
- **Effort:** Low
- **Dependencies:** None (pure UI)

**Tasks:**

- [ ] Success status (green)
- [ ] Error status (red)
- [ ] Blocked status (orange)
- [ ] Skipped status (gray)
- [ ] Warning status (yellow)
- [ ] In-progress status (blue/pulsing)

**Validation:**

```bash
# Pass Criteria: All status variants render correctly
cd frontend && npm run test -- --testPathPattern="StatusBadge"
# Expected: Snapshot tests for all variants pass
```

### Phase 3 Completion Criteria

```bash
# Run all Phase 3 tests
npm run test:phase3:obs

# Individual test scripts:
cd frontend && npm run test -- --testPathPattern="QuickStats|ViewSelector|Breadcrumb|StatusBadge"
```

**Phase 3 Pass/Fail Gate:**

- [ ] All 4 base components render without errors
- [ ] Component unit tests pass
- [ ] Snapshot tests pass

---

## Phase 4: Visualization Components

### 4.1 ExecutionTimeline

- [ ] **File:** `frontend/src/components/observability/ExecutionTimeline.tsx`
- **Effort:** High
- **Dependencies:** 2.2, 3.1-3.4

**Tasks:**

- [ ] `PhaseGantt` sub-component - PRIME/ITERATE/VALIDATE bars
- [ ] `TaskGantt` sub-component - Task bars with status colors
- [ ] `ToolDensityChart` sub-component - Sparkline of tool call frequency
- [ ] `EventMarkers` sub-component - Vertical lines for errors, skills
- [ ] Zoom controls (0.5x to 4x)
- [ ] Click on task to expand
- [ ] Hover tooltip with details
- [ ] Export to PNG button
- [ ] Export to JSON button

**Validation:**

```bash
# Pass Criteria: Timeline renders with test data
cd frontend && npm run test -- --testPathPattern="ExecutionTimeline"
# Expected: Rendering and interaction tests pass

# E2E Puppeteer test
python3 tests/e2e/test-obs-timeline-e2e.py
# Expected: Visual regression and click interaction tests pass
```

### 4.2 ToolUseHeatMap

- [ ] **File:** `frontend/src/components/observability/ToolUseHeatMap.tsx`
- **Effort:** Medium
- **Dependencies:** 2.2, 3.4

**Tasks:**

- [ ] `HeatMapGrid` sub-component - Tool × Time matrix
- [ ] `AnomalyPanel` sub-component - Detected anomalies list
- [ ] 5-minute interval columns
- [ ] Tool category rows (Read, Write, Edit, Bash, etc.)
- [ ] Color coding by status (green/red/orange)
- [ ] Cell click navigation to tool use
- [ ] Anomaly highlighting

**Validation:**

```bash
# Pass Criteria: Heat map renders correctly
cd frontend && npm run test -- --testPathPattern="ToolUseHeatMap"
# Expected: Grid rendering and color coding tests pass

# E2E Puppeteer test
python3 tests/e2e/test-obs-heatmap-e2e.py
# Expected: Cell click navigation works
```

### 4.3 AssertionDashboard

- [ ] **File:** `frontend/src/components/observability/AssertionDashboard.tsx`
- **Effort:** Medium
- **Dependencies:** 2.2, 3.4

**Tasks:**

- [ ] `OverallHealth` sub-component - Pass rate bar
- [ ] `CategorySparklines` sub-component - Per-category trends
- [ ] `FailureList` sub-component - Expandable failure details
- [ ] `AssertionChains` sub-component - Chain visualization
- [ ] Overall pass rate display with trend indicator
- [ ] Click failure to expand evidence

**Validation:**

```bash
# Pass Criteria: Dashboard shows correct stats
cd frontend && npm run test -- --testPathPattern="AssertionDashboard"
# Expected: Calculation and rendering tests pass

# E2E Puppeteer test
python3 tests/e2e/test-obs-assertions-e2e.py
# Expected: Failure expansion and evidence viewing works
```

### 4.4 SkillFlowDiagram

- [ ] **File:** `frontend/src/components/observability/SkillFlowDiagram.tsx`
- **Effort:** High
- **Dependencies:** 2.2, 3.4

**Tasks:**

- [ ] `FlowCanvas` sub-component - Canvas with pan/zoom
- [ ] `SkillNode` sub-component - Skill box with file:line reference
- [ ] `ToolNode` sub-component - Tool box with status
- [ ] `AssertionNode` sub-component - Assertion result box
- [ ] Hierarchical layout (task → skills → tools → assertions)
- [ ] Status-based coloring
- [ ] Node click navigation
- [ ] Export to SVG
- [ ] Export to Mermaid

**Validation:**

```bash
# Pass Criteria: Flow diagram renders hierarchy
cd frontend && npm run test -- --testPathPattern="SkillFlowDiagram"
# Expected: Layout and rendering tests pass

# E2E Puppeteer test
python3 tests/e2e/test-obs-skillflow-e2e.py
# Expected: Pan/zoom and node click work
```

### 4.5 AgentActivityGraph

- [ ] **File:** `frontend/src/components/observability/AgentActivityGraph.tsx`
- **Effort:** Medium
- **Dependencies:** 2.2, 2.3, 3.4

**Tasks:**

- [ ] `ActivityTimeline` sub-component - Per-agent activity bars (last 5 min)
- [ ] `AgentStatusCards` sub-component - Current status cards
- [ ] `AlertPanel` sub-component - Slow/stuck agent alerts
- [ ] Real-time updates via WebSocket
- [ ] Alert threshold (> 3min = slow)
- [ ] Click agent to navigate

**Validation:**

```bash
# Pass Criteria: Real-time updates work
cd frontend && npm run test -- --testPathPattern="AgentActivityGraph"
# Expected: WebSocket integration tests pass

# E2E Puppeteer test with mock WebSocket
python3 tests/e2e/test-obs-agent-activity-e2e.py
# Expected: Real-time updates appear within 200ms
```

### 4.6 UnifiedLogViewer

- [ ] **File:** `frontend/src/components/observability/UnifiedLogViewer.tsx`
- **Effort:** Medium
- **Dependencies:** 2.2, 2.3

**Tasks:**

- [ ] `LogStream` sub-component - Virtual scrolling log list
- [ ] `FilterBar` sub-component - Event type/source/severity filters
- [ ] `SearchBox` sub-component - Text search with debounce
- [ ] Real-time streaming via WebSocket
- [ ] Severity color coding (info, warning, error, critical)
- [ ] Expandable entries with payload
- [ ] Click entity links for navigation

**Validation:**

```bash
# Pass Criteria: Log viewer handles large data
cd frontend && npm run test -- --testPathPattern="UnifiedLogViewer"
# Expected: Virtual scrolling and filter tests pass

# E2E Puppeteer test
python3 tests/e2e/test-obs-logs-e2e.py
# Expected: Filter and search work correctly
```

### Phase 4 Completion Criteria

```bash
# Run all Phase 4 tests
npm run test:phase4:obs

# Individual test scripts:
cd frontend && npm run test -- --testPathPattern="Timeline|HeatMap|Assertion|SkillFlow|AgentActivity|LogViewer"
python3 tests/e2e/test-obs-visualizations-e2e.py  # All visualization E2E tests
```

**Phase 4 Pass/Fail Gate:**

- [ ] All 6 visualization components render without errors
- [ ] Component unit tests pass (>80% coverage)
- [ ] E2E Puppeteer tests pass for all visualizations
- [ ] Performance: No lag with 1000+ entries

---

## Phase 5: Detail Modals

### 5.1 EvidenceViewerModal

- [ ] **File:** `frontend/src/components/observability/EvidenceViewerModal.tsx`
- **Effort:** Medium
- **Dependencies:** 2.2

**Tasks:**

- [ ] Command execution details (command, exit code, duration)
- [ ] Stdout display with syntax highlighting
- [ ] Stderr display with error highlighting
- [ ] File diff viewer (before/after)
- [ ] Related transcript entries list
- [ ] Navigation links to related entities
- [ ] Close button and escape key handling

**Validation:**

```bash
# Pass Criteria: Modal displays evidence correctly
cd frontend && npm run test -- --testPathPattern="EvidenceViewerModal"
# Expected: Content rendering and navigation tests pass
```

### 5.2 SkillTraceViewer

- [ ] **File:** `frontend/src/components/observability/SkillTraceViewer.tsx`
- **Effort:** Medium
- **Dependencies:** 2.2

**Tasks:**

- [ ] Skill file reference (clickable to open file)
- [ ] Invocation context (task, action)
- [ ] Input summary (collapsed by default)
- [ ] Output summary (collapsed by default)
- [ ] Tool calls during skill (list with links)
- [ ] Metrics (duration, tokens, cost)

**Validation:**

```bash
# Pass Criteria: Skill trace displays correctly
cd frontend && npm run test -- --testPathPattern="SkillTraceViewer"
# Expected: Display and expansion tests pass
```

### 5.3 ToolUseLog

- [ ] **File:** `frontend/src/components/observability/ToolUseLog.tsx`
- **Effort:** Medium
- **Dependencies:** 2.2

**Tasks:**

- [ ] Tool name and category display
- [ ] Input display (formatted JSON with syntax highlighting)
- [ ] Output display (formatted with syntax highlighting)
- [ ] Error/block details (if applicable)
- [ ] Cross-references (transcript, task, skill)
- [ ] Previous/next navigation buttons

**Validation:**

```bash
# Pass Criteria: Tool use log displays correctly
cd frontend && npm run test -- --testPathPattern="ToolUseLog"
# Expected: Display and navigation tests pass
```

### Phase 5 Completion Criteria

```bash
# Run all Phase 5 tests
npm run test:phase5:obs

# Individual test scripts:
cd frontend && npm run test -- --testPathPattern="EvidenceViewer|SkillTraceViewer|ToolUseLog"
```

**Phase 5 Pass/Fail Gate:**

- [ ] All 3 detail modals render without errors
- [ ] Modal open/close behavior works correctly
- [ ] Cross-reference navigation works

---

## Phase 6: Container Components

### 6.1 ObservabilityHub

- [ ] **File:** `frontend/src/components/observability/ObservabilityHub.tsx`
- **Effort:** Medium
- **Dependencies:** 3.1-3.4, 4.1-4.6

**Tasks:**

- [ ] Integrate QuickStats at top
- [ ] Add ViewSelector for tab navigation
- [ ] Conditional rendering of view components
- [ ] DeepLinkPanel integration
- [ ] URL sync with current view
- [ ] Loading state handling
- [ ] Error boundary wrapper

**Validation:**

```bash
# Pass Criteria: Hub orchestrates views correctly
cd frontend && npm run test -- --testPathPattern="ObservabilityHub"
# Expected: View switching and state management tests pass

# E2E Puppeteer test
python3 tests/e2e/test-obs-hub-e2e.py
# Expected: Tab navigation and deep linking work
```

### 6.2 ExecutionReviewDashboard

- [ ] **File:** `frontend/src/components/observability/ExecutionReviewDashboard.tsx`
- **Effort:** Medium
- **Dependencies:** 4.1-4.5, 5.1-5.3

**Tasks:**

- [ ] Summary section (status, duration, task count)
- [ ] Metric cards (assertions, skills, tool calls, discoveries)
- [ ] Assertions list with evidence links
- [ ] Unified transcript view
- [ ] Skills used summary
- [ ] Error summary (if any)
- [ ] Export report button

**Validation:**

```bash
# Pass Criteria: Dashboard displays execution details
cd frontend && npm run test -- --testPathPattern="ExecutionReviewDashboard"
# Expected: Summary and metric calculation tests pass
```

### 6.3 DeepLinkPanel

- [ ] **File:** `frontend/src/components/observability/DeepLinkPanel.tsx`
- **Effort:** Medium
- **Dependencies:** 2.2, 3.3

**Tasks:**

- [ ] Breadcrumb navigation
- [ ] Current entity details card
- [ ] Related entities list (transcript, task, skill, assertions)
- [ ] Previous/next navigation
- [ ] Copy deep link button
- [ ] Collapse/expand toggle

**Validation:**

```bash
# Pass Criteria: Deep links work correctly
cd frontend && npm run test -- --testPathPattern="DeepLinkPanel"
# Expected: Navigation and URL generation tests pass
```

### Phase 6 Completion Criteria

```bash
# Run all Phase 6 tests
npm run test:phase6:obs

# Individual test scripts:
cd frontend && npm run test -- --testPathPattern="ObservabilityHub|ExecutionReviewDashboard|DeepLinkPanel"
python3 tests/e2e/test-obs-containers-e2e.py  # Container E2E tests
```

**Phase 6 Pass/Fail Gate:**

- [ ] All 3 container components render without errors
- [ ] View orchestration works correctly
- [ ] Deep linking generates correct URLs

---

## Phase 7: Pages & Routing

### 7.1 ObservabilityPage

- [ ] **File:** `frontend/src/pages/ObservabilityPage.tsx`
- **Effort:** Low
- **Dependencies:** 6.1

**Tasks:**

- [ ] Page wrapper with layout
- [ ] Page title and meta
- [ ] ObservabilityHub integration
- [ ] Error boundary
- [ ] Loading state

**Validation:**

```bash
# Pass Criteria: Page renders correctly
cd frontend && npm run test -- --testPathPattern="ObservabilityPage"
# Expected: Page render tests pass
```

### 7.2 ExecutionReviewPage

- [ ] **File:** `frontend/src/pages/ExecutionReviewPage.tsx`
- **Effort:** Low
- **Dependencies:** 6.2

**Tasks:**

- [ ] Route param extraction (`id`)
- [ ] ExecutionReviewDashboard integration
- [ ] View param support
- [ ] Modal param support (toolUse, assertion, skill)
- [ ] 404 handling for invalid execution ID

**Validation:**

```bash
# Pass Criteria: Page handles route params
cd frontend && npm run test -- --testPathPattern="ExecutionReviewPage"
# Expected: Route param tests pass
```

### 7.3 Update App Routes

- [ ] **File:** `frontend/src/App.tsx`
- **Effort:** Low
- **Dependencies:** 7.1, 7.2

**Tasks:**

- [ ] Add `/observability` route
- [ ] Add `/observability/executions/:id` route
- [ ] Add `/observability/executions/:id/timeline` route
- [ ] Add `/observability/executions/:id/tool-uses/:toolUseId` route
- [ ] Add `/observability/executions/:id/assertions/:assertionId` route
- [ ] Add `/observability/executions/:id/skills/:skillTraceId` route
- [ ] Add navigation link in sidebar/header

**Validation:**

```bash
# Pass Criteria: All routes resolve correctly
python3 tests/e2e/test-obs-routing-e2e.py
# Expected: All 6 routes navigate correctly
```

### Phase 7 Completion Criteria

```bash
# Run all Phase 7 tests
npm run test:phase7:obs

# Individual test scripts:
cd frontend && npm run test -- --testPathPattern="ObservabilityPage|ExecutionReviewPage"
python3 tests/e2e/test-obs-routing-e2e.py
```

**Phase 7 Pass/Fail Gate:**

- [ ] All pages render without errors
- [ ] All routes resolve correctly
- [ ] 404 handling works for invalid IDs

---

## Phase 8: Agent Dashboard Integration

### 8.1 Add Observability Tab

- [ ] **File:** `frontend/src/pages/AgentDashboard.tsx`
- **Effort:** Medium
- **Dependencies:** 6.1

**Tasks:**

- [ ] Add TabBar component (if not existing)
- [ ] Add Observability tab to tab list
- [ ] Conditional rendering of ObservabilityHub
- [ ] Add live indicator when WebSocket connected
- [ ] Preserve existing tab functionality
- [ ] Handle tab switching state
- [ ] Persist selected tab in URL

**Validation:**

```bash
# Pass Criteria: Tab integration works
cd frontend && npm run test -- --testPathPattern="AgentDashboard"
# Expected: Tab switching tests pass

# E2E Puppeteer test
python3 tests/e2e/test-obs-dashboard-integration-e2e.py
# Expected: Tab appears and switches correctly
```

### 8.2 Cross-Navigation

- [ ] **Effort:** Low
- **Dependencies:** 8.1

**Tasks:**

- [ ] Add link from Agent cards to Agent's observability view
- [ ] Add link from Task executor status to Execution observability
- [ ] Add link from Activity feed to related transcript entry
- [ ] Ensure back navigation works correctly

**Validation:**

```bash
# Pass Criteria: Cross-navigation links work
python3 tests/e2e/test-obs-cross-nav-e2e.py
# Expected: All navigation links work correctly
```

### Phase 8 Completion Criteria

```bash
# Run all Phase 8 tests
npm run test:phase8:obs

# Individual test scripts:
cd frontend && npm run test -- --testPathPattern="AgentDashboard"
python3 tests/e2e/test-obs-dashboard-integration-e2e.py
python3 tests/e2e/test-obs-cross-nav-e2e.py
```

**Phase 8 Pass/Fail Gate:**

- [ ] Observability tab appears in Agent Dashboard
- [ ] Tab switching works correctly
- [ ] Cross-navigation links work
- [ ] Live indicator shows connection status

---

## Phase 9: WebSocket Integration

### 9.1 Backend WebSocket Handler

- [ ] **File:** `server/websocket/observability.ts`
- **Effort:** Medium
- **Dependencies:** 1.2

**Tasks:**

- [ ] Add observability topic to WebSocket server
- [ ] Topic format: `monitor=observability[&execution={id}]`
- [ ] Event: `transcript:entry` - New transcript entry
- [ ] Event: `tooluse:start` - Tool use started
- [ ] Event: `tooluse:end` - Tool use completed
- [ ] Event: `tooluse:output` - Tool use output received
- [ ] Event: `assertion:result` - Assertion result recorded
- [ ] Event: `skill:start` - Skill invocation started
- [ ] Event: `skill:end` - Skill invocation completed
- [ ] Event: `messagebus:event` - Message bus event

**Validation:**

```bash
# Pass Criteria: WebSocket events broadcast correctly
python3 tests/e2e/test-obs-websocket-backend-e2e.py
# Expected: All event types broadcast and received
```

### 9.2 Real-Time Updates

- [ ] **Effort:** Medium
- **Dependencies:** 9.1, 2.3

**Tasks:**

- [ ] Connect WebSocket to QuickStats (update counts)
- [ ] Connect WebSocket to ExecutionTimeline (append entries)
- [ ] Connect WebSocket to ToolUseHeatMap (update cells)
- [ ] Connect WebSocket to AssertionDashboard (update sparklines)
- [ ] Connect WebSocket to AgentActivityGraph (update status)
- [ ] Connect WebSocket to UnifiedLogViewer (stream entries)
- [ ] Debounce updates (max 10 updates/sec per component)
- [ ] Handle connection loss gracefully

**Validation:**

```bash
# Pass Criteria: Real-time updates work end-to-end
python3 tests/e2e/test-obs-realtime-e2e.py
# Expected: Updates appear within 200ms of event
```

### Phase 9 Completion Criteria

```bash
# Run all Phase 9 tests
npm run test:phase9:obs

# Individual test scripts:
python3 tests/e2e/test-obs-websocket-backend-e2e.py
python3 tests/e2e/test-obs-realtime-e2e.py
```

**Phase 9 Pass/Fail Gate:**

- [ ] WebSocket handler broadcasts all event types
- [ ] Real-time updates appear within 200ms
- [ ] Connection loss handled gracefully (reconnect with backoff)
- [ ] Debouncing prevents UI overwhelm

---

## Test Suite Summary

### Unit Tests

| Test File                               | Component     | Pass Criteria                  |
| --------------------------------------- | ------------- | ------------------------------ |
| [ ] `useObservability.test.ts`          | Hooks         | All hook return values correct |
| [ ] `QuickStats.test.tsx`               | QuickStats    | Renders with mock data         |
| [ ] `ViewSelector.test.tsx`             | ViewSelector  | Tab switching works            |
| [ ] `Breadcrumb.test.tsx`               | Breadcrumb    | Navigation works               |
| [ ] `StatusBadge.test.tsx`              | StatusBadge   | All variants render            |
| [ ] `ExecutionTimeline.test.tsx`        | Timeline      | Gantt bars render              |
| [ ] `ToolUseHeatMap.test.tsx`           | HeatMap       | Grid renders                   |
| [ ] `AssertionDashboard.test.tsx`       | Assertions    | Stats calculate correctly      |
| [ ] `SkillFlowDiagram.test.tsx`         | SkillFlow     | Nodes render                   |
| [ ] `AgentActivityGraph.test.tsx`       | AgentActivity | Real-time works                |
| [ ] `UnifiedLogViewer.test.tsx`         | LogViewer     | Virtual scroll works           |
| [ ] `EvidenceViewerModal.test.tsx`      | Evidence      | Modal opens/closes             |
| [ ] `SkillTraceViewer.test.tsx`         | SkillTrace    | Details display                |
| [ ] `ToolUseLog.test.tsx`               | ToolLog       | Navigation works               |
| [ ] `ObservabilityHub.test.tsx`         | Hub           | View switching works           |
| [ ] `ExecutionReviewDashboard.test.tsx` | Review        | Summary displays               |
| [ ] `DeepLinkPanel.test.tsx`            | DeepLink      | URLs generated                 |

### API Tests

| Test File                        | Endpoint                                       | Pass Criteria             |
| -------------------------------- | ---------------------------------------------- | ------------------------- |
| [ ] `test-obs-api-executions.py` | `/api/observability/executions`                | Returns paginated list    |
| [ ] `test-obs-api-execution.py`  | `/api/observability/executions/:id`            | Returns execution details |
| [ ] `test-obs-api-transcript.py` | `/api/observability/executions/:id/transcript` | Returns entries           |
| [ ] `test-obs-api-tool-uses.py`  | `/api/observability/executions/:id/tool-uses`  | Returns tool uses         |
| [ ] `test-obs-api-assertions.py` | `/api/observability/executions/:id/assertions` | Returns assertions        |
| [ ] `test-obs-api-skills.py`     | `/api/observability/executions/:id/skills`     | Returns skill traces      |
| [ ] `test-obs-api-summaries.py`  | Summary endpoints                              | Returns aggregated stats  |
| [ ] `test-obs-api-crossrefs.py`  | `/api/observability/cross-refs/:type/:id`      | Returns references        |

### E2E Puppeteer/Chrome Tests

| Test File                        | Flow                                          | Pass Criteria            |
| -------------------------------- | --------------------------------------------- | ------------------------ |
| [ ] `test-obs-e2e-full-flow.py`  | Execution list → detail → tool use → evidence | Complete flow works      |
| [ ] `test-obs-e2e-timeline.py`   | Timeline rendering and interaction            | Zoom, click, export work |
| [ ] `test-obs-e2e-heatmap.py`    | Heat map cell clicks                          | Navigation works         |
| [ ] `test-obs-e2e-assertions.py` | Assertion drill-down                          | Evidence displays        |
| [ ] `test-obs-e2e-skillflow.py`  | Skill flow pan/zoom/click                     | Interactions work        |
| [ ] `test-obs-e2e-realtime.py`   | Real-time WebSocket updates                   | Updates <200ms           |
| [ ] `test-obs-e2e-deeplinks.py`  | All deep link URLs                            | Direct navigation works  |
| [ ] `test-obs-e2e-dashboard.py`  | Agent Dashboard integration                   | Tab switching works      |
| [ ] `test-obs-e2e-cross-nav.py`  | Cross-reference navigation                    | Links work               |

### Test Commands

```bash
# Run all unit tests
cd frontend && npm run test -- --testPathPattern="observability"

# Run all API tests
python3 tests/e2e/test-obs-api-all.py

# Run all E2E Puppeteer tests
python3 tests/e2e/test-obs-e2e-all.py

# Run full test suite
npm run test:obs:all

# Run specific phase tests
npm run test:phase1:obs
npm run test:phase2:obs
npm run test:phase3:obs
npm run test:phase4:obs
npm run test:phase5:obs
npm run test:phase6:obs
npm run test:phase7:obs
npm run test:phase8:obs
npm run test:phase9:obs
```

---

## Implementation Order (Critical Path)

### Week 1: Foundation

- [ ] Day 1-2: Phase 1 (Types & API Routes)
  - [ ] 1.1 Backend types
  - [ ] 1.2 API routes (all 10 endpoints)
  - [ ] 1.3 Route registration
  - [ ] Run `npm run test:phase1:obs`

- [ ] Day 3-4: Phase 2 (Frontend Types & Hooks)
  - [ ] 2.1 Frontend types
  - [ ] 2.2 Data fetching hooks (all 9)
  - [ ] 2.3 WebSocket hook
  - [ ] Run `npm run test:phase2:obs`

- [ ] Day 5: Phase 3 (Base Components)
  - [ ] 3.1 QuickStats
  - [ ] 3.2 ViewSelector
  - [ ] 3.3 Breadcrumb
  - [ ] 3.4 StatusBadge
  - [ ] Run `npm run test:phase3:obs`

### Week 2: Visualizations

- [ ] Day 1-2: Phase 4.1 (ExecutionTimeline)
  - [ ] PhaseGantt sub-component
  - [ ] TaskGantt sub-component
  - [ ] ToolDensityChart sub-component
  - [ ] EventMarkers sub-component
  - [ ] Run timeline tests

- [ ] Day 3: Phase 4.2-4.3 (HeatMap & Assertions)
  - [ ] ToolUseHeatMap
  - [ ] AssertionDashboard
  - [ ] Run heatmap and assertion tests

- [ ] Day 4: Phase 4.4 (SkillFlowDiagram)
  - [ ] FlowCanvas sub-component
  - [ ] SkillNode, ToolNode, AssertionNode sub-components
  - [ ] Run skill flow tests

- [ ] Day 5: Phase 4.5-4.6 (AgentActivity & Logs)
  - [ ] AgentActivityGraph
  - [ ] UnifiedLogViewer
  - [ ] Run `npm run test:phase4:obs`

### Week 3: Integration

- [ ] Day 1-2: Phase 5 (Detail Modals)
  - [ ] EvidenceViewerModal
  - [ ] SkillTraceViewer
  - [ ] ToolUseLog
  - [ ] Run `npm run test:phase5:obs`

- [ ] Day 3: Phase 6 (Container Components)
  - [ ] ObservabilityHub
  - [ ] ExecutionReviewDashboard
  - [ ] DeepLinkPanel
  - [ ] Run `npm run test:phase6:obs`

- [ ] Day 4: Phase 7 (Pages & Routing)
  - [ ] ObservabilityPage
  - [ ] ExecutionReviewPage
  - [ ] App.tsx route updates
  - [ ] Run `npm run test:phase7:obs`

- [ ] Day 5: Phase 8 (Agent Dashboard Integration)
  - [ ] Add Observability tab
  - [ ] Cross-navigation links
  - [ ] Run `npm run test:phase8:obs`

### Week 4: Real-Time & Polish

- [ ] Day 1-2: Phase 9 (WebSocket Integration)
  - [ ] Backend WebSocket handler
  - [ ] Real-time component updates
  - [ ] Run `npm run test:phase9:obs`

- [ ] Day 3-4: Full Test Suite
  - [ ] Run `npm run test:obs:all`
  - [ ] Fix any failing tests
  - [ ] Performance testing with 1000+ entries

- [ ] Day 5: Final Validation
  - [ ] Run `python3 tests/e2e/test-obs-e2e-full-flow.py`
  - [ ] Manual QA pass
  - [ ] Documentation review

---

## File Summary

| Phase | File                                                                 | Type         | Status | LOC Est |
| ----- | -------------------------------------------------------------------- | ------------ | ------ | ------- |
| 1.1   | `server/types/observability.ts`                                      | Types        | [ ]    | 400     |
| 1.2   | `server/routes/observability.ts`                                     | API          | [ ]    | 500     |
| 2.1   | `frontend/src/types/observability.ts`                                | Types        | [ ]    | 350     |
| 2.2   | `frontend/src/hooks/useObservability.ts`                             | Hooks        | [ ]    | 200     |
| 2.3   | `frontend/src/hooks/useObservabilityStream.ts`                       | Hook         | [ ]    | 100     |
| 3.1   | `frontend/src/components/observability/QuickStats.tsx`               | Component    | [ ]    | 80      |
| 3.2   | `frontend/src/components/observability/ViewSelector.tsx`             | Component    | [ ]    | 50      |
| 3.3   | `frontend/src/components/observability/Breadcrumb.tsx`               | Component    | [ ]    | 40      |
| 3.4   | `frontend/src/components/observability/StatusBadge.tsx`              | Component    | [ ]    | 40      |
| 4.1   | `frontend/src/components/observability/ExecutionTimeline.tsx`        | Component    | [ ]    | 350     |
| 4.2   | `frontend/src/components/observability/ToolUseHeatMap.tsx`           | Component    | [ ]    | 250     |
| 4.3   | `frontend/src/components/observability/AssertionDashboard.tsx`       | Component    | [ ]    | 280     |
| 4.4   | `frontend/src/components/observability/SkillFlowDiagram.tsx`         | Component    | [ ]    | 400     |
| 4.5   | `frontend/src/components/observability/AgentActivityGraph.tsx`       | Component    | [ ]    | 200     |
| 4.6   | `frontend/src/components/observability/UnifiedLogViewer.tsx`         | Component    | [ ]    | 220     |
| 5.1   | `frontend/src/components/observability/EvidenceViewerModal.tsx`      | Component    | [ ]    | 180     |
| 5.2   | `frontend/src/components/observability/SkillTraceViewer.tsx`         | Component    | [ ]    | 150     |
| 5.3   | `frontend/src/components/observability/ToolUseLog.tsx`               | Component    | [ ]    | 180     |
| 6.1   | `frontend/src/components/observability/ObservabilityHub.tsx`         | Container    | [ ]    | 200     |
| 6.2   | `frontend/src/components/observability/ExecutionReviewDashboard.tsx` | Container    | [ ]    | 250     |
| 6.3   | `frontend/src/components/observability/DeepLinkPanel.tsx`            | Component    | [ ]    | 150     |
| 7.1   | `frontend/src/pages/ObservabilityPage.tsx`                           | Page         | [ ]    | 50      |
| 7.2   | `frontend/src/pages/ExecutionReviewPage.tsx`                         | Page         | [ ]    | 80      |
| 8.1   | Update `AgentDashboard.tsx`                                          | Modification | [ ]    | 100     |
| 9.1   | `server/websocket/observability.ts`                                  | WebSocket    | [ ]    | 150     |

**Total Estimated LOC:** ~4,580

---

## Test Files to Create

| Test File                                                                               | Type | Phase | Status |
| --------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| [ ] `tests/e2e/test-obs-phase1-api.py`                                                  | API  | 1     |        |
| [ ] `tests/e2e/test-obs-api-all.py`                                                     | API  | 1     |        |
| [ ] `frontend/src/hooks/__tests__/useObservability.test.ts`                             | Unit | 2     |        |
| [ ] `frontend/src/hooks/__tests__/useObservabilityStream.test.ts`                       | Unit | 2     |        |
| [ ] `frontend/src/components/observability/__tests__/QuickStats.test.tsx`               | Unit | 3     |        |
| [ ] `frontend/src/components/observability/__tests__/ViewSelector.test.tsx`             | Unit | 3     |        |
| [ ] `frontend/src/components/observability/__tests__/Breadcrumb.test.tsx`               | Unit | 3     |        |
| [ ] `frontend/src/components/observability/__tests__/StatusBadge.test.tsx`              | Unit | 3     |        |
| [ ] `frontend/src/components/observability/__tests__/ExecutionTimeline.test.tsx`        | Unit | 4     |        |
| [ ] `frontend/src/components/observability/__tests__/ToolUseHeatMap.test.tsx`           | Unit | 4     |        |
| [ ] `frontend/src/components/observability/__tests__/AssertionDashboard.test.tsx`       | Unit | 4     |        |
| [ ] `frontend/src/components/observability/__tests__/SkillFlowDiagram.test.tsx`         | Unit | 4     |        |
| [ ] `frontend/src/components/observability/__tests__/AgentActivityGraph.test.tsx`       | Unit | 4     |        |
| [ ] `frontend/src/components/observability/__tests__/UnifiedLogViewer.test.tsx`         | Unit | 4     |        |
| [ ] `tests/e2e/test-obs-timeline-e2e.py`                                                | E2E  | 4     |        |
| [ ] `tests/e2e/test-obs-heatmap-e2e.py`                                                 | E2E  | 4     |        |
| [ ] `tests/e2e/test-obs-assertions-e2e.py`                                              | E2E  | 4     |        |
| [ ] `tests/e2e/test-obs-skillflow-e2e.py`                                               | E2E  | 4     |        |
| [ ] `tests/e2e/test-obs-agent-activity-e2e.py`                                          | E2E  | 4     |        |
| [ ] `tests/e2e/test-obs-logs-e2e.py`                                                    | E2E  | 4     |        |
| [ ] `tests/e2e/test-obs-visualizations-e2e.py`                                          | E2E  | 4     |        |
| [ ] `frontend/src/components/observability/__tests__/EvidenceViewerModal.test.tsx`      | Unit | 5     |        |
| [ ] `frontend/src/components/observability/__tests__/SkillTraceViewer.test.tsx`         | Unit | 5     |        |
| [ ] `frontend/src/components/observability/__tests__/ToolUseLog.test.tsx`               | Unit | 5     |        |
| [ ] `frontend/src/components/observability/__tests__/ObservabilityHub.test.tsx`         | Unit | 6     |        |
| [ ] `frontend/src/components/observability/__tests__/ExecutionReviewDashboard.test.tsx` | Unit | 6     |        |
| [ ] `frontend/src/components/observability/__tests__/DeepLinkPanel.test.tsx`            | Unit | 6     |        |
| [ ] `tests/e2e/test-obs-hub-e2e.py`                                                     | E2E  | 6     |        |
| [ ] `tests/e2e/test-obs-containers-e2e.py`                                              | E2E  | 6     |        |
| [ ] `frontend/src/pages/__tests__/ObservabilityPage.test.tsx`                           | Unit | 7     |        |
| [ ] `frontend/src/pages/__tests__/ExecutionReviewPage.test.tsx`                         | Unit | 7     |        |
| [ ] `tests/e2e/test-obs-routing-e2e.py`                                                 | E2E  | 7     |        |
| [ ] `tests/e2e/test-obs-dashboard-integration-e2e.py`                                   | E2E  | 8     |        |
| [ ] `tests/e2e/test-obs-cross-nav-e2e.py`                                               | E2E  | 8     |        |
| [ ] `tests/e2e/test-obs-websocket-backend-e2e.py`                                       | E2E  | 9     |        |
| [ ] `tests/e2e/test-obs-realtime-e2e.py`                                                | E2E  | 9     |        |
| [ ] `tests/e2e/test-obs-e2e-full-flow.py`                                               | E2E  | Final |        |
| [ ] `tests/e2e/test-obs-e2e-deeplinks.py`                                               | E2E  | Final |        |
| [ ] `tests/e2e/test-obs-e2e-all.py`                                                     | E2E  | Final |        |

---

## Risk Mitigation

| Risk                          | Mitigation                                                 |
| ----------------------------- | ---------------------------------------------------------- |
| Large component complexity    | Break into sub-components, iterate on each                 |
| WebSocket reliability         | Exponential backoff, reconnection logic, offline indicator |
| Performance with many entries | Virtual scrolling, pagination, debounced updates           |
| Data staleness                | Clear cache on reconnect, timestamp indicators             |
| E2E test flakiness            | Retry logic, explicit waits, stable selectors              |

---

## Success Criteria

**Functional:**

- [ ] All components render without errors
- [ ] All unit tests pass (>80% coverage)
- [ ] All API tests pass
- [ ] All E2E Puppeteer tests pass

**Real-time:**

- [ ] Updates appear within 200ms of event
- [ ] WebSocket reconnects automatically
- [ ] Connection status visible to user

**Navigable:**

- [ ] All deep links work correctly
- [ ] Cross-reference navigation works
- [ ] Browser back/forward works

**Integrated:**

- [ ] Observability tab appears in Agent Dashboard
- [ ] Tab switching works correctly
- [ ] Live indicator shows connection status

**Performant:**

- [ ] No lag with 1000+ entries
- [ ] Virtual scrolling works for large lists
- [ ] Debouncing prevents UI overwhelm

**Tested:**

- [ ] > 80% code coverage on hooks and utils
- [ ] All E2E flows pass
- [ ] Manual QA complete

---

_Implementation starts with Phase 1.1: `server/types/observability.ts`_
