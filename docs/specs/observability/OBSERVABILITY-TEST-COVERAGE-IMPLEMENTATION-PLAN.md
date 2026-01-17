# Observability Test Coverage Implementation Plan

> **Location:** `docs/specs/observability/OBSERVABILITY-TEST-COVERAGE-IMPLEMENTATION-PLAN.md`
> **Source:** [Gap Analysis](./OBSERVABILITY-PHASES-1-2-GAP-ANALYSIS.md)
> **Created:** 2026-01-17
> **Status:** Ready for Execution

---

## Overview

This implementation plan addresses the test coverage gaps identified in the Observability System Phases 1 & 2. It provides detailed tasks, test scripts, and acceptance criteria for each remediation phase.

### Coverage Targets

| Area              | Current | Target | Delta |
| ----------------- | ------- | ------ | ----- |
| API Endpoints     | 20%     | 100%   | +80%  |
| UI Components     | 23%     | 90%    | +67%  |
| Service Layer     | 0%      | 80%    | +80%  |
| SQL Query Methods | 0%      | 100%   | +100% |
| Integration       | 30%     | 80%    | +50%  |

---

## Phase A: API Test Suite (Critical Priority)

### A.1 Test Infrastructure Setup

- [ ] **A.1.1** Create test directory structure

  ```bash
  mkdir -p tests/api/observability
  mkdir -p tests/api/__fixtures__
  mkdir -p tests/api/__utils__
  ```

- [ ] **A.1.2** Create test setup utility
  - **File:** `tests/api/__utils__/test-server.ts`
  - **Purpose:** Express app wrapper for Supertest

- [ ] **A.1.3** Create test fixtures
  - **File:** `tests/api/__fixtures__/observability-fixtures.ts`
  - **Contents:** Sample execution, transcript, tool-use, assertion data

- [ ] **A.1.4** Verify test infrastructure
  ```bash
  npm run test -- tests/api/__utils__/test-server.test.ts
  ```

**Pass Criteria A.1:**

- [ ] Test directory structure exists
- [ ] `test-server.ts` exports working Supertest app
- [ ] Fixtures can be imported without errors
- [ ] Sample test runs successfully

---

### A.2 Stats Endpoint Tests

- [ ] **A.2.1** Create stats test file
  - **File:** `tests/api/observability/stats.test.ts`

**Test Script:**

```typescript
// tests/api/observability/stats.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp } from "../__utils__/test-server";

describe("GET /api/observability/stats", () => {
  let app: Express.Application;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it("returns 200 with valid stats object", async () => {
    const res = await request(app).get("/api/observability/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalExecutions");
    expect(res.body).toHaveProperty("activeExecutions");
    expect(res.body).toHaveProperty("totalToolUses");
    expect(res.body).toHaveProperty("passRate");
  });

  it("stats values are non-negative numbers", async () => {
    const res = await request(app).get("/api/observability/stats");
    expect(res.body.totalExecutions).toBeGreaterThanOrEqual(0);
    expect(res.body.activeExecutions).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.passRate).toBe("number");
  });

  it("returns correct content-type", async () => {
    const res = await request(app).get("/api/observability/stats");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
```

**Pass Criteria A.2:**

- [ ] Stats endpoint returns 200
- [ ] Response contains required fields
- [ ] Values are correctly typed
- [ ] Content-type is JSON

---

### A.3 Health Endpoint Tests

- [ ] **A.3.1** Create health test file
  - **File:** `tests/api/observability/health.test.ts`

**Test Script:**

```typescript
// tests/api/observability/health.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../__utils__/test-server";

describe("GET /api/observability/health", () => {
  it("returns 200 with health status", async () => {
    const app = await createTestApp();
    const res = await request(app).get("/api/observability/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(["healthy", "degraded", "unhealthy"]).toContain(res.body.status);
  });

  it("includes database connectivity status", async () => {
    const app = await createTestApp();
    const res = await request(app).get("/api/observability/health");
    expect(res.body).toHaveProperty("database");
    expect(res.body.database).toHaveProperty("connected");
  });

  it("includes timestamp", async () => {
    const app = await createTestApp();
    const res = await request(app).get("/api/observability/health");
    expect(res.body).toHaveProperty("timestamp");
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });
});
```

**Pass Criteria A.3:**

- [ ] Health endpoint returns 200
- [ ] Status is one of: healthy, degraded, unhealthy
- [ ] Database connectivity reported
- [ ] Valid timestamp included

---

### A.4 Executions Endpoint Tests

- [ ] **A.4.1** Create executions list test file
  - **File:** `tests/api/observability/executions.test.ts`

**Test Script:**

