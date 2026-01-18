/**
 * TaskGroupCard - Collapsible card for a group of tasks
 *
 * Shows group label, progress bar, and expandable task list.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Pause,
} from "lucide-react";
import clsx from "clsx";
import type { TaskGroup } from "../../hooks/useGroupedTasks";

interface TaskGroupCardProps {
  group: TaskGroup;
  projectSlug: string;
  defaultExpanded?: boolean;
  colorScheme?: "blue" | "purple" | "orange" | "green" | "gray";
}

// Status colors and icons
const statusConfig: Record<
  string,
  { bg: string; text: string; icon: typeof CheckCircle2 }
> = {
  completed: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle2 },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700", icon: Clock },
  pending: { bg: "bg-gray-100", text: "text-gray-700", icon: AlertCircle },
  failed: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
  blocked: { bg: "bg-amber-100", text: "text-amber-700", icon: Pause },
};

// Color scheme borders
const colorBorders: Record<string, string> = {
  blue: "border-l-blue-500",
  purple: "border-l-purple-500",
  orange: "border-l-orange-500",
  green: "border-l-green-500",
  gray: "border-l-gray-400",
};

export default function TaskGroupCard({
  group,
  projectSlug,
  defaultExpanded = false,
  colorScheme = "blue",
}: TaskGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={clsx(
        "bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden border-l-4",
        colorBorders[colorScheme],
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <div>
            <span className="font-medium text-gray-900">{group.label}</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                {group.tasks.length}{" "}
                {group.tasks.length === 1 ? "task" : "tasks"}
              </span>
              <span
                className={clsx(
                  "text-xs font-medium px-1.5 py-0.5 rounded",
                  group.progress.percentage === 100
                    ? "bg-green-100 text-green-700"
                    : group.progress.percentage >= 50
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700",
                )}
              >
                {group.progress.percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all",
              group.progress.percentage === 100
                ? "bg-green-500"
                : group.progress.percentage >= 50
                  ? "bg-blue-500"
                  : "bg-gray-400",
            )}
            style={{ width: `${group.progress.percentage}%` }}
          />
        </div>
      </button>

      {/* Task list */}
      {isExpanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {group.tasks.map((task) => {
            const config = statusConfig[task.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <Link
                key={task.id}
                to={`/projects/${projectSlug}/build?task=${task.displayId || task.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon
                    className={clsx("h-4 w-4 flex-shrink-0", config.text)}
                  />
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-primary-600">
                      {task.displayId || task.id.slice(0, 8)}
                    </span>
                    <p className="text-sm text-gray-700 truncate">
                      {task.title}
                    </p>
                  </div>
                </div>
                <span
                  className={clsx(
                    "text-xs px-2 py-0.5 rounded flex-shrink-0 ml-2",
                    config.bg,
                    config.text,
                  )}
                >
                  {task.status.replace("_", " ")}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
