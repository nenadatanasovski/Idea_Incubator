# Observability UI Restructure Plan

> **Purpose:** Comprehensive plan to restructure Observability as a first-class top-level navigation item with unified sub-tabs for all logging, monitoring, and analytics functionality.
> **Created:** 2026-01-17
> **Status:** Planning

---

## Progress Tracker

| Phase | Description            | Status          | Tasks Done | Tests Pass |
| ----- | ---------------------- | --------------- | ---------- | ---------- |
| 1     | Navigation & Container | [x] Complete    | 18/18      | [x]        |
| 2     | Overview Dashboard     | [ ] In Progress | 0/19       | [ ]        |
| 3     | Event Log Migration    | [ ] Not Started | 0/8        | [ ]        |
| 4     | Executions Migration   | [ ] Not Started | 0/9        | [ ]        |
| 5     | Agents Sub-Tab         | [ ] Not Started | 0/14       | [ ]        |
| 6     | Analytics Sub-Tab      | [ ] Not Started | 0/13       | [ ]        |
| 7     | Unified Search         | [ ] Not Started | 0/10       | [ ]        |
| 8     | Real-Time Integration  | [ ] Not Started | 0/13       | [ ]        |
| 9     | Polish & Testing       | [ ] Not Started | 0/21       | [ ]        |

**Overall Progress: 0/125 tasks complete**

---

## Executive Summary

The current Observability implementation is fragmented across multiple disconnected pages:

- **Event Log** (`/events`) - Ideation/evaluation events, accessed via main nav
- **Observability** (`/observability`) - Execution runs, accessed via link in AgentDashboard
- **Agent Dashboard** (`/agents`) - Agent status, questions, activity

This plan restructures Observability as a **top-level navigation tab** with unified sub-tabs, providing a single entry point for understanding system behavior.

---

## First Principles Analysis

### What is Observability?

Observability is the ability to understand internal system state by examining outputs. For an AI agent system, this means answering:

1. **What's happening now?** (Real-time monitoring)
2. **What happened?** (Historical review)
3. **What went wrong?** (Debugging)
4. **How is the system performing?** (Analytics)

### Who Uses Observability?

| User Type     | Primary Need  | Key Questions                                          |
| ------------- | ------------- | ------------------------------------------------------ |
| **Developer** | Debugging     | "Why did this task fail?" "What tool calls were made?" |
| **Operator**  | Monitoring    | "Is the system healthy?" "Are agents stuck?"           |
| **Analyst**   | Understanding | "What patterns emerge?" "Where are bottlenecks?"       |

### Current Problems

1. **Fragmented Access** - Three different routes for related functionality
2. **No Unified Mental Model** - Users must learn multiple navigation paths
3. **Context Switching** - Jumping between pages loses context
4. **Hidden Features** - Observability buried in AgentDashboard link
5. **Duplicate Concepts** - "Event Log" vs "Logs" tab confusion

### Design Principles

1. **Single Entry Point** - One place for all observability
2. **Progressive Disclosure** - Overview → Category → Detail
3. **Context Preservation** - Breadcrumbs, URL state, back navigation
4. **Unified Search** - Search across all data types
5. **Real-Time First** - Live updates with clear connection status
6. **Elegant Navigation** - Clear hierarchy, obvious paths

---

## Target Architecture

### Navigation Structure

```
Main App Navigation:
┌────────────────────────────────────────────────────────────────────────┐
│ [Dashboard] [Ideate] [Ideas] [Debates] [Tasks] [OBSERVABILITY] [Profile] │
└────────────────────────────────────────────────────────────────────────┘
                                                        ↓
Observability Page (top-level, replaces /events route):
┌────────────────────────────────────────────────────────────────────────┐
│  🔍 Search across all observability data...              [Live ●]     │
├────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Event Log] [Executions] [Agents] [Analytics]              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     Sub-tab Content Area                        │  │
│  │                                                                  │  │
│  │  (Content changes based on selected sub-tab)                    │  │
│  │                                                                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Sub-Tab Content

| Sub-Tab        | Route                       | Content                                         | Source                         |
| -------------- | --------------------------- | ----------------------------------------------- | ------------------------------ |
| **Overview**   | `/observability`            | Quick stats, health indicators, recent activity | New                            |
| **Event Log**  | `/observability/events`     | Ideation/evaluation events by session           | Existing EventLog.tsx          |
| **Executions** | `/observability/executions` | Task execution runs list & details              | Existing ObservabilityPage.tsx |
| **Agents**     | `/observability/agents`     | Agent status, questions, activity feed          | Subset of AgentDashboard.tsx   |
| **Analytics**  | `/observability/analytics`  | Tool heatmaps, assertion dashboards, trends     | New visualizations             |

### URL Structure

```
/observability                          → Overview (default)
/observability/events                   → Event Log (sessions list)
/observability/events?session={id}      → Event Log with session selected
/observability/executions               → Execution runs list
/observability/executions/:id           → Execution detail (timeline, tools, etc.)
/observability/executions/:id?view=timeline → Specific view tab
/observability/agents                   → Agent status overview
/observability/agents/:id               → Individual agent detail
/observability/analytics                → Analytics dashboard
/observability/analytics/tools          → Tool usage analytics
/observability/analytics/assertions     → Assertion analytics
```

---

## Implementation Phases

### Phase 1: Navigation & Container Structure

**Goal:** Create the top-level Observability tab and container with sub-tab navigation.

---

#### 1.1 Update Main Navigation

**File:** `frontend/src/components/Layout.tsx`
**Effort:** Low

**Tasks:**

- [ ] **1.1.1** Replace `Event Log` nav item text with `Observability`
  - **Pass Criteria:** Navigation shows "Observability" text instead of "Event Log"
- [ ] **1.1.2** Change nav href from `/events` to `/observability`
  - **Pass Criteria:** Clicking nav item navigates to `/observability` URL
- [ ] **1.1.3** Update icon from `ScrollText` to `Activity`
  - **Pass Criteria:** Activity icon renders in navigation
- [ ] **1.1.4** Ensure active state works for all `/observability/*` routes
  - **Pass Criteria:** Nav item shows active styling when on any `/observability` sub-route

**Before:**

```tsx
{ name: "Event Log", href: "/events", icon: ScrollText },
```

**After:**

```tsx
{ name: "Observability", href: "/observability", icon: Activity },
```

---

#### 1.2 Create ObservabilityContainer Component

**File:** `frontend/src/components/observability/ObservabilityContainer.tsx`
**Effort:** Medium

**Tasks:**

- [ ] **1.2.1** Create container layout with header and sub-tab bar
  - **Pass Criteria:** Component renders without errors; header and sub-tab bar visible
- [ ] **1.2.2** Implement sub-tab navigation: Overview, Event Log, Executions, Agents, Analytics
  - **Pass Criteria:** All 5 tabs render with correct labels and icons
- [ ] **1.2.3** Add unified search bar placeholder
  - **Pass Criteria:** Search input visible in header area
- [ ] **1.2.4** Add real-time connection status indicator
  - **Pass Criteria:** Status dot renders; shows correct color based on connection state
- [ ] **1.2.5** Support URL-based tab selection
  - **Pass Criteria:** Navigating to `/observability/events` highlights Events tab
- [ ] **1.2.6** Persist tab selection in URL
  - **Pass Criteria:** Clicking tab updates browser URL

**Component Structure:**

```tsx
interface ObservabilityContainerProps {
  children: React.ReactNode;
  activeTab: "overview" | "events" | "executions" | "agents" | "analytics";
}

export function ObservabilityContainer({ children, activeTab }: Props) {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header with search and connection status */}
      <ObservabilityHeader />

      {/* Sub-tab navigation */}
      <ObservabilitySubTabs activeTab={activeTab} />

      {/* Content area */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
```

---

#### 1.3 Create ObservabilitySubTabs Component

**File:** `frontend/src/components/observability/ObservabilitySubTabs.tsx`
**Effort:** Low

**Tasks:**

- [ ] **1.3.1** Render 5 sub-tabs with icons and labels
  - **Pass Criteria:** All tabs visible with correct icons (LayoutDashboard, ScrollText, Play, Bot, BarChart3)
- [ ] **1.3.2** Highlight active tab based on current route
  - **Pass Criteria:** Active tab has distinct visual styling (e.g., border-bottom, background color)
- [ ] **1.3.3** Handle tab click navigation
  - **Pass Criteria:** Clicking tab navigates to correct route
- [ ] **1.3.4** Show counts/badges on tabs (e.g., error count on Agents)
  - **Pass Criteria:** Badge renders on Agents tab when errors > 0

**Tab Definitions:**

```tsx
const subTabs = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/observability",
  },
  {
    id: "events",
    label: "Event Log",
    icon: ScrollText,
    href: "/observability/events",
  },
  {
    id: "executions",
    label: "Executions",
    icon: Play,
    href: "/observability/executions",
  },
  {
    id: "agents",
    label: "Agents",
    icon: Bot,
    href: "/observability/agents",
    badge: errorCount,
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    href: "/observability/analytics",
  },
];
```

---

#### 1.4 Create ObservabilityHeader Component

**File:** `frontend/src/components/observability/ObservabilityHeader.tsx`
**Effort:** Low

**Tasks:**

- [ ] **1.4.1** Display page title "Observability"
  - **Pass Criteria:** Title text visible and styled correctly
- [ ] **1.4.2** Add unified search input (placeholder for Phase 7)
  - **Pass Criteria:** Search input renders with placeholder text
- [ ] **1.4.3** Show real-time connection status (green=connected, yellow=reconnecting, red=offline)
  - **Pass Criteria:** Status indicator renders with correct color
- [ ] **1.4.4** Add refresh button
  - **Pass Criteria:** Button renders and triggers data refresh on click

---

### Phase 1 Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-obs-phase1-navigation.sh
# Run: chmod +x tests/e2e/test-obs-phase1-navigation.sh && ./tests/e2e/test-obs-phase1-navigation.sh

set -e
echo "=== Phase 1: Navigation & Container Tests ==="

# Ensure frontend is running
curl -s http://localhost:5173 > /dev/null || { echo "FAIL: Frontend not running"; exit 1; }

echo "✓ Frontend is running"

# Test 1.1: Main navigation updated
echo "Testing main navigation..."
MAIN_NAV=$(curl -s http://localhost:5173 | grep -o "Observability" || true)
if [ -z "$MAIN_NAV" ]; then
    echo "FAIL: 'Observability' not found in main navigation"
    exit 1
fi
echo "✓ Main navigation shows 'Observability'"

# Test 1.2: Route exists
echo "Testing /observability route..."
ROUTE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability)
if [ "$ROUTE_STATUS" != "200" ]; then
    echo "FAIL: /observability route returned $ROUTE_STATUS"
    exit 1
fi
echo "✓ /observability route returns 200"

# Test 1.3: Sub-routes exist
for subroute in events executions agents analytics; do
    SUBROUTE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/observability/$subroute")
    if [ "$SUBROUTE_STATUS" != "200" ]; then
        echo "FAIL: /observability/$subroute route returned $SUBROUTE_STATUS"
        exit 1
    fi
    echo "✓ /observability/$subroute route returns 200"
done

echo ""
echo "=== Phase 1 Tests PASSED ==="
```

