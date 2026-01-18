/**
 * ToolUseHeatMap - Tool × Time matrix visualization
 *
 * Features:
 * - Grid cells for tool × time interval
 * - Color coding for intensity and errors
 * - Hover tooltip with detailed info
 * - Summary row showing totals per interval
 * - Summary column showing totals per tool
 * - Anomaly highlighting
 * - Click to drill down
 */

import { useMemo, useState, useCallback } from "react";
import { useToolUses, useToolSummary } from "../../hooks/useObservability";
import type { ToolUse } from "../../types/observability";

interface ToolUseHeatMapProps {
  executionId: string;
  onCellClick?: (toolUses: ToolUse[]) => void;
  showSummary?: boolean;
}

const INTERVAL_MINUTES = 5;

// Detailed tooltip component
interface TooltipData {
  tool: string;
  interval: number;
  intervalStart: Date;
  intervalEnd: Date;
  count: number;
  errors: number;
  blocked: number;
  avgDuration: number;
  toolUses: ToolUse[];
}

function CellTooltip({
  data,
  position,
}: {
  data: TooltipData | null;
  position: { x: number; y: number };
}) {
  if (!data) return null;

  return (
    <div
      className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 max-w-xs pointer-events-none"
      style={{
        left: position.x + 10,
        top: position.y + 10,
      }}
    >
      <div className="font-medium text-sm mb-2">{data.tool}</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400">Time:</span>
          <span>
            {data.intervalStart.toLocaleTimeString()} -{" "}
            {data.intervalEnd.toLocaleTimeString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Calls:</span>
          <span className="font-medium">{data.count}</span>
        </div>
        {data.errors > 0 && (
          <div className="flex justify-between text-red-400">
            <span>Errors:</span>
            <span className="font-medium">{data.errors}</span>
          </div>
        )}
        {data.blocked > 0 && (
          <div className="flex justify-between text-orange-400">
            <span>Blocked:</span>
            <span className="font-medium">{data.blocked}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400">Avg Duration:</span>
          <span>{data.avgDuration.toFixed(0)}ms</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400">
        Click to view details
      </div>
    </div>
  );
}

export default function ToolUseHeatMap({
  executionId,
  onCellClick,
  showSummary = true,
}: ToolUseHeatMapProps) {
  const { toolUses, loading } = useToolUses(executionId, { limit: 1000 });
  const { summary } = useToolSummary(executionId);
  const [hoveredCell, setHoveredCell] = useState<{
    tool: string;
    interval: number;
  } | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Handle mouse move for tooltip positioning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Build heat map data
  const {
    grid,
    tools,
    intervals,
    maxCount,
    anomalies,
    toolSummaries,
    intervalSummaries,
  } = useMemo(() => {
    if (toolUses.length === 0) {
      return {
        grid: new Map(),
        tools: [],
        intervals: [],
        maxCount: 0,
        anomalies: [],
        toolSummaries: new Map(),
        intervalSummaries: new Map(),
      };
    }

    const times = toolUses.map((tu) => new Date(tu.startTime).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const intervalMs = INTERVAL_MINUTES * 60 * 1000;

    // Create intervals
    const intervalCount = Math.ceil((maxTime - minTime) / intervalMs) + 1;
    const intervalList = Array.from({ length: intervalCount }, (_, i) => ({
      index: i,
      start: new Date(minTime + i * intervalMs),
      end: new Date(minTime + (i + 1) * intervalMs),
    }));

    // Get unique tools
    const toolSet = new Set(toolUses.map((tu) => tu.tool));
    const toolList = Array.from(toolSet).sort();

    // Build grid: Map<"tool-interval", { count, errors, blocked, toolUses, totalDuration }>
    const gridMap = new Map<
      string,
      {
        count: number;
        errors: number;
        blocked: number;
        toolUses: ToolUse[];
        totalDuration: number;
      }
    >();
    let maxCellCount = 0;

    // Summary maps
    const toolTotals = new Map<
      string,
      { count: number; errors: number; blocked: number }
    >();
    const intervalTotals = new Map<
      number,
      { count: number; errors: number; blocked: number }
    >();

    toolUses.forEach((tu) => {
      const intervalIdx = Math.floor(
        (new Date(tu.startTime).getTime() - minTime) / intervalMs,
      );
      const key = `${tu.tool}-${intervalIdx}`;

      if (!gridMap.has(key)) {
        gridMap.set(key, {
          count: 0,
          errors: 0,
          blocked: 0,
          toolUses: [],
          totalDuration: 0,
        });
      }
      const cell = gridMap.get(key)!;
      cell.count++;
      cell.totalDuration += tu.durationMs || 0;
      if (tu.isError) cell.errors++;
      if (tu.isBlocked) cell.blocked++;
      cell.toolUses.push(tu);
      if (cell.count > maxCellCount) maxCellCount = cell.count;

      // Update tool summary
      if (!toolTotals.has(tu.tool)) {
        toolTotals.set(tu.tool, { count: 0, errors: 0, blocked: 0 });
      }
      const toolTotal = toolTotals.get(tu.tool)!;
      toolTotal.count++;
      if (tu.isError) toolTotal.errors++;
      if (tu.isBlocked) toolTotal.blocked++;

      // Update interval summary
      if (!intervalTotals.has(intervalIdx)) {
        intervalTotals.set(intervalIdx, { count: 0, errors: 0, blocked: 0 });
      }
      const intervalTotal = intervalTotals.get(intervalIdx)!;
      intervalTotal.count++;
      if (tu.isError) intervalTotal.errors++;
      if (tu.isBlocked) intervalTotal.blocked++;
    });

    // Detect anomalies (cells with unusually high activity or error rates)
    const anomalyList: Array<{
      tool: string;
      interval: number;
      reason: string;
    }> = [];
    const avgPerCell = toolUses.length / (toolList.length * intervalCount);
    gridMap.forEach((cell, key) => {
      const [tool, interval] = key.split("-");
      if (cell.count > avgPerCell * 3) {
        anomalyList.push({
          tool,
          interval: parseInt(interval),
          reason: "High activity",
        });
      }
      if (cell.errors > 0 && cell.errors / cell.count > 0.5) {
        anomalyList.push({
          tool,
          interval: parseInt(interval),
          reason: "High error rate",
        });
      }
    });

    return {
      grid: gridMap,
      tools: toolList,
      intervals: intervalList,
      maxCount: maxCellCount,
      anomalies: anomalyList,
      toolSummaries: toolTotals,
      intervalSummaries: intervalTotals,
    };
  }, [toolUses]);

  // Handle cell hover
  const handleCellHover = useCallback(
    (tool: string, intervalIdx: number, e: React.MouseEvent) => {
      setHoveredCell({ tool, interval: intervalIdx });
      setTooltipPosition({ x: e.clientX, y: e.clientY });

      const key = `${tool}-${intervalIdx}`;
      const cell = grid.get(key);
      const interval = intervals[intervalIdx];

      if (cell && interval) {
        const avgDuration =
          cell.count > 0 ? cell.totalDuration / cell.count : 0;
        setTooltipData({
          tool,
          interval: intervalIdx,
          intervalStart: interval.start,
          intervalEnd: interval.end,
          count: cell.count,
          errors: cell.errors,
          blocked: cell.blocked,
          avgDuration,
          toolUses: cell.toolUses,
        });
      } else {
        setTooltipData(null);
      }
    },
    [grid, intervals],
  );

  const handleCellLeave = useCallback(() => {
    setHoveredCell(null);
    setTooltipData(null);
  }, []);

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded" />;
  }

  if (tools.length === 0) {
    return <div className="p-4 text-gray-500">No tool use data available</div>;
  }

  const getCellColor = (count: number, errors: number, blocked: number) => {
    if (count === 0) return "bg-gray-50";
    if (blocked > 0) return "bg-orange-200";
    if (errors > 0) return "bg-red-200";
    const intensity = Math.min((count / maxCount) * 100, 100);
    if (intensity < 25) return "bg-green-100";
    if (intensity < 50) return "bg-green-200";
    if (intensity < 75) return "bg-green-300";
    return "bg-green-400";
  };

  return (
    <div className="space-y-4 p-4">
      {/* Summary */}
      {summary && (
        <div className="flex gap-4 text-sm">
          <span className="text-gray-600">
            Total: <strong>{summary.total}</strong>
          </span>
          <span className="text-red-600">
            Errors: <strong>{summary.byStatus?.error ?? 0}</strong>
          </span>
          <span className="text-orange-600">
            Blocked: <strong>{summary.byStatus?.blocked ?? 0}</strong>
          </span>
        </div>
      )}

      {/* Heat map grid */}
      <div className="overflow-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="p-1 text-xs font-medium text-gray-500 text-left w-24">
                Tool
              </th>
              {intervals.map((interval) => (
                <th
                  key={interval.index}
                  className="p-1 text-xs font-medium text-gray-500 text-center w-8"
                  title={interval.start.toLocaleTimeString()}
                >
                  {interval.index}
                </th>
              ))}
              {showSummary && (
                <th className="p-1 text-xs font-medium text-gray-500 text-center w-12">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool}>
                <td className="p-1 text-xs text-gray-700 truncate" title={tool}>
                  {tool}
                </td>
                {intervals.map((interval) => {
                  const key = `${tool}-${interval.index}`;
                  const cell = grid.get(key) || {
                    count: 0,
                    errors: 0,
                    blocked: 0,
                    toolUses: [],
                    totalDuration: 0,
                  };
                  const isHovered =
                    hoveredCell?.tool === tool &&
                    hoveredCell?.interval === interval.index;
                  const isAnomaly = anomalies.some(
                    (a) => a.tool === tool && a.interval === interval.index,
                  );

                  return (
                    <td
                      key={key}
                      className={`p-0.5 cursor-pointer transition-all ${isHovered ? "ring-2 ring-blue-500" : ""}`}
                      onMouseEnter={(e) =>
                        handleCellHover(tool, interval.index, e)
                      }
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleCellLeave}
                      onClick={() =>
                        cell.count > 0 && onCellClick?.(cell.toolUses)
                      }
                    >
                      <div
                        className={`w-6 h-6 rounded ${getCellColor(cell.count, cell.errors, cell.blocked)} ${isAnomaly ? "ring-2 ring-yellow-500" : ""}`}
                      >
                        {cell.count > 0 && (
                          <span className="text-[10px] flex items-center justify-center h-full">
                            {cell.count}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
                {/* Tool summary column */}
                {showSummary && (
                  <td className="p-0.5">
                    <div className="w-12 h-6 rounded bg-blue-50 flex items-center justify-center">
                      <span className="text-[10px] font-medium text-blue-700">
                        {toolSummaries.get(tool)?.count ?? 0}
                      </span>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {/* Summary row */}
            {showSummary && (
              <tr className="border-t-2 border-gray-300">
                <td className="p-1 text-xs font-medium text-gray-700">Total</td>
                {intervals.map((interval) => {
                  const total = intervalSummaries.get(interval.index);
                  return (
                    <td key={interval.index} className="p-0.5">
                      <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-gray-700">
                          {total?.count ?? 0}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="p-0.5">
                  <div className="w-12 h-6 rounded bg-blue-100 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-800">
                      {toolUses.length}
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      <CellTooltip data={tooltipData} position={tooltipPosition} />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-500">Intensity:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-gray-50" /> Low
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-200" /> Medium
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-400" /> High
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-200" /> Errors
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-orange-200" /> Blocked
        </div>
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">
            Anomalies Detected ({anomalies.length})
          </h4>
          <ul className="text-xs text-yellow-700 space-y-1">
            {anomalies.slice(0, 5).map((a, i) => (
              <li key={i}>
                {a.tool} at interval {a.interval}: {a.reason}
              </li>
            ))}
            {anomalies.length > 5 && (
              <li>...and {anomalies.length - 5} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
