// =============================================================================
// FILE: frontend/src/components/ideation/GraphTabPanel.tsx
// Graph tab panel that integrates GraphContainer with the ideation session
// Lazy-loaded for performance
// =============================================================================

import {
  lazy,
  Suspense,
  useState,
  useCallback,
  useEffect,
  memo,
  Component,
  type ReactNode,
  type ErrorInfo,
} from "react";
import type { GraphNode, GraphFilters } from "../../types/graph";
import type { ProposedChange } from "../../types/ideation-state";
import { useGraphDataWithWebSocket } from "../graph/hooks/useGraphDataWithWebSocket";
import { GraphUpdateConfirmation } from "../graph/GraphUpdateConfirmation";

import { ProposedChangesReviewModal } from "../graph/ProposedChangesReviewModal";
import { useIdeationAPI } from "../../hooks/useIdeationAPI";
import type {
  NewBlockUpdate,
  CascadeEffect,
} from "../graph/GraphUpdateConfirmation";
import { analyzeCascadeEffects } from "../graph/utils/cascadeDetection";
import { MemoryGraphStats } from "./MemoryGraphStats";
import { CreateBlockForm } from "./CreateBlockForm";
import { MemoryBlockSearch } from "./MemoryBlockSearch";
import { Neo4jGraphView } from "./Neo4jGraphView";

// Lazy load GraphContainer for code splitting
const GraphContainer = lazy(() => import("../graph/GraphContainer"));

/**
 * Error Boundary for the Graph Canvas to catch WebGL/Reagraph errors
 */
interface GraphErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface GraphErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GraphErrorBoundary extends Component<
  GraphErrorBoundaryProps,
  GraphErrorBoundaryState
> {
  constructor(props: GraphErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): GraphErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GraphErrorBoundary] Caught error:", error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          className="flex items-center justify-center h-full min-h-[400px] bg-amber-50 rounded-lg p-6"
          data-testid="graph-error-boundary"
        >
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-amber-500"
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
            </div>
            <h3 className="text-lg font-medium text-amber-800 mb-2">
              Graph Rendering Issue
            </h3>
            <p className="text-sm text-amber-600 mb-4 max-w-md">
              The graph visualization encountered an error. This may be due to
              WebGL compatibility issues in your browser.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export interface GraphTabPanelProps {
  sessionId: string;
  ideaSlug?: string;
  isVisible: boolean;
  onNodeSelect?: (node: GraphNode | null) => void;
  onUpdateCount?: (count: number) => void;
  className?: string;
  // Memory Graph Update
  onUpdateMemoryGraph?: () => void;
  isAnalyzingGraph?: boolean;
  pendingGraphChanges?: number;
  // Source navigation callbacks
  onNavigateToChatMessage?: (messageId: string, turnIndex?: number) => void;
  onNavigateToArtifact?: (artifactId: string, section?: string) => void;
  onNavigateToMemoryDB?: (tableName: string, blockId?: string) => void;
  onNavigateToExternal?: (url: string) => void;
  // Navigate to Insights tab and highlight the insight with matching sourceId
  onNavigateToInsight?: (sourceId: string) => void;
  // Selection actions for the selected node
  onLinkNode?: (nodeId: string) => void;
  onGroupIntoSynthesis?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string, nodeLabel: string) => void;
  /** Callback to delete all nodes in a group (from Node Group Report view) */
  onDeleteNodeGroup?: (nodeIds: string[], groupName: string) => void;
  // Trigger to refetch graph data (increment to trigger refetch)
  refetchTrigger?: number;
  // Success notification to display
  successNotification?: {
    action: "created" | "updated" | "deleted";
    nodeLabel: string;
  } | null;
  // Callback to clear the notification
  onClearNotification?: () => void;
  // Callback when a snapshot is restored (to refresh other panels like MemoryDatabase)
  onSnapshotRestored?: () => void;
  // Existing insights from the right panel for source selection
  existingInsights?: ProposedChange[];
  // Callback when source mapping completes (to refresh insights in right panel)
  onInsightsRefresh?: () => void;
}

