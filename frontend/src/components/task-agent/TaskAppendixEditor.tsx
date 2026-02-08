/**
 * Task Appendix Editor Component
 *
 * Manages task appendices (11 types) with inline/reference content.
 * Part of: Task System V2 Implementation Plan (IMPL-7.5)
 */

import { useState, useEffect } from "react";
import {
  FileCode,
  BookOpen,
  AlertTriangle,
  RotateCcw,
  FileText,
  Link2,
  History,
  Lightbulb,
  Settings,
  Code2,
  TestTube,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ExternalLink,
} from "lucide-react";

type AppendixType =
  | "code_context"
  | "research_notes"
  | "gotcha"
  | "rollback_plan"
  | "related_tasks"
  | "references"
  | "decision_log"
  | "discovery"
  | "config"
  | "snippet"
  | "test_data";

interface TaskAppendix {
  id: string;
  taskId: string;
  appendixType: AppendixType;
  title: string;
  contentInline?: string;
  contentRef?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface TaskAppendixEditorProps {
  taskId: string;
  readOnly?: boolean;
  onAppendixChange?: () => void;
}

const appendixTypeConfig: Record<
  AppendixType,
  {
    icon: typeof FileCode;
    color: string;
    bgColor: string;
    label: string;
    description: string;
  }
> = {
  code_context: {
    icon: FileCode,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    label: "Code Context",
    description: "Relevant code snippets from the codebase",
  },
  research_notes: {
    icon: BookOpen,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    label: "Research Notes",
    description: "Investigation findings and notes",
  },
  gotcha: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    label: "Gotcha",
    description: "Pitfalls and warnings to avoid",
  },
  rollback_plan: {
    icon: RotateCcw,
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Rollback Plan",
    description: "Steps to undo changes if needed",
  },
  related_tasks: {
    icon: Link2,
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Related Tasks",
    description: "Links to related task IDs",
  },
  references: {
    icon: ExternalLink,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
    label: "References",
    description: "External documentation and links",
  },
  decision_log: {
    icon: History,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
    label: "Decision Log",
    description: "Architecture and design decisions",
  },
  discovery: {
    icon: Lightbulb,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    label: "Discovery",
    description: "New findings during execution",
  },
  config: {
    icon: Settings,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    label: "Config",
    description: "Configuration requirements",
  },
  snippet: {
    icon: Code2,
    color: "text-pink-600",
    bgColor: "bg-pink-100",
    label: "Code Snippet",
    description: "Implementation code templates",
  },
  test_data: {
    icon: TestTube,
    color: "text-teal-600",
    bgColor: "bg-teal-100",
    label: "Test Data",
    description: "Test fixtures and sample data",
  },
};

export default function TaskAppendixEditor({
  taskId,
  readOnly = false,
  onAppendixChange,
}: TaskAppendixEditorProps) {
  const [appendices, setAppendices] = useState<TaskAppendix[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Form state
  const [newAppendix, setNewAppendix] = useState({
    appendixType: "code_context" as AppendixType,
    title: "",
    contentInline: "",
    contentRef: "",
  });

  useEffect(() => {
    fetchAppendices();
  }, [taskId]);

  const fetchAppendices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/appendices`,
      );
      if (response.ok) {
        setAppendices(await response.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAppendix = async () => {
    if (!newAppendix.title.trim()) return;

    try {
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/appendices`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newAppendix),
        },
      );

      if (!response.ok) throw new Error("Failed to add appendix");

      setShowAddForm(false);
      setNewAppendix({
        appendixType: "code_context",
        title: "",
        contentInline: "",
        contentRef: "",
      });
      fetchAppendices();
      onAppendixChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleRemoveAppendix = async (id: string) => {
    try {
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/appendices/${id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) throw new Error("Failed to remove appendix");

      fetchAppendices();
      onAppendixChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Appendix Button */}
      {!readOnly && (
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Appendix
        </button>
      )}

      {/* Add Appendix Form */}
      {showAddForm && (
        <div className="p-4 border border-gray-200 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={newAppendix.appendixType}
              onChange={(e) =>
                setNewAppendix({
                  ...newAppendix,
                  appendixType: e.target.value as AppendixType,
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
            >
              {Object.entries(appendixTypeConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label} - {config.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={newAppendix.title}
              onChange={(e) =>
                setNewAppendix({ ...newAppendix, title: e.target.value })
              }
              placeholder="Brief title for this appendix"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <textarea
              value={newAppendix.contentInline}
              onChange={(e) =>
                setNewAppendix({
                  ...newAppendix,
                  contentInline: e.target.value,
                })
              }
              placeholder="Appendix content..."
              rows={4}
              className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference Path (optional)
            </label>
            <input
              type="text"
              value={newAppendix.contentRef}
              onChange={(e) =>
                setNewAppendix({ ...newAppendix, contentRef: e.target.value })
              }
              placeholder="e.g., docs/spec.md#section"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAddAppendix}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Appendices List */}
      {appendices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No appendices</p>
          <p className="text-sm">
            Add appendices to provide context for task execution
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {appendices.map((appendix) => {
            const config = appendixTypeConfig[appendix.appendixType];
            const TypeIcon = config.icon;
            const isExpanded = expandedIds.has(appendix.id);
            return (
              <div
                key={appendix.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="flex items-center gap-2 p-3 hover:bg-gray-50">
                  {!readOnly && (
                    <GripVertical className="h-4 w-4 text-gray-300 cursor-grab" />
                  )}
                  <button
                    onClick={() => toggleExpanded(appendix.id)}
                    className="flex items-center gap-3 flex-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className={`p-1.5 rounded ${config.bgColor}`}>
                      <TypeIcon className={`h-4 w-4 ${config.color}`} />
                    </span>
                    <span className="font-medium text-gray-900">
                      {appendix.title}
                    </span>
                    <span className="text-xs text-gray-400">
                      {config.label}
                    </span>
                  </button>
                  {!readOnly && (
                    <button
                      onClick={() => handleRemoveAppendix(appendix.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    {appendix.contentInline && (
                      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 bg-white p-3 rounded border">
                        {appendix.contentInline}
                      </pre>
                    )}
                    {appendix.contentRef && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-500">Reference:</span>
                        <code className="ml-2 px-2 py-1 bg-gray-100 rounded">
                          {appendix.contentRef}
                        </code>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-400">
                      Updated {new Date(appendix.updatedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
