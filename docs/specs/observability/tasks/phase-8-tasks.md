# Phase 8: UI Components - Task Checklist

> **Implementation Plan:** [implementation-plan-phase-8.md](../implementation-plan-phase-8.md)
> **Status:** Ready for execution

---

## Quick Reference

| Task ID | Component                | Status  | Test Script                   |
| ------- | ------------------------ | ------- | ----------------------------- |
| OBS-800 | ObservabilityHub         | Partial | test-obs-800-hub.sh           |
| OBS-801 | ExecutionTimeline        | Partial | test-obs-801-timeline.sh      |
| OBS-802 | ToolUseHeatMap           | Partial | test-obs-802-heatmap.sh       |
| OBS-803 | AssertionDashboard       | Pending | test-obs-803-assertions.sh    |
| OBS-804 | SkillFlowDiagram         | Partial | test-obs-804-skillflow.sh     |
| OBS-805 | AgentActivityGraph       | Partial | test-obs-805-activity.sh      |
| OBS-806 | UnifiedLogViewer         | Partial | test-obs-806-logviewer.sh     |
| OBS-807 | EvidenceViewerModal      | Pending | test-obs-807-evidence.sh      |
| OBS-808 | QuickStats               | Partial | test-obs-808-quickstats.sh    |
| OBS-809 | ViewSelector             | Partial | test-obs-809-viewselector.sh  |
| OBS-810 | Breadcrumb               | Partial | test-obs-810-breadcrumb.sh    |
| OBS-811 | DeepLinkPanel            | Pending | test-obs-811-deeplinkpanel.sh |
| OBS-812 | ExecutionReviewDashboard | Pending | test-obs-812-review.sh        |
| OBS-813 | SkillTraceViewer         | Pending | test-obs-813-skilltrace.sh    |
| OBS-814 | MessageBusLogViewer      | Pending | test-obs-814-messagebus.sh    |
| OBS-815 | WaveProgressPanel        | Pending | test-obs-815-wave.sh          |
| OBS-816 | ToolUseLog               | Pending | test-obs-816-toollog.sh       |
| OBS-817 | Integration Tests        | Pending | test-obs-817-integration.sh   |
| OBS-818 | Accessibility Tests      | Pending | test-obs-818-a11y.sh          |
| OBS-819 | Visual Regression Tests  | Pending | test-obs-819-visual.sh        |
| OBS-820 | Performance Tests        | Pending | test-obs-820-performance.sh   |
| OBS-821 | Documentation            | Pending | test-obs-821-docs.sh          |

---

## OBS-800: ObservabilityHub Container

**File:** `frontend/src/components/observability/ObservabilityHub.tsx`

### Completed

- [x] View state management with URL sync
- [x] Connection status indicator (Live/Reconnecting/Offline)
- [x] Integration with useObservabilityStream hook

### Remaining

- [ ] Keyboard navigation support (g+t → timeline, g+h → heatmap, etc.)
- [ ] Export functionality (PNG, JSON, Share Link)
- [ ] Error boundary with graceful degradation
- [ ] Loading skeleton for initial data fetch
- [ ] Empty state for no executions

### Test Command

```bash
bash tests/e2e/test-obs-800-hub.sh
```

### Pass Criteria

- [ ] Component renders without errors
- [ ] URL params sync with view state
- [ ] Connection indicator updates in real-time
- [ ] Keyboard shortcuts work (g+t, g+h, g+a, g+s, g+l)
- [ ] Export generates valid output
- [ ] All unit tests pass

---

## OBS-801: ExecutionTimeline

**File:** `frontend/src/components/observability/ExecutionTimeline.tsx`

### Completed

- [x] Phase bars (PRIME, ITERATE, VALIDATE)
- [x] Task bars with status colors
- [x] Zoom controls
- [x] Expandable task details

### Remaining

