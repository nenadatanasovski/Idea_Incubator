/**
 * ToolUseLog - Detailed list view of tool uses
 *
 * Features:
 * - Filterable by tool name, status
 * - Sortable by time, duration
 * - Expandable input/output
 * - Copy tool input
 * - Link to related entities
 */

import { useState, useMemo, useCallback } from "react";
import {
  Wrench,
  Filter,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { useToolUses } from "../../hooks/useObservability";
import type { ToolUse } from "../../types/observability";

interface ToolUseLogProps {
  executionId: string;
  onToolClick?: (toolUse: ToolUse) => void;
  onEntityClick?: (entityType: string, entityId: string) => void;
}

type SortField = "time" | "duration" | "tool";
type SortOrder = "asc" | "desc";

export default function ToolUseLog({
  executionId,
  onToolClick,
  onEntityClick,
}: ToolUseLogProps) {
  const { toolUses, loading } = useToolUses(executionId, { limit: 500 });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("time");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique tool names
  const toolNames = useMemo(() => {
    const names = new Set(toolUses.map((t) => t.tool));
    return Array.from(names).sort();
  }, [toolUses]);

  // Filter and sort
  const filteredToolUses = useMemo(() => {
    let result = toolUses;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.tool.toLowerCase().includes(query) ||
          JSON.stringify(t.input).toLowerCase().includes(query),
      );
    }

    // Tool filter
    if (selectedTool) {
      result = result.filter((t) => t.tool === selectedTool);
    }

    // Status filter
    if (selectedStatus) {
      result = result.filter((t) => {
        if (selectedStatus === "error") return t.isError;
        if (selectedStatus === "blocked") return t.isBlocked;
        if (selectedStatus === "success") return !t.isError && !t.isBlocked;
        return true;
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "time":
          cmp =
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          break;
        case "duration":
          cmp = (a.durationMs || 0) - (b.durationMs || 0);
          break;
        case "tool":
          cmp = a.tool.localeCompare(b.tool);
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    toolUses,
    searchQuery,
    selectedTool,
    selectedStatus,
    sortField,
    sortOrder,
  ]);

  // Toggle sort
  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortOrder("desc");
      }
    },
    [sortField],
  );

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Copy input
  const handleCopy = useCallback(async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedTool(null);
    setSelectedStatus(null);
  }, []);

  const hasActiveFilters = searchQuery || selectedTool || selectedStatus;

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-500" />
            <h3 className="font-medium text-gray-900">Tool Use Log</h3>
            <span className="text-xs text-gray-500">
              ({filteredToolUses.length}
              {filteredToolUses.length !== toolUses.length &&
                ` / ${toolUses.length}`}
              )
            </span>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded ${
              showFilters || hasActiveFilters
                ? "bg-blue-100 text-blue-600"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="mt-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={selectedTool || ""}
              onChange={(e) => setSelectedTool(e.target.value || null)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="">All Tools</option>
              {toolNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus || ""}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="blocked">Blocked</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-red-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Sort buttons */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => toggleSort("time")}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
              sortField === "time"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <ArrowUpDown className="h-3 w-3" />
            Time {sortField === "time" && (sortOrder === "asc" ? "↑" : "↓")}
          </button>
          <button
            onClick={() => toggleSort("duration")}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
              sortField === "duration"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Clock className="h-3 w-3" />
            Duration{" "}
            {sortField === "duration" && (sortOrder === "asc" ? "↑" : "↓")}
          </button>
          <button
            onClick={() => toggleSort("tool")}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
              sortField === "tool"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Wrench className="h-3 w-3" />
            Tool {sortField === "tool" && (sortOrder === "asc" ? "↑" : "↓")}
          </button>
        </div>
      </div>

      {/* Tool uses list */}
      <div className="divide-y max-h-96 overflow-auto">
        {filteredToolUses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {hasActiveFilters ? "No matching tool uses" : "No tool uses yet"}
          </div>
        ) : (
          filteredToolUses.map((toolUse) => {
            const isExpanded = expandedItems.has(toolUse.id);

            return (
              <div key={toolUse.id} className="hover:bg-gray-50">
                <button
                  onClick={() => toggleExpand(toolUse.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left"
                >
                  <span className="text-gray-400 mt-0.5">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>

                  {/* Status icon */}
                  {toolUse.isError ? (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : toolUse.isBlocked ? (
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {toolUse.tool}
                      </span>
                      {toolUse.durationMs !== undefined && (
                        <span className="text-xs text-gray-500">
                          {toolUse.durationMs}ms
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(toolUse.startTime).toLocaleTimeString()}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToolClick?.(toolUse);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="View details"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-3">
                    <div className="ml-10 space-y-2">
                      {/* Input */}
                      {toolUse.input && (
                        <div className="bg-gray-100 rounded-md overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-200">
                            <span className="text-xs font-medium text-gray-600">
                              Input
                            </span>
                            <button
                              onClick={() =>
                                handleCopy(
                                  JSON.stringify(toolUse.input, null, 2),
                                  `input-${toolUse.id}`,
                                )
                              }
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {copiedId === `input-${toolUse.id}` ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          <pre className="p-2 text-xs font-mono text-gray-700 overflow-auto max-h-32">
                            {JSON.stringify(toolUse.input, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Output */}
                      {toolUse.output && (
                        <div
                          className={`rounded-md overflow-hidden ${
                            toolUse.isError ? "bg-red-50" : "bg-gray-100"
                          }`}
                        >
                          <div
                            className={`flex items-center justify-between px-3 py-1.5 ${
                              toolUse.isError ? "bg-red-100" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`text-xs font-medium ${
                                toolUse.isError
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {toolUse.isError ? "Error" : "Output"}
                            </span>
                            <button
                              onClick={() =>
                                handleCopy(
                                  JSON.stringify(toolUse.output, null, 2),
                                  `output-${toolUse.id}`,
                                )
                              }
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {copiedId === `output-${toolUse.id}` ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                          <pre
                            className={`p-2 text-xs font-mono overflow-auto max-h-32 ${
                              toolUse.isError ? "text-red-700" : "text-gray-700"
                            }`}
                          >
                            {typeof toolUse.output === "string"
                              ? toolUse.output
                              : JSON.stringify(toolUse.output, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Related entities */}
                      {toolUse.withinSkill && (
                        <button
                          onClick={() =>
                            onEntityClick?.("skill", toolUse.withinSkill!)
                          }
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View Skill Invocation →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      {toolUses.length > 0 && (
        <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>{toolNames.length} unique tools</span>
            <span>
              Avg:{" "}
              {Math.round(
                toolUses.reduce((sum, t) => sum + (t.durationMs || 0), 0) /
                  toolUses.length,
              )}
              ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
