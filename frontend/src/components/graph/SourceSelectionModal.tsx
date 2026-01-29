/**
 * SourceSelectionModal Component
 *
 * Modal for selecting which sources to include in graph analysis.
 * Shows all available sources grouped by type in tables with expandable details.
 * Warns that this will reset the existing graph before analysis.
 */

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";

// ============================================================================
// Types
// ============================================================================

export type InsightType =
  | "insight"
  | "fact"
  | "assumption"
  | "question"
  | "decision"
  | "action"
  | "requirement"
  | "option"
  | "pattern"
  | "synthesis"
  | "meta";

export interface CollectedSource {
  id: string;
  type:
    | "conversation"
    | "conversation_insight"
    | "artifact"
    | "memory_file"
    | "user_block"
    | "external"
    | "pending_insight";
  content: string;
  weight: number;
  metadata: {
    role?: string;
    title?: string;
    artifactType?: string;
    memoryFileType?: string;
    timestamp?: string;
    // Conversation insight specific
    insightType?: InsightType;
    sourceContext?: string;
    synthesized?: boolean;
    [key: string]: unknown;
  };
}

export interface SourceCollectionResult {
  sources: CollectedSource[];
  totalTokenEstimate: number;
  truncated: boolean;
  collectionMetadata: {
    conversationCount: number;
    conversationInsightCount: number;
    artifactCount: number;
    memoryFileCount: number;
    userBlockCount: number;
  };
}

// Pending insight type from memory graph analysis
export interface PendingInsight {
  id: string;
  type: "create_block" | "update_block" | "create_link";
  blockType?: string;
  title?: string;
  content?: string;
  confidence: number;
}

export interface SourceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  ideaSlug?: string; // Optional idea slug to include file-based artifacts
  onConfirm: (
    selectedSourceIds: string[],
    selectedSources: CollectedSource[],
  ) => void;
  isProcessing?: boolean;
  existingInsights?: PendingInsight[]; // Insights from the right panel
}

// ============================================================================
// Source Type Configuration
// ============================================================================

// Insight type styling - uses canonical block type colors
const INSIGHT_TYPE_CONFIG: Record<
  InsightType,
  { label: string; color: string; bgColor: string }
> = {
  insight: {
    label: "Insight",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
  },
  fact: { label: "Fact", color: "text-blue-700", bgColor: "bg-blue-100" },
  assumption: {
    label: "Assumption",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  question: {
    label: "Question",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
  },
  decision: {
    label: "Decision",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
  },
  action: {
    label: "Action",
    color: "text-pink-700",
    bgColor: "bg-pink-100",
  },
  requirement: {
    label: "Requirement",
    color: "text-violet-700",
    bgColor: "bg-violet-100",
  },
  option: {
    label: "Option",
    color: "text-cyan-700",
    bgColor: "bg-cyan-100",
  },
  pattern: {
    label: "Pattern",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
  },
  synthesis: {
    label: "Synthesis",
    color: "text-rose-700",
    bgColor: "bg-rose-100",
  },
  meta: { label: "Meta", color: "text-gray-700", bgColor: "bg-gray-100" },
};

const SOURCE_TYPE_CONFIG = {
  conversation_insight: {
    label: "Conversation Insights",
    description: "AI-synthesized knowledge from chat",
    icon: (
      <svg
        className="w-5 h-5"
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
    ),
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    textColor: "text-indigo-700",
    iconColor: "text-indigo-600",
  },
  conversation: {
    label: "Raw Messages",
    description: "Individual chat messages (legacy)",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    iconColor: "text-blue-600",
  },
  artifact: {
    label: "Artifacts",
    description: "Research, analysis, and documents",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    textColor: "text-green-700",
    iconColor: "text-green-600",
  },
  memory_file: {
    label: "Memory Files",
    description: "State documents and assessments",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
        />
      </svg>
    ),
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-700",
    iconColor: "text-purple-600",
  },
  user_block: {
    label: "Manual Insights",
    description: "User-created observations",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        />
      </svg>
    ),
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
    iconColor: "text-amber-600",
  },
  external: {
    label: "External",
    description: "Imported content",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    ),
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    textColor: "text-gray-700",
    iconColor: "text-gray-600",
  },
  pending_insight: {
    label: "Pending Insights",
    description: "Chat insights awaiting graph update",
    icon: (
      <svg
        className="w-5 h-5"
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
    ),
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    textColor: "text-yellow-700",
    iconColor: "text-yellow-600",
  },
};

