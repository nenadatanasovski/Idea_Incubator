/**
 * ViewSelector - Tab navigation for observability views
 *
 * Features:
 * - Tab buttons for all views
 * - Active state highlighting
 * - Keyboard navigation (arrow keys)
 * - Badge showing counts (errors, etc.)
 * - Tooltips explaining each view
 * - Mobile-friendly dropdown fallback
 */

import { useRef, useCallback, useEffect, useState } from "react";
import {
  Activity,
  Wrench,
  CheckSquare,
  Sparkles,
  ScrollText,
  ChevronDown,
  Grid,
  FileText,
  MessageSquare,
  Zap,
} from "lucide-react";
import type { ObservabilityView } from "../../types/observability";

interface ViewBadgeCounts {
  errors?: number;
  failed?: number;
  blocked?: number;
}

interface ViewSelectorProps {
  currentView: ObservabilityView;
  onViewChange: (view: ObservabilityView) => void;
  badgeCounts?: ViewBadgeCounts;
}

interface ViewConfig {
  id: ObservabilityView;
  label: string;
  icon: typeof Activity;
  shortcut: string;
  tooltip: string;
  badgeKey?: keyof ViewBadgeCounts;
  badgeColor?: string;
}

const views: ViewConfig[] = [
  {
    id: "timeline",
    label: "Timeline",
    icon: Activity,
    shortcut: "g t",
    tooltip: "Gantt-style view of execution phases and tasks",
  },
  {
    id: "tool-uses",
    label: "Tools",
    icon: Wrench,
    shortcut: "g u",
    tooltip: "All tool invocations with input/output details",
    badgeKey: "errors",
    badgeColor: "bg-red-500",
  },
  {
    id: "assertions",
    label: "Assertions",
    icon: CheckSquare,
    shortcut: "g a",
    tooltip: "Validation results and pass/fail status",
    badgeKey: "failed",
    badgeColor: "bg-red-500",
  },
  {
    id: "skills",
    label: "Skills",
    icon: Sparkles,
    shortcut: "g s",
    tooltip: "Skill invocations and nested tool calls",
  },
  {
    id: "logs",
    label: "Logs",
    icon: ScrollText,
    shortcut: "g l",
    tooltip: "Human-readable event stream",
    badgeKey: "blocked",
    badgeColor: "bg-orange-500",
  },
  {
    id: "heatmap",
    label: "Heatmap",
    icon: Grid,
    shortcut: "g h",
    tooltip: "Tool usage patterns over time",
  },
  {
    id: "unified",
    label: "Unified",
    icon: FileText,
    shortcut: "g f",
    tooltip: "Unified log stream with all events",
  },
  {
    id: "messages",
    label: "Messages",
    icon: MessageSquare,
    shortcut: "g m",
    tooltip: "Message bus events",
  },
  {
    id: "events",
    label: "All Events",
    icon: Zap,
    shortcut: "g e",
    tooltip: "Platform-wide event log with real-time streaming",
    badgeKey: "errors",
    badgeColor: "bg-purple-500",
  },
];

// Tooltip component
function Tooltip({
  children,
  content,
  shortcut,
}: {
  children: React.ReactNode;
  content: string;
  shortcut?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), 500);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg">
            <p>{content}</p>
            {shortcut && (
              <p className="mt-1 text-gray-400">
                Shortcut:{" "}
                <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-200">
                  {shortcut}
                </kbd>
              </p>
            )}
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-gray-900" />
        </div>
      )}
    </div>
  );
}

// Badge component
function Badge({ count, color }: { count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span
      className={`${color} text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function ViewSelector({
  currentView,
  onViewChange,
  badgeCounts = {},
}: ViewSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(
    views.findIndex((v) => v.id === currentView),
  );
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Update focused index when currentView changes
  useEffect(() => {
    setFocusedIndex(views.findIndex((v) => v.id === currentView));
  }, [currentView]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(views.length - 1, prev + 1));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onViewChange(views[focusedIndex].id);
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(views.length - 1);
          break;
      }
    },
    [focusedIndex, onViewChange],
  );

  // Focus the button when focusedIndex changes
  useEffect(() => {
    const buttons = containerRef.current?.querySelectorAll("button");
    buttons?.[focusedIndex]?.focus();
  }, [focusedIndex]);

  // Mobile dropdown
  if (isMobile) {
    return (
      <div className="relative">
        <select
          value={currentView}
          onChange={(e) => onViewChange(e.target.value as ObservabilityView)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm appearance-none px-4 py-2 pr-10 bg-white"
          aria-label="Select view"
        >
          {views.map((view) => {
            const badgeCount = view.badgeKey ? badgeCounts[view.badgeKey] : 0;
            return (
              <option key={view.id} value={view.id}>
                {view.label}
                {badgeCount ? ` (${badgeCount})` : ""}
              </option>
            );
          })}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex border-b border-gray-200"
      role="tablist"
      aria-label="Observability views"
      onKeyDown={handleKeyDown}
    >
      {views.map((view, index) => {
        const Icon = view.icon;
        const isActive = currentView === view.id;
        const isFocused = focusedIndex === index;
        const badgeCount = view.badgeKey
          ? (badgeCounts[view.badgeKey] ?? 0)
          : 0;

        return (
          <Tooltip
            key={view.id}
            content={view.tooltip}
            shortcut={view.shortcut}
          >
            <button
              onClick={() => onViewChange(view.id)}
              onFocus={() => setFocusedIndex(index)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${view.id}`}
              tabIndex={isFocused ? 0 : -1}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium
                border-b-2 transition-colors outline-none
                ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
                ${isFocused && !isActive ? "ring-2 ring-blue-300 ring-inset" : ""}
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{view.label}</span>
              {view.badgeKey && view.badgeColor && (
                <Badge count={badgeCount} color={view.badgeColor} />
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

// Compact version for mobile (exported for backwards compatibility)
export function ViewSelectorCompact({
  currentView,
  onViewChange,
  badgeCounts = {},
}: ViewSelectorProps) {
  return (
    <select
      value={currentView}
      onChange={(e) => onViewChange(e.target.value as ObservabilityView)}
      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
      aria-label="Select view"
    >
      {views.map((view) => {
        const badgeCount = view.badgeKey ? badgeCounts[view.badgeKey] : 0;
        return (
          <option key={view.id} value={view.id}>
            {view.label}
            {badgeCount ? ` (${badgeCount})` : ""}
          </option>
        );
      })}
    </select>
  );
}