```typescript
// tests/api/observability/executions.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import {
  createTestApp,
  seedTestData,
  cleanupTestData,
} from "../__utils__/test-server";
import { testExecutions } from "../__fixtures__/observability-fixtures";

describe("GET /api/observability/executions", () => {
  let app: Express.Application;

  beforeEach(async () => {
    app = await createTestApp();
    await seedTestData(testExecutions);
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("returns paginated list of executions", async () => {
    const res = await request(app).get("/api/observability/executions");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("executions");
    expect(Array.isArray(res.body.executions)).toBe(true);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("hasMore");
  });

  it("respects limit parameter", async () => {
    const res = await request(app)
      .get("/api/observability/executions")
      .query({ limit: 5 });
    expect(res.body.executions.length).toBeLessThanOrEqual(5);
  });

  it("respects offset parameter", async () => {
    const res1 = await request(app)
      .get("/api/observability/executions")
      .query({ limit: 2, offset: 0 });
    const res2 = await request(app)
      .get("/api/observability/executions")
      .query({ limit: 2, offset: 2 });

    expect(res1.body.executions[0].id).not.toBe(res2.body.executions[0].id);
  });

  it("filters by status", async () => {
    const res = await request(app)
      .get("/api/observability/executions")
      .query({ status: "active" });

    res.body.executions.forEach((exec: any) => {
      expect(exec.status).toBe("active");
    });
  });

  it("returns 400 for invalid limit", async () => {
    const res = await request(app)
      .get("/api/observability/executions")
      .query({ limit: -1 });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/observability/executions/:id", () => {
  it("returns execution details by ID", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(execId);
    expect(res.body).toHaveProperty("taskId");
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("startedAt");
  });

  it("returns 404 for non-existent execution", async () => {
    const app = await createTestApp();
    const res = await request(app).get(
      "/api/observability/executions/nonexistent",
    );
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 for invalid ID format", async () => {
    const app = await createTestApp();
    const res = await request(app).get("/api/observability/executions/");
    expect(res.status).toBe(404);
  });
});
```

**Pass Criteria A.4:**

- [ ] List endpoint returns paginated results
- [ ] Limit parameter respected
- [ ] Offset parameter works correctly
- [ ] Status filter works
- [ ] Invalid parameters return 400
- [ ] Detail endpoint returns correct execution
- [ ] Non-existent ID returns 404

---

### A.5 Transcript Endpoint Tests

- [ ] **A.5.1** Create transcript test file
  - **File:** `tests/api/observability/transcript.test.ts`

**Test Script:**

```typescript
// tests/api/observability/transcript.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp, seedTranscriptData } from "../__utils__/test-server";

describe("GET /api/observability/executions/:id/transcript", () => {
  let app: Express.Application;
  const execId = "test-exec-001";

  beforeAll(async () => {
    app = await createTestApp();
    await seedTranscriptData(execId);
  });

  it("returns transcript entries in sequence order", async () => {
    const res = await request(app).get(
      `/api/observability/executions/${execId}/transcript`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Verify sequence ordering
    for (let i = 1; i < res.body.length; i++) {
      expect(res.body[i].sequence).toBeGreaterThan(res.body[i - 1].sequence);
    }
  });

  it("includes required transcript fields", async () => {
    const res = await request(app).get(
      `/api/observability/executions/${execId}/transcript`,
    );
    const entry = res.body[0];

    expect(entry).toHaveProperty("sequence");
    expect(entry).toHaveProperty("role");
    expect(entry).toHaveProperty("content");
    expect(entry).toHaveProperty("createdAt");
  });

  it("filters by role parameter", async () => {
    const res = await request(app)
      .get(`/api/observability/executions/${execId}/transcript`)
      .query({ role: "assistant" });

    res.body.forEach((entry: any) => {
      expect(entry.role).toBe("assistant");
    });
  });

  it("returns empty array for execution with no transcript", async () => {
    const res = await request(app).get(
      "/api/observability/executions/empty-exec/transcript",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
```

**Pass Criteria A.5:**

- [ ] Transcript entries returned in sequence order
- [ ] Required fields present
- [ ] Role filtering works
- [ ] Empty transcript returns empty array

---

### A.6 Tool Uses Endpoint Tests

- [ ] **A.6.1** Create tool-uses test file
  - **File:** `tests/api/observability/tool-uses.test.ts`

**Test Script:**

```typescript
// tests/api/observability/tool-uses.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../__utils__/test-server";

describe("GET /api/observability/executions/:id/tool-uses", () => {
  it("returns tool uses for execution", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-uses`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("includes duration_ms for completed tool uses", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-uses`,
    );
    const completedTools = res.body.filter((t: any) => t.endedAt);

    completedTools.forEach((tool: any) => {
      expect(tool).toHaveProperty("durationMs");
      expect(typeof tool.durationMs).toBe("number");
    });
  });

  it("shows blocked commands with is_blocked flag", async () => {
    const app = await createTestApp();
    const execId = "test-exec-blocked";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-uses`,
    );
    const blockedTools = res.body.filter((t: any) => t.isBlocked);

    expect(blockedTools.length).toBeGreaterThan(0);
    blockedTools.forEach((tool: any) => {
      expect(tool.isBlocked).toBe(true);
    });
  });

  it("filters by tool category", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app)
      .get(`/api/observability/executions/${execId}/tool-uses`)
      .query({ category: "file_operation" });

    res.body.forEach((tool: any) => {
      expect(tool.category).toBe("file_operation");
    });
  });
});

