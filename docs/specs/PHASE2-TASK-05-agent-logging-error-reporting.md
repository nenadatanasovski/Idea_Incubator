# PHASE2-TASK-05: Agent Logging and Error Reporting to Parent Harness

**Status:** 📝 SPECIFICATION
**Created:** 2026-02-08
**Priority:** P0 (Critical Path - Phase 2)
**Effort:** Medium (6-8 hours)
**Model:** Sonnet/Opus
**Agent Type:** build_agent

---

## Overview

Implement comprehensive logging and error reporting infrastructure for all specialized agents (Build, QA, Spec, Research, etc.) to communicate status, progress, and errors to the Parent Harness orchestrator. This enables real-time observability, debugging, failure analysis, and autonomous recovery in the multi-agent execution pipeline.

### Problem Statement

**Current State:**
- Agents log to console only (stdout/stderr)
- No centralized error tracking across agents
- Parent Harness cannot monitor agent health or progress
- Failed tasks lack detailed error context for recovery
- No real-time visibility into agent execution state
- Dashboard cannot display live agent activity

**Desired State:**
- Agents emit structured events to Parent Harness via WebSocket
- Centralized event database tracks all agent activity
- Parent Harness monitors agent health and execution state
- Failed tasks include detailed error context for retry/recovery
- Real-time dashboard visibility into agent execution
- Observability supports debugging and autonomous recovery

### Value Proposition

1. **Enables Autonomous Recovery** - Detailed error context allows intelligent retry logic
2. **Improves Debugging** - Centralized logs show cross-agent interaction patterns
3. **Real-time Visibility** - Dashboard displays live agent execution state
4. **Supports Analytics** - Historical event data enables performance analysis
5. **Foundation for Phase 7** - Self-improvement requires comprehensive observability

---

## Requirements

### Functional Requirements

#### 1. Structured Event Emission

All agents must emit structured events to Parent Harness via WebSocket:

```typescript
interface AgentLogEvent {
  type: AgentEventType;
  timestamp: string;
  agentId: string;
  agentType: string;
  sessionId?: string;
  taskId?: string;
  data: {
    message: string;
    severity: 'debug' | 'info' | 'warning' | 'error';
    phase?: string;        // Agent execution phase
    progress?: number;     // 0-100 percentage
    metadata?: object;     // Additional context
    error?: {
      name: string;
      message: string;
      stack?: string;
      code?: string;
      recoverable: boolean;
    };
  };
}

type AgentEventType =
  | 'agent:started'       // Agent began task execution
  | 'agent:phase'         // Agent entered new execution phase
  | 'agent:progress'      // Progress update (e.g., "2/5 tests completed")
  | 'agent:tool_use'      // Tool invoked (Read, Write, Edit, Bash)
  | 'agent:completed'     // Agent completed task successfully
  | 'agent:error'         // Agent encountered error
  | 'agent:halted';       // Agent halted (timeout/fatal error)
```

#### 2. Error Classification

Errors must be classified for intelligent recovery:

```typescript
interface ErrorClassification {
  recoverable: boolean;    // Can retry fix the issue?
  category: string;        // network | resource | logic | configuration | timeout
  severity: string;        // debug | info | warning | error | critical
  retryable: boolean;      // Should orchestrator retry?
  suggestedAction?: string; // human_intervention | retry | decompose | research
}
```

**Error Categories:**
- **network**: API failures, rate limits, connection errors
- **resource**: File not found, permission denied, disk full
- **logic**: Compilation errors, test failures, validation errors
- **configuration**: Missing env vars, invalid config
- **timeout**: Task exceeded execution time limit

**Recovery Actions:**
- **retry**: Transient error (network, rate limit) - retry with backoff
- **decompose**: Task too complex - break into subtasks
- **research**: Unknown problem - research agent investigates
- **human_intervention**: Cannot proceed - escalate to human

#### 3. Execution Phase Tracking

Agents must report their current execution phase:

**Build Agent Phases:**
1. `analyzing` - Reading task requirements and existing code
2. `planning` - Creating implementation plan
3. `implementing` - Writing/editing code
4. `testing` - Running tests and validations
5. `committing` - Creating git commit
6. `completed` - Task finished successfully

**QA Agent Phases:**
1. `analyzing` - Reading task and spec
2. `validating` - Running validation checks
3. `testing` - Running test suite
4. `reporting` - Creating validation report
5. `completed` - Validation finished

**Spec Agent Phases:**
1. `parsing` - Parsing task brief
2. `context` - Loading context and gotchas
3. `analyzing` - Analyzing requirements
4. `generating` - Generating specification
5. `completed` - Spec generation finished

