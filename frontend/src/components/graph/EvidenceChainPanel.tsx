/**
 * EvidenceChainPanel Component
 * Visualizes evidence chains and confidence propagation
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T7.1
 */

import { useMemo } from "react";
import type { GraphNode, GraphEdge } from "../../types/graph";
import { nodeColors } from "../../types/graph";
import {
  analyzeEvidenceChain,
  STRENGTH_MULTIPLIERS,
  type EvidenceChainNode,
} from "./utils/evidenceChain";

export interface EvidenceChainPanelProps {
  nodeId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

/**
 * Get confidence color based on value
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return "text-green-600";
  if (confidence >= 0.4) return "text-yellow-600";
  return "text-red-600";
}

/**
 * Get background color for confidence bar
 */
function getConfidenceBarColor(confidence: number): string {
  if (confidence >= 0.7) return "bg-green-500";
  if (confidence >= 0.4) return "bg-yellow-500";
  return "bg-red-500";
}

/**
 * Strength badge component
 */
function StrengthBadge({
  strength,
}: {
  strength?: "strong" | "moderate" | "weak";
}) {
  if (!strength) return null;

  const styles: Record<string, string> = {
    strong: "bg-green-100 text-green-700",
    moderate: "bg-yellow-100 text-yellow-700",
    weak: "bg-red-100 text-red-700",
  };

  const multiplier = STRENGTH_MULTIPLIERS[strength];

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${styles[strength]}`}
    >
      {strength} (×{multiplier})
    </span>
  );
}

/**
 * Status badge component
 */
function StatusBadge({
  status,
}: {
  status: "active" | "invalidated" | "superseded";
}) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    superseded: "bg-gray-100 text-gray-700",
    invalidated: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

/**
 * Chain node item component
 */
function ChainNodeItem({
  chainNode,
  isLast,
  onClick,
}: {
  chainNode: EvidenceChainNode;
  isLast: boolean;
  onClick?: () => void;
}) {
  const { node, confidence, evidenceStrength, status } = chainNode;

  return (
    <div className="relative">
      {/* Connection line */}
      {!isLast && (
        <div className="absolute left-4 top-12 w-0.5 h-8 bg-gray-300" />
      )}

      <button
        onClick={onClick}
        className="w-full p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
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
            <span className="text-xs font-medium">{chainNode.hopDistance}</span>
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
              <StatusBadge status={status} />
              {evidenceStrength && (
                <StrengthBadge strength={evidenceStrength} />
              )}
            </div>

            {/* Confidence bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getConfidenceBarColor(confidence)}`}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span
                className={`text-xs font-medium ${getConfidenceColor(confidence)}`}
              >
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

/**
 * Warning banner component
 */
function WarningBanner({
  type,
  message,
}: {
  type: "invalidated" | "superseded" | "low";
  message: string;
}) {
  const styles: Record<string, string> = {
    invalidated: "bg-red-50 border-red-200border-red-800 text-red-700",
    superseded:
      "bg-yellow-50bg-yellow-900/20 border-yellow-200border-yellow-800 text-yellow-700",
    low: "bg-orange-50bg-orange-900/20 border-orange-200border-orange-800 text-orange-700text-orange-300",
  };

  const icons: Record<string, JSX.Element> = {
    invalidated: (
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
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    superseded: (
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
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    low: (
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
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-lg border ${styles[type]}`}
    >
      {icons[type]}
      <span className="text-sm">{message}</span>
    </div>
  );
}

/**
 * EvidenceChainPanel Component
 * Displays the evidence chain for a selected node
 */
export function EvidenceChainPanel({
  nodeId,
  nodes,
  edges,
  onNodeClick,
  className = "",
}: EvidenceChainPanelProps) {
  // Analyze the evidence chain
  const analysis = useMemo(() => {
    return analyzeEvidenceChain(nodeId, nodes, edges);
  }, [nodeId, nodes, edges]);

  const {
    nodes: chainNodes,
    derivedConfidence,
    hasInvalidatedSource,
    hasSupersededSource,
    totalStrengthMultiplier,
  } = analysis;

  // No chain if only one node
  if (chainNodes.length <= 1) {
    return (
      <div className={`p-4 ${className}`}>
        <p className="text-sm text-gray-500text-gray-400 italic">
          No evidence chain found for this node.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`space-y-4 ${className}`}
      data-testid="evidence-chain-panel"
    >
      {/* Derived confidence summary */}
      <div className="p-4 bg-gray-50bg-gray-800/50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Derived Confidence
          </span>
          <span
            className={`text-lg font-bold ${getConfidenceColor(derivedConfidence)}`}
          >
            {Math.round(derivedConfidence * 100)}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getConfidenceBarColor(derivedConfidence)}`}
            style={{ width: `${derivedConfidence * 100}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500text-gray-400">
          Chain length: {chainNodes.length} nodes • Total strength: ×
          {totalStrengthMultiplier.toFixed(2)}
        </div>
      </div>

      {/* Warnings */}
      {hasInvalidatedSource && (
        <WarningBanner
          type="invalidated"
          message="Evidence chain contains an invalidated source. Confidence may be unreliable."
        />
      )}

      {hasSupersededSource && !hasInvalidatedSource && (
        <WarningBanner
          type="superseded"
          message="Evidence chain contains a superseded source. Consider updating to newer evidence."
        />
      )}

      {derivedConfidence < 0.3 && !hasInvalidatedSource && (
        <WarningBanner
          type="low"
          message="Low derived confidence. Evidence chain may need strengthening."
        />
      )}

      {/* Chain visualization */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-500text-gray-400 uppercase tracking-wider">
          Evidence Chain
        </h4>
        <div className="space-y-2">
          {chainNodes.map((chainNode, index) => (
            <ChainNodeItem
              key={chainNode.id}
              chainNode={chainNode}
              isLast={index === chainNodes.length - 1}
              onClick={
                onNodeClick ? () => onNodeClick(chainNode.id) : undefined
              }
            />
          ))}
        </div>
      </div>

      {/* Calculation breakdown */}
      <div className="p-3 bg-gray-50bg-gray-800/50 rounded-lg">
        <h4 className="text-xs font-medium text-gray-500text-gray-400 uppercase tracking-wider mb-2">
          Calculation Breakdown
        </h4>
        <div className="text-xs text-gray-600text-gray-400 font-mono space-y-1">
          {chainNodes
            .slice()
            .reverse()
            .map((chainNode, index) => {
              const multipliers: string[] = [];
              multipliers.push(`${(chainNode.confidence * 100).toFixed(0)}%`);
              if (chainNode.evidenceStrength && index < chainNodes.length - 1) {
                multipliers.push(
                  `×${STRENGTH_MULTIPLIERS[chainNode.evidenceStrength]}`,
                );
              }
              if (chainNode.status !== "active") {
                const penalty =
                  chainNode.status === "superseded" ? "×0.5" : "×0";
                multipliers.push(`(${penalty} ${chainNode.status})`);
              }
              return (
                <div key={chainNode.id} className="flex items-center gap-2">
                  <span className="text-gray-400">→</span>
                  <span>{chainNode.node.label.substring(0, 20)}:</span>
                  <span>{multipliers.join(" ")}</span>
                </div>
              );
            })}
          <div className="border-t border-gray-200 pt-1 mt-1">
            <span className="font-medium">
              = {(derivedConfidence * 100).toFixed(1)}% derived confidence
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EvidenceChainPanel;