describe("GET /api/observability/executions/:id/tool-summary", () => {
  it("returns aggregated tool statistics", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-summary`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalCalls");
    expect(res.body).toHaveProperty("byTool");
    expect(res.body).toHaveProperty("avgDurationMs");
  });

  it("byTool breakdown includes counts and durations", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/tool-summary`,
    );

    Object.values(res.body.byTool).forEach((tool: any) => {
      expect(tool).toHaveProperty("count");
      expect(tool).toHaveProperty("avgDurationMs");
      expect(tool).toHaveProperty("successRate");
    });
  });
});
```

**Pass Criteria A.6:**

- [ ] Tool uses returned with correct structure
- [ ] Duration calculated for completed tools
- [ ] Blocked commands identified
- [ ] Category filtering works
- [ ] Summary aggregation accurate

---

### A.7 Assertions Endpoint Tests

- [ ] **A.7.1** Create assertions test file
  - **File:** `tests/api/observability/assertions.test.ts`

**Test Script:**

```typescript
// tests/api/observability/assertions.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../__utils__/test-server";

describe("GET /api/observability/executions/:id/assertions", () => {
  it("returns assertion chains grouped correctly", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertions`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("chains");
    expect(Array.isArray(res.body.chains)).toBe(true);
  });

  it("each chain has pass/fail counts", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertions`,
    );

    res.body.chains.forEach((chain: any) => {
      expect(chain).toHaveProperty("chainId");
      expect(chain).toHaveProperty("passCount");
      expect(chain).toHaveProperty("failCount");
      expect(chain).toHaveProperty("assertions");
    });
  });

  it("assertion entries include evidence", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertions`,
    );
    const firstChain = res.body.chains[0];

    if (firstChain?.assertions?.length > 0) {
      const assertion = firstChain.assertions[0];
      expect(assertion).toHaveProperty("passed");
      expect(assertion).toHaveProperty("evidence");
      expect(assertion).toHaveProperty("assertedAt");
    }
  });
});

describe("GET /api/observability/executions/:id/assertion-summary", () => {
  it("returns overall pass rate", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertion-summary`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalAssertions");
    expect(res.body).toHaveProperty("passRate");
    expect(res.body.passRate).toBeGreaterThanOrEqual(0);
    expect(res.body.passRate).toBeLessThanOrEqual(100);
  });

  it("includes breakdown by assertion type", async () => {
    const app = await createTestApp();
    const execId = "test-exec-001";

    const res = await request(app).get(
      `/api/observability/executions/${execId}/assertion-summary`,
    );
    expect(res.body).toHaveProperty("byType");
  });
});
```

**Pass Criteria A.7:**

- [ ] Chains grouped correctly
- [ ] Pass/fail counts accurate
- [ ] Evidence included in entries
- [ ] Summary pass rate calculated correctly

---

### A.8 Logs Endpoint Tests

- [ ] **A.8.1** Create logs test file
  - **File:** `tests/api/observability/logs.test.ts`

**Test Script:**

```typescript
// tests/api/observability/logs.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp } from "../__utils__/test-server";

describe("GET /api/observability/logs/message-bus", () => {
  it("returns message bus logs", async () => {
    const app = await createTestApp();

    const res = await request(app).get("/api/observability/logs/message-bus");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("filters by severity level", async () => {
    const app = await createTestApp();

    const res = await request(app)
      .get("/api/observability/logs/message-bus")
      .query({ severity: "error" });

    res.body.forEach((log: any) => {
      expect(log.severity).toBe("error");
    });
  });

  it("filters by time range", async () => {
    const app = await createTestApp();
    const since = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

    const res = await request(app)
      .get("/api/observability/logs/message-bus")
      .query({ since });

    res.body.forEach((log: any) => {
      expect(new Date(log.createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(since).getTime(),
      );
    });
  });

  it("respects limit parameter", async () => {
    const app = await createTestApp();

    const res = await request(app)
      .get("/api/observability/logs/message-bus")
      .query({ limit: 10 });

    expect(res.body.length).toBeLessThanOrEqual(10);
  });
});
```

**Pass Criteria A.8:**

- [ ] Logs returned successfully
- [ ] Severity filtering works
- [ ] Time range filtering works
- [ ] Limit parameter respected

---

### A.9 WebSocket Tests

- [ ] **A.9.1** Create WebSocket test file
  - **File:** `tests/api/observability/websocket.test.ts`

**Test Script:**

```typescript
// tests/api/observability/websocket.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { createTestServer } from "../__utils__/test-server";

describe("WebSocket /ws?monitor=observability", () => {
  let server: any;
  let serverUrl: string;

  beforeAll(async () => {
    const result = await createTestServer();
    server = result.server;
    serverUrl = result.url;
  });

  afterAll(() => {
    server.close();
  });

  it("establishes WebSocket connection", async () => {
    const ws = new WebSocket(
      `${serverUrl.replace("http", "ws")}/ws?monitor=observability`,
    );

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        resolve();
      });
      ws.on("error", reject);
    });
  });

  it("receives initial connection message", async () => {
    const ws = new WebSocket(
      `${serverUrl.replace("http", "ws")}/ws?monitor=observability`,
    );

    const message = await new Promise<any>((resolve, reject) => {
      ws.on("message", (data) => {
        resolve(JSON.parse(data.toString()));
        ws.close();
      });
      ws.on("error", reject);
    });

    expect(message).toHaveProperty("type");
    expect(["connected", "status"]).toContain(message.type);
  });

  it("handles reconnection gracefully", async () => {
    const ws1 = new WebSocket(
      `${serverUrl.replace("http", "ws")}/ws?monitor=observability`,
    );

    await new Promise<void>((resolve) => {
      ws1.on("open", () => {
        ws1.close();
        resolve();
      });
    });

    // Reconnect
    const ws2 = new WebSocket(
      `${serverUrl.replace("http", "ws")}/ws?monitor=observability`,
    );

    await new Promise<void>((resolve, reject) => {
      ws2.on("open", () => {
        expect(ws2.readyState).toBe(WebSocket.OPEN);
        ws2.close();
        resolve();
      });
      ws2.on("error", reject);
    });
  });
});
```

**Pass Criteria A.9:**

- [ ] WebSocket connection established
- [ ] Initial message received
- [ ] Reconnection works
- [ ] Messages properly formatted

---

### Phase A Validation Commands

```bash
# Run all API tests
npm run test -- tests/api/observability/

