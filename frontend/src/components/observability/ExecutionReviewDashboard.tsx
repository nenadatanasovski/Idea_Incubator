/**
 * ExecutionReviewDashboard - Full review interface for a single execution
 *
 * Features:
 * - Summary section with key metrics
 * - Assertions list with evidence links
 * - Unified transcript with search
 * - Skills used summary
 * - Export options (JSON, PDF report)
 */

import { useState, useMemo, useCallback } from "react";
import {
  Download,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Activity,
  FileText,
  ChevronDown,
  ChevronRight,
  Play,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import {
  useExecution,
  useAssertions,
  useAssertionSummary,
  useToolSummary,
  useSkillTraces,
  useTranscript,
} from "../../hooks/useObservability";
import type {
  AssertionResultEntry,
  SkillTrace,
} from "../../types/observability";

interface ExecutionReviewDashboardProps {
  executionId: string;
  onAssertionClick?: (assertion: AssertionResultEntry) => void;
  onSkillClick?: (skillId: string) => void;
  onTranscriptEntryClick?: (entryId: string) => void;
}

type SectionId =
  | "summary"
  | "assertions"
  | "transcript"
  | "skills"
  | "discoveries";

export default function ExecutionReviewDashboard({
  executionId,
  onAssertionClick,
  onSkillClick,
  onTranscriptEntryClick,
}: ExecutionReviewDashboardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(["summary", "assertions"]),
  );
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [assertionFilter, setAssertionFilter] = useState<
    "all" | "pass" | "fail"
  >("all");

  // Fetch data
  const { execution, loading: executionLoading } = useExecution(executionId);
  const { assertions, loading: assertionsLoading } = useAssertions(
    executionId,
    { limit: 100 },
  );
  const { summary: assertionSummary } = useAssertionSummary(executionId);
  const { summary: toolSummary } = useToolSummary(executionId);
  const { skills } = useSkillTraces(executionId, { limit: 100 });
  const { entries: transcriptEntries, loading: transcriptLoading } =
    useTranscript(executionId, { limit: 500 });

  const loading = executionLoading || assertionsLoading || transcriptLoading;

  // Toggle section
  const toggleSection = useCallback((section: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const isExpanded = (section: SectionId) => expandedSections.has(section);

  // Filter assertions
  const filteredAssertions = useMemo(() => {
    if (assertionFilter === "all") return assertions;
    return assertions.filter((a) => a.result === assertionFilter);
  }, [assertions, assertionFilter]);

  // Filter transcript
  const filteredTranscript = useMemo(() => {
    if (!transcriptSearch.trim()) return transcriptEntries;
    const search = transcriptSearch.toLowerCase();
    return transcriptEntries.filter(
      (entry) =>
        entry.summary?.toLowerCase().includes(search) ||
        entry.entryType?.toLowerCase().includes(search),
    );
  }, [transcriptEntries, transcriptSearch]);

  // Export as JSON
  const handleExportJSON = useCallback(() => {
    const data = {
      execution,
      assertions,
      assertionSummary,
      toolSummary,
      skills,
      transcript: transcriptEntries,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `execution-${executionId.slice(0, 8)}-review.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    execution,
    assertions,
    assertionSummary,
    toolSummary,
    skills,
    transcriptEntries,
    executionId,
  ]);

  // Calculate duration
  const duration = useMemo(() => {
    if (!execution?.startedAt) return null;
    const start = new Date(execution.startedAt).getTime();
    const end = execution.completedAt
      ? new Date(execution.completedAt).getTime()
      : Date.now();
    const ms = end - start;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000)
      return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }, [execution]);

  if (loading && !execution) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-32 bg-gray-100 rounded-lg" />
        <div className="h-48 bg-gray-100 rounded-lg" />
        <div className="h-64 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="p-8 text-center text-gray-500">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>Execution not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Execution Review
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border rounded-md hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100"
          onClick={() => toggleSection("summary")}
        >
          {isExpanded("summary") ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Activity className="h-4 w-4 text-blue-500" />
          <span className="font-medium">Summary</span>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded ${
              execution.status === "completed"
                ? "bg-green-100 text-green-700"
                : execution.status === "failed"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {execution.status}
          </span>
        </button>
        {isExpanded("summary") && (
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Status */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  {execution.status === "completed" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : execution.status === "failed" ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Play className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="text-xs text-gray-500">Status</span>
                </div>
                <span className="text-lg font-semibold capitalize">
                  {execution.status}
                </span>
              </div>

              {/* Duration */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-xs text-gray-500">Duration</span>
                </div>
                <span className="text-lg font-semibold">{duration || "-"}</span>
              </div>

              {/* Tool Calls */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-gray-500">Tool Calls</span>
                </div>
                <span className="text-lg font-semibold">
                  {toolSummary?.total ?? 0}
                </span>
              </div>

              {/* Pass Rate */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-gray-500">Pass Rate</span>
                </div>
                <span className="text-lg font-semibold">
                  {assertionSummary
                    ? `${(assertionSummary.passRate * 100).toFixed(0)}%`
                    : "-"}
                </span>
              </div>
            </div>

            {/* Additional stats */}
            <div className="mt-4 flex gap-4 text-sm">
              <span className="text-gray-600">
                Run #{execution.runNumber} ·{" "}
                {new Date(execution.startedAt).toLocaleString()}
              </span>
              {execution.taskListId && (
                <span className="text-gray-500">
                  Task List: {execution.taskListId.slice(0, 8)}...
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assertions Section */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="flex items-center bg-gray-50">
          <button
            className="flex-1 flex items-center gap-2 px-4 py-3 hover:bg-gray-100"
            onClick={() => toggleSection("assertions")}
          >
            {isExpanded("assertions") ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="font-medium">Assertions</span>
            <span className="text-xs text-gray-500 ml-2">
              {assertionSummary?.passed ?? 0}/{assertionSummary?.total ?? 0}{" "}
              passed
            </span>
          </button>
          {isExpanded("assertions") && (
            <div className="flex items-center gap-1 pr-2">
              <button
                onClick={() => setAssertionFilter("all")}
                className={`px-2 py-1 text-xs rounded ${
                  assertionFilter === "all"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setAssertionFilter("pass")}
                className={`px-2 py-1 text-xs rounded ${
                  assertionFilter === "pass"
                    ? "bg-green-100 text-green-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Pass
              </button>
              <button
                onClick={() => setAssertionFilter("fail")}
                className={`px-2 py-1 text-xs rounded ${
                  assertionFilter === "fail"
                    ? "bg-red-100 text-red-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Fail
              </button>
            </div>
          )}
        </div>
        {isExpanded("assertions") && (
          <div className="divide-y max-h-64 overflow-auto">
            {filteredAssertions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No assertions found
              </div>
            ) : (
              filteredAssertions.map((assertion) => (
                <button
                  key={assertion.id}
                  onClick={() => onAssertionClick?.(assertion)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                >
                  {assertion.result === "pass" ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {assertion.description}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">
                        {assertion.category}
                      </span>
                      {assertion.evidence && (
                        <span className="text-xs text-blue-600">
                          Has evidence
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Transcript Section */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="flex items-center bg-gray-50">
          <button
            className="flex-1 flex items-center gap-2 px-4 py-3 hover:bg-gray-100"
            onClick={() => toggleSection("transcript")}
          >
            {isExpanded("transcript") ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <FileText className="h-4 w-4 text-purple-500" />
            <span className="font-medium">Transcript</span>
            <span className="text-xs text-gray-500 ml-2">
              {transcriptEntries.length} entries
            </span>
          </button>
          {isExpanded("transcript") && (
            <div className="relative pr-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search..."
                className="pl-7 pr-2 py-1 text-xs border rounded w-40"
              />
            </div>
          )}
        </div>
        {isExpanded("transcript") && (
          <div className="divide-y max-h-80 overflow-auto">
            {filteredTranscript.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {transcriptSearch
                  ? "No matches found"
                  : "No transcript entries"}
              </div>
            ) : (
              filteredTranscript.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onTranscriptEntryClick?.(entry.id)}
                  className="w-full flex items-start gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                >
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                      entry.entryType === "tool_use"
                        ? "bg-purple-100 text-purple-700"
                        : entry.entryType === "skill_invoke"
                          ? "bg-indigo-100 text-indigo-700"
                          : entry.entryType === "error"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {entry.entryType}
                  </span>
                  <p className="text-sm text-gray-700 line-clamp-2 flex-1">
                    {entry.summary?.slice(0, 200) || "(empty)"}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Skills Section */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100"
          onClick={() => toggleSection("skills")}
        >
          {isExpanded("skills") ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Lightbulb className="h-4 w-4 text-teal-500" />
          <span className="font-medium">Skills Used</span>
          <span className="text-xs text-gray-500 ml-2">
            {skills.length} invocations
          </span>
        </button>
        {isExpanded("skills") && (
          <div className="p-4">
            {skills.length === 0 ? (
              <div className="text-center text-gray-500 text-sm">
                No skills invoked
              </div>
            ) : (
              <div className="space-y-2">
                {/* Group by skill name */}
                {Object.entries(
                  skills.reduce(
                    (acc: Record<string, SkillTrace[]>, inv: SkillTrace) => {
                      const name = inv.skillName || "Unknown";
                      if (!acc[name]) acc[name] = [];
                      acc[name].push(inv);
                      return acc;
                    },
                    {} as Record<string, SkillTrace[]>,
                  ),
                ).map(([skillName, invocations]) => (
                  <div
                    key={skillName}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-teal-500" />
                      <span className="text-sm font-medium">{skillName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500">
                        {invocations.length}x
                      </span>
                      <button
                        onClick={() => onSkillClick?.(invocations[0].id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tool Summary */}
      {toolSummary && (
        <div className="bg-white border rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            Tool Summary
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {toolSummary.total}
              </div>
              <div className="text-xs text-gray-500">Total Calls</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {toolSummary.byStatus?.done ?? 0}
              </div>
              <div className="text-xs text-gray-500">Successful</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {toolSummary.byStatus?.error ?? 0}
              </div>
              <div className="text-xs text-gray-500">Errors</div>
            </div>
          </div>
          {toolSummary.byTool && Object.keys(toolSummary.byTool).length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h5 className="text-xs font-medium text-gray-500 mb-2">
                By Tool
              </h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(toolSummary.byTool).map(([tool, count]) => (
                  <span
                    key={tool}
                    className="px-2 py-1 text-xs bg-gray-100 rounded"
                  >
                    {tool}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
