/**
 * ToolUseList - List of tool uses with filtering
 */

import { useState } from "react";
import { Clock, ChevronRight, Filter } from "lucide-react";
import { useToolUses } from "../../hooks/useObservability";
import ObsStatusBadge from "./ObsStatusBadge";
import type { ToolUse, ToolName } from "../../types/observability";

interface ToolUseListProps {
  executionId: string;
  onToolUseClick?: (toolUse: ToolUse) => void;
}

const toolIcons: Partial<Record<ToolName, string>> = {
  Read: "📖",
  Write: "✏️",
  Edit: "📝",
  Bash: "💻",
  Glob: "🔍",
  Grep: "🔎",
  Task: "🤖",
  WebFetch: "🌐",
  WebSearch: "🔍",
  Skill: "✨",
};

export default function ToolUseList({
  executionId,
  onToolUseClick,
}: ToolUseListProps) {
  const [filters, setFilters] = useState<{
    tool?: string;
    category?: string;
    status?: string;
  }>({});

  const { toolUses, loading, error, total, hasMore, refetch } = useToolUses(
    executionId,
    { ...filters, limit: 50 },
  );

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded">
        Error loading tool uses: {error.message}
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={filters.tool || ""}
          onChange={(e) =>
            setFilters({ ...filters, tool: e.target.value || undefined })
          }
          className="text-sm border-gray-300 rounded-md"
        >
          <option value="">All Tools</option>
          {Object.keys(toolIcons).map((tool) => (
            <option key={tool} value={tool}>
              {tool}
            </option>
          ))}
        </select>
        <select
          value={filters.status || ""}
          onChange={(e) =>
            setFilters({ ...filters, status: e.target.value || undefined })
          }
          className="text-sm border-gray-300 rounded-md"
        >
          <option value="">All Status</option>
          <option value="done">Done</option>
          <option value="error">Error</option>
          <option value="blocked">Blocked</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">{total} total</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {toolUses.length === 0 ? (
          <div className="text-gray-500 p-4 text-center">
            No tool uses found
          </div>
        ) : (
          toolUses.map((toolUse) => (
            <ToolUseItem
              key={toolUse.id}
              toolUse={toolUse}
              onClick={() => onToolUseClick?.(toolUse)}
            />
          ))
        )}
      </div>

      {hasMore && (
        <button
          onClick={refetch}
          className="mt-4 w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
        >
          Load more...
        </button>
      )}
    </div>
  );
}

interface ToolUseItemProps {
  toolUse: ToolUse;
  onClick?: () => void;
}

function ToolUseItem({ toolUse, onClick }: ToolUseItemProps) {
  const icon = toolIcons[toolUse.tool] || "🔧";

  return (
    <div
      className="flex items-center gap-3 p-3 bg-white border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <span className="text-xl">{icon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{toolUse.tool}</span>
          <ObsStatusBadge status={toolUse.resultStatus} size="sm" />
        </div>
        <p className="text-xs text-gray-500 truncate">{toolUse.inputSummary}</p>
      </div>

      <div className="flex items-center gap-2 text-gray-400">
        <span className="text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {toolUse.durationMs}ms
        </span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}
