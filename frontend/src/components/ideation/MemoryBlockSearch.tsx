/**
 * Memory Block Search Component
 *
 * Search and filter memory blocks from Neo4j using full-text search.
 */

import React, { useState, useCallback, useMemo } from "react";
import type {
  BlockType,
  BlockStatus,
  MemoryBlock,
} from "../../api/memory-graph";
import { useMemoryBlocks } from "../../hooks/useMemoryGraph";

interface MemoryBlockSearchProps {
  sessionId: string;
  onSelectBlock?: (block: MemoryBlock) => void;
}

const BLOCK_TYPE_OPTIONS: {
  value: BlockType | "all";
  label: string;
  icon: string;
}[] = [
  { value: "all", label: "All Types", icon: "📊" },
  { value: "knowledge", label: "Knowledge", icon: "📚" },
  { value: "decision", label: "Decision", icon: "⚖️" },
  { value: "assumption", label: "Assumption", icon: "🤔" },
  { value: "question", label: "Question", icon: "❓" },
  { value: "requirement", label: "Requirement", icon: "📋" },
  { value: "task", label: "Task", icon: "✅" },
  { value: "proposal", label: "Proposal", icon: "💡" },
  { value: "artifact", label: "Artifact", icon: "📦" },
  { value: "evidence", label: "Evidence", icon: "🔍" },
];

const STATUS_OPTIONS: { value: BlockStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "validated", label: "Validated" },
  { value: "superseded", label: "Superseded" },
  { value: "abandoned", label: "Abandoned" },
];

export function MemoryBlockSearch({
  sessionId,
  onSelectBlock,
}: MemoryBlockSearchProps) {
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<BlockType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<BlockStatus | "all">("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  const debounceTimer = React.useRef<NodeJS.Timeout>();
  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  // Build query
  const query = useMemo(
    () => ({
      session_id: sessionId,
      block_type: typeFilter === "all" ? undefined : typeFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      search: debouncedSearch || undefined,
      limit: 50,
    }),
    [sessionId, typeFilter, statusFilter, debouncedSearch],
  );

  const { blocks, loading, error, refetch } = useMemoryBlocks(query);

  return (
    <div className="flex flex-col h-full">
      {/* Search Controls */}
      <div className="p-4 border-b space-y-3">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search blocks..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as BlockType | "all")}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {BLOCK_TYPE_OPTIONS.map(({ value, label, icon }) => (
              <option key={value} value={value}>
                {icon} {label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as BlockStatus | "all")
            }
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button
            onClick={() => refetch()}
            className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="text-center text-gray-500 py-8 animate-pulse">
            Searching...
          </div>
        )}

        {error && (
          <div className="text-center text-red-500 py-8">Error: {error}</div>
        )}

        {!loading && !error && blocks.length === 0 && (
          <div className="text-center text-gray-500 py-8">No blocks found</div>
        )}

        {!loading && !error && blocks.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500 mb-2">
              {blocks.length} block{blocks.length !== 1 ? "s" : ""} found
            </div>
            {blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                onClick={() => onSelectBlock?.(block)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface BlockCardProps {
  block: MemoryBlock;
  onClick?: () => void;
}

function BlockCard({ block, onClick }: BlockCardProps) {
  const typeInfo = BLOCK_TYPE_OPTIONS.find((t) => t.value === block.type);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-white border rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className="text-lg" title={block.type}>
          {typeInfo?.icon || "📄"}
        </span>
        <div className="flex-1 min-w-0">
          {block.title && (
            <div className="font-medium text-gray-900 truncate">
              {block.title}
            </div>
          )}
          <div className="text-sm text-gray-600 line-clamp-2">
            {block.content}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            <span
              className={`px-1.5 py-0.5 rounded ${
                block.status === "active"
                  ? "bg-green-100 text-green-700"
                  : block.status === "validated"
                    ? "bg-blue-100 text-blue-700"
                    : block.status === "draft"
                      ? "bg-gray-100 text-gray-700"
                      : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {block.status}
            </span>
            {block.confidence && (
              <span>Confidence: {Math.round(block.confidence * 100)}%</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default MemoryBlockSearch;
