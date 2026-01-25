/**
 * GraphQuickActions Component
 *
 * Collapsible pill for quick graph operations - extraction, analysis,
 * spec generation, and export. Designed to be compact and non-intrusive.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  Search,
  CheckCircle,
  FileText,
  Download,
  Image,
  Loader2,
  AlertTriangle,
  X,
  Zap,
  ChevronDown,
} from "lucide-react";
import { SpecGenerationModal } from "../ideation/SpecGenerationModal";

// ============================================================================
// Types
// ============================================================================

export interface GraphQuickActionsProps {
  sessionId: string;
  selectedNodeIds: string[];
  onActionComplete: () => void;
  disabled?: boolean;
  /** External control for expanded state */
  isExpanded?: boolean;
  /** Callback when expansion state changes */
  onExpandedChange?: (expanded: boolean) => void;
}

interface ActionState {
  isLoading: boolean;
  action: string | null;
}

interface CheckResult {
  passed: boolean;
  message: string;
  affectedBlocks?: string[];
}

interface GraphValidationResult {
  canGenerate: boolean;
  overallScore: number;
  checks: {
    hasProblemBlocks: CheckResult;
    hasSolutionBlocks: CheckResult;
    problemSolutionLinked: CheckResult;
    noBlockingCycles: CheckResult;
    hasMarketBlocks: CheckResult;
    hasValidatedAssumptions: CheckResult;
    criticalAssumptionsAddressed: CheckResult;
    hasEvidenceChains: CheckResult;
  };
  missingPieces: Array<{
    type: "required" | "recommended";
    category: "problem" | "solution" | "market" | "assumption" | "evidence";
    description: string;
    suggestion: string;
  }>;
  suggestedQuestions: Array<{
    question: string;
    targetGraphType: string;
    targetBlockType: string;
    prefillContent?: string;
  }>;
}

// ============================================================================
// API Functions
// ============================================================================

async function reextractBlocks(sessionId: string): Promise<void> {
  const response = await fetch(
    `/api/ideation/session/${sessionId}/graph/extract`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to re-extract blocks: ${response.statusText}`);
  }
}

async function findContradictions(
  sessionId: string,
): Promise<{ contradictions: unknown[] }> {
  const response = await fetch(
    `/api/ideation/session/${sessionId}/graph/analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskType: "contradiction-scan" }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to find contradictions: ${response.statusText}`);
  }
  return response.json();
}

async function exportGraph(
  sessionId: string,
  format: "json" | "png",
): Promise<Blob> {
  const response = await fetch(
    `/api/ideation/session/${sessionId}/graph?format=${format}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to export graph: ${response.statusText}`);
  }
  return response.blob();
}

async function getGraphValidation(
  sessionId: string,
): Promise<GraphValidationResult> {
  const response = await fetch(
    `/api/ideation/session/${sessionId}/graph/validation`,
  );
  if (!response.ok) {
    throw new Error(`Failed to get validation: ${response.statusText}`);
  }
  return response.json();
}

async function submitQuestionAnswers(
  sessionId: string,
  answers: Array<{ questionIndex: number; answer: string }>,
): Promise<void> {
  const response = await fetch(
    `/api/ideation/session/${sessionId}/graph/blocks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "content",
        content: answers.map((a) => a.answer).join("\n\n"),
        properties: { fromValidationQuestions: true },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to submit answers: ${response.statusText}`);
  }
}

async function runAssumptionScan(
  sessionId: string,
): Promise<{ surfacedAssumptions: unknown[] }> {
  const response = await fetch(
    `/api/ideation/session/${sessionId}/graph/analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskType: "assumption-surface" }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to scan assumptions: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// Compact Action Button
