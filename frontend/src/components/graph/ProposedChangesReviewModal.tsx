/**
 * ProposedChangesReviewModal Component
 *
 * Modal for reviewing AI-proposed graph changes before applying them.
 * Shows all proposed changes with ability to select/deselect each one.
 * User must confirm before changes are applied to the graph.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type { ProposedChange } from "../../types/ideation-state";

// Block type styling
const BLOCK_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  problem: { label: "Problem", color: "text-red-700", bgColor: "bg-red-100" },
  solution: {
    label: "Solution",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  assumption: {
    label: "Assumption",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  constraint: {
    label: "Constraint",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
  },
  requirement: {
    label: "Requirement",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
  },
  question: {
    label: "Question",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  decision: {
    label: "Decision",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
  },
  insight: {
    label: "Insight",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
  },
  risk: { label: "Risk", color: "text-rose-700", bgColor: "bg-rose-100" },
  opportunity: {
    label: "Opportunity",
    color: "text-teal-700",
    bgColor: "bg-teal-100",
  },
  context: { label: "Context", color: "text-gray-700", bgColor: "bg-gray-100" },
  content: {
    label: "Content",
    color: "text-slate-700",
    bgColor: "bg-slate-100",
  },
  // Link type (for create_link changes)
  link: {
    label: "Connection",
    color: "text-violet-700",
    bgColor: "bg-violet-100",
  },
};

// Icon for supersession indicator
const SupersessionIcon = () => (
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
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

export interface ProposedChangesReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposedChanges: ProposedChange[];
  onApply: (selectedChanges: ProposedChange[]) => void;
  onCancel: () => void;
  isApplying?: boolean;
}

export function ProposedChangesReviewModal({
  isOpen,
  onClose,
  proposedChanges,
  onApply,
  onCancel,
  isApplying = false,
}: ProposedChangesReviewModalProps) {
  // Track selected change IDs (all selected by default)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(proposedChanges.map((c) => c.id)),
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Sync selectedIds when proposedChanges prop changes
  // This ensures all new changes are selected when analysis results come in
  useEffect(() => {
    console.log(
      "[ProposedChangesReviewModal] proposedChanges updated, resetting selectedIds",
      proposedChanges.length,
    );
    setSelectedIds(new Set(proposedChanges.map((c) => c.id)));
    setExpandedIds(new Set()); // Reset expanded state too
  }, [proposedChanges]);

  // Group changes by type for organized display
  const changesByType = useMemo(() => {
    const grouped: Record<string, ProposedChange[]> = {};
    proposedChanges.forEach((change) => {
      // Links are grouped separately under "link" type
      const type =
        change.type === "create_link" ? "link" : change.blockType || "content";
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(change);
    });
    return grouped;
  }, [proposedChanges]);

  // Count blocks vs links for summary
  const blockCount = useMemo(() => {
    return proposedChanges.filter((c) => c.type === "create_block").length;
  }, [proposedChanges]);

  const linkCount = useMemo(() => {
    return proposedChanges.filter((c) => c.type === "create_link").length;
  }, [proposedChanges]);

  // Count superseding changes
  const supersessionCount = useMemo(() => {
    return proposedChanges.filter((c) => c.supersedesBlockId).length;
  }, [proposedChanges]);

  // Toggle selection for a single change
  const toggleChange = useCallback((changeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(changeId)) {
        next.delete(changeId);
      } else {
        next.add(changeId);
      }
      return next;
    });
  }, []);

  // Toggle all changes of a type
  const toggleTypeAll = useCallback(
    (type: string, selected: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        changesByType[type]?.forEach((change) => {
          if (selected) {
            next.add(change.id);
          } else {
            next.delete(change.id);
          }
        });
        return next;
      });
    },
    [changesByType],
  );

  // Check if all changes of a type are selected
  const isTypeFullySelected = useCallback(
    (type: string) => {
      const typeChanges = changesByType[type] || [];
      return (
        typeChanges.length > 0 &&
        typeChanges.every((c) => selectedIds.has(c.id))
      );
    },
    [changesByType, selectedIds],
  );

  // Toggle expanded state for a change
  const toggleExpanded = useCallback((changeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(changeId)) {
        next.delete(changeId);
      } else {
        next.add(changeId);
      }
      return next;
    });
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(proposedChanges.map((c) => c.id)));
  }, [proposedChanges]);

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handle apply
  const handleApply = useCallback(() => {
    console.log("[ProposedChangesReviewModal] Apply clicked");
    console.log("[ProposedChangesReviewModal] selectedIds:", selectedIds.size);
    console.log(
      "[ProposedChangesReviewModal] proposedChanges:",
      proposedChanges.length,
    );
    const selectedChanges = proposedChanges.filter((c) =>
      selectedIds.has(c.id),
    );
    console.log(
      "[ProposedChangesReviewModal] selectedChanges to apply:",
      selectedChanges.length,
    );
    onApply(selectedChanges);
  }, [proposedChanges, selectedIds, onApply]);

  // Get styling for a block type
  const getTypeStyle = (type: string) => {
    return (
      BLOCK_TYPE_CONFIG[type] || {
        label: type,
        color: "text-gray-700",
        bgColor: "bg-gray-100",
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Review Proposed Changes
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Select which insights to add to your knowledge graph
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isApplying}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0"
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
            <div className="text-sm text-blue-800">
              <strong>{blockCount} insights</strong> and{" "}
              <strong>{linkCount} connections</strong> extracted from your
              selected sources.
              {supersessionCount > 0 && (
                <>
                  {" "}
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <SupersessionIcon />
                    <strong>{supersessionCount}</strong> superseding
                  </span>
                </>
              )}{" "}
              Review and select which ones to add.
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {proposedChanges.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg
                  className="w-12 h-12 text-gray-300 mx-auto mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <p className="text-gray-500">No insights extracted</p>
                <p className="text-sm text-gray-400 mt-1">
                  Try selecting more sources or different content
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={selectAll}
                    disabled={isApplying}
                    className="px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    disabled={isApplying}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Deselect All
                  </button>
                </div>
                <span className="text-sm text-gray-500 font-medium">
                  {selectedIds.size} of {proposedChanges.length} selected
                </span>
              </div>

              {/* Changes by Type */}
              {Object.entries(changesByType).map(([type, changes]) => {
                const typeStyle = getTypeStyle(type);
                const isFullySelected = isTypeFullySelected(type);
                const selectedCount = changes.filter((c) =>
                  selectedIds.has(c.id),
                ).length;

                return (
                  <div
                    key={type}
                    className={`border rounded-lg overflow-hidden ${typeStyle.bgColor.replace("bg-", "border-").replace("100", "200")}`}
                  >
                    {/* Type Header */}
                    <div
                      className={`px-4 py-3 ${typeStyle.bgColor} flex items-center justify-between`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-bold rounded ${typeStyle.bgColor} ${typeStyle.color}`}
                        >
                          {typeStyle.label}
                        </span>
                        <span className="text-sm text-gray-600">
                          {selectedCount}/{changes.length} selected
                        </span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFullySelected}
                          onChange={(e) =>
                            toggleTypeAll(type, e.target.checked)
                          }
                          disabled={isApplying}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-600">All</span>
                      </label>
                    </div>

                    {/* Changes List */}
                    <div className="divide-y divide-gray-100">
                      {changes.map((change) => {
                        const isSelected = selectedIds.has(change.id);
                        const isExpanded = expandedIds.has(change.id);

                        return (
                          <div
                            key={change.id}
                            className={`bg-white ${isSelected ? "bg-purple-50/30" : ""}`}
                          >
                            <div className="px-4 py-3 flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleChange(change.id)}
                                disabled={isApplying}
                                className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div
                                  className="cursor-pointer"
                                  onClick={() => toggleExpanded(change.id)}
                                >
                                  {change.type === "create_link" ? (
                                    // Display link changes differently
                                    <>
                                      <p className="font-medium text-gray-900 text-sm">
                                        <span className="text-violet-600">
                                          {change.linkType || "relates_to"}
                                        </span>
                                        {" connection"}
                                      </p>
                                      <p className="text-gray-600 text-sm">
                                        {change.reason ||
                                          `Links ${change.sourceBlockId?.slice(0, 8)} → ${change.targetBlockId?.slice(0, 8)}`}
                                      </p>
                                    </>
                                  ) : (
                                    // Display block changes
                                    <>
                                      <div className="flex items-center gap-2">
                                        {change.title && (
                                          <p className="font-medium text-gray-900 text-sm">
                                            {change.title}
                                          </p>
                                        )}
                                        {/* Supersession badge */}
                                        {change.supersedesBlockId && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                                            <SupersessionIcon />
                                            Supersedes
                                          </span>
                                        )}
                                      </div>
                                      <p
                                        className={`text-gray-600 text-sm ${isExpanded ? "" : "line-clamp-2"}`}
                                      >
                                        {change.content || "(No content)"}
                                      </p>
                                      {/* Supersession reason */}
                                      {change.supersedesBlockId &&
                                        change.supersessionReason && (
                                          <p className="text-xs text-amber-600 mt-1 italic">
                                            Reason: {change.supersessionReason}
                                          </p>
                                        )}
                                      {!isExpanded &&
                                        (change.content?.length || 0) > 150 && (
                                          <button className="text-xs text-purple-600 hover:text-purple-800 mt-1">
                                            Show more...
                                          </button>
                                        )}
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs text-gray-500">
                                    Confidence:{" "}
                                    <span className="font-medium">
                                      {Math.round(change.confidence * 100)}%
                                    </span>
                                  </span>
                                  {change.graphMembership &&
                                    change.graphMembership.length > 0 && (
                                      <span className="text-xs text-gray-500">
                                        Graphs:{" "}
                                        {change.graphMembership.join(", ")}
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedIds.size > 0 && (
              <span>
                <span className="font-medium">
                  {
                    proposedChanges.filter(
                      (c) => selectedIds.has(c.id) && c.type === "create_block",
                    ).length
                  }
                </span>{" "}
                insights and{" "}
                <span className="font-medium">
                  {
                    proposedChanges.filter(
                      (c) => selectedIds.has(c.id) && c.type === "create_link",
                    ).length
                  }
                </span>{" "}
                connections will be added
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={isApplying}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || selectedIds.size === 0}
              className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isApplying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Applying...
                </>
              ) : (
                <>
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Apply to Graph ({selectedIds.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProposedChangesReviewModal;
