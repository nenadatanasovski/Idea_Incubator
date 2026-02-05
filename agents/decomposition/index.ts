/**
 * AI Decomposition Agent
 *
 * Uses Claude to intelligently analyze tasks and suggest meaningful decomposition
 * into atomic subtasks. Provides context-aware splitting based on PRD requirements,
 * file impacts, and knowledge base gotchas.
 */

import { v4 as uuidv4 } from "uuid";
import { query, getOne } from "../../database/db.js";
import {
  createAnthropicClient,
  type AnthropicClient,
} from "../../utils/anthropic-client.js";
import {
  DECOMPOSITION_SYSTEM_PROMPT,
  buildDecompositionPrompt,
} from "./prompts/system.js";
import type {
  DecompositionContext,
  AIDecompositionResult,
  AISubtaskProposal,
  DecompositionAgentOptions,
  TaskAppendixContext,
  PrdContext,
  RelatedTaskContext,
  FileImpactContext,
  GotchaContext,
} from "./types.js";
import type { Task } from "../../types/task-agent.js";

const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;

/**
 * Database row interfaces
 */
interface TaskRow {
  id: string;
  display_id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  queue: string | null;
  task_list_id: string | null;
  project_id: string | null;
  priority: string;
  effort: string;
  phase: number;
  position: number;
  owner: string;
  assigned_agent_id: string | null;
  parent_task_id: string | null;
  is_decomposed: number;
  decomposition_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface AppendixRow {
  id: string;
  task_id: string;
  appendix_type: string;
  content: string;
  metadata: string | null;
}

interface PrdRow {
  id: string;
  title: string;
  problem_statement: string | null;
  functional_description: string | null;
  success_criteria: string | null;
}

interface RelatedTaskRow {
  id: string;
  relationship_type: string;
  target_task_id: string;
  target_display_id: string;
  target_title: string;
  target_status: string;
}

interface FileImpactRow {
  id: string;
  task_id: string;
  impact_type: string;
  operation: string;
  target_path: string;
  confidence: number;
}

interface GotchaRow {
  id: string;
  content: string;
  file_pattern: string | null;
  confidence: number;
}

/**
 * Map database row to Task object
 */
function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    displayId: row.display_id,
    title: row.title,
    description: row.description || undefined,
    category: row.category as Task["category"],
    status: row.status as Task["status"],
    queue: row.queue as Task["queue"],
    taskListId: row.task_list_id || undefined,
    projectId: row.project_id || undefined,
    priority: row.priority as Task["priority"],
    effort: row.effort as Task["effort"],
    phase: row.phase,
    position: row.position,
    owner: row.owner as Task["owner"],
    assignedAgentId: row.assigned_agent_id || undefined,
    parentTaskId: row.parent_task_id || undefined,
    isDecomposed: row.is_decomposed === 1,
    decompositionId: row.decomposition_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
  };
}

/**
 * AI Decomposition Agent
 */
export class DecompositionAgent {
  private client: AnthropicClient;
  private model: string;
  private maxTokens: number;
  private maxRetries: number;
  private baseDelay: number;
  private totalTokensUsed: number = 0;

  constructor(options: DecompositionAgentOptions = {}) {
    this.client = createAnthropicClient();
    this.model = options.model || DEFAULT_MODEL;
    this.maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.baseDelay = options.baseDelay || DEFAULT_BASE_DELAY;
  }

  /**
   * Load full context for decomposition analysis
   */
  async loadContext(taskId: string): Promise<DecompositionContext> {
    // Load task
    const taskRow = await getOne<TaskRow>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);

    if (!taskRow) {
      throw new Error(`Task ${taskId} not found`);
    }

    const task = mapTaskRow(taskRow);

    // Load appendices
    const appendixRows = await query<AppendixRow>(
      "SELECT * FROM task_appendices WHERE task_id = ?",
      [taskId],
    );

