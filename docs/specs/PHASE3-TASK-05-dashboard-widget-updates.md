# PHASE3-TASK-05: Dashboard Widget Updates (Agent Status, Task Progress, Error States)

**Status:** Specification
**Priority:** P0 (Critical Path - Phase 3)
**Effort:** Medium
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Enhance Parent Harness dashboard widgets with real-time agent status visualization, task progress tracking, and comprehensive error state display to enable effective monitoring, debugging, and intervention during autonomous agent execution.

**Problem:** While the dashboard foundation exists (React components, WebSocket hooks, API clients), current widgets display only basic static information. They lack real-time health indicators, detailed progress visualization, error context, and actionable interventions. Users cannot distinguish between healthy agents making progress versus stuck agents, cannot see task completion estimates, and have limited visibility into error root causes.

**Solution:** Extend existing dashboard components (AgentStatusCard, TaskCard, EventStream, HealthIndicator) with real-time WebSocket updates, progress bars, health status badges, error details panels, and interactive controls. Add new specialized widgets for session monitoring, error aggregation, and system-wide health metrics.

---

## Current State Analysis

### Existing Dashboard Infrastructure ✅

1. **Dashboard Components** (`parent-harness/dashboard/src/components/`)
   - ✅ `AgentStatusCard.tsx` - Basic agent display with status badge, heartbeat
   - ✅ `TaskCard.tsx` - Task display with priority, status, action buttons
   - ✅ `EventStream.tsx` - Event log with filtering and search
   - ✅ `HealthIndicator.tsx` - Server health check with status dot
   - ✅ `WaveProgressBar.tsx` - Wave progress visualization
   - ❌ **Gap:** No detailed error display within cards
   - ❌ **Gap:** No progress bars for in-progress tasks
   - ❌ **Gap:** No session health status per agent

2. **WebSocket Integration** (`parent-harness/dashboard/src/hooks/useWebSocket.ts`)
   - ✅ Connection management with auto-reconnect
   - ✅ Message subscription system
   - ✅ Event broadcasting from orchestrator
   - ✅ Types: agent:*, task:*, session:*, event
   - ❌ **Gap:** Widgets not subscribed to real-time updates
   - ❌ **Gap:** No WebSocket connection status in UI

3. **API Client** (`parent-harness/dashboard/src/api/client.ts`)
   - ✅ HTTP client for REST endpoints
   - ✅ Hooks: useAgents, useTasks, useEvents, useSessions
   - ✅ Auto-refetch on interval
   - ❌ **Gap:** No session health API integration
   - ❌ **Gap:** No error aggregation endpoint

4. **Type Definitions** (`parent-harness/dashboard/src/api/types.ts`)
   - ✅ Agent, Task, AgentSession, ObservabilityEvent types
   - ❌ **Gap:** Missing SessionHealth type
   - ❌ **Gap:** Missing progress_percent, health_status fields
   - ❌ **Gap:** Missing error details structure

5. **WebSocket Server** (`parent-harness/orchestrator/src/websocket.ts`)
   - ✅ Broadcasts: agent:status, task:*, session:started/updated/ended
   - ✅ Event bus integration
   - ❌ **Gap:** No session:heartbeat event (from PHASE3-TASK-03)
   - ❌ **Gap:** No session:unhealthy event
   - ❌ **Gap:** No agent:error with error details

### Gaps Identified

1. **Real-time Updates Missing** - Components refetch on interval instead of WebSocket updates
2. **Progress Visualization Missing** - No progress bars, completion estimates, or iteration counts
3. **Health Status Missing** - No visual health indicators (healthy, stale, stuck, crashed)
4. **Error Context Missing** - Errors shown as text, no stack traces, suggestions, or history
5. **Intervention Actions Missing** - Limited controls for stuck agents, failed tasks
6. **Session Metrics Missing** - No duration, token usage, resource consumption
7. **WebSocket Status Missing** - Users can't see if dashboard is connected to backend

---

## Requirements

### Functional Requirements

