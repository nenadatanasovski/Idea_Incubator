/**
 * Tests for Notification Template Rendering
 */
import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  renderHtmlTemplate,
  escapeHtml,
  getMissingVariables,
  extractVariables
} from '../server/notifications/templates.js';

describe('Template Rendering', () => {
  describe('renderTemplate', () => {
    it('should replace simple variables', () => {
      const template = 'Hello, {{name}}!';
      const data = { name: 'World' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello, World!');
    });

    it('should replace multiple variables', () => {
      const template = '{{greeting}}, {{name}}! Welcome to {{place}}.';
      const data = { greeting: 'Hello', name: 'User', place: 'Vibe' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello, User! Welcome to Vibe.');
    });

    it('should support nested paths', () => {
      const template = 'User: {{user.name}}, Email: {{user.email}}';
      const data = {
        user: {
          name: 'John',
          email: 'john@example.com'
        }
      };

      const result = renderTemplate(template, data);

      expect(result).toBe('User: John, Email: john@example.com');
    });

    it('should leave missing variables unchanged', () => {
      const template = 'Hello, {{name}}! You have {{count}} messages.';
      const data = { name: 'User' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello, User! You have {{count}} messages.');
    });

    it('should handle empty data object', () => {
      const template = 'Hello, {{name}}!';
      const data = {};

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello, {{name}}!');
    });

    it('should convert values to strings', () => {
      const template = 'Count: {{count}}, Active: {{active}}';
      const data = { count: 42, active: true };

      const result = renderTemplate(template, data);

      expect(result).toBe('Count: 42, Active: true');
    });

    it('should handle null/undefined values as missing', () => {
      const template = 'Value: {{value}}';
      const data = { value: null };

      const result = renderTemplate(template, data);

      expect(result).toBe('Value: {{value}}');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';

      const result = escapeHtml(input);

      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("It's fine")).toBe('It&#39;s fine');
    });

    it('should handle text without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('renderHtmlTemplate', () => {
    it('should escape values for HTML safety', () => {
      const template = '<p>Message: {{message}}</p>';
      const data = { message: '<script>evil()</script>' };

      const result = renderHtmlTemplate(template, data);

      expect(result).toBe('<p>Message: &lt;script&gt;evil()&lt;/script&gt;</p>');
    });

    it('should still replace variables', () => {
      const template = '<div>Hello, {{name}}!</div>';
      const data = { name: 'User' };

      const result = renderHtmlTemplate(template, data);

      expect(result).toBe('<div>Hello, User!</div>');
    });
  });

  describe('getMissingVariables', () => {
    it('should return empty array when all variables present', () => {
      const template = '{{a}} and {{b}}';
      const data = { a: '1', b: '2' };

      const missing = getMissingVariables(template, data);

      expect(missing).toEqual([]);
    });

    it('should return missing variable names', () => {
      const template = '{{a}}, {{b}}, {{c}}';
      const data = { a: '1' };

      const missing = getMissingVariables(template, data);

      expect(missing).toContain('b');
      expect(missing).toContain('c');
      expect(missing).not.toContain('a');
    });

    it('should handle nested paths', () => {
      const template = '{{user.name}} - {{user.email}}';
      const data = { user: { name: 'John' } };

      const missing = getMissingVariables(template, data);

      expect(missing).toContain('user.email');
      expect(missing).not.toContain('user.name');
    });
  });

  describe('extractVariables', () => {
    it('should extract all variable names', () => {
      const template = 'Hello {{name}}, you have {{count}} {{items}}';

      const variables = extractVariables(template);

      expect(variables).toEqual(['name', 'count', 'items']);
    });

    it('should not include duplicates', () => {
      const template = '{{name}} said {{name}} again';

      const variables = extractVariables(template);

      expect(variables).toEqual(['name']);
    });

    it('should extract nested paths', () => {
      const template = '{{user.name}} ({{user.email}})';

      const variables = extractVariables(template);

      expect(variables).toContain('user.name');
      expect(variables).toContain('user.email');
    });

    it('should return empty array for template without variables', () => {
      const template = 'Hello World!';

      const variables = extractVariables(template);

      expect(variables).toEqual([]);
    });
  });
});
