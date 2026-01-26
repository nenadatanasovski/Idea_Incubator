/**
 * SourceMappingStatusPill Component
 *
 * A compact pill that shows the status of background source mapping operations.
 * Displayed in the graph toolbar when a mapping job is active or recently completed.
 *
 * Features:
 * - Shows progress indicator while mapping
 * - Cancel button to stop in-progress jobs
 * - Auto-dismisses after completion
 * - Survives page refresh (queries server for active jobs)
 */

import { X, Loader2, Check, AlertCircle, XCircle } from "lucide-react";
import type { SourceMappingJobStatus } from "./hooks/useSourceMappingStatus";

// ============================================================================
// Types
// ============================================================================

export interface SourceMappingStatusPillProps {
  status: SourceMappingJobStatus;
  onCancel: () => void;
  onDismiss: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function SourceMappingStatusPill({
  status,
  onCancel,
  onDismiss,
}: SourceMappingStatusPillProps) {
  // Don't render if no active job and no recent completion
  if (!status.jobId && !status.status) {
    return null;
  }

  // Determine the display state
  const isActive = status.isActive;
  const isComplete = status.status === "complete";
  const isFailed = status.status === "failed";
  const isCancelled = status.status === "cancelled";

  // Get status-specific styles and content
  const getStatusConfig = () => {
    if (isActive) {
      return {
        bgColor: "bg-purple-50",
        textColor: "text-purple-700",
        borderColor: "border-purple-200",
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        label: getActiveLabel(),
        showCancel: true,
        showDismiss: false,
      };
    }
    if (isComplete) {
      return {
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        borderColor: "border-green-200",
        icon: <Check className="w-3.5 h-3.5" />,
        label: `${status.mappingsCreated} source${status.mappingsCreated !== 1 ? "s" : ""} mapped`,
        showCancel: false,
        showDismiss: true,
      };
    }
    if (isFailed) {
      return {
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        borderColor: "border-red-200",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: "Mapping failed",
        showCancel: false,
        showDismiss: true,
      };
    }
    if (isCancelled) {
      return {
        bgColor: "bg-gray-50",
        textColor: "text-gray-600",
        borderColor: "border-gray-200",
        icon: <XCircle className="w-3.5 h-3.5" />,
        label: "Mapping cancelled",
        showCancel: false,
        showDismiss: true,
      };
    }
    // Default fallback
    return {
      bgColor: "bg-gray-50",
      textColor: "text-gray-600",
      borderColor: "border-gray-200",
      icon: null,
      label: "",
      showCancel: false,
      showDismiss: false,
    };
  };

  const getActiveLabel = () => {
    if (status.status === "started" || status.progress <= 20) {
      return "Collecting sources...";
    }
    if (status.progress <= 50) {
      return `Mapping ${status.blocksToMap} node${status.blocksToMap !== 1 ? "s" : ""}...`;
    }
    return "Analyzing with AI...";
  };

  const config = getStatusConfig();

  if (!config.icon && !config.label) {
    return null;
  }

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        border shadow-sm transition-all duration-200
        animate-in fade-in slide-in-from-top-1
      `}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      {config.icon}

      {/* Label */}
      <span className="text-xs font-medium whitespace-nowrap">
        {config.label}
      </span>

      {/* Progress indicator for active jobs */}
      {isActive && status.progress > 0 && (
        <div className="w-12 h-1.5 bg-purple-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 rounded-full transition-all duration-300"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      )}

      {/* Cancel button for active jobs */}
      {config.showCancel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="p-0.5 rounded-full hover:bg-purple-200 transition-colors"
          title="Cancel source mapping"
          aria-label="Cancel source mapping"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dismiss button for completed states */}
      {config.showDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="p-0.5 rounded-full hover:bg-gray-200 transition-colors"
          title="Dismiss"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default SourceMappingStatusPill;
