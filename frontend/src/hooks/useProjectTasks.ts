/**
 * useProjectTasks Hook
 *
 * Fetches tasks for a specific project.
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3001";

export interface Task {
  id: string;
  displayId: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "complete" | "failed" | "blocked";
  priority: number;
  taskListId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskList {
  id: string;
  name: string;
  description?: string;
  status: string;
  projectId?: string;
  taskCount: number;
  completedCount: number;
}

export interface TaskSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  blocked: number;
}

export interface UseProjectTasksReturn {
  tasks: Task[];
  taskLists: TaskList[];
  summary: TaskSummary;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProjectTasks(
  projectId: string | undefined,
): UseProjectTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [summary, setSummary] = useState<TaskSummary>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch tasks and task lists in parallel
      const [tasksRes, listsRes] = await Promise.all([
        fetch(`${API_BASE}/api/task-agent/tasks?projectId=${projectId}`),
        fetch(`${API_BASE}/api/task-agent/task-lists?projectId=${projectId}`),
      ]);

      if (!tasksRes.ok || !listsRes.ok) {
        throw new Error("Failed to fetch project tasks");
      }

      const [tasksData, listsData] = await Promise.all([
        tasksRes.json(),
        listsRes.json(),
      ]);

      const fetchedTasks: Task[] = tasksData.success
        ? tasksData.data || []
        : [];
      const fetchedLists: TaskList[] = listsData.success
        ? listsData.data || []
        : [];

      setTasks(fetchedTasks);
      setTaskLists(fetchedLists);

      // Calculate summary
      const taskSummary: TaskSummary = {
        total: fetchedTasks.length,
        pending: fetchedTasks.filter((t) => t.status === "pending").length,
        inProgress: fetchedTasks.filter((t) => t.status === "in_progress")
          .length,
        completed: fetchedTasks.filter((t) => t.status === "complete").length,
        failed: fetchedTasks.filter((t) => t.status === "failed").length,
        blocked: fetchedTasks.filter((t) => t.status === "blocked").length,
      };
      setSummary(taskSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tasks");
      setTasks([]);
      setTaskLists([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    taskLists,
    summary,
    isLoading,
    error,
    refetch: fetchTasks,
  };
}

export default useProjectTasks;
