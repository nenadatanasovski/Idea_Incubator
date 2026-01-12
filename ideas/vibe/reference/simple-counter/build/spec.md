---
id: "simple-counter"
title: "API Call Counter"
idea_type: "feature_internal"
creator: "system"
created: "2026-01-10"
updated: "2026-01-10"
status: "approved"
version: "1.0"
complexity: "simple"
---

# Technical Specification: API Call Counter

## Context References

**Required Reading:**
- [x] `README.md` - Idea overview
- [x] `planning/brief.md` - Feature brief

**Patterns to Follow:**
- Section: "Database Patterns" - Use SQLite with TEXT timestamps
- Section: "API Routes" - Express router patterns

---

## Overview

**Objective:**
Implement a lightweight API call counter that records every API request and provides aggregated statistics. This enables usage monitoring and future billing features.

**Success Criteria:**
1. Every API call is recorded in the database
2. Statistics endpoint returns accurate counts within 5 seconds
3. Response time overhead from middleware < 5ms
4. Counter continues working even if database write fails (fire-and-forget)

**Out of Scope:**
- Real-time streaming dashboards
- Rate limiting based on counts
- Data retention policies
- Export functionality

---

## Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria | Source |
|----|-------------|----------|---------------------|--------|
| FR-001 | Record API calls | Must | Every request logged with endpoint, method, status | Brief |
| FR-002 | Query call counts | Must | Filter by user, endpoint, date range | Brief |
| FR-003 | Aggregate statistics | Should | Return total calls, avg response time | Brief |

### Detailed Requirements

#### FR-001: Record API Calls

**Description:** Middleware intercepts all API requests and logs them to the database.

**User Story:** As a system administrator, I want all API calls recorded so that I can monitor usage patterns.

**Acceptance Criteria:**
- [x] Every request to `/api/*` is logged
- [x] Logs include: user_id, endpoint, method, status_code, response_time_ms
- [x] Logging is non-blocking (fire-and-forget)
- [x] Failed logging does not affect request handling

---

## Non-Functional Requirements

| Category | Requirement | Target | Validation Method |
|----------|-------------|--------|-------------------|
| Performance | Middleware overhead | < 5ms | Timing comparison |
| Reliability | Logging availability | 99.9% | Monitoring |
| Storage | Data growth | ~100 bytes/call | Database size check |

---

## Architecture

### System Context

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Middleware │────▶│   Handler   │
└─────────────┘     │  (counter)  │     └─────────────┘
                    └──────┬──────┘
                           │ async
                           ▼
                    ┌─────────────┐
                    │  api_calls  │
                    │   (table)   │
                    └─────────────┘
```

### New Files

| File Path | Purpose | Owner |
|-----------|---------|-------|
| `database/migrations/025_api_calls.sql` | Create api_calls table | Build Agent |
| `server/middleware/api-counter.ts` | Request logging middleware | Build Agent |
| `server/routes/stats.ts` | Statistics API endpoints | Build Agent |

### Modified Files

| File Path | Changes | Owner |
|-----------|---------|-------|
| `server/api.ts` | Mount middleware and stats routes | Build Agent |

### Files to Avoid

| File Path | Reason | Owner |
|-----------|--------|-------|
| `server/websocket.ts` | Unrelated to this feature | WebSocket team |
| `server/communication/*` | Communication subsystem | COM team |

---

## API Design

### Endpoints

| Endpoint | Method | Description | Auth | Request | Response |
|----------|--------|-------------|------|---------|----------|
| `/api/stats/calls` | GET | Get call counts | Optional | Query params | CallStats[] |
| `/api/stats/summary` | GET | Get summary stats | Optional | Query params | Summary |

### Request/Response Examples

#### GET /api/stats/calls

**Request:**
```
GET /api/stats/calls?endpoint=/api/sessions&from=2026-01-01&to=2026-01-10
```

**Response:**
```json
{
  "calls": [
    {
      "endpoint": "/api/sessions",
      "method": "GET",
      "count": 150,
      "avgResponseTime": 45
    }
  ],
  "total": 150,
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-10"
  }
}
```

#### GET /api/stats/summary

**Response:**
```json
{
  "totalCalls": 5420,
  "uniqueEndpoints": 23,
  "avgResponseTime": 67,
  "period": "last_24h"
}
```

---

## Data Models

### Database Schema

```sql
-- Migration 025: API Call Counter
CREATE TABLE IF NOT EXISTS api_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_calls_endpoint ON api_calls(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_calls_user ON api_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_created ON api_calls(created_at);
```

### TypeScript Interfaces

```typescript
interface ApiCall {
  id: number;
  userId: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  createdAt: string;
}

interface CallStats {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
}

interface StatsSummary {
  totalCalls: number;
  uniqueEndpoints: number;
  avgResponseTime: number;
  period: string;
}
```

---

## Dependencies

### Internal Dependencies

| Dependency | Status | Blocks | Owner |
|------------|--------|--------|-------|
| Database (db.ts) | Ready | None | Core |
| Express app | Ready | None | Core |

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18 | Web framework (existing) |

---

## Known Gotchas

| ID | Gotcha | Source | Confidence |
|----|--------|--------|------------|
| G-001 | Use TEXT for SQLite timestamps, not DATETIME | Knowledge Base | High |
| G-002 | Middleware must call next() even on error | Experience | High |
| G-003 | Fire-and-forget requires try/catch to prevent unhandled rejections | Experience | High |

---

## Validation Strategy

### Unit Tests

| Test File | Coverage Target | Priority |
|-----------|-----------------|----------|
| `tests/api-counter.test.ts` | 80% | High |

### Validation Commands

```bash
# TypeScript check
npx tsc --noEmit

# Run tests
npm test -- --grep "api-counter"

# Manual validation
curl http://localhost:3000/api/stats/summary | jq
```

### Manual Validation

- [ ] Make 10 API calls, verify count increases
- [ ] Check response time overhead < 5ms
- [ ] Verify failed DB write doesn't break requests

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Database growth | Medium | Low | Add TTL later |
| Performance impact | Low | Medium | Fire-and-forget pattern |

---

## Implementation Notes

1. Use `res.on('finish')` to capture response status and timing
2. Generate response time by comparing request start time
3. Don't await database writes in middleware - fire and forget

---

## Approval

- [x] **Auto-Approved** - Complexity below threshold

**Approved By:** System
**Approved At:** 2026-01-10
**Notes:** Simple feature, low risk

---

*Generated for Spec Agent reference*
*See `tasks.md` for implementation breakdown*
