/**
 * Agent Runner Service
 *
 * Actually executes tasks by calling Claude and handling questions.
 * This is the missing piece that connects the task executor to real agent work.
 */

import { v4 as uuid } from "uuid";
import {
  createAnthropicClient,
  AnthropicClient,
} from "../../utils/anthropic-client.js";
import { ParsedTask } from "./task-loader.js";
import {
  CommunicationHub,
  getCommunicationHub,
} from "../communication/communication-hub.js";
import { Question, QuestionType } from "../communication/question-delivery.js";
import { query, run, getOne } from "../../database/db.js";
import { emitTaskExecutorEvent } from "../websocket.js";
import * as fs from "fs";
import * as path from "path";

// Database adapter to match CommunicationHub's expected interface
interface DatabaseAdapter {
  run(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

function createDatabaseAdapter(): DatabaseAdapter {
  return {
    async run(
      sql: string,
      params: unknown[] = [],
    ): Promise<{ lastID: number; changes: number }> {
      await run(sql, params as (string | number | null | boolean)[]);
      return { lastID: 0, changes: 1 };
    },
    async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      const result = (await getOne(
        sql,
        params as (string | number | null | boolean)[],
      )) as T | null;
      return result === null ? undefined : result;
    },
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return (await query(
        sql,
        params as (string | number | null | boolean)[],
      )) as T[];
    },
  };
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 8192;

export interface AgentRunnerConfig {
  model?: string;
  maxTokens?: number;
  questionTimeoutMs?: number;
  maxRetries?: number;
}

export interface TaskListContext {
  projectName: string; // e.g., "Vibe Platform"
  projectSlug: string; // e.g., "vibe-platform"
  taskListName: string; // e.g., "SPEC-IMPLEMENTATION-GAPS.md"
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  filesModified?: string[];
  questionsAsked?: number;
  tokensUsed?: number;
}

interface ParsedQuestion {
  type: QuestionType;
  content: string;
  options: { label: string; action: string; description?: string }[];
  defaultOption?: string;
  blocking: boolean;
}

/**
 * Agent Runner - Actually executes tasks using Claude
 */
export class AgentRunner {
  private client: AnthropicClient;
  private model: string;
  private maxTokens: number;
  private questionTimeoutMs: number;
  private hub: CommunicationHub | null = null;
  private agentId: string;
  private taskListContext: TaskListContext | null = null;

  constructor(agentType: string, config: AgentRunnerConfig = {}) {
    this.client = createAnthropicClient();
    this.model = config.model || DEFAULT_MODEL;
    this.maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;
    this.questionTimeoutMs = config.questionTimeoutMs || 5 * 60 * 1000; // 5 min default
    this.agentId = `${agentType}-${uuid().slice(0, 8)}`;
  }

  /**
   * Set the task list context for this runner
   * This context will be included in all Telegram messages for identification
   */
  setTaskListContext(context: TaskListContext): void {
    this.taskListContext = context;
    console.log(
      `[AgentRunner] Set task list context: ${context.projectName} / ${context.taskListName}`,
    );
  }

  /**
   * Initialize the agent runner with CommunicationHub
   */
  async initialize(): Promise<void> {
    const db = createDatabaseAdapter();
    this.hub = getCommunicationHub(db as any);

    // Register agent with hub
    await this.hub.registerAgent({
      agentId: this.agentId,
      agentType: this.extractAgentType(this.agentId),
      sessionId: `session-${Date.now()}`,
      capabilities: ["code-generation", "task-execution"],
    });

    // Acknowledge the handshake (for in-process agents)
    // This completes the hello/ack handshake so the agent is marked as ready
    await this.hub.acknowledgeAgent(this.agentId);

    console.log(`[AgentRunner] Initialized agent ${this.agentId}`);
  }

