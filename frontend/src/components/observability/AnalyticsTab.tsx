/**
 * AnalyticsTab - Analytics and visualization view within Observability
 * Shows tool usage, assertion trends, execution durations, and error hotspots
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import clsx from "clsx";

const API_BASE = "http://localhost:3001";

type TimeRange = "1h" | "6h" | "24h" | "7d";

// Types for API responses
interface ToolUsageData {
  tools: Array<{
    name: string;
    count: number;
    errors: number;
    avgDurationMs: number;
  }>;
  summary: {
    total: number;
    errors: number;
    blocked: number;
    errorRate: string;
  };
}

interface AssertionData {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    warned: number;
    passRate: string;
  };
  byCategory: Array<{
    category: string;
    total: number;
    passed: number;
    passRate: string;
  }>;
}

interface DurationData {
  summary: {
    avgSeconds: number;
    minSeconds: number;
    maxSeconds: number;
    p95Seconds: number;
    totalExecutions: number;
  };
  trend: Array<{
    id: string;
    durationSeconds: number;
    status: string;
    startedAt: string;
  }>;
}

interface ErrorData {
  toolErrors: Array<{
    tool: string;
    count: number;
    sampleError: string;
  }>;
  assertionFailures: Array<{
    category: string;
    count: number;
    sampleDescription: string;
  }>;
  failedExecutions: Array<{
    id: string;
    runNumber: number;
    startedAt: string;
  }>;
}

export default function AnalyticsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [timeRange, setTimeRange] = useState<TimeRange>(
    (searchParams.get("range") as TimeRange) || "24h",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [toolUsage, setToolUsage] = useState<ToolUsageData | null>(null);
  const [assertions, setAssertions] = useState<AssertionData | null>(null);
  const [durations, setDurations] = useState<DurationData | null>(null);
  const [errors, setErrors] = useState<ErrorData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const [toolRes, assertRes, durationRes, errorRes] = await Promise.all([
        fetch(
          `${API_BASE}/api/observability/analytics/tool-usage?range=${timeRange}`,
        ),
        fetch(
          `${API_BASE}/api/observability/analytics/assertions?range=${timeRange}`,
        ),
        fetch(
          `${API_BASE}/api/observability/analytics/durations?range=${timeRange}`,
        ),
        fetch(
          `${API_BASE}/api/observability/analytics/errors?range=${timeRange}`,
        ),
      ]);

      const [toolData, assertData, durationData, errorData] = await Promise.all(
        [toolRes.json(), assertRes.json(), durationRes.json(), errorRes.json()],
      );

      if (toolData.success) setToolUsage(toolData.data);
      if (assertData.success) setAssertions(assertData.data);
      if (durationData.success) setDurations(durationData.data);
      if (errorData.success) setErrors(errorData.data);
    } catch (err) {
      console.error("Failed to fetch analytics data:", err);
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update URL when time range changes
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    setSearchParams({ range });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-500">
            Tool usage patterns, assertion trends, and error analysis
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Time Range:</span>
            <div className="flex gap-1">
              {(["1h", "6h", "24h", "7d"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => handleTimeRangeChange(range)}
                  className={clsx(
                    "px-3 py-1 text-sm font-medium rounded-lg transition-colors",
                    timeRange === range
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tool Usage Panel */}
        <ToolUsagePanel data={toolUsage} />

        {/* Assertion Trends Panel */}
        <AssertionTrendsPanel data={assertions} />

        {/* Execution Duration Panel */}
        <ExecutionDurationPanel data={durations} />

        {/* Error Hotspots Panel */}
        <ErrorHotspotsPanel data={errors} />
      </div>
    </div>
  );
}

// Tool Usage Panel
function ToolUsagePanel({ data }: { data: ToolUsageData | null }) {
  if (!data || !data.tools || data.tools.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Tool Usage Heatmap
        </h3>
        <div className="text-center text-gray-500 py-12">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No tool usage data</p>
          <p className="text-sm text-gray-400 mt-1">
            Tool usage will appear as agents execute tasks
          </p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.tools.map((t) => t.count));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Tool Usage</h3>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-600">
            Total: <strong>{data.summary.total}</strong>
          </span>
          <span className="text-red-600">
            Errors: <strong>{data.summary.errors}</strong>
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {data.tools.slice(0, 10).map((tool) => {
          const percentage = (tool.count / maxCount) * 100;
          const hasErrors = tool.errors > 0;

          return (
            <div key={tool.name} className="flex items-center gap-3">
              <span
                className="w-20 text-sm text-gray-600 truncate"
                title={tool.name}
              >
                {tool.name}
              </span>
              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full transition-all rounded-full",
                    hasErrors
                      ? "bg-gradient-to-r from-green-400 to-red-400"
                      : "bg-green-400",
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-12 text-sm text-gray-700 text-right font-medium">
                {tool.count}
              </span>
              {hasErrors && (
                <span className="text-xs text-red-500">
                  ({tool.errors} err)
                </span>
              )}
            </div>
          );
        })}
      </div>

      {data.summary.errorRate !== "0.0" && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-600">
            Error Rate:{" "}
            <strong className="text-red-600">{data.summary.errorRate}%</strong>
          </span>
        </div>
      )}
    </div>
  );
}

