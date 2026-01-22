/**
 * GraphUpdateConfirmation Component
 * Displays new block details with suggested type/graph
 * Shows affected nodes with proposed actions
 * Implements Confirm All / Review Each / Cancel flow
 *
 * @see GRAPH-TAB-VIEW-SPEC.md T6.3
 */

import { useState, useCallback, memo } from "react";
import type {
  GraphNode,
  BlockType,
  BlockStatus,
  GraphType,
} from "../../types/graph";
import { nodeColors, graphColors } from "../../types/graph";
import { AlertCircle, Check, ChevronDown, ChevronRight, X } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface NewBlockUpdate {
  id: string;
  content: string;
  suggestedType: BlockType;
  suggestedGraph: GraphType[];
  confidence: number;
  properties?: Record<string, unknown>;
}

export interface AffectedNode {
  id: string;
  content: string;
  currentStatus: BlockStatus;
  proposedAction: "supersedes" | "invalidates" | "needs_review" | "refines";
  reason: string;
  node?: GraphNode; // Optional: full node reference for advanced operations
  suggestedChanges?: Partial<GraphNode>;
}

export interface CascadeEffect {
  affectedNodes: AffectedNode[];
  newLinks: Array<{
    source: string;
    target: string;
    linkType: string;
    reason: string;
  }>;
  conflicts: Array<{
    nodeId: string;
    type: "contradiction" | "supersession" | "dependency";
    description: string;
  }>;
  impactRadius: number;
}

export interface GraphUpdateConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  newBlock: NewBlockUpdate;
  cascadeEffects: CascadeEffect;
  onConfirmAll: () => void;
  onReviewEach: () => void;
  onCancel: () => void;
  onUpdateBlock?: (blockId: string, changes: Partial<GraphNode>) => void;
  onRejectChange?: (nodeId: string) => void;
  isProcessing?: boolean;
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

interface AffectedNodeItemProps {
  affected: AffectedNode;
  isExpanded: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onReject: () => void;
}

