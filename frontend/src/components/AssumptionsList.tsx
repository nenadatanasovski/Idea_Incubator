import { AlertTriangle, CheckCircle, Circle, HelpCircle } from "lucide-react";
import type { Assumption } from "../api/client";

interface AssumptionsListProps {
  assumptions: Assumption[];
  onValidate?: (id: string, validated: boolean, notes?: string) => void;
}

const riskColors: Record<string, { bg: string; text: string; border: string }> =
  {
    critical: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    },
    high: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-200",
    },
    medium: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
    },
    low: {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    },
  };

const categoryIcons: Record<string, typeof AlertTriangle> = {
  market: HelpCircle,
  technical: Circle,
  financial: Circle,
  operational: Circle,
};

function AssumptionItem({
  assumption,
  onValidate,
}: {
  assumption: Assumption;
  onValidate?: (validated: boolean, notes?: string) => void;
}) {
  const risk = riskColors[assumption.risk_level] || riskColors.medium;
  const Icon = categoryIcons[assumption.category] || HelpCircle;

  return (
    <div className={`p-3 rounded-lg border ${risk.border} ${risk.bg}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {assumption.validated ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <Icon className={`h-5 w-5 ${risk.text}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-gray-900">
              {assumption.assumption_text}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${risk.bg} ${risk.text} border ${risk.border}`}
              >
                {assumption.risk_level}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {assumption.category}
              </span>
            </div>
          </div>

          {assumption.validation_notes && (
            <p className="mt-2 text-xs text-gray-600 bg-white bg-opacity-50 rounded p-2">
              {assumption.validation_notes}
            </p>
          )}

          {onValidate && !assumption.validated && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => onValidate(true)}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                Mark as validated
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssumptionsList({
  assumptions,
  onValidate,
}: AssumptionsListProps) {
  if (assumptions.length === 0) {
    return (
      <div className="card text-center py-8 text-gray-500">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No assumptions identified yet</p>
        <p className="text-xs mt-1">
          Run gap analysis to identify untested assumptions
        </p>
      </div>
    );
  }

  const grouped = assumptions.reduce(
    (acc, assumption) => {
      const key = assumption.risk_level;
      if (!acc[key]) acc[key] = [];
      acc[key].push(assumption);
      return acc;
    },
    {} as Record<string, Assumption[]>,
  );

  const order = ["critical", "high", "medium", "low"];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Assumptions</h3>
        <span className="text-sm text-gray-500">
          {assumptions.filter((a) => a.validated).length}/{assumptions.length}{" "}
          validated
        </span>
      </div>

      <div className="space-y-4">
        {order.map((risk) => {
          const items = grouped[risk];
          if (!items || items.length === 0) return null;

          return (
            <div key={risk}>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {risk} Risk ({items.length})
              </h4>
              <div className="space-y-2">
                {items.map((assumption) => (
                  <AssumptionItem
                    key={assumption.id}
                    assumption={assumption}
                    onValidate={
                      onValidate
                        ? (validated, notes) =>
                            onValidate(assumption.id, validated, notes)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
