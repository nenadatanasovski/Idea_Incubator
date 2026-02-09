# PHASE6-TASK-02: Agent Activity Visualization (Heartbeats, Session Logs, Errors)

**Task**: Agent activity visualization (heartbeats, session logs, errors)
**Phase**: 6 - Dashboard and User Experience Refinement
**Status**: 📝 Specification
**Created**: February 8, 2026
**Priority**: P1
**Estimated Effort**: Medium (3-4 days)

---

## Overview

Create comprehensive agent activity visualization to track heartbeats, session logs, and errors across all autonomous agents. This system provides real-time insight into agent health, debugging capabilities, and historical activity analysis to support intervention, debugging, and system optimization.

### Context

The Parent Harness orchestrates 12+ specialized agents executing autonomous tasks. Currently:
- **Basic activity tracking exists** (`agent_activities` table, basic UI in `AgentActivity.tsx`)
- **Session logs are viewable** (`SessionLogModal.tsx`, `SessionLogs.tsx`)
- **Heartbeats are tracked** (`agent_heartbeats` table in schema)
- **Gap**: No unified visualization connecting heartbeats → session logs → errors
- **Gap**: Limited historical analysis and trend visualization
- **Gap**: No alerting for abnormal heartbeat patterns

This task unifies activity data into a comprehensive monitoring dashboard that enables quick identification of stuck agents, error patterns, and performance bottlenecks.

### Strategic Alignment

**Phase 6 Goal**: Full-featured dashboard for idea management, evaluation monitoring, and agent interaction

Agent activity visualization is **critical for autonomous execution monitoring**:
- Enables early detection of stuck/crashed agents (via heartbeat gaps)
- Provides debugging context through session logs
- Reveals error patterns across agent types
- Supports post-mortem analysis for failed tasks
- Informs agent performance optimization

This complements PHASE3-TASK-05 (dashboard widgets) by adding deep-dive activity analysis beyond real-time status cards.

---

## Requirements

### Functional Requirements

#### FR-1: Heartbeat Timeline Visualization
- **FR-1.1**: Display heartbeat timeline for each agent (last 24 hours)
- **FR-1.2**: Visual indicators: 🟢 Active (<1 min), 🟡 Stale (1-5 min), 🟠 Stuck (5-15 min), 🔴 Dead (>15 min)
- **FR-1.3**: Hoverable heartbeat dots showing timestamp, status, progress, current step
- **FR-1.4**: Gaps in timeline highlight missing heartbeats (potential crashes)
- **FR-1.5**: Filter by agent type, date range, health status
- **FR-1.6**: Export heartbeat data as CSV for analysis

#### FR-2: Session Log Viewer
- **FR-2.1**: Unified session log interface with filtering, search, and pagination
- **FR-2.2**: Display session metadata: agent_id, task_id, status, duration, iterations
- **FR-2.3**: Show session output/logs with syntax highlighting
- **FR-2.4**: Filter by agent, task, status, date range
- **FR-2.5**: Search logs by keyword (supports regex)
- **FR-2.6**: Link from session to related activities (heartbeats, errors)
- **FR-2.7**: Download session logs as text file
- **FR-2.8**: Real-time log streaming for active sessions (WebSocket)

#### FR-3: Error Correlation Dashboard
- **FR-3.1**: Show errors grouped by agent, task, error type
- **FR-3.2**: Display error timeline with frequency chart
- **FR-3.3**: Link errors to corresponding session logs
- **FR-3.4**: Show error stack traces and context
- **FR-3.5**: Highlight recurring error patterns
- **FR-3.6**: Filter errors by severity, agent, date range
- **FR-3.7**: Mark errors as "resolved" or "known issue"

#### FR-4: Activity Stream (Unified View)
- **FR-4.1**: Chronological activity stream showing all events (heartbeats, tasks, errors)
- **FR-4.2**: Activity types: task_assigned, task_started, task_completed, task_failed, file_read, file_write, command_executed, error_occurred, heartbeat, spawned, terminated
- **FR-4.3**: Filter by activity type, agent, severity, date range
- **FR-4.4**: Real-time updates via WebSocket (no page refresh)
- **FR-4.5**: Infinite scroll for historical activities (load on scroll)
- **FR-4.6**: Click activity to expand details panel

