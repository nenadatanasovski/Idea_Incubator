/**
 * SkillTraceDetailPage - Detailed view of a skill invocation trace
 */

import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Wand2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useSkillTraceDetail } from "../../hooks/useObservability";
import {
  Breadcrumb,
  buildExecutionBreadcrumb,
  ObsStatusBadge,
} from "../../components/observability";
import { buildObservabilityUrl } from "../../utils/observability-urls";
import CrossReferencePanel from "../../components/observability/CrossReferencePanel";

export default function SkillTraceDetailPage() {
  const { id: executionId, skillId } = useParams<{
    id: string;
    skillId: string;
  }>();

  const { skillTrace, isLoading, error, refetch } = useSkillTraceDetail(
    executionId!,
    skillId!,
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
          Error loading skill trace: {error.message}
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

  if (!skillTrace) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-gray-500 text-center py-12">
          Skill trace not found
        </div>
      </div>
    );
  }

  const skill = skillTrace.skill || skillTrace;
  const breadcrumbSegments = buildExecutionBreadcrumb(executionId!, [
    { label: "Skills" },
    { label: skill.skillName || skillId!.slice(0, 8) },
  ]);

  const getStatusIcon = () => {
    switch (skill.status) {
      case "success":
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case "failed":
        return <XCircle className="h-6 w-6 text-red-500" />;
      case "partial":
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      default:
        return <Wand2 className="h-6 w-6 text-gray-500" />;
    }
  };

  const durationMs =
    skill.endTime && skill.startTime
      ? new Date(skill.endTime).getTime() - new Date(skill.startTime).getTime()
      : null;

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
          <Wand2 className="h-6 w-6 text-purple-600" />
          {getStatusIcon()}
          <h1 className="text-2xl font-bold text-gray-900">
            {skill.skillName}
          </h1>
          <ObsStatusBadge status={skill.status} size="lg" />
        </div>

        <div className="mt-2 flex items-center gap-6 text-sm text-gray-500">
          <span>ID: {skillId!.slice(0, 8)}</span>
          {durationMs && <span>Duration: {durationMs}ms</span>}
          {skill.tokenEstimate && <span>Tokens: {skill.tokenEstimate}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Skill Reference Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Skill Reference
            </h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Skill Name</dt>
                <dd className="text-sm font-medium">{skill.skillName}</dd>
              </div>
              {skill.skillFile && (
                <div>
                  <dt className="text-sm text-gray-500">File</dt>
                  <dd className="text-sm font-mono">
                    {skill.skillFile}
                    {skill.lineNumber && `:${skill.lineNumber}`}
                  </dd>
                </div>
              )}
              {skill.sectionTitle && (
                <div>
                  <dt className="text-sm text-gray-500">Section</dt>
                  <dd className="text-sm font-medium">{skill.sectionTitle}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="text-sm font-medium">{skill.status}</dd>
              </div>
              {durationMs && (
                <div>
                  <dt className="text-sm text-gray-500">Duration</dt>
                  <dd className="text-sm font-medium">{durationMs}ms</dd>
                </div>
              )}
              {skill.tokenEstimate && (
                <div>
                  <dt className="text-sm text-gray-500">Token Estimate</dt>
                  <dd className="text-sm font-medium">{skill.tokenEstimate}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Invocation Context Section */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Invocation Context
            </h2>
            <dl className="space-y-4">
              {skillTrace.taskId && (
                <div>
                  <dt className="text-sm text-gray-500">Task</dt>
                  <dd className="text-sm font-medium">
                    <Link
                      to={buildObservabilityUrl("task", {
                        id: executionId!,
                        taskId: skillTrace.taskId,
                      })}
                      className="text-blue-600 hover:underline"
                    >
                      {skillTrace.taskId.slice(0, 8)}
                    </Link>
                  </dd>
                </div>
              )}
              {skill.inputSummary && (
                <div>
                  <dt className="text-sm text-gray-500">Input Summary</dt>
                  <dd className="text-sm text-gray-700">
                    {skill.inputSummary}
                  </dd>
                </div>
              )}
              {skill.outputSummary && (
                <div>
                  <dt className="text-sm text-gray-500">Output Summary</dt>
                  <dd className="text-sm text-gray-700">
                    {skill.outputSummary}
                  </dd>
                </div>
              )}
            </dl>

            {skill.errorMessage && (
              <div className="mt-4 p-4 bg-red-50 rounded border border-red-200">
                <strong className="text-red-800">Error:</strong>
                <pre className="mt-2 text-sm text-red-700 whitespace-pre-wrap">
                  {skill.errorMessage}
                </pre>
              </div>
            )}
          </section>

          {/* Tool Calls Section */}
          {skillTrace.toolCalls && skillTrace.toolCalls.length > 0 && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Tool Calls ({skillTrace.toolCalls.length})
              </h2>
              <div className="space-y-2">
                {skillTrace.toolCalls.map((call, index) => (
                  <Link
                    key={call.toolUseId}
                    to={buildObservabilityUrl("tool", {
                      id: executionId!,
                      toolId: call.toolUseId,
                    })}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm">
                      <span className="font-medium">
                        {index + 1}. {call.tool}
                      </span>
                      <span className="text-gray-500 ml-2">
                        - {call.inputSummary}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <ObsStatusBadge status={call.resultStatus} size="sm" />
                      <span className="text-xs text-gray-500">
                        {call.durationMs}ms
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Assertions Section */}
          {skillTrace.assertions && skillTrace.assertions.length > 0 && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Assertions ({skillTrace.assertions.length})
              </h2>
              <div className="space-y-2">
                {skillTrace.assertions.map((assertion) => (
                  <Link
                    key={assertion.id}
                    to={buildObservabilityUrl("assertion", {
                      id: executionId!,
                      assertId: assertion.id,
                    })}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm">
                      <span className="font-medium">{assertion.category}</span>
                      <span className="text-gray-500 ml-2">
                        : {assertion.description}
                      </span>
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        assertion.result === "pass"
                          ? "bg-green-100 text-green-800"
                          : assertion.result === "fail"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {assertion.result}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Cross Reference Panel */}
        <div className="lg:col-span-1">
          <CrossReferencePanel
            entityType="skillTrace"
            entityId={skillId!}
            executionId={executionId!}
          />
        </div>
      </div>
    </div>
  );
}
