/**
 * TraceabilityGapPanel - AI-powered gap analysis panel
 */

import { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Plus,
  X,
  Edit3,
  FileCode,
  Settings,
  ExternalLink,
  ClipboardCheck,
  GitBranch,
  Layers,
  ArrowRightFromLine,
} from "lucide-react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import type {
  TraceabilityGap,
  GapCounts,
} from "../../hooks/useTraceabilityGaps";
import BulkTaskCreationWizard from "./BulkTaskCreationWizard";

interface TraceabilityGapPanelProps {
  gaps: TraceabilityGap[];
  counts: GapCounts;
  isAnalyzing: boolean;
  projectId: string;
  projectSlug: string;
  prdId: string | null;
  onAnalyze: () => Promise<void>;
  onGetSuggestions: (gapId: string) => Promise<string[]>;
  onResolve: (gapId: string) => Promise<void>;
  onIgnore: (gapId: string) => Promise<void>;
  onRefetch: () => Promise<void>;
  onTaskCreated?: () => void;
}

interface AutoPopulatedData {
  fileImpacts: Array<{
    filePath: string;
    operation: string;
    confidence: number;
  }>;
  acceptanceCriteria: string[];
  effort: string;
  priority: string;
  phase: number;
}

interface CreatedTask {
  id: string;
  displayId: string;
  title?: string;
  projectId?: string;
  prdId?: string | null;
  requirementRef?: string;
  autoPopulated?: AutoPopulatedData | null;
}

interface FileImpact {
  id: string;
  filePath: string;
  operation: string;
  confidence: number;
}

