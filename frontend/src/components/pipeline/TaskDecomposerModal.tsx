/**
 * TaskDecomposerModal Component
 *
 * Modal wrapper for task decomposition with enhanced editing capabilities.
 * Shows AC, test commands, file impacts, and dependencies per subtask.
 *
 * Reference: TASK-DECOMPOSITION-COMPREHENSIVE-PLAN.md Phase 3
 */

import { useState, useEffect } from "react";
import {
  X,
  Scissors,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  RefreshCw,
  Target,
  TestTube,
  FolderOpen,
  ArrowRight,
  Info,
} from "lucide-react";

interface ProposedSubtask {
  title: string;
  description?: string;
  category: string;
  estimatedEffort: string;
  fileImpacts: string[];
  acceptanceCriteria: string[];
  testCommands: string[];
  dependsOnIndex?: number;
}

interface DecompositionResult {
  originalTaskId: string;
  subtasks: ProposedSubtask[];
  reasoning: string;
  estimatedTotalEffort: string;
  contextUsed?: {
    prdsUsed: string[];
    criteriaDistributed: number;
    criteriaGenerated: number;
  };
}

interface TaskDecomposerModalProps {
  taskId: string;
  taskTitle: string;
  reason?: string[];
  onClose: () => void;
  onDecompose: (subtaskIds: string[]) => void;
}

