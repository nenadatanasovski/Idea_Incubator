/**
 * Tests for Phase 7: Specialized Evaluators
 */
import { describe, it, expect } from 'vitest';
import {
  SPECIALIZED_EVALUATORS,
  getSpecializedEvaluator,
  listSpecializedEvaluators,
} from '../../../agents/specialized-evaluators.js';
import { CATEGORIES, type Category as _Category } from '../../../agents/config.js';

describe('Specialized Evaluators', () => {
  describe('SPECIALIZED_EVALUATORS', () => {
    it('should have 6 specialized evaluators (one per category)', () => {
      expect(Object.keys(SPECIALIZED_EVALUATORS)).toHaveLength(6);
    });

    it('should have an evaluator for each category', () => {
      for (const category of CATEGORIES) {
        expect(SPECIALIZED_EVALUATORS[category]).toBeDefined();
        expect(SPECIALIZED_EVALUATORS[category].category).toBe(category);
      }
    });

    it('should have required properties for each evaluator', () => {
      for (const category of CATEGORIES) {
        const evaluator = SPECIALIZED_EVALUATORS[category];
        expect(evaluator.id).toBeDefined();
        expect(evaluator.name).toBeDefined();
        expect(evaluator.expertise).toBeDefined();
        expect(evaluator.systemPrompt).toBeDefined();
        expect(evaluator.systemPrompt.length).toBeGreaterThan(100);
      }
    });

    it('should have unique IDs for each evaluator', () => {
      const ids = Object.values(SPECIALIZED_EVALUATORS).map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getSpecializedEvaluator', () => {
    it('should return the correct evaluator for each category', () => {
      for (const category of CATEGORIES) {
        const evaluator = getSpecializedEvaluator(category);
        expect(evaluator).toBeDefined();
        expect(evaluator.category).toBe(category);
      }
    });

    it('should return problem evaluator with correct focus', () => {
      const evaluator = getSpecializedEvaluator('problem');
      expect(evaluator.name).toBe('Problem Expert');
      expect(evaluator.systemPrompt).toContain('PROBLEM');
    });

    it('should return solution evaluator with correct focus', () => {
      const evaluator = getSpecializedEvaluator('solution');
      expect(evaluator.name).toBe('Solution Architect');
      expect(evaluator.systemPrompt).toContain('SOLUTION');
    });

    it('should return feasibility evaluator with correct focus', () => {
      const evaluator = getSpecializedEvaluator('feasibility');
      expect(evaluator.name).toBe('Feasibility Analyst');
      expect(evaluator.systemPrompt).toContain('FEASIBILITY');
    });

    it('should return fit evaluator with correct focus', () => {
      const evaluator = getSpecializedEvaluator('fit');
      expect(evaluator.name).toBe('Strategic Fit Analyst');
      expect(evaluator.systemPrompt).toContain('FIT');
    });

    it('should return market evaluator with correct focus', () => {
      const evaluator = getSpecializedEvaluator('market');
      expect(evaluator.name).toBe('Market Analyst');
      expect(evaluator.systemPrompt).toContain('MARKET');
    });

    it('should return risk evaluator with correct focus', () => {
      const evaluator = getSpecializedEvaluator('risk');
      expect(evaluator.name).toBe('Risk Analyst');
      expect(evaluator.systemPrompt).toContain('RISK');
    });
  });

  describe('listSpecializedEvaluators', () => {
    it('should return all 6 evaluators', () => {
      const evaluators = listSpecializedEvaluators();
      expect(evaluators).toHaveLength(6);
    });

    it('should return evaluators with all required properties', () => {
      const evaluators = listSpecializedEvaluators();
      for (const evaluator of evaluators) {
        expect(evaluator).toHaveProperty('id');
        expect(evaluator).toHaveProperty('name');
        expect(evaluator).toHaveProperty('category');
        expect(evaluator).toHaveProperty('expertise');
        expect(evaluator).toHaveProperty('systemPrompt');
      }
    });
  });

  describe('Evaluator System Prompts', () => {
    it('should all mention scoring guidelines', () => {
      for (const category of CATEGORIES) {
        const evaluator = SPECIALIZED_EVALUATORS[category];
        expect(evaluator.systemPrompt).toContain('Scoring Guidelines');
      }
    });

    it('should all have score descriptions (10, 8-9, etc.)', () => {
      for (const category of CATEGORIES) {
        const evaluator = SPECIALIZED_EVALUATORS[category];
        expect(evaluator.systemPrompt).toMatch(/10:/);
        expect(evaluator.systemPrompt).toMatch(/8-9:/);
        expect(evaluator.systemPrompt).toMatch(/6-7:/);
      }
    });
  });
});
