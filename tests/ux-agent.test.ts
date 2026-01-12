// tests/ux-agent.test.ts - UX Agent unit tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  STANDARD_JOURNEYS,
  getJourney,
  getJourneysByTag,
  getAllJourneys,
  registerJourney,
  unregisterJourney,
  hasJourney,
  getJourneyIds,
} from '../agents/ux/journey-definitions.js';
import { createMockBridge, MCPBridge } from '../agents/ux/mcp-bridge.js';
import { ScreenshotManager } from '../agents/ux/screenshot-manager.js';
import { summarizeIssues, meetsThreshold } from '../agents/ux/accessibility-checker.js';
import { Journey, AccessibilityIssue } from '../types/ux.js';

describe('UX Agent', () => {
  describe('Journey Definitions', () => {
    it('should have standard journeys defined', () => {
      expect(STANDARD_JOURNEYS.length).toBeGreaterThan(0);
    });

    it('should include homepage-load journey', () => {
      const journey = getJourney('homepage-load');
      expect(journey).toBeDefined();
      expect(journey?.name).toBe('Homepage Load');
    });

    it('should include ideas-list journey', () => {
      const journey = getJourney('ideas-list');
      expect(journey).toBeDefined();
      expect(journey?.name).toBe('Ideas List Navigation');
    });

    it('should return undefined for non-existent journey', () => {
      const journey = getJourney('non-existent-journey');
      expect(journey).toBeUndefined();
    });

    it('should get journeys by tag', () => {
      const smokeJourneys = getJourneysByTag('smoke');
      expect(smokeJourneys.length).toBeGreaterThan(0);
      expect(smokeJourneys.every(j => j.tags?.includes('smoke'))).toBe(true);
    });

    it('should get all journeys', () => {
      const allJourneys = getAllJourneys();
      expect(allJourneys.length).toBeGreaterThanOrEqual(STANDARD_JOURNEYS.length);
    });

    it('should register custom journey', () => {
      const customJourney: Journey = {
        id: 'test-custom',
        name: 'Test Custom',
        description: 'Custom test journey',
        startUrl: 'http://localhost:3000',
        steps: [{ action: 'wait', target: 'body' }],
      };

      registerJourney(customJourney);
      expect(hasJourney('test-custom')).toBe(true);
      expect(getJourney('test-custom')).toEqual(customJourney);

      // Clean up
      unregisterJourney('test-custom');
      expect(hasJourney('test-custom')).toBe(false);
    });

    it('should get journey IDs', () => {
      const ids = getJourneyIds();
      expect(ids).toContain('homepage-load');
      expect(ids).toContain('ideas-list');
    });
  });

  describe('MCP Bridge', () => {
    it('should throw if tools not set', () => {
      const bridge = new MCPBridge();
      expect(bridge.hasTools()).toBe(false);
    });

    it('should create mock bridge with tools', () => {
      const bridge = createMockBridge();
      expect(bridge.hasTools()).toBe(true);
    });

    it('mock bridge should not throw on navigate', async () => {
      const bridge = createMockBridge();
      await expect(bridge.navigate('http://example.com')).resolves.not.toThrow();
    });

    it('mock bridge should not throw on click', async () => {
      const bridge = createMockBridge();
      await expect(bridge.click('#button')).resolves.not.toThrow();
    });

    it('mock bridge should not throw on type', async () => {
      const bridge = createMockBridge();
      await expect(bridge.type('#input', 'test')).resolves.not.toThrow();
    });
  });

  describe('Screenshot Manager', () => {
    let manager: ScreenshotManager;

    beforeEach(() => {
      manager = new ScreenshotManager('test-screenshots');
    });

    it('should generate unique filenames', () => {
      const filename1 = manager.generateFilename('run-1', 0, 'homepage');
      const filename2 = manager.generateFilename('run-1', 1, 'click');
      const filename3 = manager.generateFilename('run-1', 2);

      expect(filename1).toBe('000-homepage.png');
      expect(filename2).toBe('001-click.png');
      expect(filename3).toBe('002.png');
    });

    it('should sanitize description in filename', () => {
      const filename = manager.generateFilename('run-1', 0, 'Test With Spaces & Special!');
      expect(filename).toBe('000-test-with-spaces-special-.png');
    });

    it('should truncate long descriptions', () => {
      const longDesc = 'This is a very long description that should be truncated to fit';
      const filename = manager.generateFilename('run-1', 0, longDesc);
      expect(filename.length).toBeLessThan(50);
    });

    it('should get run directory', () => {
      const dir = manager.getRunDir('run-123');
      expect(dir).toBe('test-screenshots/run-123');
    });

    it('should return empty array for non-existent run', () => {
      const screenshots = manager.getScreenshots('non-existent-run');
      expect(screenshots).toEqual([]);
    });
  });

  describe('Accessibility Summary', () => {
    const mockIssues: AccessibilityIssue[] = [
      { ruleId: 'color-contrast', impact: 'serious', description: 'Low contrast', selector: '#text', helpUrl: '' },
      { ruleId: 'image-alt', impact: 'critical', description: 'Missing alt', selector: 'img', helpUrl: '' },
      { ruleId: 'label', impact: 'moderate', description: 'Missing label', selector: 'input', helpUrl: '' },
      { ruleId: 'link-name', impact: 'minor', description: 'Empty link', selector: 'a', helpUrl: '' },
      { ruleId: 'heading-order', impact: 'moderate', description: 'Wrong order', selector: 'h3', helpUrl: '' },
    ];

    it('should summarize issues by impact', () => {
      const summary = summarizeIssues(mockIssues);
      expect(summary.critical).toBe(1);
      expect(summary.serious).toBe(1);
      expect(summary.moderate).toBe(2);
      expect(summary.minor).toBe(1);
    });

    it('should return zeros for empty issues', () => {
      const summary = summarizeIssues([]);
      expect(summary.critical).toBe(0);
      expect(summary.serious).toBe(0);
      expect(summary.moderate).toBe(0);
      expect(summary.minor).toBe(0);
    });

    it('should check threshold - fail', () => {
      const result = meetsThreshold(mockIssues, 0, 0);
      expect(result).toBe(false);
    });

    it('should check threshold - pass with allowance', () => {
      const result = meetsThreshold(mockIssues, 1, 1);
      expect(result).toBe(true);
    });

    it('should pass threshold with no issues', () => {
      const result = meetsThreshold([]);
      expect(result).toBe(true);
    });
  });

  describe('Journey Structure', () => {
    it('homepage-load should have valid structure', () => {
      const journey = getJourney('homepage-load');
      expect(journey?.startUrl).toBeDefined();
      expect(journey?.steps.length).toBeGreaterThan(0);
      expect(journey?.steps[0].action).toBeDefined();
    });

    it('all standard journeys should have required fields', () => {
      for (const journey of STANDARD_JOURNEYS) {
        expect(journey.id).toBeDefined();
        expect(journey.name).toBeDefined();
        expect(journey.description).toBeDefined();
        expect(journey.startUrl).toBeDefined();
        expect(journey.steps).toBeDefined();
        expect(journey.steps.length).toBeGreaterThan(0);
      }
    });

    it('all steps should have valid actions', () => {
      const validActions = ['navigate', 'click', 'type', 'wait', 'screenshot', 'assert', 'select'];

      for (const journey of STANDARD_JOURNEYS) {
        for (const step of journey.steps) {
          expect(validActions).toContain(step.action);
        }
      }
    });
  });

  describe('Type Definitions', () => {
    it('should allow creating valid journey step', () => {
      const step = {
        action: 'click' as const,
        target: '#button',
        timeout: 5000,
      };
      expect(step.action).toBe('click');
    });

    it('should allow creating valid journey', () => {
      const journey: Journey = {
        id: 'test',
        name: 'Test',
        description: 'Test journey',
        startUrl: 'http://localhost',
        steps: [],
      };
      expect(journey.id).toBe('test');
    });

    it('should allow creating accessibility issue', () => {
      const issue: AccessibilityIssue = {
        ruleId: 'test-rule',
        impact: 'serious',
        description: 'Test issue',
        selector: '#element',
        helpUrl: 'http://help.example.com',
      };
      expect(issue.impact).toBe('serious');
    });
  });
});
