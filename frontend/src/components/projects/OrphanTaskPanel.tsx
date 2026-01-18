/**
 * OrphanTaskPanel - Enhanced orphan task management with AI link suggestions
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Link2Off,
  Sparkles,
  Link2,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import type { OrphanTask } from "../../hooks/useTraceability";

const API_BASE = "http://localhost:3001";

interface LinkSuggestion {
  taskId: string;
  requirementRef: string;
  sectionType: string;
  itemIndex: number;
  requirementContent: string;
  linkType: "implements" | "tests" | "related";
  confidence: number;
  reasoning: string;
}

interface OrphanTaskPanelProps {
  orphanTasks: OrphanTask[];
  projectId: string;
  projectSlug: string;
  onLinkApplied?: () => void;
  onTaskDismissed?: () => void;
}

const linkTypeLabels: Record<string, { label: string; color: string }> = {
  implements: { label: "Implements", color: "bg-purple-100 text-purple-700" },
  tests: { label: "Tests", color: "bg-cyan-100 text-cyan-700" },
  related: { label: "Related", color: "bg-gray-100 text-gray-700" },
};

export default function OrphanTaskPanel({
  orphanTasks,
  projectId,
  projectSlug,
  onLinkApplied,
  onTaskDismissed,
}: OrphanTaskPanelProps) {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Record<string, LinkSuggestion[]>
  >({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<string | null>(
    null,
  );
  const [applyingLink, setApplyingLink] = useState<string | null>(null);
  const [dismissingTask, setDismissingTask] = useState<string | null>(null);

  const handleGetSuggestions = useCallback(
    async (taskId: string) => {
      setLoadingSuggestions(taskId);
      try {
        const response = await fetch(
          `${API_BASE}/api/projects/${projectId}/orphans/${taskId}/suggest-links`,
          { method: "POST" },
        );

        if (response.ok) {
          const data = await response.json();
          setSuggestions((prev) => ({
            ...prev,
            [taskId]: data.suggestions || [],
          }));
        }
      } catch (error) {
        console.error("Error getting suggestions:", error);
      } finally {
        setLoadingSuggestions(null);
      }
    },
    [projectId],
  );

  const handleApplyLink = useCallback(
    async (taskId: string, suggestion: LinkSuggestion) => {
      setApplyingLink(`${taskId}-${suggestion.requirementRef}`);
      try {
        const response = await fetch(
          `${API_BASE}/api/projects/${projectId}/orphans/${taskId}/apply-link`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requirementRef: suggestion.requirementRef,
              linkType: suggestion.linkType,
            }),
          },
        );

        if (response.ok) {
          // Remove from suggestions
          setSuggestions((prev) => {
            const updated = { ...prev };
            delete updated[taskId];
            return updated;
          });
          onLinkApplied?.();
        }
      } catch (error) {
        console.error("Error applying link:", error);
      } finally {
        setApplyingLink(null);
      }
    },
    [projectId, onLinkApplied],
  );

  const handleDismiss = useCallback(
    async (taskId: string) => {
      setDismissingTask(taskId);
      try {
        const response = await fetch(
          `${API_BASE}/api/projects/${projectId}/orphans/${taskId}/dismiss`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Intentionally unlinked" }),
          },
        );

        if (response.ok) {
          setSuggestions((prev) => {
            const updated = { ...prev };
            delete updated[taskId];
            return updated;
          });
          onTaskDismissed?.();
        }
      } catch (error) {
        console.error("Error dismissing task:", error);
      } finally {
        setDismissingTask(null);
      }
    },
    [projectId, onTaskDismissed],
  );

  if (orphanTasks.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-amber-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200 rounded-t-lg">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-amber-600" />
          ) : (
            <ChevronUp className="h-4 w-4 text-amber-600" />
          )}
          <Link2Off className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-800">Orphan Tasks</h3>
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 rounded-full">
            {orphanTasks.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          <p className="text-xs text-amber-700 mb-3">
            These tasks are not linked to any PRD requirement. Use AI to suggest
            links or dismiss if intentionally unlinked.
          </p>

          {orphanTasks.map((task) => {
            const isExpanded = expandedTask === task.id;
            const taskSuggestions = suggestions[task.id] || [];
            const isLoadingThis = loadingSuggestions === task.id;
            const isDismissingThis = dismissingTask === task.id;

            return (
              <div
                key={task.id}
                className={clsx(
                  "border rounded-lg transition-all",
                  isExpanded
                    ? "border-amber-300 bg-amber-50"
                    : "border-gray-200",
                )}
              >
                {/* Task header */}
                <div className="p-3 flex items-start gap-3">
                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500">
                        {task.displayId}
                      </span>
                      <span
                        className={clsx(
                          "text-xs px-1.5 py-0.5 rounded capitalize",
                          task.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : task.status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700",
                        )}
                      >
                        {task.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 line-clamp-2">
                      {task.title}
                    </p>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(
                          `/projects/${projectSlug}/build?task=${task.id}`,
                        );
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      title="View task"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(task.id);
                      }}
                      disabled={isDismissingThis}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Dismiss (intentionally unlinked)"
                    >
                      {isDismissingThis ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-amber-200">
                    <div className="pt-3 space-y-3">
                      {/* Get suggestions button */}
                      {taskSuggestions.length === 0 && (
                        <button
                          onClick={() => handleGetSuggestions(task.id)}
                          disabled={isLoadingThis}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white hover:bg-primary-700 rounded disabled:opacity-50"
                        >
                          {isLoadingThis ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Finding matches...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Suggest Links
                            </>
                          )}
                        </button>
                      )}

                      {/* Suggestions */}
                      {taskSuggestions.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-gray-700">
                            Suggested Links:
                          </h4>
                          {taskSuggestions.map((suggestion) => {
                            const isApplying =
                              applyingLink ===
                              `${task.id}-${suggestion.requirementRef}`;
                            const ltConfig =
                              linkTypeLabels[suggestion.linkType];

                            return (
                              <div
                                key={suggestion.requirementRef}
                                className="p-2 bg-white rounded border border-gray-200"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className={clsx(
                                          "text-xs px-1.5 py-0.5 rounded",
                                          ltConfig.color,
                                        )}
                                      >
                                        {ltConfig.label}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        {suggestion.confidence}% confident
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-600 line-clamp-2">
                                      {suggestion.requirementContent}
                                    </p>
                                    {suggestion.reasoning && (
                                      <p className="text-xs text-gray-400 mt-1 italic">
                                        {suggestion.reasoning}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleApplyLink(task.id, suggestion)
                                    }
                                    disabled={isApplying}
                                    className="flex-shrink-0 p-1.5 bg-primary-600 text-white hover:bg-primary-700 rounded disabled:opacity-50"
                                    title="Apply link"
                                  >
                                    {isApplying ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Link2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* No suggestions found */}
                      {taskSuggestions.length === 0 &&
                        !isLoadingThis &&
                        suggestions[task.id] !== undefined && (
                          <div className="text-center py-4 text-gray-500">
                            <Check className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">
                              No matching requirements found
                            </p>
                            <p className="text-xs">
                              This task may be intentionally unlinked
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
