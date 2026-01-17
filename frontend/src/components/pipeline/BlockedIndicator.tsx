/**
 * BlockedIndicator Component
 *
 * Shows why a task is blocked with link to blocking task.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { AlertTriangle, Link2, FileWarning, Lock } from "lucide-react";

interface BlockedIndicatorProps {
  reason?: string;
  blockingTaskId?: string;
  blockingTaskDisplayId?: string;
  conflictType?: "dependency" | "file_conflict" | "resource_lock";
  filePath?: string;
  size?: "sm" | "md" | "lg";
  onBlockingTaskClick?: (taskId: string) => void;
}

export default function BlockedIndicator({
  reason,
  blockingTaskId,
  blockingTaskDisplayId,
  conflictType = "dependency",
  filePath,
  size = "md",
  onBlockingTaskClick,
}: BlockedIndicatorProps) {
  const sizeClasses = {
    sm: "text-xs p-1 gap-1",
    md: "text-sm p-1.5 gap-1.5",
    lg: "text-base p-2 gap-2",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const getIcon = () => {
    switch (conflictType) {
      case "file_conflict":
        return <FileWarning className={`${iconSizes[size]} text-amber-400`} />;
      case "resource_lock":
        return <Lock className={`${iconSizes[size]} text-amber-400`} />;
      case "dependency":
      default:
        return <Link2 className={`${iconSizes[size]} text-amber-400`} />;
    }
  };

  const getDefaultReason = () => {
    if (blockingTaskId) {
      return `Waiting on ${blockingTaskDisplayId || blockingTaskId.slice(0, 8)}`;
    }
    if (filePath) {
      return `File conflict: ${filePath}`;
    }
    return "Blocked";
  };

  const displayReason = reason || getDefaultReason();

  return (
    <div
      data-testid="blocked-indicator"
      className={`
        inline-flex items-center
        ${sizeClasses[size]}
        bg-amber-900/30 rounded
        text-amber-300
      `}
    >
      {getIcon()}
      <span className="truncate max-w-[150px]" title={displayReason}>
        {displayReason}
      </span>

      {blockingTaskId && onBlockingTaskClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBlockingTaskClick(blockingTaskId);
          }}
          className="ml-1 text-amber-400 hover:text-amber-200 underline"
        >
          View
        </button>
      )}
    </div>
  );
}

// Tooltip variant for hover display
interface BlockedTooltipProps {
  reason?: string;
  blockingTaskId?: string;
  blockingTaskDisplayId?: string;
  conflictType?: "dependency" | "file_conflict" | "resource_lock";
  filePath?: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function BlockedTooltip({
  reason,
  blockingTaskId,
  blockingTaskDisplayId,
  conflictType = "dependency",
  filePath,
  position = "top",
}: BlockedTooltipProps) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const getConflictTypeLabel = () => {
    switch (conflictType) {
      case "file_conflict":
        return "File Conflict";
      case "resource_lock":
        return "Resource Lock";
      case "dependency":
      default:
        return "Dependency";
    }
  };

  return (
    <div
      data-testid="blocked-tooltip"
      className={`
        absolute z-50
        ${positionClasses[position]}
        bg-gray-800 border border-amber-600
        rounded-lg shadow-lg
        p-3 min-w-[200px] max-w-[300px]
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="font-medium text-amber-300">
          {getConflictTypeLabel()}
        </span>
      </div>

      {reason && <p className="text-sm text-gray-300 mb-2">{reason}</p>}

      {blockingTaskId && (
        <div className="text-sm text-gray-400">
          <span className="text-gray-500">Blocked by: </span>
          <span className="text-amber-300 font-mono">
            {blockingTaskDisplayId || blockingTaskId.slice(0, 8)}
          </span>
        </div>
      )}

      {filePath && (
        <div className="text-sm text-gray-400 mt-1">
          <span className="text-gray-500">File: </span>
          <span className="font-mono text-amber-300/80">{filePath}</span>
        </div>
      )}

      {/* Arrow */}
      <div
        className={`
          absolute w-2 h-2 bg-gray-800 border-amber-600
          transform rotate-45
          ${position === "top" ? "bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r" : ""}
          ${position === "bottom" ? "top-[-5px] left-1/2 -translate-x-1/2 border-t border-l" : ""}
          ${position === "left" ? "right-[-5px] top-1/2 -translate-y-1/2 border-t border-r" : ""}
          ${position === "right" ? "left-[-5px] top-1/2 -translate-y-1/2 border-b border-l" : ""}
        `}
      />
    </div>
  );
}
