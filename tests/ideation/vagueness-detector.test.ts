import { describe, test, expect } from 'vitest';
import {
  detectVagueness,
  isSimpleConfirmation,
  isQuestionBack,
  isConfused,
  classifyMessage,
  getResponseStrategy,
} from '../../agents/ideation/vagueness-detector.js';

describe('VaguenessDetector', () => {

  describe('detectVagueness', () => {
    test('PASS: Detects hedging language', () => {
      const result = detectVagueness('Maybe I could possibly try something');
      expect(result.isVague).toBe(true);
      expect(result.reasons.some(r => r.includes('Hedging'))).toBe(true);
    });

    test('PASS: Detects non-committal language', () => {
      const result = detectVagueness("It depends on many factors, we'll see");
      expect(result.isVague).toBe(true);
      expect(result.reasons.some(r => r.includes('Non-committal'))).toBe(true);
    });

    test('PASS: Detects deflecting language', () => {
      const result = detectVagueness("I haven't thought about that, good question");
      expect(result.isVague).toBe(true);
      expect(result.reasons.some(r => r.includes('Deflecting'))).toBe(true);
    });

    test('PASS: Detects unclear language', () => {
      const result = detectVagueness('You know, like, basically stuff and things');
      expect(result.isVague).toBe(true);
      expect(result.reasons.some(r => r.includes('Unclear'))).toBe(true);
    });

    test('PASS: Flags very short responses', () => {
      const result = detectVagueness('Ok');
      expect(result.reasons.some(r => r.includes('Very short'))).toBe(true);
    });

    test('PASS: Recognizes clear, substantive response', () => {
      const result = detectVagueness('I have 10 years of experience in software development at fintech companies. My main expertise is in payment systems.');
      expect(result.isVague).toBe(false);
      expect(result.score).toBeLessThan(0.3);
    });

    test('PASS: Provides follow-up suggestion when vague', () => {
      const result = detectVagueness('Maybe, I guess, possibly');
      expect(result.suggestedFollowUp).not.toBeNull();
    });

    test('PASS: No follow-up for clear response', () => {
      const result = detectVagueness('I want to build a B2B SaaS product for the healthcare industry.');
      expect(result.suggestedFollowUp).toBeNull();
    });

    test('PASS: Score is between 0 and 1', () => {
      const result = detectVagueness('maybe possibly perhaps could be might be I think I guess sort of kind of');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('isSimpleConfirmation', () => {
    test('PASS: Recognizes yes', () => {
      expect(isSimpleConfirmation('yes')).toBe(true);
    });

    test('PASS: Recognizes yeah', () => {
      expect(isSimpleConfirmation('yeah')).toBe(true);
    });

    test('PASS: Recognizes no', () => {
      expect(isSimpleConfirmation('no')).toBe(true);
    });

    test('PASS: Recognizes ok', () => {
      expect(isSimpleConfirmation('ok')).toBe(true);
    });

    test('PASS: Recognizes with punctuation', () => {
      expect(isSimpleConfirmation('yes.')).toBe(true);
    });

    test('PASS: Rejects longer messages', () => {
      expect(isSimpleConfirmation('Yes, I agree with that assessment')).toBe(false);
    });

    test('PASS: Case insensitive', () => {
      expect(isSimpleConfirmation('YES')).toBe(true);
      expect(isSimpleConfirmation('OK')).toBe(true);
    });
  });

  describe('isQuestionBack', () => {
    test('PASS: Detects question mark', () => {
      expect(isQuestionBack('What do you mean?')).toBe(true);
    });

    test('PASS: Detects what questions', () => {
      expect(isQuestionBack('What should I do')).toBe(true);
    });

    test('PASS: Detects how questions', () => {
      expect(isQuestionBack('How does that work')).toBe(true);
    });

    test('PASS: Detects can you questions', () => {
      expect(isQuestionBack('Can you explain more')).toBe(true);
    });

    test('PASS: Rejects statements', () => {
      expect(isQuestionBack('That sounds good')).toBe(false);
    });
  });

  describe('isConfused', () => {
    test('PASS: Detects explicit confusion', () => {
      expect(isConfused("I don't understand")).toBe(true);
    });

    test('PASS: Detects clarification request', () => {
      expect(isConfused('Can you explain that?')).toBe(true);
    });

    test('PASS: Detects lost feeling', () => {
      expect(isConfused("I'm lost here")).toBe(true);
    });

    test('PASS: Rejects clear statements', () => {
      expect(isConfused('That makes sense')).toBe(false);
    });
  });

  describe('classifyMessage', () => {
    test('PASS: Classifies confused message', () => {
      const result = classifyMessage("I don't understand what you mean");
      expect(result.type).toBe('confused');
    });

    test('PASS: Classifies question', () => {
      const result = classifyMessage('What do you think about that?');
      expect(result.type).toBe('question');
    });

    test('PASS: Classifies confirmation', () => {
      const result = classifyMessage('yes');
      expect(result.type).toBe('confirmation');
    });

    test('PASS: Classifies vague message', () => {
      const result = classifyMessage('Maybe, I guess, possibly');
      expect(result.type).toBe('vague');
    });

    test('PASS: Classifies short message', () => {
      const result = classifyMessage('Good');
      expect(result.type).toBe('short');
    });

    test('PASS: Classifies substantive message', () => {
      const result = classifyMessage('I have extensive experience in software development and want to build a B2B SaaS product for the healthcare industry targeting small clinics.');
      expect(result.type).toBe('substantive');
    });
  });

  describe('getResponseStrategy', () => {
    test('PASS: Substantive - continue naturally', () => {
      const strategy = getResponseStrategy('substantive');
      expect(strategy.shouldProbe).toBe(false);
    });

    test('PASS: Vague - should probe for specifics', () => {
      const strategy = getResponseStrategy('vague');
      expect(strategy.shouldProbe).toBe(true);
      expect(strategy.probeType).toBe('specific');
    });

    test('PASS: Confirmation - expand', () => {
      const strategy = getResponseStrategy('confirmation');
      expect(strategy.shouldProbe).toBe(true);
      expect(strategy.probeType).toBe('expand');
    });

    test('PASS: Confused - clarify', () => {
      const strategy = getResponseStrategy('confused');
      expect(strategy.shouldProbe).toBe(true);
      expect(strategy.probeType).toBe('clarify');
    });

    test('PASS: Question - answer then redirect', () => {
      const strategy = getResponseStrategy('question');
      expect(strategy.shouldProbe).toBe(false);
    });

    test('PASS: Short - expand', () => {
      const strategy = getResponseStrategy('short');
      expect(strategy.shouldProbe).toBe(true);
      expect(strategy.probeType).toBe('expand');
    });
  });
});