#### FR-5: Agent Health Dashboard
- **FR-5.1**: Grid view showing all agents with health status
- **FR-5.2**: Per-agent metrics: last heartbeat, active sessions, error count, uptime percentage
- **FR-5.3**: Health trend sparklines (heartbeat regularity over 24h)
- **FR-5.4**: Alert indicators for agents missing heartbeats
- **FR-5.5**: Quick actions: view sessions, restart agent, view logs

#### FR-6: Historical Analysis
- **FR-6.1**: Activity heatmap showing agent workload by hour/day
- **FR-6.2**: Session duration trends over time
- **FR-6.3**: Error rate trends per agent type
- **FR-6.4**: Comparative analysis: agent A vs agent B performance
- **FR-6.5**: Export charts/data for reporting

### Non-Functional Requirements

#### NFR-1: Performance
- Activity stream must load first 100 items in <1 second
- Heartbeat timeline rendering: <500ms for 24h data
- Search across logs: <2 seconds for 10k+ log entries
- Real-time updates must not block UI rendering

#### NFR-2: Scalability
- Support 1M+ activity records without performance degradation
- Pagination/lazy loading for large datasets
- Database indexes on agent_id, created_at, activity_type

#### NFR-3: Usability
- Color-coded activity types for quick scanning
- Tooltips explaining all metrics and statuses
- Mobile-responsive layouts (stacked on <768px)
- Keyboard shortcuts for navigation and filtering

#### NFR-4: Accessibility
- ARIA labels for screen readers
- Keyboard navigation support
- High-contrast mode compatible
- Focus indicators on all interactive elements

---

## Technical Design

### 1. Data Sources

#### 1.1 Database Tables (Existing)

**`agent_heartbeats`** (from `parent-harness/database/schema.sql`):
```sql
CREATE TABLE agent_heartbeats (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  session_id TEXT REFERENCES agent_sessions(id),
  iteration_number INTEGER,
  task_id TEXT,
  status TEXT NOT NULL,
  progress_percent INTEGER CHECK(progress_percent >= 0 AND progress_percent <= 100),
  current_step TEXT,
  last_tool_call TEXT,
  last_output TEXT,
  memory_mb REAL,
  cpu_percent REAL,
  recorded_at TEXT DEFAULT (datetime('now')),
  INDEX idx_agent_heartbeats_agent (agent_id, recorded_at DESC)
);
```

**`agent_activities`** (from `parent-harness/orchestrator/database/migrations/001_vibe_patterns.sql`):
```sql
CREATE TABLE agent_activities (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'task_assigned', 'task_started', 'task_completed', 'task_failed',
    'file_read', 'file_write', 'command_executed',
    'error_occurred', 'heartbeat', 'idle', 'spawned', 'terminated'
  )),
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES agent_sessions(id) ON DELETE SET NULL,
  details TEXT,  -- JSON
  created_at TEXT DEFAULT (datetime('now')),
  INDEX idx_agent_activities_agent (agent_id, created_at DESC),
  INDEX idx_agent_activities_type (activity_type, created_at DESC)
);
```

**`agent_sessions`** (existing):
```sql
CREATE TABLE agent_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  task_id TEXT,
  run_id TEXT,
  wave_number INTEGER,
  lane_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused', 'terminated')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  current_iteration INTEGER,
  total_iterations INTEGER,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  parent_session_id TEXT REFERENCES agent_sessions(id),
  metadata TEXT,  -- JSON
  INDEX idx_sessions_agent (agent_id, started_at DESC),
  INDEX idx_sessions_status (status, started_at DESC)
);
```

#### 1.2 API Endpoints (Existing)

From `parent-harness/orchestrator/src/api/agents.ts`:
- ✅ `GET /api/agents/activities/recent?limit=100` - Recent activities across all agents
- ✅ `GET /api/agents/:id/activities?limit=50&type=heartbeat` - Activities for specific agent

From `parent-harness/dashboard/src/pages/AgentActivity.tsx`:
- ✅ Basic activity rendering with type icons and colors

#### 1.3 New API Endpoints Required

**Heartbeat Endpoints:**
```typescript
GET /api/agents/:id/heartbeats?since=<ISO>&limit=100
// Returns heartbeat timeline for agent

GET /api/agents/:id/heartbeat-gaps?threshold=300000
// Returns gaps in heartbeats >5 minutes (indicates crashes)

Response: {
  gaps: Array<{
    start: string,        // ISO timestamp of last heartbeat
    end: string,          // ISO timestamp of next heartbeat
    duration_ms: number,  // Gap duration
    suspected_crash: boolean
  }>
}
```

