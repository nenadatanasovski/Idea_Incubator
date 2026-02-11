# PHASE7-TASK-02: Health Checks and Monitoring

**Phase**: 7 - Deploy and Iterate
**Priority**: P0
**Estimated Effort**: Medium (3-4 hours)
**Dependencies**: PHASE7-TASK-01 (Docker Containerization)
**Created**: February 8, 2026
**Status**: Specification Complete

---

## Overview

This specification defines a comprehensive health monitoring system for production deployment of the Parent Harness platform. The system provides real-time visibility into agent health, task execution success rates, system resource utilization, and automated alerting for critical conditions.

The Parent Harness orchestrates 12+ specialized AI agents executing autonomous tasks. Production monitoring must answer three critical questions:

1. **Are agents alive and working?** (heartbeat monitoring)
2. **Are tasks succeeding?** (success rate tracking)
3. **Is the system healthy?** (resource utilization, error rates)

### Current State

**Existing Infrastructure** (already implemented):

- ✅ `agent_heartbeats` table - captures agent status, progress, resource metrics every 30s
- ✅ Crown Agent (SIA monitoring) - 10-minute interval health checks with intervention logic
- ✅ Monitoring Agent class - WebSocket emission, issue detection, configurable alerting
- ✅ Alert Rules Engine - 5 alert rules with cooldown (stuck agents, failure rate, blocked tasks)
- ✅ Health endpoint `/health` - basic liveness check returns `{ status: 'ok', timestamp }`
- ✅ API endpoints - `/api/agents`, `/api/sessions`, `/api/introspection/:agentId/summary`
- ✅ Database tables - `agents`, `agent_sessions`, `iteration_logs`, `tasks`, `detected_issues`
- ✅ Docker HEALTHCHECK - orchestrator polls `/health` every 30s (3 retries, 40s start delay)

**Missing Components** (this task):

- ❌ Enhanced `/health` endpoint with detailed metrics (agent counts, error rates, recent failures)
- ❌ Aggregated success rate calculations (per-agent, system-wide, time-windowed)
- ❌ Dashboard health visualization (status indicators, metrics cards, trend charts)
- ❌ Historical health data retention and cleanup policies
- ❌ Production monitoring documentation (runbook, alert response procedures)

---

## Requirements

### Functional Requirements

**FR-1: Enhanced Health Endpoint**

- Extend `/health` endpoint to return comprehensive health status
- Include system-level metrics: active agents, blocked agents, pending questions
- Include task metrics: success rate (last hour, last 24h), failed tasks count
- Include resource metrics: system uptime, average response time
- Return three-level health status: `healthy`, `degraded`, `critical`
- Include array of current issues with severity levels
- Support query param `?detailed=true` for verbose diagnostics
- Response time: <100ms for standard check, <500ms for detailed

**FR-2: Agent Heartbeat Monitoring**

- Monitor agent heartbeats from `agent_heartbeats` table
- Detect stuck agents (no heartbeat for 15+ minutes while status=working)
- Calculate agent uptime percentage (time working / total session time)
- Track agent-specific success rates (completed tasks / total tasks)
- Identify agents with high failure rates (>50% in last 10 sessions)
- Support per-agent health endpoint: `GET /api/agents/:id/health`

**FR-3: Task Success Rate Tracking**

- Calculate system-wide success rate across time windows (1h, 24h, 7d)
- Calculate per-agent success rates with minimum sample size (>=5 tasks)
- Calculate per-task-category success rates (feature, bug, test, etc.)
- Track consecutive failure patterns (3+ failures in a row triggers alert)
- Support time-series data for trend visualization
- Store aggregated metrics in `health_metrics` table for historical analysis

**FR-4: Dashboard Health Visualization**

- Add `HealthIndicator` component to Dashboard (already exists - enhance it)
- Display system status badge (green/yellow/red) with hover tooltip
- Show key metrics cards: Active Agents, Success Rate (24h), Pending Tasks, System Uptime
- Render agent health table: agent name, status, last heartbeat, success rate, actions
- Chart task success rate trends over 7 days
- Auto-refresh every 30 seconds via WebSocket `system:health` events
- Alert banner for critical issues (dismissible, persists until issue resolved)

**FR-5: Alert Integration**