- [ ] Tool density sparkline per task
- [ ] Event markers (vertical lines for errors, skills)
- [ ] Click-to-navigate to task/entry details
- [ ] Time axis with auto-scaling
- [ ] Export to PNG button
- [ ] Tooltip on hover showing entry details

### Test Command

```bash
bash tests/e2e/test-obs-801-timeline.sh
```

### Pass Criteria

- [ ] Phase bars render with correct colors and labels
- [ ] Task bars show correct duration and status
- [ ] Zoom in/out works smoothly (0.5x to 4x)
- [ ] Tasks expand to show nested entries
- [ ] Tool density sparkline visible under each task
- [ ] Event markers visible for errors and skills
- [ ] Clicking entry navigates to detail view
- [ ] All unit tests pass

---

## OBS-802: ToolUseHeatMap

**File:** `frontend/src/components/observability/ToolUseHeatMap.tsx`

### Completed

- [x] Grid with tools as rows, time intervals as columns
- [x] Color coding by status (success/error/blocked)
- [x] Anomaly detection panel
- [x] Hover state

### Remaining

- [ ] Legend with color explanations
- [ ] Hover tooltip with cell details
- [ ] Click to show tool uses in that cell
- [ ] Summary statistics row/column

### Test Command

```bash
bash tests/e2e/test-obs-802-heatmap.sh
```

### Pass Criteria

- [ ] Grid renders with correct tool rows and time columns
- [ ] Cells colored correctly: green=success, red=error, orange=blocked
- [ ] Anomaly panel shows detected issues with severity
- [ ] Legend clearly explains color meanings
- [ ] Hover shows detailed cell information
- [ ] Click filters tool use list to that cell
- [ ] Summary statistics accurate
- [ ] All unit tests pass

---

## OBS-803: AssertionDashboard

**File:** `frontend/src/components/observability/AssertionDashboard.tsx`

### Completed

- [x] Overall health bar

### Remaining

- [ ] Category sparklines (typescript_compiles, lint_passes, etc.)
- [ ] Failure list with expandable evidence
- [ ] Assertion chain visualization
- [ ] Filter by category/status
- [ ] Real-time updates from WebSocket

### Test Command

```bash
bash tests/e2e/test-obs-803-assertions.sh
```

### Pass Criteria

- [ ] Overall health bar shows correct pass rate
- [ ] Sparklines render for each assertion category
- [ ] Failure list shows failed assertions with details
- [ ] Assertion chains visualize the flow correctly
- [ ] Filters work for category and status
- [ ] Real-time updates appear without refresh
- [ ] All unit tests pass

---

## OBS-804: SkillFlowDiagram

**File:** `frontend/src/components/observability/SkillFlowDiagram.tsx`

### Completed

- [x] Skill nodes with file:line references
- [x] Tool nodes showing invocations

### Remaining

- [ ] Assertion nodes showing validation results
- [ ] Collapsible branches
- [ ] Click to navigate to skill/tool/assertion
- [ ] Export to SVG/Mermaid
- [ ] Zoom/pan controls
- [ ] Legend explaining node types

### Test Command

```bash
bash tests/e2e/test-obs-804-skillflow.sh
```

### Pass Criteria

- [ ] Skill nodes show name, file, line number
- [ ] Tool nodes show tool name, input summary, status
- [ ] Assertion nodes show category, result, evidence link
- [ ] Branches collapse/expand correctly
- [ ] Clicking node navigates to detail view
- [ ] Export produces valid SVG/Mermaid
- [ ] All unit tests pass

---

## OBS-805: AgentActivityGraph

**File:** `frontend/src/components/observability/AgentActivityGraph.tsx`

### Completed

- [x] Agent status cards

### Remaining

- [ ] Activity timeline per agent (last 5 minutes)
- [ ] Alert panel for slow/stuck agents
- [ ] Real-time heartbeat updates
- [ ] Click to view agent details
- [ ] Pause/resume live updates
- [ ] Threshold configuration for alerts

### Test Command

```bash
bash tests/e2e/test-obs-805-activity.sh
```