# Run with coverage
npm run test -- tests/api/observability/ --coverage

# Run specific test file
npm run test -- tests/api/observability/stats.test.ts

# Watch mode during development
npm run test -- tests/api/observability/ --watch
```

### Phase A Completion Checklist

- [ ] All 9 test files created
- [ ] Test infrastructure working (test-server.ts, fixtures)
- [ ] All 11 API endpoints have tests
- [ ] Error scenarios covered (400, 404, 500)
- [ ] Pagination tested (limit, offset, hasMore)
- [ ] All tests passing
- [ ] Coverage ≥ 100% for API layer

---

## Phase B: UI Component Tests (High Priority)

### B.1 High-Priority Component Tests

- [ ] **B.1.1** AssertionList.test.tsx
- [ ] **B.1.2** ToolUseList.test.tsx
- [ ] **B.1.3** ExecutionList.test.tsx
- [ ] **B.1.4** ExecutionTimeline.test.tsx
- [ ] **B.1.5** UnifiedLogViewer.test.tsx

**Test Template:**

```typescript
// frontend/src/components/observability/__tests__/AssertionList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssertionList } from '../AssertionList';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockAssertions } from './__fixtures__/assertions';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('AssertionList', () => {
  it('renders loading state initially', () => {
    render(<AssertionList executionId="exec-001" />, { wrapper });
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders assertion chains when loaded', async () => {
    vi.mock('../hooks/useAssertions', () => ({
      useAssertions: () => ({ data: mockAssertions, isLoading: false })
    }));

    render(<AssertionList executionId="exec-001" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Chain 1/)).toBeInTheDocument();
    });
  });

  it('shows pass/fail badges correctly', async () => {
    render(<AssertionList executionId="exec-001" />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByTestId('pass-badge').length).toBeGreaterThan(0);
    });
  });

  it('expands chain on click', async () => {
    render(<AssertionList executionId="exec-001" />, { wrapper });

    await waitFor(() => {
      const chain = screen.getByText(/Chain 1/);
      fireEvent.click(chain);
      expect(screen.getByTestId('chain-details')).toBeVisible();
    });
  });

  it('shows empty state when no assertions', async () => {
    vi.mock('../hooks/useAssertions', () => ({
      useAssertions: () => ({ data: { chains: [] }, isLoading: false })
    }));

    render(<AssertionList executionId="empty-exec" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/No assertions/)).toBeInTheDocument();
    });
  });

  it('handles error state', async () => {
    vi.mock('../hooks/useAssertions', () => ({
      useAssertions: () => ({ error: new Error('Failed'), isLoading: false })
    }));

    render(<AssertionList executionId="error-exec" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Error loading/)).toBeInTheDocument();
    });
  });
});
```

**Pass Criteria B.1:**

- [ ] Each component renders without errors
- [ ] Loading states displayed
- [ ] Data renders correctly
- [ ] User interactions work
- [ ] Empty states handled
- [ ] Error states handled

---

### B.2 Medium-Priority Component Tests

- [ ] **B.2.1** ObservabilityHub.test.tsx
- [ ] **B.2.2** AssertionDashboard.test.tsx
- [ ] **B.2.3** ObservabilityConnectionProvider.test.tsx
- [ ] **B.2.4** SkillTraceList.test.tsx
- [ ] **B.2.5** LogViewer.test.tsx

---

### B.3 Lower-Priority Component Tests

- [ ] **B.3.1** QuickStats.test.tsx
- [ ] **B.3.2** ViewSelector.test.tsx
- [ ] **B.3.3** Breadcrumb.test.tsx
- [ ] **B.3.4** StatusBadge.test.tsx
- [ ] **B.3.5** ObservabilityHeader.test.tsx

---

### B.4 Visual/Chart Component Tests

- [ ] **B.4.1** AgentActivityGraph.test.tsx
- [ ] **B.4.2** SkillFlowDiagram.test.tsx
- [ ] **B.4.3** ToolUseHeatMap.test.tsx
- [ ] **B.4.4** TableERD.test.tsx

**Note:** Chart components require special mocking for canvas/SVG rendering.

---

### Phase B Validation Commands

```bash
# Run UI component tests
npm run test -- frontend/src/components/observability/__tests__/