**Session Log Endpoints:**
```typescript
GET /api/sessions/:id/logs?offset=0&limit=500
// Paginated session logs with line numbers

POST /api/sessions/:id/logs/search
Body: { query: string, regex?: boolean }
Response: {
  matches: Array<{
    line_number: number,
    content: string,
    timestamp: string
  }>
}
```

**Error Correlation:**
```typescript
GET /api/errors/correlation?agent_id=<id>&since=<ISO>
// Returns errors grouped by pattern with related sessions

Response: {
  error_groups: Array<{
    pattern: string,
    count: number,
    sessions: string[],
    first_occurrence: string,
    last_occurrence: string,
    sample_stack: string
  }>
}
```

**Health Metrics:**
```typescript
GET /api/agents/:id/health-metrics?window=24h
// Returns health metrics over time window

Response: {
  heartbeat_regularity: number,  // 0-100, percentage of expected heartbeats
  avg_heartbeat_interval: number, // milliseconds
  uptime_percent: number,
  error_rate: number,  // errors per hour
  session_success_rate: number
}
```

### 2. Component Architecture

```
AgentActivityDashboard.tsx (New Page: /agents/activity)
├── HealthOverviewGrid.tsx
│   ├── AgentHealthCard.tsx (per agent)
│   │   ├── HeartbeatSparkline.tsx (24h trend)
│   │   ├── HealthBadge.tsx (🟢🟡🟠🔴)
│   │   └── QuickActions.tsx (View Sessions, Restart, Logs)
│   └── SystemHealthSummary.tsx (aggregate metrics)
├── HeartbeatTimeline.tsx
│   ├── TimelineAxis.tsx (date/time markers)
│   ├── HeartbeatDots.tsx (interactive dots)
│   ├── HeartbeatGaps.tsx (highlighted gaps)
│   └── TimelineControls.tsx (zoom, filter)
├── ActivityStreamPanel.tsx
│   ├── ActivityFilter.tsx (type, agent, severity)
│   ├── ActivityList.tsx (infinite scroll)
│   │   └── ActivityItem.tsx (expandable)
│   └── ActivitySearch.tsx
├── SessionLogViewer.tsx
│   ├── SessionSelector.tsx (dropdown)
│   ├── LogDisplay.tsx (syntax highlighting)
│   ├── LogSearch.tsx (keyword/regex)
│   └── LogDownload.tsx
└── ErrorCorrelationPanel.tsx
    ├── ErrorGroupList.tsx
    ├── ErrorTimeline.tsx (frequency chart)
    └── ErrorDetails.tsx (stack, sessions)
```

### 3. State Management

```typescript
// hooks/useAgentActivity.ts
export interface AgentActivityState {
  // Heartbeats
  heartbeats: Record<string, Heartbeat[]>; // keyed by agent_id
  heartbeatGaps: Record<string, HeartbeatGap[]>;

  // Activities
  activities: Activity[];
  activityFilter: {
    types?: ActivityType[];
    agents?: string[];
    severity?: string[];
    dateRange?: [Date, Date];
  };

  // Sessions
  sessions: AgentSession[];
  selectedSessionId: string | null;
  sessionLogs: Record<string, SessionLog[]>;

  // Errors
  errorGroups: ErrorGroup[];
  selectedErrorGroup: string | null;

  // Health
  healthMetrics: Record<string, AgentHealthMetrics>;

  // UI State
  loading: boolean;
  error: string | null;
  selectedView: 'overview' | 'timeline' | 'stream' | 'logs' | 'errors';
}

export function useAgentActivity(options?: {
  agentId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}): {
  state: AgentActivityState;
  actions: {
    loadHeartbeats: (agentId: string, since: Date) => Promise<void>;
    loadActivities: (filter: ActivityFilter) => Promise<void>;
    loadSessionLogs: (sessionId: string) => Promise<void>;
    searchLogs: (sessionId: string, query: string) => Promise<void>;
    loadErrorGroups: (agentId?: string) => Promise<void>;
    setFilter: (filter: Partial<ActivityFilter>) => void;
    exportData: (format: 'csv' | 'json') => void;
  };
}
```

### 4. Real-Time Updates (WebSocket)

Extend existing WebSocket integration from `useWebSocket.ts`:

