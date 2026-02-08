/**
 * API Call Counter Middleware
 * Records all API calls for usage monitoring and emits platform events
 */
import { Request, Response, NextFunction } from "express";
import { recordApiCall } from "../../database/db.js";
import { eventService } from "../services/event-service.js";
import { requestCounterService } from "../services/request-counter.js";

// Endpoints that should emit events (excludes high-frequency/read-only endpoints)
const EVENT_WORTHY_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const EXCLUDED_PATHS = [
  "/api/events", // Don't log event queries
  "/api/agents/heartbeat", // High frequency
  "/api/observability", // Internal
];

/**
 * Middleware that logs all /api/* requests
 * Uses res.on('finish') to capture response details after completion
 */
export function apiCounter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const endpoint = req.path;
  const method = req.method;
  const userId = (req as any).user?.id ?? null;

  // Increment request counter for every API request
  requestCounterService.increment();

  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    // Fire-and-forget - don't await
    recordApiCall(userId, endpoint, method, res.statusCode, responseTime);

    // Emit platform event for significant API calls
    const shouldEmitEvent =
      EVENT_WORTHY_METHODS.includes(method) &&
      !EXCLUDED_PATHS.some((p) => endpoint.startsWith(p)) &&
      res.statusCode < 500; // Don't log server errors as api_request

    if (shouldEmitEvent) {
      const severity =
        res.statusCode >= 400
          ? "warning"
          : res.statusCode >= 200 && res.statusCode < 300
            ? "info"
            : "info";

      eventService
        .emitEvent({
          type: "api_request",
          source: "api",
          severity,
          payload: {
            method,
            endpoint,
            statusCode: res.statusCode,
            responseTimeMs: responseTime,
          },
          userId: userId || undefined,
        })
        .catch(() => {
          // Silently ignore event emission errors to not affect API
        });
    }
  });

  next();
}
