/**
 * Brief Parser for Spec Agent
 *
 * Parses brief.md files to extract structured data:
 * - Problem statement
 * - Proposed solution
 * - MVP scope
 * - Technical constraints
 * - Success criteria
 */

import * as yaml from 'yaml';

export interface ParsedBrief {
  id: string;
  title: string;
  complexity: 'simple' | 'medium' | 'complex';
  problem: string;
  solution: string;
  mvpScope: MvpScope;
  constraints: string[];
  successCriteria: string[];
  architecture?: string;
  databaseSchema?: string;
  rawContent: string;
}

export interface MvpScope {
  inScope: string[];
  outOfScope: string[];
}

export interface ParseResult {
  brief: ParsedBrief;
  valid: boolean;
  missing: string[];
  warnings: string[];
  questions: string[];
}

export interface Frontmatter {
  id?: string;
  title?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  creator?: string;
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

/**
 * Required sections in a brief (documented for reference)
 */

export class BriefParser {
  /**
   * Parse brief content and extract structured data
   */
  parse(content: string): ParseResult {
    const missing: string[] = [];
    const warnings: string[] = [];
    const questions: string[] = [];

    // Extract frontmatter
    const frontmatter = this.extractFrontmatter(content);
    const contentWithoutFrontmatter = this.removeFrontmatter(content);

    // Extract sections
    const problem = this.extractSection(contentWithoutFrontmatter, 'Problem');
    const solution = this.extractSection(contentWithoutFrontmatter, 'Solution');
    const mvpScope = this.extractMvpScope(contentWithoutFrontmatter);
    const constraints = this.extractListItems(contentWithoutFrontmatter, 'Constraints');
    const successCriteria = this.extractSuccessCriteria(contentWithoutFrontmatter);
    const architecture = this.extractSection(contentWithoutFrontmatter, 'Architecture');
    const databaseSchema = this.extractCodeBlock(contentWithoutFrontmatter, 'sql');

    // Validate required fields
    if (!frontmatter.id) {
      missing.push('id (in frontmatter)');
    }
    if (!frontmatter.title) {
      missing.push('title (in frontmatter)');
    }
    if (!problem) {
      missing.push('Problem section');
    }
    if (!solution) {
      missing.push('Solution section');
    }

    // Check recommended sections
    if (mvpScope.inScope.length === 0 && mvpScope.outOfScope.length === 0) {
      warnings.push('No MVP Scope section found');
    }
    if (successCriteria.length === 0) {
      warnings.push('No Success Criteria found');
    }

    // Generate questions for ambiguity
    if (problem && problem.length < 100) {
      questions.push('The problem statement is brief. Can you elaborate on the specific pain points?');
    }
    if (solution && !solution.includes('API') && !solution.includes('database') && !solution.includes('table')) {
      questions.push('What data structures or APIs will this feature require?');
    }
    if (!frontmatter.complexity) {
      questions.push('What is the complexity level of this feature: simple, medium, or complex?');
    }
    if (successCriteria.length === 0) {
      questions.push('What are the specific success criteria for this feature?');
    }

    // Infer complexity if not specified
    const complexity = frontmatter.complexity || this.inferComplexity(mvpScope, solution);

    const brief: ParsedBrief = {
      id: frontmatter.id || 'unknown',
      title: frontmatter.title || 'Untitled',
      complexity,
      problem: problem || '',
      solution: solution || '',
      mvpScope,
      constraints,
      successCriteria,
      architecture: architecture || undefined,
      databaseSchema: databaseSchema || undefined,
      rawContent: content
    };

    const valid = missing.length === 0;

    return {
      brief,
      valid,
      missing,
      warnings,
      questions
    };
  }

  /**
   * Extract YAML frontmatter from content
   */
  private extractFrontmatter(content: string): Frontmatter {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      return {};
    }

    try {
      return yaml.parse(match[1]) || {};
    } catch {
      return {};
    }
  }

