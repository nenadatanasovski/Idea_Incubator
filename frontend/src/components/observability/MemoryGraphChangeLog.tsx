/**
 * Memory Graph Change Log Component
 *
 * Displays a log of all changes to the Memory Graph with tag-based filters,
 * search, stats panel, and export functionality - matching the All Events viewer style.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Filter,
  Clock,
  User,
  Bot,
  Zap,
  Undo2,
  Search,
  Download,
  Plus,
  Edit3,
  Link2,
  Unlink,
  Trash2,
  RotateCcw,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import {
  useMemoryGraphChanges,
  useMemoryGraphStats,
  type ChangeType,
  type TriggerType,
  type GraphChangeEntry,
} from "../../hooks/useMemoryGraphChanges";

// ============================================================================
// Types
// ============================================================================

export interface MemoryGraphChangeLogProps {
  sessionId?: string;
  onRevert?: (entryId: string) => void;
  onViewBlock?: (blockId: string) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const allChangeTypes: ChangeType[] = [
  "created",
  "modified",
  "superseded",
  "linked",
  "unlinked",
  "deleted",
];

const allTriggerTypes: TriggerType[] = [
  "user",
  "ai_auto",
  "ai_confirmed",
  "cascade",
  "system",
];

const changeTypeColors: Record<ChangeType, string> = {
  created: "bg-green-100 text-green-800",
  modified: "bg-blue-100 text-blue-800",
  superseded: "bg-yellow-100 text-yellow-800",
  linked: "bg-purple-100 text-purple-800",
  unlinked: "bg-orange-100 text-orange-800",
  deleted: "bg-red-100 text-red-800",
};

const triggerColors: Record<TriggerType, string> = {
  user: "bg-blue-100 text-blue-800",
  ai_auto: "bg-purple-100 text-purple-800",
  ai_confirmed: "bg-green-100 text-green-800",
  cascade: "bg-yellow-100 text-yellow-800",
  system: "bg-gray-100 text-gray-800",
};

const changeTypeIcons: Record<ChangeType, typeof Plus> = {
  created: Plus,
  modified: Edit3,
  superseded: RotateCcw,
  linked: Link2,
  unlinked: Unlink,
  deleted: Trash2,
};

// ============================================================================
// Helper Functions
// ============================================================================

function getTriggerIcon(trigger: TriggerType) {
  switch (trigger) {
    case "user":
      return <User className="w-3 h-3" />;
    case "ai_auto":
      return <Bot className="w-3 h-3" />;
    case "ai_confirmed":
      return <Bot className="w-3 h-3 text-green-500" />;
    case "cascade":
      return <Zap className="w-3 h-3 text-yellow-500" />;
    case "system":
      return <RefreshCw className="w-3 h-3" />;
    default:
      return null;
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTriggerLabel(trigger: TriggerType): string {
  return trigger.replace(/_/g, " ");
}

// ============================================================================
// Expanded Row Component
// ============================================================================

function ExpandedRowContent({
  entry,
  onRevert,
  onViewBlock,
}: {
  entry: GraphChangeEntry;
  onRevert?: (entryId: string) => void;
  onViewBlock?: (blockId: string) => void;
}) {
  return (
    <td colSpan={6} className="px-4 py-3 bg-gray-50">
      <div className="space-y-2">
        {/* IDs */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-gray-500">Change ID: </span>
            <code className="text-gray-700 bg-gray-100 px-1 rounded">
              {entry.id}
            </code>
          </div>
          <div>
            <span className="text-gray-500">Block ID: </span>
            <code className="text-blue-700 bg-blue-50 px-1 rounded">
              {entry.blockId}
            </code>
          </div>
          <div>
            <span className="text-gray-500">Session ID: </span>
            <code className="text-purple-700 bg-purple-50 px-1 rounded">
              {entry.sessionId}
            </code>
          </div>
          <div>
            <span className="text-gray-500">Context: </span>
            <code className="text-gray-700 bg-gray-100 px-1 rounded">
              {entry.contextSource}
            </code>
          </div>
        </div>

        {/* Property change details */}
        {entry.propertyChanged && (
          <div>
            <span className="text-xs text-gray-500">
              Property Changed: {entry.propertyChanged}
            </span>
            <div className="grid grid-cols-2 gap-4 mt-1">
              <div>
                <span className="text-xs text-gray-500">Old Value:</span>
                <pre className="mt-1 p-2 bg-red-50 rounded text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-24">
                  {entry.oldValue || "(none)"}
                </pre>
              </div>
              <div>
                <span className="text-xs text-gray-500">New Value:</span>
                <pre className="mt-1 p-2 bg-green-50 rounded text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-24">
                  {entry.newValue || "(none)"}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Cascade info */}
        {entry.cascadeDepth > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3 h-3 text-yellow-500" />
            <span className="text-yellow-600">
              Cascade depth: {entry.cascadeDepth}
            </span>
            {entry.affectedBlocks && entry.affectedBlocks.length > 0 && (
              <span className="text-gray-500">
                ({entry.affectedBlocks.length} blocks affected)
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {onViewBlock && (
            <button
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 transition-colors"
              onClick={() => onViewBlock(entry.blockId)}
            >
              View Block
            </button>
          )}
          {onRevert && entry.changeType !== "deleted" && (
            <button
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 transition-colors text-yellow-600 flex items-center gap-1"
              onClick={() => onRevert(entry.id)}
            >
              <Undo2 className="w-3 h-3" />
              Revert
            </button>
          )}
        </div>
      </div>
    </td>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MemoryGraphChangeLog({
  sessionId,
  onRevert,
  onViewBlock,
  className = "",
}: MemoryGraphChangeLogProps) {
  // Search state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filter state
  const [changeTypeFilter, setChangeTypeFilter] = useState<ChangeType[]>([]);
  const [triggerFilter, setTriggerFilter] = useState<TriggerType[]>([]);
  const [timeRange, setTimeRange] = useState("24h");
  const [showCascades, setShowCascades] = useState(true);

  // UI state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data
  const { entries, loading, total, hasMore, loadMore, refresh } =
    useMemoryGraphChanges({
      sessionId,
      timeRange,
      changeType: changeTypeFilter.length > 0 ? changeTypeFilter : undefined,
      triggeredBy: triggerFilter.length > 0 ? triggerFilter : undefined,
      showCascades,
      search: debouncedSearch || undefined,
    });

  // Fetch stats
  const { stats } = useMemoryGraphStats(sessionId, timeRange);

  // Toggle functions
  const toggleChangeType = (type: ChangeType) => {
    setChangeTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const toggleTrigger = (trigger: TriggerType) => {
    setTriggerFilter((prev) =>
      prev.includes(trigger)
        ? prev.filter((t) => t !== trigger)
        : [...prev, trigger],
    );
  };

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

  // Export functionality
  const exportChanges = useCallback(() => {
    const data = JSON.stringify(entries, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memory-graph-changes-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  // Sorted entries
  const displayEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [entries]);

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with stats and search */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              Memory Graph Changes
            </h2>
            <p className="text-sm text-gray-500">
              Track all modifications to the memory graph
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
                <div className="text-xl font-semibold text-green-600">
                  {stats.byChangeType?.created || 0}
                </div>
                <div className="text-xs text-gray-500">Created</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-blue-600">
                  {stats.byChangeType?.modified || 0}
                </div>
                <div className="text-xs text-gray-500">Modified</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-yellow-600">
                  {stats.cascadeCount || 0}
                </div>
                <div className="text-xs text-gray-500">Cascades</div>
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
              placeholder="Search changes..."
              className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-48"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-2">
            {entries.length}/{total}
          </span>
          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="h-8 px-2 text-sm border border-gray-300 rounded-md bg-white"
          >
            <option value="1h">Last hour</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportChanges}
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
          {/* Change type tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Type:
            </span>
            {allChangeTypes.map((type) => {
              const isSelected = changeTypeFilter.includes(type);
              const TypeIcon = changeTypeIcons[type];
              return (
                <button
                  key={type}
                  onClick={() => toggleChangeType(type)}
                  className={clsx(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    isSelected
                      ? changeTypeColors[type]
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  <TypeIcon className="h-3 w-3" />
                  {type}
                </button>
              );
            })}
            {changeTypeFilter.length > 0 && (
              <button
                onClick={() => setChangeTypeFilter([])}
                className="text-xs text-gray-400 hover:text-gray-600 ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Trigger tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Trigger:</span>
            {allTriggerTypes.map((trigger) => {
              const isSelected = triggerFilter.includes(trigger);
              return (
                <button
                  key={trigger}
                  onClick={() => toggleTrigger(trigger)}
                  className={clsx(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    isSelected
                      ? triggerColors[trigger]
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {getTriggerIcon(trigger)}
                  {formatTriggerLabel(trigger)}
                </button>
              );
            })}
            {triggerFilter.length > 0 && (
              <button
                onClick={() => setTriggerFilter([])}
                className="text-xs text-gray-400 hover:text-gray-600 ml-1"
              >
                Clear
              </button>
            )}
            {/* Cascades toggle */}
            <label className="flex items-center gap-1 text-xs text-gray-500 ml-4">
              <input
                type="checkbox"
                checked={showCascades}
                onChange={(e) => setShowCascades(e.target.checked)}
                className="rounded"
              />
              Show cascades
            </label>
          </div>
        </div>

        {/* Table */}
        {displayEntries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
            <Clock className="h-12 w-12 mb-3 text-gray-300" />
            <p>No changes found</p>
            <p className="text-xs mt-1 text-gray-400">
              Changes will appear here as they occur
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
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Block
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayEntries.map((entry) => {
                  const isExpanded = expandedIds.has(entry.id);
                  const TypeIcon = changeTypeIcons[entry.changeType];

                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        className={clsx(
                          "hover:bg-gray-50 cursor-pointer",
                          entry.cascadeDepth > 0 && "bg-yellow-50/50",
                        )}
                        onClick={() => toggleExpand(entry.id)}
                      >
                        <td className="px-4 py-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                          {formatTimestamp(entry.timestamp)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                              changeTypeColors[entry.changeType],
                            )}
                          >
                            <TypeIcon className="h-3 w-3" />
                            {entry.changeType}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {entry.blockLabel || entry.blockId.slice(0, 16)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {entry.blockType}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                              triggerColors[entry.triggeredBy],
                            )}
                          >
                            {getTriggerIcon(entry.triggeredBy)}
                            {formatTriggerLabel(entry.triggeredBy)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600 max-w-md truncate">
                          {entry.propertyChanged ? (
                            <span>
                              {entry.propertyChanged}:{" "}
                              {entry.newValue?.slice(0, 40)}
                              {(entry.newValue?.length || 0) > 40 ? "..." : ""}
                            </span>
                          ) : entry.cascadeDepth > 0 ? (
                            <span className="text-yellow-600 flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              Cascade (depth {entry.cascadeDepth})
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <ExpandedRowContent
                            entry={entry}
                            onRevert={onRevert}
                            onViewBlock={onViewBlock}
                          />
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with Load More */}
        {(hasMore || entries.length > 0) && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {entries.length} changes loaded
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

export default MemoryGraphChangeLog;
