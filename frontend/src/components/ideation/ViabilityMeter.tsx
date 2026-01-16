// =============================================================================
// FILE: frontend/src/components/ideation/ViabilityMeter.tsx
// Viability meter showing idea health
// =============================================================================

import "react";
import { AlertTriangle } from "lucide-react";
import type { ViabilityMeterProps } from "../../types/ideation";

export function ViabilityMeter({
  value,
  risks,
  showWarning,
  size = "md",
}: ViabilityMeterProps) {
  const getColor = () => {
    if (value >= 75) return "bg-green-500";
    if (value >= 50) return "bg-yellow-500";
    if (value >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  const getLabel = () => {
    if (value >= 75) return "Healthy";
    if (value >= 50) return "Caution";
    if (value >= 25) return "Warning";
    return "Critical";
  };

  const getTextColor = () => {
    if (value >= 75) return "text-green-600";
    if (value >= 50) return "text-yellow-600";
    if (value >= 25) return "text-orange-600";
    return "text-red-600";
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

  const riskCount = risks.length;

  return (
    <div className="viability-meter">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-600">Viability</span>
        <div className="flex items-center gap-1">
          {showWarning && value < 50 && (
            <AlertTriangle className="w-3 h-3 text-orange-500" />
          )}
          <span className={`text-xs ${getTextColor()}`}>{getLabel()}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 bg-gray-200 rounded-full ${getHeight()}`}>
          <div
            className={`${getColor()} ${getHeight()} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          />
        </div>
        <span
          className={`text-xs font-medium min-w-[2.5rem] text-right ${getTextColor()}`}
        >
          {Math.round(value)}%
        </span>
      </div>
      {riskCount > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {riskCount} {riskCount === 1 ? "risk" : "risks"} identified
        </p>
      )}
    </div>
  );
}

export default ViabilityMeter;
