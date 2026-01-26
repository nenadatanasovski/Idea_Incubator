// =============================================================================
// FILE: frontend/src/components/ideation/IdeaArtifactPanel.tsx
// Redesigned artifact panel with table (20%) + preview (80%) layout
// Implements TEST-UI-006 requirements with backwards compatibility
// =============================================================================

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  FileText,
  ChevronLeft,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { ArtifactTable } from "./ArtifactTable";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { ViabilityMeter } from "./ViabilityMeter";
import { RisksList } from "./RisksList";
import {
  ErrorBoundary,
  OfflineIndicator,
  useNetworkStatus,
} from "./ErrorBoundary";
import type {
  Artifact,
  IdeaCandidate,
  ViabilityRisk,
} from "../../types/ideation";
import type { ClassificationInfo } from "../../types/ideation-state";
import type { Spec, SpecSection, SpecWorkflowState } from "../../types/spec";
import { SpecPanel } from "./SpecPanel";

// =============================================================================
// Types
// =============================================================================

export interface IdeaArtifactPanelProps {
  // Idea props (for backwards compatibility)
  candidate?: IdeaCandidate | null;
  confidence?: number;
  viability?: number;
  risks?: ViabilityRisk[];
  showIntervention?: boolean;
  onContinue?: () => void;
  onDiscard?: () => void;
  // Artifact props
  artifacts: Artifact[];
  currentArtifact?: Artifact | null; // For backwards compatibility
  selectedArtifactPath?: string | null; // New prop for selection
  classifications?: Record<string, ClassificationInfo>;
  onSelectArtifact: (artifact: Artifact) => void;
  onCloseArtifact?: () => void; // For backwards compatibility
  onExpandArtifact?: () => void; // For backwards compatibility
  onToggleFolder?: (folderPath: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEditArtifact?: (...args: any[]) => void | Promise<void>;
  onDeleteArtifact?: (artifactId: string) => void;
  onRenameArtifact?: (artifactId: string, newTitle: string) => Promise<void>;
  onCopyRef?: (artifactId: string) => void;
  isArtifactLoading?: boolean;
  isLoading?: boolean;
  // Panel state
  isMinimized?: boolean;
  onExpandPanel?: () => void;
  onClosePanel?: () => void;
  // Spec props (SPEC-006-E)
  spec?: Spec | null;
  specSections?: SpecSection[];
  isSpecEditing?: boolean;
  onSpecEdit?: () => void;
  onSpecSave?: (updates: Partial<Spec>) => Promise<void>;
  onSpecCancel?: () => void;
  onSpecTransition?: (newState: SpecWorkflowState) => Promise<void>;
  onSpecCreateTasks?: () => Promise<void>;
  onGenerateSpec?: () => void;
  isSpecLoading?: boolean;
}

type TabType = "idea" | "artifacts" | "spec";

// =============================================================================
// Icons
// =============================================================================

const CloseIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const ExpandIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
    />
  </svg>
);

const CollapseIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
    />
  </svg>
);

// =============================================================================
// Idea Content Component (for tab view)
// =============================================================================

interface IdeaContentProps {
  candidate: IdeaCandidate | null;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  showIntervention: boolean;
  onContinue: () => void;
  onDiscard: () => void;
}

