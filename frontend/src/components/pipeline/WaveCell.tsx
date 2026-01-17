/**
 * WaveCell Component
 *
 * Represents a single task cell at the intersection of a lane and wave.
 * Shows task status, agent assignment, and blocking state.
 *
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { useState } from "react";
import {
  Check,
  Clock,
  AlertTriangle,
  XCircle,
  SkipForward,
  Loader2,
} from "lucide-react";
import type { LaneTask } from "../../types/pipeline";
import { TASK_STATUS_CONFIG } from "../../types/pipeline";
import AgentBadge from "./AgentBadge";
import BlockedIndicator from "./BlockedIndicator";

interface WaveCellProps {
  task?: LaneTask;
  waveNumber: number;
  isActiveWave: boolean;
  onClick?: (task: LaneTask) => void;
}

const StatusIcon = ({ status }: { status: LaneTask["status"] }) => {
  const iconClass = "w-4 h-4";
  switch (status) {
    case "complete":
      return <Check className={`${iconClass} text-green-600`} />;
    case "running":
      return <Loader2 className={`${iconClass} text-blue-600 animate-spin`} />;
    case "failed":
      return <XCircle className={`${iconClass} text-red-600`} />;
    case "blocked":
      return <AlertTriangle className={`${iconClass} text-amber-600`} />;
    case "skipped":
      return <SkipForward className={`${iconClass} text-gray-400`} />;
    case "pending":
    default:
      return <Clock className={`${iconClass} text-gray-400`} />;
  }
};

export default function WaveCell({
  task,
  waveNumber,
  isActiveWave,
  onClick,
}: WaveCellProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Empty cell for wave/lane intersection with no task
  if (!task) {
    return (
      <div
        data-testid={`wave-cell-empty-${waveNumber}`}
        className={`
          wave-cell-empty
          min-h-[60px] p-2
          border border-gray-200/50
          ${isActiveWave ? "bg-blue-50/50" : "bg-gray-50/30"}
          transition-colors duration-200
        `}
      />
    );
  }

  const config = TASK_STATUS_CONFIG[task.status];
  const isRunning = task.status === "running";
  const isBlocked = task.status === "blocked";

  return (
    <div
      data-testid={`wave-cell-${task.taskId}`}
      data-task-status={task.status}
      className={`
        wave-cell
        min-h-[60px] p-2
        border ${config.borderColor}
        ${config.bgColor}
        ${isActiveWave ? "ring-1 ring-blue-500/30" : ""}
        ${isHovered ? "ring-2 ring-blue-400/50" : ""}
        ${task.status === "running" ? "task-running" : ""}
        ${task.status === "complete" ? "task-complete" : ""}
        ${task.status === "blocked" ? "task-blocked" : ""}
        cursor-pointer
        transition-all duration-200
        relative
      `}
      onClick={() => onClick?.(task)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Task header */}
      <div className="flex items-center gap-1.5 mb-1">
        <StatusIcon status={task.status} />
        <span className={`text-xs font-medium ${config.color} truncate`}>
          {task.displayId || task.taskId.slice(0, 8)}
        </span>
      </div>

      {/* Task title */}
      <div className="text-xs text-gray-700 line-clamp-2" title={task.title}>
        {task.title}
      </div>

      {/* Duration (for completed tasks) */}
      {task.status === "complete" && task.durationMs && (
        <div className="text-xs text-gray-500 mt-1">
          {formatDuration(task.durationMs)}
        </div>
      )}

      {/* Agent badge (for running tasks) */}
      {isRunning && task.agentId && (
        <div className="mt-1">
          <AgentBadge
            agentId={task.agentId}
            agentName={task.agentName}
            size="sm"
          />
        </div>
      )}

      {/* Blocked indicator */}
      {isBlocked && (
        <div className="mt-1">
          <BlockedIndicator
            reason={task.blockReason}
            blockingTaskId={task.blockingTaskId}
            size="sm"
          />
        </div>
      )}

      {/* Active wave indicator */}
      {isActiveWave && isRunning && (
        <div className="absolute top-0 right-0">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
