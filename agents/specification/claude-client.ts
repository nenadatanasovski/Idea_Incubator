/**
 * Claude Client for Spec Agent
 *
 * Integrates with Claude API for analyzing briefs and generating specs.
 * Handles rate limiting, retries, and response parsing.
 */

import { ParsedBrief } from "./brief-parser.js";
import { LoadedContext, Gotcha } from "./context-loader.js";
import {
  SPEC_AGENT_SYSTEM_PROMPT,
  BRIEF_ANALYSIS_SYSTEM_PROMPT,
  TASK_GENERATION_SYSTEM_PROMPT,
} from "./prompts/system.js";
import {
  buildAnalysisPrompt,
  buildArchitecturePrompt,
} from "./prompts/analyze.js";
import {
  buildTaskGenerationPrompt,
  AnalyzedRequirements,
  getTaskCountForComplexity,
} from "./prompts/tasks.js";
import {
  createAnthropicClient,
  type AnthropicClient,
} from "../../utils/anthropic-client.js";

export interface AtomicTask {
  id: string;
  phase: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  file: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  requirements: string[];
  gotchas: string[];
  validation: {
    command: string;
    expected: string;
  };
  codeTemplate?: string;
  dependsOn: string[];
}

export interface SpecGenerationResult {
  requirements: AnalyzedRequirements;
  architecture: string;
  tasks: AtomicTask[];
  tokensUsed: number;
}

export interface ClaudeClientOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  maxRetries?: number;
  baseDelay?: number;
}

const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;

export class ClaudeClient {
  private client: AnthropicClient;
  private model: string;
  private maxTokens: number;
  private maxRetries: number;
  private baseDelay: number;
  private totalTokensUsed: number = 0;

  constructor(options: ClaudeClientOptions = {}) {
    // Use shared client which handles both API key and CLI OAuth
    this.client = createAnthropicClient();
    this.model = options.model || DEFAULT_MODEL;
    this.maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.baseDelay = options.baseDelay || DEFAULT_BASE_DELAY;
  }

  /**
   * Analyze a brief and extract structured requirements
   */
  async analyzeBrief(
    brief: ParsedBrief,
    context: LoadedContext,
  ): Promise<AnalyzedRequirements> {
    const prompt = buildAnalysisPrompt(brief, context);

    const response = await this.callWithRetry(
      BRIEF_ANALYSIS_SYSTEM_PROMPT,
      prompt,
    );

    return this.parseRequirements(response);
  }

  /**
   * Generate architecture documentation
   */
  async generateArchitecture(
    brief: ParsedBrief,
    context: LoadedContext,
  ): Promise<string> {
    const prompt = buildArchitecturePrompt(brief, context);

    return this.callWithRetry(SPEC_AGENT_SYSTEM_PROMPT, prompt);
  }

  /**
   * Generate atomic tasks from requirements
   */
  async generateTasks(
    brief: ParsedBrief,
    requirements: AnalyzedRequirements,
    gotchas: Gotcha[],
  ): Promise<AtomicTask[]> {
    const prompt = buildTaskGenerationPrompt(brief, requirements, gotchas);

    const response = await this.callWithRetry(
      TASK_GENERATION_SYSTEM_PROMPT,
      prompt,
    );

    return this.parseTasks(response);
  }

  /**
   * Generate complete spec from brief
   */
  async generateSpec(
    brief: ParsedBrief,
    context: LoadedContext,
  ): Promise<SpecGenerationResult> {
    // Step 1: Analyze brief
    const requirements = await this.analyzeBrief(brief, context);

    // Step 2: Generate architecture
    const architecture = await this.generateArchitecture(brief, context);

    // Step 3: Generate tasks
    const tasks = await this.generateTasks(
      brief,
      requirements,
      context.gotchas,
    );

    // Validate task count
    const expected = getTaskCountForComplexity(brief.complexity);
    if (tasks.length < expected.min || tasks.length > expected.max) {
      console.warn(
        `Task count ${tasks.length} outside expected range ${expected.min}-${expected.max} for ${brief.complexity} complexity`,
      );
    }

    return {
      requirements,
      architecture,
      tasks,
      tokensUsed: this.totalTokensUsed,
    };
  }

