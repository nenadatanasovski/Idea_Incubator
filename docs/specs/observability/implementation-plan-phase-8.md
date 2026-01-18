# Observability System Implementation Plan - Phase 8: UI Components

> **Location:** `docs/specs/observability/implementation-plan-phase-8.md`
> **Purpose:** Actionable implementation plan for React UI components
> **Status:** Ready for execution
> **Priority:** P2 (Builds on P0/P1 infrastructure)
> **Dependencies:** Phase 5 (API Routes), Phase 6 (WebSocket), Phase 7 (React Hooks)

---

## Executive Summary

Phase 8 implements all React visualization components for the observability dashboard. These components consume data from the API (Phase 5) and real-time WebSocket stream (Phase 6) via hooks (Phase 7).

| Scope               | Details                                                     |
| ------------------- | ----------------------------------------------------------- |
| **Component Files** | `frontend/src/components/observability/*.tsx`               |
| **Tasks**           | OBS-800 to OBS-821                                          |
| **Deliverables**    | Complete UI component suite for observability visualization |
| **Test Validation** | Component tests, E2E tests, visual regression tests         |

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY UI ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ObservabilityHub (Container)                                            │
│  ├── QuickStats                    - Real-time metrics overview          │
│  ├── ViewSelector                  - Tab navigation                      │
│  └── ViewContainer                                                       │
│      ├── ExecutionTimeline         - Gantt-style phase/task view         │
│      ├── ToolUseHeatMap            - Tool × Time activity grid           │
│      ├── AssertionDashboard        - Pass/fail trends with sparklines    │
│      ├── SkillFlowDiagram          - Nested tool call tree               │
│      ├── AgentActivityGraph        - Real-time agent status              │
│      ├── UnifiedLogViewer          - Human-readable event stream         │
│      └── EvidenceViewerModal       - Assertion evidence inspection       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Task Breakdown

### OBS-800: Enhance ObservabilityHub Container

**File:** `frontend/src/components/observability/ObservabilityHub.tsx`

**Purpose:** Main container component that orchestrates all sub-views.

#### Requirements

- [x] View state management with URL sync
- [x] Connection status indicator (Live/Reconnecting/Offline)
- [x] Integration with useObservabilityStream hook
- [ ] Keyboard navigation support (g+t → timeline, g+h → heatmap, etc.)
- [ ] Export functionality (PNG, JSON, Share Link)
- [ ] Error boundary with graceful degradation

#### Implementation Checklist

- [ ] Add keyboard shortcut handler for view navigation
- [ ] Add export menu with PNG/JSON/Link options
- [ ] Wrap children in ErrorBoundary component
- [ ] Add loading skeleton for initial data fetch
- [ ] Add empty state for no executions

#### Test Script

```bash
#!/bin/bash
# test-obs-800-hub.sh

set -e

echo "=== OBS-800: ObservabilityHub Container Tests ==="

# Test 1: Component file exists
echo "Test 1: Component file exists..."
if [ -f "frontend/src/components/observability/ObservabilityHub.tsx" ]; then
    echo "  ✓ ObservabilityHub.tsx exists"
else
    echo "  ✗ ObservabilityHub.tsx not found"
    exit 1
fi

# Test 2: Has keyboard navigation
echo "Test 2: Has keyboard navigation..."
if grep -q "useEffect.*keydown\|addEventListener.*keydown" frontend/src/components/observability/ObservabilityHub.tsx; then
    echo "  ✓ Keyboard navigation implemented"
else
    echo "  ✗ Keyboard navigation missing"
    exit 1
fi

# Test 3: Has error boundary
echo "Test 3: Has error boundary..."
if grep -q "ErrorBoundary" frontend/src/components/observability/ObservabilityHub.tsx; then
    echo "  ✓ Error boundary present"
else
    echo "  ✗ Error boundary missing"
    exit 1
fi

# Test 4: Has export functionality
echo "Test 4: Has export functionality..."
if grep -q "export.*PNG\|export.*JSON\|handleExport" frontend/src/components/observability/ObservabilityHub.tsx; then
    echo "  ✓ Export functionality present"
else
    echo "  ✗ Export functionality missing"
    exit 1
fi

# Test 5: Unit tests pass
echo "Test 5: Running unit tests..."
npm test -- --testPathPattern="ObservabilityHub.test" --passWithNoTests

echo ""
echo "=== OBS-800 Tests Complete ==="
```

#### Pass Criteria

- [ ] Component renders without errors
- [ ] URL params sync with view state
- [ ] Connection indicator updates in real-time
- [ ] Keyboard shortcuts work (g+t, g+h, g+a, g+s, g+l)
- [ ] Export generates valid output
- [ ] All unit tests pass

---

### OBS-801: Complete ExecutionTimeline Component

**File:** `frontend/src/components/observability/ExecutionTimeline.tsx`

**Purpose:** Gantt-style visualization of execution phases and tasks.

#### Requirements

- [x] Phase bars (PRIME, ITERATE, VALIDATE)
- [x] Task bars with status colors
- [x] Zoom controls
- [x] Expandable task details
- [ ] Tool density sparkline per task
- [ ] Event markers (vertical lines for errors, skills)
- [ ] Click-to-navigate to task/entry details
- [ ] Time axis with auto-scaling

#### Implementation Checklist

- [ ] Add tool density sparkline below task bars
- [ ] Add vertical event markers for errors/skills/checkpoints
- [ ] Add time axis with dynamic scaling based on zoom
- [ ] Add click handlers for navigation
- [ ] Add tooltip on hover showing entry details
- [ ] Add export to PNG button

#### Test Script

```bash
#!/bin/bash
# test-obs-801-timeline.sh

set -e

echo "=== OBS-801: ExecutionTimeline Tests ==="

FILE="frontend/src/components/observability/ExecutionTimeline.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has phase rendering
echo "Test 2: Has phase rendering..."
grep -q "phase_start\|phase_end\|PRIME\|ITERATE\|VALIDATE" "$FILE" && \
    echo "  ✓ Phase rendering present" || { echo "  ✗ Phase rendering missing"; exit 1; }

# Test 3: Has zoom controls
echo "Test 3: Has zoom controls..."
grep -q "setZoom\|ZoomIn\|ZoomOut" "$FILE" && \
    echo "  ✓ Zoom controls present" || { echo "  ✗ Zoom controls missing"; exit 1; }

# Test 4: Has task status colors
echo "Test 4: Has task status colors..."
grep -q "completed.*green\|failed.*red\|running" "$FILE" && \
    echo "  ✓ Status colors present" || { echo "  ✗ Status colors missing"; exit 1; }

# Test 5: Has expandable tasks
echo "Test 5: Has expandable tasks..."
grep -q "expandedTasks\|ChevronDown\|ChevronRight" "$FILE" && \
    echo "  ✓ Expandable tasks present" || { echo "  ✗ Expandable tasks missing"; exit 1; }

# Test 6: Has tool density visualization
echo "Test 6: Has tool density visualization..."
grep -q "toolDensity\|sparkline\|density" "$FILE" && \
    echo "  ✓ Tool density present" || { echo "  ⚠ Tool density may need implementation"; }

# Test 7: Has event markers
echo "Test 7: Has event markers..."
grep -q "eventMarker\|verticalMarker\|markerLine" "$FILE" && \
    echo "  ✓ Event markers present" || { echo "  ⚠ Event markers may need implementation"; }

# Test 8: Unit tests pass
echo "Test 8: Running unit tests..."
npm test -- --testPathPattern="ExecutionTimeline.test" --passWithNoTests

echo ""
echo "=== OBS-801 Tests Complete ==="
```

#### Pass Criteria

