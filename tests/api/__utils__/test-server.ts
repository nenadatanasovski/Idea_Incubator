/**
 * Test Server Utility
 *
 * Express app wrapper for Supertest with isolated test database
 */

import express, { Express, Request, Response, NextFunction } from "express";
import { vi } from "vitest";

// Database mocks - defined outside vi.mock to avoid hoisting issues
export const mockQuery = vi.fn();
export const mockRun = vi.fn();
export const mockGetOne = vi.fn();

vi.mock("../../../database/db.js", () => {
  return {
    query: (...args: unknown[]) => mockQuery(...args),
    run: (...args: unknown[]) => mockRun(...args),
    getOne: (...args: unknown[]) => mockGetOne(...args),
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
  };
});

// Service mocks for observability services - use wrapper functions to avoid hoisting issues
export const mockExecutionService = {
  getExecution: vi.fn(),
  listExecutions: vi.fn(),
  getExecutionStats: vi.fn(),
};

export const mockTranscriptService = {
  getTranscript: vi.fn(),
  getTranscriptEntry: vi.fn(),
};

export const mockToolUseService = {
  getToolUses: vi.fn(),
  getToolUse: vi.fn(),
  getToolSummary: vi.fn(),
};

export const mockAssertionService = {
  getAssertions: vi.fn(),
  getAssertion: vi.fn(),
  getAssertionSummary: vi.fn(),
};

export const mockSkillService = {
  getSkillTraces: vi.fn(),
  getSkillTrace: vi.fn(),
};

export const mockMessageBusService = {
  getLogs: vi.fn(),
  getLog: vi.fn(),
};

export const mockCrossReferenceService = {
  getCrossReferences: vi.fn(),
};

