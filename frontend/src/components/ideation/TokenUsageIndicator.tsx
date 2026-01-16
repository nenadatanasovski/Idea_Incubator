// =============================================================================
// FILE: frontend/src/components/ideation/TokenUsageIndicator.tsx
// Token usage progress indicator
// =============================================================================

import "react";
import { AlertTriangle } from "lucide-react";
import type { TokenUsageIndicatorProps } from "../../types/ideation";

export function TokenUsageIndicator({ usage }: TokenUsageIndicatorProps) {
  const { percentUsed, shouldHandoff } = usage;

  const getColor = () => {
    if (percentUsed >= 80) return "bg-red-500";
    if (percentUsed >= 60) return "bg-orange-500";
    if (percentUsed >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getTextColor = () => {
    if (percentUsed >= 80) return "text-red-600";
    if (percentUsed >= 60) return "text-orange-600";
    return "text-gray-600";
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 whitespace-nowrap">Context</span>

      <div className="flex-1 relative">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`${getColor()} h-2 rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>

        {/* Handoff threshold marker at 80% */}
        <div
          className="absolute top-0 w-0.5 h-2 bg-orange-400"
          style={{ left: "80%" }}
          title="Handoff threshold"
        />
      </div>

      <div className="flex items-center gap-1">
        {shouldHandoff && <AlertTriangle className="w-3 h-3 text-orange-500" />}
        <span
          className={`text-xs font-medium ${getTextColor()}`}
          data-testid="token-usage-display"
        >
          {Math.round(percentUsed)}%
        </span>
        <span className="text-xs text-gray-400 ml-1" data-testid="token-count">
          ({usage.total.toLocaleString()} / {usage.limit.toLocaleString()})
        </span>
      </div>
    </div>
  );
}

export default TokenUsageIndicator;