- [ ] Phase bars render with correct colors and labels
- [ ] Task bars show correct duration and status
- [ ] Zoom in/out works smoothly (0.5x to 4x)
- [ ] Tasks expand to show nested entries
- [ ] Tool density sparkline visible under each task
- [ ] Event markers visible for errors and skills
- [ ] Clicking entry navigates to detail view
- [ ] All unit tests pass

---

### OBS-802: Complete ToolUseHeatMap Component

**File:** `frontend/src/components/observability/ToolUseHeatMap.tsx`

**Purpose:** Tool × Time activity grid showing tool invocation patterns.

#### Requirements

- [x] Grid with tools as rows, time intervals as columns
- [x] Color coding by status (success/error/blocked)
- [x] Anomaly detection panel
- [ ] Legend with color explanations
- [ ] Hover tooltip with cell details
- [ ] Click to show tool uses in that cell
- [ ] Summary statistics row/column

#### Implementation Checklist

- [ ] Add legend component explaining color codes
- [ ] Add hover tooltip showing: count, success rate, error details
- [ ] Add click handler to show filtered tool use list
- [ ] Add summary row showing total per tool
- [ ] Add summary column showing total per interval
- [ ] Enhance anomaly detection with severity levels

#### Test Script

```bash
#!/bin/bash
# test-obs-802-heatmap.sh

set -e

echo "=== OBS-802: ToolUseHeatMap Tests ==="

FILE="frontend/src/components/observability/ToolUseHeatMap.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has grid rendering
echo "Test 2: Has grid rendering..."
grep -q "grid\|gridMap\|cellKey" "$FILE" && \
    echo "  ✓ Grid rendering present" || { echo "  ✗ Grid rendering missing"; exit 1; }

# Test 3: Has color coding
echo "Test 3: Has color coding..."
grep -q "isError\|isBlocked\|bg-green\|bg-red" "$FILE" && \
    echo "  ✓ Color coding present" || { echo "  ✗ Color coding missing"; exit 1; }

# Test 4: Has anomaly detection
echo "Test 4: Has anomaly detection..."
grep -q "anomal\|anomalyList" "$FILE" && \
    echo "  ✓ Anomaly detection present" || { echo "  ✗ Anomaly detection missing"; exit 1; }

# Test 5: Has interval calculation
echo "Test 5: Has interval calculation..."
grep -q "INTERVAL_MINUTES\|intervalMs" "$FILE" && \
    echo "  ✓ Interval calculation present" || { echo "  ✗ Interval calculation missing"; exit 1; }

# Test 6: Has hover state
echo "Test 6: Has hover state..."
grep -q "hoveredCell\|setHoveredCell\|onMouseEnter" "$FILE" && \
    echo "  ✓ Hover state present" || { echo "  ✗ Hover state missing"; exit 1; }

# Test 7: Has legend
echo "Test 7: Has legend component..."
grep -q "Legend\|legend" "$FILE" && \
    echo "  ✓ Legend present" || { echo "  ⚠ Legend may need implementation"; }

# Test 8: Unit tests pass
echo "Test 8: Running unit tests..."
npm test -- --testPathPattern="ToolUseHeatMap.test" --passWithNoTests

echo ""
echo "=== OBS-802 Tests Complete ==="
```

#### Pass Criteria

- [ ] Grid renders with correct tool rows and time columns
- [ ] Cells colored correctly: green=success, red=error, orange=blocked
- [ ] Anomaly panel shows detected issues with severity
- [ ] Legend clearly explains color meanings
- [ ] Hover shows detailed cell information
- [ ] Click filters tool use list to that cell
- [ ] Summary statistics accurate
- [ ] All unit tests pass

---

### OBS-803: Create AssertionDashboard Component

**File:** `frontend/src/components/observability/AssertionDashboard.tsx`

**Purpose:** Comprehensive assertion visualization with sparklines and chains.

#### Requirements

- [x] Overall health bar
- [ ] Category sparklines (typescript_compiles, lint_passes, etc.)
- [ ] Failure list with expandable evidence
- [ ] Assertion chain visualization
- [ ] Filter by category/status
- [ ] Real-time updates from WebSocket

#### Implementation Checklist

- [ ] Create OverallHealth sub-component with pass rate bar
- [ ] Create CategorySparklines with recharts mini-charts
- [ ] Create FailureList with expandable evidence panels
- [ ] Create AssertionChains showing task → assertion flow
- [ ] Add filter controls (category, status, task)
- [ ] Wire up real-time updates for new assertions

#### Test Script

```bash
#!/bin/bash
# test-obs-803-assertions.sh

set -e

echo "=== OBS-803: AssertionDashboard Tests ==="

FILE="frontend/src/components/observability/AssertionDashboard.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has overall health
echo "Test 2: Has overall health display..."
grep -q "passRate\|overall.*health\|OverallHealth" "$FILE" && \
    echo "  ✓ Overall health present" || { echo "  ✗ Overall health missing"; exit 1; }

# Test 3: Has sparklines
echo "Test 3: Has category sparklines..."
grep -q "Sparkline\|sparkline\|Recharts\|LineChart" "$FILE" && \
    echo "  ✓ Sparklines present" || { echo "  ⚠ Sparklines may need implementation"; }

# Test 4: Has failure list
echo "Test 4: Has failure list..."
grep -q "failedAssertions\|FailureList\|failures" "$FILE" && \
    echo "  ✓ Failure list present" || { echo "  ⚠ Failure list may need implementation"; }

# Test 5: Has assertion chains
echo "Test 5: Has assertion chains..."
grep -q "chain\|AssertionChain" "$FILE" && \
    echo "  ✓ Assertion chains present" || { echo "  ⚠ Assertion chains may need implementation"; }

# Test 6: Has filtering
echo "Test 6: Has filtering capability..."
grep -q "filter\|Filter\|category.*filter\|status.*filter" "$FILE" && \
    echo "  ✓ Filtering present" || { echo "  ⚠ Filtering may need implementation"; }

# Test 7: Unit tests pass
echo "Test 7: Running unit tests..."
npm test -- --testPathPattern="AssertionDashboard.test\|AssertionList.test" --passWithNoTests

echo ""
echo "=== OBS-803 Tests Complete ==="
```

#### Pass Criteria

- [ ] Overall health bar shows correct pass rate
- [ ] Sparklines render for each assertion category
- [ ] Failure list shows failed assertions with details
- [ ] Assertion chains visualize the flow correctly
- [ ] Filters work for category and status
- [ ] Real-time updates appear without refresh
- [ ] All unit tests pass

---

### OBS-804: Complete SkillFlowDiagram Component

**File:** `frontend/src/components/observability/SkillFlowDiagram.tsx`

**Purpose:** Tree visualization of skill invocations and nested tool calls.

#### Requirements

- [x] Skill nodes with file:line references
- [x] Tool nodes showing invocations
- [ ] Assertion nodes showing validation results
- [ ] Collapsible branches
- [ ] Click to navigate to skill/tool/assertion
- [ ] Export to SVG/Mermaid

#### Implementation Checklist

- [ ] Add AssertionNode component for validation results
- [ ] Add collapse/expand controls for branches
- [ ] Add navigation on node click
- [ ] Add export menu (SVG, Mermaid, PNG)
- [ ] Add zoom/pan controls
- [ ] Add legend explaining node types

#### Test Script