    const appendices: TaskAppendixContext[] = appendixRows.map((row) => ({
      id: row.id,
      appendixType: row.appendix_type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));

    // Load linked PRDs
    const prdRows = await query<PrdRow>(
      `SELECT p.id, p.title, p.problem_statement, p.functional_description, p.success_criteria
       FROM prds p
       JOIN prd_tasks pt ON p.id = pt.prd_id
       WHERE pt.task_id = ?`,
      [taskId],
    );

    const linkedPrds: PrdContext[] = prdRows.map((row) => ({
      id: row.id,
      title: row.title,
      problemStatement: row.problem_statement || undefined,
      functionalDescription: row.functional_description || undefined,
      successCriteria: row.success_criteria
        ? JSON.parse(row.success_criteria)
        : undefined,
    }));

    // Load related tasks
    const relatedRows = await query<RelatedTaskRow>(
      `SELECT tr.id, tr.relationship_type, tr.target_task_id,
              t.display_id as target_display_id, t.title as target_title, t.status as target_status
       FROM task_relationships tr
       JOIN tasks t ON tr.target_task_id = t.id
       WHERE tr.source_task_id = ?`,
      [taskId],
    );

    const relatedTasks: RelatedTaskContext[] = relatedRows.map((row) => ({
      id: row.target_task_id,
      displayId: row.target_display_id,
      title: row.target_title,
      relationshipType: row.relationship_type,
      status: row.target_status,
    }));

    // Load file impacts
    const impactRows = await query<FileImpactRow>(
      "SELECT * FROM task_file_impacts WHERE task_id = ?",
      [taskId],
    );

    const fileImpacts: FileImpactContext[] = impactRows.map((row) => ({
      targetPath: row.target_path,
      operation: row.operation as FileImpactContext["operation"],
      impactType: row.impact_type as FileImpactContext["impactType"],
      confidence: row.confidence,
    }));

    // Load relevant gotchas from knowledge base
    const gotchas = await this.loadRelevantGotchas(task, fileImpacts);

    return {
      task,
      appendices,
      linkedPrds,
      relatedTasks,
      fileImpacts,
      gotchas,
    };
  }

  /**
   * Load gotchas relevant to the task's file impacts
   */
  private async loadRelevantGotchas(
    task: Task,
    fileImpacts: FileImpactContext[],
  ): Promise<GotchaContext[]> {
    // Get file patterns from impacts
    const patterns = fileImpacts.map((i) => i.targetPath);

    // If no patterns, use task category as fallback
    if (patterns.length === 0) {
      patterns.push(`%${task.category}%`);
    }

    // Query knowledge base for matching gotchas
    const gotchaRows = await query<GotchaRow>(
      `SELECT id, content, file_pattern, confidence
       FROM knowledge_base
       WHERE entry_type = 'gotcha' AND confidence >= 0.7
       ORDER BY confidence DESC
       LIMIT 10`,
      [],
    );

    // Filter gotchas by file pattern match
    return gotchaRows
      .filter((row) => {
        if (!row.file_pattern) return true;
        return patterns.some((p) => this.matchesPattern(p, row.file_pattern!));
      })
      .map((row) => ({
        id: row.id,
        content: row.content,
        filePattern: row.file_pattern || undefined,
        confidence: row.confidence,
      }));
  }

