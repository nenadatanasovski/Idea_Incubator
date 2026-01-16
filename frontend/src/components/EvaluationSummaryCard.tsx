import {
  AlertTriangle,
  Play,
  RefreshCw,
  Pause,
  XOctagon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import { scoreInterpretation } from "../types";
import type { Synthesis } from "../types";
import {
  useEvaluations,
  useDebateRounds,
  usePreviousRunScores,
} from "../hooks/useEvaluations";

interface EvaluationSummaryCardProps {
  slug: string;
  runId?: string;
  synthesis: Synthesis | null;
}

interface WeakCriterion {
  criterion: string;
  category: string;
  previousScore?: number; // From previous evaluation run
  finalScore: number;
  reasoning: string;
  debateChallenges: string[];
}

const recommendationConfig: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
  }
> = {
  PURSUE: {
    label: "Pursue",
    icon: Play,
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  REFINE: {
    label: "Refine",
    icon: RefreshCw,
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  PAUSE: {
    label: "Pause",
    icon: Pause,
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  ABANDON: {
    label: "Abandon",
    icon: XOctagon,
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
};

export default function EvaluationSummaryCard({
  slug,
  runId,
  synthesis,
}: EvaluationSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { evaluations } = useEvaluations(slug, runId);
  const { rounds } = useDebateRounds(slug, runId);
  const { previousScores } = usePreviousRunScores(slug, runId);

  if (!synthesis) return null;

  // Build lookup map for previous scores by criterion (from previous evaluation run)
  const previousScoresByCriterion = new Map<string, number>();
  if (previousScores) {
    for (const cat of previousScores) {
      for (const criterion of cat.criteria) {
        previousScoresByCriterion.set(
          criterion.criterion,
          criterion.final_score,
        );
      }
    }
  }

  const scoreColor = scoreInterpretation.getColor(synthesis.overall_score);
  const scoreLevel = scoreInterpretation.getLevel(synthesis.overall_score);

  // Find weak criteria (final_score < 6 - weakness in current assessment)
  const weakCriteria: WeakCriterion[] = evaluations
    .filter((e) => e.final_score < 6)
    .sort((a, b) => a.final_score - b.final_score)
    .slice(0, 5)
    .map((e) => {
      // Get debate challenges that explain the weakness
      const criterionDebates = rounds.filter(
        (r) => r.criterion === e.criterion,
      );
      const debateChallenges = criterionDebates
        .filter(
          (r) =>
            r.arbiter_verdict === "RED_TEAM" || r.arbiter_verdict === "DRAW",
        )
        .map((r) => r.redteam_challenge)
        .filter((c): c is string => c !== null);
      return {
        criterion: e.criterion
          .replace(/_/g, " ")
          .replace(/^\w/, (c) => c.toUpperCase()),
        category: e.category,
        previousScore: previousScoresByCriterion.get(e.criterion), // From previous evaluation run
        finalScore: e.final_score,
        reasoning: e.reasoning,
        debateChallenges,
      };
    });

  const recConfig =
    recommendationConfig[synthesis.recommendation] ||
    recommendationConfig.REFINE;
  const RecIcon = recConfig.icon;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Compact Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          {/* Score and Recommendation */}
          <div className="flex items-center gap-4">
            {/* Score */}
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  synthesis.overall_score >= 7
                    ? "bg-green-100"
                    : synthesis.overall_score >= 5
                      ? "bg-yellow-100"
                      : "bg-red-100",
                )}
              >
                <span className={clsx("text-xl font-bold", scoreColor)}>
                  {synthesis.overall_score.toFixed(2)}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {scoreLevel}
                </p>
                <p className="text-xs text-gray-500">
                  {Math.round(synthesis.confidence * 100)}% confidence
                </p>
              </div>
            </div>

            {/* Recommendation Badge */}
            <div
              className={clsx(
                "px-3 py-1.5 rounded-full flex items-center gap-1.5",
                recConfig.bgColor,
              )}
            >
              <RecIcon className={clsx("h-4 w-4", recConfig.color)} />
              <span className={clsx("text-sm font-medium", recConfig.color)}>
                {recConfig.label}
              </span>
            </div>
          </div>

          {/* Weak criteria count */}
          {weakCriteria.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>
                {weakCriteria.length} weakness
                {weakCriteria.length !== 1 ? "es" : ""}
              </span>
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Weaknesses */}
      {expanded && weakCriteria.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Key Weaknesses
          </h4>
          <div className="space-y-2">
            {weakCriteria.map((criterion, idx) => {
              const hasDebateForCriterion =
                criterion.debateChallenges.length > 0;
              const hasPreviousScore = criterion.previousScore !== undefined;
              const delta = hasPreviousScore
                ? criterion.finalScore - criterion.previousScore!
                : 0;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2 bg-red-50 rounded-lg"
                >
                  {/* Show current score as the primary score */}
                  <span className="flex-shrink-0 w-8 h-6 flex items-center justify-center bg-red-100 rounded text-red-700 font-semibold text-sm">
                    {criterion.finalScore.toFixed(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-red-900">
                      {criterion.criterion}
                      <span className="text-red-600 font-normal ml-1">
                        ({criterion.category})
                      </span>
                      {hasPreviousScore && Math.abs(delta) >= 0.5 && (
                        <span className="ml-2 text-xs text-gray-500">
                          (prev: {criterion.previousScore!.toFixed(0)})
                        </span>
                      )}
                    </p>
                    {/* Show debate challenges as context for the score */}
                    {hasDebateForCriterion ? (
                      <p className="text-xs text-red-700 mt-0.5 line-clamp-2">
                        {criterion.debateChallenges[0].length > 150
                          ? criterion.debateChallenges[0].slice(0, 150) + "..."
                          : criterion.debateChallenges[0]}
                      </p>
                    ) : (
                      <p className="text-xs text-red-700 mt-0.5 line-clamp-2">
                        {criterion.reasoning}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Strengths Preview (if no weaknesses expanded) */}
      {!expanded &&
        synthesis.key_strengths &&
        synthesis.key_strengths.length > 0 && (
          <div className="px-4 pb-3 border-t border-gray-100 pt-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium">Strengths:</span>
              <span className="text-gray-700 truncate">
                {synthesis.key_strengths.slice(0, 2).join(" | ")}
              </span>
            </div>
          </div>
        )}
    </div>
  );
}