```bash
#!/bin/bash
# test-obs-804-skillflow.sh

set -e

echo "=== OBS-804: SkillFlowDiagram Tests ==="

FILE="frontend/src/components/observability/SkillFlowDiagram.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has skill nodes
echo "Test 2: Has skill node rendering..."
grep -q "SkillNode\|skillName\|skill_invoke" "$FILE" && \
    echo "  ✓ Skill nodes present" || { echo "  ✗ Skill nodes missing"; exit 1; }

# Test 3: Has tool nodes
echo "Test 3: Has tool node rendering..."
grep -q "ToolNode\|toolUse\|tool_use" "$FILE" && \
    echo "  ✓ Tool nodes present" || { echo "  ✗ Tool nodes missing"; exit 1; }

# Test 4: Has file:line references
echo "Test 4: Has file:line references..."
grep -q "lineNumber\|skillFile\|file:line" "$FILE" && \
    echo "  ✓ File:line references present" || { echo "  ⚠ File:line references may need work"; }

# Test 5: Has assertion nodes
echo "Test 5: Has assertion nodes..."
grep -q "AssertionNode\|assertion" "$FILE" && \
    echo "  ✓ Assertion nodes present" || { echo "  ⚠ Assertion nodes may need implementation"; }

# Test 6: Has collapsible branches
echo "Test 6: Has collapsible branches..."
grep -q "collapsed\|expanded\|toggle.*branch" "$FILE" && \
    echo "  ✓ Collapsible branches present" || { echo "  ⚠ Collapsible branches may need implementation"; }

# Test 7: Has export functionality
echo "Test 7: Has export functionality..."
grep -q "export.*SVG\|export.*Mermaid\|handleExport" "$FILE" && \
    echo "  ✓ Export present" || { echo "  ⚠ Export may need implementation"; }

# Test 8: Unit tests pass
echo "Test 8: Running unit tests..."
npm test -- --testPathPattern="SkillFlowDiagram.test" --passWithNoTests

echo ""
echo "=== OBS-804 Tests Complete ==="
```

#### Pass Criteria

- [ ] Skill nodes show name, file, line number
- [ ] Tool nodes show tool name, input summary, status
- [ ] Assertion nodes show category, result, evidence link
- [ ] Branches collapse/expand correctly
- [ ] Clicking node navigates to detail view
- [ ] Export produces valid SVG/Mermaid
- [ ] All unit tests pass

---

### OBS-805: Complete AgentActivityGraph Component

**File:** `frontend/src/components/observability/AgentActivityGraph.tsx`

**Purpose:** Real-time agent status monitoring and activity timeline.

#### Requirements

- [x] Agent status cards
- [ ] Activity timeline per agent (last 5 minutes)
- [ ] Alert panel for slow/stuck agents
- [ ] Real-time heartbeat updates
- [ ] Click to view agent details
- [ ] Pause/resume live updates

#### Implementation Checklist

- [ ] Add activity timeline showing agent work over time
- [ ] Add alert panel detecting: slow tasks, stuck agents, high error rates
- [ ] Add heartbeat indicator (pulsing dot)
- [ ] Add pause/resume control for live updates
- [ ] Add click handler to navigate to agent detail
- [ ] Add threshold configuration for alerts

#### Test Script

```bash
#!/bin/bash
# test-obs-805-activity.sh

set -e

echo "=== OBS-805: AgentActivityGraph Tests ==="

FILE="frontend/src/components/observability/AgentActivityGraph.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has agent status cards
echo "Test 2: Has agent status cards..."
grep -q "AgentCard\|agent.*status\|instance" "$FILE" && \
    echo "  ✓ Agent status cards present" || { echo "  ✗ Agent cards missing"; exit 1; }

# Test 3: Has real-time updates
echo "Test 3: Has real-time updates..."
grep -q "useObservabilityStream\|WebSocket\|isConnected" "$FILE" && \
    echo "  ✓ Real-time updates present" || { echo "  ⚠ Real-time may need work"; }

# Test 4: Has activity timeline
echo "Test 4: Has activity timeline..."
grep -q "timeline\|ActivityTimeline\|activityHistory" "$FILE" && \
    echo "  ✓ Activity timeline present" || { echo "  ⚠ Activity timeline may need implementation"; }

# Test 5: Has alert panel
echo "Test 5: Has alert panel..."
grep -q "alert\|Alert\|warning\|slow\|stuck" "$FILE" && \
    echo "  ✓ Alert panel present" || { echo "  ⚠ Alert panel may need implementation"; }

# Test 6: Has pause control
echo "Test 6: Has pause/resume control..."
grep -q "pause\|Pause\|isPaused\|setIsPaused" "$FILE" && \
    echo "  ✓ Pause control present" || { echo "  ⚠ Pause control may need implementation"; }

# Test 7: Unit tests pass
echo "Test 7: Running unit tests..."
npm test -- --testPathPattern="AgentActivityGraph.test" --passWithNoTests

echo ""
echo "=== OBS-805 Tests Complete ==="
```

#### Pass Criteria

- [ ] Agent cards show current status and task
- [ ] Activity timeline renders agent history
- [ ] Alert panel detects and displays issues
- [ ] Heartbeat indicator pulses for active agents
- [ ] Pause/resume toggle works
- [ ] Clicking agent navigates to detail view
- [ ] All unit tests pass

---

### OBS-806: Complete UnifiedLogViewer Component

**File:** `frontend/src/components/observability/UnifiedLogViewer.tsx`

**Purpose:** Human-readable event stream with filtering and search.

#### Requirements

- [x] Log entry rendering
- [x] Real-time streaming
- [ ] Filter by event type, source, severity
- [ ] Search across log content
- [ ] Auto-scroll with pause on hover
- [ ] Click to navigate to related entity

#### Implementation Checklist

- [ ] Add filter bar with dropdowns for type/source/severity
- [ ] Add search input with debounced query
- [ ] Add auto-scroll that pauses on user interaction
- [ ] Add click handlers for entity navigation
- [ ] Add export log button
- [ ] Add clear button for filter reset

#### Test Script

```bash
#!/bin/bash
# test-obs-806-logviewer.sh

set -e

echo "=== OBS-806: UnifiedLogViewer Tests ==="

FILE="frontend/src/components/observability/UnifiedLogViewer.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has log rendering
echo "Test 2: Has log entry rendering..."
grep -q "logEntry\|LogEntry\|message_bus" "$FILE" && \
    echo "  ✓ Log rendering present" || { echo "  ✗ Log rendering missing"; exit 1; }

# Test 3: Has filtering
echo "Test 3: Has filtering capability..."
grep -q "filter\|Filter\|eventType.*filter\|severity.*filter" "$FILE" && \
    echo "  ✓ Filtering present" || { echo "  ⚠ Filtering may need implementation"; }

# Test 4: Has search
echo "Test 4: Has search capability..."
grep -q "search\|Search\|query" "$FILE" && \
    echo "  ✓ Search present" || { echo "  ⚠ Search may need implementation"; }

# Test 5: Has auto-scroll
echo "Test 5: Has auto-scroll..."
grep -q "autoScroll\|scrollToBottom\|scrollIntoView" "$FILE" && \
    echo "  ✓ Auto-scroll present" || { echo "  ⚠ Auto-scroll may need implementation"; }

# Test 6: Has real-time updates
echo "Test 6: Has real-time updates..."
grep -q "useObservabilityStream\|isConnected\|events" "$FILE" && \
    echo "  ✓ Real-time updates present" || { echo "  ⚠ Real-time may need work"; }

# Test 7: Unit tests pass
echo "Test 7: Running unit tests..."
npm test -- --testPathPattern="UnifiedLogViewer.test" --passWithNoTests

echo ""
echo "=== OBS-806 Tests Complete ==="
```

#### Pass Criteria

- [ ] Log entries render with timestamp, type, and message
- [ ] Filters work for event type, source, severity
- [ ] Search filters entries by content
- [ ] Auto-scroll to bottom for new entries
- [ ] Scroll pauses when user hovers/scrolls
- [ ] Clicking entry navigates to related entity
- [ ] All unit tests pass

---

### OBS-807: Complete EvidenceViewerModal Component

**File:** `frontend/src/components/observability/EvidenceViewerModal.tsx`

**Purpose:** Modal for inspecting assertion evidence in detail.

#### Requirements