/**
 * Loading skeleton for the graph panel
 */
function GraphLoadingSkeleton() {
  return (
    <div
      className="flex items-center justify-center h-full min-h-[400px] bg-gray-50 rounded-lg animate-pulse"
      data-testid="graph-loading"
    >
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full mb-4" />
        <div className="h-4 w-32 bg-gray-200 rounded mx-auto mb-2" />
        <div className="h-3 w-48 bg-gray-200 rounded mx-auto" />
      </div>
    </div>
  );
}

export const GraphTabPanel = memo(function GraphTabPanel({
  sessionId,
  ideaSlug,
  isVisible,
  onNodeSelect,
  onUpdateCount,
  className = "",
  onUpdateMemoryGraph,
  isAnalyzingGraph = false,
  pendingGraphChanges = 0,
  onNavigateToChatMessage,
  onNavigateToArtifact,
  onNavigateToMemoryDB,
  onNavigateToExternal,
  onNavigateToInsight,
  onLinkNode,
  onGroupIntoSynthesis,
  onDeleteNode,
  onDeleteNodeGroup,
  refetchTrigger,
  successNotification,
  onClearNotification,
  onSnapshotRestored,
  existingInsights = [],
  onInsightsRefresh,
}: GraphTabPanelProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  // Trigger to reset GraphContainer's internal filters
  const [resetFiltersTrigger, setResetFiltersTrigger] = useState(0);
  // State for showing create block form
  const [showCreateBlock, setShowCreateBlock] = useState(false);
  // State for showing search panel
  const [showSearch, setShowSearch] = useState(false);
  // State for switching to Neo4j view
  const [showNeo4jView, setShowNeo4jView] = useState(false);

  // State for update confirmation dialog (T6.3)
  const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
  const [pendingNewBlock, setPendingNewBlock] = useState<NewBlockUpdate | null>(
    null,
  );
  const [cascadeEffects, setCascadeEffects] = useState<CascadeEffect | null>(
    null,
  );
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);

  // Use the combined hook for data + WebSocket
  const {
    filteredData,
    isLoading,
    error,
    lastUpdated,
    isConnected,
    isReconnecting,
    isStale,
    applyFilters,
    resetFilters,
    refetch,
    pendingUpdates,
    recentlyAddedNodeIds,
    recentlyAddedEdgeIds,
    // Source mapping status (background Claude Opus 4.5 processing)
    sourceMappingStatus,
    cancelSourceMapping,
    dismissSourceMappingStatus,
    // Report synthesis status (background report generation)
    reportSynthesisStatus,
    cancelReportSynthesis,
    dismissReportSynthesisStatus,
    // Report refresh trigger (incremented when synthesis completes)
    reportRefreshTrigger,
    // Insights refresh trigger (incremented when source mapping completes)
    insightsRefreshTrigger,
  } = useGraphDataWithWebSocket({
    sessionId,
    ideaSlug,
    enableWebSocket: isVisible, // Only connect when visible
  });

  // Notify parent of pending update count
  useEffect(() => {
    onUpdateCount?.(pendingUpdates.length);
  }, [pendingUpdates.length, onUpdateCount]);

  // Refetch graph data when trigger changes (e.g., after node deletion)
  useEffect(() => {
    if (refetchTrigger !== undefined && refetchTrigger > 0) {
      refetch();
    }
  }, [refetchTrigger, refetch]);

  // Close inspector panel when a node is deleted
  useEffect(() => {
    if (successNotification?.action === "deleted") {
      setSelectedNode(null);
    }
  }, [successNotification]);

  // Notify parent to refresh insights when source mapping completes
  useEffect(() => {
    if (insightsRefreshTrigger > 0) {
      onInsightsRefresh?.();
    }
  }, [insightsRefreshTrigger, onInsightsRefresh]);

  // Handle node selection
  const handleNodeSelect = useCallback(
    (node: GraphNode | null) => {
      setSelectedNode(node);
      onNodeSelect?.(node);
    },
    [onNodeSelect],
  );

  // Handle prompt results
  const handlePromptHighlight = useCallback((nodeIds: string[]) => {
    setHighlightedNodeIds(nodeIds);
    // Clear highlights after 5 seconds
    setTimeout(() => setHighlightedNodeIds([]), 5000);
  }, []);

  const handlePromptFilterChange = useCallback(
    (filters: Partial<GraphFilters>) => {
      applyFilters({
        graphTypes: filters.graphTypes || [],
        blockTypes: filters.blockTypes || [],
        statuses: filters.statuses || [],
        abstractionLevels: filters.abstractionLevels || [],
        sourceTypes: filters.sourceTypes || [],
        confidenceRange: filters.confidenceRange || [0, 1],
      });
    },
    [applyFilters],
  );

  // Combine WebSocket recently added with prompt highlights
  const combinedHighlightedNodeIds = new Set([
    ...recentlyAddedNodeIds,
    ...highlightedNodeIds,
  ]);

  // Handle showing update confirmation when cascade effects are detected (T6.3)
  const handleShowUpdateConfirmation = useCallback(
    (
      newBlock: NewBlockUpdate,
      existingNodes: GraphNode[],
      existingEdges: import("../../types/graph").GraphEdge[],
    ) => {
      // Run cascade analysis
      const analysis = analyzeCascadeEffects(
        {
          id: newBlock.id,
          content: newBlock.content,
          blockType: newBlock.suggestedType,
          graphMembership: newBlock.suggestedGraph,
          confidence: newBlock.confidence,
        },
        existingNodes,
        existingEdges,
        { similarityThreshold: 0.7 },
      );

      // If there are affected nodes or conflicts, show confirmation
      if (analysis.affectedNodes.length > 0 || analysis.conflicts.length > 0) {
        setCascadeEffects({
          affectedNodes: analysis.affectedNodes,
          newLinks: analysis.newLinks.map((link) => ({
            source: link.source,
            target: link.target,
            linkType: link.linkType,
            reason: link.reason,
          })),
          conflicts: analysis.conflicts.map((c) => ({
            nodeId: c.nodeId,
            type: c.type as "contradiction" | "supersession" | "dependency",
            description: c.description,
          })),
          impactRadius: analysis.impactRadius,
        });
        setPendingNewBlock(newBlock);
        setShowUpdateConfirmation(true);
      }
    },
    [],
  );

  // Handle confirm all in update confirmation
  const handleConfirmAllUpdates = useCallback(async () => {
    if (!pendingNewBlock || !cascadeEffects) {
      console.warn("[GraphTabPanel] No pending changes to confirm");
      return;
    }

    setIsProcessingUpdate(true);
    console.log("[GraphTabPanel] Confirming all updates:", pendingNewBlock);

    try {
      // Build the list of changes to apply
      const changes: Array<{
        id: string;
        type: "create_block" | "update_block" | "create_link";
        blockType?: string;
        title?: string;
        content?: string;
        graphMembership?: string[];
        confidence?: number;
        sourceBlockId?: string;
        targetBlockId?: string;
        linkType?: string;
        reason?: string;
        blockId?: string;
        statusChange?: {
          newStatus: "superseded" | "abandoned";
          reason?: string;
        };
      }> = [];

      // 1. Create the new block
      changes.push({
        id: pendingNewBlock.id,
        type: "create_block",
        blockType: pendingNewBlock.suggestedType,
        content: pendingNewBlock.content,
        graphMembership: pendingNewBlock.suggestedGraph,
        confidence: pendingNewBlock.confidence,
      });

      // 2. Add status changes for affected nodes
      for (const affected of cascadeEffects.affectedNodes) {
        if (affected.proposedAction === "supersedes") {
          changes.push({
            id: `update-${affected.id}`,
            type: "update_block",
            blockId: affected.id,
            statusChange: {
              newStatus: "superseded",
              reason: affected.reason,
            },
          });
        } else if (affected.proposedAction === "invalidates") {
          changes.push({
            id: `update-${affected.id}`,
            type: "update_block",
            blockId: affected.id,
            statusChange: {
              newStatus: "abandoned",
              reason: affected.reason,
            },
          });
        }
      }

      // 3. Create new links
      for (const link of cascadeEffects.newLinks) {
        changes.push({
          id: `link-${link.source}-${link.target}`,
          type: "create_link",
          sourceBlockId: link.source,
          targetBlockId: link.target,
          linkType: link.linkType,
          reason: link.reason,
        });
      }

      // Apply all changes via API
      const changeIds = changes.map((c) => c.id);
      await applyGraphChanges(sessionId, changeIds, changes);
      console.log("[GraphTabPanel] Cascade changes applied successfully");

      // Refresh the graph
      refetch();
    } catch (error) {
      console.error("[GraphTabPanel] Error applying cascade changes:", error);
    } finally {
      setIsProcessingUpdate(false);
      setShowUpdateConfirmation(false);
      setPendingNewBlock(null);
      setCascadeEffects(null);
    }
  }, [pendingNewBlock, cascadeEffects, sessionId, applyGraphChanges, refetch]);

  // Handle review each in update confirmation
  const handleReviewEachUpdate = useCallback(() => {
    console.log("[GraphTabPanel] Entering review mode for updates");
    // The GraphUpdateConfirmation component handles the review mode internally
  }, []);

  // Handle cancel update confirmation
  const handleCancelUpdate = useCallback(() => {
    console.log("[GraphTabPanel] Cancelling update confirmation");
    setPendingNewBlock(null);
    setCascadeEffects(null);
  }, []);

  // Handle close update confirmation dialog
  const handleCloseUpdateConfirmation = useCallback(() => {
    setShowUpdateConfirmation(false);
  }, []);

  // Get API functions
  const {
    resetGraph,
    analyzeGraphChanges,
    applyGraphChanges,
    listGraphSnapshots,
    createGraphSnapshot,
    restoreGraphSnapshot,
    deleteGraphSnapshot,
  } = useIdeationAPI();

  // State for tracking analysis progress and pending proposed changes
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingProposedChanges, setPendingProposedChanges] = useState<
    ProposedChange[] | null
  >(null);
  // Sources from analysis - used for lineage tracking when applying changes
  const [pendingSources, setPendingSources] = useState<Array<{
    id: string;
    type: string;
    title: string | null;
    artifactType?: string | null;
    memoryFileType?: string | null;
    weight?: number | null;
    contentSnippet?: string | null;
  }> | null>(null);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);

  // Snapshot/Versioning state
  const [snapshots, setSnapshots] = useState<
    Array<{
      id: string;
      sessionId: string;
      name: string;
      description: string | null;
      blockCount: number;
      linkCount: number;
      createdAt: string;
    }>
  >([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);

  // Load snapshots
  const handleLoadSnapshots = useCallback(async () => {
    setIsLoadingSnapshots(true);
    try {
      const result = await listGraphSnapshots(sessionId);
      setSnapshots(result.snapshots);
    } catch (error) {
      console.error("[GraphTabPanel] Failed to load snapshots:", error);
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, [sessionId, listGraphSnapshots]);

  // Save snapshot
  const handleSaveSnapshot = useCallback(
    async (name: string, description?: string) => {
      setIsSavingSnapshot(true);
      try {
        const result = await createGraphSnapshot(sessionId, name, description);
        // Add new snapshot to the list
        setSnapshots((prev) => [result.snapshot, ...prev]);
      } catch (error) {
        console.error("[GraphTabPanel] Failed to save snapshot:", error);
        throw error;
      } finally {
        setIsSavingSnapshot(false);
      }
    },
    [sessionId, createGraphSnapshot],
  );

  // Restore snapshot
  const handleRestoreSnapshot = useCallback(
    async (snapshotId: string) => {
      setIsRestoringSnapshot(true);
      try {
        await restoreGraphSnapshot(sessionId, snapshotId);
        // Refetch graph data after restore
        refetch();
        // Reload snapshots list (a backup was auto-created)
        handleLoadSnapshots();
        // Notify parent to refresh other panels (e.g., MemoryDatabasePanel)
        onSnapshotRestored?.();
      } catch (error) {
        console.error("[GraphTabPanel] Failed to restore snapshot:", error);
        throw error;
      } finally {
        setIsRestoringSnapshot(false);
      }
    },
    [
      sessionId,
      restoreGraphSnapshot,
      refetch,
      handleLoadSnapshots,
      onSnapshotRestored,
    ],
  );

  // Delete snapshot
  const handleDeleteSnapshot = useCallback(
    async (snapshotId: string) => {
      try {
        await deleteGraphSnapshot(sessionId, snapshotId);
        // Remove from list
        setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      } catch (error) {
        console.error("[GraphTabPanel] Failed to delete snapshot:", error);
        throw error;
      }
    },
    [sessionId, deleteGraphSnapshot],
  );

  // Handle analyze with selected sources - Phase 1: Analyze only, don't apply yet
  const handleAnalyzeWithSources = useCallback(
    async (
      selectedSourceIds: string[],
      selectedSources?: Array<{
        id: string;
        type: string;
        content: string;
        weight: number;
        metadata: Record<string, unknown>;
      }>,
    ) => {
      console.log(
        "[GraphTabPanel] Phase 1: Analyzing with sources:",
        selectedSourceIds.length,
      );
      console.log("[GraphTabPanel] ideaSlug:", ideaSlug || "(not set)");
      if (selectedSources) {
        console.log(
          "[GraphTabPanel] Pre-collected sources provided:",
          selectedSources.length,
        );
      }

      setIsAnalyzing(true);

      try {
        // Analyze with selected sources (don't reset or apply yet!)
        // Pass ideaSlug to include file-based artifacts from idea folder
        // Pass preCollectedSources to avoid re-synthesizing conversations
        const analysis = await analyzeGraphChanges(
          sessionId,
          selectedSourceIds,
          ideaSlug,
          undefined, // sinceTimestamp
          selectedSources, // preCollectedSources - avoids expensive re-synthesis
        );
        console.log(
          "[GraphTabPanel] Analysis complete:",
          analysis.proposedChanges?.length || 0,
          "proposed changes",
        );

        // Store the proposed changes and sources for user review
        // Sources are used for lineage tracking when applying changes
        if (analysis.proposedChanges && analysis.proposedChanges.length > 0) {
          setPendingProposedChanges(analysis.proposedChanges);
          setPendingSources(analysis.sources || null);
          console.log(
            "[GraphTabPanel] Showing review modal with",
            analysis.proposedChanges.length,
            "proposed changes and",
            analysis.sources?.length || 0,
            "sources for lineage",
          );
        } else {
          console.log("[GraphTabPanel] No changes proposed");
          setPendingProposedChanges([]);
          setPendingSources(null);
        }
      } catch (error) {
        console.error("[GraphTabPanel] Error in analyze with sources:", error);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [sessionId, ideaSlug, analyzeGraphChanges],
  );

  // Handle apply confirmed changes - Phase 2: Reset graph and apply selected changes
  const handleApplyConfirmedChanges = useCallback(
    async (selectedChanges: ProposedChange[]) => {
      console.log(
        "[GraphTabPanel] Phase 2: Applying",
        selectedChanges.length,
        "confirmed changes",
      );

      if (selectedChanges.length === 0) {
        console.warn(
          "[GraphTabPanel] No changes to apply, closing modal without changes",
        );
        setPendingProposedChanges(null);
        setPendingSources(null);
        return;
      }

      setIsApplyingChanges(true);

      try {
        // Step 1: Reset the graph (clear all existing nodes/links)
        console.log("[GraphTabPanel] Step 1: Resetting graph...");
        const resetResult = await resetGraph(sessionId);
        console.log(
          "[GraphTabPanel] Graph reset:",
          resetResult.blocksDeleted,
          "blocks,",
          resetResult.linksDeleted,
          "links deleted",
        );

        // Refetch to clear the UI immediately
        await refetch();

        // Step 2: Apply only the user-confirmed changes
        console.log(
          "[GraphTabPanel] Step 2: Applying",
          selectedChanges.length,
          "changes...",
        );
        const changeIds = selectedChanges.map((c) => c.id);
        console.log("[GraphTabPanel] Change IDs:", changeIds);
        const result = await applyGraphChanges(
          sessionId,
          changeIds,
          selectedChanges.map((c) => ({
            id: c.id,
            type: c.type as "create_block" | "update_block" | "create_link",
            blockType: c.blockType,
            title: c.title,
            content: c.content,
            graphMembership: c.graphMembership,
            confidence: c.confidence,
            // Source attribution - CRITICAL for traceability
            sourceId: c.sourceId,
            sourceType: c.sourceType,
            sourceWeight: c.sourceWeight,
            corroboratedBy: c.corroboratedBy,
            // Include link-specific fields for create_link type
            sourceBlockId: c.sourceBlockId,
            targetBlockId: c.targetBlockId,
            linkType: c.linkType,
            // Include supersession fields
            supersedesBlockId: c.supersedesBlockId,
            supersessionReason: c.supersessionReason,
            // Include status change fields for update_block
            blockId: c.blockId,
            statusChange: c.statusChange,
          })),
          // Pass sources for lineage tracking - allows server to resolve sourceIds
          pendingSources || undefined,
        );
        console.log(
          "[GraphTabPanel] Changes applied:",
          result.blocksCreated,
          "blocks,",
          result.linksCreated,
          "links created",
        );

        // Refetch to show the new graph
        await refetch();

        // Clear pending changes and sources after successful apply
        console.log("[GraphTabPanel] Clearing pending changes, closing modal");
        setPendingProposedChanges(null);
        setPendingSources(null);
      } catch (error) {
        console.error("[GraphTabPanel] Error applying changes:", error);
        // Don't close modal on error so user can retry
      } finally {
        setIsApplyingChanges(false);
      }
    },
    [sessionId, resetGraph, applyGraphChanges, refetch, pendingSources],
  );

  // Handle cancel review - discard proposed changes
  const handleCancelReview = useCallback(() => {
    console.log("[GraphTabPanel] User cancelled review, discarding changes");
    setPendingProposedChanges(null);
    setPendingSources(null);
  }, []);

  // Check for cascade effects when new nodes are added (T6.3 - T6.4)
  useEffect(() => {
    // Only check when we have pending node additions
    const nodeAdditions = pendingUpdates.filter((u) => u.type === "node_added");
    if (nodeAdditions.length === 0 || showUpdateConfirmation) return;

    // Get the most recent node addition
    const latestUpdate = nodeAdditions[nodeAdditions.length - 1];
    const newNode = latestUpdate.data as GraphNode;

    // Check for cascade effects using semantic similarity
    handleShowUpdateConfirmation(
      {
        id: newNode.id,
        content: newNode.content,
        suggestedType: newNode.blockType,
        suggestedGraph: newNode.graphMembership,
        confidence: newNode.confidence,
      },
      filteredData.nodes.filter((n) => n.id !== newNode.id),
      filteredData.edges,
    );
  }, [
    pendingUpdates,
    filteredData.nodes,
    filteredData.edges,
    handleShowUpdateConfirmation,
    showUpdateConfirmation,
  ]);

  // Keep component mounted but hidden when not visible (T6.1.3 - preserve filter state)
  // Using CSS to hide instead of returning null preserves all state including filters

  return (
    <div
      className={`flex flex-col h-full flex-1 min-w-0 ${className} ${!isVisible ? "hidden" : ""}`}
      role="tabpanel"
      id="graph-panel"
      aria-labelledby="graph-tab"
      aria-hidden={!isVisible}
      data-testid="graph-panel"
    >
      {/* Neo4j Memory Graph Stats */}
      <div className="flex-shrink-0 px-4 py-2 border-b flex items-center justify-between">
        <MemoryGraphStats sessionId={sessionId} compact />
        <div className="flex gap-2">
          <button
            onClick={() => setShowNeo4jView(!showNeo4jView)}
            className={`text-sm px-3 py-1 rounded-lg transition-colors ${
              showNeo4jView ? 'bg-teal-200 text-teal-800' : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
            }`}
            title="Toggle Neo4j Memory Graph visualization"
          >
            {showNeo4jView ? '📊 SQLite View' : '🧠 Neo4j View'}
          </button>
          <button
            onClick={() => { setShowSearch(!showSearch); setShowCreateBlock(false); }}
            className={`text-sm px-3 py-1 rounded-lg transition-colors ${
              showSearch ? 'bg-purple-200 text-purple-800' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
          >
            {showSearch ? '✕ Close Search' : '🔍 Search'}
          </button>
          <button
            onClick={() => { setShowCreateBlock(!showCreateBlock); setShowSearch(false); }}
            className={`text-sm px-3 py-1 rounded-lg transition-colors ${
              showCreateBlock ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            {showCreateBlock ? '✕ Close' : '+ Add Block'}
          </button>
        </div>
      </div>

      {/* Create Block Form */}
      {showCreateBlock && (
        <div className="flex-shrink-0 p-4 border-b bg-gray-50">
          <CreateBlockForm
            sessionId={sessionId}
            ideaId={ideaSlug}
            onBlockCreated={(block) => {
              refetch();
              setShowCreateBlock(false);
            }}
            onCancel={() => setShowCreateBlock(false)}
          />
        </div>
      )}

      {/* Search Panel */}
      {showSearch && (
        <div className="flex-shrink-0 h-80 border-b bg-gray-50">
          <MemoryBlockSearch
            sessionId={sessionId}
            onSelectBlock={(block) => {
              // Highlight the selected block in the graph
              setHighlightedNodeIds([block.id]);
              // Could also navigate to the block in the graph view
            }}
          />
        </div>
      )}

      {/* Graph Container */}
      <div className="flex-1 min-h-0 relative" data-testid="graph-canvas">
        {showNeo4jView ? (
          <Neo4jGraphView
            sessionId={sessionId}
            onSelectBlock={(block) => {
              // Could sync with the main node selection
              console.log('[GraphTabPanel] Neo4j block selected:', block.id);
            }}
            className="h-full"
          />
        ) : (
        <GraphErrorBoundary>
          <Suspense fallback={<GraphLoadingSkeleton />}>
            <GraphContainer
              nodes={filteredData.nodes.map((node) => ({
                ...node,
                isHighlighted: combinedHighlightedNodeIds.has(node.id),
                isSelected: selectedNode?.id === node.id,
              }))}
              edges={filteredData.edges.map((edge) => ({
                ...edge,
                isHighlighted: recentlyAddedEdgeIds.has(edge.id),
              }))}
              isLoading={isLoading}
              error={error}
              onNodeSelect={handleNodeSelect}
              onRefresh={refetch}
              lastUpdated={lastUpdated}
              showFilters={true}
              showLegend={true}
              showControls={true}
              isConnected={isConnected}
              isReconnecting={isReconnecting}
              isStale={isStale}
              recentlyAddedNodeIds={recentlyAddedNodeIds}
              recentlyAddedEdgeIds={recentlyAddedEdgeIds}
              onUpdateMemoryGraph={onUpdateMemoryGraph}
              onAnalyzeWithSources={handleAnalyzeWithSources}
              isAnalyzingGraph={isAnalyzingGraph || isAnalyzing}
              isApplyingChanges={isApplyingChanges}
              pendingGraphChanges={pendingGraphChanges}
              sessionId={sessionId}
              ideaSlug={ideaSlug}
              onPromptHighlight={handlePromptHighlight}
              onPromptFilterChange={handlePromptFilterChange}
              onNavigateToChatMessage={onNavigateToChatMessage}
              onNavigateToArtifact={onNavigateToArtifact}
              onNavigateToMemoryDB={onNavigateToMemoryDB}
              onNavigateToExternal={onNavigateToExternal}
              onNavigateToInsight={onNavigateToInsight}
              onLinkNode={onLinkNode}
              onGroupIntoSynthesis={onGroupIntoSynthesis}
              onDeleteNode={onDeleteNode}
              onDeleteNodeGroup={onDeleteNodeGroup}
              resetFiltersTrigger={resetFiltersTrigger}
              successNotification={successNotification}
              onClearNotification={onClearNotification}
              // Snapshot/Versioning
              snapshots={snapshots}
              onSaveSnapshot={handleSaveSnapshot}
              onRestoreSnapshot={handleRestoreSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              onLoadSnapshots={handleLoadSnapshots}
              isLoadingSnapshots={isLoadingSnapshots}
              isSavingSnapshot={isSavingSnapshot}
              isRestoringSnapshot={isRestoringSnapshot}
              reportRefreshTrigger={reportRefreshTrigger}
              // Report synthesis status (moved to GraphControls toolbar)
              reportSynthesisStatus={reportSynthesisStatus}
              onCancelReportSynthesis={cancelReportSynthesis}
              onDismissReportSynthesisStatus={dismissReportSynthesisStatus}
              // Source mapping status (moved to GraphControls toolbar)
              sourceMappingStatus={sourceMappingStatus}
              onCancelSourceMapping={cancelSourceMapping}
              onDismissSourceMappingStatus={dismissSourceMappingStatus}
              // Existing insights for source selection
              existingInsights={existingInsights}
              className="h-full"
            />
          </Suspense>
        </GraphErrorBoundary>
        )}
      </div>

      {/* Pending updates banner */}
      {pendingUpdates.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {pendingUpdates.length} new update
            {pendingUpdates.length !== 1 ? "s" : ""} from conversation
          </span>
          <button
            onClick={() => {
              // Reset both parent filters and GraphContainer's internal filters
              resetFilters();
              setResetFiltersTrigger((prev) => prev + 1);
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Show all
          </button>
        </div>
      )}

      {/* Graph Update Confirmation Dialog (T6.3) */}
      {pendingNewBlock && cascadeEffects && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <GraphUpdateConfirmation
            isOpen={showUpdateConfirmation}
            onClose={handleCloseUpdateConfirmation}
            newBlock={pendingNewBlock}
            cascadeEffects={cascadeEffects}
            onConfirmAll={handleConfirmAllUpdates}
            onReviewEach={handleReviewEachUpdate}
            onCancel={handleCancelUpdate}
            isProcessing={isProcessingUpdate}
          />
        </div>
      )}

      {/* Proposed Changes Review Modal - Phase 2 of source analysis flow */}
      {pendingProposedChanges !== null && (
        <ProposedChangesReviewModal
          isOpen={true}
          onClose={handleCancelReview}
          proposedChanges={pendingProposedChanges}
          onApply={handleApplyConfirmedChanges}
          onCancel={handleCancelReview}
          isApplying={isApplyingChanges}
        />
      )}
    </div>
  );
});

export default GraphTabPanel;
