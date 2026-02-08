/**
 * QuickAddTask Component
 *
 * Provides rapid task capture with keyboard shortcut support.
 * Tasks are added to the Evaluation Queue for analysis and grouping.
 *
 * Features:
 * - Ctrl+Shift+T opens/focuses the input
 * - Optional project/category selection
 * - Success/error toast feedback
 * - Auto-clear on success
 *
 * Part of: PTE-082 to PTE-085
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Zap, ChevronDown, Check, X, Loader2 } from "lucide-react";
import type {
  QuickAddTaskInput,
  EvaluationQueueTask,
} from "../../types/task-agent";

interface QuickAddTaskProps {
  /** Optional callback when task is successfully created */
  onTaskCreated?: (task: EvaluationQueueTask) => void;
  /** Optional list of projects for dropdown */
  projects?: Array<{ id: string; name: string }>;
  /** Whether to show inline (vs floating modal) */
  inline?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function QuickAddTask({
  onTaskCreated,
  projects = [],
  inline = false,
  autoFocus = false,
  placeholder = "Quick add a task... (Ctrl+Shift+T)",
}: QuickAddTaskProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(inline);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Category options
  const categories = [
    { value: "", label: "Auto-detect" },
    { value: "feature", label: "Feature" },
    { value: "bug", label: "Bug Fix" },
    { value: "enhancement", label: "Enhancement" },
    { value: "refactor", label: "Refactor" },
    { value: "documentation", label: "Documentation" },
    { value: "test", label: "Test" },
    { value: "infrastructure", label: "Infrastructure" },
    { value: "research", label: "Research" },
    { value: "other", label: "Other" },
  ];

  // Keyboard shortcut handler (Ctrl+Shift+T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "T") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      // Escape to close
      if (e.key === "Escape" && isOpen && !inline) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, inline]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Submit task
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!title.trim()) {
        setErrorMessage("Task title is required");
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }

      setStatus("submitting");
      setErrorMessage("");
      setSuccessMessage("");

      try {
        const input: QuickAddTaskInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: projectId || undefined,
          category: category || undefined,
        };

        const response = await fetch("/api/task-agent/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to create task");
        }

        const task: EvaluationQueueTask = await response.json();

        setStatus("success");
        setSuccessMessage(`Created ${task.displayId}`);
        setTitle("");
        setDescription("");
        setShowAdvanced(false);

        onTaskCreated?.(task);

        // Reset status after success
        setTimeout(() => {
          setStatus("idle");
          setSuccessMessage("");
        }, 3000);
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to create task",
        );
        setTimeout(() => setStatus("idle"), 5000);
      }
    },
    [title, description, projectId, category, onTaskCreated],
  );

  // Handle Enter key in input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Render floating button (when not inline)
  if (!inline && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all hover:shadow-xl group"
        title="Quick Add Task (Ctrl+Shift+T)"
      >
        <Plus className="h-5 w-5" />
        <span className="hidden group-hover:inline text-sm font-medium">
          Quick Add
        </span>
        <kbd className="hidden group-hover:inline px-1.5 py-0.5 text-xs bg-primary-500 rounded">
          Ctrl+Shift+T
        </kbd>
      </button>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Main input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-500" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            disabled={status === "submitting"}
            autoFocus={!inline}
          />
        </div>
        <button
          type="submit"
          disabled={status === "submitting" || !title.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {status === "submitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add
        </button>
        {!inline && (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Advanced options toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
        />
        {showAdvanced ? "Hide options" : "More options"}
      </button>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="space-y-3 pt-2 border-t">
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-none"
              placeholder="Add more details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Project selector */}
            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Project
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="">Auto-assign</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category selector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Status messages */}
      {status === "success" && successMessage && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
          <X className="h-4 w-4" />
          {errorMessage}
        </div>
      )}

      {/* Hint */}
      <p className="text-xs text-gray-400">
        Tasks are added to the Evaluation Queue for automatic analysis and
        grouping.
      </p>
    </form>
  );

  // Render inline
  if (inline) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {formContent}
      </div>
    );
  }

  // Render floating modal
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-4 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Quick Add Task</h2>
          </div>
          <kbd className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
            Esc to close
          </kbd>
        </div>
        {formContent}
      </div>
    </div>
  );
}

// Export individual components for flexibility
export { QuickAddTask };
