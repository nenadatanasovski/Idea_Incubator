/**
 * WaveProgressBar Component
 *
 * Horizontal timeline showing wave progression with completion status.
 * Ported from Vibe Platform for parent-harness dashboard.
 */

import type { Wave } from "../types/pipeline";
import { WAVE_STATUS_CONFIG } from "../types/pipeline";

interface WaveProgressBarProps {
  waves: Wave[];
  activeWaveNumber: number;
  selectedWaveNumber?: number;
  onWaveClick?: (waveNumber: number) => void;
}

export function WaveProgressBar({
  waves,
  activeWaveNumber,
  selectedWaveNumber,
  onWaveClick,
}: WaveProgressBarProps) {
  if (waves.length === 0) {
    return (
      <div
        data-testid="wave-progress-bar"
        className="flex items-center justify-center h-16 bg-gray-800 rounded-lg border border-gray-700"
      >
        <span className="text-gray-500 text-sm">No waves defined</span>
      </div>
    );
  }

  return (
    <div
      data-testid="wave-progress-bar"
      className="flex items-stretch gap-1 bg-gray-800 rounded-lg border border-gray-700 p-2"
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
                ${isSelected ? "ring-2 ring-blue-500" : ""}
                ${isActive ? "bg-blue-900/50" : ""}
                ${wave.status === "complete" ? "bg-green-900/30" : ""}
                ${wave.status === "active" ? "bg-blue-900/30" : ""}
                ${wave.status === "pending" ? "bg-gray-700" : ""}
                hover:bg-gray-600
              `}
              onClick={() => onWaveClick?.(wave.waveNumber)}
            >
              {/* Wave header */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-300">
                  Wave {wave.waveNumber}
                </span>
                {isActive && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded">
                    CURRENT
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-600 rounded-full overflow-hidden mb-1">
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
                  <span className="text-green-400">✓</span>
                )}
                {wave.status === "active" && wave.tasksRunning > 0 && (
                  <span className="text-blue-400">⚡ {wave.tasksRunning}</span>
                )}
                {wave.tasksBlocked > 0 && (
                  <span className="text-amber-400">◐ {wave.tasksBlocked}</span>
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
              <svg
                className="w-4 h-4 text-gray-500 mx-1 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
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
        <span className="text-gray-400">
          Wave {activeWaveNumber} of {waves.length}
        </span>
        <span className="text-gray-200">{percentComplete}%</span>
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
                ${wave.status === "pending" ? "bg-gray-600" : ""}
                ${isActive ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900" : ""}
              `}
              title={`Wave ${wave.waveNumber}: ${wave.tasksCompleted}/${wave.tasksTotal}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default WaveProgressBar;
