/**
 * TaskDependencyManager Component
 *
 * Manages task dependencies with:
 * - View all 12 relationship types
 * - Add new dependencies with cycle detection
 * - Remove existing dependencies
 * - Search tasks for dependency selection
 *
 * Part of: Task Agent Workflow Enhancement
 */

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  X,
  Loader2,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Check,
  XCircle,
  ChevronUp,
} from "lucide-react";

type RelationshipType =
  | "depends_on"
  | "blocks"
  | "related_to"
  | "duplicate_of"
  | "parent_of"
  | "child_of"
  | "supersedes"
  | "implements"
  | "conflicts_with"
  | "enables"
  | "inspired_by"
  | "tests";

interface TaskRelation {
  taskId: string;
  displayId: string;
  title: string;
  status: string;
}

interface TaskDependencies {
  dependsOn: TaskRelation[];
  blocks: TaskRelation[];
  relatedTo: TaskRelation[];
  duplicateOf: TaskRelation[];
  parentOf: TaskRelation[];
  childOf: TaskRelation[];
  supersedes?: TaskRelation[];
  implements?: TaskRelation[];
  conflictsWith?: TaskRelation[];
  enables?: TaskRelation[];
  inspiredBy?: TaskRelation[];
  tests?: TaskRelation[];
}

interface SearchResult {
  id: string;
  displayId: string;
  title: string;
  status: string;
  category: string;
}

interface CycleWarning {
  hasCycle: boolean;
  cyclePath?: string[];
  cycleDisplayIds?: string[];
}

interface DependencySuggestion {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  targetDisplayId: string;
  targetTitle: string;
  relationshipType: "depends_on" | "blocks";
  confidence: number;
  reason: string;
  source: "prd_derived" | "ai_analyzed" | "pattern_based";
}

interface TaskDependencyManagerProps {
  taskId: string;
  projectId?: string;
  readOnly?: boolean;
  showSuggestions?: boolean;
  onDependencyChange?: () => void;
  onTaskClick?: (taskId: string) => void;
}

const RELATIONSHIP_CONFIG: Record<
  RelationshipType,
  { label: string; color: string; description: string }
> = {
  depends_on: {
    label: "Depends On",
    color: "text-blue-600",
    description: "This task requires the target to be completed first",
  },
  blocks: {
    label: "Blocks",
    color: "text-amber-600",
    description: "This task is blocking the target",
  },
  related_to: {
    label: "Related To",
    color: "text-gray-600",
    description: "Thematic connection between tasks",
  },
  duplicate_of: {
    label: "Duplicate Of",
    color: "text-red-600",
    description: "This task duplicates the target",
  },
  parent_of: {
    label: "Parent Of",
    color: "text-purple-600",
    description: "This task is parent of the target",
  },
  child_of: {
    label: "Child Of",
    color: "text-teal-600",
    description: "This task is child of the target",
  },
  supersedes: {
    label: "Supersedes",
    color: "text-indigo-600",
    description: "This task replaces the target",
  },
  implements: {
    label: "Implements",
    color: "text-green-600",
    description: "This task implements the target",
  },
  conflicts_with: {
    label: "Conflicts With",
    color: "text-rose-600",
    description: "These tasks conflict and cannot run together",
  },
  enables: {
    label: "Enables",
    color: "text-cyan-600",
    description: "This task enables the target to proceed",
  },
  inspired_by: {
    label: "Inspired By",
    color: "text-pink-600",
    description: "This task was inspired by the target",
  },
  tests: {
    label: "Tests",
    color: "text-violet-600",
    description: "This task tests the target",
  },
};

