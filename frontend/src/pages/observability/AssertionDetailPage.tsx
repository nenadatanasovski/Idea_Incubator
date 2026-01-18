/**
 * AssertionDetailPage - Detailed view of an assertion result
 */

import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  SkipForward,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAssertionDetail } from "../../hooks/useObservability";
import {
  Breadcrumb,
  buildExecutionBreadcrumb,
} from "../../components/observability";
import { buildObservabilityUrl } from "../../utils/observability-urls";
import CrossReferencePanel from "../../components/observability/CrossReferencePanel";

export default function AssertionDetailPage() {
  const { id: executionId, assertId } = useParams<{
    id: string;
    assertId: string;
  }>();

  const { assertion, chainInfo, isLoading, error, refetch } =
    useAssertionDetail(executionId!, assertId!);

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
          Error loading assertion: {error.message}
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

  if (!assertion) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-gray-500 text-center py-12">
          Assertion not found
        </div>
      </div>
    );
  }

  const breadcrumbSegments = buildExecutionBreadcrumb(executionId!, [
    { label: "Assertions" },
    { label: `${assertion.category} (${assertion.result})` },
  ]);

  const getResultIcon = () => {
    switch (assertion.result) {
      case "pass":
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case "fail":
        return <XCircle className="h-6 w-6 text-red-500" />;
      case "skip":
        return <SkipForward className="h-6 w-6 text-gray-400" />;
      case "warn":
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getResultClass = () => {
    switch (assertion.result) {
      case "pass":
        return "bg-green-100 text-green-800";
      case "fail":
        return "bg-red-100 text-red-800";
      case "skip":
        return "bg-gray-100 text-gray-800";
      case "warn":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
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
          {getResultIcon()}
          <h1 className="text-2xl font-bold text-gray-900">
            {assertion.category}
          </h1>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getResultClass()}`}
          >
            {assertion.result.toUpperCase()}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
          <span>ID: {assertion.id.slice(0, 8)}</span>
          <span>
            Timestamp: {new Date(assertion.timestamp).toLocaleString()}
          </span>
          {assertion.durationMs && (
            <span>Duration: {assertion.durationMs}ms</span>
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
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500">Category</dt>
                <dd className="text-sm font-medium">{assertion.category}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Description</dt>
                <dd className="text-sm font-medium">{assertion.description}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Result</dt>
                <dd className="text-sm font-medium">{assertion.result}</dd>
              </div>
              {assertion.taskId && (
                <div>
                  <dt className="text-sm text-gray-500">Task</dt>
                  <dd className="text-sm font-medium">
                    <Link
                      to={buildObservabilityUrl("task", {
                        id: executionId!,
                        taskId: assertion.taskId,
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      {assertion.taskId.slice(0, 8)}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Evidence Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Evidence
            </h2>
            {assertion.evidence ? (
              <pre className="text-sm bg-gray-50 p-4 rounded overflow-x-auto">
                {JSON.stringify(assertion.evidence, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500">No evidence recorded</p>
            )}
          </section>

          {/* Chain Navigation */}
          {chainInfo && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Assertion Chain
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Position {chainInfo.position} of {chainInfo.total} in chain
              </p>
              <div className="flex items-center gap-4">
                {chainInfo.previousId && (
                  <Link
                    to={buildObservabilityUrl("assertion", {
                      id: executionId!,
                      assertId: chainInfo.previousId,
                    })}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Link>
                )}
                {chainInfo.nextId && (
                  <Link
                    to={buildObservabilityUrl("assertion", {
                      id: executionId!,
                      assertId: chainInfo.nextId,
                    })}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Cross Reference Panel */}
        <div className="lg:col-span-1">
          <CrossReferencePanel
            entityType="assertion"
            entityId={assertId!}
            executionId={executionId!}
          />
        </div>
      </div>
    </div>
  );
}
