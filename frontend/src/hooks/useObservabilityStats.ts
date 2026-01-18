/**
 * Observability Stats Hooks (OBS-706)
 * Provides aggregated statistics for the QuickStats component and other UI elements.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useObservabilityStream } from "./useObservabilityStream";
import type { ToolResultStatus } from "../types/observability";

interface QuickStatsData {
  activeExecutions: number;
  toolCallsPerMinute: number;
  passRate: number;
  errorCount: number;
  blockedCount: number;
  discoveriesCount: number;
  lastUpdated: string;
}

interface UseQuickStatsOptions {
  executionId?: string;
  refreshIntervalMs?: number;
}

/**
 * Hook for QuickStats component - provides real-time aggregated metrics.
 */
export function useQuickStats(options: UseQuickStatsOptions = {}) {
  const { executionId, refreshIntervalMs = 5000 } = options;

  const [stats, setStats] = useState<QuickStatsData>({
    activeExecutions: 0,
    toolCallsPerMinute: 0,
    passRate: 1,
    errorCount: 0,
    blockedCount: 0,
    discoveriesCount: 0,
    lastUpdated: new Date().toISOString(),
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // WebSocket for real-time updates
  const { events, isConnected } = useObservabilityStream({
    executionId,
    autoConnect: true,
    maxEvents: 500,
  });

  // Track tool calls in sliding window (1 minute)
  const toolCallTimestampsRef = useRef<number[]>([]);
  const processedEventsRef = useRef(0);

  // Reset when executionId changes
  useEffect(() => {
    toolCallTimestampsRef.current = [];
    processedEventsRef.current = 0;
  }, [executionId]);

  // Calculate tool calls per minute
  const calculateToolCallsPerMinute = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old timestamps
    while (
      toolCallTimestampsRef.current.length > 0 &&
      toolCallTimestampsRef.current[0] < oneMinuteAgo
    ) {
      toolCallTimestampsRef.current.shift();
    }

    return toolCallTimestampsRef.current.length;
  }, []);

  // Process events to update stats
  useEffect(() => {
    // Only process new events
    const newEvents = events.slice(processedEventsRef.current);
    processedEventsRef.current = events.length;

    let assertions = { total: 0, passed: 0 };
    let errors = 0;
    let blocked = 0;
    let discoveries = 0;

    for (const event of newEvents) {
      if (event.type === "tooluse:end") {
        toolCallTimestampsRef.current.push(Date.now());
        const data = event.data as {
          resultStatus?: ToolResultStatus;
          isError?: boolean;
          isBlocked?: boolean;
        };
        if (data.isError) errors++;
        if (data.isBlocked) blocked++;
      } else if (event.type === "assertion:result") {
        assertions.total++;
        const data = event.data as { result?: string };
        if (data.result === "pass") assertions.passed++;
      } else if (event.type === "transcript:entry") {
        const data = event.data as { entryType?: string };
        if (data.entryType === "discovery") discoveries++;
      }
    }

    setStats((prev) => ({
      ...prev,
      toolCallsPerMinute: calculateToolCallsPerMinute(),
      passRate:
        assertions.total > 0
          ? assertions.passed / assertions.total
          : prev.passRate,
      errorCount: prev.errorCount + errors,
      blockedCount: prev.blockedCount + blocked,
      discoveriesCount: prev.discoveriesCount + discoveries,
      lastUpdated: new Date().toISOString(),
    }));
  }, [events, calculateToolCallsPerMinute]);

  // Fetch initial stats from API
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "/api/observability/stats" +
          (executionId ? `?executionId=${executionId}` : ""),
      );
      if (!response.ok) throw new Error("Failed to fetch stats");
      const json = await response.json();
      if (json.success) {
        setStats((prev) => ({ ...prev, ...json.data }));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchStats();

    if (refreshIntervalMs > 0) {
      const interval = setInterval(fetchStats, refreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchStats, refreshIntervalMs]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
    isLive: isConnected,
  };
}

