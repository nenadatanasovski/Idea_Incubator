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
  Sparkles,
  List,
  AlignLeft,
} from "lucide-react";
import { parseProperties } from "./utils/propertyDisplay";
import { SpecialPropertiesSection } from "./PropertyDisplayComponents";
import { EvidenceChainPanel } from "./EvidenceChainPanel";
import { BlockTypeInspector } from "./BlockTypeInspector";
import type { SourceType } from "../../types/graph";
import { useIdeationAPI } from "../../hooks/useIdeationAPI";

// AI-mapped source type from the database
interface MappedSource {
  sourceId: string;
  sourceType: string;
  title: string | null;
  contentSnippet: string | null;
  relevanceScore: number;
  reason: string;
}

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
  sessionId?: string; // Required to fetch AI-mapped sources
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
  onDeleteNode?: (nodeId: string, nodeLabel: string) => void;
  isActionLoading?: string | null;
  className?: string;
}

interface Relationship {
  edge: GraphEdge;
  relatedNode: GraphNode;
  direction: "incoming" | "outgoing";
}

/**
 * Relationship view mode
 */
type RelationshipViewMode = "list" | "prose";

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
 * Get prose-friendly link type label (lowercase for sentence flow)
 */
function getLinkTypeLabelProse(linkType: LinkType): string {
  const labels: Record<LinkType, string> = {
    addresses: "addresses",
    creates: "creates",
    requires: "requires",
    blocks: "blocks",
    unblocks: "unblocks",
    supersedes: "supersedes",
    refines: "refines",
    replaces: "replaces",
    contradicts: "contradicts",
    evidence_for: "is evidence for",
    derived_from: "is derived from",
    implements: "implements",
    implemented_by: "is implemented by",
    alternative_to: "is an alternative to",
    synthesizes: "synthesizes",
    instance_of: "is an instance of",
    about: "is about",
    excludes: "excludes",
    includes: "includes",
    constrained_by: "is constrained by",
    validates_claim: "validates the claim of",
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

      {/* Related node title and content */}
      <div className="ml-8 mt-1">
        {relatedNode.title && (
          <div className="text-sm font-medium text-gray-900 group-hover:text-gray-900">
            {relatedNode.title}
          </div>
        )}
        <div
          className={`text-sm text-gray-600 group-hover:text-gray-700 ${relatedNode.title ? "mt-0.5" : ""}`}
        >
          {relatedNode.content}
        </div>
      </div>
    </button>
  );
}

// Default fallback color for unknown types
const FALLBACK_COLOR = "#6B7280"; // Gray

/**
 * Get the display type and color for a node
 * Uses graphMembership (solution, problem, etc.) with graphColors
 */
function getNodeTypeDisplay(node: GraphNode): { type: string; color: string } {
  const type = node.graphMembership?.[0] || node.blockType;
  const color =
    graphColors[type as keyof typeof graphColors] ||
    nodeColors[type as keyof typeof nodeColors] ||
    FALLBACK_COLOR;
  return { type, color };
}

/**
 * Relationship item component (Prose view - sentence format)
 * Renders relationships as readable sentences like:
 * "The solution 'Spec Agent' leads to the solution 'Build Agent'"
 */
