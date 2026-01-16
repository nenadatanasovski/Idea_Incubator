// =============================================================================
// FILE: frontend/src/components/ideation/ConfidenceMeter.tsx
// Confidence meter showing idea clarity
// =============================================================================

import "react";
import type { ConfidenceMeterProps } from "../../types/ideation";

export function ConfidenceMeter({
  value,
  showLabel,
  size = "md",
}: ConfidenceMeterProps) {
  const getColor = () => {
    if (value >= 80) return "bg-green-500";
    if (value >= 60) return "bg-blue-500";
    if (value >= 30) return "bg-yellow-500";
    return "bg-gray-400";
  };

  const getLabel = () => {
    if (value >= 80) return "Clear";
    if (value >= 60) return "Good";
    if (value >= 30) return "Forming";
    return "Exploring";
  };

  const getHeight = () => {
    switch (size) {
      case "sm":
        return "h-1.5";
      case "lg":
        return "h-3";
      default:
        return "h-2";
    }
  };

  return (
    <div className="confidence-meter">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-gray-600">Confidence</span>
          <span className="text-xs text-gray-500">{getLabel()}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className={`flex-1 bg-gray-200 rounded-full ${getHeight()}`}>
          <div
            className={`${getColor()} ${getHeight()} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 min-w-[2.5rem] text-right">
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}

export default ConfidenceMeter;
