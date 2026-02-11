/**
 * TaskDetailModal Component
 *
 * Modal popup showing comprehensive task details with tabs for:
 * - Overview: Core task information
 * - Criteria: Pass criteria and test plans
 * - Dependencies: Task relationships
 * - History: State changes
 *
 * Ported from Vibe Platform for parent-harness dashboard.
 */

import { useState, useEffect, useCallback } from "react";
import type { Task } from "../api/types";
import api from "../api/client";
import { formatDateTime } from "../utils/format";
import { ExecutionsPanel } from "./ExecutionsPanel";

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onNavigateToTask?: (taskId: string) => void;
}

type TabType =
  | "overview"
  | "criteria"
  | "dependencies"
  | "history"
  | "executions";

const TAB_CONFIG: { id: TabType; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📋" },
  { id: "criteria", label: "Pass Criteria", icon: "✅" },
  { id: "dependencies", label: "Dependencies", icon: "🔗" },
  { id: "history", label: "History", icon: "📜" },
  { id: "executions", label: "Executions", icon: "🔄" },
];

// Extended task type with additional fields from API
interface TaskDetail extends Task {
  test_plan?: string;
  acceptance_criteria?: string[];
  dependencies?: {
    depends_on: TaskRelation[];
    blocks: TaskRelation[];
  };
  state_history?: StateHistoryItem[];
}

interface TaskRelation {
  id: string;
  display_id: string;
  title: string;
  status: string;
}

interface StateHistoryItem {
  id: string;
  from_status?: string;
  to_status: string;
  changed_by: string;
  actor_type: string;
  created_at: string;
}

export function TaskDetailModal({
  taskId,
  onClose,
  onNavigateToTask,
}: TaskDetailModalProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const fetchTaskDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<TaskDetail>(`/api/tasks/${taskId}`);
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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl min-h-[70vh] max-h-[90vh] flex flex-col mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-6 w-48 bg-gray-700 animate-pulse rounded" />
            ) : task ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-sm text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded shrink-0">
                  {task.display_id}
                </span>
                <StatusBadge status={task.status} />
                <h2 className="text-lg font-semibold text-white truncate">
                  {task.title}
                </h2>
              </div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 px-4">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                border-b-2 -mb-px transition-colors
                ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
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
              {activeTab === "criteria" && <CriteriaTab task={task} />}
              {activeTab === "dependencies" && (
                <DependenciesTab task={task} onTaskClick={handleTaskClick} />
              )}
              {activeTab === "history" && <HistoryTab task={task} />}
              {activeTab === "executions" && (
                <ExecutionsPanel taskId={task.id} />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    pending: { bg: "bg-gray-700", text: "text-gray-300" },
    in_progress: { bg: "bg-blue-900/50", text: "text-blue-300" },
    completed: { bg: "bg-green-900/50", text: "text-green-300" },
    failed: { bg: "bg-red-900/50", text: "text-red-300" },
    blocked: { bg: "bg-amber-900/50", text: "text-amber-300" },
  };

  const statusConfig = config[status] || config.pending;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <svg
        className="w-8 h-8 text-blue-500 animate-spin"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
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
      <svg
        className="w-8 h-8 text-red-500 mb-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <p className="text-red-400 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );
}

