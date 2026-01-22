// =============================================================================
// FILE: frontend/src/components/ideation/UpdateMemoryGraphButton.tsx
// Button to trigger memory graph update analysis
// =============================================================================

import { Brain, Loader2 } from "lucide-react";

export interface UpdateMemoryGraphButtonProps {
  onClick: () => void;
  isAnalyzing: boolean;
  pendingChangesCount: number;
  disabled?: boolean;
}

export function UpdateMemoryGraphButton({
  onClick,
  isAnalyzing,
  pendingChangesCount,
  disabled = false,
}: UpdateMemoryGraphButtonProps) {
  const getTooltip = () => {
    if (disabled) return "Update Memory Graph (disabled)";
    if (isAnalyzing) return "Analyzing...";
    if (pendingChangesCount > 0)
      return `Update Memory Graph (${pendingChangesCount} pending)`;
    return "Update Memory Graph";
  };

  const hasChanges = pendingChangesCount > 0;
  const isDisabledState = disabled || isAnalyzing;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabledState}
      aria-label={getTooltip()}
      title={getTooltip()}
      data-testid="update-memory-graph-btn"
      className={`
        h-12 w-12 flex items-center justify-center rounded-lg
        transition-colors flex-shrink-0 relative
        focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:outline-none
        ${
          isDisabledState
            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
            : hasChanges
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-purple-600"
        }
      `}
    >
      {isAnalyzing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Brain className="w-5 h-5" />
      )}

      {/* Badge for pending changes count */}
      {hasChanges && !isAnalyzing && (
        <span
          className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
          data-testid="pending-changes-badge"
        >
          {pendingChangesCount > 9 ? "9+" : pendingChangesCount}
        </span>
      )}
    </button>
  );
}

export default UpdateMemoryGraphButton;
