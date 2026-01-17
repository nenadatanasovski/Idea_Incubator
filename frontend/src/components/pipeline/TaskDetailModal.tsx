/**
 * TaskDetailModal Component
 *
 * Modal popup showing comprehensive task details with tabs for:
 * - Overview: Core task information
 * - Dependencies: Task relationships
 * - File Impacts: Files affected by this task
 * - Tests: Test results
 * - History: State changes and versions
 * - Appendices: Attached context documents
 */

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Clock,
  FileCode,
  GitBranch,
  TestTube2,
  History,
  FileText,
  AlertTriangle,
  Check,
  XCircle,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  List,
  Tag,
  User,
  Calendar,
  Folder,
} from "lucide-react";
import type { TaskDetailInfo, TaskRelation } from "../../types/pipeline";

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onNavigateToTask?: (taskId: string) => void;
}

type TabType =
  | "overview"
  | "dependencies"
  | "files"
  | "tests"
  | "history"
  | "appendices";

const TAB_CONFIG: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <FileText className="w-4 h-4" /> },
  {
    id: "dependencies",
    label: "Dependencies",
    icon: <GitBranch className="w-4 h-4" />,
  },
  { id: "files", label: "Files", icon: <FileCode className="w-4 h-4" /> },
  { id: "tests", label: "Tests", icon: <TestTube2 className="w-4 h-4" /> },
  { id: "history", label: "History", icon: <History className="w-4 h-4" /> },
  { id: "appendices", label: "Appendices", icon: <List className="w-4 h-4" /> },
];

export default function TaskDetailModal({
  taskId,
  onClose,
  onNavigateToTask,
}: TaskDetailModalProps) {
  const [task, setTask] = useState<TaskDetailInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const fetchTaskDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/pipeline/tasks/${taskId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch task: ${response.statusText}`);
      }
      const data = await response.json();
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTaskDetail();
  }, [fetchTaskDetail]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleTaskClick = (relatedTaskId: string) => {
    if (onNavigateToTask) {
      onNavigateToTask(relatedTaskId);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[1600px] min-h-[85vh] max-h-[95vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" />
            ) : task ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                    {task.displayId || task.id.slice(0, 8)}
                  </span>
                  <StatusBadge status={task.status} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mt-1 truncate">
                  {task.title}
                </h2>
              </div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded transition-colors ml-2"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                border-b-2 -mb-px transition-colors
                ${
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }
              `}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "dependencies" && task && (
                <DependencyCount dependencies={task.dependencies} />
              )}
              {tab.id === "files" && task && task.fileImpacts.length > 0 && (
                <span className="text-xs bg-gray-100 px-1.5 rounded-full">
                  {task.fileImpacts.length}
                </span>
              )}
              {tab.id === "tests" && task && task.testResults.length > 0 && (
                <TestSummaryBadge testResults={task.testResults} />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={fetchTaskDetail} />
          ) : task ? (
            <>
              {activeTab === "overview" && <OverviewTab task={task} />}
              {activeTab === "dependencies" && (
                <DependenciesTab
                  dependencies={task.dependencies}
                  onTaskClick={handleTaskClick}
                />
              )}
              {activeTab === "files" && (
                <FilesTab
                  fileImpacts={task.fileImpacts}
                  fileChanges={task.fileChanges}
                />
              )}
              {activeTab === "tests" && (
                <TestsTab
                  testResults={task.testResults}
                  appendices={task.appendices}
                />
              )}
              {activeTab === "history" && (
                <HistoryTab
                  stateHistory={task.stateHistory}
                  versions={task.versions}
                />
              )}
              {activeTab === "appendices" && (
                <AppendicesTab appendices={task.appendices} />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ================================
// Helper Components
// ================================

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
    pending: {
      bg: "bg-gray-100",
      text: "text-gray-600",
      icon: <Clock className="w-3 h-3" />,
    },
    in_progress: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      icon: <RefreshCw className="w-3 h-3 animate-spin" />,
    },
    completed: {
      bg: "bg-green-100",
      text: "text-green-700",
      icon: <Check className="w-3 h-3" />,
    },
    failed: {
      bg: "bg-red-100",
      text: "text-red-700",
      icon: <XCircle className="w-3 h-3" />,
    },
    blocked: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    skipped: {
      bg: "bg-gray-100",
      text: "text-gray-500",
      icon: <ArrowRight className="w-3 h-3" />,
    },
  };

  const statusConfig = config[status] || config.pending;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
    >
      {statusConfig.icon}
      {status.replace(/_/g, " ")}
    </span>
  );
}