// Tab Components
function OverviewTab({ task }: { task: TaskDetail }) {
  return (
    <div className="space-y-6">
      {/* Description */}
      {task.description && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Description
          </h3>
          <p className="text-gray-200 whitespace-pre-wrap">
            {task.description}
          </p>
        </div>
      )}

      {/* Properties Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <PropertyCard label="Category">{task.category || "—"}</PropertyCard>
        <PropertyCard label="Priority">{task.priority || "—"}</PropertyCard>
        <PropertyCard label="Status">
          <StatusBadge status={task.status} />
        </PropertyCard>
        <PropertyCard label="Assigned Agent">
          {task.assigned_agent_id || "Unassigned"}
        </PropertyCard>
        <PropertyCard label="Task List">{task.task_list_id}</PropertyCard>
        {task.parent_task_id && (
          <PropertyCard label="Parent Task">{task.parent_task_id}</PropertyCard>
        )}
      </div>

      {/* Timestamps */}
      <div className="border-t border-gray-700 pt-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          📅 Timestamps
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Created:</span>{" "}
            <span className="text-gray-300">
              {formatDateTime(task.created_at)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Updated:</span>{" "}
            <span className="text-gray-300">
              {formatDateTime(task.updated_at)}
            </span>
          </div>
          {task.started_at && (
            <div>
              <span className="text-gray-500">Started:</span>{" "}
              <span className="text-gray-300">
                {formatDateTime(task.started_at)}
              </span>
            </div>
          )}
          {task.completed_at && (
            <div>
              <span className="text-gray-500">Completed:</span>{" "}
              <span className="text-gray-300">
                {formatDateTime(task.completed_at)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PropertyCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-3">
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className="text-gray-200 font-medium">{children}</div>
    </div>
  );
}

function CriteriaTab({ task }: { task: TaskDetail }) {
  return (
    <div className="space-y-6">
      {/* Pass Criteria */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          ✅ Pass Criteria
        </h3>
        {task.pass_criteria ? (
          <div className="bg-gray-700/50 rounded-lg p-4">
            <pre className="text-gray-200 whitespace-pre-wrap font-mono text-sm">
              {task.pass_criteria}
            </pre>
          </div>
        ) : (
          <p className="text-gray-500 italic">No pass criteria defined</p>
        )}
      </div>

      {/* Test Plan */}
      {task.test_plan && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            🧪 Test Plan
          </h3>
          <div className="bg-gray-700/50 rounded-lg p-4">
            <pre className="text-gray-200 whitespace-pre-wrap font-mono text-sm">
              {task.test_plan}
            </pre>
          </div>
        </div>
      )}

      {/* Acceptance Criteria */}
      {task.acceptance_criteria && task.acceptance_criteria.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            📝 Acceptance Criteria ({task.acceptance_criteria.length})
          </h3>
          <ul className="space-y-2">
            {task.acceptance_criteria.map((criterion, i) => (
              <li
                key={i}
                className="flex items-start gap-2 bg-gray-700/50 rounded-lg p-3"
              >
                <span className="text-green-400 mt-0.5">☐</span>
                <span className="text-gray-200">{criterion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {!task.pass_criteria &&
        !task.test_plan &&
        (!task.acceptance_criteria ||
          task.acceptance_criteria.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl mb-4 block">📋</span>
            <p>No criteria or test plans defined for this task</p>
          </div>
        )}
    </div>
  );
}

function DependenciesTab({
  task,
  onTaskClick,
}: {
  task: TaskDetail;
  onTaskClick: (id: string) => void;
}) {
  const deps = task.dependencies;

  if (!deps || (deps.depends_on.length === 0 && deps.blocks.length === 0)) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl mb-4 block">🔗</span>
        <p>No dependencies defined for this task</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Depends On */}
      {deps.depends_on.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            ⬅️ Depends On ({deps.depends_on.length})
          </h3>
          <div className="space-y-2">
            {deps.depends_on.map((dep) => (
              <DependencyCard
                key={dep.id}
                task={dep}
                onClick={() => onTaskClick(dep.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Blocks */}
      {deps.blocks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            ➡️ Blocks ({deps.blocks.length})
          </h3>
          <div className="space-y-2">
            {deps.blocks.map((dep) => (
              <DependencyCard
                key={dep.id}
                task={dep}
                onClick={() => onTaskClick(dep.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DependencyCard({
  task,
  onClick,
}: {
  task: TaskRelation;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-blue-400">
          {task.display_id}
        </span>
        <span className="text-gray-200 truncate">{task.title}</span>
      </div>
      <StatusBadge status={task.status} />
    </div>
  );
}

function HistoryTab({ task }: { task: TaskDetail }) {
  const history = task.state_history;

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <span className="text-4xl mb-4 block">📜</span>
        <p>No state changes recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((sh) => (
        <div
          key={sh.id}
          className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {sh.from_status && (
              <>
                <StatusBadge status={sh.from_status} />
                <svg
                  className="w-4 h-4 text-gray-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </>
            )}
            <StatusBadge status={sh.to_status} />
          </div>
          <div className="text-sm text-gray-400">
            <span className="text-gray-300">{sh.changed_by}</span>
            <span className="text-gray-500"> ({sh.actor_type})</span>
          </div>
          <div className="text-xs text-gray-500">
            {formatDateTime(sh.created_at)}
          </div>
        </div>
      ))}
    </div>
  );
}

// formatDateTime imported from ../utils/format

export default TaskDetailModal;
