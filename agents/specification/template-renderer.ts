/**
 * Template Renderer for Spec Agent
 *
 * Fills spec and task templates with generated content while preserving structure.
 * Supports {{variable}} placeholders, conditional sections, and YAML frontmatter.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as yaml from 'yaml';

export interface TemplateSection {
  name: string;
  content: string;
  required: boolean;
  filled: boolean;
}

export interface RenderResult {
  content: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  sections: TemplateSection[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FrontmatterData {
  id: string;
  title: string;
  [key: string]: unknown;
}

/**
 * Required sections for spec.md
 */
const REQUIRED_SPEC_SECTIONS = [
  'Overview',
  'Functional Requirements',
  'Architecture',
  'API Design',
  'Data Models',
  'Known Gotchas',
  'Validation Strategy'
];

/**
 * Required sections for tasks.md
 */
const REQUIRED_TASKS_SECTIONS = [
  'Summary',
  'Context Loading',
  'Phase 1',
  'Execution Log',
  'Completion Checklist'
];

export class TemplateRenderer {
  private template: string = '';
  private templateType: 'spec' | 'tasks' = 'spec';

  constructor(templateContent?: string) {
    if (templateContent) {
      this.template = templateContent;
      this.detectTemplateType();
    }
  }

  /**
   * Load template from file path
   */
  async loadTemplate(templatePath: string): Promise<void> {
    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    this.template = await readFile(templatePath, 'utf-8');
    this.detectTemplateType();
  }

  /**
   * Detect if this is a spec or tasks template
   */
  private detectTemplateType(): void {
    if (this.template.includes('total_tasks') || this.template.includes('Phase 1:')) {
      this.templateType = 'tasks';
    } else {
      this.templateType = 'spec';
    }
  }

  /**
   * Render template with provided data
   */
  render(data: Record<string, unknown>): RenderResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sections: TemplateSection[] = [];

    let content = this.template;

    // First, render YAML frontmatter
    content = this.renderFrontmatter(content, data, errors);

    // Then, render simple placeholders {{variable}}
    content = this.renderPlaceholders(content, data, warnings);

    // Render nested placeholders {{object.property}}
    content = this.renderNestedPlaceholders(content, data, warnings);

    // Extract and validate sections
    const requiredSections = this.templateType === 'spec'
      ? REQUIRED_SPEC_SECTIONS
      : REQUIRED_TASKS_SECTIONS;

    for (const sectionName of requiredSections) {
      const hasSection = content.includes(`## ${sectionName}`) ||
                        content.includes(`# ${sectionName}`);
      sections.push({
        name: sectionName,
        content: '', // Would need to extract actual content
        required: true,
        filled: hasSection
      });

      if (!hasSection) {
        errors.push(`Missing required section: ${sectionName}`);
      }
    }

    // Check for unfilled placeholders
    const unfilledMatches = content.match(/\{\{[\w.]+\}\}/g);
    if (unfilledMatches) {
      const uniqueUnfilled = [...new Set(unfilledMatches)];
      for (const placeholder of uniqueUnfilled) {
        warnings.push(`Unfilled placeholder: ${placeholder}`);
      }
    }

    const valid = errors.length === 0;

    return {
      content,
      valid,
      errors,
      warnings,
      sections
    };
  }

  /**
   * Render YAML frontmatter
   */
  private renderFrontmatter(
    content: string,
    data: Record<string, unknown>,
    errors: string[]
  ): string {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return content;
    }

    try {
      let frontmatter = frontmatterMatch[1];

      // Replace placeholders in frontmatter
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' || typeof value === 'number') {
          const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          frontmatter = frontmatter.replace(placeholder, String(value));
        }
      }

      // Validate YAML is still valid
      yaml.parse(frontmatter);

      return content.replace(frontmatterMatch[1], frontmatter);
    } catch (error) {
      errors.push(`Invalid YAML frontmatter: ${error}`);
      return content;
    }
  }

  /**
   * Render simple {{variable}} placeholders
   */
  private renderPlaceholders(
    content: string,
    data: Record<string, unknown>,
    warnings: string[]
  ): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in data) {
        const value = data[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }
        if (Array.isArray(value)) {
          return value.join('\n');
        }
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value, null, 2);
        }
      }
      return match; // Keep original if not found
    });
  }

  /**
   * Render nested {{object.property}} placeholders
   */
  private renderNestedPlaceholders(
    content: string,
    data: Record<string, unknown>,
    warnings: string[]
  ): string {
    return content.replace(/\{\{(\w+(?:\.\w+)+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      if (value !== undefined) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }
        if (Array.isArray(value)) {
          return value.join('\n');
        }
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value, null, 2);
        }
      }
      return match; // Keep original if not found
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Validate rendered content
   */
  validate(rendered: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check YAML frontmatter is valid
    const frontmatterMatch = rendered.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      try {
        const frontmatter = yaml.parse(frontmatterMatch[1]);
        if (!frontmatter.id) {
          errors.push('Frontmatter missing required field: id');
        }
        if (!frontmatter.title) {
          errors.push('Frontmatter missing required field: title');
        }
      } catch (error) {
        errors.push(`Invalid YAML frontmatter: ${error}`);
      }
    } else {
      errors.push('Missing YAML frontmatter');
    }

    // Check required sections exist
    const requiredSections = this.templateType === 'spec'
      ? REQUIRED_SPEC_SECTIONS
      : REQUIRED_TASKS_SECTIONS;

    for (const section of requiredSections) {
      if (!rendered.includes(`## ${section}`) && !rendered.includes(`# ${section}`)) {
        errors.push(`Missing required section: ${section}`);
      }
    }

    // Check for unfilled placeholders
    const unfilledMatches = rendered.match(/\{\{[\w.]+\}\}/g);
    if (unfilledMatches) {
      const uniqueUnfilled = [...new Set(unfilledMatches)];
      for (const placeholder of uniqueUnfilled) {
        warnings.push(`Unfilled placeholder: ${placeholder}`);
      }
    }

    // Additional spec-specific validations
    if (this.templateType === 'spec') {
      // Check for code blocks
      if (!rendered.includes('```sql') && !rendered.includes('```typescript')) {
        warnings.push('Spec may be missing code examples');
      }

      // Check for tables
      if (!rendered.includes('| ')) {
        warnings.push('Spec may be missing tables');
      }
    }

    // Additional tasks-specific validations
    if (this.templateType === 'tasks') {
      // Check for task YAML blocks
      const taskBlocks = rendered.match(/```yaml\nid: T-/g);
      if (!taskBlocks || taskBlocks.length === 0) {
        errors.push('Tasks file missing task YAML blocks');
      }

      // Check total_tasks matches actual tasks
      const frontmatter = this.parseFrontmatter(rendered);
      if (frontmatter && taskBlocks) {
        const totalTasks = frontmatter.total_tasks;
        if (totalTasks && totalTasks !== taskBlocks.length) {
          warnings.push(`total_tasks (${totalTasks}) doesn't match actual tasks (${taskBlocks.length})`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Parse frontmatter from rendered content
   */
  private parseFrontmatter(content: string): Record<string, unknown> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    try {
      return yaml.parse(match[1]);
    } catch {
      return null;
    }
  }

  /**
   * Check if a string looks like valid YAML
   */
  isValidYaml(content: string): boolean {
    try {
      yaml.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get template type
   */
  getTemplateType(): 'spec' | 'tasks' {
    return this.templateType;
  }

  /**
   * Set template type explicitly
   */
  setTemplateType(type: 'spec' | 'tasks'): void {
    this.templateType = type;
  }
}
