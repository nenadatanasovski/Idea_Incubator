/**
 * Spec Agent - AI-powered technical specification generator
 *
 * Creates detailed technical specifications from high-level briefs.
 * Uses Claude Opus to analyze requirements, design solutions, and
 * define testable pass criteria.
 */

import { v4 as uuidv4 } from "uuid";
import {
  createAnthropicClient,
  type AnthropicClient,
} from "../../utils/anthropic-client.js";
import type {
  SpecificationBrief,
  TechnicalSpecification,
  SpecificationBreakdown,
  SpecAgentOutput,
  SpecAgentOptions,
} from "./types.js";

const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;

/**
 * Spec Agent for generating technical specifications
 *
 * This agent takes a high-level brief and generates a comprehensive
 * technical specification including:
 * - Requirements analysis
 * - Technical design approach
 * - Testable pass criteria
 * - Dependencies and risks
 * - Optional task breakdown
 *
 * Follows singleton pattern for consistent logging and state management.
 */
export class SpecAgent {
  private client: AnthropicClient;
  private model: string;
  private maxTokens: number;
  private maxRetries: number;
  private baseDelay: number;
  private totalTokensUsed: number = 0;
  private instanceId: string;

  constructor(options: SpecAgentOptions = {}) {
    this.client = createAnthropicClient();
    this.model = options.model || DEFAULT_MODEL;
    this.maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.baseDelay = options.baseDelay || DEFAULT_BASE_DELAY;
    this.instanceId = `spec-agent-${uuidv4().slice(0, 8)}`;

    this.log("Spec Agent initialized", {
      model: this.model,
      maxTokens: this.maxTokens,
      instanceId: this.instanceId,
    });
  }

  /**
   * Generate a technical specification from a brief
   */
  async generateSpecification(
    brief: SpecificationBrief,
    options: { includeBreakdown?: boolean } = {},
  ): Promise<SpecAgentOutput> {
    const startTime = Date.now();
    const executionId = `spec-${uuidv4().slice(0, 8)}`;

    this.log("Starting specification generation", {
      executionId,
      title: brief.title,
      includeBreakdown: options.includeBreakdown,
    });

    try {
      // Generate the specification
      const specification = await this.generateSpec(brief, executionId);

      // Optionally generate task breakdown
      let breakdown: SpecificationBreakdown | undefined;
      if (options.includeBreakdown) {
        breakdown = await this.generateBreakdown(specification, executionId);
      }

      const executionTimeMs = Date.now() - startTime;

      this.log("Specification generation complete", {
        executionId,
        tokensUsed: this.totalTokensUsed,
        executionTimeMs,
        hasBreakdown: !!breakdown,
      });

      return {
        specification,
        breakdown,
        tokensUsed: this.totalTokensUsed,
        executionTimeMs,
      };
    } catch (error) {
      this.logError("Specification generation failed", error, executionId);
      throw error;
    }
  }

  /**
   * Generate the technical specification
   */
  private async generateSpec(
    brief: SpecificationBrief,
    executionId: string,
  ): Promise<TechnicalSpecification> {
    this.log("Generating specification", { executionId, brief });

    const systemPrompt = this.buildSpecSystemPrompt();
    const userPrompt = this.buildSpecUserPrompt(brief);

    const response = await this.callWithRetry(
      systemPrompt,
      userPrompt,
      executionId,
    );

    return this.parseSpecification(response);
  }

  /**
   * Generate task breakdown from specification
   */
  private async generateBreakdown(
    specification: TechnicalSpecification,
    executionId: string,
  ): Promise<SpecificationBreakdown> {
    this.log("Generating task breakdown", { executionId });

    const systemPrompt = this.buildBreakdownSystemPrompt();
    const userPrompt = this.buildBreakdownUserPrompt(specification);

    const response = await this.callWithRetry(
      systemPrompt,
      userPrompt,
      executionId,
    );

    return this.parseBreakdown(response);
  }

  /**
   * Build system prompt for specification generation
   */
  private buildSpecSystemPrompt(): string {
    return `You are a technical specification expert. Your role is to create detailed, actionable technical specifications from high-level briefs.

Your specifications must include:
1. Clear overview and requirements
2. Concrete technical design with file-level details
3. Testable pass criteria (no vague criteria like "works correctly")
4. Dependencies and prerequisites
5. Risk considerations

Rules:
- Pass criteria must be objectively verifiable (e.g., "TypeScript compiles with no errors", "File X exists with function Y")
- Reference existing codebase patterns when applicable
- Be specific about files, functions, and types
- Consider edge cases and error handling
- Keep the tone professional and implementation-focused

Output format: JSON matching the TechnicalSpecification interface.`;
  }

