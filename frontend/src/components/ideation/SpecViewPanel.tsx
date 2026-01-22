// =============================================================================
// FILE: frontend/src/components/ideation/SpecViewPanel.tsx
// Spec view panel with completeness progress bar, version history, and export
// Part of: Phase 9 - Project Folder & Spec Output (T9.3)
// =============================================================================

import { memo, useState, useCallback, useEffect } from "react";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Network,
  Download,
  RefreshCw,
  History,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
} from "lucide-react";
import type {
  Spec,
  SpecSection,
  SpecSectionType,
  SpecWorkflowState,
} from "../../types/spec";

export interface SpecVersion {
  version: number;
  createdAt: string;
  workflowState: SpecWorkflowState;
  changedBy?: string;
  changeReason?: string;
}

export interface SpecViewPanelProps {
  spec: Spec | null;
  sections: SpecSection[];
  isVisible: boolean;
  isLoading?: boolean;
  onViewInGraph?: (sectionType: SpecSectionType, blockIds?: string[]) => void;
  onExport?: (format: "md" | "json") => void;
  onRegenerate?: () => void;
  onViewVersion?: (version: number) => void;
  className?: string;
}

// Section configuration
const SECTION_CONFIG: Record<
  SpecSectionType,
  { label: string; description: string; graphType: string }
> = {
  problem: {
    label: "Problem Statement",
    description: "What problem are you solving?",
    graphType: "problem",
  },
  target_users: {
    label: "Target Users",
    description: "Who will use this solution?",
    graphType: "market",
  },
  functional_desc: {
    label: "Functional Description",
    description: "How will the solution work?",
    graphType: "solution",
  },
  success_criteria: {
    label: "Success Criteria",
    description: "How will you measure success?",
    graphType: "fit",
  },
  constraints: {
    label: "Constraints",
    description: "What limitations exist?",
    graphType: "risk",
  },
  out_of_scope: {
    label: "Out of Scope",
    description: "What is NOT included?",
    graphType: "spec",
  },
  risks: {
    label: "Risks",
    description: "What could go wrong?",
    graphType: "risk",
  },
  assumptions: {
    label: "Assumptions",
    description: "What are you assuming?",
    graphType: "spec",
  },
};

const SECTION_ORDER: SpecSectionType[] = [
  "problem",
  "target_users",
  "functional_desc",
  "success_criteria",
  "constraints",
  "out_of_scope",
  "risks",
  "assumptions",
];

interface ProgressBarProps {
  sections: SpecSection[];
  totalSections: number;
}

