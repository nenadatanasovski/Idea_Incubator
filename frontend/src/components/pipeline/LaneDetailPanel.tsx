/**
 * LaneDetailPanel Component
 *
 * Slide-out panel showing full lane context and task history.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import {
  X,
  Database,
  Code2,
  Server,
  Layout,
  TestTube2,
  Settings,
  Clock,
  FileCode,
  Check,
  AlertTriangle,
  Play,
} from "lucide-react";
import type { Lane, LaneTask, LaneCategory } from "../../types/pipeline";
import { LANE_CATEGORY_CONFIG, TASK_STATUS_CONFIG } from "../../types/pipeline";
import AgentBadge from "./AgentBadge";
import BlockedIndicator from "./BlockedIndicator";

interface LaneDetailPanelProps {
  lane: Lane;
  onClose: () => void;
  onTaskClick?: (task: LaneTask) => void;
}

const CategoryIcon = ({ category }: { category: LaneCategory }) => {
  const iconClass = "w-5 h-5";
  switch (category) {
    case "database":
      return <Database className={iconClass} />;
    case "types":
      return <Code2 className={iconClass} />;
    case "api":
      return <Server className={iconClass} />;
    case "ui":
      return <Layout className={iconClass} />;
    case "tests":
      return <TestTube2 className={iconClass} />;
    case "infrastructure":
      return <Settings className={iconClass} />;
    default:
      return <Code2 className={iconClass} />;
  }
};

export default function LaneDetailPanel({
  lane,
  onClose,
  onTaskClick,
}: LaneDetailPanelProps) {
  const config = LANE_CATEGORY_CONFIG[lane.category as LaneCategory];

  // Group tasks by wave
  const tasksByWave = lane.tasks.reduce(
    (acc, task) => {
      const wave = task.waveNumber;
      if (!acc[wave]) acc[wave] = [];
      acc[wave].push(task);
      return acc;
    },
    {} as Record<number, LaneTask[]>,
  );

  const waveNumbers = Object.keys(tasksByWave)
    .map(Number)
    .sort((a, b) => a - b);

  // Calculate timing analytics
  const completedTasks = lane.tasks.filter((t) => t.status === "complete");
  const totalDuration = completedTasks.reduce(
    (sum, t) => sum + (t.durationMs || 0),
    0,
  );
  const avgDuration =
    completedTasks.length > 0 ? totalDuration / completedTasks.length : 0;

  const getWaveStatus = (
    waveNum: number,
  ): "pending" | "active" | "complete" => {
    const waveTasks = tasksByWave[waveNum];
    if (!waveTasks || waveTasks.length === 0) return "pending";
    const allComplete = waveTasks.every((t) => t.status === "complete");
    const hasRunning = waveTasks.some((t) => t.status === "running");
    if (allComplete) return "complete";
    if (hasRunning) return "active";
    return "pending";
  };

  return (
    <div
      data-testid="lane-detail-panel"
      className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col"
    >
      {/* Header */}
      <div
        className={`p-4 border-b border-gray-200 ${config?.bgColor || "bg-gray-50"}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={config?.color || "text-gray-600"}>
              <CategoryIcon category={lane.category as LaneCategory} />
            </span>
            <h2
              data-testid="lane-detail-name"
              className="text-lg font-semibold text-gray-900"
            >
              {lane.name}
            </h2>
          </div>
          <button
            data-testid="lane-detail-close"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Lane status */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            {lane.tasksCompleted}/{lane.tasksTotal} tasks complete
          </span>
          {lane.status === "blocked" && (
            <span className="text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Blocked
            </span>
          )}
          {lane.status === "complete" && (
            <span className="text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Complete
            </span>
          )}
          {lane.status === "active" && (
            <span className="text-blue-600 flex items-center gap-1">
              <Play className="w-3 h-3" />
              Active
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Tasks by wave */}
        <div className="space-y-4">
          {waveNumbers.map((waveNum) => {
            const waveTasks = tasksByWave[waveNum];
            const waveStatus = getWaveStatus(waveNum);

            return (
              <div
                key={waveNum}
                data-testid={`lane-wave-group-${waveNum}`}
                className="space-y-2"
              >
                {/* Wave header */}
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      text-sm font-medium
                      ${waveStatus === "complete" ? "text-green-600" : ""}
                      ${waveStatus === "active" ? "text-blue-600" : ""}
                      ${waveStatus === "pending" ? "text-gray-500" : ""}
                    `}
                  >
                    Wave {waveNum}:
                  </span>
                  <span className="text-xs text-gray-500">
                    {waveStatus === "complete" && "✓ Complete"}
                    {waveStatus === "active" && "⚡ Active"}
                    {waveStatus === "pending" && "○ Pending"}
                  </span>
                </div>

                {/* Tasks in wave */}
                <div className="space-y-1 ml-4">
                  {waveTasks.map((task) => {
                    const taskConfig = TASK_STATUS_CONFIG[task.status];

                    return (
                      <div
                        key={task.id}
                        className={`
                          p-2 rounded border cursor-pointer
                          ${taskConfig.bgColor} ${taskConfig.borderColor}
                          hover:brightness-95 transition-all
                        `}
                        onClick={() => onTaskClick?.(task)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-sm font-mono ${taskConfig.color}`}
                          >
                            {task.displayId || task.taskId.slice(0, 8)}
                          </span>
                          {task.status === "complete" && task.durationMs && (
                            <span className="text-xs text-gray-500">
                              {formatDuration(task.durationMs)}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-gray-600 truncate">
                          {task.title}
                        </div>

                        {/* Agent badge for running tasks */}
                        {task.status === "running" && task.agentId && (
                          <div className="mt-1">
                            <AgentBadge
                              agentId={task.agentId}
                              agentName={task.agentName}
                              size="sm"
                            />
                          </div>
                        )}

                        {/* Blocked indicator */}
                        {task.status === "blocked" && (
                          <div className="mt-1">
                            <BlockedIndicator
                              reason={task.blockReason}
                              blockingTaskId={task.blockingTaskId}
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer - File impacts and analytics */}
      <div className="border-t border-gray-200 p-4 space-y-4">
        {/* Timing analytics */}
        {completedTasks.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Avg: {formatDuration(avgDuration)}</span>
            </div>
            <div className="text-gray-500">
              Total: {formatDuration(totalDuration)}
            </div>
          </div>
        )}

        {/* File patterns */}
        {lane.filePatterns.length > 0 && (
          <div data-testid="lane-file-impacts">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              Files in this lane
            </h4>
            <div className="space-y-1">
              {lane.filePatterns.map((pattern, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-gray-600"
                >
                  <FileCode className="w-3 h-3" />
                  <span className="font-mono">{pattern}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