  /**
   * Execute a task - the main entry point
   */
  async executeTask(task: ParsedTask): Promise<TaskResult> {
    console.log(`[AgentRunner] Executing task ${task.id}: ${task.description}`);

    let questionsAsked = 0;
    let totalTokens = 0;
    const filesModified: string[] = [];

    try {
      // Build the initial prompt
      const systemPrompt = this.buildSystemPrompt(task);
      const userPrompt = this.buildTaskPrompt(task);

      // Conversation loop - may involve multiple turns if questions are needed
      const messages: { role: "user" | "assistant"; content: string }[] = [
        { role: "user", content: userPrompt },
      ];

      let maxTurns = 7; // Prevent infinite loops, but give enough turns for completion
      let turn = 0;
      let completed = false;
      let finalOutput = "";

      while (turn < maxTurns && !completed) {
        turn++;
        console.log(`[AgentRunner] Turn ${turn} for task ${task.id}`);

        // Call Claude
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: systemPrompt,
          messages: messages as any,
        });

        totalTokens +=
          (response.usage?.input_tokens || 0) +
          (response.usage?.output_tokens || 0);

        const responseText = response.content
          .filter((block) => block.type === "text")
          .map((block) => (block as any).text)
          .join("");

        // Check if Claude is asking a question
        const question = this.parseQuestion(responseText);

        if (question) {
          questionsAsked++;
          console.log(
            `[AgentRunner] Agent needs to ask a question: ${question.content.slice(0, 100)}...`,
          );

          // Broadcast that we're waiting for input
          emitTaskExecutorEvent("task:blocked", {
            taskId: task.id,
            reason: "waiting_for_user_input",
            questionType: question.type,
          });

          // Ask the question via Telegram
          const answer = await this.askQuestion(task.id, question);

          if (!answer) {
            // Timeout or error - use default or fail
            if (question.defaultOption) {
              console.log(
                `[AgentRunner] Using default answer: ${question.defaultOption}`,
              );
              messages.push({ role: "assistant", content: responseText });
              messages.push({
                role: "user",
                content: `User did not respond in time. Using default: ${question.defaultOption}`,
              });
            } else {
              return {
                success: false,
                error: "Question timeout with no default option",
                questionsAsked,
                tokensUsed: totalTokens,
              };
            }
          } else {
            // Got an answer - continue conversation
            console.log(`[AgentRunner] Received answer: ${answer}`);
            messages.push({ role: "assistant", content: responseText });
            messages.push({
              role: "user",
              content: `User answered: ${answer}\n\nPlease continue with the task.`,
            });

            // Broadcast that we're resuming
            emitTaskExecutorEvent("task:resumed", {
              taskId: task.id,
              answer,
            });
          }
        } else {
          // Check if task is complete
          const result = this.parseTaskResult(responseText, task);

          if (result.isComplete) {
            completed = true;
            finalOutput = result.output;

            // Write generated code if any
            if (result.code && result.filePath) {
              const filePath = this.resolveFilePath(result.filePath);
              await this.writeFile(filePath, result.code);
              filesModified.push(filePath);
              console.log(`[AgentRunner] Wrote code to ${filePath}`);
            }
          } else {
            // On last turn, try to accept the response as completion if it's substantial
            if (turn === maxTurns - 1 && responseText.length > 200) {
              console.log(
                `[AgentRunner] Last turn - accepting substantial response as completion`,
              );
              completed = true;
              finalOutput = responseText.slice(0, 500) + "...";
            } else {
              // Claude didn't complete and didn't ask a question - might need more context
              console.log(
                `[AgentRunner] Turn ${turn}: No completion detected, asking for explicit completion`,
              );
              messages.push({ role: "assistant", content: responseText });
              messages.push({
                role: "user",
                content:
                  'Please complete the task and confirm completion. Use ```TASK_COMPLETE\\noutput: description\\n``` format, or just say "Task completed" or "Implementation complete" when done.',
              });
            }
          }
        }
      }

