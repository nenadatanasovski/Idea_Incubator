/**
 * Spec Agent Core
 *
 * Main entry point that integrates all Spec Agent components.
 * Coordinates brief parsing, requirement analysis, task generation,
 * and spec output.
 */

import { ContextLoader, LoadedContext, Gotcha } from "./context-loader.js";
import { BriefParser, ParsedBrief } from "./brief-parser.js";
import { ClaudeClient, SpecGenerationResult } from "./claude-client.js";
import { TaskGenerator, AtomicTask, GeneratedTasks } from "./task-generator.js";
import { GotchaInjector } from "./gotcha-injector.js";
import { QuestionGenerator, Question } from "./question-generator.js";
import { AnalyzedRequirements } from "./prompts/tasks.js";
import * as fs from "fs";

export interface SpecOutput {
  spec: string; // spec.md content
  tasks: string; // tasks.md content
  questions: Question[];
  metadata: {
    tokensUsed: number;
    taskCount: number;
    complexity: string;
    warnings: string[];
  };
}

export interface GenerateOptions {
  ideaSlug: string;
  briefPath: string;
  skipQuestions?: boolean;
  useDefaults?: boolean;
  answers?: Map<string, string>;
}

export interface SpecAgentConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  templateDir?: string;
  strictMode?: boolean;
}

export class SpecAgent {
  private contextLoader: ContextLoader;
  private briefParser: BriefParser;
  private claudeClient: ClaudeClient;
  private gotchaInjector: GotchaInjector;
  private questionGenerator: QuestionGenerator;

  constructor(config: SpecAgentConfig = {}) {
    this.contextLoader = new ContextLoader();
    this.briefParser = new BriefParser();
    this.claudeClient = new ClaudeClient({
      apiKey: config.apiKey,
      model: config.model,
      maxTokens: config.maxTokens,
    });
    this.questionGenerator = new QuestionGenerator({
      strictMode: config.strictMode,
    });
    this.gotchaInjector = new GotchaInjector();
  }

  /**
   * Generate a complete specification from a brief
   */
  async generateSpec(options: GenerateOptions): Promise<SpecOutput> {
    const warnings: string[] = [];

    // 1. Load brief content
    const briefContent = this.loadBrief(options.briefPath);
    if (!briefContent) {
      throw new Error(`Failed to load brief from ${options.briefPath}`);
    }

    // 2. Parse brief
    const parseResult = this.briefParser.parse(briefContent);
    if (!parseResult.brief) {
      throw new Error(
        `Failed to parse brief: ${parseResult.missing.join(", ")}`,
      );
    }
    warnings.push(...parseResult.warnings);

    const brief = parseResult.brief;

    // 3. Load context
    const context = await this.contextLoader.load(options.ideaSlug);

    // 4. Generate questions if not skipping
    let questions: Question[] = [];
    if (!options.skipQuestions) {
      const emptyReqs: AnalyzedRequirements = {
        functionalRequirements: [],
        nonFunctionalRequirements: [],
        constraints: [],
        successCriteria: [],
        ambiguities: [],
      };
      const questionResult = this.questionGenerator.generate(brief, emptyReqs);
      questions = questionResult.questions;

      // Check if we can proceed
      if (questionResult.blockingCount > 0 && !options.useDefaults) {
        // Has blocking questions and not using defaults
        if (
          !options.answers ||
          !this.questionGenerator.canProceed(questionResult, options.answers)
        ) {
          // Return early with questions - cannot proceed
          return {
            spec: "",
            tasks: "",
            questions,
            metadata: {
              tokensUsed: 0,
              taskCount: 0,
              complexity: brief.complexity,
              warnings: ["Blocked by unanswered questions"],
            },
          };
        }
      }
    }

    // 5. Analyze with Claude
    const specResult = await this.claudeClient.generateSpec(brief, context);

    // 6. Initialize task generator with context gotchas
    const taskGenerator = new TaskGenerator({
      gotchas: context.gotchas as Gotcha[],
      migrationPrefix: this.getNextMigrationNumber(),
    });

    // 7. Generate tasks
    const taskResult = taskGenerator.generate(brief, specResult.requirements);
    warnings.push(...taskResult.warnings);

    // 8. Inject additional gotchas into tasks
    const injectedTasks = this.gotchaInjector.inject(taskResult.tasks);

    // 9. Render spec.md
    const specContent = this.renderSpec(brief, specResult, context);

    // 10. Render tasks.md
    const tasksContent = this.renderTasks(brief, injectedTasks, taskResult);

    return {
      spec: specContent,
      tasks: tasksContent,
      questions,
      metadata: {
        tokensUsed: specResult.tokensUsed,
        taskCount: injectedTasks.length,
        complexity: brief.complexity,
        warnings,
      },
    };
  }

