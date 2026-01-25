/**
 * CycleIndicator Component
 * Compact, collapsible indicator for circular dependencies with node highlighting
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.2
 */

import { useMemo, useState, useEffect, useRef } from "react";
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
  /** Callback with all node IDs involved in cycles (for canvas highlighting) */
  onCycleNodeIds?: (nodeIds: string[]) => void;
  /** Callback when hovering over a cycle member row (for highlight and zoom) */
  onNodeHover?: (nodeId: string | null) => void;
  /** Callback when hovering over a cycle card header (for highlight all cycle nodes and zoom) */
  onCycleHover?: (nodeIds: string[] | null) => void;
  showAll?: boolean;
  className?: string;
  /** Start in collapsed state */
  defaultCollapsed?: boolean;
  /** External control for expanded state */
  isExpanded?: boolean;
  /** Callback when expansion state changes */
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * Compact cycle pill for minimized state
 */
function CyclePill({
  count,
  blockingCount,
  onClick,
}: {
  count: number;
  blockingCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full shadow-sm transition-all hover:shadow-md"
      data-testid="cycle-pill"
    >
      <div className="flex items-center gap-1.5">
        <svg
          className="w-4 h-4 text-amber-600"
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
        <span className="text-sm font-medium text-amber-800">
          {count} {count === 1 ? "Cycle" : "Cycles"}
        </span>
      </div>
      {blockingCount > 0 && (
        <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          {blockingCount} blocking
        </span>
      )}
      <svg
        className="w-4 h-4 text-amber-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}

/**
 * Compact cycle member row
 */
function CycleMemberRow({
  node,
  isSuggested,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  node: GraphNode;
  isSuggested?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded text-left w-full
        transition-colors text-sm
        ${isSuggested ? "bg-green-50 hover:bg-green-100" : "hover:bg-gray-100"}
      `}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: nodeColors[node.blockType] }}
      />
      <span className="truncate flex-1 text-gray-700">
        {node.label || node.content?.substring(0, 30)}
      </span>
      {isSuggested && (
        <span className="text-xs text-green-600 font-medium flex-shrink-0">
          Break here
        </span>
      )}
    </button>
  );
}

/**
 * Expanded cycle card - compact version
 */
function CompactCycleCard({
  cycle,
  nodes,
  suggestedBreakPoint,
  onNodeClick,
  onNodeHover,
  onCycleHover,
  isActive,
  onToggle,
}: {
  cycle: DetectedCycle;
  nodes: GraphNode[];
  suggestedBreakPoint?: string;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onCycleHover?: (nodeIds: string[] | null) => void;
  isActive: boolean;
  onToggle: () => void;
}) {
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
      className={`border rounded-lg transition-all ${
        isActive
          ? "border-amber-300 bg-amber-50/50"
          : "border-gray-200 bg-white"
      }`}
      data-testid={`cycle-card-${cycle.id}`}
    >
      {/* Compact header */}
      <button
        onClick={onToggle}
        onMouseEnter={
          onCycleHover ? () => onCycleHover(cycle.members) : undefined
        }
        onMouseLeave={onCycleHover ? () => onCycleHover(null) : undefined}
        className="w-full px-3 py-2 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              cycle.type === "blocking" ? "bg-red-500" : "bg-amber-500"
            }`}
          />
          <span className="text-sm font-medium text-gray-800">
            {cycle.members.length} nodes
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              cycle.type === "blocking"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {cycle.type}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isActive ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded content */}
      {isActive && (
        <div className="px-3 pb-3 space-y-2">
          {/* Cycle path visualization - horizontal scroll */}
          <div className="flex items-center gap-1 text-xs text-gray-500 overflow-x-auto pb-1">
            {cycle.members.map((memberId) => {
              const node = nodeMap.get(memberId);
              return (
                <span
                  key={memberId}
                  className="flex items-center gap-1 flex-shrink-0"
                >
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap"
                    style={{
                      backgroundColor: node
                        ? `${nodeColors[node.blockType]}20`
                        : "#f3f4f6",
                      color: node ? nodeColors[node.blockType] : "#6b7280",
                    }}
                  >
                    {node?.label?.substring(0, 12) || "..."}
                  </span>
                  <span className="text-gray-400">→</span>
                </span>
              );
            })}
            <span className="text-amber-500">↺</span>
          </div>

          {/* Member list */}
          <div className="space-y-0.5">
            {memberNodes.map((node) => (
              <CycleMemberRow
                key={node.id}
                node={node}
                isSuggested={node.id === suggestedBreakPoint}
                onClick={onNodeClick ? () => onNodeClick(node.id) : undefined}
                onMouseEnter={
                  onNodeHover ? () => onNodeHover(node.id) : undefined
                }
                onMouseLeave={onNodeHover ? () => onNodeHover(null) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CycleIndicator Component
 * Displays cycle information in a compact, collapsible format
 */
export function CycleIndicator({
  nodeId,
  nodes,
  edges,
  onNodeClick,
  onBreakCycle: _onBreakCycle, // TODO: implement break cycle feature
  onCycleNodeIds,
  onNodeHover,
  onCycleHover,
  showAll = false,
  className = "",
  defaultCollapsed = true,
  isExpanded: externalExpanded,
  onExpandedChange,
}: CycleIndicatorProps) {
  // Use external state if provided, otherwise use internal state
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed =
    externalExpanded !== undefined ? !externalExpanded : internalCollapsed;

  const setIsCollapsed = (collapsed: boolean) => {
    if (onExpandedChange) {
      onExpandedChange(!collapsed);
    } else {
      setInternalCollapsed(collapsed);
    }
  };

  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);

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

  // Track if we've auto-expanded the first cycle
  const hasAutoExpanded = useRef(false);

  // Auto-expand the first cycle when cycles are available
  useEffect(() => {
    if (cycles.length > 0 && !hasAutoExpanded.current) {
      setActiveCycleId(cycles[0].id);
      hasAutoExpanded.current = true;
    }
  }, [cycles]);

  // Collect all cycle node IDs and notify parent
  const allCycleNodeIds = useMemo(() => {
    const nodeIds = new Set<string>();
    cycles.forEach((cycle) => {
      cycle.members.forEach((id) => nodeIds.add(id));
    });
    return Array.from(nodeIds);
  }, [cycles]);

  // Notify parent of cycle node IDs for canvas highlighting
  useEffect(() => {
    onCycleNodeIds?.(allCycleNodeIds);
  }, [allCycleNodeIds, onCycleNodeIds]);

  const blockingCount = cycles.filter((c) => c.type === "blocking").length;

  // No cycles found - don't render anything
  if (cycles.length === 0) {
    return null;
  }

  // Collapsed state - show pill
  if (isCollapsed) {
    return (
      <div className={className} data-testid="cycle-indicator">
        <CyclePill
          count={cycles.length}
          blockingCount={blockingCount}
          onClick={() => setIsCollapsed(false)}
        />
      </div>
    );
  }

  // Expanded state
  return (
    <div
      className={`bg-white rounded-lg shadow-lg border border-gray-200 w-72 ${className}`}
      data-testid="cycle-indicator"
    >
      {/* Header with minimize button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-amber-500"
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
          <span className="text-sm font-medium text-gray-800">
            {cycles.length} Circular{" "}
            {cycles.length === 1 ? "Dependency" : "Dependencies"}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Minimize"
          data-testid="cycle-minimize-btn"
        >
          <svg
            className="w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 12H6"
            />
          </svg>
        </button>
      </div>

      {/* Stats bar */}
      <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex gap-2">
        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
          {blockingCount} blocking
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
          {cycles.length - blockingCount} reinforcing
        </span>
      </div>

      {/* Cycle list */}
      <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
        {cycles.map((cycle) => (
          <CompactCycleCard
            key={cycle.id}
            cycle={cycle}
            nodes={nodes}
            suggestedBreakPoint={analysis.suggestedBreakPoints.get(cycle.id)}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
            onCycleHover={onCycleHover}
            isActive={activeCycleId === cycle.id}
            onToggle={() =>
              setActiveCycleId(activeCycleId === cycle.id ? null : cycle.id)
            }
          />
        ))}
      </div>
    </div>
  );
}

export default CycleIndicator;