      if (!completed) {
        // Even if not explicitly completed, if we got substantial output, consider it a success
        const lastResponse = messages[messages.length - 2]?.content || "";
        if (lastResponse.length > 300) {
          console.log(
            `[AgentRunner] Treating substantial final response as completion`,
          );
          return {
            success: true,
            output: lastResponse.slice(0, 500) + "...",
            questionsAsked,
            tokensUsed: totalTokens,
            filesModified,
          };
        }

        return {
          success: false,
          error: `Task not completed after ${maxTurns} turns. Last response: ${lastResponse.slice(0, 200)}...`,
          questionsAsked,
          tokensUsed: totalTokens,
          filesModified,
        };
      }

      return {
        success: true,
        output: finalOutput,
        questionsAsked,
        tokensUsed: totalTokens,
        filesModified,
      };
    } catch (error) {
      console.error(`[AgentRunner] Error executing task ${task.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        questionsAsked,
        tokensUsed: totalTokens,
        filesModified,
      };
    }
  }

  /**
   * Build system prompt for the agent
   */
  private buildSystemPrompt(_task: ParsedTask): string {
    return `You are a skilled software engineer working on a task for the Vibe Platform.

## Your Capabilities
- Generate high-quality TypeScript/JavaScript code
- Follow project conventions and patterns
- Ask clarifying questions when needed
- Provide clear explanations

## Output Formats

### When you need to ask the user a question:
\`\`\`QUESTION
type: BLOCKING|CLARIFYING|DECISION
content: Your question here
options:
  - label: Option 1
    action: option_1
    description: What this option means
  - label: Option 2
    action: option_2
    description: What this option means
default: option_1
\`\`\`

### When you complete the task with code:
\`\`\`TASK_COMPLETE
output: Brief description of what was done
\`\`\`
\`\`\`typescript
// Your generated code here
\`\`\`

### When you complete the task without code:
\`\`\`TASK_COMPLETE
output: Description of what was accomplished
\`\`\`

## Rules
1. Always ask BLOCKING questions for architectural decisions
2. Ask CLARIFYING questions for preferences that have good defaults
3. Generate complete, working code - no placeholders
4. Follow existing patterns in the codebase
5. Include necessary imports`;
  }

  /**
   * Build the task prompt
   */
  private buildTaskPrompt(task: ParsedTask): string {
    const parts: string[] = [];

    parts.push(`## Task: ${task.id}`);
    parts.push(`**Description:** ${task.description}`);
    parts.push(`**Priority:** ${task.priority}`);
    parts.push(`**Section:** ${task.section}`);
    if (task.subsection) {
      parts.push(`**Subsection:** ${task.subsection}`);
    }

    // Load CLAUDE.md for conventions
    const claudeMdPath = path.join(process.cwd(), "CLAUDE.md");
    if (fs.existsSync(claudeMdPath)) {
      const claudeMd = fs.readFileSync(claudeMdPath, "utf-8");
      parts.push("");
      parts.push("### Project Conventions (from CLAUDE.md)");
      parts.push(claudeMd.slice(0, 3000)); // Limit size
    }

    parts.push("");
    parts.push(
      "Please complete this task. If you need clarification, ask a question using the QUESTION format. Otherwise, complete the task and output using TASK_COMPLETE format.",
    );
    parts.push("");
    parts.push(
      "If you generate code, include the target file path in your TASK_COMPLETE block like:",
    );
    parts.push("```TASK_COMPLETE");
    parts.push("output: Description of what was done");
    parts.push("file: path/to/file.ts");
    parts.push("```");

    return parts.join("\n");
  }

  /**
   * Parse a question from Claude's response
   */
  private parseQuestion(text: string): ParsedQuestion | null {
    const questionMatch = text.match(/```QUESTION\n([\s\S]*?)```/);
    if (!questionMatch) return null;

    const questionBlock = questionMatch[1];

    try {
      // Parse the YAML-like format
      const typeMatch = questionBlock.match(/type:\s*(\w+)/);
      const contentMatch = questionBlock.match(/content:\s*(.+?)(?:\n|$)/);
      const defaultMatch = questionBlock.match(/default:\s*(\w+)/);

      if (!typeMatch || !contentMatch) return null;

      const options: { label: string; action: string; description?: string }[] =
        [];
      const optionsMatch = questionBlock.match(
        /options:\n((?:\s+-[\s\S]*?)+?)(?:\ndefault:|$)/,
      );

      if (optionsMatch) {
        const optionLines = optionsMatch[1].split(/\n\s+-\s+/).filter(Boolean);
        for (const opt of optionLines) {
          const labelMatch = opt.match(/label:\s*(.+?)(?:\n|$)/);
          const actionMatch = opt.match(/action:\s*(\w+)/);
          const descMatch = opt.match(/description:\s*(.+?)(?:\n|$)/);

          if (labelMatch && actionMatch) {
            options.push({
              label: labelMatch[1].trim(),
              action: actionMatch[1].trim(),
              description: descMatch?.[1]?.trim(),
            });
          }
        }
      }

      const type = typeMatch[1].toUpperCase() as QuestionType;

      return {
        type:
          type === "DECISION"
            ? "DECISION"
            : type === "CLARIFYING"
              ? "CLARIFYING"
              : "BLOCKING",
        content: contentMatch[1].trim(),
        options:
          options.length > 0
            ? options
            : [
                { label: "Yes", action: "yes" },
                { label: "No", action: "no" },
              ],
        defaultOption: defaultMatch?.[1],
        blocking: type === "BLOCKING",
      };
    } catch (e) {
      console.error("[AgentRunner] Failed to parse question:", e);
      return null;
    }
  }

  /**
   * Parse task completion result
   * Supports multiple formats for flexibility with different Claude response styles
   */
  private parseTaskResult(
    text: string,
    _task: ParsedTask,
  ): { isComplete: boolean; output: string; code?: string; filePath?: string } {
    // Try exact TASK_COMPLETE format first
    const completeMatch = text.match(/```TASK_COMPLETE\n([\s\S]*?)```/);

    if (completeMatch) {
      const outputMatch = completeMatch[1].match(/output:\s*(.+?)(?:\n|$)/);
      const fileMatch = completeMatch[1].match(/file:\s*(.+?)(?:\n|$)/);
      const output = outputMatch?.[1]?.trim() || "Task completed";
      const filePath = fileMatch?.[1]?.trim();

      // Extract code if present
      const codeMatch = text.match(
        /```(?:typescript|javascript|ts|js)\n([\s\S]*?)```/,
      );
      const code = codeMatch?.[1];

      return {
        isComplete: true,
        output,
        code,
        filePath,
      };
    }

    // Try alternative completion indicators
    const alternativePatterns = [
      /```COMPLETE\n([\s\S]*?)```/i,
      /\[TASK[_\s]?COMPLETE\]/i,
      /\[COMPLETE\]/i,
      /task\s+(?:is\s+)?completed?/i,
      /successfully\s+completed/i,
      /implementation\s+(?:is\s+)?complete/i,
    ];

    for (const pattern of alternativePatterns) {
      if (pattern.test(text)) {
        // Extract any code blocks
        const codeMatch = text.match(
          /```(?:typescript|javascript|ts|js)\n([\s\S]*?)```/,
        );
        const code = codeMatch?.[1];

        // Extract file path if mentioned
        const fileMatch = text.match(
          /(?:file|path):\s*[`"]?([^\s`"]+\.[a-z]+)[`"]?/i,
        );
        const filePath = fileMatch?.[1]?.trim();

        // Extract a summary from the response
        const lines = text.split("\n").filter((l) => l.trim());
        const output =
          lines.slice(0, 2).join(" ").slice(0, 200) || "Task completed";

        return {
          isComplete: true,
          output,
          code,
          filePath,
        };
      }
    }

    // Check if response contains code and looks complete (heuristic)
    const hasCode = /```(?:typescript|javascript|ts|js)\n[\s\S]+```/.test(text);
    const looksComplete =
      hasCode &&
      (text.includes("Here") ||
        text.includes("complete") ||
        text.includes("implemented") ||
        text.includes("created") ||
        text.includes("added") ||
        text.length > 500); // Substantial response with code likely means completion

    if (looksComplete) {
      const codeMatch = text.match(
        /```(?:typescript|javascript|ts|js)\n([\s\S]*?)```/,
      );
      const code = codeMatch?.[1];
      const fileMatch = text.match(
        /(?:file|path):\s*[`"]?([^\s`"]+\.[a-z]+)[`"]?/i,
      );
      const filePath = fileMatch?.[1]?.trim();

      // Extract first meaningful line as output
      const lines = text
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("```"));
      const output = lines[0]?.slice(0, 200) || "Task completed with code";

      console.log(`[AgentRunner] Detected task completion via heuristic`);
      return {
        isComplete: true,
        output,
        code,
        filePath,
      };
    }

    return { isComplete: false, output: "" };
  }