```typescript
// Subscribe to activity events
useEffect(() => {
  const unsubscribe = subscribe((message) => {
    switch (message.type) {
      case 'agent:heartbeat':
        // Add heartbeat to timeline
        addHeartbeat(message.payload);
        break;

      case 'agent:activity':
        // Add to activity stream
        addActivity(message.payload);
        break;

      case 'session:log':
        // Append to session logs (for active session viewer)
        appendSessionLog(message.payload);
        break;

      case 'agent:error':
        // Update error groups
        updateErrorGroups(message.payload);
        break;
    }
  });

  return unsubscribe;
}, [subscribe]);
```

### 5. Visualization Components

#### 5.1 HeartbeatTimeline Component

```typescript
interface HeartbeatTimelineProps {
  agentId: string;
  heartbeats: Heartbeat[];
  gaps: HeartbeatGap[];
  timeRange: [Date, Date];
  onHeartbeatClick?: (heartbeat: Heartbeat) => void;
}

export function HeartbeatTimeline({ ... }: HeartbeatTimelineProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">Heartbeat Timeline - {agentId}</h3>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Timeline axis */}
      <TimelineAxis start={timeRange[0]} end={timeRange[1]} />

      {/* Heartbeat dots */}
      <svg width="100%" height="80" className="mt-2">
        {heartbeats.map((hb, i) => {
          const x = calculateXPosition(hb.recorded_at, timeRange);
          const color = getHeartbeatColor(hb.status, hb.recorded_at);

          return (
            <g key={hb.id}>
              <circle
                cx={x}
                cy={40}
                r={4}
                fill={color}
                className="cursor-pointer hover:r-6 transition-all"
                onClick={() => onHeartbeatClick?.(hb)}
              />
              <title>
                {formatDate(hb.recorded_at)} - {hb.status}
                {hb.current_step && ` - ${hb.current_step}`}
              </title>
            </g>
          );
        })}

        {/* Highlight gaps */}
        {gaps.map((gap, i) => (
          <rect
            key={i}
            x={calculateXPosition(gap.start, timeRange)}
            width={calculateWidth(gap.duration_ms, timeRange)}
            y={20}
            height={40}
            fill="rgba(239, 68, 68, 0.2)"
            stroke="rgb(239, 68, 68)"
            strokeWidth={1}
            strokeDasharray="4 2"
          >
            <title>
              Gap: {formatDuration(gap.duration_ms)}
              {gap.suspected_crash && ' (Suspected crash)'}
            </title>
          </rect>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
        <span>🟢 Active</span>
        <span>🟡 Stale</span>
        <span>🟠 Stuck</span>
        <span>🔴 Dead</span>
        <span className="text-red-400">█ Gap (no heartbeat)</span>
      </div>
    </div>
  );
}

function getHeartbeatColor(status: string, recordedAt: string): string {
  const age = Date.now() - new Date(recordedAt).getTime();
  if (age < 60000) return '#22c55e'; // green (active)
  if (age < 300000) return '#eab308'; // yellow (stale)
  if (age < 900000) return '#f97316'; // orange (stuck)
  return '#ef4444'; // red (dead)
}
```

#### 5.2 ActivityStreamPanel Component

