/**
 * Questions API Routes
 *
 * Endpoints for managing agent questions:
 * - GET /api/questions/pending - Get all pending questions
 * - POST /api/questions/:id/answer - Answer a question
 * - POST /api/questions/:id/skip - Skip a question
 * - POST /api/questions/:id/remind - Set reminder for later
 * - POST /api/questions/expire-old - Expire old questions (QUE-004)
 * - POST /api/questions/answer-all-defaults - Answer all with defaults (QUE-005)
 */

import { Router, Request, Response } from "express";
import { query, run, getOne } from "../../database/db.js";
import { emitTaskExecutorEvent } from "../websocket.js";
import {
  validateAnswerRequest,
} from "../../utils/url-signer.js";
import { eventService } from "../services/event-service.js";

// Default timeout for questions without explicit expiry (24 hours)
const DEFAULT_QUESTION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

// Expiry check interval (5 minutes)
const EXPIRY_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let expiryCheckInterval: ReturnType<typeof setInterval> | null = null;

const router = Router();

interface QuestionRow {
  id: string;
  agent_id: string;
  agent_type: string;
  type: string;
  content: string;
  options: string | null;
  blocking: number;
  priority: number;
  message_id: number | null;
  chat_id: string | null;
  default_option: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
  project_name?: string;
  task_id?: string;
  task_list_name?: string;
  [key: string]: unknown; // Add index signature for Record<string, unknown> constraint
}

/**
 * GET /api/questions/pending
 * Get all pending questions
 */
