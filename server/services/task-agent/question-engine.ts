/**
 * Question Engine
 *
 * Generates and processes clarifying questions to develop tasks.
 * Part of: Task System V2 Implementation Plan (IMPL-4.7)
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import { Task } from "../../../types/task-agent.js";

/**
 * Question categories (8 categories)
 */
export type QuestionCategory =
  | "outcome"
  | "scope"
  | "implementation"
  | "dependencies"
  | "testing"
  | "risks"
  | "acceptance"
  | "context";

/**
 * Question importance level - derived from priority
 */
export type QuestionImportance = "required" | "important" | "optional";

/**
 * Question entity
 */
export interface Question {
  id: string;
  category: QuestionCategory;
  text: string;
  priority: number; // 1-10, higher = more important
  importance: QuestionImportance; // derived from priority
  targetField?: string; // Which task field this helps clarify
  answer?: string;
  answeredAt?: string;
}

/**
 * Answer entity
 */
export interface Answer {
  questionId: string;
  answer: string;
  answeredAt: string;
}

/**
 * Processed answer with extracted info
 */
export interface ProcessedAnswer {
  questionId: string;
  answer: string;
  extractedInfo: Record<string, unknown>;
  suggestedUpdates: Record<string, unknown>;
}

/**
 * Gap analysis result
 */
export interface GapAnalysis {
  taskId: string;
  missingCategories: QuestionCategory[];
  gapScore: number; // 0-100, lower = more gaps
  recommendations: string[];
}

/**
 * Completeness score
 */
export interface CompletenessScore {
  taskId: string;
  score: number; // 0-100
  byCategory: Record<QuestionCategory, number>;
  isComplete: boolean;
}

/**
 * Completion status for question tracking
 */
export interface CompletionStatus {
  totalQuestions: number;
  answeredQuestions: number;
  requiredAnswered: number;
  requiredTotal: number;
  isComplete: boolean;
}

/**
 * Derive importance from priority value
 */
function importanceFromPriority(priority: number): QuestionImportance {
  if (priority >= 8) return "required";
  if (priority >= 6) return "important";
  return "optional";
}

/**
 * Question templates by category
 */
const QUESTION_TEMPLATES: Record<
  QuestionCategory,
  Array<{ text: string; priority: number; targetField?: string }>
> = {
  outcome: [
    {
      text: "What is the expected end result of this task?",
      priority: 10,
      targetField: "description",
    },
    {
      text: "How will you know when this task is complete?",
      priority: 9,
      targetField: "acceptance",
    },
    { text: "What problem does this task solve?", priority: 8 },
  ],
  scope: [
    { text: "What is explicitly out of scope for this task?", priority: 8 },
    {
      text: "What files or components will this task modify?",
      priority: 7,
      targetField: "impacts",
    },
    { text: "Are there any edge cases that need to be handled?", priority: 6 },
  ],
  implementation: [
    { text: "What approach will you take to implement this?", priority: 7 },
    {
      text: "Are there any existing patterns in the codebase to follow?",
      priority: 6,
    },
    {
      text: "What APIs or services will this task interact with?",
      priority: 5,
    },
  ],
  dependencies: [
    {
      text: "Does this task depend on any other tasks being completed first?",
      priority: 8,
      targetField: "dependencies",
    },
    {
      text: "Are there any external dependencies (packages, APIs, etc.)?",
      priority: 6,
    },
    { text: "Will this task block any other tasks?", priority: 5 },
  ],
  testing: [
    { text: "How will this task be tested?", priority: 7 },
    { text: "What test cases should be created?", priority: 6 },
    {
      text: "Are there any existing tests that need to be updated?",
      priority: 5,
    },
  ],
  risks: [
    { text: "What could go wrong during implementation?", priority: 6 },
    { text: "Are there any performance implications?", priority: 5 },
    { text: "Could this change break existing functionality?", priority: 7 },
  ],
  acceptance: [
    {
      text: "What are the acceptance criteria for this task?",
      priority: 9,
      targetField: "acceptance",
    },
    { text: "Who needs to approve this task as complete?", priority: 5 },
    { text: "Are there any non-functional requirements?", priority: 6 },
  ],
  context: [
    { text: "Why is this task needed now?", priority: 5 },
    { text: "Is there any related documentation or PRDs?", priority: 4 },
    {
      text: "Are there any constraints or limitations to consider?",
      priority: 6,
    },
  ],
};

