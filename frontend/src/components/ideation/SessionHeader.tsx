// =============================================================================
// FILE: frontend/src/components/ideation/SessionHeader.tsx
// Session header with token usage, metrics, tabs, and actions
// =============================================================================

import { useState, useRef, useEffect } from "react";
import {
  Minimize2,
  Trash2,
  Pencil,
  MessageSquare,
  Network,
  AlertCircle,
  FolderOpen,
  FileText,
  Database,
} from "lucide-react";
import { TokenUsageIndicator } from "./TokenUsageIndicator";
import { IdeaSelector } from "./IdeaSelector";
import type { IdeaCandidate } from "../../types/ideation";

export type SessionTab = "chat" | "graph" | "memory" | "files" | "spec";

export interface SessionHeaderProps {
  sessionId: string;
  sessionTitle?: string | null;
  tokenUsage: {
    total: number;
    limit: number;
    percentUsed: number;
    shouldHandoff: boolean;
  };
  candidate: IdeaCandidate | null;
  onDiscard: () => void;
  onMinimize: () => void;
  onUpdateTitle?: (newTitle: string) => void;
  // IdeaSelector props
  userSlug?: string;
  linkedIdea?: { userSlug: string; ideaSlug: string } | null;
  onSelectIdea?: (idea: { userSlug: string; ideaSlug: string } | null) => void;
  onNewIdea?: () => void;
  // Tab props
  activeTab: SessionTab;
  onTabChange: (tab: SessionTab) => void;
  graphUpdateCount?: number;
  hasGraphUpdates?: boolean;
  // T9 props - Files and Spec tabs
  hasSpec?: boolean;
  filesCount?: number;
}

