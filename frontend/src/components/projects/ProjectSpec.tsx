/**
 * ProjectSpec - Specification sub-tab content
 * Shows spec sections with workflow controls
 */

import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Archive,
  Send,
  ThumbsUp,
  RotateCcw,
  Edit3,
  Save,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { ProjectWithStats } from "../../../../types/project";

const API_BASE = "http://localhost:3001";

interface OutletContext {
  project: ProjectWithStats;
}

interface SpecSection {
  id: string;
  specId: string;
  sectionType: string;
  title: string;
  content: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

interface Spec {
  id: string;
  sessionId: string;
  ideaId?: string;
  workflowState: "draft" | "review" | "approved" | "archived";
  createdAt: string;
  updatedAt: string;
}

const workflowStateConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: typeof FileText }
> = {
  draft: {
    label: "Draft",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: Edit3,
  },
  review: {
    label: "In Review",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CheckCircle2,
  },
  archived: {
    label: "Archived",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    icon: Archive,
  },
};

export default function ProjectSpec() {
  const { project } = useOutletContext<OutletContext>();

  const [spec, setSpec] = useState<Spec | null>(null);
  const [sections, setSections] = useState<SpecSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Fetch spec for this project's idea
  const fetchSpec = useCallback(async () => {
    if (!project.ideaId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First get ideation sessions for this idea
      const sessionsRes = await fetch(
        `${API_BASE}/api/ideation/sessions?ideaId=${project.ideaId}`,
      );
      if (!sessionsRes.ok) {
        throw new Error("Failed to fetch sessions");
      }

      const sessionsData = await sessionsRes.json();
      const sessions = sessionsData.sessions || [];

      if (sessions.length === 0) {
        setSpec(null);
        setSections([]);
        setIsLoading(false);
        return;
      }

      // Get spec for the first session
      const sessionId = sessions[0].id;
      const specRes = await fetch(`${API_BASE}/api/specs/session/${sessionId}`);

      if (specRes.status === 404) {
        setSpec(null);
        setSections([]);
        setIsLoading(false);
        return;
      }

      if (!specRes.ok) {
        throw new Error("Failed to fetch spec");
      }

      const specData = await specRes.json();
      setSpec(specData.spec);
      setSections(specData.sections || []);

      // Expand first section by default
      if (specData.sections?.length > 0) {
        setExpandedSections(new Set([specData.sections[0].id]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch spec");
    } finally {
      setIsLoading(false);
    }
  }, [project.ideaId]);

  useEffect(() => {
    fetchSpec();
  }, [fetchSpec]);

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Start editing a section
  const startEditing = (section: SpecSection) => {
    setEditingSection(section.id);
    setEditContent(section.content);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingSection(null);
    setEditContent("");
  };

  // Save section edit
  const saveSection = async (sectionId: string) => {
    if (!spec) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/specs/${spec.id}/sections/${sectionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update section");
      }

      // Update local state
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, content: editContent } : s,
        ),
      );
      setEditingSection(null);
      setEditContent("");
    } catch (err) {
      console.error("Failed to save section:", err);
    }
  };

  // Workflow actions
  const submitForReview = async () => {
    if (!spec) return;
    try {
      const res = await fetch(`${API_BASE}/api/specs/${spec.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setSpec(data.spec);
      }
    } catch (err) {
      console.error("Failed to submit for review:", err);
    }
  };

  const approve = async () => {
    if (!spec) return;
    try {
      const res = await fetch(`${API_BASE}/api/specs/${spec.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setSpec(data.spec);
      }
    } catch (err) {
      console.error("Failed to approve:", err);
    }
  };

  const requestChanges = async () => {
    if (!spec) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/specs/${spec.id}/request-changes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Needs revision" }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        setSpec(data.spec);
      }
    } catch (err) {
      console.error("Failed to request changes:", err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  // No linked idea
  if (!project.ideaId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Linked Idea
          </h3>
          <p className="text-gray-500">
            This project doesn't have a linked idea with a specification.
          </p>
        </div>
      </div>
    );
  }

  // No spec found
  if (!spec) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Specification Yet
          </h3>
          <p className="text-gray-500">
            Generate a specification from an ideation session to see it here.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const stateConfig = workflowStateConfig[spec.workflowState];
  const StateIcon = stateConfig.icon;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header with workflow state */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StateIcon className={clsx("h-5 w-5", stateConfig.color)} />
            <span
              className={clsx(
                "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
                stateConfig.bgColor,
                stateConfig.color,
              )}
            >
              {stateConfig.label}
            </span>
            <span className="text-sm text-gray-500">
              Last updated: {new Date(spec.updatedAt).toLocaleDateString()}
            </span>
          </div>

          {/* Workflow actions */}
          <div className="flex items-center gap-2">
            {spec.workflowState === "draft" && (
              <button
                onClick={submitForReview}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Send className="h-4 w-4" />
                Submit for Review
              </button>
            )}
            {spec.workflowState === "review" && (
              <>
                <button
                  onClick={requestChanges}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Request Changes
                </button>
                <button
                  onClick={approve}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Approve
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const isEditing = editingSection === section.id;

          return (
            <div
              key={section.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="font-medium text-gray-900">
                    {section.title}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {section.sectionType}
                  </span>
                </div>
              </button>

              {/* Section content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  {isEditing ? (
                    <div className="mt-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={cancelEditing}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                        <button
                          onClick={() => saveSection(section.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-3 rounded-lg overflow-auto">
                          {section.content}
                        </pre>
                      </div>
                      {spec.workflowState === "draft" && (
                        <button
                          onClick={() => startEditing(section)}
                          className="mt-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sections.length === 0 && (
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Sections Yet
          </h3>
          <p className="text-gray-500">
            This specification doesn't have any sections yet.
          </p>
        </div>
      )}
    </div>
  );
}
