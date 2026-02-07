import 'dotenv/config';

// ============ STABILITY LAYER (MUST BE FIRST) ============
import { initStability } from './stability/index.js';
initStability();

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { agentsRouter } from './api/agents.js';
import { tasksRouter } from './api/tasks.js';
import { sessionsRouter } from './api/sessions.js';
import { eventsRouter } from './api/events.js';
import { testsRouter } from './api/tests.js';
import { spawnRouter } from './api/spawn.js';
import { memoryRouter } from './api/memory.js';
import { qaRouter } from './api/qa.js';
import { wavesRouter } from './api/waves.js';
import { clarificationRouter } from './api/clarification.js';
import { configRouter } from './api/config.js';
import { orchestratorRouter } from './api/orchestrator.js';
import { gitRouter } from './api/git.js';
import { budgetRouter } from './api/budget.js';
import { crownRouter } from './api/crown.js';
import { telegramRouter } from './api/telegram.js';
import { webhookRouter } from './api/webhook.js';
import { stabilityRouter } from './api/stability.js';
import { buildHealthRouter } from './api/build-health.js';
import { alertsRouter } from './api/alerts.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

// Import command handlers (registers commands on load)
import './telegram/commands.js';
import { initWebSocket } from './websocket.js';
import { startOrchestrator } from './orchestrator/index.js';
import { initTelegram } from './telegram/index.js';
import { initBuildHealth } from './build-health/index.js';

const app = express();
const PORT = process.env.PORT || 3333;

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket
initWebSocket(server);

// Initialize Telegram (optional)
initTelegram();

// Initialize Build Health monitoring
const CODEBASE_ROOT = process.env.CODEBASE_ROOT || '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';
initBuildHealth(CODEBASE_ROOT);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/agents', agentsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/tests', testsRouter);
app.use('/api/spawn', spawnRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/qa', qaRouter);
app.use('/api/waves', wavesRouter);
app.use('/api/clarifications', clarificationRouter);
app.use('/api/config', configRouter);
app.use('/api/orchestrator', orchestratorRouter);
app.use('/api/git', gitRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/crown', crownRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/stability', stabilityRouter);
app.use('/api/build-health', buildHealthRouter);
app.use('/api/alerts', alertsRouter);
app.use('/webhook', webhookRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Orchestrator API running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);

  // Start orchestration loop
  startOrchestrator();
});

export default app;