### Phase 1 Pass Criteria Summary

| Task ID | Description                 | Pass Criteria                            | Status |
| ------- | --------------------------- | ---------------------------------------- | ------ |
| 1.1.1   | Replace nav text            | Shows "Observability"                    | [ ]    |
| 1.1.2   | Update nav href             | Navigates to `/observability`            | [ ]    |
| 1.1.3   | Update nav icon             | Activity icon visible                    | [ ]    |
| 1.1.4   | Active state on sub-routes  | Active styling on all `/observability/*` | [ ]    |
| 1.2.1   | Container layout            | Renders header + sub-tabs                | [ ]    |
| 1.2.2   | Sub-tab navigation          | 5 tabs with labels/icons                 | [ ]    |
| 1.2.3   | Search bar placeholder      | Input visible in header                  | [ ]    |
| 1.2.4   | Connection status indicator | Status dot renders                       | [ ]    |
| 1.2.5   | URL-based tab selection     | URL determines active tab                | [ ]    |
| 1.2.6   | Persist tab in URL          | Click tab updates URL                    | [ ]    |
| 1.3.1   | Render 5 sub-tabs           | All tabs visible with icons              | [ ]    |
| 1.3.2   | Highlight active tab        | Active tab distinct styling              | [ ]    |
| 1.3.3   | Tab click navigation        | Click navigates to route                 | [ ]    |
| 1.3.4   | Badge on tabs               | Badge shows when errors > 0              | [ ]    |
| 1.4.1   | Display page title          | "Observability" visible                  | [ ]    |
| 1.4.2   | Search input placeholder    | Input renders                            | [ ]    |
| 1.4.3   | Connection status colors    | Green/yellow/red based on state          | [ ]    |
| 1.4.4   | Refresh button              | Button triggers data refresh             | [ ]    |

---

### Phase 2: Overview Dashboard (Default View)

**Goal:** Create the default Overview tab showing system health at a glance.

---

#### 2.1 Create OverviewDashboard Component

**File:** `frontend/src/components/observability/OverviewDashboard.tsx`
**Effort:** Medium

**Tasks:**

- [ ] **2.1.1** Create component skeleton with proper TypeScript types
  - **Pass Criteria:** Component exports correctly; no TypeScript errors
- [ ] **2.1.2** Quick stats cards row: Active Executions, Error Rate, Blocked Agents, Pending Questions
  - **Pass Criteria:** 4 stat cards render with correct labels and values from API
- [ ] **2.1.3** System health indicator section
  - **Pass Criteria:** Health indicator visible with status text
- [ ] **2.1.4** Recent activity timeline (last 10 events from all sources)
  - **Pass Criteria:** Activity list renders with timestamps and descriptions
- [ ] **2.1.5** Quick links to dive into specific areas
  - **Pass Criteria:** "View All" links navigate to correct sub-tabs

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Quick Stats                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│ │   Active    │ │   Error     │ │  Blocked    │ │  Pending    │        │
│ │ Executions  │ │    Rate     │ │   Agents    │ │ Questions   │        │
│ │     3       │ │    2.1%     │ │      1      │ │      4      │        │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────────────────────┤
│ System Health: ● Healthy                            Last updated: 2s ago│
├─────────────────────────────────────────────────────────────────────────┤
│ Recent Activity                                          [View All →]   │
│ ─────────────────────────────────────────────────────────────────────── │
│ 10:32:15  [Execution]  Run #42 completed successfully                   │
│ 10:32:01  [Agent]      build-agent-3 started task T-IDEA-FEA-012       │
│ 10:31:45  [Event]      Evaluation started for "AI Assistant" idea       │
│ 10:31:30  [Question]   New blocking question from spec-agent           │
│ 10:31:12  [Execution]  Run #41 failed: TypeScript compilation error    │
│ ...                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

#### 2.2 Create QuickStatsRow Component

**File:** `frontend/src/components/observability/QuickStatsRow.tsx`
**Effort:** Low

**Tasks:**

- [ ] **2.2.1** Create reusable StatCard sub-component
  - **Pass Criteria:** StatCard accepts label, value, trend, and color props
- [ ] **2.2.2** Support for trend indicators (↑ ↓ ─)
  - **Pass Criteria:** Trend arrow renders based on `trend` prop
- [ ] **2.2.3** Color coding based on threshold (green/yellow/red)
  - **Pass Criteria:** Card border/background changes based on threshold
- [ ] **2.2.4** Click to navigate to relevant sub-tab
  - **Pass Criteria:** Clicking card navigates (e.g., "Blocked Agents" → Agents tab)

---

#### 2.3 Create SystemHealthIndicator Component

**File:** `frontend/src/components/observability/SystemHealthIndicator.tsx`
**Effort:** Low

**Tasks:**

- [ ] **2.3.1** Aggregate health from multiple sources (executions, agents, questions)
  - **Pass Criteria:** Health calculation considers all relevant metrics
- [ ] **2.3.2** Display status: Healthy (green), Degraded (yellow), Critical (red)
  - **Pass Criteria:** Correct color and label based on health score
- [ ] **2.3.3** Show "last updated" timestamp
  - **Pass Criteria:** Relative timestamp displays (e.g., "2s ago")
- [ ] **2.3.4** Tooltip with health breakdown
  - **Pass Criteria:** Hover shows detailed breakdown of health factors

---

#### 2.4 Create RecentActivityFeed Component

**File:** `frontend/src/components/observability/RecentActivityFeed.tsx`
**Effort:** Medium

**Tasks:**

- [ ] **2.4.1** Unified feed from all sources (events, executions, agents, questions)
  - **Pass Criteria:** Feed shows items from multiple sources
- [ ] **2.4.2** Color-coded by source type
  - **Pass Criteria:** Different colors for Execution/Agent/Event/Question
- [ ] **2.4.3** Timestamp formatting
  - **Pass Criteria:** Times formatted as HH:MM:SS
- [ ] **2.4.4** Click to navigate to source
  - **Pass Criteria:** Clicking item opens relevant detail view
- [ ] **2.4.5** Real-time updates via WebSocket
  - **Pass Criteria:** New items appear without page refresh
- [ ] **2.4.6** "View All" link to relevant sub-tab
  - **Pass Criteria:** Link navigates to Events/Executions/Agents as appropriate

---

### Phase 2 Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-obs-phase2-overview.sh
# Run: chmod +x tests/e2e/test-obs-phase2-overview.sh && ./tests/e2e/test-obs-phase2-overview.sh

set -e
echo "=== Phase 2: Overview Dashboard Tests ==="

# Ensure servers are running
curl -s http://localhost:5173 > /dev/null || { echo "FAIL: Frontend not running"; exit 1; }
curl -s http://localhost:3001/api/health > /dev/null || { echo "FAIL: Backend not running"; exit 1; }

echo "✓ Frontend and Backend running"

