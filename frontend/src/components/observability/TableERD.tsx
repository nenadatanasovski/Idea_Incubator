import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Key,
  Link2,
  Loader2,
  Maximize2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import clsx from "clsx";

// Color schemes for light and dark modes
const colorSchemes = {
  light: {
    tableBackground: "#ffffff",
    tableBorder: "#d1d5db",
    tableBorderCenter: "#6366f1",
    tableHeaderBg: "#f9fafb",
    tableHeaderBgCenter: "#eef2ff",
    tableNameText: "#374151",
    tableNameTextCenter: "#4338ca",
    columnText: "#4b5563",
    columnTextHighlighted: "#111827",
    columnType: "#9ca3af",
    columnHighlightBg: "#fef9c3",
    relationshipLine: "#d1d5db",
    relationshipLineHighlighted: "#6366f1",
    canvasBg: "#f8fafc",
  },
  dark: {
    tableBackground: "#1e293b",
    tableBorder: "#475569",
    tableBorderCenter: "#818cf8",
    tableHeaderBg: "#334155",
    tableHeaderBgCenter: "#312e81",
    tableNameText: "#e5e7eb",
    tableNameTextCenter: "#a5b4fc",
    columnText: "#d1d5db",
    columnTextHighlighted: "#f9fafb",
    columnType: "#6b7280",
    columnHighlightBg: "#854d0e",
    relationshipLine: "#64748b",
    relationshipLineHighlighted: "#818cf8",
    canvasBg: "#0f172a",
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

interface DirectRelationships {
  table: TableNode;
  outgoing: TableRelationship[];
  incoming: TableRelationship[];
  relatedTables: TableNode[];
}

interface TableERDProps {
  tableName: string;
  onShowFullERD: () => void;
}

// Layout constants
const TABLE_WIDTH = 220;
const TABLE_HEADER_HEIGHT = 36;
const COLUMN_HEIGHT = 28;
const TABLE_PADDING = 12;
const HORIZONTAL_GAP = 100;
const VERTICAL_GAP = 40;

// Calculate table height based on columns (capped at 8 displayed)
const getTableHeight = (columnCount: number) =>
  TABLE_HEADER_HEIGHT +
  Math.min(columnCount, 8) * COLUMN_HEIGHT +
  TABLE_PADDING * 2 +
  (columnCount > 8 ? 20 : 0); // Add space for "more columns" indicator

interface TablePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function TableERD({ tableName, onShowFullERD }: TableERDProps) {
  const [data, setData] = useState<DirectRelationships | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<{
    table: string;
    column: string;
  } | null>(null);
  const [hoveredRelationship, setHoveredRelationship] =
    useState<TableRelationship | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Fetch direct relationships
  const fetchRelationships = useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError(null);
      try {
        // If force refresh, refresh the relationship cache first
        if (forceRefresh) {
          await fetch("/api/objects/relationships/refresh", { method: "POST" });
        }

        const response = await fetch(
          `/api/objects/tables/${encodeURIComponent(tableName)}/relationships`,
        );
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          // If table not found and we haven't tried refreshing, try once with refresh
          if (result.error?.includes("not found") && !forceRefresh) {
            return fetchRelationships(true);
          }
          setError(result.error || "Failed to fetch relationships");
        }
      } catch (err) {
        setError("Failed to fetch relationships");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [tableName],
  );

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  // Scroll to top-left when data loads to ensure tables are visible
  useEffect(() => {
    if (data && containerRef.current) {
      containerRef.current.scrollTo(0, 0);
    }
  }, [data]);

  // Calculate table positions
  const tablePositions = useMemo(() => {
    if (!data) return new Map<string, TablePosition>();

    const positions = new Map<string, TablePosition>();

    // Get incoming tables (left side)
    const incomingTables = [
      ...new Set(data.incoming.map((r) => r.fromTable)),
    ].filter((t) => t !== tableName);

    // Get outgoing tables (right side)
    const outgoingTables = [
      ...new Set(data.outgoing.map((r) => r.toTable)),
    ].filter((t) => t !== tableName);

    // Calculate center table position
    const centerTable = data.table;
    const centerHeight = getTableHeight(centerTable.columns.length);

    // Calculate max heights for each side to center the main table
    let leftMaxY = 0;
    incomingTables.forEach((name) => {
      const table = data.relatedTables.find((t) => t.name === name);
      if (table) {
        leftMaxY += getTableHeight(table.columns.length) + VERTICAL_GAP;
      }
    });

    let rightMaxY = 0;
    outgoingTables.forEach((name) => {
      const table = data.relatedTables.find((t) => t.name === name);
      if (table) {
        rightMaxY += getTableHeight(table.columns.length) + VERTICAL_GAP;
      }
    });

    const maxSideHeight = Math.max(leftMaxY, rightMaxY, centerHeight);
    const centerY = Math.max(20, (maxSideHeight - centerHeight) / 2);

    // Position center table
    const centerX =
      (incomingTables.length > 0 ? TABLE_WIDTH + HORIZONTAL_GAP : 0) + 20;
    positions.set(tableName, {
      x: centerX,
      y: centerY,
      width: TABLE_WIDTH,
      height: centerHeight,
    });

    // Position incoming tables (left side)
    let leftY =
      incomingTables.length > 1
        ? Math.max(20, (maxSideHeight - leftMaxY + VERTICAL_GAP) / 2)
        : centerY;
    incomingTables.forEach((name) => {
      const table = data.relatedTables.find((t) => t.name === name);
      if (table) {
        const height = getTableHeight(table.columns.length);
        positions.set(name, {
          x: 20,
          y: leftY,
          width: TABLE_WIDTH,
          height,
        });
        leftY += height + VERTICAL_GAP;
      }
    });

    // Position outgoing tables (right side)
    let rightY =
      outgoingTables.length > 1
        ? Math.max(20, (maxSideHeight - rightMaxY + VERTICAL_GAP) / 2)
        : centerY;
    const rightX = centerX + TABLE_WIDTH + HORIZONTAL_GAP;
    outgoingTables.forEach((name) => {
      const table = data.relatedTables.find((t) => t.name === name);
      if (table) {
        const height = getTableHeight(table.columns.length);
        positions.set(name, {
          x: rightX,
          y: rightY,
          width: TABLE_WIDTH,
          height,
        });
        rightY += height + VERTICAL_GAP;
      }
    });

    return positions;
  }, [data, tableName]);

  // Calculate SVG dimensions with proper bounding box
  const svgDimensions = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;
    tablePositions.forEach((pos) => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    });
    // Ensure minimum values are reasonable
    if (minX === Infinity) minX = 0;
    if (minY === Infinity) minY = 0;
    return {
      width: maxX + 40,
      height: maxY + 40,
      // Offset to shift content if tables start above expected position
      offsetX: Math.max(0, 20 - minX),
      offsetY: Math.max(0, 20 - minY),
    };
  }, [tablePositions]);

  // Get column Y position within a table
  const getColumnY = (tableName: string, columnName: string): number | null => {
    const pos = tablePositions.get(tableName);
    if (!pos) return null;

    let table: TableNode | undefined;
    if (tableName === data?.table.name) {
      table = data.table;
    } else {
      table = data?.relatedTables.find((t) => t.name === tableName);
    }
    if (!table) return null;

    const columnIndex = table.columns.findIndex((c) => c.name === columnName);
    if (columnIndex === -1) return null;

    return (
      pos.y +
      TABLE_HEADER_HEIGHT +
      TABLE_PADDING +
      columnIndex * COLUMN_HEIGHT +
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

  // Render a table box
  const renderTable = (table: TableNode, isCenter: boolean) => {
    const pos = tablePositions.get(table.name);
    if (!pos) return null;

    return (
      <g key={table.name}>
        {/* Table background */}
        <rect
          x={pos.x}
          y={pos.y}
          width={pos.width}
          height={pos.height}
          rx={6}
          fill={colors.tableBackground}
          stroke={isCenter ? colors.tableBorderCenter : colors.tableBorder}
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
          y={pos.y + TABLE_HEADER_HEIGHT / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isCenter ? colors.tableNameTextCenter : colors.tableNameText}
          className="text-sm font-semibold pointer-events-none"
        >
          {table.name.length > 24
            ? table.name.substring(0, 22) + "..."
            : table.name}
        </text>

        {/* Columns */}
        {table.columns.slice(0, 8).map((col, idx) => {
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
                  x={pos.x + 4}
                  y={colY}
                  width={pos.width - 8}
                  height={COLUMN_HEIGHT}
                  rx={4}
                  fill={colors.columnHighlightBg}
                />
              )}

              {/* Column icon */}
              {col.primaryKey && (
                <g
                  transform={`translate(${pos.x + 12}, ${colY + COLUMN_HEIGHT / 2 - 6})`}
                >
                  <Key className="w-3 h-3 text-yellow-500" />
                </g>
              )}
              {col.isForeignKey && !col.primaryKey && (
                <g
                  transform={`translate(${pos.x + 12}, ${colY + COLUMN_HEIGHT / 2 - 6})`}
                >
                  <Link2 className="w-3 h-3 text-blue-500" />
                </g>
              )}

              {/* Column name */}
              <text
                x={pos.x + (col.primaryKey || col.isForeignKey ? 30 : 12)}
                y={colY + COLUMN_HEIGHT / 2 + 1}
                dominantBaseline="middle"
                fill={
                  highlighted ? colors.columnTextHighlighted : colors.columnText
                }
                className={clsx(
                  "text-xs pointer-events-none",
                  highlighted && "font-medium",
                )}
              >
                {col.name.length > 18
                  ? col.name.substring(0, 16) + "..."
                  : col.name}
              </text>

              {/* Column type */}
              <text
                x={pos.x + pos.width - 12}
                y={colY + COLUMN_HEIGHT / 2 + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fill={colors.columnType}
                className="text-[10px] pointer-events-none"
              >
                {col.type.length > 10
                  ? col.type.substring(0, 8) + "..."
                  : col.type}
              </text>
            </g>
          );
        })}

        {/* More columns indicator */}
        {table.columns.length > 8 && (
          <text
            x={pos.x + pos.width / 2}
            y={
              pos.y +
              TABLE_HEADER_HEIGHT +
              TABLE_PADDING +
              8 * COLUMN_HEIGHT +
              10
            }
            textAnchor="middle"
            fill={colors.columnType}
            className="text-xs pointer-events-none"
          >
            +{table.columns.length - 8} more columns
          </text>
        )}
      </g>
    );
  };

  // Render relationship lines
  const renderRelationships = () => {
    if (!data) return null;

    const allRelationships = [...data.incoming, ...data.outgoing];

    return allRelationships.map((rel, idx) => {
      const fromPos = tablePositions.get(rel.fromTable);
      const toPos = tablePositions.get(rel.toTable);
      if (!fromPos || !toPos) return null;

      const fromY = getColumnY(rel.fromTable, rel.fromColumn);
      const toY = getColumnY(rel.toTable, rel.toColumn);
      if (fromY === null || toY === null) return null;

      const highlighted = isRelationshipHighlighted(rel);

      // Determine if line goes left-to-right or right-to-left
      const isLeftToRight = fromPos.x < toPos.x;
      const startX = isLeftToRight ? fromPos.x + fromPos.width : fromPos.x;
      const endX = isLeftToRight ? toPos.x : toPos.x + toPos.width;

      // Create curved path
      const midX = (startX + endX) / 2;
      const path = `M ${startX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${endX} ${toY}`;

      return (
        <g
          key={`${rel.fromTable}-${rel.fromColumn}-${rel.toTable}-${rel.toColumn}-${idx}`}
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
            stroke={
              highlighted
                ? colors.relationshipLineHighlighted
                : colors.relationshipLine
            }
            strokeWidth={highlighted ? 2.5 : 1.5}
            markerEnd={
              highlighted ? "url(#arrowhead-highlighted)" : "url(#arrowhead)"
            }
          />

          {/* Relationship cardinality indicators */}
          {highlighted && (
            <>
              {/* From side (many) */}
              <circle
                cx={startX + (isLeftToRight ? 10 : -10)}
                cy={fromY}
                r={4}
                fill={colors.relationshipLineHighlighted}
              />
              <circle
                cx={startX + (isLeftToRight ? 18 : -18)}
                cy={fromY - 4}
                r={2}
                fill={colors.relationshipLineHighlighted}
              />
              <circle
                cx={startX + (isLeftToRight ? 18 : -18)}
                cy={fromY + 4}
                r={2}
                fill={colors.relationshipLineHighlighted}
              />
            </>
          )}
        </g>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">
          Loading relationships...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p className="mb-2">{error}</p>
        <button
          onClick={() => fetchRelationships()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-700 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        No relationship data available
      </div>
    );
  }

  const hasRelationships = data.incoming.length > 0 || data.outgoing.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* ERD Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <ArrowLeft className="w-4 h-4 text-blue-500" />
            <span>{data.incoming.length} incoming</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span>{data.outgoing.length} outgoing</span>
            <ArrowRight className="w-4 h-4 text-green-500" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRelationships()}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
            title="Refresh relationships"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onShowFullERD}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/50 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors"
            title="View full relationship cluster"
          >
            <Maximize2 className="w-4 h-4" />
            Full ERD
          </button>
        </div>
      </div>

      {/* ERD Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto min-h-0"
        style={{ backgroundColor: colors.canvasBg }}
      >
        {hasRelationships ? (
          <svg
            width={Math.max(svgDimensions.width + svgDimensions.offsetX, 500)}
            height={Math.max(svgDimensions.height + svgDimensions.offsetY, 300)}
            className="min-w-full"
          >
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
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill={colors.relationshipLine}
                />
              </marker>
              <marker
                id="arrowhead-highlighted"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill={colors.relationshipLineHighlighted}
                />
              </marker>
            </defs>

            {/* Apply offset transform to ensure all content is visible */}
            <g
              transform={`translate(${svgDimensions.offsetX}, ${svgDimensions.offsetY})`}
            >
              {/* Render relationships first (behind tables) */}
              {renderRelationships()}

              {/* Render related tables */}
              {data.relatedTables.map((table) => renderTable(table, false))}

              {/* Render center table last (on top) */}
              {renderTable(data.table, true)}
            </g>
          </svg>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Link2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-lg font-medium">No relationships</p>
            <p className="text-sm">
              This table has no foreign key relationships
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
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
          <span>References</span>
        </div>
        <span className="ml-auto text-gray-400 dark:text-gray-500">
          Hover over columns or lines to highlight relationships
        </span>
      </div>
    </div>
  );
}
