/**
 * AcceptanceCriteriaGenerator - AI-powered acceptance criteria generation
 *
 * Generates clarifying questions and acceptance criteria based on:
 * - Task title and description
 * - PRD requirement context (if linked)
 * - Adjacent tasks in the same task list
 * - User-provided additional context and answers
 *
 * Part of: Task Agent Workflow Enhancement
 */

import { query, getOne } from "../../../database/db.js";
import { createAnthropicClient } from "../../../utils/anthropic-client.js";

// Types
export interface ACGenerationContext {
  taskId: string;
  prdId?: string;
  requirementRef?: string;
  adjacentTaskIds?: string[];
  additionalContext?: string;
}

export interface Question {
  question: string;
  suggestedAnswers: string[];
}

export interface QuestionAnswer {
  question: string;
  answer: string;
}

interface TaskRow {
  id: string;
  display_id: string;
  title: string;
  description: string | null;
  category: string;
}

interface PrdRow {
  id: string;
  title: string;
  problem_statement: string | null;
  success_criteria: string;
  constraints: string;
}

// Rate limiting
const rateLimits: Record<string, number> = {};
const RATE_LIMIT_MS = 3000;

function checkRateLimit(operation: string): boolean {
  const now = Date.now();
  const lastCall = rateLimits[operation] || 0;
  if (now - lastCall < RATE_LIMIT_MS) return false;
  rateLimits[operation] = now;
  return true;
}

/**
 * AcceptanceCriteriaGenerator class
 */
export class AcceptanceCriteriaGenerator {
  private client = createAnthropicClient();

  /**
   * Generate clarifying questions based on task context
   */
  async generateQuestions(context: ACGenerationContext): Promise<Question[]> {
    if (!checkRateLimit(`questions-${context.taskId}`)) {
      throw new Error("Rate limited. Please wait a few seconds and try again.");
    }

    // Gather all context
    const taskContext = await this.getTaskContext(context.taskId);
    if (!taskContext) {
      throw new Error("Task not found");
    }

    const prdContext = context.prdId
      ? await this.getPrdContext(context.prdId, context.requirementRef)
      : null;

    const adjacentTasksContext = context.adjacentTaskIds?.length
      ? await this.getAdjacentTasksContext(context.adjacentTaskIds)
      : null;

    // Build prompt
    const prompt = this.buildQuestionsPrompt(
      taskContext,
      prdContext,
      adjacentTasksContext,
      context.additionalContext,
    );

    try {
      const response = await this.client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 2000,
        system: `You are a senior software engineer helping to define acceptance criteria for development tasks.
Your goal is to ask clarifying questions that will help generate comprehensive, testable acceptance criteria.

Focus on:
- Edge cases and error handling
- User experience considerations
- Performance requirements
- Security implications
- Integration points with other systems
- Data validation requirements

Return your response as JSON in this exact format:
{
  "questions": [
    {
      "question": "What should happen when...?",
      "suggestedAnswers": ["Option A", "Option B", "Option C"]
    }
  ]
}

Generate 3-5 relevant questions. Each question should have 2-3 suggested answers that cover common scenarios.`,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(
          "[AC-Generator] Failed to parse questions response:",
          text,
        );
        return this.getDefaultQuestions(taskContext);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.questions || [];
    } catch (err) {
      console.error("[AC-Generator] Error generating questions:", err);
      // Return default questions on error
      return this.getDefaultQuestions(taskContext);
    }
  }