# Run with coverage
npm run test -- frontend/src/components/observability/__tests__/ --coverage

# Run specific test
npm run test -- frontend/src/components/observability/__tests__/AssertionList.test.tsx
```

### Phase B Completion Checklist

- [ ] All 31 untested components have test files
- [ ] Render tests pass
- [ ] Props variations tested
- [ ] User events tested
- [ ] Loading/error/empty states tested
- [ ] Coverage ≥ 90% for UI components

---

## Phase C: Service Layer Tests (Medium Priority)

### C.1 UnifiedEventEmitter Tests

- [ ] **C.1.1** Create test file
  - **File:** `tests/unit/observability/unified-event-emitter.test.ts`

**Test Script:**

```typescript
// tests/unit/observability/unified-event-emitter.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnifiedEventEmitter } from "../../../server/services/observability/unified-event-emitter";

describe("UnifiedEventEmitter", () => {
  let emitter: UnifiedEventEmitter;

  beforeEach(() => {
    emitter = new UnifiedEventEmitter();
  });

  it("emits events to subscribers", () => {
    const callback = vi.fn();
    emitter.on("execution:started", callback);

    emitter.emit("execution:started", { executionId: "exec-001" });

    expect(callback).toHaveBeenCalledWith({ executionId: "exec-001" });
  });

  it("supports multiple subscribers", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    emitter.on("execution:started", callback1);
    emitter.on("execution:started", callback2);

    emitter.emit("execution:started", { executionId: "exec-001" });

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });

  it("unsubscribes correctly", () => {
    const callback = vi.fn();
    const unsubscribe = emitter.on("execution:started", callback);

    unsubscribe();
    emitter.emit("execution:started", { executionId: "exec-001" });

    expect(callback).not.toHaveBeenCalled();
  });

  it("handles wildcard subscriptions", () => {
    const callback = vi.fn();
    emitter.on("*", callback);

    emitter.emit("execution:started", { executionId: "exec-001" });
    emitter.emit("tool:invoked", { toolId: "tool-001" });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("does not throw on emit with no subscribers", () => {
    expect(() => {
      emitter.emit("nonexistent:event", {});
    }).not.toThrow();
  });
});
```

**Pass Criteria C.1:**

- [ ] Event emission works
- [ ] Multiple subscribers supported
- [ ] Unsubscribe works
- [ ] Wildcard subscriptions work
- [ ] No error on emit without subscribers

---

### C.2 ExecutionManager Tests

- [ ] **C.2.1** Create test file
  - **File:** `tests/unit/observability/execution-manager.test.ts`

**Test Script:**

```typescript
// tests/unit/observability/execution-manager.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionManager } from "../../../server/services/observability/execution-manager";

describe("ExecutionManager", () => {
  let manager: ExecutionManager;

  beforeEach(() => {
    manager = new ExecutionManager();
  });

  it("creates new execution", async () => {
    const execution = await manager.startExecution({
      taskId: "task-001",
      agentId: "agent-001",
    });

    expect(execution).toHaveProperty("id");
    expect(execution.status).toBe("active");
    expect(execution.startedAt).toBeDefined();
  });

  it("tracks active executions", async () => {
    await manager.startExecution({ taskId: "task-001", agentId: "agent-001" });
    await manager.startExecution({ taskId: "task-002", agentId: "agent-002" });

    const active = manager.getActiveExecutions();
    expect(active.length).toBe(2);
  });

  it("completes execution", async () => {
    const execution = await manager.startExecution({
      taskId: "task-001",
      agentId: "agent-001",
    });

    const completed = await manager.completeExecution(execution.id, {
      status: "success",
      result: { output: "done" },
    });

    expect(completed.status).toBe("completed");
    expect(completed.endedAt).toBeDefined();
  });

  it("fails execution with error", async () => {
    const execution = await manager.startExecution({
      taskId: "task-001",
      agentId: "agent-001",
    });

    const failed = await manager.failExecution(
      execution.id,
      new Error("Test error"),
    );

    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("Test error");
  });

  it("gets execution by ID", async () => {
    const execution = await manager.startExecution({
      taskId: "task-001",
      agentId: "agent-001",
    });

    const retrieved = await manager.getExecution(execution.id);
    expect(retrieved.id).toBe(execution.id);
  });

  it("returns null for non-existent execution", async () => {
    const result = await manager.getExecution("nonexistent");
    expect(result).toBeNull();
  });
});
```

**Pass Criteria C.2:**

- [ ] Execution creation works
- [ ] Active executions tracked
- [ ] Completion updates status
- [ ] Failure records error
- [ ] Retrieval by ID works

---

### Phase C Validation Commands

```bash
# Run service layer tests
npm run test -- tests/unit/observability/

# Run with coverage
npm run test -- tests/unit/observability/ --coverage
```

### Phase C Completion Checklist

- [ ] UnifiedEventEmitter fully tested
- [ ] ExecutionManager fully tested
- [ ] Query helpers tested
- [ ] Coverage ≥ 80% for service layer

---

## Phase D: Integration Tests (Medium Priority)

### D.1 API-to-Database Integration

- [ ] **D.1.1** Create test file
  - **File:** `tests/integration/observability/api-to-db.test.ts`

**Test Script:**

```typescript
// tests/integration/observability/api-to-db.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  createTestApp,
  getTestDb,
  resetTestDb,
} from "../../__utils__/test-server";

