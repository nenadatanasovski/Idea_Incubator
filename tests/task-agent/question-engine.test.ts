/**
 * Question Engine Tests
 *
 * Unit tests for the question engine service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.9)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { questionEngine } from "../../server/services/task-agent/question-engine";
import { run, saveDb } from "../../database/db";

const TEST_PREFIX = "QUESTION-TEST-";

import type { Task } from "../../types/task-agent.js";

// Create test task and return Task object
function createTestTask(attrs: {
  title?: string;
  description?: string;
}): Task {
  const taskId = uuidv4();
  return {
    id: taskId,
    displayId: `${TEST_PREFIX}${taskId.slice(0, 8)}`,
    title: attrs.title || `${TEST_PREFIX}Test Task`,
    description: attrs.description || "",
    status: "pending",
    category: "feature",
    priority: "P2",
    effort: "medium",
    queue: null,
    phase: 0,
    position: 0,
    owner: "human",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Task;
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(`DELETE FROM task_questions WHERE task_id IN (SELECT id FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%')`);
  await run(`DELETE FROM task_questions WHERE task_id NOT IN (SELECT id FROM tasks) AND task_id LIKE '%-%-%-%-%'`);
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe("QuestionEngine", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("generateQuestions", () => {
    it("should generate questions for a task", async () => {
      const task = createTestTask({
        title: "Add user authentication",
        description: "Implement auth system",
      });

      const questions = await questionEngine.generateQuestions(task);

      expect(questions).toBeDefined();
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    it("should generate questions across multiple categories", async () => {
      const task = createTestTask({
        title: "Build new API endpoint",
        description: "Create endpoint for user data",
      });

      const questions = await questionEngine.generateQuestions(task);

      const categories = new Set(questions.map((q) => q.category));

      // Should cover multiple categories
      expect(categories.size).toBeGreaterThan(1);
    });

    it("should have questions with priority values", async () => {
      const task = createTestTask({
        title: "Critical security fix",
      });

      const questions = await questionEngine.generateQuestions(task);

      // Questions should have priority values (1-10)
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.every(q => q.priority >= 1 && q.priority <= 10)).toBe(true);
    });
  });

  describe("question categories", () => {
    it("should generate requirements questions", async () => {
      const task = createTestTask({
        title: "Implement feature X",
      });

      const questions = await questionEngine.generateQuestions(task);
      const requirementsQuestions = questions.filter(
        (q) => q.category === "outcome",
      );

      expect(requirementsQuestions.length).toBeGreaterThan(0);
    });

    it("should generate scope questions", async () => {
      const task = createTestTask({
        title: "Major refactoring",
      });

      const questions = await questionEngine.generateQuestions(task);
      const scopeQuestions = questions.filter((q) => q.category === "scope");

      expect(scopeQuestions.length).toBeGreaterThan(0);
    });

    it("should generate acceptance questions", async () => {
      const task = createTestTask({
        title: "Add test coverage",
      });

      const questions = await questionEngine.generateQuestions(task);
      const acceptanceQuestions = questions.filter(
        (q) => q.category === "testing",
      );

      expect(acceptanceQuestions.length).toBeGreaterThan(0);
    });

    it("should generate testing questions", async () => {
      const task = createTestTask({
        title: "Create integration tests",
      });

      const questions = await questionEngine.generateQuestions(task);
      const testingQuestions = questions.filter(
        (q) => q.category === "testing",
      );

      expect(testingQuestions.length).toBeGreaterThan(0);
    });
  });

  describe("answerQuestion", () => {
    it("should record answer for a question", async () => {
      const task = createTestTask({
        title: "Test task for answers",
      });

      const questions = await questionEngine.generateQuestions(task);
      const question = questions[0];

      await questionEngine.answerQuestion(
        task.id,
        question.id,
        "This is my answer",
      );

      const updatedQuestions = await questionEngine.getQuestions(task.id);
      const answeredQuestion = updatedQuestions.find(
        (q) => q.id === question.id,
      );

      expect(answeredQuestion?.answer).toBe("This is my answer");
      expect(answeredQuestion?.answeredAt).toBeDefined();
    });
  });

  describe("skipQuestion", () => {
    it("should remove skipped question", async () => {
      const task = createTestTask({
        title: "Test task for skipping",
      });

      const questions = await questionEngine.generateQuestions(task);
      const optionalQuestion = questions.find(
        (q) => q.importance !== "required",
      );

      if (optionalQuestion) {
        await questionEngine.skipQuestion(task.id, optionalQuestion.id);

        const updatedQuestions = await questionEngine.getQuestions(task.id);
        const skippedQuestion = updatedQuestions.find(
          (q) => q.id === optionalQuestion.id,
        );

        expect(skippedQuestion).toBeUndefined();
      }
    });
  });

  describe("getCompletionStatus", () => {
    it("should return completion status", async () => {
      const task = createTestTask({
        title: "Status check task",
      });

      const questions = await questionEngine.generateQuestions(task);
      const status = await questionEngine.getCompletionStatus(task.id);

      expect(status).toBeDefined();
      expect(status.totalQuestions).toBe(questions.length);
      expect(status.answeredQuestions).toBe(0);
      expect(status.requiredAnswered).toBe(0);
    });

    it("should update status after answering", async () => {
      const task = createTestTask({
        title: "Answer tracking task",
      });

      const questions = await questionEngine.generateQuestions(task);

      // Answer first question
      await questionEngine.answerQuestion(task.id, questions[0].id, "Answer");

      const status = await questionEngine.getCompletionStatus(task.id);

      expect(status.answeredQuestions).toBe(1);
    });
  });

  describe("areRequiredQuestionsAnswered", () => {
    it("should return false when required questions unanswered", async () => {
      const task = createTestTask({
        title: "Required questions check",
      });

      await questionEngine.generateQuestions(task);
      const allAnswered =
        await questionEngine.areRequiredQuestionsAnswered(task.id);

      expect(allAnswered).toBe(false);
    });

    it("should return true when all required questions answered", async () => {
      const task = createTestTask({
        title: "All required answered check",
      });

      const questions = await questionEngine.generateQuestions(task);
      const requiredQuestions = questions.filter(
        (q) => q.importance === "required",
      );

      // Answer all required questions
      for (const q of requiredQuestions) {
        await questionEngine.answerQuestion(task.id, q.id, "Answer");
      }

      const allAnswered =
        await questionEngine.areRequiredQuestionsAnswered(task.id);

      expect(allAnswered).toBe(true);
    });
  });
});
