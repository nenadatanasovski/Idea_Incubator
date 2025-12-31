import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  generateGreeting,
  generateGreetingWithButtons,
  generateReturningGreeting,
} from '../../agents/ideation/greeting-generator.js';

describe('GreetingGenerator', () => {

  describe('generateGreeting', () => {
    test('PASS: Includes welcome message', () => {
      const greeting = generateGreeting({});

      expect(greeting).toContain('Welcome');
    });

    test('PASS: Includes process explanation', () => {
      const greeting = generateGreeting({});

      expect(greeting).toContain("We'll have a conversation");
      expect(greeting).toContain('panel on the right');
    });

    test('PASS: Includes opening question', () => {
      const greeting = generateGreeting({});

      expect(greeting).toContain("What's been occupying your mind");
    });

    test('PASS: Personalizes for technical skills', () => {
      const greeting = generateGreeting({
        skills: ['programming', 'software development', 'marketing'],
      });

      expect(greeting).toContain('technical background');
      expect(greeting).toContain('programming');
    });

    test('PASS: Personalizes for industry experience', () => {
      const greeting = generateGreeting({
        experience: {
          industries: ['healthcare', 'fintech'],
        },
      });

      expect(greeting).toContain('experience in');
      expect(greeting).toContain('healthcare');
    });

    test('PASS: Personalizes for interests', () => {
      const greeting = generateGreeting({
        interests: ['sustainability', 'AI'],
      });

      expect(greeting).toContain('interest in');
      expect(greeting).toContain('sustainability');
    });

    test('PASS: Personalizes for location', () => {
      const greeting = generateGreeting({
        location: { city: 'Sydney' },
      });

      expect(greeting).toContain('based in Sydney');
    });

    test('PASS: Combines multiple personalizations', () => {
      const greeting = generateGreeting({
        skills: ['data engineering'],
        experience: { industries: ['fintech'] },
        location: { city: 'Melbourne' },
      });

      expect(greeting).toContain('data engineering');
      expect(greeting).toContain('fintech');
      expect(greeting).toContain('Melbourne');
    });

    test('PASS: Works with empty profile', () => {
      const greeting = generateGreeting({});

      expect(greeting).toContain('Welcome');
      expect(greeting).toContain("I've loaded your profile");
    });
  });

  describe('generateGreetingWithButtons', () => {
    test('PASS: Returns greeting text', () => {
      const result = generateGreetingWithButtons({});

      expect(result.text).toContain('Welcome');
    });

    test('PASS: Returns three starting buttons', () => {
      const result = generateGreetingWithButtons({});

      expect(result.buttons.length).toBe(3);
    });

    test('PASS: Includes frustration button', () => {
      const result = generateGreetingWithButtons({});

      const frustrationBtn = result.buttons.find(b => b.id === 'btn_frustration');
      expect(frustrationBtn).toBeDefined();
      expect(frustrationBtn!.label).toContain('frustrates');
    });

    test('PASS: Includes idea button', () => {
      const result = generateGreetingWithButtons({});

      const ideaBtn = result.buttons.find(b => b.id === 'btn_idea');
      expect(ideaBtn).toBeDefined();
      expect(ideaBtn!.label).toContain('idea');
    });

    test('PASS: Includes explore button', () => {
      const result = generateGreetingWithButtons({});

      const exploreBtn = result.buttons.find(b => b.id === 'btn_explore');
      expect(exploreBtn).toBeDefined();
      expect(exploreBtn!.label).toContain('explore');
    });

    test('PASS: All buttons have required fields', () => {
      const result = generateGreetingWithButtons({});

      for (const button of result.buttons) {
        expect(button.id).toBeDefined();
        expect(button.label).toBeDefined();
        expect(button.value).toBeDefined();
        expect(button.style).toBeDefined();
      }
    });
  });

  describe('generateReturningGreeting', () => {
    test('PASS: Includes welcome back', () => {
      const greeting = generateReturningGreeting({});

      expect(greeting).toContain('Welcome back');
    });

    test('PASS: Uses name if provided', () => {
      const greeting = generateReturningGreeting({ name: 'Alex' });

      expect(greeting).toContain('Alex');
    });

    test('PASS: Includes session summary if provided', () => {
      const greeting = generateReturningGreeting(
        {},
        'we explored ideas around coworking spaces'
      );

      expect(greeting).toContain('coworking spaces');
      expect(greeting).toContain('continue');
    });

    test('PASS: Works without session summary', () => {
      const greeting = generateReturningGreeting({ name: 'Jordan' });

      expect(greeting).toContain('Ready to explore');
    });
  });
});
