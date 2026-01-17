/**
 * ParallelismControls Component
 *
 * Provides controls for parallelism visibility and manual recalculation.
 * Shows stats badge with wave/conflict counts and a recalculate button.
 *
 * Reference: TASK-READINESS-PIPELINE-ENHANCEMENTS-IMPLEMENTATION-PLAN.md Phase 2
 */

import { useState, useCallback } from "react";
import { RefreshCw, Layers, AlertTriangle, Zap } from "lucide-react";

interface ParallelismStats {
  totalWaves: number;
  maxParallel: number;
  conflictCount: number;
  parallelOpportunities: number;
  timeSavingsPercent: number;
}

interface ParallelismControlsProps {
  taskListId: string;
  initialStats?: ParallelismStats;
  onRecalculateComplete?: (stats: ParallelismStats) => void;
}

export default function ParallelismControls({
  taskListId,
  initialStats,
  onRecalculateComplete,
}: ParallelismControlsProps) {
  const [stats, setStats] = useState<ParallelismStats | null>(
    initialStats || null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecalculate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/task-agent/task-lists/${taskListId}/parallelism/recalculate`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error("Failed to recalculate parallelism");
      }

      const data = await response.json();
      const newStats: ParallelismStats = {
        totalWaves: data.totalWaves,
        maxParallel: data.maxParallel,
        conflictCount: data.conflictCount,
        parallelOpportunities: 0, // Not returned from recalculate endpoint
        timeSavingsPercent: 0,
      };

      setStats(newStats);
      onRecalculateComplete?.(newStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [taskListId, onRecalculateComplete]);

  return (
    <div
      data-testid="parallelism-controls"
      className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
    >
      {/* Stats badges */}
      <div className="flex items-center gap-3">
        {stats && (
          <>
            <StatsChip
              icon={<Layers className="w-4 h-4" />}
              label="Waves"
              value={stats.totalWaves}
            />
            <StatsChip
              icon={<Zap className="w-4 h-4" />}
              label="Max Parallel"
              value={stats.maxParallel}
              highlight
            />
            {stats.conflictCount > 0 && (
              <StatsChip
                icon={<AlertTriangle className="w-4 h-4" />}
                label="Conflicts"
                value={stats.conflictCount}
                variant="warning"
              />
            )}
          </>
        )}

        {!stats && !isLoading && (
          <span className="text-sm text-gray-500">
            Click to analyze parallelism
          </span>
        )}
      </div>

      {/* Recalculate button */}
      <button
        data-testid="recalculate-parallelism-btn"
        onClick={handleRecalculate}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
          transition-colors duration-200
          ${
            isLoading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }
        `}
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        {isLoading ? "Calculating..." : "Recalculate"}
      </button>

      {/* Error message */}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

// Stats chip subcomponent
interface StatsChipProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  variant?: "default" | "warning" | "success";
  highlight?: boolean;
}

function StatsChip({
  icon,
  label,
  value,
  variant = "default",
  highlight = false,
}: StatsChipProps) {
  const variantStyles = {
    default: "bg-white text-gray-700 border-gray-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    success: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <div
      className={`
        flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm
        ${variantStyles[variant]}
        ${highlight ? "ring-1 ring-blue-200" : ""}
      `}
    >
      {icon}
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// Compact inline variant
interface ParallelismBadgeProps {
  waves: number;
  maxParallel: number;
  conflicts: number;
}

export function ParallelismBadge({
  waves,
  maxParallel,
  conflicts,
}: ParallelismBadgeProps) {
  return (
    <div
      data-testid="parallelism-badge"
      className="inline-flex items-center gap-2 text-xs"
    >
      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
        {waves} waves
      </span>
      <span className="px-1.5 py-0.5 bg-blue-100 rounded text-blue-600">
        {maxParallel} max
      </span>
      {conflicts > 0 && (
        <span className="px-1.5 py-0.5 bg-amber-100 rounded text-amber-600">
          {conflicts} conflicts
        </span>
      )}
    </div>
  );
}