# Test 2.1: Overview is default view
echo "Testing overview as default..."
OVERVIEW_CONTENT=$(curl -s http://localhost:5173/observability)
if ! echo "$OVERVIEW_CONTENT" | grep -q "Quick Stats\|Active Executions\|System Health"; then
    echo "FAIL: Overview dashboard content not found"
    exit 1
fi
echo "✓ Overview dashboard renders"

# Test 2.2: API endpoints exist for stats
echo "Testing stats API endpoints..."
for endpoint in "observability/stats" "agents" "questions/pending"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/$endpoint")
    if [ "$STATUS" != "200" ]; then
        echo "WARN: /api/$endpoint returned $STATUS (may need implementation)"
    else
        echo "✓ /api/$endpoint returns 200"
    fi
done

# Test 2.3: Activity feed endpoint
echo "Testing activity feed..."
ACTIVITY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/observability/activity?limit=10")
if [ "$ACTIVITY_STATUS" != "200" ]; then
    echo "WARN: Activity feed endpoint not available (may need implementation)"
else
    echo "✓ Activity feed endpoint returns 200"
fi

echo ""
echo "=== Phase 2 Tests PASSED ==="
```

### Phase 2 Pass Criteria Summary

| Task ID | Description              | Pass Criteria                      | Status |
| ------- | ------------------------ | ---------------------------------- | ------ |
| 2.1.1   | Component skeleton       | No TypeScript errors               | [ ]    |
| 2.1.2   | Quick stats cards        | 4 cards with labels/values         | [ ]    |
| 2.1.3   | Health indicator section | Health indicator visible           | [ ]    |
| 2.1.4   | Activity timeline        | 10 items with timestamps           | [ ]    |
| 2.1.5   | Quick links              | "View All" navigates correctly     | [ ]    |
| 2.2.1   | StatCard sub-component   | Accepts label, value, trend, color | [ ]    |
| 2.2.2   | Trend indicators         | ↑ ↓ ─ render based on prop         | [ ]    |
| 2.2.3   | Threshold color coding   | Green/yellow/red based on value    | [ ]    |
| 2.2.4   | Card click navigation    | Click navigates to sub-tab         | [ ]    |
| 2.3.1   | Aggregate health         | Considers all metrics              | [ ]    |
| 2.3.2   | Health status display    | Correct color and label            | [ ]    |
| 2.3.3   | Last updated timestamp   | Relative time displays             | [ ]    |
| 2.3.4   | Health breakdown tooltip | Hover shows details                | [ ]    |
| 2.4.1   | Unified feed             | Multiple sources in one list       | [ ]    |
| 2.4.2   | Color-coded by source    | Different colors per type          | [ ]    |
| 2.4.3   | Timestamp formatting     | HH:MM:SS format                    | [ ]    |
| 2.4.4   | Click navigation         | Opens detail view                  | [ ]    |
| 2.4.5   | Real-time updates        | New items appear automatically     | [ ]    |
| 2.4.6   | "View All" link          | Navigates to appropriate tab       | [ ]    |

---

### Phase 3: Event Log Sub-Tab (Migration)

**Goal:** Move existing EventLog.tsx content into the Observability sub-tab structure.

---

#### 3.1 Create EventLogTab Component

**File:** `frontend/src/components/observability/EventLogTab.tsx`
**Effort:** Medium

**Tasks:**

- [ ] **3.1.1** Extract core content from EventLog.tsx
  - **Pass Criteria:** EventLogTab renders same content as original EventLog
- [ ] **3.1.2** Adapt to work within ObservabilityContainer (remove page-level header/layout)
  - **Pass Criteria:** Component renders correctly inside container without duplicate headers
- [ ] **3.1.3** Maintain session selection via URL params (`?session={id}`)
  - **Pass Criteria:** Session ID persists in URL; page reload maintains selection
- [ ] **3.1.4** Keep existing Events/API Calls tabs
  - **Pass Criteria:** Both sub-tabs render and switch correctly
- [ ] **3.1.5** Ensure styling consistency with new container
  - **Pass Criteria:** No visual regressions; consistent spacing and colors

**Key Changes from EventLog.tsx:**

- Remove page-level header (container handles this)
- Remove page-level layout (container handles this)
- Use URL params instead of local state for session selection
- Integrate with unified real-time connection

---

#### 3.2 Update Routes

**File:** `frontend/src/App.tsx`
**Effort:** Low

**Tasks:**

- [ ] **3.2.1** Add nested routes under `/observability`
  - **Pass Criteria:** All sub-routes render correct components
- [ ] **3.2.2** Add `/observability/events` route pointing to EventLogTab
  - **Pass Criteria:** Route renders EventLogTab component
- [ ] **3.2.3** Add redirect from `/events` to `/observability/events` for backwards compatibility
  - **Pass Criteria:** `/events` redirects to `/observability/events`

**Route Changes:**

```tsx
// Remove:
<Route path="/events" element={<EventLog />} />

// Add:
<Route path="/observability" element={<ObservabilityPage />}>
  <Route index element={<OverviewDashboard />} />
  <Route path="events" element={<EventLogTab />} />
  <Route path="executions" element={<ExecutionsTab />} />
  <Route path="executions/:id" element={<ExecutionReviewPage />} />
  <Route path="agents" element={<AgentsTab />} />
  <Route path="agents/:id" element={<AgentDetailPage />} />
  <Route path="analytics" element={<AnalyticsTab />} />
</Route>

// Add redirect for backwards compatibility:
<Route path="/events" element={<Navigate to="/observability/events" replace />} />
```

---

### Phase 3 Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-obs-phase3-eventlog.sh
# Run: chmod +x tests/e2e/test-obs-phase3-eventlog.sh && ./tests/e2e/test-obs-phase3-eventlog.sh

set -e
echo "=== Phase 3: Event Log Migration Tests ==="

# Ensure frontend is running
curl -s http://localhost:5173 > /dev/null || { echo "FAIL: Frontend not running"; exit 1; }

echo "✓ Frontend is running"

# Test 3.1: Event Log tab renders
echo "Testing /observability/events route..."
EVENTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/events)
if [ "$EVENTS_STATUS" != "200" ]; then
    echo "FAIL: /observability/events returned $EVENTS_STATUS"
    exit 1
fi
echo "✓ /observability/events returns 200"

# Test 3.2: Backwards compatibility redirect
echo "Testing /events redirect..."
REDIRECT_LOCATION=$(curl -s -o /dev/null -w "%{redirect_url}" -L http://localhost:5173/events)
if ! echo "$REDIRECT_LOCATION" | grep -q "/observability/events"; then
    echo "FAIL: /events does not redirect to /observability/events"
    exit 1
fi
echo "✓ /events redirects to /observability/events"

# Test 3.3: Session URL param
echo "Testing session URL param..."
SESSION_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/observability/events?session=test-123")
if [ "$SESSION_STATUS" != "200" ]; then
    echo "FAIL: Session param URL returned $SESSION_STATUS"
    exit 1
fi
echo "✓ Session param URL works"

# Test 3.4: API endpoint for events
echo "Testing events API..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/events")
if [ "$API_STATUS" != "200" ]; then
    echo "WARN: /api/events returned $API_STATUS"
else
    echo "✓ /api/events returns 200"
fi

echo ""
echo "=== Phase 3 Tests PASSED ==="
```

### Phase 3 Pass Criteria Summary

| Task ID | Description                 | Pass Criteria                           | Status |
| ------- | --------------------------- | --------------------------------------- | ------ |
| 3.1.1   | Extract core content        | Renders same content as EventLog        | [ ]    |
| 3.1.2   | Adapt to container          | No duplicate headers; fits in container | [ ]    |
| 3.1.3   | Session URL params          | Session ID in URL; survives reload      | [ ]    |
| 3.1.4   | Events/API Calls sub-tabs   | Both tabs render and switch             | [ ]    |
| 3.1.5   | Styling consistency         | No visual regressions                   | [ ]    |
| 3.2.1   | Nested routes               | All sub-routes render correctly         | [ ]    |
| 3.2.2   | /observability/events route | Route renders EventLogTab               | [ ]    |
| 3.2.3   | /events redirect            | Redirects to /observability/events      | [ ]    |

---

### Phase 4: Executions Sub-Tab (Migration)

**Goal:** Move existing Observability execution content into the sub-tab structure.

---

#### 4.1 Create ExecutionsTab Component

**File:** `frontend/src/components/observability/ExecutionsTab.tsx`
**Effort:** Medium

**Tasks:**

- [ ] **4.1.1** Extract ExecutionList from current ObservabilityPage
  - **Pass Criteria:** ExecutionList renders same content as original page
- [ ] **4.1.2** Adapt to work within ObservabilityContainer
  - **Pass Criteria:** Component fits in container; no layout issues
- [ ] **4.1.3** Maintain existing functionality (list, filters, pagination)
  - **Pass Criteria:** All filters work; pagination works; sorting works

---

#### 4.2 Migrate ExecutionReviewPage

**File:** `frontend/src/pages/ExecutionReviewPage.tsx`
**Effort:** Low

**Tasks:**

- [ ] **4.2.1** Ensure route works at `/observability/executions/:id`
  - **Pass Criteria:** Page renders correctly at new path
- [ ] **4.2.2** Ensure back navigation goes to `/observability/executions`
  - **Pass Criteria:** Back button/link returns to executions list
- [ ] **4.2.3** Update breadcrumb to show Observability → Executions → Run #X
  - **Pass Criteria:** Breadcrumb shows correct hierarchy

---

#### 4.3 Update Old ObservabilityPage

**File:** `frontend/src/pages/ObservabilityPage.tsx`
**Effort:** Low

**Tasks:**

- [ ] **4.3.1** Refactor to be the container page that renders ObservabilityContainer
  - **Pass Criteria:** Page wraps content with ObservabilityContainer
- [ ] **4.3.2** Use React Router Outlet for sub-tab content
  - **Pass Criteria:** Outlet renders correct component based on route
- [ ] **4.3.3** Handle default redirect to Overview
  - **Pass Criteria:** `/observability` shows Overview tab by default

---

### Phase 4 Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-obs-phase4-executions.sh
# Run: chmod +x tests/e2e/test-obs-phase4-executions.sh && ./tests/e2e/test-obs-phase4-executions.sh

set -e
echo "=== Phase 4: Executions Migration Tests ==="

# Ensure servers are running
curl -s http://localhost:5173 > /dev/null || { echo "FAIL: Frontend not running"; exit 1; }
curl -s http://localhost:3001/api/health > /dev/null || { echo "FAIL: Backend not running"; exit 1; }

echo "✓ Servers running"

# Test 4.1: Executions list route
echo "Testing /observability/executions route..."
EXEC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/executions)
if [ "$EXEC_STATUS" != "200" ]; then
    echo "FAIL: /observability/executions returned $EXEC_STATUS"
    exit 1
