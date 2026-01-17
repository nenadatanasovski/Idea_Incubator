/**
 * ExecutionList - List of execution runs
 */

import { Link } from "react-router-dom";
import { Clock, ChevronRight, Play } from "lucide-react";
import { useExecutions } from "../../hooks/useObservability";
import ObsStatusBadge from "./ObsStatusBadge";
import type { ExecutionRun } from "../../types/observability";

interface ExecutionListProps {
  onExecutionSelect?: (execution: ExecutionRun) => void;
}

export default function ExecutionList({
  onExecutionSelect,
}: ExecutionListProps) {
  const { executions, loading, error, total, hasMore, refetch } = useExecutions(
    {
      limit: 20,
    },
  );

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded">
        Error loading executions: {error.message}
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="text-center py-12">
        <Play className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No executions yet
        </h3>
        <p className="text-gray-500">
          Start a task list execution to see observability data
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-500">{total} executions</div>

      {executions.map((execution) => (
        <ExecutionCard
          key={execution.id}
          execution={execution}
          onClick={() => onExecutionSelect?.(execution)}
        />
      ))}

      {hasMore && (
        <button
          onClick={refetch}
          className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
        >
          Load more...
        </button>
      )}
    </div>
  );
}

interface ExecutionCardProps {
  execution: ExecutionRun;
  onClick?: () => void;
}

function ExecutionCard({ execution, onClick }: ExecutionCardProps) {
  const duration =
    execution.completedAt && execution.startedAt
      ? new Date(execution.completedAt).getTime() -
        new Date(execution.startedAt).getTime()
      : null;

  return (
    <Link
      to={`/observability/executions/${execution.id}`}
      className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ObsStatusBadge status={execution.status} />

          <div>
            <div className="font-medium text-sm">
              Run #{execution.runNumber}
            </div>
            <div className="text-xs text-gray-500">
              {execution.id.slice(0, 8)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          {duration !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(duration)}
            </span>
          )}

          <span>
            {execution.taskCount > 0
              ? `${execution.completedCount}/${execution.taskCount} tasks`
              : "No tasks"}
          </span>

          <ChevronRight className="h-4 w-4" />
        </div>
      </div>

      {/* Progress bar */}
      {execution.taskCount > 0 && (
        <div className="mt-3">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
            <div
              className="bg-green-500"
              style={{
                width: `${(execution.completedCount / execution.taskCount) * 100}%`,
              }}
            />
            {execution.failedCount > 0 && (
              <div
                className="bg-red-500"
                style={{
                  width: `${(execution.failedCount / execution.taskCount) * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-2 text-xs text-gray-400">
        Started {new Date(execution.startedAt).toLocaleString()}
      </div>
    </Link>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000)
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
