// =============================================================================
// FILE: frontend/src/components/ideation/ProjectContextHeader.tsx
// Project context header showing idea info, navigation tabs, and quick actions
// Part of: Phase 9 - Project Folder & Spec Output (T9.1)
// =============================================================================

import { memo, useCallback } from "react";
import {
  FolderOpen,
  Calendar,
  FileText,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { SpecWorkflowState } from "../../types/spec";

export type ProjectTab = "chat" | "graph" | "files" | "spec";

export interface LinkedIdeaInfo {
  ideaSlug: string;
  userSlug: string;
  ideaType?: string;
  status?: string;
  lastUpdated?: string;
  folderPath?: string;
}

export interface ProjectContextHeaderProps {
  linkedIdea: LinkedIdeaInfo | null;
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  specStatus?: SpecWorkflowState | null;
  hasSpec?: boolean;
  graphUpdateCount?: number;
  hasGraphUpdates?: boolean;
  filesCount?: number;
  onOpenFolder?: () => void;
  className?: string;
}

interface SpecStatusIndicatorProps {
  status: SpecWorkflowState | null;
  hasSpec: boolean;
}

function SpecStatusIndicator({ status, hasSpec }: SpecStatusIndicatorProps) {
  if (!hasSpec || !status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
        <Clock className="w-3 h-3" />
        No Spec
      </span>
    );
  }

  const statusConfig: Record<
    SpecWorkflowState,
    { icon: typeof CheckCircle; color: string; label: string }
  > = {
    draft: {
      icon: Clock,
      color: "text-yellow-600 bg-yellow-100",
      label: "Draft",
    },
    review: {
      icon: AlertCircle,
      color: "text-blue-600 bg-blue-100",
      label: "In Review",
    },
    approved: {
      icon: CheckCircle,
      color: "text-green-600 bg-green-100",
      label: "Approved",
    },
    archived: {
      icon: FileText,
      color: "text-gray-600 bg-gray-100",
      label: "Archived",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export const ProjectContextHeader = memo(function ProjectContextHeader({
  linkedIdea,
  activeTab,
  onTabChange,
  specStatus = null,
  hasSpec = false,
  graphUpdateCount = 0,
  hasGraphUpdates = false,
  filesCount = 0,
  onOpenFolder,
  className = "",
}: ProjectContextHeaderProps) {
  const handleOpenFolder = useCallback(() => {
    if (onOpenFolder) {
      onOpenFolder();
    } else if (linkedIdea?.folderPath) {
      // Default behavior: try to open via API
      window.open(
        `/api/files/open?path=${encodeURIComponent(linkedIdea.folderPath)}`,
        "_blank",
      );
    }
  }, [onOpenFolder, linkedIdea?.folderPath]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Unknown";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Unknown";
    }
  };

  // If no linked idea, show a placeholder
  if (!linkedIdea) {
    return (
      <div
        className={`bg-gray-50 border-b border-gray-200 px-4 py-2 ${className}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 italic">
            No idea linked to this session
          </span>
        </div>
      </div>
    );
  }

  const tabs: Array<{
    id: ProjectTab;
    label: string;
    badge?: number | string;
    badgeClass?: string;
  }> = [
    { id: "chat", label: "Chat" },
    {
      id: "graph",
      label: "Graph",
      badge:
        hasGraphUpdates && activeTab !== "graph" ? graphUpdateCount : undefined,
      badgeClass: "bg-blue-100 text-blue-700 animate-pulse",
    },
    {
      id: "files",
      label: "Files",
      badge: filesCount > 0 ? filesCount : undefined,
      badgeClass: "bg-gray-100 text-gray-600",
    },
    {
      id: "spec",
      label: "Spec",
      badge: hasSpec && specStatus ? undefined : undefined,
    },
  ];

  return (
    <div className={`bg-white border-b border-gray-200 ${className}`}>
      {/* Idea Info Row */}
      <div className="px-4 py-2 flex items-center justify-between gap-4 bg-gray-50 border-b border-gray-100">
        {/* Left: Idea info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="font-medium text-gray-900 truncate">
              {linkedIdea.ideaSlug}
            </span>
          </div>

          {linkedIdea.ideaType && (
            <span className="px-2 py-0.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-full">
              {linkedIdea.ideaType}
            </span>
          )}

          {linkedIdea.status && (
            <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
              {linkedIdea.status}
            </span>
          )}

          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            {formatDate(linkedIdea.lastUpdated)}
          </span>
        </div>

        {/* Right: Spec status & actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <SpecStatusIndicator status={specStatus} hasSpec={hasSpec} />

          <button
            onClick={handleOpenFolder}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                       text-gray-600 bg-white border border-gray-300 rounded-md shadow-sm
                       hover:bg-gray-50 hover:text-gray-900 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            title="Open project folder in file manager"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Folder
          </button>
        </div>
      </div>

      {/* Tab Navigation Row */}
      <div
        className="flex border-b border-gray-200"
        role="tablist"
        aria-label="Project views"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            data-testid={`${tab.id}-tab`}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium
              border-b-2 transition-colors focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset
              ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            <span>{tab.label}</span>

            {/* Badge */}
            {tab.badge !== undefined && (
              <span
                className={`flex items-center justify-center min-w-[20px] h-5 px-1.5
                           rounded-full text-xs font-semibold
                           ${tab.badgeClass || "bg-gray-100 text-gray-600"}`}
              >
                {typeof tab.badge === "number" && tab.badge > 99
                  ? "99+"
                  : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
});

export default ProjectContextHeader;
