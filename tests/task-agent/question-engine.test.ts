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

// Create test task
async function createTestTask(attrs: {
  title?: string;
  description?: string;
}): Promise<string> {
  const taskId = uuidv4();
  await run(
    `INSERT INTO tasks (id, display_id, title, description, status, category, priority, effort, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 'feature', 'P2', 'medium', datetime('now'), datetime('now'))`,
    [
      taskId,
      `${TEST_PREFIX}${taskId.slice(0, 8)}`,
      attrs.title || `${TEST_PREFIX}Test Task`,
      attrs.description || "",
    ],
  );
  await saveDb();
  return taskId;
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
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
      const taskId = await createTestTask({
        title: "Add user authentication",
        description: "Implement auth system",
      });

      const questions = await questionEngine.generateQuestions(taskId);

      expect(questions).toBeDefined();
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    it("should generate questions across multiple categories", async () => {
      const taskId = await createTestTask({
        title: "Build new API endpoint",
        description: "Create endpoint for user data",
      });

      const questions = await questionEngine.generateQuestions(taskId);

      const categories = new Set(questions.map((q) => q.category));

      // Should cover multiple categories
      expect(categories.size).toBeGreaterThan(1);
    });

    it("should mark required questions as required importance", async () => {
      const taskId = await createTestTask({
        title: "Critical security fix",
      });

      const questions = await questionEngine.generateQuestions(taskId);

      const requiredQuestions = questions.filter(
        (q) => q.importance === "required",
      );

      // Should have at least some required questions
      expect(requiredQuestions.length).toBeGreaterThan(0);
    });
  });

  describe("question categories", () => {
    it("should generate requirements questions", async () => {
      const taskId = await createTestTask({
        title: "Implement feature X",
      });

      const questions = await questionEngine.generateQuestions(taskId);
      const requirementsQuestions = questions.filter(
        (q) => q.category === "requirements",
      );

      expect(requirementsQuestions.length).toBeGreaterThan(0);
    });

    it("should generate scope questions", async () => {
      const taskId = await createTestTask({
        title: "Major refactoring",
      });

      const questions = await questionEngine.generateQuestions(taskId);
      const scopeQuestions = questions.filter((q) => q.category === "scope");

      expect(scopeQuestions.length).toBeGreaterThan(0);
    });

    it("should generate acceptance questions", async () => {
      const taskId = await createTestTask({
        title: "Add test coverage",
      });

      const questions = await questionEngine.generateQuestions(taskId);
      const acceptanceQuestions = questions.filter(
        (q) => q.category === "acceptance",
      );

      expect(acceptanceQuestions.length).toBeGreaterThan(0);
    });

    it("should generate testing questions", async () => {
      const taskId = await createTestTask({
        title: "Create integration tests",
      });

      const questions = await questionEngine.generateQuestions(taskId);
      const testingQuestions = questions.filter(
        (q) => q.category === "testing",
      );

      expect(testingQuestions.length).toBeGreaterThan(0);
    });
  });

  describe("answerQuestion", () => {
    it("should record answer for a question", async () => {
      const taskId = await createTestTask({
        title: "Test task for answers",
      });

      const questions = await questionEngine.generateQuestions(taskId);
      const question = questions[0];

      await questionEngine.answerQuestion(
        taskId,
        question.id,
        "This is my answer",
      );

      const updatedQuestions = await questionEngine.getQuestions(taskId);
      const answeredQuestion = updatedQuestions.find(
        (q) => q.id === question.id,
      );

      expect(answeredQuestion?.answer).toBe("This is my answer");
      expect(answeredQuestion?.answeredAt).toBeDefined();
    });
  });

  describe("skipQuestion", () => {
    it("should remove skipped question", async () => {
      const taskId = await createTestTask({
        title: "Test task for skipping",
      });

      const questions = await questionEngine.generateQuestions(taskId);
      const optionalQuestion = questions.find(
        (q) => q.importance !== "required",
      );

      if (optionalQuestion) {
        await questionEngine.skipQuestion(taskId, optionalQuestion.id);

        const updatedQuestions = await questionEngine.getQuestions(taskId);
        const skippedQuestion = updatedQuestions.find(
          (q) => q.id === optionalQuestion.id,
        );

        expect(skippedQuestion).toBeUndefined();
      }
    });
  });

  describe("getCompletionStatus", () => {
    it("should return completion status", async () => {
      const taskId = await createTestTask({
        title: "Status check task",
      });

      const questions = await questionEngine.generateQuestions(taskId);
      const status = await questionEngine.getCompletionStatus(taskId);

      expect(status).toBeDefined();
      expect(status.totalQuestions).toBe(questions.length);
      expect(status.answeredQuestions).toBe(0);
      expect(status.requiredAnswered).toBe(0);
    });

    it("should update status after answering", async () => {
      const taskId = await createTestTask({
        title: "Answer tracking task",
      });

      const questions = await questionEngine.generateQuestions(taskId);

      // Answer first question
      await questionEngine.answerQuestion(taskId, questions[0].id, "Answer");

      const status = await questionEngine.getCompletionStatus(taskId);

      expect(status.answeredQuestions).toBe(1);
    });
  });

  describe("areRequiredQuestionsAnswered", () => {
    it("should return false when required questions unanswered", async () => {
      const taskId = await createTestTask({
        title: "Required questions check",
      });

      await questionEngine.generateQuestions(taskId);
      const allAnswered =
        await questionEngine.areRequiredQuestionsAnswered(taskId);

      expect(allAnswered).toBe(false);
    });

    it("should return true when all required questions answered", async () => {
      const taskId = await createTestTask({
        title: "All required answered check",
      });

      const questions = await questionEngine.generateQuestions(taskId);
      const requiredQuestions = questions.filter(
        (q) => q.importance === "required",
      );

      // Answer all required questions
      for (const q of requiredQuestions) {
        await questionEngine.answerQuestion(taskId, q.id, "Answer");
      }

      const allAnswered =
        await questionEngine.areRequiredQuestionsAnswered(taskId);

      expect(allAnswered).toBe(true);
    });
  });
});
