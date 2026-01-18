/**
 * AssertionDashboard - Assertion pass/fail overview with category breakdown
 *
 * Features:
 * - Overall pass rate with trend indicator
 * - Result cards (pass, fail, skip, warn)
 * - Category breakdown with progress bars
 * - Failed assertions list
 * - Category filter dropdown
 * - Real-time updates via WebSocket
 * - Time-series sparkline for pass rate trend
 */

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import {
  useAssertions,
  useAssertionSummary,
} from "../../hooks/useObservability";
import { useObservabilityStream } from "../../hooks/useObservabilityStream";
import type { AssertionResultEntry } from "../../types/observability";

interface AssertionDashboardProps {
  executionId: string;
  onAssertionClick?: (assertion: AssertionResultEntry) => void;
}

// Time-series sparkline component
function PassRateTrend({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const height = 32;
  const width = 100;
  const max = 100;
  const min = 0;

  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / (max - min)) * height;
      return `${x},${y}`;
    })
    .join(" ");

  // Determine color based on trend
  const lastValue = data[data.length - 1];
  const color =
    lastValue >= 80 ? "#16a34a" : lastValue >= 50 ? "#ca8a04" : "#dc2626";

  return (
    <div className="flex items-center gap-2">
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        viewBox={`0 0 ${width} ${height}`}
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current value dot */}
        <circle
          cx={width}
          cy={height - ((lastValue - min) / (max - min)) * height}
          r="3"
          fill={color}
        />
      </svg>
      <span className="text-xs text-gray-500">Trend</span>
    </div>
  );
}

const resultIcons = {
  pass: CheckCircle,
  fail: XCircle,
  skip: MinusCircle,
  warn: AlertTriangle,
};

const resultColors = {
  pass: "text-green-600 bg-green-100",
  fail: "text-red-600 bg-red-100",
  skip: "text-gray-500 bg-gray-100",
  warn: "text-yellow-600 bg-yellow-100",
};