#### 4. Progress Reporting

Long-running operations must report progress:

```typescript
// Example: QA Agent running 15 test files
emitAgentProgress(agentId, taskId, {
  phase: 'testing',
  progress: 47,  // 7/15 = 47%
  message: 'Running test suite: 7/15 files completed',
});
```

#### 5. Tool Usage Logging

Track all tool invocations for observability:

```typescript
interface ToolUseEvent {
  tool: string;      // Read | Write | Edit | Bash | Glob | Grep
  args: object;      // Tool-specific arguments
  duration?: number; // Execution time (ms)
  success: boolean;  // Did tool succeed?
  error?: string;    // Error message if failed
}
```

### Non-Functional Requirements

1. **Performance**
   - Events must not block agent execution
   - Queue events if WebSocket disconnected
   - Batch events for efficiency (max 10/sec per agent)

2. **Reliability**
   - Events persisted to database
   - Failed WebSocket delivery doesn't crash agent
   - Automatic reconnection on disconnect

3. **Security**
   - Sanitize error messages (no secrets/credentials)
   - Truncate large error stacks (max 500 chars)
   - Filter sensitive file paths

4. **Observability**
   - All events timestamped (ISO 8601)
   - Unique event IDs for correlation
   - Agent ID + Task ID in all events

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent Process                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Agent Code                           │ │
│  │  (Build Agent, QA Agent, Spec Agent, etc.)             │ │
│  └──────────────┬─────────────────────────────────────────┘ │
│                 │ emitEvent()                                │
│  ┌──────────────▼─────────────────────────────────────────┐ │
│  │              AgentLogger                                │ │
│  │  - Event buffering                                      │ │
│  │  - Error classification                                 │ │
│  │  - WebSocket connection                                 │ │
│  └──────────────┬─────────────────────────────────────────┘ │
└─────────────────┼──────────────────────────────────────────┘
                  │ WebSocket
                  │ ws://localhost:3333/ws?monitor=agents
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Parent Harness                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           WebSocket Server                            │   │
│  │  /ws?monitor=agents (agent events)                   │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │                                             │
│  ┌──────────────▼───────────────────────────────────────┐   │
│  │         Event Handler                                 │   │
│  │  - Validate events                                    │   │
│  │  - Update agent status                                │   │
│  │  - Trigger recovery logic                             │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │                                             │
│  ┌──────────────▼───────────────────────────────────────┐   │
│  │   Event Database (observability_events table)        │   │
│  │  - Persist all events                                 │   │
│  │  - Enable historical queries                          │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │                                             │
│  ┌──────────────▼───────────────────────────────────────┐   │
│  │   WebSocket Broadcast                                 │   │
│  │  - Send to dashboard clients                          │   │
│  │  - Real-time UI updates                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. AgentLogger Class (`parent-harness/orchestrator/src/logging/agent-logger.ts`)

Centralized logging utility for all agents:

```typescript
export class AgentLogger {
  private agentId: string;
  private agentType: string;
  private taskId?: string;
  private sessionId?: string;
  private wsClient?: WebSocket;
  private eventQueue: AgentLogEvent[] = [];
  private isConnected: boolean = false;

  constructor(config: {
    agentId: string;
    agentType: string;
    taskId?: string;
    sessionId?: string;
    websocketUrl: string;
  });

  // Core logging methods
  started(): void;
  phase(phase: string, message?: string): void;
  progress(phase: string, current: number, total: number, message?: string): void;
  toolUse(tool: string, args: object): void;
  info(message: string, metadata?: object): void;
  warning(message: string, metadata?: object): void;
  error(error: Error | string, recoverable?: boolean): void;
  completed(output?: string): void;
  halted(reason: string): void;

  // Internal methods
  private emit(event: AgentLogEvent): void;
  private connect(): void;
  private reconnect(): void;
  private flushQueue(): void;
  private classifyError(error: Error): ErrorClassification;
}
```

#### 2. Error Classifier (`parent-harness/orchestrator/src/logging/error-classifier.ts`)

Analyzes errors and suggests recovery actions:

```typescript
export function classifyError(error: Error, context?: {
  agentType: string;
  phase: string;
  taskId: string;
}): ErrorClassification {
  // Analyze error type, message, stack
  // Return classification with recovery suggestion
}

export function isRetryable(classification: ErrorClassification): boolean;
export function getRetryCooldown(classification: ErrorClassification): number;
export function getSuggestedAction(classification: ErrorClassification): string;
```

