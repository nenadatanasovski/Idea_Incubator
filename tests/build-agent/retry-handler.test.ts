/**
 * Retry Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RetryHandler,
  createRetryHandler,
  withRetry
} from '../../agents/build/retry-handler.js';

describe('retry-handler', () => {
  let handler: RetryHandler;

  beforeEach(() => {
    // Use short delays for tests
    handler = new RetryHandler({
      maxRetries: 3,
      baseDelay: 10,
      maxDelay: 100
    });
  });

  describe('constructor', () => {
    it('should create handler with default config', () => {
      const defaultHandler = new RetryHandler();
      const config = defaultHandler.getConfig();

      expect(config.maxRetries).toBe(3);
      expect(config.baseDelay).toBe(1000);
      expect(config.maxDelay).toBe(60000);
      expect(config.jitterFactor).toBe(0.3);
    });

    it('should accept custom config', () => {
      const customHandler = new RetryHandler({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 10000,
        jitterFactor: 0.1
      });
      const config = customHandler.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.baseDelay).toBe(500);
      expect(config.maxDelay).toBe(10000);
      expect(config.jitterFactor).toBe(0.1);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await handler.withRetry(operation);

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await handler.withRetry(operation);

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('always fails'));

      const result = await handler.withRetry(operation);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('always fails');
      expect(result.attempts).toBe(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('permanent error'));
      const isRetryable = vi.fn().mockReturnValue(false);

      const result = await handler.withRetry(operation, isRetryable);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should track total duration', async () => {
      const operation = vi.fn().mockResolvedValue('done');

      const result = await handler.withRetry(operation);

      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      handler.setOnRetry(onRetry);

      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      await handler.withRetry(operation);

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
        attempt: 1,
        delay: expect.any(Number),
        error: expect.any(Error),
        timestamp: expect.any(String)
      }));
    });

    it('should handle non-Error errors', async () => {
      const operation = vi.fn().mockRejectedValue('string error');

      const result = await handler.withRetry(operation);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('string error');
    });
  });

  describe('withRetryForErrors', () => {
    class CustomError extends Error {}
    class AnotherError extends Error {}

    it('should retry for specified error types', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new CustomError('custom'))
        .mockResolvedValue('success');

      const result = await handler.withRetryForErrors(operation, [CustomError] as Array<new (...args: any[]) => Error>);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should not retry for unspecified error types', async () => {
      const operation = vi.fn().mockRejectedValue(new AnotherError('another'));

      const result = await handler.withRetryForErrors(operation, [CustomError] as Array<new (...args: any[]) => Error>);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
    });
  });

  describe('calculateBackoff', () => {
    it('should use exponential backoff', () => {
      const handler = new RetryHandler({
        baseDelay: 100,
        jitterFactor: 0 // No jitter for predictable tests
      });

      const delay1 = handler.calculateBackoff(1);
      const delay2 = handler.calculateBackoff(2);
      const delay3 = handler.calculateBackoff(3);

      expect(delay1).toBe(100);
      expect(delay2).toBe(200);
      expect(delay3).toBe(400);
    });

    it('should cap at maxDelay', () => {
      const handler = new RetryHandler({
        baseDelay: 100,
        maxDelay: 300,
        jitterFactor: 0
      });

      const delay = handler.calculateBackoff(10); // Would be 51200 without cap

      expect(delay).toBe(300);
    });

    it('should add jitter', () => {
      const handler = new RetryHandler({
        baseDelay: 100,
        jitterFactor: 0.5
      });

      // Run multiple times to check jitter varies
      const delays = new Set<number>();
      for (let i = 0; i < 10; i++) {
        delays.add(handler.calculateBackoff(1));
      }

      // With jitter, we should get different values
      expect(delays.size).toBeGreaterThan(1);
    });
  });

  describe('getConfig', () => {
    it('should return config copy', () => {
      const config = handler.getConfig();

      expect(config).toEqual({
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitterFactor: 0.3
      });
    });
  });

  describe('updateConfig', () => {
    it('should update config partially', () => {
      handler.updateConfig({ maxRetries: 5 });

      expect(handler.getConfig().maxRetries).toBe(5);
      expect(handler.getConfig().baseDelay).toBe(10); // Unchanged
    });
  });

  describe('static factory methods', () => {
    it('should create handler for network errors', () => {
      const handler = RetryHandler.forNetworkErrors();
      expect(handler).toBeInstanceOf(RetryHandler);
    });

    it('should create handler for rate limits', () => {
      const handler = RetryHandler.forRateLimits();
      const config = handler.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.baseDelay).toBe(2000);
    });
  });

  describe('static error checks', () => {
    describe('isNetworkError', () => {
      it('should detect network errors', () => {
        expect(RetryHandler.isNetworkError(new Error('network error'))).toBe(true);
        expect(RetryHandler.isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
        expect(RetryHandler.isNetworkError(new Error('socket hang up'))).toBe(true);
        expect(RetryHandler.isNetworkError(new Error('ETIMEDOUT'))).toBe(true);
      });

      it('should return false for non-network errors', () => {
        expect(RetryHandler.isNetworkError(new Error('random error'))).toBe(false);
        expect(RetryHandler.isNetworkError('not an error')).toBe(false);
      });
    });

    describe('isRateLimitError', () => {
      it('should detect rate limit errors', () => {
        expect(RetryHandler.isRateLimitError(new Error('rate limit exceeded'))).toBe(true);
        expect(RetryHandler.isRateLimitError(new Error('too many requests'))).toBe(true);
        expect(RetryHandler.isRateLimitError(new Error('HTTP 429'))).toBe(true);
      });

      it('should return false for non-rate-limit errors', () => {
        expect(RetryHandler.isRateLimitError(new Error('server error'))).toBe(false);
      });
    });

    describe('isTemporaryError', () => {
      it('should detect both network and rate limit errors', () => {
        expect(RetryHandler.isTemporaryError(new Error('network error'))).toBe(true);
        expect(RetryHandler.isTemporaryError(new Error('rate limit'))).toBe(true);
        expect(RetryHandler.isTemporaryError(new Error('permanent error'))).toBe(false);
      });
    });
  });

  describe('createRetryHandler', () => {
    it('should create handler instance', () => {
      const instance = createRetryHandler();
      expect(instance).toBeInstanceOf(RetryHandler);
    });

    it('should pass config', () => {
      const instance = createRetryHandler({ maxRetries: 10 });
      expect(instance.getConfig().maxRetries).toBe(10);
    });
  });

  describe('withRetry helper', () => {
    it('should succeed and return value', async () => {
      const result = await withRetry(() => Promise.resolve('value'), { maxRetries: 2, baseDelay: 10 });
      expect(result).toBe('value');
    });

    it('should throw after failures', async () => {
      await expect(
        withRetry(() => Promise.reject(new Error('fail')), { maxRetries: 2, baseDelay: 10 })
      ).rejects.toThrow('fail');
    });
  });
});
