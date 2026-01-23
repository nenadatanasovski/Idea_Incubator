/**
 * GraphQuickActions Component
 *
 * Provides quick action buttons for graph operations including
 * re-extraction, analysis, spec generation, and export.
 * Shows context-sensitive actions when nodes are selected.
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  Search,
  CheckCircle,
  FileText,
  Download,
  Image,
  Link2,
  Layers,
  Trash2,
  Loader2,
  AlertTriangle,
  X,
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

async function linkSelectedNodes(
  sessionId: string,
  nodeIds: string[],
  linkType: string,
): Promise<void> {
  // Create links between consecutive pairs
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const response = await fetch(
      `/api/ideation/session/${sessionId}/graph/links`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceBlockId: nodeIds[i],
          targetBlockId: nodeIds[i + 1],
          linkType,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to create link: ${response.statusText}`);
    }
  }
}

async function createSynthesisBlock(
  sessionId: string,
  nodeIds: string[],
): Promise<void> {
  const response = await fetch(
    `/api/ideation/session/${sessionId}/graph/blocks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "synthesis",
        content: "Synthesis of selected blocks",
        properties: {
          synthesizes: nodeIds,
          clusterTheme: "User-created synthesis",
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to create synthesis block: ${response.statusText}`);
  }
}

async function deleteBlocks(
  sessionId: string,
  nodeIds: string[],
): Promise<void> {
  for (const nodeId of nodeIds) {
    const response = await fetch(
      `/api/ideation/session/${sessionId}/graph/blocks/${nodeId}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error(`Failed to delete block: ${response.statusText}`);
    }
  }
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
// Quick Action Button Component
// ============================================================================

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: "default" | "outline" | "destructive";
}

function QuickActionButton({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  isLoading,
  variant = "outline",
}: QuickActionButtonProps) {
  const baseClasses =
    "inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
      disabled={disabled || isLoading}
      title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
}

function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  count,
}: DeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Selected Blocks
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to delete {count} selected block
              {count > 1 ? "s" : ""}? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GraphQuickActions({
  sessionId,
  selectedNodeIds,
  onActionComplete,
  disabled = false,
}: GraphQuickActionsProps) {
  const [actionState, setActionState] = useState<ActionState>({
    isLoading: false,
    action: null,
  });
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [contradictionsResult, setContradictionsResult] = useState<{
    contradictions: unknown[];
  } | null>(null);
  const [graphValidation, setGraphValidation] =
    useState<GraphValidationResult | null>(null);
  const [isValidationLoading, setIsValidationLoading] = useState(false);
  const [assumptionsResult, setAssumptionsResult] = useState<{
    surfacedAssumptions: unknown[];
  } | null>(null);

  const hasSelection = selectedNodeIds.length > 0;
  const canLink = selectedNodeIds.length >= 2;

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

  // Selection Actions
  const handleLinkSelected = useCallback(() => {
    executeAction("link", () =>
      linkSelectedNodes(sessionId, selectedNodeIds, "refines"),
    );
  }, [executeAction, sessionId, selectedNodeIds]);

  const handleGroupIntoSynthesis = useCallback(() => {
    executeAction("synthesis", () =>
      createSynthesisBlock(sessionId, selectedNodeIds),
    );
  }, [executeAction, sessionId, selectedNodeIds]);

  const handleDeleteSelected = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const confirmDelete = useCallback(() => {
    executeAction("delete", () => deleteBlocks(sessionId, selectedNodeIds));
    setShowDeleteDialog(false);
  }, [executeAction, sessionId, selectedNodeIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      // Check for modifier key (Cmd on Mac, Ctrl on Windows/Linux)
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

      // Selection-specific shortcuts
      if (hasSelection && modKey) {
        switch (e.key.toLowerCase()) {
          case "l":
            if (canLink) {
              e.preventDefault();
              handleLinkSelected();
            }
            break;
          case "s":
            if (e.shiftKey) {
              e.preventDefault();
              handleGroupIntoSynthesis();
            }
            break;
          case "backspace":
          case "delete":
            e.preventDefault();
            handleDeleteSelected();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    disabled,
    hasSelection,
    canLink,
    handleReextract,
    handleFindContradictions,
    handleGenerateSpec,
    handleExportJson,
    handleValidateAssumptions,
    handleLinkSelected,
    handleGroupIntoSynthesis,
    handleDeleteSelected,
  ]);

  const isActionLoading = (action: string) =>
    actionState.isLoading && actionState.action === action;

  return (
    <div className="space-y-2">
      {/* Quick Actions */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <h4 className="text-xs font-medium text-gray-500 mb-2">
          Quick Actions
        </h4>
        <div className="flex flex-wrap gap-2">
          <QuickActionButton
            icon={<RefreshCw className="h-4 w-4" />}
            label="Re-extract Blocks"
            shortcut="Cmd+Shift+R"
            onClick={handleReextract}
            disabled={disabled}
            isLoading={isActionLoading("reextract")}
          />
          <QuickActionButton
            icon={<Search className="h-4 w-4" />}
            label="Find Contradictions"
            shortcut="Cmd+Shift+C"
            onClick={handleFindContradictions}
            disabled={disabled}
            isLoading={isActionLoading("contradictions")}
          />
          <QuickActionButton
            icon={<CheckCircle className="h-4 w-4" />}
            label="Validate Assumptions"
            shortcut="Cmd+Shift+A"
            onClick={handleValidateAssumptions}
            disabled={disabled}
            isLoading={isActionLoading("assumptions")}
          />
          <QuickActionButton
            icon={<FileText className="h-4 w-4" />}
            label="Generate Spec"
            shortcut="Cmd+Shift+G"
            onClick={handleGenerateSpec}
            disabled={disabled}
          />
          <QuickActionButton
            icon={<Download className="h-4 w-4" />}
            label="Export JSON"
            shortcut="Cmd+Shift+E"
            onClick={handleExportJson}
            disabled={disabled}
            isLoading={isActionLoading("export-json")}
          />
          <QuickActionButton
            icon={<Image className="h-4 w-4" />}
            label="Export PNG"
            onClick={handleExportPng}
            disabled={disabled}
            isLoading={isActionLoading("export-png")}
          />
        </div>
      </div>

      {/* Selection Actions (only shown when nodes are selected) */}
      {hasSelection && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h4 className="text-xs font-medium text-gray-500 mb-2">
            Selection Actions ({selectedNodeIds.length} node
            {selectedNodeIds.length > 1 ? "s" : ""} selected)
          </h4>
          <div className="flex flex-wrap gap-2">
            <QuickActionButton
              icon={<Link2 className="h-4 w-4" />}
              label="Link Selected"
              shortcut="Cmd+L"
              onClick={handleLinkSelected}
              disabled={disabled || !canLink}
              isLoading={isActionLoading("link")}
            />
            <QuickActionButton
              icon={<Layers className="h-4 w-4" />}
              label="Group into Synthesis"
              shortcut="Cmd+Shift+S"
              onClick={handleGroupIntoSynthesis}
              disabled={disabled}
              isLoading={isActionLoading("synthesis")}
            />
            <QuickActionButton
              icon={<Trash2 className="h-4 w-4" />}
              label="Delete Selected"
              shortcut="Cmd+Backspace"
              onClick={handleDeleteSelected}
              disabled={disabled}
              variant="destructive"
            />
          </div>
        </div>
      )}

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
          // Refresh validation after answering questions
          const newValidation = await getGraphValidation(sessionId);
          setGraphValidation(newValidation);
          onActionComplete();
        }}
        onSkipAndGenerate={async () => {
          // TODO: Implement actual spec generation
          console.log("Generate spec - skipping validation");
          setShowSpecModal(false);
          setGraphValidation(null);
          onActionComplete();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        count={selectedNodeIds.length}
      />

      {/* Contradictions Result (simple display for now) */}
      {contradictionsResult &&
        contradictionsResult.contradictions.length > 0 && (
          <div className="rounded-lg border border-yellow-500 bg-yellow-500/10 p-3">
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
          <div className="rounded-lg border border-amber-500 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-medium text-amber-600">
                  Found {assumptionsResult.surfacedAssumptions.length} Hidden
                  Assumption
                  {assumptionsResult.surfacedAssumptions.length > 1 ? "s" : ""}
                </h4>
                <p className="text-xs text-amber-700 mt-1">
                  These assumptions were detected in your graph and may need
                  validation.
                </p>
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
