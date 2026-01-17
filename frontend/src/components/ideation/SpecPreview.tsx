/**
 * SpecPreview Component
 *
 * Collapsible inline preview of a generated spec.
 * Shows summary with readiness score and quick actions.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-005-A)
 */

import React, { useState } from "react";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Edit3,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { SpecWorkflowBadge } from "./SpecWorkflowBadge";
import type {
  SpecPreviewProps,
  SpecSection,
  SpecSectionType,
} from "../../types/spec";

// Section type labels for display
const SECTION_LABELS: Record<SpecSectionType, string> = {
  problem: "Problem Statement",
  target_users: "Target Users",
  functional_desc: "Functional Description",
  success_criteria: "Success Criteria",
  constraints: "Constraints",
  out_of_scope: "Out of Scope",
  risks: "Risks",
  assumptions: "Assumptions",
};

// Get confidence indicator
function getConfidenceIndicator(confidence: number) {
  if (confidence >= 80) {
    return { icon: CheckCircle, color: "text-green-500", label: "High" };
  }
  if (confidence >= 50) {
    return { icon: Clock, color: "text-yellow-500", label: "Medium" };
  }
  return { icon: AlertCircle, color: "text-orange-500", label: "Low" };
}

export const SpecPreview: React.FC<SpecPreviewProps> = ({
  spec,
  sections = [],
  readiness,
  onViewSpec,
  onEditSpec,
  isCollapsible = true,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!spec) {
    return null;
  }

  // Use readinessScore from spec (0-100)
  const confidenceInfo = getConfidenceIndicator(spec.readinessScore || 0);
  const ConfidenceIcon = confidenceInfo.icon;

  // Count sections needing review
  const sectionsNeedingReview = sections.filter(
    (s: SpecSection) => s.needsReview,
  ).length;
  const totalSections = sections.length;

  // Summarize key sections
  const problemSection = sections.find(
    (s: SpecSection) => s.sectionType === "problem",
  );
  const solutionSection = sections.find(
    (s: SpecSection) => s.sectionType === "functional_desc",
  );

  return (
    <div className="spec-preview bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 ${isCollapsible ? "cursor-pointer hover:bg-blue-100/50" : ""}`}
        onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">
              {spec.title || "Generated Specification"}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <SpecWorkflowBadge state={spec.workflowState} size="sm" />
              <span className="text-xs text-gray-500">
                v{spec.version || 1}
              </span>
              <span
                className={`flex items-center gap-1 text-xs ${confidenceInfo.color}`}
              >
                <ConfidenceIcon className="w-3 h-3" />
                {spec.readinessScore}% confidence
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Action buttons */}
          {onViewSpec && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewSpec();
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View
            </button>
          )}
          {onEditSpec && spec.workflowState === "draft" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditSpec();
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}

          {/* Expand/Collapse toggle */}
          {isCollapsible && (
            <button className="p-1 text-gray-400 hover:text-gray-600">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expandable content */}
      {(isExpanded || !isCollapsible) && (
        <div className="border-t border-blue-200 p-3 space-y-3">
          {/* Readiness score */}
          {readiness && (
            <div className="flex items-center gap-2 text-sm">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Readiness Score</span>
                  <span className="font-medium">{readiness.total}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      readiness.total >= 75
                        ? "bg-green-500"
                        : readiness.total >= 50
                          ? "bg-yellow-500"
                          : "bg-orange-500"
                    }`}
                    style={{ width: `${readiness.total}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section summary */}
          {totalSections > 0 && (
            <div className="text-sm">
              <div className="flex justify-between text-xs text-gray-600 mb-2">
                <span>Sections</span>
                <span>
                  {totalSections - sectionsNeedingReview}/{totalSections}{" "}
                  complete
                </span>
              </div>

              {sectionsNeedingReview > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {sectionsNeedingReview} section
                  {sectionsNeedingReview > 1 ? "s" : ""} need review
                </div>
              )}
            </div>
          )}

          {/* Key section previews */}
          {(problemSection || solutionSection) && (
            <div className="space-y-2">
              {problemSection && (
                <div className="text-xs">
                  <span className="font-medium text-gray-700">Problem: </span>
                  <span className="text-gray-600">
                    {truncateText(problemSection.content, 120)}
                  </span>
                </div>
              )}
              {solutionSection && (
                <div className="text-xs">
                  <span className="font-medium text-gray-700">Solution: </span>
                  <span className="text-gray-600">
                    {truncateText(solutionSection.content, 120)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Section list */}
          {sections.length > 0 && (
            <div className="grid grid-cols-2 gap-1 text-xs">
              {sections.slice(0, 6).map((section: SpecSection) => (
                <div
                  key={section.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                    section.needsReview
                      ? "bg-amber-50 text-amber-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  {section.needsReview ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  <span className="truncate">
                    {SECTION_LABELS[section.sectionType] || section.sectionType}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper to truncate text
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

export default SpecPreview;
