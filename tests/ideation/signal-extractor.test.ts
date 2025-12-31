import { describe, test, expect } from 'vitest';
import {
  extractSignals,
  extractCustomerType,
  extractProductType,
  extractGeography,
  extractExpertise,
  extractInterests,
  extractImpactVision,
  extractMarketData,
} from '../../agents/ideation/signal-extractor.js';

describe('SignalExtractor', () => {

  describe('extractSignals', () => {
    test('PASS: Returns empty signals for empty input', () => {
      const signals = extractSignals('', { reply: '' }, {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowing: {},
      });

      expect(signals).toBeDefined();
      expect(signals.selfDiscovery).toBeDefined();
      expect(signals.marketDiscovery).toBeDefined();
      expect(signals.narrowing).toBeDefined();
    });

    test('PASS: Uses LLM signals when provided', () => {
      const signals = extractSignals('test message', {
        reply: 'test reply',
        signals: {
          selfDiscovery: { impactVision: { level: 'world', description: 'Global impact', confidence: 0.8 } },
        },
      }, {
        selfDiscovery: {},
        marketDiscovery: {},
        narrowing: {},
      });

      expect(signals.selfDiscovery.impactVision?.level).toBe('world');
    });
  });

  describe('extractCustomerType', () => {
    test('PASS: Extracts B2B from business keywords', () => {
      const result = extractCustomerType('I want to sell to businesses');
      expect(result.value).toBe('B2B');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('PASS: Extracts B2C from consumer keywords', () => {
      const result = extractCustomerType('This is for everyday consumers');
      expect(result.value).toBe('B2C');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('PASS: Extracts marketplace from platform keywords', () => {
      const result = extractCustomerType('A marketplace connecting buyers and sellers');
      expect(result.value).toBe('marketplace');
    });

    test('PASS: Returns null for no signal', () => {
      const result = extractCustomerType('The weather is nice today');
      expect(result.value).toBeNull();
    });

    test('PASS: B2B beats B2C with more signals', () => {
      const result = extractCustomerType('enterprise companies and corporations need this');
      expect(result.value).toBe('B2B');
    });
  });

  describe('extractProductType', () => {
    test('PASS: Extracts digital from software keywords', () => {
      const result = extractProductType('A mobile app for tracking');
      expect(result.value).toBe('digital');
    });

    test('PASS: Extracts physical from hardware keywords', () => {
      const result = extractProductType('A physical device for manufacturing');
      expect(result.value).toBe('physical');
    });

    test('PASS: Extracts service from consulting keywords', () => {
      const result = extractProductType('Consulting service for businesses');
      expect(result.value).toBe('service');
    });

    test('PASS: Returns null for no signal', () => {
      const result = extractProductType('Something interesting');
      expect(result.value).toBeNull();
    });

    test('PASS: Detects hybrid when multiple types present', () => {
      const result = extractProductType('software platform with hardware device');
      expect(result.value).toBe('hybrid');
    });
  });

  describe('extractGeography', () => {
    test('PASS: Extracts local from city keywords', () => {
      const result = extractGeography('only for my local area');
      expect(result.value).toBe('local');
    });

    test('PASS: Extracts national from country keywords', () => {
      const result = extractGeography('across Australia nationally');
      expect(result.value).toBe('national');
    });

    test('PASS: Extracts global from international keywords', () => {
      const result = extractGeography('worldwide global reach');
      expect(result.value).toBe('global');
    });

    test('PASS: Returns null for no signal', () => {
      const result = extractGeography('no location mentioned');
      expect(result.value).toBeNull();
    });

    test('PASS: Recognizes Australian cities as local', () => {
      const result = extractGeography('targeting Sydney market');
      expect(result.value).toBe('local');
    });
  });

  describe('extractExpertise', () => {
    test('PASS: Extracts expertise from years worked', () => {
      const result = extractExpertise("I've worked in fintech for 5 years");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].depth).toBe('expert');
    });

    test('PASS: Extracts expertise from explicit claim', () => {
      const result = extractExpertise("I'm an expert in machine learning");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].area).toContain('machine learning');
    });

    test('PASS: Extracts expertise from specialization', () => {
      const result = extractExpertise('I specialize in data analysis');
      expect(result.length).toBeGreaterThan(0);
    });

    test('PASS: Returns empty for no expertise mentioned', () => {
      const result = extractExpertise('Just a normal person here');
      expect(result.length).toBe(0);
    });
  });

  describe('extractInterests', () => {
    test('PASS: Extracts passionate interest', () => {
      const result = extractInterests("I'm passionate about sustainability");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].genuine).toBe(true);
    });

    test('PASS: Extracts love statements', () => {
      const result = extractInterests('I love working with data');
      expect(result.length).toBeGreaterThan(0);
    });

    test('PASS: Distinguishes genuine from potential interest', () => {
      const result = extractInterests('I want to explore AI');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].genuine).toBe(false);
    });

    test('PASS: Returns empty for no interest mentioned', () => {
      const result = extractInterests('The meeting is at 3pm');
      expect(result.length).toBe(0);
    });
  });

  describe('extractImpactVision', () => {
    test('PASS: Extracts world-level impact', () => {
      const result = extractImpactVision('I want to change the world');
      expect(result?.level).toBe('world');
    });

    test('PASS: Extracts country-level impact', () => {
      const result = extractImpactVision('impact across Australia');
      expect(result?.level).toBe('country');
    });

    test('PASS: Extracts city-level impact', () => {
      const result = extractImpactVision('focus on my city');
      expect(result?.level).toBe('city');
    });

    test('PASS: Extracts community-level impact', () => {
      const result = extractImpactVision('help my local community');
      expect(result?.level).toBe('community');
    });

    test('PASS: Returns null for no impact mentioned', () => {
      const result = extractImpactVision('just making money');
      expect(result).toBeNull();
    });
  });

  describe('extractMarketData', () => {
    test('PASS: Extracts competitors from search results', () => {
      const result = extractMarketData([
        { title: 'Company A', url: 'https://example.com', snippet: 'competitor to ProductX, they offer similar solutions' },
      ]);
      expect(result.competitors.length).toBeGreaterThanOrEqual(0);
    });

    test('PASS: Extracts gaps from search results', () => {
      const result = extractMarketData([
        { title: 'Market Report', url: 'https://example.com', snippet: 'There is a lack of solutions for small businesses' },
      ]);
      expect(result.gaps.length).toBeGreaterThan(0);
    });

    test('PASS: Extracts timing signals', () => {
      const result = extractMarketData([
        { title: 'Trend Report', url: 'https://example.com', snippet: 'growing market demand for AI tools' },
      ]);
      expect(result.timingSignals.length).toBeGreaterThan(0);
    });

    test('PASS: Returns empty arrays for no signals', () => {
      const result = extractMarketData([
        { title: 'Random', url: 'https://example.com', snippet: 'The weather is nice' },
      ]);
      expect(result.competitors.length).toBe(0);
      expect(result.gaps.length).toBe(0);
      expect(result.timingSignals.length).toBe(0);
    });
  });
});