/**
 * Question Engine class
 */
export class QuestionEngine {
  /**
   * Generate questions for a task
   */
  async generateQuestions(
    task: Task,
    maxQuestions?: number,
  ): Promise<Question[]> {
    const gaps = await this.analyzeGaps(task);
    const questions: Question[] = [];

    // Prioritize questions from categories with gaps
    for (const category of gaps.missingCategories) {
      const templates = QUESTION_TEMPLATES[category];
      for (const template of templates) {
        questions.push({
          id: uuidv4(),
          category,
          text: template.text,
          priority: template.priority,
          importance: importanceFromPriority(template.priority),
          targetField: template.targetField,
        });
      }
    }

    // Sort by priority
    questions.sort((a, b) => b.priority - a.priority);

    // Limit if requested
    const result = maxQuestions ? questions.slice(0, maxQuestions) : questions;

    // Persist questions to task_questions table
    for (const q of result) {
      await run(
        `INSERT OR IGNORE INTO task_questions (id, task_id, category, text, priority, importance, target_field, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          q.id,
          task.id,
          q.category,
          q.text,
          q.priority,
          q.importance,
          q.targetField || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
    }
    await saveDb();

    return result;
  }

  /**
   * Get next questions based on previous answers
   */
  async getNextQuestions(
    taskId: string,
    previousAnswers: Answer[],
  ): Promise<Question[]> {
    const task = await getOne<Task>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Get categories already answered
    const answeredQuestionIds = new Set(
      previousAnswers.map((a) => a.questionId),
    );

    // Generate new questions
    const allQuestions = await this.generateQuestions(task);

    // Filter out answered questions
    return allQuestions.filter((q) => !answeredQuestionIds.has(q.id));
  }

  /**
   * Analyze gaps in task information
   */
  async analyzeGaps(task: Task): Promise<GapAnalysis> {
    const missingCategories: QuestionCategory[] = [];
    let totalScore = 0;
    const recommendations: string[] = [];

    // Check each category
    const categoryScores: Record<QuestionCategory, number> = {
      outcome: 0,
      scope: 0,
      implementation: 0,
      dependencies: 0,
      testing: 0,
      risks: 0,
      acceptance: 0,
      context: 0,
    };

    // Analyze task data
    const description = task.description || "";
    const hasDescription = description.length > 20;
    const hasOutcome = /will\s+|should\s+|must\s+|result\s+in/i.test(
      description,
    );
    const hasScope = /not\s+include|out\s+of\s+scope|exclude/i.test(
      description,
    );
    const hasImplementation = /approach|implement|use|pattern/i.test(
      description,
    );
    const hasTests = /test|verify|validate|check/i.test(description);
    const hasAcceptance = /accept|criteria|complete\s+when|done\s+when/i.test(
      description,
    );

    // Score categories
    categoryScores.outcome = hasOutcome ? 80 : hasDescription ? 40 : 0;
    categoryScores.scope = hasScope ? 80 : hasDescription ? 30 : 0;
    categoryScores.implementation = hasImplementation ? 70 : 20;
    categoryScores.testing = hasTests ? 70 : 20;
    categoryScores.acceptance = hasAcceptance ? 80 : 20;
    categoryScores.context = hasDescription ? 50 : 0;

    // Check dependencies
    const deps = await query<{ id: string }>(
      `SELECT id FROM task_relationships WHERE source_task_id = ? AND relationship_type = 'depends_on'`,
      [task.id],
    );
    categoryScores.dependencies = deps.length > 0 || hasDescription ? 60 : 30;

    // Check appendices for risk/acceptance
    const appendices = await query<{ appendix_type: string }>(
      "SELECT appendix_type FROM task_appendices WHERE task_id = ?",
      [task.id],
    );
    const appendixTypes = new Set(appendices.map((a) => a.appendix_type));

    if (appendixTypes.has("acceptance_criteria")) {
      categoryScores.acceptance = 100;
    }
    if (appendixTypes.has("rollback_plan")) {
      categoryScores.risks = Math.max(categoryScores.risks, 70);
    }
    if (appendixTypes.has("test_context")) {
      categoryScores.testing = Math.max(categoryScores.testing, 80);
    }

    // Identify missing categories
    for (const [category, score] of Object.entries(categoryScores)) {
      totalScore += score;
      if (score < 50) {
        missingCategories.push(category as QuestionCategory);
        recommendations.push(`Add more detail about ${category}`);
      }
    }

    const avgScore = Math.round(totalScore / 8);

    return {
      taskId: task.id,
      missingCategories,
      gapScore: avgScore,
      recommendations,
    };
  }

  /**
   * Get completeness score for a task
   */
  async getCompletenessScore(task: Task): Promise<CompletenessScore> {
    const gaps = await this.analyzeGaps(task);
    const score = gaps.gapScore;

    // Calculate per-category scores
    const byCategory: Record<QuestionCategory, number> = {
      outcome: gaps.missingCategories.includes("outcome") ? 30 : 80,
      scope: gaps.missingCategories.includes("scope") ? 30 : 70,
      implementation: gaps.missingCategories.includes("implementation")
        ? 30
        : 70,
      dependencies: gaps.missingCategories.includes("dependencies") ? 30 : 70,
      testing: gaps.missingCategories.includes("testing") ? 30 : 70,
      risks: gaps.missingCategories.includes("risks") ? 30 : 60,
      acceptance: gaps.missingCategories.includes("acceptance") ? 30 : 80,
      context: gaps.missingCategories.includes("context") ? 30 : 60,
    };

    return {
      taskId: task.id,
      score,
      byCategory,
      isComplete: score >= 70 && gaps.missingCategories.length <= 2,
    };
  }

  /**
   * Process an answer and extract useful information
   */
  async processAnswer(
    _taskId: string,
    questionId: string,
    answer: string,
  ): Promise<ProcessedAnswer> {
    const extractedInfo: Record<string, unknown> = {};
    const suggestedUpdates: Record<string, unknown> = {};

    // Extract file paths
    const filePaths = answer.match(
      /[a-zA-Z0-9_\-/.]+\.(ts|tsx|js|jsx|sql|md|json|yaml|yml)/g,
    );
    if (filePaths) {
      extractedInfo.mentionedFiles = filePaths;
      suggestedUpdates.impacts = filePaths.map((fp) => ({
        targetPath: fp,
        operation: "UPDATE",
        impactType: "file",
      }));
    }

    // Extract dependencies (task references)
    const taskRefs = answer.match(/TU-[A-Z]+-[A-Z]+-\d+/g);
    if (taskRefs) {
      extractedInfo.taskReferences = taskRefs;
    }

    // Extract acceptance criteria (bullet points)
    const bullets = answer.match(/^[-*]\s+.+$/gm);
    if (bullets) {
      extractedInfo.acceptanceCriteria = bullets.map((b) =>
        b.replace(/^[-*]\s+/, ""),
      );
    }

    return {
      questionId,
      answer,
      extractedInfo,
      suggestedUpdates,
    };
  }

  /**
   * Apply answers to update a task
   */
  async applyAnswers(taskId: string, answers: Answer[]): Promise<Task> {
    const task = await getOne<Task>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Process all answers
    const allUpdates: Record<string, unknown>[] = [];
    for (const answer of answers) {
      const processed = await this.processAnswer(
        taskId,
        answer.questionId,
        answer.answer,
      );
      allUpdates.push(processed.suggestedUpdates);
    }

    // Collect file impacts
    const impacts: any[] = [];
    for (const updates of allUpdates) {
      if (updates.impacts) {
        impacts.push(...(updates.impacts as any[]));
      }
    }

    // Save file impacts
    for (const impact of impacts) {
      await run(
        `INSERT OR IGNORE INTO task_impacts (id, task_id, impact_type, operation, target_path, confidence, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          taskId,
          impact.impactType,
          impact.operation,
          impact.targetPath,
          0.7,
          "user",
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      );
    }

    await saveDb();

    // Return updated task
    const updated = await getOne<Task>("SELECT * FROM tasks WHERE id = ?", [
      taskId,
    ]);
    return updated!;
  }

  /**
   * Get available question categories
   */
  getQuestionCategories(): QuestionCategory[] {
    return [
      "outcome",
      "scope",
      "implementation",
      "dependencies",
      "testing",
      "risks",
      "acceptance",
      "context",
    ];
  }

  /**
   * Answer a question
   */
  async answerQuestion(
    taskId: string,
    questionId: string,
    answer: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    await run(
      `UPDATE task_questions SET answer = ?, answered_at = ?, updated_at = ? WHERE id = ? AND task_id = ?`,
      [answer, now, now, questionId, taskId],
    );

    await saveDb();
  }

  /**
   * Get questions for a task
   */
  async getQuestions(taskId: string): Promise<Question[]> {
    const rows = await query<{
      id: string;
      category: QuestionCategory;
      text: string;
      priority: number;
      importance: string;
      target_field: string | null;
      answer: string | null;
      answered_at: string | null;
    }>(
      `SELECT id, category, text, priority, importance, target_field, answer, answered_at FROM task_questions WHERE task_id = ? AND skipped = 0`,
      [taskId],
    );

    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      text: row.text,
      priority: row.priority,
      importance: (row.importance ||
        importanceFromPriority(row.priority)) as QuestionImportance,
      targetField: row.target_field || undefined,
      answer: row.answer || undefined,
      answeredAt: row.answered_at || undefined,
    }));
  }

  /**
   * Check if all required questions are answered
   */
  async areRequiredQuestionsAnswered(taskId: string): Promise<boolean> {
    const unansweredRequired = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM task_questions WHERE task_id = ? AND importance = 'required' AND answer IS NULL AND skipped = 0`,
      [taskId],
    );

    return unansweredRequired[0]?.count === 0;
  }

  /**
   * Skip a question (marks it as skipped so it won't appear in getQuestions)
   */
  async skipQuestion(taskId: string, questionId: string): Promise<void> {
    const now = new Date().toISOString();
    await run(
      `UPDATE task_questions SET skipped = 1, updated_at = ? WHERE id = ? AND task_id = ?`,
      [now, questionId, taskId],
    );
    await saveDb();
  }

  /**
   * Get completion status for a task's questions
   */
  async getCompletionStatus(taskId: string): Promise<CompletionStatus> {
    const rows = await query<{
      importance: string;
      answer: string | null;
    }>(
      `SELECT importance, answer FROM task_questions WHERE task_id = ? AND skipped = 0`,
      [taskId],
    );

    const totalQuestions = rows.length;
    const answeredQuestions = rows.filter((r) => r.answer !== null).length;
    const requiredRows = rows.filter((r) => r.importance === "required");
    const requiredTotal = requiredRows.length;
    const requiredAnswered = requiredRows.filter(
      (r) => r.answer !== null,
    ).length;

    return {
      totalQuestions,
      answeredQuestions,
      requiredAnswered,
      requiredTotal,
      isComplete: requiredTotal === 0 || requiredAnswered >= requiredTotal,
    };
  }
}

// Export singleton instance
export const questionEngine = new QuestionEngine();
export default questionEngine;
