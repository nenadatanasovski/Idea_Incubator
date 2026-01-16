import {
  X,
  TrendingUp,
  TrendingDown,
  GitBranch,
  Pause,
  Trash2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import { scoreInterpretation } from "../types";

export type EvaluationDecision =
  | "pursue"
  | "iterate"
  | "branch"
  | "pause"
  | "abandon";

interface WeakCriterion {
  criterion: string;
  category: string;
  previousScore?: number; // From previous evaluation run
  finalScore: number;
  reasoning: string;
  debateChallenges?: string[];
}

interface EvaluationAdvisoryModalProps {
  isOpen: boolean;
  overallScore: number;
  confidence: number;
  previousScore?: number;
  weakCriteria: WeakCriterion[];
  recommendation: EvaluationDecision;
  recommendationReasoning: string;
  onDecision: (decision: EvaluationDecision, reason?: string) => void;
  onClose: () => void;
}

const decisionConfig: Record<
  EvaluationDecision,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
  }
> = {
  pursue: {
    label: "Pursue",
    description: "Move forward with implementation",
    icon: ArrowRight,
    color: "text-green-600",
    bgColor: "bg-green-50 hover:bg-green-100 border-green-200",
  },
  iterate: {
    label: "Iterate",
    description: "Address weaknesses and re-evaluate",
    icon: RefreshCw,
    color: "text-blue-600",
    bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200",
  },
  branch: {
    label: "Branch",
    description: "Try a different approach as a variant",
    icon: GitBranch,
    color: "text-purple-600",
    bgColor: "bg-purple-50 hover:bg-purple-100 border-purple-200",
  },
  pause: {
    label: "Pause",
    description: "Set aside for now and return later",
    icon: Pause,
    color: "text-amber-600",
    bgColor: "bg-amber-50 hover:bg-amber-100 border-amber-200",
  },
  abandon: {
    label: "Abandon",
    description: "This idea is not viable",
    icon: Trash2,
    color: "text-red-600",
    bgColor: "bg-red-50 hover:bg-red-100 border-red-200",
  },
};

export default function EvaluationAdvisoryModal({
  isOpen,
  overallScore,
  confidence,
  previousScore,
  weakCriteria,
  recommendation,
  recommendationReasoning,
  onDecision,
  onClose,
}: EvaluationAdvisoryModalProps) {
  if (!isOpen) return null;

  const scoreDelta =
    previousScore !== undefined ? overallScore - previousScore : null;
  const scoreLevel = scoreInterpretation.getLevel(overallScore);
  const scoreColor = scoreInterpretation.getColor(overallScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[126rem] mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Evaluation Complete
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Score display */}
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 flex-shrink-0">
              <span className={clsx("text-2xl font-bold", scoreColor)}>
                {overallScore.toFixed(2)}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {scoreLevel}
            </h3>
            <span className="text-sm text-gray-500">
              {Math.round(confidence * 100)}% confidence
            </span>
            {scoreDelta !== null && (
              <span
                className={clsx(
                  "flex items-center text-sm",
                  scoreDelta > 0
                    ? "text-green-600"
                    : scoreDelta < 0
                      ? "text-red-600"
                      : "text-gray-500",
                )}
              >
                {scoreDelta > 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : scoreDelta < 0 ? (
                  <TrendingDown className="h-4 w-4 mr-1" />
                ) : null}
                {scoreDelta > 0 ? "+" : ""}
                {scoreDelta.toFixed(1)} from previous
              </span>
            )}
          </div>

          {/* Key weaknesses */}
          {weakCriteria.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Key Weaknesses
              </h4>
              <div className="space-y-2">
                {weakCriteria.slice(0, 5).map((criterion, idx) => {
                  const hasDebateForCriterion =
                    criterion.debateChallenges &&
                    criterion.debateChallenges.length > 0;
                  const hasPreviousScore =
                    criterion.previousScore !== undefined;
                  const delta = hasPreviousScore
                    ? criterion.finalScore - criterion.previousScore!
                    : 0;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-red-50 rounded-lg border border-red-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-red-900 text-sm">
                          {criterion.criterion}
                        </span>
                        <div className="flex items-center gap-1 text-sm">
                          {/* Show current score as the primary score */}
                          <span className="text-red-600 font-semibold">
                            {criterion.finalScore.toFixed(1)}
                          </span>
                          {hasPreviousScore && Math.abs(delta) >= 0.5 && (
                            <span className="text-xs text-gray-400">
                              (prev: {criterion.previousScore!.toFixed(1)})
                            </span>
                          )}
                          <span className="text-gray-400">/10</span>
                        </div>
                      </div>
                      {/* Show debate challenges as context for the score */}
                      {hasDebateForCriterion ? (
                        <p className="text-sm text-red-700">
                          {criterion.debateChallenges![0]}
                        </p>
                      ) : (
                        <p className="text-sm text-red-700">
                          {criterion.reasoning}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-500">
                System Recommendation:
              </span>
              <span
                className={clsx(
                  "text-sm font-semibold px-2 py-0.5 rounded",
                  decisionConfig[recommendation].color,
                  decisionConfig[recommendation].bgColor.split(" ")[0],
                )}
              >
                {decisionConfig[recommendation].label}
              </span>
            </div>
            <p className="text-sm text-gray-700">{recommendationReasoning}</p>
          </div>

          {/* Decision options */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Choose your next step:
            </p>

            {Object.entries(decisionConfig).map(([key, config]) => {
              const Icon = config.icon;
              const isRecommended = key === recommendation;

              return (
                <button
                  key={key}
                  onClick={() => onDecision(key as EvaluationDecision)}
                  className={clsx(
                    "w-full px-4 py-3 rounded-lg border-2 transition-all text-left",
                    config.bgColor,
                    isRecommended && "ring-2 ring-primary-500 ring-offset-2",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={clsx("h-5 w-5 flex-shrink-0", config.color)}
                    />
                    <span className="font-medium text-gray-900">
                      {config.label}
                    </span>
                    {isRecommended && (
                      <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full">
                        Recommended
                      </span>
                    )}
                    <span className="text-sm text-gray-600">
                      — {config.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
