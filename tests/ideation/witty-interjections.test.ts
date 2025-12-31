import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldInjectWit,
  findRelevantInterjection,
  maybeInjectWit,
  injectAtNaturalBreak,
  InterjectionTracker,
  getAllInterjections,
  getInterjectionsByCategory,
} from '../../agents/ideation/witty-interjections.js';

describe('WittyInterjections', () => {

  describe('shouldInjectWit', () => {

    test('PASS: Returns boolean', () => {
      const result = shouldInjectWit();
      expect(typeof result).toBe('boolean');
    });

    test('PASS: Approximately 10% true rate over many calls', () => {
      const results = Array(1000).fill(null).map(() => shouldInjectWit());
      const trueCount = results.filter(r => r).length;

      // Allow 5-15% range for statistical variance
      expect(trueCount).toBeGreaterThan(50);
      expect(trueCount).toBeLessThan(150);
    });
  });

  describe('findRelevantInterjection', () => {

    test('PASS: Finds interjection for matching trigger', () => {
      const interjection = findRelevantInterjection(
        "surely someone has built this before",
        "Let's check"
      );

      expect(interjection).not.toBeNull();
      expect(interjection!.triggers).toContain('surely');
    });

    test('PASS: Returns null when no triggers match', () => {
      const interjection = findRelevantInterjection(
        "The weather is nice today",
        "Indeed it is"
      );

      expect(interjection).toBeNull();
    });

    test('PASS: Matches triggers in agent reply too', () => {
      const interjection = findRelevantInterjection(
        "I want to build something",
        "You mentioned this is for a niche market"
      );

      expect(interjection).not.toBeNull();
    });

    test('PASS: Case-insensitive matching', () => {
      const interjection = findRelevantInterjection(
        "SURELY this exists",
        ""
      );

      expect(interjection).not.toBeNull();
    });
  });

  describe('injectAtNaturalBreak', () => {

    test('PASS: Injects after first paragraph', () => {
      const text = "First paragraph.\n\nSecond paragraph.";
      const result = injectAtNaturalBreak(text, "Witty comment");

      expect(result).toContain("First paragraph.");
      expect(result).toContain("*Witty comment*");
      expect(result).toContain("Second paragraph.");
      expect(result.indexOf("*Witty comment*")).toBeGreaterThan(result.indexOf("First"));
      expect(result.indexOf("*Witty comment*")).toBeLessThan(result.indexOf("Second"));
    });

    test('PASS: Injects after first sentence if no paragraphs', () => {
      const text = "First sentence. Second sentence.";
      const result = injectAtNaturalBreak(text, "Witty comment");

      expect(result).toContain("First sentence.");
      expect(result).toContain("*Witty comment*");
    });

    test('PASS: Appends if no natural breaks', () => {
      const text = "Short text";
      const result = injectAtNaturalBreak(text, "Witty comment");

      expect(result).toContain("Short text");
      expect(result).toContain("*Witty comment*");
    });
  });

  describe('InterjectionTracker', () => {

    test('PASS: Tracks used interjections', () => {
      const tracker = new InterjectionTracker();
      const candidates = [
        { text: 'First', category: 'self_awareness' as const, triggers: [] },
        { text: 'Second', category: 'self_awareness' as const, triggers: [] },
      ];

      const first = tracker.getUnused(candidates);
      expect(first).not.toBeNull();

      const second = tracker.getUnused(candidates);
      expect(second).not.toBeNull();
      expect(second!.text).not.toBe(first!.text);
    });

    test('PASS: Returns null when all used', () => {
      const tracker = new InterjectionTracker();
      const candidates = [
        { text: 'Only', category: 'self_awareness' as const, triggers: [] },
      ];

      tracker.getUnused(candidates);
      const result = tracker.getUnused(candidates);

      expect(result).toBeNull();
    });

    test('PASS: Reset clears tracking', () => {
      const tracker = new InterjectionTracker();
      const candidates = [
        { text: 'Only', category: 'self_awareness' as const, triggers: [] },
      ];

      tracker.getUnused(candidates);
      tracker.reset();
      const result = tracker.getUnused(candidates);

      expect(result).not.toBeNull();
    });

    test('PASS: markUsed adds to tracking', () => {
      const tracker = new InterjectionTracker();
      const candidates = [
        { text: 'Marked', category: 'self_awareness' as const, triggers: [] },
      ];

      tracker.markUsed('Marked');
      const result = tracker.getUnused(candidates);

      expect(result).toBeNull();
    });
  });

  describe('getAllInterjections', () => {
    test('PASS: Returns non-empty array', () => {
      const all = getAllInterjections();
      expect(all.length).toBeGreaterThan(0);
    });

    test('PASS: All have required properties', () => {
      const all = getAllInterjections();
      for (const i of all) {
        expect(i.text).toBeDefined();
        expect(i.category).toBeDefined();
        expect(i.triggers).toBeDefined();
      }
    });
  });

  describe('getInterjectionsByCategory', () => {
    test('PASS: Returns self_awareness interjections', () => {
      const interjections = getInterjectionsByCategory('self_awareness');
      expect(interjections.length).toBeGreaterThan(0);
      expect(interjections.every(i => i.category === 'self_awareness')).toBe(true);
    });

    test('PASS: Returns market_reality interjections', () => {
      const interjections = getInterjectionsByCategory('market_reality');
      expect(interjections.length).toBeGreaterThan(0);
      expect(interjections.every(i => i.category === 'market_reality')).toBe(true);
    });

    test('PASS: Returns encouragement interjections', () => {
      const interjections = getInterjectionsByCategory('encouragement');
      expect(interjections.length).toBeGreaterThan(0);
      expect(interjections.every(i => i.category === 'encouragement')).toBe(true);
    });

    test('PASS: Returns gentle_push interjections', () => {
      const interjections = getInterjectionsByCategory('gentle_push');
      expect(interjections.length).toBeGreaterThan(0);
      expect(interjections.every(i => i.category === 'gentle_push')).toBe(true);
    });
  });
});
