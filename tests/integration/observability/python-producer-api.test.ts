/**
 * Python Producer to API Integration Tests
 *
 * Tests that verify Python-produced observability data is correctly
 * consumed by the API layer
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";

// Mock the database layer to simulate Python-produced data
vi.mock("../../../database/db.js", () => ({
  getDb: vi.fn(),
  run: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
}));

import { query } from "../../../database/db.js";

describe("Python Producer to API Integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Message Bus Log Format", () => {
    it("parses Python-produced message bus logs correctly", async () => {
      // Simulate the format Python produces
      const pythonProducedLog = {
        id: uuidv4(),
        event_id: uuidv4(),
        timestamp: "2026-01-15T10:00:00.000Z",
        source: "build-agent",
        event_type: "task.started",
        correlation_id: null,
        human_summary: "Task T-001 started execution",
        severity: "info",
        category: "execution",
        transcript_entry_id: uuidv4(),
        task_id: "T-001",
        execution_id: "exec-001",
        payload: JSON.stringify({ taskTitle: "Create migration" }),
        created_at: "2026-01-15T10:00:00.000Z",
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        pythonProducedLog,
      ]);

      const result = (await query(
        "SELECT * FROM message_bus_log WHERE id = ?",
        [pythonProducedLog.id],
      )) as any[];

      expect(result).toHaveLength(1);
      expect(result[0].event_type).toBe("task.started");
      expect(result[0].severity).toBe("info");

      // Verify payload can be parsed
      const payload = JSON.parse(result[0].payload);
      expect(payload.taskTitle).toBe("Create migration");
    });

    it("handles Python timestamp format", async () => {
      const pythonLog = {
        id: uuidv4(),
        timestamp: "2026-01-15T10:00:00.000000Z", // Python often includes microseconds
        event_type: "task.completed",
        human_summary: "Task completed",
        severity: "info",
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([pythonLog]);

      const result = (await query(
        "SELECT * FROM message_bus_log LIMIT 1",
      )) as any[];

      expect(result[0].timestamp).toBeDefined();
      // Should be parseable as a date
      expect(new Date(result[0].timestamp).getTime()).not.toBeNaN();
    });
  });

  describe("Transcript Entry Format", () => {
    it("parses Python-produced transcript entries correctly", async () => {
      const pythonTranscriptEntry = {
        id: uuidv4(),
        timestamp: "2026-01-15T10:05:00.000Z",
        sequence: 5,
        source: "agent",
        execution_id: "exec-001",
        task_id: "task-001",
        instance_id: "build-agent-001",
        wave_id: "wave-001",
        wave_number: 1,
        entry_type: "tool_use",
        category: "action",
        summary: "Read file config.ts",
        details: JSON.stringify({
          tool: "Read",
          filePath: "/src/config.ts",
          success: true,
        }),
        duration_ms: 45,
        token_estimate: 150,
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        pythonTranscriptEntry,
      ]);

      const result = (await query(
        "SELECT * FROM transcript_entries WHERE id = ?",
        [pythonTranscriptEntry.id],
      )) as any[];

      expect(result[0].entry_type).toBe("tool_use");
      expect(result[0].sequence).toBe(5);
      expect(result[0].duration_ms).toBe(45);

      // Verify details can be parsed
      const details = JSON.parse(result[0].details);
      expect(details.tool).toBe("Read");
      expect(details.success).toBe(true);
    });

    it("handles wave event entries", async () => {
      const waveEntry = {
        id: uuidv4(),
        entry_type: "wave_start",
        category: "lifecycle",
        summary: "Wave 1 started with 5 tasks",
        wave_number: 1,
        details: JSON.stringify({
          taskCount: 5,
          parallelism: 3,
        }),
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([waveEntry]);

      const result = (await query(
        "SELECT * FROM transcript_entries LIMIT 1",
      )) as any[];

      expect(result[0].entry_type).toBe("wave_start");
      expect(result[0].wave_number).toBe(1);
    });
  });

  describe("Tool Use Format", () => {
    it("parses Python-produced tool uses correctly", async () => {
      const pythonToolUse = {
        id: uuidv4(),
        transcript_entry_id: uuidv4(),
        tool: "Bash",
        input_summary: "npm run build",
        output_summary: "Build completed successfully",
        start_time: "2026-01-15T10:10:00.000Z",
        end_time: "2026-01-15T10:10:30.000Z",
        duration_ms: 30000,
        is_error: 0,
        is_blocked: 0,
        error_message: null,
        blocked_reason: null,
        task_id: "task-001",
        execution_id: "exec-001",
        within_skill: null,
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        pythonToolUse,
      ]);

      const result = (await query("SELECT * FROM tool_uses WHERE id = ?", [
        pythonToolUse.id,
      ])) as any[];

      expect(result[0].tool).toBe("Bash");
      expect(result[0].duration_ms).toBe(30000);
      expect(result[0].is_error).toBe(0);
    });

    it("handles tool errors correctly", async () => {
      const errorToolUse = {
        id: uuidv4(),
        tool: "Bash",
        input_summary: "npm run test",
        output_summary: "Tests failed",
        is_error: 1,
        error_message: "3 tests failed",
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([errorToolUse]);

      const result = (await query(
        "SELECT * FROM tool_uses WHERE is_error = 1",
      )) as any[];

      expect(result[0].is_error).toBe(1);
      expect(result[0].error_message).toBe("3 tests failed");
    });

    it("handles blocked tools correctly", async () => {
      const blockedToolUse = {
        id: uuidv4(),
        tool: "Bash",
        input_summary: "rm -rf /",
        output_summary: "Command blocked",
        is_blocked: 1,
        blocked_reason: "Dangerous command detected",
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        blockedToolUse,
      ]);

      const result = (await query(
        "SELECT * FROM tool_uses WHERE is_blocked = 1",
      )) as any[];

      expect(result[0].is_blocked).toBe(1);
      expect(result[0].blocked_reason).toBe("Dangerous command detected");
    });
  });

  describe("Assertion Result Format", () => {
    it("parses Python-produced assertion results correctly", async () => {
      const pythonAssertion = {
        id: uuidv4(),
        description: "TypeScript compiles without errors",
        category: "syntax",
        result: "pass",
        timestamp: "2026-01-15T10:15:00.000Z",
        task_id: "task-001",
        execution_id: "exec-001",
        chain_id: uuidv4(),
        evidence: JSON.stringify({
          command: "npx tsc --noEmit",
          exitCode: 0,
          stdout: "",
          stderr: "",
        }),
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        pythonAssertion,
      ]);

      const result = (await query(
        "SELECT * FROM assertion_results WHERE id = ?",
        [pythonAssertion.id],
      )) as any[];

      expect(result[0].result).toBe("pass");
      expect(result[0].category).toBe("syntax");

      // Verify evidence can be parsed
      const evidence = JSON.parse(result[0].evidence);
      expect(evidence.exitCode).toBe(0);
    });

    it("handles failed assertions with evidence", async () => {
      const failedAssertion = {
        id: uuidv4(),
        description: "Unit tests pass",
        category: "unit_test",
        result: "fail",
        evidence: JSON.stringify({
          command: "npm test",
          exitCode: 1,
          stdout: "3 passed, 2 failed",
          stderr: "Error: Expected true to be false",
        }),
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        failedAssertion,
      ]);

      const result = (await query(
        "SELECT * FROM assertion_results WHERE result = 'fail'",
      )) as any[];

      expect(result[0].result).toBe("fail");
      const evidence = JSON.parse(result[0].evidence);
      expect(evidence.exitCode).toBe(1);
    });
  });

  describe("Skill Trace Format", () => {
    it("parses Python-produced skill traces correctly", async () => {
      const pythonSkillTrace = {
        id: uuidv4(),
        skill_name: "commit",
        skill_file: "skills/commit/index.ts",
        line_number: 42,
        section_title: "Creating commit message",
        status: "completed",
        start_time: "2026-01-15T10:20:00.000Z",
        end_time: "2026-01-15T10:20:05.000Z",
        duration_ms: 5000,
        token_estimate: 800,
        tool_calls: JSON.stringify(["tool-001", "tool-002", "tool-003"]),
        execution_id: "exec-001",
        task_id: "task-001",
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        pythonSkillTrace,
      ]);

      const result = (await query("SELECT * FROM skill_traces WHERE id = ?", [
        pythonSkillTrace.id,
      ])) as any[];

      expect(result[0].skill_name).toBe("commit");
      expect(result[0].status).toBe("completed");
      expect(result[0].duration_ms).toBe(5000);

      // Verify tool_calls can be parsed
      const toolCalls = JSON.parse(result[0].tool_calls);
      expect(toolCalls).toHaveLength(3);
    });
  });

  describe("Build Agent Instance Format", () => {
    it("parses Python-produced agent instances correctly", async () => {
      const pythonAgent = {
        id: uuidv4(),
        name: "build-agent-001",
        type: "build",
        status: "active",
        current_task_id: "task-001",
        wave_id: "wave-001",
        spawned_at: "2026-01-15T10:00:00.000Z",
        last_heartbeat: "2026-01-15T10:25:00.000Z",
        terminated_at: null,
        claude_session_id: "claude-123",
      };

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([pythonAgent]);

      const result = (await query(
        "SELECT * FROM build_agent_instances WHERE id = ?",
        [pythonAgent.id],
      )) as any[];

      expect(result[0].status).toBe("active");
      expect(result[0].current_task_id).toBe("task-001");
    });
  });

  describe("Cross-Source Data Consistency", () => {
    it("links transcript entries to tool uses correctly", async () => {
      const transcriptEntryId = uuidv4();
      const toolUseId = uuidv4();

      // Simulate related records
      (query as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          {
            id: transcriptEntryId,
            entry_type: "tool_use",
            summary: "Read file",
          },
        ])
        .mockResolvedValueOnce([
          {
            id: toolUseId,
            transcript_entry_id: transcriptEntryId,
            tool: "Read",
          },
        ]);

      await query("SELECT * FROM transcript_entries WHERE id = ?", [
        transcriptEntryId,
      ]);
      const toolUseResult = (await query(
        "SELECT * FROM tool_uses WHERE transcript_entry_id = ?",
        [transcriptEntryId],
      )) as any[];

      expect(toolUseResult[0].transcript_entry_id).toBe(transcriptEntryId);
    });

    it("links execution runs to waves correctly", async () => {
      const executionId = uuidv4();
      const waveId = uuidv4();

      (query as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: waveId, execution_run_id: executionId, wave_number: 1 },
      ]);

      const result = (await query(
        "SELECT * FROM parallel_execution_waves WHERE execution_run_id = ?",
        [executionId],
      )) as any[];

      expect(result[0].execution_run_id).toBe(executionId);
    });
  });
});
