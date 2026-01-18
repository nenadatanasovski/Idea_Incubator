/**
 * UnifiedLogViewer - Real-time log stream with filtering
 *
 * Features:
 * - Search box with clear
 * - Severity filters (info, warning, error, critical)
 * - Category filters
 * - Expandable entries for JSON payload
 * - Auto-scroll toggle
 * - Export logs (JSON)
 * - Clear all filters
 * - Entity navigation (click to navigate to task/tool)
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
} from "lucide-react";
import { useMessageBusLogs } from "../../hooks/useObservability";
import { useObservabilityStream } from "../../hooks/useObservabilityStream";
import type { MessageBusLogEntry, Severity } from "../../types/observability";
import { severityConfig } from "../../types/observability";

interface UnifiedLogViewerProps {
  executionId?: string;
  autoScroll?: boolean;
  maxHeight?: number;
  onEntityClick?: (entityType: string, entityId: string) => void;
}

const severityIcons: Record<Severity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  critical: XCircle,
};

export default function UnifiedLogViewer({
  executionId,
  autoScroll = true,
  maxHeight = 500,
  onEntityClick: _onEntityClick,
}: UnifiedLogViewerProps) {
  // Note: _onEntityClick is available for future entity click handlers
  void _onEntityClick;
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(autoScroll);

  const { logs, loading, total } = useMessageBusLogs({
    executionId,
    severity: severityFilter.length === 1 ? severityFilter[0] : undefined,
    limit: 200,
  });

  // Real-time updates
  const { events, isConnected } = useObservabilityStream({
    executionId,
    autoConnect: true,
  });

  // Combine static logs with real-time events
  const allLogs = useMemo(() => {
    const realTimeLogs = events
      .filter((e) => e.type === "messagebus:event")
      .map((e) => e.data as unknown as MessageBusLogEntry);

    const combined = [...logs];
    realTimeLogs.forEach((rtLog) => {
      if (!combined.some((l) => l.id === rtLog.id)) {
        combined.push(rtLog);
      }
    });
    return combined.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [logs, events]);

  // Get unique categories from logs
  const categories = useMemo(() => {
    const cats = new Set(allLogs.map((log) => log.category));
    return Array.from(cats).sort();
  }, [allLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (isPaused)
      return allLogs.slice(0, -realTimeStats.additionalLogs || allLogs.length);
    return allLogs.filter((log) => {
      if (
        search &&
        !log.humanSummary.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (severityFilter.length > 0 && !severityFilter.includes(log.severity)) {
        return false;
      }
      if (categoryFilter.length > 0 && !categoryFilter.includes(log.category)) {
        return false;
      }
      return true;
    });
  }, [allLogs, search, severityFilter, categoryFilter, isPaused]);

  // Count real-time additions for pause indicator
  const realTimeStats = useMemo(() => {
    const rtLogs = events.filter((e) => e.type === "messagebus:event").length;
    return { additionalLogs: rtLogs };
  }, [events]);

  // Check if any filters are active
  const hasActiveFilters =
    search.length > 0 || severityFilter.length > 0 || categoryFilter.length > 0;

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSearch("");
    setSeverityFilter([]);
    setCategoryFilter([]);
  }, []);

  // Export logs as JSON
  const handleExportLogs = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      executionId,
      totalLogs: filteredLogs.length,
      filters: {
        search: search || null,
        severity: severityFilter.length > 0 ? severityFilter : null,
        category: categoryFilter.length > 0 ? categoryFilter : null,
      },
      logs: filteredLogs,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${executionId || "all"}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs, executionId, search, severityFilter, categoryFilter]);

  // Toggle category filter
  const toggleCategory = useCallback((cat: string) => {
    setCategoryFilter((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      return [...prev, cat];
    });
  }, []);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (shouldScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLogs.length]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSeverity = useCallback((sev: Severity) => {
    setSeverityFilter((prev) => {
      if (prev.includes(sev)) return prev.filter((s) => s !== sev);
      return [...prev, sev];
    });
  }, []);

  if (loading && logs.length === 0) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 p-3 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          {/* Search with clear */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-9 pr-8 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Severity filters */}
          <div className="flex items-center gap-1">
            {(["info", "warning", "error", "critical"] as Severity[]).map(
              (sev) => {
                const Icon = severityIcons[sev];
                const isActive = severityFilter.includes(sev);
                const config = severityConfig[sev];
                return (
                  <button
                    key={sev}
                    onClick={() => toggleSeverity(sev)}
                    className={`p-1.5 rounded transition-colors ${isActive ? config.bg + " " + config.color : "text-gray-400 hover:text-gray-600"}`}
                    title={sev}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              },
            )}
          </div>

          {/* Pause/Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-1.5 rounded transition-colors ${
              isPaused
                ? "bg-yellow-100 text-yellow-700"
                : "text-gray-400 hover:text-gray-600"
            }`}
            title={isPaused ? "Resume live updates" : "Pause live updates"}
          >
            {isPaused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Clear all filters"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}

          {/* Export */}
          <button
            onClick={handleExportLogs}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Export logs as JSON"
          >
            <Download className="h-3 w-3" />
            Export
          </button>

          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? isPaused
                    ? "bg-yellow-500"
                    : "bg-green-500"
                  : "bg-gray-300"
              }`}
            />
            <span className="text-gray-500">
              {isPaused ? "Paused" : isConnected ? "Live" : "Disconnected"}
            </span>
          </div>

          {/* Count */}
          <span className="text-xs text-gray-500">
            {filteredLogs.length} / {total}
          </span>
        </div>

        {/* Category filters (if there are categories) */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Categories:</span>
            {categories.map((cat) => {
              const isActive = categoryFilter.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Log list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ maxHeight }}
        onScroll={(e) => {
          const el = e.currentTarget;
          shouldScrollRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 50;
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            {search || severityFilter.length > 0
              ? "No logs match filters"
              : "No logs available"}
          </div>
        ) : (
          <div className="divide-y">
            {filteredLogs.map((log) => {
              const isExpanded = expandedIds.has(log.id);
              const config = severityConfig[log.severity];
              const Icon = severityIcons[log.severity];

              return (
                <div
                  key={log.id}
                  className={`${config.bg} border-l-4 ${config.borderColor}`}
                >
                  <div
                    className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-white/50"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <Icon
                      className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                          {log.source}
                        </span>
                        <span className="text-xs text-gray-400">
                          {log.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mt-0.5">
                        {log.humanSummary}
                      </p>
                    </div>
                    {log.payload &&
                      (isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      ))}
                  </div>
                  {isExpanded && log.payload && (
                    <div className="px-3 pb-2 pl-9">
                      <pre className="text-xs bg-gray-800 text-gray-100 rounded p-2 overflow-auto max-h-48">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