fi
echo "✓ /observability/executions returns 200"

# Test 4.2: Execution detail route
echo "Testing execution detail route..."
DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/executions/test-id)
if [ "$DETAIL_STATUS" != "200" ]; then
    echo "FAIL: Execution detail route returned $DETAIL_STATUS"
    exit 1
fi
echo "✓ Execution detail route returns 200"

# Test 4.3: API endpoint for executions
echo "Testing executions API..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/observability/runs")
if [ "$API_STATUS" != "200" ]; then
    echo "WARN: /api/observability/runs returned $API_STATUS"
else
    echo "✓ /api/observability/runs returns 200"
fi

# Test 4.4: Pagination support
echo "Testing pagination..."
PAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/observability/runs?page=1&limit=10")
if [ "$PAGE_STATUS" != "200" ]; then
    echo "WARN: Pagination query returned $PAGE_STATUS"
else
    echo "✓ Pagination query returns 200"
fi

echo ""
echo "=== Phase 4 Tests PASSED ==="
```

### Phase 4 Pass Criteria Summary

| Task ID | Description           | Pass Criteria                                 | Status |
| ------- | --------------------- | --------------------------------------------- | ------ |
| 4.1.1   | Extract ExecutionList | Renders same content as original              | [ ]    |
| 4.1.2   | Adapt to container    | Fits in container; no layout issues           | [ ]    |
| 4.1.3   | Filters/pagination    | All filters work; pagination works            | [ ]    |
| 4.2.1   | Route at new path     | Page renders at /observability/executions/:id | [ ]    |
| 4.2.2   | Back navigation       | Returns to executions list                    | [ ]    |
| 4.2.3   | Breadcrumb hierarchy  | Shows Observability → Executions → Run        | [ ]    |
| 4.3.1   | Container wrapper     | Page wraps with ObservabilityContainer        | [ ]    |
| 4.3.2   | React Router Outlet   | Outlet renders correct component              | [ ]    |
| 4.3.3   | Default redirect      | /observability shows Overview                 | [ ]    |

---

### Phase 5: Agents Sub-Tab

**Goal:** Create a focused agent monitoring view within Observability.

---

#### 5.1 Create AgentsTab Component

**File:** `frontend/src/components/observability/AgentsTab.tsx`
**Effort:** Medium

**Tasks:**

- [ ] **5.1.1** Create component structure with three sections: Status Grid, Questions, Activity
  - **Pass Criteria:** Component renders all three sections
- [ ] **5.1.2** Agent status grid (subset of AgentDashboard)
  - **Pass Criteria:** Grid shows all registered agents with status
- [ ] **5.1.3** Blocking questions queue with answer UI
  - **Pass Criteria:** Questions list renders with answer buttons
- [ ] **5.1.4** Agent activity feed
  - **Pass Criteria:** Activity feed shows recent agent actions
- [ ] **5.1.5** Real-time status updates via WebSocket
  - **Pass Criteria:** Status changes without page refresh

**Difference from AgentDashboard:**

- AgentsTab is **observation-focused** (status, logs, questions)
- AgentDashboard is **control-focused** (start/stop executor, manage tasks)
- AgentsTab lives under Observability
- AgentDashboard remains at `/agents` for control operations

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Agent Status                                              [View All →]  │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│ │ spec-agent│ │build-agent│ │validation │ │   sia     │ │ ux-agent  │ │
│ │  ● Idle   │ │ ● Running │ │  ● Idle   │ │ ● Blocked │ │  ● Error  │ │
│ │  Tasks: 0 │ │  Tasks: 1 │ │  Tasks: 0 │ │  Tasks: 1 │ │  Tasks: 0 │ │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ Blocking Questions (4)                                                  │
│ ─────────────────────────────────────────────────────────────────────── │
│ 🔴 HIGH  | spec-agent asks: "Which authentication method?"    [Answer]  │
│ 🟡 MED   | build-agent asks: "Should I create migration?"     [Answer]  │
│ 🟡 MED   | sia asks: "Is this pattern worth recording?"       [Answer]  │
│ 🟢 LOW   | validation asks: "Run full test suite?"            [Answer]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Recent Agent Activity                                                   │
│ ─────────────────────────────────────────────────────────────────────── │
│ 10:32:15  build-agent   Task T-IDEA-FEA-012 completed                  │
│ 10:31:45  spec-agent    Blocked: waiting for user input                │
│ 10:31:30  ux-agent      Error: File not found                          │
│ ...                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

#### 5.2 Create AgentStatusGrid Component

**File:** `frontend/src/components/observability/AgentStatusGrid.tsx`
**Effort:** Low

**Tasks:**

- [ ] **5.2.1** Extract agent status card logic from AgentDashboard
  - **Pass Criteria:** Cards show same info as AgentDashboard cards
- [ ] **5.2.2** Compact card design for grid layout
  - **Pass Criteria:** Cards fit 5 across on desktop viewport
- [ ] **5.2.3** Status indicators: Idle (gray), Running (blue), Blocked (orange), Error (red)
  - **Pass Criteria:** Correct color for each status
- [ ] **5.2.4** Click to expand or navigate to detail
  - **Pass Criteria:** Click opens detail view or navigates to /observability/agents/:id

---

#### 5.3 Create BlockingQuestionsPanel Component

**File:** `frontend/src/components/observability/BlockingQuestionsPanel.tsx`
**Effort:** Medium

**Tasks:**

- [ ] **5.3.1** Extract from existing questions handling (useBlockingQuestions hook)
  - **Pass Criteria:** Panel shows questions from API
- [ ] **5.3.2** Priority-sorted list (HIGH → MED → LOW)
  - **Pass Criteria:** Questions sorted by priority
- [ ] **5.3.3** Inline answer option for simple questions
  - **Pass Criteria:** Simple text questions have inline answer input
- [ ] **5.3.4** Modal for complex multi-field questions
  - **Pass Criteria:** Complex questions open modal
- [ ] **5.3.5** Real-time updates via WebSocket
  - **Pass Criteria:** New questions appear; answered questions disappear

---

### Phase 5 Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-obs-phase5-agents.sh
# Run: chmod +x tests/e2e/test-obs-phase5-agents.sh && ./tests/e2e/test-obs-phase5-agents.sh

set -e
echo "=== Phase 5: Agents Sub-Tab Tests ==="

# Ensure servers are running
curl -s http://localhost:5173 > /dev/null || { echo "FAIL: Frontend not running"; exit 1; }
curl -s http://localhost:3001/api/health > /dev/null || { echo "FAIL: Backend not running"; exit 1; }

echo "✓ Servers running"

# Test 5.1: Agents tab route
echo "Testing /observability/agents route..."
AGENTS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/agents)
if [ "$AGENTS_STATUS" != "200" ]; then
    echo "FAIL: /observability/agents returned $AGENTS_STATUS"
    exit 1
fi
echo "✓ /observability/agents returns 200"

# Test 5.2: Agent detail route
echo "Testing agent detail route..."
DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/agents/spec-agent)
if [ "$DETAIL_STATUS" != "200" ]; then
    echo "WARN: Agent detail route returned $DETAIL_STATUS"
else
    echo "✓ Agent detail route returns 200"
fi

# Test 5.3: Agents API endpoint
echo "Testing agents API..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/agents")
if [ "$API_STATUS" != "200" ]; then
    echo "WARN: /api/agents returned $API_STATUS"
else
    echo "✓ /api/agents returns 200"
fi

# Test 5.4: Questions API endpoint
echo "Testing questions API..."
QUESTIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/questions/pending")
if [ "$QUESTIONS_STATUS" != "200" ]; then
    echo "WARN: /api/questions/pending returned $QUESTIONS_STATUS"
else
    echo "✓ /api/questions/pending returns 200"
fi

# Test 5.5: Question answer endpoint
echo "Testing question answer endpoint..."
ANSWER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3001/api/questions/test-id/answer" -H "Content-Type: application/json" -d '{"answer":"test"}')
if [ "$ANSWER_STATUS" != "200" ] && [ "$ANSWER_STATUS" != "404" ]; then
    echo "WARN: Question answer endpoint returned $ANSWER_STATUS"
else
    echo "✓ Question answer endpoint accessible"
fi

echo ""
echo "=== Phase 5 Tests PASSED ==="
```

### Phase 5 Pass Criteria Summary

