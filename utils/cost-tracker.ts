import { BudgetExceededError, ApiCallLimitError } from "./errors.js";

// Claude model pricing (as of 2025)
// https://www.anthropic.com/pricing
interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Opus 4.6
  "claude-opus-4-6": { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  // Opus 4.5
  "claude-opus-4-5-20251101": { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  "claude-opus-4-5": { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  // Sonnet 4
  "claude-sonnet-4-20250514": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "claude-sonnet-4": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  // Sonnet 3.5
  "claude-3-5-sonnet-20241022": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
  },
  "claude-3-5-sonnet": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  // Haiku 3.5
  "claude-3-5-haiku-20241022": { inputPerMillion: 1.0, outputPerMillion: 5.0 },
  "claude-3-5-haiku": { inputPerMillion: 1.0, outputPerMillion: 5.0 },
  // Haiku 3
  "claude-3-haiku-20240307": { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  "claude-3-haiku": { inputPerMillion: 0.25, outputPerMillion: 1.25 },
};

// Default pricing (Sonnet as a reasonable default)
const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3.0,
  outputPerMillion: 15.0,
};

function getPricingForModel(model?: string): ModelPricing {
  if (!model) return DEFAULT_PRICING;
  // Try exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  // Try partial match (e.g., 'claude-sonnet-4' matches 'claude-sonnet-4-20250514')
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key) || key.startsWith(model)) {
      return pricing;
    }
  }
  // Try fuzzy match for model family
  if (model.includes("opus")) return MODEL_PRICING["claude-opus-4-6"];
  if (model.includes("sonnet")) return MODEL_PRICING["claude-sonnet-4"];
  if (model.includes("haiku")) return MODEL_PRICING["claude-3-5-haiku"];
  return DEFAULT_PRICING;
}

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
  request?: ApiRequestData;
  response?: ApiResponseData;
}

/** Request data for API call logging */
export interface ApiRequestData {
  model?: string;
  system?: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
}

/** Response data for API call logging */
export interface ApiResponseData {
  content: string;
  stop_reason?: string;
}

/** Callback type for API call notifications */
export type ApiCallCallback = (
  operation: string,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  request?: ApiRequestData,
  response?: ApiResponseData,
) => void;

/**
 * Tracks API costs and enforces budget limits
 */
export class CostTracker {
  private inputTokens = 0;
  private outputTokens = 0;
  private budget: number;
  private apiCalls = 0;
  private log: CostLogEntry[] = [];
  private unlimitedMode: boolean;
  private maxApiCalls?: number;
  private pricing: ModelPricing;
  private model: string;
  private apiCallCallback?: ApiCallCallback;

  constructor(
    budgetDollars: number = 10.0,
    unlimited: boolean = false,
    maxApiCalls?: number,
    model?: string,
  ) {
    this.budget = budgetDollars;
    this.unlimitedMode = unlimited;
    this.maxApiCalls = maxApiCalls;
    this.model = model || "claude-sonnet-4";
    this.pricing = getPricingForModel(model);
  }

  /**
   * Set a callback to be invoked on each API call
   * Useful for broadcasting API call details to WebSocket clients
   */
  setApiCallCallback(callback: ApiCallCallback | undefined): void {
    this.apiCallCallback = callback;
  }

  /**
   * Set the model and update pricing
   */
  setModel(model: string): void {
    this.model = model;
    this.pricing = getPricingForModel(model);
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Track token usage from an API call
   * @param usage Token usage from API response
   * @param operation Operation name for logging
   * @param request Optional request data for detailed logging
   * @param response Optional response data for detailed logging
   */
  track(
    usage: TokenUsage,
    operation: string = "unknown",
    request?: ApiRequestData,
    response?: ApiResponseData,
  ): void {
    this.inputTokens += usage.input_tokens;
    this.outputTokens += usage.output_tokens;
    this.apiCalls++;

    const cost = this.calculateCost(usage.input_tokens, usage.output_tokens);
    this.log.push({
      operation,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cost,
      timestamp: new Date(),
      request,
      response,
    });

    // Invoke callback if set (for broadcasting API call details)
    if (this.apiCallCallback) {
      this.apiCallCallback(
        operation,
        usage.input_tokens,
        usage.output_tokens,
        cost,
        request,
        response,
      );
    }
  }

  /**
   * Calculate cost for given token counts
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * this.pricing.inputPerMillion;
    const outputCost =
      (outputTokens / 1_000_000) * this.pricing.outputPerMillion;
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
    if (this.unlimitedMode) return; // Skip budget check in unlimited mode
    const cost = this.getEstimatedCost();
    if (cost >= this.budget) {
      throw new BudgetExceededError(cost, this.budget);
    }
  }

  /**
   * Check if API call limit is exceeded and throw if so
   */
  checkApiCallLimit(): void {
    if (this.unlimitedMode) return; // Skip check in unlimited mode
    if (this.maxApiCalls && this.apiCalls >= this.maxApiCalls) {
      throw new ApiCallLimitError(this.apiCalls, this.maxApiCalls);
    }
  }

  /**
   * Get current API call count
   */
  getApiCalls(): number {
    return this.apiCalls;
  }

  /**
   * Get max API calls limit (if set)
   */
  getMaxApiCalls(): number | undefined {
    return this.maxApiCalls;
  }

  /**
   * Set max API calls limit
   */
  setMaxApiCalls(maxCalls: number | undefined): void {
    this.maxApiCalls = maxCalls;
  }

  /**
   * Check if running in unlimited mode
   */
  isUnlimited(): boolean {
    return this.unlimitedMode;
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
      apiCalls: this.apiCalls,
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
  static estimateCost(
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    model?: string,
  ): number {
    const pricing = getPricingForModel(model);
    const inputCost =
      (estimatedInputTokens / 1_000_000) * pricing.inputPerMillion;
    const outputCost =
      (estimatedOutputTokens / 1_000_000) * pricing.outputPerMillion;
    return inputCost + outputCost;
  }
}
