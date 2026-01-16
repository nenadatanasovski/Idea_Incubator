import React, { useState, useMemo } from "react";
import type { EnhancedStrategy, IdeaFinancialAllocation } from "../types";

interface Props {
  strategies: EnhancedStrategy[];
  allocation?: IdeaFinancialAllocation | null;
  selectedStrategyId: string | null;
  onSelectStrategy: (id: string) => void;
  recommendedStrategyId?: string | null;
}

type FilterType =
  | "all"
  | "quick-win"
  | "best-fit"
  | "high-upside"
  | "lowest-risk";
type SortColumn =
  | "name"
  | "fitWithProfile"
  | "timeToValue"
  | "riskLevel"
  | "resourceNeed";

// Format currency for display
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
};

const getTimeToValueLabel = (strategy: EnhancedStrategy): string => {
  // Extract timeline from fiveWH.when
  if (strategy.fiveWH?.when) {
    // Parse common patterns like "MVP in 6-8 weeks" or "Month 1-2"
    const when = strategy.fiveWH.when;
    const weekMatch = when.match(/(\d+)(?:-(\d+))?\s*weeks?/i);
    const monthMatch = when.match(/(\d+)(?:-(\d+))?\s*months?/i);
    if (weekMatch) {
      return `${weekMatch[1]}${weekMatch[2] ? "-" + weekMatch[2] : ""} weeks`;
    }
    if (monthMatch) {
      return `${monthMatch[1]}${monthMatch[2] ? "-" + monthMatch[2] : ""} months`;
    }
    // Return first 30 chars if parsing fails
    return when.length > 30 ? when.slice(0, 30) + "..." : when;
  }
  if (strategy.revenueEstimates) {
    return "See details";
  }
  return "TBD";
};

const getRiskLevel = (
  strategy: EnhancedStrategy,
): "low" | "medium" | "high" => {
  // Calculate risk based on tradeoffs count and allocation feasibility
  const tradeoffCount = strategy.tradeoffs?.length || 0;
  if (tradeoffCount >= 3) return "high";
  if (tradeoffCount >= 1) return "medium";
  return "low";
};

const getResourceNeed = (
  strategy: EnhancedStrategy,
): "low" | "medium" | "high" => {
  // investmentRequired is an optional extension field
  const stratAny = strategy as any;
  if (stratAny.investmentRequired) {
    const upfront =
      stratAny.investmentRequired.upfront.mid ||
      (stratAny.investmentRequired.upfront.low +
        stratAny.investmentRequired.upfront.high) /
        2;
    if (upfront >= 50000) return "high";
    if (upfront >= 15000) return "medium";
    return "low";
  }
  return "medium";
};

const getOpportunityAlignment = (
  strategy: EnhancedStrategy,
): "high" | "medium" | "low" => {
  const count = strategy.addressesOpportunities?.length || 0;
  if (count >= 2) return "high";
  if (count >= 1) return "medium";
  return "low";
};

const getCellColor = (
  value: "high" | "medium" | "low",
  isRisk = false,
): string => {
  if (isRisk) {
    // For risk, low is good
    if (value === "low") return "bg-green-100 text-green-800";
    if (value === "medium") return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  }
  // For other metrics, high is good
  if (value === "high") return "bg-green-100 text-green-800";
  if (value === "medium") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
};

const getScoreColor = (score: number): string => {
  if (score >= 8) return "text-green-600";
  if (score >= 6) return "text-yellow-600";
  if (score >= 4) return "text-orange-600";
  return "text-red-600";
};

