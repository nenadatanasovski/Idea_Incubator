import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { Task } from '../api/types';

interface UseTasksResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Task[]>('/api/tasks');
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks };
}

export default useTasks;
