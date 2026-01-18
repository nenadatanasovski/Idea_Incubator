/**
 * BulkTaskCreationWizard - Create multiple tasks from gaps at once
 *
 * 5-step wizard:
 * 1. Select - Choose gaps to address
 * 2. Generate - AI creates task drafts
 * 3. Review - Edit tasks before creation
 * 4. Dependencies - Review AI-suggested dependencies
 * 5. Create - Batch create all tasks
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Check,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Edit2,
  Plus,
  Trash2,
  GitBranch,
  FileCode,
} from "lucide-react";
import clsx from "clsx";
import type { TraceabilityGap } from "../../hooks/useTraceabilityGaps";

const API_BASE = "http://localhost:3001";

interface TaskDraft {
  gapId: string;
  title: string;
  description: string;
  category: string;
  entityRef?: string;
  isEditing: boolean;
  status: "pending" | "generating" | "ready" | "error" | "created";
  createdTaskId?: string;
  createdDisplayId?: string;
}

interface DependencySuggestion {
  sourceIndex: number;
  targetIndex: number;
  sourceTitle: string;
  targetTitle: string;
  relationshipType: "depends_on" | "blocks";
  reason: string;
  confidence: number;
  accepted: boolean;
}

interface BulkTaskCreationWizardProps {
  gaps: TraceabilityGap[];
  projectId: string;
  projectSlug: string;
  prdId: string | null;
  onComplete: () => void;
  onClose: () => void;
}

type WizardStep = "select" | "generate" | "review" | "dependencies" | "create";

const categoryOptions = [
  { value: "feature", label: "Feature" },
  { value: "enhancement", label: "Enhancement" },
  { value: "bug", label: "Bug Fix" },
  { value: "task", label: "Task" },
  { value: "research", label: "Research" },
  { value: "infrastructure", label: "Infrastructure" },
];

const gapTypeLabels: Record<string, string> = {
  uncovered: "Uncovered Requirement",
  weak_coverage: "Weak Coverage",
  orphan: "Orphan Task",
  mismatch: "Category Mismatch",
};

export default function BulkTaskCreationWizard({
  gaps,
  projectId,
  projectSlug,
  prdId,
  onComplete,
  onClose,
}: BulkTaskCreationWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>("select");

  // Step 1: Selection
  const [selectedGapIds, setSelectedGapIds] = useState<Set<string>>(new Set());

  // Step 2 & 3: Generation and Review
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  // Step 4: Dependencies
  const [dependencySuggestions, setDependencySuggestions] = useState<
    DependencySuggestion[]
  >([]);
  const [loadingDependencies, setLoadingDependencies] = useState(false);

  // Step 5: Creation
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  // Filter to open gaps only
  const openGaps = gaps.filter((g) => g.status === "open");

  // Toggle gap selection
  const toggleGapSelection = (gapId: string) => {
    setSelectedGapIds((prev) => {
      const next = new Set(prev);
      if (next.has(gapId)) {
        next.delete(gapId);
      } else {
        next.add(gapId);
      }
      return next;
    });
  };

  // Select all gaps
  const selectAll = () => {
    setSelectedGapIds(new Set(openGaps.map((g) => g.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedGapIds(new Set());
  };

  // Generate task drafts from selected gaps
  const generateTaskDrafts = useCallback(async () => {
    const selectedGaps = openGaps.filter((g) => selectedGapIds.has(g.id));
    if (selectedGaps.length === 0) return;

    setIsGenerating(true);
    setGeneratedCount(0);

    const drafts: TaskDraft[] = selectedGaps.map((gap) => ({
      gapId: gap.id,
      title: "",
      description: "",
      category: "feature",
      entityRef: gap.entityRef,
      isEditing: false,
      status: "pending",
    }));

    setTaskDrafts(drafts);
    setStep("generate");

    // Generate each draft using AI
    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];
      const gap = selectedGaps[i];
      draft.status = "generating";
      setTaskDrafts([...drafts]);

      try {
        // Use the gap suggestions if available, or generate new ones
        if (gap.suggestions.length > 0) {
          // Use existing suggestions
          const defaultTitle = `Address: ${gap.description.slice(0, 60)}${gap.description.length > 60 ? "..." : ""}`;
          const suggestionText = gap.suggestions.join("\n\n");

          draft.title = defaultTitle;
          draft.description = `## Gap\n${gap.description}\n\n## Suggested Actions\n${suggestionText}`;
          draft.category =
            gap.gapType === "uncovered" || gap.gapType === "weak_coverage"
              ? "feature"
              : gap.gapType === "orphan"
                ? "enhancement"
                : "task";
          draft.status = "ready";
        } else {
          // Generate with AI
          const response = await fetch(
            `${API_BASE}/api/traceability/gaps/${gap.id}/suggestions`,
            { method: "POST" },
          );

          if (response.ok) {
            const data = await response.json();
            const suggestions = data.suggestions || [];

            const defaultTitle = `Address: ${gap.description.slice(0, 60)}${gap.description.length > 60 ? "..." : ""}`;
            const suggestionText = suggestions.join("\n\n");

            draft.title = defaultTitle;
            draft.description = suggestionText
              ? `## Gap\n${gap.description}\n\n## Suggested Actions\n${suggestionText}`
              : `## Gap\n${gap.description}\n\n## Gap Type\n${gapTypeLabels[gap.gapType]}`;
            draft.category =
              gap.gapType === "uncovered" || gap.gapType === "weak_coverage"
                ? "feature"
                : gap.gapType === "orphan"
                  ? "enhancement"
                  : "task";
            draft.status = "ready";
          } else {
            // Fallback without AI
            draft.title = `Address: ${gap.description.slice(0, 60)}...`;
            draft.description = `## Gap\n${gap.description}`;
            draft.category = "task";
            draft.status = "ready";
          }
        }
      } catch (error) {
        console.error("Error generating draft:", error);
        draft.title = `Address: ${gap.description.slice(0, 60)}...`;
        draft.description = gap.description;
        draft.category = "task";
        draft.status = "error";
      }

      setGeneratedCount(i + 1);
      setTaskDrafts([...drafts]);
    }

    setIsGenerating(false);
    setStep("review");
  }, [openGaps, selectedGapIds]);

  // Update a draft
  const updateDraft = (index: number, updates: Partial<TaskDraft>) => {
    setTaskDrafts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  // Remove a draft
  const removeDraft = (index: number) => {
    setTaskDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  // Generate dependency suggestions
  const generateDependencySuggestions = useCallback(async () => {
    if (taskDrafts.length < 2) {
      setStep("create");
      return;
    }

    setLoadingDependencies(true);
    setStep("dependencies");

    try {
      // Build context for AI analysis
      const tasksContext = taskDrafts.map((d, i) => ({
        index: i,
        title: d.title,
        description: d.description.slice(0, 200),
        category: d.category,
      }));

      // Simple heuristic-based dependency suggestions
      // In a real implementation, this would call an AI endpoint
      const suggestions: DependencySuggestion[] = [];

      // Suggest infrastructure before features
      const infraTasks = tasksContext.filter(
        (t) => t.category === "infrastructure",
      );
      const featureTasks = tasksContext.filter((t) => t.category === "feature");

      for (const infra of infraTasks) {
        for (const feature of featureTasks) {
          if (infra.index !== feature.index) {
            suggestions.push({
              sourceIndex: feature.index,
              targetIndex: infra.index,
              sourceTitle: feature.title,
              targetTitle: infra.title,
              relationshipType: "depends_on",
              reason: "Infrastructure tasks typically complete before features",
              confidence: 0.7,
              accepted: true,
            });
          }
        }
      }

      // Suggest research before implementation
      const researchTasks = tasksContext.filter(
        (t) => t.category === "research",
      );
      const implTasks = tasksContext.filter(
        (t) => t.category === "feature" || t.category === "enhancement",
      );

      for (const research of researchTasks) {
        for (const impl of implTasks) {
          if (research.index !== impl.index) {
            // Check for keyword overlap
            const researchWords = research.title.toLowerCase().split(/\s+/);
            const implWords = impl.title.toLowerCase().split(/\s+/);
            const overlap = researchWords.filter((w) =>
              implWords.some((iw) => iw.includes(w) || w.includes(iw)),
            );

            if (overlap.length > 0) {
              suggestions.push({
                sourceIndex: impl.index,
                targetIndex: research.index,
                sourceTitle: impl.title,
                targetTitle: research.title,
                relationshipType: "depends_on",
                reason: `Related research should complete first (common words: ${overlap.slice(0, 2).join(", ")})`,
                confidence: 0.6,
                accepted: true,
              });
            }
          }
        }
      }

      setDependencySuggestions(suggestions);
    } catch (error) {
      console.error("Error generating dependencies:", error);
    } finally {
      setLoadingDependencies(false);
    }
  }, [taskDrafts]);

  // Toggle dependency suggestion acceptance
  const toggleDependency = (index: number) => {
    setDependencySuggestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], accepted: !next[index].accepted };
      return next;
    });
  };

  // Create all tasks
  const createAllTasks = useCallback(async () => {
    setIsCreating(true);
    setCreatedCount(0);
    setStep("create");

    const createdTasks: Array<{ id: string; displayId: string }> = [];

    // Create each task
    for (let i = 0; i < taskDrafts.length; i++) {
      const draft = taskDrafts[i];

      try {
        const response = await fetch(`${API_BASE}/api/task-agent/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title,
            description: draft.description,
            category: draft.category,
            projectId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const taskId = data.task?.id || data.id;
          const displayId = data.task?.displayId || data.display_id;

          createdTasks.push({ id: taskId, displayId });
          draft.createdTaskId = taskId;
          draft.createdDisplayId = displayId;
          draft.status = "created";

          // Link to PRD if available
          if (prdId && draft.entityRef) {
            try {
              await fetch(`${API_BASE}/api/traceability/prd-tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  taskId,
                  prdId,
                  requirementRef: draft.entityRef,
                  linkType: "implements",
                }),
              });
            } catch {
              console.warn("Failed to link task to PRD");
            }
          }
        } else {
          draft.status = "error";
        }
      } catch (error) {
        console.error("Error creating task:", error);
        draft.status = "error";
      }

      setCreatedCount(i + 1);
      setTaskDrafts([...taskDrafts]);
    }

    // Create accepted dependencies
    const acceptedDeps = dependencySuggestions.filter((d) => d.accepted);
    for (const dep of acceptedDeps) {
      const sourceTask = taskDrafts[dep.sourceIndex];
      const targetTask = taskDrafts[dep.targetIndex];

      if (sourceTask.createdTaskId && targetTask.createdTaskId) {
        try {
          await fetch(`${API_BASE}/api/task-agent/dependencies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceTaskId: sourceTask.createdTaskId,
              targetTaskId: targetTask.createdTaskId,
            }),
          });
        } catch {
          console.warn("Failed to create dependency");
        }
      }
    }

    setIsCreating(false);
  }, [taskDrafts, dependencySuggestions, projectId, prdId]);

  // Progress through steps
  const goToNextStep = () => {
    switch (step) {
      case "select":
        generateTaskDrafts();
        break;
      case "review":
        generateDependencySuggestions();
        break;
      case "dependencies":
        createAllTasks();
        break;
      case "create":
        onComplete();
        break;
    }
  };

  const goToPrevStep = () => {
    switch (step) {
      case "generate":
        setStep("select");
        break;
      case "review":
        setStep("select");
        break;
      case "dependencies":
        setStep("review");
        break;
    }
  };

  const canProceed = () => {
    switch (step) {
      case "select":
        return selectedGapIds.size > 0;
      case "generate":
        return !isGenerating;
      case "review":
        return taskDrafts.length > 0 && taskDrafts.every((d) => d.title.trim());
      case "dependencies":
        return !loadingDependencies;
      case "create":
        return !isCreating;
      default:
        return false;
    }
  };

  const successCount = taskDrafts.filter((d) => d.status === "created").length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Bulk Task Creation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50">
          {["select", "generate", "review", "dependencies", "create"].map(
            (s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    step === s
                      ? "bg-primary-600 text-white"
                      : [
                            "select",
                            "generate",
                            "review",
                            "dependencies",
                          ].indexOf(step) > i || step === "create"
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500",
                  )}
                >
                  {["select", "generate", "review", "dependencies"].indexOf(
                    step,
                  ) > i || step === "create" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 4 && (
                  <div
                    className={clsx(
                      "w-12 h-0.5",
                      ["select", "generate", "review", "dependencies"].indexOf(
                        step,
                      ) > i
                        ? "bg-green-500"
                        : "bg-gray-200",
                    )}
                  />
                )}
              </div>
            ),
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Gaps */}
          {step === "select" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">
                  Select Gaps to Address ({selectedGapIds.size} selected)
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {openGaps.map((gap) => (
                  <label
                    key={gap.id}
                    className={clsx(
                      "flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                      selectedGapIds.has(gap.id)
                        ? "border-primary-400 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGapIds.has(gap.id)}
                      onChange={() => toggleGapSelection(gap.id)}
                      className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={clsx(
                            "text-xs font-medium px-2 py-0.5 rounded",
                            gap.severity === "critical" &&
                              "bg-red-100 text-red-700",
                            gap.severity === "warning" &&
                              "bg-amber-100 text-amber-700",
                            gap.severity === "info" &&
                              "bg-blue-100 text-blue-700",
                          )}
                        >
                          {gap.severity}
                        </span>
                        <span className="text-xs text-gray-500">
                          {gapTypeLabels[gap.gapType]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {gap.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Generating */}
          {step === "generate" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-primary-600 animate-spin mb-4" />
              <p className="text-gray-700 font-medium">
                Generating task drafts...
              </p>
              <p className="text-gray-500 text-sm mt-1">
                {generatedCount} of {taskDrafts.length} completed
              </p>
              <div className="w-64 h-2 bg-gray-200 rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all"
                  style={{
                    width: `${(generatedCount / taskDrafts.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 3: Review Tasks */}
          {step === "review" && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">
                Review Task Drafts ({taskDrafts.length} tasks)
              </h3>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {taskDrafts.map((draft, index) => (
                  <div
                    key={draft.gapId}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    {draft.isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) =>
                            updateDraft(index, { title: e.target.value })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="Task title..."
                        />
                        <select
                          value={draft.category}
                          onChange={(e) =>
                            updateDraft(index, { category: e.target.value })
                          }
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          {categoryOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={draft.description}
                          onChange={(e) =>
                            updateDraft(index, { description: e.target.value })
                          }
                          rows={4}
                          className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                          placeholder="Description..."
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              updateDraft(index, { isEditing: false })
                            }
                            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {
                                categoryOptions.find(
                                  (c) => c.value === draft.category,
                                )?.label
                              }
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 truncate">
                            {draft.title || "(No title)"}
                          </p>
                          <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                            {draft.description.slice(0, 150)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              updateDraft(index, { isEditing: true })
                            }
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeDraft(index)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Dependencies */}
          {step === "dependencies" && (
            <div className="space-y-4">
              {loadingDependencies ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-primary-600 animate-spin mb-4" />
                  <p className="text-gray-600">
                    Analyzing dependencies between tasks...
                  </p>
                </div>
              ) : dependencySuggestions.length === 0 ? (
                <div className="text-center py-12">
                  <GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">
                    No dependency suggestions found
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Tasks will be created independently
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="font-medium text-gray-900">
                    Suggested Dependencies ({dependencySuggestions.length})
                  </h3>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {dependencySuggestions.map((dep, index) => (
                      <label
                        key={index}
                        className={clsx(
                          "flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                          dep.accepted
                            ? "border-blue-300 bg-blue-50"
                            : "border-gray-200",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={dep.accepted}
                          onChange={() => toggleDependency(index)}
                          className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-700 truncate max-w-[200px]">
                              {dep.sourceTitle.slice(0, 40)}...
                            </span>
                            <span className="text-gray-400">
                              {dep.relationshipType === "depends_on"
                                ? "→"
                                : "←"}
                            </span>
                            <span className="font-medium text-gray-700 truncate max-w-[200px]">
                              {dep.targetTitle.slice(0, 40)}...
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {dep.reason}
                          </p>
                        </div>
                        <span
                          className={clsx(
                            "text-xs px-2 py-0.5 rounded",
                            dep.confidence >= 0.7
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600",
                          )}
                        >
                          {Math.round(dep.confidence * 100)}%
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 5: Creating */}
          {step === "create" && (
            <div className="space-y-4">
              {isCreating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 text-primary-600 animate-spin mb-4" />
                  <p className="text-gray-700 font-medium">Creating tasks...</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {createdCount} of {taskDrafts.length} completed
                  </p>
                  <div className="w-64 h-2 bg-gray-200 rounded-full mt-4 overflow-hidden">
                    <div
                      className="h-full bg-primary-600 transition-all"
                      style={{
                        width: `${(createdCount / taskDrafts.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Tasks Created Successfully!
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {successCount} task{successCount !== 1 ? "s" : ""} created
                    {dependencySuggestions.filter((d) => d.accepted).length > 0
                      ? ` with ${dependencySuggestions.filter((d) => d.accepted).length} dependencies`
                      : ""}
                  </p>

                  <div className="space-y-2 max-w-md mx-auto">
                    {taskDrafts
                      .filter((d) => d.status === "created")
                      .slice(0, 5)
                      .map((draft) => (
                        <div
                          key={draft.gapId}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="font-mono text-xs text-gray-500">
                              {draft.createdDisplayId}
                            </span>
                            <span className="text-sm text-gray-700 truncate max-w-[200px]">
                              {draft.title.slice(0, 40)}...
                            </span>
                          </div>
                        </div>
                      ))}
                    {taskDrafts.filter((d) => d.status === "created").length >
                      5 && (
                      <p className="text-xs text-gray-400">
                        +
                        {taskDrafts.filter((d) => d.status === "created")
                          .length - 5}{" "}
                        more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={step === "create" && !isCreating ? onClose : goToPrevStep}
            disabled={step === "select" || isGenerating || isCreating}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === "create" && !isCreating ? "Close" : "Back"}
          </button>

          <button
            onClick={goToNextStep}
            disabled={!canProceed()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            {step === "select" && (
              <>
                Generate Drafts
                <ChevronRight className="h-4 w-4" />
              </>
            )}
            {step === "review" && (
              <>
                Check Dependencies
                <ChevronRight className="h-4 w-4" />
              </>
            )}
            {step === "dependencies" && (
              <>
                Create {taskDrafts.length} Task{taskDrafts.length !== 1 && "s"}
                <Plus className="h-4 w-4" />
              </>
            )}
            {step === "create" && !isCreating && (
              <>
                <Check className="h-4 w-4" />
                Done
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