- Crown Agent fires alerts via existing alert rules engine
- Telegram notifications for critical alerts (already implemented)
- WebSocket broadcasts for real-time dashboard updates
- Alert cooldown periods prevent spam (30min-2h depending on severity)
- Alert history logged to `detected_issues` table
- Support manual alert acknowledgment via API

**FR-6: Historical Data Management**

- Retain `agent_heartbeats` for 7 days (cleanup old records)
- Retain `detected_issues` for 30 days (archive after resolution)
- Retain `health_metrics` aggregates indefinitely (compact storage)
- Daily aggregation job calculates summary metrics at midnight
- Automatic cleanup cron runs every 6 hours
- Support manual cleanup via API endpoint

### Non-Functional Requirements

**NFR-1: Performance**

- Health endpoint responds in <100ms (p95)
- Dashboard health metrics load in <500ms
- Database queries use indexes for heartbeat/session lookups
- Aggregation queries complete in <1s for 7-day windows
- WebSocket health broadcasts: max 1 per 5 seconds (throttled)
- Minimal CPU overhead: <5% for monitoring loops

**NFR-2: Reliability**

- Health checks never crash the orchestrator (error boundary)
- Database write failures logged but don't block agent work
- Crown monitoring loop restarts automatically on failure
- Missing heartbeats don't cause false alerts (grace period)
- Health endpoint returns degraded status if DB unavailable
- Monitoring Agent tolerates incomplete data gracefully

**NFR-3: Observability**

- All health checks logged with timestamps and results
- Alert rules log trigger conditions and evidence
- Crown interventions logged with before/after state
- Dashboard API calls tracked for performance monitoring
- Health endpoint includes response time metric
- Support `/health?detailed=true` for debugging

**NFR-4: Maintainability**

- Clear separation: Crown (monitoring loop), Monitoring Agent (metrics collection), Health API (exposure)
- Alert rules defined declaratively in `alerts/index.ts`
- Configurable thresholds via environment variables
- Health calculation logic unit tested
- Database queries optimized with EXPLAIN
- Monitoring code documented with decision rationale

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Production Deployment                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐         ┌──────────────────────────────────┐ │
│  │   Dashboard  │────────>│   Orchestrator Container         │ │
│  │  (Browser)   │ HTTP/WS │                                  │ │
│  └──────────────┘         │  ┌────────────────────────────┐  │ │
│                           │  │  Health Endpoint Layer     │  │ │
│                           │  │  GET /health               │  │ │
│  ┌──────────────┐         │  │  GET /api/agents/:id/health│ │ │
│  │   Docker     │────────>│  └────────────────────────────┘  │ │
│  │  HEALTHCHECK │ HTTP    │             ▲                    │ │
│  └──────────────┘         │             │                    │ │
│                           │  ┌──────────┴──────────────────┐ │ │
│                           │  │  Monitoring Agent           │ │ │
│                           │  │  - Health checks (60s)      │ │ │
│                           │  │  - Heartbeat emission (30s) │ │ │
│                           │  │  - Issue detection          │ │ │
│                           │  │  - WebSocket broadcast      │ │ │
│                           │  └──────────┬──────────────────┘ │ │
│                           │             │                    │ │
│  ┌──────────────┐         │  ┌──────────┴──────────────────┐ │ │
│  │  Telegram    │<───────│  │  Crown Agent (SIA Monitor)  │ │ │
│  │  Bot (Alerts)│ Webhook │  │  - 10min health sweeps      │ │ │
│  └──────────────┘         │  │  - Stuck agent detection    │ │ │
│                           │  │  - Orphaned task recovery   │ │ │
│                           │  │  - Alert rule evaluation    │ │ │
│                           │  └──────────┬──────────────────┘ │ │
│                           │             │                    │ │
│                           │  ┌──────────┴──────────────────┐ │ │
│                           │  │  Database (SQLite)          │ │ │
│                           │  │  - agent_heartbeats (7d)    │ │ │
│                           │  │  - agents (status, metrics) │ │ │
│                           │  │  - agent_sessions           │ │ │
│                           │  │  - tasks (success/fail)     │ │ │
│                           │  │  - detected_issues (30d)    │ │ │
│                           │  │  - health_metrics (∞)       │ │ │
│                           │  └─────────────────────────────┘ │ │
│                           └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. Health Endpoint (`server.ts`, new `/api/health.ts`)

**Basic Health Check** (existing - enhance):