  /**
   * Call Claude API with retry logic
   */
  private async callWithRetry(
    systemPrompt: string,
    userPrompt: string,
    retryCount: number = 0,
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Track token usage (may be 0 for CLI client)
      if (response.usage) {
        this.totalTokensUsed +=
          (response.usage.input_tokens || 0) +
          (response.usage.output_tokens || 0);
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
        console.log(
          `Retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})...`,
        );
        await this.sleep(delay);
        return this.callWithRetry(systemPrompt, userPrompt, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Rate limit errors
    if (error.status === 429) return true;

    // Server errors
    if (error.status >= 500) return true;

    // Network errors
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") return true;

    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 60000); // Max 60 seconds
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse requirements JSON from response
   */
  private parseRequirements(response: string): AnalyzedRequirements {
    // Try to extract JSON from response
    const jsonMatch = response.match(/```json\n([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("Failed to parse JSON from code block:", e);
      }
    }

    // Try to parse the whole response as JSON
    try {
      return JSON.parse(response);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
    }

    // Return empty requirements if parsing fails
    return {
      functionalRequirements: [],
      nonFunctionalRequirements: [],
      constraints: [],
      successCriteria: [],
      ambiguities: [],
    };
  }

  /**
   * Parse task YAML blocks from response
   */
  private parseTasks(response: string): AtomicTask[] {
    const tasks: AtomicTask[] = [];
    const yamlBlockRegex = /```yaml\n([\s\S]*?)```/g;

    let match;
    while ((match = yamlBlockRegex.exec(response)) !== null) {
      try {
        const taskYaml = match[1];
        const task = this.parseTaskYaml(taskYaml);
        if (task && task.id && task.id.startsWith("T-")) {
          tasks.push(task);
        }
      } catch (e) {
        console.error("Failed to parse task YAML:", e);
      }
    }

    return tasks;
  }

  /**
   * Parse individual task YAML
   */
  private parseTaskYaml(yamlContent: string): AtomicTask | null {
    // Simple YAML parsing for task blocks
    const lines = yamlContent.split("\n");
    const task: Partial<AtomicTask> = {
      requirements: [],
      gotchas: [],
      dependsOn: [],
    };

    let currentKey = "";
    let inCodeTemplate = false;
    let codeTemplateLines: string[] = [];

    for (const line of lines) {
      if (inCodeTemplate) {
        if (line.match(/^[a-z_]+:/)) {
          // End of code template
          inCodeTemplate = false;
          task.codeTemplate = codeTemplateLines.join("\n");
        } else {
          codeTemplateLines.push(line);
          continue;
        }
      }

      const keyMatch = line.match(/^([a-z_]+):\s*(.*)$/);
      if (keyMatch) {
        const [, key, value] = keyMatch;
        currentKey = key;

        if (key === "code_template" && value === "|") {
          inCodeTemplate = true;
          codeTemplateLines = [];
        } else if (value && !value.startsWith("|")) {
          // Clean value
          const cleanValue = value.replace(/^["']|["']$/g, "");

          switch (key) {
            case "id":
              task.id = cleanValue;
              break;
            case "phase":
              task.phase = cleanValue;
              break;
            case "action":
              task.action = cleanValue as "CREATE" | "UPDATE" | "DELETE";
              break;
            case "file":
              task.file = cleanValue;
              break;
            case "status":
              task.status = cleanValue as "pending";
              break;
          }
        }
      } else if (line.match(/^\s+-\s+/)) {
        // List item
        const itemValue = line
          .replace(/^\s+-\s+/, "")
          .replace(/^["']|["']$/g, "");

        switch (currentKey) {
          case "requirements":
            task.requirements?.push(itemValue);
            break;
          case "gotchas":
            task.gotchas?.push(itemValue);
            break;
          case "depends_on":
            task.dependsOn?.push(itemValue);
            break;
        }
      } else if (line.match(/^\s+command:/)) {
        const cmdMatch = line.match(/command:\s*["']?(.*)["']?$/);
        if (cmdMatch) {
          task.validation = task.validation || { command: "", expected: "" };
          task.validation.command = cmdMatch[1].replace(/^["']|["']$/g, "");
        }
      } else if (line.match(/^\s+expected:/)) {
        const expMatch = line.match(/expected:\s*["']?(.*)["']?$/);
        if (expMatch) {
          task.validation = task.validation || { command: "", expected: "" };
          task.validation.expected = expMatch[1].replace(/^["']|["']$/g, "");
        }
      }
    }

    // Handle code template at end
    if (inCodeTemplate) {
      task.codeTemplate = codeTemplateLines.join("\n");
    }

    // Validate required fields
    if (!task.id || !task.phase || !task.action || !task.file) {
      return null;
    }

    return task as AtomicTask;
  }

  /**
   * Generic completion method for flexible prompts
   * Used by spec session agent for various generation tasks
   */
  async complete(options: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
  }): Promise<string> {
    const systemMessage = options.messages.find(m => m.role === 'system');
    const userMessages = options.messages.filter(m => m.role !== 'system');
    
    const systemPrompt = systemMessage?.content || 'You are a helpful assistant.';
    const userPrompt = userMessages.map(m => m.content).join('\n\n');
    
    return this.callWithRetry(systemPrompt, userPrompt);
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
}
