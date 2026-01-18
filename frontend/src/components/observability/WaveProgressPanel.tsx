/**
 * WaveProgressPanel - Visualize execution wave progress
 *
 * Features:
 * - Wave progress visualization
 * - Tasks per wave
 * - Parallel execution indicator
 * - Wave timing
 * - Task status breakdown
 */

import { useMemo } from "react";
import {
  Layers,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause,
  Zap,
} from "lucide-react";

interface WaveTask {
  id: string;
  displayId?: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "blocked";
  startedAt?: string;
  completedAt?: string;
}

interface Wave {
  waveNumber: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  tasks: WaveTask[];
  startedAt?: string;
  completedAt?: string;
  maxParallel?: number;
}

interface WaveProgressPanelProps {
  waves: Wave[];
  currentWave?: number;
  onTaskClick?: (taskId: string) => void;
  onWaveClick?: (waveNumber: number) => void;
}

// Status colors
const statusColors = {
  pending: "bg-gray-200 text-gray-600",
  in_progress: "bg-yellow-200 text-yellow-700",
  completed: "bg-green-200 text-green-700",
  failed: "bg-red-200 text-red-700",
  blocked: "bg-orange-200 text-orange-700",
};

const statusIcons = {
  pending: Clock,
  in_progress: Play,
  completed: CheckCircle,
  failed: XCircle,
  blocked: Pause,
};

export default function WaveProgressPanel({
  waves,
  currentWave,
  onTaskClick,
  onWaveClick,
}: WaveProgressPanelProps) {
  // Calculate overall stats
  const stats = useMemo(() => {
    const totalTasks = waves.reduce((sum, w) => sum + w.tasks.length, 0);
    const completedTasks = waves.reduce(
      (sum, w) => sum + w.tasks.filter((t) => t.status === "completed").length,
      0,
    );
    const failedTasks = waves.reduce(
      (sum, w) => sum + w.tasks.filter((t) => t.status === "failed").length,
      0,
    );
    const completedWaves = waves.filter((w) => w.status === "completed").length;

    return {
      totalTasks,
      completedTasks,
      failedTasks,
      completedWaves,
      totalWaves: waves.length,
      progress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
    };
  }, [waves]);

  // Calculate wave duration
  const getWaveDuration = (wave: Wave) => {
    if (!wave.startedAt) return null;
    const start = new Date(wave.startedAt).getTime();
    const end = wave.completedAt
      ? new Date(wave.completedAt).getTime()
      : Date.now();
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  if (waves.length === 0) {
    return (
      <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
        <Layers className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No execution waves</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-500" />
            <h3 className="font-medium text-gray-900">Execution Waves</h3>
          </div>
          <div className="text-sm text-gray-500">
            Wave {currentWave || stats.completedWaves} / {stats.totalWaves}
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Overall Progress</span>
            <span>
              {stats.completedTasks} / {stats.totalTasks} tasks
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 flex gap-4 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" />
            {stats.completedTasks} completed
          </span>
          {stats.failedTasks > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-3 w-3" />
              {stats.failedTasks} failed
            </span>
          )}
        </div>
      </div>

      {/* Waves list */}
      <div className="divide-y max-h-96 overflow-auto">
        {waves.map((wave) => {
          const StatusIcon = statusIcons[wave.status];
          const isCurrentWave = currentWave === wave.waveNumber;
          const duration = getWaveDuration(wave);

          // Calculate wave progress
          const completedInWave = wave.tasks.filter(
            (t) => t.status === "completed",
          ).length;
          const waveProgress =
            wave.tasks.length > 0
              ? (completedInWave / wave.tasks.length) * 100
              : 0;

          return (
            <div
              key={wave.waveNumber}
              className={`${isCurrentWave ? "bg-indigo-50" : ""}`}
            >
              {/* Wave header */}
              <button
                onClick={() => onWaveClick?.(wave.waveNumber)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <span className={`p-1.5 rounded ${statusColors[wave.status]}`}>
                  <StatusIcon className="h-4 w-4" />
                </span>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      Wave {wave.waveNumber}
                    </span>
                    {isCurrentWave && (
                      <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                        Current
                      </span>
                    )}
                    {wave.maxParallel && wave.maxParallel > 1 && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {wave.maxParallel}x parallel
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">
                      {wave.tasks.length} tasks
                    </span>
                    {duration && (
                      <span className="text-xs text-gray-400">
                        · {duration}
                      </span>
                    )}
                  </div>
                </div>

                {/* Wave progress */}
                <div className="w-24">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        wave.status === "failed"
                          ? "bg-red-500"
                          : wave.status === "completed"
                            ? "bg-green-500"
                            : "bg-indigo-500"
                      }`}
                      style={{ width: `${waveProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-right mt-0.5">
                    {completedInWave}/{wave.tasks.length}
                  </div>
                </div>
              </button>

              {/* Tasks in wave */}
              {(isCurrentWave || wave.status === "in_progress") && (
                <div className="px-4 pb-3">
                  <div className="ml-10 flex flex-wrap gap-2">
                    {wave.tasks.map((task) => {
                      const TaskIcon = statusIcons[task.status];
                      return (
                        <button
                          key={task.id}
                          onClick={() => onTaskClick?.(task.id)}
                          className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded ${statusColors[task.status]} hover:opacity-80`}
                          title={task.title}
                        >
                          <TaskIcon className="h-3 w-3" />
                          <span className="max-w-24 truncate">
                            {task.displayId || task.title.slice(0, 20)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t bg-gray-50">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">Status:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Running
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Complete
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Failed
          </span>
        </div>
      </div>
    </div>
  );
}