```typescript
export function ActivityStreamPanel() {
  const { activities, activityFilter, setFilter } = useAgentActivity();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">Activity Stream</h3>
        <ActivityFilter value={activityFilter} onChange={setFilter} />
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`p-3 rounded border-l-4 cursor-pointer transition-all ${
              expandedId === activity.id ? 'bg-gray-700' : 'bg-gray-750 hover:bg-gray-700'
            }`}
            style={{ borderColor: activityTypeColors[activity.activity_type] }}
            onClick={() => setExpandedId(expandedId === activity.id ? null : activity.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={activityTypeColors[activity.activity_type]}>
                  {activityIcons[activity.activity_type]}
                </span>
                <span className="font-mono text-sm text-blue-400">{activity.agent_id}</span>
                <span className="text-xs text-gray-400">{activity.activity_type}</span>
              </div>
              <span className="text-xs text-gray-500">
                {formatRelativeTime(activity.created_at)}
              </span>
            </div>

            {/* Expanded details */}
            {expandedId === activity.id && (
              <div className="mt-3 pt-3 border-t border-gray-600 text-sm space-y-2">
                {activity.task_id && (
                  <div>
                    <span className="text-gray-500">Task:</span>{' '}
                    <Link to={`/tasks/${activity.task_id}`} className="text-blue-400 hover:underline">
                      {activity.task_id}
                    </Link>
                  </div>
                )}
                {activity.session_id && (
                  <div>
                    <span className="text-gray-500">Session:</span>{' '}
                    <Link to={`/sessions/${activity.session_id}`} className="text-blue-400 hover:underline">
                      {activity.session_id}
                    </Link>
                  </div>
                )}
                {activity.details && (
                  <div>
                    <span className="text-gray-500">Details:</span>
                    <pre className="bg-gray-900 p-2 rounded mt-1 text-xs overflow-x-auto">
                      {JSON.stringify(JSON.parse(activity.details), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const activityIcons = {
  task_assigned: '📋',
  task_started: '▶️',
  task_completed: '✅',
  task_failed: '❌',
  file_read: '📖',
  file_write: '✏️',
  command_executed: '⚡',
  error_occurred: '🚨',
  heartbeat: '💓',
  idle: '😴',
  spawned: '🐣',
  terminated: '🔴',
};

const activityTypeColors = {
  task_assigned: '#3b82f6',
  task_started: '#3b82f6',
  task_completed: '#22c55e',
  task_failed: '#ef4444',
  file_read: '#6b7280',
  file_write: '#eab308',
  command_executed: '#a855f7',
  error_occurred: '#ef4444',
  heartbeat: '#6b7280',
  idle: '#6b7280',
  spawned: '#22c55e',
  terminated: '#ef4444',
};
```

#### 5.3 ErrorCorrelationPanel Component

