/**
 * AgentBadge Component
 *
 * Shows agent assignment on active tasks with heartbeat indicator.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { Bot, Heart, AlertCircle } from "lucide-react";
import type { AgentStatus } from "../../types/pipeline";

interface AgentBadgeProps {
  agentId: string;
  agentName?: string;
  status?: AgentStatus["status"];
  heartbeatAgeSeconds?: number;
  size?: "sm" | "md" | "lg";
  showHeartbeat?: boolean;
  onClick?: () => void;
}

const HEARTBEAT_WARNING_THRESHOLD = 30; // seconds
const HEARTBEAT_ERROR_THRESHOLD = 60; // seconds

export default function AgentBadge({
  agentId,
  agentName,
  status = "working",
  heartbeatAgeSeconds = 0,
  size = "md",
  showHeartbeat = true,
  onClick,
}: AgentBadgeProps) {
  const isStale = heartbeatAgeSeconds > HEARTBEAT_WARNING_THRESHOLD;
  const isError =
    status === "error" || heartbeatAgeSeconds > HEARTBEAT_ERROR_THRESHOLD;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div
      data-testid="agent-badge"
      className={`
        inline-flex items-center
        ${sizeClasses[size]}
        rounded-full
        ${isError ? "bg-red-100 text-red-700 agent-error" : ""}
        ${isStale && !isError ? "bg-amber-100 text-amber-700 heartbeat-warning" : ""}
        ${!isStale && !isError ? "bg-blue-100 text-blue-700" : ""}
        ${onClick ? "cursor-pointer hover:opacity-80" : ""}
        transition-colors duration-200
      `}
      onClick={onClick}
    >
      {isError ? (
        <AlertCircle className={`${iconSizes[size]} text-red-600`} />
      ) : (
        <Bot className={`${iconSizes[size]}`} />
      )}

      <span className="font-medium truncate max-w-[100px]">
        {agentName || `Agent ${agentId.slice(0, 6)}`}
      </span>

      {showHeartbeat && (
        <div
          data-testid="heartbeat-indicator"
          className={`flex items-center gap-0.5 ${isStale ? "text-amber-600" : "text-green-600"}`}
        >
          <Heart
            className={`${iconSizes[size]} ${!isStale ? "animate-pulse" : ""}`}
            fill={isStale ? "currentColor" : "none"}
          />
          <span className="text-xs opacity-75">
            {formatHeartbeatAge(heartbeatAgeSeconds)}
          </span>
        </div>
      )}
    </div>
  );
}

function formatHeartbeatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

// Agent card variant for the agent pool view
interface AgentCardProps {
  agent: AgentStatus;
  onClick?: (agent: AgentStatus) => void;
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const isIdle = agent.status === "idle";
  const isError = agent.status === "error";
  const isStale = agent.heartbeatAgeSeconds > HEARTBEAT_WARNING_THRESHOLD;

  return (
    <div
      data-testid={`agent-card-${agent.id}`}
      className={`
        p-3 rounded-lg border
        ${isError ? "bg-red-50 border-red-200" : ""}
        ${isIdle ? "bg-gray-50 border-gray-200 agent-idle" : ""}
        ${!isIdle && !isError ? "bg-blue-50 border-blue-200" : ""}
        ${onClick ? "cursor-pointer hover:border-blue-500" : ""}
        transition-all duration-200
      `}
      onClick={() => onClick?.(agent)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot
            className={`w-5 h-5 ${isError ? "text-red-600" : isIdle ? "text-gray-400" : "text-blue-600"}`}
          />
          <span className="font-medium text-gray-900">{agent.name}</span>
        </div>
        <span
          className={`
            text-xs px-2 py-0.5 rounded-full
            ${isIdle ? "bg-gray-200 text-gray-600" : ""}
            ${isError ? "bg-red-100 text-red-700" : ""}
            ${!isIdle && !isError ? "bg-blue-100 text-blue-700" : ""}
          `}
        >
          {isIdle ? "Idle" : isError ? "Error" : "Working"}
        </span>
      </div>

      {!isIdle && agent.currentTaskTitle && (
        <div className="text-sm text-gray-600 truncate mb-2">
          {agent.currentTaskTitle}
        </div>
      )}

      {agent.heartbeatAt && (
        <div
          className={`flex items-center gap-1 text-xs ${isStale ? "text-amber-600" : "text-gray-500"}`}
        >
          <Heart
            className={`w-3 h-3 ${!isStale ? "animate-pulse text-green-600" : ""}`}
          />
          <span>{formatHeartbeatAge(agent.heartbeatAgeSeconds)} ago</span>
        </div>
      )}
    </div>
  );
}
