/**
 * GraphLegend Component
 * Visual legend for node colors, shapes, and edge styles
 */

import { useState, useCallback } from "react";
import {
  nodeColors,
  edgeColors,
  edgeStyles,
  nodeShapes,
} from "../../types/graph";
import type {
  BlockType,
  GraphType,
  LinkType,
  NodeShape,
} from "../../types/graph";

export interface GraphLegendProps {
  className?: string;
  defaultCollapsed?: boolean;
  showNodeColors?: boolean;
  showNodeShapes?: boolean;
  showEdgeStyles?: boolean;
  /** External control for expanded state */
  isExpanded?: boolean;
  /** Callback when expansion state changes */
  onExpandedChange?: (expanded: boolean) => void;
}

// Human-readable labels for block types
const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  // Canonical (11)
  insight: "Insight",
  fact: "Fact",
  assumption: "Assumption",
  question: "Question",
  decision: "Decision",
  action: "Action",
  requirement: "Requirement",
  option: "Option",
  pattern: "Pattern",
  synthesis: "Synthesis",
  meta: "Meta",
  // Legacy (hidden from legend)
  content: "Content",
  link: "Link",
  derived: "Derived",
  cycle: "Cycle",
  placeholder: "Placeholder",
  stakeholder_view: "Stakeholder View",
  topic: "Topic",
  external: "External",
};

// Canonical block types to show in legend (11 items)
const CANONICAL_BLOCK_TYPES: BlockType[] = [
  "insight",
  "fact",
  "assumption",
  "question",
  "decision",
  "action",
  "requirement",
  "option",
  "pattern",
  "synthesis",
  "meta",
];

// Human-readable labels for graph types
const GRAPH_TYPE_LABELS: Record<GraphType, string> = {
  problem: "Problem",
  solution: "Solution",
  market: "Market",
  risk: "Risk",
  fit: "Fit",
  business: "Business",
  spec: "Spec",
  distribution: "Distribution",
  marketing: "Marketing",
  manufacturing: "Manufacturing",
};

// Human-readable labels for link types
const LINK_TYPE_LABELS: Record<LinkType, string> = {
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

// Edge style groups for organized display
const EDGE_STYLE_GROUPS: Record<string, LinkType[]> = {
  "Problem-Solution": ["addresses", "creates"],
  Dependencies: ["requires", "blocks", "unblocks", "constrained_by"],
  Evolution: ["supersedes", "refines", "replaces", "contradicts"],
  Evidence: ["evidence_for", "derived_from", "validates_claim"],
  Hierarchy: ["implements", "implemented_by", "synthesizes", "instance_of"],
  Decision: ["alternative_to"],
  Scope: ["about", "excludes", "includes"],
};

/**
 * Shape SVG component
 */
function ShapeIcon({ shape, color }: { shape: NodeShape; color: string }) {
  const size = 16;
  const center = size / 2;

  switch (shape) {
    case "circle":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={center} cy={center} r={5} fill={color} />
        </svg>
      );
    case "diamond":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${center},2 ${size - 2},${center} ${center},${size - 2} 2,${center}`}
            fill={color}
          />
        </svg>
      );
    case "hexagon":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${center},2 ${size - 2},5 ${size - 2},${size - 5} ${center},${size - 2} 2,${size - 5} 2,5`}
            fill={color}
          />
        </svg>
      );
    case "triangle":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${center},2 ${size - 2},${size - 2} 2,${size - 2}`}
            fill={color}
          />
        </svg>
      );
    case "square":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect x="2" y="2" width={size - 4} height={size - 4} fill={color} />
        </svg>
      );
    case "pentagon":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${center},2 ${size - 2},6 ${size - 3},${size - 2} 3,${size - 2} 2,6`}
            fill={color}
          />
        </svg>
      );
    case "star":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`${center},1 ${center + 2},6 ${size - 1},6 ${center + 3},9 ${size - 2},${size - 1} ${center},11 2,${size - 1} ${center - 3},9 1,6 ${center - 2},6`}
            fill={color}
          />
        </svg>
      );
    case "octagon":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`5,2 11,2 14,5 14,11 11,14 5,14 2,11 2,5`}
            fill={color}
          />
        </svg>
      );
    case "cross":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={`6,2 10,2 10,6 14,6 14,10 10,10 10,14 6,14 6,10 2,10 2,6 6,6`}
            fill={color}
          />
        </svg>
      );
    case "pill":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect x="1" y="4" width={14} height={8} rx={4} fill={color} />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={center} cy={center} r={5} fill={color} />
        </svg>
      );
  }
}

// Bidirectional link types (arrows on both ends)
const BIDIRECTIONAL_LINK_TYPES: LinkType[] = ["alternative_to", "contradicts"];

/**
 * Edge style line component
 */
