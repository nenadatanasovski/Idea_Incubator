/**
 * SnapshotControls Component
 * Save and restore memory graph snapshots
 *
 * Features:
 * - Save button to create snapshot of current graph state
 * - History button with dropdown showing previous snapshots
 * - Click to restore any previous snapshot
 * - Auto-backup before restore
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { GraphSnapshotSummary } from "../../types/graph";

export interface SnapshotControlsProps {
  snapshots: GraphSnapshotSummary[];
  onSaveSnapshot: (name: string, description?: string) => Promise<void>;
  onRestoreSnapshot: (snapshotId: string) => Promise<void>;
  onDeleteSnapshot?: (snapshotId: string) => Promise<void>;
  onLoadSnapshots: () => void;
  isLoadingSnapshots?: boolean;
  isSavingSnapshot?: boolean;
  isRestoringSnapshot?: boolean;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return "Just now";
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHr < 24) {
    return `${diffHr}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function SnapshotControls({
  snapshots,
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onLoadSnapshots,
  isLoadingSnapshots = false,
  isSavingSnapshot = false,
  isRestoringSnapshot = false,
}: SnapshotControlsProps) {
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotDescription, setSnapshotDescription] = useState("");

  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
  const saveDialogRef = useRef<HTMLDivElement>(null);
  const snapshotNameInputRef = useRef<HTMLInputElement>(null);

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        historyDropdownRef.current &&
        !historyDropdownRef.current.contains(event.target as Node) &&
        historyButtonRef.current &&
        !historyButtonRef.current.contains(event.target as Node)
      ) {
        setIsHistoryDropdownOpen(false);
      }
    };

    if (isHistoryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      onLoadSnapshots();
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isHistoryDropdownOpen, onLoadSnapshots]);

  // Close save dialog when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        saveDialogRef.current &&
        !saveDialogRef.current.contains(event.target as Node)
      ) {
        setIsSaveDialogOpen(false);
      }
    };

    if (isSaveDialogOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => snapshotNameInputRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSaveDialogOpen]);

  // Handle save snapshot
  const handleSaveSnapshot = useCallback(async () => {
    if (!snapshotName.trim()) return;

    try {
      await onSaveSnapshot(
        snapshotName.trim(),
        snapshotDescription.trim() || undefined,
      );
      setSnapshotName("");
      setSnapshotDescription("");
      setIsSaveDialogOpen(false);
    } catch (error) {
      console.error("Failed to save snapshot:", error);
    }
  }, [snapshotName, snapshotDescription, onSaveSnapshot]);

  // Handle restore snapshot
  const handleRestoreSnapshot = useCallback(
    async (snapshotId: string) => {
      const confirmed = window.confirm(
        "Restore this snapshot? Your current graph state will be saved automatically before restoration.",
      );
      if (!confirmed) return;

      try {
        await onRestoreSnapshot(snapshotId);
        setIsHistoryDropdownOpen(false);
      } catch (error) {
        console.error("Failed to restore snapshot:", error);
      }
    },
    [onRestoreSnapshot],
  );

  // Handle delete snapshot
  const handleDeleteSnapshot = useCallback(
    async (snapshotId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDeleteSnapshot) return;

      const confirmed = window.confirm("Delete this snapshot permanently?");
      if (!confirmed) return;

      try {
        await onDeleteSnapshot(snapshotId);
      } catch (error) {
        console.error("Failed to delete snapshot:", error);
      }
    },
    [onDeleteSnapshot],
  );

  return (
    <div className="flex items-center gap-1">
      {/* Save Button */}
      <div className="relative">
        <button
          onClick={() => setIsSaveDialogOpen(!isSaveDialogOpen)}
          disabled={isSavingSnapshot}
          className={`p-1.5 rounded transition-colors ${
            isSavingSnapshot
              ? "bg-green-100 dark:bg-green-900 cursor-not-allowed"
              : "hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          title="Save snapshot of current graph"
          data-testid="save-snapshot-btn"
        >
          {isSavingSnapshot ? (
            <svg
              className="w-4 h-4 animate-spin text-green-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-gray-600 dark:text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {/* Save/floppy disk icon */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
          )}
        </button>

        {/* Save Dialog Popup */}
        {isSaveDialogOpen && (
          <div
            ref={saveDialogRef}
            className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
            data-testid="save-snapshot-dialog"
          >
            <div className="p-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Save Graph Snapshot
              </h3>
              <input
                ref={snapshotNameInputRef}
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && snapshotName.trim()) {
                    handleSaveSnapshot();
                  } else if (e.key === "Escape") {
                    setIsSaveDialogOpen(false);
                  }
                }}
                placeholder="Snapshot name (required)"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 mb-2"
              />
              <textarea
                value={snapshotDescription}
                onChange={(e) => setSnapshotDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 mb-2 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSaveDialogOpen(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  disabled={!snapshotName.trim() || isSavingSnapshot}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History Button */}
      <div className="relative">
        <button
          ref={historyButtonRef}
          onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
          disabled={isRestoringSnapshot}
          className={`p-1.5 rounded transition-colors ${
            isHistoryDropdownOpen
              ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
              : isRestoringSnapshot
                ? "bg-blue-100 dark:bg-blue-900 cursor-not-allowed"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          title="View snapshot history"
          data-testid="snapshot-history-btn"
        >
          {isRestoringSnapshot ? (
            <svg
              className="w-4 h-4 animate-spin text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className={`w-4 h-4 ${isHistoryDropdownOpen ? "" : "text-gray-600 dark:text-gray-300"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {/* History/clock with arrow icon */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          {/* Badge showing snapshot count */}
          {snapshots.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {snapshots.length > 9 ? "9+" : snapshots.length}
            </span>
          )}
        </button>

        {/* History Dropdown */}
        {isHistoryDropdownOpen && (
          <div
            ref={historyDropdownRef}
            className="absolute top-full left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
            data-testid="snapshot-history-dropdown"
          >
            <div className="p-2 border-b border-gray-100 border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Snapshot History
              </h3>
            </div>

            {isLoadingSnapshots ? (
              <div className="p-4 text-center">
                <svg
                  className="w-6 h-6 animate-spin mx-auto text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Loading snapshots...
                </p>
              </div>
            ) : snapshots.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <svg
                  className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm">No snapshots yet</p>
                <p className="text-xs mt-1">
                  Click the save button to create your first snapshot
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    onClick={() => handleRestoreSnapshot(snapshot.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRestoreSnapshot(snapshot.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {snapshot.name}
                        </p>
                        {snapshot.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {snapshot.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {formatTimestamp(snapshot.createdAt)}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {snapshot.blockCount} blocks, {snapshot.linkCount}{" "}
                            links
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Restore icon */}
                        <span
                          className="text-blue-500 hover:text-blue-600"
                          title="Restore this snapshot"
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
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </span>
                        {/* Delete button */}
                        {onDeleteSnapshot && (
                          <button
                            type="button"
                            onClick={(e) =>
                              handleDeleteSnapshot(snapshot.id, e)
                            }
                            className="text-red-400 hover:text-red-500"
                            title="Delete snapshot"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 ml-1" />
    </div>
  );
}

export default SnapshotControls;