  /**
   * Remove frontmatter from content
   */
  private removeFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
  }

  /**
   * Extract content under a specific heading
   */
  private extractSection(content: string, heading: string): string {
    // Match ## heading or # heading (case insensitive)
    const pattern = new RegExp(
      `#+\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n#+\\s|$)`,
      'i'
    );
    const match = content.match(pattern);

    if (!match) {
      return '';
    }

    return match[1].trim();
  }

  /**
   * Extract MVP scope as in-scope and out-of-scope lists
   */
  private extractMvpScope(content: string): MvpScope {
    const mvpSection = this.extractSection(content, 'MVP Scope') ||
                       this.extractSection(content, 'Scope');

    const inScope: string[] = [];
    const outOfScope: string[] = [];

    if (!mvpSection) {
      return { inScope, outOfScope };
    }

    // Look for "In Scope" and "Out of Scope" subsections within the MVP section
    // Match ### In Scope, **In Scope:**, or other common formats
    const inScopeMatch = mvpSection.match(/(?:###?\s*|\*\*\s*)In[- ]?Scope[^\n]*(?:\*\*)?:?\n([\s\S]*?)(?=(?:###?\s|\*\*\s*Out)|$)/i);
    const outOfScopeMatch = mvpSection.match(/(?:###?\s*|\*\*\s*)Out[- ]?of[- ]?Scope[^\n]*(?:\*\*)?:?\n([\s\S]*?)(?=(?:###?\s|\*\*)|$)/i);

    if (inScopeMatch) {
      inScope.push(...this.extractListFromText(inScopeMatch[1]));
    }
    if (outOfScopeMatch) {
      outOfScope.push(...this.extractListFromText(outOfScopeMatch[1]));
    }

    // If no subsections, try to parse the whole MVP section
    if (inScope.length === 0 && outOfScope.length === 0) {
      const items = this.extractListFromText(mvpSection);
      inScope.push(...items);
    }

    return { inScope, outOfScope };
  }

  /**
   * Extract list items from a section
   */
  private extractListItems(content: string, sectionName: string): string[] {
    const section = this.extractSection(content, sectionName);
    if (!section) {
      return [];
    }
    return this.extractListFromText(section);
  }

  /**
   * Extract list items from text (bullet points or numbered lists)
   */
  private extractListFromText(text: string): string[] {
    const items: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      // Match bullet points (-, *, +) or numbered lists
      const match = line.match(/^\s*[-*+]\s+(.+)$/) ||
                   line.match(/^\s*\d+\.\s+(.+)$/);
      if (match) {
        items.push(match[1].trim());
      }
    }

    return items;
  }

  /**
   * Extract success criteria (handles checkboxes)
   */
  private extractSuccessCriteria(content: string): string[] {
    const section = this.extractSection(content, 'Success Criteria') ||
                   this.extractSection(content, 'Acceptance Criteria');

    if (!section) {
      return [];
    }

    const criteria: string[] = [];
    const lines = section.split('\n');

    for (const line of lines) {
      // Match checkboxes [ ] or [x] or bullet points
      const match = line.match(/^\s*[-*+]\s*\[[ x]\]\s*(.+)$/) ||
                   line.match(/^\s*[-*+]\s+(.+)$/) ||
                   line.match(/^\s*\d+\.\s+(.+)$/);
      if (match) {
        criteria.push(match[1].trim());
      }
    }

    return criteria;
  }

  /**
   * Extract code block of specific language
   */
  private extractCodeBlock(content: string, language: string): string | undefined {
    const pattern = new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 'i');
    const match = content.match(pattern);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Infer complexity from scope and solution
   */
  private inferComplexity(mvpScope: MvpScope, solution: string): 'simple' | 'medium' | 'complex' {
    const totalItems = mvpScope.inScope.length + mvpScope.outOfScope.length;
    const solutionLength = solution.length;

    // Simple heuristics
    if (totalItems <= 5 && solutionLength < 500) {
      return 'simple';
    }
    if (totalItems > 10 || solutionLength > 1500) {
      return 'complex';
    }
    return 'medium';
  }

  /**
   * Validate brief has all required fields
   */
  validateBrief(brief: ParsedBrief): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!brief.id || brief.id === 'unknown') {
      missing.push('id');
    }
    if (!brief.title || brief.title === 'Untitled') {
      missing.push('title');
    }
    if (!brief.problem) {
      missing.push('problem');
    }
    if (!brief.solution) {
      missing.push('solution');
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Get expected task count based on complexity
   */
  getExpectedTaskCount(complexity: 'simple' | 'medium' | 'complex'): { min: number; max: number } {
    switch (complexity) {
      case 'simple':
        return { min: 5, max: 8 };
      case 'medium':
        return { min: 10, max: 15 };
      case 'complex':
        return { min: 20, max: 30 };
    }
  }
}