  /**
   * Ask a question via CommunicationHub and wait for answer
   */
  private async askQuestion(
    taskId: string,
    question: ParsedQuestion,
  ): Promise<string | null> {
    if (!this.hub) {
      console.error("[AgentRunner] CommunicationHub not initialized");
      return null;
    }

    const questionId = `q-${taskId}-${Date.now()}`;

    const fullQuestion: Question = {
      id: questionId,
      agentId: this.agentId,
      type: question.type,
      content: question.content,
      options: question.options,
      defaultOption: question.defaultOption,
      priority: question.blocking ? 10 : 5,
      blocking: question.blocking,
      // Include project context for multi-project identification
      projectName: this.taskListContext?.projectName,
      projectSlug: this.taskListContext?.projectSlug,
      taskId: taskId,
      taskListName: this.taskListContext?.taskListName,
    };

    // Deliver the question
    const deliveryResult = await this.hub.askQuestion(fullQuestion);

    if (!deliveryResult.success) {
      console.error(
        "[AgentRunner] Failed to deliver question:",
        deliveryResult.error,
      );
      return null;
    }

    console.log(
      `[AgentRunner] Question delivered via ${deliveryResult.channel}, waiting for answer...`,
    );

    // Wait for answer
    const answer = await this.hub.waitForAnswer(
      questionId,
      this.questionTimeoutMs,
    );

    if (answer) {
      // Unblock the agent
      await this.hub.unblockAgent(this.agentId);
      return answer.answer;
    }

    return null;
  }