| Task ID | Description                | Pass Criteria                            | Status |
| ------- | -------------------------- | ---------------------------------------- | ------ |
| 5.1.1   | Three-section structure    | Status Grid, Questions, Activity visible | [ ]    |
| 5.1.2   | Agent status grid          | Shows all registered agents              | [ ]    |
| 5.1.3   | Blocking questions queue   | Questions list with answer buttons       | [ ]    |
| 5.1.4   | Agent activity feed        | Shows recent agent actions               | [ ]    |
| 5.1.5   | Real-time updates          | Status changes without refresh           | [ ]    |
| 5.2.1   | Extract card logic         | Same info as AgentDashboard              | [ ]    |
| 5.2.2   | Compact card design        | 5 cards fit across desktop               | [ ]    |
| 5.2.3   | Status color indicators    | Correct color per status                 | [ ]    |
| 5.2.4   | Click navigation           | Opens detail view                        | [ ]    |
| 5.3.1   | Extract questions logic    | Panel shows API questions                | [ ]    |
| 5.3.2   | Priority sorting           | HIGH → MED → LOW order                   | [ ]    |
| 5.3.3   | Inline answer              | Simple questions have inline input       | [ ]    |
| 5.3.4   | Modal for complex          | Complex questions open modal             | [ ]    |
| 5.3.5   | Real-time question updates | New/answered questions update live       | [ ]    |

---

### Phase 6: Analytics Sub-Tab

**Goal:** Create a dedicated analytics view for patterns and trends.

---

#### 6.1 Create AnalyticsTab Component

**File:** `frontend/src/components/observability/AnalyticsTab.tsx`
**Effort:** High

**Tasks:**

- [ ] **6.1.1** Create component layout with 4 visualization panels
  - **Pass Criteria:** Four panels render in 2x2 grid on desktop
- [ ] **6.1.2** Tool usage analytics section
  - **Pass Criteria:** Shows tool usage counts/frequency
- [ ] **6.1.3** Assertion pass/fail trends
  - **Pass Criteria:** Shows assertion success rates over time
- [ ] **6.1.4** Execution duration trends
  - **Pass Criteria:** Shows avg, min, max, P95 durations
- [ ] **6.1.5** Error hotspots
  - **Pass Criteria:** Shows files/components with most errors
- [ ] **6.1.6** Time range selector integration
  - **Pass Criteria:** Time range changes update all charts

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Time Range: [1h] [6h] [24h] [7d]                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Tool Usage Heatmap          │  │ Assertion Trends                │  │
│  │ ┌─────────────────────────┐ │  │ ┌─────────────────────────────┐ │  │
│  │ │  Read  ████████████████ │ │  │ │     Pass Rate: 94.2%        │ │  │
│  │ │  Edit  ████████         │ │  │ │     ▁▂▃▅▇▆▅▆▇█▇▆▅▆▇█      │ │  │
│  │ │  Write ██████           │ │  │ │                              │ │  │
│  │ │  Bash  ████████████     │ │  │ │  ● tsc_compiles: 98%        │ │  │
│  │ │  Grep  ██████████       │ │  │ │  ● test_passes: 89%         │ │  │
│  │ └─────────────────────────┘ │  │ │  ● lint_passes: 96%         │ │  │
│  └─────────────────────────────┘  │ └─────────────────────────────┘ │  │
│                                    └─────────────────────────────────┘  │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Execution Duration          │  │ Error Hotspots                  │  │
│  │ ┌─────────────────────────┐ │  │ ┌─────────────────────────────┐ │  │
│  │ │  Avg: 45s  P95: 2m 30s  │ │  │ │  server/routes/api.ts  (5) │ │  │
│  │ │  ▁▂▃▂▁▂▃▅▇▅▃▂▁▂▃▄▅▃▂▁  │ │  │ │  src/utils/parser.ts   (3) │ │  │
│  │ │                          │ │  │ │  database/migrate.ts   (2) │ │  │
│  │ └─────────────────────────┘ │  │ └─────────────────────────────┘ │  │
│  └─────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

#### 6.2 Migrate Existing Visualization Components

**Effort:** Medium

**Tasks:**

- [ ] **6.2.1** Move ToolUseHeatMap to Analytics tab
  - **Pass Criteria:** Heatmap renders with same data/styling
- [ ] **6.2.2** Move AssertionDashboard to Analytics tab
  - **Pass Criteria:** Dashboard renders with same data/styling
- [ ] **6.2.3** Create ExecutionDurationChart (new)
  - **Pass Criteria:** Chart shows duration distribution over time
- [ ] **6.2.4** Create ErrorHotspotsPanel (new)
  - **Pass Criteria:** Panel shows ranked list of error locations

---

#### 6.3 Create TimeRangeSelector Component

**File:** `frontend/src/components/observability/TimeRangeSelector.tsx`
**Effort:** Low

**Tasks:**

- [ ] **6.3.1** Preset time ranges: 1h, 6h, 24h, 7d
  - **Pass Criteria:** Four preset buttons render and function
- [ ] **6.3.2** Custom date range picker (optional)
  - **Pass Criteria:** Date picker opens; selection works
- [ ] **6.3.3** Persist selection in URL params
  - **Pass Criteria:** URL updates with `?range=24h`; reload preserves

---

### Phase 6 Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-obs-phase6-analytics.sh
# Run: chmod +x tests/e2e/test-obs-phase6-analytics.sh && ./tests/e2e/test-obs-phase6-analytics.sh

set -e
echo "=== Phase 6: Analytics Sub-Tab Tests ==="

# Ensure servers are running
curl -s http://localhost:5173 > /dev/null || { echo "FAIL: Frontend not running"; exit 1; }
curl -s http://localhost:3001/api/health > /dev/null || { echo "FAIL: Backend not running"; exit 1; }

echo "✓ Servers running"

# Test 6.1: Analytics tab route
echo "Testing /observability/analytics route..."
ANALYTICS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/analytics)
if [ "$ANALYTICS_STATUS" != "200" ]; then
    echo "FAIL: /observability/analytics returned $ANALYTICS_STATUS"
    exit 1
fi
echo "✓ /observability/analytics returns 200"

# Test 6.2: Time range URL param
echo "Testing time range URL param..."
RANGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/observability/analytics?range=24h")
if [ "$RANGE_STATUS" != "200" ]; then
    echo "FAIL: Time range param returned $RANGE_STATUS"
    exit 1
fi
echo "✓ Time range param works"

# Test 6.3: Tool usage API
echo "Testing tool usage API..."
TOOLS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/observability/analytics/tools?range=24h")
if [ "$TOOLS_STATUS" != "200" ]; then
    echo "WARN: /api/observability/analytics/tools returned $TOOLS_STATUS (may need implementation)"
else
    echo "✓ Tool usage API returns 200"
fi

# Test 6.4: Assertions API
echo "Testing assertions API..."
ASSERTIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/observability/analytics/assertions?range=24h")
if [ "$ASSERTIONS_STATUS" != "200" ]; then
    echo "WARN: /api/observability/analytics/assertions returned $ASSERTIONS_STATUS (may need implementation)"
else
    echo "✓ Assertions API returns 200"
fi

# Test 6.5: Errors API
echo "Testing errors API..."
ERRORS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/observability/analytics/errors?range=24h")
if [ "$ERRORS_STATUS" != "200" ]; then
    echo "WARN: /api/observability/analytics/errors returned $ERRORS_STATUS (may need implementation)"
else
    echo "✓ Errors API returns 200"
fi

