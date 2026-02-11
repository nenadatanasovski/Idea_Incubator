/**
 * Telegram Message History API Routes
 */
import { Router } from "express";
import * as telegram from "../db/telegram.js";
import {
  getAllBotsStatus,
  setAllWebhooks,
  deleteAllWebhooks,
} from "../telegram/direct-telegram.js";

export const telegramRouter = Router();

/**
 * GET /api/telegram/messages
 * Get telegram messages with filters
 */
telegramRouter.get("/messages", (req, res) => {
  const filters = {
    botType: req.query.botType as string | undefined,
    taskId: req.query.taskId as string | undefined,
    agentId: req.query.agentId as string | undefined,
    direction: req.query.direction as "outgoing" | "incoming" | undefined,
    since: req.query.since as string | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    offset: req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : undefined,
  };

  const messages = telegram.getTelegramMessages(filters);
  res.json(messages);
});

/**
 * GET /api/telegram/channels
 * Get messages grouped by bot/channel
 */
telegramRouter.get("/channels", (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const messages = telegram.getMessagesByChannel(limit);
  res.json(messages);
});

/**
 * GET /api/telegram/stats
 * Get telegram message statistics
 */
telegramRouter.get("/stats", (_req, res) => {
  const stats = telegram.getTelegramStats();
  res.json(stats);
});

/**
 * GET /api/telegram/task/:taskId
 * Get all messages related to a task
 */
telegramRouter.get("/task/:taskId", (req, res) => {
  const messages = telegram.getMessagesForTask(req.params.taskId);
  res.json(messages);
});

/**
 * GET /api/telegram/bots
 * Get status of all Telegram bots (username, webhook info)
 */
telegramRouter.get("/bots", async (_req, res) => {
  try {
    const statuses = await getAllBotsStatus();
    res.json(statuses);
  } catch (err) {
    console.error("Failed to get bot statuses:", err);
    res.status(500).json({ error: "Failed to get bot statuses" });
  }
});

/**
 * POST /api/telegram/webhooks
 * Set webhooks for all bots
 * Body: { baseUrl: "https://example.ngrok.io" }
 */
telegramRouter.post("/webhooks", async (req, res) => {
  const { baseUrl } = req.body;

  if (!baseUrl) {
    res.status(400).json({ error: "baseUrl is required" });
    return;
  }

  try {
    const result = await setAllWebhooks(baseUrl);
    res.json({
      message: "Webhooks configured",
      success: result.success,
      failed: result.failed,
    });
  } catch (err) {
    console.error("Failed to set webhooks:", err);
    res.status(500).json({ error: "Failed to set webhooks" });
  }
});

/**
 * DELETE /api/telegram/webhooks
 * Delete webhooks for all bots (revert to polling)
 */
telegramRouter.delete("/webhooks", async (_req, res) => {
  try {
    await deleteAllWebhooks();
    res.json({ message: "All webhooks deleted" });
  } catch (err) {
    console.error("Failed to delete webhooks:", err);
    res.status(500).json({ error: "Failed to delete webhooks" });
  }
});

export default telegramRouter;