  /**
   * Simple glob-like pattern matching
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    try {
      return new RegExp(regexPattern).test(path);
    } catch {
      return path.includes(pattern);
    }
  }

  /**
   * Analyze a task and generate decomposition suggestions using AI
   */
  async analyzeTask(
    context: DecompositionContext,
  ): Promise<AIDecompositionResult> {
    const { task, appendices, linkedPrds, relatedTasks, fileImpacts, gotchas } =
      context;

    // Build PRD context strings
    const prdContext = linkedPrds.map((prd) => {
      const parts: string[] = [];
      if (prd.problemStatement) parts.push(`Problem: ${prd.problemStatement}`);
      if (prd.functionalDescription)
        parts.push(`Description: ${prd.functionalDescription}`);
      if (prd.successCriteria)
        parts.push(`Success Criteria:\n${prd.successCriteria.join("\n")}`);
      return { title: prd.title, content: parts.join("\n\n") };
    });

    // Build the prompt
    const userPrompt = buildDecompositionPrompt(
      {
        id: task.id,
        displayId: task.displayId,
        title: task.title,
        description: task.description,
        category: task.category,
        effort: task.effort,
        status: task.status,
      },
      appendices.map((a) => ({
        appendixType: a.appendixType,
        content: a.content,
      })),
      prdContext,
      relatedTasks.map((t) => ({
        displayId: t.displayId,
        title: t.title,
        relationshipType: t.relationshipType,
      })),
      fileImpacts.map((f) => ({
        targetPath: f.targetPath,
        operation: f.operation,
        impactType: f.impactType,
      })),
      gotchas.map((g) => ({ content: g.content, filePattern: g.filePattern })),
    );

    // Call Claude
    const response = await this.callWithRetry(
      DECOMPOSITION_SYSTEM_PROMPT,
      userPrompt,
    );

    // Parse the response
    return this.parseDecompositionResult(response);
  }

  /**
   * Parse AI response into structured result
   */
  private parseDecompositionResult(response: string): AIDecompositionResult {
    // Try to extract JSON from code block
    const jsonMatch = response.match(/```json\n([\s\S]*?)```/);
    let parsed: any;

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("Failed to parse JSON from code block:", e);
      }
    }

    // Try direct JSON parse
    if (!parsed) {
      try {
        parsed = JSON.parse(response);
      } catch (e) {
        console.error("Failed to parse response as JSON:", e);
      }
    }

    // Return default if parsing fails
    if (!parsed) {
      return {
        shouldDecompose: false,
        reasoning: "Failed to parse AI response",
        subtasks: [],
        confidence: 0,
        warnings: ["AI response could not be parsed"],
      };
    }

    // Validate and normalize the result
    return {
      shouldDecompose: Boolean(parsed.shouldDecompose),
      reasoning: String(parsed.reasoning || ""),
      subtasks: Array.isArray(parsed.subtasks)
        ? parsed.subtasks.map(this.normalizeSubtask)
        : [],
      confidence: Number(parsed.confidence) || 0.5,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : undefined,
    };
  }

  /**
   * Normalize a subtask proposal from AI
   */
  private normalizeSubtask(subtask: any): AISubtaskProposal {
    return {
      title: String(subtask.title || "Untitled Subtask"),
      description: String(subtask.description || ""),
      category: subtask.category || "task",
      effort: subtask.effort || "small",
      acceptanceCriteria: Array.isArray(subtask.acceptanceCriteria)
        ? subtask.acceptanceCriteria.map(String)
        : [],
      testCommands: Array.isArray(subtask.testCommands)
        ? subtask.testCommands.map(String)
        : ["npx tsc --noEmit"],
      fileImpacts: Array.isArray(subtask.fileImpacts)
        ? subtask.fileImpacts.map((f: any) => ({
            targetPath: String(f.targetPath || ""),
            operation: f.operation || "UPDATE",
            impactType: f.impactType || "file",
          }))
        : [],
      dependsOnIndex:
        typeof subtask.dependsOnIndex === "number"
          ? subtask.dependsOnIndex
          : undefined,
      rationale: String(subtask.rationale || ""),
      addressesCriteria: Array.isArray(subtask.addressesCriteria)
        ? subtask.addressesCriteria
        : undefined,
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

      // Track token usage
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
          `[DecompositionAgent] Retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})...`,
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
    if (error.status === 429) return true;
    if (error.status >= 500) return true;
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
   * Generate a new decomposition ID
   */
  generateDecompositionId(): string {
    return uuidv4();
  }
}

// Export singleton instance
export const decompositionAgent = new DecompositionAgent();
export default decompositionAgent;

// Re-export types
export type {
  DecompositionContext,
  AIDecompositionResult,
  AISubtaskProposal,
  DecompositionAgentOptions,
} from "./types.js";