const CompletenessProgressBar = memo(function CompletenessProgressBar({
  sections,
  totalSections,
}: ProgressBarProps) {
  // Calculate completeness metrics
  const completeSections = sections.filter(
    (s) => s.content && s.content.trim().length > 0 && s.confidenceScore >= 50,
  ).length;
  const partialSections = sections.filter(
    (s) => s.content && s.content.trim().length > 0 && s.confidenceScore < 50,
  ).length;
  const missingSections = totalSections - completeSections - partialSections;

  const completeness = Math.round((completeSections / totalSections) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">Spec Completeness</span>
        <span className="font-semibold text-gray-900">{completeness}%</span>
      </div>

      {/* Progress bar with section indicators */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
        {sections.map((section, index) => {
          const width = 100 / totalSections;
          let bgColor = "bg-gray-300"; // Missing

          if (section.content && section.content.trim().length > 0) {
            bgColor =
              section.confidenceScore >= 50 ? "bg-green-500" : "bg-yellow-500";
          }

          return (
            <div
              key={section.id || index}
              className={`${bgColor} transition-colors`}
              style={{ width: `${width}%` }}
              title={`${SECTION_CONFIG[section.sectionType]?.label || section.sectionType}: ${section.confidenceScore}%`}
            />
          );
        })}

        {/* Fill remaining slots for missing sections */}
        {Array.from({ length: missingSections }).map((_, i) => (
          <div
            key={`missing-${i}`}
            className="bg-gray-300"
            style={{ width: `${100 / totalSections}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Complete ({completeSections})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          Needs Review ({partialSections})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          Missing ({missingSections})
        </span>
      </div>
    </div>
  );
});

interface VersionHistoryModalProps {
  isOpen: boolean;
  specId: string;
  currentVersion: number;
  onClose: () => void;
  onViewVersion: (version: number) => void;
}

const VersionHistoryModal = memo(function VersionHistoryModal({
  isOpen,
  specId,
  currentVersion,
  onClose,
  onViewVersion,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<SpecVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !specId) return;

    const fetchVersions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/specs/${specId}/versions`);
        if (response.ok) {
          const data = await response.json();
          setVersions(data.versions || []);
        }
      } catch (err) {
        console.error("[VersionHistory] Error fetching versions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersions();
  }, [isOpen, specId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-900">Version History</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No version history available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <div
                  key={version.version}
                  className={`p-3 rounded-lg border ${
                    version.version === currentVersion
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        v{version.version}
                      </span>
                      {version.version === currentVersion && (
                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onViewVersion(version.version)}
                      disabled={version.version === currentVersion}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      title="View this version"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {new Date(version.createdAt).toLocaleString()}
                  </div>
                  {version.changeReason && (
                    <div className="mt-1 text-xs text-gray-600">
                      {version.changeReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

interface SectionViewerProps {
  section: SpecSection;
  config: (typeof SECTION_CONFIG)[SpecSectionType];
  isExpanded: boolean;
  onToggle: () => void;
  onViewInGraph?: () => void;
}

const SectionViewer = memo(function SectionViewer({
  section,
  config,
  isExpanded,
  onToggle,
  onViewInGraph,
}: SectionViewerProps) {
  const getConfidenceColor = (score: number) => {
    if (score >= 75) return "text-green-600 bg-green-100";
    if (score >= 50) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 75) return CheckCircle;
    if (score >= 50) return Clock;
    return AlertCircle;
  };

  const ConfidenceIcon = getConfidenceIcon(section.confidenceScore);

  // Parse content - handle both string and JSON array
  const parseContent = (content: string): string[] => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
      return [String(parsed)];
    } catch {
      return content.split("\n").filter((line) => line.trim());
    }
  };

  const contentItems = parseContent(section.content);
  const isListType = [
    "success_criteria",
    "constraints",
    "out_of_scope",
    "risks",
    "assumptions",
  ].includes(section.sectionType);

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        section.needsReview ? "border-yellow-300" : "border-gray-200"
      }`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <span className="font-medium text-gray-800">{config.label}</span>
          {section.needsReview && (
            <span className="px-1.5 py-0.5 text-xs bg-yellow-200 text-yellow-800 rounded">
              Needs Review
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${getConfidenceColor(section.confidenceScore)}`}
          >
            <ConfidenceIcon className="w-3 h-3" />
            {section.confidenceScore}%
          </span>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-3 pt-0 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">{config.description}</p>

          <div className="text-sm text-gray-700">
            {isListType ? (
              contentItems.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {contentItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 italic">No items specified</p>
              )
            ) : contentItems.length > 0 ? (
              <p className="whitespace-pre-wrap">{contentItems.join("\n")}</p>
            ) : (
              <p className="text-gray-400 italic">Not specified</p>
            )}
          </div>

          {/* View in Graph button */}
          {onViewInGraph && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewInGraph();
              }}
              className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                         text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Network className="w-3.5 h-3.5" />
              View in Graph
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export const SpecViewPanel = memo(function SpecViewPanel({
  spec,
  sections,
  isVisible,
  isLoading = false,
  onViewInGraph,
  onExport,
  onRegenerate,
  onViewVersion,
  className = "",
}: SpecViewPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTION_ORDER),
  );
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Toggle section expansion
  const toggleSection = useCallback((sectionType: SpecSectionType) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionType)) {
        next.delete(sectionType);
      } else {
        next.add(sectionType);
      }
      return next;
    });
  }, []);

  // Handle export
  const handleExport = useCallback(
    (format: "md" | "json") => {
      if (onExport) {
        onExport(format);
      } else if (spec) {
        // Default export to markdown
        const content = generateMarkdownExport(spec, sections);
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${spec.slug || "spec"}-v${spec.version}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [onExport, spec, sections],
  );

  if (!isVisible) return null;

  // No spec state
  if (!spec) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-full text-center p-4 ${className}`}
      >
        <FileText className="w-12 h-12 mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Spec Yet</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-xs">
          Generate a spec from your ideation session to see it here
        </p>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                       text-white bg-blue-600 rounded-md hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Generate Spec
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {spec.title || "Specification"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    spec.workflowState === "approved"
                      ? "bg-green-100 text-green-700"
                      : spec.workflowState === "review"
                        ? "bg-blue-100 text-blue-700"
                        : spec.workflowState === "archived"
                          ? "bg-gray-100 text-gray-700"
                          : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {spec.workflowState.charAt(0).toUpperCase() +
                    spec.workflowState.slice(1)}
                </span>
                <span className="text-xs text-gray-500">v{spec.version}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVersionHistory(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Version history"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleExport("md")}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Export as Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md
                           disabled:opacity-50 disabled:cursor-not-allowed
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Regenerate spec"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <CompletenessProgressBar
          sections={sections}
          totalSections={SECTION_ORDER.length}
        />
      </div>

      {/* Section list */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : (
          SECTION_ORDER.map((sectionType) => {
            const section = sections.find((s) => s.sectionType === sectionType);
            const config = SECTION_CONFIG[sectionType];

            // Create a placeholder section if missing
            const displaySection: SpecSection = section || {
              id: `placeholder-${sectionType}`,
              specId: spec.id,
              sectionType,
              content: "",
              orderIndex: SECTION_ORDER.indexOf(sectionType),
              confidenceScore: 0,
              needsReview: true,
              createdAt: "",
              updatedAt: "",
            };

            return (
              <SectionViewer
                key={sectionType}
                section={displaySection}
                config={config}
                isExpanded={expandedSections.has(sectionType)}
                onToggle={() => toggleSection(sectionType)}
                onViewInGraph={
                  onViewInGraph ? () => onViewInGraph(sectionType) : undefined
                }
              />
            );
          })
        )}
      </div>

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={showVersionHistory}
        specId={spec.id}
        currentVersion={spec.version}
        onClose={() => setShowVersionHistory(false)}
        onViewVersion={(version) => {
          onViewVersion?.(version);
          setShowVersionHistory(false);
        }}
      />
    </div>
  );
});

// Helper function to generate markdown export
function generateMarkdownExport(spec: Spec, sections: SpecSection[]): string {
  const lines: string[] = [
    `# ${spec.title}`,
    "",
    `**Status:** ${spec.workflowState}`,
    `**Version:** ${spec.version}`,
    `**Created:** ${spec.createdAt}`,
    "",
    "---",
    "",
  ];

  for (const sectionType of SECTION_ORDER) {
    const section = sections.find((s) => s.sectionType === sectionType);
    const config = SECTION_CONFIG[sectionType];

    lines.push(`## ${config.label}`);
    lines.push("");

    if (section && section.content) {
      try {
        const parsed = JSON.parse(section.content);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            lines.push(`- ${item}`);
          }
        } else {
          lines.push(String(parsed));
        }
      } catch {
        lines.push(section.content);
      }
    } else {
      lines.push("*Not specified*");
    }

    lines.push("");
  }

  return lines.join("\n");
}

export default SpecViewPanel;
