# VIBE-P16-008: Feedback Dashboard Widget

**Task ID:** VIBE-P16-008
**Created:** 2026-02-09
**Status:** Specification
**Category:** Dashboard & User Experience - Phase 16
**Priority:** High
**Agent Type:** spec_agent
**Model:** Claude Sonnet 4.5

---

## Overview

The Feedback Dashboard Widget provides real-time visualization of user feedback metrics, sentiment trends, top issues, response times, and team performance. This widget serves as the central monitoring interface for the feedback loop system, enabling product teams to track feedback volume, identify critical issues, monitor resolution progress, and assess system responsiveness.

### Context

The Vibe platform implements a self-improvement feedback loop where users submit feedback (bugs, feature requests, satisfaction surveys) through various channels (UI, API, Telegram). The Intake Agent processes feedback, the Triage System classifies severity, and tasks are automatically created for Planning/Build/QA agents. This widget provides visibility into this entire pipeline, showing:

1. **Feedback Volume** - How much feedback is being received
2. **Sentiment Analysis** - Distribution of positive/neutral/negative feedback
3. **Top Issues** - Most frequently reported problems
4. **Response Performance** - How quickly feedback is processed and resolved
5. **Conversion Metrics** - Feedback → task creation rate
6. **Team Performance** - Agent assignment and completion tracking

### Problem Statement

Without a feedback dashboard widget:

- Product teams have no visibility into feedback volume trends
- Critical issues may not be identified quickly (buried in noise)
- Response time SLAs cannot be monitored
- Sentiment degradation goes undetected
- Feedback-to-task conversion rate is unknown
- Team workload imbalances are invisible
- No historical trend analysis for process improvement

### Solution

Create an embeddable dashboard widget that:

1. **Displays real-time metrics** - Volume, sentiment, response times with trend arrows
2. **Visualizes sentiment distribution** - Pie chart breakdown of positive/neutral/negative
3. **Highlights top issues** - Most reported problems with occurrence counts
4. **Tracks performance** - Average response time vs. target SLA
5. **Shows conversion rate** - Percentage of feedback that becomes actionable tasks
6. **Supports filtering** - By date range, feedback type, status, assigned team
7. **Enables drill-down** - Click metrics to see underlying feedback items
8. **Embeds flexibly** - Works in main dashboard and as standalone page
9. **Updates in real-time** - WebSocket integration for live metrics (<30s refresh)
10. **Exports reports** - Generate PDF reports with current dashboard data

---

## Requirements

### Functional Requirements

#### FR-1: Feedback Volume Metrics

**Priority:** P0 (Critical)

MUST display three volume metrics with trend indicators:

- **Today**: Total feedback submitted today with % change vs. yesterday
- **This Week**: Total feedback this week with % change vs. last week
- **This Month**: Total feedback this month with % change vs. last month

**Trend Indicators:**

- Green ↑ arrow for increasing volume (positive for engagement)
- Red ↓ arrow for decreasing volume (potential engagement issue)
- Gray → for flat/stable volume (±5%)

**Display Format:**

```
Today: 42 feedback items ↑ +15%
This Week: 187 items ↑ +8%
This Month: 623 items ↓ -3%
```

**Acceptance Criteria:**

- Metrics recalculate on date boundaries (midnight UTC)
- Trend calculations compare equivalent time periods
- Handles zero-state (no feedback yet)
- Shows loading skeleton during data fetch

#### FR-2: Sentiment Pie Chart

**Priority:** P0 (Critical)

MUST display sentiment distribution as interactive pie chart:

- **Positive**: Feedback score ≥4/5 (green segment)
- **Neutral**: Feedback score 3/5 (yellow segment)
- **Negative**: Feedback score ≤2/5 (red segment)

**Sentiment Classification Rules:**

- Bug reports: Always negative (implies broken experience)
- Feature requests: Neutral (implies missing capability)
- Satisfaction surveys: Use numeric score (1-5 scale)
- General feedback: AI-derived sentiment from Intake Agent

**Interactivity:**

- Hover: Show exact count and percentage
- Click: Filter to show only that sentiment category
- Legend: Toggle segments on/off

**Acceptance Criteria:**

- Pie chart uses accessible color palette (WCAG 2.1 AA)
- Percentages sum to 100% (handles rounding)
- Handles edge case: all feedback one sentiment
- Shows "No data" state with empty chart

#### FR-3: Top 5 Issues List

**Priority:** P0 (Critical)

MUST display most reported problems with occurrence counts:

- **Ranked List**: Issues sorted by report frequency (descending)
- **Limit**: Show top 5 issues only
- **Display Format**: `[Count]× Issue Title`
- **Issue Grouping**: Similar feedback aggregated by Triage System

**Issue Metadata:**

- Issue title (truncated to 80 characters)
- Occurrence count (number badge)
- Severity indicator (critical/high/medium/low color)
- First reported date
- Latest report date

**Example Display:**

```
1. 🔴 12× Dashboard crashes when loading tasks (CRITICAL)
2. 🟡  8× Export to CSV fails with large datasets (HIGH)
3. 🟡  6× Mobile UI not responsive on tablets (MEDIUM)
4. 🟢  4× Dark mode colors hard to read (LOW)
5. 🟢  3× Add keyboard shortcuts for navigation (LOW)
```

**Acceptance Criteria:**

- Issues update in real-time as new feedback arrives
- Click issue to see all related feedback items
- Shows "No issues reported" when list is empty
- Handles ties (equal counts) with consistent ordering

#### FR-4: Average Response Time Metric

**Priority:** P0 (Critical)

MUST display response time performance vs. SLA target:

- **Metric**: Average time from feedback submission to first response (agent assignment or status change)
- **Target Comparison**: Visual indicator showing performance vs. 30-second SLA
- **Format**: `Avg Response Time: 18.5s (Target: 30s) ✓`

**Response Time Categories:**

- **Critical Bug**: Target <60s (red if exceeded)
- **High Priority**: Target <5 minutes (yellow if exceeded)
- **Normal Feedback**: Target <30 minutes (green if met)

**Display Variants:**

- Green checkmark ✓ if meeting SLA
- Yellow warning ⚠ if within 20% of SLA
- Red alert 🚨 if exceeding SLA

**Acceptance Criteria:**

- Calculates response time from feedback creation to first status change
- Excludes outliers (>99th percentile) from average
- Shows P50, P95, P99 on hover
- Updates every 30 seconds via WebSocket

