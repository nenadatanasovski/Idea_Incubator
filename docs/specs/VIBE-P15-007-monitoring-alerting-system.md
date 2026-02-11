# VIBE-P15-007: Monitoring and Alerting System

**Phase**: 15 - Production Deployment & Operations
**Priority**: P0
**Estimated Effort**: High (8-10 hours)
**Dependencies**: PHASE7-TASK-02 (Health Checks), VIBE-P15-006 (SSL Certificates)
**Created**: February 9, 2026
**Status**: Specification Complete

---

## Overview

This specification defines a comprehensive external monitoring and alerting system for the Parent Harness platform, integrating third-party uptime monitoring services, error tracking, performance metrics, and multi-channel alerting. The system complements the internal health monitoring (PHASE7-TASK-02) by providing external validation, incident management, and production observability through industry-standard tools.

### Context

The Parent Harness orchestrates 12+ autonomous AI agents executing complex software development tasks. Production deployment requires:

1. **External Uptime Monitoring** - Validate system availability from outside the infrastructure (detect network issues, DNS failures, complete service outages)
2. **Error Tracking** - Centralized exception capture with stack traces, release tracking, and user impact analysis
3. **Performance Monitoring** - Response time tracking, slow query detection, resource utilization trends
4. **Multi-Channel Alerting** - Email, Slack, PagerDuty webhooks for incident escalation
5. **Deployment Status Dashboard** - Real-time visibility into monitoring health and alert status

**Key Distinction from PHASE7-TASK-02**:

- **Internal Monitoring** (PHASE7-TASK-02): Crown Agent, Monitoring Agent, agent heartbeats, task success rates, database-driven health checks
- **External Monitoring** (This Task): Third-party service integration, HTTP/TCP uptime checks, Sentry error tracking, Datadog/Better Stack metrics, external alerting channels

### Current State

**Existing Infrastructure** (from PHASE7-TASK-02):

- ✅ Internal health endpoint `/health` with system metrics
- ✅ Crown Agent monitoring loop (10-minute intervals)
- ✅ Monitoring Agent with heartbeat tracking
- ✅ Alert rules engine with Telegram notifications
- ✅ Dashboard health visualization
- ✅ `detected_issues` and `agent_heartbeats` tables

**Missing Components** (this task):

- ❌ HealthCheckManager class for external endpoint monitoring
- ❌ HTTP/TCP health check protocols
- ❌ Uptime Robot, Better Stack, or Datadog integration
- ❌ Sentry SDK setup and error tracking
- ❌ Performance metrics collection (response times, error rates)
- ❌ Slack and PagerDuty webhook alerting
- ❌ Deployment status dashboard data provider

---

## Requirements

### Functional Requirements

**FR-1: HealthCheckManager Class**

- Centralized management for external health check endpoints
- Register health check targets: `registerEndpoint(name, url, protocol, interval, timeout)`
- Support HTTP/HTTPS health checks (GET requests with status code validation)
- Support TCP health checks (socket connection validation)
- Support custom health checks (execute arbitrary validation logic)
- Status tracking: `healthy`, `degraded`, `down`
- Last check timestamp and response time recording
- Retry logic with exponential backoff (3 attempts before marking as down)
- Database persistence in `health_check_endpoints` table

**FR-2: HTTP/HTTPS Health Check Protocol**

- Execute periodic GET requests to registered endpoints
- Validate HTTP status codes (200-299 = healthy, 400-499 = degraded, 500+ = down)
- Support custom status code expectations (e.g., 201 for specific APIs)
- Parse response bodies for health indicators (e.g., `{"status": "ok"}`)
- Measure response time and flag slow responses (>2s warning, >5s critical)
- TLS certificate validation (flag if cert expires within 7 days)
- Follow redirects (max 3 hops)
- Support custom headers (e.g., Authorization, API keys)

**FR-3: TCP Health Check Protocol**

- Open socket connection to host:port
- Validate successful connection within timeout (default 5s)
- Optionally send protocol-specific handshake (e.g., PostgreSQL startup message)
- Validate expected response pattern (regex match)
- Use cases: Database availability, Redis, message queues
- Support TLS socket connections (e.g., `postgres://` with SSL)

**FR-4: Uptime Monitoring Service Integration**

- **Provider Support**: Uptime Robot, Better Stack (formerly Better Uptime), Datadog Synthetics
- **Configuration**: Environment variables for API keys and monitor IDs
- **Monitor Creation**: Auto-create monitors via API on first deployment
- **Monitor Updates**: Sync endpoint changes (URL updates, interval changes)
- **Status Retrieval**: Fetch monitor status via API every 5 minutes
- **Incident Webhooks**: Receive and process uptime service webhooks
- **Dashboard Display**: Show external monitor status in dashboard

**FR-5: Sentry Error Tracking Integration**

- **SDK Setup**: Initialize `@sentry/node` in orchestrator and dashboard
- **Auto-Configuration**: Environment variable `SENTRY_DSN` for project connection
- **Error Capture**: Automatic exception capture with stack traces
- **Context Enrichment**: Include agent ID, task ID, session ID in error context
- **Release Tracking**: Tag errors with git commit SHA and build timestamp
- **User Identification**: Associate errors with agent sessions
- **Breadcrumbs**: Log agent phase transitions and task events as breadcrumbs
- **Performance Monitoring**: Track transaction duration for API endpoints
- **Custom Events**: Manual error reporting via `Sentry.captureException()`

**FR-6: Performance Metrics Collection**

- **Response Time Tracking**: Measure and log API endpoint latency (p50, p95, p99)
- **Error Rate Calculation**: Track 4xx and 5xx error rates per endpoint
- **Database Query Performance**: Log slow queries (>500ms) with query text
- **Agent Execution Time**: Track task completion time by agent type
- **Resource Utilization**: CPU, memory, disk I/O (via node.js `process` API)
- **WebSocket Connection Health**: Track active connections, reconnection rate
- **Metrics Storage**: `performance_metrics` table with time-series data
- **Aggregation**: Calculate hourly/daily averages for trending

**FR-7: Multi-Channel Alert Configuration**

- **Slack Webhooks**: Send alert messages to Slack channels via incoming webhooks
- **Email Alerts**: SMTP-based email notifications with HTML templates
- **PagerDuty Integration**: Create incidents via Events API v2
- **Telegram Notifications**: Extend existing Telegram bot with monitoring alerts
- **Alert Routing**: Configure alert severity → channel mappings (e.g., critical → PagerDuty, warning → Slack)
- **Alert Throttling**: Cooldown periods to prevent alert spam (5min-2h based on severity)
- **Alert Acknowledgment**: API endpoint to acknowledge/resolve alerts manually
- **Escalation Policies**: Auto-escalate unacknowledged critical alerts after 15 minutes

**FR-8: Deployment Status Dashboard Data Provider**

- **API Endpoint**: `GET /api/monitoring/status` - returns comprehensive monitoring health
- **Response Data**:
  - Health check endpoint statuses (name, URL, status, last check, response time)
  - External monitor statuses (Uptime Robot, Better Stack, Datadog)
  - Recent errors from Sentry (last 10, with count)
  - Performance metrics (avg response time, error rate, slow queries)
  - Active alerts (unacknowledged incidents)
  - System uptime percentage (last 24h, 7d, 30d)