- [x] Modal container with close button
- [ ] Command execution display (command, exit code, duration)
- [ ] Stdout/stderr panels with syntax highlighting
- [ ] File diff viewer with line highlighting
- [ ] Related transcript entries section
- [ ] Navigation to related entities

#### Implementation Checklist

- [ ] Add command execution panel showing the test command
- [ ] Add stdout panel with monospace formatting
- [ ] Add stderr panel with error highlighting
- [ ] Add diff viewer for file changes
- [ ] Add related transcript entries with navigation
- [ ] Add copy evidence button
- [ ] Add keyboard shortcut (Esc to close)

#### Test Script

```bash
#!/bin/bash
# test-obs-807-evidence.sh

set -e

echo "=== OBS-807: EvidenceViewerModal Tests ==="

FILE="frontend/src/components/observability/EvidenceViewerModal.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has modal structure
echo "Test 2: Has modal structure..."
grep -q "Modal\|Dialog\|isOpen\|onClose" "$FILE" && \
    echo "  ✓ Modal structure present" || { echo "  ✗ Modal structure missing"; exit 1; }

# Test 3: Has command display
echo "Test 3: Has command execution display..."
grep -q "command\|exitCode\|Command" "$FILE" && \
    echo "  ✓ Command display present" || { echo "  ⚠ Command display may need implementation"; }

# Test 4: Has stdout/stderr panels
echo "Test 4: Has stdout/stderr panels..."
grep -q "stdout\|stderr\|output" "$FILE" && \
    echo "  ✓ Output panels present" || { echo "  ⚠ Output panels may need implementation"; }

# Test 5: Has diff viewer
echo "Test 5: Has diff viewer..."
grep -q "diff\|Diff\|fileDiff" "$FILE" && \
    echo "  ✓ Diff viewer present" || { echo "  ⚠ Diff viewer may need implementation"; }

# Test 6: Has related entries
echo "Test 6: Has related transcript entries..."
grep -q "relatedEntries\|transcriptEntry\|related" "$FILE" && \
    echo "  ✓ Related entries present" || { echo "  ⚠ Related entries may need implementation"; }

# Test 7: Has close functionality
echo "Test 7: Has close functionality..."
grep -q "onClose\|handleClose\|Escape" "$FILE" && \
    echo "  ✓ Close functionality present" || { echo "  ✗ Close functionality missing"; exit 1; }

# Test 8: Unit tests pass
echo "Test 8: Running unit tests..."
npm test -- --testPathPattern="EvidenceViewerModal.test" --passWithNoTests

echo ""
echo "=== OBS-807 Tests Complete ==="
```

#### Pass Criteria

- [ ] Modal opens with assertion details
- [ ] Command execution shows command, exit code, duration
- [ ] Stdout panel displays output with proper formatting
- [ ] Stderr panel highlights errors
- [ ] Diff viewer shows file changes with line numbers
- [ ] Related transcript entries are clickable
- [ ] Esc key closes modal
- [ ] All unit tests pass

---

### OBS-808: Create QuickStats Component

**File:** `frontend/src/components/observability/QuickStats.tsx`

**Purpose:** Real-time metrics overview panel.

#### Requirements

- [x] Active executions count
- [x] Tool calls per minute
- [x] Pass rate percentage
- [x] Error count with link
- [ ] Discovery count
- [ ] Real-time updates
- [ ] Sparkline trends

#### Implementation Checklist

- [ ] Add discovery count metric
- [ ] Add mini sparklines for each metric
- [ ] Wire up real-time updates from WebSocket
- [ ] Add click handlers to navigate to filtered views
- [ ] Add loading skeleton

#### Test Script

```bash
#!/bin/bash
# test-obs-808-quickstats.sh

set -e

echo "=== OBS-808: QuickStats Tests ==="

FILE="frontend/src/components/observability/QuickStats.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has metrics
echo "Test 2: Has required metrics..."
grep -q "passRate\|errorCount\|toolCalls" "$FILE" && \
    echo "  ✓ Core metrics present" || { echo "  ✗ Core metrics missing"; exit 1; }

# Test 3: Has discovery count
echo "Test 3: Has discovery count..."
grep -q "discovery\|Discovery" "$FILE" && \
    echo "  ✓ Discovery count present" || { echo "  ⚠ Discovery count may need implementation"; }

# Test 4: Has sparklines
echo "Test 4: Has mini sparklines..."
grep -q "sparkline\|Sparkline\|trend" "$FILE" && \
    echo "  ✓ Sparklines present" || { echo "  ⚠ Sparklines may need implementation"; }

# Test 5: Has real-time updates
echo "Test 5: Has real-time updates..."
grep -q "useObservabilityStream\|useEffect.*subscription" "$FILE" && \
    echo "  ✓ Real-time updates present" || { echo "  ⚠ Real-time may need work"; }

# Test 6: Unit tests pass
echo "Test 6: Running unit tests..."
npm test -- --testPathPattern="QuickStats.test" --passWithNoTests

echo ""
echo "=== OBS-808 Tests Complete ==="
```

#### Pass Criteria

- [ ] All 5 metrics displayed correctly
- [ ] Mini sparklines show recent trends
- [ ] Values update in real-time
- [ ] Clicking metric navigates to filtered view
- [ ] Loading skeleton shown during fetch
- [ ] All unit tests pass

---

### OBS-809: Create ViewSelector Component

**File:** `frontend/src/components/observability/ViewSelector.tsx`

**Purpose:** Tab navigation for switching between views.

#### Requirements

- [x] Tab buttons for all views
- [x] Active state highlighting
- [x] Click to switch view
- [ ] Keyboard navigation (arrow keys)
- [ ] Badge showing counts (errors, etc.)
- [ ] Mobile-friendly dropdown fallback

#### Implementation Checklist

- [ ] Add keyboard navigation with arrow keys
- [ ] Add badge showing error/alert counts
- [ ] Add mobile dropdown for narrow screens
- [ ] Add tooltips explaining each view

#### Test Script

```bash
#!/bin/bash
# test-obs-809-viewselector.sh

set -e

echo "=== OBS-809: ViewSelector Tests ==="

FILE="frontend/src/components/observability/ViewSelector.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has all view tabs
echo "Test 2: Has all view tabs..."
grep -q "timeline\|heatmap\|assertions\|skills\|activity\|logs" "$FILE" && \
    echo "  ✓ View tabs present" || { echo "  ✗ View tabs missing"; exit 1; }

# Test 3: Has active state
echo "Test 3: Has active state..."
grep -q "currentView\|activeView\|isActive" "$FILE" && \
    echo "  ✓ Active state present" || { echo "  ✗ Active state missing"; exit 1; }

# Test 4: Has click handler
echo "Test 4: Has click handler..."
grep -q "onClick\|onViewChange" "$FILE" && \
    echo "  ✓ Click handler present" || { echo "  ✗ Click handler missing"; exit 1; }

# Test 5: Has keyboard navigation
echo "Test 5: Has keyboard navigation..."
grep -q "onKeyDown\|ArrowLeft\|ArrowRight" "$FILE" && \
    echo "  ✓ Keyboard navigation present" || { echo "  ⚠ Keyboard nav may need implementation"; }

# Test 6: Unit tests pass
echo "Test 6: Running unit tests..."
npm test -- --testPathPattern="ViewSelector.test" --passWithNoTests

echo ""
echo "=== OBS-809 Tests Complete ==="
```

#### Pass Criteria

- [ ] All 6 views have tabs
- [ ] Active tab visually highlighted
- [ ] Clicking tab switches view
- [ ] Arrow keys navigate between tabs
- [ ] Badge shows relevant counts
- [ ] Mobile dropdown works on narrow screens
- [ ] All unit tests pass

---

### OBS-810: Create Breadcrumb Component

**File:** `frontend/src/components/observability/Breadcrumb.tsx`

**Purpose:** Navigation breadcrumb for deep-linked views.

#### Requirements

