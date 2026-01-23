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
 * - AI prompt button with hover popup
 */

import { useCallback, useState, useRef, useEffect } from "react";
import type { GraphFilters as GraphFiltersType } from "../../types/graph";

// ============================================================================
// Types for AI Prompt
// ============================================================================

export type PromptActionType =
  | "link_created"
  | "highlight"
  | "filter"
  | "block_updated"
  | "clarification_needed"
  | "error";

export interface PromptResult {
  action: PromptActionType;
  message?: string;
  link?: {
    id: string;
    source: string;
    target: string;
    linkType: string;
  };
  nodeIds?: string[];
  filters?: Partial<GraphFiltersType>;
  block?: {
    id: string;
    status?: string;
    properties?: Record<string, unknown>;
  };
}

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

  // AI Prompt
  sessionId?: string;
  onPromptResult?: (result: PromptResult) => void;
  onPromptHighlight?: (nodeIds: string[]) => void;
  onPromptFilterChange?: (filters: Partial<GraphFiltersType>) => void;
  promptDisabled?: boolean;

  // Search
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
  searchResultCount?: number;
  totalNodeCount?: number;

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
  sessionId,
  onPromptResult,
  onPromptHighlight,
  onPromptFilterChange,
  promptDisabled = false,
  onSearchChange,
  searchQuery = "",
  searchResultCount,
  totalNodeCount,
  className = "",
}: GraphControlsProps) {
  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);
  const [isAiPopupOpen, setIsAiPopupOpen] = useState(false);
  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchPopupRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [lastPromptResult, setLastPromptResult] = useState<PromptResult | null>(
    null,
  );
  const aiButtonRef = useRef<HTMLButtonElement>(null);
  const aiPopupRef = useRef<HTMLDivElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);

  // Close AI popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        aiPopupRef.current &&
        !aiPopupRef.current.contains(event.target as Node) &&
        aiButtonRef.current &&
        !aiButtonRef.current.contains(event.target as Node)
      ) {
        setIsAiPopupOpen(false);
      }
    };

    if (isAiPopupOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus input when popup opens
      setTimeout(() => promptInputRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAiPopupOpen]);

  // Close search popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchPopupRef.current &&
        !searchPopupRef.current.contains(event.target as Node) &&
        searchButtonRef.current &&
        !searchButtonRef.current.contains(event.target as Node)
      ) {
        setIsSearchPopupOpen(false);
      }
    };

    if (isSearchPopupOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus input when popup opens
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchPopupOpen]);

  // Sync local search query with prop
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Handle search input change
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearchQuery(value);
      onSearchChange?.(value);
    },
    [onSearchChange],
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery("");
    onSearchChange?.("");
  }, [onSearchChange]);

  // Handle prompt submission
  const handlePromptSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!prompt.trim() || isPromptLoading || promptDisabled || !sessionId) {
        return;
      }

      setIsPromptLoading(true);
      setPromptError(null);
      setLastPromptResult(null);

      try {
        const response = await fetch(
          `/api/ideation/session/${sessionId}/graph/prompt`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt: prompt.trim() }),
          },
        );

        if (!response.ok) {
          throw new Error(`Request failed: ${response.statusText}`);
        }

        const result: PromptResult = await response.json();
        setLastPromptResult(result);

        // Handle the result based on action type
        if (
          result.action === "highlight" &&
          result.nodeIds &&
          onPromptHighlight
        ) {
          onPromptHighlight(result.nodeIds);
        } else if (
          result.action === "filter" &&
          result.filters &&
          onPromptFilterChange
        ) {
          onPromptFilterChange(result.filters);
        }

        // Notify parent of result
        onPromptResult?.(result);

        // Clear input on success (except for clarification)
        if (result.action !== "clarification_needed") {
          setPrompt("");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to process prompt";
        setPromptError(errorMessage);
        setLastPromptResult({
          action: "error",
          message: errorMessage,
        });
      } finally {
        setIsPromptLoading(false);
      }
    },
    [
      prompt,
      sessionId,
      isPromptLoading,
      promptDisabled,
      onPromptResult,
      onPromptHighlight,
      onPromptFilterChange,
    ],
  );

  const handleLayoutSelect = useCallback(
    (layout: LayoutOption) => {
      onLayoutChange?.(layout);
      setIsLayoutDropdownOpen(false);
    },
    [onLayoutChange],
  );

  return (
    <div
      className={`flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}
      data-testid="graph-controls"
    >
      {/* Connection Status */}
      {showConnectionStatus && isConnected !== undefined && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50">
          <span
            className={`w-2 h-2 rounded-full ${
              isReconnecting
                ? "bg-yellow-500 animate-pulse"
                : isConnected
                  ? "bg-green-500"
                  : "bg-red-500"
            }`}
          />
          <span className="text-xs text-gray-600">
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
        <div className="w-px h-6 bg-gray-200" />
      )}

      {/* AI Prompt Button with Popup */}
      {sessionId && (
        <>
          <div className="relative">
            <button
              ref={aiButtonRef}
              onMouseEnter={() => {
                setIsAiPopupOpen(true);
                setIsSearchPopupOpen(false); // Close search when opening AI
              }}
              onClick={() => {
                setIsAiPopupOpen(!isAiPopupOpen);
                if (!isAiPopupOpen) setIsSearchPopupOpen(false);
              }}
              disabled={promptDisabled}
              className={`p-1.5 rounded transition-colors ${
                isAiPopupOpen
                  ? "bg-purple-100 text-purple-600"
                  : "hover:bg-gray-100 text-gray-600"
              } ${promptDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              title="Ask AI about the graph"
              data-testid="ai-prompt-button"
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
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </button>

            {/* AI Popup */}
            {isAiPopupOpen && (
              <div
                ref={aiPopupRef}
                onMouseLeave={() => {
                  // Only close if not focused on input
                  if (document.activeElement !== promptInputRef.current) {
                    setIsAiPopupOpen(false);
                  }
                }}
                className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                data-testid="ai-prompt-popup"
              >
                <div className="p-3">
                  <form onSubmit={handlePromptSubmit} className="flex gap-2">
                    <input
                      ref={promptInputRef}
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handlePromptSubmit();
                        } else if (e.key === "Escape") {
                          setIsAiPopupOpen(false);
                        }
                      }}
                      placeholder="Ask about your graph..."
                      disabled={promptDisabled || isPromptLoading}
                      className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={
                        !prompt.trim() || isPromptLoading || promptDisabled
                      }
                      className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isPromptLoading ? (
                        <svg
                          className="animate-spin w-4 h-4"
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
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                      )}
                    </button>
                  </form>

                  {/* Error Message */}
                  {promptError && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                      {promptError}
                    </div>
                  )}

                  {/* Result Feedback */}
                  {lastPromptResult && lastPromptResult.action !== "error" && (
                    <div
                      className={`mt-2 p-2 rounded text-xs ${
                        lastPromptResult.action === "clarification_needed"
                          ? "bg-amber-50 border border-amber-200 text-amber-600"
                          : "bg-green-50 border border-green-200 text-green-600"
                      }`}
                    >
                      {lastPromptResult.action === "clarification_needed"
                        ? lastPromptResult.message ||
                          "Could you be more specific?"
                        : lastPromptResult.action === "highlight"
                          ? `Highlighted ${lastPromptResult.nodeIds?.length || 0} nodes`
                          : lastPromptResult.action === "link_created"
                            ? "Link created between blocks"
                            : lastPromptResult.action === "filter"
                              ? "Filters applied"
                              : "Action completed"}
                    </div>
                  )}

                  {/* Quick suggestions */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["Find risks", "Show assumptions", "Link blocks"].map(
                      (suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setPrompt(suggestion)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="w-px h-6 bg-gray-200" />
        </>
      )}

      {/* Search Button with Popup */}
      {onSearchChange && (
        <>
          <div className="relative">
            <button
              ref={searchButtonRef}
              onMouseEnter={() => {
                setIsSearchPopupOpen(true);
                setIsAiPopupOpen(false); // Close AI when opening search
              }}
              onClick={() => {
                setIsSearchPopupOpen(!isSearchPopupOpen);
                if (!isSearchPopupOpen) setIsAiPopupOpen(false);
              }}
              className={`p-1.5 rounded transition-colors ${
                isSearchPopupOpen || localSearchQuery
                  ? "bg-blue-100 text-blue-600"
                  : "hover:bg-gray-100 text-gray-600"
              }`}
              title="Search nodes"
              data-testid="search-button"
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {/* Active search indicator */}
              {localSearchQuery && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>

            {/* Search Popup */}
            {isSearchPopupOpen && (
              <div
                ref={searchPopupRef}
                onMouseLeave={() => {
                  // Only close if not focused on input
                  if (document.activeElement !== searchInputRef.current) {
                    setIsSearchPopupOpen(false);
                  }
                }}
                className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                data-testid="search-popup"
              >
                <div className="p-3">
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={localSearchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          if (localSearchQuery) {
                            handleClearSearch();
                          } else {
                            setIsSearchPopupOpen(false);
                          }
                        }
                      }}
                      placeholder="Search nodes by keyword..."
                      className="w-full px-3 py-2 pr-8 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {localSearchQuery && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                        title="Clear search"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Search results count */}
                  {localSearchQuery && searchResultCount !== undefined && (
                    <div className="mt-2 text-xs text-gray-500">
                      {searchResultCount === 0 ? (
                        <span className="text-amber-600">
                          No matching nodes
                        </span>
                      ) : (
                        <span>
                          Showing {searchResultCount} of {totalNodeCount} nodes
                        </span>
                      )}
                    </div>
                  )}

                  {/* Search tips */}
                  {!localSearchQuery && (
                    <div className="mt-2 text-xs text-gray-400">
                      <p>Filter nodes by content, label, or type</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="w-px h-6 bg-gray-200" />
        </>
      )}

      {/* Zoom Controls */}
      {showZoomControls && (onZoomIn || onZoomOut || onZoomReset) && (
        <>
          <div className="flex items-center">
            {onZoomIn && (
              <button
                onClick={onZoomIn}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                title="Zoom in"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
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
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                title="Zoom out"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
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
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                title="Reset zoom"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
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
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                title="Fit to view"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
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
          <div className="w-px h-6 bg-gray-200" />
        </>
      )}

      {/* Layout Selector */}
      {showLayoutControls && onLayoutChange && (
        <>
          <div className="relative">
            <button
              onClick={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 rounded hover:bg-gray-100 transition-colors"
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
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px]">
                {LAYOUTS.map((layout) => (
                  <button
                    key={layout.value}
                    onClick={() => handleLayoutSelect(layout.value)}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg ${
                      currentLayout === layout.value
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600"
                    }`}
                  >
                    {layout.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-6 bg-gray-200" />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Last Updated & Refresh */}
      <div className="flex items-center gap-2">
        {/* Stale Indicator */}
        {isStale && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
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
          <span className="text-xs text-gray-500">
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
                ? "bg-purple-100 cursor-not-allowed"
                : pendingGraphChanges > 0
                  ? "bg-purple-100 hover:bg-purple-200"
                  : "hover:bg-gray-100"
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
                  ? "animate-pulse text-purple-600"
                  : pendingGraphChanges > 0
                    ? "text-purple-600"
                    : "text-gray-600"
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
                ? "bg-gray-100 cursor-not-allowed"
                : "hover:bg-gray-100"
            }`}
            title="Refresh graph"
          >
            <svg
              className={`w-4 h-4 text-gray-600 ${
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
