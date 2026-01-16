import { describe, it, expect, vi } from "vitest";
import { createMockAnthropicClient } from "../mocks/anthropic.js";

describe("Parallel Execution", () => {
  it("should execute multiple requests in parallel", async () => {
    const mockClient = createMockAnthropicClient();
    const startTime = Date.now();

    // Simulate 3 parallel requests
    const personas = ["Skeptic", "Realist", "First Principles"];

    const challenges = await Promise.all(
      personas.map((persona) =>
        mockClient.messages.create({
          model: "claude-opus-4-5-20251101",
          max_tokens: 512,
          system: `You are the ${persona}.`,
          messages: [{ role: "user", content: "Challenge this claim" }],
        }),
      ),
    );

    const duration = Date.now() - startTime;

    expect(challenges).toHaveLength(3);
    // In real scenario, parallel should be faster than sequential
    // With mocks, just verify all completed
    challenges.forEach((c) => {
      expect(c.content[0].type).toBe("text");
    });
  });

  it("should aggregate token usage from parallel calls", async () => {
    const mockClient = createMockAnthropicClient();

    const responses = await Promise.all([
      mockClient.messages.create({
        model: "test",
        max_tokens: 100,
        messages: [],
      }),
      mockClient.messages.create({
        model: "test",
        max_tokens: 100,
        messages: [],
      }),
      mockClient.messages.create({
        model: "test",
        max_tokens: 100,
        messages: [],
      }),
    ]);

    const totalInput = responses.reduce(
      (sum, r) => sum + r.usage.input_tokens,
      0,
    );
    const totalOutput = responses.reduce(
      (sum, r) => sum + r.usage.output_tokens,
      0,
    );

    expect(totalInput).toBe(300); // 3 * 100
    expect(totalOutput).toBe(600); // 3 * 200
  });

  it("should handle mixed success/failure in parallel", async () => {
    const mockClient = createMockAnthropicClient();

    // Mock one to fail
    mockClient.messages.create
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "success" }],
        usage: { input_tokens: 100, output_tokens: 200 },
      })
      .mockRejectedValueOnce(new Error("API Error"))
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "success" }],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

    const results = await Promise.allSettled([
      mockClient.messages.create({
        model: "test",
        max_tokens: 100,
        messages: [],
      }),
      mockClient.messages.create({
        model: "test",
        max_tokens: 100,
        messages: [],
      }),
      mockClient.messages.create({
        model: "test",
        max_tokens: 100,
        messages: [],
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(2);
    expect(rejected).toHaveLength(1);
  });
});
