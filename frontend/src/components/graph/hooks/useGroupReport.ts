/**
 * useGroupReport Hook
 *
 * Fetches the group report for a specific node from the API.
 */

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export interface NodeSummaryItem {
  nodeId: string;
  title: string;
  oneLiner: string;
}

export interface GroupRelationship {
  groupHash: string;
  groupName: string;
  relationship: string;
}

export interface GroupReport {
  id: string;
  sessionId: string;
  nodeIds: string[];
  groupHash: string;
  groupName: string | null;
  overview: string | null;
  keyThemes: string[];
  story: string | null;
  relationshipsToGroups: GroupRelationship[];
  openQuestions: string[];
  nodesSummary: NodeSummaryItem[];
  status: "current" | "stale";
  nodeCount: number;
  edgeCount: number;
  generatedAt: string;
  generationDurationMs: number | null;
  modelUsed: string | null;
}

export interface UseGroupReportOptions {
  sessionId: string;
  nodeId: string;
  /** Optional refresh trigger - when this changes, the hook will re-fetch */
  refreshTrigger?: number;
}

export interface UseGroupReportReturn {
  report: GroupReport | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  refresh: () => Promise<void>;
  regenerate: () => Promise<boolean>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGroupReport(
  options: UseGroupReportOptions,
): UseGroupReportReturn {
  const { sessionId, nodeId, refreshTrigger } = options;

  const [report, setReport] = useState<GroupReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch report for node
  const refresh = useCallback(async () => {
    if (!sessionId || !nodeId) {
      setReport(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ideation/session/${sessionId}/reports/for-node/${nodeId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch report");
      }

      const data = await response.json();

      if (data.success) {
        setReport(data.report);
      } else {
        setError(data.error || "Failed to fetch report");
      }
    } catch (err) {
      console.error("Error fetching group report:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, nodeId]);

  // Fetch on mount, when node changes, or when refresh is triggered
  useEffect(() => {
    refresh();
  }, [refresh, refreshTrigger]);

  // Regenerate report
  const regenerate = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !report?.id) return false;

    try {
      const response = await fetch(
        `/api/ideation/session/${sessionId}/reports/${report.id}/regenerate`,
        { method: "POST" },
      );

      if (response.ok) {
        // Report regeneration started, UI should listen to WebSocket for completion
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error regenerating report:", err);
      return false;
    }
  }, [sessionId, report?.id]);

  return {
    report,
    isLoading,
    error,
    isStale: report?.status === "stale",
    refresh,
    regenerate,
  };
}

export default useGroupReport;
