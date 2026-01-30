// =============================================================================
// FILE: frontend/src/components/ideation/ContextLimitModal.tsx
// Modal shown when conversation context limit is approaching
// =============================================================================

import {
  X,
  Brain,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";

interface ContextLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  percentUsed: number;
  onSaveAndContinue: () => Promise<void>;
  onContinueWithoutSaving: () => void;
  isSaving: boolean;
  saveResult?: {
    success: boolean;
    blocksCreated?: number;
    linksCreated?: number;
    error?: string;
  };
}

export function ContextLimitModal({
  isOpen,
  onClose,
  percentUsed,
  onSaveAndContinue,
  onContinueWithoutSaving,
  isSaving,
  saveResult,
}: ContextLimitModalProps) {
  if (!isOpen) return null;

  const percentDisplay = Math.round(percentUsed * 100);
  const progressColor =
    percentUsed > 0.95
      ? "bg-red-500"
      : percentUsed > 0.9
        ? "bg-yellow-500"
        : "bg-blue-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="context-limit-modal"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Context Limit Approaching
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Warning Alert */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">
                Running Low on Context
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Your conversation has used {percentDisplay}% of available
                context. To continue effectively, save your insights to the
                memory graph.
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Context Usage</span>
              <span>{percentDisplay}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressColor} transition-all duration-300`}
                style={{ width: `${percentDisplay}%` }}
                data-testid="context-progress-bar"
              />
            </div>
          </div>

          {/* Success Alert */}
          {saveResult?.success && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-800">
                  Saved Successfully!
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Created {saveResult.blocksCreated} blocks and{" "}
                  {saveResult.linksCreated} links. You can now start a fresh
                  session with full context from the graph.
                </p>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {saveResult?.error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800">Save Failed</h3>
                <p className="text-sm text-red-700 mt-1">{saveResult.error}</p>
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong className="text-gray-700">Save & Continue</strong>{" "}
              extracts insights from this conversation into your memory graph.
              You'll start a fresh session, but all knowledge is preserved and
              accessible.
            </p>
            <p>
              <strong className="text-gray-700">Continue Without Saving</strong>{" "}
              starts a fresh session without extracting insights. You can return
              to this session later.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onContinueWithoutSaving}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Continue Without Saving
          </button>
          <button
            onClick={onSaveAndContinue}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            {isSaving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
