/**
 * Graph Tab View Components
 * Memory Graph visualization for the Ideation Agent
 */

// Types (re-export from types folder for convenience)
export type {
  GraphNode,
  GraphEdge,
  GraphData,
  GraphDataState,
  GraphFilters as GraphFiltersState,
  BlockType,
  GraphType,
  BlockStatus,
  LinkType,
  LinkDegree,
  AbstractionLevel,
  SourceType,
  NodeShape,
  ApiBlock,
  ApiLink,
} from "../../types/graph";

export {
  nodeColors,
  graphColors,
  nodeShapes,
  edgeColors,
  edgeStyles,
  defaultGraphFilters,
} from "../../types/graph";

// Components
export { GraphCanvas } from "./GraphCanvas";
export type {
  GraphCanvasProps,
  GraphCanvasHandle,
  LayoutType,
} from "./GraphCanvas";

export { GraphContainer } from "./GraphContainer";
export type { GraphContainerProps } from "./GraphContainer";

export { NodeInspector } from "./NodeInspector";
export type {
  NodeInspectorProps,
  RelationshipHoverInfo,
} from "./NodeInspector";

export { GraphFilters } from "./GraphFilters";
export type { GraphFiltersProps } from "./GraphFilters";

export { GraphLegend } from "./GraphLegend";
export type { GraphLegendProps } from "./GraphLegend";

export { GraphControls } from "./GraphControls";
export type { GraphControlsProps, LayoutOption } from "./GraphControls";

export { GraphPrompt } from "./GraphPrompt";
export type {
  GraphPromptProps,
  PromptActionType,
  PromptResult,
} from "./GraphPrompt";

export { GraphUpdateConfirmation } from "./GraphUpdateConfirmation";
export type {
  GraphUpdateConfirmationProps,
  NewBlockUpdate,
  AffectedNode as UpdateAffectedNode,
  CascadeEffect,
} from "./GraphUpdateConfirmation";

// Phase 8 Quick Actions Component
export { GraphQuickActions } from "./GraphQuickActions";
export type { GraphQuickActionsProps } from "./GraphQuickActions";

// Phase 7 Advanced Feature Components
export { EvidenceChainPanel } from "./EvidenceChainPanel";
export type { EvidenceChainPanelProps } from "./EvidenceChainPanel";

export { CycleIndicator } from "./CycleIndicator";
export type { CycleIndicatorProps } from "./CycleIndicator";

export { BlockTypeInspector } from "./BlockTypeInspector";
export type { BlockTypeInspectorProps } from "./BlockTypeInspector";

export {
  RangePropertyDisplay,
  ContextQualifiedPropertyDisplay,
  SpecialPropertiesSection,
} from "./PropertyDisplayComponents";
export type {
  RangePropertyDisplayProps,
  ContextQualifiedPropertyDisplayProps,
  SpecialPropertiesSectionProps,
} from "./PropertyDisplayComponents";

export { WhyIsThisHerePanel } from "./WhyIsThisHerePanel";
export type { WhyIsThisHerePanelProps } from "./WhyIsThisHerePanel";

// Hooks
export {
  useGraphData,
  useSessionGraphData,
  useIdeaGraphData,
} from "./hooks/useGraphData";

export { useGraphFilters } from "./hooks/useGraphFilters";

export { useGraphWebSocket } from "./hooks/useGraphWebSocket";
export type {
  UseGraphWebSocketOptions,
  UseGraphWebSocketReturn,
  BlockCreatedPayload,
  BlockUpdatedPayload,
  LinkCreatedPayload,
  LinkRemovedPayload,
  WebSocketEvent,
  SourceMappingPayload,
  SourceMappingStatus,
} from "./hooks/useGraphWebSocket";

export { useSourceMappingStatus } from "./hooks/useSourceMappingStatus";
export type {
  SourceMappingJobStatus,
  UseSourceMappingStatusOptions,
  UseSourceMappingStatusReturn,
} from "./hooks/useSourceMappingStatus";

// Source Mapping Status Component
export { SourceMappingStatusPill } from "./SourceMappingStatusPill";
export type { SourceMappingStatusPillProps } from "./SourceMappingStatusPill";

// Report Synthesis Status Hook and Component
export { useReportSynthesisStatus } from "./hooks/useReportSynthesisStatus";
export type {
  ReportSynthesisJobStatus,
  UseReportSynthesisStatusOptions,
  UseReportSynthesisStatusReturn,
  ReportSynthesisPayload as ReportSynthesisStatusPayload,
  ReportSynthesisStatus as ReportSynthesisStatusType,
} from "./hooks/useReportSynthesisStatus";

