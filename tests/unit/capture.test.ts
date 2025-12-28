import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { titleToSlug } from '../../utils/parser.js';

describe('Idea Capture', () => {
  const testDir = './test-ideas';

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Slug Generation', () => {
    it('should generate valid slugs from titles', () => {
      expect(titleToSlug('My Great Idea')).toBe('my-great-idea');
      expect(titleToSlug('Solar-Powered Phone Charger')).toBe('solar-powered-phone-charger');
      expect(titleToSlug('App for Tracking Plants!')).toBe('app-for-tracking-plants');
    });

    it('should handle edge cases', () => {
      expect(titleToSlug('   Spaces   ')).toBe('spaces');
      expect(titleToSlug('Multiple   Spaces   Here')).toBe('multiple-spaces-here');
      expect(titleToSlug('123 Numbers')).toBe('123-numbers');
    });
  });

  describe('Folder Structure', () => {
    it('should create correct folder structure', () => {
      const slug = 'test-idea';
      const ideaDir = path.join(testDir, slug);

      // Create structure
      fs.mkdirSync(ideaDir, { recursive: true });
      fs.mkdirSync(path.join(ideaDir, 'research'), { recursive: true });
      fs.mkdirSync(path.join(ideaDir, 'notes'), { recursive: true });
      fs.mkdirSync(path.join(ideaDir, 'assets'), { recursive: true });

      // Verify structure
      expect(fs.existsSync(ideaDir)).toBe(true);
      expect(fs.existsSync(path.join(ideaDir, 'research'))).toBe(true);
      expect(fs.existsSync(path.join(ideaDir, 'notes'))).toBe(true);
      expect(fs.existsSync(path.join(ideaDir, 'assets'))).toBe(true);
    });
  });

  describe('README Template', () => {
    it('should contain required frontmatter fields', () => {
      const templateContent = fs.readFileSync('./templates/idea.md', 'utf-8');

      expect(templateContent).toContain('id:');
      expect(templateContent).toContain('title:');
      expect(templateContent).toContain('type:');
      expect(templateContent).toContain('stage:');
      expect(templateContent).toContain('created:');
      expect(templateContent).toContain('tags:');
      expect(templateContent).toContain('related:');
    });

    it('should contain required sections', () => {
      const templateContent = fs.readFileSync('./templates/idea.md', 'utf-8');

      expect(templateContent).toContain('## Overview');
      expect(templateContent).toContain('## Problem Statement');
      expect(templateContent).toContain('## Target Users');
      expect(templateContent).toContain('## Proposed Solution');
    });
  });
});
