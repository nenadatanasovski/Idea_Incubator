/**
 * ProfileFitBreakdown
 *
 * Displays how well a strategy fits the user's profile,
 * showing strengths, gaps, and suggestions for improvement.
 */

import type { EnhancedStrategy, UserProfileSummary } from "../types";

interface Props {
  strategy: EnhancedStrategy;
  profile?: UserProfileSummary | null;
  className?: string;
}

const getFitScoreColor = (score: number) => {
  if (score >= 8) return "text-green-600";
  if (score >= 6) return "text-blue-600";
  if (score >= 4) return "text-yellow-600";
  return "text-red-600";
};

const getFitScoreBackground = (score: number) => {
  if (score >= 8) return "bg-green-50 border-green-200";
  if (score >= 6) return "bg-blue-50 border-blue-200";
  if (score >= 4) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
};

export default function ProfileFitBreakdown({
  strategy,
  profile,
  className = "",
}: Props) {
  const { profileFitBreakdown, fitWithProfile } = strategy;

  // If no breakdown available, show simple score
  if (!profileFitBreakdown) {
    return (
      <div
        className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}
      >
        <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-indigo-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
          Profile Fit
        </h4>
        <div className="flex items-center gap-4">
          <div
            className={`px-4 py-3 rounded-lg border ${getFitScoreBackground(fitWithProfile)}`}
          >
            <span
              className={`text-3xl font-bold ${getFitScoreColor(fitWithProfile)}`}
            >
              {fitWithProfile}
            </span>
            <span className="text-gray-500 text-lg">/10</span>
          </div>
          <p className="text-sm text-gray-600">
            {fitWithProfile >= 8
              ? "Excellent fit with your profile"
              : fitWithProfile >= 6
                ? "Good fit with your profile"
                : fitWithProfile >= 4
                  ? "Moderate fit - some gaps to address"
                  : "Low fit - significant gaps identified"}
          </p>
        </div>
      </div>
    );
  }

  const { score, strengths, gaps, suggestions } = profileFitBreakdown;

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-indigo-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
          Profile Fit Analysis
        </h4>
        <div
          className={`px-3 py-1 rounded-full border ${getFitScoreBackground(score)}`}
        >
          <span className={`text-lg font-bold ${getFitScoreColor(score)}`}>
            {score}
          </span>
          <span className="text-gray-500 text-sm">/10</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Strengths */}
        {strengths && strengths.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-green-700 uppercase tracking-wide mb-2">
              Strengths
            </h5>
            <ul className="space-y-1">
              {strengths.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <svg
                    className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gaps */}
        {gaps && gaps.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-red-700 uppercase tracking-wide mb-2">
              Gaps
            </h5>
            <ul className="space-y-1">
              {gaps.map((g, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <svg
                    className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-2">
              Suggestions
            </h5>
            <ul className="space-y-1">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <svg
                    className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Profile context if available */}
        {profile && (
          <div className="pt-3 border-t border-gray-100">
            <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Your Profile
            </h5>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              {profile.risk_tolerance && (
                <div>
                  <span className="text-gray-400">Risk:</span>{" "}
                  {profile.risk_tolerance}
                </div>
              )}
              {profile.weekly_hours_available && (
                <div>
                  <span className="text-gray-400">Hours:</span>{" "}
                  {profile.weekly_hours_available}/week
                </div>
              )}
              {profile.domain_expertise && (
                <div className="col-span-2">
                  <span className="text-gray-400">Domain:</span>{" "}
                  {profile.domain_expertise}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