**FR-1: Real-Time Agent Status Updates**
- MUST subscribe to `agent:status` WebSocket events
- MUST update AgentStatusCard in real-time (<1s latency)
- MUST display health status badge (healthy, stale, stuck, crashed)
- MUST show running instance count (e.g., "3 sessions active")
- MUST display last heartbeat timestamp with relative time
- MUST highlight agents with errors (red border, pulsing animation)
- SHOULD show agent resource usage (CPU%, memory) if available
- SHOULD display current iteration/step for working agents

**FR-2: Task Progress Visualization**
- MUST show progress bar for in_progress tasks (0-100%)
- MUST display estimated completion time based on iteration rate
- MUST show current/total iterations if available
- MUST update progress in real-time via `task:updated` events
- MUST display time elapsed since task started
- SHOULD show token usage and cost for running tasks
- SHOULD display files modified count

**FR-3: Comprehensive Error State Display**
- MUST show error indicator on agent cards (red badge with count)
- MUST display recent error message in TaskCard
- MUST show error severity (warning, error, critical)
- MUST provide expandable error details panel with:
  - Full error message
  - Stack trace (if available)
  - Error timestamp
  - Suggested recovery actions
  - Link to session logs
- MUST highlight failed tasks with red border
- SHOULD group similar errors
- SHOULD show error rate trend (increasing, stable, decreasing)

**FR-4: Session Health Monitoring**
- MUST display session health status per agent (API from PHASE3-TASK-03)
- MUST subscribe to `session:heartbeat` WebSocket events
- MUST show session duration with real-time counter
- MUST display health badges: 🟢 Healthy, 🟡 Stale, 🟠 Stuck, 🔴 Crashed
- MUST show time since last heartbeat
- MUST alert when session becomes unhealthy (browser notification)
- SHOULD show session resource usage over time (sparkline chart)

**FR-5: Interactive Controls**
- MUST provide "Retry" button for failed tasks
- MUST provide "Terminate" button for stuck sessions
- MUST provide "View Logs" button for all active sessions
- MUST provide "Restart Agent" action for crashed agents
- MUST confirm destructive actions (terminate, restart)
- SHOULD provide "Pause/Resume" controls for running tasks
- SHOULD provide "Force Complete" option with reason input

**FR-6: WebSocket Connection Status**
- MUST display WebSocket connection indicator in header
- MUST show connection state: Connected, Disconnecting, Reconnecting, Disconnected
- MUST show connection latency (ping response time)
- MUST auto-reconnect on disconnect with retry count
- MUST warn when disconnected (yellow banner)
- SHOULD show last successful message timestamp

**FR-7: Error Aggregation Widget**
- MUST display top 5 errors across all agents
- MUST show error frequency (count in last hour)
- MUST group errors by type/pattern
- MUST link to affected tasks/sessions
- MUST highlight new errors (unseen since last visit)
- SHOULD show error resolution rate

### Non-Functional Requirements

**NFR-1: Performance**
- Dashboard MUST remain responsive with 100+ events per minute
- Widget updates MUST complete in <100ms (no UI blocking)
- WebSocket message processing MUST NOT block React render
- Progress bar animations MUST be smooth (60fps)
- MUST use React.memo for expensive components

**NFR-2: Usability**
- Widgets MUST use consistent color scheme (healthy=green, error=red, warning=yellow)
- Progress bars MUST show percentage text overlay
- Health badges MUST include tooltip explanations
- Error messages MUST be readable (max 2 lines, expandable)
- MUST support keyboard navigation for controls

**NFR-3: Accessibility**
- MUST use semantic HTML for screen readers
- MUST provide ARIA labels for status indicators
- MUST use sufficient color contrast (WCAG AA)
- MUST support high-contrast mode
- SHOULD announce critical errors via screen reader

**NFR-4: Reliability**
- Dashboard MUST handle WebSocket disconnection gracefully
- Widgets MUST degrade to polling if WebSocket unavailable
- MUST persist filter/sort preferences to localStorage
- MUST recover state on browser refresh
- MUST handle missing data fields without errors

---

## Technical Design

### Type Extensions

**Extend existing types** (`parent-harness/dashboard/src/api/types.ts`):

