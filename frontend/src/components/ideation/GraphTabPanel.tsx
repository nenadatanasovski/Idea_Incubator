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
  // Selection actions for the selected node
  onLinkNode?: (nodeId: string) => void;
  onGroupIntoSynthesis?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string, nodeLabel: string) => void;
  // Trigger to refetch graph data (increment to trigger refetch)
  refetchTrigger?: number;
  // Success notification to display
  successNotification?: {
    action: "created" | "updated" | "deleted";
    nodeLabel: string;
  } | null;
  // Callback to clear the notification
  onClearNotification?: () => void;
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
  onLinkNode,
  onGroupIntoSynthesis,
  onDeleteNode,
  refetchTrigger,
  successNotification,
  onClearNotification,
}: GraphTabPanelProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  // Trigger to reset GraphContainer's internal filters
  const [resetFiltersTrigger, setResetFiltersTrigger] = useState(0);

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
  const handleConfirmAllUpdates = useCallback(() => {
    setIsProcessingUpdate(true);
    // TODO: Apply all cascade changes via API
    console.log("[GraphTabPanel] Confirming all updates:", pendingNewBlock);
    setIsProcessingUpdate(false);
    setShowUpdateConfirmation(false);
    setPendingNewBlock(null);
    setCascadeEffects(null);
  }, [pendingNewBlock]);

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
      } catch (error) {
        console.error("[GraphTabPanel] Failed to restore snapshot:", error);
        throw error;
      } finally {
        setIsRestoringSnapshot(false);
      }
    },
    [sessionId, restoreGraphSnapshot, refetch, handleLoadSnapshots],
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
    async (selectedSourceIds: string[]) => {
      console.log(
        "[GraphTabPanel] Phase 1: Analyzing with sources:",
        selectedSourceIds.length,
      );
      console.log("[GraphTabPanel] ideaSlug:", ideaSlug || "(not set)");

      setIsAnalyzing(true);

      try {
        // Analyze with selected sources (don't reset or apply yet!)
        // Pass ideaSlug to include file-based artifacts from idea folder
        const analysis = await analyzeGraphChanges(
          sessionId,
          selectedSourceIds,
          ideaSlug,
        );
        console.log(
          "[GraphTabPanel] Analysis complete:",
          analysis.proposedChanges?.length || 0,
          "proposed changes",
        );

        // Store the proposed changes for user review
        if (analysis.proposedChanges && analysis.proposedChanges.length > 0) {
          setPendingProposedChanges(analysis.proposedChanges);
          console.log(
            "[GraphTabPanel] Showing review modal with",
            analysis.proposedChanges.length,
            "proposed changes",
          );
        } else {
          console.log("[GraphTabPanel] No changes proposed");
          setPendingProposedChanges([]);
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

        // Clear pending changes after successful apply
        console.log("[GraphTabPanel] Clearing pending changes, closing modal");
        setPendingProposedChanges(null);
      } catch (error) {
        console.error("[GraphTabPanel] Error applying changes:", error);
        // Don't close modal on error so user can retry
      } finally {
        setIsApplyingChanges(false);
      }
    },
    [sessionId, resetGraph, applyGraphChanges, refetch],
  );

  // Handle cancel review - discard proposed changes
  const handleCancelReview = useCallback(() => {
    console.log("[GraphTabPanel] User cancelled review, discarding changes");
    setPendingProposedChanges(null);
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
      {/* Graph Container */}
      <div className="flex-1 min-h-0" data-testid="graph-canvas">
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
              onLinkNode={onLinkNode}
              onGroupIntoSynthesis={onGroupIntoSynthesis}
              onDeleteNode={onDeleteNode}
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
              className="h-full"
            />
          </Suspense>
        </GraphErrorBoundary>
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
