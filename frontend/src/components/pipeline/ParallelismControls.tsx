/**
 * ParallelismControls Component
 *
 * Provides controls for parallelism visibility and manual recalculation.
 * Shows stats badges with clickable conflict count and a Fix Conflicts button.
 *
 * Reference: TASK-READINESS-PIPELINE-ENHANCEMENTS-IMPLEMENTATION-PLAN.md Phase 2
 */

import { useState, useCallback } from "react";
import {
  RefreshCw,
  Layers,
  AlertTriangle,
  Zap,
  CheckCircle,
  GitBranch,
  Wrench,
} from "lucide-react";
import type { ConflictItem } from "./ConflictListPanel";
import ConflictListPanel from "./ConflictListPanel";

interface ParallelismStats {
  totalWaves: number;
  maxParallel: number;
  conflictCount: number;
  dependencyCount: number;
}

interface ResolutionResult {
  resolved: number;
  total: number;
}

interface ParallelismControlsProps {
  taskListId: string;
  initialStats?: ParallelismStats;
  onRecalculateComplete?: (stats: ParallelismStats) => void;
  onTaskClick?: (taskId: string) => void;
}

export default function ParallelismControls({
  taskListId,
  initialStats,
  onRecalculateComplete,
  onTaskClick,
}: ParallelismControlsProps) {
  const [stats, setStats] = useState<ParallelismStats | null>(
    initialStats || null,
  );
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResolution, setLastResolution] = useState<ResolutionResult | null>(
    null,
  );

  const fetchParallelism = useCallback(
    async (fix: boolean) => {
      if (fix) {
        setIsFixing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const url = `/api/task-agent/task-lists/${taskListId}/parallelism/recalculate${fix ? "?fix=true" : ""}`;
        const response = await fetch(url, { method: "POST" });

        if (!response.ok) {
          throw new Error("Failed to recalculate parallelism");
        }

        const data = await response.json();
        const newStats: ParallelismStats = {
          totalWaves: data.totalWaves,
          maxParallel: data.maxParallel,
          conflictCount: data.conflictCount,
          dependencyCount: data.dependencyCount || 0,
        };

        // Store conflict details
        if (data.conflicts && Array.isArray(data.conflicts)) {
          setConflicts(data.conflicts);
        } else {
          setConflicts([]);
        }

        // Store resolution result
        if (data.resolution && data.resolution.resolved > 0) {
          setLastResolution({
            resolved: data.resolution.resolved,
            total: data.resolution.total,
          });
          // Auto-hide conflict panel after fixing
          setShowConflicts(false);
        } else {
          setLastResolution(null);
        }

        setStats(newStats);
        onRecalculateComplete?.(newStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
        setIsFixing(false);
      }
    },
    [taskListId, onRecalculateComplete],
  );

  const handleRecalculate = useCallback(() => {
    setLastResolution(null);
    fetchParallelism(false);
  }, [fetchParallelism]);

  const handleFixConflicts = useCallback(() => {
    fetchParallelism(true);
  }, [fetchParallelism]);

  const handleConflictsClick = useCallback(() => {
    setShowConflicts((prev) => !prev);
  }, []);

  const handleCloseConflicts = useCallback(() => {
    setShowConflicts(false);
  }, []);

  return (
    <div data-testid="parallelism-controls">
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
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
              {stats.dependencyCount > 0 && (
                <StatsChip
                  icon={<GitBranch className="w-4 h-4" />}
                  label="Dependencies"
                  value={stats.dependencyCount}
                />
              )}
              {stats.conflictCount > 0 ? (
                <StatsChip
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="Conflicts"
                  value={stats.conflictCount}
                  variant="warning"
                  onClick={handleConflictsClick}
                  isActive={showConflicts}
                />
              ) : lastResolution ? (
                <StatsChip
                  icon={<CheckCircle className="w-4 h-4" />}
                  label="Resolved"
                  value={lastResolution.resolved}
                  variant="success"
                />
              ) : null}
            </>
          )}

          {!stats && !isLoading && (
            <span className="text-sm text-gray-500">
              Click Recalculate to analyze
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Fix Conflicts button - only show if there are conflicts */}
          {stats && stats.conflictCount > 0 && (
            <button
              data-testid="fix-conflicts-btn"
              onClick={handleFixConflicts}
              disabled={isFixing || isLoading}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
                transition-colors duration-200
                ${
                  isFixing
                    ? "bg-amber-200 text-amber-700 cursor-not-allowed"
                    : "bg-amber-500 text-white hover:bg-amber-600"
                }
              `}
            >
              <Wrench
                className={`w-4 h-4 ${isFixing ? "animate-pulse" : ""}`}
              />
              {isFixing ? "Fixing..." : "Fix Conflicts"}
            </button>
          )}

          {/* Recalculate button */}
          <button
            data-testid="recalculate-parallelism-btn"
            onClick={handleRecalculate}
            disabled={isLoading || isFixing}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
              transition-colors duration-200
              ${
                isLoading || isFixing
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }
            `}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Calculating..." : "Recalculate"}
          </button>
        </div>

        {/* Error message */}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* Resolution Success Banner */}
      {lastResolution && lastResolution.resolved > 0 && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <span className="font-medium text-green-800">
              {lastResolution.resolved} conflict
              {lastResolution.resolved !== 1 ? "s" : ""} fixed!
            </span>
            <span className="text-green-600 ml-2">
              Dependencies added to enforce sequential execution.
            </span>
          </div>
        </div>
      )}

      {/* Conflict List Panel */}
      {showConflicts && conflicts.length > 0 && (
        <ConflictListPanel
          conflicts={conflicts}
          onClose={handleCloseConflicts}
          onTaskClick={onTaskClick}
        />
      )}
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
  onClick?: () => void;
  isActive?: boolean;
}

function StatsChip({
  icon,
  label,
  value,
  variant = "default",
  highlight = false,
  onClick,
  isActive = false,
}: StatsChipProps) {
  const variantStyles = {
    default: "bg-white text-gray-700 border-gray-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    success: "bg-green-50 text-green-700 border-green-200",
  };

  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm
        ${variantStyles[variant]}
        ${highlight ? "ring-1 ring-blue-200" : ""}
        ${isClickable ? "cursor-pointer hover:brightness-95 active:brightness-90" : ""}
        ${isActive ? "ring-2 ring-amber-400" : ""}
        transition-all duration-150
      `}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
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
