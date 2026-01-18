/**
 * AllEventsViewer - Platform-wide event log viewer
 *
 * Features:
 * - Real-time event streaming via WebSocket
 * - Filter by source, event type, severity
 * - Search box with debounce
 * - Expandable rows showing payload
 * - Auto-scroll toggle
 * - Export functionality
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  Filter,
  Loader2,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import {
  useEvents,
  useEventStream,
  useEventStats,
} from "../../hooks/useEvents";
import type {
  EventFilters,
  EventSeverity,
  EventSource,
} from "../../types/events";

interface AllEventsViewerProps {
  projectId?: string;
  taskId?: string;
  executionId?: string;
}

const severityIcons: Record<EventSeverity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: XCircle,
};

const severityColors: Record<EventSeverity, string> = {
  info: "bg-blue-100 text-blue-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900",
};

const sourceColors: Record<string, string> = {
  "task-agent": "bg-purple-100 text-purple-800",
  pipeline: "bg-green-100 text-green-800",
  api: "bg-blue-100 text-blue-800",
  system: "bg-gray-100 text-gray-800",
  ideation: "bg-orange-100 text-orange-800",
  "build-agent": "bg-cyan-100 text-cyan-800",
  websocket: "bg-pink-100 text-pink-800",
  telegram: "bg-sky-100 text-sky-800",
  monitoring: "bg-indigo-100 text-indigo-800",
};

const allSeverities: EventSeverity[] = ["info", "warning", "error", "critical"];
const allSources: EventSource[] = [
  "task-agent",
  "pipeline",
  "api",
  "system",
  "ideation",
  "build-agent",
  "websocket",
  "telegram",
  "monitoring",
];

export default function AllEventsViewer({
  projectId,
  taskId,
  executionId,
}: AllEventsViewerProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<EventSeverity[]>([]);
  const [sourceFilter, setSourceFilter] = useState<EventSource[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showRealtime, setShowRealtime] = useState(true);

  // Toggle functions for tag filters
  const toggleSeverity = (sev: EventSeverity) => {
    setSeverityFilter((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
    );
  };

  const toggleSource = (src: EventSource) => {
    setSourceFilter((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src],
    );
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Build filters
  const filters: EventFilters = useMemo(
    () => ({
      source: sourceFilter.length > 0 ? sourceFilter : undefined,
      severity: severityFilter.length > 0 ? severityFilter : undefined,
      projectId,
      taskId,
      executionId,
      search: debouncedSearch || undefined,
    }),
    [
      sourceFilter,
      severityFilter,
      projectId,
      taskId,
      executionId,
      debouncedSearch,
    ],
  );

  // Fetch historical events
  const {
    events: historicalEvents,
    loading,
    total,
    hasMore,
    loadMore,
    refresh,
  } = useEvents(filters);

  // Real-time stream
  const { events: streamEvents, isConnected } = useEventStream();

  // Get stats
  const { stats } = useEventStats(executionId);

  // Combine and filter events
  const allEvents = useMemo(() => {
    if (!showRealtime) {
      return historicalEvents;
    }

    // Filter stream events by current filters
    const filteredStreamEvents = streamEvents.filter((event) => {
      if (
        severityFilter.length > 0 &&
        !severityFilter.includes(event.severity)
      ) {
        return false;
      }
      if (sourceFilter.length > 0 && !sourceFilter.includes(event.source)) {
        return false;
      }
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        return (
          event.eventType.toLowerCase().includes(searchLower) ||
          event.source.toLowerCase().includes(searchLower) ||
          JSON.stringify(event.payload || {})
            .toLowerCase()
            .includes(searchLower)
        );
      }
      return true;
    });

    // Merge with historical, avoiding duplicates using a Map for O(1) lookup
    const eventMap = new Map<string, (typeof historicalEvents)[0]>();

    // Add historical events first
    historicalEvents.forEach((event) => {
      eventMap.set(event.id, event);
    });

    // Add/overwrite with stream events (they're more recent)
    filteredStreamEvents.forEach((event) => {
      eventMap.set(event.id, event);
    });

    return Array.from(eventMap.values()).sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [
    historicalEvents,
    streamEvents,
    showRealtime,
    severityFilter,
    sourceFilter,
    debouncedSearch,
  ]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const exportEvents = useCallback(() => {
    const data = JSON.stringify(allEvents, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `events-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allEvents]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading && allEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header with inline stats */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              Platform Events
            </h2>
            <p className="text-sm text-gray-500">
              View all platform-wide events with real-time streaming
            </p>
          </div>
          {/* Inline stats */}
          {stats && (
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-gray-200">
              <div className="text-center">
                <div className="text-xl font-semibold text-gray-900">
                  {stats.total}
                </div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-blue-600">
                  {stats.bySeverity.info || 0}
                </div>
                <div className="text-xs text-gray-500">Info</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-yellow-600">
                  {stats.bySeverity.warning || 0}
                </div>
                <div className="text-xs text-gray-500">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-red-600">
                  {(stats.bySeverity.error || 0) +
                    (stats.bySeverity.critical || 0)}
                </div>
                <div className="text-xs text-gray-500">Errors</div>
              </div>
            </div>
          )}
          {/* Search */}
          <div className="relative ml-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-48"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-2">
            {allEvents.length}/{total}
          </span>
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              <Wifi className="w-3 h-3" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              <WifiOff className="w-3 h-3" />
              Disconnected
            </span>
          )}
          <button
            onClick={() => setShowRealtime(!showRealtime)}
            className={clsx(
              "px-3 py-1.5 text-sm border rounded-md flex items-center gap-2",
              showRealtime
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50",
            )}
          >
            {showRealtime ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            {showRealtime ? "Live" : "Paused"}
          </button>
          <button
            onClick={refresh}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={exportEvents}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="bg-white rounded-lg shadow flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Filters */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 space-y-2">
          {/* Severity tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Severity:
            </span>
            {allSeverities.map((sev) => {
              const isSelected = severityFilter.includes(sev);
              const SevIcon = severityIcons[sev];
              return (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  className={clsx(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    isSelected
                      ? severityColors[sev]
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  <SevIcon className="h-3 w-3" />
                  {sev.charAt(0).toUpperCase() + sev.slice(1)}
                </button>
              );
            })}
            {severityFilter.length > 0 && (
              <button
                onClick={() => setSeverityFilter([])}
                className="text-xs text-gray-400 hover:text-gray-600 ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Source tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Source:</span>
            {allSources.map((src) => {
              const isSelected = sourceFilter.includes(src);
              return (
                <button
                  key={src}
                  onClick={() => toggleSource(src)}
                  className={clsx(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    isSelected
                      ? sourceColors[src] || "bg-gray-200 text-gray-800"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {src}
                </button>
              );
            })}
            {sourceFilter.length > 0 && (
              <button
                onClick={() => setSourceFilter([])}
                className="text-xs text-gray-400 hover:text-gray-600 ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {allEvents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
            <Zap className="h-12 w-12 mb-3 text-gray-300" />
            <p>No events found</p>
            <p className="text-xs mt-1 text-gray-400">
              Events will appear here as they occur
            </p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allEvents.map((event) => {
                  const isExpanded = expandedIds.has(event.id);
                  const SeverityIcon = severityIcons[event.severity];

                  return (
                    <React.Fragment key={event.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpand(event.id)}
                      >
                        <td className="px-4 py-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                          {formatTimestamp(event.timestamp)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className={clsx(
                              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                              sourceColors[event.source] ||
                                "bg-gray-100 text-gray-800",
                            )}
                          >
                            {event.source}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-sm font-medium text-gray-900">
                            {event.eventType}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                              severityColors[event.severity],
                            )}
                          >
                            <SeverityIcon className="h-3 w-3" />
                            {event.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600 max-w-md truncate">
                          {event.payload ? (
                            JSON.stringify(event.payload).slice(0, 60) +
                            (JSON.stringify(event.payload).length > 60
                              ? "..."
                              : "")
                          ) : (
                            <span className="text-gray-400">No payload</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 bg-gray-50">
                            <div className="space-y-2">
                              {/* IDs */}
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <span className="text-gray-500">
                                    Event ID:{" "}
                                  </span>
                                  <code className="text-gray-700 bg-gray-100 px-1 rounded">
                                    {event.id}
                                  </code>
                                </div>
                                {event.correlationId && (
                                  <div>
                                    <span className="text-gray-500">
                                      Correlation ID:{" "}
                                    </span>
                                    <code className="text-blue-700 bg-blue-50 px-1 rounded">
                                      {event.correlationId}
                                    </code>
                                  </div>
                                )}
                                {event.taskId && (
                                  <div>
                                    <span className="text-gray-500">
                                      Task ID:{" "}
                                    </span>
                                    <code className="text-purple-700 bg-purple-50 px-1 rounded">
                                      {event.taskId}
                                    </code>
                                  </div>
                                )}
                                {event.executionId && (
                                  <div>
                                    <span className="text-gray-500">
                                      Execution ID:{" "}
                                    </span>
                                    <code className="text-green-700 bg-green-50 px-1 rounded">
                                      {event.executionId}
                                    </code>
                                  </div>
                                )}
                                {event.projectId && (
                                  <div>
                                    <span className="text-gray-500">
                                      Project ID:{" "}
                                    </span>
                                    <code className="text-orange-700 bg-orange-50 px-1 rounded">
                                      {event.projectId}
                                    </code>
                                  </div>
                                )}
                              </div>

                              {/* Payload */}
                              {event.payload &&
                                Object.keys(event.payload).length > 0 && (
                                  <div>
                                    <span className="text-xs text-gray-500">
                                      Payload:
                                    </span>
                                    <pre className="mt-1 p-2 bg-gray-100 rounded text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify(event.payload, null, 2)}
                                    </pre>
                                  </div>
                                )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load more / Footer */}
        {(hasMore || allEvents.length > 0) && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {allEvents.length} events loaded
            </span>
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
