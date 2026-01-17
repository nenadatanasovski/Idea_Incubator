/**
 * useReadiness Hook
 *
 * Manages readiness score state via API polling.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-009-C)
 */

import { useState, useEffect, useCallback } from "react";
import type { ReadinessScore } from "../types/spec";

export interface UseReadinessOptions {
  sessionId: string;
  autoFetch?: boolean;
  /** Set to false to disable auto-fetching */
  enabled?: boolean;
}

export interface UseReadinessReturn {
  readiness: ReadinessScore | null;
  dimensions: ReadinessScore["dimensions"] | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  fetchReadiness: () => Promise<void>;
}

const READINESS_THRESHOLD = 70;

export function useReadiness({
  sessionId,
  autoFetch = true,
  enabled = true,
}: UseReadinessOptions): UseReadinessReturn {
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [dimensions, setDimensions] = useState<
    ReadinessScore["dimensions"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate if ready
  const isReady = readiness ? readiness.total >= READINESS_THRESHOLD : false;

  // Fetch readiness from API
  const fetchReadiness = useCallback(async () => {
    if (!enabled || !sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/specs/readiness/${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch readiness");
      }

      const data = await response.json();
      setReadiness(data.readiness);
      setDimensions(data.readiness?.dimensions || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch readiness",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, sessionId]);

  // Auto-fetch on mount
  useEffect(() => {
    if (enabled && autoFetch && sessionId) {
      fetchReadiness();
    }
  }, [enabled, autoFetch, sessionId, fetchReadiness]);

  // WebSocket subscription disabled - using polling instead
  // The WebSocket connection was causing errors due to proxy/connection issues
  // Real-time updates can be re-enabled later if needed

  return {
    readiness,
    dimensions,
    isReady,
    isLoading,
    error,
    fetchReadiness,
  };
}

export default useReadiness;
