/**
 * ConflictListPanel Component
 *
 * Shows a list of conflicts with details and suggested resolutions.
 * Displayed inline below ParallelismControls when conflicts badge is clicked.
 */

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileWarning,
  GitBranch,
  X,
} from "lucide-react";

export interface ConflictItem {
  id: string;
  taskAId: string;
  taskADisplayId: string;
  taskATitle: string;
  taskBId: string;
  taskBDisplayId: string;
  taskBTitle: string;
  conflictType: "file_conflict" | "dependency" | "resource_lock";
  details: string;
  filePath?: string;
  operationA?: string;
  operationB?: string;
  allFileConflicts?: Array<{
    filePath: string;
    operationA: string;
    operationB: string;
  }>;
}

interface ConflictListPanelProps {
  conflicts: ConflictItem[];
  onClose: () => void;
  onTaskClick?: (taskId: string) => void;
}

export default function ConflictListPanel({
  conflicts,
  onClose,
  onTaskClick,
}: ConflictListPanelProps) {
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(
    new Set(),
  );

  const toggleExpanded = (id: string) => {
    setExpandedConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getConflictIcon = (type: string) => {
    switch (type) {
      case "dependency":
        return <GitBranch className="w-4 h-4" />;
      case "file_conflict":
        return <FileWarning className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getResolutionSuggestion = (conflict: ConflictItem): string => {
    if (conflict.conflictType === "dependency") {
      return "These tasks have a dependency relationship. They will run in sequence automatically.";
    }

    if (conflict.conflictType === "file_conflict") {
      if (
        conflict.operationA === "CREATE" &&
        conflict.operationB === "CREATE"
      ) {
        return "Both tasks create the same file. Consider merging them or renaming one file.";
      }
      if (
        conflict.operationA === "UPDATE" ||
        conflict.operationB === "UPDATE"
      ) {
        return "Both tasks modify the same file. Add a dependency to ensure correct ordering.";
      }
      if (
        conflict.operationA === "DELETE" ||
        conflict.operationB === "DELETE"
      ) {
        return "One task deletes a file the other needs. Add a dependency or restructure tasks.";
      }
    }

    return "Review the tasks and add dependencies if needed to ensure correct execution order.";
  };

  if (conflicts.length === 0) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-3">
        <div className="flex items-center gap-2 text-green-700">
          <span className="text-lg">✓</span>
          <span className="font-medium">No conflicts detected</span>
        </div>
        <p className="text-sm text-green-600 mt-1">
          All tasks can potentially run in parallel (subject to dependencies).
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span className="font-medium text-amber-800">
            {conflicts.length} Conflict{conflicts.length !== 1 ? "s" : ""}{" "}
            Detected
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Conflict List */}
      <div className="max-h-80 overflow-y-auto">
        {conflicts.map((conflict) => {
          const isExpanded = expandedConflicts.has(conflict.id);
          const hasMultipleFiles = (conflict.allFileConflicts?.length || 0) > 1;

          return (
            <div
              key={conflict.id}
              className="border-b border-gray-100 last:border-b-0"
            >
              {/* Conflict Header Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpanded(conflict.id)}
              >
                <button className="text-gray-400 hover:text-gray-600">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                <span
                  className={`p-1.5 rounded ${
                    conflict.conflictType === "dependency"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {getConflictIcon(conflict.conflictType)}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick?.(conflict.taskAId);
                      }}
                      className="font-mono text-xs px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                      {conflict.taskADisplayId}
                    </button>
                    <span className="text-red-500 font-bold">✗</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick?.(conflict.taskBId);
                      }}
                      className="font-mono text-xs px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                      {conflict.taskBDisplayId}
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {conflict.details}
                  </div>
                </div>

                {hasMultipleFiles && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {conflict.allFileConflicts?.length} files
                  </span>
                )}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-3 pl-12 space-y-3">
                  {/* Task Titles */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Task A: </span>
                      <span className="text-gray-700">
                        {conflict.taskATitle}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Task B: </span>
                      <span className="text-gray-700">
                        {conflict.taskBTitle}
                      </span>
                    </div>
                  </div>

                  {/* File Conflicts */}
                  {conflict.allFileConflicts &&
                    conflict.allFileConflicts.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-medium text-gray-600">
                          Conflicting Files:
                        </div>
                        {conflict.allFileConflicts.map((fc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5"
                          >
                            <code className="flex-1 text-gray-700 truncate">
                              {fc.filePath}
                            </code>
                            <span className="text-amber-600 font-medium">
                              {fc.operationA}
                            </span>
                            <span className="text-gray-400">vs</span>
                            <span className="text-amber-600 font-medium">
                              {fc.operationB}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Resolution Suggestion */}
                  <div className="bg-blue-50 rounded-lg px-3 py-2">
                    <div className="text-xs font-medium text-blue-700 mb-1">
                      Suggested Resolution:
                    </div>
                    <div className="text-xs text-blue-600">
                      {getResolutionSuggestion(conflict)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Click a task ID to view details. Conflicts are automatically handled
          by assigning tasks to different execution waves.
        </p>
      </div>
    </div>
  );
}