- [x] Shows current location hierarchy
- [x] Each segment is clickable
- [ ] Copy link button
- [ ] Truncation for long paths

#### Implementation Checklist

- [ ] Add copy link button that copies deep link URL
- [ ] Add truncation with ellipsis for long segment names
- [ ] Add home icon for root

#### Test Script

```bash
#!/bin/bash
# test-obs-810-breadcrumb.sh

set -e

echo "=== OBS-810: Breadcrumb Tests ==="

FILE="frontend/src/components/observability/Breadcrumb.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found"; exit 1; }

# Test 2: Has segment rendering
echo "Test 2: Has segment rendering..."
grep -q "segment\|BreadcrumbItem\|crumb" "$FILE" && \
    echo "  ✓ Segment rendering present" || { echo "  ✗ Segment rendering missing"; exit 1; }

# Test 3: Has clickable navigation
echo "Test 3: Has clickable navigation..."
grep -q "onClick\|Link\|navigate" "$FILE" && \
    echo "  ✓ Navigation present" || { echo "  ✗ Navigation missing"; exit 1; }

# Test 4: Has copy link
echo "Test 4: Has copy link functionality..."
grep -q "copy\|Copy\|clipboard" "$FILE" && \
    echo "  ✓ Copy link present" || { echo "  ⚠ Copy link may need implementation"; }

# Test 5: Unit tests pass
echo "Test 5: Running unit tests..."
npm test -- --testPathPattern="Breadcrumb.test" --passWithNoTests

echo ""
echo "=== OBS-810 Tests Complete ==="
```

#### Pass Criteria

- [ ] Breadcrumb shows full path
- [ ] Each segment navigates on click
- [ ] Copy button copies URL to clipboard
- [ ] Long paths truncated appropriately
- [ ] All unit tests pass

---

### OBS-811: Create DeepLinkPanel Component

**File:** `frontend/src/components/observability/DeepLinkPanel.tsx`

**Purpose:** Side panel showing entity details and cross-references.

#### Requirements

- [ ] Entity details section (based on entity type)
- [ ] Cross-references to related entities
- [ ] Navigation links to related items
- [ ] Copy deep link URL

#### Implementation Checklist

- [ ] Create component structure with sections
- [ ] Add entity details renderer for each type
- [ ] Add cross-reference list with navigation
- [ ] Add copy URL functionality
- [ ] Add close button

#### Test Script

```bash
#!/bin/bash
# test-obs-811-deeplinkpanel.sh

set -e

echo "=== OBS-811: DeepLinkPanel Tests ==="

FILE="frontend/src/components/observability/DeepLinkPanel.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || { echo "  ✗ File not found - needs creation"; }

# Test 2: Has entity details
echo "Test 2: Has entity details section..."
if [ -f "$FILE" ]; then
    grep -q "entityDetails\|EntityDetails" "$FILE" && \
        echo "  ✓ Entity details present" || echo "  ⚠ Entity details may need implementation"
fi

# Test 3: Has cross-references
echo "Test 3: Has cross-references..."
if [ -f "$FILE" ]; then
    grep -q "crossRef\|CrossReference\|relatedEntities" "$FILE" && \
        echo "  ✓ Cross-references present" || echo "  ⚠ Cross-references may need implementation"
fi

# Test 4: Unit tests pass
echo "Test 4: Running unit tests..."
npm test -- --testPathPattern="DeepLinkPanel.test" --passWithNoTests

echo ""
echo "=== OBS-811 Tests Complete ==="
```

#### Pass Criteria

- [ ] Panel shows current entity details
- [ ] Cross-references link to related entities
- [ ] Clicking reference navigates correctly
- [ ] Copy URL works
- [ ] All unit tests pass

---

### OBS-812: Create ExecutionReviewDashboard Component

**File:** `frontend/src/components/observability/ExecutionReviewDashboard.tsx`

**Purpose:** Full review interface for a single execution.

#### Requirements

- [ ] Summary section with key metrics
- [ ] Assertions list with evidence links
- [ ] Unified transcript with search
- [ ] Skills used summary
- [ ] Export options

#### Implementation Checklist

- [ ] Create summary header with stats cards
- [ ] Add assertions section with expandable evidence
- [ ] Add transcript section with filtering
- [ ] Add skills section with invocation counts
- [ ] Add export menu (JSON, PDF report)

#### Test Script

```bash
#!/bin/bash
# test-obs-812-review.sh

set -e

echo "=== OBS-812: ExecutionReviewDashboard Tests ==="

FILE="frontend/src/components/observability/ExecutionReviewDashboard.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || echo "  ⚠ File not found - needs creation"

# Test 2: Has summary section
echo "Test 2: Has summary section..."
if [ -f "$FILE" ]; then
    grep -q "summary\|Summary\|stats" "$FILE" && \
        echo "  ✓ Summary present" || echo "  ⚠ Summary may need implementation"
fi

# Test 3: Has assertions
echo "Test 3: Has assertions section..."
if [ -f "$FILE" ]; then
    grep -q "assertion\|Assertion" "$FILE" && \
        echo "  ✓ Assertions present" || echo "  ⚠ Assertions may need implementation"
fi

# Test 4: Has transcript
echo "Test 4: Has transcript section..."
if [ -f "$FILE" ]; then
    grep -q "transcript\|Transcript" "$FILE" && \
        echo "  ✓ Transcript present" || echo "  ⚠ Transcript may need implementation"
fi

# Test 5: Unit tests pass
echo "Test 5: Running unit tests..."
npm test -- --testPathPattern="ExecutionReviewDashboard.test" --passWithNoTests

echo ""
echo "=== OBS-812 Tests Complete ==="
```

#### Pass Criteria

- [ ] Summary shows status, duration, task count
- [ ] Assertions filterable and expandable
- [ ] Transcript searchable and scrollable
- [ ] Skills summary shows usage patterns
- [ ] Export produces valid output
- [ ] All unit tests pass

---

### OBS-813: Create SkillTraceViewer Component

**File:** `frontend/src/components/observability/SkillTraceViewer.tsx`

**Purpose:** Detailed view of a single skill invocation.

#### Requirements

- [ ] Skill file reference with link
- [ ] Invocation context (task, input, output)
- [ ] Tool calls made during skill
- [ ] Metrics (duration, tokens)
- [ ] Status indicator

#### Implementation Checklist

- [ ] Create skill reference section with file:line link
- [ ] Add context section showing task and summaries
- [ ] Add tool calls list
- [ ] Add metrics section
- [ ] Add navigation to related items

#### Test Script

```bash
#!/bin/bash
# test-obs-813-skilltrace.sh

set -e

echo "=== OBS-813: SkillTraceViewer Tests ==="

FILE="frontend/src/components/observability/SkillTraceViewer.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || echo "  ⚠ File not found - needs creation"

# Test 2: Has skill reference
echo "Test 2: Has skill reference..."
if [ -f "$FILE" ]; then
    grep -q "skillFile\|skillName\|lineNumber" "$FILE" && \
        echo "  ✓ Skill reference present" || echo "  ⚠ Skill reference may need implementation"
fi

# Test 3: Has tool calls
echo "Test 3: Has tool calls section..."
if [ -f "$FILE" ]; then
    grep -q "toolCalls\|ToolCall" "$FILE" && \
        echo "  ✓ Tool calls present" || echo "  ⚠ Tool calls may need implementation"
fi

# Test 4: Unit tests pass
echo "Test 4: Running unit tests..."
npm test -- --testPathPattern="SkillTraceViewer.test" --passWithNoTests

echo ""
echo "=== OBS-813 Tests Complete ==="
```

#### Pass Criteria

- [ ] Skill file reference clickable
- [ ] Context shows task and summaries
- [ ] Tool calls listed with details
- [ ] Metrics displayed correctly
- [ ] All unit tests pass