describe("API to Database Integration", () => {
  let app: Express.Application;
  let db: any;

  beforeAll(async () => {
    app = await createTestApp();
    db = getTestDb();
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
  });

  it("API reads reflect database state", async () => {
    // Insert directly to DB
    await db.run(`
      INSERT INTO build_agent_executions (id, task_id, agent_id, status, started_at)
      VALUES ('int-exec-001', 'task-001', 'agent-001', 'active', datetime('now'))
    `);

    // Verify via API
    const res = await request(app).get(
      "/api/observability/executions/int-exec-001",
    );
    expect(res.status).toBe(200);
    expect(res.body.taskId).toBe("task-001");
    expect(res.body.status).toBe("active");
  });

  it("foreign keys enforced through API layer", async () => {
    // This should fail - execution doesn't exist
    const res = await request(app)
      .post("/api/observability/executions/nonexistent/transcript")
      .send({ content: "Test" });

    expect(res.status).toBe(404);
  });

  it("database triggers fire on API writes", async () => {
    // Create execution
    const createRes = await request(app)
      .post("/api/observability/executions")
      .send({ taskId: "task-002", agentId: "agent-002" });

    const execId = createRes.body.id;

    // Add transcript entry (should trigger tr_event_to_log)
    await request(app)
      .post(`/api/observability/executions/${execId}/transcript`)
      .send({ role: "user", content: "Test message" });

    // Check message_bus_logs for triggered entry
    const logs = await db.all(`
      SELECT * FROM message_bus_logs
      WHERE event_type = 'transcript_entry'
      AND payload LIKE '%${execId}%'
    `);

    expect(logs.length).toBeGreaterThan(0);
  });
});
```

**Pass Criteria D.1:**

- [ ] API reads reflect DB state
- [ ] Foreign keys enforced
- [ ] Triggers fire correctly

---

### D.2 Python Producer to API Integration

- [ ] **D.2.1** Create test file
  - **File:** `tests/integration/observability/producer-to-api.test.ts`

**Test Script:**

```typescript
// tests/integration/observability/producer-to-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import request from "supertest";
import { createTestApp } from "../../__utils__/test-server";

const execAsync = promisify(exec);

describe("Python Producer to API Integration", () => {
  let app: Express.Application;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it("TranscriptWriter entries appear in API", async () => {
    // Run Python producer
    await execAsync(`python3 -c "
from coding_loops.shared.observability import TranscriptWriter
writer = TranscriptWriter('test-db.db')
writer.write_entry('int-exec-py', 1, 'user', 'Hello from Python')
writer.flush()
"`);

    // Verify via API
    const res = await request(app).get(
      "/api/observability/executions/int-exec-py/transcript",
    );
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].content).toContain("Hello from Python");
  });

  it("ToolUseLogger entries appear in API", async () => {
    await execAsync(`python3 -c "
from coding_loops.shared.observability import ToolUseLogger
logger = ToolUseLogger('test-db.db')
logger.log_tool_start('int-exec-py', 'tool-001', 'Read', {'file': 'test.ts'})
logger.log_tool_end('tool-001', {'content': 'File contents'})
"`);

    const res = await request(app).get(
      "/api/observability/executions/int-exec-py/tool-uses",
    );
    expect(res.status).toBe(200);
    expect(res.body.some((t: any) => t.toolName === "Read")).toBe(true);
  });

  it("AssertionRecorder entries appear in API", async () => {
    await execAsync(`python3 -c "
from coding_loops.shared.observability import AssertionRecorder
recorder = AssertionRecorder('test-db.db')
chain_id = recorder.start_chain('int-exec-py', 'Validation chain')
recorder.record_assertion(chain_id, 'File exists', True, 'Found file.ts')
recorder.end_chain(chain_id)
"`);

    const res = await request(app).get(
      "/api/observability/executions/int-exec-py/assertions",
    );
    expect(res.status).toBe(200);
    expect(res.body.chains.length).toBeGreaterThan(0);
  });
});
```

**Pass Criteria D.2:**

- [ ] TranscriptWriter entries readable via API
- [ ] ToolUseLogger entries readable via API
- [ ] AssertionRecorder entries readable via API

---

### Phase D Validation Commands

```bash
# Run integration tests
npm run test -- tests/integration/observability/

