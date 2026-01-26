/**
 * useReportSynthesisStatus Hook
 *
 * Tracks background report synthesis job status via WebSocket events.
 * Provides state and actions for the UI status indicator.
 */

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export type ReportSynthesisStatus =
  | "started"
  | "detecting"
  | "generating"
  | "complete"
  | "failed"
  | "cancelled";

export interface ReportSynthesisPayload {
  jobId: string;
  totalGroups: number;
  completedGroups: number;
  currentGroupName?: string;
  reportsCreated?: number;
  progress?: number;
  status: ReportSynthesisStatus;
  error?: string;
}

export interface ReportSynthesisJobStatus {
  isActive: boolean;
  jobId: string | null;
  status: ReportSynthesisStatus | null;
  totalGroups: number;
  completedGroups: number;
  currentGroupName: string | null;
  reportsCreated: number;
  progress: number; // 0-100
  error: string | null;
  completedAt: string | null;
}

export interface UseReportSynthesisStatusOptions {
  sessionId: string;
  // Auto-dismiss completed status after N milliseconds (0 = never)
  autoDismissDelay?: number;
}

export interface UseReportSynthesisStatusReturn {
  status: ReportSynthesisJobStatus;
  // Cancel the current synthesis job
  cancel: () => Promise<boolean>;
  // Dismiss the status indicator (for completed/failed/cancelled)
  dismiss: () => void;
  // Check status from server (for page refresh recovery)
  checkStatus: () => Promise<void>;
  // Event handlers to wire up to useGraphWebSocket
  handlers: {
    onReportSynthesisStarted: (payload: ReportSynthesisPayload) => void;
    onReportSynthesisProgress: (payload: ReportSynthesisPayload) => void;
    onReportSynthesisComplete: (payload: ReportSynthesisPayload) => void;
    onReportSynthesisFailed: (payload: ReportSynthesisPayload) => void;
    onReportSynthesisCancelled: (payload: ReportSynthesisPayload) => void;
  };
}

// ============================================================================
// Initial State
// ============================================================================

const initialStatus: ReportSynthesisJobStatus = {
  isActive: false,
  jobId: null,
  status: null,
  totalGroups: 0,
  completedGroups: 0,
  currentGroupName: null,
  reportsCreated: 0,
  progress: 0,
  error: null,
  completedAt: null,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useReportSynthesisStatus(
  options: UseReportSynthesisStatusOptions,
): UseReportSynthesisStatusReturn {
  const { sessionId, autoDismissDelay = 5000 } = options;

  const [status, setStatus] = useState<ReportSynthesisJobStatus>(initialStatus);

  // Auto-dismiss completed status after delay
  useEffect(() => {
    if (
      autoDismissDelay > 0 &&
      status.completedAt &&
      (status.status === "complete" ||
        status.status === "failed" ||
        status.status === "cancelled")
    ) {
      const timer = setTimeout(() => {
        setStatus(initialStatus);
      }, autoDismissDelay);
      return () => clearTimeout(timer);
    }
  }, [status.completedAt, status.status, autoDismissDelay]);

  // Check server for active job on mount (for page refresh recovery)
  const checkStatus = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(
        `/api/ideation/session/${sessionId}/report-synthesis/status`,
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.job) {
          const job = data.job;
          setStatus({
            isActive: data.hasActiveJob,
            jobId: job.id,
            status: job.status,
            totalGroups: job.totalGroups || 0,
            completedGroups: job.completedGroups || 0,
            currentGroupName: job.currentGroupName || null,
            reportsCreated: job.reportsCreated || 0,
            progress: getProgressFromStatus(
              job.status,
              job.completedGroups,
              job.totalGroups,
            ),
            error: job.error || null,
            completedAt: job.completedAt || null,
          });
        }
      }
    } catch (err) {
      console.error("Error checking report synthesis status:", err);
    }
  }, [sessionId]);

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Cancel the current job
  const cancel = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !status.isActive) return false;

    try {
      const response = await fetch(
        `/api/ideation/session/${sessionId}/report-synthesis/cancel`,
        { method: "POST" },
      );
      return response.ok;
    } catch (err) {
      console.error("Error cancelling report synthesis:", err);
      return false;
    }
  }, [sessionId, status.isActive]);

  // Dismiss the status indicator
  const dismiss = useCallback(() => {
    setStatus(initialStatus);
  }, []);

  // WebSocket event handlers
  const onReportSynthesisStarted = useCallback(
    (payload: ReportSynthesisPayload) => {
      setStatus({
        isActive: true,
        jobId: payload.jobId,
        status: "started",
        totalGroups: 0,
        completedGroups: 0,
        currentGroupName: null,
        reportsCreated: 0,
        progress: 5,
        error: null,
        completedAt: null,
      });
    },
    [],
  );

  const onReportSynthesisProgress = useCallback(
    (payload: ReportSynthesisPayload) => {
      setStatus((prev) => ({
        ...prev,
        status: payload.status,
        totalGroups: payload.totalGroups || prev.totalGroups,
        completedGroups: payload.completedGroups || prev.completedGroups,
        currentGroupName: payload.currentGroupName || prev.currentGroupName,
        progress: payload.progress || prev.progress,
      }));
    },
    [],
  );

  const onReportSynthesisComplete = useCallback(
    (payload: ReportSynthesisPayload) => {
      setStatus((prev) => ({
        ...prev,
        isActive: false,
        status: "complete",
        totalGroups: payload.totalGroups || prev.totalGroups,
        completedGroups: payload.totalGroups || prev.totalGroups,
        reportsCreated: payload.reportsCreated || 0,
        progress: 100,
        completedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const onReportSynthesisFailed = useCallback(
    (payload: ReportSynthesisPayload) => {
      setStatus((prev) => ({
        ...prev,
        isActive: false,
        status: "failed",
        error: payload.error || "Unknown error",
        completedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const onReportSynthesisCancelled = useCallback(
    (payload: ReportSynthesisPayload) => {
      setStatus((prev) => ({
        ...prev,
        isActive: false,
        status: "cancelled",
        completedAt: new Date().toISOString(),
      }));
      // Silence unused var warning
      void payload;
    },
    [],
  );

  return {
    status,
    cancel,
    dismiss,
    checkStatus,
    handlers: {
      onReportSynthesisStarted,
      onReportSynthesisProgress,
      onReportSynthesisComplete,
      onReportSynthesisFailed,
      onReportSynthesisCancelled,
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getProgressFromStatus(
  status: string,
  completedGroups: number,
  totalGroups: number,
): number {
  switch (status) {
    case "started":
      return 5;
    case "detecting":
      return 10;
    case "generating":
      // Progress from 10 to 95 based on completed groups
      if (totalGroups === 0) return 50;
      return 10 + (completedGroups / totalGroups) * 85;
    case "complete":
      return 100;
    case "failed":
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

export default useReportSynthesisStatus;
