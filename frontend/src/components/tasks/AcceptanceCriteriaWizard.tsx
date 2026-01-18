/**
 * AcceptanceCriteriaWizard Component
 *
 * AI-enhanced acceptance criteria generation wizard with 3 steps:
 * 1. Context Collection - Shows PRD requirement, adjacent tasks, task details
 * 2. AI Questions - Proactive questions with suggested answers
 * 3. Criteria Review - Edit/finalize generated criteria
 *
 * Part of: Task Agent Workflow Enhancement
 */

import { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  FileText,
  MessageSquare,
  ClipboardCheck,
  Plus,
  Trash2,
  Edit2,
  Save,
} from "lucide-react";

interface Question {
  id: string;
  question: string;
  suggestedAnswers: string[];
  selectedAnswer: string | null;
  customAnswer: string;
}

interface Criterion {
  id: string;
  text: string;
  scope: "codebase" | "api" | "ui" | "database" | "integration";
  isEditing: boolean;
}

interface ContextInfo {
  prdRequirement?: {
    ref: string;
    text: string;
  };
  adjacentTasks: Array<{
    id: string;
    displayId: string;
    title: string;
    status: string;
  }>;
  taskTitle: string;
  taskDescription: string;
}

interface AcceptanceCriteriaWizardProps {
  taskId: string;
  prdId?: string;
  requirementRef?: string;
  taskListId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (criteria: string[]) => void;
}

type WizardStep = "context" | "questions" | "review";

const SCOPE_OPTIONS: Array<{ value: Criterion["scope"]; label: string }> = [
  { value: "codebase", label: "Codebase" },
  { value: "api", label: "API" },
  { value: "ui", label: "UI" },
  { value: "database", label: "Database" },
  { value: "integration", label: "Integration" },
];