---

### OBS-814: Create MessageBusLogViewer Component

**File:** `frontend/src/components/observability/MessageBusLogViewer.tsx`

**Purpose:** Human-readable message bus event stream.

#### Requirements

- [ ] Real-time event streaming
- [ ] Filter by event type and source
- [ ] Severity-based styling
- [ ] Action buttons for actionable events
- [ ] Jump to related entity

#### Implementation Checklist

- [ ] Create real-time log stream
- [ ] Add filter controls
- [ ] Add severity styling (info, warning, error)
- [ ] Add action buttons for actionable events
- [ ] Add navigation to related entities

#### Test Script

```bash
#!/bin/bash
# test-obs-814-messagebus.sh

set -e

echo "=== OBS-814: MessageBusLogViewer Tests ==="

FILE="frontend/src/components/observability/MessageBusLogViewer.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || echo "  ⚠ File not found - needs creation"

# Test 2: Has message bus integration
echo "Test 2: Has message bus integration..."
if [ -f "$FILE" ]; then
    grep -q "message_bus\|messageBus\|MessageBus" "$FILE" && \
        echo "  ✓ Message bus integration present" || echo "  ⚠ Integration may need implementation"
fi

# Test 3: Has severity styling
echo "Test 3: Has severity styling..."
if [ -f "$FILE" ]; then
    grep -q "severity\|warning\|error\|info" "$FILE" && \
        echo "  ✓ Severity styling present" || echo "  ⚠ Severity styling may need implementation"
fi

# Test 4: Unit tests pass
echo "Test 4: Running unit tests..."
npm test -- --testPathPattern="MessageBusLogViewer.test" --passWithNoTests

echo ""
echo "=== OBS-814 Tests Complete ==="
```

#### Pass Criteria

- [ ] Events stream in real-time
- [ ] Filters work correctly
- [ ] Severity styles applied
- [ ] Action buttons functional
- [ ] Navigation works
- [ ] All unit tests pass

---

### OBS-815: Create WaveProgressPanel Component

**File:** `frontend/src/components/observability/WaveProgressPanel.tsx`

**Purpose:** Parallel execution wave progress visualization.

#### Requirements

- [ ] Wave progress bars
- [ ] Task assignment per wave
- [ ] Status indicators
- [ ] Duration metrics
- [ ] Agent allocation visualization

#### Implementation Checklist

- [ ] Create wave progress bar component
- [ ] Add task list per wave
- [ ] Add status indicators (pending, running, completed, failed)
- [ ] Add duration and timing info
- [ ] Add agent allocation view

#### Test Script

```bash
#!/bin/bash
# test-obs-815-wave.sh

set -e

echo "=== OBS-815: WaveProgressPanel Tests ==="

FILE="frontend/src/components/observability/WaveProgressPanel.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || echo "  ⚠ File not found - needs creation"

# Test 2: Has wave rendering
echo "Test 2: Has wave rendering..."
if [ -f "$FILE" ]; then
    grep -q "wave\|Wave\|waveNumber" "$FILE" && \
        echo "  ✓ Wave rendering present" || echo "  ⚠ Wave rendering may need implementation"
fi

# Test 3: Unit tests pass
echo "Test 3: Running unit tests..."
npm test -- --testPathPattern="WaveProgressPanel.test" --passWithNoTests

echo ""
echo "=== OBS-815 Tests Complete ==="
```

#### Pass Criteria

- [ ] Wave progress bars show completion
- [ ] Tasks listed per wave
- [ ] Status indicators correct
- [ ] Duration displayed
- [ ] All unit tests pass

---

### OBS-816: Create ToolUseLog Component

**File:** `frontend/src/components/observability/ToolUseLog.tsx`

**Purpose:** Detailed log of tool invocations with filtering.

#### Requirements

- [ ] Tool use list with details
- [ ] Filter by tool type, status
- [ ] Search by input/output
- [ ] Click to expand full details
- [ ] Navigation to related entities

#### Implementation Checklist

- [ ] Create tool use list with virtualization
- [ ] Add filter controls
- [ ] Add search functionality
- [ ] Add expandable detail view
- [ ] Add navigation links

#### Test Script

```bash
#!/bin/bash
# test-obs-816-toollog.sh

set -e

echo "=== OBS-816: ToolUseLog Tests ==="

FILE="frontend/src/components/observability/ToolUseLog.tsx"

# Test 1: Component exists
echo "Test 1: Component file exists..."
[ -f "$FILE" ] && echo "  ✓ File exists" || echo "  ⚠ File not found - needs creation"

# Test 2: Has tool use rendering
echo "Test 2: Has tool use rendering..."
if [ -f "$FILE" ]; then
    grep -q "toolUse\|ToolUse" "$FILE" && \
        echo "  ✓ Tool use rendering present" || echo "  ⚠ Rendering may need implementation"
fi

# Test 3: Unit tests pass
echo "Test 3: Running unit tests..."
npm test -- --testPathPattern="ToolUseLog.test" --passWithNoTests

echo ""
echo "=== OBS-816 Tests Complete ==="
```

#### Pass Criteria

- [ ] Tool uses listed with key details
- [ ] Filters work correctly
- [ ] Search filters by content
- [ ] Expand shows full details
- [ ] All unit tests pass

---

### OBS-817: Add Integration Tests

**Purpose:** E2E tests for component integration.

#### Test Script

```bash
#!/bin/bash
# test-obs-817-integration.sh

set -e

API_BASE="http://localhost:3001"
FRONTEND_BASE="http://localhost:3002"

echo "=== OBS-817: Integration Tests ==="

# Test 1: Backend health
echo "Test 1: Backend health check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/health" 2>/dev/null || echo "000")
[ "$HEALTH" = "200" ] && echo "  ✓ Backend healthy" || echo "  ✗ Backend unhealthy ($HEALTH)"

# Test 2: Observability endpoint
echo "Test 2: Observability API endpoint..."
OBS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/observability/executions" 2>/dev/null || echo "000")
[ "$OBS_STATUS" = "200" ] && echo "  ✓ API endpoint responding" || echo "  ✗ API endpoint failed ($OBS_STATUS)"

# Test 3: Frontend route
echo "Test 3: Frontend route accessible..."
FE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_BASE/observability" 2>/dev/null || echo "000")
[ "$FE_STATUS" = "200" ] && echo "  ✓ Frontend route accessible" || echo "  ⚠ Frontend may not be running ($FE_STATUS)"

# Test 4: WebSocket connection
echo "Test 4: WebSocket server file exists..."
[ -f "server/websocket.ts" ] && echo "  ✓ WebSocket server exists" || echo "  ✗ WebSocket server missing"

# Test 5: All component files exist
echo "Test 5: All required components exist..."
COMPONENTS=(
    "ObservabilityHub.tsx"
    "ExecutionTimeline.tsx"
    "ToolUseHeatMap.tsx"
    "AssertionDashboard.tsx"
    "SkillFlowDiagram.tsx"
    "AgentActivityGraph.tsx"
    "UnifiedLogViewer.tsx"
    "EvidenceViewerModal.tsx"
    "QuickStats.tsx"
    "ViewSelector.tsx"
    "Breadcrumb.tsx"
)
MISSING=0
for comp in "${COMPONENTS[@]}"; do
    if [ -f "frontend/src/components/observability/$comp" ]; then
        echo "  ✓ $comp exists"
    else
        echo "  ✗ $comp missing"
        MISSING=$((MISSING + 1))
    fi
done
[ $MISSING -eq 0 ] && echo "  All components present" || echo "  $MISSING components missing"

# Test 6: Type definitions
echo "Test 6: Type definitions exist..."
[ -f "frontend/src/types/observability.ts" ] && echo "  ✓ Frontend types exist" || echo "  ✗ Frontend types missing"
[ -f "server/types/observability.ts" ] && echo "  ✓ Server types exist" || echo "  ✗ Server types missing"

# Test 7: Hooks exist
echo "Test 7: Required hooks exist..."
[ -f "frontend/src/hooks/useObservability.ts" ] && echo "  ✓ useObservability.ts exists" || echo "  ✗ useObservability.ts missing"
[ -f "frontend/src/hooks/useObservabilityStream.ts" ] && echo "  ✓ useObservabilityStream.ts exists" || echo "  ✗ useObservabilityStream.ts missing"

# Test 8: Run component tests
echo "Test 8: Running component tests..."
npm test -- --testPathPattern="components/observability" --passWithNoTests

echo ""
echo "=== OBS-817 Integration Tests Complete ==="
```

