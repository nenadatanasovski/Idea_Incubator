/**
 * Test Server Utility
 *
 * Express app wrapper for Supertest with isolated test database
 */

import express, { Express, Request, Response, NextFunction } from "express";
import { vi } from "vitest";

// Database mocks - must be set before imports
const mockQuery = vi.fn();
const mockRun = vi.fn();
const mockGetOne = vi.fn();

vi.mock("../../../database/db.js", () => ({
  query: mockQuery,
  run: mockRun,
  getOne: mockGetOne,
  getDb: vi.fn(() => ({
    run: vi.fn(),
    exec: vi.fn(() => []),
  })),
  saveDb: vi.fn(() => Promise.resolve()),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  exec: vi.fn(),
  closeDb: vi.fn(),
  reloadDb: vi.fn(),
}));

// Import observability routes after mocks
import observabilityRouter from "../../../server/routes/observability.js";

/**
 * Create a test Express app with observability routes
 */
export async function createTestApp(): Promise<Express> {
  const app = express();

  // Middleware
  app.use(express.json());

  // Mount observability routes
  app.use("/api/observability", observabilityRouter);

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Test server error:", err);
    res.status(500).json({ success: false, error: err.message });
  });

  return app;
}

/**
 * Create test server with WebSocket support
 */
export async function createTestServer(): Promise<{
  app: Express;
  server: import("http").Server;
  url: string;
}> {
  const app = await createTestApp();
  const server = app.listen(0); // Random available port
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const url = `http://localhost:${port}`;

  return { app, server, url };
}

/**
 * Seed test execution data
 */
export async function seedTestData(
  executions: Array<{
    id: string;
    taskListId: string;
    runNumber: number;
    status: string;
    startedAt: string;
    completedAt?: string;
    sessionId?: string;
  }>,
): Promise<void> {
  // Configure mock to return seeded data
  mockQuery.mockImplementation((sql: string, params: unknown[]) => {
    if (sql.includes("FROM task_list_execution_runs")) {
      if (sql.includes("COUNT(*)")) {
        return Promise.resolve([{ count: executions.length }]);
      }
      // Handle filtering
      const status = params.find(
        (p, i) =>
          typeof p === "string" &&
          sql.split("?")[i]?.includes("status") === true,
      );
      let filtered = executions;
      if (status) {
        filtered = executions.filter((e) => e.status === status);
      }
      // Apply limit/offset from last two params
      const limit = params.find((p) => typeof p === "number") || 50;
      const offset =
        params.filter((p) => typeof p === "number").length > 1
          ? (params.filter((p) => typeof p === "number")[1] as number)
          : 0;
      return Promise.resolve(
        filtered.slice(offset, offset + (limit as number)).map((e) => ({
          id: e.id,
          task_list_id: e.taskListId,
          run_number: e.runNumber,
          status: e.status,
          started_at: e.startedAt,
          completed_at: e.completedAt || null,
          session_id: e.sessionId || null,
        })),
      );
    }
    return Promise.resolve([]);
  });
}

/**
 * Seed transcript data for a specific execution
 */
export async function seedTranscriptData(
  executionId: string,
  entries?: Array<{
    id: string;
    sequence: number;
    entryType: string;
    category: string;
    summary: string;
    createdAt: string;
  }>,
): Promise<void> {
  const defaultEntries = entries || [
    {
      id: "transcript-001",
      sequence: 1,
      entryType: "message",
      category: "input",
      summary: "User sent a message",
      createdAt: new Date().toISOString(),
    },
    {
      id: "transcript-002",
      sequence: 2,
      entryType: "tool_call",
      category: "execution",
      summary: "Tool was called",
      createdAt: new Date().toISOString(),
    },
    {
      id: "transcript-003",
      sequence: 3,
      entryType: "response",
      category: "output",
      summary: "Assistant responded",
      createdAt: new Date().toISOString(),
    },
  ];

  // Configure mock for transcript queries
  mockQuery.mockImplementation((sql: string, params: unknown[]) => {
    if (
      sql.includes("FROM transcript_entries") &&
      params.includes(executionId)
    ) {
      if (sql.includes("COUNT(*)")) {
        return Promise.resolve([{ count: defaultEntries.length }]);
      }
      return Promise.resolve(
        defaultEntries.map((e) => ({
          id: e.id,
          timestamp: e.createdAt,
          sequence: e.sequence,
          execution_id: executionId,
          task_id: null,
          instance_id: "instance-001",
          wave_number: null,
          entry_type: e.entryType,
          category: e.category,
          summary: e.summary,
          details: null,
          skill_ref: null,
          tool_calls: null,
          assertions: null,
          duration_ms: null,
          token_estimate: null,
          created_at: e.createdAt,
        })),
      );
    }
    return Promise.resolve([]);
  });
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(): Promise<void> {
  mockQuery.mockReset();
  mockRun.mockReset();
  mockGetOne.mockReset();
}

/**
 * Get mock functions for direct manipulation
 */
export function getMocks(): {
  mockQuery: typeof mockQuery;
  mockRun: typeof mockRun;
  mockGetOne: typeof mockGetOne;
} {
  return { mockQuery, mockRun, mockGetOne };
}

/**
 * Reset all mocks to default behavior
 */
export function resetMocks(): void {
  mockQuery.mockReset();
  mockRun.mockReset();
  mockGetOne.mockReset();

  // Default implementations
  mockQuery.mockResolvedValue([]);
  mockRun.mockResolvedValue(undefined);
  mockGetOne.mockResolvedValue(null);
}

/**
 * Configure mock to return specific stats
 */
export function mockStats(stats: {
  activeExecutions?: number;
  errorRate?: string;
  blockedAgents?: number;
  pendingQuestions?: number;
}): void {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes("task_list_execution_runs")) {
      return Promise.resolve([
        {
          active_count: stats.activeExecutions || 0,
          total_recent: 10,
          failed_recent: stats.errorRate ? parseFloat(stats.errorRate) / 10 : 0,
        },
      ]);
    }
    if (sql.includes("build_agent_instances")) {
      return Promise.resolve([{ blocked_count: stats.blockedAgents || 0 }]);
    }
    if (sql.includes("blocking_questions")) {
      return Promise.resolve([{ pending_count: stats.pendingQuestions || 0 }]);
    }
    return Promise.resolve([]);
  });
}

