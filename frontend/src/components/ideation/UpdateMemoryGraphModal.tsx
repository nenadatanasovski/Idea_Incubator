// =============================================================================
// FILE: frontend/src/components/ideation/UpdateMemoryGraphModal.tsx
// Modal for reviewing and applying graph updates
// =============================================================================

import { X, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { ProposedChangeItem } from "./ProposedChangeItem";
import type {
  GraphUpdateAnalysis,
  CascadeEffect,
} from "../../types/ideation-state";

export interface UpdateMemoryGraphModalProps {
  isOpen: boolean;
  analysis: GraphUpdateAnalysis | null;
  selectedChangeIds: string[];
  isApplying: boolean;
  error: string | null;
  onClose: () => void;
  onToggleChange: (changeId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onApply: () => void;
}

export function UpdateMemoryGraphModal({
  isOpen,
  analysis,
  selectedChangeIds,
  isApplying,
  error,
  onClose,
  onToggleChange,
  onSelectAll,
  onSelectNone,
  onApply,
}: UpdateMemoryGraphModalProps) {
  if (!isOpen || !analysis) return null;

  const allSelected =
    analysis.proposedChanges.length > 0 &&
    selectedChangeIds.length === analysis.proposedChanges.length;
  const someSelected = selectedChangeIds.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="update-memory-graph-modal"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-[1400px] w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Update Memory Graph
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 5W1H Analysis Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Context Analysis (5W1H)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(analysis.context).map(([key, value]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    {key}
                  </span>
                  <p className="text-sm text-gray-900 mt-1 line-clamp-2">
                    {value || "N/A"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Proposed Changes */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                Proposed Changes ({analysis.proposedChanges.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={onSelectAll}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                  disabled={allSelected}
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={onSelectNone}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                  disabled={!someSelected}
                >
                  Select None
                </button>
              </div>
            </div>

            {analysis.proposedChanges.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <p>No new changes detected.</p>
                <p className="text-sm mt-1">
                  The graph is up to date with the conversation.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {analysis.proposedChanges.map((change) => (
                  <ProposedChangeItem
                    key={change.id}
                    change={change}
                    isSelected={selectedChangeIds.includes(change.id)}
                    onToggle={onToggleChange}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cascade Effect Warnings */}
          {analysis.cascadeEffects.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                Cascade Effects ({analysis.cascadeEffects.length})
              </h3>
              <div className="space-y-2">
                {analysis.cascadeEffects.map((effect, index) => (
                  <CascadeEffectItem
                    key={effect.id || `cascade-${index}`}
                    effect={effect}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Graph Preview (Mini visualization) */}
          {(analysis.previewNodes.length > 0 ||
            analysis.previewEdges.length > 0) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Graph Preview
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex flex-wrap gap-2 mb-3">
                  {analysis.previewNodes.slice(0, 10).map((node) => (
                    <span
                      key={node.id}
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        node.isNew
                          ? "bg-green-100 text-green-800 border border-green-300"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {node.type}: {node.content.slice(0, 20)}...
                    </span>
                  ))}
                  {analysis.previewNodes.length > 10 && (
                    <span className="text-xs text-gray-500">
                      +{analysis.previewNodes.length - 10} more
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {analysis.previewNodes.filter((n) => n.isNew).length} new
                  nodes will be added
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={isApplying || selectedChangeIds.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            data-testid="apply-changes-btn"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                Apply {selectedChangeIds.length} Change
                {selectedChangeIds.length !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper component for cascade effect items
function CascadeEffectItem({ effect }: { effect: CascadeEffect }) {
  if (!effect || !effect.effectType) {
    return null;
  }

  const severityColors = {
    low: "bg-blue-50 text-blue-700 border-blue-200",
    medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    high: "bg-red-50 text-red-700 border-red-200",
  };

  const severity = effect.severity || "low";

  return (
    <div className={`p-3 rounded-lg border ${severityColors[severity]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium uppercase">
          {effect.effectType.replace(/_/g, " ")}
        </span>
        <span className="text-xs">({severity})</span>
      </div>
      <p className="text-sm">{effect.description || "No description"}</p>
      <p className="text-xs mt-1 opacity-75">
        Affects: {(effect.affectedBlockContent || "").slice(0, 50)}...
      </p>
    </div>
  );
}

export default UpdateMemoryGraphModal;