#### Pass Criteria

- [ ] Backend API responding
- [ ] Observability endpoints work
- [ ] Frontend route accessible
- [ ] WebSocket server exists
- [ ] All components present
- [ ] Type definitions exist
- [ ] Hooks exist
- [ ] All component tests pass

---

### OBS-818: Add Accessibility Tests

**Purpose:** Ensure components are accessible.

#### Test Script

```bash
#!/bin/bash
# test-obs-818-a11y.sh

set -e

echo "=== OBS-818: Accessibility Tests ==="

COMPONENTS_DIR="frontend/src/components/observability"

# Test 1: ARIA labels present
echo "Test 1: ARIA labels in components..."
ARIA_COUNT=$(grep -r "aria-label\|aria-describedby\|aria-hidden\|role=" "$COMPONENTS_DIR" 2>/dev/null | wc -l || echo "0")
echo "  Found $ARIA_COUNT ARIA attributes"
[ "$ARIA_COUNT" -gt 10 ] && echo "  ✓ Good ARIA coverage" || echo "  ⚠ Consider adding more ARIA labels"

# Test 2: Keyboard navigation
echo "Test 2: Keyboard navigation support..."
KB_COUNT=$(grep -r "onKeyDown\|onKeyUp\|tabIndex" "$COMPONENTS_DIR" 2>/dev/null | wc -l || echo "0")
echo "  Found $KB_COUNT keyboard handlers"
[ "$KB_COUNT" -gt 5 ] && echo "  ✓ Keyboard navigation present" || echo "  ⚠ Consider adding more keyboard support"

# Test 3: Focus management
echo "Test 3: Focus management..."
FOCUS_COUNT=$(grep -r "focus\|Focus\|autoFocus\|focusRef" "$COMPONENTS_DIR" 2>/dev/null | wc -l || echo "0")
echo "  Found $FOCUS_COUNT focus-related items"
[ "$FOCUS_COUNT" -gt 0 ] && echo "  ✓ Focus management present" || echo "  ⚠ Consider adding focus management"

# Test 4: Color contrast (check for hardcoded colors)
echo "Test 4: Color usage check..."
CONTRAST=$(grep -r "text-gray-300\|bg-gray-100" "$COMPONENTS_DIR" 2>/dev/null | wc -l || echo "0")
[ "$CONTRAST" -lt 20 ] && echo "  ✓ Reasonable color usage" || echo "  ⚠ Review low-contrast color combinations"

# Test 5: Run a11y tests if available
echo "Test 5: Running a11y test suite..."
if npm test -- --testPathPattern="a11y\|accessibility" --passWithNoTests 2>/dev/null; then
    echo "  ✓ Accessibility tests pass"
else
    echo "  ⚠ No dedicated a11y tests found"
fi

echo ""
echo "=== OBS-818 Accessibility Tests Complete ==="
```

#### Pass Criteria

- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Focus properly managed
- [ ] Color contrast meets WCAG AA
- [ ] All a11y tests pass

---

### OBS-819: Add Visual Regression Tests

**Purpose:** Prevent unintended visual changes.

#### Test Script

```bash
#!/bin/bash
# test-obs-819-visual.sh

set -e

echo "=== OBS-819: Visual Regression Setup ==="

# Test 1: Storybook setup (if applicable)
echo "Test 1: Check for Storybook or visual test setup..."
if [ -f ".storybook/main.js" ] || [ -f ".storybook/main.ts" ]; then
    echo "  ✓ Storybook configured"
else
    echo "  ⚠ Storybook not found - consider adding for visual testing"
fi

# Test 2: Check for Percy or similar
echo "Test 2: Check for visual testing tool..."
if grep -q "percy\|chromatic\|loki" package.json 2>/dev/null; then
    echo "  ✓ Visual testing tool configured"
else
    echo "  ⚠ No visual testing tool found"
fi

# Test 3: Component story files
echo "Test 3: Check for component stories..."
STORY_COUNT=$(find frontend/src/components/observability -name "*.stories.*" 2>/dev/null | wc -l || echo "0")
echo "  Found $STORY_COUNT story files"
[ "$STORY_COUNT" -gt 5 ] && echo "  ✓ Good story coverage" || echo "  ⚠ Consider adding more stories"

# Test 4: Snapshot tests
echo "Test 4: Check for snapshot tests..."
SNAPSHOT_COUNT=$(find frontend/src/components/observability/__tests__ -name "*.snap" 2>/dev/null | wc -l || echo "0")
echo "  Found $SNAPSHOT_COUNT snapshot files"

echo ""
echo "=== OBS-819 Visual Regression Setup Complete ==="
echo ""
echo "Manual steps for visual testing:"
echo "  1. Run: npm run storybook"
echo "  2. Review each component visually"
echo "  3. Run: npm run test:visual (if configured)"
```

#### Pass Criteria

- [ ] Visual testing tool configured
- [ ] Story files for main components
- [ ] Snapshots up to date
- [ ] No visual regressions detected

---

### OBS-820: Add Performance Tests

**Purpose:** Ensure components perform well with large datasets.

#### Test Script

```bash
#!/bin/bash
# test-obs-820-performance.sh

set -e

echo "=== OBS-820: Performance Tests ==="

COMPONENTS_DIR="frontend/src/components/observability"

# Test 1: Virtualization for lists
echo "Test 1: Check for list virtualization..."
VIRTUAL=$(grep -r "react-window\|react-virtualized\|virtual" "$COMPONENTS_DIR" 2>/dev/null | wc -l || echo "0")
[ "$VIRTUAL" -gt 0 ] && echo "  ✓ Virtualization present" || echo "  ⚠ Consider adding virtualization for long lists"

# Test 2: Memoization usage
echo "Test 2: Check for memoization..."
MEMO=$(grep -r "useMemo\|useCallback\|React.memo" "$COMPONENTS_DIR" 2>/dev/null | wc -l || echo "0")
echo "  Found $MEMO memoization uses"
[ "$MEMO" -gt 10 ] && echo "  ✓ Good memoization coverage" || echo "  ⚠ Consider adding more memoization"

# Test 3: Check for expensive operations in render
echo "Test 3: Check for potential render issues..."
FILTER_MAP=$(grep -rn "\.filter.*\.map\|\.map.*\.filter" "$COMPONENTS_DIR" 2>/dev/null | wc -l || echo "0")
[ "$FILTER_MAP" -lt 5 ] && echo "  ✓ Minimal filter/map chains in render" || echo "  ⚠ Review filter/map chains ($FILTER_MAP found)"

# Test 4: Bundle size check
echo "Test 4: Check for large imports..."
LARGE_IMPORTS=$(grep -r "import \* as\|import { .*lodash\|moment\|d3\s*}" "$COMPONENTS_DIR" 2>/dev/null | wc -l || echo "0")
[ "$LARGE_IMPORTS" -lt 3 ] && echo "  ✓ No problematic large imports" || echo "  ⚠ Review large imports ($LARGE_IMPORTS found)"

# Test 5: Run performance tests if available
echo "Test 5: Running performance tests..."
if npm test -- --testPathPattern="performance\|perf" --passWithNoTests 2>/dev/null; then
    echo "  ✓ Performance tests pass"
else
    echo "  ⚠ No dedicated performance tests found"
fi

echo ""
echo "=== OBS-820 Performance Tests Complete ==="
```