/**
 * Configure mock to return health data
 */
export function mockHealth(data: {
  failedRecent?: number;
  blockedAgents?: number;
  staleQuestions?: number;
}): void {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes("status = 'failed'")) {
      return Promise.resolve([{ failed_count: data.failedRecent || 0 }]);
    }
    if (sql.includes("status = 'blocked'")) {
      return Promise.resolve([{ blocked_count: data.blockedAgents || 0 }]);
    }
    if (sql.includes("status = 'pending'")) {
      return Promise.resolve([{ stale_count: data.staleQuestions || 0 }]);
    }
    return Promise.resolve([]);
  });
}

/**
 * Configure mock to return execution data
 */
export function mockExecution(execution: {
  id: string;
  taskListId: string;
  runNumber: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  sessionId?: string;
  waveCount?: number;
  taskCount?: number;
  completedCount?: number;
  failedCount?: number;
}): void {
  mockQuery.mockImplementation((sql: string, params: unknown[]) => {
    if (sql.includes("FROM task_list_execution_runs WHERE id = ?")) {
      if (params[0] === execution.id) {
        return Promise.resolve([
          {
            id: execution.id,
            task_list_id: execution.taskListId,
            run_number: execution.runNumber,
            status: execution.status,
            started_at: execution.startedAt,
            completed_at: execution.completedAt || null,
            session_id: execution.sessionId || null,
          },
        ]);
      }
      return Promise.resolve([]);
    }
    if (sql.includes("wave_count")) {
      return Promise.resolve([
        {
          wave_count: execution.waveCount || 0,
          task_count: execution.taskCount || 0,
          completed_count: execution.completedCount || 0,
          failed_count: execution.failedCount || 0,
        },
      ]);
    }
    return Promise.resolve([]);
  });
}

/**
 * Configure mock to return tool uses data
 */
export function mockToolUses(
  executionId: string,
  toolUses: Array<{
    id: string;
    tool: string;
    toolCategory: string;
    inputSummary: string;
    resultStatus: string;
    isError?: boolean;
    isBlocked?: boolean;
    durationMs?: number;
  }>,
): void {
  mockQuery.mockImplementation((sql: string, params: unknown[]) => {
    if (sql.includes("FROM tool_uses") && params.includes(executionId)) {
      if (sql.includes("COUNT(*)")) {
        return Promise.resolve([{ count: toolUses.length }]);
      }
      return Promise.resolve(
        toolUses.map((t) => ({
          id: t.id,
          execution_id: executionId,
          task_id: null,
          transcript_entry_id: "transcript-001",
          tool: t.tool,
          tool_category: t.toolCategory,
          input: "{}",
          input_summary: t.inputSummary,
          result_status: t.resultStatus,
          output: null,
          output_summary: "Output summary",
          is_error: t.isError ? 1 : 0,
          is_blocked: t.isBlocked ? 1 : 0,
          error_message: null,
          block_reason: null,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          duration_ms: t.durationMs || 100,
          within_skill: null,
          parent_tool_use_id: null,
          created_at: new Date().toISOString(),
        })),
      );
    }
    return Promise.resolve([]);
  });
}

/**
 * Configure mock to return assertions data
 */
export function mockAssertions(
  executionId: string,
  assertions: Array<{
    id: string;
    taskId: string;
    category: string;
    description: string;
    result: string;
    evidence?: Record<string, unknown>;
    chainId?: string;
  }>,
): void {
  mockQuery.mockImplementation((sql: string, params: unknown[]) => {
    if (
      sql.includes("FROM assertion_results") &&
      params.includes(executionId)
    ) {
      if (sql.includes("COUNT(*)")) {
        return Promise.resolve([{ count: assertions.length }]);
      }
      return Promise.resolve(
        assertions.map((a) => ({
          id: a.id,
          task_id: a.taskId,
          execution_id: executionId,
          category: a.category,
          description: a.description,
          result: a.result,
          evidence: JSON.stringify(a.evidence || {}),
          chain_id: a.chainId || null,
          chain_position: null,
          timestamp: new Date().toISOString(),
          duration_ms: null,
          transcript_entry_id: null,
          created_at: new Date().toISOString(),
        })),
      );
    }
    return Promise.resolve([]);
  });
}

/**
 * Configure mock to return message bus logs
 */
export function mockMessageBusLogs(
  logs: Array<{
    id: string;
    eventType: string;
    severity: string;
    humanSummary: string;
    executionId?: string;
  }>,
): void {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes("FROM message_bus_log")) {
      if (sql.includes("COUNT(*)")) {
        return Promise.resolve([{ count: logs.length }]);
      }
      return Promise.resolve(
        logs.map((l) => ({
          id: l.id,
          event_id: `event-${l.id}`,
          timestamp: new Date().toISOString(),
          source: "test",
          event_type: l.eventType,
          correlation_id: null,
          human_summary: l.humanSummary,
          severity: l.severity,
          category: "general",
          transcript_entry_id: null,
          task_id: null,
          execution_id: l.executionId || null,
          payload: null,
          created_at: new Date().toISOString(),
        })),
      );
    }
    return Promise.resolve([]);
  });
}