export default function StrategyComparisonMatrix({
  strategies,
  allocation,
  selectedStrategyId,
  onSelectStrategy,
  recommendedStrategyId,
}: Props) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("fitWithProfile");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(
    null,
  );

  const toggleExpand = (strategyId: string) => {
    setExpandedStrategyId(
      expandedStrategyId === strategyId ? null : strategyId,
    );
  };

  // Filter and sort strategies
  const processedStrategies = useMemo(() => {
    let result = [...strategies];

    // Apply filter
    switch (filter) {
      case "quick-win":
        result = result.filter((s) => {
          const risk = getRiskLevel(s);
          const resource = getResourceNeed(s);
          return risk !== "high" && resource !== "high";
        });
        break;
      case "best-fit":
        result = result.filter((s) => s.fitWithProfile >= 7);
        break;
      case "high-upside":
        result = result.filter((s) => {
          const opportunity = getOpportunityAlignment(s);
          return opportunity === "high";
        });
        break;
      case "lowest-risk":
        result = result.filter((s) => getRiskLevel(s) === "low");
        break;
    }

    // Apply sort
    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortColumn) {
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "fitWithProfile":
          aVal = a.fitWithProfile;
          bVal = b.fitWithProfile;
          break;
        case "riskLevel":
          const riskOrder = { low: 1, medium: 2, high: 3 };
          aVal = riskOrder[getRiskLevel(a)];
          bVal = riskOrder[getRiskLevel(b)];
          break;
        case "resourceNeed":
          const resourceOrder = { low: 1, medium: 2, high: 3 };
          aVal = resourceOrder[getResourceNeed(a)];
          bVal = resourceOrder[getResourceNeed(b)];
          break;
        default:
          aVal = a.fitWithProfile;
          bVal = b.fitWithProfile;
      }

      if (typeof aVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortOrder === "asc"
        ? aVal - (bVal as number)
        : (bVal as number) - aVal;
    });

    return result;
  }, [strategies, filter, sortColumn, sortOrder]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <span className="text-gray-300 ml-1">↕</span>;
    }
    return (
      <span className="text-blue-500 ml-1">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (strategies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No strategies available. Run the positioning analysis first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            "all",
            "quick-win",
            "best-fit",
            "high-upside",
            "lowest-risk",
          ] as FilterType[]
        ).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "all"
              ? "All Strategies"
              : f === "quick-win"
                ? "Quick Wins"
                : f === "best-fit"
                  ? "Best Fit"
                  : f === "high-upside"
                    ? "High Upside"
                    : "Lowest Risk"}
          </button>
        ))}
      </div>

      {/* No Results Message */}
      {processedStrategies.length === 0 && (
        <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
          No strategies match the selected filter. Try a different filter.
        </div>
      )}

      {/* Comparison Table */}
      {processedStrategies.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  Strategy
                  <SortIcon column="name" />
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("fitWithProfile")}
                >
                  Profile Fit
                  <SortIcon column="fitWithProfile" />
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Opportunity
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("riskLevel")}
                >
                  Risk Level
                  <SortIcon column="riskLevel" />
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Time to Value
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("resourceNeed")}
                >
                  Resources
                  <SortIcon column="resourceNeed" />
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedStrategies.map((strategy, _index) => {
                const strategyId = strategy.id || strategy.name;
                const isSelected = selectedStrategyId === strategyId;
                const isRecommended = recommendedStrategyId === strategyId;
                const isExpanded = expandedStrategyId === strategyId;
                const risk = getRiskLevel(strategy);
                const resource = getResourceNeed(strategy);
                const opportunity = getOpportunityAlignment(strategy);

                // Get revenue projections
                const year1Revenue = strategy.revenueEstimates?.year1;
                const meetsGoal = strategy.goalAlignment?.meetsIncomeTarget;

                return (
                  <React.Fragment key={strategyId}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors ${
                        isSelected ? "bg-blue-50" : ""
                      } ${isExpanded ? "bg-gray-50" : ""}`}
                    >
                      {/* Strategy Name */}
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          {/* Expand/Collapse Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(strategyId);
                            }}
                            className="mt-0.5 p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            <svg
                              className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          {isRecommended && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 flex-shrink-0 mt-0.5">
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              {strategy.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {strategy.description}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Profile Fit */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span
                          className={`text-lg font-bold ${getScoreColor(strategy.fitWithProfile)}`}
                        >
                          {strategy.fitWithProfile}/10
                        </span>
                      </td>

                      {/* Opportunity */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCellColor(opportunity)}`}
                        >
                          {opportunity}
                        </span>
                      </td>

                      {/* Risk Level */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCellColor(risk, true)}`}
                        >
                          {risk}
                        </span>
                      </td>

                      {/* Time to Value */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-600">
                          {getTimeToValueLabel(strategy)}
                        </span>
                      </td>

                      {/* Resources */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCellColor(resource, true)}`}
                        >
                          {"$".repeat(
                            resource === "low"
                              ? 1
                              : resource === "medium"
                                ? 2
                                : 3,
                          )}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectStrategy(strategyId);
                            }}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr key={`${strategyId}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="ml-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Revenue Projections */}
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                Revenue Projections
                              </h4>
                              {year1Revenue ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">
                                      Year 1 (Low)
                                    </span>
                                    <span className="text-sm font-medium text-gray-900">
                                      {formatCurrency(year1Revenue.low)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">
                                      Year 1 (Mid)
                                    </span>
                                    <span className="text-sm font-semibold text-blue-600">
                                      {formatCurrency(year1Revenue.mid)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">
                                      Year 1 (High)
                                    </span>
                                    <span className="text-sm font-medium text-gray-900">
                                      {formatCurrency(year1Revenue.high)}
                                    </span>
                                  </div>
                                  {strategy.revenueEstimates?.year3 && (
                                    <div className="pt-2 mt-2 border-t border-gray-100">
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">
                                          Year 3 (Mid)
                                        </span>
                                        <span className="text-sm font-medium text-green-600">
                                          {formatCurrency(
                                            strategy.revenueEstimates.year3.mid,
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">
                                  No revenue projections available
                                </p>
                              )}
                            </div>

                            {/* Goal Alignment */}
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                Goal Alignment
                              </h4>
                              {strategy.goalAlignment ? (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    {meetsGoal ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                        <svg
                                          className="w-3 h-3"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                        Meets Income Target
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                                        <svg
                                          className="w-3 h-3"
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                        Gap:{" "}
                                        {formatCurrency(
                                          strategy.goalAlignment.gapToTarget ||
                                            0,
                                        )}
                                      </span>
                                    )}
                                  </div>
                                  {allocation?.allocatedRunwayMonths &&
                                    strategy.goalAlignment.runwaySufficient !==
                                      undefined && (
                                      <div className="text-sm">
                                        <span className="text-gray-600">
                                          Runway:{" "}
                                        </span>
                                        <span
                                          className={
                                            strategy.goalAlignment
                                              .runwaySufficient
                                              ? "text-green-600"
                                              : "text-red-600"
                                          }
                                        >
                                          {strategy.goalAlignment
                                            .runwaySufficient
                                            ? "Sufficient"
                                            : "May need extension"}
                                        </span>
                                      </div>
                                    )}
                                  <div className="text-sm">
                                    <span className="text-gray-600">
                                      Investment:{" "}
                                    </span>
                                    <span
                                      className={
                                        strategy.goalAlignment
                                          .investmentFeasible
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }
                                    >
                                      {strategy.goalAlignment.investmentFeasible
                                        ? "Feasible"
                                        : "May exceed budget"}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">
                                  Goal alignment data not available
                                </p>
                              )}
                            </div>

                            {/* Key Actions */}
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                Key Differentiators
                              </h4>
                              {strategy.differentiators &&
                              strategy.differentiators.length > 0 ? (
                                <ul className="space-y-1.5">
                                  {strategy.differentiators
                                    .slice(0, 3)
                                    .map((diff, i) => (
                                      <li
                                        key={i}
                                        className="text-sm text-gray-700 flex items-start gap-2"
                                      >
                                        <span className="text-blue-500 mt-1">
                                          •
                                        </span>
                                        <span className="line-clamp-2">
                                          {diff}
                                        </span>
                                      </li>
                                    ))}
                                  {strategy.differentiators.length > 3 && (
                                    <li className="text-xs text-gray-400">
                                      +{strategy.differentiators.length - 3}{" "}
                                      more
                                    </li>
                                  )}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-500">
                                  No differentiators listed
                                </p>
                              )}
                            </div>
                          </div>

                          {/* View Full Details Button */}
                          <div className="ml-8 mt-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectStrategy(strategyId);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            >
                              View Full Details
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-100" />
          <span>Good / Low risk</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-100" />
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-100" />
          <span>Challenging / High risk</span>
        </div>
        {recommendedStrategyId && (
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-600">
              <svg
                className="w-2.5 h-2.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <span>Recommended</span>
          </div>
        )}
      </div>
    </div>
  );
}
