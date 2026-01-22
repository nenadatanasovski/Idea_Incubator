/**
 * SpecGenerationModal Component
 * Modal for validating graph completeness before generating app specs
 */

import { useState, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface CheckResult {
  passed: boolean;
  message: string;
  affectedBlocks?: string[];
}

interface MissingPiece {
  type: "required" | "recommended";
  category: "problem" | "solution" | "market" | "assumption" | "evidence";
  description: string;
  suggestion: string;
}

interface SuggestedQuestion {
  question: string;
  targetGraphType: string;
  targetBlockType: string;
  prefillContent?: string;
}

interface GraphValidationResult {
  canGenerate: boolean;
  overallScore: number;
  checks: {
    hasProblemBlocks: CheckResult;
    hasSolutionBlocks: CheckResult;
    problemSolutionLinked: CheckResult;
    noBlockingCycles: CheckResult;
    hasMarketBlocks: CheckResult;
    hasValidatedAssumptions: CheckResult;
    criticalAssumptionsAddressed: CheckResult;
    hasEvidenceChains: CheckResult;
  };
  missingPieces: MissingPiece[];
  suggestedQuestions: SuggestedQuestion[];
}

interface QuestionAnswer {
  questionIndex: number;
  answer: string;
}

export interface SpecGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  validation: GraphValidationResult | null;
  isLoading?: boolean;
  onQuestionsAnswered: (answers: QuestionAnswer[]) => Promise<void>;
  onSkipAndGenerate: () => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SpecGenerationModal({
  isOpen,
  onClose,
  sessionId: _sessionId,
  validation,
  isLoading = false,
  onQuestionsAnswered,
  onSkipAndGenerate,
}: SpecGenerationModalProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAnswerChange = useCallback(
    (questionIndex: number, value: string) => {
      setAnswers((prev) => ({ ...prev, [questionIndex]: value }));
    },
    [],
  );

  const handleSubmitAnswers = useCallback(async () => {
    if (!validation) return;

    setIsSubmitting(true);
    try {
      const questionAnswers: QuestionAnswer[] = Object.entries(answers)
        .filter(([_, value]) => value.trim().length > 0)
        .map(([index, answer]) => ({
          questionIndex: parseInt(index, 10),
          answer,
        }));

      await onQuestionsAnswered(questionAnswers);
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, validation, onQuestionsAnswered]);

  const handleSkip = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onSkipAndGenerate();
    } finally {
      setIsSubmitting(false);
    }
  }, [onSkipAndGenerate]);

  if (!isOpen) return null;

  const requiredMissing =
    validation?.missingPieces.filter((p) => p.type === "required") || [];
  const recommendedMissing =
    validation?.missingPieces.filter((p) => p.type === "recommended") || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              📋 Generate App Spec
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Validating graph completeness...
              </span>
            </div>
          ) : validation ? (
            <>
              {/* Status message */}
              {!validation.canGenerate ? (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                  <span className="text-yellow-500 text-xl">⚠️</span>
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      Cannot generate spec yet
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Please address the missing pieces below or skip to
                      generate with warnings.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <span className="text-green-500 text-xl">✅</span>
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Ready to generate spec
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      All required checks passed. You can generate the app spec
                      now.
                    </p>
                  </div>
                </div>
              )}

              {/* Required missing pieces */}
              {requiredMissing.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Required
                  </h3>
                  {requiredMissing.map((piece, index) => (
                    <div
                      key={index}
                      className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-red-500">❌</span>
                        <div className="flex-1">
                          <p className="font-medium text-red-800 dark:text-red-200">
                            {piece.description}
                          </p>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            → {piece.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommended missing pieces */}
              {recommendedMissing.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Recommended
                  </h3>
                  {recommendedMissing.map((piece, index) => (
                    <div
                      key={index}
                      className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-500">⚠️</span>
                        <div className="flex-1">
                          <p className="font-medium text-yellow-800 dark:text-yellow-200">
                            {piece.description}
                          </p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            → {piece.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested questions */}
              {validation.suggestedQuestions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Answer These Questions
                  </h3>
                  {validation.suggestedQuestions.map((q, index) => (
                    <div key={index} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {q.question}
                      </label>
                      <textarea
                        value={answers[index] || ""}
                        onChange={(e) =>
                          handleAnswerChange(index, e.target.value)
                        }
                        placeholder={q.prefillContent || "Type your answer..."}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2 text-xs text-gray-500">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                          {q.targetGraphType}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                          {q.targetBlockType}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completeness score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Completeness Score
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {validation.overallScore}/100
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      validation.overallScore >= 75
                        ? "bg-green-500"
                        : validation.overallScore >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${validation.overallScore}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No validation data available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          {validation && !validation.canGenerate && (
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/50 hover:bg-yellow-200 dark:hover:bg-yellow-900 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Skip & Generate Anyway
            </button>
          )}
          {validation?.suggestedQuestions.length ? (
            <button
              onClick={handleSubmitAnswers}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              disabled={isSubmitting || Object.keys(answers).length === 0}
            >
              {isSubmitting ? "Submitting..." : "Answer All Questions"}
            </button>
          ) : validation?.canGenerate ? (
            <button
              onClick={handleSkip}
              className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Generating..." : "Generate Spec"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default SpecGenerationModal;
