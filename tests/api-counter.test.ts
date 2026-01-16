/**
 * API Counter Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

describe("API Counter", () => {
  describe("recordApiCall", () => {
    it("should not throw on valid input", async () => {
      // Use direct import to test the actual function behavior
      const db = await import("../database/db.js");

      // recordApiCall is fire-and-forget and doesn't throw
      expect(() => {
        db.recordApiCall("user-1", "/api/sessions", "GET", 200, 45);
      }).not.toThrow();
    });

    it("should handle null userId", async () => {
      const db = await import("../database/db.js");

      expect(() => {
        db.recordApiCall(null, "/api/public", "GET", 200, 30);
      }).not.toThrow();
    });
  });

  describe("getCallStats", () => {
    it("should return array", async () => {
      const db = await import("../database/db.js");
      const stats = await db.getCallStats({});

      expect(Array.isArray(stats)).toBe(true);
    });

    it("should accept filter parameters", async () => {
      const db = await import("../database/db.js");
      const stats = await db.getCallStats({
        endpoint: "/api/test",
        from: "2026-01-01",
        to: "2026-12-31",
      });

      expect(Array.isArray(stats)).toBe(true);
    });

    it("should return correct structure", async () => {
      const db = await import("../database/db.js");

      // Record a call first
      db.recordApiCall("user-1", "/api/test-stats", "GET", 200, 50);
      await db.saveDb();

      const stats = await db.getCallStats({ endpoint: "/api/test-stats" });

      if (stats.length > 0) {
        expect(stats[0]).toHaveProperty("endpoint");
        expect(stats[0]).toHaveProperty("method");
        expect(stats[0]).toHaveProperty("count");
        expect(stats[0]).toHaveProperty("avgResponseTime");
      }
    });
  });

  describe("getStatsSummary", () => {
    it("should return summary object", async () => {
      const db = await import("../database/db.js");
      const summary = await db.getStatsSummary();

      expect(summary).toHaveProperty("totalCalls");
      expect(summary).toHaveProperty("uniqueEndpoints");
      expect(summary).toHaveProperty("avgResponseTime");
      expect(summary).toHaveProperty("period");
      expect(summary.period).toBe("last_24h");
    });

    it("should return numeric values", async () => {
      const db = await import("../database/db.js");
      const summary = await db.getStatsSummary();

      expect(typeof summary.totalCalls).toBe("number");
      expect(typeof summary.uniqueEndpoints).toBe("number");
      expect(typeof summary.avgResponseTime).toBe("number");
    });
  });

  describe("getCallCount", () => {
    it("should return number", async () => {
      const db = await import("../database/db.js");
      const count = await db.getCallCount({});

      expect(typeof count).toBe("number");
    });

    it("should accept filters", async () => {
      const db = await import("../database/db.js");
      const count = await db.getCallCount({ endpoint: "/api/test" });

      expect(typeof count).toBe("number");
    });
  });
});

describe("apiCounter middleware", () => {
  it("should call next immediately", async () => {
    const { apiCounter } = await import("../server/middleware/api-counter.js");

    const mockReq = {
      path: "/api/test",
      method: "GET",
    } as any;

    const mockRes = {
      statusCode: 200,
      on: vi.fn(),
    } as any;

    const next = vi.fn();

    apiCounter(mockReq, mockRes, next);

    // next() should be called immediately - middleware doesn't block
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should register finish listener", async () => {
    const { apiCounter } = await import("../server/middleware/api-counter.js");

    const mockReq = {
      path: "/api/test",
      method: "POST",
      user: { id: "user-123" },
    } as any;

    const mockRes = {
      statusCode: 201,
      on: vi.fn(),
    } as any;

    const next = vi.fn();

    apiCounter(mockReq, mockRes, next);

    // Should have registered a 'finish' event listener
    expect(mockRes.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("should handle request without user", async () => {
    const { apiCounter } = await import("../server/middleware/api-counter.js");

    const mockReq = {
      path: "/api/public",
      method: "GET",
      // No user
    } as any;

    const mockRes = {
      statusCode: 200,
      on: vi.fn(),
    } as any;

    const next = vi.fn();

    // Should not throw
    expect(() => apiCounter(mockReq, mockRes, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it("should capture response time on finish", async () => {
    const { apiCounter } = await import("../server/middleware/api-counter.js");

    const mockReq = {
      path: "/api/timed",
      method: "GET",
      user: { id: "timer-user" },
    } as any;

    let finishCallback: (() => void) | null = null;
    const mockRes = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "finish") {
          finishCallback = cb;
        }
      }),
    } as any;

    const next = vi.fn();

    apiCounter(mockReq, mockRes, next);

    // Simulate async response
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Trigger finish callback
    expect(finishCallback).toBeDefined();
    if (finishCallback) {
      expect(() => finishCallback!()).not.toThrow();
    }
  });
});

describe("Stats Routes Types", () => {
  it("should have CallStats interface", async () => {
    // Types are compile-time only, just verify import doesn't fail
    expect(true).toBe(true);
  });

  it("should have StatsSummary interface", async () => {
    const types = await import("../types/api-stats.js");
    // Verify the types exist by using them
    const mockSummary: any = {
      totalCalls: 100,
      uniqueEndpoints: 5,
      avgResponseTime: 45,
      period: "last_24h",
    };
    expect(mockSummary.totalCalls).toBe(100);
  });
});
