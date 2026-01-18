/**
 * TaskCompletionModal Component
 *
 * Modal showing task readiness with missing fields and completion actions.
 * Displays readiness progress bar and allows manual or auto-fill of missing data.
 * Now supports decomposition flow for non-atomic tasks.
 *
 * Reference: TASK-READINESS-PIPELINE-ENHANCEMENTS-IMPLEMENTATION-PLAN.md Phase 3
 * Enhanced per: TASK-DECOMPOSITION-COMPREHENSIVE-PLAN.md Phase 3
 */

import { useState, useEffect, useCallback } from "react";
import {
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  FolderOpen,
  Target,
  TestTube,
  Link,
  Wand2,
  Plus,
  Play,
  Save,
  Loader2,
  Scissors,
  GitBranch,
  ChevronRight,
} from "lucide-react";
import TaskDecomposerModal from "./TaskDecomposerModal";

// Types
interface RuleResult {
  rule: string;
  score: number;
  weight: number;
  status: "pass" | "fail" | "warning";
  reason?: string;
  details?: Record<string, unknown>;
}

interface ReadinessScore {
  taskId: string;
  overall: number;
  rules: {
    singleConcern: RuleResult;
    boundedFiles: RuleResult;
    timeBounded: RuleResult;
    testable: RuleResult;
    independent: RuleResult;
    clearCompletion: RuleResult;
  };
  threshold: number;
  isReady: boolean;
  missingItems: string[];
  calculatedAt: string;
}

interface TaskLineageInfo {
  parent: {
    id: string;
    display_id: string;
    title: string;
    status: string;
  } | null;
  subtaskCount: number;
  siblingCount: number;
  isDecomposed: boolean;
}

interface TaskCompletionModalProps {
  taskId: string;
  taskDisplayId?: string;
  taskTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  onExecute?: () => void;
  onDecompose?: (subtaskIds: string[]) => void;
}

