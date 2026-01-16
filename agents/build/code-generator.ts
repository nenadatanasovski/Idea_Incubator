/**
 * Code Generator for Build Agent
 *
 * Generates code using Claude API based on task requirements and context.
 */

import Anthropic from "@anthropic-ai/sdk";
import { AtomicTask, TaskContext } from "../../types/build-agent.js";
import { CodeGeneratorInterface } from "./task-executor.js";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 8192;

export interface CodeGeneratorOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

export interface GeneratedCode {
  code: string;
  explanation: string;
  tokensUsed: number;
}

export class CodeGenerator implements CodeGeneratorInterface {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(options: CodeGeneratorOptions = {}) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model || DEFAULT_MODEL;
    this.maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
  }

  /**
   * Generate code for a task
   */
  async generate(task: AtomicTask, context: TaskContext): Promise<string> {
    const prompt = this.buildPrompt(task, context);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return this.extractCode(response);
  }

  /**
   * Generate code with full response details
   */
  async generateWithDetails(
    task: AtomicTask,
    context: TaskContext,
  ): Promise<GeneratedCode> {
    const prompt = this.buildPrompt(task, context);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const code = this.extractCode(response);
    const explanation = this.extractExplanation(response);
    const tokensUsed =
      (response.usage?.input_tokens || 0) +
      (response.usage?.output_tokens || 0);

    return {
      code,
      explanation,
      tokensUsed,
    };
  }

  /**
   * Build the prompt for code generation
   */
  buildPrompt(task: AtomicTask, context: TaskContext): string {
    const parts: string[] = [];

    // System context
    parts.push(
      "You are a code generator for a build system. Generate ONLY the code requested, wrapped in a code block with the appropriate language tag.",
    );
    parts.push("");

    // Task info
    parts.push("## Task");
    parts.push(`- **ID:** ${task.id}`);
    parts.push(`- **Action:** ${task.action}`);
    parts.push(`- **File:** ${task.file}`);
    parts.push(`- **Phase:** ${task.phase}`);
    parts.push("");

    // Requirements
    parts.push("## Requirements");
    for (const req of task.requirements) {
      parts.push(`- ${req}`);
    }
    parts.push("");

    // Gotchas
    if (context.gotchas.length > 0) {
      parts.push("## Important Notes (Gotchas)");
      for (const gotcha of context.gotchas) {
        parts.push(`- ${gotcha.content}`);
      }
      parts.push("");
    }

    // Code template
    if (task.codeTemplate) {
      parts.push("## Code Template");
      parts.push("Use this as a starting point:");
      parts.push("```");
      parts.push(task.codeTemplate);
      parts.push("```");
      parts.push("");
    }

    // Conventions
    if (context.conventions) {
      parts.push("## Project Conventions");
      parts.push(context.conventions);
      parts.push("");
    }

    // Dependency outputs
    if (Object.keys(context.dependencyOutputs).length > 0) {
      parts.push("## Dependency Files (for reference)");
      for (const [filePath, content] of Object.entries(
        context.dependencyOutputs,
      )) {
        parts.push(`### ${filePath}`);
        parts.push("```");
        parts.push(content);
        parts.push("```");
      }
      parts.push("");
    }

    // Related files
    if (Object.keys(context.relatedFiles).length > 0) {
      parts.push("## Related Files (for context)");
      for (const [filePath, content] of Object.entries(context.relatedFiles)) {
        parts.push(`### ${filePath}`);
        parts.push("```");
        parts.push(content);
        parts.push("```");
      }
      parts.push("");
    }

    // Spec sections
    if (context.specSections.length > 0) {
      parts.push("## Specification Sections");
      for (const section of context.specSections) {
        parts.push(section);
      }
      parts.push("");
    }

    // Instructions
    parts.push("## Instructions");
    parts.push(`Generate the complete code for \`${task.file}\`.`);
    parts.push("- Follow all requirements listed above");
    parts.push("- Apply all gotchas and conventions");
    parts.push("- Use the code template if provided");
    parts.push("- Output ONLY the code wrapped in a code block");
    parts.push("- After the code block, briefly explain any design decisions");

    return parts.join("\n");
  }

  /**
   * Extract code from API response
   */
  private extractCode(response: Anthropic.Message): string {
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude API");
    }

    const text = content.text;

    // Extract code from code block
    const codeBlockMatch = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // If no code block, return the whole text (fallback)
    return text.trim();
  }

  /**
   * Extract explanation from API response
   */
  private extractExplanation(response: Anthropic.Message): string {
    const content = response.content[0];
    if (content.type !== "text") {
      return "";
    }

    const text = content.text;

    // Extract text after the last code block
    const parts = text.split(/```[\s\S]*?```/);
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }

    return "";
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Set model
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get max tokens
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }

  /**
   * Set max tokens
   */
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
  }
}

/**
 * Create a code generator instance
 */
export function createCodeGenerator(
  options?: CodeGeneratorOptions,
): CodeGenerator {
  return new CodeGenerator(options);
}
