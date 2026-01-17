/**
 * ConflictMatrix Component
 *
 * Shows NxN matrix of task conflicts for debugging parallel execution.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { useState } from "react";
import { Check, X, AlertTriangle } from "lucide-react";
import type { Conflict } from "../../types/pipeline";

interface TaskInfo {
  id: string;
  displayId?: string;
  title: string;
}

interface ConflictMatrixProps {
  tasks: TaskInfo[];
  conflicts: Conflict[];
  onCellClick?: (taskA: string, taskB: string) => void;
}

export default function ConflictMatrix({
  tasks,
  conflicts,
  onCellClick,
}: ConflictMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    row: string;
    col: string;
  } | null>(null);
  const [tooltipConflict, setTooltipConflict] = useState<Conflict | null>(null);

  // Build conflict lookup map
  const conflictMap = new Map<string, Conflict>();
  conflicts.forEach((c) => {
    conflictMap.set(`${c.taskAId}-${c.taskBId}`, c);
    conflictMap.set(`${c.taskBId}-${c.taskAId}`, c);
  });

  const getConflict = (taskAId: string, taskBId: string): Conflict | null => {
    return conflictMap.get(`${taskAId}-${taskBId}`) || null;
  };

  const isHighlighted = (taskId: string): boolean => {
    if (!hoveredCell) return false;
    return hoveredCell.row === taskId || hoveredCell.col === taskId;
  };

  if (tasks.length === 0) {
    return (
      <div
        data-testid="conflict-matrix"
        className="p-4 bg-gray-800/30 rounded-lg border border-gray-700"
      >
        <div className="text-center py-8">
          <AlertTriangle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">No tasks to analyze</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="conflict-matrix"
      className="p-4 bg-gray-800/30 rounded-lg border border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-300">Conflict Matrix</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <X className="w-3 h-3 text-red-400" />
            <span className="text-gray-400">Conflict</span>
          </div>
          <div className="flex items-center gap-1">
            <Check className="w-3 h-3 text-green-400" />
            <span className="text-gray-400">Compatible</span>
          </div>
        </div>
      </div>

      {/* Matrix grid */}
      <div className="overflow-x-auto">
        <div
          data-testid="conflict-matrix-grid"
          className="inline-block min-w-full"
        >
          <table className="border-collapse">
            {/* Column headers */}
            <thead>
              <tr>
                <th className="w-24 p-2" />
                {tasks.map((task) => (
                  <th
                    key={task.id}
                    className={`
                      p-2 text-xs font-mono
                      ${isHighlighted(task.id) ? "bg-blue-900/30" : ""}
                      transition-colors duration-150
                    `}
                  >
                    <div
                      className="w-16 truncate transform -rotate-45 origin-left translate-y-4"
                      title={task.title}
                    >
                      {task.displayId || task.id.slice(0, 8)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Matrix rows */}
            <tbody>
              {tasks.map((rowTask) => (
                <tr key={rowTask.id}>
                  {/* Row header */}
                  <td
                    className={`
                      p-2 text-xs font-mono text-right
                      ${isHighlighted(rowTask.id) ? "bg-blue-900/30" : ""}
                      transition-colors duration-150
                    `}
                  >
                    <div className="truncate w-24" title={rowTask.title}>
                      {rowTask.displayId || rowTask.id.slice(0, 8)}
                    </div>
                  </td>

                  {/* Matrix cells */}
                  {tasks.map((colTask) => {
                    const isSelf = rowTask.id === colTask.id;
                    const conflict = !isSelf
                      ? getConflict(rowTask.id, colTask.id)
                      : null;
                    const hasConflict = !!conflict;
                    const isCellHovered =
                      hoveredCell?.row === rowTask.id &&
                      hoveredCell?.col === colTask.id;

                    return (
                      <td
                        key={colTask.id}
                        data-testid={`conflict-cell-${hasConflict ? "conflict" : "compatible"}`}
                        className={`
                          w-8 h-8 p-0 border border-gray-700
                          ${isSelf ? "bg-gray-700" : ""}
                          ${!isSelf && hasConflict ? "bg-red-900/30 hover:bg-red-900/50" : ""}
                          ${!isSelf && !hasConflict ? "bg-green-900/20 hover:bg-green-900/40" : ""}
                          ${isHighlighted(rowTask.id) || isHighlighted(colTask.id) ? "ring-1 ring-blue-500/50" : ""}
                          ${isCellHovered ? "ring-2 ring-blue-400" : ""}
                          cursor-pointer
                          transition-all duration-150
                          relative
                        `}
                        onMouseEnter={() => {
                          setHoveredCell({ row: rowTask.id, col: colTask.id });
                          if (conflict) setTooltipConflict(conflict);
                        }}
                        onMouseLeave={() => {
                          setHoveredCell(null);
                          setTooltipConflict(null);
                        }}
                        onClick={() =>
                          !isSelf && onCellClick?.(rowTask.id, colTask.id)
                        }
                      >
                        <div className="flex items-center justify-center h-full">
                          {isSelf ? (
                            <span className="text-gray-600">-</span>
                          ) : hasConflict ? (
                            <X className="w-4 h-4 text-red-400" />
                          ) : (
                            <Check className="w-4 h-4 text-green-400" />
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
      </div>

      {/* Conflict tooltip */}
      {tooltipConflict && (
        <div
          data-testid="conflict-reason-tooltip"
          className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-red-300 mb-1">
                {tooltipConflict.taskADisplayId ||
                  tooltipConflict.taskAId.slice(0, 8)}{" "}
                ✗{" "}
                {tooltipConflict.taskBDisplayId ||
                  tooltipConflict.taskBId.slice(0, 8)}
              </div>
              <div className="text-gray-300">{tooltipConflict.details}</div>
              {tooltipConflict.filePath && (
                <div className="text-gray-500 mt-1 font-mono text-xs">
                  File: {tooltipConflict.filePath}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          Hover over cells to see conflict details. Tasks with ✗ cannot run in
          parallel.
        </p>
      </div>
    </div>
  );
}