```typescript
// Extend Agent type
export interface Agent {
  // ... existing fields ...
  health_status?: 'healthy' | 'stale' | 'stuck' | 'crashed';
  running_instances?: number; // Count of active sessions
  current_iteration?: number;
  current_step?: string;
  error_count?: number; // Errors in last hour
  memory_mb?: number;
  cpu_percent?: number;
}

// Extend Task type
export interface Task {
  // ... existing fields ...
  progress_percent?: number; // 0-100
  iteration_count?: number;
  total_iterations?: number;
  estimated_completion?: string; // ISO timestamp
  token_usage?: { input: number; output: number };
  files_modified?: number;
  last_error?: string;
  error_details?: {
    message: string;
    stack?: string;
    timestamp: string;
    severity: 'warning' | 'error' | 'critical';
    suggestions?: string[];
  };
}

// Extend AgentSession type
export interface AgentSession {
  // ... existing fields ...
  progress_percent?: number;
  health_status?: 'healthy' | 'stale' | 'stuck' | 'crashed';
  current_iteration?: number;
  iteration_rate?: number; // iterations per minute
  last_activity?: string;
  time_since_heartbeat?: number; // milliseconds
}

// New: Aggregated error data
export interface ErrorSummary {
  error_pattern: string;
  count: number;
  severity: 'warning' | 'error' | 'critical';
  affected_agents: string[];
  affected_tasks: string[];
  first_seen: string;
  last_seen: string;
  sample_message: string;
}

// New: WebSocket connection state
export interface WsConnectionState {
  status: 'connected' | 'connecting' | 'reconnecting' | 'disconnected';
  latency: number | null; // milliseconds
  reconnectAttempts: number;
  lastMessage: string | null;
}
```

### Component Enhancements

#### 1. AgentStatusCard Enhancements

**File:** `parent-harness/dashboard/src/components/AgentStatusCard.tsx`