export default function TaskDecomposerModal({
  taskId,
  taskTitle,
  reason: _reason = [],
  onClose,
  onDecompose,
}: TaskDecomposerModalProps) {
  const [decomposition, setDecomposition] =
    useState<DecompositionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedSubtasks, setEditedSubtasks] = useState<ProposedSubtask[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  // Generate decomposition on mount
  useEffect(() => {
    console.log("[TaskDecomposerModal] Mounted with taskId:", taskId);
    generateDecomposition();
  }, [taskId]);

  const generateDecomposition = async () => {
    console.log(
      "[TaskDecomposerModal] generateDecomposition called for taskId:",
      taskId,
    );
    try {
      setLoading(true);
      setError(null);
      console.log("[TaskDecomposerModal] Fetching decomposition...");
      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/decompose`,
        {
          method: "POST",
        },
      );

      console.log("[TaskDecomposerModal] Response status:", response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[TaskDecomposerModal] Error response:", errorData);
        throw new Error(
          errorData.message || "Failed to generate decomposition",
        );
      }

      const result = await response.json();
      console.log("[TaskDecomposerModal] Decomposition result:", result);
      setDecomposition(result);
      setEditedSubtasks(result.subtasks || []);
    } catch (err) {
      console.error("[TaskDecomposerModal] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const executeDecomposition = async () => {
    try {
      setExecuting(true);
      setError(null);

      const response = await fetch(
        `/api/task-agent/tasks/${taskId}/decompose/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subtasks: editedSubtasks }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create subtasks");
      }

      const result = await response.json();
      onDecompose(result.subtaskIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExecuting(false);
    }
  };

  const updateSubtask = (index: number, updates: Partial<ProposedSubtask>) => {
    const newSubtasks = [...editedSubtasks];
    newSubtasks[index] = { ...newSubtasks[index], ...updates };
    setEditedSubtasks(newSubtasks);
  };

  const removeSubtask = (index: number) => {
    const newSubtasks = editedSubtasks.filter((_, i) => i !== index);
    // Update dependsOnIndex for subtasks that depended on removed or later indexes
    newSubtasks.forEach((subtask) => {
      if (subtask.dependsOnIndex !== undefined) {
        if (subtask.dependsOnIndex === index) {
          subtask.dependsOnIndex = undefined;
        } else if (subtask.dependsOnIndex > index) {
          subtask.dependsOnIndex = subtask.dependsOnIndex - 1;
        }
      }
    });
    setEditedSubtasks(newSubtasks);
  };

  const addSubtask = () => {
    const newIndex = editedSubtasks.length;
    setEditedSubtasks([
      ...editedSubtasks,
      {
        title: "New Subtask",
        description: "",
        category: "feature",
        estimatedEffort: "small",
        fileImpacts: [],
        acceptanceCriteria: [],
        testCommands: ["npx tsc --noEmit"],
        dependsOnIndex: newIndex > 0 ? newIndex - 1 : undefined,
      },
    ]);
    setExpandedIndex(newIndex);
  };

  const addAcceptanceCriterion = (index: number, criterion: string) => {
    if (!criterion.trim()) return;
    const subtask = editedSubtasks[index];
    updateSubtask(index, {
      acceptanceCriteria: [...subtask.acceptanceCriteria, criterion.trim()],
    });
  };

  const removeAcceptanceCriterion = (
    subtaskIndex: number,
    criterionIndex: number,
  ) => {
    const subtask = editedSubtasks[subtaskIndex];
    updateSubtask(subtaskIndex, {
      acceptanceCriteria: subtask.acceptanceCriteria.filter(
        (_, i) => i !== criterionIndex,
      ),
    });
  };

  const addTestCommand = (index: number, command: string) => {
    if (!command.trim()) return;
    const subtask = editedSubtasks[index];
    updateSubtask(index, {
      testCommands: [...subtask.testCommands, command.trim()],
    });
  };

  const removeTestCommand = (subtaskIndex: number, commandIndex: number) => {
    const subtask = editedSubtasks[subtaskIndex];
    updateSubtask(subtaskIndex, {
      testCommands: subtask.testCommands.filter((_, i) => i !== commandIndex),
    });
  };

  const addFileImpact = (index: number, filePath: string) => {
    if (!filePath.trim()) return;
    const subtask = editedSubtasks[index];
    updateSubtask(index, {
      fileImpacts: [...subtask.fileImpacts, filePath.trim()],
    });
  };

  const removeFileImpact = (subtaskIndex: number, fileIndex: number) => {
    const subtask = editedSubtasks[subtaskIndex];
    updateSubtask(subtaskIndex, {
      fileImpacts: subtask.fileImpacts.filter((_, i) => i !== fileIndex),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-amber-600" />
              Split into Atomic Tasks
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">{taskTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mb-4" />
              <p className="text-gray-600">
                Analyzing task for atomic splitting...
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Decomposition Result */}
          {decomposition && !loading && (
            <div className="space-y-6">
              {/* Reasoning */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800 font-medium">
                      Why decompose?
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      {decomposition.reasoning}
                    </p>
                    {decomposition.contextUsed && (
                      <p className="text-xs text-blue-600 mt-2">
                        Context: {decomposition.contextUsed.criteriaDistributed}{" "}
                        criteria distributed,{" "}
                        {decomposition.contextUsed.criteriaGenerated} generated
                        {decomposition.contextUsed.prdsUsed.length > 0 &&
                          ` | PRDs: ${decomposition.contextUsed.prdsUsed.join(", ")}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Subtasks List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">
                    Proposed Subtasks ({editedSubtasks.length})
                  </h3>
                  <span className="text-sm text-gray-500">
                    Total effort: {decomposition.estimatedTotalEffort}
                  </span>
                </div>

                {editedSubtasks.map((subtask, index) => {
                  const isExpanded = expandedIndex === index;
                  const dependsOn =
                    subtask.dependsOnIndex !== undefined
                      ? editedSubtasks[subtask.dependsOnIndex]
                      : null;

                  return (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Subtask Header */}
                      <div className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <button
                          onClick={() =>
                            setExpandedIndex(isExpanded ? null : index)
                          }
                          className="flex-1 flex items-center gap-2 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-xs font-mono text-gray-400 w-6">
                            #{index + 1}
                          </span>
                          <span className="font-medium text-gray-900 flex-1 truncate">
                            {subtask.title}
                          </span>
                          <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-200 rounded">
                            {subtask.estimatedEffort}
                          </span>
                          <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-200 rounded">
                            {subtask.category}
                          </span>
                        </button>
                        <button
                          onClick={() => removeSubtask(index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Dependency indicator */}
                      {dependsOn && (
                        <div className="px-3 py-1.5 bg-gray-100 text-xs text-gray-600 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />
                          Depends on: #{(subtask.dependsOnIndex ?? 0) + 1}{" "}
                          {dependsOn.title}
                        </div>
                      )}

                      {/* Expanded Edit Form */}
                      {isExpanded && (
                        <div className="p-4 space-y-4 border-t border-gray-100">
                          {/* Title & Description */}
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title
                              </label>
                              <input
                                type="text"
                                value={subtask.title}
                                onChange={(e) =>
                                  updateSubtask(index, {
                                    title: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                              </label>
                              <textarea
                                value={subtask.description || ""}
                                onChange={(e) =>
                                  updateSubtask(index, {
                                    description: e.target.value,
                                  })
                                }
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              />
                            </div>
                          </div>

                          {/* Category, Effort, Dependency */}
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category
                              </label>
                              <select
                                value={subtask.category}
                                onChange={(e) =>
                                  updateSubtask(index, {
                                    category: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              >
                                <option value="feature">Feature</option>
                                <option value="bug">Bug Fix</option>
                                <option value="enhancement">Enhancement</option>
                                <option value="refactor">Refactor</option>
                                <option value="test">Test</option>
                                <option value="infrastructure">
                                  Infrastructure
                                </option>
                                <option value="design">Design</option>
                                <option value="research">Research</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Effort
                              </label>
                              <select
                                value={subtask.estimatedEffort}
                                onChange={(e) =>
                                  updateSubtask(index, {
                                    estimatedEffort: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              >
                                <option value="trivial">
                                  Trivial (~5 min)
                                </option>
                                <option value="small">Small (~15 min)</option>
                                <option value="medium">Medium (~30 min)</option>
                                <option value="large">Large (~1 hour)</option>
                                <option value="epic">Epic (~2+ hours)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Depends On
                              </label>
                              <select
                                value={subtask.dependsOnIndex ?? ""}
                                onChange={(e) =>
                                  updateSubtask(index, {
                                    dependsOnIndex:
                                      e.target.value === ""
                                        ? undefined
                                        : parseInt(e.target.value, 10),
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                              >
                                <option value="">None</option>
                                {editedSubtasks.map((s, i) =>
                                  i !== index ? (
                                    <option key={i} value={i}>
                                      #{i + 1} {s.title.slice(0, 30)}
                                    </option>
                                  ) : null,
                                )}
                              </select>
                            </div>
                          </div>

                          {/* Acceptance Criteria */}
                          <EditableList
                            icon={<Target className="w-4 h-4 text-green-600" />}
                            title="Acceptance Criteria"
                            items={subtask.acceptanceCriteria}
                            onAdd={(item) =>
                              addAcceptanceCriterion(index, item)
                            }
                            onRemove={(itemIndex) =>
                              removeAcceptanceCriterion(index, itemIndex)
                            }
                            placeholder="Add acceptance criterion..."
                            emptyMessage="No acceptance criteria defined"
                          />

                          {/* Test Commands */}
                          <EditableList
                            icon={
                              <TestTube className="w-4 h-4 text-purple-600" />
                            }
                            title="Test Commands"
                            items={subtask.testCommands}
                            onAdd={(item) => addTestCommand(index, item)}
                            onRemove={(itemIndex) =>
                              removeTestCommand(index, itemIndex)
                            }
                            placeholder="Add test command..."
                            emptyMessage="No test commands defined"
                            mono
                          />

                          {/* File Impacts */}
                          <EditableList
                            icon={
                              <FolderOpen className="w-4 h-4 text-blue-600" />
                            }
                            title="File Impacts"
                            items={subtask.fileImpacts}
                            onAdd={(item) => addFileImpact(index, item)}
                            onRemove={(itemIndex) =>
                              removeFileImpact(index, itemIndex)
                            }
                            placeholder="Add file path..."
                            emptyMessage="No file impacts specified"
                            mono
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Subtask */}
              <button
                onClick={addSubtask}
                className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Subtask
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                console.log("[TaskDecomposer] Analyze again clicked");
                generateDecomposition();
              }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Analyzing..." : "Analyze Again"}
            </button>
          </div>

          <button
            onClick={executeDecomposition}
            disabled={executing || editedSubtasks.length === 0 || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {executing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Create {editedSubtasks.length} Subtask
            {editedSubtasks.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// Editable List Subcomponent
interface EditableListProps {
  icon: React.ReactNode;
  title: string;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  emptyMessage: string;
  mono?: boolean;
}

function EditableList({
  icon,
  title,
  items,
  onAdd,
  onRemove,
  placeholder,
  emptyMessage,
  mono = false,
}: EditableListProps) {
  const [newItem, setNewItem] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (newItem.trim()) {
      onAdd(newItem.trim());
      setNewItem("");
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <span className="text-xs text-gray-400">({items.length})</span>
      </div>

      {items.length === 0 && !isAdding ? (
        <p className="text-xs text-gray-400 italic pl-6">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1 pl-6">
          {items.map((item, i) => (
            <li
              key={i}
              className={`flex items-center justify-between text-sm group ${
                mono ? "font-mono text-xs" : ""
              }`}
            >
              <span className="text-gray-700 flex-1 truncate">{item}</span>
              <button
                onClick={() => onRemove(i)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <div className="flex items-center gap-2 pl-6">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={placeholder}
            className={`flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 ${
              mono ? "font-mono text-xs" : ""
            }`}
            autoFocus
          />
          <button
            onClick={handleAdd}
            className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
          >
            Add
          </button>
          <button
            onClick={() => {
              setIsAdding(false);
              setNewItem("");
            }}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 pl-6 text-xs text-gray-500 hover:text-gray-700"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      )}
    </div>
  );
}
