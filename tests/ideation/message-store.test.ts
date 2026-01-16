import { describe, test, expect, beforeEach, vi } from "vitest";
import { MessageStore } from "../../agents/ideation/message-store.js";

// Mock the database
vi.mock("../../database/db.js", () => ({
  getDb: vi.fn(() => ({
    run: vi.fn(),
    exec: vi.fn(() => []),
  })),
  saveDb: vi.fn(() => Promise.resolve()),
}));

describe("MessageStore", () => {
  let messageStore: MessageStore;

  beforeEach(() => {
    messageStore = new MessageStore();
    vi.clearAllMocks();
  });

  describe("add", () => {
    test("PASS: Adds a message with required fields", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "role",
              "content",
              "buttons_shown",
              "button_clicked",
              "form_shown",
              "form_response",
              "web_search_results",
              "token_count",
              "created_at",
            ],
            values: [
              [
                "msg-123",
                "session-123",
                "user",
                "Hello",
                null,
                null,
                null,
                null,
                null,
                10,
                "2024-01-01T00:00:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const message = await messageStore.add({
        sessionId: "session-123",
        role: "user",
        content: "Hello",
      });

      expect(mockDb.run).toHaveBeenCalled();
      expect(saveDb).toHaveBeenCalled();
    });

    test("PASS: Adds message with buttons", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "role",
              "content",
              "buttons_shown",
              "button_clicked",
              "form_shown",
              "form_response",
              "web_search_results",
              "token_count",
              "created_at",
            ],
            values: [
              [
                "msg-123",
                "session-123",
                "assistant",
                "Choose one",
                '[{"id":"btn1","label":"Option 1"}]',
                null,
                null,
                null,
                null,
                20,
                "2024-01-01T00:00:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const message = await messageStore.add({
        sessionId: "session-123",
        role: "assistant",
        content: "Choose one",
        buttonsShown: [
          { id: "btn1", label: "Option 1", value: "opt1", style: "primary" },
        ],
      });

      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe("get", () => {
    test("PASS: Returns null for non-existent message", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const message = await messageStore.get("non-existent");

      expect(message).toBeNull();
    });

    test("PASS: Returns message for valid ID", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "role",
              "content",
              "buttons_shown",
              "button_clicked",
              "form_shown",
              "form_response",
              "web_search_results",
              "token_count",
              "created_at",
            ],
            values: [
              [
                "msg-123",
                "session-123",
                "user",
                "Hello",
                null,
                null,
                null,
                null,
                null,
                10,
                "2024-01-01T00:00:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const message = await messageStore.get("msg-123");

      expect(message).not.toBeNull();
      expect(message?.id).toBe("msg-123");
    });
  });

  describe("getBySession", () => {
    test("PASS: Returns empty array for no messages", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const messages = await messageStore.getBySession("session-123");

      expect(messages).toHaveLength(0);
    });

    test("PASS: Returns messages in order", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "role",
              "content",
              "buttons_shown",
              "button_clicked",
              "form_shown",
              "form_response",
              "web_search_results",
              "token_count",
              "created_at",
            ],
            values: [
              [
                "msg-1",
                "session-123",
                "user",
                "First",
                null,
                null,
                null,
                null,
                null,
                10,
                "2024-01-01T00:00:00.000Z",
              ],
              [
                "msg-2",
                "session-123",
                "assistant",
                "Second",
                null,
                null,
                null,
                null,
                null,
                20,
                "2024-01-01T00:01:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const messages = await messageStore.getBySession("session-123");

      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
    });
  });

  describe("getRecent", () => {
    test("PASS: Returns limited messages", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: [
              "id",
              "session_id",
              "role",
              "content",
              "buttons_shown",
              "button_clicked",
              "form_shown",
              "form_response",
              "web_search_results",
              "token_count",
              "created_at",
            ],
            values: [
              [
                "msg-1",
                "session-123",
                "user",
                "Recent 1",
                null,
                null,
                null,
                null,
                null,
                10,
                "2024-01-01T00:00:00.000Z",
              ],
              [
                "msg-2",
                "session-123",
                "assistant",
                "Recent 2",
                null,
                null,
                null,
                null,
                null,
                20,
                "2024-01-01T00:01:00.000Z",
              ],
            ],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const messages = await messageStore.getRecent("session-123", 2);

      expect(messages.length).toBeLessThanOrEqual(2);
    });
  });

  describe("recordButtonClick", () => {
    test("PASS: Records button click on message", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      await messageStore.recordButtonClick("msg-123", "btn-1");

      expect(mockDb.run).toHaveBeenCalled();
      expect(saveDb).toHaveBeenCalled();
    });
  });

  describe("recordFormResponse", () => {
    test("PASS: Records form response on message", async () => {
      const { getDb, saveDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      await messageStore.recordFormResponse("msg-123", { field1: "value1" });

      expect(mockDb.run).toHaveBeenCalled();
      expect(saveDb).toHaveBeenCalled();
    });
  });

  describe("getTotalTokens", () => {
    test("PASS: Returns 0 for no messages", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: ["total"],
            values: [[0]],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const total = await messageStore.getTotalTokens("session-123");

      expect(total).toBe(0);
    });

    test("PASS: Returns sum of token counts", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: ["total"],
            values: [[1500]],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const total = await messageStore.getTotalTokens("session-123");

      expect(total).toBe(1500);
    });
  });

  describe("count", () => {
    test("PASS: Returns 0 for no messages", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: ["count"],
            values: [[0]],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const count = await messageStore.count("session-123");

      expect(count).toBe(0);
    });

    test("PASS: Returns message count", async () => {
      const { getDb } = await import("../../database/db.js");
      const mockDb = {
        run: vi.fn(),
        exec: vi.fn().mockReturnValue([
          {
            columns: ["count"],
            values: [[15]],
          },
        ]),
      };
      vi.mocked(getDb).mockReturnValue(
        mockDb as unknown as ReturnType<typeof getDb>,
      );

      const count = await messageStore.count("session-123");

      expect(count).toBe(15);
    });
  });
});