```typescript
interface AgentStatusCardProps {
  // ... existing props ...
  healthStatus?: 'healthy' | 'stale' | 'stuck' | 'crashed';
  currentIteration?: number;
  currentStep?: string;
  errorCount?: number;
  memoryMb?: number;
  cpuPercent?: number;
  onRestart?: () => void;
  onViewSessions?: () => void;
}

export function AgentStatusCard({ ... }: AgentStatusCardProps) {
  return (
    <div className={`bg-gray-700 rounded-lg p-3 mb-3 ${
      errorCount && errorCount > 0 ? 'border-2 border-red-500 animate-pulse-border' : ''
    }`}>
      {/* Header with name + health badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{name}</span>

          {/* Health status badge */}
          {healthStatus && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${healthStatusColors[healthStatus]}`}
              title={healthStatusTooltips[healthStatus]}
            >
              {healthStatusIcons[healthStatus]} {healthStatus}
            </span>
          )}

          {/* Running instance count */}
          {runningInstances > 0 && (
            <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {runningInstances}
            </span>
          )}

          {/* Error count badge */}
          {errorCount && errorCount > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              ⚠ {errorCount}
            </span>
          )}
        </div>

        {/* Status badge (existing) */}
        <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>

      {/* Current task + progress */}
      {currentTask && (
        <div className="text-xs mb-2">
          <div className="text-gray-400">{currentTask}</div>
          {currentStep && (
            <div className="text-gray-500 italic mt-0.5">→ {currentStep}</div>
          )}
          {currentIteration !== undefined && (
            <div className="text-gray-500 mt-0.5">
              Iteration: {currentIteration}
            </div>
          )}
        </div>
      )}

      {/* Resource usage */}
      {(memoryMb || cpuPercent) && (
        <div className="flex gap-3 text-xs text-gray-500 mb-2">
          {memoryMb && <span>💾 {memoryMb}MB</span>}
          {cpuPercent && <span>⚙️ {cpuPercent.toFixed(1)}%</span>}
        </div>
      )}

      {/* Footer: heartbeat + actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {lastHeartbeat ? `Last seen: ${lastHeartbeat}` : 'No heartbeat'}
        </div>

        <div className="flex gap-1">
          {onViewSessions && (
            <button
              onClick={onViewSessions}
              className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded"
              title="View active sessions"
            >
              📊 Sessions
            </button>
          )}
          {status === 'error' && onRestart && (
            <button
              onClick={onRestart}
              className="text-xs px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded"
              title="Restart agent"
            >
              🔄 Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const healthStatusColors = {
  healthy: 'bg-green-600 text-white',
  stale: 'bg-yellow-500 text-black',
  stuck: 'bg-orange-500 text-white',
  crashed: 'bg-red-600 text-white',
};

const healthStatusIcons = {
  healthy: '🟢',
  stale: '🟡',
  stuck: '🟠',
  crashed: '🔴',
};

const healthStatusTooltips = {
  healthy: 'Agent responding normally, making progress',
  stale: 'No heartbeat for >1 minute, may be busy',
  stuck: 'No progress for >15 minutes, likely stuck',
  crashed: 'Process appears dead, needs restart',
};
```

#### 2. TaskCard Enhancements

**File:** `parent-harness/dashboard/src/components/TaskCard.tsx`

```typescript
interface TaskCardProps {
  // ... existing props ...
  progressPercent?: number;
  iterationCount?: number;
  totalIterations?: number;
  estimatedCompletion?: string;
  tokenUsage?: { input: number; output: number };
  lastError?: string;
  errorDetails?: TaskErrorDetails;
  onViewError?: () => void;
}

export function TaskCard({ ... }: TaskCardProps) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  return (
    <>
      <div className={`bg-gray-700 rounded-lg p-3 mb-3 ${
        status === 'failed' ? 'border-2 border-red-500' : ''
      }`}>
        {/* Header (existing: priority, displayId, status) */}

        {/* Title */}
        <h3 className="text-sm font-medium text-white mb-2">{title}</h3>

        {/* Progress bar for in-progress tasks */}
        {status === 'in_progress' && progressPercent !== undefined && (
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Iteration count */}
        {iterationCount !== undefined && (
          <div className="text-xs text-gray-400 mb-1">
            Iteration: {iterationCount}
            {totalIterations && ` / ${totalIterations}`}
          </div>
        )}

        {/* Estimated completion */}
        {estimatedCompletion && (
          <div className="text-xs text-gray-400 mb-1">
            ETA: {formatRelativeTime(estimatedCompletion)}
          </div>
        )}

        {/* Token usage */}
        {tokenUsage && (
          <div className="text-xs text-gray-500 mb-1">
            🪙 Tokens: {(tokenUsage.input + tokenUsage.output).toLocaleString()}
          </div>
        )}

        {/* Error display */}
        {lastError && (
          <div className="mb-2 p-2 bg-red-900/30 border border-red-500 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-red-400">ERROR</span>
              {errorDetails && (
                <button
                  onClick={() => setShowErrorDetails(true)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Details →
                </button>
              )}
            </div>
            <div className="text-xs text-red-300 line-clamp-2">
              {lastError}
            </div>
          </div>
        )}

        {/* Footer: category, agent, actions (existing) */}
      </div>

      {/* Error Details Modal */}
      {showErrorDetails && errorDetails && (
        <ErrorDetailsModal
          error={errorDetails}
          taskId={id}
          onClose={() => setShowErrorDetails(false)}
        />
      )}
    </>
  );
}
```

#### 3. New Widget: ErrorDetailsModal

**File:** `parent-harness/dashboard/src/components/ErrorDetailsModal.tsx`

```typescript
interface ErrorDetailsModalProps {
  error: {
    message: string;
    stack?: string;
    timestamp: string;
    severity: 'warning' | 'error' | 'critical';
    suggestions?: string[];
  };
  taskId: string;
  onClose: () => void;
}

