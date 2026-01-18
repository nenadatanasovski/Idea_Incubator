/**
 * ExecutionReviewPage - Detailed view of a single execution
 */

import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useExecution } from "../hooks/useObservability";
import {
  Breadcrumb,
  buildExecutionBreadcrumb,
  ObsStatusBadge,
  ExecutionReviewDashboard,
} from "../components/observability";

export default function ExecutionReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { execution, loading, error } = useExecution(id);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-200 rounded w-96" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-red-500 p-4 bg-red-50 rounded">
          Error loading execution: {error.message}
        </div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-gray-500 text-center py-12">
          Execution not found
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        to="/observability"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Executions
      </Link>

      {/* Breadcrumb */}
      <Breadcrumb segments={buildExecutionBreadcrumb(execution.id)} />

      {/* Header */}
      <div className="mt-6 mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Execution Run #{execution.runNumber}
          </h1>
          <ObsStatusBadge status={execution.status} size="lg" />
        </div>

        <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
          <span>ID: {execution.id.slice(0, 8)}</span>
          <span>Started: {new Date(execution.startedAt).toLocaleString()}</span>
          {execution.completedAt && (
            <span>
              Completed: {new Date(execution.completedAt).toLocaleString()}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Waves:</span>{" "}
            <span className="font-medium">{execution.waveCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Tasks:</span>{" "}
            <span className="font-medium">{execution.taskCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Completed:</span>{" "}
            <span className="font-medium text-green-600">
              {execution.completedCount}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Failed:</span>{" "}
            <span className="font-medium text-red-600">
              {execution.failedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Review Dashboard */}
      <div className="space-y-6">
        <ExecutionReviewDashboard executionId={execution.id} />
      </div>
    </div>
  );
}
