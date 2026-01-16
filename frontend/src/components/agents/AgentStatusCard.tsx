import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Clock,
  Pause,
  ChevronRight,
} from "lucide-react";
import type { AgentInfo, AgentStatus } from "../../types/agent.js";

interface AgentStatusCardProps {
  agent: AgentInfo;
}

const STATUS_CONFIG: Record<
  AgentStatus,
  { icon: typeof Activity; color: string; bg: string; label: string }
> = {
  idle: {
    icon: Pause,
    color: "text-gray-500",
    bg: "bg-gray-100",
    label: "Idle",
  },
  running: {
    icon: Activity,
    color: "text-green-600",
    bg: "bg-green-100",
    label: "Running",
  },
  error: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-100",
    label: "Error",
  },
  waiting: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-100",
    label: "Waiting",
  },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimeSinceHeartbeat(lastHeartbeat: string): string {
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export default function AgentStatusCard({
  agent,
}: AgentStatusCardProps): JSX.Element {
  const config = STATUS_CONFIG[agent.status];
  const StatusIcon = config.icon;

  return (
    <Link
      to={`/agents/${agent.id}`}
      className="card hover:shadow-md transition-shadow block cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
              {agent.name}
            </h3>
            <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-xs text-gray-500">{agent.type}</p>
        </div>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bg}`}
        >
          <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
        </div>
      </div>

      {agent.currentTask && (
        <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
          {(agent.currentTaskListName || agent.currentProjectName) && (
            <div className="flex items-center gap-2 mb-1">
              {agent.currentProjectName && (
                <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                  {agent.currentProjectName}
                </span>
              )}
              {agent.currentTaskListName && (
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                  {agent.currentTaskListName}
                </span>
              )}
            </div>
          )}
          <span className="text-gray-500">Current:</span>{" "}
          <span className="text-gray-700">{agent.currentTask}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-green-600">
            {agent.metrics.tasksCompleted}
          </p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div>
          <p className="text-lg font-bold text-red-600">
            {agent.metrics.tasksFailed}
          </p>
          <p className="text-xs text-gray-500">Failed</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-700">
            {formatDuration(agent.metrics.avgDuration)}
          </p>
          <p className="text-xs text-gray-500">Avg Time</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-400">
        <span>
          Last heartbeat: {formatTimeSinceHeartbeat(agent.lastHeartbeat)}
        </span>
        <div className="flex items-center gap-2">
          {agent.currentTaskListName && (
            <Link
              to="/tasks/kanban"
              onClick={(e) => e.stopPropagation()}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              View Tasks
            </Link>
          )}
          <span className={agent.status === "running" ? "text-green-500" : ""}>
            {agent.status === "running" ? "● Active" : "○ Inactive"}
          </span>
        </div>
      </div>
    </Link>
  );
}