// Inline tab buttons
function InlineTabs({
  activeTab,
  onTabChange,
  graphUpdateCount = 0,
  hasGraphUpdates = false,
  hasLinkedIdea = false,
  hasSpec = false,
  filesCount = 0,
}: {
  activeTab: SessionTab;
  onTabChange: (tab: SessionTab) => void;
  graphUpdateCount?: number;
  hasGraphUpdates?: boolean;
  hasLinkedIdea?: boolean;
  hasSpec?: boolean;
  filesCount?: number;
}) {
  const getTabClass = (tabId: SessionTab) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      activeTab === tabId
        ? "bg-blue-100 text-blue-700"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
    }`;

  return (
    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
      <button
        onClick={() => onTabChange("chat")}
        className={getTabClass("chat")}
        data-testid="chat-tab"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>Chat</span>
      </button>
      <button
        onClick={() => onTabChange("graph")}
        className={getTabClass("graph")}
        data-testid="graph-tab"
      >
        <Network className="w-3.5 h-3.5" />
        <span>Memory Graph</span>
        {hasGraphUpdates && activeTab !== "graph" && (
          <span
            className="flex items-center justify-center min-w-[18px] h-4 px-1
                       bg-blue-500 text-white rounded-full text-[10px] font-semibold
                       animate-pulse ml-0.5"
            title={`${graphUpdateCount} new graph update${graphUpdateCount !== 1 ? "s" : ""}`}
          >
            {graphUpdateCount > 0 ? (
              graphUpdateCount > 99 ? (
                "99+"
              ) : (
                graphUpdateCount
              )
            ) : (
              <AlertCircle className="w-2.5 h-2.5" />
            )}
          </span>
        )}
      </button>
      {/* Memory Database tab - always available */}
      <button
        onClick={() => onTabChange("memory")}
        className={getTabClass("memory")}
        data-testid="memory-tab"
      >
        <Database className="w-3.5 h-3.5" />
        <span>Memory DB</span>
      </button>
      {/* Files and Spec tabs - only show when idea is linked (T9.1) */}
      {hasLinkedIdea && (
        <>
          <button
            onClick={() => onTabChange("files")}
            className={getTabClass("files")}
            data-testid="files-tab"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Files</span>
            {filesCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[10px] font-medium">
                {filesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange("spec")}
            className={getTabClass("spec")}
            data-testid="spec-tab"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Spec</span>
            {hasSpec && (
              <span
                className="ml-0.5 w-2 h-2 bg-green-500 rounded-full"
                title="Spec available"
              />
            )}
          </button>
        </>
      )}
    </div>
  );
}

export function SessionHeader({
  sessionId,
  sessionTitle,
  tokenUsage,
  candidate,
  onDiscard,
  onMinimize,
  onUpdateTitle,
  userSlug,
  linkedIdea,
  onSelectIdea,
  onNewIdea,
  activeTab,
  onTabChange,
  graphUpdateCount = 0,
  hasGraphUpdates = false,
  hasSpec = false,
  filesCount = 0,
}: SessionHeaderProps) {
  // Use session title as primary, fall back to candidate title for backward compatibility
  const displayTitle = sessionTitle || candidate?.title || "";

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(displayTitle);
  const [isHoveringTitle, setIsHoveringTitle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edited title when session/candidate title changes
  useEffect(() => {
    setEditedTitle(displayTitle);
  }, [displayTitle]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleStartEdit = () => {
    if (onUpdateTitle) {
      setIsEditingTitle(true);
    }
  };

  const handleSaveTitle = () => {
    const trimmed = editedTitle.trim();
    if (trimmed && trimmed !== displayTitle && onUpdateTitle) {
      onUpdateTitle(trimmed);
    } else {
      setEditedTitle(displayTitle);
    }
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setEditedTitle(displayTitle);
      setIsEditingTitle(false);
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      {/* Left: Session info + IdeaSelector + Tabs */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">I</span>
        </div>
        <div className="min-w-0">
          {isEditingTitle ? (
            <input
              ref={inputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDown}
              className="text-sm font-semibold text-gray-900 bg-white border border-blue-400 rounded px-2 py-0.5 w-48 outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div
              className="flex items-center gap-1.5 group"
              onMouseEnter={() => setIsHoveringTitle(true)}
              onMouseLeave={() => setIsHoveringTitle(false)}
            >
              <h1
                className={`text-sm font-semibold text-gray-900 truncate ${
                  onUpdateTitle ? "cursor-pointer hover:text-blue-600" : ""
                }`}
                onClick={handleStartEdit}
                title={onUpdateTitle ? "Click to edit title" : undefined}
              >
                {displayTitle || "Ideation Session"}
              </h1>
              {onUpdateTitle && isHoveringTitle && (
                <button
                  onClick={handleStartEdit}
                  className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit title"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500">
            Session: {sessionId.slice(0, 8)}...
          </p>
        </div>

        {/* IdeaSelector - only show when userSlug is provided */}
        {userSlug && onSelectIdea && (
          <div className="ml-2">
            <IdeaSelector
              userSlug={userSlug}
              selectedIdea={linkedIdea || null}
              onSelectIdea={onSelectIdea}
              onNewIdea={onNewIdea}
            />
          </div>
        )}

        {/* Inline Tabs */}
        <div className="ml-2">
          <InlineTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            graphUpdateCount={graphUpdateCount}
            hasGraphUpdates={hasGraphUpdates}
            hasLinkedIdea={Boolean(linkedIdea)}
            hasSpec={hasSpec}
            filesCount={filesCount}
          />
        </div>
      </div>

      {/* Right side: Token usage + Actions */}
      <div className="flex items-center gap-4">
        {/* Token usage - compact */}
        <div className="w-[180px]">
          <TokenUsageIndicator usage={tokenUsage} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {candidate && (
            <>
              <button
                data-testid="header-discard-btn"
                onClick={onDiscard}
                className="flex items-center justify-center p-1.5
                           border border-red-200 rounded-lg hover:bg-red-50
                           text-red-600 transition-colors
                           focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                title="Discard Idea"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-gray-200 mx-1" />
            </>
          )}
          <button
            onClick={onMinimize}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default SessionHeader;
