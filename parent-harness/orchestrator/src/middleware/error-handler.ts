import type { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
  status?: number;
}

/**
 * Handle 404 Not Found
 */
export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const error: ApiError = new Error("Not found");
  error.status = 404;
  next(error);
}

/**
 * Global error handler
 */
export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status || 500;
  const message = err.message || "Internal server error";

  console.error(`[ERROR] ${status}: ${message}`);
  if (status === 500) {
    console.error(err.stack);
  }

  res.status(status).json({
    error: message,
    status,
  });
}
