/**
 * CoverageStatsCard - Displays PRD coverage statistics
 *
 * Shows overall coverage, orphan tasks, and gaps in a sidebar card.
 */

import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Link2Off,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import { useCoverageStats } from "../../hooks/useTraceability";

interface CoverageStatsCardProps {
  projectId: string;
  projectSlug: string;
}

export default function CoverageStatsCard({
  projectId,
  projectSlug,
}: CoverageStatsCardProps) {
  const { stats, isLoading, error } = useCoverageStats({ projectId });

  // Don't render if loading or error
  if (isLoading || error || !stats) {
    return null;
  }

  // Don't render if there are no requirements to track
  if (stats.totalRequirements === 0) {
    return null;
  }

  const hasIssues = stats.orphanTaskCount > 0 || stats.gapCount > 0;

  return (
    <div
      className={clsx(
        "bg-white rounded-lg border shadow-sm p-5",
        hasIssues ? "border-amber-200" : "border-gray-200",
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Requirement Coverage</h3>
        {hasIssues && <AlertTriangle className="h-4 w-4 text-amber-500" />}
      </div>

      {/* Coverage progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-600">Overall Coverage</span>
          <span
            className={clsx(
              "font-bold",
              stats.overallCoverage === 100
                ? "text-green-600"
                : stats.overallCoverage >= 50
                  ? "text-amber-600"
                  : "text-red-600",
            )}
          >
            {stats.overallCoverage}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all",
              stats.overallCoverage === 100
                ? "bg-green-500"
                : stats.overallCoverage >= 50
                  ? "bg-amber-500"
                  : "bg-red-500",
            )}
            style={{ width: `${stats.overallCoverage}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Covered</span>
          </div>
          <span className="text-sm font-medium text-gray-900">
            {stats.coveredRequirements} / {stats.totalRequirements}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <AlertTriangle
              className={clsx(
                "h-4 w-4",
                stats.gapCount > 0 ? "text-amber-500" : "text-gray-400",
              )}
            />
            <span>Gaps</span>
          </div>
          <span
            className={clsx(
              "text-sm font-medium",
              stats.gapCount > 0 ? "text-amber-600" : "text-gray-900",
            )}
          >
            {stats.gapCount}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Link2Off
              className={clsx(
                "h-4 w-4",
                stats.orphanTaskCount > 0 ? "text-amber-500" : "text-gray-400",
              )}
            />
            <span>Orphan Tasks</span>
          </div>
          <span
            className={clsx(
              "text-sm font-medium",
              stats.orphanTaskCount > 0 ? "text-amber-600" : "text-gray-900",
            )}
          >
            {stats.orphanTaskCount}
          </span>
        </div>
      </div>

      {/* View Details link */}
      <Link
        to={`/projects/${projectSlug}/traceability`}
        className="flex items-center justify-center gap-1.5 mt-4 pt-4 border-t border-gray-100 text-sm text-primary-600 hover:text-primary-700 transition-colors"
      >
        View Details
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
