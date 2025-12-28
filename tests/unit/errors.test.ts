import { describe, it, expect } from 'vitest';
import {
  IdeaIncubatorError,
  IdeaNotFoundError,
  EvaluationParseError,
  APIRateLimitError,
  BudgetExceededError,
  ConvergenceTimeoutError,
  ValidationError,
  DatabaseError,
  SyncError,
  MarkdownParseError,
  ConfigurationError
} from '../../utils/errors.js';

describe('Error Classes', () => {
  describe('IdeaIncubatorError', () => {
    it('should be an instance of Error', () => {
      const error = new IdeaIncubatorError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('IdeaIncubatorError');
      expect(error.message).toBe('Test error');
    });
  });

  describe('IdeaNotFoundError', () => {
    it('should include slug in message', () => {
      const error = new IdeaNotFoundError('solar-charger');
      expect(error.message).toBe('Idea not found: solar-charger');
      expect(error.slug).toBe('solar-charger');
    });

    it('should be instance of IdeaIncubatorError', () => {
      const error = new IdeaNotFoundError('test');
      expect(error).toBeInstanceOf(IdeaIncubatorError);
    });
  });

  describe('EvaluationParseError', () => {
    it('should include parse details', () => {
      const error = new EvaluationParseError('invalid JSON');
      expect(error.message).toContain('Failed to parse evaluation');
      expect(error.message).toContain('invalid JSON');
    });
  });

  describe('APIRateLimitError', () => {
    it('should include retry after', () => {
      const error = new APIRateLimitError(30);
      expect(error.message).toContain('30 seconds');
      expect(error.retryAfter).toBe(30);
    });

    it('should handle unknown retry time', () => {
      const error = new APIRateLimitError();
      expect(error.message).toContain('unknown');
      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('BudgetExceededError', () => {
    it('should include spent and budget amounts', () => {
      const error = new BudgetExceededError(12.50, 10.00);
      expect(error.message).toContain('$12.50');
      expect(error.message).toContain('$10.00');
      expect(error.spent).toBe(12.50);
      expect(error.budget).toBe(10.00);
    });
  });

  describe('ConvergenceTimeoutError', () => {
    it('should include round counts', () => {
      const error = new ConvergenceTimeoutError(5, 5);
      expect(error.message).toContain('5 rounds');
      expect(error.message).toContain('max 5');
      expect(error.rounds).toBe(5);
      expect(error.maxRounds).toBe(5);
    });
  });

  describe('ValidationError', () => {
    it('should include field name', () => {
      const error = new ValidationError('email', 'must be valid email');
      expect(error.message).toContain('email');
      expect(error.message).toContain('must be valid email');
      expect(error.field).toBe('email');
    });
  });

  describe('DatabaseError', () => {
    it('should include operation name', () => {
      const error = new DatabaseError('insert', 'duplicate key');
      expect(error.message).toContain('insert');
      expect(error.message).toContain('duplicate key');
      expect(error.operation).toBe('insert');
    });
  });

  describe('SyncError', () => {
    it('should include file path when provided', () => {
      const error = new SyncError('failed to parse', 'ideas/test/README.md');
      expect(error.message).toContain('ideas/test/README.md');
      expect(error.filePath).toBe('ideas/test/README.md');
    });

    it('should work without file path', () => {
      const error = new SyncError('general sync failure');
      expect(error.filePath).toBeUndefined();
    });
  });

  describe('MarkdownParseError', () => {
    it('should include file path', () => {
      const error = new MarkdownParseError('ideas/test/README.md', 'invalid frontmatter');
      expect(error.message).toContain('ideas/test/README.md');
      expect(error.message).toContain('invalid frontmatter');
      expect(error.filePath).toBe('ideas/test/README.md');
    });
  });

  describe('ConfigurationError', () => {
    it('should include config key', () => {
      const error = new ConfigurationError('budget.default', 'must be positive');
      expect(error.message).toContain('budget.default');
      expect(error.message).toContain('must be positive');
      expect(error.configKey).toBe('budget.default');
    });
  });
});
