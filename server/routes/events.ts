/**
 * Platform Events API Routes
 *
 * Exposes platform-wide events for real-time monitoring and analysis.
 */

import { Router, Request, Response } from "express";
import {
  eventService,
  type EventFilters,
  type EventSeverity,
  type EventSource,
} from "../services/event-service.js";

const router = Router();

/**
 * GET /api/events
 * List events with filtering and pagination.
 *
 * Query params:
 * - source: comma-separated list of sources
 * - eventType: comma-separated list of event types
 * - severity: comma-separated list of severities
 * - projectId: filter by project
 * - taskId: filter by task
 * - executionId: filter by execution
 * - ideaId: filter by idea
 * - sessionId: filter by session
 * - userId: filter by user
 * - correlationId: filter by correlation
 * - fromTimestamp: ISO timestamp (start of range)
 * - toTimestamp: ISO timestamp (end of range)
 * - search: text search in event_type, payload, source
 * - limit: max results (default 100)
 * - offset: pagination offset (default 0)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const filters: EventFilters = {};

    // Parse array filters
    if (req.query.source) {
      filters.source = (req.query.source as string).split(",") as EventSource[];
    }

    if (req.query.eventType) {
      filters.eventType = (req.query.eventType as string).split(",");
    }

    if (req.query.severity) {
      filters.severity = (req.query.severity as string).split(
        ",",
      ) as EventSeverity[];
    }

    // Parse single-value filters
    if (req.query.projectId) {
      filters.projectId = req.query.projectId as string;
    }

    if (req.query.taskId) {
      filters.taskId = req.query.taskId as string;
    }

    if (req.query.executionId) {
      filters.executionId = req.query.executionId as string;
    }

    if (req.query.ideaId) {
      filters.ideaId = req.query.ideaId as string;
    }

    if (req.query.sessionId) {
      filters.sessionId = req.query.sessionId as string;
    }

    if (req.query.userId) {
      filters.userId = req.query.userId as string;
    }

    if (req.query.correlationId) {
      filters.correlationId = req.query.correlationId as string;
    }

    // Parse time range
    if (req.query.fromTimestamp) {
      filters.fromTimestamp = req.query.fromTimestamp as string;
    }

    if (req.query.toTimestamp) {
      filters.toTimestamp = req.query.toTimestamp as string;
    }

    // Parse search
    if (req.query.search) {
      filters.search = req.query.search as string;
    }

    // Parse pagination
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await eventService.getEvents(filters, limit, offset);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Failed to fetch events:", error);
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
});

/**
 * GET /api/events/stats
 * Get event statistics.
 *
 * Query params:
 * - executionId: optional filter by execution
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const filters = req.query.executionId
      ? { executionId: req.query.executionId as string }
      : undefined;

    const stats = await eventService.getEventStats(filters);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Failed to fetch event stats:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch event stats" });
  }
});

/**
 * GET /api/events/buffered
 * Get buffered events for real-time catch-up.
 */
router.get("/buffered", async (_req: Request, res: Response) => {
  try {
    const events = eventService.getBufferedEvents();

    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    console.error("Failed to fetch buffered events:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch buffered events" });
  }
});

/**
 * GET /api/events/correlated/:correlationId
 * Get all events with a specific correlation ID.
 */
router.get(
  "/correlated/:correlationId",
  async (req: Request, res: Response) => {
    try {
      const { correlationId } = req.params;

      const events = await eventService.getCorrelatedEvents(correlationId);

      if (events.length === 0) {
        res.status(404).json({
          success: false,
          error: "No events found for this correlation ID",
        });
        return;
      }

      // Calculate timeline info
      const firstTimestamp = events[0].timestamp;
      const lastTimestamp = events[events.length - 1].timestamp;
      const durationMs =
        new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();

      res.json({
        success: true,
        data: {
          correlationId,
          events,
          timeline: {
            first: firstTimestamp,
            last: lastTimestamp,
            durationMs,
          },
          eventCount: events.length,
        },
      });
    } catch (error) {
      console.error("Failed to fetch correlated events:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch correlated events" });
    }
  },
);

/**
 * GET /api/events/:id
 * Get a single event by ID.
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const event = await eventService.getEventById(id);

    if (!event) {
      res.status(404).json({ success: false, error: "Event not found" });
      return;
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Failed to fetch event:", error);
    res.status(500).json({ success: false, error: "Failed to fetch event" });
  }
});

/**
 * POST /api/events
 * Emit a new platform event (for internal use).
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      type,
      source,
      payload,
      correlationId,
      taskId,
      executionId,
      projectId,
      ideaId,
      sessionId,
      userId,
      severity,
    } = req.body;

    if (!type || !source) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: type, source",
      });
      return;
    }

    const eventId = await eventService.emitEvent({
      type,
      source,
      payload,
      correlationId,
      taskId,
      executionId,
      projectId,
      ideaId,
      sessionId,
      userId,
      severity,
    });

    res.status(201).json({
      success: true,
      data: { id: eventId },
    });
  } catch (error) {
    console.error("Failed to emit event:", error);
    res.status(500).json({ success: false, error: "Failed to emit event" });
  }
});

/**
 * GET /api/events/types/list
 * Get list of distinct event types.
 */
router.get("/types/list", async (_req: Request, res: Response) => {
  try {
    const { query: dbQuery } = await import("../../database/db.js");

    const rows = await dbQuery<{ event_type: string; count: number }>(
      `SELECT event_type, COUNT(*) as count
       FROM events
       GROUP BY event_type
       ORDER BY count DESC`,
      [],
    );

    res.json({
      success: true,
      data: rows.map((r) => ({ type: r.event_type, count: r.count })),
    });
  } catch (error) {
    console.error("Failed to fetch event types:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch event types" });
  }
});

/**
 * GET /api/events/sources/list
 * Get list of distinct event sources.
 */
router.get("/sources/list", async (_req: Request, res: Response) => {
  try {
    const { query: dbQuery } = await import("../../database/db.js");

    const rows = await dbQuery<{ source: string; count: number }>(
      `SELECT source, COUNT(*) as count
       FROM events
       GROUP BY source
       ORDER BY count DESC`,
      [],
    );

    res.json({
      success: true,
      data: rows.map((r) => ({ source: r.source, count: r.count })),
    });
  } catch (error) {
    console.error("Failed to fetch event sources:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch event sources" });
  }
});

export default router;
