/**
 * Task List Status Enum
 */

export const taskListStatuses = [
  "draft",
  "ready",
  "in_progress",
  "paused",
  "completed",
  "archived",
] as const;

export type TaskListStatus = (typeof taskListStatuses)[number];
