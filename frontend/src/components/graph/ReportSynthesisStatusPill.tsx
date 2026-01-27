/**
 * ReportSynthesisStatusPill Component
 *
 * A compact pill that shows the status of background report synthesis operations.
 * Displayed in the graph toolbar when a synthesis job is active or recently completed.
 *
 * Features:
 * - Shows progress indicator while generating
 * - Cancel button to stop in-progress jobs
 * - Auto-dismisses after completion
 * - Survives page refresh (queries server for active jobs)
 */

import {
  X,
  Loader2,
  Check,
  AlertCircle,
  XCircle,
  FileText,
} from "lucide-react";
import type { ReportSynthesisJobStatus } from "./hooks/useReportSynthesisStatus";

// ============================================================================
// Types
// ============================================================================

export interface ReportSynthesisStatusPillProps {
  status: ReportSynthesisJobStatus;
  onCancel: () => void;
  onDismiss: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ReportSynthesisStatusPill({
  status,
  onCancel,
  onDismiss,
}: ReportSynthesisStatusPillProps) {
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
        bgColor: "bg-amber-100 dark:bg-amber-900/80",
        textColor: "text-amber-800 dark:text-amber-200",
        borderColor: "border-amber-300 dark:border-amber-600",
        progressBg: "bg-amber-200 dark:bg-amber-700",
        progressFill: "bg-amber-500 dark:bg-amber-400",
        hoverBg: "hover:bg-amber-200 dark:hover:bg-amber-800",
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        label: getActiveLabel(),
        showCancel: true,
        showDismiss: false,
      };
    }
    if (isComplete) {
      return {
        bgColor: "bg-green-100 dark:bg-green-900/80",
        textColor: "text-green-800 dark:text-green-200",
        borderColor: "border-green-300 dark:border-green-600",
        progressBg: "",
        progressFill: "",
        hoverBg: "hover:bg-green-200 dark:hover:bg-green-800",
        icon: <Check className="w-3.5 h-3.5" />,
        label: `${status.reportsCreated} report${status.reportsCreated !== 1 ? "s" : ""} generated`,
        showCancel: false,
        showDismiss: true,
      };
    }
    if (isFailed) {
      return {
        bgColor: "bg-red-100 dark:bg-red-900/80",
        textColor: "text-red-800 dark:text-red-200",
        borderColor: "border-red-300 dark:border-red-600",
        progressBg: "",
        progressFill: "",
        hoverBg: "hover:bg-red-200 dark:hover:bg-red-800",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: "Report generation failed",
        showCancel: false,
        showDismiss: true,
      };
    }
    if (isCancelled) {
      return {
        bgColor: "bg-gray-100 dark:bg-gray-700",
        textColor: "text-gray-700 dark:text-gray-200",
        borderColor: "border-gray-300 dark:border-gray-500",
        progressBg: "",
        progressFill: "",
        hoverBg: "hover:bg-gray-200 dark:hover:bg-gray-600",
        icon: <XCircle className="w-3.5 h-3.5" />,
        label: "Report generation cancelled",
        showCancel: false,
        showDismiss: true,
      };
    }
    // Default fallback
    return {
      bgColor: "bg-gray-100 dark:bg-gray-700",
      textColor: "text-gray-700 dark:text-gray-200",
      borderColor: "border-gray-300 dark:border-gray-500",
      progressBg: "",
      progressFill: "",
      hoverBg: "",
      icon: null,
      label: "",
      showCancel: false,
      showDismiss: false,
    };
  };

  const getActiveLabel = () => {
    if (status.status === "started") {
      return "Starting report synthesis...";
    }
    if (status.status === "detecting") {
      return "Detecting node groups...";
    }
    if (status.status === "generating") {
      if (status.totalGroups > 0) {
        const groupInfo = status.currentGroupName
          ? `"${status.currentGroupName}"`
          : `${status.completedGroups + 1}`;
        return `Generating reports... (${status.completedGroups}/${status.totalGroups})`;
      }
      return "Generating reports...";
    }
    return "Processing...";
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
      data-testid="report-synthesis-status"
    >
      {/* Icon */}
      {config.icon}

      {/* Label */}
      <span className="text-xs font-medium whitespace-nowrap">
        {config.label}
      </span>

      {/* Progress indicator for active jobs */}
      {isActive && status.progress > 0 && (
        <div
          className={`w-12 h-1.5 ${config.progressBg} rounded-full overflow-hidden`}
        >
          <div
            className={`h-full ${config.progressFill} rounded-full transition-all duration-300`}
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
          className={`p-0.5 rounded-full ${config.hoverBg} transition-colors`}
          title="Cancel report synthesis"
          aria-label="Cancel report synthesis"
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

export default ReportSynthesisStatusPill;
