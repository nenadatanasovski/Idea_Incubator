/**
 * Context Primer for Build Agent
 *
 * Loads and assembles context for code generation tasks.
 * Prioritizes relevant files and respects token limits.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  AtomicTask,
  TaskContext,
  Gotcha
} from '../../types/build-agent.js';

const DEFAULT_TOKEN_LIMIT = 100000;
const CHARS_PER_TOKEN = 4; // Rough estimate

export interface ContextPrimerOptions {
  tokenLimit?: number;
  projectRoot?: string;
}

export interface TasksFile {
  id: string;
  complexity: string;
  totalTasks: number;
  phases: Record<string, number>;
}

export class ContextPrimer {
  private tokenLimit: number;
  private projectRoot: string;

  constructor(options: ContextPrimerOptions = {}) {
    this.tokenLimit = options.tokenLimit || DEFAULT_TOKEN_LIMIT;
    this.projectRoot = options.projectRoot || process.cwd();
  }

  /**
   * Load full context for a specific task
   */
  async loadForTask(taskId: string, specPath: string): Promise<TaskContext> {
    // Load tasks file
    const tasksContent = this.loadFile(specPath);
    if (!tasksContent) {
      throw new Error(`Failed to load tasks from ${specPath}`);
    }

    // Parse tasks
    const tasks = this.parseTasks(tasksContent);
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in ${specPath}`);
    }

    // Load task context
    return this.loadTask(task, tasks, specPath);
  }

  /**
   * Load context for a single task
   */
  async loadTask(task: AtomicTask, allTasks: AtomicTask[], specPath: string): Promise<TaskContext> {
    let tokenCount = 0;

    // 1. Load CLAUDE.md conventions
    const conventions = this.loadConventions();
    tokenCount += this.estimateTokens(conventions);

    // 2. Load spec sections
    const specSections = this.loadSpecSections(specPath, task);
    tokenCount += specSections.reduce((sum, s) => sum + this.estimateTokens(s), 0);

    // 3. Load dependency outputs
    const dependencyOutputs = this.loadDependencyOutputs(task, allTasks);
    tokenCount += Object.values(dependencyOutputs).reduce(
      (sum, content) => sum + this.estimateTokens(content),
      0
    );

    // 4. Load related codebase files
    const relatedFiles = this.loadCodebase(task, this.tokenLimit - tokenCount);
    tokenCount += Object.values(relatedFiles).reduce(
      (sum, content) => sum + this.estimateTokens(content),
      0
    );

    // 5. Get relevant gotchas
    const gotchas = this.getGotchas(task);
    tokenCount += gotchas.reduce(
      (sum, g) => sum + this.estimateTokens(g.content),
      0
    );

    return {
      task,
      specSections,
      dependencyOutputs,
      conventions,
      relatedFiles,
      gotchas,
      tokenCount
    };
  }

  /**
   * Load CLAUDE.md conventions
   */
  private loadConventions(): string {
    const claudePath = path.join(this.projectRoot, 'CLAUDE.md');
    return this.loadFile(claudePath) || '# No CLAUDE.md found';
  }

  /**
   * Load relevant spec sections for task
   */
  private loadSpecSections(specPath: string, task: AtomicTask): string[] {
    const specDir = path.dirname(specPath);
    const specFilePath = path.join(specDir, 'spec.md');
    const specContent = this.loadFile(specFilePath);

    if (!specContent) {
      return [];
    }

    const sections: string[] = [];

    // Extract sections relevant to the task's phase
    const phasePatterns: Record<string, RegExp> = {
      database: /## Data Models[\s\S]*?(?=##|$)/i,
      types: /## Data Models[\s\S]*?(?=##|$)/i,
      services: /## Architecture[\s\S]*?(?=##|$)/i,
      api: /## API Design[\s\S]*?(?=##|$)/i,
      tests: /## Validation Strategy[\s\S]*?(?=##|$)/i
    };

    const pattern = phasePatterns[task.phase];
    if (pattern) {
      const match = specContent.match(pattern);
      if (match) {
        sections.push(match[0]);
      }
    }

    // Always include gotchas section
    const gotchasMatch = specContent.match(/## Known Gotchas[\s\S]*?(?=##|$)/i);
    if (gotchasMatch) {
      sections.push(gotchasMatch[0]);
    }

    return sections;
  }

  /**
   * Load outputs from dependency tasks
   */
  private loadDependencyOutputs(task: AtomicTask, allTasks: AtomicTask[]): Record<string, string> {
    const outputs: Record<string, string> = {};

    for (const depId of task.dependsOn) {
      const depTask = allTasks.find(t => t.id === depId);
      if (depTask && depTask.file) {
        const filePath = path.join(this.projectRoot, depTask.file);
        const content = this.loadFile(filePath);
        if (content) {
          outputs[depTask.file] = content;
        }
      }
    }

    return outputs;
  }

  /**
   * Load related codebase files
   */
  loadCodebase(task: AtomicTask, remainingTokens: number): Record<string, string> {
    const relatedFiles: Record<string, string> = {};
    let usedTokens = 0;

    // Determine related file patterns based on task file
    const taskDir = path.dirname(task.file);
    const taskExt = path.extname(task.file);

    // Priority 1: Files in same directory
    const sameDirFiles = this.findFiles(taskDir, taskExt);
    for (const file of sameDirFiles) {
      if (usedTokens >= remainingTokens) break;

      const content = this.loadFile(path.join(this.projectRoot, file));
      if (content) {
        const tokens = this.estimateTokens(content);
        if (usedTokens + tokens <= remainingTokens) {
          relatedFiles[file] = content;
          usedTokens += tokens;
        }
      }
    }

    // Priority 2: Type definitions if TypeScript
    if (taskExt === '.ts') {
      const typeFiles = this.findFiles('types', '.ts');
      for (const file of typeFiles.slice(0, 5)) {
        if (usedTokens >= remainingTokens) break;

        const content = this.loadFile(path.join(this.projectRoot, file));
        if (content) {
          const tokens = this.estimateTokens(content);
          if (usedTokens + tokens <= remainingTokens) {
            relatedFiles[file] = content;
            usedTokens += tokens;
          }
        }
      }
    }

    // Priority 3: Database queries if database-related
    if (task.phase === 'database' || task.file.includes('database')) {
      const dbPath = 'database/db.ts';
      const content = this.loadFile(path.join(this.projectRoot, dbPath));
      if (content) {
        const tokens = this.estimateTokens(content);
        if (usedTokens + tokens <= remainingTokens) {
          relatedFiles[dbPath] = content;
          usedTokens += tokens;
        }
      }
    }

    return relatedFiles;
  }

  /**
   * Get gotchas relevant to task
   */
  private getGotchas(task: AtomicTask): Gotcha[] {
    // Return task's own gotchas as Gotcha objects
    return task.gotchas.map((content, index) => ({
      id: `TG-${String(index + 1).padStart(3, '0')}`,
      content,
      filePattern: task.file,
      actionType: task.action,
      severity: 'warning'
    }));
  }

  /**
   * Parse tasks from tasks.md content
   */
  private parseTasks(content: string): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    const regex = /```yaml\n([\s\S]*?)```/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
      try {
        const parsed = yaml.parse(match[1]);
        if (parsed && parsed.id && parsed.id.startsWith('T-')) {
          tasks.push({
            id: parsed.id,
            phase: parsed.phase,
            action: parsed.action,
            file: parsed.file,
            status: parsed.status || 'pending',
            requirements: parsed.requirements || [],
            gotchas: parsed.gotchas || [],
            validation: parsed.validation || { command: '', expected: '' },
            codeTemplate: parsed.code_template,
            dependsOn: parsed.depends_on || []
          });
        }
      } catch {
        // Skip invalid YAML
      }
    }

    return tasks;
  }

  /**
   * Load file content
   */
  private loadFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Find files matching pattern
   */
  private findFiles(dir: string, ext: string): string[] {
    const fullDir = path.join(this.projectRoot, dir);
    try {
      if (!fs.existsSync(fullDir)) {
        return [];
      }
      return fs.readdirSync(fullDir)
        .filter(f => f.endsWith(ext))
        .map(f => path.join(dir, f))
        .slice(0, 10); // Limit to 10 files
    } catch {
      return [];
    }
  }

  /**
   * Estimate token count from text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Get current token limit
   */
  getTokenLimit(): number {
    return this.tokenLimit;
  }

  /**
   * Set token limit
   */
  setTokenLimit(limit: number): void {
    this.tokenLimit = limit;
  }
}

/**
 * Create a context primer instance
 */
export function createContextPrimer(options?: ContextPrimerOptions): ContextPrimer {
  return new ContextPrimer(options);
}
