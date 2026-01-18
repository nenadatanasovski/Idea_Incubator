/**
 * TaskSpecLinkModal - Modal for linking a task to PRD requirements
 *
 * Allows selecting multiple requirements and link types.
 */

import { useState, useEffect } from "react";
import {
  X,
  Target,
  List,
  CheckCircle2,
  Loader2,
  Link2,
  Trash2,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";

const API_BASE = "http://localhost:3001";

interface PRDRequirement {
  sectionType: "success_criteria" | "constraints";
  index: number;
  content: string;
}

interface ExistingLink {
  id: string;
  prdId: string;
  requirementRef: string;
  linkType: string;
}

interface TaskSpecLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskDisplayId: string;
  projectId: string;
  onLinksUpdated?: () => void;
}

const linkTypes = [
  {
    value: "implements",
    label: "Implements",
    description: "Task implements this requirement",
  },
  {
    value: "tests",
    label: "Tests",
    description: "Task tests this requirement",
  },
  {
    value: "related",
    label: "Related",
    description: "Task is related to this requirement",
  },
];

export default function TaskSpecLinkModal({
  isOpen,
  onClose,
  taskId,
  taskDisplayId,
  projectId,
  onLinksUpdated,
}: TaskSpecLinkModalProps) {
  const [prdId, setPrdId] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<PRDRequirement[]>([]);
  const [existingLinks, setExistingLinks] = useState<ExistingLink[]>([]);
  const [selectedReqs, setSelectedReqs] = useState<Set<string>>(new Set());
  const [linkType, setLinkType] = useState<string>("implements");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch AI suggestions for linking
  const fetchSuggestions = async () => {
    setIsSuggesting(true);
    try {
      const response = await fetch(`${API_BASE}/api/ai/suggest-task-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get suggestions");
      }

      const data = await response.json();
      const suggestions = data.suggestions || [];

      // Auto-select suggested requirements
      const newSelected = new Set(selectedReqs);
      for (const suggestion of suggestions) {
        if (
          !existingLinks.some(
            (l) => l.requirementRef === suggestion.requirementRef,
          )
        ) {
          newSelected.add(suggestion.requirementRef);
          // Set link type from first suggestion if available
          if (suggestions.length > 0) {
            setLinkType(suggestions[0].linkType || "implements");
          }
        }
      }
      setSelectedReqs(newSelected);

      if (suggestions.length === 0) {
        alert("No AI suggestions found for this task.");
      } else {
        alert(
          `AI suggested ${suggestions.length} requirement(s). They have been pre-selected.`,
        );
      }
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to get AI suggestions",
      );
    } finally {
      setIsSuggesting(false);
    }
  };

  // Fetch PRD and existing links
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch PRD for project
        const prdRes = await fetch(
          `${API_BASE}/api/prds?projectId=${projectId}`,
        );
        if (!prdRes.ok) throw new Error("Failed to fetch PRD");
        const prdData = await prdRes.json();
        const prds = Array.isArray(prdData) ? prdData : prdData.prds || [];

        if (prds.length === 0) {
          setError("No PRD found for this project");
          setIsLoading(false);
          return;
        }

        const prd = prds[0];
        setPrdId(prd.id);

        // Build requirements list
        const reqs: PRDRequirement[] = [];

        if (prd.successCriteria) {
          prd.successCriteria.forEach(
            (sc: { criterion?: string } | string, idx: number) => {
              reqs.push({
                sectionType: "success_criteria",
                index: idx,
                content: typeof sc === "string" ? sc : sc.criterion || "",
              });
            },
          );
        }

        if (prd.constraints) {
          prd.constraints.forEach((c: string, idx: number) => {
            reqs.push({
              sectionType: "constraints",
              index: idx,
              content: c,
            });
          });
        }

        setRequirements(reqs);

        // Fetch existing links
        const linksRes = await fetch(
          `${API_BASE}/api/prd-tasks/by-task/${taskId}`,
        );
        if (linksRes.ok) {
          const links = await linksRes.json();
          setExistingLinks(links);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, projectId, taskId]);

  const getReqKey = (req: PRDRequirement) => `${req.sectionType}[${req.index}]`;

  const isAlreadyLinked = (req: PRDRequirement) =>
    existingLinks.some((l) => l.requirementRef === getReqKey(req));

  const toggleReq = (req: PRDRequirement) => {
    const key = getReqKey(req);
    setSelectedReqs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!prdId || selectedReqs.size === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      // Create links for all selected requirements
      for (const reqRef of selectedReqs) {
        const res = await fetch(`${API_BASE}/api/prd-tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            prdId,
            requirementRef: reqRef,
            linkType,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create link");
        }
      }

      onLinksUpdated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save links");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/prd-tasks/${linkId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setExistingLinks((prev) => prev.filter((l) => l.id !== linkId));
        onLinksUpdated?.();
      }
    } catch (err) {
      setError("Failed to delete link");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Link Task to Specifications
            </h2>
            <p className="text-sm text-gray-500">Task: {taskDisplayId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
          ) : (
            <>
              {/* Existing Links */}
              {existingLinks.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Existing Links
                  </h3>
                  <div className="space-y-2">
                    {existingLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {link.requirementRef}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            {link.linkType}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Suggestions */}
              <div className="mb-6">
                <button
                  onClick={fetchSuggestions}
                  disabled={isSuggesting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {isSuggesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isSuggesting ? "Getting Suggestions..." : "AI Suggest Links"}
                </button>
              </div>

              {/* Link Type Selection */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Link Type
                </h3>
                <div className="flex gap-2">
                  {linkTypes.map((lt) => (
                    <button
                      key={lt.value}
                      onClick={() => setLinkType(lt.value)}
                      className={clsx(
                        "px-4 py-2 text-sm rounded-lg transition-colors",
                        linkType === lt.value
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                      )}
                    >
                      {lt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Requirements Selection */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Select Requirements to Link
                </h3>
                <div className="space-y-4">
                  {/* Success Criteria */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Success Criteria
                      </span>
                    </div>
                    <div className="space-y-2 ml-6">
                      {requirements
                        .filter((r) => r.sectionType === "success_criteria")
                        .map((req) => {
                          const key = getReqKey(req);
                          const linked = isAlreadyLinked(req);
                          const selected = selectedReqs.has(key);
                          return (
                            <button
                              key={key}
                              onClick={() => !linked && toggleReq(req)}
                              disabled={linked}
                              className={clsx(
                                "w-full text-left p-3 rounded-lg border transition-colors",
                                linked
                                  ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
                                  : selected
                                    ? "bg-primary-50 border-primary-300"
                                    : "bg-white border-gray-200 hover:border-gray-300",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {selected && (
                                  <CheckCircle2 className="h-4 w-4 text-primary-600" />
                                )}
                                <span className="text-xs text-gray-500">
                                  #{req.index + 1}
                                </span>
                                {linked && (
                                  <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                                    Already linked
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                {req.content}
                              </p>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Constraints */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <List className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Constraints
                      </span>
                    </div>
                    <div className="space-y-2 ml-6">
                      {requirements
                        .filter((r) => r.sectionType === "constraints")
                        .map((req) => {
                          const key = getReqKey(req);
                          const linked = isAlreadyLinked(req);
                          const selected = selectedReqs.has(key);
                          return (
                            <button
                              key={key}
                              onClick={() => !linked && toggleReq(req)}
                              disabled={linked}
                              className={clsx(
                                "w-full text-left p-3 rounded-lg border transition-colors",
                                linked
                                  ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
                                  : selected
                                    ? "bg-primary-50 border-primary-300"
                                    : "bg-white border-gray-200 hover:border-gray-300",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {selected && (
                                  <CheckCircle2 className="h-4 w-4 text-primary-600" />
                                )}
                                <span className="text-xs text-gray-500">
                                  #{req.index + 1}
                                </span>
                                {linked && (
                                  <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                                    Already linked
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                                {req.content}
                              </p>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || selectedReqs.size === 0}
            className={clsx(
              "px-4 py-2 text-sm text-white rounded-lg transition-colors",
              isSaving || selectedReqs.size === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-primary-600 hover:bg-primary-700",
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Saving...
              </>
            ) : (
              `Link ${selectedReqs.size} Requirement${selectedReqs.size !== 1 ? "s" : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
