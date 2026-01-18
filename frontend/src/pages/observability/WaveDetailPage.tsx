/**
 * WaveDetailPage - Detailed view of an execution wave
 */

import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Layers,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useWaveDetail } from "../../hooks/useObservability";
import {
  Breadcrumb,
  buildExecutionBreadcrumb,
  ObsStatusBadge,
} from "../../components/observability";
import { buildObservabilityUrl } from "../../utils/observability-urls";

export default function WaveDetailPage() {
  const { id: executionId, waveNum } = useParams<{
    id: string;
    waveNum: string;
  }>();
  const waveNumber = parseInt(waveNum!, 10);

  const { wave, tasks, agents, navigation, isLoading, error, refetch } =
    useWaveDetail(executionId!, waveNumber);

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
          Error loading wave: {error.message}
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

  if (!wave) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-gray-500 text-center py-12">Wave not found</div>
      </div>
    );
  }

  const breadcrumbSegments = buildExecutionBreadcrumb(executionId!, [
    { label: "Waves" },
    { label: `Wave ${waveNumber}` },
  ]);

  const getStatusIcon = () => {
    switch (wave.status) {
      case "completed":
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case "failed":
        return <XCircle className="h-6 w-6 text-red-500" />;
      case "running":
        return <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />;
      case "pending":
        return <Clock className="h-6 w-6 text-gray-400" />;
      default:
        return <Layers className="h-6 w-6 text-gray-500" />;
    }
  };

  const completedTasks =
    tasks?.filter((t) => t.status === "completed").length || 0;
  const totalTasks = tasks?.length || 0;
  const progressPercent =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

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
          <Layers className="h-6 w-6 text-gray-600" />
          {getStatusIcon()}
          <h1 className="text-2xl font-bold text-gray-900">
            Wave {waveNumber}
          </h1>
          <ObsStatusBadge status={wave.status} size="lg" />
        </div>

        <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
          {wave.startedAt && (
            <span>Started: {new Date(wave.startedAt).toLocaleString()}</span>
          )}
          {wave.completedAt && (
            <span>
              Completed: {new Date(wave.completedAt).toLocaleString()}
            </span>
          )}
          {wave.durationMs && (
            <span>Duration: {(wave.durationMs / 1000).toFixed(2)}s</span>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Overview Section */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="text-sm font-medium">{wave.status}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Task Count</dt>
              <dd className="text-sm font-medium">{wave.taskCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Max Parallel Agents</dt>
              <dd className="text-sm font-medium">{wave.maxParallelAgents}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Duration</dt>
              <dd className="text-sm font-medium">
                {wave.durationMs
                  ? `${(wave.durationMs / 1000).toFixed(2)}s`
                  : "-"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Progress Section */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                {completedTasks} of {totalTasks} tasks completed
              </span>
              <span className="font-medium">{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </section>

        {/* Tasks Section */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Tasks in Wave ({tasks?.length || 0})
          </h2>
          {tasks && tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  to={buildObservabilityUrl("task", {
                    id: executionId!,
                    taskId: task.id,
                  })}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {task.displayId || task.id.slice(0, 8)}
                  </span>
                  <ObsStatusBadge status={task.status} size="sm" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No tasks in this wave</p>
          )}
        </section>

        {/* Agents Section */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Agents ({agents?.length || 0})
          </h2>
          {agents && agents.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {agents.map((agent) => (
                <div key={agent.id} className="p-3 bg-gray-50 rounded text-sm">
                  <div className="font-medium">
                    {agent.name || agent.id.slice(0, 8)}
                  </div>
                  <div className="text-gray-500">{agent.status}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No agents assigned to this wave</p>
          )}
        </section>

        {/* Wave Navigation */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Wave Navigation
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {(navigation?.hasPrevious ?? waveNumber > 1) && (
                <Link
                  to={buildObservabilityUrl("wave", {
                    id: executionId!,
                    waveNum: waveNumber - 1,
                  })}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Wave {waveNumber - 1}
                </Link>
              )}
              {navigation?.hasNext && (
                <Link
                  to={buildObservabilityUrl("wave", {
                    id: executionId!,
                    waveNum: waveNumber + 1,
                  })}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  Wave {waveNumber + 1}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
            {navigation && (
              <span className="text-sm text-gray-500">
                Wave {navigation.current} of {navigation.total}
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