export function ErrorDetailsModal({ error, taskId, onClose }: ErrorDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Error Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Severity badge */}
        <div className={`inline-block px-3 py-1 rounded mb-4 ${severityColors[error.severity]}`}>
          {severityIcons[error.severity]} {error.severity.toUpperCase()}
        </div>

        {/* Error message */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-300 mb-2">Message</h3>
          <pre className="bg-gray-900 p-3 rounded text-xs text-red-300 overflow-x-auto">
            {error.message}
          </pre>
        </div>

        {/* Stack trace */}
        {error.stack && (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-300 mb-2">Stack Trace</h3>
            <pre className="bg-gray-900 p-3 rounded text-xs text-gray-400 overflow-x-auto max-h-64">
              {error.stack}
            </pre>
          </div>
        )}

        {/* Suggestions */}
        {error.suggestions && error.suggestions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-300 mb-2">💡 Suggested Actions</h3>
            <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
              {error.suggestions.map((suggestion, i) => (
                <li key={i}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Timestamp */}
        <div className="text-xs text-gray-500">
          Occurred at: {new Date(error.timestamp).toLocaleString()}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => window.open(`/sessions?task=${taskId}`, '_blank')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm"
          >
            📋 View Session Logs
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const severityColors = {
  warning: 'bg-yellow-600 text-black',
  error: 'bg-red-600 text-white',
  critical: 'bg-red-700 text-white',
};

const severityIcons = {
  warning: '⚠️',
  error: '❌',
  critical: '🔥',
};
```

#### 4. New Widget: ErrorAggregationPanel

**File:** `parent-harness/dashboard/src/components/ErrorAggregationPanel.tsx`

```typescript
interface ErrorAggregationPanelProps {
  errors: ErrorSummary[];
}

export function ErrorAggregationPanel({ errors }: ErrorAggregationPanelProps) {
  const topErrors = errors.slice(0, 5);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold text-white mb-3">🔍 Top Errors (Last Hour)</h3>

      {topErrors.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          ✅ No errors detected
        </div>
      ) : (
        <div className="space-y-2">
          {topErrors.map((error, i) => (
            <div
              key={i}
              className="bg-gray-700 p-3 rounded border-l-4"
              style={{ borderColor: severityColorMap[error.severity] }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${severityTextColor[error.severity]}`}>
                  {error.error_pattern}
                </span>
                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                  {error.count}
                </span>
              </div>

              <div className="text-xs text-gray-400 mb-2 line-clamp-1">
                {error.sample_message}
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>👥 {error.affected_agents.length} agents</span>
                <span>📋 {error.affected_tasks.length} tasks</span>
                <span>🕒 Last: {formatRelativeTime(error.last_seen)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const severityColorMap = {
  warning: '#EAB308',
  error: '#EF4444',
  critical: '#991B1B',
};

const severityTextColor = {
  warning: 'text-yellow-400',
  error: 'text-red-400',
  critical: 'text-red-600',
};
```

#### 5. WebSocket Connection Indicator

**File:** `parent-harness/dashboard/src/components/WebSocketStatus.tsx`

```typescript
import { useWebSocket } from '../hooks/useWebSocket';

export function WebSocketStatus() {
  const { connected, lastMessage } = useWebSocket();
  const [latency, setLatency] = useState<number | null>(null);

  // Measure latency via ping/pong
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      const start = Date.now();
      ws.send('ping', {});

      // Listen for pong response
      const unsubscribe = subscribe((msg) => {
        if (msg.type === 'pong') {
          setLatency(Date.now() - start);
          unsubscribe();
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [connected]);

  const statusColor = connected ? 'bg-green-500' : 'bg-red-500';
  const statusText = connected ? 'Connected' : 'Disconnected';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${statusColor} ${!connected && 'animate-pulse'}`} />
      <span className="text-gray-400">{statusText}</span>
      {connected && latency && (
        <span className="text-gray-500">({latency}ms)</span>
      )}
    </div>
  );
}
```

### WebSocket Subscription Integration

**Update hooks to subscribe to WebSocket events:**

```typescript
// In parent-harness/dashboard/src/hooks/useAgents.ts
export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const { subscribe } = useWebSocket();

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type === 'agent:status') {
        const updatedAgent = message.payload as Agent;
        setAgents(prev =>
          prev.map(a => a.id === updatedAgent.id ? updatedAgent : a)
        );
      }
    });
    return unsubscribe;
  }, [subscribe]);

  // ... existing fetch logic ...
}

// Similar for useTasks.ts
export function useTasks() {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type === 'task:updated' || message.type === 'task:assigned') {
        const updatedTask = message.payload as Task;
        setTasks(prev =>
          prev.map(t => t.id === updatedTask.id ? updatedTask : t)
        );
      }
    });
    return unsubscribe;
  }, [subscribe]);

  // ... existing logic ...
}
```

### Backend API Enhancements

**New endpoint:** GET `/api/errors/summary`

```typescript
// parent-harness/orchestrator/src/api/errors.ts
import { Router } from 'express';
import { query } from '../db/index.js';

