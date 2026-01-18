/**
 * Real-Time Data Fusion Hooks (OBS-705)
 * Combine API data with WebSocket streaming for real-time UI updates.
 */

import { useState, useEffect, useMemo } from "react";
import { useTranscript, useToolUses, useAssertions } from "./useObservability";
import { useObservabilityStream } from "./useObservabilityStream";
import type {
  TranscriptEntry,
  ToolUse,
  AssertionResultEntry,
} from "../types/observability";

interface UseRealtimeTranscriptOptions {
  entryType?: string;
  category?: string;
  taskId?: string;
  limit?: number;
  autoRefreshOnReconnect?: boolean;
}

/**
 * Hook that combines API data with WebSocket streaming for real-time transcript updates.
 *
 * - Initial data loaded via REST API
 * - New entries appended via WebSocket
 * - Automatic deduplication
 * - Reconnection triggers data refresh
 */
export function useRealtimeTranscript(
  executionId: string | undefined,
  options: UseRealtimeTranscriptOptions = {},
) {
  const { autoRefreshOnReconnect = true, ...apiOptions } = options;

  // API data for initial load
  const {
    entries: apiEntries,
    loading,
    error,
    refetch,
  } = useTranscript(executionId, apiOptions);

  // WebSocket for real-time updates
  const { events, isConnected, status } = useObservabilityStream({
    executionId,
    autoConnect: !!executionId,
  });

  // Merged entries (API + WebSocket)
  const [mergedEntries, setMergedEntries] = useState<TranscriptEntry[]>([]);
  const seenIds = useMemo(() => new Set<string>(), [executionId]);

  // Update merged entries when API data loads
  useEffect(() => {
    if (apiEntries.length > 0) {
      setMergedEntries(apiEntries);
      apiEntries.forEach((e) => seenIds.add(e.id));
    }
  }, [apiEntries, seenIds]);

  // Append new entries from WebSocket
  useEffect(() => {
    const transcriptEvents = events.filter(
      (e) => e.type === "transcript:entry",
    );

    const newEntries: TranscriptEntry[] = [];

    for (const event of transcriptEvents) {
      const entry = event.data as TranscriptEntry;
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        newEntries.push(entry);
      }
    }

    if (newEntries.length > 0) {
      setMergedEntries((prev) => [...prev, ...newEntries]);
    }
  }, [events, seenIds]);

  // Refresh on reconnection
  useEffect(() => {
    if (autoRefreshOnReconnect && status.connected && status.lastConnectedAt) {
      refetch();
    }
  }, [
    status.connected,
    status.lastConnectedAt,
    autoRefreshOnReconnect,
    refetch,
  ]);

  // Get latest entry
  const latestEntry = mergedEntries[mergedEntries.length - 1] || null;

  return {
    entries: mergedEntries,
    latestEntry,
    loading,
    error,
    refetch,
    isLive: isConnected,
    connectionStatus: status,
    newEntriesCount: mergedEntries.length - apiEntries.length,
  };
}

/**
 * Hook for real-time tool use updates.
 */
export function useRealtimeToolUses(
  executionId: string | undefined,
  options: { limit?: number } = {},
) {
  const {
    toolUses: apiToolUses,
    loading,
    error,
    refetch,
  } = useToolUses(executionId, options);

  const { events, isConnected, status } = useObservabilityStream({
    executionId,
    autoConnect: !!executionId,
  });

  const [mergedToolUses, setMergedToolUses] = useState<ToolUse[]>([]);
  const [inProgress, setInProgress] = useState<Map<string, ToolUse>>(new Map());
  const seenIds = useMemo(() => new Set<string>(), [executionId]);

  // Initialize with API data
  useEffect(() => {
    if (apiToolUses.length > 0) {
      setMergedToolUses(apiToolUses);
      apiToolUses.forEach((t) => seenIds.add(t.id));
    }
  }, [apiToolUses, seenIds]);

  // Process tool use events
  useEffect(() => {
    for (const event of events) {
      if (event.type === "tooluse:start") {
        const toolUse = event.data as ToolUse;
        setInProgress((prev) => new Map(prev).set(toolUse.id, toolUse));
      } else if (event.type === "tooluse:end") {
        const toolUse = event.data as ToolUse;
        setInProgress((prev) => {
          const next = new Map(prev);
          next.delete(toolUse.id);
          return next;
        });
        if (!seenIds.has(toolUse.id)) {
          seenIds.add(toolUse.id);
          setMergedToolUses((prev) => [...prev, toolUse]);
        }
      }
    }
  }, [events, seenIds]);

  // Refresh on reconnection
  useEffect(() => {
    if (status.connected && status.lastConnectedAt) {
      refetch();
    }
  }, [status.connected, status.lastConnectedAt, refetch]);

  return {
    toolUses: mergedToolUses,
    inProgressTools: Array.from(inProgress.values()),
    loading,
    error,
    refetch,
    isLive: isConnected,
    totalCount: mergedToolUses.length,
    errorCount: mergedToolUses.filter((t) => t.isError).length,
  };
}

/**
 * Hook for real-time assertion updates.
 */
export function useRealtimeAssertions(executionId: string | undefined) {
  const {
    assertions: apiAssertions,
    loading,
    error,
    refetch,
  } = useAssertions(executionId);

  const { events, isConnected, status } = useObservabilityStream({
    executionId,
    autoConnect: !!executionId,
  });

  const [mergedAssertions, setMergedAssertions] = useState<
    AssertionResultEntry[]
  >([]);
  const [runningPassRate, setRunningPassRate] = useState<number>(1);
  const seenIds = useMemo(() => new Set<string>(), [executionId]);

  useEffect(() => {
    if (apiAssertions.length > 0) {
      setMergedAssertions(apiAssertions);
      apiAssertions.forEach((a) => seenIds.add(a.id));
      const passed = apiAssertions.filter((a) => a.result === "pass").length;
      setRunningPassRate(passed / apiAssertions.length);
    }
  }, [apiAssertions, seenIds]);

  useEffect(() => {
    for (const event of events) {
      if (event.type === "assertion:result") {
        const assertion = event.data as AssertionResultEntry;
        if (!seenIds.has(assertion.id)) {
          seenIds.add(assertion.id);
          setMergedAssertions((prev) => {
            const next = [...prev, assertion];
            const passed = next.filter((a) => a.result === "pass").length;
            setRunningPassRate(passed / next.length);
            return next;
          });
        }
      }
    }
  }, [events, seenIds]);

  // Refresh on reconnection
  useEffect(() => {
    if (status.connected && status.lastConnectedAt) {
      refetch();
    }
  }, [status.connected, status.lastConnectedAt, refetch]);

  return {
    assertions: mergedAssertions,
    runningPassRate,
    loading,
    error,
    refetch,
    isLive: isConnected,
    totalCount: mergedAssertions.length,
    passedCount: mergedAssertions.filter((a) => a.result === "pass").length,
    failedCount: mergedAssertions.filter((a) => a.result === "fail").length,
  };
}
