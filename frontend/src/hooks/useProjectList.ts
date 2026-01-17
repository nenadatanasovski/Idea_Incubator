/**
 * useProjectList Hook
 *
 * Fetches a list of projects with optional filtering.
 */

import { useState, useEffect, useCallback } from "react";
import type { ProjectWithStats, ProjectStatus } from "../../../types/project";

const API_BASE = "http://localhost:3001";

export interface UseProjectListOptions {
  status?: ProjectStatus;
  hasIdea?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export interface UseProjectListReturn {
  projects: ProjectWithStats[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProjectList(
  options: UseProjectListOptions = {},
): UseProjectListReturn {
  const {
    status,
    hasIdea,
    search,
    limit = 50,
    offset = 0,
    enabled = true,
  } = options;

  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append("withStats", "true");
      if (status) params.append("status", status);
      if (hasIdea !== undefined) params.append("hasIdea", String(hasIdea));
      if (search) params.append("search", search);
      if (limit) params.append("limit", String(limit));
      if (offset) params.append("offset", String(offset));

      const response = await fetch(
        `${API_BASE}/api/projects?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }

      const data = await response.json();
      // API returns array directly or wrapped in { success, data }
      const projectList = Array.isArray(data) ? data : data.data || [];
      setProjects(projectList);
      setTotal(data.total || projectList.length || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, status, hasIdea, search, limit, offset]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    total,
    isLoading,
    error,
    refetch: fetchProjects,
  };
}

export default useProjectList;
