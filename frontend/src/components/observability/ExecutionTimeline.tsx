/**
 * ExecutionTimeline - Gantt-style visualization of execution phases and tasks
 */

import { useState, useMemo, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  Download,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { useTranscript, useToolUses } from "../../hooks/useObservability";
import type {
  TranscriptEntry,
  ToolUse,
  TranscriptEntryType,
} from "../../types/observability";

interface ExecutionTimelineProps {
  executionId: string;
  onEntryClick?: (entry: TranscriptEntry) => void;
  onToolUseClick?: (toolUse: ToolUse) => void;
}

interface TimelineTask {
  id: string;
  taskId: string | null;
  label: string;
  startTime: Date;
  endTime: Date | null;
  status: "running" | "completed" | "failed";
  entries: TranscriptEntry[];
  toolUses: ToolUse[];
}

// Color mapping for entry types
const entryTypeColors: Partial<Record<TranscriptEntryType, string>> = {
  phase_start: "bg-blue-200",
  phase_end: "bg-blue-300",
  task_start: "bg-green-200",
  task_end: "bg-green-300",
  tool_use: "bg-purple-200",
  skill_invoke: "bg-indigo-200",
  assertion: "bg-yellow-200",
  error: "bg-red-300",
  discovery: "bg-teal-200",
  checkpoint: "bg-gray-200",
};

export default function ExecutionTimeline({
  executionId,
  onEntryClick,
  onToolUseClick,
}: ExecutionTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [hoveredEntry, setHoveredEntry] = useState<TranscriptEntry | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const { entries, loading: entriesLoading } = useTranscript(executionId, {
    limit: 500,
  });
  const { toolUses, loading: toolUsesLoading } = useToolUses(executionId, {
    limit: 500,
  });

  const loading = entriesLoading || toolUsesLoading;

  // Process entries into timeline tasks
  const { tasks, timeRange, phases } = useMemo(() => {
    if (entries.length === 0) {
      return {
        tasks: [],
        timeRange: { start: new Date(), end: new Date() },
        phases: [],
      };
    }

    const taskMap = new Map<string, TimelineTask>();
    const phaseList: Array<{
      name: string;
      startTime: Date;
      endTime: Date | null;
    }> = [];

    let minTime = new Date(entries[0].timestamp);
    let maxTime = new Date(entries[0].timestamp);
    let currentPhase: string | null = null;
    let phaseStart: Date | null = null;

    entries.forEach((entry) => {
      const entryTime = new Date(entry.timestamp);
      if (entryTime < minTime) minTime = entryTime;
      if (entryTime > maxTime) maxTime = entryTime;

      // Track phases
      if (entry.entryType === "phase_start") {
        if (currentPhase && phaseStart) {
          phaseList.push({
            name: currentPhase,
            startTime: phaseStart,
            endTime: entryTime,
          });
        }
        currentPhase = entry.summary;
        phaseStart = entryTime;
      } else if (
        entry.entryType === "phase_end" &&
        currentPhase &&
        phaseStart
      ) {
        phaseList.push({
          name: currentPhase,
          startTime: phaseStart,
          endTime: entryTime,
        });
        currentPhase = null;
        phaseStart = null;
      }

      // Group by task
      const taskKey = entry.taskId || "global";
      if (!taskMap.has(taskKey)) {
        taskMap.set(taskKey, {
          id: taskKey,
          taskId: entry.taskId,
          label: entry.taskId ? `Task ${entry.taskId.slice(0, 8)}` : "Global",
          startTime: entryTime,
          endTime: null,
          status: "running",
          entries: [],
          toolUses: [],
        });
      }

      const task = taskMap.get(taskKey)!;
      task.entries.push(entry);

      if (entry.entryType === "task_end") {
        task.endTime = entryTime;
        task.status = "completed";
      } else if (entry.entryType === "error") {
        task.status = "failed";
      }
    });

    // Add tool uses to tasks
    toolUses.forEach((tu) => {
      const taskKey = tu.taskId || "global";
      const task = taskMap.get(taskKey);
      if (task) {
        task.toolUses.push(tu);
      }
    });

    // Close any open phase
    if (currentPhase && phaseStart) {
      phaseList.push({
        name: currentPhase,
        startTime: phaseStart,
        endTime: maxTime,
      });
    }

    return {
      tasks: Array.from(taskMap.values()).sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime(),
      ),
      timeRange: { start: minTime, end: maxTime },
      phases: phaseList,
    };
  }, [entries, toolUses]);

  // Calculate timeline dimensions
  const duration = timeRange.end.getTime() - timeRange.start.getTime();
  const msPerPixel = duration / (800 * zoom);

  const getPosition = (time: Date) => {
    return (time.getTime() - timeRange.start.getTime()) / msPerPixel;
  };

  const getWidth = (start: Date, end: Date | null) => {
    const endTime = end || timeRange.end;
    return Math.max((endTime.getTime() - start.getTime()) / msPerPixel, 4);
  };

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleExportJSON = () => {
    const data = { entries, toolUses, tasks, phases };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `execution-${executionId}-timeline.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-32 bg-gray-100 rounded" />
        <div className="h-24 bg-gray-100 rounded" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Clock className="h-12 w-12 mb-4" />
        <p>No timeline data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded hover:bg-gray-200"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600 w-16 text-center">
            {(zoom * 100).toFixed(0)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="p-1.5 rounded hover:bg-gray-200"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={handleExportJSON}
          className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-200"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max" style={{ width: `${800 * zoom}px` }}>
          {/* Phase bars */}
          {phases.length > 0 && (
            <div className="relative h-8 border-b bg-gray-50">
              {phases.map((phase, idx) => (
                <div
                  key={idx}
                  className="absolute top-1 h-6 bg-blue-100 border border-blue-300 rounded text-xs flex items-center px-2 overflow-hidden"
                  style={{
                    left: getPosition(phase.startTime),
                    width: getWidth(phase.startTime, phase.endTime),
                  }}
                  title={phase.name}
                >
                  <span className="truncate">{phase.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Task rows */}
          {tasks.map((task) => {
            const isExpanded = expandedTasks.has(task.id);
            const StatusIcon =
              task.status === "completed"
                ? CheckCircle
                : task.status === "failed"
                  ? XCircle
                  : Clock;
            const statusColor =
              task.status === "completed"
                ? "text-green-500"
                : task.status === "failed"
                  ? "text-red-500"
                  : "text-blue-500";

            return (
              <div key={task.id} className="border-b">
                <div className="flex items-stretch">
                  <div
                    className="flex items-center gap-2 w-48 px-3 py-2 border-r bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleTask(task.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                    <span className="text-sm font-medium truncate">
                      {task.label}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {task.entries.length}
                    </span>
                  </div>
                  <div className="flex-1 relative h-10 bg-gray-50">
                    <div
                      className={`absolute top-2 h-6 rounded border cursor-pointer hover:opacity-80 ${
                        task.status === "completed"
                          ? "bg-green-200 border-green-400"
                          : task.status === "failed"
                            ? "bg-red-200 border-red-400"
                            : "bg-blue-200 border-blue-400"
                      }`}
                      style={{
                        left: getPosition(task.startTime),
                        width: getWidth(task.startTime, task.endTime),
                      }}
                      onClick={() => onEntryClick?.(task.entries[0])}
                    />
                    {task.entries
                      .filter((e) => e.entryType === "error")
                      .map((entry, idx) => (
                        <div
                          key={idx}
                          className="absolute top-1 h-8 w-1 bg-red-500 cursor-pointer"
                          style={{
                            left: getPosition(new Date(entry.timestamp)),
                          }}
                          title={entry.summary}
                          onClick={() => onEntryClick?.(entry)}
                        />
                      ))}
                  </div>
                </div>
                {isExpanded && (
                  <div className="bg-white">
                    {task.toolUses.length > 0 && (
                      <div className="flex items-stretch border-t">
                        <div className="w-48 px-6 py-1.5 border-r text-xs text-gray-500">
                          Tool Uses ({task.toolUses.length})
                        </div>
                        <div className="flex-1 relative h-6">
                          {task.toolUses.map((tu) => (
                            <div
                              key={tu.id}
                              className={`absolute top-0.5 h-5 rounded cursor-pointer hover:opacity-80 ${tu.isError ? "bg-red-300" : tu.isBlocked ? "bg-orange-300" : "bg-purple-200"}`}
                              style={{
                                left: getPosition(new Date(tu.startTime)),
                                width: Math.max(
                                  (tu.durationMs || 100) / msPerPixel,
                                  4,
                                ),
                              }}
                              title={`${tu.tool}: ${tu.inputSummary}`}
                              onClick={() => onToolUseClick?.(tu)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-stretch border-t">
                      <div className="w-48 px-6 py-1.5 border-r text-xs text-gray-500">
                        Entries
                      </div>
                      <div className="flex-1 relative h-6">
                        {task.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className={`absolute top-1 w-2 h-4 rounded-sm cursor-pointer hover:ring-2 hover:ring-blue-500 ${entryTypeColors[entry.entryType] || "bg-gray-200"}`}
                            style={{
                              left: getPosition(new Date(entry.timestamp)),
                            }}
                            title={`${entry.entryType}: ${entry.summary}`}
                            onClick={() => onEntryClick?.(entry)}
                            onMouseEnter={() => setHoveredEntry(entry)}
                            onMouseLeave={() => setHoveredEntry(null)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {hoveredEntry && (
        <div className="fixed bottom-4 right-4 bg-white border rounded-lg shadow-lg p-3 max-w-sm z-50">
          <div className="text-xs text-gray-500 mb-1">
            {hoveredEntry.entryType}
          </div>
          <div className="text-sm font-medium">{hoveredEntry.summary}</div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(hoveredEntry.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

export function ToolDensityChart({
  executionId,
  height = 40,
}: {
  executionId: string;
  height?: number;
}) {
  const { toolUses } = useToolUses(executionId, { limit: 500 });

  const bins = useMemo(() => {
    if (toolUses.length === 0) return [];
    const times = toolUses.map((tu) => new Date(tu.startTime).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const binCount = 50;
    const binSize = (maxTime - minTime) / binCount;
    const binCounts = new Array(binCount).fill(0);
    times.forEach((t) => {
      const binIdx = Math.min(
        Math.floor((t - minTime) / binSize),
        binCount - 1,
      );
      binCounts[binIdx]++;
    });
    const maxCount = Math.max(...binCounts);
    return binCounts.map((c) => (maxCount > 0 ? c / maxCount : 0));
  }, [toolUses]);

  if (bins.length === 0) return null;

  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {bins.map((ratio, idx) => (
        <div
          key={idx}
          className="flex-1 bg-purple-400 rounded-t"
          style={{ height: `${ratio * 100}%`, minHeight: ratio > 0 ? 2 : 0 }}
        />
      ))}
    </div>
  );
}
