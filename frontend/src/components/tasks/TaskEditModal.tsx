/**
 * TaskEditModal Component
 *
 * Modal for editing task details including title, description, category,
 * priority, effort, and component types.
 *
 * Features:
 * - Edit all task properties
 * - Component type selection (PTE-138)
 * - Re-analysis trigger on significant changes
 * - File impact editing integration
 *
 * Part of: PTE-137, PTE-138
 */

import { useState, useEffect } from "react";
import {
  X,
  Save,
  Loader2,
  AlertCircle,
  Tag,
  FileText,
  Layers,
  Flag,
  Clock,
  RefreshCw,
} from "lucide-react";
import type {
  Task,
  TaskCategory,
  TaskPriority,
  TaskEffort,
  ComponentType,
} from "../../types/task-agent";
import FileImpactEditor from "./FileImpactEditor";

interface TaskEditModalProps {
  /** Task to edit (null to close) */
  task: Task | null;
  /** Close callback */
  onClose: () => void;
  /** Save callback */
  onSave: (task: Task) => void;
}

// Category options
const CATEGORY_OPTIONS: Array<{ value: TaskCategory; label: string }> = [
  { value: "feature", label: "Feature" },
  { value: "bug", label: "Bug" },
  { value: "task", label: "Task" },
  { value: "story", label: "Story" },
  { value: "epic", label: "Epic" },
  { value: "spike", label: "Spike" },
  { value: "improvement", label: "Improvement" },
  { value: "documentation", label: "Documentation" },
  { value: "test", label: "Test" },
  { value: "devops", label: "DevOps" },
  { value: "design", label: "Design" },
  { value: "research", label: "Research" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "security", label: "Security" },
  { value: "performance", label: "Performance" },
  { value: "other", label: "Other" },
];

// Priority options
const PRIORITY_OPTIONS: Array<{
  value: TaskPriority;
  label: string;
  color: string;
}> = [
  { value: "P1", label: "Critical (P1)", color: "text-red-600" },
  { value: "P2", label: "High (P2)", color: "text-orange-600" },
  { value: "P3", label: "Medium (P3)", color: "text-yellow-600" },
  { value: "P4", label: "Low (P4)", color: "text-green-600" },
];

// Effort options
const EFFORT_OPTIONS: Array<{ value: TaskEffort; label: string }> = [
  { value: "trivial", label: "Trivial (< 1 hour)" },
  { value: "small", label: "Small (1-4 hours)" },
  { value: "medium", label: "Medium (1-2 days)" },
  { value: "large", label: "Large (3-5 days)" },
  { value: "epic", label: "Epic (1+ weeks)" },
];

// Component type options (PTE-138)
const COMPONENT_OPTIONS: Array<{
  value: ComponentType;
  label: string;
  icon: string;
}> = [
  { value: "database", label: "Database", icon: "💾" },
  { value: "types", label: "Types", icon: "📝" },
  { value: "api", label: "API", icon: "🔌" },
  { value: "service", label: "Service", icon: "⚙️" },
  { value: "ui", label: "UI", icon: "🎨" },
  { value: "test", label: "Test", icon: "🧪" },
  { value: "config", label: "Config", icon: "⚡" },
  { value: "documentation", label: "Documentation", icon: "📚" },
  { value: "infrastructure", label: "Infrastructure", icon: "🏗️" },
  { value: "other", label: "Other", icon: "📦" },
];

export default function TaskEditModal({
  task,
  onClose,
  onSave,
}: TaskEditModalProps): JSX.Element | null {
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategory>("task");
  const [priority, setPriority] = useState<TaskPriority>("P2");
  const [effort, setEffort] = useState<TaskEffort>("medium");
  const [componentTypes, setComponentTypes] = useState<ComponentType[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFileImpacts, setShowFileImpacts] = useState(false);
  const [willReanalyze, setWillReanalyze] = useState(false);

  // Load task data
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setCategory(task.category);
      setPriority(task.priority);
      setEffort(task.effort);
      setComponentTypes(task.componentTypes || []);
    }
  }, [task]);

  // Check if significant changes that require re-analysis
  useEffect(() => {
    if (!task) return;

    const hasSignificantChange =
      title !== task.title ||
      description !== (task.description || "") ||
      category !== task.category;

    setWillReanalyze(hasSignificantChange);
  }, [task, title, description, category]);

  // Toggle component type
  const toggleComponentType = (type: ComponentType) => {
    if (componentTypes.includes(type)) {
      setComponentTypes(componentTypes.filter((t) => t !== type));
    } else {
      setComponentTypes([...componentTypes, type]);
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!task) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/task-agent/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          category,
          priority,
          effort,
          componentTypes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save task");
      }

      const result = await response.json();
      onSave(result.task);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Don't render if no task
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Task</h2>
            <p className="text-sm text-gray-500 font-mono">{task.displayId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Title
              </div>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              placeholder="Task title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-400 resize-none"
              placeholder="Task description (optional)"
            />
          </div>

          {/* Category, Priority, Effort Row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  Category
                </div>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-1">
                  <Flag className="h-4 w-4" />
                  Priority
                </div>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Effort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Effort
                </div>
              </label>
              <select
                value={effort}
                onChange={(e) => setEffort(e.target.value as TaskEffort)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              >
                {EFFORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Component Types (PTE-138) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-1">
                <Layers className="h-4 w-4" />
                Component Types
              </div>
            </label>
            <div className="flex flex-wrap gap-2">
              {COMPONENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleComponentType(opt.value)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors flex items-center gap-1.5 ${
                    componentTypes.includes(opt.value)
                      ? "bg-primary-100 border-primary-400 text-primary-700"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File Impacts */}
          <div>
            <button
              onClick={() => setShowFileImpacts(!showFileImpacts)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <Layers className="h-4 w-4" />
              File Impacts
              {showFileImpacts ? (
                <X className="h-4 w-4" />
              ) : (
                <span className="text-xs text-gray-500">(click to edit)</span>
              )}
            </button>
            {showFileImpacts && (
              <div className="mt-3">
                <FileImpactEditor
                  taskId={task.id}
                  taskDisplayId={task.displayId}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div>
            {willReanalyze && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <RefreshCw className="h-3 w-3" />
                <span>Will trigger re-analysis</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TaskEditModal };
