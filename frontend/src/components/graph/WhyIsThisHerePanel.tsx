/**
 * WhyIsThisHerePanel Component
 * Displays the abstraction chain to explain why a node exists
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.4
 */

import { useMemo } from "react";
import type { GraphNode, GraphEdge } from "../../types/graph";
import { nodeColors } from "../../types/graph";
import {
  buildAbstractionChain,
  ABSTRACTION_ORDER,
  type AbstractionChainNode,
} from "./utils/abstractionTraversal";

export interface WhyIsThisHerePanelProps {
  nodeId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

/**
 * Abstraction level badge with color coding
 */
function AbstractionLevelBadge({ level }: { level?: string }) {
  const colors: Record<string, string> = {
    vision: "bg-purple-100 text-purple-700",
    strategy: "bg-blue-100 text-blue-700",
    tactic: "bg-green-100 text-green-700",
    implementation: "bg-amber-100 text-amber-700",
  };

  const colorClass = level ? colors[level] : "bg-gray-100 text-gray-700";

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {level || "unspecified"}
    </span>
  );
}

/**
 * Chain node item component
 */
function ChainNodeItem({
  chainNode,
  direction,
  onClick,
}: {
  chainNode: AbstractionChainNode;
  direction: "up" | "down" | "current";
  onClick?: () => void;
}) {
  const { node, abstractionLevel, hopDistance } = chainNode;

  const directionStyles = {
    up: "border-l-4 border-l-purple-400",
    down: "border-l-4 border-l-amber-400",
    current: "border-l-4 border-l-blue-500 bg-blue-50",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors ${directionStyles[direction]}`}
    >
      <div className="flex items-start gap-3">
        {/* Node indicator */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: `${nodeColors[node.blockType]}20`,
            color: nodeColors[node.blockType],
          }}
        >
          {direction === "current" ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="6" />
            </svg>
          ) : (
            <span className="text-xs font-medium">{hopDistance}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Node label */}
          <h4 className="font-medium text-gray-900 truncate">{node.label}</h4>

          {/* Metadata row */}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: `${nodeColors[node.blockType]}20`,
                color: nodeColors[node.blockType],
              }}
            >
              {node.blockType}
            </span>
            <AbstractionLevelBadge level={abstractionLevel} />
          </div>
        </div>

        {/* Direction indicator */}
        <div className="flex-shrink-0 text-gray-400">
          {direction === "up" && (
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
                d="M5 15l7-7 7 7"
              />
            </svg>
          )}
          {direction === "down" && (
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
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * WhyIsThisHerePanel Component
 * Shows the abstraction chain to explain why a node exists
 */
export function WhyIsThisHerePanel({
  nodeId,
  nodes,
  edges,
  onNodeClick,
  className = "",
}: WhyIsThisHerePanelProps) {
  // Build the abstraction chain
  const chain = useMemo(() => {
    try {
      return buildAbstractionChain(nodeId, nodes, edges);
    } catch {
      return null;
    }
  }, [nodeId, nodes, edges]);

  if (!chain) {
    return (
      <div className={`p-4 ${className}`}>
        <p className="text-sm text-gray-500 italic">
          Unable to build abstraction chain for this node.
        </p>
      </div>
    );
  }

  const { current, ancestors, descendants, whyIsThisHere } = chain;

  const hasChain = ancestors.length > 0 || descendants.length > 0;

  return (
    <div
      className={`space-y-4 ${className}`}
      data-testid="why-is-this-here-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-purple-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-sm font-medium text-gray-900">Why is this here?</h3>
      </div>

      {/* Explanation text */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-700 space-y-1">
          {whyIsThisHere.map((line, i) => (
            <p
              key={i}
              className={line.startsWith("  ") ? "font-mono text-xs" : ""}
            >
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Abstraction hierarchy visualization */}
      {hasChain && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Abstraction Hierarchy
          </h4>

          {/* Level guide */}
          <div className="flex items-center justify-between text-xs text-gray-400 px-2 mb-2">
            {ABSTRACTION_ORDER.map((level, i) => (
              <div key={level} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300">→</span>}
                <span className="capitalize">{level}</span>
              </div>
            ))}
          </div>

          {/* Ancestors (more abstract, shown first) */}
          {ancestors.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-purple-600 font-medium">
                ↑ More Abstract ({ancestors.length})
              </span>
              <div className="space-y-1">
                {[...ancestors].reverse().map((ancestor) => (
                  <ChainNodeItem
                    key={ancestor.id}
                    chainNode={ancestor}
                    direction="up"
                    onClick={
                      onNodeClick ? () => onNodeClick(ancestor.id) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Current node */}
          <div className="py-2">
            <span className="text-xs text-blue-600 font-medium mb-1 block">
              Current Node
            </span>
            <ChainNodeItem
              chainNode={{
                id: current.id,
                node: current,
                abstractionLevel: current.abstractionLevel,
                direction: "current",
                hopDistance: 0,
              }}
              direction="current"
            />
          </div>

          {/* Descendants (more concrete, shown last) */}
          {descendants.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-amber-600 font-medium">
                ↓ More Concrete ({descendants.length})
              </span>
              <div className="space-y-1">
                {descendants.map((descendant) => (
                  <ChainNodeItem
                    key={descendant.id}
                    chainNode={descendant}
                    direction="down"
                    onClick={
                      onNodeClick ? () => onNodeClick(descendant.id) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No chain message */}
      {!hasChain && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">
            This node has no implements/implemented_by relationships. It stands
            alone in the abstraction hierarchy.
          </p>
        </div>
      )}
    </div>
  );
}

export default WhyIsThisHerePanel;
