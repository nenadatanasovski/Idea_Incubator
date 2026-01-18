/**
 * TraceabilityView - Main traceability view for a project
 *
 * Two-panel layout showing spec sections on left, details on right.
 * Displays overall coverage summary and gap/orphan warnings.
 */

import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  FileText,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Link2Off,
} from "lucide-react";
import clsx from "clsx";
import {
  useTraceability,
  useCoverageGaps,
  useOrphanTasks,
  useTraceabilityHierarchy,
} from "../../hooks/useTraceability";
import { useTraceabilityGaps } from "../../hooks/useTraceabilityGaps";
import SpecSectionCard from "./SpecSectionCard";
import TraceabilityGapPanel from "./TraceabilityGapPanel";
import TraceabilityHierarchy from "./TraceabilityHierarchy";
import OrphanTaskPanel from "./OrphanTaskPanel";
import type { ProjectWithStats } from "../../../../types/project";

interface OutletContext {
  project: ProjectWithStats;
}

export default function TraceabilityView() {
  // Get project from outlet context (passed by ProjectsPage)
  const { project } = useOutletContext<OutletContext>();
  const projectId = project.id;
  const projectSlug = project.slug;

  const { traceability, isLoading, error, refetch } = useTraceability({
    projectId,
  });
  const { orphanTasks } = useOrphanTasks({ projectId });
  const { gaps } = useCoverageGaps({ projectId });

  // AI Gap Analysis
  const {
    gaps: aiGaps,
    counts: gapCounts,
    isAnalyzing,
    runAnalysis,
    getSuggestions,
    resolveGap,
    ignoreGap,
    refetch: refetchGaps,
  } = useTraceabilityGaps(projectId);

  // Hierarchical view
  const { hierarchy } = useTraceabilityHierarchy({ projectId });

  // URL-based state for tab persistence
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSection = searchParams.get("section");

  const handleSectionSelect = (sectionType: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("section", sectionType);
      return newParams;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-3 text-gray-600">Loading traceability data...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">
          Error Loading Data
        </h3>
        <p className="text-gray-600 mt-1">{error}</p>
        <button
          onClick={refetch}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  // No PRD state
  if (!traceability || !traceability.prdId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <FileText className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No PRD Found</h3>
        <p className="text-gray-600 mt-1">
          This project doesn&apos;t have a PRD yet. Create a PRD to start
          tracking requirement coverage.
        </p>
      </div>
    );
  }

  const selectedSectionData = traceability.sections.find(
    (s) => s.sectionType === selectedSection,
  );

  return (
    <div className="space-y-6">
      {/* Coverage summary header - inline stats */}
      <div className="bg-white rounded-lg border border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Requirement Traceability
              </h2>
              <p className="text-sm text-gray-500">
                PRD: {traceability.prdTitle}
              </p>
            </div>

            {/* Inline stats */}
            <div className="flex items-center gap-6 pl-6 border-l border-gray-200">
              {/* Overall coverage */}
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    "h-2.5 w-2.5 rounded-full",
                    traceability.overallCoverage === 100
                      ? "bg-green-500"
                      : traceability.overallCoverage >= 50
                        ? "bg-amber-500"
                        : "bg-red-500",
                  )}
                />
                <span className="text-xs text-gray-500">Overall Coverage</span>
                <span className="text-sm font-bold text-gray-900">
                  {traceability.overallCoverage}%
                </span>
              </div>

              {/* Requirements covered */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs text-gray-500">Covered</span>
                <span className="text-sm font-bold text-gray-900">
                  {traceability.sections.reduce(
                    (sum, s) => sum + s.coveredItems,
                    0,
                  )}
                  <span className="font-normal text-gray-400">
                    /
                    {traceability.sections.reduce(
                      (sum, s) => sum + s.totalItems,
                      0,
                    )}
                  </span>
                </span>
              </div>

              {/* Coverage gaps */}
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={clsx(
                    "h-3.5 w-3.5",
                    traceability.gapCount > 0
                      ? "text-amber-500"
                      : "text-gray-400",
                  )}
                />
                <span className="text-xs text-gray-500">Gaps</span>
                <span
                  className={clsx(
                    "text-sm font-bold",
                    traceability.gapCount > 0
                      ? "text-amber-600"
                      : "text-gray-900",
                  )}
                >
                  {traceability.gapCount}
                </span>
              </div>

              {/* Orphan tasks */}
              <div className="flex items-center gap-2">
                <Link2Off
                  className={clsx(
                    "h-3.5 w-3.5",
                    traceability.orphanTaskCount > 0
                      ? "text-amber-500"
                      : "text-gray-400",
                  )}
                />
                <span className="text-xs text-gray-500">Orphan Tasks</span>
                <span
                  className={clsx(
                    "text-sm font-bold",
                    traceability.orphanTaskCount > 0
                      ? "text-amber-600"
                      : "text-gray-900",
                  )}
                >
                  {traceability.orphanTaskCount}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={refetch}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* AI Gap Analysis Panel */}
      <TraceabilityGapPanel
        gaps={aiGaps}
        counts={gapCounts}
        isAnalyzing={isAnalyzing}
        onAnalyze={runAnalysis}
        onGetSuggestions={getSuggestions}
        onResolve={async (gapId) => {
          await resolveGap(gapId);
          refetch();
        }}
        onIgnore={ignoreGap}
        onRefetch={refetchGaps}
      />

      {/* Hierarchical View */}
      {hierarchy && (
        <TraceabilityHierarchy
          hierarchy={hierarchy}
          projectSlug={projectSlug}
          defaultExpanded={["section-success_criteria", "section-constraints"]}
        />
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left panel - Section list */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Spec Sections
          </h3>
          {traceability.sections.map((section) => (
            <button
              key={section.sectionType}
              onClick={() => handleSectionSelect(section.sectionType)}
              className={clsx(
                "w-full text-left p-4 rounded-lg border transition-colors",
                selectedSection === section.sectionType
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 bg-white hover:border-gray-300",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">
                  {section.sectionTitle}
                </span>
                <span
                  className={clsx(
                    "text-sm font-bold",
                    section.coveragePercentage === 100
                      ? "text-green-600"
                      : section.coveragePercentage >= 50
                        ? "text-amber-600"
                        : "text-red-600",
                  )}
                >
                  {section.coveragePercentage}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full",
                    section.coveragePercentage === 100
                      ? "bg-green-500"
                      : section.coveragePercentage >= 50
                        ? "bg-amber-500"
                        : "bg-red-500",
                  )}
                  style={{ width: `${section.coveragePercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {section.coveredItems} of {section.totalItems} covered
              </p>
            </button>
          ))}

          {/* Enhanced Orphan Task Panel with AI suggestions */}
          <OrphanTaskPanel
            orphanTasks={orphanTasks}
            projectId={projectId}
            projectSlug={projectSlug}
            onLinkApplied={refetch}
            onTaskDismissed={refetch}
          />
        </div>

        {/* Right panel - Selected section details */}
        <div className="col-span-2">
          {selectedSectionData ? (
            <SpecSectionCard
              section={selectedSectionData}
              projectSlug={projectSlug}
              defaultExpanded={true}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                Select a Section
              </h3>
              <p className="text-gray-600 mt-1">
                Click on a section in the left panel to view its requirements
                and linked tasks.
              </p>
            </div>
          )}

          {/* Coverage gaps */}
          {gaps.length > 0 && (
            <div className="mt-6 border border-amber-200 bg-amber-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-800">
                  Coverage Gaps ({gaps.length})
                </span>
              </div>
              <p className="text-sm text-amber-700 mb-4">
                These requirements need tasks to be linked to them.
              </p>
              <div className="space-y-3">
                {gaps.map((gap) => (
                  <div
                    key={`${gap.sectionType}-${gap.itemIndex}`}
                    className={clsx(
                      "p-3 bg-white rounded border-l-4",
                      gap.severity === "high"
                        ? "border-red-400"
                        : gap.severity === "medium"
                          ? "border-amber-400"
                          : "border-gray-400",
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="font-medium">{gap.sectionTitle}</span>
                      <span>#{gap.itemIndex + 1}</span>
                      <span
                        className={clsx(
                          "px-1.5 py-0.5 rounded text-xs font-medium",
                          gap.severity === "high"
                            ? "bg-red-100 text-red-700"
                            : gap.severity === "medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-700",
                        )}
                      >
                        {gap.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {gap.itemContent}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
