import "dotenv/config";

// ============ STABILITY LAYER (MUST BE FIRST) ============
import { initStability } from "./stability/index.js";
initStability();

// ============ DATABASE MIGRATIONS ============
import {
  getDatabasePath,
  migrate,
  runMaintenanceCheckpointAndBackup,
  verifyDatabaseIntegrity,
} from "./db/index.js";
try {
  migrate();
} catch (err) {
  console.error("❌ Migration failed:", err);
  process.exit(1);
}

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { agentsRouter } from "./api/agents.js";
import { tasksRouter } from "./api/tasks.js";
import { sessionsRouter } from "./api/sessions.js";
import { eventsRouter } from "./api/events.js";
import { testsRouter } from "./api/tests.js";
import { spawnRouter } from "./api/spawn.js";
import { memoryRouter } from "./api/memory.js";
import { qaRouter } from "./api/qa.js";
import { wavesRouter } from "./api/waves.js";
import { clarificationRouter } from "./api/clarification.js";
import { configRouter } from "./api/config.js";
import { orchestratorRouter } from "./api/orchestrator.js";
import { gitRouter } from "./api/git.js";
import { budgetRouter } from "./api/budget.js";
import { crownRouter } from "./api/crown.js";
import { telegramRouter } from "./api/telegram.js";
import { webhookRouter } from "./api/webhook.js";
import { stabilityRouter } from "./api/stability.js";
import { buildHealthRouter } from "./api/build-health.js";
import { alertsRouter } from "./api/alerts.js";
import { eventBusRouter } from "./api/event-bus.js";
import { introspectionRouter } from "./api/introspection.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

// Import command handlers (registers commands on load)
import "./telegram/commands.js";
import { initWebSocket } from "./websocket.js";
import { startOrchestrator } from "./orchestrator/index.js";
import { initTelegram } from "./telegram/index.js";
import { initBuildHealth } from "./build-health/index.js";
import { initEventSystem, getEventSystemStatus } from "./events/index.js";
import { initializeRateLimiter } from "./spawner/rate-limiter.js";
import { getRuntimeMode, isEventMode } from "./runtime/mode.js";
import { validateTelegramConfigOrThrow } from "./telegram/direct-telegram.js";

const runtimeMode = getRuntimeMode();

const app = express();
const PORT = process.env.PORT || 4001;

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket
initWebSocket(server);

// Initialize Telegram (optional)
try {
  validateTelegramConfigOrThrow();
  initTelegram().catch((err) => {
    console.error("❌ Telegram initialization failed:", err);
    console.warn("⚠️  Continuing without Telegram integration");
  });
} catch (err) {
  console.warn(
    "⚠️  Telegram not configured, continuing without Telegram integration",
  );
  console.debug("Telegram config error:", err);
}

// Initialize Build Health monitoring - ONLY check orchestrator, not entire codebase
// Full codebase check was causing 200%+ CPU usage and machine freezes
const ORCHESTRATOR_ROOT = process.env.CODEBASE_ROOT || process.cwd();
initBuildHealth(ORCHESTRATOR_ROOT);

// Initialize per-minute rate limiter from config
// Defaults (35 RPM / 28K TPM / 3 concurrent) are already applied at module load.
// This call updates from user config if available.
initializeRateLimiter().catch((err) => {
  console.error("❌ Rate limiter config initialization failed:", err);
  console.warn(
    "⚠️  Continuing with default rate limits (35 RPM / 28K TPM / 3 concurrent)",
  );
  console.warn(
    "⚠️  Verify your API tier: https://console.anthropic.com/settings/limits",
  );
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/agents", agentsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/tests", testsRouter);
app.use("/api/spawn", spawnRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/qa", qaRouter);
app.use("/api/waves", wavesRouter);
app.use("/api/clarifications", clarificationRouter);
app.use("/api/config", configRouter);
app.use("/api/orchestrator", orchestratorRouter);
app.use("/api/git", gitRouter);
app.use("/api/budget", budgetRouter);
app.use("/api/crown", crownRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/stability", stabilityRouter);
app.use("/api/build-health", buildHealthRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/event-bus", eventBusRouter);
app.use("/api/introspection", introspectionRouter);
app.use("/webhook", webhookRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Event system status endpoint
app.get("/api/events/system", (_req, res) => {
  if (isEventMode(runtimeMode)) {
    res.json(getEventSystemStatus());
  } else {
    res.json({
      enabled: false,
      message: "Event system disabled. Use HARNESS_RUNTIME_MODE=event",
    });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(
    `🚀 Orchestrator API running on http://localhost:${PORT} (pid=${process.pid})`,
  );
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`🗄️ DB Path: ${getDatabasePath()}`);
  console.log(`🎛️ Runtime mode: ${runtimeMode}`);

  // Choose orchestration mode
  if (isEventMode(runtimeMode)) {
    console.log(`⚡ Event-driven architecture: ENABLED`);
    initEventSystem();
    console.log(`⚡ Event system initialized - scanners and services running`);
  } else {
    console.log(`🔄 Legacy tick loop: ENABLED`);
    startOrchestrator();
  }

  // Integrity hardening: periodic quick_check + checkpoint + backup.
  setInterval(
    () => {
      try {
        verifyDatabaseIntegrity();
        const backupPath = runMaintenanceCheckpointAndBackup("periodic");
        console.log(`🛡️ DB maintenance completed: ${backupPath}`);
      } catch (err) {
        console.error("❌ DB maintenance failed:", err);
      }
    },
    30 * 60 * 1000,
  );
});

export default app;
