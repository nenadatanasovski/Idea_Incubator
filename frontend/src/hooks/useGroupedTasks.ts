/**
 * useGroupedTasks - Hook for grouping tasks by various criteria
 *
 * Supports grouping by: category, phase, spec_section, parent task
 */

import { useMemo } from "react";
import type { TaskGroupMode } from "../components/projects/TaskGroupSelector";

// Simplified task interface for grouping
interface GroupableTask {
  id: string;
  displayId?: string;
  title: string;
  status: string;
  category?: string;
  phase?: number;
  parentTaskId?: string | null;
  specSection?: string | null;
  isDecomposed?: boolean;
}

export interface TaskGroup {
  key: string;
  label: string;
  tasks: GroupableTask[];
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

interface UseGroupedTasksResult {
  groups: TaskGroup[];
  ungrouped: GroupableTask[];
}

// Category labels
const categoryLabels: Record<string, string> = {
  feature: "Feature",
  bug: "Bug Fix",
  enhancement: "Enhancement",
  refactor: "Refactor",
  documentation: "Documentation",
  test: "Test",
  infrastructure: "Infrastructure",
  research: "Research",
  security: "Security",
  performance: "Performance",
};

// Phase labels
const phaseLabels: Record<number, string> = {
  1: "Phase 1: Database",
  2: "Phase 2: Types",
  3: "Phase 3: API",
  4: "Phase 4: UI",
  5: "Phase 5: Tests",
};

function calculateProgress(tasks: GroupableTask[]) {
  const completed = tasks.filter((t) => t.status === "completed").length;
  return {
    completed,
    total: tasks.length,
    percentage:
      tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
  };
}

function groupByCategory(tasks: GroupableTask[]): TaskGroup[] {
  const groups = new Map<string, GroupableTask[]>();

  for (const task of tasks) {
    const category = task.category || "other";
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(task);
  }

  return Array.from(groups.entries()).map(([key, groupTasks]) => ({
    key,
    label: categoryLabels[key] || key.charAt(0).toUpperCase() + key.slice(1),
    tasks: groupTasks,
    progress: calculateProgress(groupTasks),
  }));
}

function groupByPhase(tasks: GroupableTask[]): TaskGroup[] {
  const groups = new Map<number, GroupableTask[]>();

  for (const task of tasks) {
    const phase = task.phase || 0;
    if (!groups.has(phase)) {
      groups.set(phase, []);
    }
    groups.get(phase)!.push(task);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, groupTasks]) => ({
      key: String(key),
      label: phaseLabels[key] || `Phase ${key}`,
      tasks: groupTasks,
      progress: calculateProgress(groupTasks),
    }));
}

function groupBySpecSection(tasks: GroupableTask[]): TaskGroup[] {
  const groups = new Map<string, GroupableTask[]>();

  for (const task of tasks) {
    const section = task.specSection || "unlinked";
    if (!groups.has(section)) {
      groups.set(section, []);
    }
    groups.get(section)!.push(task);
  }

  // Custom ordering: success_criteria first, then constraints, then unlinked
  const sectionOrder: Record<string, number> = {
    success_criteria: 0,
    constraints: 1,
    unlinked: 99,
  };

  return Array.from(groups.entries())
    .sort(([a], [b]) => (sectionOrder[a] ?? 50) - (sectionOrder[b] ?? 50))
    .map(([key, groupTasks]) => ({
      key,
      label:
        key === "success_criteria"
          ? "Success Criteria"
          : key === "constraints"
            ? "Constraints"
            : key === "unlinked"
              ? "Unlinked Tasks"
              : key,
      tasks: groupTasks,
      progress: calculateProgress(groupTasks),
    }));
}

function groupByParent(tasks: GroupableTask[]): TaskGroup[] {
  // Build parent-child relationships
  const rootTasks: GroupableTask[] = [];
  const childTasksByParent = new Map<string, GroupableTask[]>();

  for (const task of tasks) {
    if (task.parentTaskId) {
      if (!childTasksByParent.has(task.parentTaskId)) {
        childTasksByParent.set(task.parentTaskId, []);
      }
      childTasksByParent.get(task.parentTaskId)!.push(task);
    } else {
      rootTasks.push(task);
    }
  }

  // Create groups from parent tasks that have children
  const groups: TaskGroup[] = [];

  for (const task of rootTasks) {
    const children = childTasksByParent.get(task.id);
    if (children && children.length > 0) {
      groups.push({
        key: task.id,
        label: task.title,
        tasks: [task, ...children],
        progress: calculateProgress([task, ...children]),
      });
    }
  }

  return groups;
}

export function useGroupedTasks(
  tasks: GroupableTask[],
  groupBy: TaskGroupMode,
): UseGroupedTasksResult {
  return useMemo(() => {
    if (groupBy === "none" || !tasks.length) {
      return { groups: [], ungrouped: tasks };
    }

    let groups: TaskGroup[];
    let ungrouped: GroupableTask[] = [];

    switch (groupBy) {
      case "category":
        groups = groupByCategory(tasks);
        break;
      case "phase":
        groups = groupByPhase(tasks);
        break;
      case "spec_section":
        groups = groupBySpecSection(tasks);
        // In spec_section mode, "unlinked" tasks are part of a group, not ungrouped
        break;
      case "parent":
        groups = groupByParent(tasks);
        // Find tasks that are not in any group (standalone tasks without parents or children)
        const tasksInGroups = new Set(
          groups.flatMap((g) => g.tasks.map((t) => t.id)),
        );
        ungrouped = tasks.filter((t) => !tasksInGroups.has(t.id));
        break;
      default:
        groups = [];
        ungrouped = tasks;
    }

    return { groups, ungrouped };
  }, [tasks, groupBy]);
}

export default useGroupedTasks;
