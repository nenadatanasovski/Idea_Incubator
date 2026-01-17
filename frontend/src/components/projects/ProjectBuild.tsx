/**
 * ProjectBuild - Build sub-tab content
 * Shows tasks, kanban mini-view, and execution status
 */

import { useOutletContext, Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Pause,
  ExternalLink,
  Loader2,
  ListTodo,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import { useProjectTasks } from "../../hooks/useProjectTasks";
import type { ProjectWithStats } from "../../../../types/project";

interface OutletContext {
  project: ProjectWithStats;
}

const statusConfig: Record<
  string,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof CheckCircle2;
  }
> = {
  pending: {
    label: "Pending",
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    icon: AlertCircle,
  },
  in_progress: {
    label: "In Progress",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: Clock,
  },
  complete: {
    label: "Complete",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: XCircle,
  },
  blocked: {
    label: "Blocked",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    icon: Pause,
  },
};

export default function ProjectBuild() {
  const { project } = useOutletContext<OutletContext>();

  const { tasks, taskLists, summary, isLoading, error } = useProjectTasks(
    project.id,
  );

  // Group tasks by status for mini kanban
  const tasksByStatus = {
    pending: tasks.filter((t) => t.status === "pending"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    complete: tasks.filter((t) => t.status === "complete"),
    failed: tasks.filter((t) => t.status === "failed"),
    blocked: tasks.filter((t) => t.status === "blocked"),
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const completionPct =
    summary.total > 0
      ? Math.round((summary.completed / summary.total) * 100)
      : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header with progress and link to full kanban */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Build Progress</h3>
            <p className="text-sm text-gray-500">
              {summary.completed} of {summary.total} tasks completed
            </p>
          </div>
          <Link
            to={`/tasks/kanban?project=${project.slug}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
          >
            Open Full Kanban
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              "absolute left-0 top-0 h-full rounded-full transition-all duration-300",
              completionPct >= 100
                ? "bg-green-500"
                : completionPct >= 50
                  ? "bg-blue-500"
                  : "bg-amber-500",
            )}
            style={{ width: `${Math.min(completionPct, 100)}%` }}
          />
        </div>
        <div className="text-right text-sm text-gray-500 mt-1">
          {completionPct}%
        </div>
      </div>

      {/* Task Lists */}
      {taskLists.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Task Lists</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {taskLists.map((list) => (
              <div
                key={list.id}
                className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900 text-sm">
                      {list.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {list.completedCount}/{list.taskCount}
                  </span>
                </div>
                <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-primary-500 rounded-full"
                    style={{
                      width: `${list.taskCount > 0 ? ((list.completedCount || 0) / list.taskCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini Kanban */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Tasks by Status</h3>

        {summary.total === 0 ? (
          <div className="text-center py-8">
            <ListTodo className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No Tasks Yet
            </h4>
            <p className="text-gray-500 mb-4">
              This project doesn't have any tasks yet.
            </p>
            <Link
              to="/tasks"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Browse Task Lists
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {(
              Object.entries(tasksByStatus) as [
                keyof typeof statusConfig,
                typeof tasks,
              ][]
            ).map(([status, statusTasks]) => {
              const config = statusConfig[status];
              const Icon = config.icon;

              return (
                <div key={status} className="min-w-0">
                  {/* Column header */}
                  <div
                    className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-t-lg border-b-2",
                      config.bgColor,
                      config.borderColor,
                    )}
                  >
                    <Icon className={clsx("h-4 w-4", config.color)} />
                    <span className={clsx("text-sm font-medium", config.color)}>
                      {config.label}
                    </span>
                    <span
                      className={clsx(
                        "ml-auto text-xs font-medium px-1.5 py-0.5 rounded",
                        config.bgColor,
                        config.color,
                      )}
                    >
                      {statusTasks.length}
                    </span>
                  </div>

                  {/* Task cards */}
                  <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
                    {statusTasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="p-2 bg-white border border-gray-200 rounded text-sm"
                      >
                        <div className="font-mono text-xs text-gray-500 mb-1">
                          {task.displayId}
                        </div>
                        <div className="text-gray-900 line-clamp-2">
                          {task.title}
                        </div>
                      </div>
                    ))}
                    {statusTasks.length > 5 && (
                      <div className="text-xs text-gray-500 text-center py-1">
                        +{statusTasks.length - 5} more
                      </div>
                    )}
                    {statusTasks.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
