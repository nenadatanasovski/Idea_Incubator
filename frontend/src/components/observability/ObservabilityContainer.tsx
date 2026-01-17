/**
 * ObservabilityContainer - Main container layout for Observability page
 * Provides header, sub-tabs, and content area for all observability views
 */

import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import ObservabilityHeader, { ConnectionStatus } from "./ObservabilityHeader";
import ObservabilitySubTabs, { ObservabilityTab } from "./ObservabilitySubTabs";

interface ObservabilityContainerProps {
  children: ReactNode;
  connectionStatus?: ConnectionStatus;
  agentErrorCount?: number;
  onRefresh?: () => void | Promise<void>;
}

export default function ObservabilityContainer({
  children,
  connectionStatus = "connected",
  agentErrorCount = 0,
  onRefresh,
}: ObservabilityContainerProps) {
  const location = useLocation();

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
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header with unified search and connection status */}
      <ObservabilityHeader
        connectionStatus={connectionStatus}
        onRefresh={onRefresh}
      />

      {/* Sub-tab navigation */}
      <ObservabilitySubTabs
        activeTab={activeTab}
        agentErrorCount={agentErrorCount}
      />

      {/* Content area */}
      <div className="flex-1 overflow-auto bg-gray-50">{children}</div>
    </div>
  );
}
