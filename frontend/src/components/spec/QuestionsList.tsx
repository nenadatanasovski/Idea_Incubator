/**
 * QuestionsList.tsx
 * Component for displaying and answering spec clarification questions
 */

import { useState } from "react";
import { HelpCircle, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import type { SpecQuestion } from "../../hooks/useSpecSession";

interface QuestionsListProps {
  questions: SpecQuestion[];
  onAnswer: (questionId: string, answer: string) => Promise<boolean>;
  isLoading?: boolean;
}

export function QuestionsList({
  questions,
  onAnswer,
  isLoading = false,
}: QuestionsListProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (questionId: string) => {
    const answer = answers[questionId];
    if (!answer?.trim()) return;

    setSubmitting(questionId);
    setErrors((prev) => ({ ...prev, [questionId]: "" }));

    try {
      const success = await onAnswer(questionId, answer.trim());
      if (success) {
        // Clear answer after successful submission
        setAnswers((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
      } else {
        setErrors((prev) => ({
          ...prev,
          [questionId]: "Failed to submit answer",
        }));
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [questionId]:
          err instanceof Error ? err.message : "Failed to submit answer",
      }));
    } finally {
      setSubmitting(null);
    }
  };

  const getPriorityColor = (priority: SpecQuestion["priority"]) => {
    switch (priority) {
      case "blocking":
        return "text-red-500 bg-red-50";
      case "important":
        return "text-amber-500 bg-amber-50";
      case "optional":
        return "text-gray-500 bg-gray-50";
      default:
        return "text-gray-500 bg-gray-50";
    }
  };

  const getCategoryIcon = (category: SpecQuestion["category"]) => {
    switch (category) {
      case "feature":
        return "📦";
      case "technical":
        return "⚙️";
      case "scope":
        return "🎯";
      case "clarification":
        return "💬";
      default:
        return "❓";
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-green-600 py-4">
        <CheckCircle className="w-5 h-5" />
        <span className="text-sm font-medium">All questions answered!</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((question) => (
        <div
          key={question.id}
          className={clsx(
            "bg-white rounded-lg p-4 border transition-shadow",
            submitting === question.id && "opacity-70",
            errors[question.id] && "border-red-200",
          )}
        >
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />

            <div className="flex-1 min-w-0">
              {/* Question header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">
                  {getCategoryIcon(question.category)}
                </span>
                <span
                  className={clsx(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    getPriorityColor(question.priority),
                  )}
                >
                  {question.priority}
                </span>
              </div>

              {/* Question text */}
              <p className="font-medium text-gray-900">{question.question}</p>

              {/* Context if available */}
              {question.context && (
                <p className="text-sm text-gray-500 mt-1">{question.context}</p>
              )}

              {/* Answer input */}
              <div className="mt-3">
                <textarea
                  value={answers[question.id] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: e.target.value,
                    }))
                  }
                  placeholder="Your answer..."
                  className={clsx(
                    "w-full p-2 border rounded-md text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
                    errors[question.id] && "border-red-300",
                  )}
                  rows={2}
                  disabled={isLoading || submitting === question.id}
                />

                {/* Error message */}
                {errors[question.id] && (
                  <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    <span>{errors[question.id]}</span>
                  </div>
                )}

                <button
                  onClick={() => handleSubmit(question.id)}
                  disabled={
                    !answers[question.id]?.trim() ||
                    isLoading ||
                    submitting === question.id
                  }
                  className={clsx(
                    "mt-2 px-3 py-1.5 text-sm font-medium rounded-md transition",
                    "bg-primary-600 text-white hover:bg-primary-700",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center gap-2",
                  )}
                >
                  {submitting === question.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Answer"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default QuestionsList;