### Pass Criteria

- [ ] Agent cards show current status and task
- [ ] Activity timeline renders agent history
- [ ] Alert panel detects and displays issues
- [ ] Heartbeat indicator pulses for active agents
- [ ] Pause/resume toggle works
- [ ] Clicking agent navigates to detail view
- [ ] All unit tests pass

---

## OBS-806: UnifiedLogViewer

**File:** `frontend/src/components/observability/UnifiedLogViewer.tsx`

### Completed

- [x] Log entry rendering
- [x] Real-time streaming

### Remaining

- [ ] Filter by event type, source, severity
- [ ] Search across log content
- [ ] Auto-scroll with pause on hover
- [ ] Click to navigate to related entity
- [ ] Export log button
- [ ] Clear button for filter reset

### Test Command

```bash
bash tests/e2e/test-obs-806-logviewer.sh
```

### Pass Criteria

- [ ] Log entries render with timestamp, type, and message
- [ ] Filters work for event type, source, severity
- [ ] Search filters entries by content
- [ ] Auto-scroll to bottom for new entries
- [ ] Scroll pauses when user hovers/scrolls
- [ ] Clicking entry navigates to related entity
- [ ] All unit tests pass

---

## OBS-807: EvidenceViewerModal

**File:** `frontend/src/components/observability/EvidenceViewerModal.tsx`

### Completed

- [x] Modal container with close button

### Remaining

- [ ] Command execution display (command, exit code, duration)
- [ ] Stdout/stderr panels with syntax highlighting
- [ ] File diff viewer with line highlighting
- [ ] Related transcript entries section
- [ ] Navigation to related entities
- [ ] Copy evidence button
- [ ] Keyboard shortcut (Esc to close)

### Test Command

```bash
bash tests/e2e/test-obs-807-evidence.sh
```

### Pass Criteria

- [ ] Modal opens with assertion details
- [ ] Command execution shows command, exit code, duration
- [ ] Stdout panel displays output with proper formatting
- [ ] Stderr panel highlights errors
- [ ] Diff viewer shows file changes with line numbers
- [ ] Related transcript entries are clickable
- [ ] Esc key closes modal
- [ ] All unit tests pass

---

## OBS-808: QuickStats

**File:** `frontend/src/components/observability/QuickStats.tsx`

### Completed

- [x] Active executions count
- [x] Tool calls per minute
- [x] Pass rate percentage
- [x] Error count with link

### Remaining

- [ ] Discovery count
- [ ] Real-time updates from WebSocket
- [ ] Sparkline trends
- [ ] Click handlers to navigate to filtered views
- [ ] Loading skeleton

### Test Command

```bash
bash tests/e2e/test-obs-808-quickstats.sh
```

### Pass Criteria

- [ ] All 5 metrics displayed correctly
- [ ] Mini sparklines show recent trends
- [ ] Values update in real-time
- [ ] Clicking metric navigates to filtered view
- [ ] Loading skeleton shown during fetch
- [ ] All unit tests pass

---

## OBS-809: ViewSelector

**File:** `frontend/src/components/observability/ViewSelector.tsx`

### Completed

- [x] Tab buttons for all views
- [x] Active state highlighting
- [x] Click to switch view

### Remaining

- [ ] Keyboard navigation (arrow keys)
- [ ] Badge showing counts (errors, etc.)
- [ ] Mobile-friendly dropdown fallback
- [ ] Tooltips explaining each view

### Test Command

```bash
bash tests/e2e/test-obs-809-viewselector.sh
```

### Pass Criteria

- [ ] All 6 views have tabs
- [ ] Active tab visually highlighted
- [ ] Clicking tab switches view
- [ ] Arrow keys navigate between tabs
- [ ] Badge shows relevant counts
- [ ] Mobile dropdown works on narrow screens
- [ ] All unit tests pass

---

## OBS-810: Breadcrumb

**File:** `frontend/src/components/observability/Breadcrumb.tsx`

