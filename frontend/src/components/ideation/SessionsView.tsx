// =============================================================================
// FILE: frontend/src/components/ideation/SessionsView.tsx
// Sessions view component - groups artifacts by session
// Implements TEST-UI-007 requirements
// =============================================================================

import React, { useState, useMemo, useCallback } from "react";
import type { Artifact, ArtifactType } from "../../types/ideation";
import type { ClassificationInfo } from "../../types/ideation-state";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SessionsViewProps {
  artifacts: Artifact[];
  selectedPath: string | null;
  onSelect: (artifact: Artifact) => void;
  onDeleteSession?: (sessionId: string, artifactIds: string[]) => void;
  classifications?: Record<string, ClassificationInfo>;
}

interface SessionGroup {
  sessionId: string;
  displayName: string;
  date: Date;
  artifacts: Artifact[];
  isTemplate: boolean;
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

const ChevronRightIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const SessionIcon = () => (
  <svg
    className="w-4 h-4 text-blue-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const TemplateIcon = () => (
  <svg
    className="w-4 h-4 text-gray-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
    />
  </svg>
);

const TrashIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const getFileIcon = (type: ArtifactType) => {
  switch (type) {
    case "code":
      return (
        <svg
          className="w-4 h-4 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      );
    case "research":
      return (
        <svg
          className="w-4 h-4 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    case "mermaid":
      return (
        <svg
          className="w-4 h-4 text-purple-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343"
          />
        </svg>
      );
    case "markdown":
    case "text":
      return (
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case "idea-summary":
    case "analysis":
      return (
        <svg
          className="w-4 h-4 text-amber-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
  }
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Extract sessionId from artifact
 * Looks for session patterns in id or identifier
 */
function extractSessionId(artifact: Artifact): string | null {
  // If the artifact ID contains a session prefix (e.g., "session_123_artifact_456")
  const sessionMatch = artifact.id.match(/^session[_-]?([a-zA-Z0-9-]+)/i);
  if (sessionMatch) {
    return sessionMatch[0]; // Return full session part
  }

  // Check identifier for session pattern
  if (artifact.identifier) {
    const identMatch = artifact.identifier.match(
      /^session[_-]?([a-zA-Z0-9-]+)/i,
    );
    if (identMatch) {
      return identMatch[0];
    }
  }

  // Check if createdAt suggests a session (same timestamp group)
  return null;
}

/**
 * Get earliest date from a set of artifacts
 */
function getSessionDate(artifacts: Artifact[]): Date {
  let earliest = new Date();
  for (const artifact of artifacts) {
    const date = new Date(artifact.createdAt);
    if (date < earliest) {
      earliest = date;
    }
  }
  return earliest;
}

/**
 * Format date as "Jan 5, 2:30 PM"
 */
function formatSessionDate(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours || 12; // Convert 0 to 12

  const minuteStr = minutes < 10 ? `0${minutes}` : minutes;

  return `${month} ${day}, ${hours}:${minuteStr} ${ampm}`;
}

/**
 * Format relative date (e.g., "2 hours ago", "Jan 5")
 */
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
}

/**
 * Get artifact type display name
 */
function getTypeDisplayName(type: ArtifactType): string {
  switch (type) {
    case "code":
      return "Code";
    case "html":
      return "HTML";
    case "svg":
      return "SVG";
    case "mermaid":
      return "Diagram";
    case "react":
      return "React";
    case "text":
      return "Text";
    case "markdown":
      return "Markdown";
    case "research":
      return "Research";
    case "idea-summary":
      return "Summary";
    case "analysis":
      return "Analysis";
    case "comparison":
      return "Comparison";
    default:
      return type;
  }
}

/**
 * Extract filename from artifact
 */
function extractFileName(artifact: Artifact): string {
  if (artifact.title.includes("/")) {
    const parts = artifact.title.split("/");
    return parts[parts.length - 1];
  }
  return artifact.title;
}

/**
 * Group artifacts by session
 */
function groupArtifactsBySession(artifacts: Artifact[]): SessionGroup[] {
  const sessionMap = new Map<string, Artifact[]>();
  const templateArtifacts: Artifact[] = [];

  for (const artifact of artifacts) {
    const sessionId = extractSessionId(artifact);
    if (sessionId) {
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, []);
      }
      sessionMap.get(sessionId)!.push(artifact);
    } else {
      templateArtifacts.push(artifact);
    }
  }

  const groups: SessionGroup[] = [];

  // Create session groups
  for (const [sessionId, sessionArtifacts] of sessionMap.entries()) {
    // Sort artifacts within session by date (newest first)
    sessionArtifacts.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    const sessionDate = getSessionDate(sessionArtifacts);
    const artifactCount = sessionArtifacts.length;
    const displayName = `Session ${formatSessionDate(sessionDate)} (${artifactCount} artifact${artifactCount !== 1 ? "s" : ""})`;

    groups.push({
      sessionId,
      displayName,
      date: sessionDate,
      artifacts: sessionArtifacts,
      isTemplate: false,
    });
  }

  // Sort sessions by date (newest first)
  groups.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Add template files group at the end
  if (templateArtifacts.length > 0) {
    templateArtifacts.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    groups.push({
      sessionId: "_template",
      displayName: "Template Files",
      date: new Date(0), // Very old date to keep at bottom
      artifacts: templateArtifacts,
      isTemplate: true,
    });
  }

  return groups;
}

// -----------------------------------------------------------------------------
// Status Badge Component
// -----------------------------------------------------------------------------

interface StatusBadgeProps {
  classification: ClassificationInfo | undefined;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ classification }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  let bgColor = "bg-gray-300";
  let tooltip = "Unknown";

  if (classification) {
    const { classification: type, isComplete } = classification;

    if (type === "required") {
      if (isComplete) {
        bgColor = "bg-yellow-400";
        tooltip = "Required - Complete";
      } else {
        bgColor = "bg-red-500";
        tooltip = "Required - Missing";
      }
    } else if (type === "recommended") {
      bgColor = "bg-blue-400";
      tooltip = "Recommended";
    } else if (type === "optional") {
      bgColor = "bg-gray-300";
      tooltip = "Optional";
    }
  }

  return (
    <span
      className="relative inline-flex items-center justify-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        data-testid="status-badge"
        className={`w-3 h-3 rounded-full ${bgColor} inline-block cursor-help`}
        role="img"
        aria-label={tooltip}
      />
      {showTooltip && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded whitespace-nowrap z-50"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
};

// -----------------------------------------------------------------------------
// Confirmation Dialog Component
// -----------------------------------------------------------------------------

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        data-testid="confirm-dialog"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const SessionsView: React.FC<SessionsViewProps> = ({
  artifacts,
  selectedPath,
  onSelect,
  onDeleteSession,
  classifications = {},
}) => {
  // Track expanded/collapsed state of sessions
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set(["_template"]),
  );

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    sessionId: string;
    artifactIds: string[];
  }>({ isOpen: false, sessionId: "", artifactIds: [] });

  // Group artifacts by session
  const sessionGroups = useMemo(
    () => groupArtifactsBySession(artifacts),
    [artifacts],
  );

  // Toggle session expanded/collapsed state
  const handleToggleSession = useCallback((sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  // Handle delete session button click
  const handleDeleteSessionClick = useCallback(
    (sessionId: string, artifactIds: string[]) => {
      setConfirmDialog({
        isOpen: true,
        sessionId,
        artifactIds,
      });
    },
    [],
  );

  // Confirm deletion
  const handleConfirmDelete = useCallback(() => {
    if (onDeleteSession && confirmDialog.sessionId) {
      onDeleteSession(confirmDialog.sessionId, confirmDialog.artifactIds);
    }
    setConfirmDialog({ isOpen: false, sessionId: "", artifactIds: [] });
  }, [onDeleteSession, confirmDialog]);

  // Cancel deletion
  const handleCancelDelete = useCallback(() => {
    setConfirmDialog({ isOpen: false, sessionId: "", artifactIds: [] });
  }, []);

  if (artifacts.length === 0) {
    return (
      <div
        data-testid="sessions-view"
        className="flex items-center justify-center h-full text-gray-500 text-sm"
      >
        No artifacts yet
      </div>
    );
  }

  return (
    <div data-testid="sessions-view" className="w-full overflow-auto">
      {sessionGroups.map((group) => {
        const isExpanded = expandedSessions.has(group.sessionId);
        const artifactIds = group.artifacts.map((a) => a.id);

        return (
          <div
            key={group.sessionId}
            data-testid={
              group.isTemplate ? "template-files-group" : "session-group"
            }
            aria-expanded={isExpanded}
            className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
          >
            {/* Session Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <button
                data-testid="session-toggle"
                onClick={() => handleToggleSession(group.sessionId)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <ChevronRightIcon expanded={isExpanded} />
                <span className="flex-shrink-0">
                  {group.isTemplate ? <TemplateIcon /> : <SessionIcon />}
                </span>
                <span
                  data-testid="session-header"
                  className="font-medium text-sm text-gray-700 dark:text-gray-300 truncate"
                >
                  {group.displayName}
                </span>
              </button>

              {/* Delete Session button (not for template files) */}
              {!group.isTemplate && onDeleteSession && (
                <button
                  data-testid="btn-delete-session"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSessionClick(group.sessionId, artifactIds);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete session"
                >
                  <TrashIcon />
                </button>
              )}
            </div>

            {/* Artifacts Table (when expanded) */}
            {isExpanded && (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-900/50">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400 text-xs">
                      Name
                    </th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400 text-xs w-20">
                      Date
                    </th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400 text-xs w-20">
                      Type
                    </th>
                    <th className="text-center px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400 text-xs w-14">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.artifacts.map((artifact, index) => {
                    const isSelected =
                      artifact.id === selectedPath ||
                      artifact.title === selectedPath ||
                      artifact.identifier === selectedPath;
                    const classification =
                      classifications[artifact.id] ||
                      classifications[artifact.title];

                    return (
                      <tr
                        key={artifact.id}
                        data-testid="artifact-row"
                        data-id={artifact.id}
                        data-index={index}
                        aria-selected={isSelected}
                        onClick={() => onSelect(artifact)}
                        className={`
                          cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0
                          ${isSelected ? "bg-blue-50 dark:bg-blue-900/30 selected" : "hover:bg-gray-50 dark:hover:bg-gray-800"}
                        `}
                      >
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2 pl-6">
                            <span className="flex-shrink-0">
                              {getFileIcon(artifact.type)}
                            </span>
                            <span
                              data-testid="artifact-name"
                              className={`truncate ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-100"}`}
                              title={artifact.title}
                            >
                              {extractFileName(artifact)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                          {formatRelativeDate(
                            artifact.updatedAt || artifact.createdAt,
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                          {getTypeDisplayName(artifact.type)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <StatusBadge classification={classification} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Session"
        message={`Are you sure you want to delete this session and all ${confirmDialog.artifactIds.length} artifact${confirmDialog.artifactIds.length !== 1 ? "s" : ""}? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default SessionsView;