type SourceType = keyof typeof SOURCE_TYPE_CONFIG;

// ============================================================================
// Component
// ============================================================================

export function SourceSelectionModal({
  isOpen,
  onClose,
  sessionId,
  ideaSlug,
  onConfirm,
  isProcessing = false,
  existingInsights = [],
}: SourceSelectionModalProps) {
  const [sources, setSources] = useState<CollectedSource[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [collapsedTypes, setCollapsedTypes] = useState<Set<SourceType>>(
    new Set(),
  );

  // Convert pending insights to CollectedSource format
  const convertInsightsToSources = useCallback(
    (insights: PendingInsight[]): CollectedSource[] => {
      return insights
        .filter((insight) => insight.type === "create_block" && insight.content)
        .map((insight) => ({
          id: `pending_${insight.id}`,
          type: "pending_insight" as const,
          content: insight.content || "",
          weight: insight.confidence,
          metadata: {
            title: insight.title || insight.blockType || "Pending Insight",
            insightType: (insight.blockType || "insight") as InsightType,
            timestamp: new Date().toISOString(),
          },
        }));
    },
    [],
  );

  // Fetch sources when modal opens
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    const fetchSources = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/ideation/session/${sessionId}/graph/collect-sources`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tokenBudget: 100000,
              ideaSlug: ideaSlug, // Include idea slug for file-based artifacts
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch sources");
        }

        const result: SourceCollectionResult = await response.json();
        // Merge fetched sources with existing insights
        const insightSources = convertInsightsToSources(existingInsights);
        const allSources = [...result.sources, ...insightSources];
        setSources(allSources);
        setSelectedIds(new Set(allSources.map((s) => s.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sources");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSources();
  }, [isOpen, sessionId, ideaSlug, existingInsights, convertInsightsToSources]);

  // Group sources by type
  const sourcesByType = useMemo(() => {
    const grouped: Record<SourceType, CollectedSource[]> = {
      pending_insight: [],
      conversation_insight: [],
      conversation: [],
      artifact: [],
      memory_file: [],
      user_block: [],
      external: [],
    };

    sources.forEach((source) => {
      if (grouped[source.type as SourceType]) {
        grouped[source.type as SourceType].push(source);
      }
    });

    return grouped;
  }, [sources]);

  // Toggle selection for a single source
  const toggleSource = useCallback((sourceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  // Toggle all sources of a type
  const toggleTypeAll = useCallback(
    (type: SourceType, selected: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sourcesByType[type].forEach((source) => {
          if (selected) {
            next.add(source.id);
          } else {
            next.delete(source.id);
          }
        });
        return next;
      });
    },
    [sourcesByType],
  );

  // Check if all sources of a type are selected
  const isTypeFullySelected = useCallback(
    (type: SourceType) => {
      const typeSources = sourcesByType[type];
      return (
        typeSources.length > 0 &&
        typeSources.every((s) => selectedIds.has(s.id))
      );
    },
    [sourcesByType, selectedIds],
  );

  // Check if some (but not all) sources of a type are selected
  const isTypePartiallySelected = useCallback(
    (type: SourceType) => {
      const typeSources = sourcesByType[type];
      const selectedCount = typeSources.filter((s) =>
        selectedIds.has(s.id),
      ).length;
      return selectedCount > 0 && selectedCount < typeSources.length;
    },
    [sourcesByType, selectedIds],
  );

  // Toggle expanded state for a source
  const toggleExpanded = useCallback((sourceId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  // Toggle collapsed state for a type
  const toggleTypeCollapsed = useCallback((type: SourceType) => {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sources.map((s) => s.id)));
  }, [sources]);

  // Deselect all
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handle confirm - pass both IDs and full sources for backend analysis
  const handleConfirm = useCallback(() => {
    const ids = Array.from(selectedIds);
    const selectedSources = sources.filter((s) => selectedIds.has(s.id));
    onConfirm(ids, selectedSources);
  }, [selectedIds, sources, onConfirm]);

  // Get title for a source
  const getSourceTitle = (source: CollectedSource): string => {
    if (source.metadata.title) return source.metadata.title as string;
    if (source.type === "conversation_insight" && source.metadata.insightType) {
      const insightType = source.metadata.insightType as InsightType;
      const label = INSIGHT_TYPE_CONFIG[insightType]?.label || insightType;
      return `${label}: ${source.content.slice(0, 50)}...`;
    }
    if (source.type === "conversation" && source.metadata.role) {
      return `${source.metadata.role}`;
    }
    return source.type.replace("_", " ");
  };

  // Get subtitle for a source
  const getSourceSubtitle = (source: CollectedSource): string | null => {
    if (source.type === "conversation_insight" && source.metadata.insightType) {
      const insightType = source.metadata.insightType as InsightType;
      return INSIGHT_TYPE_CONFIG[insightType]?.label || insightType;
    }
    if (source.metadata.artifactType) {
      return source.metadata.artifactType as string;
    }
    if (source.metadata.memoryFileType) {
      return source.metadata.memoryFileType as string;
    }
    return null;
  };

  // Get insight type config for styling
  const getInsightTypeStyle = (source: CollectedSource) => {
    if (source.type === "conversation_insight" && source.metadata.insightType) {
      const insightType = source.metadata.insightType as InsightType;
      return INSIGHT_TYPE_CONFIG[insightType];
    }
    return null;
  };

  // Format timestamp
  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return "-";
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  // Estimate tokens for a source
  const estimateTokens = (content: string): number => {
    return Math.ceil(content.length / 4);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Select Sources for Analysis
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose which sources to include in the knowledge graph analysis
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="text-gray-400 hover:text-gray-600 transition-colors"
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

        {/* Warning Banner */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-amber-600 flex-shrink-0"
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
            <div className="text-sm text-amber-800">
              <strong>This will reset the memory graph.</strong> All existing
              nodes and links will be removed before creating new ones from the
              selected sources.
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Loading sources...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg
                  className="w-12 h-12 text-red-400 mx-auto mb-3"
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
                <p className="text-red-600">{error}</p>
              </div>
            </div>
          ) : sources.length === 0 ? (
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
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-gray-500">No sources available</p>
                <p className="text-sm text-gray-400 mt-1">
                  Start a conversation or add artifacts to analyze
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
                    className="px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
                <span className="text-sm text-gray-500 font-medium">
                  {selectedIds.size} of {sources.length} selected
                </span>
              </div>

              {/* Source Groups as Tables */}
              {(Object.keys(SOURCE_TYPE_CONFIG) as SourceType[]).map((type) => {
                const typeSources = sourcesByType[type];
                if (typeSources.length === 0) return null;

                const config = SOURCE_TYPE_CONFIG[type];
                const isFullySelected = isTypeFullySelected(type);
                const isPartiallySelected = isTypePartiallySelected(type);
                const isCollapsed = collapsedTypes.has(type);
                const selectedCount = typeSources.filter((s) =>
                  selectedIds.has(s.id),
                ).length;

                return (
                  <div
                    key={type}
                    className={`border rounded-lg overflow-hidden ${config.borderColor}`}
                  >
                    {/* Type Header */}
                    <div
                      className={`px-4 py-3 ${config.bgColor} flex items-center justify-between cursor-pointer`}
                      onClick={() => toggleTypeCollapsed(type)}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          className="text-gray-500 hover:text-gray-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTypeCollapsed(type);
                          }}
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                        <div className={config.iconColor}>{config.icon}</div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {config.label}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {config.description} &middot; {selectedCount}/
                            {typeSources.length} selected
                          </p>
                        </div>
                      </div>
                      <label
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isFullySelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isPartiallySelected;
                          }}
                          onChange={(e) =>
                            toggleTypeAll(type, e.target.checked)
                          }
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-600">All</span>
                      </label>
                    </div>

                    {/* Source Table */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="w-10 px-3 py-2 text-left">
                                <span className="sr-only">Select</span>
                              </th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600">
                                Title / Preview
                              </th>
                              <th className="w-24 px-3 py-2 text-left font-medium text-gray-600">
                                Type
                              </th>
                              <th className="w-20 px-3 py-2 text-center font-medium text-gray-600">
                                Weight
                              </th>
                              <th className="w-20 px-3 py-2 text-right font-medium text-gray-600">
                                Tokens
                              </th>
                              <th className="w-10 px-3 py-2">
                                <span className="sr-only">Expand</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {typeSources.map((source) => {
                              const isSelected = selectedIds.has(source.id);
                              const isExpanded = expandedIds.has(source.id);
                              const title = getSourceTitle(source);
                              const subtitle = getSourceSubtitle(source);
                              const tokens = estimateTokens(source.content);

                              return (
                                <Fragment key={source.id}>
                                  <tr
                                    className={`hover:bg-gray-50 transition-colors ${
                                      isSelected ? "bg-purple-50/30" : ""
                                    }`}
                                  >
                                    <td className="px-3 py-2">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSource(source.id)}
                                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <div
                                        className="cursor-pointer"
                                        onClick={() =>
                                          toggleExpanded(source.id)
                                        }
                                      >
                                        <div className="font-medium text-gray-900 truncate max-w-md">
                                          {title}
                                        </div>
                                        <div className="text-gray-500 truncate max-w-md text-xs mt-0.5">
                                          {source.content.slice(0, 100)}
                                          {source.content.length > 100
                                            ? "..."
                                            : ""}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">
                                      {(() => {
                                        const insightStyle =
                                          getInsightTypeStyle(source);
                                        if (insightStyle) {
                                          return (
                                            <span
                                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${insightStyle.bgColor} ${insightStyle.color}`}
                                            >
                                              {subtitle}
                                            </span>
                                          );
                                        }
                                        return (
                                          <span
                                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${config.bgColor} ${config.textColor}`}
                                          >
                                            {subtitle || type.replace("_", " ")}
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span
                                        className={`inline-flex items-center justify-center w-12 py-0.5 text-xs font-medium rounded ${
                                          source.weight >= 0.9
                                            ? "bg-green-100 text-green-700"
                                            : source.weight >= 0.7
                                              ? "bg-blue-100 text-blue-700"
                                              : "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {(source.weight * 100).toFixed(0)}%
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-500 font-mono text-xs">
                                      ~{tokens.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2">
                                      <button
                                        onClick={() =>
                                          toggleExpanded(source.id)
                                        }
                                        className="text-gray-400 hover:text-gray-600"
                                      >
                                        <svg
                                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
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
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr>
                                      <td
                                        colSpan={6}
                                        className="px-3 py-3 bg-gray-50 border-t border-gray-100"
                                      >
                                        <div className="space-y-2">
                                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                            Full Content
                                          </div>
                                          <div className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200 max-h-64 overflow-y-auto font-mono text-xs">
                                            {source.content}
                                          </div>
                                          {source.metadata.timestamp && (
                                            <div className="text-xs text-gray-500">
                                              Timestamp:{" "}
                                              {formatTimestamp(
                                                source.metadata
                                                  .timestamp as string,
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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
              <span className="font-medium">
                Estimated tokens:{" "}
                <span className="font-mono">
                  ~
                  {sources
                    .filter((s) => selectedIds.has(s.id))
                    .reduce(
                      (sum, s) => sum + Math.ceil(s.content.length / 4),
                      0,
                    )
                    .toLocaleString()}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing || selectedIds.size === 0}
              className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
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
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  Analyze Sources ({selectedIds.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SourceSelectionModal;