#### FR-5: Feedback-to-Task Conversion Rate

**Priority:** P0 (Critical)

MUST display conversion funnel metrics:

- **Total Feedback**: All feedback submissions
- **Triaged**: Feedback that passed intake processing
- **Tasks Created**: Feedback converted to actionable tasks
- **Conversion Rate**: (Tasks Created / Total Feedback) × 100%

**Visual Representation:**

- Progress bar showing conversion percentage
- Target: ≥70% conversion rate (healthy triage)
- Color coding: Green ≥70%, Yellow 50-69%, Red <50%

**Example Display:**

```
Feedback → Task Conversion
█████████░ 87% (Target: ≥70%) ✓
623 feedback → 542 tasks created
```

**Acceptance Criteria:**

- Excludes spam/invalid feedback from denominator
- Handles zero-state (no feedback yet)
- Shows breakdown by feedback type on hover
- Updates in real-time as tasks are created

#### FR-6: Filter Controls

**Priority:** P1 (High)

MUST provide filtering capabilities:

- **Date Range**: Today, This Week, This Month, Last 30 Days, Last 90 Days, Custom Range
- **Feedback Type**: All, Bug Report, Feature Request, Satisfaction Survey, General
- **Status**: All, New, In Progress, Resolved, Closed, Rejected
- **Assigned Team**: All, Build Agent, Planning Agent, QA Agent, Unassigned

**Filter Behavior:**

- Filters apply to all widget metrics simultaneously
- Filters persist across page navigation (URL query params)
- "Reset Filters" button to clear all selections
- Filter count badge shows active filter count

**Acceptance Criteria:**

- All metrics update within 500ms of filter change
- Date range picker supports custom start/end dates
- Multiple filters combine with AND logic
- Invalid filter combinations show helpful error message

#### FR-7: Drill-Down Capability

**Priority:** P1 (High)

MUST enable navigation to detailed feedback views:

- **Click Volume Metrics**: Navigate to full feedback list filtered by date range
- **Click Sentiment Segment**: Navigate to feedback list filtered by sentiment
- **Click Top Issue**: Navigate to issue detail page showing all related feedback
- **Click Response Time**: Navigate to performance analytics page

**Modal/Overlay Behavior:**

- Opens feedback detail modal without page navigation (preferred)
- OR navigates to dedicated feedback page (alternative)
- Back button/breadcrumb to return to dashboard

**Acceptance Criteria:**

- Click targets have hover states (cursor: pointer)
- Keyboard navigation supported (Enter key)
- Modal has proper focus management (trap focus)
- Deep links work (shareable URLs to filtered views)

#### FR-8: Widget Embedding Modes

**Priority:** P1 (High)

MUST support two embedding modes:

1. **Dashboard Card Mode**: Compact widget for main dashboard (fixed height)
2. **Standalone Page Mode**: Full-page widget with expanded metrics

**Dashboard Card Mode:**

- Fixed height: 400px
- Scrollable content if overflow
- Minimal padding (compact layout)
- Collapses less critical metrics

**Standalone Page Mode:**

- Full viewport height
- Additional metrics: Trend charts, agent workload, resolution time
- Expanded top issues list (10 instead of 5)
- Export controls visible

**Acceptance Criteria:**

- Mode prop: `<FeedbackWidget mode="card" | "page" />`
- Card mode fits within dashboard grid (3-column layout)
- Page mode responsive: 1280px-2560px widths
- Both modes share same data fetching logic

#### FR-9: Real-time Updates via WebSocket

**Priority:** P0 (Critical)

MUST subscribe to WebSocket events for live updates:

- **Event Types**: `feedback:created`, `feedback:updated`, `feedback:assigned`, `feedback:resolved`
- **Refresh Interval**: Update metrics within 30 seconds of event
- **Optimistic Updates**: Immediate UI feedback before server confirmation

**WebSocket Integration:**

```typescript
const { connected, subscribe } = useWebSocket();

useEffect(() => {
  const unsubscribe = subscribe((message) => {
    if (message.type.startsWith("feedback:")) {
      refetchMetrics(); // Reload dashboard metrics
    }
  });
  return unsubscribe;
}, [subscribe, refetchMetrics]);
```

**Connection Indicator:**

- Green dot: Connected and live
- Yellow dot: Connecting/reconnecting
- Red dot: Disconnected (fallback to polling)

**Acceptance Criteria:**

- Metrics update within 30 seconds of feedback submission
- Connection indicator reflects actual WebSocket state
- Automatic reconnection with exponential backoff
- No memory leaks (proper cleanup on unmount)

#### FR-10: PDF Export Functionality

**Priority:** P2 (Medium)

MUST generate PDF reports with current dashboard data:

- **Export Button**: "Export Report" button in top-right corner
- **Report Contents**: All visible metrics, charts, and tables
- **Filename**: `feedback-report-YYYY-MM-DD.pdf`
- **Branding**: Include Vibe logo and report generation timestamp

**Report Sections:**

1. Executive Summary (volume, sentiment, conversion rate)
2. Sentiment Distribution Chart
3. Top 10 Issues Table
4. Response Time Metrics
5. Team Performance Summary
6. Filter Settings Used

**Technical Implementation:**

- Client-side generation: Use `jsPDF` + `html2canvas`
- OR Server-side generation: API endpoint `/api/feedback/export/pdf`
- Progress indicator during generation (can take 3-5 seconds)

**Acceptance Criteria:**

- PDF matches dashboard visual layout
- Charts render correctly (not broken/pixelated)
- Export includes only filtered data (respects active filters)
- File downloads automatically (no manual save dialog)

### Non-Functional Requirements

#### NFR-1: Performance

- **Initial Load**: Widget renders in <2 seconds (cold start)
- **Metric Calculation**: All metrics compute in <500ms
- **WebSocket Latency**: Event → UI update in <30 seconds
- **Filter Application**: UI updates in <500ms after filter change
- **PDF Generation**: Report generates in <5 seconds

#### NFR-2: Usability

- **Responsive Design**: Support 1280px-2560px screen widths
- **Color Accessibility**: WCAG 2.1 AA contrast ratios (≥4.5:1)
- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Loading States**: Skeleton loaders for all async data
- **Empty States**: Helpful messages when no data available

#### NFR-3: Data Accuracy

- **Metric Precision**: All percentages rounded to 1 decimal place
- **Time Precision**: Response times rounded to nearest second (or minute if >60s)
- **Consistency**: Metrics across widget must use same data snapshot
- **Timezone Handling**: All dates in UTC, displayed in user's local timezone

