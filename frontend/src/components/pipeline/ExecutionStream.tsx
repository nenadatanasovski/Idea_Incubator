/**
 * ExecutionStream Component
 *
 * Real-time event log showing pipeline execution events.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { useState, useRef, useEffect } from "react";
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  Bot,
  Link2,
  Filter,
} from "lucide-react";
import type { PipelineEvent } from "../../types/pipeline";

interface ExecutionStreamProps {
  events: PipelineEvent[];
  autoScroll?: boolean;
  onEventClick?: (event: PipelineEvent) => void;
  maxHeight?: string;
}

const EVENT_ICONS: Record<string, typeof Activity> = {
  "wave:started": Play,
  "wave:completed": CheckCircle,
  "task:started": Play,
  "task:completed": CheckCircle,
  "task:failed": XCircle,
  "task:blocked": AlertTriangle,
  "task:unblocked": Link2,
  "agent:assigned": Bot,
  "agent:idle": Pause,
  "agent:error": XCircle,
  "conflict:detected": AlertTriangle,
  "dependency:resolved": Link2,
};

const EVENT_COLORS: Record<string, string> = {
  "wave:started": "text-blue-600",
  "wave:completed": "text-green-600",
  "task:started": "text-blue-600",
  "task:completed": "text-green-600",
  "task:failed": "text-red-600",
  "task:blocked": "text-amber-600",
  "task:unblocked": "text-green-600",
  "agent:assigned": "text-blue-600",
  "agent:idle": "text-gray-500",
  "agent:error": "text-red-600",
  "conflict:detected": "text-amber-600",
  "dependency:resolved": "text-green-600",
};

type EventFilter = "all" | "tasks" | "agents" | "waves" | "conflicts";

export default function ExecutionStream({
  events,
  autoScroll = true,
  onEventClick,
  maxHeight = "400px",
}: ExecutionStreamProps) {
  const [isAutoScroll, setIsAutoScroll] = useState(autoScroll);
  const [filter, setFilter] = useState<EventFilter>("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const wasScrolledToBottom = useRef(true);

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (filter === "all") return true;
    if (filter === "tasks") return event.eventType.startsWith("task:");
    if (filter === "agents") return event.eventType.startsWith("agent:");
    if (filter === "waves") return event.eventType.startsWith("wave:");
    if (filter === "conflicts")
      return (
        event.eventType.startsWith("conflict:") ||
        event.eventType.startsWith("dependency:")
      );
    return true;
  });

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, isAutoScroll]);

  // Detect manual scrolling
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

    if (!isAtBottom && wasScrolledToBottom.current) {
      setIsAutoScroll(false);
    }
    wasScrolledToBottom.current = isAtBottom;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getEventMessage = (event: PipelineEvent): string => {
    const payload = event.payload as Record<string, unknown>;

    switch (event.eventType) {
      case "wave:started":
        return `Wave ${payload.waveNumber} started`;
      case "wave:completed":
        return `Wave ${payload.waveNumber} completed (${payload.duration || ""}ms)`;
      case "task:started":
        return `${payload.taskDisplayId || payload.taskId} started`;
      case "task:completed":
        return `${payload.taskDisplayId || payload.taskId} completed (${payload.duration || ""}ms)`;
      case "task:failed":
        return `${payload.taskDisplayId || payload.taskId} failed: ${payload.error || "Unknown error"}`;
      case "task:blocked":
        return `${payload.taskDisplayId || payload.taskId} blocked: ${payload.reason || "Unknown reason"}`;
      case "task:unblocked":
        return `${payload.taskDisplayId || payload.taskId} unblocked`;
      case "agent:assigned":
        return `${payload.agentName || payload.agentId} → ${payload.taskDisplayId || payload.taskId}`;
      case "agent:idle":
        return `${payload.agentName || payload.agentId} idle - ${payload.reason || "no eligible tasks"}`;
      case "agent:error":
        return `${payload.agentName || payload.agentId} error: ${payload.error || "Unknown"}`;
      case "conflict:detected":
        return `Conflict: ${payload.taskADisplayId} ✗ ${payload.taskBDisplayId}`;
      case "dependency:resolved":
        return `Dependency resolved: ${payload.taskDisplayId}`;
      default:
        return event.eventType;
    }
  };

  return (
    <div
      data-testid="execution-stream"
      className="bg-white rounded-lg border border-gray-200 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">
            Execution Stream
          </h3>
          <span className="text-xs text-gray-500">
            ({filteredEvents.length})
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter dropdown */}
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as EventFilter)}
              className="bg-gray-50 text-gray-700 text-xs rounded px-2 py-1 border border-gray-200"
            >
              <option value="all">All</option>
              <option value="tasks">Tasks only</option>
              <option value="agents">Agents only</option>
              <option value="waves">Waves only</option>
              <option value="conflicts">Conflicts</option>
            </select>
          </div>

          {/* Auto-scroll toggle */}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={isAutoScroll}
              onChange={(e) => setIsAutoScroll(e.target.checked)}
              className="rounded bg-white border-gray-300"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Event list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs"
        style={{ maxHeight }}
        onScroll={handleScroll}
      >
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No events to display
          </div>
        ) : (
          <div className="space-y-1">
            {filteredEvents.map((event) => {
              const Icon = EVENT_ICONS[event.eventType] || Activity;
              const colorClass =
                EVENT_COLORS[event.eventType] || "text-gray-500";

              return (
                <div
                  key={event.id}
                  data-testid={`stream-event-${event.id}`}
                  className={`
                    flex items-start gap-2 p-1.5 rounded
                    hover:bg-gray-50 cursor-pointer
                    transition-colors duration-150
                  `}
                  onClick={() => onEventClick?.(event)}
                >
                  <span className="text-gray-400 flex-shrink-0">
                    {formatTimestamp(event.timestamp)}
                  </span>
                  <Icon
                    className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${colorClass}`}
                  />
                  <span className={`${colorClass} break-all`}>
                    {getEventMessage(event)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
