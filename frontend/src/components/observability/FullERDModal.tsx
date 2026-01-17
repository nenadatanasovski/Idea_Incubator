import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  X,
  Key,
  Link2,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Database,
  ChevronLeft,
  ChevronRight,
  Search,
  Unlink,
} from "lucide-react";
import clsx from "clsx";

// Color schemes for light and dark modes
const colorSchemes = {
  light: {
    gridStroke: "#e2e8f0",
    tableShadow: "#94a3b8",
    tableBackground: "#ffffff",
    tableBorder: "#cbd5e1",
    tableBorderHover: "#94a3b8",
    tableHeaderBg: "#f1f5f9",
    tableHeaderBgCenter: "#dbeafe",
    tableNameText: "#334155",
    tableNameTextCenter: "#1e40af",
    columnText: "#475569",
    columnTextHighlighted: "#0f172a",
    columnType: "#94a3b8",
    columnHighlightBg: "#fef9c3",
    relationshipLine: "#94a3b8",
    relationshipLineHighlighted: "#6366f1",
    searchMatchGlow: "#fbbf24",
  },
  dark: {
    gridStroke: "#334155",
    tableShadow: "#0f172a",
    tableBackground: "#1e293b",
    tableBorder: "#475569",
    tableBorderHover: "#64748b",
    tableHeaderBg: "#334155",
    tableHeaderBgCenter: "#1e3a5f",
    tableNameText: "#e2e8f0",
    tableNameTextCenter: "#93c5fd",
    columnText: "#cbd5e1",
    columnTextHighlighted: "#f8fafc",
    columnType: "#64748b",
    columnHighlightBg: "#854d0e",
    relationshipLine: "#64748b",
    relationshipLineHighlighted: "#818cf8",
    searchMatchGlow: "#f59e0b",
  },
};

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  isForeignKey: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

interface TableNode {
  name: string;
  columns: ColumnInfo[];
  primaryKeys: string[];
  foreignKeys: Array<{
    column: string;
    referencesTable: string;
    referencesColumn: string;
  }>;
}

interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  relationshipType: "one-to-many" | "many-to-one" | "one-to-one";
}

interface RelationshipCluster {
  tables: TableNode[];
  relationships: TableRelationship[];
  centralTable: string;
}