  /**
   * Generate acceptance criteria based on context and answered questions
   */
  async generateCriteria(
    context: ACGenerationContext,
    answers: QuestionAnswer[],
  ): Promise<string[]> {
    if (!checkRateLimit(`criteria-${context.taskId}`)) {
      throw new Error("Rate limited. Please wait a few seconds and try again.");
    }

    // Gather all context
    const taskContext = await this.getTaskContext(context.taskId);
    if (!taskContext) {
      throw new Error("Task not found");
    }

    const prdContext = context.prdId
      ? await this.getPrdContext(context.prdId, context.requirementRef)
      : null;

    const adjacentTasksContext = context.adjacentTaskIds?.length
      ? await this.getAdjacentTasksContext(context.adjacentTaskIds)
      : null;

    // Build prompt
    const prompt = this.buildCriteriaPrompt(
      taskContext,
      prdContext,
      adjacentTasksContext,
      context.additionalContext,
      answers,
    );

    try {
      const response = await this.client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 3000,
        system: `You are a senior software engineer generating acceptance criteria for development tasks.

Generate comprehensive, testable acceptance criteria that:
- Start with "Given/When/Then" or "MUST/SHOULD" format when appropriate
- Are specific and measurable
- Cover the main functionality
- Address edge cases and error handling
- Consider security implications
- Are independent and can be verified individually

Return your response as JSON in this exact format:
{
  "criteria": [
    "Criterion 1 text here",
    "Criterion 2 text here",
    "Criterion 3 text here"
  ]
}

Generate 5-10 acceptance criteria based on the task context and user answers.`,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*"criteria"[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(
          "[AC-Generator] Failed to parse criteria response:",
          text,
        );
        return this.getDefaultCriteria(taskContext);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.criteria || [];
    } catch (err) {
      console.error("[AC-Generator] Error generating criteria:", err);
      return this.getDefaultCriteria(taskContext);
    }
  }

  /**
   * Get task context from database
   */
  private async getTaskContext(taskId: string): Promise<TaskRow | null> {
    return getOne<TaskRow>(
      "SELECT id, display_id, title, description, category FROM tasks WHERE id = ?",
      [taskId],
    );
  }

  /**
   * Get PRD context with specific requirement
   */
  private async getPrdContext(
    prdId: string,
    requirementRef?: string,
  ): Promise<{
    title: string;
    problemStatement: string | null;
    requirement?: { ref: string; text: string };
  } | null> {
    const prd = await getOne<PrdRow>(
      "SELECT id, title, problem_statement, success_criteria, constraints FROM prds WHERE id = ?",
      [prdId],
    );

    if (!prd) return null;

    let requirement: { ref: string; text: string } | undefined;

    // Parse requirement ref like "success_criteria[0]"
    if (requirementRef) {
      const match = requirementRef.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        const section = match[1];
        const index = parseInt(match[2], 10);

        let items: unknown[] = [];
        if (section === "success_criteria") {
          items = JSON.parse(prd.success_criteria || "[]");
        } else if (section === "constraints") {
          items = JSON.parse(prd.constraints || "[]");
        }

        if (items[index]) {
          const item = items[index];
          const text =
            typeof item === "string"
              ? item
              : (
                  item as {
                    criterion?: string;
                    text?: string;
                    description?: string;
                  }
                ).criterion ||
                (item as { text?: string }).text ||
                (item as { description?: string }).description ||
                "";
          requirement = { ref: requirementRef, text };
        }
      }
    }

    return {
      title: prd.title,
      problemStatement: prd.problem_statement,
      requirement,
    };
  }

  /**
   * Get context from adjacent tasks
   */
  private async getAdjacentTasksContext(
    taskIds: string[],
  ): Promise<Array<{ displayId: string; title: string }>> {
    if (taskIds.length === 0) return [];

    const placeholders = taskIds.map(() => "?").join(",");
    const tasks = await query<{ display_id: string; title: string }>(
      `SELECT display_id, title FROM tasks WHERE id IN (${placeholders})`,
      taskIds,
    );

    return tasks.map((t) => ({
      displayId: t.display_id,
      title: t.title,
    }));
  }