**Classification Logic:**

| Error Pattern | Category | Recoverable | Action |
|---------------|----------|-------------|--------|
| `ECONNREFUSED`, `ETIMEDOUT` | network | ✅ Yes | retry (30s cooldown) |
| `429 Too Many Requests` | network | ✅ Yes | retry (60s cooldown) |
| `ENOENT`, `EACCES` | resource | ❌ No | human_intervention |
| `SyntaxError`, `TypeError` | logic | ⚠️ Maybe | retry (Build Agent may self-fix) |
| `Test suite failed` | logic | ⚠️ Maybe | retry (QA Agent re-runs) |
| `Timeout exceeded` | timeout | ✅ Yes | decompose (task too large) |
| Missing env var | configuration | ❌ No | human_intervention |

#### 3. Event Persistence (`parent-harness/orchestrator/src/db/events.ts`)

Extended to support agent events:

```typescript
// Add to existing events.ts
export const events = {
  // ... existing event creators ...

  // Agent lifecycle events
  agentStarted: (agentId: string, agentType: string, taskId: string) =>
    createEvent({ ... }),

  agentPhase: (agentId: string, phase: string, taskId: string) =>
    createEvent({ ... }),

  agentProgress: (agentId: string, phase: string, progress: number, taskId: string) =>
    createEvent({ ... }),

  agentToolUse: (agentId: string, tool: string, args: object, taskId: string) =>
    createEvent({ ... }),

  agentError: (agentId: string, error: ErrorClassification, taskId: string) =>
    createEvent({ ... }),

  agentCompleted: (agentId: string, taskId: string, duration: number) =>
    createEvent({ ... }),
};
```

#### 4. WebSocket Integration (`parent-harness/orchestrator/src/websocket.ts`)

Already implemented - uses existing `emitAgentEvent()` function:

```typescript
// Existing implementation in server/websocket.ts
export function emitAgentEvent(
  type: AgentEventType,
  agentId?: string,
  agentType?: string,
  data: AgentEvent["data"] = {},
): void;
```

#### 5. Agent Integration

Each agent imports and uses AgentLogger:

```typescript
// Example: Build Agent
import { AgentLogger } from '../logging/agent-logger.js';

export async function executeBuildTask(task: Task): Promise<void> {
  const logger = new AgentLogger({
    agentId: `build-${task.id}`,
    agentType: 'build',
    taskId: task.id,
    sessionId: task.session_id,
    websocketUrl: 'ws://localhost:3333/ws?monitor=agents',
  });

  logger.started();

  try {
    logger.phase('analyzing', 'Reading task requirements');
    const spec = await readTaskSpec(task);

    logger.phase('implementing', 'Writing code');
    await implementCode(spec);

    logger.phase('testing', 'Running tests');
    logger.progress('testing', 3, 5, 'Running test suite');
    await runTests();

    logger.completed('Task implemented successfully');
  } catch (error) {
    logger.error(error as Error, true);
    throw error;
  }
}
```

### Integration Points

1. **Parent Harness Orchestrator**
   - Receives agent events via WebSocket
   - Updates task status based on agent events
   - Triggers retry logic on recoverable errors
   - Escalates to human on non-recoverable errors

2. **Dashboard**
   - Displays real-time agent activity
   - Shows agent execution phases and progress
   - Alerts on agent errors
   - Historical event log viewer

3. **Existing Infrastructure**
   - Uses existing WebSocket server (`server/websocket.ts`)
   - Uses existing events database (`parent-harness/orchestrator/src/db/events.ts`)
   - Integrates with existing `emitAgentEvent()` function

### Error Handling

1. **WebSocket Connection Failures**
   - Queue events in memory (max 100 events)
   - Attempt reconnection with exponential backoff (5s, 10s, 20s, 40s)
   - Log to console as fallback if WebSocket unavailable

2. **Event Serialization Errors**
   - Catch JSON.stringify errors
   - Truncate large objects (max 10KB)
   - Replace circular references with `[Circular]`

