import { describe, it, expect } from 'vitest';
import {
  titleToSlug,
  extractTitle,
  extractSummary,
  generateFrontmatter,
  generateMarkdown,
  parseMarkdownContent,
  computeHash
} from '../../utils/parser.js';

describe('Parser Utils', () => {
  describe('titleToSlug', () => {
    it('should convert title to kebab-case', () => {
      expect(titleToSlug('My Great Idea')).toBe('my-great-idea');
    });

    it('should handle special characters', () => {
      expect(titleToSlug("What's This?")).toBe('whats-this');
    });

    it('should handle multiple spaces', () => {
      expect(titleToSlug('Too   Many   Spaces')).toBe('too-many-spaces');
    });

    it('should trim leading/trailing spaces', () => {
      expect(titleToSlug('  Trimmed  ')).toBe('trimmed');
    });

    it('should handle numbers', () => {
      expect(titleToSlug('Version 2.0 Release')).toBe('version-20-release');
    });
  });

  describe('extractTitle', () => {
    it('should extract h1 title', () => {
      const content = '# My Idea\n\nSome content';
      expect(extractTitle(content)).toBe('My Idea');
    });

    it('should return null if no title', () => {
      const content = 'Just some content';
      expect(extractTitle(content)).toBeNull();
    });

    it('should handle title with special chars', () => {
      const content = '# What\'s the Big Idea?\n\nContent';
      expect(extractTitle(content)).toBe("What's the Big Idea?");
    });
  });

  describe('extractSummary', () => {
    it('should extract first paragraph after title', () => {
      const content = '# Title\n\nThis is the summary paragraph.\n\nMore content.';
      expect(extractSummary(content)).toBe('This is the summary paragraph.');
    });

    it('should truncate long summaries', () => {
      const longParagraph = 'A'.repeat(250);
      const content = `# Title\n\n${longParagraph}\n\nMore.`;
      const summary = extractSummary(content, 100);

      expect(summary!.length).toBeLessThanOrEqual(100);
      expect(summary).toContain('...');
    });

    it('should skip h2 headers', () => {
      const content = '# Title\n\n## Subtitle\n\nActual content.';
      expect(extractSummary(content)).toBe('Actual content.');
    });
  });

  describe('generateFrontmatter', () => {
    it('should generate valid YAML', () => {
      const data = {
        id: '123',
        title: 'Test',
        tags: ['a', 'b']
      };

      const yaml = generateFrontmatter(data);
      expect(yaml).toContain('---');
      expect(yaml).toContain('id: 123');
      expect(yaml).toContain('title: Test');
      expect(yaml).toContain('tags:');
      expect(yaml).toContain('  - a');
      expect(yaml).toContain('  - b');
    });

    it('should handle empty arrays', () => {
      const data = { tags: [] };
      const yaml = generateFrontmatter(data);
      expect(yaml).toContain('tags: []');
    });
  });

  describe('generateMarkdown', () => {
    it('should combine frontmatter and content', () => {
      const frontmatter = { title: 'Test' };
      const content = '# Test\n\nContent here.';

      const md = generateMarkdown(frontmatter, content);
      expect(md).toContain('---');
      expect(md).toContain('title: Test');
      expect(md).toContain('# Test');
      expect(md).toContain('Content here.');
    });
  });

  describe('parseMarkdownContent', () => {
    it('should parse frontmatter and body', () => {
      const content = `---
title: Test
type: technical
---

# Content

Body text.`;

      const result = parseMarkdownContent(content);
      expect(result.frontmatter.title).toBe('Test');
      expect(result.frontmatter.type).toBe('technical');
      expect(result.body).toContain('# Content');
    });

    it('should handle content without frontmatter', () => {
      const content = '# Just content\n\nNo frontmatter.';
      const result = parseMarkdownContent(content);

      expect(Object.keys(result.frontmatter)).toHaveLength(0);
      expect(result.body).toContain('# Just content');
    });
  });

  describe('computeHash', () => {
    it('should return consistent hash for same content', () => {
      const content = 'Test content';
      const hash1 = computeHash(content);
      const hash2 = computeHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different content', () => {
      const hash1 = computeHash('Content A');
      const hash2 = computeHash('Content B');

      expect(hash1).not.toBe(hash2);
    });

    it('should return 32 character MD5 hash', () => {
      const hash = computeHash('Test');
      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });
});
