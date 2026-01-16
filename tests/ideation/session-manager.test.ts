import { describe, test, expect, beforeEach, vi } from "vitest";
import { SessionManager } from "../../agents/ideation/session-manager.js";

// Mock the database
vi.mock("../../database/db.js", () => ({
  getDb: vi.fn(() => ({
    run: vi.fn(),
    exec: vi.fn(() => []),
  })),
  saveDb: vi.fn(() => Promise.resolve()),
}));

describe("SessionManager", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
    vi.clearAllMocks();
  });

  describe("create", () => {
    test("PASS: Creates a new session with profile ID", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "test-id",
                "profile-123",
                "active",
                "exploring",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                null,
                0,
                0,
                0,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const session = await sessionManager.create({ profileId: "profile-123" });

      expect(mockDb.run).toHaveBeenCalled();
      expect(saveDb).toHaveBeenCalled();
    });

    test("PASS: Sets status to active", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "test-id",
                "profile-123",
                "active",
                "exploring",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                null,
                0,
                0,
                0,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const session = await sessionManager.create({ profileId: "profile-123" });

      expect(session?.status).toBe("active");
    });

    test("PASS: Sets current phase to exploring", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "test-id",
                "profile-123",
                "active",
                "exploring",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                null,
                0,
                0,
                0,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const session = await sessionManager.create({ profileId: "profile-123" });

      expect(session?.currentPhase).toBe("exploring");
    });
  });

  describe("load", () => {
    test("PASS: Returns null for non-existent session", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const session = await sessionManager.load("non-existent");

      expect(session).toBeNull();
    });

    test("PASS: Returns session for valid ID", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "session-123",
                "profile-123",
                "active",
                "exploring",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                null,
                0,
                0,
                0,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const session = await sessionManager.load("session-123");

      expect(session).not.toBeNull();
      expect(session?.id).toBe("session-123");
    });
  });

  describe("update", () => {
    test("PASS: Updates status field", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "session-123",
                "profile-123",
                "completed",
                "exploring",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                null,
                0,
                0,
                0,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      await sessionManager.update("session-123", { status: "completed" });

      expect(mockDb.run).toHaveBeenCalled();
      expect(saveDb).toHaveBeenCalled();
    });

    test("PASS: Updates multiple fields", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "session-123",
                "profile-123",
                "active",
                "narrowing",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                null,
                0,
                1000,
                10,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      await sessionManager.update("session-123", {
        currentPhase: "narrowing",
        tokenCount: 1000,
        messageCount: 10,
      });

      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe("complete", () => {
    test("PASS: Sets status to completed", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "session-123",
                "profile-123",
                "completed",
                "exploring",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                0,
                0,
                0,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const session = await sessionManager.complete("session-123");

      expect(session?.status).toBe("completed");
      expect(mockDb.run).toHaveBeenCalled();
    });

    test("PASS: Sets completed_at timestamp", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "session-123",
                "profile-123",
                "completed",
                "exploring",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T01:00:00.000Z",
                0,
                0,
                0,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const session = await sessionManager.complete("session-123");

      expect(session?.completedAt).not.toBeNull();
    });
  });

  describe("abandon", () => {
    test("PASS: Sets status to abandoned", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "session-123",
                "profile-123",
                "abandoned",
                "exploring",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                0,
                0,
                0,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const session = await sessionManager.abandon("session-123");

      expect(session?.status).toBe("abandoned");
    });
  });

  describe("getActiveByProfile", () => {
    test("PASS: Returns empty array for no active sessions", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const sessions = await sessionManager.getActiveByProfile("profile-123");

      expect(sessions).toHaveLength(0);
    });

    test("PASS: Returns active sessions for profile", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "profile_id",
              "status",
              "current_phase",
              "entry_mode",
              "started_at",
              "last_activity_at",
              "completed_at",
              "handoff_count",
              "token_count",
              "message_count",
            ],
            values: [
              [
                "session-1",
                "profile-123",
                "active",
                "exploring",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                null,
                0,
                0,
                0,
              ],
              [
                "session-2",
                "profile-123",
                "active",
                "narrowing",
                "discover",
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
                null,
                0,
                0,
                0,
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const sessions = await sessionManager.getActiveByProfile("profile-123");

      expect(sessions.length).toBeGreaterThan(0);
    });
  });

  describe("incrementHandoff", () => {
    test("PASS: Increments handoff count", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      await sessionManager.incrementHandoff("session-123");

      expect(mockDb.run).toHaveBeenCalled();
      expect(saveDb).toHaveBeenCalled();
    });
  });
});
