/**
 * CycleIndicator Component
 * Visualizes detected cycles and provides break point suggestions
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.2
 */

import { useMemo } from "react";
import type { GraphNode, GraphEdge } from "../../types/graph";
import { nodeColors } from "../../types/graph";
import {
  analyzeCycles,
  getNodeCycleInfo,
  type DetectedCycle,
  type CycleAnalysis,
} from "./utils/cycleDetection";

export interface CycleIndicatorProps {
  nodeId?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  onBreakCycle?: (cycleId: string, breakPointId: string) => void;
  showAll?: boolean;
  className?: string;
}

/**
 * Cycle type badge component
 */
function CycleTypeBadge({ type }: { type: "blocking" | "reinforcing" }) {
  const styles: Record<string, string> = {
    blocking: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
    reinforcing:
      "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
  };

  const icons: Record<string, JSX.Element> = {
    blocking: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
    ),
    reinforcing: (
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${styles[type]}`}
    >
      {icons[type]}
      {type}
    </span>
  );
}

/**
 * Cycle member node component
 */
function CycleMemberNode({
  node,
  isBreakPoint,
  isSuggested,
  onClick,
}: {
  node: GraphNode;
  isBreakPoint?: boolean;
  isSuggested?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 p-2 rounded-lg text-left w-full
        border transition-colors
        ${
          isSuggested
            ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
            : isBreakPoint
              ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        }
      `}
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `${nodeColors[node.blockType]}20`,
          color: nodeColors[node.blockType],
        }}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="6" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">
          {node.label}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {node.blockType}
        </span>
      </div>
      {isSuggested && (
        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
          Suggested break
        </span>
      )}
    </button>
  );
}

/**
 * Single cycle card component
 */
function CycleCard({
  cycle,
  nodes,
  suggestedBreakPoint,
  onNodeClick,
  onBreakCycle,
}: {
  cycle: DetectedCycle;
  nodes: GraphNode[];
  suggestedBreakPoint?: string;
  onNodeClick?: (nodeId: string) => void;
  onBreakCycle?: (cycleId: string, breakPointId: string) => void;
}) {
  // Get node objects for cycle members
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const memberNodes = cycle.members
    .map((id) => nodeMap.get(id))
    .filter((n): n is GraphNode => n !== undefined);

  return (
    <div
      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
      data-testid={`cycle-card-${cycle.id}`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Circular Dependency
          </span>
          <CycleTypeBadge type={cycle.type} />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {cycle.members.length} nodes
        </span>
      </div>

      {/* Cycle visualization */}
      <div className="p-4">
        {/* Arrow path visualization */}
        <div className="flex items-center justify-center mb-4 text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-1 text-xs">
            {cycle.members.map((memberId, index) => {
              const node = nodeMap.get(memberId);
              const linkType =
                index < cycle.linkTypes.length ? cycle.linkTypes[index] : null;
              return (
                <span key={memberId} className="flex items-center gap-1">
                  <span
                    className="px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: node
                        ? `${nodeColors[node.blockType]}20`
                        : undefined,
                      color: node ? nodeColors[node.blockType] : undefined,
                    }}
                  >
                    {node?.label.substring(0, 10)}...
                  </span>
                  {linkType && (
                    <>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-500 text-[10px]">
                        {linkType.replace(/_/g, " ")}
                      </span>
                      <span className="text-gray-400">→</span>
                    </>
                  )}
                </span>
              );
            })}
            <span className="text-gray-400">↺</span>
          </div>
        </div>

        {/* Member nodes list */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Cycle Members
          </h4>
          <div className="space-y-1">
            {memberNodes.map((node) => (
              <CycleMemberNode
                key={node.id}
                node={node}
                isSuggested={node.id === suggestedBreakPoint}
                onClick={onNodeClick ? () => onNodeClick(node.id) : undefined}
              />
            ))}
          </div>
        </div>

        {/* Break cycle action */}
        {suggestedBreakPoint && onBreakCycle && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => onBreakCycle(cycle.id, suggestedBreakPoint)}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Break Cycle at "{nodeMap.get(suggestedBreakPoint)?.label}"
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CycleIndicator Component
 * Displays cycle information for a node or all cycles in the graph
 */
export function CycleIndicator({
  nodeId,
  nodes,
  edges,
  onNodeClick,
  onBreakCycle,
  showAll = false,
  className = "",
}: CycleIndicatorProps) {
  // Analyze cycles
  const analysis = useMemo<CycleAnalysis>(() => {
    return analyzeCycles(nodes, edges);
  }, [nodes, edges]);

  // Get relevant cycles
  const cycles = useMemo(() => {
    if (showAll) {
      return analysis.cycles;
    }
    if (nodeId) {
      return getNodeCycleInfo(nodeId, analysis);
    }
    return [];
  }, [analysis, nodeId, showAll]);

  // No cycles found
  if (cycles.length === 0) {
    return (
      <div className={`p-4 ${className}`} data-testid="cycle-indicator">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm">No circular dependencies detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`} data-testid="cycle-indicator">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {cycles.length} Circular{" "}
            {cycles.length === 1 ? "Dependency" : "Dependencies"} Detected
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
            {cycles.filter((c) => c.type === "blocking").length} blocking
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
            {cycles.filter((c) => c.type === "reinforcing").length} reinforcing
          </span>
        </div>
      </div>

      {/* Cycle cards */}
      <div className="space-y-4">
        {cycles.map((cycle) => (
          <CycleCard
            key={cycle.id}
            cycle={cycle}
            nodes={nodes}
            suggestedBreakPoint={analysis.suggestedBreakPoints.get(cycle.id)}
            onNodeClick={onNodeClick}
            onBreakCycle={onBreakCycle}
          />
        ))}
      </div>
    </div>
  );
}

export default CycleIndicator;