- **WebSocket Updates**: Real-time status changes via `monitoring:status` events
- **Dashboard Component**: `MonitoringStatusWidget` to render monitoring overview

### Non-Functional Requirements

**NFR-1: Reliability**

- Health check failures don't crash the orchestrator
- Retry logic with exponential backoff (3 attempts: 0s, 5s, 15s)
- Graceful degradation if external services unavailable
- Database write failures logged but don't block health checks
- Webhook endpoint responds 200 OK even if processing fails (async processing)
- Timeout handling for all network requests (max 30s)

**NFR-2: Performance**

- Health checks execute in parallel (Promise.all)
- Maximum 100 concurrent health checks
- Webhook processing completes in <100ms (defer heavy work to queue)
- Dashboard status API responds in <500ms
- Minimal CPU overhead: <2% for health check loops
- Database queries use indexes for time-range lookups

**NFR-3: Security**

- API keys stored in environment variables (never hardcoded)
- Webhook endpoints validate signatures (Slack, PagerDuty, Uptime Robot)
- HTTPS-only for external API calls
- Sanitize error messages before sending to external services (no secrets)
- Rate limiting on webhook endpoints (100 req/min per IP)
- Access control: Admin-only API endpoints for monitor configuration

**NFR-4: Observability**

- All health checks logged with timestamp, duration, and result
- Failed health checks logged with error details
- Alert delivery success/failure logged
- Sentry integration logs errors to console (fallback)
- Dashboard displays last sync time with external monitors
- Health check metrics exposed via Prometheus (if enabled)

**NFR-5: Maintainability**