export default function AcceptanceCriteriaWizard({
  taskId,
  prdId,
  requirementRef,
  taskListId,
  isOpen,
  onClose,
  onSave,
}: AcceptanceCriteriaWizardProps) {
  const [step, setStep] = useState<WizardStep>("context");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Context step state
  const [context, setContext] = useState<ContextInfo | null>(null);
  const [additionalContext, setAdditionalContext] = useState("");

  // Questions step state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Review step state
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [newCriterionText, setNewCriterionText] = useState("");

  // Fetch context on mount
  useEffect(() => {
    if (isOpen) {
      fetchContext();
    }
  }, [isOpen, taskId]);

  const fetchContext = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch task details
      const taskResponse = await fetch(`/api/task-agent/tasks/${taskId}`);
      if (!taskResponse.ok) throw new Error("Failed to fetch task");
      const task = await taskResponse.json();

      // Fetch adjacent tasks if in a task list
      let adjacentTasks: ContextInfo["adjacentTasks"] = [];
      if (taskListId) {
        const listResponse = await fetch(
          `/api/pipeline/task-lists/${taskListId}/tasks`,
        );
        if (listResponse.ok) {
          const listData = await listResponse.json();
          adjacentTasks = (listData.tasks || [])
            .filter((t: { id: string }) => t.id !== taskId)
            .slice(0, 5)
            .map(
              (t: {
                id: string;
                display_id: string;
                title: string;
                status: string;
              }) => ({
                id: t.id,
                displayId: t.display_id,
                title: t.title,
                status: t.status,
              }),
            );
        }
      }

      // Fetch PRD requirement if provided
      let prdRequirement: ContextInfo["prdRequirement"];
      if (prdId && requirementRef) {
        const prdResponse = await fetch(`/api/prds/${prdId}`);
        if (prdResponse.ok) {
          const prd = await prdResponse.json();
          // Parse requirement ref like "success_criteria[0]"
          const match = requirementRef.match(/^(\w+)\[(\d+)\]$/);
          if (match) {
            const section = match[1];
            const index = parseInt(match[2], 10);
            const items = prd[section];
            if (Array.isArray(items) && items[index]) {
              prdRequirement = {
                ref: requirementRef,
                text:
                  typeof items[index] === "string"
                    ? items[index]
                    : items[index].text || items[index].description || "",
              };
            }
          }
        }
      }

      setContext({
        prdRequirement,
        adjacentTasks,
        taskTitle: task.title || "",
        taskDescription: task.description || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load context");
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = async () => {
    try {
      setLoadingQuestions(true);
      setError(null);

      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/generate-acceptance-criteria`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: "questions",
            prdId,
            requirementRef,
            adjacentTaskIds: context?.adjacentTasks.map((t) => t.id) || [],
            additionalContext,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate questions");
      }

      const data = await response.json();

      // Map questions to our format
      const mappedQuestions: Question[] = (data.questions || []).map(
        (
          q: { question: string; suggestedAnswers: string[] },
          index: number,
        ) => ({
          id: `q-${index}`,
          question: q.question,
          suggestedAnswers: q.suggestedAnswers || [],
          selectedAnswer: null,
          customAnswer: "",
        }),
      );

      setQuestions(mappedQuestions);
      setStep("questions");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate questions",
      );
    } finally {
      setLoadingQuestions(false);
    }
  };

  const generateCriteria = async () => {
    try {
      setLoadingCriteria(true);
      setError(null);

      const answers = questions.map((q) => ({
        question: q.question,
        answer: q.customAnswer || q.selectedAnswer || "",
      }));

      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/generate-acceptance-criteria`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: "criteria",
            prdId,
            requirementRef,
            adjacentTaskIds: context?.adjacentTasks.map((t) => t.id) || [],
            additionalContext,
            questionAnswers: answers,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate criteria");
      }

      const data = await response.json();

      // Map criteria to our format
      const mappedCriteria: Criterion[] = (data.criteria || []).map(
        (text: string, index: number) => ({
          id: `c-${index}`,
          text,
          scope: "codebase" as const,
          isEditing: false,
        }),
      );

      setCriteria(mappedCriteria);
      setStep("review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate criteria",
      );
    } finally {
      setLoadingCriteria(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, selectedAnswer: answer, customAnswer: "" }
          : q,
      ),
    );
  };

  const handleCustomAnswer = (questionId: string, answer: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, customAnswer: answer, selectedAnswer: null }
          : q,
      ),
    );
  };

  const handleEditCriterion = (criterionId: string) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === criterionId ? { ...c, isEditing: true } : c)),
    );
  };

  const handleSaveCriterion = (criterionId: string, newText: string) => {
    setCriteria((prev) =>
      prev.map((c) =>
        c.id === criterionId ? { ...c, text: newText, isEditing: false } : c,
      ),
    );
  };

  const handleDeleteCriterion = (criterionId: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== criterionId));
  };

  const handleAddCriterion = () => {
    if (!newCriterionText.trim()) return;
    setCriteria((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        text: newCriterionText.trim(),
        scope: "codebase",
        isEditing: false,
      },
    ]);
    setNewCriterionText("");
  };

  const handleScopeChange = (
    criterionId: string,
    scope: Criterion["scope"],
  ) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === criterionId ? { ...c, scope } : c)),
    );
  };

  const handleSave = () => {
    onSave(criteria.map((c) => c.text));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Generate Acceptance Criteria
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-8 px-6 py-4 border-b border-gray-100 bg-gray-50">
          <StepIndicator
            step={1}
            label="Context"
            icon={<FileText className="h-4 w-4" />}
            isActive={step === "context"}
            isComplete={step !== "context"}
          />
          <ChevronRight className="h-4 w-4 text-gray-300" />
          <StepIndicator
            step={2}
            label="Questions"
            icon={<MessageSquare className="h-4 w-4" />}
            isActive={step === "questions"}
            isComplete={step === "review"}
          />
          <ChevronRight className="h-4 w-4 text-gray-300" />
          <StepIndicator
            step={3}
            label="Review"
            icon={<ClipboardCheck className="h-4 w-4" />}
            isActive={step === "review"}
            isComplete={false}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {error}
            </div>
          ) : (
            <>
              {/* Step 1: Context */}
              {step === "context" && context && (
                <div className="space-y-6">
                  {/* Task Info */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Task
                    </h3>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-900">
                        {context.taskTitle}
                      </p>
                      {context.taskDescription && (
                        <p className="text-sm text-gray-600 mt-1">
                          {context.taskDescription}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* PRD Requirement */}
                  {context.prdRequirement && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        PRD Requirement
                      </h3>
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-600 mb-1">
                          {context.prdRequirement.ref}
                        </p>
                        <p className="text-sm text-blue-900">
                          {context.prdRequirement.text}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Adjacent Tasks */}
                  {context.adjacentTasks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Related Tasks in List
                      </h3>
                      <div className="space-y-2">
                        {context.adjacentTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                          >
                            <span className="font-mono text-xs text-gray-500">
                              {task.displayId}
                            </span>
                            <span className="text-sm text-gray-700 flex-1 truncate">
                              {task.title}
                            </span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                task.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Context */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Additional Context (Optional)
                    </h3>
                    <textarea
                      value={additionalContext}
                      onChange={(e) => setAdditionalContext(e.target.value)}
                      placeholder="Add any additional context or requirements..."
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Questions */}
              {step === "questions" && (
                <div className="space-y-6">
                  {loadingQuestions ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-3" />
                        <p className="text-gray-600">
                          Generating clarifying questions...
                        </p>
                      </div>
                    </div>
                  ) : questions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No questions generated</p>
                      <p className="text-sm">
                        Click "Next" to proceed to criteria generation
                      </p>
                    </div>
                  ) : (
                    questions.map((q, index) => (
                      <div
                        key={q.id}
                        className="p-4 border border-gray-200 rounded-lg"
                      >
                        <p className="font-medium text-gray-900 mb-3">
                          {index + 1}. {q.question}
                        </p>

                        {/* Suggested Answers */}
                        <div className="space-y-2 mb-3">
                          {q.suggestedAnswers.map((answer, i) => (
                            <button
                              key={i}
                              onClick={() => handleAnswerSelect(q.id, answer)}
                              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                                q.selectedAnswer === answer
                                  ? "border-primary-500 bg-primary-50 text-primary-700"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    q.selectedAnswer === answer
                                      ? "border-primary-500 bg-primary-500"
                                      : "border-gray-300"
                                  }`}
                                >
                                  {q.selectedAnswer === answer && (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                  )}
                                </div>
                                <span className="text-sm">{answer}</span>
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* Custom Answer */}
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">
                            Or provide your own answer:
                          </label>
                          <input
                            type="text"
                            value={q.customAnswer}
                            onChange={(e) =>
                              handleCustomAnswer(q.id, e.target.value)
                            }
                            placeholder="Type your answer..."
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Step 3: Review */}
              {step === "review" && (
                <div className="space-y-6">
                  {loadingCriteria ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-3" />
                        <p className="text-gray-600">
                          Generating acceptance criteria...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {criteria.map((c, index) => (
                          <div
                            key={c.id}
                            className="p-3 border border-gray-200 rounded-lg"
                          >
                            {c.isEditing ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  defaultValue={c.text}
                                  onBlur={(e) =>
                                    handleSaveCriterion(c.id, e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveCriterion(
                                        c.id,
                                        (e.target as HTMLInputElement).value,
                                      );
                                    }
                                  }}
                                  autoFocus
                                  className="w-full px-3 py-2 border rounded-lg text-sm"
                                />
                              </div>
                            ) : (
                              <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium">
                                  {index + 1}
                                </span>
                                <p className="flex-1 text-sm text-gray-700">
                                  {c.text}
                                </p>
                                <div className="flex items-center gap-1">
                                  <select
                                    value={c.scope}
                                    onChange={(e) =>
                                      handleScopeChange(
                                        c.id,
                                        e.target.value as Criterion["scope"],
                                      )
                                    }
                                    className="text-xs border rounded px-1.5 py-0.5"
                                  >
                                    {SCOPE_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleEditCriterion(c.id)}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCriterion(c.id)}
                                    className="p-1 text-gray-400 hover:text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add New Criterion */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newCriterionText}
                          onChange={(e) => setNewCriterionText(e.target.value)}
                          placeholder="Add new criterion..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddCriterion();
                          }}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                        <button
                          onClick={handleAddCriterion}
                          disabled={!newCriterionText.trim()}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              if (step === "questions") setStep("context");
              else if (step === "review") setStep("questions");
            }}
            disabled={step === "context" || loading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>

            {step === "context" && (
              <button
                onClick={generateQuestions}
                disabled={loadingQuestions || !context}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingQuestions ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate Questions
              </button>
            )}

            {step === "questions" && (
              <button
                onClick={generateCriteria}
                disabled={loadingCriteria}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingCriteria ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Generate Criteria
              </button>
            )}

            {step === "review" && (
              <button
                onClick={handleSave}
                disabled={criteria.length === 0}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Criteria ({criteria.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  step,
  label,
  icon,
  isActive,
  isComplete,
}: {
  step: number;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isComplete
            ? "bg-green-500 text-white"
            : isActive
              ? "bg-primary-600 text-white"
              : "bg-gray-200 text-gray-500"
        }`}
      >
        {isComplete ? <CheckCircle className="h-4 w-4" /> : icon}
      </div>
      <span
        className={`text-sm font-medium ${
          isActive ? "text-gray-900" : "text-gray-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
