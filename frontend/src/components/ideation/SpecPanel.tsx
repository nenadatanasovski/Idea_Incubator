/**
 * SpecPanel Component
 *
 * Full-height panel for viewing and editing specs.
 * Shows all sections with edit capabilities and workflow actions.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-006-A)
 */

import React, { useState, useCallback } from "react";
import {
  FileText,
  Edit3,
  Save,
  X,
  Send,
  CheckCircle,
  Archive,
  ListTodo,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { SpecWorkflowBadge } from "./SpecWorkflowBadge";
import { SpecSectionEditor } from "./SpecSectionEditor";
import { SpecSectionList } from "./SpecSectionList";
import type { SpecPanelProps, SpecSectionType } from "../../types/spec";

// Section configuration for display
const SECTION_CONFIG: Record<
  SpecSectionType,
  { label: string; type: "text" | "list"; description: string }
> = {
  problem: {
    label: "Problem Statement",
    type: "text",
    description: "What problem are you solving?",
  },
  target_users: {
    label: "Target Users",
    type: "text",
    description: "Who will use this solution?",
  },
  functional_desc: {
    label: "Functional Description",
    type: "text",
    description: "How will the solution work?",
  },
  success_criteria: {
    label: "Success Criteria",
    type: "list",
    description: "How will you measure success?",
  },
  constraints: {
    label: "Constraints",
    type: "list",
    description: "What limitations exist?",
  },
  out_of_scope: {
    label: "Out of Scope",
    type: "list",
    description: "What is NOT included in this scope?",
  },
  risks: {
    label: "Risks",
    type: "list",
    description: "What could go wrong?",
  },
  assumptions: {
    label: "Assumptions",
    type: "list",
    description: "What are you assuming to be true?",
  },
};

// Section order for display
const SECTION_ORDER: SpecSectionType[] = [
  "problem",
  "target_users",
  "functional_desc",
  "success_criteria",
  "constraints",
  "out_of_scope",
  "risks",
  "assumptions",
];

export const SpecPanel: React.FC<SpecPanelProps> = ({
  spec,
  sections,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onTransition,
  onCreateTasks,
  isLoading = false,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTION_ORDER),
  );
  const [editedSections, setEditedSections] = useState<
    Map<string, string | string[]>
  >(new Map());
  const [saving, setSaving] = useState(false);

  // Toggle section expansion
  const toggleSection = useCallback((sectionType: SpecSectionType) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionType)) {
        next.delete(sectionType);
      } else {
        next.add(sectionType);
      }
      return next;
    });
  }, []);

  // Handle section content change
  const handleSectionChange = useCallback(
    (sectionId: string, content: string | string[]) => {
      setEditedSections((prev) => {
        const next = new Map(prev);
        next.set(sectionId, content);
        return next;
      });
    },
    [],
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (editedSections.size === 0) {
      onCancel();
      return;
    }

    setSaving(true);
    try {
      // Build updates object
      const updates: Record<string, unknown> = {};

      // Apply section edits
      editedSections.forEach((content, sectionId) => {
        const section = sections.find((s) => s.id === sectionId);
        if (section) {
          // Map section type to spec field
          const fieldMap: Record<SpecSectionType, string> = {
            problem: "problemStatement",
            target_users: "targetUsers",
            functional_desc: "functionalDescription",
            success_criteria: "successCriteria",
            constraints: "constraints",
            out_of_scope: "outOfScope",
            risks: "risks",
            assumptions: "assumptions",
          };
          const fieldName = fieldMap[section.sectionType];
          if (fieldName) {
            updates[fieldName] = content;
          }
        }
      });

      await onSave(updates);
      setEditedSections(new Map());
    } finally {
      setSaving(false);
    }
  }, [editedSections, sections, onSave, onCancel]);

  // Get section by type
  const getSection = useCallback(
    (sectionType: SpecSectionType) => {
      return sections.find((s) => s.sectionType === sectionType);
    },
    [sections],
  );

  // Check if any sections need review
  const sectionsNeedingReview = sections.filter((s) => s.needsReview);

  return (
    <div className="spec-panel h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {spec.title || "Specification"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <SpecWorkflowBadge state={spec.workflowState} size="sm" />
                <span className="text-xs text-gray-500">v{spec.version}</span>
                {sectionsNeedingReview.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {sectionsNeedingReview.length} need review
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={onCancel}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                {spec.workflowState === "draft" && (
                  <button
                    onClick={onEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                )}

                {spec.workflowState === "draft" && (
                  <button
                    onClick={() => onTransition("review")}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 rounded-md hover:bg-blue-50"
                  >
                    <Send className="w-4 h-4" />
                    Submit for Review
                  </button>
                )}

                {spec.workflowState === "review" && (
                  <>
                    <button
                      onClick={() => onTransition("draft")}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
                    >
                      Request Changes
                    </button>
                    <button
                      onClick={() => onTransition("approved")}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-green-600 rounded-md hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                  </>
                )}

                {spec.workflowState === "approved" && (
                  <>
                    <button
                      onClick={onCreateTasks}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700"
                    >
                      <ListTodo className="w-4 h-4" />
                      Create Tasks
                    </button>
                    <button
                      onClick={() => onTransition("archived")}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
                    >
                      <Archive className="w-4 h-4" />
                      Archive
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {SECTION_ORDER.map((sectionType) => {
          const section = getSection(sectionType);
          const config = SECTION_CONFIG[sectionType];
          const isExpanded = expandedSections.has(sectionType);

          return (
            <div
              key={sectionType}
              className={`border rounded-lg ${
                section?.needsReview
                  ? "border-amber-300 bg-amber-50/50"
                  : "border-gray-200"
              }`}
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(sectionType)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium text-gray-800">
                    {config.label}
                  </span>
                  {section?.needsReview && (
                    <span className="px-1.5 py-0.5 text-xs bg-amber-200 text-amber-800 rounded">
                      Needs Review
                    </span>
                  )}
                </div>
                {section && (
                  <span className="text-xs text-gray-400">
                    {section.confidenceScore}% confidence
                  </span>
                )}
              </button>

              {/* Section content */}
              {isExpanded && (
                <div className="p-3 pt-0">
                  <p className="text-xs text-gray-500 mb-2">
                    {config.description}
                  </p>

                  {config.type === "text" ? (
                    <SpecSectionEditor
                      section={section!}
                      isEditing={isEditing}
                      onChange={(content) =>
                        section && handleSectionChange(section.id, content)
                      }
                      onSave={async () => {}}
                      onCancel={() => {}}
                    />
                  ) : (
                    <SpecSectionList
                      items={
                        section
                          ? section.content
                              .split("\n")
                              .filter((line) => line.trim())
                          : []
                      }
                      isEditing={isEditing}
                      onAdd={(item) => {
                        if (section) {
                          const current = section.content
                            .split("\n")
                            .filter((line) => line.trim());
                          handleSectionChange(
                            section.id,
                            [...current, item].join("\n"),
                          );
                        }
                      }}
                      onRemove={(index) => {
                        if (section) {
                          const current = section.content
                            .split("\n")
                            .filter((line) => line.trim());
                          current.splice(index, 1);
                          handleSectionChange(section.id, current.join("\n"));
                        }
                      }}
                      onReorder={(from, to) => {
                        if (section) {
                          const current = section.content
                            .split("\n")
                            .filter((line) => line.trim());
                          const [item] = current.splice(from, 1);
                          current.splice(to, 0, item);
                          handleSectionChange(section.id, current.join("\n"));
                        }
                      }}
                      onUpdate={(index, value) => {
                        if (section) {
                          const current = section.content
                            .split("\n")
                            .filter((line) => line.trim());
                          current[index] = value;
                          handleSectionChange(section.id, current.join("\n"));
                        }
                      }}
                      placeholder={`Add ${config.label.toLowerCase()}...`}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SpecPanel;
