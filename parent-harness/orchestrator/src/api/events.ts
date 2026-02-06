import { Router } from 'express';
import * as events from '../db/events.js';

export const eventsRouter = Router();

/**
 * GET /api/events
 * List events with optional filters
 */
eventsRouter.get('/', (req, res) => {
  const filters = {
    type: req.query.type as string | undefined,
    agentId: req.query.agentId as string | undefined,
    sessionId: req.query.sessionId as string | undefined,
    taskId: req.query.taskId as string | undefined,
    severity: req.query.severity as events.ObservabilityEvent['severity'] | undefined,
    since: req.query.since as string | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
  };

  const allEvents = events.getEvents(filters);
  res.json(allEvents);
});

/**
 * GET /api/events/:id
 * Get a single event
 */
eventsRouter.get('/:id', (req, res) => {
  const event = events.getEvent(req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found', status: 404 });
  }
  res.json(event);
});

/**
 * POST /api/events
 * Create a new event
 */
eventsRouter.post('/', (req, res) => {
  const { type, message, agentId, sessionId, taskId, severity, metadata } = req.body;

  if (!type || !message) {
    return res.status(400).json({
      error: 'Missing required fields: type, message',
      status: 400,
    });
  }

  const event = events.createEvent({
    type,
    message,
    agentId,
    sessionId,
    taskId,
    severity,
    metadata,
  });

  res.status(201).json(event);
});