```typescript
GET /health
Response: {
  status: 'healthy' | 'degraded' | 'critical',
  timestamp: string,
  uptime_ms: number,
  version: string,
  metrics: {
    active_agents: number,
    blocked_agents: number,
    pending_questions: number,
    tasks_last_hour: { completed: number, failed: number, success_rate: number },
    tasks_last_24h: { completed: number, failed: number, success_rate: number },
    avg_response_time_ms: number
  },
  issues: string[],  // Human-readable issue descriptions
  checks: {
    database: 'ok' | 'error',
    websocket: 'ok' | 'error',
    crown_agent: 'ok' | 'error'
  }
}
```

**Detailed Health** (new):

```typescript
GET /health?detailed=true
Response: {
  ...basic_fields,
  agents: Array<{
    agent_id: string,
    type: string,
    status: string,
    last_heartbeat: string,
    time_since_heartbeat_ms: number,
    success_rate: number,
    total_sessions: number,
    consecutive_failures: number
  }>,
  recent_issues: Array<{
    id: string,
    type: string,
    severity: string,
    description: string,
    detected_at: string,
    resolved: boolean
  }>,
  resource_usage: {
    db_size_mb: number,
    heartbeats_count: number,
    sessions_count: number
  }
}
```

#### 2. Health Metrics Table (new migration)

```sql
CREATE TABLE IF NOT EXISTS health_metrics (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL CHECK(metric_type IN (
    'system_success_rate', 'agent_success_rate', 'category_success_rate',
    'agent_uptime', 'response_time', 'active_agents'
  )),
  metric_key TEXT,  -- agent_id or category for scoped metrics
  time_window TEXT NOT NULL CHECK(time_window IN (
    '1h', '24h', '7d', '30d'
  )),
  value REAL NOT NULL,
  sample_size INTEGER,  -- Number of data points
  recorded_at TEXT DEFAULT (datetime('now')),

  INDEX idx_health_metrics_type (metric_type, time_window, recorded_at DESC),
  INDEX idx_health_metrics_key (metric_key, metric_type, recorded_at DESC)
);
```

#### 3. Monitoring Agent Enhancements (`server/monitoring/monitoring-agent.ts`)

**Add Success Rate Calculation**:

```typescript
class MonitoringAgent {
  // ... existing methods ...

  /**
   * Calculate success rate for a time window
   */
  async calculateSuccessRate(windowMs: number): Promise<{
    completed: number;
    failed: number;
    total: number;
    success_rate: number;
  }> {
    const since = new Date(Date.now() - windowMs).toISOString();

    const sessions = await this.db.all<AgentSession>(
      `SELECT status FROM agent_sessions
       WHERE completed_at >= ? AND status IN ('completed', 'failed')`,
      [since],
    );

    const completed = sessions.filter((s) => s.status === "completed").length;
    const failed = sessions.filter((s) => s.status === "failed").length;
    const total = completed + failed;
    const success_rate = total > 0 ? completed / total : 0;

    return { completed, failed, total, success_rate };
  }

  /**
   * Get per-agent success rates
   */
  async getAgentSuccessRates(minSampleSize = 5): Promise<Map<string, number>> {
    const rates = new Map<string, number>();

    const results = await this.db.all<{
      agent_id: string;
      completed: number;
      total: number;
    }>(
      `SELECT agent_id,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              COUNT(*) as total
       FROM agent_sessions
       WHERE completed_at >= datetime('now', '-24 hours')
       GROUP BY agent_id
       HAVING total >= ?`,
      [minSampleSize],
    );

    for (const row of results) {
      rates.set(row.agent_id, row.completed / row.total);
    }

    return rates;
  }
}
```

#### 4. Crown Agent Enhancements (`orchestrator/src/crown/index.ts`)

**Add Health Metrics Recording** (already has health checks - add metrics persistence):

