/**
 * AssertionDashboard - Assertion pass/fail overview with category breakdown
 */

import { useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MinusCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  useAssertions,
  useAssertionSummary,
} from "../../hooks/useObservability";
import type { AssertionResultEntry } from "../../types/observability";

interface AssertionDashboardProps {
  executionId: string;
  onAssertionClick?: (assertion: AssertionResultEntry) => void;
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
  const { summary, loading: summaryLoading } = useAssertionSummary(executionId);
  const { assertions, loading: assertionsLoading } = useAssertions(
    executionId,
    { limit: 100 },
  );

  const loading = summaryLoading || assertionsLoading;

  const failedAssertions = useMemo(
    () => assertions.filter((a) => a.result === "fail"),
    [assertions],
  );

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
      {/* Overall health */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">
            Overall Pass Rate
          </h3>
          {passRate >= 80 ? (
            <TrendingUp className="h-5 w-5 text-green-500" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-500" />
          )}
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
          <span className="text-green-600">{summary.passed} passed</span>
          <span className="text-red-600">{summary.failed} failed</span>
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