  /**
   * Load brief content from file
   */
  private loadBrief(briefPath: string): string | null {
    try {
      return fs.readFileSync(briefPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Get next migration number based on existing migrations
   */
  private getNextMigrationNumber(): number {
    try {
      const migrationsDir = "database/migrations";
      if (!fs.existsSync(migrationsDir)) {
        return 25;
      }
      const files = fs.readdirSync(migrationsDir);
      const numbers = files
        .map((f) => parseInt(f.split("_")[0], 10))
        .filter((n) => !isNaN(n));
      return numbers.length > 0 ? Math.max(...numbers) + 1 : 25;
    } catch {
      return 25;
    }
  }

  /**
   * Render spec.md content
   */
  private renderSpec(
    brief: ParsedBrief,
    result: SpecGenerationResult,
    _context: LoadedContext,
  ): string {
    const frontmatter = `---
id: ${brief.id}
title: ${brief.title}
complexity: ${brief.complexity}
status: draft
version: 1.0.0
generated: ${new Date().toISOString().split("T")[0]}
---`;

    const sections = [
      frontmatter,
      "",
      `# ${brief.title}`,
      "",
      "## Overview",
      "",
      `**Problem:** ${brief.problem}`,
      "",
      `**Solution:** ${brief.solution}`,
      "",
      "## Functional Requirements",
      "",
      ...result.requirements.functionalRequirements.map(
        (r) => `- **[${r.id}]** ${r.description} _(${r.priority})_`,
      ),
      "",
      "## Architecture",
      "",
      result.architecture,
      "",
      "## API Design",
      "",
      "| Endpoint | Method | Description |",
      "|----------|--------|-------------|",
      `| /api/${brief.id} | GET | List all |`,
      `| /api/${brief.id}/:id | GET | Get by ID |`,
      `| /api/${brief.id} | POST | Create new |`,
      `| /api/${brief.id}/:id | PUT | Update |`,
      `| /api/${brief.id}/:id | DELETE | Delete |`,
      "",
      "## Data Models",
      "",
      "```typescript",
      `export interface ${this.toPascalCase(brief.id)} {`,
      "  id: string;",
      "  // Add fields based on requirements",
      "  created_at: string;",
      "  updated_at: string;",
      "}",
      "```",
      "",
      "```sql",
      brief.databaseSchema ||
        `-- Migration for ${brief.id}
CREATE TABLE IF NOT EXISTS ${brief.id.replace(/-/g, "_")} (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);`,
      "```",
      "",
      "## Known Gotchas",
      "",
      ...this.gotchaInjector
        .getGotchasByCategory("sql")
        .slice(0, 3)
        .map((g) => `- **${g.id}:** ${g.content}`),
      "",
      "## Validation Strategy",
      "",
      "1. **Unit Tests:** Test individual functions",
      "2. **Integration Tests:** Test API endpoints",
      "3. **TypeScript:** Compile without errors",
      "",
    ];

    return sections.join("\n");
  }

  /**
   * Render tasks.md content
   */
  private renderTasks(
    brief: ParsedBrief,
    tasks: AtomicTask[],
    result: GeneratedTasks,
  ): string {
    const frontmatter = `---
id: ${brief.id}
complexity: ${brief.complexity}
total_tasks: ${tasks.length}
phases:
${Object.entries(result.byPhase)
  .filter(([_, count]) => count > 0)
  .map(([phase, count]) => `  ${phase}: ${count}`)
  .join("\n")}
---`;

    const sections = [
      frontmatter,
      "",
      `# ${brief.title} - Implementation Tasks`,
      "",
      "## Task Summary",
      "",
      `| Phase | Count |`,
      `|-------|-------|`,
      ...Object.entries(result.byPhase)
        .filter(([_, count]) => count > 0)
        .map(([phase, count]) => `| ${phase} | ${count} |`),
      "",
      "---",
      "",
      "## Tasks",
      "",
    ];

    // Render each task
    for (const task of tasks) {
      sections.push(
        `### ${task.id}: ${task.phase} - ${task.action} ${task.file.split("/").pop()}`,
      );
      sections.push("");
      sections.push("```yaml");
      sections.push(`id: ${task.id}`);
      sections.push(`phase: ${task.phase}`);
      sections.push(`action: ${task.action}`);
      sections.push(`file: "${task.file}"`);
      sections.push(`status: ${task.status}`);
      sections.push("requirements:");
      for (const req of task.requirements) {
        sections.push(`  - "${req}"`);
      }
      sections.push("gotchas:");
      for (const gotcha of task.gotchas) {
        sections.push(`  - "${gotcha}"`);
      }
      sections.push("validation:");
      sections.push(`  command: "${task.validation.command}"`);
      sections.push(`  expected: "${task.validation.expected}"`);
      if (task.codeTemplate) {
        sections.push("code_template: |");
        for (const line of task.codeTemplate.split("\n")) {
          sections.push(`  ${line}`);
        }
      }
      sections.push("depends_on:");
      if (task.dependsOn.length > 0) {
        for (const dep of task.dependsOn) {
          sections.push(`  - ${dep}`);
        }
      } else {
        sections.push("  []");
      }
      sections.push("```");
      sections.push("");
    }

    return sections.join("\n");
  }

  /**
   * Convert kebab-case to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  }

  /**
   * Get tokens used in last generation
   */
  getTokensUsed(): number {
    return this.claudeClient.getTokensUsed();
  }

  /**
   * Reset token counter
   */
  resetTokenCounter(): void {
    this.claudeClient.resetTokenCounter();
  }
}

/**
 * Create a spec agent instance with default config
 */
export function createSpecAgent(config?: SpecAgentConfig): SpecAgent {
  return new SpecAgent(config);
}

/**
 * Quick helper to generate spec from brief path
 */
export async function generateSpecFromBrief(
  briefPath: string,
  ideaSlug: string,
  config?: SpecAgentConfig,
): Promise<SpecOutput> {
  const agent = createSpecAgent(config);
  return agent.generateSpec({
    briefPath,
    ideaSlug,
    skipQuestions: true,
    useDefaults: true,
  });
}
