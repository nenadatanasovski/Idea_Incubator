import { useState, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  List,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import QuestionCard from "./QuestionCard";
import ReadinessMeter from "./ReadinessMeter";
import type {
  Question,
  ReadinessScore,
  DevelopmentSession,
  Answer,
  QuestionCategory,
} from "../types";
import { categoryNames, priorityMeta } from "../types";

interface GroupedQuestion {
  id: string;
  text: string;
  criterion: string;
  category: string;
  priority: string;
  answered: boolean;
  answer?: string;
}

interface AllQuestionsData {
  grouped: Record<string, GroupedQuestion[]>;
  totalQuestions: number;
  answeredCount: number;
}

interface DevelopmentWizardProps {
  ideaSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onSessionComplete?: (session: DevelopmentSession) => void;
  onEvaluate?: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function DevelopmentWizard({
  ideaSlug,
  isOpen,
  onClose,
  onSessionComplete,
  onEvaluate,
}: DevelopmentWizardProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [session, setSession] = useState<DevelopmentSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Tab state: 'session' or 'all'
  const [activeTab, setActiveTab] = useState<"session" | "all">("session");
  const [allQuestionsData, setAllQuestionsData] =
    useState<AllQuestionsData | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["problem", "solution"]),
  );
  const [selectedQuestion, setSelectedQuestion] =
    useState<GroupedQuestion | null>(null);
  const [loadingAllQuestions, setLoadingAllQuestions] = useState(false);

  // Start session and load initial questions
  useEffect(() => {
    if (!isOpen) return;

    const startSession = async () => {
      setLoading(true);
      setError(null);

      try {
        // Start development session
        const sessionRes = await fetch(
          `${API_BASE}/api/ideas/${ideaSlug}/develop`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "start" }),
          },
        );

        if (!sessionRes.ok) throw new Error("Failed to start session");

        const sessionData = await sessionRes.json();
        if (sessionData.success) {
          setSession(sessionData.data.session);
          setQuestions(sessionData.data.questions);
        }

        // Load existing answers and readiness
        const [answersRes, readinessRes] = await Promise.all([
          fetch(`${API_BASE}/api/ideas/${ideaSlug}/answers`),
          fetch(`${API_BASE}/api/ideas/${ideaSlug}/questions`),
        ]);

        if (answersRes.ok) {
          const answersData = await answersRes.json();
          if (answersData.success) {
            const answerMap = new Map<string, string>();
            answersData.data.answers.forEach((a: Answer) => {
              answerMap.set(a.questionId, a.answer);
            });
            setAnswers(answerMap);
          }
        }

        if (readinessRes.ok) {
          const readinessData = await readinessRes.json();
          if (readinessData.success) {
            setReadiness(readinessData.data.readiness);
            setTotalAnswered(readinessData.data.answeredCount);
            setTotalQuestions(readinessData.data.totalQuestions);
          }
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    startSession();
  }, [isOpen, ideaSlug]);

  // Fetch all questions when "All Questions" tab is selected
  const fetchAllQuestions = async () => {
    if (allQuestionsData) return; // Already loaded

    setLoadingAllQuestions(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/ideas/${ideaSlug}/questions/all`,
      );
      if (!res.ok) throw new Error("Failed to load questions");

      const data = await res.json();
      if (data.success) {
        setAllQuestionsData(data.data);
      }
    } catch (err) {
      console.error("Failed to load all questions:", err);
    } finally {
      setLoadingAllQuestions(false);
    }
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Handle tab change
  const handleTabChange = (tab: "session" | "all") => {
    setActiveTab(tab);
    if (tab === "all") {
      fetchAllQuestions();
    }
    setSelectedQuestion(null);
  };

  // Handle selecting a question from the all questions view
  const handleSelectQuestion = (question: GroupedQuestion) => {
    setSelectedQuestion(question);
  };

  const handleAnswer = async (questionId: string, answer: string) => {
    // Clear any previous submission error
    setSubmitError(null);

    try {
      const res = await fetch(`${API_BASE}/api/ideas/${ideaSlug}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`Failed to save answer: ${res.status} ${errorText}`);
      }

      const data = await res.json();
      if (data.success) {
        // Update local state with the new answer
        const newAnswers = new Map(answers).set(questionId, answer);
        setAnswers(newAnswers);
        setReadiness(data.data.readiness);
        setTotalAnswered((prev) => prev + 1);

        // Update allQuestionsData if loaded
        if (allQuestionsData) {
          setAllQuestionsData((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              answeredCount: prev.answeredCount + 1,
              grouped: { ...prev.grouped },
            };
            // Update the specific question's answered status
            for (const cat of Object.keys(updated.grouped)) {
              updated.grouped[cat] = updated.grouped[cat].map((q) =>
                q.id === questionId ? { ...q, answered: true, answer } : q,
              );
            }
            return updated;
          });
        }

        // Clear selected question in all-questions view
        if (selectedQuestion?.id === questionId) {
          setSelectedQuestion(null);
        }

        // Build updated questions list
        let updatedQuestions = questions;
        if (data.data.nextQuestions?.length > 0) {
          const existingIds = new Set(questions.map((q) => q.id));
          const newQuestions = data.data.nextQuestions.filter(
            (q: Question) => !existingIds.has(q.id),
          );
          updatedQuestions = [...questions, ...newQuestions];
          setQuestions(updatedQuestions);
        }

        // Auto-advance to next unanswered question using updated state (only in session view)
        if (activeTab === "session") {
          const nextUnanswered = updatedQuestions.findIndex(
            (q, i) => i > currentIndex && !newAnswers.has(q.id),
          );
          if (nextUnanswered !== -1) {
            setCurrentIndex(nextUnanswered);
          } else if (currentIndex < updatedQuestions.length - 1) {
            setCurrentIndex(currentIndex + 1);
          }
        }
      } else {
        throw new Error(data.error || "Failed to save answer");
      }
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setSubmitError(
        (err as Error).message || "Failed to save answer. Please try again.",
      );
      // Don't throw - let the UI handle the error display
    }
  };

  const handleSkip = (_questionId: string) => {
    // Move to next question
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Load more questions using smart selection
  const loadMoreQuestions = async () => {
    try {
      setLoading(true);

      // First try with normal dependency checking
      let res = await fetch(
        `${API_BASE}/api/ideas/${ideaSlug}/questions/smart?limit=10`,
      );
      if (!res.ok) throw new Error("Failed to load questions");

      let data = await res.json();

      // If no questions found, try again with skipDependencies
      if (!data.data || data.data.length === 0) {
        res = await fetch(
          `${API_BASE}/api/ideas/${ideaSlug}/questions/smart?limit=10&skipDependencies=true`,
        );
        if (!res.ok) throw new Error("Failed to load questions");
        data = await res.json();
      }

      if (data.success && data.data?.length > 0) {
        // Filter out already loaded questions and already answered questions
        const existingIds = new Set(questions.map((q) => q.id));
        const newQuestions = data.data.filter(
          (q: Question) => !existingIds.has(q.id) && !answers.has(q.id),
        );

        if (newQuestions.length > 0) {
          setQuestions((prev) => [...prev, ...newQuestions]);
          // Move to first new question
          setCurrentIndex(questions.length);
        }
      }
    } catch (err) {
      console.error("Failed to load more questions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!session) return;

    try {
      const res = await fetch(`${API_BASE}/api/ideas/${ideaSlug}/develop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "complete", sessionId: session.id }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && onSessionComplete) {
          onSessionComplete(data.data.session);
        }
      }
    } catch (err) {
      console.error("Failed to complete session:", err);
    }

    onClose();
  };

  if (!isOpen) return null;

  const currentQuestion = questions[currentIndex];
  const answeredInSession = Array.from(answers.keys()).filter((id) =>
    questions.some((q) => q.id === id),
  ).length;
  const progressPercent =
    questions.length > 0 ? (answeredInSession / questions.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Develop Your Idea
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Answer questions to improve evaluation confidence
              </p>
            </div>
            <button
              onClick={handleComplete}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => handleTabChange("session")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "session"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Smart Session
              <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                {questions.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange("all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <List className="h-4 w-4" />
              All Questions
              <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                {totalQuestions}
              </span>
            </button>
          </div>
        </div>

        {/* Progress Bar - Conditional */}
        {activeTab === "session" && (
          <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Session Progress</span>
              <span>
                {answeredInSession} of {questions.length} questions answered
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        {activeTab === "all" && (
          <div className="px-6 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Overall Progress</span>
              <span>
                {totalAnswered} of {totalQuestions} questions answered
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{
                  width: `${totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Session Tab Content */}
            {activeTab === "session" && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  </div>
                ) : error ? (
                  <div className="text-center text-red-500 py-8">
                    <p>{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="btn btn-secondary mt-4"
                    >
                      Retry
                    </button>
                  </div>
                ) : currentQuestion ? (
                  <div>
                    {/* Category Header */}
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">
                        {
                          categoryNames[
                            currentQuestion.category as QuestionCategory
                          ]
                        }
                      </span>
                      <span className="text-sm text-gray-400">
                        Question {currentIndex + 1} of {questions.length}
                      </span>
                    </div>

                    {/* Question Card */}
                    <QuestionCard
                      key={currentQuestion.id}
                      question={currentQuestion}
                      onAnswer={handleAnswer}
                      onSkip={handleSkip}
                      existingAnswer={answers.get(currentQuestion.id)}
                      ideaSlug={ideaSlug}
                    />

                    {/* Submission Error Display */}
                    {submitError && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <span className="text-red-500 text-sm">⚠️</span>
                        <div className="flex-1">
                          <p className="text-sm text-red-700">{submitError}</p>
                          <button
                            onClick={() => setSubmitError(null)}
                            className="text-xs text-red-600 hover:text-red-800 underline mt-1"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-6">
                      <button
                        onClick={() =>
                          setCurrentIndex((prev) => Math.max(0, prev - 1))
                        }
                        disabled={currentIndex === 0}
                        className="btn btn-secondary disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          setCurrentIndex((prev) =>
                            Math.min(questions.length - 1, prev + 1),
                          )
                        }
                        disabled={currentIndex === questions.length - 1}
                        className="btn btn-secondary disabled:opacity-50"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </button>
                    </div>
                  </div>
                ) : totalAnswered < totalQuestions ? (
                  <div className="text-center py-8">
                    <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ChevronRight className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Session Questions Complete
                    </h3>
                    <p className="text-gray-500 mb-4">
                      You've answered all questions in this session, but there
                      are {totalQuestions - totalAnswered} more questions
                      available.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={loadMoreQuestions}
                        className="btn btn-primary"
                      >
                        Load More Questions
                      </button>
                      <button
                        onClick={() => handleTabChange("all")}
                        className="btn btn-secondary"
                      >
                        Browse All Questions
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      All Questions Answered!
                    </h3>
                    <p className="text-gray-500 mb-4">
                      You've answered all available questions. Your idea is
                      ready for evaluation.
                    </p>
                    <button
                      onClick={handleComplete}
                      className="btn btn-primary"
                    >
                      Complete Session
                    </button>
                  </div>
                )}
              </>
            )}

            {/* All Questions Tab Content */}
            {activeTab === "all" && (
              <>
                {loadingAllQuestions ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  </div>
                ) : selectedQuestion ? (
                  /* Show selected question for answering */
                  <div>
                    <button
                      onClick={() => setSelectedQuestion(null)}
                      className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back to all questions
                    </button>

                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">
                        {
                          categoryNames[
                            selectedQuestion.category as QuestionCategory
                          ]
                        }
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          selectedQuestion.priority === "critical"
                            ? "bg-red-100 text-red-700"
                            : selectedQuestion.priority === "important"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {priorityMeta[
                          selectedQuestion.priority as keyof typeof priorityMeta
                        ]?.label || selectedQuestion.priority}
                      </span>
                    </div>

                    <QuestionCard
                      key={selectedQuestion.id}
                      question={{
                        id: selectedQuestion.id,
                        text: selectedQuestion.text,
                        criterion: selectedQuestion.criterion,
                        category: selectedQuestion.category as QuestionCategory,
                        priority: selectedQuestion.priority as
                          | "critical"
                          | "important"
                          | "nice-to-have",
                        type: "factual",
                        idea_types: null,
                        lifecycle_stages: null,
                        depends_on: null,
                        follow_ups: null,
                      }}
                      onAnswer={handleAnswer}
                      onSkip={() => setSelectedQuestion(null)}
                      existingAnswer={selectedQuestion.answer}
                      ideaSlug={ideaSlug}
                    />

                    {submitError && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <span className="text-red-500 text-sm">⚠️</span>
                        <div className="flex-1">
                          <p className="text-sm text-red-700">{submitError}</p>
                          <button
                            onClick={() => setSubmitError(null)}
                            className="text-xs text-red-600 hover:text-red-800 underline mt-1"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : allQuestionsData ? (
                  /* Show all questions grouped by category */
                  <div className="space-y-4">
                    {Object.entries(categoryNames).map(([cat, name]) => {
                      const questions = allQuestionsData.grouped[cat] || [];
                      if (questions.length === 0) return null;

                      const answered = questions.filter(
                        (q) => q.answered,
                      ).length;
                      const isExpanded = expandedCategories.has(cat);

                      return (
                        <div
                          key={cat}
                          className="border border-gray-200 rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() => toggleCategory(cat)}
                            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-gray-900">
                                {name}
                              </span>
                              <span className="text-sm text-gray-500">
                                {answered} / {questions.length} answered
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all"
                                  style={{
                                    width: `${(answered / questions.length) * 100}%`,
                                  }}
                                />
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="divide-y divide-gray-100">
                              {questions.map((q) => (
                                <button
                                  key={q.id}
                                  onClick={() => handleSelectQuestion(q)}
                                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 transition-colors"
                                >
                                  <div
                                    className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      q.answered
                                        ? "bg-green-100 text-green-600"
                                        : "bg-gray-100 text-gray-400"
                                    }`}
                                  >
                                    {q.answered ? (
                                      <CheckCircle className="h-4 w-4" />
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-current" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={`text-sm ${q.answered ? "text-gray-500" : "text-gray-900"}`}
                                    >
                                      {q.text}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-gray-400">
                                        {q.criterion}
                                      </span>
                                      <span
                                        className={`text-xs px-1.5 py-0.5 rounded ${
                                          q.priority === "critical"
                                            ? "bg-red-50 text-red-600"
                                            : q.priority === "important"
                                              ? "bg-amber-50 text-amber-600"
                                              : "bg-gray-50 text-gray-500"
                                        }`}
                                      >
                                        {priorityMeta[
                                          q.priority as keyof typeof priorityMeta
                                        ]?.label || q.priority}
                                      </span>
                                    </div>
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No questions available
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar - Readiness Meter */}
          <div className="w-80 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
            {readiness && (
              <ReadinessMeter readiness={readiness} showDetails={true} />
            )}

            {/* Quick Stats */}
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Overall Progress
              </h4>
              <div className="text-3xl font-bold text-gray-900">
                {totalAnswered} / {totalQuestions}
              </div>
              <p className="text-sm text-gray-500">questions answered total</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <p className="text-sm text-gray-500">
            Your answers are saved automatically
          </p>
          <div className="flex gap-3">
            <button onClick={handleComplete} className="btn btn-secondary">
              Save & Close
            </button>
            {readiness?.readyForEvaluation && onEvaluate && (
              <button
                onClick={() => {
                  handleComplete();
                  onEvaluate();
                }}
                className="btn btn-primary"
              >
                Proceed to Evaluation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
