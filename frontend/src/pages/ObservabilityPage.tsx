/**
 * ObservabilityPage - Main observability page with container, connection provider, and sub-tab routing
 */

import { useState, useCallback, useEffect } from "react";
import { Outlet } from "react-router-dom";
import ObservabilityContainer from "../components/observability/ObservabilityContainer";
import {
  ObservabilityConnectionProvider,
  useObservabilityConnectionContext,
} from "../components/observability/ObservabilityConnectionProvider";

const API_BASE = "http://localhost:3001";

// Inner component that uses the connection context
function ObservabilityPageContent() {
  const { status, events } = useObservabilityConnectionContext();

  // Agent error count - fetched from API
  const [agentErrorCount, setAgentErrorCount] = useState(0);

  // Fetch agent error count
  const fetchAgentErrorCount = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/agents`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          const errorCount = data.data.filter(
            (a: { status: string }) => a.status === "error",
          ).length;
          setAgentErrorCount(errorCount);
        }
      }
    } catch (err) {
      console.error("Failed to fetch agent error count:", err);
    }
  }, []);

  // Fetch on mount and when events arrive
  useEffect(() => {
    fetchAgentErrorCount();
  }, [fetchAgentErrorCount]);

  // Re-fetch when agent events arrive
  useEffect(() => {
    const agentEvents = events.filter((e) => e.type === "agent");
    if (agentEvents.length > 0) {
      fetchAgentErrorCount();
    }
  }, [events, fetchAgentErrorCount]);

  // Refresh handler - triggers data refresh
  const handleRefresh = useCallback(() => {
    fetchAgentErrorCount();
    console.log("Refreshing observability data...");
  }, [fetchAgentErrorCount]);

  return (
    <ObservabilityContainer
      connectionStatus={status}
      agentErrorCount={agentErrorCount}
      onRefresh={handleRefresh}
    >
      <Outlet />
    </ObservabilityContainer>
  );
}

// Main page component wraps with connection provider
export default function ObservabilityPage() {
  return (
    <ObservabilityConnectionProvider>
      <ObservabilityPageContent />
    </ObservabilityConnectionProvider>
  );
}