function EdgeStyleLine({
  color,
  style,
  bidirectional = false,
}: {
  color: string;
  style: "solid" | "dashed" | "dotted";
  bidirectional?: boolean;
}) {
  const dashArray =
    style === "dashed" ? "4,3" : style === "dotted" ? "1,2" : undefined;

  return (
    <svg width={32} height={12} viewBox="0 0 32 12">
      {/* Left arrow (only for bidirectional) */}
      {bidirectional && <polygon points="0,6 6,2 6,10" fill={color} />}
      <line
        x1={bidirectional ? 6 : 0}
        y1="6"
        x2={26}
        y2="6"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dashArray}
      />
      {/* Right arrow */}
      <polygon points="32,6 26,2 26,10" fill={color} />
    </svg>
  );
}

/**
 * Legend section component
 */
function LegendSection({
  title,
  children,
  isExpanded,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full py-2 flex items-center justify-between text-xs font-medium text-gray-600 uppercase tracking-wider hover:text-gray-900"
      >
        {title}
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
      {isExpanded && <div className="pb-3">{children}</div>}
    </div>
  );
}

/**
 * Compact legend pill for minimized state
 */
function LegendPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 border border-white rounded-full shadow-sm transition-all hover:shadow-md"
      data-testid="legend-pill"
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
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <span className="text-sm font-medium text-gray-700">Legend</span>
      <svg
        className="w-4 h-4 text-gray-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    </button>
  );
}

/**
 * GraphLegend Component
 */
export function GraphLegend({
  className = "",
  defaultCollapsed = true,
  showNodeColors = true,
  showNodeShapes = true,
  showEdgeStyles = true,
  isExpanded: externalExpanded,
  onExpandedChange,
}: GraphLegendProps) {
  // Use external state if provided, otherwise use internal state
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsed =
    externalExpanded !== undefined ? !externalExpanded : internalCollapsed;

  const setIsCollapsed = (collapsed: boolean) => {
    if (onExpandedChange) {
      onExpandedChange(!collapsed);
    } else {
      setInternalCollapsed(collapsed);
    }
  };

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["colors", "shapes", "edges"]),
  );

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Show only canonical 11 block types in legend
  const visibleBlockTypes = CANONICAL_BLOCK_TYPES;

  // Collapsed state - show pill
  if (isCollapsed) {
    return (
      <div className={className} data-testid="graph-legend">
        <LegendPill onClick={() => setIsCollapsed(false)} />
      </div>
    );
  }

  // Expanded state
  return (
    <div
      className={`bg-white rounded-lg shadow-lg border border-white w-72 ${className}`}
      data-testid="graph-legend"
    >
      {/* Content */}
      <div className="px-3 divide-y divide-gray-100">
        {/* Node Colors (Block Types) */}
        {showNodeColors && (
          <LegendSection
            title="Block Type"
            isExpanded={expandedSections.has("colors")}
            onToggle={() => toggleSection("colors")}
          >
            <p className="text-xs text-gray-400 mb-2">
              Color indicates what kind of information the node represents.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {visibleBlockTypes.map((blockType) => (
                <div key={blockType} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: nodeColors[blockType] }}
                  />
                  <span className="text-xs text-gray-600 truncate">
                    {BLOCK_TYPE_LABELS[blockType]}
                  </span>
                </div>
              ))}
            </div>
          </LegendSection>
        )}

        {/* Node Shapes (Graph Types) */}
        {showNodeShapes && (
          <LegendSection
            title="Graph Type"
            isExpanded={expandedSections.has("shapes")}
            onToggle={() => toggleSection("shapes")}
          >
            <p className="text-xs text-gray-400 mb-2">
              Shape indicates which business dimension the node belongs to.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {(Object.keys(nodeShapes) as GraphType[]).map((graphType) => (
                <div key={graphType} className="flex items-center gap-2">
                  <ShapeIcon shape={nodeShapes[graphType]} color="#9ca3af" />
                  <span className="text-xs text-gray-400 truncate">
                    {GRAPH_TYPE_LABELS[graphType]}
                  </span>
                </div>
              ))}
            </div>
          </LegendSection>
        )}

        {/* Edge Styles (Link Types) */}
        {showEdgeStyles && (
          <LegendSection
            title="Edge Styles"
            isExpanded={expandedSections.has("edges")}
            onToggle={() => toggleSection("edges")}
          >
            <div className="space-y-3">
              {Object.entries(EDGE_STYLE_GROUPS).map(([group, linkTypes]) => (
                <div key={group}>
                  <h5 className="text-xs font-medium text-gray-500 mb-1">
                    {group}
                  </h5>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {linkTypes.map((linkType) => (
                      <div key={linkType} className="flex items-center gap-2">
                        <EdgeStyleLine
                          color={edgeColors[linkType]}
                          style={edgeStyles[linkType]}
                          bidirectional={BIDIRECTIONAL_LINK_TYPES.includes(
                            linkType,
                          )}
                        />
                        <span className="text-xs text-gray-600 truncate">
                          {LINK_TYPE_LABELS[linkType]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </LegendSection>
        )}
      </div>

      {/* Footer with minimize button - stays at bottom */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <span className="text-sm font-medium text-gray-800">Legend</span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Minimize"
          data-testid="legend-minimize-btn"
        >
          <svg
            className="w-4 h-4 text-gray-500"
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
      </div>
    </div>
  );
}

export default GraphLegend;
