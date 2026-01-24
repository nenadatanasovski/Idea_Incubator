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
} from "../../types/graph";
import { nodeColors, edgeColors, graphColors } from "../../types/graph";
import { FileText, ExternalLink, FileCode, File } from "lucide-react";
import { parseProperties } from "./utils/propertyDisplay";
import { SpecialPropertiesSection } from "./PropertyDisplayComponents";

export interface RelationshipHoverInfo {
  currentNodeId: string;
  relatedNodeId: string;
  edgeId: string;
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

  return (
    <div
      className={`
        w-full sm:w-80 md:w-96
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
          <h3 className="font-semibold text-gray-900 break-words">
            {node.content}
          </h3>
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
                {new Date(node.createdAt).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Updated</dt>
              <dd className="text-gray-900 text-xs">
                {new Date(node.updatedAt).toLocaleString()}
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

        {/* Source Attribution Section (if available) */}
        {(node.sourceType || node.sourceName) && (
          <Section title="Source" defaultExpanded={false}>
            <dl className="space-y-2 text-sm">
              {node.sourceType && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Type</dt>
                  <dd className="text-gray-900 capitalize">
                    {node.sourceType.replace(/_/g, " ")}
                  </dd>
                </div>
              )}
              {node.sourceName && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Name</dt>
                  <dd className="text-gray-900">{node.sourceName}</dd>
                </div>
              )}
              {node.sourceDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Date</dt>
                  <dd className="text-gray-900">{node.sourceDate}</dd>
                </div>
              )}
              {node.verifiable !== undefined && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Verifiable</dt>
                  <dd className="text-gray-900">
                    {node.verifiable ? "Yes" : "No"}
                  </dd>
                </div>
              )}
            </dl>
          </Section>
        )}
      </div>
    </div>
  );
}

export default NodeInspector;
