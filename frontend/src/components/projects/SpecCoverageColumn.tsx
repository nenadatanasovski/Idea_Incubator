/**
 * SpecCoverageColumn - Coverage status for a single success criterion or constraint
 *
 * Displays coverage status (covered/uncovered) with task count.
 * Clickable to show linked tasks popover.
 *
 * Accepts pre-fetched tasks prop to avoid N+1 API calls when used in tables.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react";
import clsx from "clsx";
import type { LinkedTask } from "../../hooks/useTraceability";

interface SpecCoverageColumnProps {
  prdId: string;
  sectionType: "success_criteria" | "constraints";
  itemIndex: number;
  projectSlug: string;
  /** Pre-fetched tasks from parent - avoids individual API calls */
  preloadedTasks?: LinkedTask[];
  /** Loading state from parent */
  isParentLoading?: boolean;
}

// Status color mapping
const statusColors: Record<string, { bg: string; text: string }> = {
  completed: { bg: "bg-green-100", text: "text-green-700" },
  complete: { bg: "bg-green-100", text: "text-green-700" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700" },
  pending: { bg: "bg-gray-100", text: "text-gray-700" },
  failed: { bg: "bg-red-100", text: "text-red-700" },
  blocked: { bg: "bg-amber-100", text: "text-amber-700" },
};

export default function SpecCoverageColumn({
  projectSlug,
  preloadedTasks,
  isParentLoading = false,
}: SpecCoverageColumnProps) {
  const [showPopover, setShowPopover] = useState(false);

  // Use pre-fetched tasks if available
  const tasks = preloadedTasks || [];
  const isCovered = tasks.length > 0;

  if (isParentLoading) {
    return (
      <td className="py-2 w-24 text-center">
        <Loader2 className="h-3 w-3 animate-spin text-gray-400 inline" />
      </td>
    );
  }

  return (
    <td className="py-2 w-24 relative">
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={clsx(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors",
          isCovered
            ? "bg-green-100 text-green-700 hover:bg-green-200"
            : "bg-amber-100 text-amber-700 hover:bg-amber-200",
        )}
      >
        {isCovered ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </>
        ) : (
          <>
            <AlertTriangle className="h-3 w-3" />0 tasks
          </>
        )}
      </button>

      {/* Popover */}
      {showPopover && tasks.length > 0 && (
        <div className="absolute z-50 right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">
              Linked Tasks
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPopover(false);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {tasks.map((task) => {
              const colors = statusColors[task.status] || statusColors.pending;
              return (
                <Link
                  key={task.id}
                  to={`/projects/${projectSlug}/build?task=${task.displayId}`}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <span className="font-mono text-xs text-primary-600">
                      {task.displayId}
                    </span>
                    <p className="text-xs text-gray-600 truncate max-w-40">
                      {task.title}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "text-xs px-1.5 py-0.5 rounded",
                      colors.bg,
                      colors.text,
                    )}
                  >
                    {task.status}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </td>
  );
}