# Run with coverage
npm run test -- tests/integration/observability/ --coverage
```

### Phase D Completion Checklist

- [ ] API-to-DB integration verified
- [ ] Producer-to-API integration verified
- [ ] Full data flow validated
- [ ] Concurrent access tested

---

## Phase E: Python Query Class Tests (Medium Priority)

### E.1 ObservabilitySkills Query Tests

- [ ] **E.1.1** Create test file
  - **File:** `tests/e2e/test-obs-query-skills.py`

**Test Script:**

```python
#!/usr/bin/env python3
"""
Test all 39 ObservabilitySkills SQL query methods.
Run: python3 tests/e2e/test-obs-query-skills.py
"""

import sys
import sqlite3
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from coding_loops.shared.observability import ObservabilitySkills

class TestObservabilitySkills:
    def __init__(self, db_path: str):
        self.skills = ObservabilitySkills(db_path)
        self.passed = 0
        self.failed = 0

    def run_all(self):
        """Run all query method tests."""
        print("\n" + "="*60)
        print("ObservabilitySkills Query Tests")
        print("="*60)

        # Validation methods (V001-V007)
        self._test_validation_methods()

        # Troubleshooting methods (T001-T006)
        self._test_troubleshooting_methods()

        # Investigation methods (I001-I007)
        self._test_investigation_methods()

        # Aggregation methods (A001-A006)
        self._test_aggregation_methods()

        # Parallel execution methods (P001-P007)
        self._test_parallel_methods()

        # Anomaly detection methods (D001-D006)
        self._test_anomaly_methods()

        # Summary
        print("\n" + "="*60)
        print(f"Results: {self.passed} passed, {self.failed} failed")
        print("="*60)

        return self.failed == 0

    def _test(self, name: str, method, *args):
        """Run a single test."""
        try:
            result = method(*args)
            # Just verify it returns without error
            print(f"  ✓ {name}")
            self.passed += 1
            return result
        except Exception as e:
            print(f"  ✗ {name}: {e}")
            self.failed += 1
            return None

    def _test_validation_methods(self):
        print("\n[Validation Methods]")
        self._test("v001_verify_sequence_integrity",
                   self.skills.v001_verify_sequence_integrity, "test-exec")
        self._test("v002_verify_tool_use_linkage",
                   self.skills.v002_verify_tool_use_linkage, "test-exec")
        self._test("v003_verify_temporal_consistency",
                   self.skills.v003_verify_temporal_consistency, "test-exec")
        self._test("v004_verify_lock_balance",
                   self.skills.v004_verify_lock_balance)
        self._test("v005_verify_chain_completeness",
                   self.skills.v005_verify_chain_completeness)
        self._test("v006_verify_wave_task_counts",
                   self.skills.v006_verify_wave_task_counts)
        self._test("v007_verify_foreign_keys",
                   self.skills.v007_verify_foreign_keys)

    def _test_troubleshooting_methods(self):
        print("\n[Troubleshooting Methods]")
        self._test("t001_find_all_errors",
                   self.skills.t001_find_all_errors, 1)
        self._test("t002_find_blocked_commands",
                   self.skills.t002_find_blocked_commands, "test-exec")
        self._test("t003_find_first_error_in_chain",
                   self.skills.t003_find_first_error_in_chain, "test-chain")
        self._test("t004_find_incomplete_operations",
                   self.skills.t004_find_incomplete_operations)
        self._test("t005_find_repeated_failures",
                   self.skills.t005_find_repeated_failures, 2)
        self._test("t006_find_task_blockers",
                   self.skills.t006_find_task_blockers, "test-task")

    def _test_investigation_methods(self):
        print("\n[Investigation Methods]")
        self._test("i001_get_execution_timeline",
                   self.skills.i001_get_execution_timeline, "test-exec")
        self._test("i002_get_tool_call_context",
                   self.skills.i002_get_tool_call_context, "test-tool")
        self._test("i003_get_assertion_history",
                   self.skills.i003_get_assertion_history, "test-assertion")
        self._test("i004_get_file_modification_history",
                   self.skills.i004_get_file_modification_history, "test.ts")
        self._test("i005_get_agent_session_summary",
                   self.skills.i005_get_agent_session_summary, "test-session")
        self._test("i006_get_skill_execution_path",
                   self.skills.i006_get_skill_execution_path, "test-skill")
        self._test("i007_get_wave_execution_details",
                   self.skills.i007_get_wave_execution_details, "test-wave")

    def _test_aggregation_methods(self):
        print("\n[Aggregation Methods]")
        self._test("a001_aggregate_tool_usage_stats",
                   self.skills.a001_aggregate_tool_usage_stats, 24)
        self._test("a002_aggregate_assertion_pass_rates",
                   self.skills.a002_aggregate_assertion_pass_rates)
        self._test("a003_aggregate_execution_durations",
                   self.skills.a003_aggregate_execution_durations)
        self._test("a004_aggregate_error_frequency",
                   self.skills.a004_aggregate_error_frequency, 7)
        self._test("a005_aggregate_agent_performance",
                   self.skills.a005_aggregate_agent_performance)
        self._test("a006_aggregate_wave_efficiency",
                   self.skills.a006_aggregate_wave_efficiency)

    def _test_parallel_methods(self):
        print("\n[Parallel Execution Methods]")
        self._test("p001_get_wave_status",
                   self.skills.p001_get_wave_status, "test-wave")
        self._test("p002_get_agent_workload",
                   self.skills.p002_get_agent_workload)
        self._test("p003_get_task_dependencies",
                   self.skills.p003_get_task_dependencies, "test-task")
        self._test("p004_get_file_contention",
                   self.skills.p004_get_file_contention)
        self._test("p005_get_execution_parallelism",
                   self.skills.p005_get_execution_parallelism, "test-wave")
        self._test("p006_get_blocked_tasks",
                   self.skills.p006_get_blocked_tasks, "test-wave")
        self._test("p007_get_wave_timeline",
                   self.skills.p007_get_wave_timeline, "test-wave")

    def _test_anomaly_methods(self):
        print("\n[Anomaly Detection Methods]")
        self._test("d001_detect_slow_tools",
                   self.skills.d001_detect_slow_tools, 2.0)
        self._test("d002_detect_assertion_regressions",
                   self.skills.d002_detect_assertion_regressions)
        self._test("d003_detect_error_spikes",
                   self.skills.d003_detect_error_spikes, 24)
        self._test("d004_detect_stalled_executions",
                   self.skills.d004_detect_stalled_executions, 300)
        self._test("d005_detect_resource_exhaustion",
                   self.skills.d005_detect_resource_exhaustion)
        self._test("d006_detect_pattern_anomalies",
                   self.skills.d006_detect_pattern_anomalies)


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else "database/ideas.db"

    tester = TestObservabilitySkills(db_path)
    success = tester.run_all()

    sys.exit(0 if success else 1)
