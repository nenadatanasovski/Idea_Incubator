// =============================================================================
// FILE: frontend/src/components/ideation/RisksList.tsx
// List of viability risks
// =============================================================================

import { useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { RisksListProps, ViabilityRisk } from "../../types/ideation";

export function RisksList({ risks, maxDisplay = 3 }: RisksListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (risks.length === 0) return null;

  const visibleRisks = isExpanded ? risks : risks.slice(0, maxDisplay);
  const hasMore = risks.length > maxDisplay;
  const hiddenCount = risks.length - maxDisplay;

  return (
    <div className="risks-list">
      <h4 className="text-xs font-medium text-gray-700 mb-2">
        Identified Risks
      </h4>
      <div className="space-y-2">
        {visibleRisks.map((risk, index) => (
          <RiskItem key={risk.id || index} risk={risk} />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              Show {hiddenCount} more <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

function RiskItem({ risk }: { risk: ViabilityRisk }) {
  const getSeverityStyles = () => {
    switch (risk.severity) {
      case "critical":
        return "text-red-600 bg-red-50 border-red-200";
      case "high":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-gray-600 bg-gray-50 border-gray-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getRiskTypeLabel = () => {
    const typeLabels: Record<string, string> = {
      impossible: "impossible",
      unrealistic: "unrealistic",
      too_complex: "too complex",
      too_vague: "too vague",
      saturated_market: "saturated market",
      wrong_timing: "wrong timing",
      resource_mismatch: "resource mismatch",
    };
    return typeLabels[risk.riskType] || risk.riskType.replace(/_/g, " ");
  };

  return (
    <div className={`p-2 rounded border ${getSeverityStyles()}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium">{getRiskTypeLabel()}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${getSeverityStyles()}`}
            >
              {risk.severity}
            </span>
          </div>
          <p className="text-xs">{risk.description}</p>
          {risk.evidenceUrl && (
            <a
              href={risk.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
            >
              Source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default RisksList;
