import { useState, useMemo } from "react";

interface Event {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  agentId?: string;
  severity?: "debug" | "info" | "warning" | "error";
}

interface EventStreamProps {
  events: Event[];
}

type SeverityFilter = "all" | "debug" | "info" | "warning" | "error";

const typeColors: Record<string, string> = {
  "task:assigned": "text-blue-400",
  "task:completed": "text-green-400",
  "task:failed": "text-red-400",
  "agent:started": "text-purple-400",
  "agent:idle": "text-gray-400",
  "agent:error": "text-red-400",
  "tool:started": "text-yellow-400",
  "tool:completed": "text-yellow-300",
  "qa:passed": "text-green-400",
  "qa:failed": "text-red-400",
  "cron:tick": "text-gray-500",
};

const typeIcons: Record<string, string> = {
  "task:assigned": "📋",
  "task:completed": "✅",
  "task:failed": "❌",
  "agent:started": "🚀",
  "agent:idle": "💤",
  "agent:error": "🔴",
  "tool:started": "🔧",
  "tool:completed": "🔧",
  "qa:passed": "✅",
  "qa:failed": "❌",
  "cron:tick": "⏰",
};

const severityColors: Record<string, string> = {
  debug: "text-gray-500",
  info: "text-blue-400",
  warning: "text-yellow-400",
  error: "text-red-400",
};

export function EventStream({ events }: EventStreamProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Get unique event types for the type filter dropdown
  const eventTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.type));
    return Array.from(types).sort();
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        searchQuery === "" ||
        event.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.agentId?.toLowerCase().includes(searchQuery.toLowerCase()) ??
          false);

      const matchesSeverity =
        severityFilter === "all" || event.severity === severityFilter;
      const matchesType = typeFilter === "all" || event.type === typeFilter;

      return matchesSearch && matchesSeverity && matchesType;
    });
  }, [events, searchQuery, severityFilter, typeFilter]);

  const isFiltered =
    searchQuery !== "" || severityFilter !== "all" || typeFilter !== "all";

  return (
    <div data-testid="event-stream" className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 flex-1"
          />
          <select
            value={severityFilter}
            onChange={(e) =>
              setSeverityFilter(e.target.value as SeverityFilter)
            }
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Severity</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Types</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
              autoScroll
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-400"
            }`}
          >
            Auto-scroll: {autoScroll ? "ON" : "OFF"}
          </button>
        </div>
        <div className="text-xs text-gray-500">
          {isFiltered
            ? `${filteredEvents.length} of ${events.length} events`
            : `${events.length} events`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            data-testid="event-item"
            className="flex items-start gap-2 text-sm py-1 border-b border-gray-700/50"
          >
            <span className="text-gray-500 text-xs whitespace-nowrap">
              {event.timestamp}
            </span>
            {event.severity && (
              <span
                className={`text-xs font-mono ${severityColors[event.severity] || "text-gray-400"}`}
              >
                {event.severity.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-base">{typeIcons[event.type] || "📌"}</span>
            <span
              className={`font-mono text-xs ${typeColors[event.type] || "text-gray-400"}`}
            >
              {event.type}
            </span>
            <span className="text-gray-300 text-xs flex-1">
              {event.message}
            </span>
            {event.agentId && (
              <span className="text-xs text-gray-500">[{event.agentId}]</span>
            )}
          </div>
        ))}
        {filteredEvents.length === 0 && events.length > 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No events match your filters
          </div>
        )}
      </div>
    </div>
  );
}

// Mock data for development
export const mockEvents: Event[] = [
  {
    id: "1",
    timestamp: "14:23:45",
    type: "task:assigned",
    message: "TASK-042 assigned to Build Agent",
    agentId: "build_agent",
    severity: "info",
  },
  {
    id: "2",
    timestamp: "14:23:46",
    type: "tool:started",
    message: "read_file → server/routes/api.ts",
    agentId: "build_agent",
    severity: "debug",
  },
  {
    id: "3",
    timestamp: "14:23:48",
    type: "tool:completed",
    message: "read_file completed (2.4KB)",
    agentId: "build_agent",
    severity: "debug",
  },
  {
    id: "4",
    timestamp: "14:23:50",
    type: "tool:started",
    message: "edit_file → server/routes/api.ts",
    agentId: "build_agent",
    severity: "debug",
  },
  {
    id: "5",
    timestamp: "14:23:55",
    type: "tool:completed",
    message: "edit_file (+26 lines)",
    agentId: "build_agent",
    severity: "debug",
  },
  {
    id: "6",
    timestamp: "14:24:00",
    type: "task:completed",
    message: "TASK-042 completed successfully",
    agentId: "build_agent",
    severity: "info",
  },
  {
    id: "7",
    timestamp: "14:24:01",
    type: "qa:passed",
    message: "TASK-042 validation passed",
    agentId: "qa_agent",
    severity: "info",
  },
  {
    id: "8",
    timestamp: "14:25:00",
    type: "cron:tick",
    message: "Tick #143: 3 agents working, 4 idle",
    severity: "debug",
  },
];

export default EventStream;
