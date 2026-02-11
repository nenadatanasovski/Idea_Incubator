/**
 * Memory Graph Statistics Panel
 *
 * Displays Neo4j memory graph statistics for the current session.
 */

import {
  useMemoryStats,
  useMemoryGraphHealth,
} from "../../hooks/useMemoryGraph";
import type { BlockType } from "../../api/memory-graph";

interface MemoryGraphStatsProps {
  sessionId?: string;
  compact?: boolean;
}

const BLOCK_TYPE_ICONS: Record<BlockType, string> = {
  knowledge: "📚",
  decision: "⚖️",
  assumption: "🤔",
  question: "❓",
  requirement: "📋",
  task: "✅",
  proposal: "💡",
  artifact: "📦",
  evidence: "🔍",
};

const BLOCK_TYPE_COLORS: Record<BlockType, string> = {
  knowledge: "bg-blue-100 text-blue-800",
  decision: "bg-purple-100 text-purple-800",
  assumption: "bg-yellow-100 text-yellow-800",
  question: "bg-orange-100 text-orange-800",
  requirement: "bg-red-100 text-red-800",
  task: "bg-green-100 text-green-800",
  proposal: "bg-indigo-100 text-indigo-800",
  artifact: "bg-gray-100 text-gray-800",
  evidence: "bg-teal-100 text-teal-800",
};

export function MemoryGraphStats({
  sessionId,
  compact = false,
}: MemoryGraphStatsProps) {
  const { stats, loading, error } = useMemoryStats(sessionId);
  const { healthy, loading: healthLoading } = useMemoryGraphHealth();

  if (loading || healthLoading) {
    return (
      <div className="p-4 text-gray-500 animate-pulse">
        Loading memory graph...
      </div>
    );
  }

  if (!healthy) {
    return (
      <div className="p-4 text-amber-600 bg-amber-50 rounded-lg">
        <span className="font-medium">⚠️ Memory Graph Offline</span>
        <p className="text-sm mt-1">Neo4j service not available</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        <span className="font-medium">Error:</span> {error}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span title="Total Blocks">📊 {stats.total_blocks} blocks</span>
        <span title="Total Links">🔗 {stats.total_links} links</span>
      </div>
    );
  }

  const blockTypes = Object.entries(stats.blocks_by_type) as [
    BlockType,
    number,
  ][];

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        🧠 Memory Graph
        <span className="text-xs font-normal text-green-600 bg-green-100 px-2 py-0.5 rounded">
          Connected
        </span>
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {stats.total_blocks}
          </div>
          <div className="text-sm text-gray-500">Total Blocks</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {stats.total_links}
          </div>
          <div className="text-sm text-gray-500">Total Links</div>
        </div>
      </div>

      {/* Block Type Breakdown */}
      {blockTypes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">By Type</h4>
          <div className="flex flex-wrap gap-2">
            {blockTypes.map(([type, count]) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${BLOCK_TYPE_COLORS[type]}`}
              >
                {BLOCK_TYPE_ICONS[type]} {type}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status Breakdown */}
      {Object.keys(stats.blocks_by_status).length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">By Status</h4>
          <div className="flex gap-4 text-sm">
            {Object.entries(stats.blocks_by_status).map(([status, count]) => (
              <span key={status} className="text-gray-600">
                {status}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MemoryGraphStats;
