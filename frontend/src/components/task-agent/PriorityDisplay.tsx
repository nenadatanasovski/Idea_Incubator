/**
 * Priority Display Component
 *
 * Shows calculated priority with breakdown factors.
 * Part of: Task System V2 Implementation Plan (IMPL-7.13)
 */

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Clock,
  AlertCircle,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";

interface PriorityFactors {
  basePriority: number;
  blockingCount: number;
  blockingBoost: number;
  urgencyMultiplier: number;
  effortDiscount: number;
  staleDays: number;
  staleBoost: number;
  dependencyPenalty: number;
}

interface PriorityCalculation {
  taskId: string;
  finalScore: number;
  factors: PriorityFactors;
  isQuickWin: boolean;
  calculatedAt: string;
}

interface PriorityDisplayProps {
  taskId: string;
  compact?: boolean;
  onRecalculate?: () => void;
}

function getScoreColor(score: number): { text: string; bg: string } {
  if (score >= 80) return { text: "text-red-600", bg: "bg-red-100" };
  if (score >= 60) return { text: "text-orange-600", bg: "bg-orange-100" };
  if (score >= 40) return { text: "text-yellow-600", bg: "bg-yellow-100" };
  return { text: "text-green-600", bg: "bg-green-100" };
}

export default function PriorityDisplay({
  taskId,
  compact = false,
  onRecalculate,
}: PriorityDisplayProps) {
  const [priority, setPriority] = useState<PriorityCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchPriority();
  }, [taskId]);

  const fetchPriority = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/task-agent/tasks/${taskId}/priority`);
      if (response.ok) {
        setPriority(await response.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const recalculate = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/priority/recalculate`,
        {
          method: "POST",
        },
      );
      if (response.ok) {
        const result = await response.json();
        setPriority(result);
        onRecalculate?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">Calculating...</span>
      </div>
    );
  }

  if (error || !priority) {
    return null;
  }

  const scoreColor = getScoreColor(priority.finalScore);

  // Compact mode - just show score badge
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        <span
          className={`px-2 py-0.5 rounded-full text-sm font-medium ${scoreColor.bg} ${scoreColor.text}`}
        >
          P{Math.round(priority.finalScore)}
        </span>
        {priority.isQuickWin && (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Quick Win
          </span>
        )}
      </div>
    );
  }

  // Full mode - show breakdown
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-gray-400" />
          <span className={`text-2xl font-bold ${scoreColor.text}`}>
            {Math.round(priority.finalScore)}
          </span>
          <span className="text-gray-500">/ 100</span>
          {priority.isQuickWin && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Quick Win
            </span>
          )}
        </div>
        <button
          onClick={recalculate}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          Recalculate
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${scoreColor.bg.replace("100", "500")} transition-all duration-500`}
          style={{ width: `${priority.finalScore}%` }}
        />
      </div>

      {/* Factors Breakdown */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        View Priority Factors
      </button>

      {expanded && (
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          {/* Base Priority */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Base Priority</span>
              <Info className="h-3 w-3 text-gray-400" />
            </div>
            <span className="font-mono text-sm">
              {priority.factors.basePriority}
            </span>
          </div>

          {/* Blocking Boost */}
          {priority.factors.blockingCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Blocking {priority.factors.blockingCount} task
                  {priority.factors.blockingCount > 1 ? "s" : ""}
                </span>
                <AlertCircle className="h-3 w-3 text-red-400" />
              </div>
              <span className="font-mono text-sm text-green-600">
                +{priority.factors.blockingBoost}
              </span>
            </div>
          )}

          {/* Urgency Multiplier */}
          {priority.factors.urgencyMultiplier !== 1 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Urgency Multiplier
                </span>
                <Clock className="h-3 w-3 text-amber-400" />
              </div>
              <span className="font-mono text-sm">
                ×{priority.factors.urgencyMultiplier.toFixed(2)}
              </span>
            </div>
          )}

          {/* Effort Discount */}
          {priority.factors.effortDiscount !== 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Effort Adjustment</span>
                <Zap className="h-3 w-3 text-green-400" />
              </div>
              <span
                className={`font-mono text-sm ${priority.factors.effortDiscount > 0 ? "text-green-600" : "text-red-600"}`}
              >
                {priority.factors.effortDiscount > 0 ? "+" : ""}
                {priority.factors.effortDiscount}
              </span>
            </div>
          )}

          {/* Stale Boost */}
          {priority.factors.staleDays > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Stale ({priority.factors.staleDays} days)
                </span>
              </div>
              <span className="font-mono text-sm text-amber-600">
                +{priority.factors.staleBoost}
              </span>
            </div>
          )}

          {/* Dependency Penalty */}
          {priority.factors.dependencyPenalty > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Blocked Dependencies
                </span>
              </div>
              <span className="font-mono text-sm text-red-600">
                -{priority.factors.dependencyPenalty}
              </span>
            </div>
          )}

          {/* Calculation Time */}
          <div className="pt-2 border-t border-gray-200 text-xs text-gray-400">
            Calculated {new Date(priority.calculatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
