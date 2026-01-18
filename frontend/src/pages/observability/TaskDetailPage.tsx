/**
 * TaskDetailPage - Detailed view of a task within an execution
 */

import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useTaskDetail } from "../../hooks/useObservability";
import {
  Breadcrumb,
  buildExecutionBreadcrumb,
  ObsStatusBadge,
} from "../../components/observability";
import { buildObservabilityUrl } from "../../utils/observability-urls";
import CrossReferencePanel from "../../components/observability/CrossReferencePanel";

export default function TaskDetailPage() {
  const { id: executionId, taskId } = useParams<{
    id: string;
    taskId: string;
  }>();
  const { task, isLoading, error, refetch } = useTaskDetail(
    executionId!,
    taskId!,
  );

  if (isLoading) {
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
          Error loading task: {error.message}
          <button
            onClick={() => refetch()}
            className="ml-4 text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-gray-500 text-center py-12">Task not found</div>
      </div>
    );
  }

  const breadcrumbSegments = buildExecutionBreadcrumb(executionId!, [
    { label: "Tasks" },
    { label: task.displayId || task.id.slice(0, 8) },
  ]);

  const getStatusIcon = () => {
    switch (task.status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "in_progress":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        to={buildObservabilityUrl("execution", { id: executionId! })}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Execution
      </Link>

      {/* Breadcrumb */}
      <Breadcrumb segments={breadcrumbSegments} />

      {/* Header */}
      <div className="mt-6 mb-8">
        <div className="flex items-center gap-4">
          {getStatusIcon()}
          <h1 className="text-2xl font-bold text-gray-900">
            {task.displayId || task.title || "Task"}
          </h1>
          <ObsStatusBadge status={task.status} size="lg" />
        </div>

        <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
          <span>ID: {task.id.slice(0, 8)}</span>
          {task.startedAt && (
            <span>Started: {new Date(task.startedAt).toLocaleString()}</span>
          )}
          {task.completedAt && (
            <span>
              Completed: {new Date(task.completedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Overview
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Title</dt>
                <dd className="text-sm font-medium">{task.title || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="text-sm font-medium">{task.status}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Duration</dt>
                <dd className="text-sm font-medium">
                  {task.durationMs
                    ? `${(task.durationMs / 1000).toFixed(2)}s`
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Wave</dt>
                <dd className="text-sm font-medium">
                  {task.waveNumber ? (
                    <Link
                      to={buildObservabilityUrl("wave", {
                        id: executionId!,
                        waveNum: task.waveNumber,
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      Wave {task.waveNumber}
                    </Link>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Tool Uses Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Tool Uses
            </h2>
            {task.toolUseCount > 0 ? (
              <div className="text-sm">
                <p className="text-gray-600">
                  {task.toolUseCount} tool invocations
                </p>
                <Link
                  to={`${buildObservabilityUrl("execution", { id: executionId! })}?task=${taskId}`}
                  className="text-blue-600 hover:underline mt-2 inline-block"
                >
                  View in Timeline
                </Link>
              </div>
            ) : (
              <p className="text-gray-500">No tool uses recorded</p>
            )}
          </section>

          {/* Assertions Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Assertions
            </h2>
            {task.assertionCount > 0 ? (
              <div className="text-sm">
                <p className="text-gray-600">
                  {task.passedAssertions}/{task.assertionCount} passed (
                  {(
                    (task.passedAssertions / task.assertionCount) *
                    100
                  ).toFixed(0)}
                  %)
                </p>
              </div>
            ) : (
              <p className="text-gray-500">No assertions recorded</p>
            )}
          </section>
        </div>

        {/* Cross Reference Panel */}
        <div className="lg:col-span-1">
          <CrossReferencePanel
            entityType="task"
            entityId={taskId!}
            executionId={executionId!}
          />
        </div>
      </div>
    </div>
  );
}