```typescript
async function recordHealthMetrics(report: CrownReport): Promise<void> {
  const db = getDb();

  // Calculate system-wide success rates
  const rate1h = await calculateSuccessRate(60 * 60 * 1000);
  const rate24h = await calculateSuccessRate(24 * 60 * 60 * 1000);

  // Record system metrics
  await db.run(
    `INSERT INTO health_metrics (id, metric_type, time_window, value, sample_size)
     VALUES (?, 'system_success_rate', '1h', ?, ?)`,
    [uuidv4(), rate1h.success_rate, rate1h.total],
  );

  await db.run(
    `INSERT INTO health_metrics (id, metric_type, time_window, value, sample_size)
     VALUES (?, 'system_success_rate', '24h', ?, ?)`,
    [uuidv4(), rate24h.success_rate, rate24h.total],
  );

  // Record per-agent success rates
  const agentRates = await getAgentSuccessRates();
  for (const [agentId, rate] of agentRates) {
    await db.run(
      `INSERT INTO health_metrics (id, metric_type, metric_key, time_window, value)
       VALUES (?, 'agent_success_rate', ?, '24h', ?)`,
      [uuidv4(), agentId, rate],
    );
  }

  // Record active agent count
  const activeCount = report.healthChecks.filter(
    (h) => h.status === "working",
  ).length;
  await db.run(
    `INSERT INTO health_metrics (id, metric_type, time_window, value)
     VALUES (?, 'active_agents', '1h', ?)`,
    [uuidv4(), activeCount],
  );
}
```

#### 5. Dashboard Health Component (`parent-harness/dashboard/src/components/HealthIndicator.tsx`)

**Enhanced Health Visualization**:

```tsx
import React, { useEffect, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

interface HealthMetrics {
  status: "healthy" | "degraded" | "critical";
  metrics: {
    active_agents: number;
    blocked_agents: number;
    tasks_last_24h: {
      success_rate: number;
    };
  };
  issues: string[];
}

export function HealthIndicator() {
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const { connected } = useWebSocket();

  useEffect(() => {
    // Fetch initial health
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth);

    // Subscribe to WebSocket health updates
    const ws = new WebSocket("ws://localhost:3333/ws");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "system:health") {
        setHealth(data.payload);
      }
    };

    return () => ws.close();
  }, []);

  if (!health) return <div>Loading...</div>;

  const statusColor =
    health.status === "healthy"
      ? "bg-green-500"
      : health.status === "degraded"
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="health-indicator">
      <div className={`status-badge ${statusColor}`}>
        {health.status.toUpperCase()}
      </div>

      <div className="metrics-grid">
        <MetricCard
          label="Active Agents"
          value={health.metrics.active_agents}
        />
        <MetricCard
          label="Success Rate (24h)"
          value={`${(health.metrics.tasks_last_24h.success_rate * 100).toFixed(1)}%`}
        />
        <MetricCard
          label="Blocked Agents"
          value={health.metrics.blocked_agents}
          alert={health.metrics.blocked_agents > 3}
        />
      </div>

      {health.issues.length > 0 && (
        <div className="alert-banner">
          {health.issues.map((issue, i) => (
            <div key={i} className="alert-item">
              {issue}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

#### 6. Heartbeat Cleanup Job (new `orchestrator/src/jobs/cleanup.ts`)

```typescript
/**
 * Cleanup old monitoring data
 */
export async function cleanupHealthData(): Promise<void> {
  const db = getDb();

  // Delete heartbeats older than 7 days
  await db.run(
    `DELETE FROM agent_heartbeats
     WHERE recorded_at < datetime('now', '-7 days')`,
  );

  // Delete resolved issues older than 30 days
  await db.run(
    `DELETE FROM detected_issues
     WHERE resolved = 1 AND resolved_at < datetime('now', '-30 days')`,
  );

  // Keep aggregated metrics forever (small storage footprint)

  console.log("[Cleanup] Old health data removed");
}

