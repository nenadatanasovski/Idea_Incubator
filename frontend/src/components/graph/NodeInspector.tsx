/**
 * NodeInspector Component
 * Side panel for displaying detailed node information including relationships
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import type {
  GraphNode,
  GraphEdge,
  LinkType,
  FileReference,
  SourceLocation,
} from "../../types/graph";
import { nodeColors, edgeColors, graphColors } from "../../types/graph";
import {
  FileText,
  ExternalLink,
  FileCode,
  File,
  MessageSquare,
  Database,
  Link2,
  Layers,
  Trash2,
  Loader2,
} from "lucide-react";
import { parseProperties } from "./utils/propertyDisplay";
import { SpecialPropertiesSection } from "./PropertyDisplayComponents";
import { EvidenceChainPanel } from "./EvidenceChainPanel";
import { BlockTypeInspector } from "./BlockTypeInspector";
import type { SourceType } from "../../types/graph";

/**
 * Safely format a date string, returning "Unknown" if invalid
 */
function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export interface RelationshipHoverInfo {
  currentNodeId: string;
  relatedNodeId: string;
  edgeId: string;
}

// Internal source info - where the block data originated from
export interface SourceInfo {
  sourceType?: SourceType;
  sourceLocation?: SourceLocation;
}

export interface NodeInspectorProps {
  node: GraphNode;
  edges: GraphEdge[];
  nodes: GraphNode[];
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
  onRelationshipHover?: (info: RelationshipHoverInfo | null) => void;
  onViewArtifact?: (artifactId: string) => void;
  onUnlinkArtifact?: (nodeId: string) => void;
  onViewFile?: (filePath: string) => void;
  // Source navigation callbacks - each handles a different destination
  onNavigateToChatMessage?: (messageId: string, turnIndex?: number) => void;
  onNavigateToArtifact?: (artifactId: string, section?: string) => void;
  onNavigateToMemoryDB?: (tableName: string, blockId?: string) => void;
  onNavigateToExternal?: (url: string) => void;
  // Selection actions for the selected node
  onLinkNode?: (nodeId: string) => void;
  onGroupIntoSynthesis?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  isActionLoading?: string | null;
  className?: string;
}

interface Relationship {
  edge: GraphEdge;
  relatedNode: GraphNode;
  direction: "incoming" | "outgoing";
}

/**
 * Get human-readable link type label
 */
function getLinkTypeLabel(linkType: LinkType): string {
  const labels: Record<LinkType, string> = {
    addresses: "Addresses",
    creates: "Creates",
    requires: "Requires",
    blocks: "Blocks",
    unblocks: "Unblocks",
    supersedes: "Supersedes",
    refines: "Refines",
    replaces: "Replaces",
    contradicts: "Contradicts",
    evidence_for: "Evidence For",
    derived_from: "Derived From",
    implements: "Implements",
    implemented_by: "Implemented By",
    alternative_to: "Alternative To",
    synthesizes: "Synthesizes",
    instance_of: "Instance Of",
    about: "About",
    excludes: "Excludes",
    includes: "Includes",
    constrained_by: "Constrained By",
    validates_claim: "Validates Claim",
  };
  return labels[linkType] || linkType.replace(/_/g, " ");
}

/**
 * Relationship item component
 */
function RelationshipItem({
  relationship,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  relationship: Relationship;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const { edge, relatedNode, direction } = relationship;
  const isIncoming = direction === "incoming";

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="w-full p-2 text-left rounded-lg hover:bg-gray-100 transition-colors group"
    >
      <div className="flex items-center gap-2">
        {/* Direction indicator */}
        <div
          className={`w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
            isIncoming
              ? "bg-blue-100 text-blue-600"
              : "bg-green-100 text-green-600"
          }`}
        >
          <svg
            className={`w-3 h-3 ${isIncoming ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </div>

        {/* Link type badge */}
        <span
          className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
          style={{
            backgroundColor: `${edgeColors[edge.linkType]}20`,
            color: edgeColors[edge.linkType],
          }}
        >
          {getLinkTypeLabel(edge.linkType)}
        </span>

        {/* Related node metadata */}
        <span
          className="px-1.5 py-0.5 rounded text-xs flex-shrink-0"
          style={{
            backgroundColor: `${nodeColors[relatedNode.blockType]}20`,
            color: nodeColors[relatedNode.blockType],
          }}
        >
          {relatedNode.blockType}
        </span>
        {edge.degree && (
          <span className="text-xs text-gray-500 flex-shrink-0 italic">
            {edge.degree}
          </span>
        )}
        {edge.confidence !== undefined && (
          <span className="text-xs text-gray-500 flex-shrink-0">
            {Math.round(edge.confidence * 100)}% confidence
          </span>
        )}
      </div>

      {/* Related node content - full text on its own line */}
      <div className="ml-8 mt-1 text-sm text-gray-700 group-hover:text-gray-900">
        {relatedNode.content}
      </div>
    </button>
  );
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    validated: "bg-blue-100 text-blue-700",
    draft: "bg-yellow-100 text-yellow-700",
    superseded: "bg-gray-100 text-gray-700",
    abandoned: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs ${styles[status] || styles.active}`}
    >
      {status}
    </span>
  );
}