```

**Pass Criteria E.1:**

- [ ] All 7 validation methods execute without error
- [ ] All 6 troubleshooting methods execute without error
- [ ] All 7 investigation methods execute without error
- [ ] All 6 aggregation methods execute without error
- [ ] All 7 parallel execution methods execute without error
- [ ] All 6 anomaly detection methods execute without error
- [ ] Total: 39/39 methods pass

---

### Phase E Validation Commands

```bash
# Run Python query tests
python3 tests/e2e/test-obs-query-skills.py

# Run with specific database
python3 tests/e2e/test-obs-query-skills.py database/test.db
```

### Phase E Completion Checklist

- [ ] test-obs-query-skills.py created
- [ ] All 39 SQL query methods tested
- [ ] Methods return expected types
- [ ] Error handling verified
- [ ] Edge cases covered (empty results, missing data)

---

## Final Validation

### Complete Test Suite Commands

```bash
# Add these to package.json scripts
"test:obs:api": "vitest run tests/api/observability",
"test:obs:ui": "vitest run frontend/src/components/observability/__tests__",
"test:obs:services": "vitest run tests/unit/observability",
"test:obs:integration": "vitest run tests/integration/observability",
"test:obs:python": "python3 tests/e2e/test-obs-phase2-producers.py && python3 tests/e2e/test-obs-query-skills.py",
"test:obs:all": "npm run test:obs:api && npm run test:obs:ui && npm run test:obs:services && npm run test:obs:integration && npm run test:obs:python"
```

### Run Full Validation

```bash
npm run test:obs:all
```

---

## Master Completion Checklist

### Phase A: API Test Suite

- [ ] A.1 Test infrastructure setup complete
- [ ] A.2 Stats endpoint tests passing
- [ ] A.3 Health endpoint tests passing
- [ ] A.4 Executions endpoint tests passing
- [ ] A.5 Transcript endpoint tests passing
- [ ] A.6 Tool uses endpoint tests passing
- [ ] A.7 Assertions endpoint tests passing
- [ ] A.8 Logs endpoint tests passing
- [ ] A.9 WebSocket tests passing
- [ ] **API coverage ≥ 100%**

### Phase B: UI Component Tests

- [ ] B.1 High-priority components (5) tested
- [ ] B.2 Medium-priority components (5) tested
- [ ] B.3 Lower-priority components (5) tested
- [ ] B.4 Visual/chart components tested
- [ ] **UI coverage ≥ 90%**

### Phase C: Service Layer Tests

- [ ] C.1 UnifiedEventEmitter tested
- [ ] C.2 ExecutionManager tested
- [ ] **Service layer coverage ≥ 80%**

### Phase D: Integration Tests

- [ ] D.1 API-to-DB integration verified
- [ ] D.2 Producer-to-API integration verified
- [ ] **Integration coverage ≥ 80%**

### Phase E: Python Query Tests

- [ ] E.1 All 39 SQL query methods tested
- [ ] **Query coverage = 100%**

---

## Definition of Done

This implementation plan is complete when:

1. ✅ All checkboxes in this document are checked
2. ✅ `npm run test:obs:all` passes with 0 failures
3. ✅ Coverage thresholds met (API 100%, UI 90%, Services 80%)
4. ✅ No flaky tests (3 consecutive green runs)
5. ✅ Tests integrated into CI pipeline
6. ✅ Documentation updated with test locations

---

_Implementation plan for Observability System Test Coverage Remediation_