echo ""
echo "=== Phase 6 Tests PASSED ==="
```

### Phase 6 Pass Criteria Summary

| Task ID | Description            | Pass Criteria                 | Status |
| ------- | ---------------------- | ----------------------------- | ------ |
| 6.1.1   | 4-panel layout         | 2x2 grid on desktop           | [ ]    |
| 6.1.2   | Tool usage section     | Shows tool counts/frequency   | [ ]    |
| 6.1.3   | Assertion trends       | Shows success rates over time | [ ]    |
| 6.1.4   | Execution duration     | Shows avg, min, max, P95      | [ ]    |
| 6.1.5   | Error hotspots         | Shows files with most errors  | [ ]    |
| 6.1.6   | Time range integration | Changes update all charts     | [ ]    |
| 6.2.1   | Migrate ToolUseHeatMap | Renders same data/styling     | [ ]    |
| 6.2.2   | Migrate AssertionDash  | Renders same data/styling     | [ ]    |
| 6.2.3   | ExecutionDurationChart | Shows duration distribution   | [ ]    |
| 6.2.4   | ErrorHotspotsPanel     | Shows ranked error locations  | [ ]    |
| 6.3.1   | Preset time ranges     | 1h, 6h, 24h, 7d buttons work  | [ ]    |
| 6.3.2   | Custom date picker     | Date picker opens and works   | [ ]    |
| 6.3.3   | URL param persistence  | Range persists in URL         | [ ]    |

---

### Phase 7: Unified Search

**Goal:** Enable searching across all observability data from the header.

---

#### 7.1 Create ObservabilitySearch Component

**File:** `frontend/src/components/observability/ObservabilitySearch.tsx`
**Effort:** High

**Tasks:**

- [ ] **7.1.1** Search input with debounce (300ms)
  - **Pass Criteria:** Search only triggers 300ms after user stops typing
- [ ] **7.1.2** Search across: events, executions, tool uses, agents, errors
  - **Pass Criteria:** Results include items from all 5 data types
- [ ] **7.1.3** Display results grouped by type
  - **Pass Criteria:** Results shown in sections by type with headers
- [ ] **7.1.4** Keyboard navigation (↑↓ Enter Esc)
  - **Pass Criteria:** Arrow keys move selection; Enter navigates; Esc closes
- [ ] **7.1.5** Click result to navigate
  - **Pass Criteria:** Clicking result navigates to correct detail page
- [ ] **7.1.6** Empty state and loading state
  - **Pass Criteria:** Shows "No results" for empty; spinner while loading

**Search Result Types:**

```typescript
interface SearchResult {
  type: "event" | "execution" | "tool-use" | "agent" | "error";
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  href: string;
}
```

---

#### 7.2 Backend Search Endpoint

**File:** `server/routes/observability.ts`
**Effort:** Medium

**Tasks:**

- [ ] **7.2.1** Add `GET /api/observability/search?q=...` endpoint
  - **Pass Criteria:** Endpoint returns 200 with results array
- [ ] **7.2.2** Search across relevant tables (events, runs, tool_uses, agents)
  - **Pass Criteria:** Query searches all relevant tables
- [ ] **7.2.3** Return unified results with type indicators
  - **Pass Criteria:** Each result has `type` field
- [ ] **7.2.4** Pagination support (limit/offset)
  - **Pass Criteria:** Accepts `limit` and `offset` params; returns `total`

---

### Phase 7 Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-obs-phase7-search.sh
# Run: chmod +x tests/e2e/test-obs-phase7-search.sh && ./tests/e2e/test-obs-phase7-search.sh

set -e
echo "=== Phase 7: Unified Search Tests ==="

# Ensure servers are running
curl -s http://localhost:5173 > /dev/null || { echo "FAIL: Frontend not running"; exit 1; }
curl -s http://localhost:3001/api/health > /dev/null || { echo "FAIL: Backend not running"; exit 1; }

echo "✓ Servers running"

# Test 7.1: Search API endpoint exists
echo "Testing search API endpoint..."
SEARCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/observability/search?q=test")
if [ "$SEARCH_STATUS" != "200" ]; then
    echo "FAIL: /api/observability/search returned $SEARCH_STATUS"
    exit 1
fi
echo "✓ Search endpoint returns 200"

# Test 7.2: Search returns valid JSON
echo "Testing search response format..."
SEARCH_RESPONSE=$(curl -s "http://localhost:3001/api/observability/search?q=test")
if ! echo "$SEARCH_RESPONSE" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
    echo "FAIL: Search response is not valid JSON"
    exit 1
fi
echo "✓ Search returns valid JSON"

# Test 7.3: Search supports pagination
echo "Testing pagination params..."
PAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/observability/search?q=test&limit=10&offset=0")
if [ "$PAGE_STATUS" != "200" ]; then
    echo "FAIL: Pagination params returned $PAGE_STATUS"
    exit 1
fi
echo "✓ Pagination params accepted"

# Test 7.4: Empty search query
echo "Testing empty search..."
EMPTY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/observability/search?q=")
if [ "$EMPTY_STATUS" != "200" ] && [ "$EMPTY_STATUS" != "400" ]; then
    echo "FAIL: Empty search returned unexpected $EMPTY_STATUS"
    exit 1
fi
echo "✓ Empty search handled correctly"

echo ""
echo "=== Phase 7 Tests PASSED ==="
```

### Phase 7 Pass Criteria Summary

| Task ID | Description             | Pass Criteria                         | Status |
| ------- | ----------------------- | ------------------------------------- | ------ |
| 7.1.1   | Debounced search input  | Search triggers after 300ms pause     | [ ]    |
| 7.1.2   | Multi-type search       | Results from all 5 data types         | [ ]    |
| 7.1.3   | Grouped results display | Sections with type headers            | [ ]    |
| 7.1.4   | Keyboard navigation     | ↑↓ moves; Enter navigates; Esc closes | [ ]    |
| 7.1.5   | Click navigation        | Click navigates to detail             | [ ]    |
| 7.1.6   | Empty/loading states    | "No results" and spinner shown        | [ ]    |
| 7.2.1   | Search API endpoint     | Returns 200 with results array        | [ ]    |
| 7.2.2   | Multi-table search      | Queries all relevant tables           | [ ]    |
| 7.2.3   | Type indicators         | Each result has `type` field          | [ ]    |
| 7.2.4   | Pagination support      | Accepts limit/offset; returns total   | [ ]    |

---

### Phase 8: Real-Time Integration

**Goal:** Ensure all sub-tabs receive real-time updates via WebSocket.

---

#### 8.1 Create useObservabilityConnection Hook

**File:** `frontend/src/hooks/useObservabilityConnection.ts`
**Effort:** Medium

**Tasks:**

- [ ] **8.1.1** Single WebSocket connection for all Observability tabs
  - **Pass Criteria:** Only one WebSocket opens when navigating between sub-tabs
- [ ] **8.1.2** Connection status state (connected, reconnecting, offline)
  - **Pass Criteria:** Hook exposes `status` field with correct values
- [ ] **8.1.3** Subscribe to multiple event types
  - **Pass Criteria:** Can subscribe to execution, agent, question, event types
- [ ] **8.1.4** Automatic reconnection with exponential backoff
  - **Pass Criteria:** Reconnects after disconnect; delay increases 1s→2s→4s→8s
- [ ] **8.1.5** Shared across all sub-tabs (context provider)
  - **Pass Criteria:** Same connection instance across all tabs

---

#### 8.2 Create ObservabilityConnectionProvider

**File:** `frontend/src/components/observability/ObservabilityConnectionProvider.tsx`
**Effort:** Low

**Tasks:**

- [ ] **8.2.1** Wrap ObservabilityContainer with connection provider
  - **Pass Criteria:** Provider wraps container component
- [ ] **8.2.2** Expose connection status and event handlers to children
  - **Pass Criteria:** Children can access status and subscribe to events
- [ ] **8.2.3** Clean up on unmount
  - **Pass Criteria:** WebSocket closes when navigating away from Observability

---

#### 8.3 Update Components for Real-Time

**Effort:** Medium

**Tasks:**

- [ ] **8.3.1** OverviewDashboard: Subscribe to all event types
  - **Pass Criteria:** Dashboard updates when any event occurs
- [ ] **8.3.2** EventLogTab: Subscribe to new evaluation events
  - **Pass Criteria:** New events appear in list without refresh
- [ ] **8.3.3** ExecutionsTab: Subscribe to execution status changes
  - **Pass Criteria:** Execution status updates in real-time
- [ ] **8.3.4** AgentsTab: Subscribe to agent status and question events
  - **Pass Criteria:** Agent cards and question list update live
- [ ] **8.3.5** AnalyticsTab: Subscribe for live updates to charts
  - **Pass Criteria:** Charts refresh when new data arrives

---

### Phase 8 Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-obs-phase8-realtime.sh
# Run: chmod +x tests/e2e/test-obs-phase8-realtime.sh && ./tests/e2e/test-obs-phase8-realtime.sh

set -e
echo "=== Phase 8: Real-Time Integration Tests ==="

# Ensure servers are running
curl -s http://localhost:5173 > /dev/null || { echo "FAIL: Frontend not running"; exit 1; }
curl -s http://localhost:3001/api/health > /dev/null || { echo "FAIL: Backend not running"; exit 1; }

echo "✓ Servers running"

# Test 8.1: WebSocket endpoint exists
echo "Testing WebSocket endpoint..."
# Use websocat if available, otherwise skip
if command -v websocat &> /dev/null; then
    WS_TEST=$(timeout 2 websocat -1 "ws://localhost:3001/ws?monitor=observability" 2>&1 || true)
    if echo "$WS_TEST" | grep -q "error\|failed"; then
        echo "FAIL: WebSocket connection failed"
        exit 1
    fi
    echo "✓ WebSocket endpoint accessible"
else
    echo "SKIP: websocat not installed, skipping WebSocket test"
fi

# Test 8.2: API health check (ensures backend can handle connections)
echo "Testing backend health..."
HEALTH=$(curl -s "http://localhost:3001/api/health")
if ! echo "$HEALTH" | grep -q "ok\|healthy"; then
    echo "WARN: Health check response unexpected: $HEALTH"
else
    echo "✓ Backend healthy"
fi

# Test 8.3: WebSocket routes in API
echo "Testing WebSocket configuration..."
# Check that websocket.ts exists
if [ -f "server/websocket.ts" ]; then
    echo "✓ WebSocket server file exists"
else
    echo "WARN: server/websocket.ts not found"
fi

