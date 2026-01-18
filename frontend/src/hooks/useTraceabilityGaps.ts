/**
 * useTraceabilityGaps - Hook for gap analysis state management
 */

import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3001";

export interface TraceabilityGap {
  id: string;
  projectId: string;
  gapType: "uncovered" | "weak_coverage" | "orphan" | "mismatch";
  entityType: "requirement" | "task";
  entityRef: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  suggestions: string[];
  status: "open" | "resolved" | "ignored";
  createdAt: string;
  updatedAt: string;
}

export interface GapCounts {
  open: number;
  resolved: number;
  ignored: number;
}

export interface UseTraceabilityGapsReturn {
  gaps: TraceabilityGap[];
  counts: GapCounts;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  runAnalysis: () => Promise<void>;
  getSuggestions: (gapId: string) => Promise<string[]>;
  resolveGap: (gapId: string) => Promise<void>;
  ignoreGap: (gapId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useTraceabilityGaps(
  projectId: string,
): UseTraceabilityGapsReturn {
  const [gaps, setGaps] = useState<TraceabilityGap[]>([]);
  const [counts, setCounts] = useState<GapCounts>({
    open: 0,
    resolved: 0,
    ignored: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGaps = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/traceability/gaps`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch gaps");
      }

      const data = await response.json();
      setGaps(data.gaps || []);
      setCounts(data.counts || { open: 0, resolved: 0, ignored: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch gaps");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const runAnalysis = useCallback(async () => {
    if (!projectId) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/traceability/analyze`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error("Failed to run analysis");
      }

      const data = await response.json();
      setGaps(data.gaps || []);
      setCounts(data.counts || { open: 0, resolved: 0, ignored: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run analysis");
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId]);

  const getSuggestions = useCallback(
    async (gapId: string): Promise<string[]> => {
      try {
        const response = await fetch(
          `${API_BASE}/api/projects/${projectId}/traceability/gaps/${gapId}/suggestions`,
          { method: "POST" },
        );

        if (!response.ok) {
          throw new Error("Failed to get suggestions");
        }

        const data = await response.json();

        // Update local state with suggestions
        setGaps((prev) =>
          prev.map((g) =>
            g.id === gapId ? { ...g, suggestions: data.suggestions } : g,
          ),
        );

        return data.suggestions || [];
      } catch (err) {
        console.error("Error getting suggestions:", err);
        return [];
      }
    },
    [projectId],
  );

  const resolveGap = useCallback(
    async (gapId: string) => {
      try {
        await fetch(
          `${API_BASE}/api/projects/${projectId}/traceability/gaps/${gapId}/resolve`,
          { method: "PUT" },
        );

        // Update local state
        setGaps((prev) =>
          prev.map((g) =>
            g.id === gapId ? { ...g, status: "resolved" as const } : g,
          ),
        );
        setCounts((prev) => ({
          ...prev,
          open: prev.open - 1,
          resolved: prev.resolved + 1,
        }));
      } catch (err) {
        console.error("Error resolving gap:", err);
      }
    },
    [projectId],
  );

  const ignoreGap = useCallback(
    async (gapId: string) => {
      try {
        await fetch(
          `${API_BASE}/api/projects/${projectId}/traceability/gaps/${gapId}/ignore`,
          { method: "PUT" },
        );

        // Update local state
        setGaps((prev) =>
          prev.map((g) =>
            g.id === gapId ? { ...g, status: "ignored" as const } : g,
          ),
        );
        setCounts((prev) => ({
          ...prev,
          open: prev.open - 1,
          ignored: prev.ignored + 1,
        }));
      } catch (err) {
        console.error("Error ignoring gap:", err);
      }
    },
    [projectId],
  );

  // Initial fetch
  useEffect(() => {
    fetchGaps();
  }, [fetchGaps]);

  return {
    gaps,
    counts,
    isLoading,
    isAnalyzing,
    error,
    runAnalysis,
    getSuggestions,
    resolveGap,
    ignoreGap,
    refetch: fetchGaps,
  };
}

export default useTraceabilityGaps;