router.get("/pending", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await query<QuestionRow>(`
      SELECT * FROM questions
      WHERE status = 'pending'
      ORDER BY
        CASE WHEN blocking = 1 THEN 0 ELSE 1 END,
        priority DESC,
        created_at ASC
    `);

    const questions = rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      agentName:
        row.agent_type.charAt(0).toUpperCase() +
        row.agent_type.slice(1) +
        " Agent",
      agentType: row.agent_type,
      type: row.type,
      content: row.content,
      options: row.options ? JSON.parse(row.options) : [],
      priority:
        row.priority >= 8
          ? "critical"
          : row.priority >= 6
            ? "high"
            : row.priority >= 4
              ? "medium"
              : "low",
      blocking: row.blocking === 1,
      defaultOption: row.default_option,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      projectName: row.project_name,
      taskId: row.task_id,
      taskListName: row.task_list_name,
    }));

    res.json({ questions });
  } catch (error) {
    console.error("[QuestionsAPI] Error fetching pending questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

/**
 * GET /api/questions/:id
 * Get a specific question
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const row = await getOne<QuestionRow>(
      `
      SELECT * FROM questions WHERE id = ?
    `,
      [id],
    );

    if (!row) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    res.json({
      id: row.id,
      agentId: row.agent_id,
      agentName:
        row.agent_type.charAt(0).toUpperCase() +
        row.agent_type.slice(1) +
        " Agent",
      agentType: row.agent_type,
      type: row.type,
      content: row.content,
      options: row.options ? JSON.parse(row.options) : [],
      priority:
        row.priority >= 8
          ? "critical"
          : row.priority >= 6
            ? "high"
            : row.priority >= 4
              ? "medium"
              : "low",
      blocking: row.blocking === 1,
      defaultOption: row.default_option,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      status: row.status,
    });
  } catch (error) {
    console.error("[QuestionsAPI] Error fetching question:", error);
    res.status(500).json({ error: "Failed to fetch question" });
  }
});

/**
 * POST /api/questions/:id/answer
 * Answer a question
 * Supports both:
 * - POST with JSON body { answer: "..." } (from UI)
 * - GET with signed query params (from email links, SEC-003)
 */
router.post(
  "/:id/answer",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      let answer: string;
      let fromSignedLink = false;

      // Check if answer comes from query params (signed link) or body (UI)
      if (req.query.value) {
        // Validate signed URL (SEC-003)
        const validation = validateAnswerRequest(id, {
          value: req.query.value as string,
          expires: req.query.expires as string,
          sig: req.query.sig as string,
        });

        if (!validation.valid) {
          res
            .status(403)
            .json({ error: validation.error || "Invalid or expired link" });
          return;
        }

        answer = validation.value;
        fromSignedLink = true;
      } else {
        // Answer from request body (UI)
        answer = req.body.answer;
      }

      if (!answer || typeof answer !== "string") {
        res.status(400).json({ error: "Answer is required" });
        return;
      }

      // Get the question
      const row = await getOne<QuestionRow>(
        `
      SELECT * FROM questions WHERE id = ?
    `,
        [id],
      );

      if (!row) {
        res.status(404).json({ error: "Question not found" });
        return;
      }

      if (row.status !== "pending") {
        res.status(400).json({ error: `Question already ${row.status}` });
        return;
      }

      // Update question status in database
      await run(
        `
      UPDATE questions
      SET status = 'answered',
          answer = ?,
          answered_at = datetime('now')
      WHERE id = ?
    `,
        [answer, id],
      );

      // Emit event for WebSocket clients
      emitTaskExecutorEvent("task:resumed", {
        questionId: id,
        agentId: row.agent_id,
        answer,
      });

      // Emit platform event for question answered
      eventService
        .emitEvent({
          type: "question_answered",
          source: "api",
          payload: {
            questionId: id,
            agentId: row.agent_id,
            agentType: row.agent_type,
            questionType: row.type,
            fromSignedLink,
          },
          taskId: row.task_id || undefined,
        })
        .catch(() => {});

      // For signed links, redirect to a thank you page or return HTML
      if (fromSignedLink) {
        res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Answer Submitted</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>✓ Answer Submitted</h1>
          <p>Your response "${answer}" has been recorded.</p>
          <p style="color: #666;">You can close this window.</p>
        </body>
        </html>
      `);
        return;
      }

      res.json({
        success: true,
        message: "Answer submitted successfully",
        questionId: id,
      });
    } catch (error) {
      console.error("[QuestionsAPI] Error answering question:", error);
      res.status(500).json({ error: "Failed to submit answer" });
    }
  },
);

/**
 * GET /api/questions/:id/answer
 * Answer a question via signed link (SEC-003)
 * Redirects to POST handler
 */
router.get(
  "/:id/answer",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Validate signed URL
      const validation = validateAnswerRequest(id, {
        value: req.query.value as string,
        expires: req.query.expires as string,
        sig: req.query.sig as string,
      });

      if (!validation.valid) {
        res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Link Invalid</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>⚠ Link Invalid or Expired</h1>
          <p>${validation.error || "This link is no longer valid."}</p>
          <p style="color: #666;">Please check your email for a new link or use the dashboard.</p>
        </body>
        </html>
      `);
        return;
      }

      // Get the question
      const row = await getOne<QuestionRow>(
        `
      SELECT * FROM questions WHERE id = ?
    `,
        [id],
      );

      if (!row) {
        res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Question Not Found</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>⚠ Question Not Found</h1>
          <p>This question may have been deleted.</p>
        </body>
        </html>
      `);
        return;
      }

      if (row.status !== "pending") {
        res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Already Answered</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>ℹ Question Already Answered</h1>
          <p>This question has already been ${row.status}.</p>
          <p style="color: #666;">No further action needed.</p>
        </body>
        </html>
      `);
        return;
      }

      // Update question status in database
      await run(
        `
      UPDATE questions
      SET status = 'answered',
          answer = ?,
          answered_at = datetime('now')
      WHERE id = ?
    `,
        [validation.value, id],
      );

      // Emit event for WebSocket clients
      emitTaskExecutorEvent("task:resumed", {
        questionId: id,
        agentId: row.agent_id,
        answer: validation.value,
      });

      res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Answer Submitted</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>✓ Answer Submitted</h1>
        <p>Your response "<strong>${validation.value}</strong>" has been recorded.</p>
        <p style="color: #666;">You can close this window.</p>
      </body>
      </html>
    `);
    } catch (error) {
      console.error("[QuestionsAPI] Error answering question via link:", error);
      res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>⚠ Error</h1>
        <p>Failed to process your response. Please try again.</p>
      </body>
      </html>
    `);
    }
  },
);

/**
 * POST /api/questions/:id/skip
 * Skip a question
 */