/**
 * Hook for tracking tool calls per minute with sliding window.
 */
export function useToolCallRate(
  executionId?: string,
  windowMs: number = 60000,
) {
  const [rate, setRate] = useState(0);
  const timestampsRef = useRef<number[]>([]);
  const processedEventsRef = useRef(0);

  const { events } = useObservabilityStream({
    executionId,
    autoConnect: true,
  });

  // Reset when executionId changes
  useEffect(() => {
    timestampsRef.current = [];
    processedEventsRef.current = 0;
    setRate(0);
  }, [executionId]);

  useEffect(() => {
    // Only process new events (not already processed)
    const newEvents = events.slice(processedEventsRef.current);
    processedEventsRef.current = events.length;

    for (const event of newEvents) {
      if (event.type === "tooluse:end") {
        timestampsRef.current.push(Date.now());
      }
    }

    // Clean up old timestamps
    const cutoff = Date.now() - windowMs;
    while (
      timestampsRef.current.length > 0 &&
      timestampsRef.current[0] < cutoff
    ) {
      timestampsRef.current.shift();
    }

    setRate(timestampsRef.current.length);
  }, [events, windowMs]);

  return rate;
}

/**
 * Hook for tracking assertion pass rate in real-time.
 */
export function useAssertionPassRate(executionId?: string) {
  const [stats, setStats] = useState({ passRate: 1, total: 0, passed: 0 });
  const processedEventsRef = useRef(0);

  const { events } = useObservabilityStream({
    executionId,
    autoConnect: true,
  });

  // Reset when executionId changes
  useEffect(() => {
    processedEventsRef.current = 0;
    setStats({ passRate: 1, total: 0, passed: 0 });
  }, [executionId]);

  useEffect(() => {
    // Only process new events (not already processed)
    const newEvents = events.slice(processedEventsRef.current);
    processedEventsRef.current = events.length;

    let newTotal = 0;
    let newPassed = 0;

    for (const event of newEvents) {
      if (event.type === "assertion:result") {
        newTotal++;
        const data = event.data as { result?: string };
        if (data.result === "pass") newPassed++;
      }
    }

    if (newTotal > 0) {
      setStats((prev) => {
        const updatedTotal = prev.total + newTotal;
        const updatedPassed = prev.passed + newPassed;
        return {
          total: updatedTotal,
          passed: updatedPassed,
          passRate: updatedTotal > 0 ? updatedPassed / updatedTotal : 1,
        };
      });
    }
  }, [events]);

  return {
    passRate: stats.passRate,
    total: stats.total,
    passed: stats.passed,
    failed: stats.total - stats.passed,
  };
}

/**
 * Hook for tracking error count in real-time.
 */
export function useErrorCount(executionId?: string) {
  const [counts, setCounts] = useState({ errorCount: 0, blockedCount: 0 });
  const processedEventsRef = useRef(0);

  const { events } = useObservabilityStream({
    executionId,
    autoConnect: true,
  });

  // Reset when executionId changes
  useEffect(() => {
    processedEventsRef.current = 0;
    setCounts({ errorCount: 0, blockedCount: 0 });
  }, [executionId]);

  useEffect(() => {
    // Only process new events (not already processed)
    const newEvents = events.slice(processedEventsRef.current);
    processedEventsRef.current = events.length;

    let errors = 0;
    let blocked = 0;

    for (const event of newEvents) {
      if (event.type === "tooluse:end") {
        const data = event.data as { isError?: boolean; isBlocked?: boolean };
        if (data.isError) errors++;
        if (data.isBlocked) blocked++;
      }
    }

    if (errors > 0 || blocked > 0) {
      setCounts((prev) => ({
        errorCount: prev.errorCount + errors,
        blockedCount: prev.blockedCount + blocked,
      }));
    }
  }, [events]);

  return {
    errorCount: counts.errorCount,
    blockedCount: counts.blockedCount,
    total: counts.errorCount + counts.blockedCount,
  };
}