```typescript
export function ErrorCorrelationPanel() {
  const { errorGroups, selectedErrorGroup, setSelectedErrorGroup } = useAgentActivity();

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold mb-4">Error Correlation</h3>

      {errorGroups.map((group) => (
        <div
          key={group.pattern}
          className={`p-3 mb-2 rounded cursor-pointer ${
            selectedErrorGroup === group.pattern ? 'bg-red-900/30 border-2 border-red-500' : 'bg-gray-750 hover:bg-gray-700'
          }`}
          onClick={() => setSelectedErrorGroup(group.pattern)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-sm text-red-400">{group.pattern}</span>
            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {group.count}
            </span>
          </div>

          <div className="text-xs text-gray-400 mb-2">
            First: {formatDate(group.first_occurrence)} • Last: {formatDate(group.last_occurrence)}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>📋 {group.sessions.length} sessions</span>
          </div>

          {selectedErrorGroup === group.pattern && (
            <div className="mt-3 pt-3 border-t border-gray-600">
              <div className="mb-2 text-xs text-gray-400">Sample Stack Trace:</div>
              <pre className="bg-gray-900 p-2 rounded text-xs text-red-300 overflow-x-auto max-h-40">
                {group.sample_stack}
              </pre>

              <div className="mt-2">
                <div className="text-xs text-gray-400 mb-1">Affected Sessions:</div>
                <div className="flex flex-wrap gap-1">
                  {group.sessions.slice(0, 5).map((sessionId) => (
                    <Link
                      key={sessionId}
                      to={`/sessions/${sessionId}`}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-0.5 rounded"
                    >
                      {sessionId.slice(0, 8)}
                    </Link>
                  ))}
                  {group.sessions.length > 5 && (
                    <span className="text-xs text-gray-500">+{group.sessions.length - 5} more</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 6. Database Queries

#### 6.1 Heartbeat Gaps Detection

```typescript
// parent-harness/orchestrator/src/db/heartbeats.ts
export function detectHeartbeatGaps(
  agentId: string,
  thresholdMs: number = 300000, // 5 minutes
  since?: string
): HeartbeatGap[] {
  const sql = `
    WITH ordered_heartbeats AS (
      SELECT
        id,
        agent_id,
        recorded_at,
        LAG(recorded_at) OVER (PARTITION BY agent_id ORDER BY recorded_at) as prev_recorded_at
      FROM agent_heartbeats
      WHERE agent_id = ?
        ${since ? 'AND recorded_at >= ?' : ''}
      ORDER BY recorded_at
    )
    SELECT
      prev_recorded_at as start,
      recorded_at as end,
      (julianday(recorded_at) - julianday(prev_recorded_at)) * 86400000 as duration_ms
    FROM ordered_heartbeats
    WHERE prev_recorded_at IS NOT NULL
      AND (julianday(recorded_at) - julianday(prev_recorded_at)) * 86400000 > ?
    ORDER BY recorded_at DESC
  `;

  const params = since ? [agentId, since, thresholdMs] : [agentId, thresholdMs];
  const gaps = query<HeartbeatGap>(sql, params);

  return gaps.map(gap => ({
    ...gap,
    suspected_crash: gap.duration_ms > 900000, // >15 minutes = likely crash
  }));
}
```

#### 6.2 Activity Stream with Pagination

```typescript
export function getActivityStream(options: {
  limit?: number;
  offset?: number;
  agentId?: string;
  activityTypes?: ActivityType[];
  severity?: string[];
  since?: string;
  until?: string;
}): Activity[] {
  let sql = 'SELECT * FROM agent_activities WHERE 1=1';
  const params: unknown[] = [];

  if (options.agentId) {
    sql += ' AND agent_id = ?';
    params.push(options.agentId);
  }

  if (options.activityTypes && options.activityTypes.length > 0) {
    sql += ` AND activity_type IN (${options.activityTypes.map(() => '?').join(',')})`;
    params.push(...options.activityTypes);
  }

  if (options.since) {
    sql += ' AND created_at >= ?';
    params.push(options.since);
  }

  if (options.until) {
    sql += ' AND created_at <= ?';
    params.push(options.until);
  }

  sql += ' ORDER BY created_at DESC';

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  return query<Activity>(sql, params);
}
```

---

## Pass Criteria

### Implementation Completeness

1. ✅ **HeartbeatTimeline component** - Visualizes heartbeats with gaps, interactive dots
2. ✅ **ActivityStreamPanel component** - Infinite scroll activity feed with real-time updates
3. ✅ **SessionLogViewer component** - Session log display with search, download
4. ✅ **ErrorCorrelationPanel component** - Grouped errors with session links
5. ✅ **HealthOverviewGrid component** - All agents with health metrics, sparklines
6. ✅ **API endpoints** - Heartbeat gaps, log search, error correlation, health metrics
7. ✅ **Database queries** - Optimized queries with indexes, gap detection logic
8. ✅ **WebSocket subscriptions** - Real-time heartbeat, activity, log streaming

### Functional Validation

9. ✅ **Heartbeat visualization works** - Timeline shows dots, gaps highlighted correctly
10. ✅ **Gap detection accurate** - Gaps >5 min flagged, >15 min marked as crash
11. ✅ **Activity stream updates** - New activities appear <1s after creation
12. ✅ **Session logs searchable** - Regex search returns correct matches
13. ✅ **Error correlation works** - Errors grouped by pattern, linked to sessions
14. ✅ **Health metrics accurate** - Uptime %, heartbeat regularity calculated correctly
15. ✅ **Filtering works** - Activity/heartbeat filters apply correctly
16. ✅ **Export functionality** - CSV/JSON export generates valid files
17. ✅ **Real-time updates** - WebSocket events update UI without page refresh

### Testing

18. ✅ **Unit tests** - All components tested in isolation
19. ✅ **Integration test** - Full activity flow (spawn agent → heartbeat → activity → error)
20. ✅ **Gap detection test** - Verify gaps detected at correct thresholds
21. ✅ **Performance test** - Load 10k+ activities, measure render time (<2s)
22. ✅ **Search test** - Regex search across 100k+ log lines completes <2s

### Performance

23. ✅ **Timeline renders quickly** - 24h timeline with 1440 heartbeats loads <500ms
24. ✅ **Activity stream smooth** - Infinite scroll doesn't stutter
25. ✅ **Database indexed** - Queries use indexes (EXPLAIN QUERY PLAN confirms)
26. ✅ **No memory leaks** - WebSocket subscriptions cleaned up properly

### Usability

27. ✅ **Color consistency** - Activity types use consistent colors across all views
28. ✅ **Tooltips helpful** - Heartbeat dots, gaps, health badges have explanatory tooltips
29. ✅ **Mobile responsive** - Works on tablets (>768px)
30. ✅ **Keyboard navigation** - Tab through filters, Enter to search

---

## Dependencies

**Upstream (Must Complete First):**
- ✅ PHASE3-TASK-05: Dashboard widget updates (provides enhanced agent cards)
- ✅ WebSocket infrastructure (COMPLETED)
- ✅ Database schema with agent_heartbeats, agent_activities tables (COMPLETED)

**Downstream (Depends on This):**
- PHASE7-TASK-03: Automated alerting based on heartbeat/error patterns
- PHASE8-TASK-02: Agent performance optimization using activity analytics

**Parallel Work (Can Develop Concurrently):**
- PHASE6-TASK-03: Telegram notification integration
- PHASE6-TASK-04: Idea workspace

---

## Implementation Plan

### Day 1: API Endpoints & Database Queries (6 hours)

1. **Heartbeat Endpoints** (2h)
   - Implement `GET /api/agents/:id/heartbeats`
   - Implement `GET /api/agents/:id/heartbeat-gaps`
   - Add gap detection query logic
   - Test with curl/Postman

2. **Activity Endpoints** (2h)
   - Enhance `GET /api/agents/activities/recent` with pagination
   - Add filtering by type, severity, date range
   - Test query performance with EXPLAIN

3. **Error Correlation** (2h)
   - Implement `GET /api/errors/correlation`
   - Add error grouping query
   - Test pattern matching logic

### Day 2: Core Visualization Components (6 hours)

4. **HeartbeatTimeline Component** (3h)
   - SVG timeline rendering
   - Heartbeat dots with colors
   - Gap highlighting
   - Tooltip on hover
   - Time range selector

5. **ActivityStreamPanel Component** (3h)
   - Activity list with infinite scroll
   - Expandable activity details
   - Activity filter UI
   - Real-time updates via WebSocket

### Day 3: Session Logs & Error Views (6 hours)

6. **SessionLogViewer Component** (3h)
   - Log display with syntax highlighting
   - Search functionality (keyword + regex)
   - Download logs button
   - Pagination for large logs

7. **ErrorCorrelationPanel Component** (2h)
   - Error group list
   - Expandable stack traces
   - Session links
   - Mark as resolved UI

8. **HealthOverviewGrid Component** (1h)
   - Agent health cards grid
   - Sparkline charts (using simple SVG)
   - Quick actions buttons

### Day 4: Integration & Polish (6 hours)

9. **WebSocket Integration** (2h)
   - Subscribe to activity events
   - Update state on heartbeat events
   - Real-time log streaming for active sessions

10. **Export Functionality** (1h)
    - CSV export for activities/heartbeats
    - JSON export for error groups

11. **Testing & Bug Fixes** (2h)
    - Unit tests for components
    - Integration tests for API
    - Fix discovered bugs

12. **Documentation & Deployment** (1h)
    - Update README with usage instructions
    - Add screenshots to docs
    - Deploy to staging for QA

**Total Estimated Effort:** 24 hours (3-4 days)

---

## Testing Strategy

### Unit Tests

```typescript
// components/HeartbeatTimeline.test.tsx
describe('HeartbeatTimeline', () => {
  test('renders heartbeat dots at correct positions', () => {
    const heartbeats = [
      { id: '1', recorded_at: '2026-02-08T10:00:00Z', status: 'active' },
      { id: '2', recorded_at: '2026-02-08T10:05:00Z', status: 'active' },
    ];
    render(<HeartbeatTimeline heartbeats={heartbeats} ... />);

    expect(screen.getAllByRole('graphics-symbol')).toHaveLength(2);
  });

  test('highlights gaps >5 minutes', () => {
    const gaps = [{ start: '10:00', end: '10:08', duration_ms: 480000 }];
    render(<HeartbeatTimeline gaps={gaps} ... />);

    const gapRect = screen.getByRole('graphics-symbol', { name: /Gap: 8m/ });
    expect(gapRect).toHaveAttribute('fill', 'rgba(239, 68, 68, 0.2)');
  });
});

