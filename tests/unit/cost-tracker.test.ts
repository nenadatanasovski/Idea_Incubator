import { describe, it, expect, beforeEach } from "vitest";
import { CostTracker } from "../../utils/cost-tracker.js";
import { BudgetExceededError } from "../../utils/errors.js";

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker(10.0);
  });

  it("should initialize with default budget", () => {
    const defaultTracker = new CostTracker();
    expect(defaultTracker.getBudget()).toBe(10.0);
  });

  it("should initialize with custom budget", () => {
    expect(tracker.getBudget()).toBe(10.0);
  });

  it("should track token usage", () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, "test");

    const report = tracker.getReport();
    expect(report.inputTokens).toBe(1000);
    expect(report.outputTokens).toBe(500);
    expect(report.apiCalls).toBe(1);
  });

  it("should accumulate multiple API calls", () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, "test1");
    tracker.track({ input_tokens: 2000, output_tokens: 1000 }, "test2");

    const report = tracker.getReport();
    expect(report.inputTokens).toBe(3000);
    expect(report.outputTokens).toBe(1500);
    expect(report.apiCalls).toBe(2);
  });

  it("should calculate estimated cost correctly", () => {
    // Default is Sonnet 4 pricing: $3/1M input, $15/1M output
    // 100k input = $0.30, 100k output = $1.50
    tracker.track({ input_tokens: 100000, output_tokens: 100000 }, "test");

    const cost = tracker.getEstimatedCost();
    expect(cost).toBeCloseTo(1.8, 2); // $0.30 + $1.50 = $1.80
  });

  it("should check budget and throw when exceeded", () => {
    // Need to exceed $10 budget with Sonnet 4 pricing ($3/1M input, $15/1M output)
    // 500k input = $1.50, 500k output = $7.50 = $9.00 per call
    // 2 calls = $18.00 which exceeds $10
    tracker.track({ input_tokens: 500000, output_tokens: 500000 }, "test1");
    tracker.track({ input_tokens: 500000, output_tokens: 500000 }, "test2");

    expect(() => tracker.checkBudget()).toThrow(BudgetExceededError);
  });

  it("should not throw when within budget", () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, "test");
    expect(() => tracker.checkBudget()).not.toThrow();
  });

  it("should return remaining budget", () => {
    // 100k input = $0.30, 100k output = $1.50, total = $1.80
    // Budget $10 - $1.80 = $8.20 remaining
    tracker.track({ input_tokens: 100000, output_tokens: 100000 }, "test");

    expect(tracker.getBudgetRemaining()).toBeCloseTo(8.2, 2);
  });

  it("should return zero for remaining budget when exceeded", () => {
    tracker.track({ input_tokens: 1000000, output_tokens: 1000000 }, "test");
    expect(tracker.getBudgetRemaining()).toBe(0);
  });

  it("should reset tracker", () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, "test");
    tracker.reset();

    const report = tracker.getReport();
    expect(report.inputTokens).toBe(0);
    expect(report.outputTokens).toBe(0);
    expect(report.apiCalls).toBe(0);
  });

  it("should update budget", () => {
    tracker.setBudget(20.0);
    expect(tracker.getBudget()).toBe(20.0);
  });

  it("should check if within budget without throwing", () => {
    expect(tracker.isWithinBudget()).toBe(true);

    tracker.track({ input_tokens: 1000000, output_tokens: 1000000 }, "test");
    expect(tracker.isWithinBudget()).toBe(false);
  });

  it("should log operations", () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, "evaluation");
    tracker.track({ input_tokens: 2000, output_tokens: 1000 }, "redteam");

    const log = tracker.getLog();
    expect(log).toHaveLength(2);
    expect(log[0].operation).toBe("evaluation");
    expect(log[1].operation).toBe("redteam");
  });

  it("should estimate cost statically", () => {
    // Uses default Sonnet 4 pricing: 100k input = $0.30, 100k output = $1.50
    const estimate = CostTracker.estimateCost(100000, 100000);
    expect(estimate).toBeCloseTo(1.8, 2);
  });
});
