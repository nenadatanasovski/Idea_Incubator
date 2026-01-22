/**
 * GraphControls Component
 * Toolbar controls for graph visualization including zoom, refresh, and status indicators
 *
 * Features:
 * - Zoom in/out/reset controls
 * - Manual refresh button
 * - Last updated timestamp
 * - Stale data indicator
 * - WebSocket connection status
 */

import { useCallback, useState } from "react";

export interface GraphControlsProps {
  // Refresh
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: string | null;
  isStale?: boolean;

  // Memory Graph Update
  onUpdateMemoryGraph?: () => void;
  isAnalyzingGraph?: boolean;
  pendingGraphChanges?: number;

  // WebSocket status
  isConnected?: boolean;
  isReconnecting?: boolean;

  // Zoom (for integration with Reagraph)
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onFitToView?: () => void;

  // Layout
  onLayoutChange?: (layout: LayoutOption) => void;
  currentLayout?: LayoutOption;

  // Additional controls
  showLayoutControls?: boolean;
  showZoomControls?: boolean;
  showConnectionStatus?: boolean;

  className?: string;
}

export type LayoutOption =
  | "forceDirected2d"
  | "forceDirected3d"
  | "treeTd2d"
  | "treeLr2d"
  | "radialOut2d"
  | "circular2d"
  | "hierarchical";

const LAYOUTS: { value: LayoutOption; label: string; description?: string }[] =
  [
    { value: "forceDirected2d", label: "Force 2D" },
    { value: "treeTd2d", label: "Tree (Top-Down)" },
    { value: "treeLr2d", label: "Tree (Left-Right)" },
    { value: "radialOut2d", label: "Radial" },
    { value: "circular2d", label: "Circular" },
    {
      value: "hierarchical",
      label: "Hierarchical (Abstraction)",
      description:
        "Arranges nodes by abstraction level: Vision → Strategy → Tactic → Implementation",
    },
  ];

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

  if (diffSec < 60) {
    return "Just now";
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHr < 24) {
    return `${diffHr}h ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * GraphControls Component
 */
export function GraphControls({
  onRefresh,
  isRefreshing = false,
  lastUpdated,
  isStale = false,
  onUpdateMemoryGraph,
  isAnalyzingGraph = false,
  pendingGraphChanges = 0,
  isConnected,
  isReconnecting = false,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToView,
  onLayoutChange,
  currentLayout = "forceDirected2d",
  showLayoutControls = true,
  showZoomControls = true,
  showConnectionStatus = true,
  className = "",
}: GraphControlsProps) {
  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);

  const handleLayoutSelect = useCallback(
    (layout: LayoutOption) => {
      onLayoutChange?.(layout);
      setIsLayoutDropdownOpen(false);
    },
    [onLayoutChange],
  );

  return (
    <div
      className={`flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ${className}`}
      data-testid="graph-controls"
    >
      {/* Connection Status */}
      {showConnectionStatus && isConnected !== undefined && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-900">
          <span
            className={`w-2 h-2 rounded-full ${
              isReconnecting
                ? "bg-yellow-500 animate-pulse"
                : isConnected
                  ? "bg-green-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {isReconnecting
              ? "Reconnecting..."
              : isConnected
                ? "Live"
                : "Offline"}
          </span>
        </div>
      )}

      {/* Divider */}
      {showConnectionStatus && isConnected !== undefined && (
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
      )}

      {/* Zoom Controls */}
      {showZoomControls && (onZoomIn || onZoomOut || onZoomReset) && (
        <>
          <div className="flex items-center">
            {onZoomIn && (
              <button
                onClick={onZoomIn}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Zoom in"
              >
                <svg
                  className="w-4 h-4 text-gray-600 dark:text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                  />
                </svg>
              </button>
            )}
            {onZoomOut && (
              <button
                onClick={onZoomOut}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Zoom out"
              >
                <svg
                  className="w-4 h-4 text-gray-600 dark:text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                  />
                </svg>
              </button>
            )}
            {onZoomReset && (
              <button
                onClick={onZoomReset}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Reset zoom"
              >
                <svg
                  className="w-4 h-4 text-gray-600 dark:text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </button>
            )}
            {onFitToView && (
              <button
                onClick={onFitToView}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Fit to view"
              >
                <svg
                  className="w-4 h-4 text-gray-600 dark:text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </button>
            )}
          </div>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
        </>
      )}

      {/* Layout Selector */}
      {showLayoutControls && onLayoutChange && (
        <>
          <div className="relative">
            <button
              onClick={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
              <span>
                {LAYOUTS.find((l) => l.value === currentLayout)?.label ||
                  "Layout"}
              </span>
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
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isLayoutDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[140px]">
                {LAYOUTS.map((layout) => (
                  <button
                    key={layout.value}
                    onClick={() => handleLayoutSelect(layout.value)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                      currentLayout === layout.value
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {layout.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Last Updated & Refresh */}
      <div className="flex items-center gap-2">
        {/* Stale Indicator */}
        {isStale && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs">
            <svg
              className="w-3.5 h-3.5"
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
            <span>Stale</span>
          </div>
        )}

        {/* Last Updated Timestamp */}
        {lastUpdated && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatTimestamp(lastUpdated)}
          </span>
        )}

        {/* Update Memory Graph Button */}
        {onUpdateMemoryGraph && (
          <button
            onClick={onUpdateMemoryGraph}
            disabled={isAnalyzingGraph}
            className={`relative p-1.5 rounded transition-colors ${
              isAnalyzingGraph
                ? "bg-purple-100 dark:bg-purple-900/30 cursor-not-allowed"
                : pendingGraphChanges > 0
                  ? "bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-800/40"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title={
              isAnalyzingGraph
                ? "Analyzing..."
                : pendingGraphChanges > 0
                  ? `Update Memory Graph (${pendingGraphChanges} pending)`
                  : "Update Memory Graph"
            }
            data-testid="update-memory-graph-btn"
          >
            <svg
              className={`w-4 h-4 ${
                isAnalyzingGraph
                  ? "animate-pulse text-purple-600 dark:text-purple-400"
                  : pendingGraphChanges > 0
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-gray-600 dark:text-gray-300"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {/* Brain icon */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            {/* Badge for pending changes */}
            {pendingGraphChanges > 0 && !isAnalyzingGraph && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {pendingGraphChanges > 9 ? "9+" : pendingGraphChanges}
              </span>
            )}
          </button>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-1.5 rounded transition-colors ${
              isRefreshing
                ? "bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title="Refresh graph"
          >
            <svg
              className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${
                isRefreshing ? "animate-spin" : ""
              }`}
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
          </button>
        )}
      </div>
    </div>
  );
}

export default GraphControls;