const AffectedNodeItem = memo(function AffectedNodeItem({
  affected,
  isExpanded,
  onToggle,
  onAccept,
  onReject,
}: AffectedNodeItemProps) {
  const actionColors = {
    supersedes: "bg-amber-100 text-amber-700 border-amber-200",
    invalidates: "bg-red-100 text-red-700 border-red-200",
    needs_review: "bg-blue-100 text-blue-700 border-blue-200",
    refines: "bg-green-100 text-green-700 border-green-200",
  };

  const actionIcons = {
    supersedes: "\u2192",
    invalidates: "!",
    needs_review: "?",
    refines: "+",
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${actionColors[affected.proposedAction]}`}
          >
            {actionIcons[affected.proposedAction]}
          </span>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
              {affected.content}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {affected.proposedAction.replace("_", " ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept();
            }}
            className="p-1 hover:bg-green-100 rounded text-green-600"
            title="Accept change"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
            className="p-1 hover:bg-red-100 rounded text-red-600"
            title="Reject change"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-3 border-t border-gray-100 bg-gray-50">
          <p className="text-sm text-gray-600 mt-2">{affected.reason}</p>
          {affected.suggestedChanges && (
            <div className="mt-2 p-2 bg-white rounded border border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-1">
                Suggested Changes:
              </p>
              <pre className="text-xs text-gray-700 overflow-x-auto">
                {JSON.stringify(affected.suggestedChanges, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const GraphUpdateConfirmation = memo(function GraphUpdateConfirmation({
  isOpen,
  onClose,
  newBlock,
  cascadeEffects,
  onConfirmAll,
  onReviewEach,
  onCancel,
  onUpdateBlock,
  onRejectChange,
  isProcessing = false,
  className = "",
}: GraphUpdateConfirmationProps) {
  // Don't render if not open
  if (!isOpen) {
    return null;
  }
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [reviewMode, setReviewMode] = useState(false);
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(
    new Set(),
  );
  const [rejectedChanges, setRejectedChanges] = useState<Set<string>>(
    new Set(),
  );

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleAcceptChange = useCallback((nodeId: string) => {
    setAcceptedChanges((prev) => new Set(prev).add(nodeId));
    setRejectedChanges((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  const handleRejectChange = useCallback(
    (nodeId: string) => {
      setRejectedChanges((prev) => new Set(prev).add(nodeId));
      setAcceptedChanges((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      onRejectChange?.(nodeId);
    },
    [onRejectChange],
  );

  const handleConfirmReviewed = useCallback(() => {
    // Apply accepted changes
    cascadeEffects.affectedNodes.forEach((affected) => {
      if (acceptedChanges.has(affected.id) && affected.suggestedChanges) {
        onUpdateBlock?.(affected.id, affected.suggestedChanges);
      }
    });
    onConfirmAll();
  }, [
    acceptedChanges,
    cascadeEffects.affectedNodes,
    onUpdateBlock,
    onConfirmAll,
  ]);

  const hasConflicts = cascadeEffects.conflicts.length > 0;
  const totalAffected = cascadeEffects.affectedNodes.length;
  const pendingReview =
    totalAffected - acceptedChanges.size - rejectedChanges.size;

  return (
    <div
      className={`bg-white rounded-lg shadow-lg border border-gray-200 max-w-lg w-full ${className}`}
      data-testid="graph-update-confirmation"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: nodeColors[newBlock.suggestedType] + "20",
            }}
          >
            <span
              className="text-sm font-bold"
              style={{ color: nodeColors[newBlock.suggestedType] }}
            >
              {newBlock.suggestedType.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              New Block Detected
            </h3>
            <p className="text-xs text-gray-500">{newBlock.suggestedType}</p>
          </div>
        </div>
        <button
          onClick={() => {
            onClose();
            onCancel();
          }}
          className="p-1 hover:bg-gray-100 rounded"
          disabled={isProcessing}
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Block Content Preview */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm text-gray-700 line-clamp-3">{newBlock.content}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-gray-500">Suggested graphs:</span>
          <div className="flex gap-1">
            {newBlock.suggestedGraph.map((graph) => (
              <span
                key={graph}
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: graphColors[graph] + "20",
                  color: graphColors[graph],
                }}
              >
                {graph}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">Confidence:</span>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full max-w-[100px]">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${newBlock.confidence * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600">
            {Math.round(newBlock.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Cascade Effects Summary */}
      {(totalAffected > 0 || hasConflicts) && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-gray-700">
              Cascade Effects
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-white rounded border border-gray-200">
              <p className="text-lg font-semibold text-gray-900">
                {totalAffected}
              </p>
              <p className="text-xs text-gray-500">Affected</p>
            </div>
            <div className="p-2 bg-white rounded border border-gray-200">
              <p className="text-lg font-semibold text-gray-900">
                {cascadeEffects.newLinks.length}
              </p>
              <p className="text-xs text-gray-500">New Links</p>
            </div>
            <div
              className={`p-2 rounded border ${hasConflicts ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}
            >
              <p
                className={`text-lg font-semibold ${hasConflicts ? "text-red-600" : "text-gray-900"}`}
              >
                {cascadeEffects.conflicts.length}
              </p>
              <p
                className={`text-xs ${hasConflicts ? "text-red-500" : "text-gray-500"}`}
              >
                Conflicts
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Impact radius: {cascadeEffects.impactRadius} hop
            {cascadeEffects.impactRadius !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Review Mode: Affected Nodes List */}
      {reviewMode && totalAffected > 0 && (
        <div className="px-4 py-3 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">
              Review Changes ({pendingReview} pending)
            </span>
          </div>
          <div className="space-y-2">
            {cascadeEffects.affectedNodes.map((affected) => (
              <AffectedNodeItem
                key={affected.id}
                affected={affected}
                isExpanded={expandedNodes.has(affected.id)}
                onToggle={() => toggleNode(affected.id)}
                onAccept={() => handleAcceptChange(affected.id)}
                onReject={() => handleRejectChange(affected.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Conflicts Warning */}
      {hasConflicts && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600">
            {cascadeEffects.conflicts.length} conflict
            {cascadeEffects.conflicts.length !== 1 ? "s" : ""} detected. Review
            recommended before confirming.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800
                     hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
        >
          Cancel
        </button>

        {!reviewMode ? (
          <>
            {totalAffected > 0 && (
              <button
                onClick={() => {
                  setReviewMode(true);
                  onReviewEach();
                }}
                disabled={isProcessing}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded
                           hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Review Each
              </button>
            )}
            <button
              onClick={onConfirmAll}
              disabled={isProcessing}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded
                         hover:bg-blue-700 transition-colors disabled:opacity-50
                         flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <span className="animate-spin">...</span>
                  Processing
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirm All
                </>
              )}
            </button>
          </>
        ) : (
          <button
            onClick={handleConfirmReviewed}
            disabled={isProcessing || pendingReview > 0}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded
                       hover:bg-blue-700 transition-colors disabled:opacity-50
                       flex items-center gap-2"
            title={
              pendingReview > 0
                ? `${pendingReview} changes still need review`
                : undefined
            }
          >
            <Check className="w-4 h-4" />
            Confirm Reviewed ({acceptedChanges.size})
          </button>
        )}
      </div>
    </div>
  );
});

export default GraphUpdateConfirmation;
