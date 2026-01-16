/**
 * API Call Counter Middleware
 * Records all API calls for usage monitoring
 */
import { Request, Response, NextFunction } from "express";
import { recordApiCall } from "../../database/db.js";

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

  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    // Fire-and-forget - don't await
    recordApiCall(userId, endpoint, method, res.statusCode, responseTime);
  });

  next();
}
