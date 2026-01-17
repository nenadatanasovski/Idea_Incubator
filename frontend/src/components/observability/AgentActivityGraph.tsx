/**
 * AgentActivityGraph - Real-time agent activity monitoring
 */

import { useState, useMemo, useEffect } from "react";
import { Activity, AlertCircle, Clock, CheckCircle, Pause } from "lucide-react";
import { useObservabilityStream } from "../../hooks/useObservabilityStream";
import type { ObservabilityEvent } from "../../types/observability";

interface AgentActivityGraphProps {
  executionId?: string;
  refreshInterval?: number;
}

interface AgentState {
  id: string;
  name: string;
  status: "active" | "idle" | "slow" | "stuck";
  lastActivity: Date;
  recentEvents: ObservabilityEvent[];
  taskCount: number;
  errorCount: number;
}

const SLOW_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export default function AgentActivityGraph({
  executionId,
  refreshInterval = 5000,
}: AgentActivityGraphProps) {
  const { events, isConnected } = useObservabilityStream({
    executionId,
    autoConnect: true,
  });
  const [now, setNow] = useState(new Date());

  // Update "now" periodically to refresh status calculations
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Aggregate events by agent/instance
  const agents = useMemo(() => {
    const agentMap = new Map<string, AgentState>();

    // Process events to build agent states
    events.forEach((event) => {
      // Extract agent/instance ID from event data
      const instanceId = (event.data as any)?.instanceId || "unknown";

      if (!agentMap.has(instanceId)) {
        agentMap.set(instanceId, {
          id: instanceId,
          name: `Agent ${instanceId.slice(0, 8)}`,
          status: "idle",
          lastActivity: new Date(event.timestamp),
          recentEvents: [],
          taskCount: 0,
          errorCount: 0,
        });
      }

      const agent = agentMap.get(instanceId)!;
      const eventTime = new Date(event.timestamp);

      if (eventTime > agent.lastActivity) {
        agent.lastActivity = eventTime;
      }

      agent.recentEvents.push(event);
      if (agent.recentEvents.length > 50) {
        agent.recentEvents = agent.recentEvents.slice(-50);
      }

      // Count tasks and errors
      if (event.type === "transcript:entry") {
        const entryType = (event.data as any)?.entryType;
        if (entryType === "task_end") agent.taskCount++;
        if (entryType === "error") agent.errorCount++;
      }
    });

    // Calculate status based on last activity
    agentMap.forEach((agent) => {
      const timeSinceActivity = now.getTime() - agent.lastActivity.getTime();

      if (agent.recentEvents.length === 0) {
        agent.status = "idle";
      } else if (timeSinceActivity > STUCK_THRESHOLD_MS) {
        agent.status = "stuck";
      } else if (timeSinceActivity > SLOW_THRESHOLD_MS) {
        agent.status = "slow";
      } else {
        agent.status = "active";
      }
    });

    return Array.from(agentMap.values()).sort((a, b) => {
      // Sort by status priority: stuck > slow > active > idle
      const priority = { stuck: 0, slow: 1, active: 2, idle: 3 };
      return priority[a.status] - priority[b.status];
    });
  }, [events, now]);

  const getStatusIcon = (status: AgentState["status"]) => {
    switch (status) {
      case "active":
        return <Activity className="h-4 w-4 text-green-500 animate-pulse" />;
      case "idle":
        return <Pause className="h-4 w-4 text-gray-400" />;
      case "slow":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "stuck":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: AgentState["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 border-green-300";
      case "idle":
        return "bg-gray-50 border-gray-200";
      case "slow":
        return "bg-yellow-100 border-yellow-300";
      case "stuck":
        return "bg-red-100 border-red-300";
    }
  };

  const formatTimeSince = (date: Date) => {
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  // Calculate activity for last 5 minutes
  const activityBins = useMemo(() => {
    const binCount = 30; // 10-second bins
    const binDuration = 10 * 1000; // 10 seconds
    const bins = new Array(binCount).fill(0);
    const cutoff = now.getTime() - binCount * binDuration;

    events.forEach((event) => {
      const eventTime = new Date(event.timestamp).getTime();
      if (eventTime >= cutoff) {
        const binIdx = Math.floor((eventTime - cutoff) / binDuration);
        if (binIdx >= 0 && binIdx < binCount) {
          bins[binIdx]++;
        }
      }
    });

    const maxCount = Math.max(...bins, 1);
    return bins.map((c) => c / maxCount);
  }, [events, now]);

  return (
    <div className="space-y-4 p-4">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Agent Activity</h3>
        <div className="flex items-center gap-1.5 text-xs">
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-300"}`}
          />
          <span className="text-gray-500">
            {isConnected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Activity sparkline */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-2">Activity (last 5 min)</div>
        <div className="flex items-end gap-px h-12">
          {activityBins.map((ratio, idx) => (
            <div
              key={idx}
              className="flex-1 bg-blue-400 rounded-t transition-all"
              style={{
                height: `${ratio * 100}%`,
                minHeight: ratio > 0 ? 2 : 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Alerts */}
      {agents.filter((a) => a.status === "stuck" || a.status === "slow")
        .length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">Alerts</h4>
          <ul className="text-xs text-yellow-700 space-y-1">
            {agents
              .filter((a) => a.status === "stuck")
              .map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <span>
                    {a.name} appears stuck (no activity for &gt;10 min)
                  </span>
                </li>
              ))}
            {agents
              .filter((a) => a.status === "slow")
              .map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-yellow-500" />
                  <span>{a.name} is slow (no activity for &gt;3 min)</span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Agent cards */}
      {agents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Activity className="h-8 w-8 mx-auto mb-2" />
          <p>No agent activity detected</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`rounded-lg border p-3 ${getStatusColor(agent.status)}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(agent.status)}
                <span className="text-sm font-medium">{agent.name}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {formatTimeSince(agent.lastActivity)}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-600">
                <span>
                  <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />
                  {agent.taskCount} tasks
                </span>
                <span>
                  <AlertCircle className="h-3 w-3 inline mr-1 text-red-500" />
                  {agent.errorCount} errors
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
