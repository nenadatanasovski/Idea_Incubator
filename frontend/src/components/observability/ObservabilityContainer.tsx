/**
 * ObservabilityContainer - Main container layout for Observability page
 * Header with inline tabs and content area for all observability views
 */

import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  ScrollText,
  Play,
  Bot,
  BarChart3,
  Zap,
  Network,
} from "lucide-react";
import clsx from "clsx";

export type ConnectionStatus = "connected" | "reconnecting" | "offline";
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

interface ObservabilityContainerProps {
  children: ReactNode;
  connectionStatus?: ConnectionStatus;
  agentErrorCount?: number;
  onRefresh?: () => void | Promise<void>;
}

export default function ObservabilityContainer({
  children,
  agentErrorCount = 0,
}: ObservabilityContainerProps) {
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

  // Derive active tab from URL
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
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header with inline tabs */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        {/* Title */}
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-900">Observability</h1>
        </div>

        {/* Inline tabs */}
        <nav
          className="flex items-center gap-1"
          aria-label="Observability tabs"
        >
          {subTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <Link
                key={tab.id}
                to={tab.href}
                className={clsx(
                  "relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
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

      {/* Content area */}
      <div className="flex-1 overflow-auto bg-gray-50">{children}</div>
    </div>
  );
}
