/**
 * Retry Handler for Build Agent
 *
 * Implements exponential backoff with jitter for retrying failed operations.
 */

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000; // 1 second
const DEFAULT_MAX_DELAY = 60000; // 60 seconds
const DEFAULT_JITTER_FACTOR = 0.3;

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

export interface RetryAttempt {
  attempt: number;
  delay: number;
  error?: Error;
  timestamp: string;
}

export type RetryableCheck = (error: unknown) => boolean;

export class RetryHandler {
  private config: RetryConfig;
  private onRetry?: (attempt: RetryAttempt) => void;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelay: config?.baseDelay ?? DEFAULT_BASE_DELAY,
      maxDelay: config?.maxDelay ?? DEFAULT_MAX_DELAY,
      jitterFactor: config?.jitterFactor ?? DEFAULT_JITTER_FACTOR
    };
  }

  /**
   * Execute an operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    isRetryable: RetryableCheck = () => true
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const value = await operation();
        return {
          success: true,
          value,
          attempts: attempt,
          totalDuration: Date.now() - startTime
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!isRetryable(error)) {
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalDuration: Date.now() - startTime
          };
        }

        // If this was the last attempt, don't wait
        if (attempt === this.config.maxRetries) {
          break;
        }

        // Calculate delay and wait
        const delay = this.calculateBackoff(attempt);

        // Notify retry callback
        const attemptInfo: RetryAttempt = {
          attempt,
          delay,
          error: lastError,
          timestamp: new Date().toISOString()
        };
        this.onRetry?.(attemptInfo);

        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: this.config.maxRetries,
      totalDuration: Date.now() - startTime
    };
  }

  /**
   * Execute operation with automatic retry for specific error types
   */
  async withRetryForErrors<T>(
    operation: () => Promise<T>,
    retryableErrors: Array<new (...args: unknown[]) => Error>
  ): Promise<RetryResult<T>> {
    const isRetryable: RetryableCheck = (error) => {
      if (!(error instanceof Error)) return false;
      return retryableErrors.some(ErrorClass => error instanceof ErrorClass);
    };

    return this.withRetry(operation, isRetryable);
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  calculateBackoff(attempt: number): number {
    // Exponential: baseDelay * 2^(attempt-1)
    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt - 1);

    // Apply jitter: delay +/- (jitterFactor * delay)
    const jitter = exponentialDelay * this.config.jitterFactor * (Math.random() * 2 - 1);
    const delayWithJitter = exponentialDelay + jitter;

    // Cap at maxDelay
    return Math.min(delayWithJitter, this.config.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set retry callback
   */
  setOnRetry(callback: (attempt: RetryAttempt) => void): void {
    this.onRetry = callback;
  }

  /**
   * Get current config
   */
  getConfig(): Readonly<RetryConfig> {
    return { ...this.config };
  }

  /**
   * Update config
   */
  updateConfig(updates: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Create a retry handler for network errors
   */
  static forNetworkErrors(config?: Partial<RetryConfig>): RetryHandler {
    const handler = new RetryHandler(config);
    return handler;
  }

  /**
   * Create a retry handler for API rate limits
   */
  static forRateLimits(config?: Partial<RetryConfig>): RetryHandler {
    return new RetryHandler({
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 120000,
      ...config
    });
  }

  /**
   * Common retryable error check - network/timeout errors
   */
  static isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('socket hang up')
    );
  }

  /**
   * Common retryable error check - rate limit errors
   */
  static isRateLimitError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    );
  }

  /**
   * Common retryable error check - temporary errors
   */
  static isTemporaryError(error: unknown): boolean {
    return RetryHandler.isNetworkError(error) || RetryHandler.isRateLimitError(error);
  }
}

/**
 * Create a retry handler instance
 */
export function createRetryHandler(config?: Partial<RetryConfig>): RetryHandler {
  return new RetryHandler(config);
}

/**
 * Execute operation with default retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const handler = new RetryHandler(config);
  const result = await handler.withRetry(operation);

  if (!result.success) {
    throw result.error || new Error('Operation failed after retries');
  }

  return result.value!;
}