const IdeaContent: React.FC<IdeaContentProps> = ({
  candidate,
  confidence,
  viability,
  risks,
  showIntervention,
  onContinue,
  onDiscard,
}) => {
  if (!candidate) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No idea yet</p>
          <p className="text-sm text-gray-400 mt-1">
            {confidence > 0
              ? "Keep exploring to develop your idea"
              : "Start the conversation to explore ideas"}
          </p>
          {confidence > 0 && confidence < 30 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Idea Forming</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showIntervention && viability < 50) {
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-800">Viability Concerns</p>
              <p className="text-sm text-orange-700 mt-1">
                This idea has significant risks that may affect its success.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900">{candidate.title}</h3>
        </div>

        <ViabilityMeter value={viability} risks={risks} showWarning size="lg" />
        <RisksList risks={risks} maxDisplay={5} />

        <div className="space-y-2 pt-2">
          <button
            onClick={onContinue}
            className="w-full flex items-center justify-center gap-2 px-4 py-2
                       bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors
                       focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ArrowRight className="w-4 h-4" />
            Continue Anyway
          </button>
          <button
            onClick={onDiscard}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg
                       hover:bg-gray-50 text-gray-700 transition-colors
                       focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Start Fresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">{candidate.title}</h3>
        {candidate.summary && (
          <p className="text-sm text-gray-600 mt-1">{candidate.summary}</p>
        )}
      </div>

      <div className="space-y-3">
        <ConfidenceMeter value={confidence} showLabel size="md" />
        <ViabilityMeter
          value={viability}
          risks={risks}
          showWarning={viability < 50}
          size="md"
        />
      </div>

      {risks.length > 0 && <RisksList risks={risks} maxDisplay={3} />}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const IdeaArtifactPanel: React.FC<IdeaArtifactPanelProps> = ({
  // Idea props
  candidate = null,
  confidence = 0,
  viability = 0,
  risks = [],
  showIntervention = false,
  onContinue = () => {},
  onDiscard = () => {},
  // Artifact props
  artifacts,
  currentArtifact,
  selectedArtifactPath,
  classifications = {},
  onSelectArtifact,
  onCloseArtifact,
  onExpandArtifact,
  onToggleFolder,
  onEditArtifact,
  onDeleteArtifact,
  // onRenameArtifact - intentionally unused, kept for backwards compat
  onCopyRef,
  isArtifactLoading = false,
  isLoading = false,
  // Panel state
  isMinimized = false,
  onExpandPanel,
  onClosePanel,
  // Spec props (SPEC-006-E)
  spec = null,
  specSections = [],
  isSpecEditing = false,
  onSpecEdit,
  onSpecSave,
  onSpecCancel,
  onSpecTransition,
  onSpecCreateTasks,
  onGenerateSpec,
  isSpecLoading = false,
}) => {
  // Internal state for tabs (for backwards compatibility)
  const [activeTab, setActiveTab] = useState<TabType>("idea");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track selected artifact object
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    null,
  );

  // Track latest artifact ID for auto-expanding new artifacts
  const [latestArtifactId, setLatestArtifactId] = useState<string | null>(null);
  const prevArtifactsLengthRef = useRef(artifacts.length);

  // Detect when new artifacts are added and track the latest one
  useEffect(() => {
    if (artifacts.length > prevArtifactsLengthRef.current) {
      // New artifact added - find the newest one by createdAt
      const sorted = [...artifacts].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      if (sorted.length > 0) {
        setLatestArtifactId(sorted[0].id);
      }
    }
    prevArtifactsLengthRef.current = artifacts.length;
  }, [artifacts]);

  // Compute effective selected path from either new prop or currentArtifact (backwards compat)
  const effectiveSelectedPath =
    selectedArtifactPath ?? currentArtifact?.id ?? null;

  // Update selected artifact when path or currentArtifact changes
  useEffect(() => {
    if (currentArtifact) {
      // Use currentArtifact directly if provided (backwards compat)
      setSelectedArtifact(currentArtifact);
    } else if (effectiveSelectedPath) {
      const artifact = artifacts.find(
        (a) =>
          a.id === effectiveSelectedPath ||
          a.title === effectiveSelectedPath ||
          a.identifier === effectiveSelectedPath,
      );
      setSelectedArtifact(artifact || null);
    } else {
      setSelectedArtifact(null);
    }
  }, [effectiveSelectedPath, currentArtifact, artifacts]);

  // Auto-switch to artifacts tab when a new artifact is added
  useEffect(() => {
    if (artifacts.length > 0 && selectedArtifact) {
      setActiveTab("artifacts");
    }
  }, [artifacts.length, selectedArtifact?.id]);

  // Handle artifact selection
  const handleSelectArtifact = useCallback(
    (artifact: Artifact) => {
      setSelectedArtifact(artifact);
      onSelectArtifact(artifact);
    },
    [onSelectArtifact],
  );

  // Handle folder toggle
  const handleToggleFolder = useCallback(
    (folderPath: string) => {
      if (onToggleFolder) {
        onToggleFolder(folderPath);
      }
    },
    [onToggleFolder],
  );

  // Handle edit with content
  const handleEdit = useCallback(
    (artifactId: string, content?: string) => {
      if (onEditArtifact) {
        onEditArtifact(artifactId, content);
      }
    },
    [onEditArtifact],
  );

  // Handle delete
  const handleDelete = useCallback(
    (artifactId: string) => {
      if (onDeleteArtifact) {
        onDeleteArtifact(artifactId);
        // Clear selection if deleted artifact was selected
        if (selectedArtifact?.id === artifactId) {
          setSelectedArtifact(null);
        }
      }
    },
    [onDeleteArtifact, selectedArtifact],
  );

  // Handle copy ref
  const handleCopyRef = useCallback(
    (artifactId: string) => {
      if (onCopyRef) {
        onCopyRef(artifactId);
      }
    },
    [onCopyRef],
  );

  // Handle clear selection (for keyboard navigation Escape key)
  const handleClearSelection = useCallback(() => {
    setSelectedArtifact(null);
  }, []);

  // Handle close panel (backwards compat with onCloseArtifact)
  const handleClosePanel = onClosePanel ?? onCloseArtifact;
  const handleExpandPanel = onExpandPanel ?? onExpandArtifact;

  // Determine loading state
  const loading = isLoading || isArtifactLoading;

  // Network status for offline indicator (TEST-UI-014)
  const isOffline = useNetworkStatus();

  // Minimized view - show expand button
  if (isMinimized) {
    return (
      <div
        data-testid="artifact-panel-minimized"
        className="flex flex-col items-center w-10 h-full bg-gray-50 border-l border-gray-200"
      >
        <button
          onClick={handleExpandPanel}
          className="flex flex-col items-center gap-2 py-4 px-2 hover:bg-gray-100 transition-colors w-full"
          title="Expand panel"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
          <span
            className="text-xs text-gray-500 transform rotate-180"
            style={{ writingMode: "vertical-rl" }}
          >
            {candidate ? candidate.title.slice(0, 15) : "Panel"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* Offline indicator (TEST-UI-014) */}
      <OfflineIndicator isOffline={isOffline} />

      <div
        data-testid="artifact-panel"
        className={`
          flex flex-col bg-white border-l border-gray-200 relative
          ${isFullscreen ? "fixed inset-0 z-50" : "w-1/2 h-full"}
        `}
      >
        {/* Header with main tabs */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("idea")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
              ${
                activeTab === "idea"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Idea
            </button>
            <button
              onClick={() => setActiveTab("artifacts")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
              ${
                activeTab === "artifacts"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <FileText className="w-4 h-4" />
              Artifacts
              {artifacts.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                  {artifacts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("spec")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
              ${
                activeTab === "spec"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <FileText className="w-4 h-4" />
              Spec
              {spec && (
                <span
                  className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                    spec.workflowState === "approved"
                      ? "bg-green-200 text-green-700"
                      : spec.workflowState === "review"
                        ? "bg-blue-200 text-blue-700"
                        : "bg-yellow-200 text-yellow-700"
                  }`}
                >
                  {spec.workflowState}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
            </button>
            {handleClosePanel && (
              <button
                onClick={handleClosePanel}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                title="Minimize panel"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === "idea" && (
          <IdeaContent
            candidate={candidate}
            confidence={confidence}
            viability={viability}
            risks={risks}
            showIntervention={showIntervention}
            onContinue={onContinue}
            onDiscard={onDiscard}
          />
        )}

        {activeTab === "artifacts" && (
          /* Artifacts tab with accordion layout */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Accordion artifact list - takes full height */}
            <div
              data-testid="artifact-table-container"
              className="flex-1 overflow-auto"
            >
              {loading ? (
                // Show skeleton loading state
                <ArtifactTable
                  artifacts={[]}
                  selectedPath={null}
                  onSelect={() => {}}
                  onToggleFolder={() => {}}
                  classifications={{}}
                  isLoading={true}
                />
              ) : artifacts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">
                      No artifacts yet
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Artifacts created during the session will appear here
                    </p>
                  </div>
                </div>
              ) : (
                <ArtifactTable
                  artifacts={artifacts}
                  selectedPath={effectiveSelectedPath}
                  onSelect={handleSelectArtifact}
                  onToggleFolder={handleToggleFolder}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onCopyRef={handleCopyRef}
                  onClearSelection={handleClearSelection}
                  classifications={classifications}
                  isLoading={false}
                  latestArtifactId={latestArtifactId}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "spec" && (
          /* Spec tab (SPEC-006-E) */
          <div className="flex-1 overflow-hidden">
            {spec ? (
              <SpecPanel
                spec={spec}
                sections={specSections}
                isEditing={isSpecEditing}
                onEdit={onSpecEdit || (() => {})}
                onSave={onSpecSave || (async () => {})}
                onCancel={onSpecCancel || (() => {})}
                onTransition={onSpecTransition || (async () => {})}
                onCreateTasks={onSpecCreateTasks || (async () => {})}
                isLoading={isSpecLoading}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 h-full">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No spec yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Continue the conversation to generate a specification
                  </p>
                  {onGenerateSpec && (
                    <button
                      onClick={onGenerateSpec}
                      disabled={isSpecLoading}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isSpecLoading ? "Generating..." : "Generate Spec"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default IdeaArtifactPanel;