export default function TaskDependencyManager({
  taskId,
  projectId,
  readOnly = false,
  showSuggestions = true,
  onDependencyChange,
  onTaskClick,
}: TaskDependencyManagerProps) {
  const [dependencies, setDependencies] = useState<TaskDependencies | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add dependency form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SearchResult | null>(null);
  const [selectedRelationType, setSelectedRelationType] =
    useState<RelationshipType>("depends_on");
  const [adding, setAdding] = useState(false);
  const [cycleWarning, setCycleWarning] = useState<CycleWarning | null>(null);

  // Remove dependency state
  const [removing, setRemoving] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<DependencySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [acceptingSuggestion, setAcceptingSuggestion] = useState<string | null>(
    null,
  );
  const [dismissingSuggestion, setDismissingSuggestion] = useState<
    string | null
  >(null);

  // Fetch dependencies
  const fetchDependencies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/dependencies`,
      );
      if (!response.ok) throw new Error("Failed to fetch dependencies");
      const data = await response.json();
      setDependencies(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!showSuggestions) return;
    try {
      setLoadingSuggestions(true);
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/suggest-dependencies`,
      );
      if (!response.ok) throw new Error("Failed to fetch suggestions");
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error("Failed to load suggestions:", err);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [taskId, showSuggestions]);

  // Accept a suggestion
  const handleAcceptSuggestion = async (suggestion: DependencySuggestion) => {
    try {
      setAcceptingSuggestion(suggestion.id);
      const response = await fetch("/api/task-agent/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTaskId: taskId,
          targetTaskId: suggestion.targetTaskId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add dependency");
      }

      // Remove from suggestions and refresh dependencies
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      await fetchDependencies();
      onDependencyChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept");
    } finally {
      setAcceptingSuggestion(null);
    }
  };

  // Dismiss a suggestion
  const handleDismissSuggestion = async (suggestion: DependencySuggestion) => {
    try {
      setDismissingSuggestion(suggestion.id);
      await fetch(`/api/task-agent/tasks/${taskId}/dismiss-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTaskId: suggestion.targetTaskId }),
      });

      // Remove from list
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch (err) {
      console.error("Failed to dismiss:", err);
    } finally {
      setDismissingSuggestion(null);
    }
  };

  // Search tasks for dependency
  const searchTasks = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        setSearching(true);
        const params = new URLSearchParams({
          q: query,
          excludeTaskId: taskId,
          limit: "10",
        });
        if (projectId) params.set("projectId", projectId);

        const response = await fetch(
          `/api/task-agent/tasks/search?${params.toString()}`,
        );
        if (!response.ok) throw new Error("Search failed");
        const data = await response.json();
        setSearchResults(data);
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [taskId, projectId],
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchTasks(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchTasks]);

  // Check for cycle when selecting a task
  const checkCycle = useCallback(
    async (targetTaskId: string) => {
      try {
        const response = await fetch(
          "/api/task-agent/dependencies/check-cycle",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceTaskId: taskId,
              targetTaskId,
            }),
          },
        );
        if (!response.ok) throw new Error("Cycle check failed");
        const data = await response.json();
        setCycleWarning(data);
      } catch (err) {
        console.error("Cycle check error:", err);
        setCycleWarning(null);
      }
    },
    [taskId],
  );

  // Handle task selection
  const handleSelectTask = (task: SearchResult) => {
    setSelectedTask(task);
    setSearchQuery(task.displayId);
    setSearchResults([]);
    checkCycle(task.id);
  };

  // Add dependency
  const handleAddDependency = async () => {
    if (!selectedTask) return;

    try {
      setAdding(true);
      const response = await fetch("/api/task-agent/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTaskId: taskId,
          targetTaskId: selectedTask.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add dependency");
      }

      // Reset form and refresh
      setShowAddForm(false);
      setSelectedTask(null);
      setSearchQuery("");
      setCycleWarning(null);
      await fetchDependencies();
      onDependencyChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  // Remove dependency
  const handleRemoveDependency = async (
    targetTaskId: string,
    _relationType: RelationshipType,
  ) => {
    try {
      setRemoving(targetTaskId);
      const response = await fetch("/api/task-agent/dependencies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTaskId: taskId,
          targetTaskId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove dependency");
      }

      await fetchDependencies();
      onDependencyChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setRemoving(null);
    }
  };

  // Get all sections with their items
  const sections = dependencies
    ? ([
        { type: "depends_on" as const, items: dependencies.dependsOn || [] },
        { type: "blocks" as const, items: dependencies.blocks || [] },
        { type: "related_to" as const, items: dependencies.relatedTo || [] },
        { type: "parent_of" as const, items: dependencies.parentOf || [] },
        { type: "child_of" as const, items: dependencies.childOf || [] },
        {
          type: "duplicate_of" as const,
          items: dependencies.duplicateOf || [],
        },
        { type: "supersedes" as const, items: dependencies.supersedes || [] },
        { type: "implements" as const, items: dependencies.implements || [] },
        {
          type: "conflicts_with" as const,
          items: dependencies.conflictsWith || [],
        },
        { type: "enables" as const, items: dependencies.enables || [] },
        { type: "inspired_by" as const, items: dependencies.inspiredBy || [] },
        { type: "tests" as const, items: dependencies.tests || [] },
      ].filter((s) => s.items.length > 0) as {
        type: RelationshipType;
        items: TaskRelation[];
      }[])
    : [];

  const hasAny = sections.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 bg-green-100";
    if (confidence >= 0.6) return "text-amber-600 bg-amber-100";
    return "text-gray-600 bg-gray-100";
  };

  // Get source label
  const getSourceLabel = (source: DependencySuggestion["source"]) => {
    switch (source) {
      case "prd_derived":
        return "PRD";
      case "ai_analyzed":
        return "AI";
      case "pattern_based":
        return "Pattern";
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      {!readOnly && !showAddForm && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Dependency
          </button>
          {showSuggestions && (
            <button
              onClick={() => {
                setShowSuggestionsPanel(!showSuggestionsPanel);
                if (!showSuggestionsPanel && suggestions.length === 0) {
                  fetchSuggestions();
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              AI Suggestions
              {suggestions.length > 0 && (
                <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full">
                  {suggestions.length}
                </span>
              )}
              {showSuggestionsPanel ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Suggestions Panel */}
      {showSuggestionsPanel && !readOnly && (
        <div className="border border-purple-200 rounded-lg bg-purple-50 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-purple-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-purple-900">
                Dependency Suggestions
              </span>
            </div>
            <button
              onClick={() => setShowSuggestionsPanel(false)}
              className="p-1 text-purple-400 hover:text-purple-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loadingSuggestions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="py-8 text-center text-purple-600">
                <p className="text-sm">No suggestions available</p>
                <p className="text-xs mt-1 text-purple-500">
                  Add file impacts or link to a PRD for better suggestions
                </p>
              </div>
            ) : (
              <div className="divide-y divide-purple-100">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-3 hover:bg-purple-100/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-purple-700 bg-white px-1.5 py-0.5 rounded border border-purple-200">
                            {suggestion.targetDisplayId}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              suggestion.relationshipType === "depends_on"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {suggestion.relationshipType === "depends_on"
                              ? "depends on"
                              : "blocks"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 truncate">
                          {suggestion.targetTitle}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {suggestion.reason}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(suggestion.confidence)}`}
                          >
                            {Math.round(suggestion.confidence * 100)}%
                          </span>
                          <span className="text-xs text-gray-400">
                            via {getSourceLabel(suggestion.source)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleAcceptSuggestion(suggestion)}
                          disabled={
                            acceptingSuggestion === suggestion.id ||
                            dismissingSuggestion === suggestion.id
                          }
                          className="p-1.5 text-green-600 hover:bg-green-100 rounded disabled:opacity-50"
                          title="Accept suggestion"
                        >
                          {acceptingSuggestion === suggestion.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDismissSuggestion(suggestion)}
                          disabled={
                            acceptingSuggestion === suggestion.id ||
                            dismissingSuggestion === suggestion.id
                          }
                          className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded disabled:opacity-50"
                          title="Dismiss suggestion"
                        >
                          {dismissingSuggestion === suggestion.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Dependency Form */}
      {showAddForm && (
        <div className="p-4 border border-gray-200 rounded-lg space-y-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Add Dependency</h4>
            <button
              onClick={() => {
                setShowAddForm(false);
                setSelectedTask(null);
                setSearchQuery("");
                setCycleWarning(null);
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Relationship Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Relationship Type
            </label>
            <div className="relative">
              <select
                value={selectedRelationType}
                onChange={(e) =>
                  setSelectedRelationType(e.target.value as RelationshipType)
                }
                className="w-full px-3 py-2 border rounded-lg appearance-none bg-white pr-10"
              >
                {Object.entries(RELATIONSHIP_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {RELATIONSHIP_CONFIG[selectedRelationType].description}
            </p>
          </div>

          {/* Task Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Task
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedTask(null);
                  setCycleWarning(null);
                }}
                placeholder="Search by display ID or title..."
                className="w-full pl-10 pr-3 py-2 border rounded-lg"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && !selectedTask && (
              <div className="mt-1 border rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
                {searchResults.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleSelectTask(task)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="font-mono text-xs text-primary-600 bg-gray-100 px-1.5 py-0.5 rounded">
                      {task.displayId}
                    </span>
                    <span className="text-sm text-gray-700 truncate flex-1">
                      {task.title}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        task.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : task.status === "in_progress"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {task.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Task Display */}
            {selectedTask && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <span className="font-mono text-xs text-blue-600 bg-white px-1.5 py-0.5 rounded">
                  {selectedTask.displayId}
                </span>
                <span className="text-sm text-blue-800 flex-1 truncate">
                  {selectedTask.title}
                </span>
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    setSearchQuery("");
                    setCycleWarning(null);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Cycle Warning */}
          {cycleWarning?.hasCycle && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
                <AlertTriangle className="h-4 w-4" />
                Circular Dependency Detected
              </div>
              <p className="text-sm text-amber-600">
                Adding this dependency would create a cycle:
              </p>
              {cycleWarning.cycleDisplayIds && (
                <p className="text-xs font-mono text-amber-700 mt-1">
                  {cycleWarning.cycleDisplayIds.join(" → ")}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setSelectedTask(null);
                setSearchQuery("");
                setCycleWarning(null);
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAddDependency}
              disabled={
                !selectedTask || adding || (cycleWarning?.hasCycle ?? false)
              }
              className="px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Dependency
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* No Dependencies */}
      {!hasAny && !showAddForm && (
        <div className="text-center py-12 text-gray-500">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No dependencies or relationships defined</p>
          {!readOnly && (
            <p className="text-sm mt-1">Click "Add Dependency" to create one</p>
          )}
        </div>
      )}

      {/* Dependencies List */}
      {hasAny && (
        <div className="space-y-4">
          {sections.map((section) => {
            const config = RELATIONSHIP_CONFIG[section.type];

            return (
              <div key={section.type}>
                <h3
                  className={`text-sm font-medium mb-2 flex items-center gap-2 ${config.color}`}
                >
                  <GitBranch className="w-4 h-4" />
                  {config.label} ({section.items.length})
                </h3>
                <div className="space-y-2">
                  {section.items.map((rel, idx) => (
                    <div
                      key={rel.taskId || `${section.type}-${idx}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 group transition-colors"
                    >
                      <div
                        className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                        onClick={() => onTaskClick?.(rel.taskId)}
                      >
                        <span className="font-mono text-xs text-primary-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                          {rel.displayId || rel.taskId?.slice(0, 8) || "N/A"}
                        </span>
                        <span className="text-gray-700 truncate">
                          {rel.title || "Untitled task"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            rel.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : rel.status === "in_progress"
                                ? "bg-blue-100 text-blue-700"
                                : rel.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : rel.status === "blocked"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {(rel.status || "pending").replace(/_/g, " ")}
                        </span>
                        {onTaskClick && (
                          <button
                            onClick={() => onTaskClick(rel.taskId)}
                            className="p-1 text-gray-400 hover:text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            onClick={() =>
                              handleRemoveDependency(rel.taskId, section.type)
                            }
                            disabled={removing === rel.taskId}
                            className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                          >
                            {removing === rel.taskId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
