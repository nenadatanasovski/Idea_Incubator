// tests/sia.test.ts - SIA unit tests

import { describe, it, expect } from 'vitest';
import {
  EXTRACTION_RULES,
  matchExtractionRule,
  inferFilePattern,
  inferActionType,
  matchesFilePattern,
} from '../agents/sia/extraction-rules';
import { calculateSimilarity, shouldMerge } from '../agents/sia/duplicate-detector';
import { CONFIDENCE_CONFIG } from '../agents/sia/confidence-tracker';
import { categorizeError } from '../agents/sia/gotcha-extractor';
import { identifyFailures, identifyRetries } from '../agents/sia/execution-analyzer';
import {
  determineSection,
  formatProposalContent,
  isEligibleForPromotion,
} from '../agents/sia/claude-md-updater';

describe('SIA', () => {
  describe('Extraction Rules', () => {
    it('should have predefined rules', () => {
      expect(EXTRACTION_RULES.length).toBeGreaterThan(0);
    });

    it('should match sqlite date errors', () => {
      const rule = EXTRACTION_RULES.find((r) => r.name === 'sqlite-date-type');
      expect(rule).toBeDefined();
      expect(rule?.errorPattern.test('DATETIME not supported')).toBe(true);
      expect(rule?.errorPattern.test('invalid date format')).toBe(true);
    });

    it('should match import extension errors', () => {
      const rule = EXTRACTION_RULES.find((r) => r.name === 'import-extension');
      expect(rule).toBeDefined();
      expect(rule?.errorPattern.test('Cannot find module')).toBe(true);
      expect(rule?.errorPattern.test('ERR_MODULE_NOT_FOUND')).toBe(true);
    });

    it('should match sql-js API errors', () => {
      const rule = EXTRACTION_RULES.find((r) => r.name === 'sql-js-async-getdb');
      expect(rule).toBeDefined();
      expect(rule?.errorPattern.test('prepare is not a function on Promise')).toBe(true);
    });

    it('should match express return type errors', () => {
      const rule = EXTRACTION_RULES.find((r) => r.name === 'express-return-type');
      expect(rule).toBeDefined();
      expect(rule?.errorPattern.test('error TS7030: Not all code paths')).toBe(true);
    });
  });

  describe('matchExtractionRule', () => {
    it('should return matching rule for error', () => {
      const rule = matchExtractionRule('Cannot find module "./utils"');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('import-extension');
    });

    it('should return null for unknown error', () => {
      const rule = matchExtractionRule('Some random error that does not match');
      expect(rule).toBeNull();
    });

    it('should filter by file pattern when provided', () => {
      const rule = matchExtractionRule(
        'DATETIME not supported',
        'database/migrations/001.sql'
      );
      expect(rule).toBeDefined();
      expect(rule?.filePattern).toBe('*.sql');
    });
  });

  describe('inferFilePattern', () => {
    it('should infer SQL pattern', () => {
      expect(inferFilePattern('database/migrations/001.sql')).toBe('*.sql');
    });

    it('should infer route pattern', () => {
      expect(inferFilePattern('server/routes/users.ts')).toBe('server/routes/*.ts');
    });

    it('should infer test pattern', () => {
      expect(inferFilePattern('tests/api.test.ts')).toBe('tests/*.ts');
    });

    it('should infer generic TS pattern', () => {
      expect(inferFilePattern('src/utils/helpers.ts')).toBe('*.ts');
    });
  });

  describe('inferActionType', () => {
    it('should infer CREATE action', () => {
      expect(inferActionType('CREATE')).toBe('CREATE');
      expect(inferActionType('Add new file')).toBe('CREATE');
    });

    it('should infer UPDATE action', () => {
      expect(inferActionType('UPDATE')).toBe('UPDATE');
      expect(inferActionType('Modify existing')).toBe('UPDATE');
    });

    it('should infer DELETE action', () => {
      expect(inferActionType('DELETE')).toBe('DELETE');
      expect(inferActionType('Remove old code')).toBe('DELETE');
    });

    it('should infer VERIFY action', () => {
      expect(inferActionType('VERIFY')).toBe('VERIFY');
      expect(inferActionType('Check compilation')).toBe('VERIFY');
    });

    it('should return UNKNOWN for unrecognized', () => {
      expect(inferActionType('something else')).toBe('UNKNOWN');
    });
  });

  describe('matchesFilePattern', () => {
    it('should match extension patterns', () => {
      expect(matchesFilePattern('file.sql', '*.sql')).toBe(true);
      expect(matchesFilePattern('file.ts', '*.sql')).toBe(false);
    });

    it('should match directory patterns', () => {
      expect(matchesFilePattern('server/routes/api.ts', 'server/routes/*')).toBe(true);
      expect(matchesFilePattern('src/utils.ts', 'server/routes/*')).toBe(false);
    });

    it('should match specific directory + extension', () => {
      expect(
        matchesFilePattern('server/routes/api.ts', 'server/routes/*.ts')
      ).toBe(true);
      expect(matchesFilePattern('server/routes/api.js', 'server/routes/*.ts')).toBe(
        false
      );
    });
  });

  describe('Duplicate Detector', () => {
    describe('calculateSimilarity', () => {
      it('should return 1 for identical strings', () => {
        expect(calculateSimilarity('hello world', 'hello world')).toBe(1);
      });

      it('should return 0 for completely different strings', () => {
        expect(calculateSimilarity('abc', 'xyz')).toBe(0);
      });

      it('should return partial similarity for overlapping strings', () => {
        const similarity = calculateSimilarity(
          'Use TEXT for dates in SQLite',
          'Use TEXT not DATETIME in SQLite'
        );
        expect(similarity).toBeGreaterThan(0.3);
        expect(similarity).toBeLessThan(1);
      });

      it('should be case insensitive', () => {
        expect(calculateSimilarity('HELLO', 'hello')).toBe(1);
      });

      it('should handle empty strings', () => {
        expect(calculateSimilarity('', '')).toBe(1);
        expect(calculateSimilarity('hello', '')).toBe(0);
      });
    });

    describe('shouldMerge', () => {
      it('should return true for high similarity', () => {
        expect(shouldMerge(0.8)).toBe(true);
        expect(shouldMerge(0.9)).toBe(true);
      });

      it('should return false for low similarity', () => {
        expect(shouldMerge(0.5)).toBe(false);
        expect(shouldMerge(0.3)).toBe(false);
      });

      it('should return true at threshold', () => {
        expect(shouldMerge(0.7)).toBe(true);
      });
    });
  });

  describe('Confidence Config', () => {
    it('should have valid thresholds', () => {
      expect(CONFIDENCE_CONFIG.promotionThreshold).toBeGreaterThan(
        CONFIDENCE_CONFIG.demotionThreshold
      );
    });

    it('should have max confidence <= 1', () => {
      expect(CONFIDENCE_CONFIG.maxConfidence).toBeLessThanOrEqual(1);
    });

    it('should have min confidence >= 0', () => {
      expect(CONFIDENCE_CONFIG.minConfidence).toBeGreaterThanOrEqual(0);
    });

    it('should have initial confidence in valid range', () => {
      expect(CONFIDENCE_CONFIG.initial).toBeGreaterThan(0);
      expect(CONFIDENCE_CONFIG.initial).toBeLessThan(1);
    });

    it('should have positive prevention boost', () => {
      expect(CONFIDENCE_CONFIG.preventionBoost).toBeGreaterThan(0);
    });
  });

  describe('categorizeError', () => {
    it('should categorize typescript errors', () => {
      expect(categorizeError('TS2345: Argument of type')).toBe('typescript');
      expect(categorizeError('Type error in file')).toBe('typescript');
    });

    it('should categorize database errors', () => {
      expect(categorizeError('SQLite error: FOREIGN KEY')).toBe('database');
      expect(categorizeError('SQL syntax error')).toBe('database');
    });

    it('should categorize module errors', () => {
      expect(categorizeError('Cannot find module')).toBe('module');
      expect(categorizeError('import error')).toBe('module');
    });

    it('should categorize async errors', () => {
      expect(categorizeError('Promise rejected')).toBe('async');
      expect(categorizeError('await missing')).toBe('async');
    });

    it('should return unknown for unrecognized', () => {
      expect(categorizeError('random error message')).toBe('unknown');
    });
  });

  describe('Execution Analyzer', () => {
    const createTaskRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'exec-1',
      build_id: 'build-1',
      task_id: 'T-001',
      phase: 'database',
      action: 'CREATE',
      file_path: 'database/migrations/001.sql',
      attempt: 1,
      status: 'completed',
      started_at: '2026-01-11T00:00:00Z',
      completed_at: '2026-01-11T00:01:00Z',
      generated_code: 'CREATE TABLE test (id TEXT);',
      validation_command: 'sqlite3 :memory:',
      validation_output: null,
      validation_success: 1,
      error_message: null,
      duration_ms: 1000,
      ...overrides,
    });

    describe('identifyFailures', () => {
      it('should identify failed tasks with error messages', () => {
        const rows = [
          createTaskRow({
            status: 'failed',
            error_message: 'DATETIME not supported in SQLite',
          }),
        ];

        const failures = identifyFailures(rows as never[]);
        expect(failures).toHaveLength(1);
        expect(failures[0].errorMessage).toBe('DATETIME not supported in SQLite');
        expect(failures[0].file).toBe('database/migrations/001.sql');
      });

      it('should not identify completed tasks as failures', () => {
        const rows = [createTaskRow({ status: 'completed' })];
        const failures = identifyFailures(rows as never[]);
        expect(failures).toHaveLength(0);
      });

      it('should include fix when retry succeeded', () => {
        const rows = [
          createTaskRow({
            id: 'exec-1',
            attempt: 1,
            status: 'failed',
            error_message: 'Type error',
          }),
          createTaskRow({
            id: 'exec-2',
            attempt: 2,
            status: 'completed',
            generated_code: 'fixed code',
          }),
        ];

        const failures = identifyFailures(rows as never[]);
        expect(failures).toHaveLength(1);
        expect(failures[0].fixApplied).toBe('fixed code');
      });
    });

    describe('identifyRetries', () => {
      it('should identify tasks with multiple attempts', () => {
        const rows = [
          createTaskRow({ id: 'exec-1', attempt: 1, status: 'failed', error_message: 'Error 1' }),
          createTaskRow({ id: 'exec-2', attempt: 2, status: 'completed' }),
        ];

        const retries = identifyRetries(rows as never[]);
        expect(retries).toHaveLength(1);
        expect(retries[0].attempts).toBe(2);
        expect(retries[0].finalStatus).toBe('success');
        expect(retries[0].errors).toHaveLength(1);
      });

      it('should not identify single-attempt tasks', () => {
        const rows = [createTaskRow({ attempt: 1 })];
        const retries = identifyRetries(rows as never[]);
        expect(retries).toHaveLength(0);
      });

      it('should track final failure status', () => {
        const rows = [
          createTaskRow({ id: 'exec-1', attempt: 1, status: 'failed', error_message: 'Error 1' }),
          createTaskRow({ id: 'exec-2', attempt: 2, status: 'failed', error_message: 'Error 2' }),
        ];

        const retries = identifyRetries(rows as never[]);
        expect(retries).toHaveLength(1);
        expect(retries[0].finalStatus).toBe('failed');
        expect(retries[0].errors).toHaveLength(2);
      });
    });
  });

  describe('CLAUDE.md Updater', () => {
    const createEntry = (overrides: Partial<import('../types/sia').KnowledgeEntry> = {}): import('../types/sia').KnowledgeEntry => ({
      id: 'entry-1',
      type: 'gotcha',
      content: 'Use TEXT for dates in SQLite',
      filePatterns: ['*.sql'],
      actionTypes: ['CREATE'],
      confidence: 0.85,
      occurrences: 3,
      source: {
        executionId: 'exec-1',
        taskId: 'T-001',
        agentType: 'build',
      },
      createdAt: '2026-01-11T00:00:00Z',
      updatedAt: '2026-01-11T00:00:00Z',
      ...overrides,
    });

    describe('determineSection', () => {
      it('should map SQL patterns to Database Conventions', () => {
        const entry = createEntry({ filePatterns: ['*.sql'] });
        expect(determineSection(entry)).toBe('## Database Conventions');
      });

      it('should map route patterns to API Conventions', () => {
        const entry = createEntry({ filePatterns: ['server/routes/*.ts'] });
        expect(determineSection(entry)).toBe('## API Conventions');
      });

      it('should map test patterns to appropriate section', () => {
        const entry = createEntry({ filePatterns: ['tests/*.ts'] });
        // tests/*.ts matches *.ts pattern which maps to Coding Loops Infrastructure
        expect(determineSection(entry)).toBe('## Coding Loops Infrastructure');
      });

      it('should use default section for unknown patterns', () => {
        const entry = createEntry({ filePatterns: ['some/random/path.xyz'] });
        expect(determineSection(entry)).toBe('## Database Conventions');
      });
    });

    describe('formatProposalContent', () => {
      it('should format gotcha with file patterns and actions', () => {
        const entry = createEntry();
        const content = formatProposalContent(entry);
        expect(content).toContain('*.sql');
        expect(content).toContain('CREATE');
        expect(content).toContain('Use TEXT for dates in SQLite');
      });

      it('should handle multiple patterns', () => {
        const entry = createEntry({
          filePatterns: ['*.sql', 'database/*'],
          actionTypes: ['CREATE', 'UPDATE'],
        });
        const content = formatProposalContent(entry);
        expect(content).toContain('*.sql, database/*');
        expect(content).toContain('CREATE, UPDATE');
      });

      it('should handle empty patterns gracefully', () => {
        const entry = createEntry({
          filePatterns: [],
          actionTypes: [],
        });
        const content = formatProposalContent(entry);
        expect(content).toContain('general');
        expect(content).toContain('all actions');
      });
    });

    describe('isEligibleForPromotion', () => {
      it('should return true for high-confidence gotchas with multiple occurrences', () => {
        const entry = createEntry({
          type: 'gotcha',
          confidence: 0.85,
          occurrences: 3,
        });
        expect(isEligibleForPromotion(entry)).toBe(true);
      });

      it('should return false for low-confidence entries', () => {
        const entry = createEntry({
          type: 'gotcha',
          confidence: 0.5,
          occurrences: 3,
        });
        expect(isEligibleForPromotion(entry)).toBe(false);
      });

      it('should return false for entries with single occurrence', () => {
        const entry = createEntry({
          type: 'gotcha',
          confidence: 0.85,
          occurrences: 1,
        });
        expect(isEligibleForPromotion(entry)).toBe(false);
      });

      it('should return false for non-gotcha types', () => {
        const entry = createEntry({
          type: 'pattern',
          confidence: 0.85,
          occurrences: 3,
        });
        expect(isEligibleForPromotion(entry)).toBe(false);
      });
    });
  });
});
