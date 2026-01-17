/**
 * AssertionList - List of assertions with pass/fail visualization
 */

import { useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, ChevronDown } from "lucide-react";
import {
  useAssertions,
  useAssertionSummary,
} from "../../hooks/useObservability";
import ObsStatusBadge from "./ObsStatusBadge";
import type { AssertionResultEntry } from "../../types/observability";

interface AssertionListProps {
  executionId: string;
  onAssertionClick?: (assertion: AssertionResultEntry) => void;
}

export default function AssertionList({
  executionId,
  onAssertionClick,
}: AssertionListProps) {
  const [showOnlyFailed, setShowOnlyFailed] = useState(false);

  const { assertions, loading, error, total } = useAssertions(executionId, {
    result: showOnlyFailed ? "fail" : undefined,
    limit: 100,
  });

  const { summary } = useAssertionSummary(executionId);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded">
        Error loading assertions: {error.message}
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar */}
      {summary && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-600">{summary.passed}</span>
            <span className="text-gray-500 text-sm">passed</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="font-medium text-red-600">{summary.failed}</span>
            <span className="text-gray-500 text-sm">failed</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <span className="font-medium text-yellow-600">
              {summary.warned}
            </span>
            <span className="text-gray-500 text-sm">warned</span>
          </div>

          <div className="flex-1" />

          {/* Pass rate bar */}
          <div className="w-32">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(summary.passRate * 100).toFixed(0)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {(summary.passRate * 100).toFixed(0)}% pass rate
            </span>
          </div>
        </div>
      )}

      {/* Filter toggle */}
      <div className="flex items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyFailed}
            onChange={(e) => setShowOnlyFailed(e.target.checked)}
            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          Show only failed
        </label>
        <span className="text-sm text-gray-500 ml-auto">
          {assertions.length} of {total}
        </span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {assertions.length === 0 ? (
          <div className="text-gray-500 p-4 text-center">
            No assertions found
          </div>
        ) : (
          assertions.map((assertion) => (
            <AssertionItem
              key={assertion.id}
              assertion={assertion}
              onClick={() => onAssertionClick?.(assertion)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface AssertionItemProps {
  assertion: AssertionResultEntry;
  onClick?: () => void;
}

function AssertionItem({ assertion, onClick }: AssertionItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        assertion.result === "fail" ? "border-red-200" : "border-gray-200"
      }`}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onClick}
      >
        <ObsStatusBadge status={assertion.result} size="sm" showLabel={false} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {assertion.description}
          </p>
          <p className="text-xs text-gray-500">{assertion.category}</p>
        </div>

        {assertion.evidence && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>

      {expanded && assertion.evidence && (
        <div className="p-3 bg-gray-50 border-t text-xs font-mono">
          {assertion.evidence.command && (
            <div className="mb-2">
              <span className="text-gray-500">Command: </span>
              <code className="bg-gray-200 px-1 rounded">
                {assertion.evidence.command}
              </code>
            </div>
          )}
          {assertion.evidence.exitCode !== undefined && (
            <div className="mb-2">
              <span className="text-gray-500">Exit code: </span>
              <span
                className={
                  assertion.evidence.exitCode === 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {assertion.evidence.exitCode}
              </span>
            </div>
          )}
          {assertion.evidence.stderr && (
            <div className="mt-2 p-2 bg-red-100 rounded text-red-800 max-h-32 overflow-auto">
              {assertion.evidence.stderr}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
