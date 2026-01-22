/**
 * Memory Graph Change Log Component
 *
 * Displays a real-time log of all changes to the Memory Graph
 * including creates, modifications, supersessions, links, and deletions.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
  Clock,
  User,
  Bot,
  Zap,
  Undo2,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type ChangeType =
  | "created"
  | "modified"
  | "superseded"
  | "linked"
  | "unlinked"
  | "deleted";

export type TriggerType =
  | "user"
  | "ai_auto"
  | "ai_confirmed"
  | "cascade"
  | "system";

export interface GraphChangeEntry {
  id: string;
  timestamp: string;
  changeType: ChangeType;
  blockId: string;
  blockType: string;
  blockLabel?: string;
  propertyChanged?: string;
  oldValue?: string;
  newValue?: string;
  triggeredBy: TriggerType;
  contextSource: string;
  sessionId: string;
  cascadeDepth: number;
  affectedBlocks?: string[];
}

export interface MemoryGraphChangeLogProps {
  sessionId?: string;
  onRevert?: (entryId: string) => void;
  onViewBlock?: (blockId: string) => void;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getChangeTypeColor(type: ChangeType): string {
  switch (type) {
    case "created":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "modified":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "superseded":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "linked":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "unlinked":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "deleted":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  }
}

function getTriggerIcon(trigger: TriggerType) {
  switch (trigger) {
    case "user":
      return <User className="w-4 h-4" />;
    case "ai_auto":
      return <Bot className="w-4 h-4" />;
    case "ai_confirmed":
      return <Bot className="w-4 h-4 text-green-500" />;
    case "cascade":
      return <Zap className="w-4 h-4 text-yellow-500" />;
    case "system":
      return <RefreshCw className="w-4 h-4" />;
    default:
      return null;
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Old/New Values */}
        {entry.propertyChanged && (
          <div className="col-span-2 space-y-2">
            <h4 className="font-medium text-gray-700 dark:text-gray-300">
              Property: {entry.propertyChanged}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500">Old Value</span>
                <pre className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs overflow-auto max-h-24">
                  {entry.oldValue || "(none)"}
                </pre>
              </div>
              <div>
                <span className="text-xs text-gray-500">New Value</span>
                <pre className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs overflow-auto max-h-24">
                  {entry.newValue || "(none)"}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Context */}
        <div>
          <span className="text-xs text-gray-500">Context Source</span>
          <p className="mt-1 text-gray-700 dark:text-gray-300">
            {entry.contextSource}
          </p>
        </div>

        <div>
          <span className="text-xs text-gray-500">Session</span>
          <p className="mt-1 text-gray-700 dark:text-gray-300 font-mono text-xs">
            {entry.sessionId}
          </p>
        </div>

        {/* Cascade Info */}
        {entry.cascadeDepth > 0 && (
          <div className="col-span-2">
            <span className="text-xs text-gray-500">Cascade Depth</span>
            <p className="mt-1 text-yellow-600 dark:text-yellow-400">
              Level {entry.cascadeDepth} (downstream effect)
            </p>
            {entry.affectedBlocks && entry.affectedBlocks.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-gray-500">Affected Blocks</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.affectedBlocks.map((blockId) => (
                    <button
                      key={blockId}
                      onClick={() => onViewBlock?.(blockId)}
                      className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      {blockId.slice(0, 12)}...
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        {onViewBlock && (
          <button
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => onViewBlock(entry.blockId)}
          >
            View Block
          </button>
        )}
        {onRevert && entry.changeType !== "deleted" && (
          <button
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-yellow-600 hover:text-yellow-700 flex items-center gap-1"
            onClick={() => onRevert(entry.id)}
          >
            <Undo2 className="w-4 h-4" />
            Revert
          </button>
        )}
      </div>
    </div>
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
  const [entries, setEntries] = useState<GraphChangeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filters
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [showCascades, setShowCascades] = useState(true);

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (sessionId) params.append("sessionId", sessionId);
      params.append("timeRange", timeRange);
      if (changeTypeFilter !== "all")
        params.append("changeType", changeTypeFilter);
      if (triggerFilter !== "all") params.append("triggeredBy", triggerFilter);
      params.append("showCascades", String(showCascades));

      const response = await fetch(
        `/api/observability/memory-graph/changes?${params}`,
      );
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error("Failed to fetch graph changes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, timeRange, changeTypeFilter, triggerFilter, showCascades]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Toggle row expansion
  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Filtered and sorted entries
  const displayEntries = useMemo(() => {
    return entries.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [entries]);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Memory Graph Change Log
        </h3>
        <div className="flex items-center gap-2">
          <button
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            onClick={fetchEntries}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <Filter className="w-4 h-4 text-gray-500" />

        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="1h">Last hour</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="all">All time</option>
        </select>

        <select
          value={changeTypeFilter}
          onChange={(e) => setChangeTypeFilter(e.target.value)}
          className="h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All types</option>
          <option value="created">Created</option>
          <option value="modified">Modified</option>
          <option value="superseded">Superseded</option>
          <option value="linked">Linked</option>
          <option value="unlinked">Unlinked</option>
          <option value="deleted">Deleted</option>
        </select>

        <select
          value={triggerFilter}
          onChange={(e) => setTriggerFilter(e.target.value)}
          className="h-8 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All triggers</option>
          <option value="user">User</option>
          <option value="ai_auto">AI Auto</option>
          <option value="ai_confirmed">AI Confirmed</option>
          <option value="cascade">Cascade</option>
          <option value="system">System</option>
        </select>

        <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 ml-2">
          <input
            type="checkbox"
            checked={showCascades}
            onChange={(e) => setShowCascades(e.target.checked)}
            className="rounded"
          />
          Show cascades
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4 inline mr-1" />
                Timestamp
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                Type
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                Block
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                Property
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                Triggered By
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {displayEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  {isLoading
                    ? "Loading changes..."
                    : "No changes found for the selected filters"}
                </td>
              </tr>
            ) : (
              displayEntries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                      entry.cascadeDepth > 0
                        ? "bg-yellow-50/50 dark:bg-yellow-900/10"
                        : ""
                    }`}
                    onClick={() => toggleRow(entry.id)}
                  >
                    <td className="px-2 py-2 text-center">
                      {expandedRows.has(entry.id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getChangeTypeColor(entry.changeType)}`}
                      >
                        {entry.changeType}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-gray-900 dark:text-white font-mono text-xs">
                          {entry.blockLabel || entry.blockId.slice(0, 16)}...
                        </span>
                        <span className="text-xs text-gray-500">
                          {entry.blockType}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {entry.propertyChanged || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {getTriggerIcon(entry.triggeredBy)}
                        <span className="text-gray-600 dark:text-gray-400">
                          {entry.triggeredBy.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {expandedRows.has(entry.id) && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <ExpandedRowContent
                          entry={entry}
                          onRevert={onRevert}
                          onViewBlock={onViewBlock}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        Showing {displayEntries.length} changes
      </div>
    </div>
  );
}

export default MemoryGraphChangeLog;