3. **Database Write Failures**
   - Log errors to console
   - Continue agent execution (don't block on logging failure)
   - Retry database insert on next event

---

## Pass Criteria

### Must Pass

1. ✅ **AgentLogger Class Implemented**
   - File exists: `parent-harness/orchestrator/src/logging/agent-logger.ts`
   - All methods defined: `started()`, `phase()`, `progress()`, `error()`, `completed()`
   - TypeScript compilation succeeds

2. ✅ **Error Classifier Implemented**
   - File exists: `parent-harness/orchestrator/src/logging/error-classifier.ts`
   - Classifies errors into categories (network, resource, logic, configuration, timeout)
   - Suggests recovery actions (retry, decompose, research, human_intervention)

3. ✅ **WebSocket Integration Working**
   - Agents connect to `ws://localhost:3333/ws?monitor=agents`
   - Events broadcast to Parent Harness
   - Dashboard receives real-time agent events

4. ✅ **Event Persistence Working**
   - All agent events saved to `observability_events` table
   - Events queryable by agentId, taskId, type, severity
   - Historical event log accessible via API

5. ✅ **Build Agent Integration**
   - Build Agent uses AgentLogger
   - Emits events for all phases (analyzing, planning, implementing, testing, committing)
   - Errors classified and reported with recovery suggestions

6. ✅ **QA Agent Integration**
   - QA Agent uses AgentLogger
   - Emits events for validation phases
   - Test failures reported with detailed context

7. ✅ **Spec Agent Integration**
   - Spec Agent uses AgentLogger
   - Emits events for spec generation phases
   - Parse errors and ambiguities reported

8. ✅ **Error Recovery Triggering**
   - Parent Harness receives error events
   - Retryable errors trigger cooldown + retry
   - Non-retryable errors escalate to human
   - Recovery actions logged to database

9. ✅ **Dashboard Display**
   - Dashboard shows live agent activity
   - Phase transitions visible in real-time
   - Error events displayed with severity indicators

10. ✅ **Integration Test Passes**
    - End-to-end test: Build Agent executes task → emits events → Parent Harness receives → Database persisted → Dashboard displays
    - Test file: `tests/integration/agent-logging.test.ts`

### Should Pass (Nice to Have)

11. ⭐ **Tool Usage Tracking**
    - All tool invocations logged (Read, Write, Edit, Bash)
    - Tool success/failure tracked
    - Tool execution duration measured

12. ⭐ **Progress Bar Support**
    - Dashboard displays progress bars for long operations
    - Progress updates smooth (not jerky)

13. ⭐ **Error Context Enrichment**
    - Stack traces include agent context
    - Error messages reference relevant files/line numbers
    - Suggested fixes included in error events

---

## Dependencies

### Upstream (Must Exist First)

1. ✅ **WebSocket Server** - `server/websocket.ts` (already implemented)
2. ✅ **Events Database** - `parent-harness/orchestrator/src/db/events.ts` (already implemented)
3. ✅ **Agent Metadata** - `parent-harness/orchestrator/src/agents/metadata.ts` (already implemented)
4. ⚠️ **Build Agent v0.1** - PHASE2-TASK-02 (in progress)
5. ⚠️ **QA Agent v0.1** - PHASE2-TASK-03 (in progress)

### Downstream (Depends on This)

1. **PHASE2-TASK-06**: Autonomous Task Execution Pipeline
2. **PHASE4-TASK-02**: Agent Health Monitoring
3. **PHASE7-TASK-01**: Self-Improvement Loop (requires detailed event history)

---

## Implementation Plan

### Phase 1: Core Infrastructure (2 hours)

**Create AgentLogger Class:**

1. Create `parent-harness/orchestrator/src/logging/agent-logger.ts`
2. Implement constructor with WebSocket connection
3. Implement core methods: `started()`, `phase()`, `progress()`, `completed()`
4. Implement error handling: `error()`, `halted()`
5. Implement event queue + reconnection logic
6. Add TypeScript types for all events

**Create Error Classifier:**

1. Create `parent-harness/orchestrator/src/logging/error-classifier.ts`
2. Implement `classifyError()` function
3. Add error pattern matching (network, resource, logic, etc.)
4. Add recovery action suggestions
5. Add retryable/cooldown calculations

### Phase 2: Database Integration (1 hour)

**Extend Events Module:**

1. Update `parent-harness/orchestrator/src/db/events.ts`
2. Add agent event creators (`agentStarted`, `agentPhase`, `agentProgress`, etc.)
3. Add event queries (`getAgentEvents`, `getTaskEvents`)
4. Test database persistence

### Phase 3: WebSocket Integration (1 hour)

**Test WebSocket Communication:**

1. Verify existing `emitAgentEvent()` function works
2. Test connection from AgentLogger to Parent Harness
3. Test event broadcast to dashboard clients
4. Test reconnection on disconnect

### Phase 4: Agent Integration (2-3 hours)

**Integrate Build Agent:**

1. Import AgentLogger in Build Agent
2. Add logger initialization
3. Add phase transitions (`analyzing`, `implementing`, `testing`, etc.)
4. Add tool usage logging
5. Add error classification on failures

**Integrate QA Agent:**

1. Import AgentLogger in QA Agent
2. Add validation phase logging
3. Add test suite progress reporting
4. Add validation failure reporting

**Integrate Spec Agent:**

1. Import AgentLogger in Spec Agent
2. Add spec generation phase logging
3. Add parse error reporting
4. Add ambiguity detection logging

### Phase 5: Testing (1-2 hours)

**Create Integration Test:**

1. Create `tests/integration/agent-logging.test.ts`
2. Test end-to-end flow: Agent → WebSocket → Database → Dashboard
3. Test error classification and recovery
4. Test event persistence and queries
5. Test WebSocket reconnection

**Manual Testing:**

1. Run Build Agent on real task
2. Verify events in database
3. Verify dashboard displays events
4. Trigger error, verify classification
5. Verify retry logic triggers

### Phase 6: Documentation (1 hour)

**Update Documentation:**

1. Add usage guide to `parent-harness/orchestrator/CLAUDE.md`
2. Document AgentLogger API
3. Document error classification system
4. Add examples for each agent type
5. Document WebSocket event format

---

## Testing Strategy

### Unit Tests

1. **AgentLogger Unit Tests** (`tests/unit/logging/agent-logger.test.ts`)
   - Test event emission
   - Test error classification
   - Test queue buffering
   - Test reconnection logic

2. **Error Classifier Unit Tests** (`tests/unit/logging/error-classifier.test.ts`)
   - Test error pattern matching
   - Test recovery action suggestions
   - Test retryable/cooldown calculations

### Integration Tests

1. **End-to-End Agent Logging** (`tests/integration/agent-logging.test.ts`)
   - Spawn test agent
   - Verify events emitted via WebSocket
   - Verify events persisted to database
   - Verify dashboard receives events
   - Test error recovery flow

2. **Multi-Agent Coordination** (`tests/integration/multi-agent-logging.test.ts`)
   - Spawn multiple agents
   - Verify events from different agents don't interfere
   - Test event correlation by taskId/sessionId

### Manual Testing

1. **Build Agent Execution**
   - Run Build Agent on sample task
   - Monitor console output
   - Check database for events
   - Verify dashboard shows real-time updates

2. **Error Recovery**
   - Trigger network error (disconnect WiFi)
   - Verify error classified as retryable
   - Verify retry triggered after cooldown

3. **Dashboard Monitoring**
   - Open dashboard
   - Execute multiple tasks simultaneously
   - Verify all agent events displayed
   - Test event filtering and search

---

## Open Questions

1. **Event Retention Policy**
   - How long should we keep events in database?
   - Should we archive old events? Compress them?
   - Suggested: Keep 30 days, archive older to JSON files

2. **Event Rate Limiting**
   - Should we limit event emission rate per agent?
   - Suggested: Max 10 events/sec per agent, batch if exceeded

3. **Tool Usage Privacy**
   - Should we log full tool arguments (may contain secrets)?
   - Suggested: Sanitize args, redact sensitive fields (passwords, API keys)

4. **Error Stack Depth**
   - How much stack trace to include in error events?
   - Suggested: First 500 chars, full stack in database only

5. **Dashboard Performance**
   - How many concurrent agents can dashboard handle?
   - Do we need event aggregation/sampling for high load?
   - Suggested: Test with 50+ agents, optimize if needed

---

## References

- **Existing WebSocket Implementation**: `server/websocket.ts` (lines 1-2209)
- **Existing Events Database**: `parent-harness/orchestrator/src/db/events.ts` (lines 1-359)
- **Agent Metadata**: `parent-harness/orchestrator/src/agents/metadata.ts` (lines 1-389)
- **Logger Utility**: `utils/logger.ts` (lines 1-192) - for console logging patterns
- **PHASE2-TASK-01**: Spec Agent v0.1 specification (reference implementation)
- **PHASE2-TASK-04**: Task State Machine with Retry Recovery (related error handling)

---

## Success Metrics

1. **Event Coverage**: 100% of agent lifecycle events logged (started, phase, progress, completed, error)
2. **Error Classification Accuracy**: 90%+ of errors correctly classified (manual review of 100 errors)
3. **Recovery Success Rate**: 70%+ of retryable errors successfully recovered
4. **Dashboard Latency**: Events displayed within 100ms of emission
5. **System Overhead**: Logging adds <5% CPU/memory overhead to agent execution