function RelationshipItemProse({
  relationship,
  currentNode,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  relationship: Relationship;
  currentNode: GraphNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const { edge, relatedNode, direction } = relationship;
  const isIncoming = direction === "incoming";

  // Build the sentence based on direction
  // Incoming: "The [source.type] '[source.title]' [linkType] the [current.type] '[current.title]'"
  // Outgoing: "The [current.type] '[current.title]' [linkType] the [target.type] '[target.title]'"
  const sourceNode = isIncoming ? relatedNode : currentNode;
  const targetNode = isIncoming ? currentNode : relatedNode;

  const sourceTitle = sourceNode.title || sourceNode.content;
  const targetTitle = targetNode.title || targetNode.content;

  const sourceDisplay = getNodeTypeDisplay(sourceNode);
  const targetDisplay = getNodeTypeDisplay(targetNode);
  const linkColor = edgeColors[edge.linkType] || FALLBACK_COLOR;

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="w-full p-3 text-left rounded-lg hover:bg-gray-100 transition-colors group border border-gray-100 mb-2"
    >
      <p className="text-sm leading-loose flex flex-wrap items-center gap-1">
        <span className="text-gray-400">The</span>
        <span
          className="px-2 py-1 rounded text-sm font-semibold"
          style={{
            backgroundColor: sourceDisplay.color,
            color: "#ffffff",
          }}
        >
          {sourceDisplay.type}
        </span>
        <span className="text-gray-500 font-medium">"{sourceTitle}"</span>
        <span
          className="px-2 py-1 rounded text-sm font-semibold"
          style={{
            backgroundColor: linkColor,
            color: "#ffffff",
          }}
        >
          {getLinkTypeLabelProse(edge.linkType)}
        </span>
        <span className="text-gray-400">the</span>
        <span
          className="px-2 py-1 rounded text-sm font-semibold"
          style={{
            backgroundColor: targetDisplay.color,
            color: "#ffffff",
          }}
        >
          {targetDisplay.type}
        </span>
        <span className="text-gray-500 font-medium">"{targetTitle}"</span>
      </p>
      {/* Metadata row - only show degree */}
      {edge.degree && (
        <div className="mt-2 text-xs text-gray-500 italic">{edge.degree}</div>
      )}
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
 * Includes both frontend types and server-side types for compatibility
 */
const SOURCE_TYPE_LABELS: Record<
  string, // Using string to allow both SourceType and server types
  { label: string; color: string; icon: string }
> = {
  // Frontend source types
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
  // Server-side source types (from source-collector.ts)
  conversation: {
    label: "Conversation",
    color: "bg-purple-100 text-purple-700",
    icon: "💬",
  },
  conversation_insight: {
    label: "AI Insight",
    color: "bg-indigo-100 text-indigo-700",
    icon: "💡",
  },
  user_block: {
    label: "User Block",
    color: "bg-green-100 text-green-700",
    icon: "✏️",
  },
  external: {
    label: "External",
    color: "bg-gray-100 text-gray-700",
    icon: "🔗",
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
      // Build description from title and/or section
      let artifactDescription = "Artifact document";
      if (location.artifactTitle) {
        artifactDescription = location.artifactSection
          ? `${location.artifactTitle} (${location.artifactSection})`
          : location.artifactTitle;
      } else if (location.artifactSection) {
        artifactDescription = location.artifactSection;
      }
      return {
        icon: <FileText className="w-4 h-4" />,
        label: "Open artifact",
        description: artifactDescription,
      };
    case "memory_db":
      // Special handling for memory files (tableName === "files")
      if (location.tableName === "files") {
        const fileTitle =
          location.memoryFileTitle || location.memoryFileType || "Memory file";
        return {
          icon: <FileText className="w-4 h-4" />,
          label: "View in Memory Files",
          description: fileTitle,
        };
      }
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
  allSources,
  onNavigateToChat,
  onNavigateToArtifact,
  onNavigateToMemoryDB,
  onNavigateToExternal,
}: {
  sourceType?: SourceType;
  sourceLocation?: SourceLocation;
  allSources?: Array<{
    id: string;
    type: string;
    title?: string | null;
    weight?: number | null;
  }>;
  onNavigateToChat?: (messageId: string, turnIndex?: number) => void;
  onNavigateToArtifact?: (artifactId: string, section?: string) => void;
  onNavigateToMemoryDB?: (tableName: string, blockId?: string) => void;
  onNavigateToExternal?: (url: string) => void;
}) {
  const hasSource =
    sourceType || sourceLocation || (allSources && allSources.length > 0);

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

  // Collect all unique source types from allSources for display
  const uniqueSourceTypes = useMemo(() => {
    if (!allSources || allSources.length === 0) return [];
    const types = new Set<string>();
    allSources.forEach((s) => {
      if (s.type) types.add(s.type);
    });
    return Array.from(types);
  }, [allSources]);

  return (
    <div className="space-y-3">
      {/* Source type badges - show all unique types from allSources */}
      {uniqueSourceTypes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {uniqueSourceTypes.map((type) => {
            const typeInfo =
              SOURCE_TYPE_LABELS[type as SourceType] ||
              SOURCE_TYPE_LABELS.ai_generated;
            return (
              <div key={type} className="flex items-center gap-1">
                <span className="text-sm">{typeInfo.icon}</span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-medium ${typeInfo.color}`}
                >
                  {typeInfo.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        // Fallback to single sourceType if no allSources
        sourceTypeInfo && (
          <div className="flex items-center gap-2">
            <span className="text-lg">{sourceTypeInfo.icon}</span>
            <span
              className={`px-2.5 py-1 rounded-lg text-sm font-medium ${sourceTypeInfo.color}`}
            >
              {sourceTypeInfo.label}
            </span>
          </div>
        )
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

      {/* All sources that contributed to this insight */}
      {allSources && allSources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Analysis Sources ({allSources.length})
          </p>
          <div className="space-y-1.5">
            {allSources.map((source, idx) => {
              const sourceTypeLabel =
                SOURCE_TYPE_LABELS[source.type as SourceType] ||
                SOURCE_TYPE_LABELS.ai_generated;
              const isArtifact = source.type === "artifact";
              const isMemoryFile = source.type === "memory_file";
              const canNavigateArtifact = isArtifact && onNavigateToArtifact;
              const canNavigateMemoryFile =
                isMemoryFile && onNavigateToMemoryDB;
              const canNavigateSource =
                canNavigateArtifact || canNavigateMemoryFile;

              // Determine background color based on source type
              const bgClass = canNavigateArtifact
                ? "bg-amber-50 hover:bg-amber-100 cursor-pointer"
                : canNavigateMemoryFile
                  ? "bg-cyan-50 hover:bg-cyan-100 cursor-pointer"
                  : "bg-gray-50";

              return (
                <div
                  key={source.id || idx}
                  className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm ${bgClass}`}
                  onClick={() => {
                    if (canNavigateArtifact) {
                      onNavigateToArtifact(source.id);
                    } else if (canNavigateMemoryFile) {
                      // Navigate to Memory DB files tab
                      onNavigateToMemoryDB("files", source.id);
                    }
                  }}
                  role={canNavigateSource ? "button" : undefined}
                  tabIndex={canNavigateSource ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (
                      canNavigateSource &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      if (canNavigateArtifact) {
                        onNavigateToArtifact(source.id);
                      } else if (canNavigateMemoryFile) {
                        onNavigateToMemoryDB("files", source.id);
                      }
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs">{sourceTypeLabel.icon}</span>
                    <span className="truncate text-gray-700">
                      {source.title || `${source.type} source`}
                    </span>
                  </div>
                  {source.weight && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {Math.round(source.weight * 100)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
  sessionId,
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
  const [mappedSources, setMappedSources] = useState<MappedSource[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [relationshipViewMode, setRelationshipViewMode] =
    useState<RelationshipViewMode>("prose");
  const { getBlockSources } = useIdeationAPI();

  // Animate slide-in on mount
  useEffect(() => {
    // Small delay to trigger CSS transition
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Fetch AI-mapped sources when node changes
  useEffect(() => {
    if (!sessionId || !node.id) {
      setMappedSources([]);
      return;
    }

    let cancelled = false;
    setIsLoadingSources(true);

    getBlockSources(sessionId, node.id)
      .then((response) => {
        if (!cancelled && response.success) {
          setMappedSources(response.sources);
        }
      })
      .catch((error) => {
        console.error("[NodeInspector] Error fetching mapped sources:", error);
        if (!cancelled) {
          setMappedSources([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSources(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, node.id, getBlockSources]);

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

        {/* Relationships Section with View Toggle */}
        <div className="border-b border-gray-200 last:border-b-0">
          <div className="w-full py-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Relationships
              {totalRelationships > 0 && (
                <span className="px-1.5 py-0.5 bg-gray-200 rounded-full text-xs font-normal normal-case">
                  {totalRelationships}
                </span>
              )}
            </span>
            {/* View mode toggle */}
            {totalRelationships > 0 && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setRelationshipViewMode("list")}
                  className={`p-1.5 rounded transition-colors ${
                    relationshipViewMode === "list"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  title="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRelationshipViewMode("prose")}
                  className={`p-1.5 rounded transition-colors ${
                    relationshipViewMode === "prose"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  title="Prose view"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="pb-4">
            {totalRelationships === 0 ? (
              <p className="text-sm text-gray-500 italic">No relationships</p>
            ) : relationshipViewMode === "prose" ? (
              /* Prose view - all relationships as sentences */
              <div className="space-y-1">
                {[...incomingRelationships, ...outgoingRelationships].map(
                  (rel) => (
                    <RelationshipItemProse
                      key={rel.edge.id}
                      relationship={rel}
                      currentNode={node}
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
                  ),
                )}
              </div>
            ) : (
              /* List view - grouped by incoming/outgoing */
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
          </div>
        </div>

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

        {/* Source Section - Shows where the block data originated from
            Skip if Linked Artifact section already covers this (avoid duplication) */}
        {!(node.artifactId && node.sourceLocation?.type === "artifact") && (
          <Section
            title={
              node.allSources && node.allSources.length > 1
                ? `Sources (${node.allSources.length})`
                : "Source"
            }
            defaultExpanded={
              !!(node.sourceType || node.sourceLocation || node.allSources)
            }
          >
            <NavigableSourceSection
              sourceType={node.sourceType}
              sourceLocation={node.sourceLocation}
              allSources={node.allSources}
              onNavigateToChat={onNavigateToChatMessage}
              onNavigateToArtifact={onNavigateToArtifact}
              onNavigateToMemoryDB={onNavigateToMemoryDB}
              onNavigateToExternal={onNavigateToExternal}
            />
          </Section>
        )}

        {/* AI-Mapped Sources Section - Shows sources mapped by Claude Opus 4.5 */}
        {sessionId && (
          <Section
            title="AI-Mapped Sources"
            defaultExpanded={mappedSources.length > 0}
            count={mappedSources.length}
          >
            {isLoadingSources ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading sources...</span>
              </div>
            ) : mappedSources.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No AI-mapped sources found. Sources are mapped when nodes are
                created through the graph analysis flow.
              </p>
            ) : (
              <div className="space-y-3">
                {mappedSources.map((source, idx) => {
                  // Determine icon and color based on source type
                  const sourceTypeInfo: Record<
                    string,
                    { icon: string; color: string; label: string }
                  > = {
                    conversation: {
                      icon: "💬",
                      color: "bg-purple-100 text-purple-700",
                      label: "Chat",
                    },
                    conversation_insight: {
                      icon: "💡",
                      color: "bg-indigo-100 text-indigo-700",
                      label: "AI Insight",
                    },
                    artifact: {
                      icon: "📄",
                      color: "bg-amber-100 text-amber-700",
                      label: "Artifact",
                    },
                    memory_file: {
                      icon: "🧠",
                      color: "bg-cyan-100 text-cyan-700",
                      label: "Memory File",
                    },
                    user_block: {
                      icon: "✏️",
                      color: "bg-green-100 text-green-700",
                      label: "User Block",
                    },
                    external: {
                      icon: "🔗",
                      color: "bg-gray-100 text-gray-700",
                      label: "External",
                    },
                  };
                  const typeInfo = sourceTypeInfo[source.sourceType] || {
                    icon: "📎",
                    color: "bg-gray-100 text-gray-700",
                    label: source.sourceType,
                  };

                  const canNavigate =
                    (source.sourceType === "artifact" &&
                      onNavigateToArtifact) ||
                    (source.sourceType === "memory_file" &&
                      onNavigateToMemoryDB);

                  return (
                    <div
                      key={source.sourceId || idx}
                      className={`p-3 rounded-lg border ${
                        canNavigate
                          ? "cursor-pointer hover:border-blue-300 hover:bg-blue-50"
                          : ""
                      } border-gray-200 bg-gray-50`}
                      onClick={() => {
                        if (
                          source.sourceType === "artifact" &&
                          onNavigateToArtifact
                        ) {
                          onNavigateToArtifact(source.sourceId);
                        } else if (
                          source.sourceType === "memory_file" &&
                          onNavigateToMemoryDB
                        ) {
                          onNavigateToMemoryDB("files", source.sourceId);
                        }
                      }}
                      role={canNavigate ? "button" : undefined}
                      tabIndex={canNavigate ? 0 : undefined}
                    >
                      {/* Header with type badge and relevance */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{typeInfo.icon}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span className="text-xs font-medium text-gray-600">
                            {Math.round(source.relevanceScore * 100)}% relevant
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      {source.title && (
                        <p className="text-sm font-medium text-gray-800 mb-1">
                          {source.title}
                        </p>
                      )}

                      {/* Content snippet */}
                      {source.contentSnippet && (
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                          {source.contentSnippet}
                        </p>
                      )}

                      {/* AI reasoning */}
                      <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-gray-200">
                        <Sparkles className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600 italic">
                          {source.reason}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}
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
                onClick={() =>
                  onDeleteNode(
                    node.id,
                    node.title || node.content?.substring(0, 50) || "Node",
                  )
                }
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
