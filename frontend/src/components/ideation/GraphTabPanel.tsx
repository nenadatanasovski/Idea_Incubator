// =============================================================================
// FILE: frontend/src/components/ideation/GraphTabPanel.tsx
// Graph tab panel that integrates GraphContainer with the ideation session
// Lazy-loaded for performance
// =============================================================================

import { lazy, Suspense, useState, useCallback, useEffect, memo } from "react";
import type { GraphNode, GraphFilters } from "../../types/graph";
import { useGraphDataWithWebSocket } from "../graph/hooks/useGraphDataWithWebSocket";
import { GraphPrompt } from "../graph/GraphPrompt";
import { GraphUpdateConfirmation } from "../graph/GraphUpdateConfirmation";
import type {
  NewBlockUpdate,
  CascadeEffect,
} from "../graph/GraphUpdateConfirmation";
import { analyzeCascadeEffects } from "../graph/utils/cascadeDetection";

// Lazy load GraphContainer for code splitting
const GraphContainer = lazy(() => import("../graph/GraphContainer"));

export interface GraphTabPanelProps {
  sessionId: string;
  ideaSlug?: string;
  isVisible: boolean;
  onNodeSelect?: (node: GraphNode | null) => void;
  onUpdateCount?: (count: number) => void;
  className?: string;
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
}: GraphTabPanelProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);

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

  // Don't render content when not visible (preserve state)
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`flex flex-col h-full ${className}`}
      role="tabpanel"
      id="graph-panel"
      aria-labelledby="graph-tab"
      data-testid="graph-panel"
    >
      {/* Graph Prompt Input */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        <GraphPrompt
          sessionId={sessionId}
          onHighlight={handlePromptHighlight}
          onFilterChange={handlePromptFilterChange}
          disabled={isLoading}
        />
      </div>

      {/* Graph Container */}
      <div className="flex-1 min-h-0" data-testid="graph-canvas">
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
            className="h-full"
          />
        </Suspense>
      </div>

      {/* Pending updates banner */}
      {pendingUpdates.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {pendingUpdates.length} new update
            {pendingUpdates.length !== 1 ? "s" : ""} from conversation
          </span>
          <button
            onClick={resetFilters}
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
    </div>
  );
});

export default GraphTabPanel;