export default function TaskCompletionModal({
  taskId,
  taskDisplayId,
  taskTitle,
  isOpen,
  onClose,
  onSave,
  onExecute,
  onDecompose,
}: TaskCompletionModalProps) {
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  // Decomposition state
  const [showDecomposer, setShowDecomposer] = useState(false);
  const [decompositionReason, setDecompositionReason] = useState<string[]>([]);

  // Lineage state
  const [lineage, setLineage] = useState<TaskLineageInfo | null>(null);

  // Fetch lineage data
  const fetchLineage = useCallback(async () => {
    try {
      const [parentRes, subtasksRes, siblingsRes] = await Promise.all([
        fetch(`/api/task-agent/tasks/${taskId}/parent`),
        fetch(`/api/task-agent/tasks/${taskId}/subtasks`),
        fetch(`/api/task-agent/tasks/${taskId}/siblings`),
      ]);

      const parentData = parentRes.ok
        ? await parentRes.json()
        : { parent: null };
      const subtasksData = subtasksRes.ok
        ? await subtasksRes.json()
        : { subtaskCount: 0 };
      const siblingsData = siblingsRes.ok
        ? await siblingsRes.json()
        : { siblingCount: 0 };

      setLineage({
        parent: parentData.parent,
        subtaskCount: subtasksData.subtaskCount || 0,
        siblingCount: siblingsData.siblingCount || 0,
        isDecomposed: subtasksData.subtaskCount > 0,
      });
    } catch (err) {
      console.error("Failed to fetch lineage:", err);
    }
  }, [taskId]);

  // Debug: log when showDecomposer changes
  useEffect(() => {
    console.log(
      "[TaskCompletionModal] showDecomposer changed to:",
      showDecomposer,
    );
  }, [showDecomposer]);

  const fetchReadiness = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/pipeline/tasks/${taskId}/readiness`);
      if (!response.ok) {
        throw new Error("Failed to fetch task readiness");
      }
      const data = await response.json();
      setReadiness(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (isOpen) {
      fetchReadiness();
      fetchLineage();
    }
  }, [isOpen, fetchReadiness, fetchLineage]);

  if (!isOpen) return null;

  const handleAutoFill = async (section: string) => {
    setSavingSection(section);
    setError(null);

    try {
      // Step 1: Generate suggestions from backend
      const suggestResponse = await fetch(
        `/api/pipeline/tasks/${taskId}/auto-populate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: section }),
        },
      );

      if (!suggestResponse.ok) {
        const errorData = await suggestResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate suggestions");
      }

      const suggestData = await suggestResponse.json();

      // Check if decomposition is required (for description field)
      if (suggestData.requiresDecomposition) {
        setDecompositionReason(suggestData.decompositionReason || []);
        setShowDecomposer(true);
        setSavingSection(null);
        return;
      }

      // Check if we got any suggestions
      if (!suggestData.suggestions || suggestData.suggestions.length === 0) {
        setError(
          `No suggestions available for ${section}. Try adding manually.`,
        );
        setSavingSection(null);
        return;
      }

      // Step 2: Auto-apply all suggestions
      const suggestionIds = suggestData.suggestions.map(
        (s: { id: string }) => s.id,
      );

      const applyResponse = await fetch(
        `/api/pipeline/tasks/${taskId}/auto-populate/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: section,
            suggestionIds,
          }),
        },
      );

      if (!applyResponse.ok) {
        const errorData = await applyResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to apply suggestions");
      }

      const applyResult = await applyResponse.json();
      console.log(
        `Auto-fill applied ${applyResult.appliedCount} suggestions for ${section}`,
      );

      // Step 3: Refresh readiness to see the updated state
      await fetchReadiness();
    } catch (err) {
      console.error("Auto-fill error:", err);
      setError(err instanceof Error ? err.message : "Auto-fill failed");
    } finally {
      setSavingSection(null);
    }
  };

  const handleManualAdd = async (section: string, content: string) => {
    setSavingSection(section);
    try {
      const appendixType =
        section === "acceptance_criteria"
          ? "acceptance_criteria"
          : section === "test_commands"
            ? "test_commands"
            : null;

      if (appendixType) {
        const response = await fetch(
          `/api/task-agent/tasks/${taskId}/appendices`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appendixType,
              content,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to add appendix");
        }
      }

      fetchReadiness(); // Refresh readiness
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingSection(null);
    }
  };

  const handleDecompose = (subtaskIds: string[]) => {
    setShowDecomposer(false);
    onDecompose?.(subtaskIds);
    onClose();
  };

  // Check if task needs decomposition based on single concern rule
  const needsDecomposition = !!(
    readiness &&
    readiness.rules.singleConcern.status === "fail" &&
    readiness.rules.singleConcern.score < 50
  );

  return (
    <>
      <div
        data-testid="task-completion-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Task Completion
              </h2>
              {taskDisplayId && (
                <span className="text-sm font-mono text-gray-500">
                  {taskDisplayId}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 rounded-lg text-red-700 mb-4">
                {error}
              </div>
            )}

            {readiness && (
              <div className="space-y-6">
                {/* Readiness Progress Bar */}
                <ReadinessProgressBar
                  overall={readiness.overall}
                  threshold={readiness.threshold}
                  isReady={readiness.isReady}
                />

                {/* Title display */}
                {taskTitle && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Task:</span>
                    <p className="text-gray-900 font-medium">{taskTitle}</p>
                  </div>
                )}

                {/* Decomposition Status - Always visible */}
                <div
                  className={`p-3 rounded-lg border ${
                    lineage?.subtaskCount && lineage.subtaskCount > 0
                      ? "bg-purple-50 border-purple-200"
                      : lineage?.parent
                        ? "bg-blue-50 border-blue-200"
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch
                        className={`w-4 h-4 ${
                          lineage?.subtaskCount && lineage.subtaskCount > 0
                            ? "text-purple-600"
                            : lineage?.parent
                              ? "text-blue-600"
                              : "text-gray-400"
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          lineage?.subtaskCount && lineage.subtaskCount > 0
                            ? "text-purple-800"
                            : lineage?.parent
                              ? "text-blue-800"
                              : "text-gray-600"
                        }`}
                      >
                        Decomposition Status
                      </span>
                    </div>
                    {/* Status badge */}
                    {lineage?.subtaskCount && lineage.subtaskCount > 0 ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                        Decomposed → {lineage.subtaskCount} subtasks
                      </span>
                    ) : lineage?.parent ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        Subtask
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                        Original Task
                      </span>
                    )}
                  </div>

                  {/* Lineage details when present */}
                  {lineage &&
                    (lineage.parent ||
                      lineage.subtaskCount > 0 ||
                      lineage.siblingCount > 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5 text-sm">
                        {lineage.parent && (
                          <div className="flex items-center gap-2 text-blue-700">
                            <ChevronRight className="w-3 h-3" />
                            <span>Parent:</span>
                            <span className="font-mono text-xs bg-blue-100 px-1.5 py-0.5 rounded">
                              {lineage.parent.display_id}
                            </span>
                            <span className="truncate max-w-[200px]">
                              {lineage.parent.title}
                            </span>
                          </div>
                        )}
                        {lineage.subtaskCount > 0 && (
                          <div className="flex items-center gap-2 text-purple-700">
                            <ChevronRight className="w-3 h-3" />
                            <span>
                              Created {lineage.subtaskCount} subtask
                              {lineage.subtaskCount > 1 ? "s" : ""} via AI
                              decomposition
                            </span>
                          </div>
                        )}
                        {lineage.siblingCount > 0 && (
                          <div className="flex items-center gap-2 text-blue-700">
                            <ChevronRight className="w-3 h-3" />
                            <span>Siblings:</span>
                            <span className="font-medium">
                              {lineage.siblingCount}
                            </span>
                            <span className="text-xs text-blue-500">
                              (from same decomposition)
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                </div>

                {/* Decomposition Warning */}
                {needsDecomposition && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Scissors className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-medium text-amber-800">
                          Task Not Atomic
                        </h3>
                        <p className="text-sm text-amber-700 mt-1">
                          This task mentions multiple concerns and should be
                          decomposed into smaller, focused subtasks before
                          execution.
                        </p>
                        <button
                          onClick={() => {
                            console.log(
                              "[TaskCompletionModal] Decompose button clicked, taskId:",
                              taskId,
                            );
                            setDecompositionReason([
                              readiness.rules.singleConcern.reason ||
                                "Task needs decomposition",
                            ]);
                            console.log(
                              "[TaskCompletionModal] Setting showDecomposer to true",
                            );
                            setShowDecomposer(true);
                          }}
                          className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 transition-colors text-sm font-medium"
                        >
                          <Scissors className="w-4 h-4" />
                          Decompose Task
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Completion Sections */}
                <div className="space-y-4">
                  <CompletionSection
                    icon={<FileText className="w-5 h-5" />}
                    title="Description"
                    rule={readiness.rules.singleConcern}
                    fieldName="description"
                    onAutoFill={() => handleAutoFill("description")}
                    onManualAdd={(content) =>
                      handleManualAdd("description", content)
                    }
                    isLoading={savingSection === "description"}
                    showDecomposeHint={needsDecomposition}
                  />

                  <CompletionSection
                    icon={<FolderOpen className="w-5 h-5" />}
                    title="File Impacts"
                    rule={readiness.rules.boundedFiles}
                    fieldName="file_impacts"
                    showCount={
                      (readiness.rules.boundedFiles.details
                        ?.fileCount as number) || 0
                    }
                    countLabel="files"
                    onAutoFill={() => handleAutoFill("file_impacts")}
                    onManualAdd={(content) =>
                      handleManualAdd("file_impacts", content)
                    }
                    isLoading={savingSection === "file_impacts"}
                  />

                  <CompletionSection
                    icon={<Target className="w-5 h-5" />}
                    title="Acceptance Criteria"
                    rule={readiness.rules.clearCompletion}
                    fieldName="acceptance_criteria"
                    showCount={
                      (readiness.rules.clearCompletion.details
                        ?.criteriaCount as number) || 0
                    }
                    countLabel="criteria"
                    onAutoFill={() => handleAutoFill("acceptance_criteria")}
                    onManualAdd={(content) =>
                      handleManualAdd("acceptance_criteria", content)
                    }
                    isLoading={savingSection === "acceptance_criteria"}
                    isHighPriority
                  />

                  <CompletionSection
                    icon={<TestTube className="w-5 h-5" />}
                    title="Test Commands"
                    rule={readiness.rules.testable}
                    fieldName="test_commands"
                    onAutoFill={() => handleAutoFill("test_commands")}
                    onManualAdd={(content) =>
                      handleManualAdd("test_commands", content)
                    }
                    isLoading={savingSection === "test_commands"}
                    isHighPriority
                  />

                  <CompletionSection
                    icon={<Link className="w-5 h-5" />}
                    title="Dependencies"
                    rule={readiness.rules.independent}
                    fieldName="dependencies"
                    showCount={
                      (readiness.rules.independent.details
                        ?.depCount as number) || 0
                    }
                    countLabel="pending deps"
                    onAutoFill={() => handleAutoFill("dependencies")}
                    onManualAdd={(content) =>
                      handleManualAdd("dependencies", content)
                    }
                    isLoading={savingSection === "dependencies"}
                  />
                </div>

                {/* Missing Items Summary */}
                {readiness.missingItems.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <span className="text-sm font-medium text-amber-800">
                          Missing Items
                        </span>
                        <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                          {readiness.missingItems.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {onSave && (
                <button
                  onClick={onSave}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-md transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save & Close
                </button>
              )}

              {needsDecomposition && (
                <button
                  onClick={() => {
                    setDecompositionReason([
                      readiness?.rules.singleConcern.reason ||
                        "Task needs decomposition",
                    ]);
                    setShowDecomposer(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white hover:bg-amber-600 rounded-md transition-colors"
                >
                  <Scissors className="w-4 h-4" />
                  Decompose
                </button>
              )}

              {onExecute && (
                <button
                  data-testid="execute-now-btn"
                  onClick={onExecute}
                  disabled={!readiness?.isReady || needsDecomposition}
                  className={`
                    flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors
                    ${
                      readiness?.isReady && !needsDecomposition
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }
                  `}
                >
                  <Play className="w-4 h-4" />
                  Execute Now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decomposer Modal */}
      {showDecomposer && (
        <TaskDecomposerModal
          taskId={taskId}
          taskTitle={taskTitle || ""}
          reason={decompositionReason}
          onClose={() => setShowDecomposer(false)}
          onDecompose={handleDecompose}
        />
      )}
    </>
  );
}

// Readiness Progress Bar Subcomponent
interface ReadinessProgressBarProps {
  overall: number;
  threshold: number;
  isReady: boolean;
}

function ReadinessProgressBar({
  overall,
  threshold,
  isReady,
}: ReadinessProgressBarProps) {
  return (
    <div data-testid="readiness-progress-bar" className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Readiness</span>
        <span
          className={`text-sm font-semibold ${
            isReady ? "text-green-600" : "text-amber-600"
          }`}
        >
          {overall}%
        </span>
      </div>

      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        {/* Threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
          style={{ left: `${threshold}%` }}
        />

        {/* Progress fill */}
        <div
          className={`h-full transition-all duration-500 ${
            overall >= threshold ? "bg-green-500" : "bg-amber-500"
          }`}
          style={{ width: `${overall}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>0%</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 border border-gray-400 rounded-full" />
          {threshold}% threshold
        </span>
        <span>100%</span>
      </div>
    </div>
  );
}

// Completion Section Subcomponent
interface CompletionSectionProps {
  icon: React.ReactNode;
  title: string;
  rule: RuleResult;
  fieldName: string;
  showCount?: number;
  countLabel?: string;
  onAutoFill: () => void;
  onManualAdd: (content: string) => void;
  isLoading: boolean;
  isHighPriority?: boolean;
  showDecomposeHint?: boolean;
}

function CompletionSection({
  icon,
  title,
  rule,
  fieldName,
  showCount,
  countLabel,
  onAutoFill,
  onManualAdd,
  isLoading,
  isHighPriority = false,
  showDecomposeHint = false,
}: CompletionSectionProps) {
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualInput, setManualInput] = useState("");

  const statusIcon =
    rule.status === "pass" ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : rule.status === "warning" ? (
      <AlertCircle className="w-5 h-5 text-amber-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );

  const handleSubmitManual = () => {
    if (manualInput.trim()) {
      onManualAdd(manualInput.trim());
      setManualInput("");
      setIsAddingManual(false);
    }
  };

  return (
    <div
      data-testid={`completion-section-${fieldName}`}
      className={`
        p-4 rounded-lg border
        ${rule.status === "pass" ? "border-green-200 bg-green-50" : ""}
        ${rule.status === "warning" ? "border-amber-200 bg-amber-50" : ""}
        ${rule.status === "fail" ? "border-red-200 bg-red-50" : ""}
        ${isHighPriority && rule.status === "fail" ? "ring-2 ring-red-300" : ""}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {statusIcon}
          <div>
            <div className="flex items-center gap-2">
              {icon}
              <span className="font-medium text-gray-900">{title}</span>
              {isHighPriority && (
                <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                  25% weight
                </span>
              )}
            </div>
            {rule.reason && (
              <p className="text-sm text-gray-600 mt-1">{rule.reason}</p>
            )}
            {showCount !== undefined && (
              <p className="text-sm text-gray-500 mt-1">
                {showCount} {countLabel}
              </p>
            )}
            {showDecomposeHint && rule.status === "fail" && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Scissors className="w-3 h-3" />
                Consider decomposing this task
              </p>
            )}
          </div>
        </div>

        {rule.status !== "pass" && (
          <button
            onClick={onAutoFill}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            Auto-Fill
          </button>
        )}
      </div>

      {/* Manual add section */}
      {rule.status !== "pass" && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          {!isAddingManual ? (
            <button
              onClick={() => setIsAddingManual(true)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              <Plus className="w-4 h-4" />
              Add manually
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={`Enter ${title.toLowerCase()}...`}
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmitManual}
                  disabled={!manualInput.trim() || isLoading}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setIsAddingManual(false);
                    setManualInput("");
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
