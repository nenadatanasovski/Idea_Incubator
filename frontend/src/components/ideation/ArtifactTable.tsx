// =============================================================================
// FILE: frontend/src/components/ideation/ArtifactTable.tsx
// Table component for displaying artifacts with folder support
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

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ArtifactTableProps {
  artifacts: Artifact[];
  selectedPath: string | null;
  onSelect: (artifact: Artifact) => void;
  onToggleFolder: (folderPath: string) => void;
  onDelete?: (artifactId: string) => void;
  onClearSelection?: () => void;
  classifications?: Record<string, ClassificationInfo>;
  isLoading?: boolean;
}

interface FolderState {
  [path: string]: boolean; // true = expanded, false = collapsed
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

const FolderIcon = () => (
  <svg
    className="w-4 h-4 text-yellow-500"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
);

const FolderOpenIcon = () => (
  <svg
    className="w-4 h-4 text-yellow-500"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z"
      clipRule="evenodd"
    />
    <path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" />
  </svg>
);

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
 * Format date as relative time (e.g., "2 hours ago", "Jan 5")
 */
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
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
 * Extract folder path from artifact
 */
function extractFolderPath(artifact: Artifact): string {
  // Check if title contains path separators
  if (artifact.title.includes("/")) {
    const parts = artifact.title.split("/");
    parts.pop(); // Remove filename
    return parts.length > 0 ? parts.join("/") : "/";
  }

  // Check identifier for path structure
  if (artifact.identifier && artifact.identifier.includes("/")) {
    const parts = artifact.identifier.split("/");
    parts.pop();
    return parts.length > 0 ? parts.join("/") : "/";
  }

  // No folder structure - root folder
  return "/";
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
 * Group artifacts by folder structure and sort appropriately
 */
function groupArtifactsByFolder(artifacts: Artifact[]): GroupedArtifact[] {
  const folders: Map<string, Artifact[]> = new Map();
  const rootFiles: Artifact[] = [];

  // Group by folder path
  for (const artifact of artifacts) {
    const folderPath = extractFolderPath(artifact);
    if (folderPath === "/") {
      rootFiles.push(artifact);
    } else {
      if (!folders.has(folderPath)) {
        folders.set(folderPath, []);
      }
      folders.get(folderPath)!.push(artifact);
    }
  }

  const result: GroupedArtifact[] = [];

  // Add folders first (sorted alphabetically)
  const sortedFolders = Array.from(folders.keys()).sort((a, b) =>
    a.localeCompare(b),
  );
  for (const folderPath of sortedFolders) {
    const folderArtifacts = folders.get(folderPath)!;
    // Sort files by date (newest first)
    folderArtifacts.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    result.push({
      type: "folder",
      path: folderPath,
      name: folderPath.split("/").pop() || folderPath,
      depth: 0,
      children: folderArtifacts.map((artifact) => ({
        type: "file" as const,
        path: artifact.id,
        name: extractFileName(artifact),
        artifact,
        depth: 1,
      })),
    });
  }

  // Add root files (sorted by date, newest first)
  rootFiles.sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt).getTime();
    return dateB - dateA;
  });

  for (const artifact of rootFiles) {
    result.push({
      type: "file",
      path: artifact.id,
      name: extractFileName(artifact),
      artifact,
      depth: 0,
    });
  }

  return result;
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
  <tr className="border-b border-gray-100 dark:border-gray-700 animate-pulse">
    <td className="px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
          style={{ width: `${120 + (index % 3) * 40}px` }}
        />
      </div>
    </td>
    <td className="px-3 py-2">
      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
    </td>
    <td className="px-3 py-2">
      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
    </td>
    <td className="px-3 py-2 text-center">
      <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
    </td>
  </tr>
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
        className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-xl max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          Delete Artifact
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete "{artifactName}"? This action cannot
          be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            data-testid="btn-cancel-delete"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
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
// Main Component
// -----------------------------------------------------------------------------