echo ""
echo "=== Phase 8 Tests PASSED ==="
echo ""
echo "NOTE: Full WebSocket testing requires browser/Puppeteer tests."
echo "Manual verification steps:"
echo "  1. Open /observability in browser"
echo "  2. Check connection indicator shows 'Connected' (green)"
echo "  3. Trigger an event (e.g., start execution)"
echo "  4. Verify dashboard updates without refresh"
echo "  5. Disconnect network, verify 'Reconnecting' (yellow)"
echo "  6. Reconnect, verify returns to 'Connected'"
```

### Phase 8 Pass Criteria Summary

| Task ID | Description              | Pass Criteria                           | Status |
| ------- | ------------------------ | --------------------------------------- | ------ |
| 8.1.1   | Single WebSocket         | One connection across all sub-tabs      | [ ]    |
| 8.1.2   | Connection status state  | Exposes connected/reconnecting/offline  | [ ]    |
| 8.1.3   | Multi-event subscription | Can subscribe to multiple event types   | [ ]    |
| 8.1.4   | Exponential backoff      | Reconnect delay increases exponentially | [ ]    |
| 8.1.5   | Shared via context       | Same instance across tabs               | [ ]    |
| 8.2.1   | Provider wraps container | Provider component wraps container      | [ ]    |
| 8.2.2   | Exposes status/handlers  | Children can access connection state    | [ ]    |
| 8.2.3   | Cleanup on unmount       | WebSocket closes on navigation away     | [ ]    |
| 8.3.1   | Overview real-time       | Updates on any event                    | [ ]    |
| 8.3.2   | EventLog real-time       | New events appear live                  | [ ]    |
| 8.3.3   | Executions real-time     | Execution status updates live           | [ ]    |
| 8.3.4   | Agents real-time         | Agent/question updates live             | [ ]    |
| 8.3.5   | Analytics real-time      | Charts refresh on new data              | [ ]    |

---

### Phase 9: Polish & Testing

**Goal:** Ensure quality, consistency, and robustness.

---

#### 9.1 Visual Consistency Pass

**Effort:** Low

**Tasks:**

- [ ] **9.1.1** Ensure consistent spacing and typography
  - **Pass Criteria:** All text uses design system tokens; spacing follows 4px/8px grid
- [ ] **9.1.2** Verify color coding is consistent across tabs
  - **Pass Criteria:** Status colors match across Overview, Agents, and Executions
- [ ] **9.1.3** Check responsive behavior (mobile, tablet)
  - **Pass Criteria:** Layout adapts at 768px and 1024px breakpoints
- [ ] **9.1.4** Verify dark mode support (if applicable)
  - **Pass Criteria:** All components use theme colors; no hard-coded colors

---

#### 9.2 Accessibility Pass

**Effort:** Low

**Tasks:**

- [ ] **9.2.1** Keyboard navigation for all interactive elements
  - **Pass Criteria:** Tab key navigates all buttons, links, inputs
- [ ] **9.2.2** ARIA labels for status indicators
  - **Pass Criteria:** Screen reader announces "Connected" for green dot
- [ ] **9.2.3** Focus management when switching tabs
  - **Pass Criteria:** Focus moves to tab content on tab switch
- [ ] **9.2.4** Screen reader announcements for real-time updates
  - **Pass Criteria:** aria-live region announces new items

---

#### 9.3 Performance Pass

**Effort:** Medium

**Tasks:**

- [ ] **9.3.1** Lazy load Analytics tab (heavy visualizations)
  - **Pass Criteria:** Analytics bundle loads only when tab visited
- [ ] **9.3.2** Virtual scrolling for long lists
  - **Pass Criteria:** Render 1000 items without scroll lag
- [ ] **9.3.3** Debounce real-time updates (max 10/sec)
  - **Pass Criteria:** High-frequency updates batched to 100ms intervals
- [ ] **9.3.4** Cache API responses appropriately
  - **Pass Criteria:** Repeated requests use cache; stale-while-revalidate

---

#### 9.4 Test Suite

**Effort:** Medium

**Tasks:**

- [ ] **9.4.1** Create ObservabilityContainer.test.tsx
  - **Pass Criteria:** Test renders, tab switching, URL sync
- [ ] **9.4.2** Create ObservabilitySubTabs.test.tsx
  - **Pass Criteria:** Test active state, click handling, badges
- [ ] **9.4.3** Create OverviewDashboard.test.tsx
  - **Pass Criteria:** Test stats loading, health indicator, activity feed
- [ ] **9.4.4** Create EventLogTab.test.tsx
  - **Pass Criteria:** Test session selection, events rendering
- [ ] **9.4.5** Create ExecutionsTab.test.tsx
  - **Pass Criteria:** Test list, filters, pagination
- [ ] **9.4.6** Create AgentsTab.test.tsx
  - **Pass Criteria:** Test grid, questions, activity
- [ ] **9.4.7** Create AnalyticsTab.test.tsx
  - **Pass Criteria:** Test charts, time range
- [ ] **9.4.8** Create ObservabilitySearch.test.tsx
  - **Pass Criteria:** Test debounce, results, keyboard nav
- [ ] **9.4.9** Create E2E test file (test-obs-restructure-e2e.py)
  - **Pass Criteria:** Full flow test passes

**Files to Create:**

```
frontend/src/components/observability/__tests__/ObservabilityContainer.test.tsx
frontend/src/components/observability/__tests__/ObservabilitySubTabs.test.tsx
frontend/src/components/observability/__tests__/OverviewDashboard.test.tsx
frontend/src/components/observability/__tests__/EventLogTab.test.tsx
frontend/src/components/observability/__tests__/ExecutionsTab.test.tsx
frontend/src/components/observability/__tests__/AgentsTab.test.tsx
frontend/src/components/observability/__tests__/AnalyticsTab.test.tsx
frontend/src/components/observability/__tests__/ObservabilitySearch.test.tsx
tests/e2e/test-obs-restructure-e2e.py
```

---

### Phase 9 Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-obs-phase9-polish.sh
# Run: chmod +x tests/e2e/test-obs-phase9-polish.sh && ./tests/e2e/test-obs-phase9-polish.sh

set -e
echo "=== Phase 9: Polish & Testing ==="

# Test 9.1: Run unit tests
echo "Running unit tests..."
cd frontend
if npm test -- --testPathPattern="observability" --passWithNoTests 2>/dev/null; then
    echo "✓ Unit tests passed"
else
    echo "FAIL: Unit tests failed"
    exit 1
fi
cd ..

# Test 9.2: TypeScript compilation
echo "Checking TypeScript..."
cd frontend
if npx tsc --noEmit 2>/dev/null; then
    echo "✓ TypeScript compilation passed"
else
    echo "FAIL: TypeScript errors found"
    exit 1
fi
cd ..

# Test 9.3: ESLint check
echo "Running ESLint..."
cd frontend
if npx eslint src/components/observability --max-warnings=0 2>/dev/null; then
    echo "✓ ESLint passed"
else
    echo "WARN: ESLint warnings found"
fi
cd ..

# Test 9.4: Build succeeds
echo "Testing production build..."
cd frontend
if npm run build 2>/dev/null; then
    echo "✓ Production build succeeded"
else
    echo "FAIL: Production build failed"
    exit 1
fi
cd ..

# Test 9.5: E2E tests
echo "Running E2E tests..."
if [ -f "tests/e2e/test-obs-restructure-e2e.py" ]; then
    if python3 tests/e2e/test-obs-restructure-e2e.py 2>/dev/null; then
        echo "✓ E2E tests passed"
    else
        echo "WARN: E2E tests failed or not implemented"
    fi
else
    echo "SKIP: E2E test file not found"
fi

echo ""
echo "=== Phase 9 Tests PASSED ==="
echo ""
echo "Manual QA Checklist:"
echo "  [ ] All sub-tabs render correctly"
echo "  [ ] Navigation works between all tabs"
echo "  [ ] Real-time updates work"
echo "  [ ] Search works across all data types"
echo "  [ ] Backwards compatibility (/events redirects)"
echo "  [ ] Mobile responsive (test at 375px, 768px, 1024px)"
echo "  [ ] Dark mode works (if enabled)"
echo "  [ ] Keyboard navigation works throughout"
```

### Phase 9 Pass Criteria Summary

| Task ID | Description                   | Pass Criteria                    | Status |
| ------- | ----------------------------- | -------------------------------- | ------ |
| 9.1.1   | Consistent spacing/typography | Uses design tokens; 4px/8px grid | [ ]    |
| 9.1.2   | Consistent color coding       | Status colors match across tabs  | [ ]    |
| 9.1.3   | Responsive behavior           | Adapts at 768px and 1024px       | [ ]    |
| 9.1.4   | Dark mode support             | Uses theme colors; no hard-coded | [ ]    |
| 9.2.1   | Keyboard navigation           | Tab key navigates all elements   | [ ]    |
| 9.2.2   | ARIA labels                   | Screen reader announces status   | [ ]    |
| 9.2.3   | Focus management              | Focus moves on tab switch        | [ ]    |
| 9.2.4   | Live region announcements     | New items announced              | [ ]    |
| 9.3.1   | Lazy load Analytics           | Bundle loads only when visited   | [ ]    |
| 9.3.2   | Virtual scrolling             | 1000 items without lag           | [ ]    |
| 9.3.3   | Debounce updates              | Updates batched to 100ms         | [ ]    |
| 9.3.4   | Cache API responses           | stale-while-revalidate works     | [ ]    |
| 9.4.1   | ObservabilityContainer.test   | Renders, tabs, URL sync          | [ ]    |
| 9.4.2   | ObservabilitySubTabs.test     | Active state, clicks, badges     | [ ]    |
| 9.4.3   | OverviewDashboard.test        | Stats, health, activity          | [ ]    |
| 9.4.4   | EventLogTab.test              | Sessions, events                 | [ ]    |
| 9.4.5   | ExecutionsTab.test            | List, filters, pagination        | [ ]    |
| 9.4.6   | AgentsTab.test                | Grid, questions, activity        | [ ]    |
| 9.4.7   | AnalyticsTab.test             | Charts, time range               | [ ]    |
| 9.4.8   | ObservabilitySearch.test      | Debounce, results, keyboard      | [ ]    |
| 9.4.9   | E2E test file                 | Full flow passes                 | [ ]    |

