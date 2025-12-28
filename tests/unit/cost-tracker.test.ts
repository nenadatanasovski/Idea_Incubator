import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker } from '../../utils/cost-tracker.js';
import { BudgetExceededError } from '../../utils/errors.js';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker(10.00);
  });

  it('should initialize with default budget', () => {
    const defaultTracker = new CostTracker();
    expect(defaultTracker.getBudget()).toBe(10.00);
  });

  it('should initialize with custom budget', () => {
    expect(tracker.getBudget()).toBe(10.00);
  });

  it('should track token usage', () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, 'test');

    const report = tracker.getReport();
    expect(report.inputTokens).toBe(1000);
    expect(report.outputTokens).toBe(500);
    expect(report.apiCalls).toBe(1);
  });

  it('should accumulate multiple API calls', () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, 'test1');
    tracker.track({ input_tokens: 2000, output_tokens: 1000 }, 'test2');

    const report = tracker.getReport();
    expect(report.inputTokens).toBe(3000);
    expect(report.outputTokens).toBe(1500);
    expect(report.apiCalls).toBe(2);
  });

  it('should calculate estimated cost correctly', () => {
    // 1M input tokens = $15, 1M output tokens = $75
    // 100k input = $1.50, 100k output = $7.50
    tracker.track({ input_tokens: 100000, output_tokens: 100000 }, 'test');

    const cost = tracker.getEstimatedCost();
    expect(cost).toBeCloseTo(9.00, 2); // $1.50 + $7.50 = $9.00
  });

  it('should check budget and throw when exceeded', () => {
    tracker.track({ input_tokens: 100000, output_tokens: 100000 }, 'test1');
    tracker.track({ input_tokens: 100000, output_tokens: 100000 }, 'test2');

    expect(() => tracker.checkBudget()).toThrow(BudgetExceededError);
  });

  it('should not throw when within budget', () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, 'test');
    expect(() => tracker.checkBudget()).not.toThrow();
  });

  it('should return remaining budget', () => {
    tracker.track({ input_tokens: 100000, output_tokens: 100000 }, 'test');

    expect(tracker.getBudgetRemaining()).toBeCloseTo(1.00, 2);
  });

  it('should return zero for remaining budget when exceeded', () => {
    tracker.track({ input_tokens: 1000000, output_tokens: 1000000 }, 'test');
    expect(tracker.getBudgetRemaining()).toBe(0);
  });

  it('should reset tracker', () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, 'test');
    tracker.reset();

    const report = tracker.getReport();
    expect(report.inputTokens).toBe(0);
    expect(report.outputTokens).toBe(0);
    expect(report.apiCalls).toBe(0);
  });

  it('should update budget', () => {
    tracker.setBudget(20.00);
    expect(tracker.getBudget()).toBe(20.00);
  });

  it('should check if within budget without throwing', () => {
    expect(tracker.isWithinBudget()).toBe(true);

    tracker.track({ input_tokens: 1000000, output_tokens: 1000000 }, 'test');
    expect(tracker.isWithinBudget()).toBe(false);
  });

  it('should log operations', () => {
    tracker.track({ input_tokens: 1000, output_tokens: 500 }, 'evaluation');
    tracker.track({ input_tokens: 2000, output_tokens: 1000 }, 'redteam');

    const log = tracker.getLog();
    expect(log).toHaveLength(2);
    expect(log[0].operation).toBe('evaluation');
    expect(log[1].operation).toBe('redteam');
  });

  it('should estimate cost statically', () => {
    const estimate = CostTracker.estimateCost(100000, 100000);
    expect(estimate).toBeCloseTo(9.00, 2);
  });
});