// components/ActivityStreamPanel.test.tsx
describe('ActivityStreamPanel', () => {
  test('displays activities with correct icons', () => {
    const activities = [
      { id: '1', activity_type: 'task_completed', agent_id: 'build' },
      { id: '2', activity_type: 'error_occurred', agent_id: 'qa' },
    ];
    render(<ActivityStreamPanel activities={activities} />);

    expect(screen.getByText('✅')).toBeInTheDocument();
    expect(screen.getByText('🚨')).toBeInTheDocument();
  });

  test('expands activity on click', async () => {
    const activities = [{ id: '1', activity_type: 'file_write', details: '{"file":"test.ts"}' }];
    render(<ActivityStreamPanel activities={activities} />);

    fireEvent.click(screen.getByText('file_write'));
    await waitFor(() => {
      expect(screen.getByText(/test.ts/)).toBeInTheDocument();
    });
  });
});
```

### Integration Tests

```typescript
// integration/agent-activity.test.ts
describe('Agent Activity Integration', () => {
  test('heartbeats appear in timeline after API call', async () => {
    // Seed heartbeat data
    await seedHeartbeats('build_agent', 10);

    render(<AgentActivityDashboard agentId="build_agent" />);

    await waitFor(() => {
      expect(screen.getAllByRole('graphics-symbol')).toHaveLength(10);
    });
  });

  test('gap detection identifies missing heartbeats', async () => {
    // Create heartbeat gap (5:00-5:10, 10 min gap)
    await createHeartbeat('build_agent', '2026-02-08T05:00:00Z');
    await createHeartbeat('build_agent', '2026-02-08T05:10:00Z');

    const { gaps } = await fetch('/api/agents/build_agent/heartbeat-gaps').then(r => r.json());

    expect(gaps).toHaveLength(1);
    expect(gaps[0].duration_ms).toBeGreaterThan(300000); // >5 min
  });

  test('real-time activity updates via WebSocket', async () => {
    render(<ActivityStreamPanel />);

    // Simulate WebSocket message
    act(() => {
      mockWs.emit('agent:activity', {
        id: 'act-123',
        agent_id: 'build',
        activity_type: 'task_completed',
        created_at: new Date().toISOString(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('task_completed')).toBeInTheDocument();
    });
  });
});
```

### Performance Tests

```typescript
describe('Performance', () => {
  test('timeline renders 1440 heartbeats in <500ms', async () => {
    const heartbeats = generateHeartbeats(1440); // 1 per minute, 24h

    const start = performance.now();
    render(<HeartbeatTimeline heartbeats={heartbeats} />);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });

  test('activity stream handles 10k activities without lag', async () => {
    const activities = generateActivities(10000);

    const { container } = render(<ActivityStreamPanel activities={activities} />);

    // Scroll to bottom
    const scrollEl = container.querySelector('[data-testid="activity-list"]');
    fireEvent.scroll(scrollEl, { target: { scrollTop: 100000 } });

    // Should not freeze
    expect(screen.getByText('Activity Stream')).toBeInTheDocument();
  });
});
```

---

## Success Metrics

**Operational:**
- Heartbeat gap detection accuracy: 100% (no false positives/negatives)
- Activity stream load time: <1 second for 100 items
- Search response time: <2 seconds for 10k+ logs
- WebSocket message latency: <100ms (p95)

**Usability:**
- Users can identify stuck agents within 10 seconds
- Error root cause visible in <5 clicks
- 80%+ of users understand timeline without docs
- Mobile usability score: 70%+ on Lighthouse

**Reliability:**
- Dashboard recovers from WebSocket disconnect: 100%
- No crashes with missing/malformed data
- Works with 100+ concurrent sessions
- Database query performance: <100ms for all endpoints

---

## Future Enhancements (Out of Scope)

1. **Predictive Alerting** - ML model predicts agent crashes before they happen
2. **Comparative Analysis** - Side-by-side agent performance comparison
3. **Custom Dashboards** - User-defined widget layouts
4. **Advanced Filtering** - Natural language queries ("show me all errors from Build Agent yesterday")
5. **Video Playback** - Replay agent activity timeline like a video
6. **Export to BI Tools** - Integration with Tableau, Power BI

---

## References

### Existing Code (Reuse)
- `parent-harness/dashboard/src/pages/AgentActivity.tsx` - Basic activity rendering
- `parent-harness/dashboard/src/components/SessionLogModal.tsx` - Session log modal
- `parent-harness/dashboard/src/hooks/useAgents.ts` - Agent data fetching
- `parent-harness/orchestrator/src/db/activities.ts` - Activity database operations
- `parent-harness/orchestrator/src/api/agents.ts` - Agent API endpoints

### Database Schema
- `parent-harness/database/schema.sql` - agent_heartbeats table
- `parent-harness/orchestrator/database/migrations/001_vibe_patterns.sql` - agent_activities table

### Strategic Documents
- `STRATEGIC_PLAN.md` - Phase 6 goals
- `docs/specs/PHASE3-TASK-05-dashboard-widget-updates.md` - Widget patterns
- `parent-harness/docs/PHASES.md` - Implementation phases

---

**End of Specification**