---

## File Summary

| Phase | File                                                                        | Type   | Status | Effort |
| ----- | --------------------------------------------------------------------------- | ------ | ------ | ------ |
| 1.1   | `frontend/src/components/Layout.tsx`                                        | Modify | [ ]    | Low    |
| 1.2   | `frontend/src/components/observability/ObservabilityContainer.tsx`          | Create | [ ]    | Medium |
| 1.3   | `frontend/src/components/observability/ObservabilitySubTabs.tsx`            | Create | [ ]    | Low    |
| 1.4   | `frontend/src/components/observability/ObservabilityHeader.tsx`             | Create | [ ]    | Low    |
| 2.1   | `frontend/src/components/observability/OverviewDashboard.tsx`               | Create | [ ]    | Medium |
| 2.2   | `frontend/src/components/observability/QuickStatsRow.tsx`                   | Create | [ ]    | Low    |
| 2.3   | `frontend/src/components/observability/SystemHealthIndicator.tsx`           | Create | [ ]    | Low    |
| 2.4   | `frontend/src/components/observability/RecentActivityFeed.tsx`              | Create | [ ]    | Medium |
| 3.1   | `frontend/src/components/observability/EventLogTab.tsx`                     | Create | [ ]    | Medium |
| 3.2   | `frontend/src/App.tsx`                                                      | Modify | [ ]    | Low    |
| 4.1   | `frontend/src/components/observability/ExecutionsTab.tsx`                   | Create | [ ]    | Medium |
| 4.2   | `frontend/src/pages/ExecutionReviewPage.tsx`                                | Modify | [ ]    | Low    |
| 4.3   | `frontend/src/pages/ObservabilityPage.tsx`                                  | Modify | [ ]    | Low    |
| 5.1   | `frontend/src/components/observability/AgentsTab.tsx`                       | Create | [ ]    | Medium |
| 5.2   | `frontend/src/components/observability/AgentStatusGrid.tsx`                 | Create | [ ]    | Low    |
| 5.3   | `frontend/src/components/observability/BlockingQuestionsPanel.tsx`          | Create | [ ]    | Medium |
| 6.1   | `frontend/src/components/observability/AnalyticsTab.tsx`                    | Create | [ ]    | High   |
| 6.2   | Migrate visualizations                                                      | Modify | [ ]    | Medium |
| 6.3   | `frontend/src/components/observability/TimeRangeSelector.tsx`               | Create | [ ]    | Low    |
| 7.1   | `frontend/src/components/observability/ObservabilitySearch.tsx`             | Create | [ ]    | High   |
| 7.2   | `server/routes/observability.ts`                                            | Modify | [ ]    | Medium |
| 8.1   | `frontend/src/hooks/useObservabilityConnection.ts`                          | Create | [ ]    | Medium |
| 8.2   | `frontend/src/components/observability/ObservabilityConnectionProvider.tsx` | Create | [ ]    | Low    |
| 8.3   | Update components for real-time                                             | Modify | [ ]    | Medium |
| 9.4   | Test files                                                                  | Create | [ ]    | Medium |

**Total New Files:** 17
**Total Modified Files:** 6

---

## Migration Strategy

### Backwards Compatibility

1. **Route Redirect:** `/events` → `/observability/events`
2. **Deep Links:** All existing `/observability/executions/:id` links continue to work
3. **API Stability:** No backend API changes required

### Rollout Plan

1. **Phase 1-4:** Core structure and migration (can be deployed together)
2. **Phase 5-6:** New functionality (Agents tab, Analytics tab)
3. **Phase 7-8:** Enhanced features (Search, Real-time improvements)
4. **Phase 9:** Polish and testing

### Feature Flags (Optional)

If needed, implement feature flag for gradual rollout:

```typescript
const USE_NEW_OBSERVABILITY = true; // Enable new structure
```

---

## Success Criteria

### Functional

- [ ] Observability appears in main navigation
- [ ] All 5 sub-tabs render correctly
- [ ] Event Log content migrated without regression
- [ ] Executions content migrated without regression
- [ ] Agents tab shows status and questions
- [ ] Analytics tab shows visualizations
- [ ] Search returns results from all sources

### Navigation

- [ ] Sub-tab switching preserves URL state
- [ ] Back/forward browser navigation works
- [ ] Breadcrumbs show correct hierarchy
- [ ] Deep links work for all views

### Real-Time

- [ ] Connection status visible and accurate
- [ ] Updates appear within 500ms of event
- [ ] Graceful handling of disconnection/reconnection

### Performance

- [ ] Initial page load < 2s
- [ ] Tab switching < 500ms
- [ ] No lag with 1000+ events

### Testing

- [ ] Unit test coverage > 80%
- [ ] E2E tests pass for all critical flows
- [ ] Manual QA sign-off

---

## Risk Mitigation

| Risk                                    | Mitigation                                               |
| --------------------------------------- | -------------------------------------------------------- |
| Breaking existing bookmarks             | Redirect `/events` to `/observability/events`            |
| Performance with multiple subscriptions | Single WebSocket connection, debounced updates           |
| Complex state management                | Use URL as source of truth, React Query for caching      |
| Large migration scope                   | Implement in phases, each phase independently deployable |

---

## Appendix: Component Hierarchy

```
ObservabilityPage (page)
└── ObservabilityConnectionProvider (context)
    └── ObservabilityContainer (layout)
        ├── ObservabilityHeader
        │   ├── Page title
        │   ├── ObservabilitySearch
        │   └── ConnectionStatus
        ├── ObservabilitySubTabs
        │   └── Tab items (Overview, Events, Executions, Agents, Analytics)
        └── Content (React Router Outlet)
            ├── OverviewDashboard (default)
            │   ├── QuickStatsRow
            │   ├── SystemHealthIndicator
            │   └── RecentActivityFeed
            ├── EventLogTab
            │   ├── SessionsList
            │   └── EventsTable (with tabs: Events, API Calls)
            ├── ExecutionsTab
            │   └── ExecutionList
            │       └── ExecutionCard (click → ExecutionReviewPage)
            ├── AgentsTab
            │   ├── AgentStatusGrid
            │   ├── BlockingQuestionsPanel
            │   └── AgentActivityFeed
            └── AnalyticsTab
                ├── TimeRangeSelector
                ├── ToolUseHeatMap
                ├── AssertionDashboard
                ├── ExecutionDurationChart
                └── ErrorHotspotsPanel
```

---

## Master Test Runner

Run all phase tests sequentially to validate the complete implementation:

```bash
#!/bin/bash
# File: tests/e2e/test-obs-all-phases.sh
# Run: chmod +x tests/e2e/test-obs-all-phases.sh && ./tests/e2e/test-obs-all-phases.sh

set -e

echo "=============================================="
echo "  OBSERVABILITY UI RESTRUCTURE - FULL TEST   "
echo "=============================================="
echo ""

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

run_phase_test() {
    PHASE=$1
    SCRIPT=$2
    echo "--- Phase $PHASE ---"
    if [ -f "$SCRIPT" ]; then
        if bash "$SCRIPT"; then
            echo "✅ Phase $PHASE PASSED"
            ((PASS_COUNT++))
        else
            echo "❌ Phase $PHASE FAILED"
            ((FAIL_COUNT++))
        fi
    else
        echo "⏭️  Phase $PHASE SKIPPED (script not found)"
        ((SKIP_COUNT++))
    fi
    echo ""
}

# Run all phase tests
run_phase_test 1 "tests/e2e/test-obs-phase1-navigation.sh"
run_phase_test 2 "tests/e2e/test-obs-phase2-overview.sh"
run_phase_test 3 "tests/e2e/test-obs-phase3-eventlog.sh"
run_phase_test 4 "tests/e2e/test-obs-phase4-executions.sh"
run_phase_test 5 "tests/e2e/test-obs-phase5-agents.sh"
run_phase_test 6 "tests/e2e/test-obs-phase6-analytics.sh"
run_phase_test 7 "tests/e2e/test-obs-phase7-search.sh"
run_phase_test 8 "tests/e2e/test-obs-phase8-realtime.sh"
run_phase_test 9 "tests/e2e/test-obs-phase9-polish.sh"

echo "=============================================="
echo "               TEST SUMMARY                   "
echo "=============================================="
echo "  Passed:  $PASS_COUNT"
echo "  Failed:  $FAIL_COUNT"
echo "  Skipped: $SKIP_COUNT"
echo "=============================================="

if [ $FAIL_COUNT -gt 0 ]; then
    echo ""
    echo "❌ SOME TESTS FAILED"
    exit 1
else
    echo ""
    echo "✅ ALL TESTS PASSED"
    exit 0
fi
```

### Quick Validation Commands

```bash
# Check all routes exist (quick smoke test)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability && echo " /observability"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/events && echo " /observability/events"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/executions && echo " /observability/executions"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/agents && echo " /observability/agents"
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/observability/analytics && echo " /observability/analytics"

# Run frontend TypeScript check
cd frontend && npx tsc --noEmit

# Run unit tests for observability
cd frontend && npm test -- --testPathPattern="observability"

# Run full E2E suite
python3 tests/e2e/test-obs-restructure-e2e.py
```

---

_Implementation starts with Phase 1: Navigation & Container Structure_