- HealthCheckManager supports pluggable check types (easy to add new protocols)
- Alert channels defined declaratively in configuration
- Monitor definitions stored in database for runtime updates
- TypeScript types for all monitoring data structures
- Unit tests for health check logic (mock HTTP/TCP)
- Integration tests for external service APIs (test mode)

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Production Deployment                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐          ┌───────────────────────────────────┐│
│  │  External Users  │─────────>│  Parent Harness (Public)          ││
│  │  Dashboard/API   │  HTTPS   │  - Dashboard (port 443)           ││
│  └──────────────────┘          │  - API Endpoint (/api/*)          ││
│                                │  - Health Endpoint (/health)       ││
│  ┌──────────────────┐          └───────────────┬───────────────────┘│
│  │  Third-Party     │                          │                    │
│  │  Monitors        │<─────────────────────────┘                    │
│  │  - Uptime Robot  │  Webhook                                      │
│  │  - Better Stack  │  Callbacks                                    │
│  │  - Datadog       │                                               │
│  └──────────────────┘                                               │
│          ▲                                                           │
│          │ API Polling                                              │
│          │ (status sync)                                            │
│          │                                                           │
│  ┌───────┴──────────────────────────────────────────────────────┐  │
│  │              Parent Harness Orchestrator                       │  │
│  │                                                                 │  │
│  │  ┌───────────────────────────────────────────────────────┐    │  │
│  │  │  HealthCheckManager                                    │    │  │
│  │  │  - executeChecks() (every 60s)                        │    │  │
│  │  │  - HTTP/TCP check executors                           │    │  │
│  │  │  - Response time tracking                             │    │  │
│  │  │  - Status determination (healthy/degraded/down)       │    │  │
│  │  └────────────────┬──────────────────────────────────────┘    │  │
│  │                   │                                            │  │
│  │  ┌────────────────┴──────────────────────────────────────┐    │  │
│  │  │  External Monitor Integration                          │    │  │
│  │  │  - UptimeRobotClient (API wrapper)                    │    │  │
│  │  │  - BetterStackClient (API wrapper)                    │    │  │
│  │  │  - DatadogClient (API wrapper)                        │    │  │
│  │  │  - syncMonitors() (every 5min)                        │    │  │
│  │  └────────────────┬──────────────────────────────────────┘    │  │
│  │                   │                                            │  │
│  │  ┌────────────────┴──────────────────────────────────────┐    │  │
│  │  │  Sentry Error Tracking                                 │    │  │
│  │  │  - @sentry/node SDK                                   │    │  │
│  │  │  - Global error handlers                              │    │  │
│  │  │  - Context enrichment (agent, task, session)          │    │  │
│  │  │  - Performance transactions                           │    │  │
│  │  └────────────────┬──────────────────────────────────────┘    │  │
│  │                   │                                            │  │
│  │  ┌────────────────┴──────────────────────────────────────┐    │  │
│  │  │  Performance Metrics Collector                         │    │  │
│  │  │  - Express middleware (request timing)                │    │  │
│  │  │  - Database query interceptor                         │    │  │
│  │  │  - Agent execution time tracker                       │    │  │
│  │  │  - Metrics aggregation (hourly/daily)                 │    │  │
│  │  └────────────────┬──────────────────────────────────────┘    │  │
│  │                   │                                            │  │
│  │  ┌────────────────┴──────────────────────────────────────┐    │  │
│  │  │  Alert Manager                                         │    │  │
│  │  │  - SlackNotifier (webhook sender)                     │    │  │
│  │  │  - PagerDutyNotifier (incident creator)               │    │  │
│  │  │  - EmailNotifier (SMTP sender)                        │    │  │
│  │  │  - TelegramNotifier (existing bot integration)        │    │  │
│  │  │  - Alert routing and throttling                       │    │  │
│  │  └────────────────┬──────────────────────────────────────┘    │  │
│  │                   │                                            │  │
│  │  ┌────────────────┴──────────────────────────────────────┐    │  │
│  │  │  Database (SQLite)                                     │    │  │
│  │  │  - health_check_endpoints                             │    │  │
│  │  │  - health_check_results                               │    │  │
│  │  │  - external_monitors                                  │    │  │
│  │  │  - performance_metrics                                │    │  │
│  │  │  - alert_deliveries                                   │    │  │
│  │  └───────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Webhook Receivers                                          │    │
│  │  POST /webhooks/uptime-robot   - Uptime Robot incidents    │    │
│  │  POST /webhooks/better-stack   - Better Stack alerts       │    │
│  │  POST /webhooks/datadog        - Datadog monitor events    │    │
│  │  POST /webhooks/pagerduty      - PagerDuty acknowledgments │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. HealthCheckManager

**Location**: `parent-harness/orchestrator/src/monitoring/health-check-manager.ts`

**Class Interface**:

```typescript
export interface HealthCheckEndpoint {
  id: string;
  name: string;
  url: string;
  protocol: "http" | "https" | "tcp" | "custom";
  method?: "GET" | "POST" | "HEAD";
  interval_ms: number;
  timeout_ms: number;
  expected_status?: number;
  expected_body?: string; // regex pattern
  headers?: Record<string, string>;
  status: "healthy" | "degraded" | "down" | "unknown";
  last_check: string | null;
  last_response_time_ms: number | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

export interface HealthCheckResult {
  endpoint_id: string;
  checked_at: string;
  status: "success" | "failure";
  response_time_ms: number;
  http_status?: number;
  error_message?: string;
  details: Record<string, unknown>;
}

export class HealthCheckManager {
  constructor(db: Database, config?: HealthCheckConfig);

  // Endpoint management
  registerEndpoint(
    endpoint: Omit<
      HealthCheckEndpoint,
      "id" | "status" | "last_check" | "created_at" | "updated_at"
    >,
  ): Promise<HealthCheckEndpoint>;
  unregisterEndpoint(id: string): Promise<void>;
  getEndpoint(id: string): Promise<HealthCheckEndpoint | null>;
  listEndpoints(): Promise<HealthCheckEndpoint[]>;
  updateEndpoint(
    id: string,
    updates: Partial<HealthCheckEndpoint>,
  ): Promise<void>;

  // Health checks
  executeCheck(endpoint: HealthCheckEndpoint): Promise<HealthCheckResult>;
  executeAllChecks(): Promise<HealthCheckResult[]>;
  startPeriodicChecks(): void;
  stopPeriodicChecks(): void;

  // Status queries
  getEndpointStatus(id: string): Promise<"healthy" | "degraded" | "down">;
  getSystemUptime(windowMs: number): Promise<number>; // percentage

  // Event handlers
  on(
    event:
      | "check:success"
      | "check:failure"
      | "endpoint:down"
      | "endpoint:recovered",
    handler: (data: unknown) => void,
  ): void;
}
```

**HTTP/HTTPS Check Implementation**:

```typescript
private async executeHttpCheck(endpoint: HealthCheckEndpoint): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(endpoint.url, {
      method: endpoint.method || 'GET',
      headers: endpoint.headers || {},
      signal: AbortSignal.timeout(endpoint.timeout_ms),
    });

    const responseTime = Date.now() - startTime;
    const expectedStatus = endpoint.expected_status || 200;
    const isSuccess = response.status === expectedStatus || (response.status >= 200 && response.status < 300);

    // Check response body if pattern specified
    let bodyMatch = true;
    if (endpoint.expected_body) {
      const body = await response.text();
      const regex = new RegExp(endpoint.expected_body);
      bodyMatch = regex.test(body);
    }

    return {
      endpoint_id: endpoint.id,
      checked_at: new Date().toISOString(),
      status: isSuccess && bodyMatch ? 'success' : 'failure',
      response_time_ms: responseTime,
      http_status: response.status,
      details: {
        status_code: response.status,
        content_type: response.headers.get('content-type'),
        body_match: bodyMatch,
      },
    };
  } catch (error) {
    return {
      endpoint_id: endpoint.id,
      checked_at: new Date().toISOString(),
      status: 'failure',
      response_time_ms: Date.now() - startTime,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      details: { error: String(error) },
    };
  }
}
```

**TCP Check Implementation**:

```typescript
private async executeTcpCheck(endpoint: HealthCheckEndpoint): Promise<HealthCheckResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const [host, portStr] = endpoint.url.replace(/^tcp:\/\//, '').split(':');
    const port = parseInt(portStr, 10);

    const socket = new Socket();

    socket.setTimeout(endpoint.timeout_ms);

    socket.on('connect', () => {
      const responseTime = Date.now() - startTime;
      socket.destroy();

      resolve({
        endpoint_id: endpoint.id,
        checked_at: new Date().toISOString(),
        status: 'success',
        response_time_ms: responseTime,
        details: { host, port },
      });
    });

    socket.on('error', (error) => {
      socket.destroy();

      resolve({
        endpoint_id: endpoint.id,
        checked_at: new Date().toISOString(),
        status: 'failure',
        response_time_ms: Date.now() - startTime,
        error_message: error.message,
        details: { host, port, error: error.message },
      });
    });

    socket.on('timeout', () => {
      socket.destroy();

      resolve({
        endpoint_id: endpoint.id,
        checked_at: new Date().toISOString(),
        status: 'failure',
        response_time_ms: endpoint.timeout_ms,
        error_message: 'Connection timeout',
        details: { host, port },
      });
    });

    socket.connect(port, host);
  });
}
```

#### 2. External Monitor Integration

**Location**: `parent-harness/orchestrator/src/monitoring/integrations/`

**Uptime Robot Client**:

```typescript
// integrations/uptime-robot.ts
export class UptimeRobotClient {
  private apiKey: string;
  private baseUrl = "https://api.uptimerobot.com/v2";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createMonitor(config: {
    friendlyName: string;
    url: string;
    type: 1 | 2; // 1=HTTP, 2=Keyword
    interval: number; // seconds
  }): Promise<{ id: string; status: number }> {
    const response = await fetch(`${this.baseUrl}/newMonitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        format: "json",
        ...config,
      }),
    });

    const data = await response.json();
    if (data.stat !== "ok") {
      throw new Error(`Uptime Robot API error: ${data.error?.message}`);
    }

    return data.monitor;
  }

  async getMonitors(): Promise<
    Array<{
      id: string;
      friendly_name: string;
      url: string;
      status: number; // 0=paused, 1=not checked, 2=up, 8=seems down, 9=down
      response_time: number;
      uptime_ratio: string;
    }>
  > {
    const response = await fetch(`${this.baseUrl}/getMonitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        format: "json",
        response_times: 1,
      }),
    });

    const data = await response.json();
    return data.monitors || [];
  }

  async deleteMonitor(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/deleteMonitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        format: "json",
        id,
      }),
    });
  }
}
```

**Better Stack Client** (similar pattern):

```typescript
// integrations/better-stack.ts
export class BetterStackClient {
  private apiKey: string;
  private baseUrl = "https://uptime.betterstack.com/api/v2";

  // Similar methods: createMonitor, getMonitors, deleteMonitor
  // API docs: https://betterstack.com/docs/uptime/api/monitors/
}
```

**Datadog Client**:

```typescript
// integrations/datadog.ts
export class DatadogClient {
  private apiKey: string;
  private appKey: string;
  private baseUrl = "https://api.datadoghq.com/api/v1";

  // Methods: createSyntheticTest, getSyntheticTests, updateTest
  // API docs: https://docs.datadoghq.com/api/latest/synthetics/
}
```

#### 3. Sentry Integration

**Location**: `parent-harness/orchestrator/src/monitoring/sentry-setup.ts`

**Initialization**:

```typescript
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log("[Sentry] DSN not configured, skipping initialization");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    release: process.env.GIT_COMMIT || "unknown",

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: 0.1,

    integrations: [
      new ProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: expressApp }),
    ],

    // Ignore expected errors
    ignoreErrors: [/ECONNRESET/, /ENOTFOUND/, /Task timeout/],

    // Enrich error context
    beforeSend(event, hint) {
      // Add custom context from agent execution
      if (hint.originalException) {
        const error = hint.originalException as Error & {
          agentId?: string;
          taskId?: string;
        };
        if (error.agentId) {
          event.tags = { ...event.tags, agentId: error.agentId };
        }
        if (error.taskId) {
          event.tags = { ...event.tags, taskId: error.taskId };
        }
      }
      return event;
    },
  });

  console.log("[Sentry] Initialized with release:", process.env.GIT_COMMIT);
}

// Express middleware for request tracking
export const sentryRequestHandler = Sentry.Handlers.requestHandler();
export const sentryTracingHandler = Sentry.Handlers.tracingHandler();
export const sentryErrorHandler = Sentry.Handlers.errorHandler();
```

**Usage in Agent Code**:

```typescript
import * as Sentry from "@sentry/node";

// Enrich context during agent execution
Sentry.setContext("agent", {
  id: agent.id,
  type: agent.type,
  sessionId: session.id,
  taskId: task.id,
});

// Add breadcrumbs for phase transitions
Sentry.addBreadcrumb({
  category: "agent",
  message: `Phase started: ${phaseName}`,
  level: "info",
  data: { phase: phaseName, agentId: agent.id },
});

// Manual error capture
try {
  await agent.executeTask();
} catch (error) {
  Sentry.captureException(error, {
    tags: { agentType: agent.type },
    extra: { taskDetails: task },
  });
  throw error;
}
```

#### 4. Performance Metrics Collector

**Location**: `parent-harness/orchestrator/src/monitoring/performance-collector.ts`

**Express Middleware**:

```typescript
export function performanceTracking(db: Database) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Track response
    res.on("finish", async () => {
      const duration = Date.now() - startTime;

      await db.run(
        `INSERT INTO performance_metrics (id, metric_type, metric_key, value, recorded_at, metadata)
         VALUES (?, 'response_time', ?, ?, datetime('now'), ?)`,
        [
          uuidv4(),
          req.path,
          duration,
          JSON.stringify({
            method: req.method,
            status_code: res.statusCode,
            user_agent: req.headers["user-agent"],
          }),
        ],
      );

      // Flag slow requests
      if (duration > 2000) {
        console.warn(
          `[Performance] Slow request: ${req.method} ${req.path} (${duration}ms)`,
        );
      }
    });

    next();
  };
}
```

**Database Query Interceptor**:

```typescript
export function wrapDatabaseWithMetrics(db: Database): Database {
  const originalRun = db.run.bind(db);
  const originalGet = db.get.bind(db);
  const originalAll = db.all.bind(db);

  db.run = async function (sql: string, params?: unknown[]) {
    const start = Date.now();
    try {
      return await originalRun(sql, params);
    } finally {
      const duration = Date.now() - start;
      if (duration > 500) {
        console.warn(
          `[Database] Slow query (${duration}ms): ${sql.substring(0, 100)}`,
        );

        // Log to performance_metrics table
        await originalRun(
          `INSERT INTO performance_metrics (id, metric_type, metric_key, value, recorded_at, metadata)
           VALUES (?, 'slow_query', 'database', ?, datetime('now'), ?)`,
          [uuidv4(), duration, JSON.stringify({ sql: sql.substring(0, 200) })],
        );
      }
    }
  };

  // Similar wrapping for db.get and db.all

  return db;
}
```

#### 5. Alert Manager

**Location**: `parent-harness/orchestrator/src/monitoring/alert-manager.ts`

**Alert Routing**:

```typescript
export interface AlertRule {
  severity: "info" | "warning" | "error" | "critical";
  channels: Array<"slack" | "email" | "pagerduty" | "telegram">;
  cooldown_ms: number;
}

const ALERT_ROUTING: Record<string, AlertRule> = {
  endpoint_down: {
    severity: "critical",
    channels: ["pagerduty", "slack", "telegram"],
    cooldown_ms: 15 * 60 * 1000, // 15 minutes
  },
  slow_response: {
    severity: "warning",
    channels: ["slack"],
    cooldown_ms: 60 * 60 * 1000, // 1 hour
  },
  high_error_rate: {
    severity: "error",
    channels: ["slack", "telegram"],
    cooldown_ms: 30 * 60 * 1000, // 30 minutes
  },
};

export class AlertManager {
  private notifiers: Map<string, AlertNotifier> = new Map();
  private lastAlerts: Map<string, number> = new Map();

  constructor(private db: Database) {
    this.registerNotifiers();
  }

  private registerNotifiers(): void {
    if (process.env.SLACK_WEBHOOK_URL) {
      this.notifiers.set(
        "slack",
        new SlackNotifier(process.env.SLACK_WEBHOOK_URL),
      );
    }
    if (process.env.PAGERDUTY_INTEGRATION_KEY) {
      this.notifiers.set(
        "pagerduty",
        new PagerDutyNotifier(process.env.PAGERDUTY_INTEGRATION_KEY),
      );
    }
    if (process.env.SMTP_HOST) {
      this.notifiers.set(
        "email",
        new EmailNotifier({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587", 10),
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }),
      );
    }
    // Telegram already configured in existing system
    this.notifiers.set("telegram", new TelegramNotifier());
  }

  async sendAlert(
    alertType: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const rule = ALERT_ROUTING[alertType];
    if (!rule) {
      console.warn(`[AlertManager] Unknown alert type: ${alertType}`);
      return;
    }

    // Check cooldown
    const lastAlert = this.lastAlerts.get(alertType);
    if (lastAlert && Date.now() - lastAlert < rule.cooldown_ms) {
      console.log(`[AlertManager] Alert ${alertType} in cooldown, skipping`);
      return;
    }

    // Send to all configured channels
    const deliveries = await Promise.allSettled(
      rule.channels.map(async (channel) => {
        const notifier = this.notifiers.get(channel);
        if (!notifier) {
          console.warn(`[AlertManager] Notifier not configured: ${channel}`);
          return;
        }

        await notifier.send({
          severity: rule.severity,
          title: `[${rule.severity.toUpperCase()}] ${alertType}`,
          message,
          metadata,
        });

        // Log delivery
        await this.db.run(
          `INSERT INTO alert_deliveries (id, alert_type, channel, status, delivered_at)
           VALUES (?, ?, ?, 'success', datetime('now'))`,
          [uuidv4(), alertType, channel],
        );
      }),
    );

    // Update last alert timestamp
    this.lastAlerts.set(alertType, Date.now());

    // Log failures
    deliveries.forEach((result, idx) => {
      if (result.status === "rejected") {
        console.error(
          `[AlertManager] Failed to send to ${rule.channels[idx]}:`,
          result.reason,
        );
      }
    });
  }
}
```

**Slack Notifier**:

```typescript
class SlackNotifier implements AlertNotifier {
  constructor(private webhookUrl: string) {}

  async send(alert: Alert): Promise<void> {
    const color = {
      info: "#36a64f",
      warning: "#ff9800",
      error: "#f44336",
      critical: "#9c27b0",
    }[alert.severity];

    await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [
          {
            color,
            title: alert.title,
            text: alert.message,
            fields: Object.entries(alert.metadata || {}).map(
              ([key, value]) => ({
                title: key,
                value: String(value),
                short: true,
              }),
            ),
            footer: "Vibe Monitoring",
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      }),
    });
  }
}
```

**PagerDuty Notifier**:

```typescript
class PagerDutyNotifier implements AlertNotifier {
  constructor(private integrationKey: string) {}

  async send(alert: Alert): Promise<void> {
    const severityMap = {
      info: "info",
      warning: "warning",
      error: "error",
      critical: "critical",
    };

    await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routing_key: this.integrationKey,
        event_action: "trigger",
        dedup_key: `vibe-${alert.title}-${new Date().toISOString().split("T")[0]}`,
        payload: {
          summary: alert.title,
          severity: severityMap[alert.severity],
          source: "vibe-orchestrator",
          custom_details: alert.metadata,
        },
      }),
    });
  }
}
```

#### 6. Database Schema

**Migration**: `parent-harness/orchestrator/database/migrations/003_monitoring_system.sql`

```sql
-- Health check endpoints
CREATE TABLE IF NOT EXISTS health_check_endpoints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK(protocol IN ('http', 'https', 'tcp', 'custom')),
  method TEXT CHECK(method IN ('GET', 'POST', 'HEAD')),
  interval_ms INTEGER NOT NULL DEFAULT 60000,
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  expected_status INTEGER,
  expected_body TEXT, -- regex pattern
  headers TEXT, -- JSON
  status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('healthy', 'degraded', 'down', 'unknown')),
  last_check TEXT,
  last_response_time_ms INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_health_check_endpoints_status ON health_check_endpoints(status);
CREATE INDEX idx_health_check_endpoints_last_check ON health_check_endpoints(last_check DESC);

-- Health check results (history)
CREATE TABLE IF NOT EXISTS health_check_results (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
  response_time_ms INTEGER NOT NULL,
  http_status INTEGER,
  error_message TEXT,
  details TEXT, -- JSON

  FOREIGN KEY (endpoint_id) REFERENCES health_check_endpoints(id) ON DELETE CASCADE
);

CREATE INDEX idx_health_check_results_endpoint ON health_check_results(endpoint_id, checked_at DESC);
CREATE INDEX idx_health_check_results_checked_at ON health_check_results(checked_at DESC);

-- External monitor tracking (Uptime Robot, Better Stack, Datadog)
CREATE TABLE IF NOT EXISTS external_monitors (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('uptime_robot', 'better_stack', 'datadog')),
  monitor_id TEXT NOT NULL, -- External service's monitor ID
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('up', 'down', 'paused', 'unknown')),
  uptime_percentage REAL,
  last_sync TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(provider, monitor_id)
);

CREATE INDEX idx_external_monitors_provider ON external_monitors(provider, status);

-- Performance metrics (time-series data)
CREATE TABLE IF NOT EXISTS performance_metrics (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL CHECK(metric_type IN (
    'response_time', 'error_rate', 'slow_query', 'agent_execution_time',
    'websocket_connections', 'cpu_usage', 'memory_usage'
  )),
  metric_key TEXT, -- Endpoint path, agent type, etc.
  value REAL NOT NULL,
  recorded_at TEXT NOT NULL,
  metadata TEXT -- JSON (additional context)
);

CREATE INDEX idx_performance_metrics_type ON performance_metrics(metric_type, recorded_at DESC);
CREATE INDEX idx_performance_metrics_key ON performance_metrics(metric_key, metric_type, recorded_at DESC);

-- Alert deliveries (audit log)
CREATE TABLE IF NOT EXISTS alert_deliveries (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('slack', 'email', 'pagerduty', 'telegram')),
  status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
  error_message TEXT,
  delivered_at TEXT NOT NULL,
  metadata TEXT -- JSON
);

CREATE INDEX idx_alert_deliveries_type ON alert_deliveries(alert_type, delivered_at DESC);
CREATE INDEX idx_alert_deliveries_channel ON alert_deliveries(channel, delivered_at DESC);

-- Cleanup policy: Delete health_check_results older than 30 days
-- DELETE FROM health_check_results WHERE checked_at < datetime('now', '-30 days');
```

#### 7. API Endpoints

**Monitoring Status Endpoint**:

```typescript
// src/api/monitoring.ts
export const monitoringRouter = Router();

/**
 * GET /api/monitoring/status
 * Returns comprehensive monitoring health
 */
monitoringRouter.get("/status", async (req, res) => {
  const db = getDb();
  const healthCheckManager = getHealthCheckManager();

  // Get health check endpoint statuses
  const endpoints = await db.all<HealthCheckEndpoint>(
    `SELECT * FROM health_check_endpoints ORDER BY last_check DESC`,
  );

  // Get external monitor statuses
  const externalMonitors = await db.all<ExternalMonitor>(
    `SELECT * FROM external_monitors ORDER BY last_sync DESC`,
  );

  // Get recent errors from Sentry (if configured)
  const recentErrors = await getSentryRecentErrors(10);

  // Calculate performance metrics (last hour)
  const avgResponseTime = await db.get<{ avg: number }>(
    `SELECT AVG(value) as avg FROM performance_metrics
     WHERE metric_type = 'response_time' AND recorded_at >= datetime('now', '-1 hour')`,
  );

  const errorRate = await db.get<{ rate: number }>(
    `SELECT
       COUNT(CASE WHEN value >= 400 THEN 1 END) * 100.0 / COUNT(*) as rate
     FROM performance_metrics
     WHERE metric_type = 'response_time' AND recorded_at >= datetime('now', '-1 hour')`,
  );

  // Get active alerts
  const activeAlerts = await db.all(
    `SELECT * FROM detected_issues WHERE resolved = 0 ORDER BY detected_at DESC LIMIT 10`,
  );

  // Calculate uptime percentage
  const uptime24h = await healthCheckManager.getSystemUptime(
    24 * 60 * 60 * 1000,
  );
  const uptime7d = await healthCheckManager.getSystemUptime(
    7 * 24 * 60 * 60 * 1000,
  );

  res.json({
    success: true,
    data: {
      health_checks: endpoints.map((e) => ({
        id: e.id,
        name: e.name,
        url: e.url,
        status: e.status,
        last_check: e.last_check,
        response_time_ms: e.last_response_time_ms,
      })),
      external_monitors: externalMonitors.map((m) => ({
        provider: m.provider,
        name: m.name,
        status: m.status,
        uptime_percentage: m.uptime_percentage,
      })),
      recent_errors: recentErrors,
      performance: {
        avg_response_time_ms: avgResponseTime?.avg || 0,
        error_rate_percentage: errorRate?.rate || 0,
      },
      active_alerts: activeAlerts,
      uptime: {
        last_24h: uptime24h,
        last_7d: uptime7d,
      },
      last_updated: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/monitoring/endpoints
 * Register a new health check endpoint
 */
monitoringRouter.post("/endpoints", async (req, res) => {
  const healthCheckManager = getHealthCheckManager();

  try {
    const endpoint = await healthCheckManager.registerEndpoint(req.body);
    res.json({ success: true, data: endpoint });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Registration failed",
    });
  }
});

/**
 * DELETE /api/monitoring/endpoints/:id
 * Unregister a health check endpoint
 */
monitoringRouter.delete("/endpoints/:id", async (req, res) => {
  const healthCheckManager = getHealthCheckManager();

  await healthCheckManager.unregisterEndpoint(req.params.id);
  res.json({ success: true });
});
```

**Webhook Endpoints**:

```typescript
// src/api/webhooks.ts
export const webhooksRouter = Router();

/**
 * POST /webhooks/uptime-robot
 * Uptime Robot incident webhook
 */
webhooksRouter.post("/uptime-robot", async (req, res) => {
  // Verify webhook signature if configured
  // Process incident data
  const {
    monitorID,
    monitorURL,
    monitorFriendlyName,
    alertType,
    alertDetails,
  } = req.body;

  const alertManager = getAlertManager();

  if (alertType === "down") {
    await alertManager.sendAlert(
      "endpoint_down",
      `Monitor ${monitorFriendlyName} is DOWN: ${alertDetails}`,
      { monitorURL, monitorID },
    );
  }

  res.status(200).json({ received: true });
});

/**
 * POST /webhooks/better-stack
 * Better Stack alert webhook
 */
webhooksRouter.post("/better-stack", async (req, res) => {
  // Similar to Uptime Robot
  res.status(200).json({ received: true });
});

/**
 * POST /webhooks/datadog
 * Datadog monitor webhook
 */
webhooksRouter.post("/datadog", async (req, res) => {
  // Similar pattern
  res.status(200).json({ received: true });
});
```

#### 8. Dashboard Component

**Location**: `parent-harness/dashboard/src/components/MonitoringStatusWidget.tsx`

```tsx
import React, { useEffect, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

interface MonitoringStatus {
  health_checks: Array<{
    id: string;
    name: string;
    url: string;
    status: "healthy" | "degraded" | "down";
    last_check: string | null;
    response_time_ms: number | null;
  }>;
  external_monitors: Array<{
    provider: string;
    name: string;
    status: string;
    uptime_percentage: number;
  }>;
  recent_errors: Array<{
    id: string;
    message: string;
    count: number;
    last_seen: string;
  }>;
  performance: {
    avg_response_time_ms: number;
    error_rate_percentage: number;
  };
  uptime: {
    last_24h: number;
    last_7d: number;
  };
}

export function MonitoringStatusWidget() {
  const [status, setStatus] = useState<MonitoringStatus | null>(null);
  const { connected } = useWebSocket();

  useEffect(() => {
    // Fetch initial status
    fetch("/api/monitoring/status")
      .then((res) => res.json())
      .then((data) => setStatus(data.data));

    // Subscribe to WebSocket updates
    const ws = new WebSocket("ws://localhost:3333/ws");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "monitoring:status") {
        setStatus(data.payload);
      }
    };

    const interval = setInterval(() => {
      fetch("/api/monitoring/status")
        .then((res) => res.json())
        .then((data) => setStatus(data.data));
    }, 30000); // Refresh every 30s

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  if (!status) return <div>Loading monitoring status...</div>;

  return (
    <div className="monitoring-status-widget">
      <h2>Monitoring Overview</h2>

      {/* Uptime Card */}
      <div className="uptime-card">
        <h3>System Uptime</h3>
        <div className="uptime-stats">
          <div className="stat">
            <span className="label">Last 24h</span>
            <span className="value">{status.uptime.last_24h.toFixed(2)}%</span>
          </div>
          <div className="stat">
            <span className="label">Last 7d</span>
            <span className="value">{status.uptime.last_7d.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Health Checks Table */}
      <div className="health-checks">
        <h3>Health Check Endpoints</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>URL</th>
              <th>Status</th>
              <th>Response Time</th>
              <th>Last Check</th>
            </tr>
          </thead>
          <tbody>
            {status.health_checks.map((check) => (
              <tr key={check.id}>
                <td>{check.name}</td>
                <td>{check.url}</td>
                <td>
                  <span className={`status-badge ${check.status}`}>
                    {check.status}
                  </span>
                </td>
                <td>
                  {check.response_time_ms ? `${check.response_time_ms}ms` : "-"}
                </td>
                <td>
                  {check.last_check
                    ? new Date(check.last_check).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* External Monitors */}
      <div className="external-monitors">
        <h3>External Monitors</h3>
        <div className="monitor-grid">
          {status.external_monitors.map((monitor, idx) => (
            <div key={idx} className="monitor-card">
              <div className="provider">{monitor.provider}</div>
              <div className="name">{monitor.name}</div>
              <div className={`status ${monitor.status}`}>{monitor.status}</div>
              <div className="uptime">
                {monitor.uptime_percentage.toFixed(2)}% uptime
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-metrics">
        <h3>Performance</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="label">Avg Response Time</span>
            <span className="value">
              {status.performance.avg_response_time_ms.toFixed(0)}ms
            </span>
          </div>
          <div className="metric-card">
            <span className="label">Error Rate</span>
            <span className="value">
              {status.performance.error_rate_percentage.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      {status.recent_errors.length > 0 && (
        <div className="recent-errors">
          <h3>Recent Errors (from Sentry)</h3>
          <ul>
            {status.recent_errors.map((error) => (
              <li key={error.id}>
                <span className="message">{error.message}</span>
                <span className="count">({error.count}x)</span>
                <span className="time">
                  {new Date(error.last_seen).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## Pass Criteria

### Functional Validation

**PC-1: HealthCheckManager Class Exists**

- [ ] `HealthCheckManager` class exported from `src/monitoring/health-check-manager.ts`
- [ ] Methods: `registerEndpoint`, `unregisterEndpoint`, `executeCheck`, `executeAllChecks`, `startPeriodicChecks`, `stopPeriodicChecks`
- [ ] Event emitters: `check:success`, `check:failure`, `endpoint:down`, `endpoint:recovered`
- [ ] Database persistence in `health_check_endpoints` and `health_check_results` tables
- [ ] Status calculation: healthy (0 failures), degraded (1-2 failures), down (3+ failures)

**PC-2: HTTP and TCP Health Checks Implemented**

- [ ] HTTP/HTTPS checks support GET, POST, HEAD methods
- [ ] HTTP checks validate status codes (200-299 = success)
- [ ] HTTP checks support custom expected status codes
- [ ] HTTP checks support response body regex validation
- [ ] HTTP checks measure response time and flag slow responses (>2s)
- [ ] TCP checks open socket connections and validate successful connection
- [ ] TCP checks support custom ports and timeout handling
- [ ] Both protocols handle timeouts gracefully (no crashes)

**PC-3: Uptime Monitoring Service Integration**

- [ ] At least one provider client implemented (UptimeRobotClient or BetterStackClient)
- [ ] `createMonitor()` method creates external monitors via API
- [ ] `getMonitors()` method retrieves monitor status
- [ ] Periodic sync (every 5 minutes) updates `external_monitors` table
- [ ] Webhook endpoint receives and processes uptime service callbacks
- [ ] Dashboard displays external monitor status

**PC-4: Sentry Error Tracking Auto-Configuration**

- [ ] `@sentry/node` SDK initialized in `src/monitoring/sentry-setup.ts`
- [ ] Environment variable `SENTRY_DSN` configures Sentry project
- [ ] Global error handlers capture unhandled exceptions
- [ ] Express middleware (`sentryRequestHandler`, `sentryErrorHandler`) installed
- [ ] Errors include context: agent ID, task ID, session ID
- [ ] Release tracking configured via `GIT_COMMIT` environment variable
- [ ] Performance transactions track API endpoint duration

**PC-5: Performance Metrics Collection**

- [ ] Express middleware tracks request response times
- [ ] Response times stored in `performance_metrics` table
- [ ] Database query interceptor logs slow queries (>500ms)
- [ ] Agent execution times tracked per agent type
- [ ] Hourly/daily aggregation calculates average metrics
- [ ] Metrics queryable via `/api/monitoring/status` endpoint

**PC-6: Alert Webhook Configuration**

- [ ] `AlertManager` class with `sendAlert()` method
- [ ] Slack webhook integration via `SlackNotifier`
- [ ] Email notifications via `EmailNotifier` (SMTP)
- [ ] PagerDuty integration via `PagerDutyNotifier` (Events API v2)
- [ ] Telegram integration extends existing bot
- [ ] Alert routing based on severity (critical → PagerDuty, warning → Slack)
- [ ] Alert cooldown prevents duplicate alerts (5min-2h based on severity)
- [ ] Alert delivery logged to `alert_deliveries` table

**PC-7: Dashboard Data API for Deployment Status**

- [ ] `GET /api/monitoring/status` endpoint returns monitoring overview
- [ ] Response includes: health checks, external monitors, recent errors, performance, uptime
- [ ] WebSocket event `monitoring:status` broadcasts status updates
- [ ] `MonitoringStatusWidget` component renders monitoring overview
- [ ] Dashboard auto-refreshes every 30 seconds
- [ ] Uptime percentage calculated for 24h and 7d windows

### Non-Functional Validation

**PC-8: Reliability**

- [ ] Health check failures don't crash orchestrator (try/catch error handling)
- [ ] Retry logic with exponential backoff (3 attempts: 0s, 5s, 15s)
- [ ] Webhook endpoints respond 200 OK even if processing fails
- [ ] External API timeouts handled gracefully (max 30s timeout)
- [ ] Database write failures logged but don't block health checks

**PC-9: Performance**

- [ ] Health checks execute in parallel (Promise.all)
- [ ] Dashboard status API responds in <500ms (p95)
- [ ] Webhook processing completes in <100ms
- [ ] Monitoring overhead <2% CPU (measured via `top` during operation)
- [ ] Database queries use indexes (verify with `EXPLAIN QUERY PLAN`)

**PC-10: Security**

- [ ] API keys stored in environment variables (not hardcoded)
- [ ] Webhook endpoints validate signatures (Slack, PagerDuty, Uptime Robot)
- [ ] HTTPS-only for external API calls (no HTTP)
- [ ] Error messages sanitized before sending to external services (no secrets)
- [ ] Rate limiting on webhook endpoints (100 req/min per IP)

**PC-11: Observability**

- [ ] All health checks logged with timestamp, duration, and result
- [ ] Failed health checks logged with error details
- [ ] Alert delivery success/failure logged to `alert_deliveries` table
- [ ] Sentry integration logs errors to console (fallback if DSN not configured)
- [ ] Dashboard displays last sync time with external monitors

**PC-12: Maintainability**

- [ ] TypeScript compilation passes with no errors
- [ ] Unit tests for health check logic (HTTP/TCP executors)
- [ ] Integration tests for HealthCheckManager (mock HTTP server)
- [ ] Environment variables documented in `.env.example`
- [ ] API documentation includes webhook signature validation examples

---

## Implementation Plan

### Phase 1: Database Schema and HealthCheckManager (2-3 hours)

1. Create migration `003_monitoring_system.sql`:
   - Tables: `health_check_endpoints`, `health_check_results`, `external_monitors`, `performance_metrics`, `alert_deliveries`
   - Indexes for time-range queries

2. Implement `HealthCheckManager` class:
   - Endpoint registration and management methods
   - HTTP/HTTPS check executor with fetch API
   - TCP check executor with Node.js `net.Socket`
   - Status determination logic (healthy/degraded/down)
   - Periodic check scheduling with `setInterval`

3. Unit tests for HealthCheckManager:
   - Mock HTTP server responses (200, 500, timeout)
   - Mock TCP socket connections
   - Verify status transitions (healthy → down → recovered)

### Phase 2: External Monitor Integration (2 hours)

1. Implement provider clients:
   - `UptimeRobotClient` with createMonitor, getMonitors methods
   - `BetterStackClient` (similar API pattern)
   - `DatadogClient` for Synthetics API

2. Periodic sync service:
   - Fetch monitor status every 5 minutes
   - Update `external_monitors` table
   - Emit WebSocket events on status changes

3. Webhook receivers:
   - `/webhooks/uptime-robot` endpoint
   - Signature validation logic
   - Alert routing on incident callbacks

### Phase 3: Sentry and Performance Monitoring (1.5 hours)

1. Sentry setup:
   - Install `@sentry/node` and `@sentry/profiling-node`
   - Initialize in `src/monitoring/sentry-setup.ts`
   - Add Express middleware to server.ts
   - Enrich error context with agent/task/session IDs

2. Performance metrics:
   - Express middleware for response time tracking
   - Database query interceptor for slow query detection
   - Store metrics in `performance_metrics` table

3. Testing:
   - Verify Sentry captures test exception
   - Verify slow request logged to database

### Phase 4: Alert Manager and Multi-Channel Notifications (2 hours)

1. Implement `AlertManager` class:
   - Alert routing based on severity
   - Cooldown tracking with Map
   - Parallel notification delivery

2. Notifier implementations:
   - `SlackNotifier` (webhook POST)
   - `PagerDutyNotifier` (Events API v2)
   - `EmailNotifier` (nodemailer SMTP)
   - Extend existing `TelegramNotifier`

3. Alert delivery logging:
   - Record success/failure in `alert_deliveries` table
   - Retry failed deliveries (optional enhancement)

### Phase 5: Dashboard and API Endpoints (1.5 hours)

1. API endpoints:
   - `GET /api/monitoring/status` - comprehensive overview
   - `POST /api/monitoring/endpoints` - register health check
   - `DELETE /api/monitoring/endpoints/:id` - unregister

2. Dashboard component:
   - `MonitoringStatusWidget` with tables and cards
   - WebSocket subscription for real-time updates
   - Auto-refresh every 30 seconds

3. Webhook endpoints:
   - Routes in `src/api/webhooks.ts`
   - Signature validation middleware
   - Async processing with queue (deferred)

### Phase 6: Testing and Documentation (1 hour)

1. Integration tests:
   - Test full health check flow (register → execute → alert)
   - Test webhook processing with mock payloads
   - Test external monitor sync

2. Load testing:
   - 50 concurrent health checks → verify CPU usage <2%
   - 100 webhook requests → verify rate limiting

3. Documentation:
   - Update `.env.example` with all monitoring variables
   - Create `docs/monitoring-setup.md` with provider configuration
   - Document webhook signature validation

---

## Dependencies

### External Libraries

```json
{
  "dependencies": {
    "@sentry/node": "^7.100.0",
    "@sentry/profiling-node": "^1.3.0",
    "nodemailer": "^6.9.0"
  },
  "devDependencies": {
    "@types/nodemailer": "^6.4.0"
  }
}
```

### Internal Dependencies

- `orchestrator/src/db/index.ts` - Database connection
- `orchestrator/src/alerts/index.ts` - Existing alert rules (extend with new types)
- `server/communication/bot-registry.ts` - Telegram bot integration
- `server/websocket/index.ts` - WebSocket emission functions

### Configuration

**Environment Variables** (`.env.example`):

```bash
# Sentry Error Tracking
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7654321
GIT_COMMIT=${CI_COMMIT_SHA}  # Auto-populated in CI/CD

# Uptime Robot
UPTIME_ROBOT_API_KEY=your-api-key
UPTIME_ROBOT_ALERT_CONTACT=your-email@example.com

# Better Stack
BETTER_STACK_API_TOKEN=your-api-token
BETTER_STACK_POLICY_ID=your-policy-id

# Datadog
DATADOG_API_KEY=your-api-key
DATADOG_APP_KEY=your-app-key
DATADOG_SITE=datadoghq.com

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty
PAGERDUTY_INTEGRATION_KEY=your-integration-key

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password

# Health Check Configuration
HEALTH_CHECK_INTERVAL_MS=60000          # 1 minute
HEALTH_CHECK_TIMEOUT_MS=5000            # 5 seconds
HEALTH_CHECK_RETRY_ATTEMPTS=3
```

---

## Risk Assessment

| Risk                                            | Likelihood | Impact | Mitigation                                                      |
| ----------------------------------------------- | ---------- | ------ | --------------------------------------------------------------- |
| External service API rate limits                | Medium     | Medium | Cache results, respect rate limits, fallback to manual checks   |
| Webhook signature validation bypass             | Low        | High   | Use cryptographic signature validation, log suspicious requests |
| Alert fatigue from too many notifications       | High       | Medium | Implement cooldowns, severity-based routing, alert aggregation  |
| Sentry quota exhaustion                         | Medium     | Low    | Use sampling (10% for production), filter noisy errors          |
| Health check false positives during deployments | Medium     | Low    | Grace periods, maintenance mode flag, alert suppression         |
| External monitor misconfiguration               | Low        | Medium | Validate configuration on startup, test with dry-run mode       |

---

## Testing Strategy

### Unit Tests

**Location**: `parent-harness/orchestrator/src/monitoring/__tests__/`

- `health-check-manager.test.ts` - HTTP/TCP check execution, status transitions
- `uptime-robot-client.test.ts` - API method mocking, error handling
- `alert-manager.test.ts` - Alert routing, cooldown logic, notification delivery
- `performance-collector.test.ts` - Metrics aggregation, slow query detection

### Integration Tests

**Location**: `parent-harness/orchestrator/tests/integration/monitoring.test.ts`

```typescript
describe("Monitoring System Integration", () => {
  it("registers health check endpoint and executes check", async () => {
    const manager = new HealthCheckManager(db);
    const endpoint = await manager.registerEndpoint({
      name: "Test API",
      url: "http://localhost:3333/health",
      protocol: "http",
      interval_ms: 60000,
      timeout_ms: 5000,
    });

    const result = await manager.executeCheck(endpoint);
    expect(result.status).toBe("success");
    expect(result.response_time_ms).toBeLessThan(1000);
  });

  it("sends alert via Slack when endpoint goes down", async () => {
    // Mock fetch for Slack webhook
    const slackCalls: unknown[] = [];
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes("slack.com")) {
        slackCalls.push(options.body);
        return Promise.resolve({ ok: true });
      }
    });

    const alertManager = new AlertManager(db);
    await alertManager.sendAlert("endpoint_down", "API is down", {
      url: "http://api.example.com",
    });

    expect(slackCalls).toHaveLength(1);
    expect(JSON.parse(slackCalls[0] as string)).toMatchObject({
      attachments: [{ title: expect.stringContaining("endpoint_down") }],
    });
  });

  it("syncs external monitors from Uptime Robot", async () => {
    // Mock Uptime Robot API
    global.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          stat: "ok",
          monitors: [
            {
              id: "12345",
              friendly_name: "Test Monitor",
              url: "http://example.com",
              status: 2, // up
              uptime_ratio: "99.95",
            },
          ],
        }),
    });

    const client = new UptimeRobotClient("test-api-key");
    const monitors = await client.getMonitors();

    expect(monitors).toHaveLength(1);
    expect(monitors[0].status).toBe(2);
  });
});
```

### Manual Testing

1. **Health Check Execution**:
   - Register health check: `curl -X POST http://localhost:3333/api/monitoring/endpoints -d '{"name":"Test","url":"http://localhost:3333/health","protocol":"http"}'`
   - Verify check executes: Check logs for "Health check completed"
   - View status: `curl http://localhost:3333/api/monitoring/status`

2. **Alert Delivery**:
   - Trigger test alert: Simulate endpoint down condition
   - Verify Slack message received
   - Verify PagerDuty incident created (if configured)
   - Check `alert_deliveries` table for success records

3. **Sentry Error Capture**:
   - Trigger test error: `curl -X POST http://localhost:3333/api/test/error`
   - Check Sentry dashboard for captured exception
   - Verify error includes agent context

4. **Dashboard Monitoring Widget**:
   - Open dashboard: http://localhost:3334
   - Verify monitoring status widget renders
   - Verify health checks table shows endpoint statuses
   - Verify auto-refresh updates every 30s

---

## Future Enhancements (Out of Scope)

1. **Prometheus Metrics Export**: Expose `/metrics` endpoint for Prometheus scraping
2. **Custom Health Check Scripts**: Support arbitrary shell commands as health checks
3. **Anomaly Detection**: ML-based detection of unusual patterns (traffic spikes, error bursts)
4. **Alert Escalation Policies**: Multi-tier escalation (email → Slack → PagerDuty)
5. **Runbook Integration**: Link alerts to runbook documentation (PagerDuty runbook URLs)
6. **Status Page Generation**: Public status page showing uptime and incident history
7. **Multi-Region Monitoring**: Health checks from multiple geographic locations

---

## Acceptance Criteria Summary

This task is complete when:

1. ✅ HealthCheckManager class exists with HTTP/TCP check support
2. ✅ At least one external monitor integration (Uptime Robot or Better Stack)
3. ✅ Sentry SDK configured and capturing errors with context
4. ✅ Performance metrics collected (response times, slow queries)
5. ✅ Alert webhooks configured for Slack and PagerDuty
6. ✅ Dashboard API endpoint `/api/monitoring/status` returns comprehensive data
7. ✅ MonitoringStatusWidget renders in dashboard
8. ✅ All tests pass (unit + integration)
9. ✅ TypeScript compiles cleanly
10. ✅ Documentation complete (setup guide, webhook configuration, `.env.example`)

**Definition of Done**: Production orchestrator has external monitoring via third-party services (Uptime Robot, Sentry), multi-channel alerting (Slack, PagerDuty, Email), performance metrics collection, and a monitoring status dashboard widget showing real-time health.
