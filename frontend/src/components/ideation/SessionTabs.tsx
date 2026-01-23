// =============================================================================
// FILE: frontend/src/components/ideation/SessionTabs.tsx
// Tab navigation component for switching between Chat and Memory Graph views
// =============================================================================

import { memo } from "react";
import { MessageSquare, Network, AlertCircle } from "lucide-react";

export type SessionTab = "chat" | "graph";

export interface SessionTabsProps {
  activeTab: SessionTab;
  onTabChange: (tab: SessionTab) => void;
  graphUpdateCount?: number;
  hasGraphUpdates?: boolean;
  className?: string;
}

export const SessionTabs = memo(function SessionTabs({
  activeTab,
  onTabChange,
  graphUpdateCount = 0,
  hasGraphUpdates = false,
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

      {/* Memory Graph Tab */}
      <button
        role="tab"
        aria-selected={activeTab === "graph"}
        aria-controls="graph-panel"
        data-testid="graph-tab"
        onClick={() => onTabChange("graph")}
        className={getTabClass("graph")}
      >
        <Network className="w-4 h-4" />
        <span>Memory Graph</span>

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
    </div>
  );
});

export default SessionTabs;