export { ReportSynthesisStatusPill } from "./ReportSynthesisStatusPill";
export type { ReportSynthesisStatusPillProps } from "./ReportSynthesisStatusPill";

export { useGraphDataWithWebSocket } from "./hooks/useGraphDataWithWebSocket";
export type {
  UseGraphDataWithWebSocketOptions,
  UseGraphDataWithWebSocketReturn,
  PendingUpdate,
} from "./hooks/useGraphDataWithWebSocket";
export type {
  FilterState,
  UseGraphFiltersOptions,
  UseGraphFiltersReturn,
} from "./hooks/useGraphFilters";

// Node Style Utils
export {
  getNodeColor,
  getNodeShape,
  getNodeBorderColor,
  getNodeOpacity,
  getNodeBorderOpacity,
  getNodeSize,
  calculateNodeSize,
  getStatusStyle,
  getNodeStyle,
  getHighlightStyle,
  countNodeConnections,
  createConnectionCountMap,
} from "./utils/nodeStyles";
export type { NodeSizeConfig } from "./utils/nodeStyles";

// Edge Style Utils
export {
  getEdgeColor,
  getEdgeLineStyle,
  getEdgeOpacity,
  getEdgeWidth,
  getEdgeStatusStyle,
  shouldShowArrow,
  getArrowType,
  getEdgeCategory,
  getEdgeStyle,
  getEdgeHighlightStyle,
  getEdgeLabelText,
  shouldShowEdgeLabel,
  getEdgeCurvature,
  groupParallelEdges,
} from "./utils/edgeStyles";
export type { EdgeWidthConfig } from "./utils/edgeStyles";

// Transform Utils
export {
  transformBlocksToNodes,
  transformLinksToEdges,
  transformToGraphData,
  filterNodesByGraph,
  filterNodesByBlockType,
  filterNodesByStatus,
  filterNodesByConfidence,
  filterNodesByAbstractionLevel,
  filterEdgesByVisibleNodes,
  // Incremental update functions
  transformSingleBlockToNode,
  transformSingleLinkToEdge,
  addNodeToGraph,
  updateNodeInGraph,
  removeNodeFromGraph,
  addEdgeToGraph,
  removeEdgeFromGraph,
  removeEdgesForNode,
} from "./utils/graphTransform";

// Cascade Detection Utils
export {
  calculateSimilarity,
  findSemanticMatches,
  detectConflicts,
  traverseDependencies,
  calculateImpactRadius,
  analyzeCascadeEffects,
  wouldCreateCycle,
  findSupersessionCascade,
} from "./utils/cascadeDetection";
export type {
  CascadeAnalysisResult,
  AffectedNode as CascadeAffectedNode,
  SuggestedLink,
  DetectedConflict,
  SemanticMatch,
  CascadeDetectionOptions,
} from "./utils/cascadeDetection";

// Evidence Chain Utils
export {
  traverseEvidenceChain,
  calculateDerivedConfidence,
  analyzeEvidenceChain,
  detectInvalidatedSources,
  findDependentNodes,
  hasLowConfidenceChain,
  STRENGTH_MULTIPLIERS,
  STATUS_MULTIPLIERS,
} from "./utils/evidenceChain";
export type { EvidenceChainNode, EvidenceChain } from "./utils/evidenceChain";

// Cycle Detection Utils
export {
  detectCycles,
  classifyCycleType,
  findBreakPoint,
  analyzeCycles,
  wouldCreateCycle as wouldCreateCycleDetection,
  getNodeCycleInfo,
  getCycleMemberIds,
} from "./utils/cycleDetection";
export type { DetectedCycle, CycleAnalysis } from "./utils/cycleDetection";

// Property Display Utils
export {
  parseRangeProperties,
  parseContextQualifiedProperties,
  parseProperties,
  formatNumber,
  formatRange,
  formatContextValues,
} from "./utils/propertyDisplay";
export type {
  RangeProperty,
  ContextQualifiedProperty,
  ParsedProperties,
} from "./utils/propertyDisplay";

// Abstraction Traversal Utils (T7.4)
export {
  traverseAbstractionUp,
  traverseAbstractionDown,
  buildAbstractionChain,
  getNodesAtAbstractionLevel,
  sortByAbstractionLevel,
  findImplementingNodes,
  findImplementedNode,
  getAbstractionIndex,
  ABSTRACTION_ORDER,
} from "./utils/abstractionTraversal";
export type {
  AbstractionChainNode,
  AbstractionChain,
} from "./utils/abstractionTraversal";

// Mock data (for testing and development)
export {
  generateMockGraph,
  generateSampleIdeationGraph,
} from "./__mocks__/mockGraphData";
