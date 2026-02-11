// =============================================================================
// UnifiedLayout.tsx
// Chat-left, content-right layout for idea development pages
// =============================================================================

import { useState, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Lightbulb,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Bell,
  User,
} from "lucide-react";
import clsx from "clsx";

// Phase types aligned with pipeline orchestrator
export type IdeaPhase =
  | "ideation"
  | "ideation_ready"
  | "specification"
  | "spec_ready"
  | "building"
  | "build_review"
  | "deployed"
  | "paused"
  | "failed";

interface UnifiedLayoutProps {
  ideaId?: string;
  ideaTitle?: string;
  currentPhase?: IdeaPhase;
  children: ReactNode;
  chatPanel?: ReactNode;
  showChat?: boolean;
}

// Phase display configuration
const PHASE_CONFIG: Record<
  IdeaPhase,
  { label: string; color: string; bgColor: string }
> = {
  ideation: {
    label: "Ideation",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
  },
  ideation_ready: {
    label: "Ready for Spec",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
  },
  specification: {
    label: "Specification",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
  },
  spec_ready: {
    label: "Ready to Build",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
  },
  building: {
    label: "Building",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
  },
  build_review: {
    label: "Review",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
  },
  deployed: {
    label: "Deployed",
    color: "text-green-700",
    bgColor: "bg-green-50",
  },
  paused: { label: "Paused", color: "text-gray-700", bgColor: "bg-gray-100" },
  failed: { label: "Failed", color: "text-red-700", bgColor: "bg-red-50" },
};

export function UnifiedLayout({
  ideaId,
  ideaTitle,
  currentPhase = "ideation",
  children,
  chatPanel,
  showChat = true,
}: UnifiedLayoutProps) {
  const [chatExpanded, setChatExpanded] = useState(true);
  const navigate = useNavigate();
  const phaseConfig = PHASE_CONFIG[currentPhase];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Fixed Header */}
      <header className="h-14 border-b bg-white flex items-center px-4 shrink-0 z-10">
        {/* Logo */}
        <Link to="/" className="flex items-center mr-6">
          <Lightbulb className="h-7 w-7 text-primary-600" />
          <span className="ml-2 text-lg font-bold text-gray-900 hidden sm:block">
            Vibe
          </span>
        </Link>

        {/* Idea Selector */}
        {ideaId && (
          <button
            onClick={() => navigate("/ideas")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 transition"
          >
            <span className="text-sm font-medium text-gray-700 max-w-[200px] truncate">
              {ideaTitle || ideaId}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        )}

        {/* Phase Indicator */}
        {currentPhase && (
          <div
            className={clsx(
              "ml-4 px-3 py-1 rounded-full text-xs font-medium",
              phaseConfig.bgColor,
              phaseConfig.color,
            )}
          >
            {phaseConfig.label}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <Link
            to="/settings/notifications"
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
          </Link>
          <Link
            to="/profile"
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
            title="Profile"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel (Left) */}
        {showChat && (
          <aside
            className={clsx(
              "border-r bg-white transition-all duration-200 flex flex-col relative",
              chatExpanded ? "w-80 min-w-[280px] max-w-[400px]" : "w-12",
            )}
          >
            {/* Toggle Button */}
            <button
              onClick={() => setChatExpanded(!chatExpanded)}
              className={clsx(
                "absolute top-3 -right-3 z-10 p-1 rounded-full bg-white border shadow-sm",
                "hover:bg-gray-50 transition",
              )}
              title={chatExpanded ? "Collapse chat" : "Expand chat"}
            >
              {chatExpanded ? (
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {/* Chat Content */}
            {chatExpanded ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {chatPanel || <DefaultChatPlaceholder />}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </aside>
        )}

        {/* Main Content (Right) */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

// Placeholder when no chat panel is provided
function DefaultChatPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center p-4 text-gray-400">
      <div className="text-center">
        <MessageSquare className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Chat will appear here</p>
      </div>
    </div>
  );
}

export default UnifiedLayout;
