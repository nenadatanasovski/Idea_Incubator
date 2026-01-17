/**
 * ReadinessIndicator Component
 *
 * Displays the spec generation readiness score with breakdown.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-005-D)
 */

import React, { useState } from "react";
import type { ReadinessIndicatorProps } from "../../types/spec";

// Color based on score
function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  if (score >= 25) return "text-orange-600";
  return "text-red-600";
}

function getProgressColor(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-red-500";
}

export const ReadinessIndicator: React.FC<ReadinessIndicatorProps> = ({
  score,
  onGenerateSpec,
  isGenerating = false,
  showBreakdown = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(showBreakdown);

  if (!score) {
    return null;
  }

  const circumference = 2 * Math.PI * 20; // radius = 20
  const strokeDashoffset = circumference - (score.total / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      {/* Circular Progress */}
      <div className="relative">
        <svg className="w-12 h-12 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="4"
          />
          {/* Progress circle */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={
              score.total >= 75
                ? "#22c55e"
                : score.total >= 50
                  ? "#eab308"
                  : "#f97316"
            }
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${getScoreColor(score.total)}`}>
            {score.total}%
          </span>
        </div>
      </div>

      {/* Score Info */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {score.isReady ? "Ready to Spec" : "Building Context"}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        </div>

        {/* Generate Button */}
        {score.isReady && onGenerateSpec && (
          <button
            onClick={onGenerateSpec}
            disabled={isGenerating}
            className={`
              mt-1 px-3 py-1 text-xs font-medium rounded-full
              ${
                isGenerating
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }
              transition-colors
            `}
          >
            {isGenerating ? "Generating..." : "Generate Spec"}
          </button>
        )}
      </div>

      {/* Breakdown Tooltip/Dropdown */}
      {isExpanded && (
        <div className="absolute z-10 mt-32 ml-0 p-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px]">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            Readiness Breakdown
          </h4>
          <div className="space-y-2">
            {Object.entries(score.dimensions).map(([key, dimension]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{dimension.name}</span>
                  <span className={getScoreColor(dimension.score * 4)}>
                    {dimension.score}/25
                  </span>
                </div>
                <div className="w-full h-1 bg-gray-200 rounded-full">
                  <div
                    className={`h-1 rounded-full ${getProgressColor(dimension.score * 4)}`}
                    style={{ width: `${(dimension.score / 25) * 100}%` }}
                  />
                </div>
                {dimension.description && (
                  <p className="text-xs text-gray-500 truncate">
                    {dimension.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadinessIndicator;