export const ArtifactTable: React.FC<ArtifactTableProps> = ({
  artifacts,
  selectedPath,
  onSelect,
  onToggleFolder,
  onDelete,
  onClearSelection,
  classifications = {},
  isLoading = false,
}) => {
  // Track expanded/collapsed state of folders
  const [folderState, setFolderState] = useState<FolderState>({});

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
  const tableRef = useRef<HTMLTableElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  // Group artifacts by folder
  const groupedArtifacts = useMemo(
    () => groupArtifactsByFolder(artifacts),
    [artifacts],
  );

  // Handle folder toggle
  const handleFolderToggle = useCallback(
    (folderPath: string) => {
      setFolderState((prev) => ({
        ...prev,
        [folderPath]: !prev[folderPath],
      }));
      onToggleFolder(folderPath);
    },
    [onToggleFolder],
  );

  // Handle row click
  const handleRowClick = useCallback(
    (item: GroupedArtifact, index: number) => {
      setFocusedIndex(index);
      if (item.type === "folder") {
        handleFolderToggle(item.path);
      } else if (item.artifact) {
        onSelect(item.artifact);
      }
    },
    [handleFolderToggle, onSelect],
  );

  // Check if a folder is expanded (default to true for first load)
  const isFolderExpanded = useCallback(
    (folderPath: string): boolean => {
      return folderState[folderPath] !== false; // Default to expanded
    },
    [folderState],
  );

  // Flatten grouped items for rendering (respecting expanded/collapsed state)
  const flattenedItems = useMemo(() => {
    const result: GroupedArtifact[] = [];

    for (const item of groupedArtifacts) {
      result.push(item);

      if (
        item.type === "folder" &&
        item.children &&
        isFolderExpanded(item.path)
      ) {
        result.push(...item.children);
      }
    }

    return result;
  }, [groupedArtifacts, isFolderExpanded]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableElement>) => {
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
            if (item.type === "folder") {
              handleFolderToggle(item.path);
            } else if (item.artifact) {
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
      handleFolderToggle,
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
        className="w-full overflow-auto"
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">
                Name
              </th>
              <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-28">
                Date
              </th>
              <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-24">
                Type
              </th>
              <th className="text-center px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-16">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4].map((index) => (
              <SkeletonRow key={`skeleton-${index}`} index={index} />
            ))}
          </tbody>
        </table>
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
    <div data-testid="artifact-table" className="w-full overflow-auto relative">
      {/* Keyboard Shortcuts Help Button */}
      <div className="absolute top-0 right-0 z-10">
        <button
          data-testid="keyboard-help-button"
          onClick={() => setShowShortcutsHelp((prev) => !prev)}
          onBlur={() => setShowShortcutsHelp(false)}
          className="p-1 m-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          title="Keyboard shortcuts (?)"
        >
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
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
        <KeyboardShortcutsHelp show={showShortcutsHelp} />
      </div>

      <table
        ref={tableRef}
        className="w-full text-sm"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="grid"
        aria-label="Artifact table with keyboard navigation"
      >
        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">
              Name
            </th>
            <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-28">
              Date
            </th>
            <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-24">
              Type
            </th>
            <th className="text-center px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-16">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {flattenedItems.map((item, index) => {
            const isFolder = item.type === "folder";
            const isSelected = !isFolder && item.path === selectedPath;
            const isFocused = index === focusedIndex;
            const expanded = isFolder ? isFolderExpanded(item.path) : undefined;
            const classification =
              !isFolder && item.artifact
                ? classifications[item.artifact.id] ||
                  classifications[item.artifact.title]
                : undefined;

            return (
              <tr
                key={`${item.type}-${item.path}-${index}`}
                ref={(el) => {
                  if (el) rowRefs.current.set(index, el);
                  else rowRefs.current.delete(index);
                }}
                data-testid={isFolder ? "folder-row" : "artifact-row"}
                data-index={index}
                data-id={item.artifact?.id}
                aria-expanded={isFolder ? expanded : undefined}
                aria-selected={!isFolder ? isSelected : undefined}
                role="row"
                tabIndex={isFocused ? 0 : -1}
                className={`
                  cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700
                  ${isSelected ? "bg-blue-50 dark:bg-blue-900/30 selected" : "hover:bg-gray-50 dark:hover:bg-gray-800"}
                  ${isFocused ? "ring-2 ring-blue-500 ring-inset focus-visible" : ""}
                `}
                onClick={() => handleRowClick(item, index)}
              >
                <td className="px-3 py-2">
                  <div
                    className="flex items-center gap-2"
                    style={{ paddingLeft: `${item.depth * 16}px` }}
                  >
                    {isFolder && (
                      <button
                        data-testid="folder-toggle"
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFolderToggle(item.path);
                        }}
                      >
                        <ChevronRightIcon expanded={expanded || false} />
                      </button>
                    )}

                    <span className="flex-shrink-0">
                      {isFolder ? (
                        expanded ? (
                          <FolderOpenIcon />
                        ) : (
                          <FolderIcon />
                        )
                      ) : item.artifact ? (
                        getFileIcon(item.artifact.type)
                      ) : null}
                    </span>

                    <span
                      data-testid="artifact-name"
                      className={`truncate ${isFolder ? "font-medium" : ""} ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-100"}`}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  </div>
                </td>

                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {!isFolder &&
                    item.artifact &&
                    formatRelativeDate(
                      item.artifact.updatedAt || item.artifact.createdAt,
                    )}
                </td>

                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {!isFolder && item.artifact && (
                    <span className="capitalize">
                      {getTypeDisplayName(item.artifact.type)}
                    </span>
                  )}
                </td>

                <td className="px-3 py-2 text-center">
                  {!isFolder && item.artifact && (
                    <StatusBadge classification={classification} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

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
