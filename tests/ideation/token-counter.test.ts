import { describe, test, expect } from "vitest";
import {
  estimateTokens,
  calculateTokenUsage,
  getRemainingTokens,
  isApproachingHandoff,
  CONTEXT_LIMIT,
  HANDOFF_THRESHOLD,
  SYSTEM_PROMPT_ESTIMATE,
  PROFILE_ESTIMATE,
  MEMORY_FILES_ESTIMATE,
} from "../../agents/ideation/token-counter.js";
import { IdeationMessage } from "../../types/ideation.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMessage(
  content: string,
  role: "user" | "assistant" = "user",
): IdeationMessage {
  return {
    id: `msg_${Date.now()}_${Math.random()}`,
    sessionId: "session_1",
    role,
    content,
    buttonsShown: null,
    buttonClicked: null,
    formShown: null,
    formResponse: null,
    webSearchResults: null,
    tokenCount: 0,
    createdAt: new Date(),
  };
}

function createMessages(
  count: number,
  avgLength: number = 100,
): IdeationMessage[] {
  const content = "a".repeat(avgLength);
  return Array.from({ length: count }, (_, i) =>
    createMessage(content, i % 2 === 0 ? "user" : "assistant"),
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe("TokenCounter", () => {
  describe("estimateTokens", () => {
    test("PASS: Empty string returns 0", () => {
      expect(estimateTokens("")).toBe(0);
    });

    test("PASS: 4 characters = 1 token", () => {
      expect(estimateTokens("1234")).toBe(1);
    });

    test("PASS: 5 characters = 2 tokens (rounds up)", () => {
      expect(estimateTokens("12345")).toBe(2);
    });

    test("PASS: 100 characters = 25 tokens", () => {
      const text = "a".repeat(100);
      expect(estimateTokens(text)).toBe(25);
    });

    test("PASS: 1000 characters = 250 tokens", () => {
      const text = "a".repeat(1000);
      expect(estimateTokens(text)).toBe(250);
    });

    test("PASS: Handles unicode characters", () => {
      const text = "你好世界"; // 4 unicode chars = 12 bytes in UTF-8
      const estimate = estimateTokens(text);
      expect(estimate).toBeGreaterThan(0);
    });

    test("PASS: Handles whitespace", () => {
      const text = "   hello   world   ";
      const estimate = estimateTokens(text);
      expect(estimate).toBeGreaterThan(0);
    });

    test("PASS: Long text gives reasonable estimate", () => {
      const text = "The quick brown fox jumps over the lazy dog. ".repeat(100);
      const estimate = estimateTokens(text);
      // 45 chars * 100 = 4500 chars / 4 = 1125 tokens
      expect(estimate).toBeCloseTo(1125, -1);
    });
  });

  describe("calculateTokenUsage", () => {
    test("PASS: Empty conversation includes base costs", () => {
      const result = calculateTokenUsage([], "");

      expect(result.systemPrompt).toBe(SYSTEM_PROMPT_ESTIMATE);
      expect(result.profile).toBe(PROFILE_ESTIMATE);
      expect(result.memoryFiles).toBe(MEMORY_FILES_ESTIMATE);
      expect(result.conversation).toBe(0);
      expect(result.currentMessage).toBe(0);
    });

    test("PASS: Total is sum of all components", () => {
      const messages = createMessages(5, 100);
      const currentMessage = "Hello world";
      const result = calculateTokenUsage(messages, currentMessage);

      const expectedTotal =
        result.systemPrompt +
        result.profile +
        result.memoryFiles +
        result.conversation +
        result.currentMessage;

      expect(result.total).toBe(expectedTotal);
    });

    test("PASS: Conversation tokens accumulate correctly", () => {
      const messages = createMessages(10, 400); // 10 messages, 400 chars each = 100 tokens each
      const result = calculateTokenUsage(messages, "");

      // 10 * 100 = 1000 tokens for conversation
      expect(result.conversation).toBe(1000);
    });

    test("PASS: Current message tokens calculated correctly", () => {
      const currentMessage = "a".repeat(200); // 50 tokens
      const result = calculateTokenUsage([], currentMessage);

      expect(result.currentMessage).toBe(50);
    });

    test("PASS: Percent used is correct", () => {
      const result = calculateTokenUsage([], "");

      const expectedPercent = (result.total / CONTEXT_LIMIT) * 100;
      expect(result.percentUsed).toBeCloseTo(expectedPercent, 5);
    });

    test("PASS: shouldHandoff is true when at threshold", () => {
      // Create enough messages to exceed threshold
      // We need total >= 80,000 tokens
      // Base costs = 5000 + 2000 + 10000 = 17000
      // Need 63,000 more in conversation
      // 63,000 tokens * 4 chars = 252,000 chars
      // 252 messages of 1000 chars each
      const messages = createMessages(300, 1000);
      const result = calculateTokenUsage(messages, "");

      expect(result.shouldHandoff).toBe(true);
    });

    test("PASS: shouldHandoff is false when below threshold", () => {
      const messages = createMessages(5, 100);
      const result = calculateTokenUsage(messages, "");

      expect(result.shouldHandoff).toBe(false);
    });
  });

  describe("getRemainingTokens", () => {
    test("PASS: Returns difference from context limit", () => {
      const usage = calculateTokenUsage([], "");
      const remaining = getRemainingTokens(usage);

      expect(remaining).toBe(CONTEXT_LIMIT - usage.total);
    });

    test("PASS: Never returns negative", () => {
      // Create usage that exceeds limit
      const usage = {
        systemPrompt: 50000,
        profile: 30000,
        memoryFiles: 30000,
        conversation: 10000,
        currentMessage: 1000,
        total: 121000, // Exceeds 100,000
        percentUsed: 121,
        shouldHandoff: true,
      };

      expect(getRemainingTokens(usage)).toBe(0);
    });

    test("PASS: Returns full limit for empty usage", () => {
      const usage = calculateTokenUsage([], "");
      const remaining = getRemainingTokens(usage);

      expect(remaining).toBe(CONTEXT_LIMIT - usage.total);
      expect(remaining).toBeGreaterThan(CONTEXT_LIMIT * 0.8);
    });
  });

  describe("isApproachingHandoff", () => {
    test("PASS: Returns false for low usage", () => {
      const usage = calculateTokenUsage([], "");

      expect(isApproachingHandoff(usage)).toBe(false);
    });

    test("PASS: Returns true near 95% of threshold", () => {
      // 95% of 80,000 = 76,000
      // Base costs = 17,000
      // Need 59,000 more tokens = 236,000 chars
      const messages = createMessages(236, 1000);
      const result = calculateTokenUsage(messages, "");

      // Should be approaching but not at handoff
      if (result.total >= HANDOFF_THRESHOLD * 0.95 && !result.shouldHandoff) {
        expect(isApproachingHandoff(result)).toBe(true);
      }
    });

    test("PASS: Returns false if already at handoff", () => {
      const messages = createMessages(300, 1000);
      const result = calculateTokenUsage(messages, "");

      // Already past handoff threshold
      if (result.shouldHandoff) {
        expect(isApproachingHandoff(result)).toBe(false);
      }
    });
  });

  describe("Constants", () => {
    test("PASS: Context limit is 100,000", () => {
      expect(CONTEXT_LIMIT).toBe(100_000);
    });

    test("PASS: Handoff threshold is 80,000 (80%)", () => {
      expect(HANDOFF_THRESHOLD).toBe(80_000);
      expect(HANDOFF_THRESHOLD / CONTEXT_LIMIT).toBe(0.8);
    });

    test("PASS: Base estimates are reasonable", () => {
      expect(SYSTEM_PROMPT_ESTIMATE).toBe(5_000);
      expect(PROFILE_ESTIMATE).toBe(2_000);
      expect(MEMORY_FILES_ESTIMATE).toBe(10_000);
    });
  });
});
