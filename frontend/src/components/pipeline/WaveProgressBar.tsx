/**
 * WaveProgressBar Component
 *
 * Horizontal timeline showing wave progression with completion status.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { ChevronRight } from "lucide-react";
import type { Wave } from "../../types/pipeline";
import { WAVE_STATUS_CONFIG } from "../../types/pipeline";

interface WaveProgressBarProps {
  waves: Wave[];
  activeWaveNumber: number;
  selectedWaveNumber?: number;
  onWaveClick?: (waveNumber: number) => void;
}

export default function WaveProgressBar({
  waves,
  activeWaveNumber,
  selectedWaveNumber,
  onWaveClick,
}: WaveProgressBarProps) {
  if (waves.length === 0) {
    return (
      <div
        data-testid="wave-progress-bar"
        className="flex items-center justify-center h-16 bg-gray-50 rounded-lg border border-gray-200"
      >
        <span className="text-gray-500 text-sm">No waves defined</span>
      </div>
    );
  }

  return (
    <div
      data-testid="wave-progress-bar"
      className="flex items-stretch gap-1 bg-gray-50 rounded-lg border border-gray-200 p-2"
    >
      {waves.map((wave, index) => {
        const config = WAVE_STATUS_CONFIG[wave.status];
        const isActive = wave.waveNumber === activeWaveNumber;
        const isSelected = wave.waveNumber === selectedWaveNumber;
        const completionPercent =
          wave.tasksTotal > 0
            ? Math.round((wave.tasksCompleted / wave.tasksTotal) * 100)
            : 0;

        return (
          <div key={wave.id} className="flex items-center">
            <div
              data-testid={`wave-segment-${wave.waveNumber}`}
              data-wave-status={wave.status}
              className={`
                relative flex-1 min-w-[120px] p-2 rounded-md cursor-pointer
                transition-all duration-200
                ${isSelected ? "ring-2 ring-blue-500 wave-selected" : ""}
                ${isActive ? "wave-active" : ""}
                ${wave.status === "complete" ? "bg-green-50" : ""}
                ${wave.status === "active" ? "bg-blue-50" : ""}
                ${wave.status === "pending" ? "bg-gray-100" : ""}
                hover:bg-gray-100
              `}
              onClick={() => onWaveClick?.(wave.waveNumber)}
            >
              {/* Wave header */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">
                  Wave {wave.waveNumber}
                </span>
                {isActive && (
                  <span className="text-xs px-1.5 py-0.5 bg-primary-600 text-white rounded">
                    CURRENT
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full transition-all duration-500 ${config.bgColor}`}
                  style={{ width: `${completionPercent}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-xs">
                <span className={config.color}>
                  {wave.tasksCompleted}/{wave.tasksTotal}
                </span>
                {wave.status === "complete" && (
                  <span className="text-green-600">✓</span>
                )}
                {wave.status === "active" && wave.tasksRunning > 0 && (
                  <span className="text-blue-600">⚡ {wave.tasksRunning}</span>
                )}
                {wave.tasksBlocked > 0 && (
                  <span className="text-amber-600">◐ {wave.tasksBlocked}</span>
                )}
              </div>

              {/* Parallelism indicator */}
              {wave.actualParallelism > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {wave.actualParallelism} parallel
                </div>
              )}
            </div>

            {/* Connector arrow */}
            {index < waves.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-400 mx-1 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Compact variant for sidebar or small spaces
interface WaveProgressCompactProps {
  waves: Wave[];
  activeWaveNumber: number;
}

export function WaveProgressCompact({
  waves,
  activeWaveNumber,
}: WaveProgressCompactProps) {
  const totalTasks = waves.reduce((sum, w) => sum + w.tasksTotal, 0);
  const completedTasks = waves.reduce((sum, w) => sum + w.tasksCompleted, 0);
  const percentComplete =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Wave {activeWaveNumber} of {waves.length}
        </span>
        <span className="text-gray-700">{percentComplete}%</span>
      </div>

      <div className="flex gap-1">
        {waves.map((wave) => {
          const isActive = wave.waveNumber === activeWaveNumber;

          return (
            <div
              key={wave.id}
              className={`
                flex-1 h-2 rounded-full
                ${wave.status === "complete" ? "bg-green-500" : ""}
                ${wave.status === "active" ? "bg-blue-500" : ""}
                ${wave.status === "pending" ? "bg-gray-300" : ""}
                ${isActive ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-white" : ""}
              `}
              title={`Wave ${wave.waveNumber}: ${wave.tasksCompleted}/${wave.tasksTotal}`}
            />
          );
        })}
      </div>
    </div>
  );
}