// Assertion Trends Panel
function AssertionTrendsPanel({ data }: { data: AssertionData | null }) {
  if (!data || data.summary.total === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Assertion Trends
        </h3>
        <div className="text-center text-gray-500 py-12">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No assertion data</p>
          <p className="text-sm text-gray-400 mt-1">
            Assertion results will appear here
          </p>
        </div>
      </div>
    );
  }

  const passRate = parseFloat(data.summary.passRate);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Assertion Trends</h3>
        {passRate >= 80 ? (
          <TrendingUp className="h-5 w-5 text-green-500" />
        ) : (
          <TrendingDown className="h-5 w-5 text-red-500" />
        )}
      </div>

      {/* Overall Pass Rate */}
      <div className="flex items-center gap-4 mb-4">
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
          {data.summary.passRate}
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

      {/* Result counts */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 bg-green-50 rounded">
          <CheckCircle className="h-4 w-4 mx-auto text-green-600 mb-1" />
          <p className="text-lg font-bold text-green-700">
            {data.summary.passed}
          </p>
          <p className="text-xs text-green-600">Passed</p>
        </div>
        <div className="text-center p-2 bg-red-50 rounded">
          <XCircle className="h-4 w-4 mx-auto text-red-600 mb-1" />
          <p className="text-lg font-bold text-red-700">
            {data.summary.failed}
          </p>
          <p className="text-xs text-red-600">Failed</p>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <p className="text-lg font-bold text-gray-700">
            {data.summary.skipped}
          </p>
          <p className="text-xs text-gray-600">Skipped</p>
        </div>
        <div className="text-center p-2 bg-yellow-50 rounded">
          <AlertTriangle className="h-4 w-4 mx-auto text-yellow-600 mb-1" />
          <p className="text-lg font-bold text-yellow-700">
            {data.summary.warned}
          </p>
          <p className="text-xs text-yellow-600">Warned</p>
        </div>
      </div>

      {/* By Category */}
      {data.byCategory.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">By Category</p>
          {data.byCategory.slice(0, 5).map((cat) => (
            <div key={cat.category} className="flex items-center gap-2 text-sm">
              <span
                className="w-24 truncate text-gray-600"
                title={cat.category}
              >
                {cat.category}
              </span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${cat.passRate}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-16 text-right">
                {cat.passed}/{cat.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Execution Duration Panel
function ExecutionDurationPanel({ data }: { data: DurationData | null }) {
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (!data || data.summary.totalExecutions === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Execution Duration
        </h3>
        <div className="text-center text-gray-500 py-12">
          <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No duration data</p>
          <p className="text-sm text-gray-400 mt-1">
            Execution times will appear here
          </p>
        </div>
      </div>
    );
  }

  const maxDuration = Math.max(...data.trend.map((e) => e.durationSeconds), 1);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Execution Duration
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">
            {formatDuration(data.summary.avgSeconds)}
          </p>
          <p className="text-xs text-gray-500">Average</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">
            {formatDuration(data.summary.minSeconds)}
          </p>
          <p className="text-xs text-gray-500">Minimum</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-600">
            {formatDuration(data.summary.maxSeconds)}
          </p>
          <p className="text-xs text-gray-500">Maximum</p>
        </div>
      </div>

      {/* Mini Bar Chart */}
      {data.trend.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Recent Executions
          </p>
          <div className="flex items-end gap-1 h-20">
            {data.trend.slice(-20).map((exec, i) => {
              const height = (exec.durationSeconds / maxDuration) * 100;
              return (
                <div
                  key={exec.id || i}
                  className={clsx(
                    "flex-1 rounded-t transition-all cursor-pointer",
                    exec.status === "failed" ? "bg-red-400" : "bg-blue-400",
                  )}
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${formatDuration(exec.durationSeconds)} - ${exec.status}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Oldest</span>
            <span>Most Recent</span>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
        Total Executions: <strong>{data.summary.totalExecutions}</strong>
      </div>
    </div>
  );
}

// Error Hotspots Panel
function ErrorHotspotsPanel({ data }: { data: ErrorData | null }) {
  const hasAnyErrors =
    data &&
    (data.toolErrors.length > 0 ||
      data.assertionFailures.length > 0 ||
      data.failedExecutions.length > 0);

  if (!hasAnyErrors) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Error Hotspots
        </h3>
        <div className="text-center text-gray-500 py-12">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-300" />
          <p className="text-green-600 font-medium">No errors detected</p>
          <p className="text-sm text-gray-400 mt-1">
            System is running smoothly
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Error Hotspots</h3>

      <div className="space-y-4">
        {/* Tool Errors */}
        {data!.toolErrors.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Tool Errors
            </p>
            <div className="space-y-2">
              {data!.toolErrors.slice(0, 5).map((err) => (
                <div
                  key={err.tool}
                  className="flex items-center justify-between p-2 bg-red-50 rounded"
                >
                  <span className="text-sm text-gray-700">{err.tool}</span>
                  <span className="text-sm font-medium text-red-600">
                    {err.count} error{err.count !== 1 && "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assertion Failures */}
        {data!.assertionFailures.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Assertion Failures
            </p>
            <div className="space-y-2">
              {data!.assertionFailures.slice(0, 5).map((fail) => (
                <div
                  key={fail.category}
                  className="flex items-center justify-between p-2 bg-orange-50 rounded"
                >
                  <span className="text-sm text-gray-700">{fail.category}</span>
                  <span className="text-sm font-medium text-orange-600">
                    {fail.count} failure{fail.count !== 1 && "s"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed Executions */}
        {data!.failedExecutions.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Failed Executions
            </p>
            <div className="space-y-2">
              {data!.failedExecutions.slice(0, 3).map((exec) => (
                <div
                  key={exec.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <span className="text-sm text-gray-700">
                    Run #{exec.runNumber}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(exec.startedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
