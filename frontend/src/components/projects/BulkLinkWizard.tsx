/**
 * BulkLinkWizard - Wizard to link multiple orphan tasks to PRD requirements at once
 *
 * Used when a project has existing tasks that weren't created through the traceability
 * workflow and need to be linked to PRD requirements.
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Link2,
  Link2Off,
  Check,
  X,
  Loader2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import type { OrphanTask } from "../../hooks/useTraceability";

const API_BASE = "http://localhost:3001";

interface LinkSuggestion {
  taskId: string;
  requirementRef: string;
  sectionType: string;
  itemIndex: number;
  requirementContent: string;
  linkType: "implements" | "tests" | "related";
  confidence: number;
  reasoning: string;
}

interface TaskWithSuggestion {
  task: OrphanTask;
  suggestions: LinkSuggestion[];
  selectedSuggestion: LinkSuggestion | null;
  status: "pending" | "analyzing" | "ready" | "skipped" | "linked";
}

interface BulkLinkWizardProps {
  orphanTasks: OrphanTask[];
  projectId: string;
  projectSlug: string;
  prdId: string;
  onComplete: () => void;
  onClose: () => void;
}

const linkTypeLabels: Record<string, { label: string; color: string }> = {
  implements: { label: "Implements", color: "bg-purple-100 text-purple-700" },
  tests: { label: "Tests", color: "bg-cyan-100 text-cyan-700" },
  related: { label: "Related", color: "bg-gray-100 text-gray-700" },
};

export default function BulkLinkWizard({
  orphanTasks,
  projectId,
  projectSlug,
  prdId,
  onComplete,
  onClose,
}: BulkLinkWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"analyze" | "review" | "apply">("analyze");
  const [tasksWithSuggestions, setTasksWithSuggestions] = useState<
    TaskWithSuggestion[]
  >(
    orphanTasks.map((task) => ({
      task,
      suggestions: [],
      selectedSuggestion: null,
      status: "pending",
    })),
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);

  // Analyze all orphan tasks for link suggestions
  const handleAnalyzeAll = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalyzedCount(0);

    const updated = [...tasksWithSuggestions];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      item.status = "analyzing";
      setTasksWithSuggestions([...updated]);

      try {
        const response = await fetch(
          `${API_BASE}/api/projects/${projectId}/orphans/${item.task.id}/suggest-links`,
          { method: "POST" },
        );

        if (response.ok) {
          const data = await response.json();
          item.suggestions = data.suggestions || [];
          // Auto-select the highest confidence suggestion
          if (item.suggestions.length > 0) {
            item.selectedSuggestion = item.suggestions[0];
            item.status = "ready";
          } else {
            item.status = "skipped";
          }
        } else {
          item.status = "skipped";
        }
      } catch (error) {
        console.error("Error analyzing task:", error);
        item.status = "skipped";
      }

      setAnalyzedCount(i + 1);
      setTasksWithSuggestions([...updated]);
    }

    setIsAnalyzing(false);
    setStep("review");
  }, [projectId, tasksWithSuggestions]);

  // Select a suggestion for a task
  const handleSelectSuggestion = (
    taskId: string,
    suggestion: LinkSuggestion | null,
  ) => {
    setTasksWithSuggestions((prev) =>
      prev.map((item) =>
        item.task.id === taskId
          ? {
              ...item,
              selectedSuggestion: suggestion,
              status: suggestion ? "ready" : "skipped",
            }
          : item,
      ),
    );
  };

  // Skip a task (don't link it)
  const handleSkipTask = (taskId: string) => {
    setTasksWithSuggestions((prev) =>
      prev.map((item) =>
        item.task.id === taskId
          ? { ...item, selectedSuggestion: null, status: "skipped" }
          : item,
      ),
    );
  };

  // Apply all selected links
  const handleApplyAll = useCallback(async () => {
    setIsApplying(true);
    setAppliedCount(0);
    setStep("apply");

    const toApply = tasksWithSuggestions.filter(
      (item) => item.status === "ready" && item.selectedSuggestion,
    );

    for (let i = 0; i < toApply.length; i++) {
      const item = toApply[i];
      if (!item.selectedSuggestion) continue;

      try {
        const response = await fetch(`${API_BASE}/api/traceability/prd-tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: item.task.id,
            prdId,
            requirementRef: item.selectedSuggestion.requirementRef,
            linkType: item.selectedSuggestion.linkType,
          }),
        });

        if (response.ok) {
          setTasksWithSuggestions((prev) =>
            prev.map((t) =>
              t.task.id === item.task.id ? { ...t, status: "linked" } : t,
            ),
          );
        }
      } catch (error) {
        console.error("Error applying link:", error);
      }

      setAppliedCount(i + 1);
    }

    setIsApplying(false);
  }, [prdId, tasksWithSuggestions]);

  const readyCount = tasksWithSuggestions.filter(
    (t) => t.status === "ready",
  ).length;
  const linkedCount = tasksWithSuggestions.filter(
    (t) => t.status === "linked",
  ).length;
  const skippedCount = tasksWithSuggestions.filter(
    (t) => t.status === "skipped",
  ).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Link2 className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Bulk Link Tasks to Requirements
              </h2>
              <p className="text-sm text-gray-500">
                {orphanTasks.length} orphan tasks found
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress steps */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div
              className={clsx(
                "flex items-center gap-2",
                step === "analyze" ? "text-primary-600" : "text-gray-400",
              )}
            >
              <span
                className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
                  step === "analyze"
                    ? "bg-primary-600 text-white"
                    : "bg-green-500 text-white",
                )}
              >
                {step === "analyze" ? "1" : <Check className="h-4 w-4" />}
              </span>
              <span className="text-sm font-medium">Analyze</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
            <div
              className={clsx(
                "flex items-center gap-2",
                step === "review" ? "text-primary-600" : "text-gray-400",
              )}
            >
              <span
                className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
                  step === "review"
                    ? "bg-primary-600 text-white"
                    : step === "apply"
                      ? "bg-green-500 text-white"
                      : "bg-gray-200",
                )}
              >
                {step === "apply" ? <Check className="h-4 w-4" /> : "2"}
              </span>
              <span className="text-sm font-medium">Review</span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
            <div
              className={clsx(
                "flex items-center gap-2",
                step === "apply" ? "text-primary-600" : "text-gray-400",
              )}
            >
              <span
                className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium",
                  step === "apply"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200",
                )}
              >
                3
              </span>
              <span className="text-sm font-medium">Apply</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Analyze */}
          {step === "analyze" && (
            <div className="text-center py-8">
              {!isAnalyzing ? (
                <>
                  <Link2Off className="h-16 w-16 mx-auto mb-4 text-amber-500" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    {orphanTasks.length} Tasks Need Linking
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    These tasks are not linked to any PRD requirements. AI will
                    analyze each task and suggest which requirement it
                    implements.
                  </p>
                  <button
                    onClick={handleAnalyzeAll}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white hover:bg-primary-700 rounded-lg font-medium"
                  >
                    <Sparkles className="h-5 w-5" />
                    Analyze All Tasks
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-16 w-16 mx-auto mb-4 text-primary-600 animate-spin" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    Analyzing Tasks...
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {analyzedCount} of {orphanTasks.length} analyzed
                  </p>
                  <div className="w-64 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 transition-all duration-300"
                      style={{
                        width: `${(analyzedCount / orphanTasks.length) * 100}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Review */}
          {step === "review" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    <span className="font-medium text-green-600">
                      {readyCount}
                    </span>{" "}
                    ready to link
                  </span>
                  <span className="text-sm text-gray-600">
                    <span className="font-medium text-gray-500">
                      {skippedCount}
                    </span>{" "}
                    skipped
                  </span>
                </div>
                <button
                  onClick={handleApplyAll}
                  disabled={readyCount === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Apply {readyCount} Links
                </button>
              </div>

              <div className="space-y-3">
                {tasksWithSuggestions.map((item) => (
                  <div
                    key={item.task.id}
                    className={clsx(
                      "border rounded-lg p-4",
                      item.status === "ready"
                        ? "border-green-200 bg-green-50"
                        : item.status === "skipped"
                          ? "border-gray-200 bg-gray-50"
                          : "border-gray-200",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Task info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-500">
                            {item.task.displayId}
                          </span>
                          <button
                            onClick={() =>
                              navigate(
                                `/projects/${projectSlug}/build?task=${item.task.id}`,
                              )
                            }
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.task.title}
                        </p>
                      </div>

                      {/* Suggestion selection */}
                      <div className="flex items-center gap-2">
                        {item.suggestions.length > 0 ? (
                          <select
                            value={
                              item.selectedSuggestion?.requirementRef || ""
                            }
                            onChange={(e) => {
                              const suggestion = item.suggestions.find(
                                (s) => s.requirementRef === e.target.value,
                              );
                              handleSelectSuggestion(
                                item.task.id,
                                suggestion || null,
                              );
                            }}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">Skip (no link)</option>
                            {item.suggestions.map((s) => (
                              <option
                                key={s.requirementRef}
                                value={s.requirementRef}
                              >
                                {s.sectionType}[{s.itemIndex}] ({s.confidence}%){" "}
                                {s.linkType}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-500">
                            No matches found
                          </span>
                        )}

                        <button
                          onClick={() => handleSkipTask(item.task.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="Skip this task"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Selected suggestion details */}
                    {item.selectedSuggestion && (
                      <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={clsx(
                              "text-xs px-1.5 py-0.5 rounded",
                              linkTypeLabels[item.selectedSuggestion.linkType]
                                .color,
                            )}
                          >
                            {
                              linkTypeLabels[item.selectedSuggestion.linkType]
                                .label
                            }
                          </span>
                          <span className="text-xs text-gray-400">
                            {item.selectedSuggestion.confidence}% confident
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {item.selectedSuggestion.requirementContent}
                        </p>
                        {item.selectedSuggestion.reasoning && (
                          <p className="text-xs text-gray-400 mt-1 italic">
                            {item.selectedSuggestion.reasoning}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Apply */}
          {step === "apply" && (
            <div className="text-center py-8">
              {isApplying ? (
                <>
                  <Loader2 className="h-16 w-16 mx-auto mb-4 text-primary-600 animate-spin" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    Applying Links...
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {appliedCount} of {readyCount} applied
                  </p>
                  <div className="w-64 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{
                        width: `${(appliedCount / Math.max(readyCount, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Check className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    Links Applied Successfully
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {linkedCount} tasks are now linked to PRD requirements.
                    {skippedCount > 0 && ` ${skippedCount} tasks were skipped.`}
                  </p>
                  <button
                    onClick={() => {
                      onComplete();
                      onClose();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white hover:bg-primary-700 rounded-lg font-medium"
                  >
                    <Check className="h-5 w-5" />
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <div className="text-xs text-gray-500">
            {step === "analyze" &&
              !isAnalyzing &&
              "Click 'Analyze All Tasks' to start"}
            {step === "analyze" &&
              isAnalyzing &&
              "AI is analyzing each task..."}
            {step === "review" &&
              "Review suggestions and click 'Apply' when ready"}
            {step === "apply" && !isApplying && "All links have been applied"}
          </div>
        </div>
      </div>
    </div>
  );
}
