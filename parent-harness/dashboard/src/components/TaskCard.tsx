import { useState } from "react";
import { SessionLogs } from "./SessionLogs";

const API_BASE = "http://localhost:3333/api";

interface TaskCardProps {
  id: string;
  displayId: string;
  title: string;
  status:
    | "pending"
    | "in_progress"
    | "completed"
    | "failed"
    | "blocked"
    | "pending_verification";
  priority: "P0" | "P1" | "P2" | "P3" | "P4";
  assignedAgent?: string;
  category?: string;
  onAction?: () => void;
}

const priorityColors = {
  P0: "bg-red-600 text-white",
  P1: "bg-orange-500 text-white",
  P2: "bg-yellow-500 text-black",
  P3: "bg-blue-500 text-white",
  P4: "bg-gray-500 text-white",
};

const statusColors: Record<string, string> = {
  pending: "text-gray-400",
  in_progress: "text-blue-400",
  completed: "text-green-400",
  failed: "text-red-400",
  blocked: "text-yellow-400",
  pending_verification: "text-purple-400",
};

const statusIcons: Record<string, string> = {
  pending: "⏳",
  in_progress: "🔄",
  completed: "✅",
  failed: "❌",
  blocked: "🚫",
  pending_verification: "🔍",
};

export function TaskCard({
  id,
  displayId,
  title,
  status,
  priority,
  assignedAgent,
  category,
  onAction,
}: TaskCardProps) {
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const handleAction = async (action: "retry" | "unblock" | "cancel") => {
    setLoading(true);
    try {
      const endpoint = `${API_BASE}/tasks/${id}/${action}`;
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        console.error(`Action ${action} failed:`, await res.text());
      }
      onAction?.();
    } catch (err) {
      console.error(`Action ${action} error:`, err);
    } finally {
      setLoading(false);
    }
  };

  const showRetry = status === "failed" || status === "blocked";
  const showUnblock = status === "blocked";
  const showCancel = status === "in_progress";
  // Show logs button for any task that has been started
  const showLogsButton = status !== "pending";

  return (
    <>
      <div
        data-testid="task-card"
        data-task-id={id}
        className="bg-gray-700 rounded-lg p-3 mb-3"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-1.5 py-0.5 rounded text-xs font-bold ${priorityColors[priority]}`}
            >
              {priority}
            </span>
            <span className="font-mono text-xs text-gray-400">{displayId}</span>
          </div>
          <span
            className={`text-sm ${statusColors[status] || "text-gray-400"}`}
          >
            {statusIcons[status] || "📋"} {status.replace("_", " ")}
          </span>
        </div>

        <h3 className="text-sm font-medium text-white mb-2 line-clamp-2">
          {title}
        </h3>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {category && (
              <span className="text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                {category}
              </span>
            )}
            {assignedAgent && (
              <span className="text-blue-400">→ {assignedAgent}</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {showLogsButton && (
              <button
                onClick={() => setShowLogs(true)}
                className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-white text-xs"
                title="View session logs"
              >
                📋 Logs
              </button>
            )}
            {showRetry && (
              <button
                onClick={() => handleAction("retry")}
                disabled={loading}
                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs disabled:opacity-50"
                title="Retry task"
              >
                🔄 Retry
              </button>
            )}
            {showUnblock && (
              <button
                onClick={() => handleAction("unblock")}
                disabled={loading}
                className="px-2 py-0.5 bg-green-600 hover:bg-green-500 rounded text-white text-xs disabled:opacity-50"
                title="Unblock task"
              >
                ✓ Unblock
              </button>
            )}
            {showCancel && (
              <button
                onClick={() => handleAction("cancel")}
                disabled={loading}
                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-xs disabled:opacity-50"
                title="Cancel task"
              >
                ✕ Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session Logs Modal */}
      <SessionLogs
        taskId={id}
        taskTitle={title}
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
      />
    </>
  );
}

// Mock data for development
export const mockTasks: TaskCardProps[] = [
  {
    id: "task-042",
    displayId: "TASK-042",
    title: "Add authentication endpoint with JWT tokens",
    status: "in_progress",
    priority: "P1",
    assignedAgent: "Build Agent",
    category: "feature",
  },
  {
    id: "task-043",
    displayId: "TASK-043",
    title: "Fix database migration rollback issue",
    status: "pending",
    priority: "P0",
    category: "bug",
  },
  {
    id: "task-044",
    displayId: "TASK-044",
    title: "Update API documentation for new endpoints",
    status: "completed",
    priority: "P3",
    assignedAgent: "Spec Agent",
    category: "documentation",
  },
  {
    id: "task-045",
    displayId: "TASK-045",
    title: "Add unit tests for task-agent services",
    status: "blocked",
    priority: "P2",
    category: "test",
  },
  {
    id: "task-046",
    displayId: "TASK-046",
    title: "Implement WebSocket reconnection logic",
    status: "failed",
    priority: "P2",
    category: "feature",
  },
];

export default TaskCard;