#### NFR-4: Reliability

- **Error Handling**: Graceful fallback if API fails (show last known data)
- **Zero State**: Widget functional with no feedback data
- **Connection Loss**: Degrade gracefully to polling if WebSocket disconnects
- **Concurrent Updates**: Handle race conditions in metric calculations

#### NFR-5: Maintainability

- **Type Safety**: Full TypeScript coverage for all components
- **Component Isolation**: Widget self-contained (no global state pollution)
- **Configuration**: Externalized color schemes, thresholds, SLA targets
- **Testing**: Unit tests for metric calculations, integration tests for WebSocket

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Feedback Dashboard Widget                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Header: [Title] [Filter Controls] [Export PDF]      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────┬──────────────────┬──────────────────┐ │
│  │  Volume Metrics  │ Sentiment Chart  │ Response Time    │ │
│  │  Today: 42 ↑15%  │   ┌────────┐     │ Avg: 18.5s ✓     │ │
│  │  Week: 187 ↑8%   │   │ 45%  │ │     │ Target: 30s      │ │
│  │  Month: 623 ↓3%  │   │ Pos  │ │     │ P95: 42.1s       │ │
│  │                  │   └────────┘     │ Conversion: 87%  │ │
│  └──────────────────┴──────────────────┴──────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Top Issues (5)                                          │ │
│  │  1. 🔴 12× Dashboard crashes when loading tasks          │ │
│  │  2. 🟡  8× Export to CSV fails with large datasets       │ │
│  │  3. 🟡  6× Mobile UI not responsive on tablets           │ │
│  │  4. 🟢  4× Dark mode colors hard to read                 │ │
│  │  5. 🟢  3× Add keyboard shortcuts for navigation         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                                  │
         ▼                                  ▼
┌──────────────────┐              ┌──────────────────┐
│ useFeedback Hook │              │ useWebSocket Hook│
│  - API fetch     │◄─────────────┤ - Event sub      │
│  - Metric calc   │              │ - Auto-reconnect │
└──────────────────┘              └──────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│     API Client (/api/feedback/metrics)   │
│  GET /api/feedback/metrics?range=...     │
│  GET /api/feedback/sentiment             │
│  GET /api/feedback/top-issues            │
│  GET /api/feedback/response-time         │
│  GET /api/feedback/conversion-rate       │
└──────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│      Database (harness.db - SQLite)      │
│  - spec_feedback (feedback submissions)  │
│  - spec_task_links (feedback → task)     │
│  - spec_quality_metrics (aggregates)     │
│  - tasks (task status, completion)       │
└──────────────────────────────────────────┘
```

### Component Structure

#### 1. Main Widget Component

**FeedbackDashboardWidget.tsx** (`parent-harness/dashboard/src/components/FeedbackDashboardWidget.tsx`)

```typescript
import { useState, useEffect } from 'react'
import { useFeedbackMetrics } from '../hooks/useFeedbackMetrics'
import { useWebSocket } from '../hooks/useWebSocket'
import { VolumeMetrics } from './feedback/VolumeMetrics'
import { SentimentChart } from './feedback/SentimentChart'
import { TopIssuesList } from './feedback/TopIssuesList'
import { ResponseTimeMetric } from './feedback/ResponseTimeMetric'
import { ConversionRateMetric } from './feedback/ConversionRateMetric'
import { FilterControls } from './feedback/FilterControls'
import { ExportButton } from './feedback/ExportButton'

export interface FeedbackWidgetProps {
  mode?: 'card' | 'page'
  onDrillDown?: (type: string, filter: any) => void
}