function DependencyCount({
  dependencies,
}: {
  dependencies: TaskDetailInfo["dependencies"];
}) {
  // Count all 12 relationship types
  const total =
    dependencies.dependsOn.length +
    dependencies.blocks.length +
    dependencies.relatedTo.length +
    dependencies.duplicateOf.length +
    dependencies.parentOf.length +
    dependencies.childOf.length +
    (dependencies.supersedes?.length || 0) +
    (dependencies.implements?.length || 0) +
    (dependencies.conflictsWith?.length || 0) +
    (dependencies.enables?.length || 0) +
    (dependencies.inspiredBy?.length || 0) +
    (dependencies.tests?.length || 0);
  if (total === 0) return null;
  return (
    <span className="text-xs bg-gray-100 px-1.5 rounded-full">{total}</span>
  );
}

function TestSummaryBadge({
  testResults,
}: {
  testResults: TaskDetailInfo["testResults"];
}) {
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.length - passed;
  if (failed > 0) {
    return (
      <span className="text-xs bg-red-100 text-red-700 px-1.5 rounded-full">
        {failed} failed
      </span>
    );
  }
  return (
    <span className="text-xs bg-green-100 text-green-700 px-1.5 rounded-full">
      {passed} passed
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
      <p className="text-red-600 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
      >
        Retry
      </button>
    </div>
  );
}

// ================================
// Tab Components
// ================================