interface FullERDModalProps {
  tableName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Layout constants
const TABLE_WIDTH = 200;
const TABLE_HEADER_HEIGHT = 32;
const COLUMN_HEIGHT = 24;
const TABLE_PADDING = 10;
const MIN_TABLE_GAP = 80;

interface TablePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const getTableHeight = (columnCount: number) =>
  TABLE_HEADER_HEIGHT +
  Math.min(columnCount, 6) * COLUMN_HEIGHT +
  TABLE_PADDING * 2 +
  (columnCount > 6 ? 20 : 0);

export default function FullERDModal({
  tableName,
  isOpen,
  onClose,
}: FullERDModalProps) {
  const [allClusters, setAllClusters] = useState<RelationshipCluster[]>([]);
  const [activeClusterIndex, setActiveClusterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<{
    table: string;
    column: string;
  } | null>(null);
  const [hoveredRelationship, setHoveredRelationship] =
    useState<TableRelationship | null>(null);
  const [zoom, setZoom] = useState(1);
  const [autoFitApplied, setAutoFitApplied] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Current cluster data
  const data = allClusters[activeClusterIndex] || null;

  // Get color scheme based on dark mode
  const colors = isDarkMode ? colorSchemes.dark : colorSchemes.light;

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setIsDarkMode(isDark);
    };

    checkDarkMode();

    // Observe for class changes on html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Filter tables matching search
  const matchingTables = useMemo(() => {
    if (!data || !searchTerm.trim()) return new Set<string>();
    const term = searchTerm.toLowerCase();
    return new Set(
      data.tables
        .filter(
          (t) =>
            t.name.toLowerCase().includes(term) ||
            t.columns.some((c) => c.name.toLowerCase().includes(term)),
        )
        .map((t) => t.name),
    );
  }, [data, searchTerm]);

  // Fetch all relationship clusters
  const fetchAllClusters = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/objects/clusters");
      const result = await response.json();
      if (result.success && result.data.clusters) {
        const rawClusters = result.data.clusters as RelationshipCluster[];

        // Separate clusters with relationships from standalone tables
        const clustersWithRelationships: RelationshipCluster[] = [];
        const standaloneTables: TableNode[] = [];

        rawClusters.forEach((cluster) => {
          if (cluster.relationships.length === 0) {
            // This is a standalone table (no relationships)
            standaloneTables.push(...cluster.tables);
          } else {
            clustersWithRelationships.push(cluster);
          }
        });

        // Create final clusters array
        let finalClusters = [...clustersWithRelationships];

        // Add "No Relationships" cluster if there are standalone tables
        if (standaloneTables.length > 0) {
          const noRelationshipsCluster: RelationshipCluster = {
            tables: standaloneTables,
            relationships: [],
            centralTable: "__no_relationships__",
          };
          finalClusters.push(noRelationshipsCluster);
        }

        // Find the cluster containing the initial table and set it as active
        let initialClusterIndex = finalClusters.findIndex((cluster) =>
          cluster.tables.some((t) => t.name === tableName),
        );

        // Update centralTable for the found cluster to be the tableName (unless it's the no-relationships cluster)
        if (
          initialClusterIndex >= 0 &&
          finalClusters[initialClusterIndex].centralTable !==
            "__no_relationships__"
        ) {
          finalClusters[initialClusterIndex] = {
            ...finalClusters[initialClusterIndex],
            centralTable: tableName,
          };
        }

        setAllClusters(finalClusters);
        setActiveClusterIndex(
          initialClusterIndex >= 0 ? initialClusterIndex : 0,
        );
      } else {
        setError(result.error || "Failed to fetch relationship clusters");
      }
    } catch (err) {
      setError("Failed to fetch relationship clusters");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tableName, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchAllClusters();
      // Reset zoom when opening - auto-fit will be calculated after data loads
      setZoom(1);
      setAutoFitApplied(false);
    }
  }, [fetchAllClusters, isOpen]);

  // Reset auto-fit when switching clusters
  useEffect(() => {
    setAutoFitApplied(false);
    setZoom(1);
    if (containerRef.current) {
      containerRef.current.scrollTo(0, 0);
    }
  }, [activeClusterIndex]);

  // Scroll tabs to show active tab
  const scrollTabsToActive = useCallback(() => {
    if (tabsContainerRef.current) {
      const activeTab = tabsContainerRef.current.querySelector(
        `[data-tab-index="${activeClusterIndex}"]`,
      );
      if (activeTab) {
        activeTab.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeClusterIndex]);

  useEffect(() => {
    scrollTabsToActive();
  }, [scrollTabsToActive]);

  // Check if cluster is the "No Relationships" special cluster
  const isNoRelationshipsCluster = (cluster: RelationshipCluster) => {
    return cluster.centralTable === "__no_relationships__";
  };

  // Get cluster display name
  const getClusterName = (cluster: RelationshipCluster, index: number) => {
    // Special case for no-relationships cluster
    if (isNoRelationshipsCluster(cluster)) {
      return "No Relationships";
    }
    // Use the first table name or central table as the cluster name
    const primaryTable =
      cluster.centralTable || cluster.tables[0]?.name || `Cluster ${index + 1}`;
    return primaryTable;
  };

  // Calculate table positions using force-directed-like layout
  const tablePositions = useMemo(() => {
    if (!data) return new Map<string, TablePosition>();

    const positions = new Map<string, TablePosition>();
    const tables = data.tables;
    const relationships = data.relationships;

    if (tables.length === 0) return positions;

    // Special case: No Relationships cluster - use grid layout
    if (isNoRelationshipsCluster(data)) {
      const COLS = Math.ceil(Math.sqrt(tables.length));
      const startX = 50;
      const startY = 50;

      tables.forEach((table, idx) => {
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        const height = getTableHeight(table.columns.length);

        positions.set(table.name, {
          x: startX + col * (TABLE_WIDTH + MIN_TABLE_GAP),
          y: startY + row * (180 + MIN_TABLE_GAP), // Use fixed row height for grid
          width: TABLE_WIDTH,
          height,
        });
      });

      return positions;
    }

    // Build adjacency map for layout
    const adjacency = new Map<string, Set<string>>();
    tables.forEach((t) => adjacency.set(t.name, new Set()));
    relationships.forEach((rel) => {
      adjacency.get(rel.fromTable)?.add(rel.toTable);
      adjacency.get(rel.toTable)?.add(rel.fromTable);
    });

    // Find center table (either the specified central table or most connected)
    const centerTableName = data.centralTable;
    const centerTable = tables.find((t) => t.name === centerTableName);

    if (!centerTable) return positions;

    // BFS to assign layers
    const layers = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ name: string; layer: number }> = [
      { name: centerTableName, layer: 0 },
    ];

    while (queue.length > 0) {
      const { name, layer } = queue.shift()!;
      if (visited.has(name)) continue;
      visited.add(name);
      layers.set(name, layer);

      const neighbors = adjacency.get(name) || new Set();
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          queue.push({ name: neighbor, layer: layer + 1 });
        }
      });
    }

    // Group tables by layer
    const layerGroups = new Map<number, TableNode[]>();
    tables.forEach((table) => {
      const layer = layers.get(table.name) || 0;
      if (!layerGroups.has(layer)) {
        layerGroups.set(layer, []);
      }
      layerGroups.get(layer)!.push(table);
    });

    // Calculate max height needed for any layer
    let maxLayerHeight = 0;
    layerGroups.forEach((group) => {
      let layerHeight = 0;
      group.forEach((t) => {
        layerHeight += getTableHeight(t.columns.length) + MIN_TABLE_GAP;
      });
      maxLayerHeight = Math.max(maxLayerHeight, layerHeight);
    });

    // Position tables
    const startX = 50;
    const layerWidth = TABLE_WIDTH + MIN_TABLE_GAP * 2;

    layerGroups.forEach((group, layer) => {
      const layerX = startX + layer * layerWidth;

      // Calculate total height for this layer
      let totalHeight = 0;
      group.forEach((t) => {
        totalHeight += getTableHeight(t.columns.length) + MIN_TABLE_GAP;
      });

      // Center vertically
      let currentY = Math.max(50, (maxLayerHeight - totalHeight) / 2 + 50);

      group.forEach((table) => {
        const height = getTableHeight(table.columns.length);
        positions.set(table.name, {
          x: layerX,
          y: currentY,
          width: TABLE_WIDTH,
          height,
        });
        currentY += height + MIN_TABLE_GAP;
      });
    });

    return positions;
  }, [data]);

  // Scroll to first matching table when search changes
  useEffect(() => {
    if (matchingTables.size > 0 && containerRef.current) {
      const firstMatch = Array.from(matchingTables)[0];
      const pos = tablePositions.get(firstMatch);
      if (pos) {
        const scrollX = Math.max(0, pos.x * zoom - 100);
        const scrollY = Math.max(0, pos.y * zoom - 100);
        containerRef.current.scrollTo({
          left: scrollX,
          top: scrollY,
          behavior: "smooth",
        });
      }
    }
  }, [matchingTables, tablePositions, zoom]);

  // Calculate SVG dimensions
  const svgDimensions = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    tablePositions.forEach((pos) => {
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    });
    return {
      width: maxX + 100,
      height: maxY + 100,
    };
  }, [tablePositions]);

  // Get column Y position within a table
  const getColumnY = (tableName: string, columnName: string): number | null => {
    const pos = tablePositions.get(tableName);
    if (!pos) return null;

    const table = data?.tables.find((t) => t.name === tableName);
    if (!table) return null;

    const columnIndex = table.columns.findIndex((c) => c.name === columnName);
    if (columnIndex === -1) return null;

    // Only show first 6 columns in position calculation
    const displayIndex = Math.min(columnIndex, 5);
    return (
      pos.y +
      TABLE_HEADER_HEIGHT +
      TABLE_PADDING +
      displayIndex * COLUMN_HEIGHT +
      COLUMN_HEIGHT / 2
    );
  };

  // Check if a column should be highlighted
  const isColumnHighlighted = (table: string, column: string): boolean => {
    if (hoveredColumn?.table === table && hoveredColumn?.column === column) {
      return true;
    }
    if (hoveredRelationship) {
      return (
        (hoveredRelationship.fromTable === table &&
          hoveredRelationship.fromColumn === column) ||
        (hoveredRelationship.toTable === table &&
          hoveredRelationship.toColumn === column)
      );
    }
    return false;
  };

  // Check if a relationship line should be highlighted
  const isRelationshipHighlighted = (rel: TableRelationship): boolean => {
    if (hoveredRelationship === rel) return true;
    if (hoveredColumn) {
      return (
        (rel.fromTable === hoveredColumn.table &&
          rel.fromColumn === hoveredColumn.column) ||
        (rel.toTable === hoveredColumn.table &&
          rel.toColumn === hoveredColumn.column)
      );
    }
    return false;
  };

  // Handle zoom with buttons
  const handleZoom = (delta: number) => {
    setZoom((z) => Math.max(0.25, Math.min(2, z + delta)));
  };

  // Calculate auto-fit zoom based on content and container size
  const calculateAutoFitZoom = useCallback(() => {
    const container = containerRef.current;
    if (!container || svgDimensions.width === 0 || svgDimensions.height === 0)
      return 1;

    // Get container dimensions (accounting for padding)
    const containerWidth = container.clientWidth - 40; // 20px padding on each side
    const containerHeight = container.clientHeight - 40;

    // Calculate the zoom needed to fit content
    const zoomX = containerWidth / svgDimensions.width;
    const zoomY = containerHeight / svgDimensions.height;

    // Use the smaller zoom to fit both dimensions, but cap between 0.3 and 1.5
    const fitZoom = Math.min(zoomX, zoomY);
    return Math.max(0.3, Math.min(1.5, fitZoom));
  }, [svgDimensions]);

  // Auto-fit zoom when data loads
  useEffect(() => {
    if (data && !loading && !autoFitApplied && containerRef.current) {
      // Small delay to ensure container is properly sized
      const timer = setTimeout(() => {
        const fitZoom = calculateAutoFitZoom();
        setZoom(fitZoom);
        setAutoFitApplied(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [data, loading, autoFitApplied, calculateAutoFitZoom]);

  // Reset view to auto-fit
  const resetView = () => {
    const fitZoom = calculateAutoFitZoom();
    setZoom(fitZoom);
    // Scroll to top-left
    if (containerRef.current) {
      containerRef.current.scrollTo(0, 0);
    }
  };

  // Render a table box
  const renderTable = (table: TableNode) => {
    const pos = tablePositions.get(table.name);
    if (!pos) return null;

    const isCenter = table.name === data?.centralTable;
    const isSearchMatch = matchingTables.has(table.name);
    const displayColumns = table.columns.slice(0, 6);

    return (
      <g key={table.name}>
        {/* Search match glow effect */}
        {isSearchMatch && (
          <rect
            x={pos.x - 4}
            y={pos.y - 4}
            width={pos.width + 8}
            height={pos.height + 8}
            rx={10}
            fill="none"
            stroke={colors.searchMatchGlow}
            strokeWidth={3}
            opacity={0.8}
          />
        )}

        {/* Table shadow */}
        <rect
          x={pos.x + 3}
          y={pos.y + 3}
          width={pos.width}
          height={pos.height}
          rx={6}
          fill={colors.tableShadow}
          opacity={0.3}
        />

        {/* Table background */}
        <rect
          x={pos.x}
          y={pos.y}
          width={pos.width}
          height={pos.height}
          rx={6}
          fill={colors.tableBackground}
          stroke={isCenter ? "#6366f1" : colors.tableBorder}
          strokeWidth={2}
        />

        {/* Table header */}
        <rect
          x={pos.x}
          y={pos.y}
          width={pos.width}
          height={TABLE_HEADER_HEIGHT}
          rx={6}
          fill={isCenter ? colors.tableHeaderBgCenter : colors.tableHeaderBg}
        />
        <rect
          x={pos.x}
          y={pos.y + TABLE_HEADER_HEIGHT - 6}
          width={pos.width}
          height={6}
          fill={isCenter ? colors.tableHeaderBgCenter : colors.tableHeaderBg}
        />

        {/* Table name */}
        <text
          x={pos.x + pos.width / 2}
          y={pos.y + TABLE_HEADER_HEIGHT / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isCenter ? colors.tableNameTextCenter : colors.tableNameText}
          className="text-xs font-semibold pointer-events-none"
        >
          {table.name.length > 22
            ? table.name.substring(0, 20) + "..."
            : table.name}
        </text>

        {/* Columns */}
        {displayColumns.map((col, idx) => {
          const colY =
            pos.y + TABLE_HEADER_HEIGHT + TABLE_PADDING + idx * COLUMN_HEIGHT;
          const highlighted = isColumnHighlighted(table.name, col.name);

          return (
            <g
              key={col.name}
              onMouseEnter={() =>
                setHoveredColumn({ table: table.name, column: col.name })
              }
              onMouseLeave={() => setHoveredColumn(null)}
              className="cursor-pointer"
            >
              {/* Column highlight background */}
              {highlighted && (
                <rect
                  x={pos.x + 3}
                  y={colY}
                  width={pos.width - 6}
                  height={COLUMN_HEIGHT}
                  rx={3}
                  fill={colors.columnHighlightBg}
                />
              )}

              {/* Column icon */}
              {col.primaryKey && (
                <g
                  transform={`translate(${pos.x + 10}, ${colY + COLUMN_HEIGHT / 2 - 5})`}
                >
                  <Key className="w-2.5 h-2.5 text-yellow-500" />
                </g>
              )}
              {col.isForeignKey && !col.primaryKey && (
                <g
                  transform={`translate(${pos.x + 10}, ${colY + COLUMN_HEIGHT / 2 - 5})`}
                >
                  <Link2 className="w-2.5 h-2.5 text-blue-500" />
                </g>
              )}

              {/* Column name */}
              <text
                x={pos.x + (col.primaryKey || col.isForeignKey ? 26 : 10)}
                y={colY + COLUMN_HEIGHT / 2}
                dominantBaseline="middle"
                fill={
                  highlighted ? colors.columnTextHighlighted : colors.columnText
                }
                className={clsx(
                  "text-[10px] pointer-events-none",
                  highlighted && "font-medium",
                )}
              >
                {col.name.length > 16
                  ? col.name.substring(0, 14) + "..."
                  : col.name}
              </text>

              {/* Column type */}
              <text
                x={pos.x + pos.width - 10}
                y={colY + COLUMN_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill={colors.columnType}
                className="text-[9px] pointer-events-none"
              >
                {col.type.length > 8
                  ? col.type.substring(0, 6) + ".."
                  : col.type}
              </text>
            </g>
          );
        })}

        {/* More columns indicator */}
        {table.columns.length > 6 && (
          <text
            x={pos.x + pos.width / 2}
            y={
              pos.y +
              TABLE_HEADER_HEIGHT +
              TABLE_PADDING +
              6 * COLUMN_HEIGHT +
              8
            }
            textAnchor="middle"
            fill={colors.columnType}
            className="text-[9px] pointer-events-none"
          >
            +{table.columns.length - 6} more
          </text>
        )}
      </g>
    );
  };

  // Render relationship lines
  const renderRelationships = () => {
    if (!data) return null;

    return data.relationships.map((rel, idx) => {
      const fromPos = tablePositions.get(rel.fromTable);
      const toPos = tablePositions.get(rel.toTable);
      if (!fromPos || !toPos) return null;

      const fromY = getColumnY(rel.fromTable, rel.fromColumn);
      const toY = getColumnY(rel.toTable, rel.toColumn);
      if (fromY === null || toY === null) return null;

      const highlighted = isRelationshipHighlighted(rel);

      // Determine connection points
      const fromCenterX = fromPos.x + fromPos.width / 2;
      const toCenterX = toPos.x + toPos.width / 2;

      let startX: number, endX: number;

      if (fromCenterX < toCenterX) {
        // From is left of To
        startX = fromPos.x + fromPos.width;
        endX = toPos.x;
      } else if (fromCenterX > toCenterX) {
        // From is right of To
        startX = fromPos.x;
        endX = toPos.x + toPos.width;
      } else {
        // Same X position - connect via sides
        startX = fromPos.x + fromPos.width;
        endX = toPos.x + toPos.width;
      }

      // Create curved path
      const dx = endX - startX;
      const controlOffset = Math.min(Math.abs(dx) * 0.4, 60);

      const path =
        `M ${startX} ${fromY} ` +
        `C ${startX + Math.sign(dx) * controlOffset} ${fromY}, ` +
        `${endX - Math.sign(dx) * controlOffset} ${toY}, ` +
        `${endX} ${toY}`;

      return (
        <g
          key={`${rel.fromTable}-${rel.fromColumn}-${rel.toTable}-${rel.toColumn}-${idx}`}
          onMouseEnter={() => setHoveredRelationship(rel)}
          onMouseLeave={() => setHoveredRelationship(null)}
          className="cursor-pointer"
        >
          {/* Invisible wider path for easier hovering */}
          <path d={path} fill="none" stroke="transparent" strokeWidth={10} />

          {/* Visible path */}
          <path
            d={path}
            fill="none"
            stroke={
              highlighted
                ? colors.relationshipLineHighlighted
                : colors.relationshipLine
            }
            strokeWidth={highlighted ? 2 : 1}
            className="transition-all duration-150"
            markerEnd={
              highlighted
                ? "url(#arrowhead-full-highlighted)"
                : "url(#arrowhead-full)"
            }
          />
        </g>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-[90vw] h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Database Relationships
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {allClusters.length} relationship group
                {allClusters.length !== 1 ? "s" : ""}
                {data && (
                  <span>
                    {" "}
                    • Viewing: {data.tables.length} tables,{" "}
                    {data.relationships.length} relationships
                  </span>
                )}
              </p>
            </div>

            {/* Search input */}
            <div className="relative ml-4">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search tables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchTerm && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                  {matchingTables.size} found
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-white dark:bg-slate-700 rounded-md border border-gray-200 dark:border-slate-600">
              <button
                onClick={() => handleZoom(-0.25)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 rounded"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-300 min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => handleZoom(0.25)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 rounded"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={resetView}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-600 rounded ml-1"
                title="Reset view"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={fetchAllClusters}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cluster Tabs */}
        {!loading && allClusters.length > 1 && (
          <div className="flex items-center border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
            {/* Left scroll button */}
            <button
              onClick={() => {
                if (tabsContainerRef.current) {
                  tabsContainerRef.current.scrollBy({
                    left: -200,
                    behavior: "smooth",
                  });
                }
              }}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0"
              title="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Tabs container */}
            <div
              ref={tabsContainerRef}
              className="flex-1 flex overflow-x-auto scrollbar-hide gap-1 py-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {allClusters.map((cluster, index) => {
                const isActive = index === activeClusterIndex;
                const containsInitialTable = cluster.tables.some(
                  (t) => t.name === tableName,
                );
                const isNoRelCluster = isNoRelationshipsCluster(cluster);

                return (
                  <button
                    key={index}
                    data-tab-index={index}
                    onClick={() => setActiveClusterIndex(index)}
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors flex-shrink-0",
                      isActive
                        ? isNoRelCluster
                          ? "bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 font-medium"
                          : "bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-gray-200",
                      containsInitialTable &&
                        !isActive &&
                        "ring-1 ring-primary-200 dark:ring-primary-700",
                    )}
                    title={
                      isNoRelCluster
                        ? `${cluster.tables.length} standalone tables`
                        : `${cluster.tables.length} tables, ${cluster.relationships.length} relationships`
                    }
                  >
                    {isNoRelCluster ? (
                      <Unlink className="w-3 h-3 text-gray-400" />
                    ) : (
                      <Database className="w-3 h-3" />
                    )}
                    <span className="max-w-[120px] truncate">
                      {getClusterName(cluster, index)}
                    </span>
                    <span
                      className={clsx(
                        "px-1.5 py-0.5 rounded text-[10px]",
                        isActive
                          ? isNoRelCluster
                            ? "bg-gray-300 dark:bg-slate-500"
                            : "bg-primary-200 dark:bg-primary-800"
                          : "bg-gray-200 dark:bg-slate-600",
                      )}
                    >
                      {cluster.tables.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right scroll button */}
            <button
              onClick={() => {
                if (tabsContainerRef.current) {
                  tabsContainerRef.current.scrollBy({
                    left: 200,
                    behavior: "smooth",
                  });
                }
              }}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0"
              title="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Content - scrollable container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 relative"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                Loading relationship cluster...
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <p className="mb-2">{error}</p>
              <button
                onClick={fetchAllClusters}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          ) : data ? (
            <div
              style={{
                width: svgDimensions.width * zoom,
                height: svgDimensions.height * zoom,
                minWidth: svgDimensions.width * zoom,
                minHeight: svgDimensions.height * zoom,
              }}
            >
              <svg
                ref={svgRef}
                width={svgDimensions.width}
                height={svgDimensions.height}
                style={{
                  display: "block",
                  transform: `scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
              >
                {/* Defs for arrow markers */}
                <defs>
                  <marker
                    id="arrowhead-full"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 8 3, 0 6"
                      fill={colors.relationshipLine}
                    />
                  </marker>
                  <marker
                    id="arrowhead-full-highlighted"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 8 3, 0 6"
                      fill={colors.relationshipLineHighlighted}
                    />
                  </marker>
                  {/* Grid pattern */}
                  <pattern
                    id="grid"
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke={colors.gridStroke}
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>

                {/* Grid background */}
                <rect
                  width={svgDimensions.width}
                  height={svgDimensions.height}
                  fill="url(#grid)"
                />

                {/* Render relationships first (behind tables) */}
                {renderRelationships()}

                {/* Render tables */}
                {data.tables.map((table) => renderTable(table))}
              </svg>
            </div>
          ) : null}

          {/* Scroll hint */}
          {!loading && !error && (
            <div className="absolute bottom-4 left-4 text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded pointer-events-none">
              Scroll to pan • Use search to find tables
            </div>
          )}
        </div>

        {/* Modal Footer - Legend */}
        <div className="flex items-center gap-6 px-4 py-2 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary-100 dark:bg-primary-900 border-2 border-primary-500"></div>
            <span>Central Table</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Key className="w-3 h-3 text-yellow-500" />
            <span>Primary Key</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link2 className="w-3 h-3 text-blue-500" />
            <span>Foreign Key</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
            <span>→ References</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 border-amber-500"></div>
            <span>Search Match</span>
          </div>
          <span className="ml-auto text-gray-400 dark:text-gray-500">
            Hover to highlight related columns
          </span>
        </div>
      </div>
    </div>
  );
}
