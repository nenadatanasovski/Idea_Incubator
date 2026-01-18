/**
 * TranscriptEntryPage - Detailed view of a single transcript entry
 */

import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Play,
  Square,
  Wrench,
  Wand2,
  CheckCircle,
  AlertCircle,
  Save,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranscriptEntryDetail } from "../../hooks/useObservability";
import {
  Breadcrumb,
  buildExecutionBreadcrumb,
} from "../../components/observability";
import { buildObservabilityUrl } from "../../utils/observability-urls";
import CrossReferencePanel from "../../components/observability/CrossReferencePanel";

export default function TranscriptEntryPage() {
  const { id: executionId, entryId } = useParams<{
    id: string;
    entryId: string;
  }>();

  const { entry, previousEntry, nextEntry, isLoading, error, refetch } =
    useTranscriptEntryDetail(executionId!, entryId!);

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
          Error loading transcript entry: {error.message}
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

  if (!entry) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-gray-500 text-center py-12">
          Transcript entry not found
        </div>
      </div>
    );
  }

  const breadcrumbSegments = buildExecutionBreadcrumb(executionId!, [
    { label: "Transcript" },
    { label: `#${entry.sequence} ${entry.entryType}` },
  ]);

  const getEntryIcon = () => {
    switch (entry.entryType) {
      case "phase_start":
      case "phase_end":
        return <FileText className="h-6 w-6 text-gray-600" />;
      case "task_start":
        return <Play className="h-6 w-6 text-blue-600" />;
      case "task_end":
        return <Square className="h-6 w-6 text-blue-600" />;
      case "tool_use":
        return <Wrench className="h-6 w-6 text-orange-600" />;
      case "skill_invoke":
      case "skill_complete":
        return <Wand2 className="h-6 w-6 text-purple-600" />;
      case "assertion":
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case "error":
        return <AlertCircle className="h-6 w-6 text-red-600" />;
      case "checkpoint":
        return <Save className="h-6 w-6 text-blue-600" />;
      case "lock_acquire":
        return <Lock className="h-6 w-6 text-yellow-600" />;
      case "lock_release":
        return <Unlock className="h-6 w-6 text-yellow-600" />;
      default:
        return <FileText className="h-6 w-6 text-gray-500" />;
    }
  };

  const getCategoryClass = () => {
    switch (entry.category) {
      case "execution":
        return "bg-blue-100 text-blue-800";
      case "tool":
        return "bg-orange-100 text-orange-800";
      case "skill":
        return "bg-purple-100 text-purple-800";
      case "assertion":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
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
          {getEntryIcon()}
          <h1 className="text-2xl font-bold text-gray-900">
            Transcript Entry #{entry.sequence}
          </h1>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryClass()}`}
          >
            {entry.category}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
          <span>Type: {entry.entryType}</span>
          <span>Timestamp: {new Date(entry.timestamp).toLocaleString()}</span>
          {entry.durationMs && <span>Duration: {entry.durationMs}ms</span>}
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
                <dt className="text-sm text-gray-500">Entry Type</dt>
                <dd className="text-sm font-medium">{entry.entryType}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Category</dt>
                <dd className="text-sm font-medium">{entry.category}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Timestamp</dt>
                <dd className="text-sm font-medium">
                  {new Date(entry.timestamp).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Sequence</dt>
                <dd className="text-sm font-medium">#{entry.sequence}</dd>
              </div>
              {entry.taskId && (
                <div>
                  <dt className="text-sm text-gray-500">Task</dt>
                  <dd className="text-sm font-medium">
                    <Link
                      to={buildObservabilityUrl("task", {
                        id: executionId!,
                        taskId: entry.taskId,
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      {entry.taskId.slice(0, 8)}
                    </Link>
                  </dd>
                </div>
              )}
              {entry.waveNumber && (
                <div>
                  <dt className="text-sm text-gray-500">Wave</dt>
                  <dd className="text-sm font-medium">
                    <Link
                      to={buildObservabilityUrl("wave", {
                        id: executionId!,
                        waveNum: entry.waveNumber,
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      Wave {entry.waveNumber}
                    </Link>
                  </dd>
                </div>
              )}
              {entry.durationMs && (
                <div>
                  <dt className="text-sm text-gray-500">Duration</dt>
                  <dd className="text-sm font-medium">{entry.durationMs}ms</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Summary Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Summary
            </h2>
            <p className="text-sm text-gray-700">
              {entry.summary || "No summary available"}
            </p>
          </section>

          {/* Details Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Details
            </h2>
            {entry.details ? (
              <pre className="text-sm bg-gray-50 p-4 rounded overflow-x-auto">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500">No details available</p>
            )}
          </section>

          {/* Navigation Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Navigation
            </h2>
            <div className="flex items-center gap-4">
              {previousEntry && (
                <Link
                  to={buildObservabilityUrl("transcript", {
                    id: executionId!,
                    entryId: previousEntry.id,
                  })}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>
                    #{previousEntry.sequence} {previousEntry.entryType}
                  </span>
                </Link>
              )}
              {nextEntry && (
                <Link
                  to={buildObservabilityUrl("transcript", {
                    id: executionId!,
                    entryId: nextEntry.id,
                  })}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  <span>
                    #{nextEntry.sequence} {nextEntry.entryType}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </section>
        </div>

        {/* Cross Reference Panel */}
        <div className="lg:col-span-1">
          <CrossReferencePanel
            entityType="transcriptEntry"
            entityId={entryId!}
            executionId={executionId!}
          />
        </div>
      </div>
    </div>
  );
}
