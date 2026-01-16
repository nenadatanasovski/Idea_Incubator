import { describe, test, expect, beforeEach, vi } from "vitest";
import { MemoryManager } from "../../agents/ideation/memory-manager.js";
import {
  createDefaultSelfDiscoveryState,
  createDefaultMarketDiscoveryState,
  createDefaultNarrowingState,
} from "../../utils/ideation-defaults.js";

// Mock the database
vi.mock("../../database/db.js", () => ({
  getDb: vi.fn(() => ({
    run: vi.fn(),
    exec: vi.fn(() => []),
  })),
  saveDb: vi.fn(() => Promise.resolve()),
}));

describe("MemoryManager", () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager();
    vi.clearAllMocks();
  });

  describe("upsert", () => {
    test("PASS: Creates new memory file if not exists", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi
          .fn()
          .mockReturnValueOnce([]) // Check for existing
          .mockReturnValueOnce([
            {
              // Get created file
              columns: [
                "id",
                "session_id",
                "file_type",
                "content",
                "version",
                "created_at",
                "updated_at",
              ],
              values: [
                [
                  "file-123",
                  "session-123",
                  "self_discovery",
                  "# Self-Discovery",
                  1,
                  "2024-01-01T00:00:00.000Z",
                  "2024-01-01T00:00:00.000Z",
                ],
              ],
            },
          ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const file = await memoryManager.upsert(
        "session-123",
        "self_discovery",
        "# Self-Discovery",
      );

      expect(mockDb.run).toHaveBeenCalled();
      expect(saveDb).toHaveBeenCalled();
    });

    test("PASS: Updates existing memory file", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi
          .fn()
          .mockReturnValueOnce([
            {
              // Existing file found
              columns: ["id", "version"],
              values: [["file-123", 1]],
            },
          ])
          .mockReturnValueOnce([
            {
              // Get updated file
              columns: [
                "id",
                "session_id",
                "file_type",
                "content",
                "version",
                "created_at",
                "updated_at",
              ],
              values: [
                [
                  "file-123",
                  "session-123",
                  "self_discovery",
                  "# Updated",
                  2,
                  "2024-01-01T00:00:00.000Z",
                  "2024-01-01T00:01:00.000Z",
                ],
              ],
            },
          ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const file = await memoryManager.upsert(
        "session-123",
        "self_discovery",
        "# Updated",
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    test("PASS: Increments version on update", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi
          .fn()
          .mockReturnValueOnce([
            {
              columns: ["id", "version"],
              values: [["file-123", 2]],
            },
          ])
          .mockReturnValueOnce([
            {
              columns: [
                "id",
                "session_id",
                "file_type",
                "content",
                "version",
                "created_at",
                "updated_at",
              ],
              values: [
                [
                  "file-123",
                  "session-123",
                  "self_discovery",
                  "# Updated",
                  3,
                  "2024-01-01T00:00:00.000Z",
                  "2024-01-01T00:01:00.000Z",
                ],
              ],
            },
          ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const file = await memoryManager.upsert(
        "session-123",
        "self_discovery",
        "# Updated",
      );

      expect(file?.version).toBe(3);
    });
  });

  describe("get", () => {
    test("PASS: Returns null for non-existent file", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const file = await memoryManager.get("non-existent");

      expect(file).toBeNull();
    });

    test("PASS: Returns memory file for valid ID", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "file_type",
              "content",
              "version",
              "created_at",
              "updated_at",
            ],
            values: [
              [
                "file-123",
                "session-123",
                "self_discovery",
                "# Content",
                1,
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const file = await memoryManager.get("file-123");

      expect(file).not.toBeNull();
      expect(file?.id).toBe("file-123");
    });
  });

  describe("getByType", () => {
    test("PASS: Returns null for non-existent type", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const file = await memoryManager.getByType(
        "session-123",
        "self_discovery",
      );

      expect(file).toBeNull();
    });

    test("PASS: Returns file for type", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "file_type",
              "content",
              "version",
              "created_at",
              "updated_at",
            ],
            values: [
              [
                "file-123",
                "session-123",
                "self_discovery",
                "# Content",
                1,
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const file = await memoryManager.getByType(
        "session-123",
        "self_discovery",
      );

      expect(file).not.toBeNull();
      expect(file?.fileType).toBe("self_discovery");
    });
  });

  describe("getAll", () => {
    test("PASS: Returns empty array for no files", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const files = await memoryManager.getAll("session-123");

      expect(files).toHaveLength(0);
    });

    test("PASS: Returns all files for session", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "file_type",
              "content",
              "version",
              "created_at",
              "updated_at",
            ],
            values: [
              [
                "file-1",
                "session-123",
                "self_discovery",
                "# Self",
                1,
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
              ],
              [
                "file-2",
                "session-123",
                "market_discovery",
                "# Market",
                1,
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const files = await memoryManager.getAll("session-123");

      expect(files.length).toBe(2);
    });
  });

  describe("updateAll", () => {
    test("PASS: Updates all memory file types", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "file_type",
              "content",
              "version",
              "created_at",
              "updated_at",
            ],
            values: [
              [
                "file-123",
                "session-123",
                "self_discovery",
                "# Content",
                1,
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      await memoryManager.updateAll("session-123", {
        selfDiscovery: createDefaultSelfDiscoveryState(),
        marketDiscovery: createDefaultMarketDiscoveryState(),
        narrowingState: createDefaultNarrowingState(),
        candidate: null,
        viability: { total: 100, risks: [] },
      });

      // Should have called run multiple times for different file types
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe("loadState", () => {
    test("PASS: Returns default state for new session", async () => {
      const state = await memoryManager.loadState("session-123");

      expect(state.selfDiscovery).toBeDefined();
      expect(state.marketDiscovery).toBeDefined();
      expect(state.narrowingState).toBeDefined();
    });
  });

  describe("createHandoffSummary", () => {
    test("PASS: Creates handoff notes", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "file_type",
              "content",
              "version",
              "created_at",
              "updated_at",
            ],
            values: [
              [
                "file-123",
                "session-123",
                "handoff_notes",
                "# Handoff",
                1,
                "2024-01-01T00:00:00.000Z",
                "2024-01-01T00:00:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      await memoryManager.createHandoffSummary(
        "session-123",
        "We discussed coworking spaces",
      );

      expect(mockDb.run).toHaveBeenCalled();
    });
  });
});
