import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { agentsRouter } from './api/agents.js';
import { tasksRouter } from './api/tasks.js';
import { sessionsRouter } from './api/sessions.js';
import { eventsRouter } from './api/events.js';
import { testsRouter } from './api/tests.js';
import { spawnRouter } from './api/spawn.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { initWebSocket } from './websocket.js';
import { startOrchestrator } from './orchestrator/index.js';

const app = express();
const PORT = process.env.PORT || 3333;

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket
initWebSocket(server);

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