// ============================================================================

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  isLoading,
}: ActionButtonProps) {
  return (
    <button
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full text-left"
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
      ) : (
        <span className="text-gray-500">{icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}

// ============================================================================
// Quick Actions Pill (Collapsed State)
// ============================================================================

function QuickActionsPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full shadow-sm transition-all hover:shadow-md"
      data-testid="quick-actions-pill"
    >
      <Zap className="w-4 h-4 text-blue-600" />
      <span className="text-sm font-medium text-blue-800">Actions</span>
      <ChevronDown className="w-4 h-4 text-blue-600" />
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GraphQuickActions({
  sessionId,
  selectedNodeIds: _selectedNodeIds, // Keep for keyboard shortcuts compatibility
  onActionComplete,
  disabled = false,
  isExpanded: externalExpanded,
  onExpandedChange,
}: GraphQuickActionsProps) {
  // Use external state if provided, otherwise use internal state
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = externalExpanded ?? internalExpanded;

  const setExpanded = useCallback(
    (expanded: boolean) => {
      if (onExpandedChange) {
        onExpandedChange(expanded);
      } else {
        setInternalExpanded(expanded);
      }
    },
    [onExpandedChange],
  );

  const [actionState, setActionState] = useState<ActionState>({
    isLoading: false,
    action: null,
  });
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [contradictionsResult, setContradictionsResult] = useState<{
    contradictions: unknown[];
  } | null>(null);
  const [graphValidation, setGraphValidation] =
    useState<GraphValidationResult | null>(null);
  const [isValidationLoading, setIsValidationLoading] = useState(false);
  const [assumptionsResult, setAssumptionsResult] = useState<{
    surfacedAssumptions: unknown[];
  } | null>(null);

  // Handle action execution
  const executeAction = useCallback(
    async (actionName: string, actionFn: () => Promise<void>) => {
      setActionState({ isLoading: true, action: actionName });
      try {
        await actionFn();
        onActionComplete();
      } catch (error) {
        console.error(`Action ${actionName} failed:`, error);
      } finally {
        setActionState({ isLoading: false, action: null });
      }
    },
    [onActionComplete],
  );

  // Quick Actions
  const handleReextract = useCallback(() => {
    executeAction("reextract", () => reextractBlocks(sessionId));
  }, [executeAction, sessionId]);

  const handleFindContradictions = useCallback(() => {
    executeAction("contradictions", async () => {
      const result = await findContradictions(sessionId);
      setContradictionsResult(result);
    });
  }, [executeAction, sessionId]);

  const handleGenerateSpec = useCallback(async () => {
    setShowSpecModal(true);
    setIsValidationLoading(true);
    try {
      const validation = await getGraphValidation(sessionId);
      setGraphValidation(validation);
    } catch (error) {
      console.error("Failed to load validation:", error);
      setGraphValidation(null);
    } finally {
      setIsValidationLoading(false);
    }
  }, [sessionId]);

  const handleExportJson = useCallback(() => {
    executeAction("export-json", async () => {
      const blob = await exportGraph(sessionId, "json");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `graph-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, [executeAction, sessionId]);

  const handleExportPng = useCallback(() => {
    executeAction("export-png", async () => {
      const blob = await exportGraph(sessionId, "png");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `graph-${sessionId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, [executeAction, sessionId]);

  const handleValidateAssumptions = useCallback(() => {
    executeAction("assumptions", async () => {
      const result = await runAssumptionScan(sessionId);
      setAssumptionsResult(result);
    });
  }, [executeAction, sessionId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      const modKey = e.metaKey || e.ctrlKey;

      if (modKey && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "r":
            e.preventDefault();
            handleReextract();
            break;
          case "c":
            e.preventDefault();
            handleFindContradictions();
            break;
          case "g":
            e.preventDefault();
            handleGenerateSpec();
            break;
          case "e":
            e.preventDefault();
            handleExportJson();
            break;
          case "a":
            e.preventDefault();
            handleValidateAssumptions();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    disabled,
    handleReextract,
    handleFindContradictions,
    handleGenerateSpec,
    handleExportJson,
    handleValidateAssumptions,
  ]);

  const isActionLoading = (action: string) =>
    actionState.isLoading && actionState.action === action;

  // Collapsed state - show pill
  if (!isExpanded) {
    return (
      <div data-testid="quick-actions">
        <QuickActionsPill onClick={() => setExpanded(true)} />
      </div>
    );
  }

  // Expanded state
  return (
    <div data-testid="quick-actions">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-56">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-800">
              Quick Actions
            </span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Minimize"
            data-testid="quick-actions-minimize-btn"
          >
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 12H6"
              />
            </svg>
          </button>
        </div>

        {/* Actions list */}
        <div className="p-1">
          <ActionButton
            icon={<RefreshCw className="h-4 w-4" />}
            label="Re-extract Blocks"
            onClick={handleReextract}
            disabled={disabled}
            isLoading={isActionLoading("reextract")}
          />
          <ActionButton
            icon={<Search className="h-4 w-4" />}
            label="Find Contradictions"
            onClick={handleFindContradictions}
            disabled={disabled}
            isLoading={isActionLoading("contradictions")}
          />
          <ActionButton
            icon={<CheckCircle className="h-4 w-4" />}
            label="Validate Assumptions"
            onClick={handleValidateAssumptions}
            disabled={disabled}
            isLoading={isActionLoading("assumptions")}
          />
          <ActionButton
            icon={<FileText className="h-4 w-4" />}
            label="Generate Spec"
            onClick={handleGenerateSpec}
            disabled={disabled}
          />

          {/* Divider */}
          <div className="my-1 border-t border-gray-100" />

          <ActionButton
            icon={<Download className="h-4 w-4" />}
            label="Export JSON"
            onClick={handleExportJson}
            disabled={disabled}
            isLoading={isActionLoading("export-json")}
          />
          <ActionButton
            icon={<Image className="h-4 w-4" />}
            label="Export PNG"
            onClick={handleExportPng}
            disabled={disabled}
            isLoading={isActionLoading("export-png")}
          />
        </div>
      </div>

      {/* Spec Generation Modal */}
      <SpecGenerationModal
        sessionId={sessionId}
        isOpen={showSpecModal}
        onClose={() => {
          setShowSpecModal(false);
          setGraphValidation(null);
        }}
        validation={graphValidation}
        isLoading={isValidationLoading}
        onQuestionsAnswered={async (answers) => {
          await submitQuestionAnswers(sessionId, answers);
          const newValidation = await getGraphValidation(sessionId);
          setGraphValidation(newValidation);
          onActionComplete();
        }}
        onSkipAndGenerate={async () => {
          console.log("Generate spec - skipping validation");
          setShowSpecModal(false);
          setGraphValidation(null);
          onActionComplete();
        }}
      />

      {/* Contradictions Result */}
      {contradictionsResult &&
        contradictionsResult.contradictions.length > 0 && (
          <div className="mt-2 rounded-lg border border-yellow-500 bg-yellow-500/10 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-yellow-600">
                Found {contradictionsResult.contradictions.length} Contradiction
                {contradictionsResult.contradictions.length > 1 ? "s" : ""}
              </h4>
              <button
                className="p-1 rounded hover:bg-yellow-500/20"
                onClick={() => setContradictionsResult(null)}
              >
                <X className="h-4 w-4 text-yellow-600" />
              </button>
            </div>
          </div>
        )}

      {/* Assumptions Result */}
      {assumptionsResult &&
        assumptionsResult.surfacedAssumptions.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-500 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-medium text-amber-600">
                  Found {assumptionsResult.surfacedAssumptions.length} Hidden
                  Assumption
                  {assumptionsResult.surfacedAssumptions.length > 1 ? "s" : ""}
                </h4>
              </div>
              <button
                className="p-1 rounded hover:bg-amber-500/20"
                onClick={() => setAssumptionsResult(null)}
              >
                <X className="h-4 w-4 text-amber-600" />
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

export default GraphQuickActions;
