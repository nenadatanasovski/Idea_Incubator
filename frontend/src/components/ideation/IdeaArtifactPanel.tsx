// =============================================================================
// FILE: frontend/src/components/ideation/IdeaArtifactPanel.tsx
// Redesigned artifact panel with table (20%) + preview (80%) layout
// Implements TEST-UI-006 requirements with backwards compatibility
// =============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  FileText,
  ChevronLeft,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Link2,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { ArtifactTable } from "./ArtifactTable";
import { RisksList } from "./RisksList";
import {
  ErrorBoundary,
  OfflineIndicator,
  useNetworkStatus,
} from "./ErrorBoundary";
import type {
  Artifact,
  IdeaCandidate,
  ViabilityRisk,
} from "../../types/ideation";
import type {
  ClassificationInfo,
  ProposedChange,
} from "../../types/ideation-state";
import type { Spec, SpecSection, SpecWorkflowState } from "../../types/spec";
import { SpecPanel } from "./SpecPanel";

// =============================================================================
// Types
// =============================================================================

export interface IdeaArtifactPanelProps {
  // Idea props (for backwards compatibility)
  candidate?: IdeaCandidate | null;
  risks?: ViabilityRisk[];
  showIntervention?: boolean;
  onContinue?: () => void;
  onDiscard?: () => void;
  // Artifact props
  artifacts: Artifact[];
  currentArtifact?: Artifact | null; // For backwards compatibility
  selectedArtifactPath?: string | null; // New prop for selection
  classifications?: Record<string, ClassificationInfo>;
  onSelectArtifact: (artifact: Artifact) => void;
  onCloseArtifact?: () => void; // For backwards compatibility
  onExpandArtifact?: () => void; // For backwards compatibility
  onToggleFolder?: (folderPath: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEditArtifact?: (...args: any[]) => void | Promise<void>;
  onDeleteArtifact?: (artifactId: string) => void;
  onRenameArtifact?: (artifactId: string, newTitle: string) => Promise<void>;
  onCopyRef?: (artifactId: string) => void;
  isArtifactLoading?: boolean;
  isLoading?: boolean;
  // Panel state
  isMinimized?: boolean;
  onExpandPanel?: () => void;
  onClosePanel?: () => void;
  // Spec props (SPEC-006-E)
  spec?: Spec | null;
  specSections?: SpecSection[];
  isSpecEditing?: boolean;
  onSpecEdit?: () => void;
  onSpecSave?: (updates: Partial<Spec>) => Promise<void>;
  onSpecCancel?: () => void;
  onSpecTransition?: (newState: SpecWorkflowState) => Promise<void>;
  onSpecCreateTasks?: () => Promise<void>;
  onGenerateSpec?: () => void;
  isSpecLoading?: boolean;
  // Insights props (chat insights from memory graph analysis)
  insights?: ProposedChange[];
  pendingInsightsCount?: number;
  onAnalyzeInsights?: () => void;
  isAnalyzingInsights?: boolean;
  onDeleteInsight?: (insightId: string) => void;
  onEditInsight?: (insightId: string, updates: Partial<ProposedChange>) => void;
  // Navigation callbacks for source lineage in insights
  onNavigateToChatMessage?: (messageId: string) => void;
  onNavigateToArtifact?: (artifactId: string) => void;
  onNavigateToMemoryDB?: (tableName: string, blockId?: string) => void;
  // Highlight specific insight by sourceId (used for navigation from Source Lineage)
  highlightInsightSourceId?: string | null;
  onClearHighlightInsight?: () => void;
  // Force tab switch from external navigation (e.g., clicking artifact in Source Lineage)
  forceActiveTab?: TabType | null;
  onForceActiveTabHandled?: () => void;
}

type TabType = "idea" | "artifacts" | "spec" | "insights";

// =============================================================================
// Icons
// =============================================================================

const CloseIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const ExpandIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
    />
  </svg>
);

const CollapseIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
    />
  </svg>
);