  /**
   * Build user prompt for specification generation
   */
  private buildSpecUserPrompt(brief: SpecificationBrief): string {
    const parts: string[] = [
      "# Specification Brief",
      `**Title:** ${brief.title}`,
      `**Description:** ${brief.description}`,
    ];

    if (brief.category) {
      parts.push(`**Category:** ${brief.category}`);
    }

    if (brief.context) {
      parts.push(`\n## Context\n${brief.context}`);
    }

    if (brief.relatedFiles && brief.relatedFiles.length > 0) {
      parts.push(
        `\n## Related Files\n${brief.relatedFiles.map((f) => `- ${f}`).join("\n")}`,
      );
    }

    if (brief.acceptanceCriteria && brief.acceptanceCriteria.length > 0) {
      parts.push(
        `\n## Acceptance Criteria\n${brief.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
      );
    }

    parts.push(
      "\n---\nGenerate a complete technical specification in JSON format.",
    );

    return parts.join("\n");
  }

  /**
   * Build system prompt for breakdown generation
   */
  private buildBreakdownSystemPrompt(): string {
    return `You are a task decomposition expert. Analyze technical specifications and determine if they should be broken into smaller subtasks.

Break down a specification when:
- It involves multiple independent files or components
- It has distinct phases (e.g., setup, implementation, testing)
- It requires changes across different layers (database, API, frontend)
- The estimated effort is large or complex

Each subtask should:
- Be independently implementable (or have clear dependencies)
- Have its own testable pass criteria
- Be smaller than the parent task
- Have clear file impacts

Output format: JSON matching the SpecificationBreakdown interface.`;
  }

  /**
   * Build user prompt for breakdown generation
   */
  private buildBreakdownUserPrompt(spec: TechnicalSpecification): string {
    return `# Technical Specification

**Title:** ${spec.title}
**Overview:** ${spec.overview}

## Requirements
${spec.requirements.map((r) => `- [${r.priority}] ${r.description}`).join("\n")}

## Technical Design
${spec.technicalDesign.approach}

## Pass Criteria
${spec.passCriteria.map((pc) => `- ${pc.description}`).join("\n")}

---
Should this be broken into subtasks? If yes, provide the breakdown in JSON format.`;
  }

  /**
   * Parse specification from AI response
   */
  private parseSpecification(response: string): TechnicalSpecification {
    // Try to extract JSON from code block
    const jsonMatch = response.match(/```json\n([\s\S]*?)```/);
    let parsed: any;

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch (e) {
        this.log("Failed to parse JSON from code block", { error: e });
      }
    }

    // Try direct JSON parse
    if (!parsed) {
      try {
        parsed = JSON.parse(response);
      } catch (e) {
        this.log("Failed to parse response as JSON", { error: e });
      }
    }

    if (!parsed) {
      throw new Error("Failed to parse specification from AI response");
    }

    // Validate required fields
    if (!parsed.title || !parsed.overview || !parsed.requirements) {
      throw new Error("Invalid specification format: missing required fields");
    }

    return parsed as TechnicalSpecification;
  }

  /**
   * Parse breakdown from AI response
   */
  private parseBreakdown(response: string): SpecificationBreakdown {
    const jsonMatch = response.match(/```json\n([\s\S]*?)```/);
    let parsed: any;

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch (e) {
        this.log("Failed to parse breakdown JSON from code block", { error: e });
      }
    }

    if (!parsed) {
      try {
        parsed = JSON.parse(response);
      } catch (e) {
        this.log("Failed to parse breakdown response as JSON", { error: e });
      }
    }

    if (!parsed) {
      throw new Error("Failed to parse breakdown from AI response");
    }

    return parsed as SpecificationBreakdown;
  }

  /**
   * Call Claude API with retry logic
   */
  private async callWithRetry(
    systemPrompt: string,
    userPrompt: string,
    executionId: string,
    retryCount: number = 0,
  ): Promise<string> {
    this.log("Calling Claude API", { executionId, retryCount, model: this.model });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Track token usage
      if (response.usage) {
        const tokens =
          (response.usage.input_tokens || 0) +
          (response.usage.output_tokens || 0);
        this.totalTokensUsed += tokens;
        this.log("API call complete", {
          executionId,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: tokens,
        });
      }

      // Extract text content
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text content in response");
      }

      return textContent.text;
    } catch (error: any) {
      // Check if we should retry
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.calculateBackoff(retryCount);
        this.log(`Retrying API call in ${delay}ms`, {
          executionId,
          attempt: retryCount + 1,
          maxRetries: this.maxRetries,
        });
        await this.sleep(delay);
        return this.callWithRetry(
          systemPrompt,
          userPrompt,
          executionId,
          retryCount + 1,
        );
      }

      throw error;
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error.status === 429) return true; // Rate limit
    if (error.status >= 500) return true; // Server errors
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") return true;
    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    const exponentialDelay = this.baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 60000);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get total tokens used
   */
  getTokensUsed(): number {
    return this.totalTokensUsed;
  }

  /**
   * Reset token counter
   */
  resetTokenCounter(): void {
    this.totalTokensUsed = 0;
  }

  /**
   * Log message with timestamp
   */
  private log(message: string, metadata?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    console.log(`[SpecAgent ${timestamp}]`, message, metadata || "");
  }

  /**
   * Log error with timestamp and context
   */
  private logError(
    message: string,
    error: unknown,
    executionId?: string,
  ): void {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`[SpecAgent ${timestamp}] ERROR:`, message, {
      executionId,
      error: errorMessage,
      stack: errorStack,
    });
  }
}

// Export singleton instance
let specAgentInstance: SpecAgent | null = null;

/**
 * Get or create the singleton SpecAgent instance
 */
export function getSpecAgent(options?: SpecAgentOptions): SpecAgent {
  if (!specAgentInstance) {
    specAgentInstance = new SpecAgent(options);
  }
  return specAgentInstance;
}

/**
 * Create a new SpecAgent instance (non-singleton)
 */
export function createSpecAgent(options?: SpecAgentOptions): SpecAgent {
  return new SpecAgent(options);
}

// Re-export types
export type {
  SpecificationBrief,
  TechnicalSpecification,
  SpecificationBreakdown,
  SpecAgentOutput,
  SpecAgentOptions,
  SpecRequirement,
  TechnicalDesign,
  PassCriterion,
  Dependency,
  SubtaskProposal,
} from "./types.js";
