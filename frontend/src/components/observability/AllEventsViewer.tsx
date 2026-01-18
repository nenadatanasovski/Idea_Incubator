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

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
  Download,
  X,
  Pause,
  Play,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  useEvents,
  useEventStream,
  useEventStats,
} from "../../hooks/useEvents";
import type {
  PlatformEvent,
  EventFilters,
  EventSeverity,
  EventSource,
} from "../../types/events";

interface AllEventsViewerProps {
  projectId?: string;
  taskId?: string;
  executionId?: string;
  autoScroll?: boolean;
  maxHeight?: number;
}

const severityIcons: Record<EventSeverity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: XCircle,
};

const severityColors: Record<EventSeverity, string> = {
  info: "text-blue-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  critical: "text-red-600",
};

const severityBgColors: Record<EventSeverity, string> = {
  info: "bg-blue-900/20",
  warning: "bg-yellow-900/20",
  error: "bg-red-900/20",
  critical: "bg-red-900/40",
};

const sourceColors: Record<string, string> = {
  "task-agent": "text-purple-400",
  pipeline: "text-green-400",
  api: "text-blue-400",
  system: "text-gray-400",
  ideation: "text-orange-400",
  "build-agent": "text-cyan-400",
  websocket: "text-pink-400",
  telegram: "text-sky-400",
  monitoring: "text-indigo-400",
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
  autoScroll = true,
  maxHeight = 600,
}: AllEventsViewerProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<EventSeverity[]>([]);
  const [sourceFilter, setSourceFilter] = useState<EventSource[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const [showRealtime, setShowRealtime] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(autoScroll);

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
  const {
    events: streamEvents,
    isConnected,
    clearEvents: clearStreamEvents,
  } = useEventStream();

  // Get stats
  const { stats } = useEventStats(executionId);

  // Combine and filter events
  const allEvents = useMemo(() => {
    if (!showRealtime || isPaused) {
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

    // Merge with historical, avoiding duplicates
    const combined = [...filteredStreamEvents];
    historicalEvents.forEach((hist) => {
      if (!combined.some((e) => e.id === hist.id)) {
        combined.push(hist);
      }
    });

    return combined.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [
    historicalEvents,
    streamEvents,
    showRealtime,
    isPaused,
    severityFilter,
    sourceFilter,
    debouncedSearch,
  ]);

  // Auto-scroll
  useEffect(() => {
    if (shouldScrollRef.current && containerRef.current && !isPaused) {
      containerRef.current.scrollTop = 0;
    }
  }, [allEvents, isPaused]);

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

  const toggleSeverity = useCallback((severity: EventSeverity) => {
    setSeverityFilter((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity],
    );
  }, []);

  const toggleSource = useCallback((source: EventSource) => {
    setSourceFilter((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setSeverityFilter([]);
    setSourceFilter([]);
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
      fractionalSecondDigits: 3,
    });
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800">
      {/* Header with stats */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">
              Platform Events
            </h3>
            <span className="text-sm text-gray-400">
              {allEvents.length} of {total} events
            </span>
            {isConnected ? (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <Wifi className="w-3 h-3" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <WifiOff className="w-3 h-3" />
                Disconnected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRealtime(!showRealtime)}
              className={`p-2 rounded ${
                showRealtime
                  ? "bg-green-900/30 text-green-400"
                  : "bg-gray-800 text-gray-400"
              }`}
              title={showRealtime ? "Disable real-time" : "Enable real-time"}
            >
              {showRealtime ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`p-2 rounded ${
                isPaused
                  ? "bg-yellow-900/30 text-yellow-400"
                  : "bg-gray-800 text-gray-400"
              }`}
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={refresh}
              className="p-2 rounded bg-gray-800 text-gray-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={exportEvents}
              className="p-2 rounded bg-gray-800 text-gray-400 hover:text-white"
              title="Export JSON"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search and filters */}
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Severity filters */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 mr-2">Severity:</span>
            {allSeverities.map((severity) => {
              const Icon = severityIcons[severity];
              const isActive = severityFilter.includes(severity);
              return (
                <button
                  key={severity}
                  onClick={() => toggleSeverity(severity)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    isActive
                      ? `${severityBgColors[severity]} ${severityColors[severity]}`
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {severity}
                  {stats?.bySeverity[severity] !== undefined && (
                    <span className="ml-1 opacity-60">
                      ({stats.bySeverity[severity]})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Source filters */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 mr-2">Source:</span>
            {allSources.map((source) => {
              const isActive = sourceFilter.includes(source);
              return (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  className={`px-2 py-1 rounded text-xs ${
                    isActive
                      ? `bg-gray-700 ${sourceColors[source] || "text-gray-400"}`
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {source}
                  {stats?.bySource[source] !== undefined && (
                    <span className="ml-1 opacity-60">
                      ({stats.bySource[source]})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active filters indicator */}
          {(severityFilter.length > 0 ||
            sourceFilter.length > 0 ||
            debouncedSearch) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Active filters:</span>
              <button
                onClick={clearFilters}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Event list */}
      <div ref={containerRef} className="overflow-y-auto" style={{ maxHeight }}>
        {loading && allEvents.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            Loading events...
          </div>
        ) : allEvents.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            No events found
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {allEvents.map((event) => {
              const Icon = severityIcons[event.severity];
              const isExpanded = expandedIds.has(event.id);

              return (
                <div
                  key={event.id}
                  className={`${severityBgColors[event.severity]} hover:bg-gray-800/50 transition-colors`}
                >
                  {/* Event row */}
                  <div
                    className="flex items-start gap-3 p-3 cursor-pointer"
                    onClick={() => toggleExpand(event.id)}
                  >
                    {/* Expand icon */}
                    <button className="mt-0.5 text-gray-500">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {/* Severity icon */}
                    <Icon
                      className={`w-4 h-4 mt-0.5 ${severityColors[event.severity]}`}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-medium ${sourceColors[event.source] || "text-gray-400"}`}
                        >
                          {event.source}
                        </span>
                        <span className="text-sm text-white font-medium">
                          {formatEventType(event.eventType)}
                        </span>
                        {event.taskTitle && (
                          <span className="text-xs text-gray-500">
                            • {event.taskTitle}
                          </span>
                        )}
                        {event.projectName && (
                          <span className="text-xs text-purple-400">
                            {event.projectName}
                          </span>
                        )}
                      </div>

                      {/* Quick preview of payload */}
                      {event.payload && !isExpanded && (
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {JSON.stringify(event.payload).slice(0, 100)}
                          {JSON.stringify(event.payload).length > 100 && "..."}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-12 pb-3 space-y-2">
                      {/* IDs */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Event ID: </span>
                          <span className="text-gray-400 font-mono">
                            {event.id}
                          </span>
                        </div>
                        {event.correlationId && (
                          <div>
                            <span className="text-gray-500">Correlation: </span>
                            <span className="text-blue-400 font-mono">
                              {event.correlationId}
                            </span>
                          </div>
                        )}
                        {event.taskId && (
                          <div>
                            <span className="text-gray-500">Task: </span>
                            <span className="text-purple-400 font-mono">
                              {event.taskId}
                            </span>
                          </div>
                        )}
                        {event.executionId && (
                          <div>
                            <span className="text-gray-500">Execution: </span>
                            <span className="text-green-400 font-mono">
                              {event.executionId}
                            </span>
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
                            <pre className="mt-1 p-2 bg-gray-800 rounded text-xs text-gray-300 overflow-x-auto">
                              {JSON.stringify(event.payload, null, 2)}
                            </pre>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="p-4 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-4 py-2 bg-gray-800 text-gray-400 rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
