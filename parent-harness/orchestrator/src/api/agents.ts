import { Router } from 'express';
import * as agents from '../db/agents.js';

export const agentsRouter = Router();

/**
 * GET /api/agents
 * List all agents
 */
agentsRouter.get('/', (_req, res) => {
  const allAgents = agents.getAgents();
  res.json(allAgents);
});

/**
 * GET /api/agents/:id
 * Get a single agent
 */
agentsRouter.get('/:id', (req, res) => {
  const agent = agents.getAgent(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found', status: 404 });
  }
  res.json(agent);
});

/**
 * PATCH /api/agents/:id
 * Update agent (status, etc.)
 */
agentsRouter.patch('/:id', (req, res) => {
  const agent = agents.getAgent(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found', status: 404 });
  }

  const { status, currentTaskId, currentSessionId } = req.body;

  if (status) {
    agents.updateAgentStatus(req.params.id, status, currentTaskId, currentSessionId);
  }

  const updated = agents.getAgent(req.params.id);
  res.json(updated);
});

/**
 * POST /api/agents/:id/heartbeat
 * Update agent heartbeat
 */
agentsRouter.post('/:id/heartbeat', (req, res) => {
  const agent = agents.getAgent(req.params.id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found', status: 404 });
  }

  agents.updateHeartbeat(req.params.id);
  res.json({ success: true });
});
