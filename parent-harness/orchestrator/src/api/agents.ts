import { Router } from 'express';
import * as agents from '../db/agents.js';
import { getAgentMetadata, getAllAgentMetadata } from '../agents/metadata.js';

export const agentsRouter = Router();

/**
 * GET /api/agents/metadata
 * Get metadata for all agent types (roles, tools, telegram config)
 */
agentsRouter.get('/metadata', (_req, res) => {
  const metadata = getAllAgentMetadata();
  res.json(metadata);
});

/**
 * GET /api/agents/metadata/:id
 * Get metadata for a specific agent type
 */
agentsRouter.get('/metadata/:id', (req, res) => {
  const metadata = getAgentMetadata(req.params.id);
  if (!metadata) {
    return res.status(404).json({ error: 'Agent metadata not found', status: 404 });
  }
  return res.json(metadata);
});

/**
 * GET /api/agents/detailed
 * Get all agents with their metadata merged
 */
agentsRouter.get('/detailed', (_req, res) => {
  const allAgents = agents.getAgents();
  const detailed = allAgents.map(agent => {
    const metadata = getAgentMetadata(agent.type) || getAgentMetadata(agent.id);
    return {
      ...agent,
      metadata: metadata || null,
    };
  });
  res.json(detailed);
});

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
  return res.json(agent);
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
  return res.json(updated);
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
  return res.json({ success: true });
});
