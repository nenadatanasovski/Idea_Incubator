import type { Task } from "../api/types";
import type { Wave, Lane } from "../types/pipeline";

const PRIORITY_TO_WAVE: Record<string, number> = {
  P0: 1,
  P1: 2,
  P2: 3,
  P3: 4,
  P4: 5,
};

const CATEGORY_TO_LANE: Record<string, string> = {
  feature: "api",
  bug: "types",
  documentation: "ui",
  test: "tests",
  infrastructure: "infrastructure",
};

export function generateWavesFromTasks(tasks: Task[]): Wave[] {
  const waveMap = new Map<
    number,
    { total: number; completed: number; running: number; blocked: number }
  >();

  tasks.forEach((task) => {
    const waveNum = PRIORITY_TO_WAVE[task.priority] || 3;
    const existing = waveMap.get(waveNum) || {
      total: 0,
      completed: 0,
      running: 0,
      blocked: 0,
    };
    existing.total++;
    if (task.status === "completed") existing.completed++;
    if (task.status === "in_progress") existing.running++;
    if (task.status === "blocked") existing.blocked++;
    waveMap.set(waveNum, existing);
  });

  return Array.from(waveMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([waveNum, stats]) => ({
      id: `wave-${waveNum}`,
      waveNumber: waveNum,
      status:
        stats.completed === stats.total
          ? ("complete" as const)
          : stats.running > 0
            ? ("active" as const)
            : ("pending" as const),
      tasksTotal: stats.total,
      tasksCompleted: stats.completed,
      tasksRunning: stats.running,
      tasksBlocked: stats.blocked,
      actualParallelism: stats.running,
    }));
}

export function generateLanesFromTasks(tasks: Task[]): Lane[] {
  const laneMap = new Map<
    string,
    { name: string; category: string; tasks: Task[] }
  >();

  tasks.forEach((task) => {
    const category = CATEGORY_TO_LANE[task.category || "feature"] || "api";
    const existing = laneMap.get(category) || {
      name: category.charAt(0).toUpperCase() + category.slice(1),
      category,
      tasks: [],
    };
    existing.tasks.push(task);
    laneMap.set(category, existing);
  });

  return Array.from(laneMap.entries()).map(([id, lane]) => ({
    id,
    name: lane.name,
    category: lane.category as Lane["category"],
    status: lane.tasks.every((t) => t.status === "completed")
      ? ("complete" as const)
      : lane.tasks.some((t) => t.status === "blocked")
        ? ("blocked" as const)
        : lane.tasks.some((t) => t.status === "in_progress")
          ? ("active" as const)
          : ("pending" as const),
    tasksTotal: lane.tasks.length,
    tasksCompleted: lane.tasks.filter((t) => t.status === "completed").length,
    tasks: lane.tasks.map((t) => ({
      taskId: t.id,
      displayId: t.display_id,
      title: t.title,
      waveNumber: PRIORITY_TO_WAVE[t.priority] || 3,
      status:
        t.status === "in_progress"
          ? ("running" as const)
          : t.status === "completed"
            ? ("complete" as const)
            : t.status === "failed"
              ? ("failed" as const)
              : t.status === "blocked"
                ? ("blocked" as const)
                : ("pending" as const),
      agentId: t.assigned_agent_id ?? undefined,
      agentName: t.assigned_agent_id ?? undefined,
    })),
  }));
}
