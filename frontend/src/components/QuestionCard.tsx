import { useState } from "react";
import {
  HelpCircle,
  AlertCircle,
  Lightbulb,
  Send,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { Question, QuestionPriority } from "../types";
import { priorityMeta, categoryNames } from "../types";

export interface Suggestion {
  id: string;
  suggestion: string;
  rationale: string;
  source: "profile" | "web_research" | "synthesis";
}

interface QuestionCardProps {
  question: Question;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
  onSkip?: (questionId: string) => void;
  existingAnswer?: string;
  disabled?: boolean;
  ideaSlug?: string;
  initialSuggestions?: Suggestion[]; // Pre-loaded suggestions from parent
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function PriorityBadge({ priority }: { priority: QuestionPriority }) {
  const meta = priorityMeta[priority];
  return (
    <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
  );
}

function QuestionTypeIcon({ type }: { type: Question["type"] }) {
  switch (type) {
    case "factual":
      return (
        <span title="Factual question">
          <HelpCircle className="h-4 w-4 text-blue-500" />
        </span>
      );
    case "analytical":
      return (
        <span title="Analytical question">
          <Lightbulb className="h-4 w-4 text-amber-500" />
        </span>
      );
    case "reflective":
      return (
        <span title="Reflective question">
          <AlertCircle className="h-4 w-4 text-purple-500" />
        </span>
      );
    default:
      return null;
  }
}

function SuggestionCard({
  suggestion,
  onSelect,
}: {
  suggestion: Suggestion;
  onSelect: (text: string) => void;
}) {
  const sourceColors = {
    profile: "bg-purple-100 text-purple-700",
    web_research: "bg-blue-100 text-blue-700",
    synthesis: "bg-green-100 text-green-700",
  };
  const sourceLabels = {
    profile: "From your profile",
    web_research: "From research",
    synthesis: "AI synthesis",
  };

  return (
    <button
      onClick={() => onSelect(suggestion.suggestion)}
      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm text-gray-900">{suggestion.suggestion}</p>
        <span
          className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${sourceColors[suggestion.source]}`}
        >
          {sourceLabels[suggestion.source]}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">{suggestion.rationale}</p>
    </button>
  );
}

export default function QuestionCard({
  question,
  onAnswer,
  onSkip,
  existingAnswer,
  disabled = false,
  ideaSlug,
  initialSuggestions,
  showAISuggestionsFirst = false, // For critical gaps, show AI suggestions more prominently
}: QuestionCardProps & { showAISuggestionsFirst?: boolean }) {
  const [answer, setAnswer] = useState(existingAnswer || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!existingAnswer);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(
    initialSuggestions || [],
  );
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  // Show suggestions if we have initialSuggestions or showAISuggestionsFirst is true
  const [showSuggestions, setShowSuggestions] = useState(
    showAISuggestionsFirst ||
      (initialSuggestions && initialSuggestions.length > 0),
  );
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [hasAttemptedAnswer, setHasAttemptedAnswer] = useState(false);

  const handleSubmit = async () => {
    if (!answer.trim() || isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      await onAnswer(question.id, answer.trim());
      setIsExpanded(false);
      setShowSuggestions(false);
      setSuggestions([]);
    } catch (error) {
      console.error("Failed to submit answer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleGetSuggestions = async () => {
    if (!ideaSlug) return;

    setIsLoadingSuggestions(true);
    setSuggestionError(null);
    setShowSuggestions(true);

    try {
      const res = await fetch(
        `${API_BASE}/api/ideas/${ideaSlug}/questions/${question.id}/suggestions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!res.ok) {
        throw new Error("Failed to get suggestions");
      }

      const data = await res.json();
      if (data.success && data.data.suggestions) {
        setSuggestions(data.data.suggestions);
      } else {
        throw new Error(data.error || "No suggestions returned");
      }
    } catch (err) {
      console.error("Failed to get suggestions:", err);
      setSuggestionError((err as Error).message);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = (text: string) => {
    setAnswer(text);
    setShowSuggestions(false);
  };

  return (
    <div
      className={`card ${existingAnswer ? "border-green-200 bg-green-50" : "border-gray-200"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <QuestionTypeIcon type={question.type} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {question.criterion}
              </span>
              <span className="text-xs text-gray-400">
                {categoryNames[question.category]}
              </span>
              <PriorityBadge priority={question.priority} />
            </div>
            <p className="font-medium text-gray-900">{question.text}</p>
          </div>
        </div>
        {existingAnswer && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
        )}
      </div>

      {/* Answer Section */}
      {isExpanded && (
        <div className="mt-4">
          {/* AI Suggestions Panel */}
          {showSuggestions && (
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">
                    AI Suggestions
                  </span>
                </div>
                <button
                  onClick={() => setShowSuggestions(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isLoadingSuggestions ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
                  <span className="ml-2 text-sm text-purple-600">
                    Generating suggestions...
                  </span>
                </div>
              ) : suggestionError ? (
                <div className="text-sm text-red-600 py-2">
                  {suggestionError}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">
                    Click a suggestion to use it as your answer:
                  </p>
                  {suggestions.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onSelect={handleSelectSuggestion}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-2">
                  No suggestions available
                </p>
              )}
            </div>
          )}

          {/* User Answer First - emphasize user input */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Answer
            </label>
            <textarea
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                if (e.target.value.length > 10) {
                  setHasAttemptedAnswer(true);
                }
              }}
              placeholder="Share your thoughts on this question..."
              rows={3}
              disabled={disabled || isSubmitting}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                Press Cmd+Enter to submit
              </span>
              {/* Show AI suggestions button - more prominent after user has attempted or for critical questions */}
              {ideaSlug && !showSuggestions && (
                <button
                  onClick={handleGetSuggestions}
                  disabled={disabled || isSubmitting || isLoadingSuggestions}
                  className={`inline-flex items-center gap-1 text-xs font-medium disabled:opacity-50 ${
                    hasAttemptedAnswer ||
                    question.priority === "critical" ||
                    showAISuggestionsFirst
                      ? "text-purple-600 hover:text-purple-700"
                      : "text-gray-400 hover:text-gray-500"
                  }`}
                  title={
                    !hasAttemptedAnswer && question.priority !== "critical"
                      ? "Try answering first, then get AI help if needed"
                      : undefined
                  }
                >
                  <Sparkles className="h-3 w-3" />
                  {hasAttemptedAnswer || question.priority === "critical"
                    ? "Get AI Suggestions"
                    : "Need help?"}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {onSkip && !existingAnswer && (
                <button
                  onClick={() => onSkip(question.id)}
                  disabled={disabled || isSubmitting}
                  className="btn btn-secondary text-sm"
                >
                  <X className="h-4 w-4 mr-1" />
                  Skip
                </button>
              )}
              {existingAnswer && (
                <button
                  onClick={() => setIsExpanded(false)}
                  disabled={isSubmitting}
                  className="btn btn-secondary text-sm"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!answer.trim() || disabled || isSubmitting}
                className="btn btn-primary text-sm"
              >
                <Send className="h-4 w-4 mr-1" />
                {isSubmitting
                  ? "Saving..."
                  : existingAnswer
                    ? "Update"
                    : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Answer Display */}
      {existingAnswer && !isExpanded && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <p className="text-sm text-green-800">{existingAnswer}</p>
        </div>
      )}
    </div>
  );
}
