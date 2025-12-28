import { BudgetExceededError } from './errors.js';

// Claude Opus 4.5 pricing (as of 2025)
const PRICING = {
  inputPerMillion: 15.00,  // $15 per 1M input tokens
  outputPerMillion: 75.00  // $75 per 1M output tokens
};

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface CostReport {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  budgetRemaining: number;
  apiCalls: number;
}

export interface CostLogEntry {
  operation: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
}

/**
 * Tracks API costs and enforces budget limits
 */
export class CostTracker {
  private inputTokens = 0;
  private outputTokens = 0;
  private budget: number;
  private apiCalls = 0;
  private log: CostLogEntry[] = [];

  constructor(budgetDollars: number = 10.00) {
    this.budget = budgetDollars;
  }

  /**
   * Track token usage from an API call
   */
  track(usage: TokenUsage, operation: string = 'unknown'): void {
    this.inputTokens += usage.input_tokens;
    this.outputTokens += usage.output_tokens;
    this.apiCalls++;

    const cost = this.calculateCost(usage.input_tokens, usage.output_tokens);
    this.log.push({
      operation,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cost,
      timestamp: new Date()
    });
  }

  /**
   * Calculate cost for given token counts
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * PRICING.inputPerMillion;
    const outputCost = (outputTokens / 1_000_000) * PRICING.outputPerMillion;
    return inputCost + outputCost;
  }

  /**
   * Get total estimated cost so far
   */
  getEstimatedCost(): number {
    return this.calculateCost(this.inputTokens, this.outputTokens);
  }

  /**
   * Check if budget is exceeded and throw if so
   */
  checkBudget(): void {
    const cost = this.getEstimatedCost();
    if (cost >= this.budget) {
      throw new BudgetExceededError(cost, this.budget);
    }
  }

  /**
   * Get remaining budget
   */
  getBudgetRemaining(): number {
    return Math.max(0, this.budget - this.getEstimatedCost());
  }

  /**
   * Get a full cost report
   */
  getReport(): CostReport {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      estimatedCost: this.getEstimatedCost(),
      budgetRemaining: this.getBudgetRemaining(),
      apiCalls: this.apiCalls
    };
  }

  /**
   * Get the log of all operations
   */
  getLog(): CostLogEntry[] {
    return [...this.log];
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.apiCalls = 0;
    this.log = [];
  }

  /**
   * Set a new budget
   */
  setBudget(budgetDollars: number): void {
    this.budget = budgetDollars;
  }

  /**
   * Get current budget
   */
  getBudget(): number {
    return this.budget;
  }

  /**
   * Check if within budget without throwing
   */
  isWithinBudget(): boolean {
    return this.getEstimatedCost() < this.budget;
  }

  /**
   * Estimate cost for a planned operation
   */
  static estimateCost(estimatedInputTokens: number, estimatedOutputTokens: number): number {
    const inputCost = (estimatedInputTokens / 1_000_000) * PRICING.inputPerMillion;
    const outputCost = (estimatedOutputTokens / 1_000_000) * PRICING.outputPerMillion;
    return inputCost + outputCost;
  }
}
