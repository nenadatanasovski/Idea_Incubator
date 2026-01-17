/**
 * Task Status Enum
 *
 * Status values for tasks in the execution pipeline.
 */

export const taskStatuses = [
  "draft",
  "evaluating",
  "pending",
  "in_progress",
  "completed",
  "failed",
  "blocked",
  "skipped",
] as const;

export type TaskStatus = (typeof taskStatuses)[number];