  /**
   * Build prompt for generating questions
   */
  private buildQuestionsPrompt(
    task: TaskRow,
    prdContext: {
      title: string;
      problemStatement: string | null;
      requirement?: { ref: string; text: string };
    } | null,
    adjacentTasks: Array<{ displayId: string; title: string }> | null,
    additionalContext?: string,
  ): string {
    let prompt = `Generate clarifying questions to help define acceptance criteria for this task:

## Task Details
- **Title**: ${task.title}
- **Category**: ${task.category}
${task.description ? `- **Description**: ${task.description}` : ""}
`;

    if (prdContext) {
      prompt += `
## PRD Context
- **PRD Title**: ${prdContext.title}
${prdContext.problemStatement ? `- **Problem Statement**: ${prdContext.problemStatement}` : ""}
`;
      if (prdContext.requirement) {
        prompt += `- **Linked Requirement** (${prdContext.requirement.ref}): ${prdContext.requirement.text}
`;
      }
    }

    if (adjacentTasks && adjacentTasks.length > 0) {
      prompt += `
## Related Tasks in Same List
${adjacentTasks.map((t) => `- ${t.displayId}: ${t.title}`).join("\n")}
`;
    }

    if (additionalContext) {
      prompt += `
## Additional Context from User
${additionalContext}
`;
    }

    prompt += `
Based on the above context, generate 3-5 clarifying questions that would help define comprehensive acceptance criteria.
Each question should have 2-3 suggested answers covering common scenarios.
`;

    return prompt;
  }

  /**
   * Build prompt for generating criteria
   */
  private buildCriteriaPrompt(
    task: TaskRow,
    prdContext: {
      title: string;
      problemStatement: string | null;
      requirement?: { ref: string; text: string };
    } | null,
    adjacentTasks: Array<{ displayId: string; title: string }> | null,
    additionalContext?: string,
    answers?: QuestionAnswer[],
  ): string {
    let prompt = `Generate acceptance criteria for this development task:

## Task Details
- **Title**: ${task.title}
- **Category**: ${task.category}
${task.description ? `- **Description**: ${task.description}` : ""}
`;

    if (prdContext) {
      prompt += `
## PRD Context
- **PRD Title**: ${prdContext.title}
${prdContext.problemStatement ? `- **Problem Statement**: ${prdContext.problemStatement}` : ""}
`;
      if (prdContext.requirement) {
        prompt += `- **Linked Requirement** (${prdContext.requirement.ref}): ${prdContext.requirement.text}
`;
      }
    }

    if (adjacentTasks && adjacentTasks.length > 0) {
      prompt += `
## Related Tasks in Same List
${adjacentTasks.map((t) => `- ${t.displayId}: ${t.title}`).join("\n")}
`;
    }

    if (additionalContext) {
      prompt += `
## Additional Context from User
${additionalContext}
`;
    }

    if (answers && answers.length > 0) {
      prompt += `
## User's Answers to Clarifying Questions
${answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}
`;
    }

    prompt += `
Based on the above context and answers, generate 5-10 comprehensive acceptance criteria.
Each criterion should be testable and independently verifiable.
`;

    return prompt;
  }

  /**
   * Default questions when AI fails
   */
  private getDefaultQuestions(task: TaskRow): Question[] {
    const category = task.category.toLowerCase();

    const baseQuestions: Question[] = [
      {
        question: "What should happen when an error occurs?",
        suggestedAnswers: [
          "Display an error message to the user",
          "Log the error and retry automatically",
          "Show error and provide retry option",
        ],
      },
      {
        question: "Are there any performance requirements for this task?",
        suggestedAnswers: [
          "No specific requirements",
          "Response time under 500ms",
          "Should handle concurrent operations",
        ],
      },
    ];

    // Add category-specific questions
    if (category === "feature" || category === "ui") {
      baseQuestions.push({
        question: "Should this feature work on mobile devices?",
        suggestedAnswers: [
          "Yes, responsive design required",
          "Desktop only",
          "Mobile-first design",
        ],
      });
    }

    if (category === "api" || category === "infrastructure") {
      baseQuestions.push({
        question: "What authentication is required?",
        suggestedAnswers: [
          "User must be authenticated",
          "No authentication required",
          "API key required",
        ],
      });
    }

    return baseQuestions;
  }

  /**
   * Default criteria when AI fails
   */
  private getDefaultCriteria(task: TaskRow): string[] {
    return [
      `MUST: ${task.title} is implemented as specified`,
      "MUST: All existing tests continue to pass",
      "SHOULD: New functionality includes appropriate error handling",
      "SHOULD: Code follows project conventions and is well-documented",
      "SHOULD: No console errors or warnings in browser/terminal",
    ];
  }
}

// Export singleton instance
export const acceptanceCriteriaGenerator = new AcceptanceCriteriaGenerator();
export default acceptanceCriteriaGenerator;