### Completed

- [x] Shows current location hierarchy
- [x] Each segment is clickable

### Remaining

- [ ] Copy link button
- [ ] Truncation for long paths
- [ ] Home icon for root

### Test Command

```bash
bash tests/e2e/test-obs-810-breadcrumb.sh
```

### Pass Criteria

- [ ] Breadcrumb shows full path
- [ ] Each segment navigates on click
- [ ] Copy button copies URL to clipboard
- [ ] Long paths truncated appropriately
- [ ] All unit tests pass

---

## OBS-811: DeepLinkPanel

**File:** `frontend/src/components/observability/DeepLinkPanel.tsx`

### Status: Needs Creation

### Requirements

- [ ] Entity details section (based on entity type)
- [ ] Cross-references to related entities
- [ ] Navigation links to related items
- [ ] Copy deep link URL
- [ ] Close button

### Test Command

```bash
bash tests/e2e/test-obs-811-deeplinkpanel.sh
```

### Pass Criteria

- [ ] Panel shows current entity details
- [ ] Cross-references link to related entities
- [ ] Clicking reference navigates correctly
- [ ] Copy URL works
- [ ] All unit tests pass

---

## OBS-812: ExecutionReviewDashboard

**File:** `frontend/src/components/observability/ExecutionReviewDashboard.tsx`

### Status: Needs Creation

### Requirements

- [ ] Summary section with key metrics
- [ ] Assertions list with evidence links
- [ ] Unified transcript with search
- [ ] Skills used summary
- [ ] Export options (JSON, PDF report)

### Test Command

```bash
bash tests/e2e/test-obs-812-review.sh
```

### Pass Criteria

- [ ] Summary shows status, duration, task count
- [ ] Assertions filterable and expandable
- [ ] Transcript searchable and scrollable
- [ ] Skills summary shows usage patterns
- [ ] Export produces valid output
- [ ] All unit tests pass

---

## OBS-813: SkillTraceViewer

**File:** `frontend/src/components/observability/SkillTraceViewer.tsx`

### Status: Needs Creation

### Requirements

- [ ] Skill file reference with link
- [ ] Invocation context (task, input, output)
- [ ] Tool calls made during skill
- [ ] Metrics (duration, tokens)
- [ ] Status indicator
- [ ] Navigation to related items

### Test Command

```bash
bash tests/e2e/test-obs-813-skilltrace.sh
```

### Pass Criteria

- [ ] Skill file reference clickable
- [ ] Context shows task and summaries
- [ ] Tool calls listed with details
- [ ] Metrics displayed correctly
- [ ] All unit tests pass

---

## OBS-814: MessageBusLogViewer

**File:** `frontend/src/components/observability/MessageBusLogViewer.tsx`

### Status: Needs Creation

### Requirements

- [ ] Real-time event streaming
- [ ] Filter by event type and source
- [ ] Severity-based styling
- [ ] Action buttons for actionable events
- [ ] Jump to related entity

### Test Command

```bash
bash tests/e2e/test-obs-814-messagebus.sh
```

### Pass Criteria

- [ ] Events stream in real-time
- [ ] Filters work correctly
- [ ] Severity styles applied
- [ ] Action buttons functional
- [ ] Navigation works
- [ ] All unit tests pass

---

## OBS-815: WaveProgressPanel

**File:** `frontend/src/components/observability/WaveProgressPanel.tsx`

### Status: Needs Creation

### Requirements

- [ ] Wave progress bars
- [ ] Task assignment per wave
- [ ] Status indicators
- [ ] Duration metrics
- [ ] Agent allocation visualization

### Test Command

```bash
bash tests/e2e/test-obs-815-wave.sh
```

### Pass Criteria

- [ ] Wave progress bars show completion
- [ ] Tasks listed per wave
- [ ] Status indicators correct
- [ ] Duration displayed
- [ ] All unit tests pass

---

## OBS-816: ToolUseLog