export function FeedbackDashboardWidget({ mode = 'card', onDrillDown }: FeedbackWidgetProps) {
  const [filters, setFilters] = useState({
    dateRange: 'this-month',
    feedbackType: 'all',
    status: 'all',
    assignedTeam: 'all',
  })

  const { metrics, loading, error, refetch } = useFeedbackMetrics(filters)
  const { connected, subscribe } = useWebSocket()

  // Subscribe to feedback events
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type.startsWith('feedback:')) {
        refetch()
      }
    })
    return unsubscribe
  }, [subscribe, refetch])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleDrillDown = (type: string, filter: any) => {
    if (onDrillDown) {
      onDrillDown(type, filter)
    } else {
      // Default: open modal or navigate
      console.log('Drill down:', type, filter)
    }
  }

  if (loading) {
    return <LoadingSkeleton mode={mode} />
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />
  }

  return (
    <div className={`bg-gray-800 rounded-lg ${mode === 'card' ? 'p-4 h-[400px]' : 'p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">📊 Feedback Dashboard</h2>
          <ConnectionIndicator connected={connected} />
        </div>
        <div className="flex items-center gap-2">
          <FilterControls filters={filters} onChange={handleFilterChange} />
          <ExportButton data={metrics} filters={filters} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <VolumeMetrics
          data={metrics.volume}
          onClick={() => handleDrillDown('volume', filters)}
        />
        <SentimentChart
          data={metrics.sentiment}
          onClick={(sentiment) => handleDrillDown('sentiment', { ...filters, sentiment })}
        />
        <div className="space-y-4">
          <ResponseTimeMetric
            data={metrics.responseTime}
            onClick={() => handleDrillDown('response-time', filters)}
          />
          <ConversionRateMetric
            data={metrics.conversion}
            onClick={() => handleDrillDown('conversion', filters)}
          />
        </div>
      </div>

      {/* Top Issues */}
      <TopIssuesList
        issues={metrics.topIssues}
        limit={mode === 'card' ? 5 : 10}
        onClick={(issueId) => handleDrillDown('issue', { issueId })}
      />
    </div>
  )
}
```

#### 2. Metric Subcomponents

**VolumeMetrics.tsx** (`parent-harness/dashboard/src/components/feedback/VolumeMetrics.tsx`)

```typescript
interface VolumeData {
  today: { count: number; trend: number }
  thisWeek: { count: number; trend: number }
  thisMonth: { count: number; trend: number }
}

interface VolumeMetricsProps {
  data: VolumeData
  onClick?: () => void
}

export function VolumeMetrics({ data, onClick }: VolumeMetricsProps) {
  const renderMetric = (label: string, value: number, trend: number) => {
    const trendColor = trend > 5 ? 'text-green-400' : trend < -5 ? 'text-red-400' : 'text-gray-400'
    const trendIcon = trend > 5 ? '↑' : trend < -5 ? '↓' : '→'

    return (
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-1">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          <span className={`text-sm font-medium ${trendColor}`}>
            {trendIcon} {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-650 transition-colors"
      onClick={onClick}
    >
      <h3 className="text-sm font-semibold text-gray-300 mb-3">📈 Volume</h3>
      {renderMetric('Today', data.today.count, data.today.trend)}
      {renderMetric('This Week', data.thisWeek.count, data.thisWeek.trend)}
      {renderMetric('This Month', data.thisMonth.count, data.thisMonth.trend)}
    </div>
  )
}
```

**SentimentChart.tsx** (`parent-harness/dashboard/src/components/feedback/SentimentChart.tsx`)

```typescript
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface SentimentData {
  positive: number
  neutral: number
  negative: number
}

interface SentimentChartProps {
  data: SentimentData
  onClick?: (sentiment: 'positive' | 'neutral' | 'negative') => void
}

const COLORS = {
  positive: '#10b981', // green-500
  neutral: '#fbbf24',  // yellow-400
  negative: '#ef4444', // red-500
}

export function SentimentChart({ data, onClick }: SentimentChartProps) {
  const total = data.positive + data.neutral + data.negative
  const chartData = [
    { name: 'Positive', value: data.positive, percentage: ((data.positive / total) * 100).toFixed(1) },
    { name: 'Neutral', value: data.neutral, percentage: ((data.neutral / total) * 100).toFixed(1) },
    { name: 'Negative', value: data.negative, percentage: ((data.negative / total) * 100).toFixed(1) },
  ]

  const handleClick = (entry: any) => {
    if (onClick) {
      onClick(entry.name.toLowerCase())
    }
  }

  if (total === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-center h-full">
        <p className="text-gray-400 text-sm">No feedback data</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">😊 Sentiment</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={60}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string, props: any) =>
              [`${value} (${props.payload.percentage}%)`, name]
            }
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**TopIssuesList.tsx** (`parent-harness/dashboard/src/components/feedback/TopIssuesList.tsx`)

```typescript
interface TopIssue {
  id: string
  title: string
  count: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  firstReported: string
  latestReport: string
}

interface TopIssuesListProps {
  issues: TopIssue[]
  limit?: number
  onClick?: (issueId: string) => void
}

const severityConfig = {
  critical: { icon: '🔴', color: 'text-red-400' },
  high: { icon: '🟡', color: 'text-yellow-400' },
  medium: { icon: '🟠', color: 'text-orange-400' },
  low: { icon: '🟢', color: 'text-green-400' },
}

export function TopIssuesList({ issues, limit = 5, onClick }: TopIssuesListProps) {
  const displayIssues = issues.slice(0, limit)

  if (displayIssues.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">🐛 Top Issues</h3>
        <p className="text-gray-400 text-sm">No issues reported</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">🐛 Top Issues ({displayIssues.length})</h3>
      <div className="space-y-2">
        {displayIssues.map((issue, index) => (
          <div
            key={issue.id}
            className="flex items-start gap-3 p-2 rounded hover:bg-gray-600 cursor-pointer transition-colors"
            onClick={() => onClick?.(issue.id)}
          >
            <span className="text-gray-500 font-mono text-sm">{index + 1}.</span>
            <span className="text-lg">{severityConfig[issue.severity].icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                  {issue.count}×
                </span>
                <span className="text-sm text-white truncate">{issue.title}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                First: {issue.firstReported} | Latest: {issue.latestReport}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**ResponseTimeMetric.tsx** (`parent-harness/dashboard/src/components/feedback/ResponseTimeMetric.tsx`)

```typescript
interface ResponseTimeData {
  average: number // seconds
  target: number // seconds
  p50: number
  p95: number
  p99: number
}

interface ResponseTimeMetricProps {
  data: ResponseTimeData
  onClick?: () => void
}

export function ResponseTimeMetric({ data, onClick }: ResponseTimeMetricProps) {
  const meetsSLA = data.average <= data.target
  const withinWarning = data.average <= data.target * 1.2

  const statusIcon = meetsSLA ? '✓' : withinWarning ? '⚠' : '🚨'
  const statusColor = meetsSLA ? 'text-green-400' : withinWarning ? 'text-yellow-400' : 'text-red-400'

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs.toFixed(0)}s`
  }

  return (
    <div
      className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-650 transition-colors"
      onClick={onClick}
    >
      <h3 className="text-sm font-semibold text-gray-300 mb-2">⏱️ Response Time</h3>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold">{formatTime(data.average)}</span>
        <span className={`text-sm font-medium ${statusColor}`}>{statusIcon}</span>
      </div>
      <div className="text-xs text-gray-400">
        Target: {formatTime(data.target)}
      </div>
      <div className="text-xs text-gray-500 mt-2">
        P50: {formatTime(data.p50)} | P95: {formatTime(data.p95)} | P99: {formatTime(data.p99)}
      </div>
    </div>
  )
}
```

**ConversionRateMetric.tsx** (`parent-harness/dashboard/src/components/feedback/ConversionRateMetric.tsx`)

```typescript
interface ConversionRateData {
  totalFeedback: number
  tasksCreated: number
  conversionRate: number // 0-100
  target: number // 0-100
}

interface ConversionRateMetricProps {
  data: ConversionRateData
  onClick?: () => void
}

export function ConversionRateMetric({ data, onClick }: ConversionRateMetricProps) {
  const meetsTarget = data.conversionRate >= data.target
  const statusIcon = meetsTarget ? '✓' : '⚠'
  const barColor = data.conversionRate >= 70 ? 'bg-green-500' :
                   data.conversionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div
      className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-650 transition-colors"
      onClick={onClick}
    >
      <h3 className="text-sm font-semibold text-gray-300 mb-2">🔄 Conversion Rate</h3>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Feedback → Tasks</span>
          <span className={`text-sm font-bold ${meetsTarget ? 'text-green-400' : 'text-yellow-400'}`}>
            {data.conversionRate.toFixed(1)}% {statusIcon}
          </span>
        </div>
        <div className="w-full bg-gray-600 rounded-full h-2">
          <div
            className={`${barColor} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${data.conversionRate}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="text-xs text-gray-400">
        {data.totalFeedback} feedback → {data.tasksCreated} tasks
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Target: ≥{data.target}%
      </div>
    </div>
  )
}
```

#### 3. Filter & Export Components

**FilterControls.tsx** (`parent-harness/dashboard/src/components/feedback/FilterControls.tsx`)

```typescript
interface FilterControlsProps {
  filters: {
    dateRange: string
    feedbackType: string
    status: string
    assignedTeam: string
  }
  onChange: (key: string, value: string) => void
}

export function FilterControls({ filters, onChange }: FilterControlsProps) {
  const activeFilterCount = Object.values(filters).filter(v => v !== 'all' && v !== 'this-month').length

  return (
    <div className="flex items-center gap-2">
      {/* Date Range */}
      <select
        value={filters.dateRange}
        onChange={(e) => onChange('dateRange', e.target.value)}
        className="bg-gray-700 text-sm rounded px-3 py-1.5 border border-gray-600 focus:border-blue-500"
      >
        <option value="today">Today</option>
        <option value="this-week">This Week</option>
        <option value="this-month">This Month</option>
        <option value="last-30-days">Last 30 Days</option>
        <option value="last-90-days">Last 90 Days</option>
      </select>

      {/* Feedback Type */}
      <select
        value={filters.feedbackType}
        onChange={(e) => onChange('feedbackType', e.target.value)}
        className="bg-gray-700 text-sm rounded px-3 py-1.5 border border-gray-600 focus:border-blue-500"
      >
        <option value="all">All Types</option>
        <option value="bug">Bug Report</option>
        <option value="feature">Feature Request</option>
        <option value="survey">Survey</option>
        <option value="general">General</option>
      </select>

      {/* Status */}
      <select
        value={filters.status}
        onChange={(e) => onChange('status', e.target.value)}
        className="bg-gray-700 text-sm rounded px-3 py-1.5 border border-gray-600 focus:border-blue-500"
      >
        <option value="all">All Status</option>
        <option value="new">New</option>
        <option value="in_progress">In Progress</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>

      {/* Filter Count Badge */}
      {activeFilterCount > 0 && (
        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
          {activeFilterCount}
        </span>
      )}

      {/* Reset Button */}
      {activeFilterCount > 0 && (
        <button
          onClick={() => {
            onChange('dateRange', 'this-month')
            onChange('feedbackType', 'all')
            onChange('status', 'all')
            onChange('assignedTeam', 'all')
          }}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Reset
        </button>
      )}
    </div>
  )
}
```

**ExportButton.tsx** (`parent-harness/dashboard/src/components/feedback/ExportButton.tsx`)

```typescript
import { useState } from 'react'

interface ExportButtonProps {
  data: any
  filters: any
}

export function ExportButton({ data, filters }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      // Call API to generate PDF
      const response = await fetch('/api/feedback/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, filters }),
      })

      if (!response.ok) throw new Error('Export failed')

      // Download file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `feedback-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export report')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {exporting ? (
        <>
          <span className="animate-spin">⏳</span>
          Exporting...
        </>
      ) : (
        <>
          📄 Export PDF
        </>
      )}
    </button>
  )
}
```

#### 4. Data Hook

**useFeedbackMetrics.ts** (`parent-harness/dashboard/src/hooks/useFeedbackMetrics.ts`)

```typescript
import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3333/api";

export interface FeedbackMetrics {
  volume: {
    today: { count: number; trend: number };
    thisWeek: { count: number; trend: number };
    thisMonth: { count: number; trend: number };
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topIssues: Array<{
    id: string;
    title: string;
    count: number;
    severity: "critical" | "high" | "medium" | "low";
    firstReported: string;
    latestReport: string;
  }>;
  responseTime: {
    average: number;
    target: number;
    p50: number;
    p95: number;
    p99: number;
  };
  conversion: {
    totalFeedback: number;
    tasksCreated: number;
    conversionRate: number;
    target: number;
  };
}

export function useFeedbackMetrics(filters: any) {
  const [metrics, setMetrics] = useState<FeedbackMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(filters);
      const response = await fetch(`${API_BASE}/feedback/metrics?${params}`);

      if (!response.ok) throw new Error("Failed to fetch metrics");

      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error("Failed to fetch feedback metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
```

#### 5. API Endpoints

**feedback.ts** (`parent-harness/orchestrator/src/api/feedback.ts`)

```typescript
import { Router } from "express";
import { query, getOne } from "../db/index.js";

export const feedbackRouter = Router();

/**
 * GET /api/feedback/metrics - Get dashboard metrics
 */
feedbackRouter.get("/metrics", async (req, res) => {
  try {
    const { dateRange, feedbackType, status, assignedTeam } = req.query;

    // Calculate date range boundaries
    const { startDate, endDate } = parseDateRange(dateRange as string);

    // Volume metrics
    const volume = await calculateVolume(startDate, endDate);

    // Sentiment distribution
    const sentiment = await calculateSentiment(
      startDate,
      endDate,
      feedbackType as string,
    );

    // Top issues
    const topIssues = await getTopIssues(startDate, endDate, 5);

    // Response time metrics
    const responseTime = await calculateResponseTime(startDate, endDate);

    // Conversion rate
    const conversion = await calculateConversionRate(startDate, endDate);

    res.json({
      volume,
      sentiment,
      topIssues,
      responseTime,
      conversion,
    });
  } catch (error) {
    console.error("Failed to calculate metrics:", error);
    res.status(500).json({ error: "Failed to calculate metrics" });
  }
});

/**
 * POST /api/feedback/export/pdf - Generate PDF report
 */
feedbackRouter.post("/export/pdf", async (req, res) => {
  try {
    const { data, filters } = req.body;

    // Generate PDF (implementation depends on PDF library choice)
    // Option 1: Use puppeteer to render HTML → PDF server-side
    // Option 2: Accept client-generated PDF and return

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="feedback-report-${new Date().toISOString().split("T")[0]}.pdf"`,
    );

    // TODO: Implement PDF generation
    res.status(501).json({ error: "PDF export not yet implemented" });
  } catch (error) {
    console.error("Failed to export PDF:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});

// Helper functions

function parseDateRange(range: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString();
  let startDate: Date;

  switch (range) {
    case "today":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "this-week":
      startDate = new Date(now.setDate(now.getDate() - now.getDay()));
      break;
    case "this-month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last-30-days":
      startDate = new Date(now.setDate(now.getDate() - 30));
      break;
    case "last-90-days":
      startDate = new Date(now.setDate(now.getDate() - 90));
      break;
    default:
      startDate = new Date(now.setMonth(now.getMonth() - 1));
  }

  return { startDate: startDate.toISOString(), endDate };
}

async function calculateVolume(startDate: string, endDate: string) {
  // Today's volume
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayCount = await query(
    `
    SELECT COUNT(*) as count
    FROM spec_feedback
    WHERE created_at >= datetime(?)
  `,
    [new Date(todayStart).toISOString()],
  );

  const yesterdayCount = await query(
    `
    SELECT COUNT(*) as count
    FROM spec_feedback
    WHERE created_at >= datetime(?, '-1 day')
      AND created_at < datetime(?)
  `,
    [new Date(todayStart).toISOString(), new Date(todayStart).toISOString()],
  );

  const todayTrend =
    yesterdayCount[0].count > 0
      ? ((todayCount[0].count - yesterdayCount[0].count) /
          yesterdayCount[0].count) *
        100
      : 0;

  // Similar calculations for week and month...

  return {
    today: { count: todayCount[0].count, trend: todayTrend },
    thisWeek: { count: 0, trend: 0 }, // TODO
    thisMonth: { count: 0, trend: 0 }, // TODO
  };
}

async function calculateSentiment(
  startDate: string,
  endDate: string,
  type: string,
) {
  const rows = await query(
    `
    SELECT
      SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END) as negative
    FROM spec_feedback
    WHERE created_at >= ? AND created_at <= ?
  `,
    [startDate, endDate],
  );

  return {
    positive: rows[0].positive || 0,
    neutral: rows[0].neutral || 0,
    negative: rows[0].negative || 0,
  };
}

async function getTopIssues(startDate: string, endDate: string, limit: number) {
  const rows = await query(
    `
    SELECT
      spec_id as id,
      feedback_text as title,
      COUNT(*) as count,
      severity,
      MIN(created_at) as firstReported,
      MAX(created_at) as latestReport
    FROM spec_feedback
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY spec_id, feedback_text, severity
    ORDER BY count DESC
    LIMIT ?
  `,
    [startDate, endDate, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title.substring(0, 80),
    count: row.count,
    severity: row.severity,
    firstReported: new Date(row.firstReported).toLocaleDateString(),
    latestReport: new Date(row.latestReport).toLocaleDateString(),
  }));
}

async function calculateResponseTime(startDate: string, endDate: string) {
  const rows = await query(
    `
    SELECT
      AVG(CAST((julianday(reviewed_at) - julianday(created_at)) * 86400 AS INTEGER)) as avg,
      MIN(CAST((julianday(reviewed_at) - julianday(created_at)) * 86400 AS INTEGER)) as min,
      MAX(CAST((julianday(reviewed_at) - julianday(created_at)) * 86400 AS INTEGER)) as max
    FROM spec_feedback
    WHERE created_at >= ? AND created_at <= ?
      AND reviewed_at IS NOT NULL
  `,
    [startDate, endDate],
  );

  return {
    average: rows[0].avg || 0,
    target: 30,
    p50: rows[0].avg || 0,
    p95: rows[0].max || 0,
    p99: rows[0].max || 0,
  };
}

async function calculateConversionRate(startDate: string, endDate: string) {
  const feedbackCount = await query(
    `
    SELECT COUNT(*) as count FROM spec_feedback
    WHERE created_at >= ? AND created_at <= ?
  `,
    [startDate, endDate],
  );

  const taskCount = await query(
    `
    SELECT COUNT(DISTINCT task_id) as count FROM spec_task_links
    WHERE created_at >= ? AND created_at <= ?
  `,
    [startDate, endDate],
  );

  const totalFeedback = feedbackCount[0].count;
  const tasksCreated = taskCount[0].count;
  const conversionRate =
    totalFeedback > 0 ? (tasksCreated / totalFeedback) * 100 : 0;

  return {
    totalFeedback,
    tasksCreated,
    conversionRate,
    target: 70,
  };
}
```

#### 6. Integration with Dashboard

**Dashboard.tsx** (add widget to existing dashboard)

```typescript
import { FeedbackDashboardWidget } from '../components/FeedbackDashboardWidget'

export function Dashboard() {
  // ... existing dashboard code ...

  return (
    <Layout>
      {/* System Health Panel */}
      <SystemHealthPanel ... />

      {/* Feedback Widget (new section) */}
      <div className="mb-4">
        <FeedbackDashboardWidget
          mode="card"
          onDrillDown={(type, filter) => {
            // Navigate to feedback detail page or open modal
            console.log('Drill down:', type, filter)
          }}
        />
      </div>

      {/* Existing 3-column layout */}
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-10rem)]">
        ...
      </div>
    </Layout>
  )
}
```

---

## Pass Criteria

### Implementation Validation

✅ **PC-1**: Widget displays volume metrics (today, week, month) with trend arrows
✅ **PC-2**: Sentiment pie chart shows positive/neutral/negative distribution
✅ **PC-3**: Top 5 issues list displays most reported problems with counts
✅ **PC-4**: Average response time metric shows performance vs. 30s target
✅ **PC-5**: Feedback-to-task conversion rate displayed with progress bar
✅ **PC-6**: Filter controls (date, type, status, team) update all metrics
✅ **PC-7**: Drill-down click handlers navigate to detail views
✅ **PC-8**: Widget embeds in dashboard card mode (400px height)
✅ **PC-9**: Widget renders as standalone page mode (full viewport)
✅ **PC-10**: WebSocket updates trigger metric refresh within 30 seconds

### Technical Validation

✅ **PC-11**: TypeScript compilation passes with no errors
✅ **PC-12**: All metric calculations accurate (tested against known data)
✅ **PC-13**: API endpoints return correct data with filters applied
✅ **PC-14**: Database queries performant (<500ms for all metrics)
✅ **PC-15**: Component renders with zero feedback data (empty state)

### User Experience Validation

✅ **PC-16**: Loading skeleton shows during data fetch
✅ **PC-17**: Error state displays retry button on API failure
✅ **PC-18**: Filter changes reflect in UI within 500ms
✅ **PC-19**: Hover states on all clickable elements
✅ **PC-20**: Color-coded severity indicators (WCAG 2.1 AA contrast)
✅ **PC-21**: Connection indicator reflects WebSocket status
✅ **PC-22**: Export button generates PDF report (or shows "not implemented" message)
✅ **PC-23**: Responsive design supports 1280px-2560px widths
✅ **PC-24**: Keyboard navigation works for all interactive elements

---

## Dependencies

### Upstream Dependencies (Must Exist First)

| Dependency                 | Description                             | Status                            |
| -------------------------- | --------------------------------------- | --------------------------------- |
| spec_feedback table        | Database table for feedback submissions | ✅ Required (from PHASE4-TASK-03) |
| spec_task_links table      | Links feedback to tasks                 | ✅ Required (from PHASE4-TASK-03) |
| spec_quality_metrics table | Aggregated metrics                      | ✅ Required (from PHASE4-TASK-03) |
| Feedback Submission API    | `/api/feedback/submit` endpoint         | ❓ Unknown                        |
| Intake Agent               | Processes feedback and assigns severity | ❓ Unknown                        |
| Dashboard Layout           | Parent Harness dashboard shell          | ✅ Exists                         |
| WebSocket Server           | ws://localhost:3333/ws                  | ✅ Exists                         |

### Downstream Dependencies (Enabled By This)

| Component             | How It Benefits                               |
| --------------------- | --------------------------------------------- |
| Feedback Detail Page  | Widget drill-down navigates to detailed view  |
| Issue Tracking Page   | Top issues link to issue management interface |
| Performance Analytics | Response time metrics inform SLA monitoring   |
| Team Dashboards       | Agent-specific views of assigned feedback     |

### Technical Dependencies

- **Frontend**: React 19, recharts (for pie chart), date-fns (for date handling)
- **API**: Express.js, better-sqlite3
- **PDF Export**: jsPDF + html2canvas OR puppeteer (server-side)
- **WebSocket**: ws library (already integrated)

---

## Implementation Plan

### Phase 1: Component Foundation (4 hours)

1. **Create component structure** (1 hour)
   - Create `components/feedback/` directory
   - Scaffold main widget component + subcomponents
   - Define TypeScript interfaces for all data types

2. **Implement metric subcomponents** (2 hours)
   - VolumeMetrics.tsx with trend indicators
   - SentimentChart.tsx with recharts pie chart
   - ResponseTimeMetric.tsx with SLA comparison
   - ConversionRateMetric.tsx with progress bar
   - TopIssuesList.tsx with severity icons

3. **Create filter controls** (1 hour)
   - FilterControls.tsx with dropdown selects
   - Active filter count badge
   - Reset filters button

### Phase 2: Data Integration (5 hours)

4. **Implement useFeedbackMetrics hook** (1 hour)
   - Fetch metrics from API
   - Handle loading/error states
   - Support filter parameters

5. **Create API endpoints** (3 hours)
   - GET /api/feedback/metrics (main metrics endpoint)
   - Implement helper functions: calculateVolume, calculateSentiment, etc.
   - Query database with date range and filter support
   - Calculate percentiles for response time

6. **Add WebSocket integration** (1 hour)
   - Subscribe to `feedback:*` events
   - Trigger refetch on relevant events
   - Connection indicator component

### Phase 3: Interactivity (3 hours)

7. **Implement drill-down navigation** (1.5 hours)
   - Click handlers for all metrics
   - Modal component for feedback detail (or navigation)
   - Pass filter context to detail views

8. **Add export functionality** (1.5 hours)
   - ExportButton.tsx component
   - API endpoint /api/feedback/export/pdf
   - PDF generation (simple implementation or stub)

### Phase 4: Dashboard Integration (2 hours)

9. **Embed widget in dashboard** (1 hour)
   - Add FeedbackDashboardWidget to Dashboard.tsx
   - Position in layout (above or below health panel)
   - Test card mode sizing

10. **Create standalone page** (1 hour)
    - Create Feedback.tsx page component
    - Use widget in page mode
    - Add to navigation menu

### Phase 5: Testing & Polish (4 hours)

11. **Write unit tests** (2 hours)
    - Test metric calculations
    - Test filter logic
    - Test component rendering with various data states

12. **Integration testing** (1 hour)
    - Test API endpoints with real database
    - Test WebSocket event handling
    - Test drill-down navigation

13. **Polish & accessibility** (1 hour)
    - Verify WCAG 2.1 AA contrast ratios
    - Test keyboard navigation
    - Add ARIA labels for screen readers
    - Loading skeletons and empty states

**Total Estimated Effort:** 18 hours (~2-3 days)

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/components/feedback/VolumeMetrics.test.tsx
describe('VolumeMetrics', () => {
  test('displays volume counts correctly', () => {
    const data = {
      today: { count: 42, trend: 15 },
      thisWeek: { count: 187, trend: 8 },
      thisMonth: { count: 623, trend: -3 },
    }
    render(<VolumeMetrics data={data} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('↑ 15.0%')).toBeInTheDocument()
  })

  test('shows correct trend arrows', () => {
    const data = {
      today: { count: 10, trend: 12 }, // ↑ green
      thisWeek: { count: 50, trend: -8 }, // ↓ red
      thisMonth: { count: 100, trend: 2 }, // → gray
    }
    render(<VolumeMetrics data={data} />)
    expect(screen.getByText('↑')).toHaveClass('text-green-400')
    expect(screen.getByText('↓')).toHaveClass('text-red-400')
    expect(screen.getByText('→')).toHaveClass('text-gray-400')
  })

  test('calls onClick when clicked', () => {
    const onClick = vi.fn()
    const data = { today: { count: 10, trend: 0 }, thisWeek: { count: 50, trend: 0 }, thisMonth: { count: 100, trend: 0 } }
    render(<VolumeMetrics data={data} onClick={onClick} />)
    fireEvent.click(screen.getByText('Volume'))
    expect(onClick).toHaveBeenCalled()
  })
})

// __tests__/hooks/useFeedbackMetrics.test.ts
describe('useFeedbackMetrics', () => {
  test('fetches metrics on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useFeedbackMetrics({ dateRange: 'this-month' })
    )

    expect(result.current.loading).toBe(true)
    await waitForNextUpdate()
    expect(result.current.loading).toBe(false)
    expect(result.current.metrics).toBeDefined()
  })

  test('refetches when filters change', async () => {
    const { result, rerender, waitForNextUpdate } = renderHook(
      ({ filters }) => useFeedbackMetrics(filters),
      { initialProps: { filters: { dateRange: 'today' } } }
    )

    await waitForNextUpdate()
    const firstMetrics = result.current.metrics

    rerender({ filters: { dateRange: 'this-week' } })
    await waitForNextUpdate()

    expect(result.current.metrics).not.toEqual(firstMetrics)
  })
})
```

### Integration Tests

```typescript
// __tests__/api/feedback.integration.test.ts
describe("Feedback API", () => {
  test("GET /api/feedback/metrics returns all metrics", async () => {
    const response = await request(app)
      .get("/api/feedback/metrics?dateRange=this-month")
      .expect(200);

    expect(response.body).toHaveProperty("volume");
    expect(response.body).toHaveProperty("sentiment");
    expect(response.body).toHaveProperty("topIssues");
    expect(response.body).toHaveProperty("responseTime");
    expect(response.body).toHaveProperty("conversion");
  });

  test("metrics respect date range filter", async () => {
    // Create test feedback in database
    await createTestFeedback({ createdAt: "2026-01-01" });
    await createTestFeedback({ createdAt: "2026-02-01" });

    const response = await request(app)
      .get("/api/feedback/metrics?dateRange=this-month")
      .expect(200);

    expect(response.body.volume.thisMonth.count).toBe(1); // Only Feb feedback
  });
});
```

### E2E Tests

```typescript
// e2e/feedback-widget.spec.ts
describe("Feedback Widget E2E", () => {
  test("displays metrics and allows drill-down", async () => {
    await page.goto("http://localhost:5173/dashboard");

    // Wait for widget to load
    await page.waitForSelector('[data-testid="feedback-widget"]');

    // Check volume metrics visible
    expect(await page.textContent(".volume-metric")).toContain("Today:");

    // Click sentiment chart segment
    await page.click(".sentiment-chart .recharts-pie-sector");

    // Verify detail modal opens
    expect(await page.isVisible('[data-testid="feedback-detail-modal"]')).toBe(
      true,
    );
  });

  test("filters update all metrics", async () => {
    await page.goto("http://localhost:5173/dashboard");

    // Change date range filter
    await page.selectOption('select[name="dateRange"]', "today");

    // Wait for metrics to update
    await page.waitForTimeout(500);

    // Verify metrics changed
    const volumeText = await page.textContent(".volume-metric");
    expect(volumeText).toContain("Today:");
  });
});
```

---

## Success Metrics

### Operational Metrics

| Metric                 | Target      | Measurement                             |
| ---------------------- | ----------- | --------------------------------------- |
| **Widget Load Time**   | <2 seconds  | Time from page load to widget render    |
| **Metric Calculation** | <500ms      | API response time for /metrics endpoint |
| **WebSocket Latency**  | <30 seconds | Time from feedback event to UI update   |
| **Filter Response**    | <500ms      | Time from filter change to UI update    |

### Quality Metrics

| Metric                  | Target      | Measurement                                   |
| ----------------------- | ----------- | --------------------------------------------- |
| **Data Accuracy**       | 100%        | Metric calculations match manual verification |
| **Zero State Handling** | Pass        | Widget functional with no feedback data       |
| **Error Resilience**    | Pass        | Graceful fallback if API fails                |
| **Accessibility**       | WCAG 2.1 AA | Contrast ratios ≥4.5:1, keyboard nav works    |

### Business Impact

| Metric                     | Target | Measurement                                      |
| -------------------------- | ------ | ------------------------------------------------ |
| **Issue Discovery Time**   | -50%   | Time to identify critical issues                 |
| **Feedback Response Rate** | +30%   | Percentage of feedback receiving timely response |
| **Team Awareness**         | >90%   | Product team checks dashboard daily              |
| **Actionable Insights**    | >80%   | Dashboard leads to concrete improvements         |

---

## Rollback Plan

If widget causes issues:

1. **Disable widget** - Comment out `<FeedbackDashboardWidget />` in Dashboard.tsx
2. **Revert API endpoints** - Remove feedback routes from api/index.ts
3. **Fallback to manual tracking** - Use database queries directly for metrics
4. **Restore previous dashboard** - Git revert to last known good commit

---

## Future Enhancements (Out of Scope)

1. **Trend Charts** - Line charts showing feedback volume over time (weeks/months)
2. **Agent Workload Breakdown** - Stacked bar chart of feedback by assigned agent
3. **Custom Metrics** - User-defined calculations and KPIs
4. **Scheduled Reports** - Automated PDF reports emailed daily/weekly
5. **Slack Integration** - Post dashboard snapshot to Slack channel
6. **Mobile Optimized View** - Responsive layout for tablets/phones
7. **Real-time Alerts** - Browser notifications for critical feedback
8. **Comparison Mode** - Compare current period vs. previous period side-by-side

---

## Related Documentation

- **VIBE-P16-010**: Feedback Loop Integration Tests (comprehensive testing strategy)
- **PHASE4-TASK-03**: Spec Agent Learning from Build Agent Feedback (database schema)
- **PHASE6-TASK-01**: Task Tracking Dashboard (dashboard layout and patterns)
- **STRATEGIC_PLAN.md**: Phase 4-6 (Feedback loop and dashboard refinement)

---

## Conclusion

This specification defines a comprehensive Feedback Dashboard Widget that provides real-time visibility into the Vibe platform's feedback loop system. The widget displays:

✅ **Volume Metrics** - Trend-aware feedback volume tracking
✅ **Sentiment Analysis** - Interactive pie chart of positive/neutral/negative
✅ **Top Issues** - Most reported problems with severity indicators
✅ **Performance Tracking** - Response time vs. SLA targets
✅ **Conversion Metrics** - Feedback → task creation rate
✅ **Filtering** - Date range, type, status, team filters
✅ **Drill-Down** - Navigate to detailed views from any metric
✅ **Embedding** - Works as dashboard card or standalone page
✅ **Real-time Updates** - WebSocket integration for live metrics
✅ **PDF Export** - Generate reports with current dashboard data

**Implementation Effort:** 18 hours (~2-3 days)
**Dependencies:** spec_feedback table, Dashboard shell, WebSocket server
**Test Coverage:** Unit tests for components, integration tests for API, E2E tests for user flows

**Status:** Ready for implementation by Build Agent
**Next Steps:**

1. Confirm database schema exists (spec_feedback, spec_task_links tables)
2. Implement component foundation (Phase 1)
3. Create API endpoints and data integration (Phase 2)
4. Add interactivity and export (Phase 3)
5. Integrate with dashboard (Phase 4)
6. Test and polish (Phase 5)

---

**Document Version:** 1.0
**Created:** 2026-02-09
**Author:** Spec Agent (Autonomous)
**Specification Duration:** Comprehensive analysis and design
