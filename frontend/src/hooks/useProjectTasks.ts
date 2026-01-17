/**
 * useProjectTasks Hook
 *
 * Fetches tasks for a specific project using the pipeline API.
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3001";

export interface Task {
  id: string;
  displayId: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "complete" | "failed" | "blocked";
  priority?: number;
  taskListId?: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskList {
  id: string;
  name: string;
  description?: string;
  status: string;
  projectId?: string;
  taskCount: number;
  completedCount?: number;
}

export interface TaskSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  blocked: number;
}

// Pipeline API response types
interface LaneTask {
  id: string;
  taskId: string;
  displayId?: string;
  title: string;
  status: string;
}

interface Lane {
  id: string;
  name: string;
  tasks: LaneTask[];
}

interface PipelineStatus {
  lanes: Lane[];
  totalTasks: number;
  completedTasks: number;
}

interface TaskListResponse {
  id: string;
  name: string;
  projectId?: string;
  taskCount: number;
  status: string;
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
      // Fetch pipeline status and task lists in parallel
      const [statusRes, listsRes] = await Promise.all([
        fetch(`${API_BASE}/api/pipeline/status?projectId=${projectId}`),
        fetch(`${API_BASE}/api/pipeline/task-lists?projectId=${projectId}`),
      ]);

      if (!statusRes.ok) {
        throw new Error("Failed to fetch pipeline status");
      }

      const statusData: PipelineStatus = await statusRes.json();
      const listsData: TaskListResponse[] = listsRes.ok
        ? await listsRes.json()
        : [];

      // Extract tasks from lanes
      const extractedTasks: Task[] = [];
      for (const lane of statusData.lanes || []) {
        for (const laneTask of lane.tasks || []) {
          // Map lane task status to our status type
          let status: Task["status"] = "pending";
          if (
            laneTask.status === "completed" ||
            laneTask.status === "complete"
          ) {
            status = "complete";
          } else if (
            laneTask.status === "in_progress" ||
            laneTask.status === "running"
          ) {
            status = "in_progress";
          } else if (laneTask.status === "failed") {
            status = "failed";
          } else if (laneTask.status === "blocked") {
            status = "blocked";
          }

          extractedTasks.push({
            id: laneTask.taskId,
            displayId: laneTask.displayId || laneTask.taskId,
            title: laneTask.title,
            status,
          });
        }
      }

      // Map task lists
      const mappedLists: TaskList[] = (
        Array.isArray(listsData) ? listsData : []
      ).map((list) => ({
        id: list.id,
        name: list.name,
        status: list.status,
        projectId: list.projectId,
        taskCount: list.taskCount || 0,
        completedCount: 0, // Not available from this endpoint
      }));

      setTasks(extractedTasks);
      setTaskLists(mappedLists);

      // Calculate summary
      const taskSummary: TaskSummary = {
        total: extractedTasks.length,
        pending: extractedTasks.filter((t) => t.status === "pending").length,
        inProgress: extractedTasks.filter((t) => t.status === "in_progress")
          .length,
        completed: extractedTasks.filter((t) => t.status === "complete").length,
        failed: extractedTasks.filter((t) => t.status === "failed").length,
        blocked: extractedTasks.filter((t) => t.status === "blocked").length,
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