// =============================================================================
// Idea Content Component (for tab view)
// =============================================================================

interface IdeaContentProps {
  candidate: IdeaCandidate | null;
  risks: ViabilityRisk[];
  showIntervention: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}

const IdeaContent: React.FC<IdeaContentProps> = ({
  candidate,
  risks,
  showIntervention,
  onContinue,
  onDiscard,
}) => {
  if (!candidate) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No idea yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Start the conversation to explore ideas
          </p>
        </div>
      </div>
    );
  }

  if (showIntervention && risks.length > 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-800">Viability Concerns</p>
              <p className="text-sm text-orange-700 mt-1">
                This idea has significant risks that may affect its success.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900">{candidate.title}</h3>
        </div>

        <RisksList risks={risks} maxDisplay={5} />

        <div className="space-y-2 pt-2">
          <button
            onClick={onContinue}
            className="w-full flex items-center justify-center gap-2 px-4 py-2
                       bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors
                       focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ArrowRight className="w-4 h-4" />
            Continue Anyway
          </button>
          <button
            onClick={onDiscard}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg
                       hover:bg-gray-50 text-gray-700 transition-colors
                       focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Start Fresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">{candidate.title}</h3>
        {candidate.summary && (
          <p className="text-sm text-gray-600 mt-1">{candidate.summary}</p>
        )}
      </div>

      {risks.length > 0 && <RisksList risks={risks} maxDisplay={3} />}
    </div>
  );
};

// =============================================================================
// Insights Content Component (for tab view)
// =============================================================================

interface InsightsContentProps {
  insights: ProposedChange[];
  pendingCount: number;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onDelete?: (insightId: string) => void;
  onEdit?: (insightId: string, updates: Partial<ProposedChange>) => void;
  // Navigation callbacks for source lineage
  onNavigateToChatMessage?: (messageId: string) => void;
  onNavigateToArtifact?: (artifactId: string) => void;
  onNavigateToMemoryDB?: (tableName: string, blockId?: string) => void;
  // Highlight a specific insight
  highlightedInsightId?: string | null;
}

