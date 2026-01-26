/**
 * useSourceMappingStatus Hook
 *
 * Tracks background source mapping job status via WebSocket events.
 * Provides state and actions for the UI status indicator.
 */

import { useState, useEffect, useCallback } from "react";
import type {
  SourceMappingPayload,
  SourceMappingStatus,
} from "./useGraphWebSocket";

// ============================================================================
// Types
// ============================================================================

export interface SourceMappingJobStatus {
  isActive: boolean;
  jobId: string | null;
  status: SourceMappingStatus | null;
  blocksToMap: number;
  sourcesAvailable: number;
  mappingsCreated: number;
  progress: number; // 0-100
  error: string | null;
  completedAt: string | null;
}

export interface UseSourceMappingStatusOptions {
  sessionId: string;
  // Auto-dismiss completed status after N milliseconds (0 = never)
  autoDismissDelay?: number;
}

export interface UseSourceMappingStatusReturn {
  status: SourceMappingJobStatus;
  // Cancel the current mapping job
  cancel: () => Promise<boolean>;
  // Dismiss the status indicator (for completed/failed/cancelled)
  dismiss: () => void;
  // Check status from server (for page refresh recovery)
  checkStatus: () => Promise<void>;
  // Event handlers to wire up to useGraphWebSocket
  handlers: {
    onSourceMappingStarted: (payload: SourceMappingPayload) => void;
    onSourceMappingProgress: (payload: SourceMappingPayload) => void;
    onSourceMappingComplete: (payload: SourceMappingPayload) => void;
    onSourceMappingFailed: (payload: SourceMappingPayload) => void;
    onSourceMappingCancelled: (payload: SourceMappingPayload) => void;
  };
}

// ============================================================================
// Initial State
// ============================================================================

const initialStatus: SourceMappingJobStatus = {
  isActive: false,
  jobId: null,
  status: null,
  blocksToMap: 0,
  sourcesAvailable: 0,
  mappingsCreated: 0,
  progress: 0,
  error: null,
  completedAt: null,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSourceMappingStatus(
  options: UseSourceMappingStatusOptions,
): UseSourceMappingStatusReturn {
  const { sessionId, autoDismissDelay = 5000 } = options;

  const [status, setStatus] = useState<SourceMappingJobStatus>(initialStatus);

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
        `/api/ideation/session/${sessionId}/source-mapping/status`,
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.job) {
          const job = data.job;
          setStatus({
            isActive: data.hasActiveJob,
            jobId: job.id,
            status: job.status,
            blocksToMap: job.blocksToMap || 0,
            sourcesAvailable: job.sourcesAvailable || 0,
            mappingsCreated: job.mappingsCreated || 0,
            progress: getProgressFromStatus(job.status),
            error: job.error || null,
            completedAt: job.completedAt || null,
          });
        }
      }
    } catch (err) {
      console.error("Error checking source mapping status:", err);
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
        `/api/ideation/session/${sessionId}/source-mapping/cancel`,
        { method: "POST" },
      );
      return response.ok;
    } catch (err) {
      console.error("Error cancelling source mapping:", err);
      return false;
    }
  }, [sessionId, status.isActive]);

  // Dismiss the status indicator
  const dismiss = useCallback(() => {
    setStatus(initialStatus);
  }, []);

  // WebSocket event handlers
  const onSourceMappingStarted = useCallback(
    (payload: SourceMappingPayload) => {
      setStatus({
        isActive: true,
        jobId: payload.jobId,
        status: "started",
        blocksToMap: payload.blocksToMap,
        sourcesAvailable: payload.sourcesAvailable,
        mappingsCreated: 0,
        progress: 10,
        error: null,
        completedAt: null,
      });
    },
    [],
  );

  const onSourceMappingProgress = useCallback(
    (payload: SourceMappingPayload) => {
      setStatus((prev) => ({
        ...prev,
        status: "processing",
        sourcesAvailable: payload.sourcesAvailable || prev.sourcesAvailable,
        progress: payload.progress || prev.progress,
      }));
    },
    [],
  );

  const onSourceMappingComplete = useCallback(
    (payload: SourceMappingPayload) => {
      setStatus((prev) => ({
        ...prev,
        isActive: false,
        status: "complete",
        mappingsCreated: payload.mappingsCreated || 0,
        progress: 100,
        completedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const onSourceMappingFailed = useCallback((payload: SourceMappingPayload) => {
    setStatus((prev) => ({
      ...prev,
      isActive: false,
      status: "failed",
      error: payload.error || "Unknown error",
      completedAt: new Date().toISOString(),
    }));
  }, []);

  const onSourceMappingCancelled = useCallback(
    (payload: SourceMappingPayload) => {
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
      onSourceMappingStarted,
      onSourceMappingProgress,
      onSourceMappingComplete,
      onSourceMappingFailed,
      onSourceMappingCancelled,
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getProgressFromStatus(status: string): number {
  switch (status) {
    case "pending":
      return 5;
    case "collecting_sources":
      return 20;
    case "mapping":
      return 50;
    case "complete":
      return 100;
    case "failed":
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

export default useSourceMappingStatus;
