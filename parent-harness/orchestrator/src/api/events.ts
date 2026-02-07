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
  return res.json(event);
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

  return res.status(201).json(event);
});

// Track read notification IDs in memory (simple approach - could move to DB)
const readNotificationIds = new Set<number>();

/**
 * GET /api/events/notifications
 * Get notification-worthy events (warnings and errors from last 24h)
 */
eventsRouter.get('/notifications', (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Get warning and error events
  const warnings = events.getEvents({ severity: 'warning', since, limit: 50 });
  const errors = events.getEvents({ severity: 'error', since, limit: 50 });
  
  // Combine and sort by timestamp desc
  const all = [...warnings, ...errors].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 50);
  
  // Add read status
  const notifications = all.map(e => ({
    id: e.id,
    type: e.type,
    message: e.message,
    severity: e.severity,
    timestamp: e.created_at,
    agentId: e.agent_id,
    taskId: e.task_id,
    read: readNotificationIds.has(e.id),
  }));
  
  res.json({
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
  });
});

/**
 * POST /api/events/notifications/:id/read
 * Mark a notification as read
 */
eventsRouter.post('/notifications/:id/read', (req, res) => {
  const id = parseInt(req.params.id, 10);
  readNotificationIds.add(id);
  res.json({ success: true });
});

/**
 * POST /api/events/notifications/read-all
 * Mark all notifications as read
 */
eventsRouter.post('/notifications/read-all', (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const warnings = events.getEvents({ severity: 'warning', since, limit: 100 });
  const errors = events.getEvents({ severity: 'error', since, limit: 100 });
  
  [...warnings, ...errors].forEach(e => readNotificationIds.add(e.id));
  res.json({ success: true });
});