interface TaskFormData {
  title: string;
  description: string;
  category: string;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    label: "Critical",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  warning: {
    icon: AlertCircle,
    label: "Warning",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  info: {
    icon: Info,
    label: "Info",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
};

const gapTypeLabels: Record<string, string> = {
  uncovered: "Uncovered Requirement",
  weak_coverage: "Weak Coverage",
  orphan: "Orphan Task",
  mismatch: "Category Mismatch",
};

const categoryOptions = [
  { value: "feature", label: "Feature" },
  { value: "enhancement", label: "Enhancement" },
  { value: "bug", label: "Bug Fix" },
  { value: "task", label: "Task" },
  { value: "research", label: "Research" },
];

const API_BASE = "http://localhost:3001";

export default function TraceabilityGapPanel({
  gaps,
  counts,
  isAnalyzing,
  projectId,
  projectSlug,
  prdId,
  onAnalyze,
  onGetSuggestions,
  onResolve,
  onIgnore,
  onRefetch,
  onTaskCreated,
}: TraceabilityGapPanelProps) {
  const navigate = useNavigate();
  const [expandedGap, setExpandedGap] = useState<string | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<string | null>(
    null,
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Task creation modal state
  const [creatingForGap, setCreatingForGap] = useState<TraceabilityGap | null>(
    null,
  );
  const [taskForm, setTaskForm] = useState<TaskFormData>({
    title: "",
    description: "",
    category: "feature",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success state with post-creation configuration
  const [createdTask, setCreatedTask] = useState<CreatedTask | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [taskFileImpacts, setTaskFileImpacts] = useState<FileImpact[]>([]);
  const [loadingImpacts, setLoadingImpacts] = useState(false);
  const [showACWizard, setShowACWizard] = useState(false);

  // Bulk selection state
  const [selectedGaps, setSelectedGaps] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showBulkWizard, setShowBulkWizard] = useState(false);

  // Moving to business context state
  const [movingToBusinessContext, setMovingToBusinessContext] = useState<
    string | null
  >(null);

  const toggleGapSelection = (gapId: string) => {
    setSelectedGaps((prev) => {
      const next = new Set(prev);
      if (next.has(gapId)) {
        next.delete(gapId);
      } else {
        next.add(gapId);
      }
      return next;
    });
  };

  const selectAllOpen = () => {
    setSelectedGaps(new Set(openGaps.map((g) => g.id)));
  };

  const clearSelection = () => {
    setSelectedGaps(new Set());
  };

  const handleBulkResolve = async () => {
    setIsBulkProcessing(true);
    try {
      for (const gapId of selectedGaps) {
        await onResolve(gapId);
      }
      setSelectedGaps(new Set());
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkIgnore = async () => {
    setIsBulkProcessing(true);
    try {
      for (const gapId of selectedGaps) {
        await onIgnore(gapId);
      }
      setSelectedGaps(new Set());
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Move a requirement to business context (not analyzed for task coverage)
  const handleMoveToBusinessContext = async (gap: TraceabilityGap) => {
    if (!prdId || !gap.entityRef) return;

    // Parse entityRef like "success_criteria[2]" or "constraints[0]"
    const match = gap.entityRef.match(
      /^(success_criteria|constraints)\[(\d+)\]$/,
    );
    if (!match) {
      console.error("Invalid entityRef format:", gap.entityRef);
      return;
    }

    const sourceType = match[1] as "success_criteria" | "constraints";
    const itemIndex = parseInt(match[2], 10);

    setMovingToBusinessContext(gap.id);
    try {
      const response = await fetch(
        `${API_BASE}/api/prds/${prdId}/move-to-business-context`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType, itemIndex }),
        },
      );

      if (response.ok) {
        // Mark the gap as resolved and refresh
        await onResolve(gap.id);
        await onRefetch();
      } else {
        const error = await response.json();
        console.error("Failed to move item:", error);
      }
    } catch (error) {
      console.error("Error moving to business context:", error);
    } finally {
      setMovingToBusinessContext(null);
    }
  };

  // Check if gap can be moved to business context
  const canMoveToBusinessContext = (gap: TraceabilityGap): boolean => {
    if (!prdId || !gap.entityRef) return false;
    // Only allow for success_criteria and constraints
    return /^(success_criteria|constraints)\[\d+\]$/.test(gap.entityRef);
  };

  // Open task creation form
  const openTaskForm = (gap: TraceabilityGap) => {
    // Build default title from gap
    const defaultTitle = `Address: ${gap.description.slice(0, 80)}${gap.description.length > 80 ? "..." : ""}`;

    // Combine all suggestions into one description (they're one cohesive response)
    const suggestionText =
      gap.suggestions.length > 0 ? gap.suggestions.join("\n\n") : "";

    const defaultDescription = suggestionText
      ? `## Gap\n${gap.description}\n\n## Suggested Actions\n${suggestionText}`
      : `## Gap\n${gap.description}\n\n## Gap Type\n${gapTypeLabels[gap.gapType]}\n\n## Severity\n${gap.severity}`;

    // Default category based on gap type
    const defaultCategory =
      gap.gapType === "uncovered" || gap.gapType === "weak_coverage"
        ? "feature"
        : gap.gapType === "orphan"
          ? "enhancement"
          : "task";

    setTaskForm({
      title: defaultTitle,
      description: defaultDescription,
      category: defaultCategory,
    });
    setCreatingForGap(gap);
  };

  // Submit task creation with PRD link
  const handleSubmitTask = async () => {
    if (!creatingForGap) return;

    setIsSubmitting(true);
    try {
      // 1. Create the task
      const response = await fetch(`${API_BASE}/api/task-agent/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title,
          description: taskForm.description,
          category: taskForm.category,
          projectId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const taskId = data.task?.id || data.id;
        const displayId = data.task?.displayId || data.display_id || "Task";

        // 2. Link to PRD requirement if we have prdId and entityRef
        if (
          prdId &&
          creatingForGap.entityRef &&
          creatingForGap.entityType === "requirement"
        ) {
          try {
            await fetch(`${API_BASE}/api/traceability/prd-tasks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId,
                prdId,
                requirementRef: creatingForGap.entityRef,
                linkType: "implements",
              }),
            });
          } catch (linkError) {
            console.error("Error linking task to PRD:", linkError);
            // Continue anyway - task was created
          }
        }

        await onResolve(creatingForGap.id);
        onTaskCreated?.();
        setCreatingForGap(null);

        // Extract auto-populated data from response
        const autoPopulated = data.autoPopulated as AutoPopulatedData | null;

        // Show success with task info and configuration option
        setCreatedTask({
          id: taskId,
          displayId,
          title: taskForm.title,
          projectId,
          prdId,
          requirementRef: creatingForGap.entityRef,
          autoPopulated,
        });
        setShowConfigPanel(false);

        // Use auto-populated file impacts if available, otherwise fetch
        if (
          autoPopulated?.fileImpacts &&
          autoPopulated.fileImpacts.length > 0
        ) {
          setTaskFileImpacts(
            autoPopulated.fileImpacts.map((fi, idx) => ({
              id: `auto-${idx}`,
              filePath: fi.filePath,
              operation: fi.operation,
              confidence: fi.confidence,
            })),
          );
        } else {
          // Fallback: fetch file impacts after a short delay
          setTimeout(async () => {
            try {
              setLoadingImpacts(true);
              const impactsRes = await fetch(
                `${API_BASE}/api/task-agent/tasks/${taskId}/impacts`,
              );
              if (impactsRes.ok) {
                const impactsData = await impactsRes.json();
                setTaskFileImpacts(impactsData.impacts || []);
              }
            } catch (e) {
              console.error("Failed to fetch impacts:", e);
            } finally {
              setLoadingImpacts(false);
            }
          }, 1500);
        }
      }
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group gaps by status
  const openGaps = gaps.filter((g) => g.status === "open");
  const resolvedGaps = gaps.filter((g) => g.status === "resolved");

  // Group open gaps by severity
  const criticalGaps = openGaps.filter((g) => g.severity === "critical");
  const warningGaps = openGaps.filter((g) => g.severity === "warning");
  const infoGaps = openGaps.filter((g) => g.severity === "info");

  const handleGetSuggestions = async (gapId: string) => {
    setLoadingSuggestions(gapId);
    await onGetSuggestions(gapId);
    setLoadingSuggestions(null);
  };

  const renderGapCard = (gap: TraceabilityGap) => {
    const config = severityConfig[gap.severity];
    const Icon = config.icon;
    const isExpanded = expandedGap === gap.id;
    const isLoadingSuggestions = loadingSuggestions === gap.id;
    const isSelected = selectedGaps.has(gap.id);
    // Combine suggestions into one unified text
    const suggestionText = gap.suggestions.join("\n\n");

    return (
      <div
        key={gap.id}
        className={clsx(
          "border rounded-lg transition-all",
          config.borderColor,
          isExpanded && config.bgColor,
          isSelected && "ring-2 ring-primary-400",
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-2 p-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleGapSelection(gap.id)}
            className="mt-1.5 h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            onClick={() => setExpandedGap(isExpanded ? null : gap.id)}
            className="flex-1 flex items-start gap-3 text-left"
          >
            <Icon
              className={clsx("h-5 w-5 flex-shrink-0 mt-0.5", config.color)}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={clsx(
                    "text-xs font-medium px-2 py-0.5 rounded",
                    config.bgColor,
                    config.color,
                  )}
                >
                  {config.label}
                </span>
                <span className="text-xs text-gray-500">
                  {gapTypeLabels[gap.gapType]}
                </span>
              </div>
              <p className="text-sm text-gray-900 line-clamp-2">
                {gap.description}
              </p>
            </div>

            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
            )}
          </button>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-gray-100">
            <div className="pt-3 space-y-3">
              {/* AI Suggestion section - only show when suggestion exists */}
              {suggestionText && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary-600" />
                    <span className="text-sm font-medium text-gray-700">
                      AI Suggested Action Plan
                    </span>
                  </div>
                  <div className="p-3 bg-primary-50 rounded border border-primary-200 text-sm text-gray-700 whitespace-pre-wrap">
                    {suggestionText}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                {/* Create Task button - contextual based on suggestion */}
                {suggestionText ? (
                  <button
                    onClick={() => openTaskForm(gap)}
                    className="text-sm bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Task
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGetSuggestions(gap.id)}
                      disabled={isLoadingSuggestions}
                      className="text-sm bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded inline-flex items-center gap-1.5"
                    >
                      {isLoadingSuggestions ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Get AI Suggestion
                        </>
                      )}
                    </button>
                    <span className="text-xs text-gray-400">or</span>
                    <button
                      onClick={() => openTaskForm(gap)}
                      className="text-sm text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 px-3 py-1.5 rounded inline-flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Manually
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* Move to Business Context - only for success_criteria/constraints */}
                  {canMoveToBusinessContext(gap) && (
                    <button
                      onClick={() => handleMoveToBusinessContext(gap)}
                      disabled={movingToBusinessContext === gap.id}
                      className="text-sm text-amber-600 hover:text-amber-700 border border-amber-300 hover:border-amber-400 px-3 py-1 rounded inline-flex items-center gap-1"
                      title="This is not a functional requirement - move to Business Context"
                    >
                      {movingToBusinessContext === gap.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Moving...
                        </>
                      ) : (
                        <>
                          <ArrowRightFromLine className="h-3 w-3" />
                          Not a Requirement
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => onIgnore(gap.id)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
                  >
                    Ignore
                  </button>
                  <button
                    onClick={() => onResolve(gap.id)}
                    className="text-sm bg-primary-600 text-white hover:bg-primary-700 px-3 py-1 rounded inline-flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Mark Resolved
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Success panel with configuration options */}
      {createdTask && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-96 animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-200 rounded-t-lg">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Task Created</p>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <span>{createdTask.displayId}</span>
                  {createdTask.autoPopulated && (
                    <>
                      <span className="text-green-400">•</span>
                      <span className="text-xs bg-green-100 px-1.5 py-0.5 rounded">
                        {createdTask.autoPopulated.priority}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {createdTask.autoPopulated.effort}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setCreatedTask(null);
                setShowConfigPanel(false);
                setTaskFileImpacts([]);
              }}
              className="p-1 text-green-600 hover:bg-green-100 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick actions */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigate(
                    `/projects/${projectSlug}/build?task=${createdTask.id}`,
                  );
                  setCreatedTask(null);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                <ExternalLink className="h-4 w-4" />
                Open Task
              </button>
              <button
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className={clsx(
                  "flex items-center justify-center gap-2 px-3 py-2 text-sm rounded border",
                  showConfigPanel
                    ? "bg-gray-100 border-gray-300 text-gray-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50",
                )}
              >
                <Settings className="h-4 w-4" />
                Configure
              </button>
            </div>
          </div>

          {/* Configuration panel (expandable) */}
          {showConfigPanel && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {/* File Impacts Preview */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Estimated File Impacts
                  </span>
                </div>
                {loadingImpacts ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Estimating...
                  </div>
                ) : taskFileImpacts.length > 0 ? (
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {taskFileImpacts.slice(0, 5).map((impact) => (
                      <div
                        key={impact.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span
                          className={clsx(
                            "px-1.5 py-0.5 rounded font-medium",
                            impact.operation === "CREATE" &&
                              "bg-green-100 text-green-700",
                            impact.operation === "UPDATE" &&
                              "bg-blue-100 text-blue-700",
                            impact.operation === "DELETE" &&
                              "bg-red-100 text-red-700",
                            impact.operation === "READ" &&
                              "bg-gray-100 text-gray-600",
                          )}
                        >
                          {impact.operation}
                        </span>
                        <code className="text-gray-600 truncate flex-1">
                          {impact.filePath}
                        </code>
                      </div>
                    ))}
                    {taskFileImpacts.length > 5 && (
                      <p className="text-xs text-gray-400">
                        +{taskFileImpacts.length - 5} more
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    No file impacts estimated yet
                  </p>
                )}
              </div>

              {/* Acceptance Criteria Preview */}
              {createdTask.autoPopulated?.acceptanceCriteria &&
                createdTask.autoPopulated.acceptanceCriteria.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardCheck className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Acceptance Criteria (
                        {createdTask.autoPopulated.acceptanceCriteria.length})
                      </span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {createdTask.autoPopulated.acceptanceCriteria
                        .slice(0, 4)
                        .map((criteria, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-xs text-gray-600"
                          >
                            <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-1">{criteria}</span>
                          </div>
                        ))}
                      {createdTask.autoPopulated.acceptanceCriteria.length >
                        4 && (
                        <p className="text-xs text-gray-400 pl-5">
                          +
                          {createdTask.autoPopulated.acceptanceCriteria.length -
                            4}{" "}
                          more
                        </p>
                      )}
                    </div>
                  </div>
                )}

              {/* Quick configuration buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowACWizard(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs border border-purple-200 text-purple-600 rounded hover:bg-purple-50"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {createdTask.autoPopulated?.acceptanceCriteria?.length
                    ? "Edit Criteria"
                    : "Add Criteria"}
                </button>
                <button
                  onClick={() =>
                    navigate(
                      `/projects/${projectSlug}/build?task=${createdTask.id}&tab=dependencies`,
                    )
                  }
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs border border-blue-200 text-blue-600 rounded hover:bg-blue-50"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Add Dependencies
                </button>
              </div>

              {/* Skip button */}
              <button
                onClick={() => {
                  setCreatedTask(null);
                  setShowConfigPanel(false);
                  setTaskFileImpacts([]);
                }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700 py-1"
              >
                Skip configuration
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            )}
            <h3 className="text-sm font-semibold text-gray-900">
              AI Gap Analysis
            </h3>
            {counts.open > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                {counts.open} open
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            {openGaps.length >= 2 && (
              <button
                onClick={() => setShowBulkWizard(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-purple-200 text-purple-600 hover:bg-purple-50 rounded"
                title="Create multiple tasks at once"
              >
                <Layers className="h-4 w-4" />
                Bulk Create
              </button>
            )}
            <button
              onClick={onRefetch}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white hover:bg-primary-700 rounded disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bulk actions bar */}
        {!isCollapsed && selectedGaps.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-primary-50 border-b border-primary-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary-700">
                {selectedGaps.size} selected
              </span>
              <button
                onClick={selectAllOpen}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Select all ({openGaps.length})
              </button>
              <button
                onClick={clearSelection}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkIgnore}
                disabled={isBulkProcessing}
                className="text-xs px-3 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
              >
                Ignore All
              </button>
              <button
                onClick={handleBulkResolve}
                disabled={isBulkProcessing}
                className="text-xs px-3 py-1 bg-primary-600 text-white hover:bg-primary-700 rounded inline-flex items-center gap-1"
              >
                {isBulkProcessing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3" />
                    Resolve All
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {!isCollapsed && (
          <div className="p-4 space-y-4 max-h-[750px] overflow-y-auto">
            {/* No gaps */}
            {openGaps.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Check className="h-12 w-12 mx-auto mb-3 text-green-400" />
                <p className="font-medium">No gaps detected</p>
                <p className="text-sm">
                  Click &quot;Analyze&quot; to check for issues
                </p>
              </div>
            )}

            {/* Critical gaps */}
            {criticalGaps.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-xs font-medium text-red-700 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Critical ({criticalGaps.length})
                </h4>
                <div className="space-y-2">
                  {criticalGaps.map(renderGapCard)}
                </div>
              </div>
            )}

            {/* Warning gaps */}
            {warningGaps.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-xs font-medium text-amber-700 mb-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Warnings ({warningGaps.length})
                </h4>
                <div className="space-y-2">
                  {warningGaps.map(renderGapCard)}
                </div>
              </div>
            )}

            {/* Info gaps */}
            {infoGaps.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-xs font-medium text-blue-700 mb-2">
                  <Info className="h-3.5 w-3.5" />
                  Info ({infoGaps.length})
                </h4>
                <div className="space-y-2">{infoGaps.map(renderGapCard)}</div>
              </div>
            )}

            {/* Resolved gaps (collapsed) */}
            {resolvedGaps.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h4 className="flex items-center gap-2 text-xs font-medium text-green-700 mb-2">
                  <Check className="h-3.5 w-3.5" />
                  Resolved ({resolvedGaps.length})
                </h4>
                <p className="text-xs text-gray-500">
                  {resolvedGaps.length} gaps have been resolved
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Task Creation Wizard */}
      {showBulkWizard && (
        <BulkTaskCreationWizard
          gaps={gaps}
          projectId={projectId}
          projectSlug={projectSlug}
          prdId={prdId}
          onComplete={async () => {
            setShowBulkWizard(false);
            await onRefetch();
            onTaskCreated?.();
          }}
          onClose={() => setShowBulkWizard(false)}
        />
      )}

      {/* Task Creation Modal */}
      {creatingForGap && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Create Task from Gap
                </h2>
              </div>
              <button
                onClick={() => setCreatingForGap(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Source gap info */}
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <span className="text-gray-500">Source: </span>
                <span className="text-gray-700">
                  {gapTypeLabels[creatingForGap.gapType]} -{" "}
                  {creatingForGap.severity}
                </span>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter task title..."
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={taskForm.category}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                  placeholder="Enter task description..."
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setCreatingForGap(null)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTask}
                disabled={isSubmitting || !taskForm.title.trim()}
                className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Task
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