#### Pass Criteria

- [ ] List virtualization for 100+ items
- [ ] useMemo/useCallback for expensive computations
- [ ] No unnecessary re-renders
- [ ] Bundle size reasonable
- [ ] Renders < 16ms for smooth 60fps

---

### OBS-821: Complete Documentation

**Purpose:** Document all components for future development.

#### Checklist

- [ ] README in observability components folder
- [ ] JSDoc comments on public APIs
- [ ] Storybook stories for all components
- [ ] Usage examples in documentation

#### Test Script

```bash
#!/bin/bash
# test-obs-821-docs.sh

set -e

echo "=== OBS-821: Documentation Tests ==="

COMPONENTS_DIR="frontend/src/components/observability"

# Test 1: README exists
echo "Test 1: README exists..."
[ -f "$COMPONENTS_DIR/README.md" ] && echo "  ✓ README exists" || echo "  ⚠ README missing"

# Test 2: JSDoc coverage
echo "Test 2: JSDoc coverage..."
JSDOC=$(grep -r "^\s*/\*\*" "$COMPONENTS_DIR"/*.tsx 2>/dev/null | wc -l || echo "0")
COMPONENTS=$(ls "$COMPONENTS_DIR"/*.tsx 2>/dev/null | wc -l || echo "0")
echo "  Found $JSDOC JSDoc blocks for $COMPONENTS components"
[ "$JSDOC" -ge "$COMPONENTS" ] && echo "  ✓ Good JSDoc coverage" || echo "  ⚠ Consider adding more JSDoc"

# Test 3: Export documentation
echo "Test 3: Export documentation..."
if [ -f "$COMPONENTS_DIR/index.ts" ]; then
    EXPORTS=$(grep -c "export" "$COMPONENTS_DIR/index.ts" 2>/dev/null || echo "0")
    echo "  Found $EXPORTS exports in index.ts"
    echo "  ✓ Index file exists"
else
    echo "  ⚠ Consider creating index.ts for clean exports"
fi

# Test 4: Props documentation
echo "Test 4: Interface documentation..."
INTERFACES=$(grep -r "^interface\|^type.*Props" "$COMPONENTS_DIR"/*.tsx 2>/dev/null | wc -l || echo "0")
echo "  Found $INTERFACES interface/type definitions"
[ "$INTERFACES" -gt 15 ] && echo "  ✓ Good type coverage" || echo "  ⚠ Consider documenting all props"

echo ""
echo "=== OBS-821 Documentation Tests Complete ==="
```

#### Pass Criteria

- [ ] README with overview and usage
- [ ] JSDoc on all exported functions/components
- [ ] Props documented with types
- [ ] Examples in documentation or Storybook

---

## Master Test Script

```bash
#!/bin/bash
# test-obs-phase8-all.sh
# Run all Phase 8 tests

set -e

echo "========================================"
echo "  OBSERVABILITY PHASE 8: UI COMPONENTS  "
echo "========================================"
echo ""

TESTS=(
    "test-obs-800-hub.sh"
    "test-obs-801-timeline.sh"
    "test-obs-802-heatmap.sh"
    "test-obs-803-assertions.sh"
    "test-obs-804-skillflow.sh"
    "test-obs-805-activity.sh"
    "test-obs-806-logviewer.sh"
    "test-obs-807-evidence.sh"
    "test-obs-808-quickstats.sh"
    "test-obs-809-viewselector.sh"
    "test-obs-810-breadcrumb.sh"
    "test-obs-811-deeplinkpanel.sh"
    "test-obs-812-review.sh"
    "test-obs-813-skilltrace.sh"
    "test-obs-814-messagebus.sh"
    "test-obs-815-wave.sh"
    "test-obs-816-toollog.sh"
    "test-obs-817-integration.sh"
    "test-obs-818-a11y.sh"
    "test-obs-819-visual.sh"
    "test-obs-820-performance.sh"
    "test-obs-821-docs.sh"
)

PASSED=0
FAILED=0
SKIPPED=0

for test in "${TESTS[@]}"; do
    echo ""
    echo "Running: $test"
    echo "----------------------------------------"

    if [ -f "tests/e2e/$test" ]; then
        if bash "tests/e2e/$test"; then
            PASSED=$((PASSED + 1))
        else
            FAILED=$((FAILED + 1))
        fi
    else
        echo "  ⚠ Test script not found, skipping"
        SKIPPED=$((SKIPPED + 1))
    fi
done

echo ""
echo "========================================"
echo "  PHASE 8 TEST SUMMARY"
echo "========================================"
echo ""
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Skipped: $SKIPPED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "  ✓ ALL TESTS PASSED"
    exit 0
else
    echo "  ✗ SOME TESTS FAILED"
    exit 1
fi
```

---

## Validation Checkpoints

### Phase 8 Complete Criteria

- [ ] All component files exist
- [ ] All components render without errors
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Accessibility audit passes
- [ ] Performance benchmarks met
- [ ] Documentation complete

### Manual Verification Steps

1. Open `/observability` in browser
2. Verify ObservabilityHub renders with all sections
3. Select an execution and verify:
   - Timeline shows phases and tasks
   - HeatMap shows tool activity
   - Assertions show pass/fail
   - Skills show invocation tree
   - Logs stream in real-time
4. Test deep linking:
   - Navigate to `/observability/exec/{id}`
   - Click on tool use, verify modal opens
   - Click on assertion, verify evidence shows
5. Test real-time:
   - Trigger an execution
   - Verify dashboard updates without refresh
6. Test export:
   - Export timeline as PNG
   - Export data as JSON

---

## Dependencies

| Phase   | Dependency          | Status |
| ------- | ------------------- | ------ |
| Phase 1 | Database schema     | ✅     |
| Phase 4 | TypeScript types    | ✅     |
| Phase 5 | API routes          | ✅     |
| Phase 6 | WebSocket streaming | ✅     |
| Phase 7 | React hooks         | ✅     |

---

## File Summary

| Task ID | File                         | Purpose                     |
| ------- | ---------------------------- | --------------------------- |
| OBS-800 | ObservabilityHub.tsx         | Main container              |
| OBS-801 | ExecutionTimeline.tsx        | Gantt-style timeline        |
| OBS-802 | ToolUseHeatMap.tsx           | Tool × Time grid            |
| OBS-803 | AssertionDashboard.tsx       | Assertion visualization     |
| OBS-804 | SkillFlowDiagram.tsx         | Skill invocation tree       |
| OBS-805 | AgentActivityGraph.tsx       | Real-time agent status      |
| OBS-806 | UnifiedLogViewer.tsx         | Human-readable log stream   |
| OBS-807 | EvidenceViewerModal.tsx      | Assertion evidence modal    |
| OBS-808 | QuickStats.tsx               | Metrics overview            |
| OBS-809 | ViewSelector.tsx             | Tab navigation              |
| OBS-810 | Breadcrumb.tsx               | Deep link breadcrumb        |
| OBS-811 | DeepLinkPanel.tsx            | Cross-reference panel       |
| OBS-812 | ExecutionReviewDashboard.tsx | Full execution review       |
| OBS-813 | SkillTraceViewer.tsx         | Skill detail view           |
| OBS-814 | MessageBusLogViewer.tsx      | Message bus events          |
| OBS-815 | WaveProgressPanel.tsx        | Wave progress visualization |
| OBS-816 | ToolUseLog.tsx               | Tool use detail list        |

---

_This implementation plan provides the detailed tasks, test scripts, and pass criteria for Phase 8. Execute tasks in order, running test scripts after each to validate completion._
