/**
 * Memory Graph Health Panel Component
 *
 * Displays a health summary of the Memory Graph including
 * block counts, stale values, cycles, and other health metrics.
 */

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Link2,
  AlertCircle,
  ExternalLink,
  FileQuestion,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface GraphHealthMetrics {
  totalBlocks: number;
  activeBlocks: number;
  supersededBlocks: number;
  staleDerivedValues: number;
  unresolvedCycles: number;
  deadExternalUrls: number;
  pendingConfirmations: number;
  orphanBlocks: number;
  orphanPercentage: number;
  lastUpdated: string;
}

export interface MemoryGraphHealthPanelProps {
  sessionId?: string;
  onViewStale?: () => void;
  onViewCycles?: () => void;
  onViewOrphans?: () => void;
  onViewDeadUrls?: () => void;
  className?: string;
}

// ============================================================================
// Metric Row Component
// ============================================================================

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  status?: "ok" | "warning" | "error";
  onClick?: () => void;
}

function MetricRow({
  icon,
  label,
  value,
  status = "ok",
  onClick,
}: MetricRowProps) {
  const statusColors = {
    ok: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
  };

  const statusIcons = {
    ok: <CheckCircle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
  };

  return (
    <div
      className={`flex items-center justify-between py-2 ${
        onClick
          ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 -mx-2"
          : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div
        className={`flex items-center gap-1 font-medium ${statusColors[status]}`}
      >
        <span>{value}</span>
        {status !== "ok" && statusIcons[status]}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MemoryGraphHealthPanel({
  sessionId,
  onViewStale,
  onViewCycles,
  onViewOrphans,
  onViewDeadUrls,
  className = "",
}: MemoryGraphHealthPanelProps) {
  const [metrics, setMetrics] = useState<GraphHealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch health metrics
  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (sessionId) params.append("sessionId", sessionId);

      const response = await fetch(
        `/api/observability/memory-graph/health?${params}`,
      );
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch graph health:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Calculate statuses
  const getStaleStatus = (count: number): "ok" | "warning" | "error" => {
    if (count === 0) return "ok";
    return "warning";
  };

  const getCycleStatus = (count: number): "ok" | "warning" | "error" => {
    if (count === 0) return "ok";
    return "warning";
  };

  const getUrlStatus = (count: number): "ok" | "warning" | "error" => {
    if (count === 0) return "ok";
    return "warning";
  };

  const getPendingStatus = (count: number): "ok" | "warning" | "error" => {
    if (count === 0) return "ok";
    if (count > 5) return "warning";
    return "ok";
  };

  const getOrphanStatus = (percentage: number): "ok" | "warning" | "error" => {
    if (percentage <= 10) return "ok";
    return "warning";
  };

  if (!metrics && !isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-900 rounded-lg border p-4 ${className}`}
      >
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>Unable to load graph health data</p>
          <button
            className="mt-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={fetchMetrics}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Memory Graph Health
        </h3>
        <button
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          onClick={fetchMetrics}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      {isLoading && !metrics ? (
        <div className="p-4 text-center text-gray-500">Loading...</div>
      ) : metrics ? (
        <div className="p-4 space-y-1">
          {/* Block Counts */}
          <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
            <MetricRow
              icon={<Database className="w-4 h-4" />}
              label="Total Blocks"
              value={metrics.totalBlocks}
            />
            <div className="flex items-center justify-between pl-6 text-xs text-gray-500 dark:text-gray-400">
              <span>Active / Superseded:</span>
              <span>
                {metrics.activeBlocks} / {metrics.supersededBlocks}
              </span>
            </div>
          </div>

          {/* Health Metrics */}
          <div className="pt-2 space-y-1">
            <MetricRow
              icon={<Clock className="w-4 h-4" />}
              label="Stale Derived Values"
              value={metrics.staleDerivedValues}
              status={getStaleStatus(metrics.staleDerivedValues)}
              onClick={metrics.staleDerivedValues > 0 ? onViewStale : undefined}
            />

            <MetricRow
              icon={<Link2 className="w-4 h-4" />}
              label="Unresolved Cycles"
              value={metrics.unresolvedCycles}
              status={getCycleStatus(metrics.unresolvedCycles)}
              onClick={metrics.unresolvedCycles > 0 ? onViewCycles : undefined}
            />

            <MetricRow
              icon={<ExternalLink className="w-4 h-4" />}
              label="Dead External URLs"
              value={metrics.deadExternalUrls}
              status={getUrlStatus(metrics.deadExternalUrls)}
              onClick={
                metrics.deadExternalUrls > 0 ? onViewDeadUrls : undefined
              }
            />

            <MetricRow
              icon={<FileQuestion className="w-4 h-4" />}
              label="Pending Confirmations"
              value={metrics.pendingConfirmations}
              status={getPendingStatus(metrics.pendingConfirmations)}
            />

            <MetricRow
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Orphan Blocks"
              value={`${metrics.orphanBlocks} (${metrics.orphanPercentage.toFixed(1)}%)`}
              status={getOrphanStatus(metrics.orphanPercentage)}
              onClick={metrics.orphanBlocks > 0 ? onViewOrphans : undefined}
            />
          </div>

          {/* Last Updated */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            Last Updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {metrics.staleDerivedValues > 0 && onViewStale && (
              <button
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={onViewStale}
              >
                View Stale
              </button>
            )}
            {metrics.unresolvedCycles > 0 && onViewCycles && (
              <button
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={onViewCycles}
              >
                View Cycles
              </button>
            )}
            <button
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              onClick={fetchMetrics}
              disabled={isLoading}
            >
              Refresh
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MemoryGraphHealthPanel;
