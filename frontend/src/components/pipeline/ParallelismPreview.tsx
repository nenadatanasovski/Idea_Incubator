/**
 * ParallelismPreview Component
 *
 * Shows wave breakdown visualization with detailed task assignment
 * and optimization suggestions before starting execution.
 *
 * Reference: TASK-READINESS-PIPELINE-ENHANCEMENTS-IMPLEMENTATION-PLAN.md Phase 2
 */

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Layers,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
} from "lucide-react";

interface TaskIdentity {
  id: string;
  displayId: string;
}

interface WavePreview {
  waveNumber: number;
  taskCount: number;
  tasks: TaskIdentity[];
  status: string;
}

interface ParallelismPreviewData {
  taskListId: string;
  totalTasks: number;
  totalWaves: number;
  maxParallel: number;
  parallelOpportunities: number;
  timeSavingsPercent: number;
  waves: WavePreview[];
  suggestions: string[];
  canExecute: boolean;
  previewedAt: string;
}

interface ParallelismPreviewProps {
  taskListId: string;
  onStartExecution?: () => void;
  onPauseExecution?: () => void;
  isExecuting?: boolean;
}

export default function ParallelismPreview({
  taskListId,
  onStartExecution,
  onPauseExecution,
  isExecuting = false,
}: ParallelismPreviewProps) {
  const [preview, setPreview] = useState<ParallelismPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedWaves, setExpandedWaves] = useState<Set<number>>(new Set([1]));

  const fetchPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/task-agent/task-lists/${taskListId}/parallelism/preview`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch parallelism preview");
      }

      const data = await response.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [taskListId]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const toggleWave = (waveNumber: number) => {
    setExpandedWaves((prev) => {
      const next = new Set(prev);
      if (next.has(waveNumber)) {
        next.delete(waveNumber);
      } else {
        next.add(waveNumber);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div
        data-testid="parallelism-preview"
        className="p-6 bg-white rounded-lg border border-gray-200"
      >
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full" />
          <span>Analyzing parallelism...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="parallelism-preview"
        className="p-6 bg-red-50 rounded-lg border border-red-200"
      >
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  return (
    <div
      data-testid="parallelism-preview"
      className="bg-white rounded-lg border border-gray-200"
    >
      {/* Header with summary stats */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Execution Preview
          </h3>
          <div className="flex items-center gap-4">
            {/* Time savings badge */}
            {preview.timeSavingsPercent > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-md">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  {preview.timeSavingsPercent}% faster
                </span>
              </div>
            )}

            {/* Execution controls */}
            {preview.canExecute && (
              <button
                data-testid="start-execution-btn"
                onClick={isExecuting ? onPauseExecution : onStartExecution}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
                  transition-colors duration-200
                  ${
                    isExecuting
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }
                `}
              >
                {isExecuting ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Execution
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Summary stats row */}
        <div className="flex items-center gap-6 mt-4">
          <StatItem
            icon={<Layers className="w-4 h-4" />}
            label="Tasks"
            value={preview.totalTasks}
          />
          <StatItem
            icon={<Layers className="w-4 h-4" />}
            label="Waves"
            value={preview.totalWaves}
          />
          <StatItem
            icon={<CheckCircle className="w-4 h-4" />}
            label="Max Parallel"
            value={preview.maxParallel}
            highlight
          />
        </div>
      </div>

      {/* Wave breakdown */}
      <div className="p-4 space-y-2">
        {preview.waves.map((wave) => {
          const isExpanded = expandedWaves.has(wave.waveNumber);

          return (
            <div
              key={wave.waveNumber}
              data-testid={`wave-preview-${wave.waveNumber}`}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Wave header */}
              <button
                onClick={() => toggleWave(wave.waveNumber)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="font-medium text-gray-900">
                    Wave {wave.waveNumber}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({wave.taskCount} task{wave.taskCount !== 1 ? "s" : ""})
                  </span>
                </div>
                <span
                  className={`
                    px-2 py-0.5 text-xs rounded-full
                    ${wave.status === "pending" ? "bg-gray-200 text-gray-600" : ""}
                    ${wave.status === "active" ? "bg-blue-100 text-blue-700" : ""}
                    ${wave.status === "complete" ? "bg-green-100 text-green-700" : ""}
                  `}
                >
                  {wave.status}
                </span>
              </button>

              {/* Wave tasks (expanded) */}
              {isExpanded && (
                <div className="p-3 bg-white border-t border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    {wave.tasks.map((task) => (
                      <span
                        key={task.id}
                        className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-700 font-mono"
                      >
                        {task.displayId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Optimization suggestions */}
      {preview.suggestions.length > 0 && (
        <div className="p-4 bg-yellow-50 border-t border-yellow-100">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="space-y-1">
              <span className="text-sm font-medium text-yellow-800">
                Optimization Suggestions
              </span>
              <ul className="text-sm text-yellow-700 list-disc list-inside">
                {preview.suggestions.map((suggestion, idx) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat item subcomponent
interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  highlight?: boolean;
}

function StatItem({ icon, label, value, highlight = false }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`${highlight ? "text-blue-600" : "text-gray-400"}`}>
        {icon}
      </div>
      <span className="text-sm text-gray-500">{label}:</span>
      <span
        className={`text-sm font-semibold ${highlight ? "text-blue-600" : "text-gray-900"}`}
      >
        {value}
      </span>
    </div>
  );
}
