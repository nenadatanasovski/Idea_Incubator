/**
 * WaveCell Component
 * 
 * Represents a single task cell at the intersection of a lane and wave.
 * Shows task status, agent assignment, and blocking state.
 * Ported from Vibe Platform for parent-harness dashboard.
 */

import { useState } from 'react';
import type { LaneTask } from '../types/pipeline';
import { TASK_STATUS_CONFIG } from '../types/pipeline';

interface WaveCellProps {
  task?: LaneTask;
  waveNumber: number;
  isActiveWave: boolean;
  onClick?: (task: LaneTask) => void;
}

const StatusIcon = ({ status }: { status: LaneTask['status'] }) => {
  const baseClass = 'w-4 h-4';
  switch (status) {
    case 'complete':
      return (
        <svg className={`${baseClass} text-green-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'running':
      return (
        <svg className={`${baseClass} text-blue-400 animate-spin`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'failed':
      return (
        <svg className={`${baseClass} text-red-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'blocked':
      return (
        <svg className={`${baseClass} text-amber-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'skipped':
      return (
        <svg className={`${baseClass} text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      );
    case 'pending':
    default:
      return (
        <svg className={`${baseClass} text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

export function WaveCell({
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
          min-h-[60px] p-2
          border border-gray-700
          ${isActiveWave ? 'bg-blue-900/20' : 'bg-gray-800/50'}
          transition-colors duration-200
        `}
      />
    );
  }

  const config = TASK_STATUS_CONFIG[task.status];
  const isRunning = task.status === 'running';
  const isBlocked = task.status === 'blocked';

  return (
    <div
      data-testid={`wave-cell-${task.taskId}`}
      data-task-status={task.status}
      className={`
        min-h-[60px] p-2
        border ${config.borderColor}
        ${task.status === 'complete' ? 'bg-green-900/20' : ''}
        ${task.status === 'running' ? 'bg-blue-900/20' : ''}
        ${task.status === 'failed' ? 'bg-red-900/20' : ''}
        ${task.status === 'blocked' ? 'bg-amber-900/20' : ''}
        ${task.status === 'pending' ? 'bg-gray-800' : ''}
        ${task.status === 'skipped' ? 'bg-gray-800/50' : ''}
        ${isActiveWave ? 'ring-1 ring-blue-500/30' : ''}
        ${isHovered ? 'ring-2 ring-blue-400/50' : ''}
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
      <div className="text-xs text-gray-300 line-clamp-2" title={task.title}>
        {task.title}
      </div>

      {/* Duration (for completed tasks) */}
      {task.status === 'complete' && task.durationMs && (
        <div className="text-xs text-gray-500 mt-1">
          {formatDuration(task.durationMs)}
        </div>
      )}

      {/* Agent badge (for running tasks) */}
      {isRunning && task.agentName && (
        <div className="mt-1">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            {task.agentName}
          </span>
        </div>
      )}

      {/* Blocked indicator */}
      {isBlocked && task.blockReason && (
        <div className="mt-1">
          <span className="text-xs text-amber-400 truncate block">
            ⚠ {task.blockReason}
          </span>
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

export default WaveCell;
