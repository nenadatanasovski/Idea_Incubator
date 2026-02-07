import { Router } from 'express';
import * as memory from '../memory/index.js';

export const memoryRouter = Router();

/**
 * GET /api/memory/:agentId
 * Get memory summary for an agent
 */
memoryRouter.get('/:agentId', (req, res) => {
  const summary = memory.getMemorySummary(req.params.agentId);
  res.json(summary);
});

/**
 * GET /api/memory/:agentId/:type
 * Get all memories of a type for an agent
 */
memoryRouter.get('/:agentId/:type', (req, res) => {
  const memories = memory.recallAll(
    req.params.agentId,
    req.params.type as memory.MemoryEntry['type']
  );
  res.json(memories);
});

/**
 * POST /api/memory/:agentId
 * Store a memory
 */
memoryRouter.post('/:agentId', (req, res) => {
  const { type, key, value, metadata, importance, expiresIn } = req.body;

  if (!type || !key || !value) {
    return res.status(400).json({
      error: 'Missing required fields: type, key, value',
      status: 400,
    });
  }

  const entry = memory.remember(req.params.agentId, type, key, value, {
    metadata,
    importance,
    expiresIn,
  });

  return res.status(201).json(entry);
});

/**
 * GET /api/memory/:agentId/:type/:key
 * Recall a specific memory
 */
memoryRouter.get('/:agentId/:type/:key', (req, res) => {
  const entry = memory.recall(
    req.params.agentId,
    req.params.type as memory.MemoryEntry['type'],
    req.params.key
  );

  if (!entry) {
    return res.status(404).json({ error: 'Memory not found', status: 404 });
  }

  res.json(entry);
});

/**
 * DELETE /api/memory/:agentId/:type/:key
 * Forget a specific memory
 */
memoryRouter.delete('/:agentId/:type/:key', (req, res) => {
  const deleted = memory.forget(
    req.params.agentId,
    req.params.type as memory.MemoryEntry['type'],
    req.params.key
  );

  res.json({ success: deleted });
});

/**
 * DELETE /api/memory/:agentId
 * Forget all memories for an agent
 */
memoryRouter.delete('/:agentId', (req, res) => {
  const type = req.query.type as memory.MemoryEntry['type'] | undefined;
  const count = memory.forgetAll(req.params.agentId, type);
  res.json({ success: true, deleted: count });
});

/**
 * POST /api/memory/cleanup
 * Clean up expired memories
 */
memoryRouter.post('/cleanup', (_req, res) => {
  const count = memory.cleanupExpired();
  res.json({ success: true, cleaned: count });
});
