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

// Hook for fetching all task links for a PRD (batched)
export interface PrdTaskLink {
  id: string;
  prdId: string;
  taskId: string;
  requirementRef: string;
  linkType: TraceabilityLinkType;
  displayId?: string;
  title?: string;
  status?: string;
}

export interface UsePrdCoverageReturn {
  linksByRef: Map<string, LinkedTask[]>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches all task links for a PRD in a single request.
 * Returns a Map keyed by requirement ref for O(1) lookups.
 */
export function usePrdCoverage(prdId: string | null): UsePrdCoverageReturn {
  const [linksByRef, setLinksByRef] = useState<Map<string, LinkedTask[]>>(
    new Map(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCoverage = useCallback(async () => {
    if (!prdId) {
      setLinksByRef(new Map());
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all links and task details in one call
      const response = await fetch(`${API_BASE}/api/prd-tasks/by-prd/${prdId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch PRD coverage");
      }

      const links: PrdTaskLink[] = await response.json();

      // Fetch task details for all linked tasks
      const taskIds = [...new Set(links.map((l) => l.taskId))];
      const taskDetailsMap = new Map<
        string,
        { displayId: string; title: string; status: string }
      >();

      if (taskIds.length > 0) {
        // Batch fetch task details
        const tasksResponse = await fetch(
          `${API_BASE}/api/task-agent/tasks?ids=${taskIds.join(",")}`,
        );
        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          for (const task of tasksData.tasks || tasksData || []) {
            taskDetailsMap.set(task.id, {
              displayId: task.displayId || task.display_id || task.id,
              title: task.title || "Untitled",
              status: task.status || "pending",
            });
          }
        }
      }

      // Group links by requirement ref
      const grouped = new Map<string, LinkedTask[]>();
      for (const link of links) {
        if (!link.requirementRef) continue;

        const ref = link.requirementRef;
        if (!grouped.has(ref)) {
          grouped.set(ref, []);
        }

        const taskDetails = taskDetailsMap.get(link.taskId);
        grouped.get(ref)!.push({
          id: link.taskId,
          displayId: taskDetails?.displayId || link.taskId,
          title: taskDetails?.title || "Untitled",
          status: taskDetails?.status || "pending",
          linkType: link.linkType,
        });
      }

      setLinksByRef(grouped);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch PRD coverage",
      );
      setLinksByRef(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [prdId]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  return {
    linksByRef,
    isLoading,
    error,
    refetch: fetchCoverage,
  };
}

// ============================================
// Hierarchy Hook
// ============================================

export interface TraceabilityHierarchy {
  projectId: string;
  prdId: string;
  prdTitle: string;
  root: HierarchyNode;
  stats: {
    totalRequirements: number;
    coveredRequirements: number;
    totalTasks: number;
    orphanTasks: number;
  };
}

export interface HierarchyNodeMetadata {
  taskCount?: number;
  coveredCount?: number;
  displayId?: string;
  taskListId?: string;
  requirementRef?: string;
}

export interface HierarchyNode {
  id: string;
  type: "prd" | "section" | "requirement" | "task_list" | "task";
  label: string;
  status?: string;
  coverage?: number;
  isCovered?: boolean;
  linkType?: TraceabilityLinkType;
  children: HierarchyNode[];
  metadata?: HierarchyNodeMetadata;
}

export interface UseTraceabilityHierarchyReturn {
  hierarchy: TraceabilityHierarchy | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTraceabilityHierarchy({
  projectId,
  enabled = true,
}: UseTraceabilityOptions): UseTraceabilityHierarchyReturn {
  const [hierarchy, setHierarchy] = useState<TraceabilityHierarchy | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHierarchy = useCallback(async () => {
    if (!enabled || !projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/traceability/hierarchy`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError("Project or PRD not found");
          setHierarchy(null);
          return;
        }
        throw new Error("Failed to fetch hierarchy");
      }

      const data = await response.json();
      setHierarchy(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch hierarchy",
      );
      setHierarchy(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  return {
    hierarchy,
    isLoading,
    error,
    refetch: fetchHierarchy,
  };
}

export default useTraceability;
