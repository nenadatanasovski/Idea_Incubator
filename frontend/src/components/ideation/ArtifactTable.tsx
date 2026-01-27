// =============================================================================
// FILE: frontend/src/components/ideation/ArtifactTable.tsx
// Accordion-style component for displaying artifacts with inline preview
// =============================================================================

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import type { Artifact, ArtifactType } from "../../types/ideation";
import type { ClassificationInfo } from "../../types/ideation-state";
import { ArtifactRenderer } from "./ArtifactRenderer";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ArtifactTableProps {
  artifacts: Artifact[];
  selectedPath: string | null;
  onSelect: (artifact: Artifact) => void;
  onToggleFolder: (folderPath: string) => void;
  onDelete?: (artifactId: string) => void;
  onEdit?: (artifactId: string, content?: string) => void;
  onCopyRef?: (artifactId: string) => void;
  onClearSelection?: () => void;
  classifications?: Record<string, ClassificationInfo>;
  isLoading?: boolean;
  /** ID of the most recently created artifact - auto-expands this row */
  latestArtifactId?: string | null;
}

interface GroupedArtifact {
  type: "folder" | "file";
  path: string;
  name: string;
  artifact?: Artifact;
  children?: GroupedArtifact[];
  depth: number;
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

// Action Icons for row-level buttons
const EditIcon = () => (
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
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
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

const LinkIcon = () => (
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
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
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
 * Parse a date string, handling various formats including SQLite's format.
 * SQLite's CURRENT_TIMESTAMP format is "2026-01-19 04:36:54" without timezone.
 * This function ensures dates without timezone info are treated as UTC.
 */
function parseDate(dateString: string): Date {
  // If the date string doesn't have a timezone indicator (Z or +/-HH:MM),
  // and looks like SQLite format "YYYY-MM-DD HH:MM:SS", treat it as UTC
  if (
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString) ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateString)
  ) {
    // Append Z to indicate UTC
    return new Date(dateString.replace(" ", "T") + "Z");
  }
  // Otherwise, parse normally (ISO 8601 with Z or timezone offset)
  return new Date(dateString);
}

/**
 * Format date as relative time (e.g., "2 hours ago", "Jan 5")
 */
function formatRelativeDate(dateString: string | null | undefined): string {
  if (!dateString) return "";

  const date = parseDate(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  } else {
    // Format as "Jan 5" or "Jan 5, 2023" if different year
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
    const year = date.getFullYear();
    const currentYear = now.getFullYear();

    if (year === currentYear) {
      return `${month} ${day}`;
    } else {
      return `${month} ${day}, ${year}`;
    }
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
 * Create a flat list of artifacts sorted by date (newest first)
 * No folder grouping - just a simple list
 */
function groupArtifactsByFolder(artifacts: Artifact[]): GroupedArtifact[] {
  // Filter out invalid artifacts (must have id and title)
  const validArtifacts = artifacts.filter(
    (a) => a && a.id && a.title && a.title !== "null" && a.title.trim() !== "",
  );

  // Sort all artifacts by date (newest first)
  const sortedArtifacts = [...validArtifacts].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt).getTime();
    return dateB - dateA;
  });

  // Return flat list of all artifacts
  return sortedArtifacts.map((artifact) => ({
    type: "file" as const,
    path: artifact.id,
    name: artifact.title,
    artifact,
    depth: 0,
  }));
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
  let tooltip = "Unknown classification";

