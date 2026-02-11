import type { Task } from "../db/tasks.js";

export function isTestLikeTask(
  task: Pick<Task, "category" | "display_id">,
): boolean {
  const displayId = (task.display_id || "").toLowerCase();
  return (
    task.category === "test" ||
    displayId.startsWith("test_") ||
    displayId.startsWith("concurrent_")
  );
}

/**
 * Production assignment predicate used by BOTH legacy and event assignment paths.
 */
export function isRunnableProductionTask(
  task: Pick<Task, "category" | "display_id">,
): boolean {
  return !isTestLikeTask(task);
}