// Schedule cleanup every 6 hours
setInterval(cleanupHealthData, 6 * 60 * 60 * 1000);
```

---

## Pass Criteria

### Functional Validation

**PC-1: Health Endpoint Returns Comprehensive Status**

- [ ] `GET /health` returns JSON with `status`, `timestamp`, `uptime_ms`, `metrics`, `issues`, `checks`
- [ ] Status calculation: `healthy` if no critical issues, `degraded` if 1-2 warnings, `critical` if 3+ issues or any critical
- [ ] Metrics include `active_agents`, `blocked_agents`, `pending_questions`, `tasks_last_hour`, `tasks_last_24h`
- [ ] Issues array populated when thresholds exceeded (>3 blocked agents, >50% failure rate)
- [ ] Response time <100ms (p95) for standard health check
- [ ] `GET /health?detailed=true` includes per-agent breakdown and recent issues

**PC-2: Agent Heartbeat Monitoring Works**

- [ ] Crown Agent detects stuck agents (no heartbeat for 15min while working)
- [ ] Per-agent health endpoint `GET /api/agents/:id/health` returns success rate, uptime, last heartbeat
- [ ] Agents with >50% failure rate in last 10 sessions flagged in health report
- [ ] Heartbeat table populated every 30s by Monitoring Agent
- [ ] Missing heartbeats trigger `agent:timeout` issue after 5 minutes

**PC-3: Success Rate Tracking Accurate**

- [ ] System-wide success rate calculated for 1h, 24h, 7d windows
- [ ] Per-agent success rates calculated (minimum 5 sessions sample size)
- [ ] Consecutive failure detection triggers alert after 3 failures
- [ ] Task category success rates calculated (feature, bug, test, etc.)
- [ ] Success rate displayed in dashboard with trend indicator (↑/↓/→)

**PC-4: Dashboard Health Visualization**

- [ ] `HealthIndicator` component shows status badge (green/yellow/red)
- [ ] Metrics cards display: Active Agents, Success Rate (24h), Pending Tasks, System Uptime
- [ ] Alert banner appears for critical issues with dismiss button
- [ ] Auto-refresh every 30s via WebSocket `system:health` events
- [ ] Agent health table shows: name, status, last heartbeat, success rate, actions
- [ ] Chart renders 7-day success rate trend (line chart, daily aggregates)

**PC-5: Alert Integration**

- [ ] Crown Agent fires alerts using existing alert rules (5 rules: stuck agents, failure rate, build critical, crashes, blocked tasks)
- [ ] Telegram notifications sent for critical alerts
- [ ] WebSocket broadcasts `system:alert` events to dashboard
- [ ] Alert cooldown prevents duplicate alerts within 30min-2h window
- [ ] Detected issues logged to `detected_issues` table with severity, evidence

**PC-6: Historical Data Management**

- [ ] `agent_heartbeats` records older than 7 days deleted by cleanup job
- [ ] `detected_issues` records (resolved only) older than 30 days deleted
- [ ] `health_metrics` table retains all aggregated data indefinitely
- [ ] Daily aggregation job runs at midnight, calculates summary metrics
- [ ] Cleanup job runs every 6 hours automatically
- [ ] Manual cleanup triggered via `POST /api/health/cleanup` endpoint

### Non-Functional Validation

**PC-7: Performance**

- [ ] Health endpoint responds in <100ms (p95) measured over 100 requests
- [ ] Detailed health endpoint responds in <500ms (p95)
- [ ] Dashboard health metrics load in <500ms on initial page load
- [ ] Database queries use indexes (verify with `EXPLAIN QUERY PLAN`)
- [ ] 7-day aggregation query completes in <1s
- [ ] Monitoring Agent CPU usage <5% (measured via `top` during active monitoring)

**PC-8: Reliability**

- [ ] Health endpoint returns `{ status: 'degraded' }` if database unavailable (not crash)
- [ ] Crown monitoring loop restarts automatically after exception
- [ ] Monitoring Agent tolerates missing heartbeat data (no crash)
- [ ] Database write failures logged but don't block health checks
- [ ] WebSocket disconnection doesn't prevent HTTP health checks
- [ ] Docker HEALTHCHECK succeeds during normal operation, fails during crash

**PC-9: Observability**

- [ ] Crown health check results logged with timestamp and summary
- [ ] Alert rule triggers logged with condition and evidence
- [ ] Health endpoint access logged (timestamp, response time, status)
- [ ] Detailed health check includes response time in payload
- [ ] Monitoring Agent phase logs include health check duration
- [ ] Database query performance logged for queries >500ms

**PC-10: Maintainability**

- [ ] TypeScript compilation passes with no errors
- [ ] Unit tests cover health calculation logic (status determination, success rate calculation)
- [ ] Integration tests verify end-to-end health flow (heartbeat → Crown → alert → dashboard)
- [ ] Environment variables documented for thresholds (STUCK_THRESHOLD_MS, FAILURE_RATE_THRESHOLD)
- [ ] Alert rules defined declaratively in `alerts/index.ts` with comments
- [ ] Database migration creates `health_metrics` table with proper indexes

---

## Implementation Plan

### Phase 1: Database Schema (30 minutes)

1. Create migration `002_health_metrics.sql`:
   - Add `health_metrics` table with indexes
   - Add indexes to `agent_heartbeats` for time-based queries
   - Add `health_status_cache` table for fast lookups

2. Run migration and verify schema:
   ```bash
   npm run migrate
   sqlite3 parent-harness/data/harness.db ".schema health_metrics"
   ```

### Phase 2: Enhanced Health Endpoint (45 minutes)

1. Create `parent-harness/orchestrator/src/api/health.ts`:
   - Implement `GET /health` with comprehensive metrics
   - Add `GET /health?detailed=true` with per-agent breakdown
   - Add `GET /api/agents/:id/health` for agent-specific status
   - Implement status calculation logic (healthy/degraded/critical)

2. Add health router to `server.ts`:

   ```typescript
   import { healthRouter } from "./api/health.js";
   app.use("/api/health", healthRouter);
   ```

3. Update existing `/health` endpoint to redirect to new detailed version

### Phase 3: Monitoring Agent Enhancements (45 minutes)

1. Add success rate methods to `server/monitoring/monitoring-agent.ts`:
   - `calculateSuccessRate(windowMs)` - time-windowed success rate
   - `getAgentSuccessRates(minSampleSize)` - per-agent rates
   - `getCategorySuccessRates()` - per-category rates

2. Update `performHealthCheck()` to record metrics to `health_metrics` table

3. Add WebSocket emission for `system:health` events (throttled to 1/5s)

### Phase 4: Crown Agent Metrics Recording (30 minutes)

1. Add `recordHealthMetrics()` function to `orchestrator/src/crown/index.ts`

2. Call from `runCrownCheck()` after health checks complete

3. Add aggregation for daily metrics at midnight

### Phase 5: Dashboard Health Component (60 minutes)

1. Enhance `parent-harness/dashboard/src/components/HealthIndicator.tsx`:
   - Add metrics cards grid (Active Agents, Success Rate, Blocked, Uptime)
   - Add alert banner for critical issues
   - Add agent health table with status indicators
   - Add 7-day success rate trend chart (use Chart.js or Recharts)

2. Add WebSocket subscription to `useWebSocket` hook for `system:health` events

3. Update Dashboard page to render `HealthIndicator` in header

### Phase 6: Cleanup Jobs (30 minutes)

1. Create `parent-harness/orchestrator/src/jobs/cleanup.ts`:
   - `cleanupHeartbeats()` - delete records >7d old
   - `cleanupIssues()` - delete resolved issues >30d old
   - Schedule with `setInterval(cleanup, 6 * 60 * 60 * 1000)`

2. Call `initCleanupJobs()` from `server.ts` on startup

3. Add manual cleanup endpoint `POST /api/health/cleanup`

### Phase 7: Testing (30 minutes)

1. Unit tests:
   - Test health status calculation (healthy/degraded/critical logic)
   - Test success rate calculations with sample data
   - Test cleanup job date calculations

2. Integration tests:
   - Seed test data (agents, sessions, heartbeats)
   - Call `/health` and verify response structure
   - Trigger alert conditions and verify WebSocket emission
   - Verify cleanup removes old data

3. Manual testing:
   - Start orchestrator and verify health endpoint
   - Open dashboard and verify health metrics render
   - Simulate stuck agent (stop heartbeat) and verify alert
   - Check Telegram for alert notification

---

## Dependencies

### External Libraries

- `express` - already installed
- `better-sqlite3` - already installed
- `ws` - already installed for WebSocket
- `chart.js` or `recharts` - for trend visualization (optional, can defer)

### Internal Dependencies

- `orchestrator/src/db/index.ts` - database connection
- `orchestrator/src/crown/index.ts` - Crown Agent monitoring loop
- `server/monitoring/monitoring-agent.ts` - Monitoring Agent class
- `orchestrator/src/alerts/index.ts` - Alert rules engine
- `parent-harness/database/schema.sql` - database schema

### Configuration

```bash
# .env variables for monitoring thresholds
STUCK_THRESHOLD_MS=900000          # 15 minutes
FAILURE_RATE_THRESHOLD=0.5         # 50%
ERROR_RATE_THRESHOLD=0.5           # 50%
HEARTBEAT_INTERVAL_MS=30000        # 30 seconds
HEALTH_CHECK_INTERVAL_MS=60000     # 1 minute
CROWN_INTERVAL_MS=600000           # 10 minutes
CLEANUP_INTERVAL_MS=21600000       # 6 hours
```

---

## Risk Assessment

| Risk                             | Likelihood | Impact | Mitigation                                                  |
| -------------------------------- | ---------- | ------ | ----------------------------------------------------------- |
| Health checks add CPU overhead   | Medium     | Medium | Use indexes, cache results, throttle WebSocket              |
| Database grows too large         | Low        | Medium | Cleanup jobs every 6h, 7-day retention for heartbeats       |
| False alerts during deployments  | Medium     | Low    | Grace periods, alert cooldowns, manual acknowledgment       |
| Dashboard polling overwhelms API | Low        | Low    | WebSocket-based updates, throttling, rate limits            |
| Crown Agent fails silently       | Low        | High   | Stability layer restart, health check monitors Crown itself |

---

## Testing Strategy

### Unit Tests

- `health.test.ts` - Health endpoint response structure, status calculation
- `monitoring-agent.test.ts` - Success rate calculations, agent rate calculations
- `cleanup.test.ts` - Date calculations, record deletion logic

### Integration Tests

- `health-flow.test.ts` - End-to-end flow: heartbeat → Crown → alert → dashboard
- `health-api.test.ts` - All health API endpoints with real database

### Manual Testing

1. Start orchestrator: `npm run dev` in `parent-harness/orchestrator`
2. Verify `/health` returns comprehensive metrics
3. Open dashboard and check health indicator
4. Simulate failure: kill agent mid-task, verify alert
5. Check Telegram for notification
6. Verify cleanup job runs (check logs after 6 hours)

### Load Testing (optional)

- 100 concurrent health endpoint requests → verify p95 <100ms
- 1000 heartbeat records → verify queries <100ms

---

## Monitoring the Monitor (Meta-Monitoring)

The monitoring system itself needs health checks:

1. **Crown Agent Liveness**: Dashboard shows "Crown Last Run" timestamp
2. **Monitoring Agent Liveness**: WebSocket connection status indicator
3. **Database Health**: Detect write failures, size limits
4. **Cleanup Job Verification**: Log cleanup results, track last run timestamp

---

## Documentation

### Runbook (create `docs/runbooks/monitoring.md`)

**Alert Response Procedures**:

- `all_agents_stuck` → Check Crown logs, restart orchestrator, inspect stuck tasks
- `high_failure_rate` → Review recent task logs, check for pattern (API failures, timeout issues)
- `build_critical` → Run `npm run build`, fix TypeScript errors
- `tasks_blocked_too_long` → Manually unblock via dashboard, investigate root cause

**Health Check Troubleshooting**:

- Health endpoint timeout → Check database connection, disk space
- Missing heartbeats → Verify agents running, check spawner logs
- False alerts → Adjust thresholds in `.env`, restart orchestrator

---

## Future Enhancements (Out of Scope)

1. **Prometheus/Grafana Integration**: Export metrics to Prometheus for advanced visualization
2. **PagerDuty/Opsgenie Integration**: Critical alerts to on-call rotation
3. **Anomaly Detection**: ML-based detection of unusual patterns (sudden failure spike)
4. **Distributed Tracing**: OpenTelemetry integration for request tracing
5. **SLA Tracking**: Track uptime percentage, SLO violations

---

## Acceptance Criteria Summary

This task is complete when:

1. ✅ Enhanced `/health` endpoint returns comprehensive metrics (status, agents, tasks, issues)
2. ✅ Dashboard renders health indicator with status badge and metrics cards
3. ✅ Agent heartbeat monitoring detects stuck agents within 15 minutes
4. ✅ Success rates calculated for 1h, 24h, 7d windows (system + per-agent)
5. ✅ Alert rules fire for critical conditions (Telegram + WebSocket)
6. ✅ Cleanup jobs remove old data (heartbeats >7d, issues >30d)
7. ✅ Docker HEALTHCHECK uses enhanced endpoint
8. ✅ All tests pass (unit + integration)
9. ✅ TypeScript compiles cleanly
10. ✅ Documentation complete (runbook, API docs, env vars)

**Definition of Done**: Production orchestrator returns detailed health status accessible via API and dashboard, with automated monitoring, alerting, and data retention policies.