  if (classification) {
    const { classification: type, isComplete } = classification;

    if (type === "required") {
      if (isComplete) {
        bgColor = "bg-yellow-400";
        tooltip = "Required - Complete";
      } else {
        bgColor = "bg-red-500";
        tooltip = "Required - Missing content";
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
          <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
};

// -----------------------------------------------------------------------------
// Skeleton Row Component for Loading State
// -----------------------------------------------------------------------------

const SkeletonRow: React.FC<{ index: number }> = ({ index }) => (
  <div className="flex items-center border-b border-gray-100 animate-pulse">
    <div className="flex-1 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-200 rounded" />
        <div className="w-4 h-4 bg-gray-200 rounded" />
        <div
          className="h-4 bg-gray-200 rounded"
          style={{ width: `${120 + (index % 3) * 40}px` }}
        />
      </div>
    </div>
    <div className="w-24 px-3 py-2">
      <div className="h-3 w-16 bg-gray-200 rounded" />
    </div>
    <div className="w-20 px-3 py-2">
      <div className="h-3 w-12 bg-gray-200 rounded" />
    </div>
    <div className="w-12 px-3 py-2 flex justify-center">
      <div className="w-3 h-3 bg-gray-200 rounded-full" />
    </div>
    <div className="w-6 px-2 py-2" />
  </div>
);

// -----------------------------------------------------------------------------
// Keyboard Shortcuts Help Tooltip
// -----------------------------------------------------------------------------

const KeyboardShortcutsHelp: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <div
      data-testid="keyboard-shortcuts-help"
      className="absolute top-8 right-0 bg-gray-900 text-white text-xs rounded-lg p-3 z-50 shadow-lg min-w-[180px]"
    >
      <div className="font-medium mb-2">Keyboard Shortcuts</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Navigate:</span>
          <span>
            <kbd className="bg-gray-700 px-1 rounded">↑</kbd>{" "}
            <kbd className="bg-gray-700 px-1 rounded">↓</kbd>
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Select:</span>
          <span>
            <kbd className="bg-gray-700 px-1 rounded">Enter</kbd>
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Delete:</span>
          <span>
            <kbd className="bg-gray-700 px-1 rounded">Del</kbd>
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Clear:</span>
          <span>
            <kbd className="bg-gray-700 px-1 rounded">Esc</kbd>
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Actions:</span>
          <span>
            <kbd className="bg-gray-700 px-1 rounded">Tab</kbd>
          </span>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Delete Confirmation Dialog
// -----------------------------------------------------------------------------

interface DeleteConfirmDialogProps {
  show: boolean;
  artifactName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  show,
  artifactName,
  onConfirm,
  onCancel,
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (show && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter") {
        onConfirm();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [show, onCancel, onConfirm]);

  if (!show) return null;

  return (
    <div
      data-testid="delete-confirm-dialog"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg p-4 shadow-xl max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-medium text-gray-900 mb-2">Delete Artifact</div>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete "{artifactName}"? This action cannot
          be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            data-testid="btn-cancel-delete"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            data-testid="btn-confirm-delete"
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Accordion Row Preview Component
// -----------------------------------------------------------------------------

interface AccordionPreviewProps {
  artifact: Artifact;
}

const AccordionPreview: React.FC<AccordionPreviewProps> = ({ artifact }) => {
  // Get content as string
  const getContentString = () => {
    if (typeof artifact.content === "string") {
      return artifact.content;
    }
    if (Array.isArray(artifact.content) && artifact.content.length === 0) {
      return "";
    }
    if (
      typeof artifact.content === "object" &&
      artifact.content !== null &&
      Object.keys(artifact.content).length === 0
    ) {
      return "";
    }
    return JSON.stringify(artifact.content, null, 2);
  };

  const contentString = getContentString();
  const isContentEmpty = !contentString || contentString.trim() === "";

  return (
    <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      {/* Content preview only - no action bar */}
      <div
        className="overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: "calc(100vh - 300px)" }}
      >
        {isContentEmpty ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No content available
              </p>
            </div>
          </div>
        ) : (
          <ArtifactRenderer artifact={artifact} />
        )}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const ArtifactTable: React.FC<ArtifactTableProps> = ({
  artifacts,
  selectedPath,
  onSelect,
  onToggleFolder,
  onDelete,
  onEdit,
  onCopyRef,
  onClearSelection,
  classifications = {},
  isLoading = false,
  latestArtifactId = null,
}) => {
  // Track which artifact rows are expanded (accordion state)
  const [expandedArtifacts, setExpandedArtifacts] = useState<Set<string>>(
    new Set(),
  );

  // Track focused index for keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Show keyboard shortcuts help
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    artifactId: string;
    name: string;
  }>({
    show: false,
    artifactId: "",
    name: "",
  });

  // Table reference for focus management
  const tableRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Auto-expand the latest artifact when it changes
  useEffect(() => {
    if (latestArtifactId) {
      setExpandedArtifacts(new Set([latestArtifactId]));
    }
  }, [latestArtifactId]);

  // Group artifacts by folder
  const groupedArtifacts = useMemo(
    () => groupArtifactsByFolder(artifacts),
    [artifacts],
  );

  // Toggle artifact accordion expansion
  const toggleArtifactExpansion = useCallback((artifactId: string) => {
    setExpandedArtifacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(artifactId)) {
        newSet.delete(artifactId);
      } else {
        // Close others and open this one (single-open accordion)
        newSet.clear();
        newSet.add(artifactId);
      }
      return newSet;
    });
  }, []);

  // Handle row click
  const handleRowClick = useCallback(
    (item: GroupedArtifact, index: number) => {
      setFocusedIndex(index);
      if (item.artifact) {
        toggleArtifactExpansion(item.artifact.id);
        onSelect(item.artifact);
      }
    },
    [toggleArtifactExpansion, onSelect],
  );

  // Flat list of items for rendering (no folder hierarchy)
  const flattenedItems = useMemo(() => {
    return groupedArtifacts;
  }, [groupedArtifacts]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (flattenedItems.length === 0) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex =
            focusedIndex < flattenedItems.length - 1 ? focusedIndex + 1 : 0;
          setFocusedIndex(nextIndex);
          rowRefs.current.get(nextIndex)?.scrollIntoView({ block: "nearest" });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex =
            focusedIndex > 0 ? focusedIndex - 1 : flattenedItems.length - 1;
          setFocusedIndex(prevIndex);
          rowRefs.current.get(prevIndex)?.scrollIntoView({ block: "nearest" });
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < flattenedItems.length) {
            const item = flattenedItems[focusedIndex];
            if (item.artifact) {
              toggleArtifactExpansion(item.artifact.id);
              onSelect(item.artifact);
            }
          }
          break;
        }
        case "Delete":
        case "Backspace": {
          if (
            focusedIndex >= 0 &&
            focusedIndex < flattenedItems.length &&
            onDelete
          ) {
            const item = flattenedItems[focusedIndex];
            if (item.type === "file" && item.artifact) {
              e.preventDefault();
              setDeleteConfirm({
                show: true,
                artifactId: item.artifact.id,
                name: item.name,
              });
            }
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          setFocusedIndex(-1);
          if (onClearSelection) {
            onClearSelection();
          }
          break;
        }
        case "Tab": {
          // Allow default Tab behavior to move to action buttons
          // Focus will naturally move to the next focusable element
          break;
        }
        case "?": {
          // Toggle keyboard shortcuts help
          e.preventDefault();
          setShowShortcutsHelp((prev) => !prev);
          break;
        }
      }
    },
    [
      flattenedItems,
      focusedIndex,
      toggleArtifactExpansion,
      onSelect,
      onDelete,
      onClearSelection,
    ],
  );

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(() => {
    if (onDelete && deleteConfirm.artifactId) {
      onDelete(deleteConfirm.artifactId);
    }
    setDeleteConfirm({ show: false, artifactId: "", name: "" });
  }, [onDelete, deleteConfirm.artifactId]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm({ show: false, artifactId: "", name: "" });
  }, []);

  // Handle row-level delete with confirmation
  const handleRowDelete = useCallback(
    (artifactId: string) => {
      const artifact = artifacts.find((a) => a.id === artifactId);
      if (artifact) {
        setDeleteConfirm({
          show: true,
          artifactId: artifact.id,
          name: artifact.title,
        });
      }
    },
    [artifacts],
  );

  // Handle row-level copy ref
  const handleRowCopyRef = useCallback(
    (artifactId: string) => {
      if (onCopyRef) {
        onCopyRef(artifactId);
      }
    },
    [onCopyRef],
  );

  // Update focused index when selected path changes externally
  useEffect(() => {
    if (selectedPath) {
      const index = flattenedItems.findIndex(
        (item) => item.type === "file" && item.path === selectedPath,
      );
      if (index >= 0) {
        setFocusedIndex(index);
      }
    }
  }, [selectedPath, flattenedItems]);

  // Loading state - show skeleton rows
  if (isLoading) {
    return (
      <div
        data-testid="artifact-table-skeleton"
        className="w-full overflow-y-auto overflow-x-hidden"
      >
        {/* Header row */}
        <div className="flex items-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 text-xs font-medium text-gray-500">
          <div className="flex-1 px-3 py-2">Name</div>
          <div className="w-24 px-3 py-2">Date</div>
          <div className="w-20 px-3 py-2">Type</div>
          <div className="w-12 px-3 py-2 text-center">Status</div>
          <div className="w-6 px-2 py-2" />
        </div>
        {/* Skeleton rows */}
        <div className="text-sm">
          {[0, 1, 2, 3, 4].map((index) => (
            <SkeletonRow key={`skeleton-${index}`} index={index} />
          ))}
        </div>
      </div>
    );
  }

  if (artifacts.length === 0) {
    return (
      <div
        data-testid="artifact-table"
        className="flex items-center justify-center h-full text-gray-500 text-sm"
        tabIndex={0}
      >
        No artifacts yet
      </div>
    );
  }

  return (
    <div
      data-testid="artifact-table"
      ref={tableRef}
      className="w-full h-full overflow-y-auto overflow-x-hidden relative"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="list"
      aria-label="Artifact list with accordion preview"
    >
      {/* Header row */}
      <div className="flex items-center bg-gray-50 sticky top-0 z-10 border-b border-gray-200 text-xs font-medium text-gray-500">
        <div className="flex-1 px-3 py-2">Name</div>
        <div className="w-24 px-3 py-2">Date</div>
        <div className="w-20 px-3 py-2">Type</div>
        <div className="w-12 px-3 py-2 text-center">Status</div>
        <div className="w-6 px-2 py-2">
          <button
            data-testid="keyboard-help-button"
            onClick={() => setShowShortcutsHelp((prev) => !prev)}
            onBlur={() => setShowShortcutsHelp(false)}
            className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
            title="Keyboard shortcuts (?)"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          <KeyboardShortcutsHelp show={showShortcutsHelp} />
        </div>
      </div>

      {/* Artifact rows */}
      <div className="text-sm">
        {flattenedItems.map((item, index) => {
          if (!item.artifact) return null;

          const isSelected = item.path === selectedPath;
          const isFocused = index === focusedIndex;
          const isArtifactExpanded =
            expandedArtifacts.has(item.artifact.id) ||
            item.path === selectedPath;
          const classification =
            classifications[item.artifact.id] ||
            classifications[item.artifact.title];

          return (
            <div
              key={`artifact-${item.artifact.id}-${index}`}
              ref={(el) => {
                if (el) rowRefs.current.set(index, el);
                else rowRefs.current.delete(index);
              }}
              data-testid="artifact-row"
              data-index={index}
              data-id={item.artifact.id}
              role="listitem"
              className="border-b border-gray-100 dark:border-gray-700"
            >
              {/* Row header - clickable to expand/collapse */}
              <div
                aria-expanded={isArtifactExpanded}
                aria-selected={isSelected}
                tabIndex={isFocused ? 0 : -1}
                className={`
                  group flex items-center cursor-pointer transition-colors
                  ${isSelected || isArtifactExpanded ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"}
                  ${isFocused ? "ring-2 ring-blue-500 ring-inset" : ""}
                `}
                onClick={() => handleRowClick(item, index)}
              >
                {/* Name column */}
                <div className="flex-1 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {/* Expand/collapse chevron */}
                    <button
                      data-testid="artifact-toggle"
                      className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleArtifactExpansion(item.artifact!.id);
                      }}
                    >
                      <ChevronRightIcon expanded={isArtifactExpanded} />
                    </button>

                    {/* File icon */}
                    <span className="flex-shrink-0">
                      {getFileIcon(item.artifact.type)}
                    </span>

                    {/* Artifact name */}
                    <span
                      data-testid="artifact-name"
                      className={`truncate ${isSelected || isArtifactExpanded ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-gray-100"}`}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  </div>
                </div>

                {/* Date column */}
                <div className="w-24 px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                  {formatRelativeDate(
                    item.artifact.updatedAt || item.artifact.createdAt,
                  )}
                </div>

                {/* Type column */}
                <div className="w-20 px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                  <span className="capitalize">
                    {getTypeDisplayName(item.artifact.type)}
                  </span>
                </div>

                {/* Status column */}
                <div className="w-12 px-3 py-2 flex justify-center">
                  <StatusBadge classification={classification} />
                </div>

                {/* Row-level action buttons - always visible on row */}
                <div className="flex items-center gap-1 px-2 py-1">
                  {onEdit && (
                    <button
                      data-testid="btn-row-edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(item.artifact!.id);
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      data-testid="btn-row-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowDelete(item.artifact!.id);
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  )}
                  {onCopyRef && (
                    <button
                      data-testid="btn-row-copy-ref"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowCopyRef(item.artifact!.id);
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400 transition-colors"
                      title="Copy @ref"
                    >
                      <LinkIcon />
                    </button>
                  )}
                </div>
              </div>

              {/* Accordion content - artifact preview (NO action buttons here anymore) */}
              {isArtifactExpanded && (
                <AccordionPreview artifact={item.artifact} />
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        show={deleteConfirm.show}
        artifactName={deleteConfirm.name}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default ArtifactTable;
