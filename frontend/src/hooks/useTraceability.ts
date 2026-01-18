/**
 * useTraceability Hook
 *
 * Fetches traceability data for a project (PRD-to-Task coverage analysis).
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3001";

// Types matching server traceability types
export type TraceabilityLinkType = "implements" | "tests" | "related";

export interface LinkedTask {
  id: string;
  displayId: string;
  title: string;
  status: string;
  linkType: TraceabilityLinkType;
}

export interface SpecItemCoverage {
  index: number;
  content: string;
  linkedTasks: LinkedTask[];
  isCovered: boolean;
}

export interface SpecSectionCoverage {
  sectionType: string;
  sectionTitle: string;
  totalItems: number;
  coveredItems: number;
  coveragePercentage: number;
  items: SpecItemCoverage[];
}

export interface ProjectTraceability {
  projectId: string;
  prdId: string | null;
  prdTitle: string | null;
  sections: SpecSectionCoverage[];
  overallCoverage: number;
  orphanTaskCount: number;
  gapCount: number;
  message?: string;
}

export interface OrphanTask {
  id: string;
  displayId: string;
  title: string;
  status: string;
  category: string;
  createdAt: string;
}

export interface CoverageGap {
  prdId: string;
  prdTitle: string;
  sectionType: string;
  sectionTitle: string;
  itemIndex: number;
  itemContent: string;
  severity: "high" | "medium" | "low";
}

export interface CoverageStats {
  overallCoverage: number;
  coveredRequirements: number;
  totalRequirements: number;
  orphanTaskCount: number;
  gapCount: number;
}

export interface UseTraceabilityOptions {
  projectId: string;
  enabled?: boolean;
}

export interface UseTraceabilityReturn {
  traceability: ProjectTraceability | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTraceability({
  projectId,
  enabled = true,
}: UseTraceabilityOptions): UseTraceabilityReturn {
  const [traceability, setTraceability] = useState<ProjectTraceability | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTraceability = useCallback(async () => {
    if (!enabled || !projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/traceability`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError("Project not found");
          setTraceability(null);
          return;
        }
        throw new Error("Failed to fetch traceability data");
      }

      const data = await response.json();
      setTraceability(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch traceability",
      );
      setTraceability(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    fetchTraceability();
  }, [fetchTraceability]);

  return {
    traceability,
    isLoading,
    error,
    refetch: fetchTraceability,
  };
}

// Hook for fetching orphan tasks
export interface UseOrphanTasksReturn {
  orphanTasks: OrphanTask[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOrphanTasks({
  projectId,
  enabled = true,
}: UseTraceabilityOptions): UseOrphanTasksReturn {
  const [orphanTasks, setOrphanTasks] = useState<OrphanTask[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrphanTasks = useCallback(async () => {
    if (!enabled || !projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/orphan-tasks`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch orphan tasks");
      }

      const data = await response.json();
      setOrphanTasks(data.tasks || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch orphan tasks",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    fetchOrphanTasks();
  }, [fetchOrphanTasks]);

  return {
    orphanTasks,
    totalCount,
    isLoading,
    error,
    refetch: fetchOrphanTasks,
  };
}

// Hook for fetching coverage gaps
export interface UseCoverageGapsReturn {
  gaps: CoverageGap[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCoverageGaps({
  projectId,
  enabled = true,
}: UseTraceabilityOptions): UseCoverageGapsReturn {
  const [gaps, setGaps] = useState<CoverageGap[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGaps = useCallback(async () => {
    if (!enabled || !projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/coverage-gaps`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch coverage gaps");
      }

      const data = await response.json();
      setGaps(data.gaps || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch coverage gaps",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    fetchGaps();
  }, [fetchGaps]);

  return {
    gaps,
    totalCount,
    isLoading,
    error,
    refetch: fetchGaps,
  };
}

// Hook for fetching coverage stats
export interface UseCoverageStatsReturn {
  stats: CoverageStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCoverageStats({
  projectId,
  enabled = true,
}: UseTraceabilityOptions): UseCoverageStatsReturn {
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!enabled || !projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/coverage-stats`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch coverage stats");
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch coverage stats",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}

export default useTraceability;