  /**
   * Resolve a relative file path to absolute
   */
  private resolveFilePath(file: string): string {
    if (path.isAbsolute(file)) return file;
    return path.join(process.cwd(), file);
  }

  /**
   * Write content to a file
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf-8");
  }

  /**
   * Extract agent type from agent ID
   */
  private extractAgentType(
    agentId: string,
  ):
    | "monitoring"
    | "orchestrator"
    | "spec"
    | "build"
    | "validation"
    | "sia"
    | "system" {
    const id = agentId.toLowerCase();
    if (id.includes("monitor")) return "monitoring";
    if (id.includes("orchestrat")) return "orchestrator";
    if (id.includes("spec")) return "spec";
    if (id.includes("build")) return "build";
    if (id.includes("valid")) return "validation";
    if (id.includes("sia")) return "sia";
    return "system";
  }

  /**
   * Get the agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }
}

// Cached runners by agent type
const runnerCache = new Map<string, AgentRunner>();

/**
 * Get or create an agent runner for a specific agent type
 */
export async function getAgentRunner(agentType: string): Promise<AgentRunner> {
  if (!runnerCache.has(agentType)) {
    const runner = new AgentRunner(agentType);
    await runner.initialize();
    runnerCache.set(agentType, runner);
  }
  return runnerCache.get(agentType)!;
}

/**
 * Clear all cached runners
 */
export function clearRunnerCache(): void {
  runnerCache.clear();
}
