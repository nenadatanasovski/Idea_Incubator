/**
 * FeatureList.tsx
 * Displays the list of features from the specification
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle, Zap } from "lucide-react";
import clsx from "clsx";
import type { Feature } from "../../hooks/useSpecSession";

interface FeatureListProps {
  features: Feature[];
}

export function FeatureList({ features }: FeatureListProps) {
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(
    new Set(),
  );

  const toggleExpanded = (featureId: string) => {
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      return next;
    });
  };

  // Group features by priority
  const featuresByPriority = features.reduce(
    (acc, feature) => {
      const priority = feature.priority;
      if (!acc[priority]) acc[priority] = [];
      acc[priority].push(feature);
      return acc;
    },
    {} as Record<Feature["priority"], Feature[]>,
  );

  const priorityOrder: Feature["priority"][] = [
    "must-have",
    "should-have",
    "nice-to-have",
  ];

  const priorityConfig = {
    "must-have": {
      label: "Must Have",
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    "should-have": {
      label: "Should Have",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    "nice-to-have": {
      label: "Nice to Have",
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    },
  };

  const complexityConfig = {
    low: { label: "Low", color: "text-green-600", bg: "bg-green-100" },
    medium: { label: "Medium", color: "text-amber-600", bg: "bg-amber-100" },
    high: { label: "High", color: "text-red-600", bg: "bg-red-100" },
  };

  if (features.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No features defined yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {priorityOrder.map((priority) => {
          const config = priorityConfig[priority];
          const count = featuresByPriority[priority]?.length || 0;
          return (
            <div
              key={priority}
              className={clsx(
                "rounded-lg p-3 border",
                config.bg,
                config.border,
              )}
            >
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className={clsx("text-sm font-medium", config.color)}>
                {config.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Groups */}
      {priorityOrder.map((priority) => {
        const priorityFeatures = featuresByPriority[priority];
        if (!priorityFeatures?.length) return null;

        const config = priorityConfig[priority];

        return (
          <div key={priority}>
            <h3 className={clsx("text-sm font-semibold mb-3", config.color)}>
              {config.label} ({priorityFeatures.length})
            </h3>
            <div className="space-y-2">
              {priorityFeatures.map((feature) => {
                const isExpanded = expandedFeatures.has(feature.id);
                const complexity =
                  complexityConfig[feature.estimatedComplexity];

                return (
                  <div
                    key={feature.id}
                    className="bg-white rounded-lg border overflow-hidden"
                  >
                    {/* Header */}
                    <button
                      onClick={() => toggleExpanded(feature.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {feature.name}
                          </span>
                          <span
                            className={clsx(
                              "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                              complexity.bg,
                              complexity.color,
                            )}
                          >
                            {complexity.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-0.5">
                          {feature.description}
                        </p>
                      </div>

                      <span className="text-xs text-gray-400 shrink-0">
                        {feature.acceptanceCriteria.length} criteria
                      </span>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-4 space-y-4">
                        {/* Full Description */}
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
                            Description
                          </h4>
                          <p className="text-sm text-gray-700">
                            {feature.description}
                          </p>
                        </div>

                        {/* Acceptance Criteria */}
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
                            Acceptance Criteria
                          </h4>
                          <ul className="space-y-2">
                            {feature.acceptanceCriteria.map(
                              (criterion, index) => (
                                <li
                                  key={index}
                                  className="flex items-start gap-2 text-sm text-gray-700"
                                >
                                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                  <span>{criterion}</span>
                                </li>
                              ),
                            )}
                          </ul>
                        </div>

                        {/* Technical Notes */}
                        {feature.technicalNotes && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">
                              Technical Notes
                            </h4>
                            <div className="flex items-start gap-2 p-2 bg-purple-50 rounded-md">
                              <Zap className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                              <p className="text-sm text-purple-700">
                                {feature.technicalNotes}
                              </p>
                            </div>
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
      })}
    </div>
  );
}

export default FeatureList;
