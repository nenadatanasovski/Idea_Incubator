/**
 * useProject Hook
 *
 * Fetches a single project with stats by slug or ID.
 */

import { useState, useEffect, useCallback } from "react";
import type { ProjectWithStats } from "../../../types/project";

const API_BASE = "http://localhost:3001";

export interface UseProjectOptions {
  slug: string;
  withStats?: boolean;
  enabled?: boolean;
}

export interface UseProjectReturn {
  project: ProjectWithStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProject({
  slug,
  withStats = true,
  enabled = true,
}: UseProjectOptions): UseProjectReturn {
  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!enabled || !slug) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = withStats ? "?withStats=true" : "";
      const response = await fetch(`${API_BASE}/api/projects/${slug}${params}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("Project not found");
          setProject(null);
          return;
        }
        throw new Error("Failed to fetch project");
      }

      const data = await response.json();
      // API returns project directly or wrapped in { success, data }
      const projectData = data.success ? data.data : data;
      // Check if it looks like a project (has id and slug)
      if (projectData && projectData.id && projectData.slug) {
        setProject(projectData);
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("Invalid project data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch project");
      setProject(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, slug, withStats]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return {
    project,
    isLoading,
    error,
    refetch: fetchProject,
  };
}

export default useProject;
