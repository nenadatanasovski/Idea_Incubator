/**
 * ObservabilitySubTabs - Sub-tab navigation for Observability sections
 */

import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ScrollText,
  Play,
  Bot,
  BarChart3,
  Zap,
  Network,
} from "lucide-react";
import clsx from "clsx";

export type ObservabilityTab =
  | "overview"
  | "events"
  | "executions"
  | "agents"
  | "analytics"
  | "platform-events"
  | "memory-graph";

interface SubTab {
  id: ObservabilityTab;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  badge?: number;
}

interface ObservabilitySubTabsProps {
  activeTab: ObservabilityTab;
  agentErrorCount?: number;
}

export default function ObservabilitySubTabs({
  activeTab,
  agentErrorCount = 0,
}: ObservabilitySubTabsProps) {
  const location = useLocation();

  const subTabs: SubTab[] = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      href: "/observability",
    },
    {
      id: "events",
      label: "Debate Events",
      icon: ScrollText,
      href: "/observability/events",
    },
    {
      id: "executions",
      label: "Executions",
      icon: Play,
      href: "/observability/executions",
    },
    {
      id: "agents",
      label: "Agents",
      icon: Bot,
      href: "/observability/agents",
      badge: agentErrorCount > 0 ? agentErrorCount : undefined,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
      href: "/observability/analytics",
    },
    {
      id: "platform-events",
      label: "All Events",
      icon: Zap,
      href: "/observability/platform-events",
    },
    {
      id: "memory-graph",
      label: "Memory Graph",
      icon: Network,
      href: "/observability/memory-graph",
    },
  ];

  // Determine active tab from URL if not explicitly set
  const getActiveTab = (): ObservabilityTab => {
    const path = location.pathname;
    if (path === "/observability" || path === "/observability/") {
      return "overview";
    }
    if (path.startsWith("/observability/events")) return "events";
    if (path.startsWith("/observability/executions")) return "executions";
    if (path.startsWith("/observability/agents")) return "agents";
    if (path.startsWith("/observability/analytics")) return "analytics";
    if (path.startsWith("/observability/platform-events"))
      return "platform-events";
    if (path.startsWith("/observability/memory-graph")) return "memory-graph";
    return activeTab;
  };

  const currentActiveTab = getActiveTab();

  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <nav className="flex space-x-1 px-6" aria-label="Observability tabs">
        {subTabs.map((tab) => {
          const isActive = currentActiveTab === tab.id;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              to={tab.href}
              className={clsx(
                "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "text-blue-600 border-b-2 border-blue-600 -mb-px bg-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-t-lg",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
