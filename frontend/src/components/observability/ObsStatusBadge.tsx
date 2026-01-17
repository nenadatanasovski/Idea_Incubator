/**
 * ObsStatusBadge - Status badge for observability entities
 */

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Ban,
  SkipForward,
  Loader,
  Clock,
  CheckSquare,
} from "lucide-react";
import type {
  ToolResultStatus,
  AssertionResult,
  ExecutionRun,
} from "../../types/observability";

type StatusType =
  | ToolResultStatus
  | AssertionResult
  | ExecutionRun["status"]
  | "success"
  | "partial";

interface ObsStatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const statusConfig: Record<
  StatusType,
  {
    icon: typeof CheckCircle;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  // Tool result statuses
  done: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Done",
  },
  error: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Error",
  },
  blocked: {
    icon: Ban,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    label: "Blocked",
  },

  // Assertion result statuses
  pass: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Pass",
  },
  fail: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Fail",
  },
  skip: {
    icon: SkipForward,
    color: "text-gray-500",
    bgColor: "bg-gray-100",
    label: "Skip",
  },
  warn: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    label: "Warn",
  },

  // Execution statuses
  pending: {
    icon: Clock,
    color: "text-gray-500",
    bgColor: "bg-gray-100",
    label: "Pending",
  },
  running: {
    icon: Loader,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    label: "Running",
  },
  completed: {
    icon: CheckSquare,
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Completed",
  },
  failed: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Failed",
  },
  cancelled: {
    icon: Ban,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    label: "Cancelled",
  },

  // Skill statuses
  success: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Success",
  },
  partial: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    label: "Partial",
  },
};

const sizeConfig = {
  sm: {
    icon: "h-3 w-3",
    text: "text-xs",
    padding: "px-1.5 py-0.5",
  },
  md: {
    icon: "h-4 w-4",
    text: "text-sm",
    padding: "px-2 py-1",
  },
  lg: {
    icon: "h-5 w-5",
    text: "text-base",
    padding: "px-2.5 py-1.5",
  },
};

export default function ObsStatusBadge({
  status,
  size = "md",
  showLabel = true,
}: ObsStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.color} ${sizes.padding}`}
    >
      <Icon
        className={`${sizes.icon} ${status === "running" ? "animate-spin" : ""}`}
      />
      {showLabel && <span className={sizes.text}>{config.label}</span>}
    </span>
  );
}

// Export config for reuse
export { statusConfig };
