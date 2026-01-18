/**
 * TraceabilityView - Main traceability view for a project
 *
 * Two-panel layout showing spec sections on left, details on right.
 * Displays overall coverage summary and gap/orphan warnings.
 */

import { useState } from "react";
import { useOutletContext } from "react-router-dom";
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
} from "../../hooks/useTraceability";
import SpecSectionCard from "./SpecSectionCard";
import LinkedTaskChip from "./LinkedTaskChip";
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

  const [selectedSection, setSelectedSection] = useState<string | null>(null);

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
      {/* Coverage summary header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Requirement Traceability
            </h2>
            <p className="text-sm text-gray-500">
              PRD: {traceability.prdTitle}
            </p>
          </div>
          <button
            onClick={refetch}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {/* Overall coverage */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={clsx(
                  "h-3 w-3 rounded-full",
                  traceability.overallCoverage === 100
                    ? "bg-green-500"
                    : traceability.overallCoverage >= 50
                      ? "bg-amber-500"
                      : "bg-red-500",
                )}
              />
              <span className="text-sm font-medium text-gray-700">
                Overall Coverage
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {traceability.overallCoverage}%
            </p>
          </div>

          {/* Requirements covered */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Covered</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {traceability.sections.reduce(
                (sum, s) => sum + s.coveredItems,
                0,
              )}
              <span className="text-sm font-normal text-gray-500">
                {" "}
                /{" "}
                {traceability.sections.reduce(
                  (sum, s) => sum + s.totalItems,
                  0,
                )}
              </span>
            </p>
          </div>

          {/* Coverage gaps */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle
                className={clsx(
                  "h-4 w-4",
                  traceability.gapCount > 0
                    ? "text-amber-500"
                    : "text-gray-400",
                )}
              />
              <span className="text-sm font-medium text-gray-700">Gaps</span>
            </div>
            <p
              className={clsx(
                "text-2xl font-bold",
                traceability.gapCount > 0 ? "text-amber-600" : "text-gray-900",
              )}
            >
              {traceability.gapCount}
            </p>
          </div>

          {/* Orphan tasks */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Link2Off
                className={clsx(
                  "h-4 w-4",
                  traceability.orphanTaskCount > 0
                    ? "text-amber-500"
                    : "text-gray-400",
                )}
              />
              <span className="text-sm font-medium text-gray-700">
                Orphan Tasks
              </span>
            </div>
            <p
              className={clsx(
                "text-2xl font-bold",
                traceability.orphanTaskCount > 0
                  ? "text-amber-600"
                  : "text-gray-900",
              )}
            >
              {traceability.orphanTaskCount}
            </p>
          </div>
        </div>
      </div>

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
              onClick={() => setSelectedSection(section.sectionType)}
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

          {/* Orphan tasks section */}
          {orphanTasks.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Link2Off className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-800">
                  Orphan Tasks ({orphanTasks.length})
                </span>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                These tasks are not linked to any PRD requirement.
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {orphanTasks.slice(0, 5).map((task) => (
                  <LinkedTaskChip
                    key={task.id}
                    task={{
                      id: task.id,
                      displayId: task.displayId,
                      title: task.title,
                      status: task.status,
                      linkType: "related",
                    }}
                    projectSlug={projectSlug}
                    showLinkType={false}
                    size="sm"
                  />
                ))}
                {orphanTasks.length > 5 && (
                  <p className="text-xs text-amber-600">
                    +{orphanTasks.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}
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
