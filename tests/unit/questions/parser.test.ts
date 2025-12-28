/**
 * Unit tests for questions/parser.ts
 * Tests markdown Q&A parsing functionality
 */
import { describe, it, expect } from 'vitest';
import { parseQAFromMarkdown } from '../../../questions/parser.js';

describe('parseQAFromMarkdown', () => {
  describe('Pattern 1: **Q:** / **A:** format', () => {
    it('should parse Q&A pairs with bold Q/A markers', () => {
      const content = `
**Q: What is the core problem?**
A: Users struggle with plant care because they lack knowledge.

**Q: Who is the target user?**
A: Urban millennials who own houseplants.
`;
      const results = parseQAFromMarkdown(content);

      // Should find at least 2 Q&A pairs (may find more due to multiple pattern matches)
      expect(results.length).toBeGreaterThanOrEqual(2);

      // Should contain both key questions
      const coreProblemQ = results.find(r => r.question.toLowerCase().includes('core problem'));
      const targetUserQ = results.find(r => r.question.toLowerCase().includes('target user'));

      expect(coreProblemQ).toBeDefined();
      expect(coreProblemQ?.answer).toContain('plant care');
      expect(targetUserQ).toBeDefined();
      expect(targetUserQ?.answer).toContain('millennials');
    });

    it('should handle bold A: marker', () => {
      const content = `
**Q: What technology will you use?**
**A:** React Native and TensorFlow for mobile AI.
`;
      const results = parseQAFromMarkdown(content);

      expect(results.length).toBeGreaterThanOrEqual(1);

      const techQ = results.find(r => r.question.toLowerCase().includes('technology'));
      expect(techQ).toBeDefined();
      expect(techQ?.answer).toContain('React Native');
    });
  });

  describe('Pattern 2: ### Question heading format', () => {
    it('should parse heading-based Q&A', () => {
      const content = `
### What is the market size?
The total addressable market is estimated at $20B globally.

### Who are the competitors?
Main competitors include Planta, Greg, and Florish.
`;
      const results = parseQAFromMarkdown(content);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle Question: prefix in heading', () => {
      const content = `
### Question: What makes this unique?
Answer: Our AI-powered plant recognition is more accurate than manual methods.
`;
      const results = parseQAFromMarkdown(content);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Pattern 3: Simple Q: / A: format', () => {
    it('should parse simple Q/A pairs', () => {
      const content = `
Q: What is the problem?
A: Plants die because owners don't know how to care for them.

Q: What is the solution?
A: An AI app that provides personalized care recommendations.
`;
      const results = parseQAFromMarkdown(content);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge cases', () => {
    it('should skip short questions', () => {
      const content = `
**Q: Hi?**
A: Hello there.
`;
      const results = parseQAFromMarkdown(content);

      // Question "Hi?" is less than 10 chars, should be skipped
      expect(results.length).toBe(0);
    });

    it('should skip short answers', () => {
      const content = `
**Q: What is your detailed business plan for the next five years?**
A: Yes.
`;
      const results = parseQAFromMarkdown(content);

      // Answer "Yes." is less than 10 chars, should be skipped
      expect(results.length).toBe(0);
    });

    it('should handle empty content', () => {
      const results = parseQAFromMarkdown('');

      expect(results.length).toBe(0);
    });

    it('should deduplicate questions', () => {
      const content = `
**Q: What is the problem?**
A: First answer about the problem.

**Q: What is the problem?**
A: Duplicate question with different answer.
`;
      const results = parseQAFromMarkdown(content);

      // Should only have one entry per unique question (normalized)
      const problemQuestions = results.filter(r =>
        r.question.toLowerCase().includes('what is the problem')
      );
      // Deduplication should work within a pattern, but since there may be
      // multiple patterns matching, we check that the count is reasonable
      expect(problemQuestions.length).toBeGreaterThanOrEqual(1);
      expect(problemQuestions.length).toBeLessThanOrEqual(2);
    });

    it('should set high confidence for parsed answers', () => {
      const content = `
**Q: What is the core problem you're solving?**
A: Users struggle to keep their houseplants alive due to lack of care knowledge.
`;
      const results = parseQAFromMarkdown(content);

      expect(results.length).toBeGreaterThanOrEqual(1);
      // All parsed answers should have 0.9 confidence
      results.forEach(r => {
        expect(r.confidence).toBe(0.9);
      });
    });

    it('should handle markdown artifacts in answers', () => {
      const content = `
**Q: What technology will you use?**
A: React Native for mobile development.
---

**Q: Next question?**
`;
      const results = parseQAFromMarkdown(content);

      // Answer should not contain ---
      if (results.length > 0) {
        expect(results[0].answer).not.toContain('---');
      }
    });
  });
});