vi.mock("../../../server/services/observability/index.js", () => ({
  executionService: {
    getExecution: (...args: unknown[]) => mockExecutionService.getExecution(...args),
    listExecutions: (...args: unknown[]) => mockExecutionService.listExecutions(...args),
    getExecutionStats: (...args: unknown[]) => mockExecutionService.getExecutionStats(...args),
  },
  transcriptService: {
    getTranscript: (...args: unknown[]) => mockTranscriptService.getTranscript(...args),
    getTranscriptEntry: (...args: unknown[]) => mockTranscriptService.getTranscriptEntry(...args),
  },
  toolUseService: {
    getToolUses: (...args: unknown[]) => mockToolUseService.getToolUses(...args),
    getToolUse: (...args: unknown[]) => mockToolUseService.getToolUse(...args),
    getToolSummary: (...args: unknown[]) => mockToolUseService.getToolSummary(...args),
  },
  assertionService: {
    getAssertions: (...args: unknown[]) => mockAssertionService.getAssertions(...args),
    getAssertion: (...args: unknown[]) => mockAssertionService.getAssertion(...args),
    getAssertionSummary: (...args: unknown[]) => mockAssertionService.getAssertionSummary(...args),
  },
  skillService: {
    getSkillTraces: (...args: unknown[]) => mockSkillService.getSkillTraces(...args),
    getSkillTrace: (...args: unknown[]) => mockSkillService.getSkillTrace(...args),
  },
  messageBusService: {
    getLogs: (...args: unknown[]) => mockMessageBusService.getLogs(...args),
    getLog: (...args: unknown[]) => mockMessageBusService.getLog(...args),
  },
  crossReferenceService: {
    getCrossReferences: (...args: unknown[]) => mockCrossReferenceService.getCrossReferences(...args),
  },
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
  // Use service mock (new architecture)
  mockExecutionService.listExecutions.mockImplementation((options?: { status?: string[]; taskListId?: string; limit?: number; offset?: number }) => {
    let filtered = executions;
    if (options?.status?.length) {
      filtered = filtered.filter(e => options.status!.includes(e.status));
    }
    if (options?.taskListId) {
      filtered = filtered.filter(e => e.taskListId === options.taskListId);
    }
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const paginatedData = filtered.slice(offset, offset + limit);
    const hasMore = offset + paginatedData.length < filtered.length;
    
    return Promise.resolve({
      data: paginatedData.map(e => ({
        id: e.id,
        taskListId: e.taskListId,
        runNumber: e.runNumber,
        status: e.status,
        startTime: e.startedAt,
        endTime: e.completedAt || null,
        waveCount: 0,
        taskCount: 0,
        completedCount: 0,
        failedCount: 0,
      })),
      total: filtered.length,
      limit,
      offset,
      hasMore,
    });
  });

  // Also keep query mock for backwards compatibility
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

  // Use service mock (new architecture)
  mockTranscriptService.getTranscript.mockImplementation((execId: string, options?: { limit?: number; offset?: number; entryTypes?: string[]; categories?: string[] }) => {
    if (execId === executionId) {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      
      // Filter by entryType and category if specified
      let filteredEntries = defaultEntries;
      if (options?.entryTypes?.length) {
        filteredEntries = filteredEntries.filter(e => options.entryTypes!.includes(e.entryType));
      }
      if (options?.categories?.length) {
        filteredEntries = filteredEntries.filter(e => options.categories!.includes(e.category));
      }
      
      const paginatedEntries = filteredEntries.slice(offset, offset + limit);
      const hasMore = offset + paginatedEntries.length < filteredEntries.length;
      
      return Promise.resolve({
        data: paginatedEntries.map((e) => ({
          id: e.id,
          timestamp: e.createdAt,
          sequence: e.sequence,
          executionId: executionId,
          taskId: null,
          instanceId: "instance-001",
          waveNumber: null,
          entryType: e.entryType,
          category: e.category,
          summary: e.summary,
          details: null,
          skillRef: null,
          toolCalls: null,
          assertions: null,
          durationMs: null,
          tokenEstimate: null,
          createdAt: e.createdAt,
        })),
        total: filteredEntries.length,
        limit,
        offset,
        hasMore,
      });
    }
    return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0, hasMore: false });
  });

  // Also keep query mock for backwards compatibility
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
  mockExecutionService: typeof mockExecutionService;
  mockTranscriptService: typeof mockTranscriptService;
  mockToolUseService: typeof mockToolUseService;
  mockAssertionService: typeof mockAssertionService;
  mockSkillService: typeof mockSkillService;
  mockMessageBusService: typeof mockMessageBusService;
  mockCrossReferenceService: typeof mockCrossReferenceService;
} {
  return {
    mockQuery,
    mockRun,
    mockGetOne,
    mockExecutionService,
    mockTranscriptService,
    mockToolUseService,
    mockAssertionService,
    mockSkillService,
    mockMessageBusService,
    mockCrossReferenceService,
  };
}

/**
 * Reset all mocks to default behavior
 */
export function resetMocks(): void {
  // Reset database mocks
  mockQuery.mockReset();
  mockRun.mockReset();
  mockGetOne.mockReset();

  // Reset service mocks
  mockExecutionService.getExecution.mockReset();
  mockExecutionService.listExecutions.mockReset();
  mockExecutionService.getExecutionStats.mockReset();
  mockTranscriptService.getTranscript.mockReset();
  mockTranscriptService.getTranscriptEntry.mockReset();
  mockToolUseService.getToolUses.mockReset();
  mockToolUseService.getToolUse.mockReset();
  mockToolUseService.getToolSummary.mockReset();
  mockAssertionService.getAssertions.mockReset();
  mockAssertionService.getAssertion.mockReset();
  mockAssertionService.getAssertionSummary.mockReset();
  mockSkillService.getSkillTraces.mockReset();
  mockSkillService.getSkillTrace.mockReset();
  mockMessageBusService.getLogs.mockReset();
  mockMessageBusService.getLog.mockReset();
  mockCrossReferenceService.getCrossReferences.mockReset();

  // Default implementations
  mockQuery.mockResolvedValue([]);
  mockRun.mockResolvedValue(undefined);
  mockGetOne.mockResolvedValue(null);
  mockExecutionService.getExecution.mockResolvedValue(null);
  mockExecutionService.listExecutions.mockResolvedValue([]);
  mockExecutionService.getExecutionStats.mockResolvedValue({ activeCount: 0, totalRecent: 0, failedRecent: 0 });
  mockTranscriptService.getTranscript.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0, hasMore: false });
  mockTranscriptService.getTranscriptEntry.mockResolvedValue(null);
  mockAssertionService.getAssertions.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });
  mockAssertionService.getAssertionSummary.mockResolvedValue({
    summary: { totalAssertions: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, passRate: 0 },
    byCategory: {},
    chains: { total: 0, passed: 0, failed: 0 },
  });
  mockCrossReferenceService.getCrossReferences.mockResolvedValue(null);
  mockToolUseService.getToolUses.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0, hasMore: false });
  mockToolUseService.getToolSummary.mockResolvedValue({ total: 0, errors: 0, blocked: 0, errorRate: 0, blockRate: 0, byTool: {}, byCategory: {}, byStatus: {}, avgDurationMs: 0 });
  mockSkillService.getSkillTraces.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0, hasMore: false });
  mockMessageBusService.getLogs.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0, hasMore: false });
}

