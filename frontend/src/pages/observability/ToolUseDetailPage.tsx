/**
 * ToolUseDetailPage - Detailed view of a tool invocation
 */

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Wrench,
  AlertCircle,
  Ban,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToolUseDetail } from "../../hooks/useObservability";
import {
  Breadcrumb,
  buildExecutionBreadcrumb,
  ObsStatusBadge,
} from "../../components/observability";
import { buildObservabilityUrl } from "../../utils/observability-urls";
import CrossReferencePanel from "../../components/observability/CrossReferencePanel";

export default function ToolUseDetailPage() {
  const { id: executionId, toolId } = useParams<{
    id: string;
    toolId: string;
  }>();
  const [showFullInput, setShowFullInput] = useState(false);
  const [showFullOutput, setShowFullOutput] = useState(false);

  const { toolUse, isLoading, error, refetch } = useToolUseDetail(
    executionId!,
    toolId!,
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
          Error loading tool use: {error.message}
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

  if (!toolUse) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-gray-500 text-center py-12">
          Tool use not found
        </div>
      </div>
    );
  }

  const breadcrumbSegments = buildExecutionBreadcrumb(executionId!, [
    { label: "Tool Uses" },
    { label: `${toolUse.tool} (${toolId!.slice(0, 8)})` },
  ]);

  const getStatusIcon = () => {
    if (toolUse.isBlocked) return <Ban className="h-5 w-5 text-orange-500" />;
    if (toolUse.isError)
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    return <CheckCircle className="h-5 w-5 text-green-500" />;
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
          <Wrench className="h-6 w-6 text-gray-600" />
          {getStatusIcon()}
          <h1 className="text-2xl font-bold text-gray-900">{toolUse.tool}</h1>
          <ObsStatusBadge status={toolUse.resultStatus} size="lg" />
        </div>

        <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
          <span>ID: {toolUse.id.slice(0, 8)}</span>
          <span>Duration: {toolUse.durationMs}ms</span>
          <span>Category: {toolUse.toolCategory}</span>
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
                <dt className="text-sm text-gray-500">Tool</dt>
                <dd className="text-sm font-medium">{toolUse.tool}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Category</dt>
                <dd className="text-sm font-medium">{toolUse.toolCategory}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="text-sm font-medium">{toolUse.resultStatus}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Duration</dt>
                <dd className="text-sm font-medium">{toolUse.durationMs}ms</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Start Time</dt>
                <dd className="text-sm font-medium">
                  {new Date(toolUse.startTime).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">End Time</dt>
                <dd className="text-sm font-medium">
                  {new Date(toolUse.endTime).toLocaleString()}
                </dd>
              </div>
            </dl>
          </section>

          {/* Input Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Input</h2>
              <button
                onClick={() => setShowFullInput(!showFullInput)}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                {showFullInput ? (
                  <>
                    Collapse <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Expand <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
            {showFullInput ? (
              <pre className="text-sm bg-gray-50 p-4 rounded overflow-x-auto">
                {JSON.stringify(toolUse.input, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-gray-600">
                {toolUse.inputSummary || "No input summary available"}
              </p>
            )}
          </section>

          {/* Output Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Output</h2>
              <button
                onClick={() => setShowFullOutput(!showFullOutput)}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                {showFullOutput ? (
                  <>
                    Collapse <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Expand <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
            {showFullOutput && toolUse.output ? (
              <pre className="text-sm bg-gray-50 p-4 rounded overflow-x-auto">
                {JSON.stringify(toolUse.output, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-gray-600">
                {toolUse.outputSummary || "No output summary available"}
              </p>
            )}
          </section>

          {/* Error Section */}
          {toolUse.isError && (
            <section className="bg-red-50 rounded-lg shadow p-6 border border-red-200">
              <h2 className="text-lg font-semibold text-red-800 mb-4">Error</h2>
              <pre className="text-sm text-red-700 whitespace-pre-wrap">
                {toolUse.errorMessage || "Unknown error"}
              </pre>
            </section>
          )}

          {/* Blocked Section */}
          {toolUse.isBlocked && (
            <section className="bg-orange-50 rounded-lg shadow p-6 border border-orange-200">
              <h2 className="text-lg font-semibold text-orange-800 mb-4">
                Blocked
              </h2>
              <p className="text-sm text-orange-700">
                {toolUse.blockReason || "No reason provided"}
              </p>
            </section>
          )}
        </div>

        {/* Cross Reference Panel */}
        <div className="lg:col-span-1">
          <CrossReferencePanel
            entityType="toolUse"
            entityId={toolId!}
            executionId={executionId!}
          />
        </div>
      </div>
    </div>
  );
}
