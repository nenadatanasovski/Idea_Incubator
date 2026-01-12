---
id: "simple-counter"
title: "API Call Counter"
idea_type: "feature_internal"
creator: "system"
created: "2026-01-10"
updated: "2026-01-10"
spec_version: "1.0"
total_tasks: 7
completed_tasks: 0
status: "pending"
---

# Build Tasks: API Call Counter

## Summary

**Spec Reference:** `build/spec.md`
**Total Tasks:** 7
**Completed:** 0
**In Progress:** 0
**Failed:** 0
**Blocked:** 0

**Last Updated:** 2026-01-10

---

## Context Loading

### Required Context
- [x] `build/spec.md` - Technical specification
- [x] `CLAUDE.md` - Project conventions (sections: Database, API Routes)
- [x] Knowledge Base gotchas for: SQLite timestamps, Express middleware

### Idea Context
- [x] `README.md` - Idea overview
- [x] `planning/brief.md` - Feature brief

---

## Phase 1: Database

### Task 1

```yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/025_api_calls.sql"
status: pending

requirements:
  - "Create api_calls table with id, user_id, endpoint, method, status_code, response_time_ms, created_at"
  - "Add indexes for user_id, endpoint, and created_at columns"
  - "Use INTEGER PRIMARY KEY AUTOINCREMENT for id"

gotchas:
  - "Use TEXT for created_at timestamp, not DATETIME"
  - "Always include IF NOT EXISTS"
  - "user_id can be NULL for unauthenticated requests"

validation:
  command: "sqlite3 :memory: < database/migrations/025_api_calls.sql && echo 'OK'"
  expected: "OK"

code_template: |
  -- Migration 025: API Call Counter
  -- Created: 2026-01-10
  -- Purpose: Track API calls for usage monitoring

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

depends_on: []
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 2: Types & Interfaces

### Task 2

```yaml
id: T-002
phase: types
action: CREATE
file: "types/api-stats.ts"
status: pending

requirements:
  - "Define ApiCall interface matching database schema"
  - "Define CallStats interface for aggregated results"
  - "Define StatsSummary interface for summary endpoint"

gotchas:
  - "Use number for id (matches INTEGER PRIMARY KEY)"
  - "userId can be null for unauthenticated calls"
  - "Dates should be ISO strings"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Types for API Call Statistics
   */

  export interface ApiCall {
    id: number;
    userId: string | null;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs: number;
    createdAt: string;
  }

  export interface CallStats {
    endpoint: string;
    method: string;
    count: number;
    avgResponseTime: number;
  }

  export interface StatsSummary {
    totalCalls: number;
    uniqueEndpoints: number;
    avgResponseTime: number;
    period: string;
  }

depends_on: []
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 3: Database Queries

### Task 3

```yaml
id: T-003
phase: database
action: UPDATE
file: "database/db.ts"
status: pending

requirements:
  - "Add recordApiCall function (fire-and-forget)"
  - "Add getCallStats function with filters"
  - "Add getStatsSummary function for last 24h"

gotchas:
  - "recordApiCall should not throw - wrap in try/catch"
  - "Use parameterized queries to prevent SQL injection"
  - "Filter by date range using TEXT comparison (ISO format)"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing file
  import { ApiCall, CallStats, StatsSummary } from '../types/api-stats.js';

  export function recordApiCall(
    userId: string | null,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number
  ): void {
    try {
      const stmt = db.prepare(`
        INSERT INTO api_calls (user_id, endpoint, method, status_code, response_time_ms)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(userId, endpoint, method, statusCode, responseTimeMs);
    } catch (error) {
      console.error('Failed to record API call:', error);
    }
  }

  export function getCallStats(filters: {
    endpoint?: string;
    from?: string;
    to?: string;
  }): CallStats[] {
    let query = `
      SELECT endpoint, method, COUNT(*) as count, AVG(response_time_ms) as avgResponseTime
      FROM api_calls
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.endpoint) {
      query += ' AND endpoint = ?';
      params.push(filters.endpoint);
    }
    if (filters.from) {
      query += ' AND created_at >= ?';
      params.push(filters.from);
    }
    if (filters.to) {
      query += ' AND created_at <= ?';
      params.push(filters.to);
    }

    query += ' GROUP BY endpoint, method ORDER BY count DESC';

    const stmt = db.prepare(query);
    return stmt.all(...params) as CallStats[];
  }

  export function getStatsSummary(): StatsSummary {
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as totalCalls,
        COUNT(DISTINCT endpoint) as uniqueEndpoints,
        AVG(response_time_ms) as avgResponseTime
      FROM api_calls
      WHERE created_at >= datetime('now', '-1 day')
    `);
    const result = stmt.get() as any;
    return {
      totalCalls: result.totalCalls || 0,
      uniqueEndpoints: result.uniqueEndpoints || 0,
      avgResponseTime: Math.round(result.avgResponseTime || 0),
      period: 'last_24h'
    };
  }

