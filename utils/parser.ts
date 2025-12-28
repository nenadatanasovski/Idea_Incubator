import * as fs from 'fs';
import matter from 'gray-matter';
import { createHash } from 'crypto';
import { IdeaFrontmatterSchema, IdeaFrontmatter } from './schemas.js';
import { MarkdownParseError } from './errors.js';

/**
 * Parse markdown file with YAML frontmatter
 */
export function parseMarkdown(filePath: string): {
  frontmatter: IdeaFrontmatter;
  content: string;
  hash: string;
} {
  if (!fs.existsSync(filePath)) {
    throw new MarkdownParseError(filePath, 'File does not exist');
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const hash = computeHash(raw);

  try {
    const { data, content } = matter(raw);

    // Validate frontmatter against schema
    const frontmatter = IdeaFrontmatterSchema.parse(data);

    return { frontmatter, content: content.trim(), hash };
  } catch (error) {
    if (error instanceof Error) {
      throw new MarkdownParseError(filePath, error.message);
    }
    throw error;
  }
}

/**
 * Parse markdown content string (not from file)
 */
export function parseMarkdownContent(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const { data, content: body } = matter(content);
  return { frontmatter: data, body: body.trim() };
}

/**
 * Compute MD5 hash of content for staleness detection
 */
export function computeHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Generate frontmatter YAML string
 */
export function generateFrontmatter(data: Record<string, unknown>): string {
  const yaml = Object.entries(data)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) return `${key}: []`;
        return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
      }
      if (typeof value === 'object' && value !== null) {
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');

  return `---\n${yaml}\n---`;
}

/**
 * Generate complete markdown file content
 */
export function generateMarkdown(
  frontmatter: Record<string, unknown>,
  content: string
): string {
  return `${generateFrontmatter(frontmatter)}\n\n${content}`;
}

/**
 * Convert title to kebab-case slug
 */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extract title from markdown content
 */
export function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Extract summary from markdown content (first paragraph after title)
 */
export function extractSummary(content: string, maxLength: number = 200): string | null {
  // Remove title
  const withoutTitle = content.replace(/^#\s+.+\n+/, '');

  // Get first paragraph
  const paragraphs = withoutTitle.split(/\n\n+/);
  const firstParagraph = paragraphs.find(p => p.trim() && !p.startsWith('#'));

  if (!firstParagraph) return null;

  const summary = firstParagraph.trim().replace(/\n/g, ' ');
  if (summary.length <= maxLength) return summary;

  return summary.substring(0, maxLength - 3) + '...';
}

/**
 * Parse evaluation scores from evaluation.md content
 */
export function parseEvaluationScores(content: string): Map<string, {
  score: number;
  confidence?: number;
  reasoning?: string;
}> {
  const scores = new Map<string, { score: number; confidence?: number; reasoning?: string }>();

  // Match patterns like "| Problem Clarity | 8 | 0.85 | reasoning |"
  const tableRowPattern = /\|\s*([^|]+)\s*\|\s*(\d+)\s*\|\s*([\d.]+)?\s*\|\s*([^|]*)\s*\|/g;

  let match;
  while ((match = tableRowPattern.exec(content)) !== null) {
    const criterion = match[1].trim();
    const score = parseInt(match[2], 10);
    const confidence = match[3] ? parseFloat(match[3]) : undefined;
    const reasoning = match[4]?.trim() || undefined;

    if (!isNaN(score) && score >= 1 && score <= 10) {
      scores.set(criterion, { score, confidence, reasoning });
    }
  }

  return scores;
}

/**
 * Update frontmatter in existing markdown file
 */
export function updateFrontmatter(
  filePath: string,
  updates: Record<string, unknown>
): void {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const newData = { ...data, ...updates };
  const newContent = generateMarkdown(newData, content.trim());

  fs.writeFileSync(filePath, newContent, 'utf-8');
}
