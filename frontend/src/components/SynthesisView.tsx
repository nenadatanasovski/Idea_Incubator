import { useState } from "react";
import type { Synthesis } from "../types";
import { scoreInterpretation } from "../types";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Lock,
  Pause,
  Play,
  XOctagon,
  RefreshCw,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  GitBranch,
  Trash2,
} from "lucide-react";
import clsx from "clsx";

export type EvaluationDecision =
  | "pursue"
  | "iterate"
  | "branch"
  | "pause"
  | "abandon";

interface WeakCriterion {
  criterion: string;
  category: string;
  previousScore?: number;
  finalScore: number;
  reasoning: string;
  debateChallenges?: string[];
}

interface SynthesisViewProps {
  synthesis: Synthesis | null;
  weakCriteria?: WeakCriterion[];
  previousScore?: number;
  recommendation?: EvaluationDecision;
  onDecision?: (decision: EvaluationDecision, reason?: string) => void;
}

const recommendationInfo = {
  PURSUE: {
    icon: Play,
    label: "Pursue",
    description:
      "This idea shows strong potential and should be actively developed",
    color: "bg-green-500",
    textColor: "text-green-700",
    bgColor: "bg-green-50",
  },
  REFINE: {
    icon: RefreshCw,
    label: "Refine",
    description: "This idea has potential but needs further development",
    color: "bg-yellow-500",
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-50",
  },
  PAUSE: {
    icon: Pause,
    label: "Pause",
    description: "This idea should be put on hold for now",
    color: "bg-orange-500",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50",
  },
  ABANDON: {
    icon: XOctagon,
    label: "Abandon",
    description: "This idea is not viable and should be discontinued",
    color: "bg-red-500",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
  },
};

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

export default function SynthesisView({
  synthesis,
  weakCriteria,
  previousScore: _previousScore,
  recommendation,
  onDecision,
}: SynthesisViewProps) {
  const [showStrengthsWeaknesses, setShowStrengthsWeaknesses] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  if (!synthesis) {
    return (
      <div className="card text-center py-8">
        <HelpCircle className="h-10 w-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No synthesis available</p>
        <p className="text-xs text-gray-400 mt-1">
          Complete an evaluation to generate a synthesis
        </p>
      </div>
    );
  }

  const recInfo = recommendationInfo[synthesis.recommendation];
  const RecIcon = recInfo.icon;
  const isPreliminary = synthesis.is_preliminary;

  return (
    <div className="space-y-6">
      {/* Preliminary Analysis Banner */}
      {isPreliminary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900">
                Preliminary Synthesis
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                This synthesis is auto-generated based on your idea's readiness
                and development answers. Run a full evaluation for comprehensive
                AI-powered analysis with debate and red team challenges.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Recommendation */}
      <div
        className={clsx(
          "card border-2",
          `border-${recInfo.color.replace("bg-", "")}`,
        )}
      >
        <div className="flex items-start gap-4">
          <div className={clsx("p-3 rounded-lg", recInfo.bgColor)}>
            <RecIcon className={clsx("h-8 w-8", recInfo.textColor)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {recInfo.label}
              </h2>
              {synthesis.locked && (
                <span className="badge bg-gray-100 text-gray-600 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Locked
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">{recInfo.description}</p>
          </div>
          <div className="text-right">
            <div
              className={`text-4xl font-bold ${scoreInterpretation.getColor(
                synthesis.overall_score ?? 0,
              )}`}
            >
              {(synthesis.overall_score ?? 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-500">
              {Math.round((synthesis.confidence ?? 0) * 100)}% confidence
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Executive Summary</h3>
        <p className="text-gray-700 leading-relaxed">
          {/* Replace stale overall score in the text with the actual current score */}
          {synthesis.executive_summary?.replace(
            /overall score of \d+\.\d+\/10/gi,
            `overall score of ${(synthesis.overall_score ?? 0).toFixed(2)}/10`,
          )}
        </p>
      </div>

      {/* Strengths and Weaknesses - Collapsible */}
      <div className="card p-0 overflow-hidden">
        <button
          onClick={() => setShowStrengthsWeaknesses(!showStrengthsWeaknesses)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <span className="font-semibold text-gray-900">
              Strengths & Weaknesses
            </span>
            <span className="text-sm text-gray-500">
              {synthesis.key_strengths.length} strengths •{" "}
              {synthesis.key_weaknesses.length} weaknesses
            </span>
          </div>
          {showStrengthsWeaknesses ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showStrengthsWeaknesses && (
          <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Key Strengths */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <h4 className="font-medium text-green-800">Strengths</h4>
              </div>
              <ul className="space-y-2">
                {synthesis.key_strengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Key Weaknesses */}
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-4 w-4 text-red-500" />
                <h4 className="font-medium text-red-800">Weaknesses</h4>
              </div>
              <ul className="space-y-2">
                {synthesis.key_weaknesses.map((weakness, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-3 w-3 text-red-500 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Critical Assumptions - Collapsible */}
      {synthesis.critical_assumptions.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <button
            onClick={() => setShowAssumptions(!showAssumptions)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-gray-900">
                Critical Assumptions
              </span>
              <span className="text-sm text-gray-500">
                {synthesis.critical_assumptions.length} items
              </span>
            </div>
            {showAssumptions ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showAssumptions && (
            <div className="px-4 pb-4">
              <ul className="space-y-2">
                {synthesis.critical_assumptions.map((assumption, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{assumption}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Unresolved Questions - Collapsible */}
      {synthesis.unresolved_questions.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <button
            onClick={() => setShowQuestions(!showQuestions)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-gray-900">
                Unresolved Questions
              </span>
              <span className="text-sm text-gray-500">
                {synthesis.unresolved_questions.length} items
              </span>
            </div>
            {showQuestions ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showQuestions && (
            <div className="px-4 pb-4">
              <ul className="space-y-2">
                {synthesis.unresolved_questions.map((question, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <HelpCircle className="h-3 w-3 text-blue-500 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Key Weaknesses - only shown when decision options are available */}
      {onDecision && weakCriteria && weakCriteria.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Key Weaknesses
          </h4>
          <div className="space-y-2">
            {weakCriteria.slice(0, 5).map((criterion, idx) => {
              const hasDebateForCriterion =
                criterion.debateChallenges &&
                criterion.debateChallenges.length > 0;
              const hasPreviousScore = criterion.previousScore !== undefined;
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
                      <span className="text-red-600 font-semibold">
                        {criterion.finalScore.toFixed(1)}
                      </span>
                      {hasPreviousScore &&
                        Math.abs(
                          criterion.finalScore - criterion.previousScore!,
                        ) >= 0.5 && (
                          <span className="text-xs text-gray-400">
                            (prev: {criterion.previousScore!.toFixed(1)})
                          </span>
                        )}
                      <span className="text-gray-400">/10</span>
                    </div>
                  </div>
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

      {/* Decision Options */}
      {onDecision && (
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
      )}
    </div>
  );
}
