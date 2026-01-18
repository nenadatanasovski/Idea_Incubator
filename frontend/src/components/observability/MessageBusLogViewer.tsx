/**
 * MessageBusLogViewer - View message bus events and inter-agent communication
 *
 * Features:
 * - Filter by event type
 * - Filter by source/target agent
 * - Payload preview
 * - Timeline view
 * - Real-time updates
 */

import { useState, useMemo, useCallback } from "react";
import {
  Radio,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Search,
} from "lucide-react";

interface MessageBusEvent {
  id: string;
  type: string;
  source: string;
  target?: string;
  payload: unknown;
  timestamp: string;
  correlationId?: string;
}

interface MessageBusLogViewerProps {
  events: MessageBusEvent[];
  loading?: boolean;
  onRefresh?: () => void;
  onEventClick?: (event: MessageBusEvent) => void;
}

// Event type colors
const eventTypeColors: Record<string, string> = {
  "task:started": "bg-green-100 text-green-700",
  "task:completed": "bg-blue-100 text-blue-700",
  "task:failed": "bg-red-100 text-red-700",
  "agent:spawn": "bg-purple-100 text-purple-700",
  "agent:stop": "bg-gray-100 text-gray-700",
  "question:ask": "bg-yellow-100 text-yellow-700",
  "question:answer": "bg-teal-100 text-teal-700",
  default: "bg-gray-100 text-gray-700",
};

export default function MessageBusLogViewer({
  events,
  loading = false,
  onRefresh,
  onEventClick,
}: MessageBusLogViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique event types
  const eventTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.type));
    return Array.from(types).sort();
  }, [events]);

  // Get unique sources
  const sources = useMemo(() => {
    const srcs = new Set(events.map((e) => e.source));
    return Array.from(srcs).sort();
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.type.toLowerCase().includes(query) ||
          e.source.toLowerCase().includes(query) ||
          e.target?.toLowerCase().includes(query) ||
          JSON.stringify(e.payload).toLowerCase().includes(query),
      );
    }

    if (selectedType) {
      result = result.filter((e) => e.type === selectedType);
    }

    if (selectedSource) {
      result = result.filter((e) => e.source === selectedSource);
    }

    return result;
  }, [events, searchQuery, selectedType, selectedSource]);

  // Toggle event expansion
  const toggleEvent = useCallback((eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }, []);

  // Copy event ID
  const handleCopyId = useCallback(async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedType(null);
    setSelectedSource(null);
  }, []);

  const hasActiveFilters = searchQuery || selectedType || selectedSource;

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-purple-500" />
            <h3 className="font-medium text-gray-900">Message Bus Events</h3>
            <span className="text-xs text-gray-500">
              ({filteredEvents.length}
              {filteredEvents.length !== events.length && ` / ${events.length}`}
              )
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded ${
                showFilters || hasActiveFilters
                  ? "bg-blue-100 text-blue-600"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }`}
              title="Filters"
            >
              <Filter className="h-4 w-4" />
            </button>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                title="Refresh"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mt-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Type filter */}
            <select
              value={selectedType || ""}
              onChange={(e) => setSelectedType(e.target.value || null)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="">All Types</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {/* Source filter */}
            <select
              value={selectedSource || ""}
              onChange={(e) => setSelectedSource(e.target.value || null)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="">All Sources</option>
              {sources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-red-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Events list */}
      <div className="divide-y max-h-96 overflow-auto">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {hasActiveFilters ? "No matching events" : "No events yet"}
          </div>
        ) : (
          filteredEvents.map((event) => {
            const isExpanded = expandedEvents.has(event.id);
            const typeColor =
              eventTypeColors[event.type] || eventTypeColors.default;

            return (
              <div key={event.id} className="hover:bg-gray-50">
                <button
                  onClick={() => toggleEvent(event.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left"
                >
                  <span className="text-gray-400 mt-0.5">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${typeColor}`}
                      >
                        {event.type}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <span className="font-medium">{event.source}</span>
                        {event.target && (
                          <>
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-medium">{event.target}</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {new Date(event.timestamp).toLocaleTimeString()}
                      {event.correlationId && (
                        <span className="text-gray-300">
                          · {event.correlationId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyId(event.id);
                    }}
                    className="p-1 text-gray-300 hover:text-gray-500"
                    title="Copy ID"
                  >
                    {copiedId === event.id ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </button>

                {/* Expanded payload */}
                {isExpanded && (
                  <div className="px-4 pb-3">
                    <div className="ml-7 bg-gray-900 rounded-md overflow-auto">
                      <pre className="p-3 text-xs text-gray-100 font-mono">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </div>
                    {onEventClick && (
                      <div className="ml-7 mt-2">
                        <button
                          onClick={() => onEventClick(event)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View Details →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      {events.length > 0 && (
        <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>
              {eventTypes.length} event types · {sources.length} sources
            </span>
            <span>
              Last event: {new Date(events[0]?.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
