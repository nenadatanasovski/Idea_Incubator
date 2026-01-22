// =============================================================================
// FILE: frontend/src/components/ideation/SessionTabs.tsx
// Tab navigation component for switching between Chat, Graph, Files, and Spec views
// Part of: Phase 9 - Project Folder & Spec Output (T9.1)
// =============================================================================

import { memo } from "react";
import {
  MessageSquare,
  Network,
  AlertCircle,
  FolderOpen,
  FileText,
} from "lucide-react";

export type SessionTab = "chat" | "graph" | "files" | "spec";

export interface SessionTabsProps {
  activeTab: SessionTab;
  onTabChange: (tab: SessionTab) => void;
  graphUpdateCount?: number;
  hasGraphUpdates?: boolean;
  filesCount?: number;
  hasSpec?: boolean;
  specStatus?: "none" | "draft" | "complete";
  className?: string;
}

export const SessionTabs = memo(function SessionTabs({
  activeTab,
  onTabChange,
  graphUpdateCount = 0,
  hasGraphUpdates = false,
  filesCount = 0,
  hasSpec = false,
  specStatus = "none",
  className = "",
}: SessionTabsProps) {
  const getTabClass = (tabId: SessionTab) => `
    relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium
    border-b-2 transition-colors focus-visible:outline-none
    focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset
    ${
      activeTab === tabId
        ? "border-blue-600 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
    }
  `;

  const getSpecStatusIndicator = () => {
    if (specStatus === "complete") {
      return (
        <span className="w-2 h-2 rounded-full bg-green-500" title="Complete" />
      );
    }
    if (specStatus === "draft") {
      return (
        <span className="w-2 h-2 rounded-full bg-yellow-500" title="Draft" />
      );
    }
    return null;
  };

  return (
    <div
      className={`flex border-b border-gray-200 bg-white ${className}`}
      role="tablist"
      aria-label="Session views"
    >
      {/* Chat Tab */}
      <button
        role="tab"
        aria-selected={activeTab === "chat"}
        aria-controls="chat-panel"
        data-testid="chat-tab"
        onClick={() => onTabChange("chat")}
        className={getTabClass("chat")}
      >
        <MessageSquare className="w-4 h-4" />
        <span>Chat</span>
      </button>

      {/* Graph Tab */}
      <button
        role="tab"
        aria-selected={activeTab === "graph"}
        aria-controls="graph-panel"
        data-testid="graph-tab"
        onClick={() => onTabChange("graph")}
        className={getTabClass("graph")}
      >
        <Network className="w-4 h-4" />
        <span>Graph</span>

        {/* Update indicator */}
        {hasGraphUpdates && activeTab !== "graph" && (
          <span
            className="flex items-center justify-center min-w-[20px] h-5 px-1.5
                       bg-blue-100 text-blue-700 rounded-full text-xs font-semibold
                       animate-pulse"
            title={`${graphUpdateCount} new graph update${graphUpdateCount !== 1 ? "s" : ""}`}
          >
            {graphUpdateCount > 0 ? (
              graphUpdateCount > 99 ? (
                "99+"
              ) : (
                graphUpdateCount
              )
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
          </span>
        )}
      </button>

      {/* Files Tab (T9.1) */}
      <button
        role="tab"
        aria-selected={activeTab === "files"}
        aria-controls="files-panel"
        data-testid="files-tab"
        onClick={() => onTabChange("files")}
        className={getTabClass("files")}
      >
        <FolderOpen className="w-4 h-4" />
        <span>Files</span>

        {/* File count badge */}
        {filesCount > 0 && (
          <span
            className="flex items-center justify-center min-w-[20px] h-5 px-1.5
                       bg-gray-100 text-gray-600 rounded-full text-xs font-semibold"
            title={`${filesCount} file${filesCount !== 1 ? "s" : ""}`}
          >
            {filesCount > 99 ? "99+" : filesCount}
          </span>
        )}
      </button>

      {/* Spec Tab (T9.1) */}
      <button
        role="tab"
        aria-selected={activeTab === "spec"}
        aria-controls="spec-panel"
        data-testid="spec-tab"
        onClick={() => onTabChange("spec")}
        className={getTabClass("spec")}
      >
        <FileText className="w-4 h-4" />
        <span>Spec</span>

        {/* Spec status indicator */}
        {hasSpec && getSpecStatusIndicator()}
      </button>
    </div>
  );
});

export default SessionTabs;
