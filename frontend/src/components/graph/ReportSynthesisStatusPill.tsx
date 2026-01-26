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
        bgColor: "bg-indigo-50",
        textColor: "text-indigo-700",
        borderColor: "border-indigo-200",
        progressBg: "bg-indigo-200",
        progressFill: "bg-indigo-600",
        hoverBg: "hover:bg-indigo-200",
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
        progressBg: "",
        progressFill: "",
        hoverBg: "hover:bg-green-200",
        icon: <Check className="w-3.5 h-3.5" />,
        label: `${status.reportsCreated} report${status.reportsCreated !== 1 ? "s" : ""} generated`,
        showCancel: false,
        showDismiss: true,
      };
    }
    if (isFailed) {
      return {
        bgColor: "bg-red-50",
        textColor: "text-red-700",
        borderColor: "border-red-200",
        progressBg: "",
        progressFill: "",
        hoverBg: "hover:bg-red-200",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: "Report generation failed",
        showCancel: false,
        showDismiss: true,
      };
    }
    if (isCancelled) {
      return {
        bgColor: "bg-gray-50",
        textColor: "text-gray-600",
        borderColor: "border-gray-200",
        progressBg: "",
        progressFill: "",
        hoverBg: "hover:bg-gray-200",
        icon: <XCircle className="w-3.5 h-3.5" />,
        label: "Report generation cancelled",
        showCancel: false,
        showDismiss: true,
      };
    }
    // Default fallback
    return {
      bgColor: "bg-gray-50",
      textColor: "text-gray-600",
      borderColor: "border-gray-200",
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