export default function AssertionDashboard({
  executionId,
  onAssertionClick,
}: AssertionDashboardProps) {
  const {
    summary,
    loading: summaryLoading,
    refetch,
  } = useAssertionSummary(executionId);
  const { assertions, loading: assertionsLoading } = useAssertions(
    executionId,
    { limit: 100 },
  );

  // State for filters and trend
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [passRateHistory, setPassRateHistory] = useState<number[]>([]);

  // Real-time updates
  const { events, isConnected } = useObservabilityStream({
    executionId,
    autoConnect: true,
  });

  // Track pass rate over time
  useEffect(() => {
    if (summary?.passRate !== undefined) {
      setPassRateHistory((prev) => {
        const newHistory = [...prev, summary.passRate * 100];
        return newHistory.slice(-20); // Keep last 20 data points
      });
    }
  }, [summary?.passRate]);

  // Count real-time assertion updates
  const realTimeStats = useMemo(() => {
    const assertionEvents = events.filter((e) => e.type === "assertion:result");
    const passed = assertionEvents.filter(
      (e) => (e.data as { result?: string })?.result === "pass",
    ).length;
    const failed = assertionEvents.filter(
      (e) => (e.data as { result?: string })?.result === "fail",
    ).length;
    return { total: assertionEvents.length, passed, failed };
  }, [events]);

  const loading = summaryLoading || assertionsLoading;

  // Get unique categories
  const categories = useMemo(() => {
    if (!summary?.byCategory) return [];
    return Object.keys(summary.byCategory).sort();
  }, [summary?.byCategory]);

  // Filter assertions by category
  const filteredAssertions = useMemo(() => {
    if (!categoryFilter) return assertions;
    return assertions.filter((a) => a.category === categoryFilter);
  }, [assertions, categoryFilter]);

  const failedAssertions = useMemo(
    () => filteredAssertions.filter((a) => a.result === "fail"),
    [filteredAssertions],
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch?.();
  }, [refetch]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-24 bg-gray-100 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return <div className="p-4 text-gray-500">No assertion data available</div>;
  }

  const passRate = summary.passRate * 100;

  return (
    <div className="space-y-6 p-4">
      {/* Header with filters and real-time indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Category filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border ${
                categoryFilter
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              {categoryFilter || "All Categories"}
              <ChevronDown className="h-4 w-4" />
            </button>
            {showFilterDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilterDropdown(false)}
                />
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-20">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setCategoryFilter(null);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        !categoryFilter
                          ? "font-medium text-blue-600"
                          : "text-gray-700"
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setCategoryFilter(cat);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                          categoryFilter === cat
                            ? "font-medium text-blue-600"
                            : "text-gray-700"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Real-time indicator */}
        <div className="flex items-center gap-2 text-xs">
          {isConnected && realTimeStats.total > 0 && (
            <span className="text-green-600">
              +{realTimeStats.total} new ({realTimeStats.passed} passed,{" "}
              {realTimeStats.failed} failed)
            </span>
          )}
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-300"}`}
          />
          <span className="text-gray-500">
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Overall health */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">
            Overall Pass Rate
          </h3>
          <div className="flex items-center gap-3">
            {passRateHistory.length > 1 && (
              <PassRateTrend data={passRateHistory} />
            )}
            {passRate >= 80 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div
            className="text-3xl font-bold"
            style={{
              color:
                passRate >= 80
                  ? "#16a34a"
                  : passRate >= 50
                    ? "#ca8a04"
                    : "#dc2626",
            }}
          >
            {passRate.toFixed(1)}%
          </div>
          <div className="flex-1">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${passRate}%`,
                  backgroundColor:
                    passRate >= 80
                      ? "#16a34a"
                      : passRate >= 50
                        ? "#ca8a04"
                        : "#dc2626",
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-6 mt-3 text-sm">
          <span className="text-green-600">
            {summary.passed + realTimeStats.passed} passed
          </span>
          <span className="text-red-600">
            {summary.failed + realTimeStats.failed} failed
          </span>
          <span className="text-gray-500">{summary.skipped} skipped</span>
          <span className="text-yellow-600">{summary.warned} warned</span>
        </div>
      </div>

      {/* Result cards */}
      <div className="grid grid-cols-4 gap-4">
        {(["pass", "fail", "skip", "warn"] as const).map((result) => {
          const Icon = resultIcons[result];
          const count =
            summary[
              result === "pass"
                ? "passed"
                : result === "fail"
                  ? "failed"
                  : result === "skip"
                    ? "skipped"
                    : "warned"
            ];
          return (
            <div
              key={result}
              className={`rounded-lg border p-3 ${resultColors[result]}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium capitalize">{result}</span>
              </div>
              <div className="text-2xl font-bold">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Category breakdown */}
      {Object.keys(summary.byCategory).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            By Category
          </h3>
          <div className="space-y-2">
            {Object.entries(summary.byCategory).map(([cat, data]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-32 text-sm text-gray-600 truncate">
                  {cat}
                </span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${data.total > 0 ? (data.passed / data.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">
                  {data.passed}/{data.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed assertions list */}
      {failedAssertions.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium text-gray-700">
              Failed Assertions ({failedAssertions.length})
            </h3>
          </div>
          <div className="divide-y max-h-64 overflow-auto">
            {failedAssertions.map((assertion) => (
              <div
                key={assertion.id}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => onAssertionClick?.(assertion)}
              >
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {assertion.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {assertion.category}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chains summary */}
      {summary.chains.total > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Assertion Chains
          </h3>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">
              {summary.chains.passed} passed
            </span>
            <span className="text-red-600">{summary.chains.failed} failed</span>
            <span className="text-yellow-600">
              {summary.chains.partial} partial
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact sparkline for category trends
export function AssertionSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-green-400 rounded-t"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}