router.post("/:id/skip", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get the question
    const row = await getOne<QuestionRow>(
      `
      SELECT * FROM questions WHERE id = ?
    `,
      [id],
    );

    if (!row) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    if (row.status !== "pending") {
      res.status(400).json({ error: `Question already ${row.status}` });
      return;
    }

    // Update question status - use default option as answer if available
    const answerValue = row.default_option || reason || "Skipped by user";
    await run(
      `
      UPDATE questions
      SET status = 'skipped',
          answered_at = datetime('now'),
          answer = ?
      WHERE id = ?
    `,
      [answerValue, id],
    );

    // Emit event for WebSocket clients
    emitTaskExecutorEvent("task:resumed", {
      questionId: id,
      agentId: row.agent_id,
      answer: row.default_option || "__skipped__",
      skipped: true,
      reason,
    });

    // Emit platform event for question skipped
    eventService
      .emitEvent({
        type: "question_skipped",
        source: "api",
        payload: {
          questionId: id,
          agentId: row.agent_id,
          agentType: row.agent_type,
          questionType: row.type,
          reason: reason || "No reason provided",
          usedDefault: !!row.default_option,
        },
        taskId: row.task_id || undefined,
      })
      .catch(() => {});

    res.json({
      success: true,
      message: "Question skipped",
      questionId: id,
      usedDefault: !!row.default_option,
    });
  } catch (error) {
    console.error("[QuestionsAPI] Error skipping question:", error);
    res.status(500).json({ error: "Failed to skip question" });
  }
});

/**
 * POST /api/questions/:id/remind
 * Set a reminder for a question
 */
router.post(
  "/:id/remind",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { remindAt, channel } = req.body;

      // Get the question
      const row = await getOne<QuestionRow>(
        `
      SELECT * FROM questions WHERE id = ?
    `,
        [id],
      );

      if (!row) {
        res.status(404).json({ error: "Question not found" });
        return;
      }

      // Calculate remind time (default: 30 minutes)
      const remindTime = remindAt
        ? new Date(remindAt).toISOString()
        : new Date(Date.now() + 30 * 60 * 1000).toISOString();

      // Store reminder (would typically go to a reminders table or use notification system)
      console.log(
        `[QuestionsAPI] Setting reminder for question ${id} at ${remindTime} via ${channel || "telegram"}`,
      );

      res.json({
        success: true,
        message: "Reminder set",
        questionId: id,
        remindAt: remindTime,
      });
    } catch (error) {
      console.error("[QuestionsAPI] Error setting reminder:", error);
      res.status(500).json({ error: "Failed to set reminder" });
    }
  },
);

/**
 * GET /api/questions/stats
 * Get question statistics
 */
