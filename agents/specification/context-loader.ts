/**
 * Context Loader for Spec Agent
 *
 * Gathers all relevant information before spec generation:
 * - CLAUDE.md conventions
 * - Templates for spec and tasks
 * - Hardcoded gotchas (v0.1)
 * - Idea README if available
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
import { graphQueryService } from "../../server/services/graph/graph-query-service.js";

export interface LoadedContext {
  claude: string;
  templates: Record<string, string>;
  gotchas: Gotcha[];
  requirements: Requirement[];
  ideaReadme?: string;
  ideaBrief?: string;
  tokenEstimate: number;
}

export interface Requirement {
  id: string;
  content: string;
  type: "requirement" | "constraint";
  confidence: number;
  source: "graph" | "spec";
}

export interface Gotcha {
  id: string;
  content: string;
  filePattern: string;
  actionType: string;
  confidence: "high" | "medium" | "low";
  source: "knowledge_base" | "experience";
}

/**
 * Hardcoded gotchas for Spec Agent v0.1
 * These will be replaced by Knowledge Base queries in v0.2
 */
const HARDCODED_GOTCHAS: Gotcha[] = [
  {
    id: "G-001",
    content: "Use TEXT for SQLite timestamps, not DATETIME",
    filePattern: "*.sql",
    actionType: "CREATE",
    confidence: "high",
    source: "knowledge_base",
  },
  {
    id: "G-002",
    content: "Always include IF NOT EXISTS for CREATE TABLE statements",
    filePattern: "*.sql",
    actionType: "CREATE",
    confidence: "high",
    source: "knowledge_base",
  },
  {
    id: "G-003",
    content: "Foreign keys require PRAGMA foreign_keys = ON in SQLite",
    filePattern: "*.sql",
    actionType: "CREATE",
    confidence: "high",
    source: "knowledge_base",
  },
  {
    id: "G-004",
    content: "Use INTEGER 0/1 for booleans in SQLite, not BOOLEAN",
    filePattern: "*.sql",
    actionType: "CREATE",
    confidence: "high",
    source: "knowledge_base",
  },
  {
    id: "G-005",
    content: "Express middleware must call next() even on error",
    filePattern: "middleware/*.ts",
    actionType: "CREATE",
    confidence: "high",
    source: "experience",
  },
  {
    id: "G-006",
    content: "Use .js extension in import paths for ES modules",
    filePattern: "*.ts",
    actionType: "CREATE",
    confidence: "high",
    source: "knowledge_base",
  },
  {
    id: "G-007",
    content: "Always use parameterized queries to prevent SQL injection",
    filePattern: "database/*.ts",
    actionType: "UPDATE",
    confidence: "high",
    source: "knowledge_base",
  },
  {
    id: "G-008",
    content:
      "Parse JSON columns when reading from SQLite, stringify when writing",
    filePattern: "database/*.ts",
    actionType: "UPDATE",
    confidence: "high",
    source: "experience",
  },
  {
    id: "G-009",
    content:
      "Fire-and-forget async operations require try/catch to prevent unhandled rejections",
    filePattern: "*.ts",
    actionType: "CREATE",
    confidence: "high",
    source: "experience",
  },
  {
    id: "G-010",
    content:
      "Use multer.memoryStorage() for file uploads, not default disk storage",
    filePattern: "routes/*.ts",
    actionType: "CREATE",
    confidence: "medium",
    source: "experience",
  },
  {
    id: "G-011",
    content:
      "WebSocket connections may disconnect - always handle reconnection",
    filePattern: "websocket*.ts",
    actionType: "CREATE",
    confidence: "high",
    source: "experience",
  },
  {
    id: "G-012",
    content: "Use generateId() from database/db.ts for new record IDs",
    filePattern: "database/*.ts",
    actionType: "UPDATE",
    confidence: "high",
    source: "knowledge_base",
  },
  {
    id: "G-013",
    content: "Return 404 for not found, not empty result or null",
    filePattern: "routes/*.ts",
    actionType: "CREATE",
    confidence: "high",
    source: "experience",
  },
  {
    id: "G-014",
    content: "Always update updated_at timestamp on record updates",
    filePattern: "database/*.ts",
    actionType: "UPDATE",
    confidence: "high",
    source: "knowledge_base",
  },
  {
    id: "G-015",
    content: "Use vitest, not jest, for testing",
    filePattern: "tests/*.ts",
    actionType: "CREATE",
    confidence: "high",
    source: "knowledge_base",
  },
];

