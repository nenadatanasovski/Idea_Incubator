/**
 * ProjectSpec - Specifications sub-tab content
 * Shows PRDs/specs for this project
 */

import { useState, useEffect, useCallback } from "react";
import { useOutletContext, Link } from "react-router-dom";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Archive,
  Edit3,
  Plus,
  Target,
  Users,
  List,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import type { ProjectWithStats } from "../../../../types/project";
import SpecCoverageColumn from "./SpecCoverageColumn";
import AISyncButton from "./AISyncButton";
import { useCoverageStats } from "../../hooks/useTraceability";

const API_BASE = "http://localhost:3001";

interface OutletContext {
  project: ProjectWithStats;
}

interface PRD {
  id: string;
  slug: string;
  title: string;
  projectId?: string;
  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;
  successCriteria: Array<{
    criterion: string;
    metric: string;
    target: string;
  }>;
  constraints: string[];
  outOfScope: string[];
  status: "draft" | "review" | "approved" | "archived";
  workflowState?: string;
  readinessScore?: number;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: typeof FileText }
> = {
  draft: {
    label: "Draft",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: Edit3,
  },
  review: {
    label: "In Review",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CheckCircle2,
  },
  archived: {
    label: "Archived",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: Archive,
  },
};

export default function ProjectSpec() {
  const { project } = useOutletContext<OutletContext>();

  const [prds, setPrds] = useState<PRD[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPrds, setExpandedPrds] = useState<Set<string>>(new Set());

  // Fetch coverage stats for the project
  const { stats: coverageStats } = useCoverageStats({ projectId: project.id });

  // Fetch PRDs for this project
  const fetchPrds = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch PRDs by project ID
      const response = await fetch(
        `${API_BASE}/api/prds?projectId=${project.id}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch specifications");
      }

      const data = await response.json();
      const prdList = Array.isArray(data) ? data : data.prds || [];
      setPrds(prdList);

      // Expand first PRD by default
      if (prdList.length > 0) {
        setExpandedPrds(new Set([prdList[0].id]));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch specifications",
      );
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchPrds();
  }, [fetchPrds]);

  // Toggle PRD expansion
  const togglePrd = (prdId: string) => {
    setExpandedPrds((prev) => {
      const next = new Set(prev);
      if (next.has(prdId)) {
        next.delete(prdId);
      } else {
        next.add(prdId);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // No PRDs found
  if (prds.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Specifications Yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create a specification to define requirements for this project.
          </p>
          <Link
            to="/prds/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Specification
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Specifications ({prds.length})
        </h2>
        <Link
          to="/prds/new"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Specification
        </Link>
      </div>

      {/* PRD List */}
      <div className="space-y-4">
        {prds.map((prd) => {
          const isExpanded = expandedPrds.has(prd.id);
          const config = statusConfig[prd.status] || statusConfig.draft;
          const StatusIcon = config.icon;

          return (
            <div
              key={prd.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* PRD Header */}
              <button
                onClick={() => togglePrd(prd.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                  <FileText className="h-5 w-5 text-primary-500" />
                  <div>
                    <span className="font-medium text-gray-900">
                      {prd.title}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                          config.bgColor,
                          config.color,
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </span>
                      {prd.readinessScore !== undefined && (
                        <span className="text-xs text-gray-500">
                          Readiness: {prd.readinessScore}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  Updated: {new Date(prd.updatedAt).toLocaleDateString()}
                </span>
              </button>

              {/* PRD Content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 space-y-4">
                  {/* Problem Statement */}
                  {prd.problemStatement && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        Problem Statement
                      </div>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {prd.problemStatement}
                      </p>
                    </div>
                  )}

                  {/* Target Users */}
                  {prd.targetUsers && (
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        Target Users
                      </div>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {prd.targetUsers}
                      </p>
                    </div>
                  )}

                  {/* Functional Description */}
                  {prd.functionalDescription && (
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <FileText className="h-4 w-4 text-green-500" />
                        Functional Description
                      </div>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                        {prd.functionalDescription}
                      </p>
                    </div>
                  )}

                  {/* Success Criteria */}
                  {prd.successCriteria && prd.successCriteria.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <Target className="h-4 w-4 text-purple-500" />
                          Success Criteria
                        </div>
                        <div className="flex items-center gap-2">
                          <AISyncButton
                            endpoint="/api/ai/sync-spec-section"
                            payload={{
                              prdId: prd.id,
                              sectionType: "success_criteria",
                            }}
                            buttonText="Sync from Tasks"
                            confirmText="This will use AI to suggest updates to success criteria based on task progress. Continue?"
                            onSuccess={(data) => {
                              console.log("AI sync result:", data);
                              // In a real implementation, show a diff modal
                              alert(
                                `AI Suggestion:\n${JSON.stringify(data, null, 2)}`,
                              );
                            }}
                          />
                          {coverageStats &&
                            coverageStats.totalRequirements > 0 && (
                              <span
                                className={clsx(
                                  "text-xs font-medium px-2 py-0.5 rounded",
                                  coverageStats.overallCoverage === 100
                                    ? "bg-green-100 text-green-700"
                                    : coverageStats.overallCoverage >= 50
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-700",
                                )}
                              >
                                {coverageStats.overallCoverage}% covered
                              </span>
                            )}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="pb-2">Criterion</th>
                              <th className="pb-2">Metric</th>
                              <th className="pb-2">Target</th>
                              <th className="pb-2 w-24 text-center">
                                Coverage
                              </th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-600">
                            {prd.successCriteria.map((sc, idx) => (
                              <tr
                                key={idx}
                                className="border-t border-gray-200"
                              >
                                <td className="py-2">{sc.criterion}</td>
                                <td className="py-2">{sc.metric}</td>
                                <td className="py-2 font-medium text-green-600">
                                  {sc.target}
                                </td>
                                <SpecCoverageColumn
                                  prdId={prd.id}
                                  sectionType="success_criteria"
                                  itemIndex={idx}
                                  projectSlug={project.slug}
                                />
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Constraints */}
                  {prd.constraints && prd.constraints.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <List className="h-4 w-4 text-orange-500" />
                          Constraints
                        </div>
                        <AISyncButton
                          endpoint="/api/ai/sync-spec-section"
                          payload={{
                            prdId: prd.id,
                            sectionType: "constraints",
                          }}
                          buttonText="Sync from Tasks"
                          confirmText="This will use AI to suggest updates to constraints based on task progress. Continue?"
                          onSuccess={(data) => {
                            console.log("AI sync result:", data);
                            alert(
                              `AI Suggestion:\n${JSON.stringify(data, null, 2)}`,
                            );
                          }}
                        />
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="pb-2">Constraint</th>
                              <th className="pb-2 w-24 text-center">
                                Coverage
                              </th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-600">
                            {prd.constraints.map((c, idx) => (
                              <tr
                                key={idx}
                                className="border-t border-gray-200"
                              >
                                <td className="py-2">
                                  <span className="text-orange-500 mr-2">
                                    •
                                  </span>
                                  {c}
                                </td>
                                <SpecCoverageColumn
                                  prdId={prd.id}
                                  sectionType="constraints"
                                  itemIndex={idx}
                                  projectSlug={project.slug}
                                />
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Out of Scope */}
                  {prd.outOfScope && prd.outOfScope.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <XCircle className="h-4 w-4 text-gray-500" />
                        Out of Scope
                      </div>
                      <ul className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg space-y-1">
                        {prd.outOfScope.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-gray-400">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
