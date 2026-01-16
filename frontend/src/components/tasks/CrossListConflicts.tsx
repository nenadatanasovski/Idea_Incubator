/**
 * CrossListConflicts Component
 *
 * Displays file conflicts detected between multiple executing task lists.
 * Helps users understand why certain task lists cannot run concurrently.
 *
 * Features:
 * - Visual conflict matrix
 * - Conflict details with affected tasks
 * - Resolution suggestions
 * - Integration with orchestrator status
 *
 * Part of: PTE-139
 */

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  FileWarning,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Layers,
  File,
  GitBranch,
} from "lucide-react";

interface CrossListConflict {
  listAId: string;
  listAName: string;
  listBId: string;
  listBName: string;
  taskAId: string;
  taskADisplayId: string;
  taskBId: string;
  taskBDisplayId: string;
  filePath: string;
  operationA: string;
  operationB: string;
  conflictType: string;
}

interface CrossListConflictsProps {
  /** Task list ID to check conflicts for */
  taskListId: string;
  /** Task list name */
  taskListName?: string;
  /** Compact mode (show only count) */
  compact?: boolean;
  /** Called when conflicts are loaded */
  onConflictsLoaded?: (hasConflicts: boolean, count: number) => void;
}

// Conflict type descriptions
const CONFLICT_DESCRIPTIONS: Record<
  string,
  { label: string; severity: "high" | "medium" | "low" }
> = {
  create_create: {
    label: "Both tasks try to create the same file",
    severity: "high",
  },
  write_write: { label: "Both tasks modify the same file", severity: "high" },
  create_delete: {
    label: "One task creates, another deletes",
    severity: "high",
  },
  write_delete: {
    label: "One task modifies, another deletes",
    severity: "high",
  },
  delete_delete: {
    label: "Both tasks try to delete the same file",
    severity: "medium",
  },
  read_delete: {
    label: "One task reads a file another deletes",
    severity: "medium",
  },
};

// Severity colors
const SEVERITY_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function CrossListConflicts({
  taskListId,
  taskListName: _taskListName,
  compact = false,
  onConflictsLoaded,
}: CrossListConflictsProps): JSX.Element {
  // taskListName is available for future use
  void _taskListName;
  const [conflicts, setConflicts] = useState<CrossListConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(
    new Set(),
  );

  // Fetch conflicts
  const fetchConflicts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/task-agent/orchestrator/conflicts/${taskListId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch conflicts");
      }
      const data = await response.json();
      setConflicts(data.conflicts || []);
      onConflictsLoaded?.(data.hasConflicts, data.conflicts?.length || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [taskListId, onConflictsLoaded]);

  // Initial fetch
  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  // Toggle conflict expansion
  const toggleConflict = (id: string) => {
    const newExpanded = new Set(expandedConflicts);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedConflicts(newExpanded);
  };

  // Group conflicts by list pair
  const groupedConflicts = conflicts.reduce(
    (acc, conflict) => {
      const key = `${conflict.listAId}-${conflict.listBId}`;
      if (!acc[key]) {
        acc[key] = {
          listAName: conflict.listAName,
          listBName: conflict.listBName,
          conflicts: [],
        };
      }
      acc[key].conflicts.push(conflict);
      return acc;
    },
    {} as Record<
      string,
      { listAName: string; listBName: string; conflicts: CrossListConflict[] }
    >,
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={fetchConflicts}
          className="mt-2 text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  // No conflicts
  if (conflicts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 py-2">
        <File className="h-4 w-4" />
        <span>No cross-list conflicts detected</span>
      </div>
    );
  }

  // Compact view
  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100 transition-colors w-full"
      >
        <FileWarning className="h-4 w-4" />
        <span className="text-sm font-medium">
          {conflicts.length} Cross-List Conflict
          {conflicts.length !== 1 ? "s" : ""}
        </span>
        <ChevronDown className="h-4 w-4 ml-auto" />
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-red-600" />
          <h3 className="font-semibold text-gray-900">
            Cross-List Conflicts ({conflicts.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConflicts}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {compact && (
            <button
              onClick={() => setExpanded(false)}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Warning message */}
      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-sm text-amber-700">
          These conflicts prevent concurrent execution of the affected task
          lists. Resolve by adjusting task order, file impacts, or running lists
          sequentially.
        </p>
      </div>

      {/* Grouped conflicts */}
      <div className="space-y-3">
        {Object.entries(groupedConflicts).map(([key, group]) => (
          <div
            key={key}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            {/* Group header */}
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-700">
                  {group.listAName}
                </span>
                <GitBranch className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-700">
                  {group.listBName}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {group.conflicts.length} conflict
                {group.conflicts.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Conflict list */}
            <div className="divide-y">
              {group.conflicts.map((conflict, idx) => {
                const id = `${key}-${idx}`;
                const isExpanded = expandedConflicts.has(id);
                const conflictInfo = CONFLICT_DESCRIPTIONS[
                  conflict.conflictType
                ] || {
                  label: conflict.conflictType,
                  severity: "medium" as const,
                };

                return (
                  <div key={id}>
                    <button
                      onClick={() => toggleConflict(id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <File className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-mono text-gray-600 truncate max-w-xs">
                          {conflict.filePath}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded border ${
                            SEVERITY_COLORS[conflictInfo.severity]
                          }`}
                        >
                          {conflict.operationA} / {conflict.operationB}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2">
                        <p className="text-sm text-gray-600">
                          {conflictInfo.label}
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="p-2 bg-gray-50 rounded">
                            <p className="text-gray-500">
                              From {group.listAName}
                            </p>
                            <p className="font-mono text-gray-700">
                              {conflict.taskADisplayId}
                            </p>
                            <p className="text-gray-500">
                              Operation:{" "}
                              <span className="text-gray-700">
                                {conflict.operationA}
                              </span>
                            </p>
                          </div>
                          <div className="p-2 bg-gray-50 rounded">
                            <p className="text-gray-500">
                              From {group.listBName}
                            </p>
                            <p className="font-mono text-gray-700">
                              {conflict.taskBDisplayId}
                            </p>
                            <p className="text-gray-500">
                              Operation:{" "}
                              <span className="text-gray-700">
                                {conflict.operationB}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { CrossListConflicts };