export const errorsRouter = Router();

/**
 * GET /api/errors/summary
 * Get aggregated error statistics
 */
errorsRouter.get('/summary', (req, res) => {
  const since = req.query.since || new Date(Date.now() - 3600000).toISOString(); // 1 hour

  const errors = query<any>(`
    SELECT
      SUBSTR(message, 1, 50) as error_pattern,
      COUNT(*) as count,
      severity,
      GROUP_CONCAT(DISTINCT agent_id) as affected_agents,
      GROUP_CONCAT(DISTINCT task_id) as affected_tasks,
      MIN(created_at) as first_seen,
      MAX(created_at) as last_seen,
      message as sample_message
    FROM observability_events
    WHERE severity IN ('error', 'critical', 'warning')
      AND created_at >= ?
    GROUP BY error_pattern, severity
    ORDER BY count DESC, last_seen DESC
    LIMIT 10
  `, [since]);

  const formatted = errors.map(e => ({
    error_pattern: e.error_pattern,
    count: e.count,
    severity: e.severity,
    affected_agents: e.affected_agents ? e.affected_agents.split(',') : [],
    affected_tasks: e.affected_tasks ? e.affected_tasks.split(',') : [],
    first_seen: e.first_seen,
    last_seen: e.last_seen,
    sample_message: e.sample_message,
  }));

  res.json(formatted);
});
```

**Extend WebSocket events:**

```typescript
// In parent-harness/orchestrator/src/websocket.ts
export const ws = {
  // ... existing events ...

  // Enhanced agent status with health
  agentStatusChanged: (agent: Agent & { health_status?: string; error_count?: number }) =>
    broadcast('agent:status', agent),

  // Enhanced task updates with progress
  taskProgressUpdated: (task: Task & { progress_percent: number; iteration_count: number }) =>
    broadcast('task:updated', task),

  // Session health events (from PHASE3-TASK-03)
  sessionHeartbeat: (data: { sessionId: string; progressPercent: number }) =>
    broadcast('session:heartbeat', data),

  sessionUnhealthy: (health: SessionHealth) =>
    broadcast('session:unhealthy', health),
};
```

---

## Pass Criteria

### Implementation Completeness

1. ✅ **AgentStatusCard enhanced** - Health badge, error count, resource usage, actions
2. ✅ **TaskCard enhanced** - Progress bar, iteration count, ETA, error display
3. ✅ **ErrorDetailsModal created** - Full error view with stack, suggestions
4. ✅ **ErrorAggregationPanel created** - Top errors summary widget
5. ✅ **WebSocketStatus created** - Connection indicator with latency
6. ✅ **Type definitions extended** - All new fields added to types.ts
7. ✅ **WebSocket subscriptions** - useAgents, useTasks subscribe to real-time updates
8. ✅ **API endpoint** - GET /api/errors/summary implemented

### Functional Validation

9. ✅ **Real-time agent updates** - Agent card updates <1s after status change
10. ✅ **Real-time task updates** - Task progress bar updates live
11. ✅ **Health status display** - All 4 health states render correctly
12. ✅ **Error visualization** - Error badge, border, details modal work
13. ✅ **Progress tracking** - Progress bar shows 0-100%, updates smoothly
14. ✅ **Session metrics** - Duration, iteration count display correctly
15. ✅ **Interactive controls** - Retry, terminate, restart buttons functional
16. ✅ **Error aggregation** - Top errors panel shows accurate data
17. ✅ **WebSocket indicator** - Connection status updates correctly

### Testing

18. ✅ **Unit tests** - All new components tested in isolation
19. ✅ **Integration test** - Spawn agent → verify dashboard updates in real-time
20. ✅ **Error display test** - Trigger error → verify it appears in dashboard
21. ✅ **WebSocket test** - Disconnect WebSocket → verify indicator shows disconnected
22. ✅ **Progress test** - Start task → verify progress bar animates correctly

### Performance

23. ✅ **No UI blocking** - Dashboard remains responsive with 100+ events/min
24. ✅ **Smooth animations** - Progress bars animate at 60fps
25. ✅ **React.memo optimization** - Expensive components memoized
26. ✅ **WebSocket latency** - Updates appear within 1 second

### Usability

27. ✅ **Color consistency** - Green=healthy, red=error, yellow=warning throughout
28. ✅ **Tooltips** - All badges have explanatory tooltips
29. ✅ **Responsive** - Widgets work on desktop and tablet
30. ✅ **Keyboard navigation** - Buttons accessible via keyboard

---

## Dependencies

**Upstream (Must Complete First):**
- ✅ PHASE3-TASK-03: Agent session tracking (provides health_status, progress_percent)
- ✅ PHASE2-TASK-01: Frontend foundation (React components, WebSocket hook)
- ✅ WebSocket server infrastructure (COMPLETED)

**Downstream (Depends on This):**
- PHASE4-TASK-01: Advanced analytics dashboard (uses enhanced widgets)
- PHASE6-TASK-02: Automated intervention system (uses health indicators)

**Parallel Work (Can Develop Concurrently):**
- PHASE3-TASK-04: Dashboard routing and navigation
- PHASE4-TASK-03: Telegram integration UI

---

## Implementation Plan

### Phase 1: Type Extensions & API (2 hours)
1. Extend Agent, Task, AgentSession types in types.ts
2. Add ErrorSummary, WsConnectionState types
3. Implement GET /api/errors/summary endpoint
4. Add error aggregation query
5. Test API endpoint with curl

### Phase 2: AgentStatusCard Enhancements (2 hours)
6. Add health status badge logic
7. Add error count indicator with animation
8. Add resource usage display (CPU, memory)
9. Add restart/view sessions buttons
10. Test with mock data

### Phase 3: TaskCard Enhancements (2.5 hours)
11. Add progress bar component
12. Add iteration count display
13. Add estimated completion time
14. Add error display with red border
15. Create ErrorDetailsModal component
16. Test progress bar animations

### Phase 4: New Widgets (2 hours)
17. Create ErrorAggregationPanel component
18. Create WebSocketStatus indicator
19. Integrate into Dashboard layout
20. Test error aggregation with real data

### Phase 5: WebSocket Integration (2 hours)
21. Update useAgents to subscribe to agent:status
22. Update useTasks to subscribe to task:updated
23. Add session:heartbeat subscription
24. Test real-time updates end-to-end
25. Verify no memory leaks on subscribe/unsubscribe

### Phase 6: Polish & Testing (1.5 hours)
26. Add React.memo to expensive components
27. Implement keyboard navigation
28. Add ARIA labels for accessibility
29. Write unit tests for new components
30. Write integration tests for WebSocket flow

**Total Estimated Effort:** 12 hours

---

## Testing Strategy

### Unit Tests

```typescript
// components/AgentStatusCard.test.tsx
describe('AgentStatusCard', () => {
  test('displays health status badge', () => {
    render(<AgentStatusCard healthStatus="stuck" ... />);
    expect(screen.getByText('🟠 stuck')).toBeInTheDocument();
  });

  test('shows error count with animation', () => {
    render(<AgentStatusCard errorCount={3} ... />);
    const badge = screen.getByText('⚠ 3');
    expect(badge).toHaveClass('animate-pulse');
  });

  test('renders restart button for error status', () => {
    const onRestart = jest.fn();
    render(<AgentStatusCard status="error" onRestart={onRestart} ... />);
    const btn = screen.getByTitle('Restart agent');
    fireEvent.click(btn);
    expect(onRestart).toHaveBeenCalled();
  });
});

