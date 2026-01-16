/**
 * Shared Route Utilities
 */
import { Request, Response, NextFunction } from "express";

/**
 * API Response wrapper type
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

/**
 * Idea interface for database queries
 */
export interface IdeaRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  idea_type: string;
  lifecycle_stage: string;
  incubation_phase: string | null;
  content: string | null;
  content_hash: string | null;
  folder_path: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * Wrap async route handlers to catch errors
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Send success response
 */
export function respond<T>(res: Response, data: T): void {
  res.json({ success: true, data } as ApiResponse<T>);
}

/**
 * Send error response
 */
export function respondError(
  res: Response,
  statusCode: number,
  message: string,
): void {
  res
    .status(statusCode)
    .json({ success: false, error: message } as ApiResponse<null>);
}