function OverviewTab({ task }: { task: TaskDetailInfo }) {
  return (
    <div className="space-y-6">
      {/* Description */}
      {task.description && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Description
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">
            {task.description}
          </p>
        </div>
      )}

      {/* Properties Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <PropertyCard icon={<Tag className="w-4 h-4" />} label="Category">
          {task.category || "—"}
        </PropertyCard>
        <PropertyCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Priority"
        >
          {task.priority || "—"}
        </PropertyCard>
        <PropertyCard icon={<Clock className="w-4 h-4" />} label="Effort">
          {task.effort || "—"}
        </PropertyCard>
        <PropertyCard icon={<List className="w-4 h-4" />} label="Phase">
          {task.phase !== undefined ? `Phase ${task.phase}` : "—"}
        </PropertyCard>
        <PropertyCard icon={<User className="w-4 h-4" />} label="Owner">
          {task.owner || "—"}
        </PropertyCard>
        <PropertyCard icon={<Folder className="w-4 h-4" />} label="Queue">
          {task.queue || "In Task List"}
        </PropertyCard>
      </div>

      {/* Task List Info */}
      {task.taskList && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <List className="w-4 h-4" />
            Task List
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">
                {task.taskList.name}
              </span>
              <StatusBadge status={task.taskList.status} />
            </div>
            {task.taskList.description && (
              <p className="text-sm text-gray-600">
                {task.taskList.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>
                {task.taskList.completedTasks}/{task.taskList.totalTasks}{" "}
                complete
              </span>
              {task.taskList.failedTasks > 0 && (
                <span className="text-red-600">
                  {task.taskList.failedTasks} failed
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRD Connections */}
      {task.prds && task.prds.length > 0 && (
        <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-purple-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Product Requirements ({task.prds.length})
          </h3>
          <div className="space-y-2">
            {task.prds.map((prd) => (
              <div
                key={prd.id}
                className="flex items-center justify-between bg-white rounded p-3 border border-purple-200"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded shrink-0">
                    {prd.slug}
                  </span>
                  <span className="text-gray-900 truncate">{prd.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      prd.linkType === "implements"
                        ? "bg-green-100 text-green-700"
                        : prd.linkType === "tests"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {prd.linkType}
                  </span>
                  <StatusBadge status={prd.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Timestamps
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Created:</span>{" "}
            <span className="text-gray-700">
              {formatDateTime(task.createdAt)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Updated:</span>{" "}
            <span className="text-gray-700">
              {formatDateTime(task.updatedAt)}
            </span>
          </div>
          {task.startedAt && (
            <div>
              <span className="text-gray-500">Started:</span>{" "}
              <span className="text-gray-700">
                {formatDateTime(task.startedAt)}
              </span>
            </div>
          )}
          {task.completedAt && (
            <div>
              <span className="text-gray-500">Completed:</span>{" "}
              <span className="text-gray-700">
                {formatDateTime(task.completedAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PropertyCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className="text-gray-900 font-medium">{children}</div>
    </div>
  );
}

function DependenciesTab({
  dependencies,
  onTaskClick,
}: {
  dependencies: TaskDetailInfo["dependencies"];
  onTaskClick: (taskId: string) => void;
}) {
  // All 12 relationship types per task-data-model-diagram.md
  const sections = [
    // Original 6 types
    {
      title: "Depends On",
      items: dependencies.dependsOn,
      color: "text-blue-600",
    },
    { title: "Blocks", items: dependencies.blocks, color: "text-amber-600" },
    {
      title: "Related To",
      items: dependencies.relatedTo,
      color: "text-gray-600",
    },
    {
      title: "Parent Of",
      items: dependencies.parentOf,
      color: "text-purple-600",
    },
    { title: "Child Of", items: dependencies.childOf, color: "text-teal-600" },
    {
      title: "Duplicate Of",
      items: dependencies.duplicateOf,
      color: "text-red-600",
    },
    // Additional 6 types
    {
      title: "Supersedes",
      items: dependencies.supersedes || [],
      color: "text-indigo-600",
    },
    {
      title: "Implements",
      items: dependencies.implements || [],
      color: "text-green-600",
    },
    {
      title: "Conflicts With",
      items: dependencies.conflictsWith || [],
      color: "text-rose-600",
    },
    {
      title: "Enables",
      items: dependencies.enables || [],
      color: "text-cyan-600",
    },
    {
      title: "Inspired By",
      items: dependencies.inspiredBy || [],
      color: "text-pink-600",
    },
    {
      title: "Tests",
      items: dependencies.tests || [],
      color: "text-violet-600",
    },
  ];

  const hasAny = sections.some((s) => s.items.length > 0);

  if (!hasAny) {
    return (
      <div className="text-center py-12 text-gray-500">
        <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No dependencies or relationships defined</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map(
        (section) =>
          section.items.length > 0 && (
            <div key={section.title}>
              <h3
                className={`text-sm font-medium mb-2 flex items-center gap-2 ${section.color}`}
              >
                <GitBranch className="w-4 h-4" />
                {section.title} ({section.items.length})
              </h3>
              <div className="space-y-2">
                {section.items.map((rel: TaskRelation) => (
                  <div
                    key={rel.taskId}
                    onClick={() => onTaskClick(rel.taskId)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-primary-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                        {rel.displayId || rel.taskId.slice(0, 8)}
                      </span>
                      <span className="text-gray-700 truncate">
                        {rel.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rel.status} />
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  );
}

function FilesTab({
  fileImpacts,
  fileChanges,
}: {
  fileImpacts: TaskDetailInfo["fileImpacts"];
  fileChanges: TaskDetailInfo["fileChanges"];
}) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (id: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (fileImpacts.length === 0 && fileChanges.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No file impacts recorded</p>
      </div>
    );
  }

  const opColors: Record<string, string> = {
    CREATE: "bg-green-100 text-green-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
    READ: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-6">
      {/* Expected Impacts */}
      {fileImpacts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Expected File Impacts ({fileImpacts.length})
          </h3>
          <div className="space-y-2">
            {fileImpacts.map((fi) => (
              <div key={fi.id} className="border border-gray-200 rounded-lg">
                <div
                  onClick={() => toggleFile(fi.id)}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                >
                  {expandedFiles.has(fi.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${opColors[fi.operation] || opColors.READ}`}
                  >
                    {fi.operation}
                  </span>
                  <span className="font-mono text-sm text-gray-700 truncate flex-1">
                    {fi.filePath}
                  </span>
                  <span className="text-xs text-gray-500">
                    {Math.round(fi.confidence * 100)}% confidence
                  </span>
                  {fi.wasAccurate !== undefined && (
                    <span
                      className={`text-xs ${fi.wasAccurate ? "text-green-600" : "text-red-600"}`}
                    >
                      {fi.wasAccurate ? "Accurate" : "Inaccurate"}
                    </span>
                  )}
                </div>
                {expandedFiles.has(fi.id) && (
                  <div className="px-3 pb-3 border-t border-gray-100 pt-2 text-sm text-gray-600">
                    <div>
                      <span className="text-gray-500">Source:</span> {fi.source}
                    </div>
                    <div>
                      <span className="text-gray-500">Created:</span>{" "}
                      {formatDateTime(fi.createdAt)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actual Changes */}
      {fileChanges.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Actual File Changes ({fileChanges.length})
          </h3>
          <div className="space-y-2">
            {fileChanges.map((fc) => (
              <div
                key={fc.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${opColors[fc.operation] || opColors.READ}`}
                >
                  {fc.operation}
                </span>
                <span className="font-mono text-sm text-gray-700 truncate flex-1">
                  {fc.filePath}
                </span>
                {(fc.linesAdded !== undefined ||
                  fc.linesRemoved !== undefined) && (
                  <span className="text-xs">
                    {fc.linesAdded !== undefined && (
                      <span className="text-green-600">+{fc.linesAdded}</span>
                    )}
                    {fc.linesAdded !== undefined &&
                      fc.linesRemoved !== undefined &&
                      " / "}
                    {fc.linesRemoved !== undefined && (
                      <span className="text-red-600">-{fc.linesRemoved}</span>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TestsTab({
  testResults,
  appendices,
}: {
  testResults: TaskDetailInfo["testResults"];
  appendices: TaskDetailInfo["appendices"];
}) {
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  // Extract acceptance criteria from appendices
  const acceptanceCriteria = appendices.filter(
    (a) => a.appendixType === "acceptance_criteria",
  );

  const toggleTest = (id: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Show empty state only if no tests AND no acceptance criteria
  if (testResults.length === 0 && acceptanceCriteria.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <TestTube2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium mb-2">No test results recorded</p>
        <p className="text-sm max-w-md mx-auto">
          Tests are recorded when a Build Agent executes this task. The
          three-level validation (syntax, unit, e2e) runs automatically during
          execution.
        </p>
        <div className="mt-4 text-xs text-gray-400">
          <p>To populate tests:</p>
          <ul className="mt-1 space-y-1">
            <li>• Execute the task via a Build Agent</li>
            <li>• Add acceptance criteria via task appendices</li>
            <li>• Define validation commands in task spec</li>
          </ul>
        </div>
      </div>
    );
  }

  const levelLabels: Record<number, string> = {
    1: "Syntax",
    2: "Unit",
    3: "E2E",
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-green-700">
            {testResults.filter((t) => t.passed).length} passed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-600" />
          <span className="text-red-700">
            {testResults.filter((t) => !t.passed).length} failed
          </span>
        </div>
      </div>

      {/* Test List */}
      <div className="space-y-2">
        {testResults.map((test) => (
          <div key={test.id} className="border border-gray-200 rounded-lg">
            <div
              onClick={() => toggleTest(test.id)}
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
            >
              {expandedTests.has(test.id) ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              {test.passed ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                {levelLabels[test.testLevel] || `Level ${test.testLevel}`}
              </span>
              <span className="text-gray-700 truncate flex-1">
                {test.testName || test.command}
              </span>
              <span className="text-xs text-gray-500">
                {formatDuration(test.durationMs)}
              </span>
            </div>
            {expandedTests.has(test.id) && (
              <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Command:</span>
                  <code className="block mt-1 p-2 bg-gray-100 rounded text-xs font-mono overflow-x-auto">
                    {test.command}
                  </code>
                </div>
                <div className="flex items-center gap-4">
                  <span>
                    <span className="text-gray-500">Exit code:</span>{" "}
                    <span
                      className={
                        test.exitCode === 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {test.exitCode}
                    </span>
                  </span>
                  <span>
                    <span className="text-gray-500">Duration:</span>{" "}
                    {formatDuration(test.durationMs)}
                  </span>
                </div>
                {test.stdout && (
                  <div>
                    <span className="text-gray-500">Output:</span>
                    <pre className="mt-1 p-2 bg-gray-100 rounded text-xs font-mono max-h-32 overflow-auto whitespace-pre-wrap">
                      {test.stdout}
                    </pre>
                  </div>
                )}
                {test.stderr && (
                  <div>
                    <span className="text-red-500">Errors:</span>
                    <pre className="mt-1 p-2 bg-red-50 rounded text-xs font-mono max-h-32 overflow-auto whitespace-pre-wrap text-red-700">
                      {test.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Acceptance Criteria */}
      {acceptanceCriteria.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Acceptance Criteria
          </h3>
          <div className="space-y-2">
            {acceptanceCriteria.map((ac) => (
              <div
                key={ac.id}
                className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
              >
                {ac.content ? (
                  <ul className="space-y-1 text-sm">
                    {ac.content
                      .split("\n")
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span className="text-gray-700">
                            {line.replace(/^[-*•]\s*/, "")}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : ac.referenceId ? (
                  <p className="text-sm text-gray-600">
                    See:{" "}
                    <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                      {ac.referenceTable ? `${ac.referenceTable}:` : ""}
                      {ac.referenceId}
                    </code>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">No content</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTab({
  stateHistory,
  versions,
}: {
  stateHistory: TaskDetailInfo["stateHistory"];
  versions: TaskDetailInfo["versions"];
}) {
  const [view, setView] = useState<"states" | "versions">("states");

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setView("states")}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            view === "states"
              ? "bg-white text-gray-900 shadow"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          State History ({stateHistory.length})
        </button>
        <button
          onClick={() => setView("versions")}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            view === "versions"
              ? "bg-white text-gray-900 shadow"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Versions ({versions.length})
        </button>
      </div>

      {view === "states" ? (
        stateHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No state changes recorded</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stateHistory.map((sh) => (
              <div
                key={sh.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {sh.fromStatus && (
                    <>
                      <StatusBadge status={sh.fromStatus} />
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </>
                  )}
                  <StatusBadge status={sh.toStatus} />
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-700">{sh.changedBy}</span>
                  <span className="text-gray-400"> ({sh.actorType})</span>
                </div>
                <div className="text-xs text-gray-400">
                  {formatDateTime(sh.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )
      ) : versions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No versions recorded</p>
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm bg-gray-200 px-2 py-0.5 rounded">
                    v{v.version}
                  </span>
                  {v.isCheckpoint && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                      {v.checkpointName || "Checkpoint"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {formatDateTime(v.createdAt)}
                </div>
              </div>
              {v.changeReason && (
                <p className="text-sm text-gray-600 mb-2">{v.changeReason}</p>
              )}
              {v.changedFields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {v.changedFields.map((field) => (
                    <span
                      key={field}
                      className="text-xs bg-gray-200 px-1.5 py-0.5 rounded"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-2">by {v.createdBy}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppendicesTab({
  appendices,
}: {
  appendices: TaskDetailInfo["appendices"];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (appendices.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <List className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No appendices attached</p>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    prd_reference: "PRD Reference",
    code_context: "Code Context",
    gotcha_list: "Gotchas",
    rollback_plan: "Rollback Plan",
    test_context: "Test Context",
    dependency_notes: "Dependency Notes",
    architecture_decision: "Architecture Decision",
    user_story: "User Story",
    acceptance_criteria: "Acceptance Criteria",
    research_notes: "Research Notes",
    api_contract: "API Contract",
  };

  return (
    <div className="space-y-2">
      {appendices.map((a) => (
        <div key={a.id} className="border border-gray-200 rounded-lg">
          <div
            onClick={() => toggle(a.id)}
            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
          >
            {expanded.has(a.id) ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
              {typeLabels[a.appendixType] || a.appendixType}
            </span>
            <span className="text-gray-700 flex-1">
              {a.contentType === "reference"
                ? `Reference: ${a.referenceTable}#${a.referenceId}`
                : "Inline content"}
            </span>
          </div>
          {expanded.has(a.id) && a.content && (
            <div className="px-3 pb-3 border-t border-gray-100 pt-2">
              <pre className="p-3 bg-gray-50 rounded text-sm font-mono whitespace-pre-wrap overflow-x-auto max-h-64">
                {a.content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ================================
// Utility Functions
// ================================

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
