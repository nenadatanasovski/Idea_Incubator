/**
 * StatusBadge - Visual status indicator with consistent styling
 */

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Pause,
  Ban,
} from "lucide-react";
import type {
  ToolResultStatus,
  AssertionResult,
  ExecutionRun,
} from "../../types/observability";
// Status config imported but used through direct access in component

type StatusType = ToolResultStatus | AssertionResult | ExecutionRun["status"];

interface StatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

// Map status to icon
const statusIcons: Record<StatusType, typeof CheckCircle> = {
  // ToolResultStatus
  done: CheckCircle,
  error: XCircle,
  blocked: Ban,
  // AssertionResult
  pass: CheckCircle,
  fail: XCircle,
  skip: Pause,
  warn: AlertTriangle,
  // ExecutionRun status
  pending: Clock,
  running: Clock,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: Ban,
};

// Map status to colors
const statusColors: Record<StatusType, { text: string; bg: string }> = {
  // ToolResultStatus
  done: { text: "text-green-600", bg: "bg-green-100" },
  error: { text: "text-red-600", bg: "bg-red-100" },
  blocked: { text: "text-orange-600", bg: "bg-orange-100" },
  // AssertionResult
  pass: { text: "text-green-600", bg: "bg-green-100" },
  fail: { text: "text-red-600", bg: "bg-red-100" },
  skip: { text: "text-gray-500", bg: "bg-gray-100" },
  warn: { text: "text-yellow-600", bg: "bg-yellow-100" },
  // ExecutionRun status
  pending: { text: "text-gray-500", bg: "bg-gray-100" },
  running: { text: "text-blue-600", bg: "bg-blue-100" },
  completed: { text: "text-green-600", bg: "bg-green-100" },
  failed: { text: "text-red-600", bg: "bg-red-100" },
  cancelled: { text: "text-orange-600", bg: "bg-orange-100" },
};

// Map status to label
const statusLabels: Record<StatusType, string> = {
  // ToolResultStatus
  done: "Done",
  error: "Error",
  blocked: "Blocked",
  // AssertionResult
  pass: "Pass",
  fail: "Fail",
  skip: "Skip",
  warn: "Warn",
  // ExecutionRun status
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const sizeClasses = {
  sm: {
    icon: "h-3 w-3",
    text: "text-xs",
    padding: "px-1.5 py-0.5",
    gap: "gap-1",
  },
  md: {
    icon: "h-4 w-4",
    text: "text-sm",
    padding: "px-2 py-1",
    gap: "gap-1.5",
  },
  lg: {
    icon: "h-5 w-5",
    text: "text-base",
    padding: "px-3 py-1.5",
    gap: "gap-2",
  },
};

export default function StatusBadge({
  status,
  size = "md",
  showLabel = true,
  className = "",
}: StatusBadgeProps) {
  const Icon = statusIcons[status];
  const colors = statusColors[status];
  const label = statusLabels[status];
  const sizes = sizeClasses[size];

  return (
    <span
      className={`
        inline-flex items-center ${sizes.gap} ${sizes.padding}
        rounded-full font-medium
        ${colors.bg} ${colors.text}
        ${className}
      `}
    >
      <Icon className={sizes.icon} />
      {showLabel && <span className={sizes.text}>{label}</span>}
    </span>
  );
}

// Icon-only variant for compact displays
export function StatusIcon({
  status,
  size = "md",
  className = "",
}: Omit<StatusBadgeProps, "showLabel">) {
  const Icon = statusIcons[status];
  const colors = statusColors[status];
  const sizes = sizeClasses[size];

  return <Icon className={`${sizes.icon} ${colors.text} ${className}`} />;
}

// Pulsing indicator for in-progress states
export function StatusPulse({
  status,
  size = "md",
}: Pick<StatusBadgeProps, "status" | "size">) {
  const colors = statusColors[status];
  const pulseSize =
    size === "sm" ? "h-2 w-2" : size === "lg" ? "h-4 w-4" : "h-3 w-3";

  const isPulsing = status === "running" || status === "pending";

  return (
    <span className="relative flex">
      {isPulsing && (
        <span
          className={`
            absolute inline-flex ${pulseSize} rounded-full
            ${colors.bg} opacity-75 animate-ping
          `}
        />
      )}
      <span
        className={`
          relative inline-flex ${pulseSize} rounded-full
          ${colors.bg.replace("100", "500")}
        `}
      />
    </span>
  );
}