const InsightsContent: React.FC<InsightsContentProps> = ({
  insights,
  pendingCount,
  onAnalyze,
  isAnalyzing,
  onDelete,
  onEdit,
  onNavigateToChatMessage,
  onNavigateToArtifact,
  onNavigateToMemoryDB,
  highlightedInsightId,
}) => {
  // Track which insight is being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Track which insights/sources have expanded text
  const [expandedContent, setExpandedContent] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );
  // Track which insights have their sources accordion expanded
  const [expandedSourcesAccordion, setExpandedSourcesAccordion] = useState<
    Set<string>
  >(new Set());

  // Toggle content expansion
  const toggleContentExpansion = (insightId: string) => {
    setExpandedContent((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(insightId)) {
        newSet.delete(insightId);
      } else {
        newSet.add(insightId);
      }
      return newSet;
    });
  };

  // Toggle source expansion
  const toggleSourceExpansion = (insightId: string, sourceIdx: number) => {
    const key = `${insightId}-${sourceIdx}`;
    setExpandedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Toggle sources accordion
  const toggleSourcesAccordion = (insightId: string) => {
    setExpandedSourcesAccordion((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(insightId)) {
        newSet.delete(insightId);
      } else {
        newSet.add(insightId);
      }
      return newSet;
    });
  };

  // Ref for scrolling to highlighted insight
  const highlightedRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted insight and expand sources when it changes
  useEffect(() => {
    if (highlightedInsightId && highlightedRef.current) {
      // Auto-expand sources accordion for highlighted insight
      setExpandedSourcesAccordion((prev) => {
        const newSet = new Set(prev);
        newSet.add(highlightedInsightId);
        return newSet;
      });
      highlightedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlightedInsightId]);

  // Helper to get icon for change type
  const getChangeTypeIcon = (type: ProposedChange["type"]) => {
    switch (type) {
      case "create_block":
        return <Plus className="w-4 h-4 text-green-500" />;
      case "update_block":
        return <RefreshCw className="w-4 h-4 text-blue-500" />;
      case "create_link":
        return <Link2 className="w-4 h-4 text-purple-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-gray-500" />;
    }
  };

  // Helper to get label for change type
  const getChangeTypeLabel = (type: ProposedChange["type"]) => {
    switch (type) {
      case "create_block":
        return "New Insight";
      case "update_block":
        return "Updated";
      case "create_link":
        return "Connection";
      default:
        return "Change";
    }
  };

  // Helper to format confidence as percentage
  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  // Start editing an insight
  const handleStartEdit = (insight: ProposedChange) => {
    setEditingId(insight.id);
    setEditTitle(insight.title || "");
    setEditContent(insight.content || "");
  };

  // Save edit
  const handleSaveEdit = (insightId: string) => {
    if (onEdit) {
      onEdit(insightId, {
        title: editTitle,
        content: editContent,
      });
    }
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  // Delete insight with confirmation
  const handleDelete = (insightId: string) => {
    if (onDelete) {
      onDelete(insightId);
    }
  };

  if (insights.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-gray-500 font-medium">No insights yet</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            Chat insights will appear here after analyzing the conversation
          </p>
          {pendingCount > 0 && (
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze {pendingCount} pending
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {/* Header with analyze button */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-purple-700 font-medium">
              {pendingCount} new insights available
            </span>
          </div>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Analyzing
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                Refresh
              </>
            )}
          </button>
        </div>
      )}

      {/* Insights list */}
      <div className="space-y-2">
        {insights.map((insight) => {
          const isHighlighted = highlightedInsightId === insight.id;
          return (
            <div
              key={insight.id}
              ref={isHighlighted ? highlightedRef : undefined}
              className={`p-3 bg-white border rounded-lg transition-all group ${
                isHighlighted
                  ? "border-purple-500 ring-2 ring-purple-300 bg-purple-50 animate-pulse"
                  : "border-gray-200 hover:border-purple-300"
              }`}
            >
              {editingId === insight.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Insight title..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">
                      Content
                    </label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      placeholder="Insight content..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(insight.id)}
                      className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getChangeTypeIcon(insight.type)}
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {getChangeTypeLabel(insight.type)}
                      </span>
                      {insight.blockType && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {insight.blockType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 flex-shrink-0 mr-2">
                        {formatConfidence(insight.confidence)} confident
                      </span>
                      {/* Edit/Delete buttons - visible on hover */}
                      {(onEdit || onDelete) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onEdit && (
                            <button
                              onClick={() => handleStartEdit(insight)}
                              className="p-1 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors"
                              title="Edit insight"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => handleDelete(insight.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                              title="Delete insight"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  {insight.title && (
                    <h4 className="font-medium text-gray-900 mt-2 text-sm">
                      {insight.title}
                    </h4>
                  )}

                  {/* Content preview - expandable */}
                  {insight.content && (
                    <div className="mt-1">
                      <p
                        className={`text-sm text-gray-600 dark:text-gray-300 ${
                          !expandedContent.has(insight.id) ? "line-clamp-2" : ""
                        }`}
                      >
                        {insight.content}
                      </p>
                      {insight.content.length > 150 && (
                        <button
                          onClick={() => toggleContentExpansion(insight.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mt-1"
                        >
                          {expandedContent.has(insight.id)
                            ? "Show less"
                            : "Show more"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Link info */}
                  {insight.type === "create_link" && insight.reason && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-medium">
                      {insight.reason}
                    </p>
                  )}

                  {/* Source attribution - collapsible accordion */}
                  {(insight.sourceType ||
                    (insight.allSources && insight.allSources.length > 0)) && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      {/* Accordion header - clickable to expand/collapse */}
                      <button
                        onClick={() => toggleSourcesAccordion(insight.id)}
                        className="flex items-center gap-1.5 w-full text-left hover:bg-gray-50 rounded px-1 py-0.5 -mx-1 transition-colors"
                      >
                        <svg
                          className={`w-3 h-3 text-gray-400 transition-transform ${
                            expandedSourcesAccordion.has(insight.id)
                              ? "rotate-90"
                              : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        <span className="text-xs text-gray-400">
                          {insight.allSources && insight.allSources.length > 0
                            ? `${insight.allSources.length + 1} sources`
                            : "1 source"}
                        </span>
                        {insight.sourceType && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">
                            {insight.sourceType.replace(/_/g, " ")}
                          </span>
                        )}
                      </button>

                      {/* Accordion content - sources list */}
                      {expandedSourcesAccordion.has(insight.id) && (
                        <div className="mt-2 space-y-2 pl-4">
                          {/* Primary source */}
                          {insight.sourceType && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-400">
                                Primary:
                              </span>
                              <button
                                onClick={() => {
                                  if (insight.sourceId) {
                                    if (
                                      insight.sourceType === "artifact" &&
                                      onNavigateToArtifact
                                    ) {
                                      onNavigateToArtifact(insight.sourceId);
                                    } else if (
                                      insight.sourceType === "memory_file" &&
                                      onNavigateToMemoryDB
                                    ) {
                                      onNavigateToMemoryDB(
                                        "files",
                                        insight.sourceId,
                                      );
                                    } else if (
                                      (insight.sourceType === "conversation" ||
                                        insight.sourceType ===
                                          "conversation_insight") &&
                                      onNavigateToChatMessage
                                    ) {
                                      onNavigateToChatMessage(insight.sourceId);
                                    }
                                  }
                                }}
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  insight.sourceId &&
                                  ((insight.sourceType === "artifact" &&
                                    onNavigateToArtifact) ||
                                    (insight.sourceType === "memory_file" &&
                                      onNavigateToMemoryDB) ||
                                    ((insight.sourceType === "conversation" ||
                                      insight.sourceType ===
                                        "conversation_insight") &&
                                      onNavigateToChatMessage))
                                    ? "bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
                                    : "bg-gray-50 text-gray-500 cursor-default"
                                }`}
                              >
                                {insight.sourceType.replace(/_/g, " ")}
                              </button>
                            </div>
                          )}

                          {/* All sources - show original source content */}
                          {insight.allSources &&
                            insight.allSources.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-xs text-gray-400">
                                  Supporting sources:
                                </span>
                                {insight.allSources.map((source, idx) => (
                                  <div
                                    key={idx}
                                    className="ml-2 p-2 bg-gray-50 rounded-md"
                                  >
                                    <button
                                      onClick={() => {
                                        if (
                                          source.type === "artifact" &&
                                          onNavigateToArtifact
                                        ) {
                                          onNavigateToArtifact(
                                            source.title || source.id,
                                          );
                                        } else if (
                                          source.type === "memory_file" &&
                                          onNavigateToMemoryDB
                                        ) {
                                          onNavigateToMemoryDB(
                                            "files",
                                            source.id,
                                          );
                                        }
                                      }}
                                      className={`text-xs font-medium ${
                                        (source.type === "artifact" &&
                                          onNavigateToArtifact) ||
                                        (source.type === "memory_file" &&
                                          onNavigateToMemoryDB)
                                          ? "text-blue-600 hover:text-blue-800 cursor-pointer"
                                          : "text-gray-600"
                                      }`}
                                    >
                                      {source.title ||
                                        source.type.replace(/_/g, " ")}
                                    </button>
                                    {source.contentSnippet && (
                                      <div className="mt-1">
                                        <p
                                          className={`text-xs text-gray-500 dark:text-gray-400 italic ${
                                            !expandedSources.has(
                                              `${insight.id}-${idx}`,
                                            )
                                              ? "line-clamp-3"
                                              : ""
                                          }`}
                                        >
                                          "{source.contentSnippet}"
                                        </p>
                                        {source.contentSnippet.length > 200 && (
                                          <button
                                            onClick={() =>
                                              toggleSourceExpansion(
                                                insight.id,
                                                idx,
                                              )
                                            }
                                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mt-1"
                                          >
                                            {expandedSources.has(
                                              `${insight.id}-${idx}`,
                                            )
                                              ? "Show less"
                                              : "Show more"}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const IdeaArtifactPanel: React.FC<IdeaArtifactPanelProps> = ({
  // Idea props
  candidate = null,
  risks = [],
  showIntervention = false,
  onContinue = () => {},
  onDiscard = () => {},
  // Artifact props
  artifacts,
  currentArtifact,
  selectedArtifactPath,
  classifications = {},
  onSelectArtifact,
  onCloseArtifact,
  onExpandArtifact,
  onToggleFolder,
  onEditArtifact,
  onDeleteArtifact,
  // onRenameArtifact - intentionally unused, kept for backwards compat
  onCopyRef,
  isArtifactLoading = false,
  isLoading = false,
  // Panel state
  isMinimized = false,
  onExpandPanel,
  onClosePanel,
  // Spec props (SPEC-006-E)
  spec = null,
  specSections = [],
  isSpecEditing = false,
  onSpecEdit,
  onSpecSave,
  onSpecCancel,
  onSpecTransition,
  onSpecCreateTasks,
  onGenerateSpec,
  isSpecLoading = false,
  // Insights props (chat insights from memory graph analysis)
  insights = [],
  pendingInsightsCount = 0,
  onAnalyzeInsights,
  isAnalyzingInsights = false,
  onDeleteInsight,
  onEditInsight,
  // Navigation callbacks for source lineage in insights
  onNavigateToChatMessage,
  onNavigateToArtifact,
  onNavigateToMemoryDB,
  // Highlight specific insight by sourceId (used for navigation from Source Lineage)
  highlightInsightSourceId,
  onClearHighlightInsight,
  // Force tab switch from external navigation
  forceActiveTab,
  onForceActiveTabHandled,
}) => {
  // Internal state for tabs (for backwards compatibility)
  const [activeTab, setActiveTab] = useState<TabType>("idea");
  const [highlightedInsightId, setHighlightedInsightId] = useState<
    string | null
  >(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track selected artifact object
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    null,
  );

  // Track latest artifact ID for auto-expanding new artifacts
  const [latestArtifactId, setLatestArtifactId] = useState<string | null>(null);
  const prevArtifactsLengthRef = useRef(artifacts.length);

  // Detect when new artifacts are added and track the latest one
  useEffect(() => {
    if (artifacts.length > prevArtifactsLengthRef.current) {
      // New artifact added - find the newest one by createdAt
      const sorted = [...artifacts].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      if (sorted.length > 0) {
        setLatestArtifactId(sorted[0].id);
      }
    }
    prevArtifactsLengthRef.current = artifacts.length;
  }, [artifacts]);

  // Handle insight highlighting from external navigation (e.g., Source Lineage click)
  useEffect(() => {
    if (highlightInsightSourceId && insights.length > 0) {
      // Find the insight that matches either by id (block ID from Source Lineage)
      // or by sourceId (original message ID)
      const matchingInsight = insights.find(
        (insight) =>
          insight.id === highlightInsightSourceId ||
          insight.sourceId === highlightInsightSourceId,
      );

      if (matchingInsight) {
        // Switch to insights tab and highlight the insight
        setActiveTab("insights");
        setHighlightedInsightId(matchingInsight.id);

        // Clear highlight after 3 seconds
        const timer = setTimeout(() => {
          setHighlightedInsightId(null);
          if (onClearHighlightInsight) {
            onClearHighlightInsight();
          }
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [highlightInsightSourceId, insights, onClearHighlightInsight]);

  // Handle forced tab switch from external navigation (e.g., clicking artifact in Source Lineage)
  useEffect(() => {
    if (forceActiveTab) {
      console.log("[IdeaArtifactPanel] Forcing tab switch to:", forceActiveTab);
      setActiveTab(forceActiveTab);
      // Notify parent that we've handled the forced tab switch
      if (onForceActiveTabHandled) {
        onForceActiveTabHandled();
      }
    }
  }, [forceActiveTab, onForceActiveTabHandled]);

  // Compute effective selected path from either new prop or currentArtifact (backwards compat)
  const effectiveSelectedPath =
    selectedArtifactPath ?? currentArtifact?.id ?? null;

  // Update selected artifact when path or currentArtifact changes
  useEffect(() => {
    if (currentArtifact) {
      // Use currentArtifact directly if provided (backwards compat)
      setSelectedArtifact(currentArtifact);
    } else if (effectiveSelectedPath) {
      const artifact = artifacts.find(
        (a) =>
          a.id === effectiveSelectedPath ||
          a.title === effectiveSelectedPath ||
          a.identifier === effectiveSelectedPath,
      );
      setSelectedArtifact(artifact || null);
    } else {
      setSelectedArtifact(null);
    }
  }, [effectiveSelectedPath, currentArtifact, artifacts]);

  // Auto-switch to artifacts tab when a new artifact is added
  useEffect(() => {
    if (artifacts.length > 0 && selectedArtifact) {
      setActiveTab("artifacts");
    }
  }, [artifacts.length, selectedArtifact?.id]);

  // Handle artifact selection
  const handleSelectArtifact = useCallback(
    (artifact: Artifact) => {
      setSelectedArtifact(artifact);
      onSelectArtifact(artifact);
    },
    [onSelectArtifact],
  );

  // Handle folder toggle
  const handleToggleFolder = useCallback(
    (folderPath: string) => {
      if (onToggleFolder) {
        onToggleFolder(folderPath);
      }
    },
    [onToggleFolder],
  );

  // Handle edit with content
  const handleEdit = useCallback(
    (artifactId: string, content?: string) => {
      if (onEditArtifact) {
        onEditArtifact(artifactId, content);
      }
    },
    [onEditArtifact],
  );

  // Handle delete
  const handleDelete = useCallback(
    (artifactId: string) => {
      if (onDeleteArtifact) {
        onDeleteArtifact(artifactId);
        // Clear selection if deleted artifact was selected
        if (selectedArtifact?.id === artifactId) {
          setSelectedArtifact(null);
        }
      }
    },
    [onDeleteArtifact, selectedArtifact],
  );

  // Handle copy ref
  const handleCopyRef = useCallback(
    (artifactId: string) => {
      if (onCopyRef) {
        onCopyRef(artifactId);
      }
    },
    [onCopyRef],
  );

  // Handle clear selection (for keyboard navigation Escape key)
  const handleClearSelection = useCallback(() => {
    setSelectedArtifact(null);
  }, []);

  // Handle close panel (backwards compat with onCloseArtifact)
  const handleClosePanel = onClosePanel ?? onCloseArtifact;
  const handleExpandPanel = onExpandPanel ?? onExpandArtifact;

  // Determine loading state
  const loading = isLoading || isArtifactLoading;

  // Network status for offline indicator (TEST-UI-014)
  const isOffline = useNetworkStatus();

  // Minimized view - show expand button
  if (isMinimized) {
    return (
      <div
        data-testid="artifact-panel-minimized"
        className="flex flex-col items-center w-10 h-full bg-gray-50 border-l border-gray-200"
      >
        <button
          onClick={handleExpandPanel}
          className="flex flex-col items-center gap-2 py-4 px-2 hover:bg-gray-100 transition-colors w-full"
          title="Expand panel"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
          <span
            className="text-xs text-gray-500 transform rotate-180"
            style={{ writingMode: "vertical-rl" }}
          >
            {candidate ? candidate.title.slice(0, 15) : "Panel"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* Offline indicator (TEST-UI-014) */}
      <OfflineIndicator isOffline={isOffline} />

      <div
        data-testid="artifact-panel"
        className={`
          flex flex-col bg-white border-l border-gray-200 relative
          ${isFullscreen ? "fixed inset-0 z-50" : "w-1/4 h-full"}
        `}
      >
        {/* Header with main tabs */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex gap-1 flex-1 min-w-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab("artifacts")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex-shrink-0
              ${
                activeTab === "artifacts"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <FileText className="w-4 h-4" />
              Artifacts
              {artifacts.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                  {artifacts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("insights")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex-shrink-0
              ${
                activeTab === "insights"
                  ? "bg-purple-100 text-purple-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Insights
              {(insights.length > 0 || pendingInsightsCount > 0) && (
                <span
                  className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                    pendingInsightsCount > 0
                      ? "bg-purple-200 text-purple-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {pendingInsightsCount > 0
                    ? pendingInsightsCount
                    : insights.length}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            {handleClosePanel && (
              <button
                onClick={handleClosePanel}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                title="Minimize panel"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === "idea" && (
          <IdeaContent
            candidate={candidate}
            risks={risks}
            showIntervention={showIntervention}
            onContinue={onContinue}
            onDiscard={onDiscard}
          />
        )}

        {activeTab === "artifacts" && (
          /* Artifacts tab with accordion layout */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Accordion artifact list - takes full height */}
            <div
              data-testid="artifact-table-container"
              className="flex-1 overflow-auto"
            >
              {loading ? (
                // Show skeleton loading state
                <ArtifactTable
                  artifacts={[]}
                  selectedPath={null}
                  onSelect={() => {}}
                  onToggleFolder={() => {}}
                  classifications={{}}
                  isLoading={true}
                />
              ) : artifacts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">
                      No artifacts yet
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Artifacts created during the session will appear here
                    </p>
                  </div>
                </div>
              ) : (
                <ArtifactTable
                  artifacts={artifacts}
                  selectedPath={effectiveSelectedPath}
                  onSelect={handleSelectArtifact}
                  onToggleFolder={handleToggleFolder}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onCopyRef={handleCopyRef}
                  onClearSelection={handleClearSelection}
                  classifications={classifications}
                  isLoading={false}
                  latestArtifactId={latestArtifactId}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "spec" && (
          /* Spec tab (SPEC-006-E) */
          <div className="flex-1 overflow-hidden">
            {spec ? (
              <SpecPanel
                spec={spec}
                sections={specSections}
                isEditing={isSpecEditing}
                onEdit={onSpecEdit || (() => {})}
                onSave={onSpecSave || (async () => {})}
                onCancel={onSpecCancel || (() => {})}
                onTransition={onSpecTransition || (async () => {})}
                onCreateTasks={onSpecCreateTasks || (async () => {})}
                isLoading={isSpecLoading}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 h-full">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No spec yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Continue the conversation to generate a specification
                  </p>
                  {onGenerateSpec && (
                    <button
                      onClick={onGenerateSpec}
                      disabled={isSpecLoading}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isSpecLoading ? "Generating..." : "Generate Spec"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "insights" && (
          /* Insights tab - chat insights from memory graph analysis */
          <InsightsContent
            insights={insights}
            pendingCount={pendingInsightsCount}
            onAnalyze={onAnalyzeInsights || (() => {})}
            isAnalyzing={isAnalyzingInsights}
            onDelete={onDeleteInsight}
            onEdit={onEditInsight}
            onNavigateToChatMessage={onNavigateToChatMessage}
            onNavigateToArtifact={
              onNavigateToArtifact
                ? (artifactId: string) => {
                    // Switch to artifacts tab AND call the navigation callback
                    setActiveTab("artifacts");
                    onNavigateToArtifact(artifactId);
                  }
                : undefined
            }
            onNavigateToMemoryDB={onNavigateToMemoryDB}
            highlightedInsightId={highlightedInsightId}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default IdeaArtifactPanel;
