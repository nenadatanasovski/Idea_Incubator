/**
 * ToolUseHeatMap - Tool × Time matrix visualization
 */

import { useMemo, useState } from "react";
import { useToolUses, useToolSummary } from "../../hooks/useObservability";
import type { ToolUse } from "../../types/observability";

interface ToolUseHeatMapProps {
  executionId: string;
  onCellClick?: (toolUses: ToolUse[]) => void;
}

const INTERVAL_MINUTES = 5;

export default function ToolUseHeatMap({
  executionId,
  onCellClick,
}: ToolUseHeatMapProps) {
  const { toolUses, loading } = useToolUses(executionId, { limit: 1000 });
  const { summary } = useToolSummary(executionId);
  const [hoveredCell, setHoveredCell] = useState<{
    tool: string;
    interval: number;
  } | null>(null);

  // Build heat map data
  const { grid, tools, intervals, maxCount, anomalies } = useMemo(() => {
    if (toolUses.length === 0) {
      return {
        grid: new Map(),
        tools: [],
        intervals: [],
        maxCount: 0,
        anomalies: [],
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

    // Build grid: Map<"tool-interval", { count, errors, blocked, toolUses }>
    const gridMap = new Map<
      string,
      { count: number; errors: number; blocked: number; toolUses: ToolUse[] }
    >();
    let maxCellCount = 0;

    toolUses.forEach((tu) => {
      const intervalIdx = Math.floor(
        (new Date(tu.startTime).getTime() - minTime) / intervalMs,
      );
      const key = `${tu.tool}-${intervalIdx}`;

      if (!gridMap.has(key)) {
        gridMap.set(key, { count: 0, errors: 0, blocked: 0, toolUses: [] });
      }
      const cell = gridMap.get(key)!;
      cell.count++;
      if (tu.isError) cell.errors++;
      if (tu.isBlocked) cell.blocked++;
      cell.toolUses.push(tu);
      if (cell.count > maxCellCount) maxCellCount = cell.count;
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
    };
  }, [toolUses]);

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
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool}>
                <td className="p-1 text-xs text-gray-700 truncate">{tool}</td>
                {intervals.map((interval) => {
                  const key = `${tool}-${interval.index}`;
                  const cell = grid.get(key) || {
                    count: 0,
                    errors: 0,
                    blocked: 0,
                    toolUses: [],
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
                      onMouseEnter={() =>
                        setHoveredCell({ tool, interval: interval.index })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() =>
                        cell.count > 0 && onCellClick?.(cell.toolUses)
                      }
                    >
                      <div
                        className={`w-6 h-6 rounded ${getCellColor(cell.count, cell.errors, cell.blocked)} ${isAnomaly ? "ring-2 ring-yellow-500" : ""}`}
                        title={`${cell.count} calls`}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