/**
 * Section component with collapsible functionality
 */
function Section({
  title,
  children,
  defaultExpanded = true,
  count,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  count?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-3 flex items-center justify-between text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
      >
        <span className="flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className="px-1.5 py-0.5 bg-gray-200 rounded-full text-xs font-normal normal-case">
              {count}
            </span>
          )}
        </span>
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
      {isExpanded && <div className="pb-4">{children}</div>}
    </div>
  );
}

/**
 * Get icon for file reference type
 */
function getFileIcon(referenceType: FileReference["referenceType"]) {
  switch (referenceType) {
    case "spec":
      return FileText;
    case "code":
      return FileCode;
    case "doc":
      return File;
    default:
      return File;
  }
}

/**
 * FileReferenceItem component
 */
function FileReferenceItem({
  reference,
  onClick,
}: {
  reference: FileReference;
  onClick?: () => void;
}) {
  const Icon = getFileIcon(reference.referenceType);

  const typeStyles: Record<FileReference["referenceType"], string> = {
    spec: "bg-purple-100 text-purple-700",
    code: "bg-blue-100 text-blue-700",
    doc: "bg-green-100 text-green-700",
    other: "bg-gray-100 text-gray-700",
  };

  return (
    <button
      onClick={onClick}
      className="w-full p-2 text-left rounded-lg hover:bg-gray-100 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <span className="flex-1 text-sm text-gray-700 truncate group-hover:text-gray-900">
          {reference.fileName}
        </span>
        <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="ml-6 mt-1 flex items-center gap-2 text-xs text-gray-500">
        <span
          className={`px-1.5 py-0.5 rounded capitalize ${typeStyles[reference.referenceType]}`}
        >
          {reference.referenceType}
        </span>
        {reference.section && (
          <span className="text-gray-400">§ {reference.section}</span>
        )}
        {reference.lineRange && (
          <span className="text-gray-400">
            L{reference.lineRange.start}-{reference.lineRange.end}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Internal source type display labels and icons
 */
const SOURCE_TYPE_LABELS: Record<
  SourceType,
  { label: string; color: string; icon: string }
> = {
  chat: { label: "Chat", color: "bg-purple-100 text-purple-700", icon: "💬" },
  artifact: {
    label: "Artifact",
    color: "bg-amber-100 text-amber-700",
    icon: "📄",
  },
  memory_file: {
    label: "Memory File",
    color: "bg-cyan-100 text-cyan-700",
    icon: "🧠",
  },
  memory_db: {
    label: "Database",
    color: "bg-blue-100 text-blue-700",
    icon: "🗄️",
  },
  user_created: {
    label: "User Created",
    color: "bg-green-100 text-green-700",
    icon: "✏️",
  },
  ai_generated: {
    label: "AI Generated",
    color: "bg-pink-100 text-pink-700",
    icon: "🤖",
  },
};

/**
 * Get icon and label for source location type
 */
function getSourceLocationInfo(location?: SourceLocation): {
  icon: React.ReactNode;
  label: string;
  description: string;
} {
  if (!location) {
    return {
      icon: <ExternalLink className="w-4 h-4" />,
      label: "View source",
      description: "Navigate to source",
    };
  }

  switch (location.type) {
    case "chat":
      return {
        icon: <MessageSquare className="w-4 h-4" />,
        label: "Go to chat message",
        description: location.turnIndex
          ? `Message #${location.turnIndex}`
          : "Chat history",
      };
    case "artifact":
      return {
        icon: <FileText className="w-4 h-4" />,
        label: "Open artifact",
        description: location.artifactSection
          ? `${location.artifactSection}`
          : "Artifact document",
      };
    case "memory_db":
      return {
        icon: <Database className="w-4 h-4" />,
        label: "View in Memory DB",
        description: location.tableName
          ? `${location.tableName} table`
          : "Memory database",
      };
    case "external":
      return {
        icon: <ExternalLink className="w-4 h-4" />,
        label: "Open external link",
        description: location.url
          ? new URL(location.url).hostname
          : "External source",
      };
    default:
      return {
        icon: <ExternalLink className="w-4 h-4" />,
        label: "View source",
        description: "Navigate to source",
      };
  }
}

/**
 * Navigable Source Section
 * Displays internal data source with navigation capability
 */
function NavigableSourceSection({
  sourceType,
  sourceLocation,
  onNavigateToChat,
  onNavigateToArtifact,
  onNavigateToMemoryDB,
  onNavigateToExternal,
}: {
  sourceType?: SourceType;
  sourceLocation?: SourceLocation;
  onNavigateToChat?: (messageId: string, turnIndex?: number) => void;
  onNavigateToArtifact?: (artifactId: string, section?: string) => void;
  onNavigateToMemoryDB?: (tableName: string, blockId?: string) => void;
  onNavigateToExternal?: (url: string) => void;
}) {
  const hasSource = sourceType || sourceLocation;

  // Determine which navigation handler to use based on location type
  const handleNavigate = useCallback(() => {
    if (!sourceLocation) return;

    switch (sourceLocation.type) {
      case "chat":
        if (onNavigateToChat && sourceLocation.messageId) {
          onNavigateToChat(sourceLocation.messageId, sourceLocation.turnIndex);
        }
        break;
      case "artifact":
        if (onNavigateToArtifact && sourceLocation.artifactId) {
          onNavigateToArtifact(
            sourceLocation.artifactId,
            sourceLocation.artifactSection,
          );
        }
        break;
      case "memory_db":
        if (onNavigateToMemoryDB && sourceLocation.tableName) {
          onNavigateToMemoryDB(
            sourceLocation.tableName,
            sourceLocation.blockId,
          );
        }
        break;
      case "external":
        if (onNavigateToExternal && sourceLocation.url) {
          onNavigateToExternal(sourceLocation.url);
        }
        break;
    }
  }, [
    sourceLocation,
    onNavigateToChat,
    onNavigateToArtifact,
    onNavigateToMemoryDB,
    onNavigateToExternal,
  ]);

  // Check if navigation is available for this source
  const canNavigate =
    sourceLocation &&
    ((sourceLocation.type === "chat" &&
      onNavigateToChat &&
      sourceLocation.messageId) ||
      (sourceLocation.type === "artifact" &&
        onNavigateToArtifact &&
        sourceLocation.artifactId) ||
      (sourceLocation.type === "memory_db" &&
        onNavigateToMemoryDB &&
        sourceLocation.tableName) ||
      (sourceLocation.type === "external" &&
        onNavigateToExternal &&
        sourceLocation.url));

  const locationInfo = getSourceLocationInfo(sourceLocation);

  if (!hasSource) {
    return (
      <p className="text-sm text-gray-500 italic">No source information</p>
    );
  }

  const sourceTypeInfo = sourceType ? SOURCE_TYPE_LABELS[sourceType] : null;

  return (
    <div className="space-y-3">
      {/* Source type badge */}
      {sourceTypeInfo && (
        <div className="flex items-center gap-2">
          <span className="text-lg">{sourceTypeInfo.icon}</span>
          <span
            className={`px-2.5 py-1 rounded-lg text-sm font-medium ${sourceTypeInfo.color}`}
          >
            {sourceTypeInfo.label}
          </span>
        </div>
      )}

      {/* Location info card */}
      {sourceLocation && (
        <div
          className={`w-full text-left p-3 rounded-lg border ${
            canNavigate
              ? "border-blue-200 bg-blue-50"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {locationInfo.icon}
            <span>{locationInfo.description}</span>
          </div>
        </div>
      )}

      {/* Navigation button - different style based on location type */}
      {canNavigate && (
        <button
          onClick={handleNavigate}
          className={`flex items-center gap-1.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            sourceLocation?.type === "chat"
              ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
              : sourceLocation?.type === "artifact"
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : sourceLocation?.type === "memory_db"
                  ? "bg-cyan-100 text-cyan-700 hover:bg-cyan-200"
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
        >
          {locationInfo.icon}
          {locationInfo.label}
        </button>
      )}
    </div>
  );
}

/**
 * PropertiesContent Component
 * Renders properties with special handling for range and context-qualified values
 */
function PropertiesContent({
  properties,
}: {
  properties: Record<string, unknown>;
}) {
  const parsedProps = useMemo(() => parseProperties(properties), [properties]);

  const { regularProperties, rangeProperties, contextQualifiedProperties } =
    parsedProps;

  return (
    <div className="space-y-4">
      {/* Special Properties (Range and Context-Qualified) */}
      <SpecialPropertiesSection
        rangeProperties={rangeProperties}
        contextQualifiedProperties={contextQualifiedProperties}
      />

      {/* Regular Properties */}
      {Object.keys(regularProperties).length > 0 && (
        <dl className="space-y-2 text-sm">
          {Object.entries(regularProperties).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="text-gray-500 truncate">
                {key.replace(/_/g, " ")}
              </dt>
              <dd className="text-gray-900 text-right break-all max-w-[180px]">
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * NodeInspector Component
 * Displays detailed information about a selected node including relationships
 */
export function NodeInspector({
  node,
  edges,
  nodes,
  onClose,
  onNodeClick,
  onRelationshipHover,
  onViewArtifact,
  onUnlinkArtifact,
  onViewFile,
  onNavigateToChatMessage,
  onNavigateToArtifact,
  onNavigateToMemoryDB,
  onNavigateToExternal,
  onLinkNode,
  onGroupIntoSynthesis,
  onDeleteNode,
  isActionLoading,
  className = "",
}: NodeInspectorProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Animate slide-in on mount
  useEffect(() => {
    // Small delay to trigger CSS transition
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsVisible(false);
    // Wait for animation to complete before calling onClose
    setTimeout(onClose, 200);
  }, [onClose]);

  // Create a map of nodes for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Calculate incoming and outgoing relationships
  const { incomingRelationships, outgoingRelationships } = useMemo(() => {
    const incoming: Relationship[] = [];
    const outgoing: Relationship[] = [];

    edges.forEach((edge) => {
      if (edge.target === node.id) {
        const sourceNode = nodeMap.get(edge.source);
        if (sourceNode) {
          incoming.push({
            edge,
            relatedNode: sourceNode,
            direction: "incoming",
          });
        }
      }
      if (edge.source === node.id) {
        const targetNode = nodeMap.get(edge.target);
        if (targetNode) {
          outgoing.push({
            edge,
            relatedNode: targetNode,
            direction: "outgoing",
          });
        }
      }
    });

    return { incomingRelationships: incoming, outgoingRelationships: outgoing };
  }, [node.id, edges, nodeMap]);

  const totalRelationships =
    incomingRelationships.length + outgoingRelationships.length;

  // Check if any selection actions are available
  const hasSelectionActions =
    onLinkNode || onGroupIntoSynthesis || onDeleteNode;

  return (
    <div
      className={`
        w-full sm:w-[640px] md:w-[768px]
        fixed sm:relative inset-y-0 right-0 sm:inset-auto
        z-30 sm:z-auto
        bg-white
        border-l border-gray-200
        shadow-xl sm:shadow-none
        transform transition-transform duration-200 ease-out
        ${isVisible ? "translate-x-0" : "translate-x-full"}
        overflow-hidden flex flex-col
        ${className}
      `}
      data-testid="node-inspector"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Show title as main heading if available */}
          {node.title && (
            <h3 className="font-semibold text-gray-900 break-words">
              {node.title}
            </h3>
          )}
          {/* Show content - as subtitle if title exists, or as main heading if no title */}
          <p
            className={`${node.title ? "mt-1 text-sm text-gray-600" : "font-semibold text-gray-900"} break-words`}
          >
            {node.content}
          </p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: `${nodeColors[node.blockType]}20`,
                color: nodeColors[node.blockType],
              }}
            >
              {node.blockType}
            </span>
            <StatusBadge status={node.status} />
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Close inspector"
        >
          <svg
            className="w-5 h-5 text-gray-500"
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0">
        {/* Block Type Inspector - Type-specific properties panel (T7.3) */}
        <BlockTypeInspector
          node={node}
          onNavigate={onNodeClick}
          className="mb-4"
        />

        {/* Evidence Chain Panel - Show for nodes with evidence_for links (T7.1) */}
        {edges.some(
          (e) =>
            e.linkType === "evidence_for" &&
            (e.source === node.id || e.target === node.id),
        ) && (
          <Section title="Evidence Chain" defaultExpanded>
            <EvidenceChainPanel
              nodeId={node.id}
              nodes={nodes}
              edges={edges}
              onNodeClick={onNodeClick}
            />
          </Section>
        )}

        {/* Relationships Section */}
        <Section
          title="Relationships"
          defaultExpanded={totalRelationships > 0}
          count={totalRelationships}
        >
          {totalRelationships === 0 ? (
            <p className="text-sm text-gray-500 italic">No relationships</p>
          ) : (
            <div className="space-y-4">
              {/* Incoming relationships */}
              {incomingRelationships.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <svg
                      className="w-3 h-3 rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                    Incoming ({incomingRelationships.length})
                  </h5>
                  <div className="space-y-1">
                    {incomingRelationships.map((rel) => (
                      <RelationshipItem
                        key={rel.edge.id}
                        relationship={rel}
                        onClick={
                          onNodeClick
                            ? () => onNodeClick(rel.relatedNode.id)
                            : undefined
                        }
                        onMouseEnter={
                          onRelationshipHover
                            ? () =>
                                onRelationshipHover({
                                  currentNodeId: node.id,
                                  relatedNodeId: rel.relatedNode.id,
                                  edgeId: rel.edge.id,
                                })
                            : undefined
                        }
                        onMouseLeave={
                          onRelationshipHover
                            ? () => onRelationshipHover(null)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Outgoing relationships */}
              {outgoingRelationships.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
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
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                    Outgoing ({outgoingRelationships.length})
                  </h5>
                  <div className="space-y-1">
                    {outgoingRelationships.map((rel) => (
                      <RelationshipItem
                        key={rel.edge.id}
                        relationship={rel}
                        onClick={
                          onNodeClick
                            ? () => onNodeClick(rel.relatedNode.id)
                            : undefined
                        }
                        onMouseEnter={
                          onRelationshipHover
                            ? () =>
                                onRelationshipHover({
                                  currentNodeId: node.id,
                                  relatedNodeId: rel.relatedNode.id,
                                  edgeId: rel.edge.id,
                                })
                            : undefined
                        }
                        onMouseLeave={
                          onRelationshipHover
                            ? () => onRelationshipHover(null)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Metadata Section */}
        <Section title="Metadata" defaultExpanded={false}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between items-start">
              <dt className="text-gray-500">ID</dt>
              <dd className="text-gray-900 font-mono text-xs break-all text-right max-w-[200px]">
                {node.id}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">Graph</dt>
              <dd className="flex gap-1 flex-wrap justify-end">
                {node.graphMembership.map((graph) => (
                  <span
                    key={graph}
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: `${graphColors[graph]}20`,
                      color: graphColors[graph],
                    }}
                  >
                    {graph}
                  </span>
                ))}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">Confidence</dt>
              <dd className="flex items-center gap-2">
                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${node.confidence * 100}%` }}
                  />
                </div>
                <span className="text-gray-900 text-xs">
                  {Math.round(node.confidence * 100)}%
                </span>
              </dd>
            </div>
            {node.abstractionLevel && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Abstraction</dt>
                <dd className="text-gray-900 capitalize">
                  {node.abstractionLevel}
                </dd>
              </div>
            )}
            {/* Action block progress bar */}
            {node.blockType === "action" &&
              node.requiredCount !== undefined &&
              node.completedCount !== undefined && (
                <div className="flex justify-between items-center">
                  <dt className="text-gray-500">Progress</dt>
                  <dd className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          node.completedCount >= node.requiredCount
                            ? "bg-green-500"
                            : "bg-amber-500"
                        }`}
                        style={{
                          width: `${Math.min(100, (node.completedCount / node.requiredCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-gray-900 text-xs">
                      {node.completedCount}/{node.requiredCount}
                    </span>
                  </dd>
                </div>
              )}
          </dl>
        </Section>

        {/* Properties Section */}
        {Object.keys(node.properties).length > 0 && (
          <Section
            title="Properties"
            defaultExpanded={false}
            count={Object.keys(node.properties).length}
          >
            <PropertiesContent properties={node.properties} />
          </Section>
        )}

        {/* Timeline Section */}
        <Section title="Timeline" defaultExpanded={false}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-900 text-xs">
                {formatDate(node.createdAt)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Updated</dt>
              <dd className="text-gray-900 text-xs">
                {formatDate(node.updatedAt)}
              </dd>
            </div>
            {node.when && (
              <div className="flex justify-between">
                <dt className="text-gray-500">When</dt>
                <dd className="text-gray-900 text-xs">{node.when}</dd>
              </div>
            )}
            {node.duration && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Duration</dt>
                <dd className="text-gray-900 text-xs">{node.duration}</dd>
              </div>
            )}
            {node.plannedFor && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Planned For</dt>
                <dd className="text-gray-900 text-xs">{node.plannedFor}</dd>
              </div>
            )}
            {node.validUntil && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Valid Until</dt>
                <dd className="text-gray-900 text-xs">{node.validUntil}</dd>
              </div>
            )}
          </dl>
        </Section>

        {/* Referenced In Section (T9.6) */}
        {node.fileReferences && node.fileReferences.length > 0 && (
          <Section
            title="Referenced In"
            defaultExpanded
            count={node.fileReferences.length}
          >
            <div className="space-y-1">
              {node.fileReferences.map((ref, index) => (
                <FileReferenceItem
                  key={`${ref.filePath}-${index}`}
                  reference={ref}
                  onClick={
                    onViewFile ? () => onViewFile(ref.filePath) : undefined
                  }
                />
              ))}
            </div>
          </Section>
        )}

        {/* Linked Artifact Section */}
        {node.artifactId && (
          <Section title="Linked Artifact" defaultExpanded>
            <div className="bg-blue-50 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                <span className="text-sm font-medium text-blue-700">
                  📎 Linked Artifact
                </span>
              </div>
              {node.artifactType && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Type</span>
                  <span className="text-gray-900 capitalize">
                    {node.artifactType.replace(/-/g, " ")}
                  </span>
                </div>
              )}
              {node.artifactSection && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Section</span>
                  <span className="text-gray-900">{node.artifactSection}</span>
                </div>
              )}
              <div className="flex gap-2">
                {onViewArtifact && (
                  <button
                    onClick={() => onViewArtifact(node.artifactId!)}
                    className="flex-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                  >
                    View Artifact
                  </button>
                )}
                {onUnlinkArtifact && (
                  <button
                    onClick={() => onUnlinkArtifact(node.id)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition-colors"
                  >
                    Unlink
                  </button>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Source Section - Shows where the block data originated from */}
        <Section
          title="Source"
          defaultExpanded={!!(node.sourceType || node.sourceLocation)}
        >
          <NavigableSourceSection
            sourceType={node.sourceType}
            sourceLocation={node.sourceLocation}
            onNavigateToChat={onNavigateToChatMessage}
            onNavigateToArtifact={onNavigateToArtifact}
            onNavigateToMemoryDB={onNavigateToMemoryDB}
            onNavigateToExternal={onNavigateToExternal}
          />
        </Section>
      </div>

      {/* Selection Actions Footer */}
      {hasSelectionActions && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-3">
          <div className="flex items-center gap-2">
            {onLinkNode && (
              <button
                onClick={() => onLinkNode(node.id)}
                disabled={isActionLoading === "link"}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {isActionLoading === "link" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                <span>Link</span>
              </button>
            )}
            {onGroupIntoSynthesis && (
              <button
                onClick={() => onGroupIntoSynthesis(node.id)}
                disabled={isActionLoading === "synthesis"}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                {isActionLoading === "synthesis" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Layers className="h-4 w-4" />
                )}
                <span>Synthesize</span>
              </button>
            )}
            {onDeleteNode && (
              <button
                onClick={() => onDeleteNode(node.id)}
                disabled={isActionLoading === "delete"}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isActionLoading === "delete" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NodeInspector;