// components/TaskCard.test.tsx
describe('TaskCard', () => {
  test('shows progress bar for in-progress tasks', () => {
    render(<TaskCard status="in_progress" progressPercent={65} ... />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveStyle({ width: '65%' });
  });

  test('displays error with red border', () => {
    render(<TaskCard status="failed" lastError="Connection timeout" ... />);
    const card = screen.getByTestId('task-card');
    expect(card).toHaveClass('border-red-500');
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// integration/dashboard-realtime.test.tsx
describe('Dashboard Real-Time Updates', () => {
  test('agent status updates when WebSocket event received', async () => {
    render(<Dashboard />);

    // Wait for initial load
    await waitFor(() => expect(screen.getByText('Build Agent')).toBeInTheDocument());

    // Simulate WebSocket message
    act(() => {
      mockWs.emit('agent:status', {
        id: 'build_agent',
        status: 'error',
        error_count: 2,
      });
    });

    // Verify UI updated
    await waitFor(() => {
      expect(screen.getByText('⚠ 2')).toBeInTheDocument();
    });
  });

  test('task progress bar updates on session:heartbeat', async () => {
    render(<Dashboard />);

    // Simulate progress update
    act(() => {
      mockWs.emit('task:updated', {
        id: 'task-123',
        progress_percent: 75,
      });
    });

    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '75%' });
    });
  });
});
```

### Manual Testing

1. **Agent Status Updates:**
   - Start orchestrator + dashboard
   - Spawn agent: `curl -X POST http://localhost:3333/api/spawn ...`
   - Verify agent card shows "working" status
   - Wait 15+ minutes without heartbeat
   - Verify health badge changes to "stuck"

2. **Task Progress:**
   - Assign task to agent
   - Monitor task card progress bar
   - Verify it updates in real-time
   - Verify ETA calculation is reasonable

3. **Error Display:**
   - Trigger agent error (e.g., invalid file path)
   - Verify error count badge appears
   - Click error details
   - Verify modal shows full stack trace
   - Verify suggestions displayed

4. **WebSocket Reconnection:**
   - Start dashboard with server running
   - Verify indicator shows "Connected"
   - Stop orchestrator
   - Verify indicator shows "Disconnected" + red
   - Restart orchestrator
   - Verify auto-reconnect within 3 seconds

---

## Rollback Plan

If implementation causes instability:

1. **Disable real-time updates:**
   - Add feature flag: `VITE_ENABLE_REALTIME=false`
   - Components fall back to polling
   - WebSocket subscription skipped

2. **Revert component changes:**
   - Keep old AgentStatusCard, TaskCard versions in .bak files
   - Restore if new versions have bugs
   - Dashboard remains functional with reduced features

3. **Remove new widgets:**
   - Remove ErrorAggregationPanel, ErrorDetailsModal imports
   - Dashboard works without error aggregation

---

## Success Metrics

**Operational:**
- WebSocket message latency: <100ms (p95)
- UI update latency: <500ms from event to display
- Dashboard CPU usage: <10% on idle
- No memory leaks after 1 hour

**Usability:**
- Users can identify stuck agents within 5 seconds
- Error root cause visible in <3 clicks
- Progress estimate accuracy: ±20%
- 90%+ of users understand health badges without docs

**Reliability:**
- Dashboard recovers from WebSocket disconnect: 100%
- No component crashes with missing data
- Works with 50+ concurrent sessions

---

## Future Enhancements (Out of Scope)

1. **Advanced visualizations** - Sparkline charts for resource usage trends
2. **Custom dashboards** - User-configurable widget layouts
3. **Historical comparison** - Compare current vs. past performance
4. **Predictive alerts** - ML-based stuck agent prediction
5. **Mobile app** - Native iOS/Android dashboard
6. **Voice alerts** - Text-to-speech for critical errors

---

## References

- STRATEGIC_PLAN.md: Phase 3 dashboard requirements
- PHASE3-TASK-03: Agent session tracking spec (provides health data)
- `parent-harness/dashboard/src/components/`: Existing widget implementations
- `parent-harness/orchestrator/src/websocket.ts`: WebSocket event types
- Design patterns: Real-time dashboards, error aggregation, progress visualization