router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getOne<{
      total: number;
      pending: number;
      answered: number;
      skipped: number;
      expired: number;
      blocking: number;
    }>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) as answered,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN blocking = 1 AND status = 'pending' THEN 1 ELSE 0 END) as blocking
      FROM questions
    `);

    res.json(stats);
  } catch (error) {
    console.error("[QuestionsAPI] Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * POST /api/questions/answer-all-defaults (QUE-005)
 * Answer all pending questions that have a default option
 * Returns the count of questions answered
 */
router.post(
  "/answer-all-defaults",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Get all pending questions with default options
      const pendingWithDefaults = await query<QuestionRow>(`
      SELECT * FROM questions
      WHERE status = 'pending' AND default_option IS NOT NULL
      ORDER BY priority DESC, created_at ASC
    `);

      if (pendingWithDefaults.length === 0) {
        res.json({
          success: true,
          answered: 0,
          message: "No pending questions with default options",
        });
        return;
      }

      const answered: string[] = [];
      const now = new Date().toISOString();

      for (const question of pendingWithDefaults) {
        try {
          // Update question status to answered with default
          await run(
            `
          UPDATE questions
          SET status = 'answered',
              answer = ?,
              answered_at = ?,
              used_default = 1
          WHERE id = ?
        `,
            [question.default_option, now, question.id],
          );

          answered.push(question.id);

          // Emit WebSocket event for each answered question
          emitTaskExecutorEvent("question:answered", {
            questionId: question.id,
            answer: question.default_option,
            usedDefault: true,
          });

          // If it was blocking, emit task resumed event
          if (question.blocking) {
            emitTaskExecutorEvent("task:resumed", {
              taskId: question.task_id,
              questionId: question.id,
              reason: "Question answered with default",
            });
          }
        } catch (err) {
          console.error(
            `[QuestionsAPI] Failed to answer question ${question.id}:`,
            err,
          );
          // Continue with other questions
        }
      }

      console.log(
        `[QuestionsAPI] Answered ${answered.length} questions with defaults`,
      );

      res.json({
        success: true,
        answered: answered.length,
        questionIds: answered,
        message: `Answered ${answered.length} question(s) with their default options`,
      });
    } catch (error) {
      console.error("[QuestionsAPI] Error answering all defaults:", error);
      res
        .status(500)
        .json({ error: "Failed to answer questions with defaults" });
    }
  },
);

/**
 * POST /api/questions/expire-old (QUE-004)
 * Expire questions that have passed their expiry time or default timeout
 * Auto-answers with default if available, otherwise marks as expired
 */
router.post(
  "/expire-old",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await expireOldQuestions();
      res.json(result);
    } catch (error) {
      console.error("[QuestionsAPI] Error expiring old questions:", error);
      res.status(500).json({ error: "Failed to expire old questions" });
    }
  },
);

/**
 * Expire old questions - can be called manually or by interval
 */
async function expireOldQuestions(): Promise<{
  expired: number;
  autoAnswered: number;
  expiredIds: string[];
  autoAnsweredIds: string[];
}> {
  const now = new Date();
  const defaultCutoff = new Date(
    now.getTime() - DEFAULT_QUESTION_TIMEOUT_MS,
  ).toISOString();

  // Get pending questions that should be expired
  // Either: expires_at is set and past, OR no expires_at and created > 24h ago
  const expiredQuestions = await query<QuestionRow>(
    `
    SELECT * FROM questions
    WHERE status = 'pending'
    AND (
      (expires_at IS NOT NULL AND expires_at < ?)
      OR (expires_at IS NULL AND created_at < ?)
    )
    ORDER BY created_at ASC
  `,
    [now.toISOString(), defaultCutoff],
  );

  const expiredIds: string[] = [];
  const autoAnsweredIds: string[] = [];
  const nowStr = now.toISOString();

  for (const question of expiredQuestions) {
    try {
      if (question.default_option) {
        // Auto-answer with default
        await run(
          `
          UPDATE questions
          SET status = 'answered',
              answer = ?,
              answered_at = ?,
              used_default = 1
          WHERE id = ?
        `,
          [question.default_option, nowStr, question.id],
        );

        autoAnsweredIds.push(question.id);

        emitTaskExecutorEvent("question:answered", {
          questionId: question.id,
          answer: question.default_option,
          usedDefault: true,
          autoExpired: true,
        });

        if (question.blocking) {
          emitTaskExecutorEvent("task:resumed", {
            taskId: question.task_id,
            questionId: question.id,
            reason: "Question auto-answered on expiry",
          });
        }
      } else {
        // Mark as expired
        await run(
          `
          UPDATE questions
          SET status = 'expired',
              expired_at = ?
          WHERE id = ?
        `,
          [nowStr, question.id],
        );

        expiredIds.push(question.id);

        emitTaskExecutorEvent("question:expired", {
          questionId: question.id,
          reason: "Question timed out without answer",
        });

        // If blocking, the task remains blocked - user needs to handle
        if (question.blocking) {
          console.warn(
            `[QuestionsAPI] Blocking question ${question.id} expired without answer`,
          );
        }
      }
    } catch (err) {
      console.error(
        `[QuestionsAPI] Failed to expire question ${question.id}:`,
        err,
      );
    }
  }

  if (expiredIds.length > 0 || autoAnsweredIds.length > 0) {
    console.log(
      `[QuestionsAPI] Expired ${expiredIds.length}, auto-answered ${autoAnsweredIds.length} questions`,
    );
  }

  return {
    expired: expiredIds.length,
    autoAnswered: autoAnsweredIds.length,
    expiredIds,
    autoAnsweredIds,
  };
}

/**
 * Start the background expiry checker
 */
export function startExpiryChecker(): void {
  if (expiryCheckInterval) {
    console.log("[QuestionsAPI] Expiry checker already running");
    return;
  }

  console.log(
    `[QuestionsAPI] Starting expiry checker (interval: ${EXPIRY_CHECK_INTERVAL_MS}ms)`,
  );

  // Run immediately on start
  expireOldQuestions().catch((err) => {
    console.error("[QuestionsAPI] Initial expiry check failed:", err);
  });

  // Then run periodically
  expiryCheckInterval = setInterval(() => {
    expireOldQuestions().catch((err) => {
      console.error("[QuestionsAPI] Periodic expiry check failed:", err);
    });
  }, EXPIRY_CHECK_INTERVAL_MS);
}

/**
 * Stop the background expiry checker
 */
export function stopExpiryChecker(): void {
  if (expiryCheckInterval) {
    clearInterval(expiryCheckInterval);
    expiryCheckInterval = null;
    console.log("[QuestionsAPI] Expiry checker stopped");
  }
}

export default router;
