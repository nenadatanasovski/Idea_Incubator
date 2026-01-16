/**
 * EvaluationQueueLane Component
 *
 * Kanban-style lane for the Evaluation Queue showing listless tasks
 * awaiting analysis and grouping.
 *
 * Features:
 * - Shows tasks in Evaluation Queue
 * - Displays related task count
 * - Shows grouping suggestions with accept/reject
 * - Highlights stale tasks (>3 days)
 * - Supports drag-to-list functionality
 *
 * Part of: PTE-086 to PTE-090
 */

import { useState, useEffect, useCallback } from "react";
import {
  Inbox,
  AlertTriangle,
  Clock,
  Link2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  FolderPlus,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type {
  EvaluationQueueTask,
  GroupingSuggestion,
  EvaluationQueueStats,
  taskStatusConfig,
} from "../../types/task-agent";

interface EvaluationQueueLaneProps {
  /** Callback when task is moved to a list */
  onMoveToList?: (taskId: string, taskListId: string) => void;
  /** Available task lists for move operation */
  taskLists?: Array<{ id: string; name: string }>;
  /** Whether to show collapsed by default */
  defaultCollapsed?: boolean;
  /** Callback when grouping suggestion is accepted */
  onAcceptSuggestion?: (suggestion: GroupingSuggestion) => void;
  /** Callback when grouping suggestion is rejected */
  onRejectSuggestion?: (suggestionId: string) => void;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
}

export default function EvaluationQueueLane({
  onMoveToList,
  taskLists = [],
  defaultCollapsed = false,
  onAcceptSuggestion,
  onRejectSuggestion,
  refreshInterval = 30000,
}: EvaluationQueueLaneProps): JSX.Element {
  const [tasks, setTasks] = useState<EvaluationQueueTask[]>([]);
  const [stats, setStats] = useState<EvaluationQueueStats | null>(null);
  const [suggestions, setSuggestions] = useState<GroupingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [selectedTask, setSelectedTask] = useState<EvaluationQueueTask | null>(
    null,
  );
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Fetch queue data
  const fetchQueueData = useCallback(async () => {
    try {
      const [tasksRes, statsRes, suggestionsRes] = await Promise.all([
        fetch("/api/task-agent/evaluation-queue"),
        fetch("/api/task-agent/evaluation-queue/stats"),
        fetch("/api/task-agent/grouping-suggestions?status=pending"),
      ]);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        setSuggestions(suggestionsData);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch queue");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchQueueData();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchQueueData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchQueueData, refreshInterval]);

  // Accept grouping suggestion
  const handleAcceptSuggestion = async (suggestion: GroupingSuggestion) => {
    setActionInProgress(suggestion.id);
    try {
      const response = await fetch(
        `/api/task-agent/grouping-suggestions/${suggestion.id}/accept`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to accept suggestion");
      }

      // Remove from local state
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));

      // Refresh queue
      await fetchQueueData();

      onAcceptSuggestion?.(suggestion);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to accept suggestion",
      );
    } finally {
      setActionInProgress(null);
    }
  };

  // Reject grouping suggestion
  const handleRejectSuggestion = async (suggestionId: string) => {
    setActionInProgress(suggestionId);
    try {
      const response = await fetch(
        `/api/task-agent/grouping-suggestions/${suggestionId}/reject`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to reject suggestion");
      }

      // Remove from local state
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));

      onRejectSuggestion?.(suggestionId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reject suggestion",
      );
    } finally {
      setActionInProgress(null);
    }
  };

  // Move task to list
  const handleMoveToList = async (taskId: string, taskListId: string) => {
    setActionInProgress(taskId);
    try {
      const response = await fetch(`/api/task-agent/tasks/${taskId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskListId }),
      });

      if (!response.ok) {
        throw new Error("Failed to move task");
      }

      // Remove from local state
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      onMoveToList?.(taskId, taskListId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move task");
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="bg-gradient-to-b from-indigo-50 to-white rounded-lg border border-indigo-200 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between border-b border-indigo-200 hover:bg-indigo-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Inbox className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Evaluation Queue</h3>
            <p className="text-xs text-gray-500">
              {tasks.length} task{tasks.length !== 1 ? "s" : ""} awaiting
              analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats?.staleCount ? (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              <AlertTriangle className="h-3 w-3" />
              {stats.staleCount} stale
            </span>
          ) : null}
          {suggestions.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              <FolderPlus className="h-3 w-3" />
              {suggestions.length} suggestion
              {suggestions.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
            {tasks.length}
          </span>
          {collapsed ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Stats bar */}
          {stats && (
            <div className="flex items-center gap-4 text-xs text-gray-500 pb-3 border-b">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Avg: {stats.avgDaysInQueue.toFixed(1)} days
              </span>
              <span>New today: {stats.newToday}</span>
              <button
                onClick={() => fetchQueueData()}
                className="ml-auto flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
              >
                <RefreshCw
                  className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && tasks.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Grouping Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FolderPlus className="h-4 w-4 text-green-600" />
                Grouping Suggestions
              </h4>
              {suggestions.map((suggestion) => (
                <GroupingSuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => handleAcceptSuggestion(suggestion)}
                  onReject={() => handleRejectSuggestion(suggestion.id)}
                  isLoading={actionInProgress === suggestion.id}
                />
              ))}
            </div>
          )}

          {/* Task list */}
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((task) => (
                <QueueTaskCard
                  key={task.id}
                  task={task}
                  taskLists={taskLists}
                  onMoveToList={(listId) => handleMoveToList(task.id, listId)}
                  isSelected={selectedTask?.id === task.id}
                  onClick={() =>
                    setSelectedTask(selectedTask?.id === task.id ? null : task)
                  }
                  isLoading={actionInProgress === task.id}
                />
              ))}
            </div>
          ) : (
            !loading && (
              <div className="text-center py-8 text-gray-500">
                <Inbox className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No tasks in queue</p>
                <p className="text-xs text-gray-400">
                  Use Quick Add to create new tasks
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// Queue Task Card Component
interface QueueTaskCardProps {
  task: EvaluationQueueTask;
  taskLists: Array<{ id: string; name: string }>;
  onMoveToList: (listId: string) => void;
  isSelected: boolean;
  onClick: () => void;
  isLoading: boolean;
}

function QueueTaskCard({
  task,
  taskLists,
  onMoveToList,
  isSelected,
  onClick,
  isLoading,
}: QueueTaskCardProps): JSX.Element {
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);

  return (
    <div
      className={`bg-white rounded-lg border transition-all ${
        isSelected
          ? "border-indigo-300 shadow-md ring-2 ring-indigo-100"
          : "border-gray-200 hover:shadow"
      } ${task.isStale ? "border-l-4 border-l-amber-400" : ""}`}
    >
      <button
        onClick={onClick}
        className="w-full p-3 text-left"
        disabled={isLoading}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-xs font-mono bg-gray-100 text-gray-600 rounded">
                {task.displayId}
              </span>
              {task.isStale && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                  <AlertTriangle className="h-3 w-3" />
                  {task.daysInQueue}d
                </span>
              )}
              {task.category && (
                <span className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded">
                  {task.category}
                </span>
              )}
            </div>
            <p className="font-medium text-gray-900 truncate">{task.title}</p>
            {task.description && (
              <p className="text-sm text-gray-500 truncate mt-0.5">
                {task.description}
              </p>
            )}
          </div>
          {task.relatedTaskCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
              <Link2 className="h-3 w-3" />
              {task.relatedTaskCount}
            </span>
          )}
        </div>
      </button>

      {/* Expanded actions */}
      {isSelected && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {/* Move to list dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderPlus className="h-4 w-4" />
                )}
                Move to List
                <ChevronDown className="h-3 w-3" />
              </button>

              {showMoveDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
                  {taskLists.length > 0 ? (
                    taskLists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => {
                          onMoveToList(list.id);
                          setShowMoveDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {list.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No task lists available
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* View related tasks */}
            {task.relatedTaskCount > 0 && (
              <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                <Link2 className="h-4 w-4" />
                View Related ({task.relatedTaskCount})
              </button>
            )}

            {/* Time in queue */}
            <span className="ml-auto text-xs text-gray-400">
              Added {new Date(task.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Grouping Suggestion Card Component
interface GroupingSuggestionCardProps {
  suggestion: GroupingSuggestion;
  onAccept: () => void;
  onReject: () => void;
  isLoading: boolean;
}

function GroupingSuggestionCard({
  suggestion,
  onAccept,
  onReject,
  isLoading,
}: GroupingSuggestionCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-green-50 rounded-lg border border-green-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FolderPlus className="h-4 w-4 text-green-600" />
            <span className="font-medium text-gray-900">
              {suggestion.suggestedListName}
            </span>
            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
              {suggestion.taskCount} tasks
            </span>
            <span className="px-1.5 py-0.5 text-xs bg-white text-gray-600 rounded">
              Score: {Math.round(suggestion.score * 100)}%
            </span>
          </div>
          <p className="text-sm text-gray-600">{suggestion.reasoning}</p>

          {/* Task list preview */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {expanded ? "Hide" : "Show"} tasks
          </button>

          {expanded && (
            <div className="mt-2 space-y-1">
              {suggestion.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 text-xs text-gray-600"
                >
                  <span className="font-mono bg-white px-1 rounded">
                    {task.displayId}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onAccept}
            disabled={isLoading}
            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
            title="Accept suggestion"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onReject}
            disabled={isLoading}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Reject suggestion"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { EvaluationQueueLane, QueueTaskCard, GroupingSuggestionCard };