**File:** `frontend/src/components/observability/ToolUseLog.tsx`

### Status: Needs Creation

### Requirements

- [ ] Tool use list with details
- [ ] Filter by tool type, status
- [ ] Search by input/output
- [ ] Click to expand full details
- [ ] Navigation to related entities
- [ ] List virtualization for performance

### Test Command

```bash
bash tests/e2e/test-obs-816-toollog.sh
```

### Pass Criteria

- [ ] Tool uses listed with key details
- [ ] Filters work correctly
- [ ] Search filters by content
- [ ] Expand shows full details
- [ ] All unit tests pass

---

## OBS-817: Integration Tests

### Test Script Location

`tests/e2e/test-obs-817-integration.sh`

### Pass Criteria

- [ ] Backend API responding
- [ ] Observability endpoints work
- [ ] Frontend route accessible
- [ ] WebSocket server exists
- [ ] All components present
- [ ] Type definitions exist
- [ ] Hooks exist
- [ ] All component tests pass

---

## OBS-818: Accessibility Tests

### Test Script Location

`tests/e2e/test-obs-818-a11y.sh`

### Pass Criteria

- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Focus properly managed
- [ ] Color contrast meets WCAG AA
- [ ] All a11y tests pass

---

## OBS-819: Visual Regression Tests

### Test Script Location

`tests/e2e/test-obs-819-visual.sh`

### Pass Criteria

- [ ] Visual testing tool configured
- [ ] Story files for main components
- [ ] Snapshots up to date
- [ ] No visual regressions detected

---

## OBS-820: Performance Tests

### Test Script Location

`tests/e2e/test-obs-820-performance.sh`

### Pass Criteria

- [ ] List virtualization for 100+ items
- [ ] useMemo/useCallback for expensive computations
- [ ] No unnecessary re-renders
- [ ] Bundle size reasonable
- [ ] Renders < 16ms for smooth 60fps

---

## OBS-821: Documentation

### Test Script Location

`tests/e2e/test-obs-821-docs.sh`

### Pass Criteria

- [ ] README in observability components folder
- [ ] JSDoc comments on public APIs
- [ ] Storybook stories for all components
- [ ] Usage examples in documentation

---

## Execution Order

### Phase 8A: Core Components (Priority)

1. OBS-800: ObservabilityHub (enhancement)
2. OBS-808: QuickStats (enhancement)
3. OBS-809: ViewSelector (enhancement)
4. OBS-801: ExecutionTimeline (enhancement)

### Phase 8B: Visualization Components

5. OBS-802: ToolUseHeatMap (enhancement)
6. OBS-803: AssertionDashboard (enhancement)
7. OBS-804: SkillFlowDiagram (enhancement)
8. OBS-805: AgentActivityGraph (enhancement)

### Phase 8C: Detail Components

9. OBS-806: UnifiedLogViewer (enhancement)
10. OBS-807: EvidenceViewerModal (enhancement)
11. OBS-810: Breadcrumb (enhancement)
12. OBS-811: DeepLinkPanel (new)

### Phase 8D: Secondary Components

13. OBS-812: ExecutionReviewDashboard (new)
14. OBS-813: SkillTraceViewer (new)
15. OBS-814: MessageBusLogViewer (new)
16. OBS-815: WaveProgressPanel (new)
17. OBS-816: ToolUseLog (new)

### Phase 8E: Quality Assurance

18. OBS-817: Integration Tests
19. OBS-818: Accessibility Tests
20. OBS-819: Visual Regression Tests
21. OBS-820: Performance Tests
22. OBS-821: Documentation

---

## Final Validation

Run the master test script to validate all tasks:

```bash
bash tests/e2e/test-obs-phase8-all.sh
```

### Expected Output

```
========================================
  OBSERVABILITY PHASE 8: UI COMPONENTS
========================================

  Passed:  22
  Failed:  0
  Skipped: 0

  ✓ ALL TESTS PASSED
```
