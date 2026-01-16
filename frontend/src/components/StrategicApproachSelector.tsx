import { useState, useMemo } from "react";
import type {
  StrategicApproach,
  IdeaFinancialAllocation,
  UserProfileSummary,
} from "../types";
import { strategicApproachMeta } from "../types";
import { saveFinancialAllocation } from "../api/client";

interface Props {
  slug: string;
  allocation: IdeaFinancialAllocation | null;
  profile?: UserProfileSummary | null;
  onApproachSelected?: (approach: StrategicApproach) => void;
  onNext?: () => void;
  onBack?: () => void;
}

interface ApproachRecommendation {
  approach: StrategicApproach;
  score: number;
  reasons: string[];
  concerns: string[];
}

export default function StrategicApproachSelector({
  slug,
  allocation,
  profile,
  onApproachSelected,
  onNext,
  onBack,
}: Props) {
  const [selectedApproach, setSelectedApproach] =
    useState<StrategicApproach | null>(allocation?.strategicApproach ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<StrategicApproach | null>(
    null,
  );

  // Calculate approach recommendations based on profile and allocation
  const recommendations = useMemo((): ApproachRecommendation[] => {
    const results: ApproachRecommendation[] = [];
    const approaches: StrategicApproach[] = [
      "create",
      "copy_improve",
      "combine",
      "localize",
      "specialize",
      "time",
    ];

    for (const approach of approaches) {
      let score = 50; // Base score
      const reasons: string[] = [];
      const concerns: string[] = [];

      // Analyze based on allocation
      if (allocation) {
        // Runway analysis
        const runway = allocation.allocatedRunwayMonths || 0;
        if (approach === "create") {
          if (runway >= 18) {
            score += 15;
            reasons.push(
              "Your 18+ month runway supports long development cycles",
            );
          } else if (runway < 12) {
            score -= 20;
            concerns.push("Short runway may not support new category creation");
          }
        } else if (approach === "copy_improve" || approach === "localize") {
          if (runway <= 8) {
            score += 10;
            reasons.push("Faster time-to-revenue fits your runway");
          }
        }

        // Income type analysis
        if (allocation.incomeType === "full_replacement") {
          if (
            approach === "copy_improve" ||
            approach === "localize" ||
            approach === "specialize"
          ) {
            score += 15;
            reasons.push("Proven models provide more predictable income");
          } else if (approach === "create") {
            score -= 10;
            concerns.push(
              "New category creation has unpredictable income timeline",
            );
          }
        } else if (
          allocation.incomeType === "wealth_building" &&
          allocation.exitIntent
        ) {
          if (approach === "create") {
            score += 20;
            reasons.push("Novel solutions have higher exit multiples");
          }
        }

        // Risk tolerance analysis
        const risk = allocation.ideaRiskTolerance || profile?.risk_tolerance;
        if (risk === "high" || risk === "very_high") {
          if (approach === "create" || approach === "time") {
            score += 10;
            reasons.push("Your high risk tolerance allows for bolder bets");
          }
        } else if (risk === "low") {
          if (approach === "copy_improve" || approach === "localize") {
            score += 15;
            reasons.push(
              "Lower risk approaches match your conservative preference",
            );
          } else if (approach === "create") {
            score -= 15;
            concerns.push("High-risk approach may not match your preferences");
          }
        }

        // Budget analysis
        const budget = allocation.allocatedBudget || 0;
        if (budget < 10000) {
          if (approach === "create") {
            score -= 10;
            concerns.push("Limited budget may constrain category creation");
          } else if (approach === "specialize" || approach === "localize") {
            score += 10;
            reasons.push("Can be executed with modest budget");
          }
        }

        // Target income analysis
        const targetIncome = allocation.targetIncomeFromIdea || 0;
        if (targetIncome > 100000) {
          if (approach === "specialize") {
            score += 5;
            reasons.push("Niche expertise commands premium pricing");
          }
        }
      }

      // Profile-based analysis
      if (profile) {
        // Parse primary goals
        let goals: string[] = [];
        try {
          goals = JSON.parse(profile.primary_goals || "[]");
        } catch {
          goals = [];
        }

        if (goals.includes("income")) {
          if (approach === "copy_improve" || approach === "localize") {
            score += 10;
            reasons.push("Income goal favors proven revenue models");
          }
        }
        if (goals.includes("exit")) {
          if (approach === "create") {
            score += 15;
            reasons.push("Exit goal aligns with differentiated offerings");
          }
        }
        if (goals.includes("learning")) {
          if (approach === "create" || approach === "combine") {
            score += 5;
            reasons.push("Creative approaches maximize learning");
          }
        }

        // Domain expertise
        if (profile.domain_expertise) {
          if (approach === "specialize") {
            score += 15;
            reasons.push("Your domain expertise supports niche positioning");
          }
        }

        // Location for localize (use profile location if available)
        const profileAny = profile as any;
        if (profileAny.city || profileAny.country) {
          if (approach === "localize") {
            score += 10;
            reasons.push(
              `Your knowledge of ${profileAny.city || profileAny.country} is an advantage`,
            );
          }
        }
      }

      // Clamp score
      score = Math.max(0, Math.min(100, score));

      results.push({
        approach,
        score,
        reasons,
        concerns,
      });
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }, [allocation, profile]);

  const handleSelect = (approach: StrategicApproach) => {
    setSelectedApproach(approach);
    if (onApproachSelected) {
      onApproachSelected(approach);
    }
  };

  const handleContinue = async () => {
    if (!selectedApproach) {
      setError("Please select a strategic approach");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Save the approach to the allocation
      await saveFinancialAllocation(slug, {
        ...allocation,
        strategicApproach: selectedApproach,
      });

      if (onNext) {
        onNext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const getRiskBadgeColor = (level: "low" | "medium" | "high") => {
    switch (level) {
      case "low":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-red-100 text-red-800";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">
          Choose Your Strategic Approach
        </h3>
        <p className="text-gray-600 mt-1">
          Based on your goals and resources, select how you want to approach
          this market. The system will tailor its analysis accordingly.
        </p>
      </div>

      {/* Recommended Approach Highlight */}
      {recommendations.length > 0 && recommendations[0].score >= 60 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-800">
                Recommended:{" "}
                {strategicApproachMeta[recommendations[0].approach].label}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {recommendations[0].reasons[0]}
              </p>
            </div>
            <button
              onClick={() => handleSelect(recommendations[0].approach)}
              className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
            >
              Select
            </button>
          </div>
        </div>
      )}

      {/* Approach Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((rec) => {
          const meta = strategicApproachMeta[rec.approach];
          const isSelected = selectedApproach === rec.approach;

          return (
            <div
              key={rec.approach}
              className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
              onClick={() => handleSelect(rec.approach)}
            >
              {/* Match Score */}
              <div
                className={`absolute top-2 right-2 text-sm font-medium ${getScoreColor(
                  rec.score,
                )}`}
              >
                {rec.score}% match
              </div>

              {/* Header */}
              <div className="pr-16">
                <h4 className="font-semibold text-gray-900">{meta.label}</h4>
                <p className="text-sm text-gray-600 mt-1">{meta.description}</p>
              </div>

              {/* Badges */}
              <div className="flex gap-2 mt-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${getRiskBadgeColor(
                    meta.riskLevel,
                  )}`}
                >
                  {meta.riskLevel} risk
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  {meta.timeToRevenue}
                </span>
              </div>

              {/* Reasons/Concerns Preview */}
              {(rec.reasons.length > 0 || rec.concerns.length > 0) && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {rec.reasons.length > 0 && (
                    <p className="text-xs text-green-600 truncate">
                      + {rec.reasons[0]}
                    </p>
                  )}
                  {rec.concerns.length > 0 && (
                    <p className="text-xs text-amber-600 truncate">
                      ! {rec.concerns[0]}
                    </p>
                  )}
                </div>
              )}

              {/* Details Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetails(
                    showDetails === rec.approach ? null : rec.approach,
                  );
                }}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                {showDetails === rec.approach ? "Hide details" : "Show details"}
              </button>

              {/* Expanded Details */}
              {showDetails === rec.approach && (
                <div className="mt-3 pt-3 border-t border-gray-200 text-sm space-y-2">
                  <p className="text-gray-600">
                    <strong>Best for:</strong> {meta.bestFor}
                  </p>
                  {rec.reasons.length > 0 && (
                    <div>
                      <strong className="text-green-700">Strengths:</strong>
                      <ul className="mt-1 space-y-1">
                        {rec.reasons.map((r, i) => (
                          <li
                            key={i}
                            className="text-green-600 text-xs flex gap-1"
                          >
                            <span>+</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rec.concerns.length > 0 && (
                    <div>
                      <strong className="text-amber-700">Concerns:</strong>
                      <ul className="mt-1 space-y-1">
                        {rec.concerns.map((c, i) => (
                          <li
                            key={i}
                            className="text-amber-600 text-xs flex gap-1"
                          >
                            <span>!</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-2 left-2">
                  <svg
                    className="w-5 h-5 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Approach Summary */}
      {selectedApproach && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900">
            Selected: {strategicApproachMeta[selectedApproach].label}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            {strategicApproachMeta[selectedApproach].description}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            The analysis will focus on{" "}
            {selectedApproach === "create"
              ? "identifying market whitespace and category creation opportunities"
              : selectedApproach === "copy_improve"
                ? "analyzing successful models to copy and areas to improve"
                : selectedApproach === "combine"
                  ? "finding synergies between validated concepts"
                  : selectedApproach === "localize"
                    ? "adapting proven models to your local market"
                    : selectedApproach === "specialize"
                      ? "identifying niche opportunities within broader markets"
                      : "evaluating market timing and readiness indicators"}
            .
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving || !selectedApproach}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Continue to Analysis"}
        </button>
      </div>
    </div>
  );
}
