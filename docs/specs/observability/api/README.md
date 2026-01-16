# Observability API Specifications

> **Navigation:** [Documentation Index](../../DOCUMENTATION-INDEX.md) > [Observability Spec](../SPEC.md) > API
> **Location:** `docs/specs/observability/api/README.md`
> **Purpose:** REST and WebSocket API endpoint specifications for the observability system

---

## Overview

The Observability API provides endpoints for:

1. **Transcript Queries** - Unified transcript retrieval and filtering
2. **Tool Use Queries** - Tool invocation history with status filtering
3. **Assertion Queries** - Test assertion results with evidence
4. **Skill Traces** - Skill invocation history with file references
5. **Message Bus Logs** - Human-readable event stream
6. **WebSocket Streaming** - Real-time event delivery

---

## REST Endpoints

### Executions

| Method | Endpoint                                              | Description               |
| ------ | ----------------------------------------------------- | ------------------------- |
| GET    | `/api/observability/executions`                       | List all executions       |
| GET    | `/api/observability/executions/:id`                   | Get execution details     |
| GET    | `/api/observability/executions/:id/transcript`        | Get transcript entries    |
| GET    | `/api/observability/executions/:id/tool-uses`         | Get tool uses             |
| GET    | `/api/observability/executions/:id/assertions`        | Get assertions            |
| GET    | `/api/observability/executions/:id/skills`            | Get skill traces          |
| GET    | `/api/observability/executions/:id/tool-summary`      | Get aggregated tool usage |
| GET    | `/api/observability/executions/:id/assertion-summary` | Get assertion statistics  |

### Message Bus

| Method | Endpoint                | Description           |
| ------ | ----------------------- | --------------------- |
| GET    | `/api/logs/message-bus` | Query message bus log |

### Cross-References

| Method | Endpoint                                              | Description          |
| ------ | ----------------------------------------------------- | -------------------- |
| GET    | `/api/observability/cross-refs/:entityType/:entityId` | Get cross-references |

---

## Query Parameters

### Tool Use Filtering

```
GET /api/observability/executions/:id/tool-uses?
  tools=Read,Write,Bash          # Filter by tool name
  categories=file_read,shell     # Filter by category
  status=error,blocked           # Filter by result status
  taskId=TU-IDEA-FEA-001         # Filter by task
  since=2026-01-15T00:00:00Z     # From timestamp
  until=2026-01-15T23:59:59Z     # To timestamp
  limit=100                      # Max results
  includeInputs=true             # Include full inputs
  includeOutputs=true            # Include full outputs
```

### Transcript Filtering

```
GET /api/observability/executions/:id/transcript?
  entryTypes=tool_use,assertion  # Filter by entry type
  categories=action,validation   # Filter by category
  since=2026-01-15T00:00:00Z     # From timestamp
  limit=500                      # Max results
```

### Message Bus Filtering

```
GET /api/logs/message-bus?
  since=2026-01-15T00:00:00Z     # From timestamp
  until=2026-01-15T23:59:59Z     # To timestamp
  eventTypes=test_failed,stuck   # Filter by event type
  sources=loop-1,loop-2          # Filter by source
  severity=error,critical        # Filter by severity
  correlationId=abc-123          # Get related events
  limit=100                      # Max results
```

---

## WebSocket Streaming

### Connection

```
ws://localhost:3001/ws?monitor=observability[&execution={executionId}]
```

### Subscription Topics

| Topic                 | Events                            |
| --------------------- | --------------------------------- |
| `transcript:*`        | All transcript entries            |
| `transcript:{execId}` | Transcript for specific execution |
| `tooluse:*`           | All tool use events               |
| `tooluse:{execId}`    | Tool uses for specific execution  |
| `assertion:*`         | All assertion results             |
| `skill:*`             | All skill traces                  |
| `messagebus:*`        | All message bus events            |

### Event Types

| Event              | Payload                                   |
| ------------------ | ----------------------------------------- |
| `transcript:entry` | `{ entry, isLatest }`                     |
| `tooluse:start`    | `{ toolUseId, tool, inputSummary }`       |
| `tooluse:end`      | `{ toolUseId, resultStatus, durationMs }` |
| `tooluse:output`   | `{ toolUseId, chunk, isStderr }`          |
| `assertion:result` | `{ assertion, runningPassRate }`          |
| `skill:start`      | `{ skillTraceId, skillName }`             |
| `skill:end`        | `{ skillTraceId, skillName, status }`     |
| `messagebus:event` | `{ entry, requiresAction }`               |

---

## Response Formats

### Paginated Response

```json
{
  "data": [...],
  "total": 150,
  "hasMore": true,
  "nextCursor": "abc123"
}
```

### Error Response

```json
{
  "error": "Not found",
  "code": "EXECUTION_NOT_FOUND",
  "details": { "executionId": "exec-123" }
}
```

---

## Related Documents

| Document                                                       | Description                             |
| -------------------------------------------------------------- | --------------------------------------- |
| [Types (appendices/TYPES.md)](../appendices/TYPES.md)          | TypeScript interfaces for API contracts |
| [Examples (appendices/EXAMPLES.md)](../appendices/EXAMPLES.md) | JSON response examples                  |
| [SPEC.md](../SPEC.md)                                          | Full specification                      |

---

_API implementation: `server/routes/observability.ts`_