// Rough token estimation (4 chars per token average)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class ContextLoader {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Load all context needed for spec generation
   */
  async load(ideaSlug?: string): Promise<LoadedContext> {
    const [claude, templates, gotchas, requirements] = await Promise.all([
      this.loadClaude(),
      this.loadTemplates(),
      this.loadGotchas(ideaSlug),
      this.loadRequirements(ideaSlug),
    ]);

    let ideaReadme: string | undefined;
    let ideaBrief: string | undefined;

    if (ideaSlug) {
      ideaReadme = await this.loadIdeaReadme(ideaSlug);
      ideaBrief = await this.loadIdeaBrief(ideaSlug);
    }

    // Calculate total token estimate
    let totalText = claude;
    totalText += Object.values(templates).join("\n");
    totalText += gotchas.map((g) => g.content).join("\n");
    totalText += requirements.map((r) => r.content).join("\n");
    if (ideaReadme) totalText += ideaReadme;
    if (ideaBrief) totalText += ideaBrief;

    const tokenEstimate = estimateTokens(totalText);

    return {
      claude,
      templates,
      gotchas,
      requirements,
      ideaReadme,
      ideaBrief,
      tokenEstimate,
    };
  }

  /**
   * Load CLAUDE.md from project root
   */
  async loadClaude(): Promise<string> {
    const claudePath = path.join(this.projectRoot, "CLAUDE.md");

    if (!existsSync(claudePath)) {
      console.warn("CLAUDE.md not found at project root");
      return "";
    }

    try {
      return await readFile(claudePath, "utf-8");
    } catch (error) {
      console.error("Failed to read CLAUDE.md:", error);
      return "";
    }
  }

  /**
   * Load templates from templates/unified/build/
   */
  async loadTemplates(): Promise<Record<string, string>> {
    const templatesDir = path.join(
      this.projectRoot,
      "templates",
      "unified",
      "build",
    );
    const templates: Record<string, string> = {};

    const templateFiles = ["spec.md", "tasks.md"];

    for (const file of templateFiles) {
      const filePath = path.join(templatesDir, file);
      if (existsSync(filePath)) {
        try {
          templates[file] = await readFile(filePath, "utf-8");
        } catch (error) {
          console.error(`Failed to read template ${file}:`, error);
        }
      }
    }

    return templates;
  }

  /**
   * Load gotchas from memory graph, falling back to hardcoded gotchas
   */
  async loadGotchas(ideaSlug?: string): Promise<Gotcha[]> {
    // Start with hardcoded gotchas as baseline
    const gotchas: Gotcha[] = [...HARDCODED_GOTCHAS];

    // If ideaSlug provided, query graph for additional learnings/gotchas
    if (ideaSlug) {
      try {
        const learnings = await graphQueryService.getLearnings(ideaSlug);

        // Convert graph learnings to gotchas
        for (const block of learnings.blocks) {
          // Skip if already have this gotcha (by content similarity)
          const exists = gotchas.some(
            (g) => g.content.toLowerCase() === block.content.toLowerCase(),
          );
          if (exists) continue;

          gotchas.push({
            id: block.id,
            content: block.content,
            filePattern: (block.properties?.filePattern as string) || "*.ts",
            actionType: (block.properties?.actionType as string) || "*",
            confidence: this.mapConfidence(block.confidence),
            source: "knowledge_base",
          });
        }

        console.log(
          `[ContextLoader] Loaded ${learnings.blocks.length} gotchas from graph for ${ideaSlug}`,
        );
      } catch (err) {
        console.warn("[ContextLoader] Failed to load gotchas from graph:", err);
        // Fall back to hardcoded gotchas only
      }
    }

    return gotchas;
  }

  /**
   * Load requirements from memory graph
   */
  async loadRequirements(ideaSlug?: string): Promise<Requirement[]> {
    if (!ideaSlug) {
      return [];
    }

    try {
      const result = await graphQueryService.getSpecRequirements(ideaSlug);

      return result.blocks.map((block) => ({
        id: block.id,
        content: block.content,
        type: block.blockTypes.includes("constraint")
          ? ("constraint" as const)
          : ("requirement" as const),
        confidence: block.confidence ?? 0.8,
        source: "graph" as const,
      }));
    } catch (err) {
      console.warn(
        "[ContextLoader] Failed to load requirements from graph:",
        err,
      );
      return [];
    }
  }

  /**
   * Map confidence score to confidence level
   */
  private mapConfidence(score: number | null): "high" | "medium" | "low" {
    if (score === null) return "medium";
    if (score >= 0.8) return "high";
    if (score >= 0.5) return "medium";
    return "low";
  }

  /**
   * Check if idea is ready for spec generation
   */
  async checkSpecReadiness(ideaSlug: string): Promise<{
    ready: boolean;
    score: number;
    missing: string[];
    warnings: string[];
  }> {
    const readiness = await graphQueryService.checkSpecReadiness(ideaSlug);

    const warnings: string[] = [];

    // Add warnings for low confidence requirements
    const requirements = await this.loadRequirements(ideaSlug);
    const lowConfidenceReqs = requirements.filter((r) => r.confidence < 0.6);
    if (lowConfidenceReqs.length > 0) {
      warnings.push(
        `${lowConfidenceReqs.length} requirements have low confidence`,
      );
    }

    return {
      ready: readiness.ready,
      score: readiness.score,
      missing: readiness.missing,
      warnings,
    };
  }

  /**
   * Get gotchas relevant to a specific file pattern and action
   */
  getRelevantGotchas(
    filePattern: string,
    actionType: string,
    allGotchas?: Gotcha[],
  ): Gotcha[] {
    const gotchas = allGotchas || HARDCODED_GOTCHAS;
    return gotchas.filter((gotcha) => {
      const patternMatch = this.matchPattern(filePattern, gotcha.filePattern);
      const actionMatch =
        gotcha.actionType === actionType || gotcha.actionType === "*";
      return patternMatch && actionMatch;
    });
  }

  /**
   * Simple glob pattern matching
   */
  private matchPattern(filename: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    return new RegExp(regexPattern).test(filename);
  }

  /**
   * Load idea README.md if it exists
   */
  async loadIdeaReadme(ideaSlug: string): Promise<string | undefined> {
    const readmePath = path.join(
      this.projectRoot,
      "ideas",
      ideaSlug,
      "README.md",
    );

    if (!existsSync(readmePath)) {
      return undefined;
    }

    try {
      return await readFile(readmePath, "utf-8");
    } catch (error) {
      console.error(`Failed to read idea README for ${ideaSlug}:`, error);
      return undefined;
    }
  }

  /**
   * Load idea brief if it exists
   */
  async loadIdeaBrief(ideaSlug: string): Promise<string | undefined> {
    const briefPath = path.join(
      this.projectRoot,
      "ideas",
      ideaSlug,
      "planning",
      "brief.md",
    );

    if (!existsSync(briefPath)) {
      return undefined;
    }

    try {
      return await readFile(briefPath, "utf-8");
    } catch (error) {
      console.error(`Failed to read idea brief for ${ideaSlug}:`, error);
      return undefined;
    }
  }

  /**
   * Get token estimate for loaded context
   * Used to ensure we stay within Claude's context limits
   */
  getTokenLimit(): number {
    // Reserve ~50k tokens for context, leaving room for generation
    return 50000;
  }

  /**
   * Check if context is within token limits
   */
  isWithinLimits(context: LoadedContext): boolean {
    return context.tokenEstimate < this.getTokenLimit();
  }

  /**
   * Assemble context into a single string for prompt injection
   */
  assembleContext(context: LoadedContext): string {
    const sections: string[] = [];

    // CLAUDE.md conventions
    if (context.claude) {
      sections.push("## Project Conventions (CLAUDE.md)\n\n" + context.claude);
    }

    // Templates
    if (context.templates["spec.md"]) {
      sections.push(
        "## Spec Template\n\n```markdown\n" +
          context.templates["spec.md"] +
          "\n```",
      );
    }
    if (context.templates["tasks.md"]) {
      sections.push(
        "## Tasks Template\n\n```markdown\n" +
          context.templates["tasks.md"] +
          "\n```",
      );
    }

    // Requirements
    if (context.requirements.length > 0) {
      const reqList = context.requirements
        .map((r) => `- [${r.type}] ${r.content}`)
        .join("\n");
      const constraintCount = context.requirements.filter(
        (r) => r.type === "constraint",
      ).length;
      const reqCount = context.requirements.length - constraintCount;
      sections.push(
        `## Requirements (${reqCount} requirements, ${constraintCount} constraints)\n\n` +
          reqList,
      );
    }

    // Gotchas
    if (context.gotchas.length > 0) {
      const gotchaList = context.gotchas
        .map((g) => `- [${g.id}] ${g.content} (${g.confidence} confidence)`)
        .join("\n");
      sections.push("## Known Gotchas\n\n" + gotchaList);
    }

    // Idea context
    if (context.ideaReadme) {
      sections.push("## Idea Overview\n\n" + context.ideaReadme);
    }
    if (context.ideaBrief) {
      sections.push("## Feature Brief\n\n" + context.ideaBrief);
    }

    return sections.join("\n\n---\n\n");
  }
}
