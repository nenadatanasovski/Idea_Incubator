/**
 * SchemaERD - Entity Relationship Diagram visualization
 *
 * Displays the schema relationships using an interactive SVG diagram
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Copy,
  Check,
} from "lucide-react";
import clsx from "clsx";

interface Relationship {
  from: string;
  to: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
  through?: string;
}

interface RelationshipData {
  relationships: Relationship[];
  graph: Record<string, Array<{ to: string; type: string }>>;
  summary: {
    total: number;
    oneToOne: number;
    oneToMany: number;
    manyToMany: number;
  };
}

interface NodePosition {
  x: number;
  y: number;
}

// Layout constants
const NODE_WIDTH = 140;
const NODE_HEIGHT = 36;
const HORIZONTAL_GAP = 180;
const VERTICAL_GAP = 80;
const CANVAS_PADDING = 60;

export default function SchemaERD() {
  const [data, setData] = useState<RelationshipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredRelationship, setHoveredRelationship] =
    useState<Relationship | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch relationships
  const fetchRelationships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/schema/relationships");
      if (!response.ok) {
        throw new Error("Failed to fetch relationships");
      }
      const json = await response.json();
      const result = json.data ?? json;
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  // Calculate node positions using a simple layered layout
  const nodePositions = useMemo(() => {
    if (!data) return new Map<string, NodePosition>();

    const positions = new Map<string, NodePosition>();

    // Get all unique entities
    const entities = new Set<string>();
    data.relationships.forEach((rel) => {
      entities.add(rel.from);
      entities.add(rel.to);
    });

    // Calculate in-degree and out-degree for layering
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    entities.forEach((e) => {
      inDegree.set(e, 0);
      outDegree.set(e, 0);
    });

    data.relationships.forEach((rel) => {
      inDegree.set(rel.to, (inDegree.get(rel.to) || 0) + 1);
      outDegree.set(rel.from, (outDegree.get(rel.from) || 0) + 1);
    });

    // Assign layers based on relationships
    const layers: string[][] = [];
    const assigned = new Set<string>();

    // Layer 0: entities with no incoming edges (root entities)
    const roots = Array.from(entities).filter(
      (e) => (inDegree.get(e) || 0) === 0,
    );
    if (roots.length > 0) {
      layers.push(roots);
      roots.forEach((r) => assigned.add(r));
    }

    // Assign remaining entities to layers
    while (assigned.size < entities.size) {
      const nextLayer: string[] = [];

      entities.forEach((e) => {
        if (assigned.has(e)) return;

        // Check if all predecessors are assigned
        const predecessors = data.relationships
          .filter((rel) => rel.to === e)
          .map((rel) => rel.from);

        const allPredecessorsAssigned = predecessors.every((p) =>
          assigned.has(p),
        );

        if (allPredecessorsAssigned || predecessors.length === 0) {
          nextLayer.push(e);
        }
      });

      // If no progress, add remaining entities
      if (nextLayer.length === 0) {
        entities.forEach((e) => {
          if (!assigned.has(e)) nextLayer.push(e);
        });
      }

      if (nextLayer.length > 0) {
        layers.push(nextLayer);
        nextLayer.forEach((e) => assigned.add(e));
      }
    }

    // Calculate positions
    layers.forEach((layer, layerIndex) => {
      const layerHeight = layer.length * (NODE_HEIGHT + VERTICAL_GAP);
      const startY = (layerHeight - VERTICAL_GAP) / -2;

      layer.forEach((entity, nodeIndex) => {
        positions.set(entity, {
          x: CANVAS_PADDING + layerIndex * HORIZONTAL_GAP,
          y:
            CANVAS_PADDING +
            startY +
            nodeIndex * (NODE_HEIGHT + VERTICAL_GAP) +
            300,
        });
      });
    });

    return positions;
  }, [data]);

  // Calculate SVG dimensions
  const svgDimensions = useMemo(() => {
    let maxX = 800;
    let maxY = 600;
    nodePositions.forEach((pos) => {
      maxX = Math.max(maxX, pos.x + NODE_WIDTH + CANVAS_PADDING);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT + CANVAS_PADDING);
    });
    return { width: maxX, height: maxY };
  }, [nodePositions]);

  // Check if a relationship is highlighted
  const isRelationshipHighlighted = (rel: Relationship) => {
    if (hoveredRelationship === rel) return true;
    if (hoveredNode) {
      return rel.from === hoveredNode || rel.to === hoveredNode;
    }
    return false;
  };

  // Check if a node is highlighted
  const isNodeHighlighted = (entity: string) => {
    if (hoveredNode === entity) return true;
    if (hoveredRelationship) {
      return (
        hoveredRelationship.from === entity || hoveredRelationship.to === entity
      );
    }
    return false;
  };

  // Generate Mermaid ERD source
  const generateMermaid = () => {
    if (!data) return "";

    let mermaid = "erDiagram\n";
    data.relationships.forEach((rel) => {
      const cardinality =
        rel.type === "one-to-one"
          ? "||--||"
          : rel.type === "one-to-many"
            ? "||--o{"
            : "}o--o{";
      mermaid += `    ${rel.from} ${cardinality} ${rel.to} : "${rel.through || ""}"\n`;
    });
    return mermaid;
  };

  // Copy Mermaid source
  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(generateMermaid());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export as SVG
  const handleExportSVG = () => {
    const svgElement = document.getElementById("schema-erd-svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schema-erd.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render relationship line
  const renderRelationship = (rel: Relationship, index: number) => {
    const fromPos = nodePositions.get(rel.from);
    const toPos = nodePositions.get(rel.to);
    if (!fromPos || !toPos) return null;

    const highlighted = isRelationshipHighlighted(rel);

    // Calculate connection points
    const fromX = fromPos.x + NODE_WIDTH;
    const fromY = fromPos.y + NODE_HEIGHT / 2;
    const toX = toPos.x;
    const toY = toPos.y + NODE_HEIGHT / 2;

    // Create curved path
    const midX = (fromX + toX) / 2;
    const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

    return (
      <g
        key={`${rel.from}-${rel.to}-${index}`}
        onMouseEnter={() => setHoveredRelationship(rel)}
        onMouseLeave={() => setHoveredRelationship(null)}
        className="cursor-pointer"
      >
        {/* Invisible wider path for easier hovering */}
        <path d={path} fill="none" stroke="transparent" strokeWidth={12} />

        {/* Visible path */}
        <path
          d={path}
          fill="none"
          stroke={highlighted ? "#6366f1" : "#d1d5db"}
          strokeWidth={highlighted ? 2 : 1.5}
          markerEnd={
            highlighted ? "url(#arrowhead-highlighted)" : "url(#arrowhead)"
          }
        />

        {/* Relationship type label */}
        {highlighted && (
          <text
            x={midX}
            y={(fromY + toY) / 2 - 8}
            textAnchor="middle"
            fill="#6366f1"
            className="text-xs font-medium"
          >
            {rel.type}
          </text>
        )}
      </g>
    );
  };

  // Render entity node
  const renderNode = (entity: string) => {
    const pos = nodePositions.get(entity);
    if (!pos) return null;

    const highlighted = isNodeHighlighted(entity);

    return (
      <g
        key={entity}
        onMouseEnter={() => setHoveredNode(entity)}
        onMouseLeave={() => setHoveredNode(null)}
        className="cursor-pointer"
      >
        {/* Node background */}
        <rect
          x={pos.x}
          y={pos.y}
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          rx={6}
          fill={highlighted ? "#eef2ff" : "#ffffff"}
          stroke={highlighted ? "#6366f1" : "#d1d5db"}
          strokeWidth={highlighted ? 2 : 1}
        />

        {/* Node label */}
        <text
          x={pos.x + NODE_WIDTH / 2}
          y={pos.y + NODE_HEIGHT / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={highlighted ? "#4338ca" : "#374151"}
          className={clsx("text-sm", highlighted && "font-medium")}
        >
          {entity.length > 16 ? entity.substring(0, 14) + "..." : entity}
        </text>
      </g>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading relationships...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={fetchRelationships}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.relationships.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No relationships defined in the schema
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* ERD Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-green-500"></span>
            1:1 ({data.summary.oneToOne})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500"></span>
            1:N ({data.summary.oneToMany})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-purple-500"></span>
            N:M ({data.summary.manyToMany})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="Reset zoom"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <button
            onClick={handleCopyMermaid}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            title="Copy as Mermaid"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Mermaid
          </button>
          <button
            onClick={handleExportSVG}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            title="Export as SVG"
          >
            <Download className="w-3.5 h-3.5" />
            SVG
          </button>
          <button
            onClick={fetchRelationships}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ERD Canvas */}
      <div
        className="flex-1 overflow-auto"
        style={{ backgroundColor: "#f8fafc" }}
      >
        <svg
          id="schema-erd-svg"
          width={svgDimensions.width * zoom}
          height={svgDimensions.height * zoom}
          style={{ minWidth: "100%", minHeight: "100%" }}
        >
          <g transform={`scale(${zoom})`}>
            {/* Defs for arrow markers */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#d1d5db" />
              </marker>
              <marker
                id="arrowhead-highlighted"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
              </marker>
            </defs>

            {/* Render relationships first (behind nodes) */}
            {data.relationships.map((rel, idx) => renderRelationship(rel, idx))}

            {/* Render nodes */}
            {Array.from(nodePositions.keys()).map((entity) =>
              renderNode(entity),
            )}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 border-t border-gray-200 bg-white text-xs text-gray-500 flex-shrink-0">
        <span>Hover over nodes or lines to highlight relationships</span>
        <span className="ml-auto">
          {nodePositions.size} entities | {data.summary.total} relationships
        </span>
      </div>
    </div>
  );
}