/**
 * Mock skill traces for testing
 */
export function mockSkillTraces(
  executionId: string,
  skills: Array<{
    id: string;
    skillName: string;
    skillFile?: string;
    status: string;
    durationMs?: number;
  }>,
): void {
  mockSkillService.getSkillTraces.mockImplementation((execId: string, options?: { limit?: number; offset?: number }) => {
    if (execId === executionId) {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const paginatedData = skills.slice(offset, offset + limit);
      const hasMore = offset + paginatedData.length < skills.length;
      
      return Promise.resolve({
        data: paginatedData.map(s => ({
          id: s.id,
          executionId,
          taskId: null,
          skillName: s.skillName,
          skillFile: s.skillFile || "skill.md",
          lineNumber: 1,
          sectionTitle: "Section",
          inputSummary: "Input",
          outputSummary: "Output",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMs: s.durationMs || 100,
          tokenEstimate: 100,
          status: s.status,
          errorMessage: null,
          toolCalls: [],
          subSkills: [],
          createdAt: new Date().toISOString(),
        })),
        total: skills.length,
        limit,
        offset,
        hasMore,
      });
    }
    return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0, hasMore: false });
  });
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
  // Use service mock (new architecture)
  const failedRecent = stats.errorRate ? parseFloat(stats.errorRate) / 10 : 0;
  mockExecutionService.getExecutionStats.mockResolvedValue({
    activeCount: stats.activeExecutions || 0,
    totalRecent: 10,
    failedRecent,
  });

  // Also mock the database queries for blocked/pending counts
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes("task_list_execution_runs")) {
      return Promise.resolve([
        {
          active_count: stats.activeExecutions || 0,
          total_recent: 10,
          failed_recent: failedRecent,
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
  // Use service mock (new architecture)
  mockExecutionService.getExecution.mockImplementation((id: string) => {
    if (id === execution.id) {
      return Promise.resolve({
        id: execution.id,
        taskListId: execution.taskListId,
        runNumber: execution.runNumber,
        status: execution.status,
        startTime: execution.startedAt,
        endTime: execution.completedAt || null,
        waveCount: execution.waveCount || 0,
        taskCount: execution.taskCount || 0,
        completedCount: execution.completedCount || 0,
        failedCount: execution.failedCount || 0,
      });
    }
    return Promise.resolve(null);
  });

  // Also keep query mock for backwards compatibility
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
  // Use service mock (new architecture)
  mockToolUseService.getToolUses.mockImplementation((execId: string, options?: { limit?: number; offset?: number }) => {
    if (execId === executionId) {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const paginatedData = toolUses.slice(offset, offset + limit);
      const hasMore = offset + paginatedData.length < toolUses.length;
      
      return Promise.resolve({
        data: paginatedData.map((t) => ({
          id: t.id,
          executionId,
          taskId: null,
          transcriptEntryId: "transcript-001",
          tool: t.tool,
          toolCategory: t.toolCategory,
          input: "{}",
          inputSummary: t.inputSummary,
          resultStatus: t.resultStatus,
          output: null,
          outputSummary: "Output summary",
          isError: t.isError || false,
          isBlocked: t.isBlocked || false,
          errorMessage: null,
          blockReason: null,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMs: t.durationMs || 100,
          withinSkill: null,
          parentToolUseId: null,
          createdAt: new Date().toISOString(),
        })),
        total: toolUses.length,
        limit,
        offset,
        hasMore,
      });
    }
    return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0, hasMore: false });
  });

  // Mock tool summary
  const errorCount = toolUses.filter(t => t.isError).length;
  const blockedCount = toolUses.filter(t => t.isBlocked).length;
  const byTool: Record<string, { count: number; errors: number; blocked: number; avgDurationMs: number }> = {};
  const byCategory: Record<string, { count: number }> = {};
  for (const t of toolUses) {
    if (!byTool[t.tool]) {
      byTool[t.tool] = { count: 0, errors: 0, blocked: 0, avgDurationMs: 0 };
    }
    byTool[t.tool].count++;
    if (t.isError) byTool[t.tool].errors++;
    if (t.isBlocked) byTool[t.tool].blocked++;
    byTool[t.tool].avgDurationMs = (byTool[t.tool].avgDurationMs + (t.durationMs || 100)) / 2;
    
    if (!byCategory[t.toolCategory]) {
      byCategory[t.toolCategory] = { count: 0 };
    }
    byCategory[t.toolCategory].count++;
  }

  mockToolUseService.getToolSummary.mockImplementation((execId: string) => {
    if (execId === executionId) {
      return Promise.resolve({
        total: toolUses.length,
        errors: errorCount,
        blocked: blockedCount,
        errorRate: toolUses.length > 0 ? (errorCount / toolUses.length) * 100 : 0,
        blockRate: toolUses.length > 0 ? (blockedCount / toolUses.length) * 100 : 0,
        byTool,
        byCategory,
        byStatus: { success: toolUses.length - errorCount, error: errorCount },
        avgDurationMs: toolUses.reduce((sum, t) => sum + (t.durationMs || 100), 0) / (toolUses.length || 1),
      });
    }
    return Promise.resolve({ total: 0, errors: 0, blocked: 0, errorRate: 0, blockRate: 0, byTool: {}, byCategory: {}, byStatus: {}, avgDurationMs: 0 });
  });

  // Also keep query mock for backwards compatibility
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
  // Use service mock (new architecture)
  mockAssertionService.getAssertions.mockImplementation((execId: string) => {
    if (execId === executionId) {
      return Promise.resolve({
        data: assertions.map((a) => ({
          id: a.id,
          taskId: a.taskId,
          executionId: executionId,
          category: a.category,
          description: a.description,
          result: a.result,
          evidence: a.evidence || {},
          chainId: a.chainId || null,
          chainPosition: null,
          timestamp: new Date().toISOString(),
          durationMs: null,
          transcriptEntryId: null,
          createdAt: new Date().toISOString(),
        })),
        total: assertions.length,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
    }
    return Promise.resolve({ data: [], total: 0, limit: 50, offset: 0, hasMore: false });
  });

  // Mock assertion summary
  const passed = assertions.filter((a) => a.result === "pass").length;
  const failed = assertions.filter((a) => a.result === "fail").length;
  const byCategory: Record<string, { total: number; passed: number }> = {};
  for (const a of assertions) {
    if (!byCategory[a.category]) {
      byCategory[a.category] = { total: 0, passed: 0 };
    }
    byCategory[a.category].total++;
    if (a.result === "pass") byCategory[a.category].passed++;
  }

  mockAssertionService.getAssertionSummary.mockImplementation((execId: string) => {
    if (execId === executionId) {
      return Promise.resolve({
        summary: {
          totalAssertions: assertions.length,
          passed,
          failed,
          skipped: 0,
          warnings: 0,
          passRate: assertions.length > 0 ? (passed / assertions.length) * 100 : 0,
        },
        byCategory,
        chains: {
          total: 0,
          passed: 0,
          failed: 0,
        },
      });
    }
    return Promise.resolve({
      summary: { totalAssertions: 0, passed: 0, failed: 0, skipped: 0, warnings: 0, passRate: 0 },
      byCategory: {},
      chains: { total: 0, passed: 0, failed: 0 },
    });
  });

  // Also keep query mock for backwards compatibility
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