depends_on: ["T-001", "T-002"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 4: API Routes

### Task 4

```yaml
id: T-004
phase: api
action: CREATE
file: "server/middleware/api-counter.ts"
status: pending

requirements:
  - "Create middleware that logs all /api/* requests"
  - "Capture response status code and timing"
  - "Use res.on('finish') to capture after response completes"
  - "Fire-and-forget database writes"

gotchas:
  - "Must call next() immediately - don't block request"
  - "Use res.on('finish') to get final status code"
  - "Calculate response time from request start"
  - "Extract user_id from req.user if available"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * API Call Counter Middleware
   * Records all API calls for usage monitoring
   */
  import { Request, Response, NextFunction } from 'express';
  import { recordApiCall } from '../../database/db.js';

  export function apiCounter(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const endpoint = req.path;
    const method = req.method;
    const userId = (req as any).user?.id ?? null;

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      // Fire-and-forget - don't await
      recordApiCall(userId, endpoint, method, res.statusCode, responseTime);
    });

    next();
  }

depends_on: ["T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 5

```yaml
id: T-005
phase: api
action: CREATE
file: "server/routes/stats.ts"
status: pending

requirements:
  - "Create GET /api/stats/calls endpoint with query filters"
  - "Create GET /api/stats/summary endpoint"
  - "Return properly formatted JSON responses"

gotchas:
  - "Parse query params for filters"
  - "Handle missing params gracefully"
  - "Return empty array, not error, for no results"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Statistics API Routes
   */
  import { Router } from 'express';
  import { getCallStats, getStatsSummary } from '../../database/db.js';

  const router = Router();

  // GET /api/stats/calls
  router.get('/calls', async (req, res) => {
    try {
      const filters = {
        endpoint: req.query.endpoint as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined
      };
      const stats = getCallStats(filters);
      const total = stats.reduce((sum, s) => sum + s.count, 0);

      res.json({
        calls: stats,
        total,
        period: {
          from: filters.from || null,
          to: filters.to || null
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch call stats' });
    }
  });

  // GET /api/stats/summary
  router.get('/summary', async (req, res) => {
    try {
      const summary = getStatsSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  });

  export default router;

depends_on: ["T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 6

```yaml
id: T-006
phase: api
action: UPDATE
file: "server/api.ts"
status: pending

requirements:
  - "Import and mount apiCounter middleware for /api routes"
  - "Import and mount stats router at /api/stats"
  - "Mount middleware BEFORE route handlers"

gotchas:
  - "Middleware must be mounted before routes it should log"
  - "Mount stats routes after middleware"
  - "Import paths use .js extension for ES modules"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add imports at top
  import { apiCounter } from './middleware/api-counter.js';
  import statsRouter from './routes/stats.js';

  // Add middleware before other routes
  app.use('/api', apiCounter);

  // Mount stats routes
  app.use('/api/stats', statsRouter);

depends_on: ["T-004", "T-005"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 5: Tests

### Task 7

```yaml
id: T-007
phase: tests
action: CREATE
file: "tests/api-counter.test.ts"
status: pending

requirements:
  - "Test middleware records calls correctly"
  - "Test stats endpoint returns valid data"
  - "Test summary endpoint returns expected format"
  - "Test fire-and-forget doesn't block requests"

gotchas:
  - "Use test database, not production"
  - "Clean up test data after each test"
  - "Mock time for consistent response time tests"

validation:
  command: "npm test -- --grep 'api-counter'"
  expected: "all tests pass"

code_template: |
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { recordApiCall, getCallStats, getStatsSummary } from '../database/db.js';

  describe('API Counter', () => {
    beforeEach(async () => {
      // Clear test data
    });

    afterEach(async () => {
      // Cleanup
    });

    it('should record an API call', async () => {
      recordApiCall('user-1', '/api/sessions', 'GET', 200, 45);
      const stats = getCallStats({ endpoint: '/api/sessions' });
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0].count).toBeGreaterThan(0);
    });

    it('should aggregate call stats', async () => {
      recordApiCall('user-1', '/api/sessions', 'GET', 200, 40);
      recordApiCall('user-1', '/api/sessions', 'GET', 200, 50);
      const stats = getCallStats({ endpoint: '/api/sessions' });
      expect(stats[0].count).toBe(2);
      expect(stats[0].avgResponseTime).toBe(45);
    });

    it('should return summary stats', async () => {
      recordApiCall('user-1', '/api/test', 'GET', 200, 100);
      const summary = getStatsSummary();
      expect(summary.totalCalls).toBeGreaterThan(0);
      expect(summary.period).toBe('last_24h');
    });
  });

depends_on: ["T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Execution Log

| Task | Status | Started | Completed | Duration | Notes |
|------|--------|---------|-----------|----------|-------|
| | | | | | |

---

## Discoveries

### Patterns Discovered

| Pattern | Context | Confidence |
|---------|---------|------------|
| | | |

### Gotchas Discovered

| Gotcha | Context | Should Propagate? |
|--------|---------|-------------------|
| | | |

---

## Validation Results

### TypeScript Check

```
[output of npx tsc --noEmit]
```

### Test Results

```
[output of npm test]
```

---

## Completion Checklist

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] No TypeScript errors
- [ ] Tests passing
- [ ] Discoveries recorded in Knowledge Base
- [ ] Execution log updated

---

## Sign-off

**Completed By:**
**Completed At:**
**Final Status:**
**Commits:**

---

*Generated for Spec Agent reference*
*Executed by Build Agent*
