/**
 * EventLogTab - Event log view within Observability
 * Phase 3 will migrate full EventLog content here
 */

import { useSearchParams } from "react-router-dom";
import { ScrollText } from "lucide-react";

// For now, import and render the existing EventLog functionality
// In Phase 3, we'll refactor this to be self-contained
import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  DollarSign,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import clsx from "clsx";

type TabType = "events" | "api-calls";

interface EventEntry {
  session_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
  idea_slug?: string;
  idea_title?: string;
}

interface SessionSummary {
  session_id: string;
  idea_slug: string;
  idea_title: string;
  event_count: number;
  started_at: string;
  ended_at: string;
}

const API_BASE = "http://localhost:3001";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getEventColor(type: string): string {
  if (type.includes("budget")) return "bg-cyan-100 text-cyan-800";
  if (type.includes("skipped")) return "bg-amber-100 text-amber-800";
  if (type.includes("evaluator")) return "bg-blue-100 text-blue-800";
  if (type.includes("redteam") || type.includes("challenge"))
    return "bg-red-100 text-red-800";
  if (type.includes("arbiter") || type.includes("verdict"))
    return "bg-purple-100 text-purple-800";
  if (type.includes("debate:started")) return "bg-green-100 text-green-800";
  if (type.includes("complete") || type.includes("finished"))
    return "bg-green-100 text-green-800";
  if (type.includes("error")) return "bg-red-100 text-red-800";
  if (type.includes("round")) return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-800";
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
      title={`Copy ${label || "text"}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {label && <span className="ml-1">{label}</span>}
    </button>
  );
}

export default function EventLogTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get("session");

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(
    sessionIdFromUrl,
  );
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabType>("events");

  useEffect(() => {
    fetchSessions();
  }, []);

  // Update URL when session changes
  useEffect(() => {
    if (selectedSession && selectedSession !== sessionIdFromUrl) {
      setSearchParams({ session: selectedSession });
    }
  }, [selectedSession, sessionIdFromUrl, setSearchParams]);

  // Load session from URL on mount
  useEffect(() => {
    if (sessionIdFromUrl && sessions.length > 0) {
      const session = sessions.find((s) => s.session_id === sessionIdFromUrl);
      if (session) {
        fetchSessionEvents(session.session_id, session.idea_slug);
      }
    }
  }, [sessionIdFromUrl, sessions]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const ideasRes = await fetch(`${API_BASE}/api/ideas`);
      const ideasData = await ideasRes.json();

      if (!ideasData.success) {
        throw new Error(ideasData.error || "Failed to fetch ideas");
      }

      const allSessions: SessionSummary[] = [];

      for (const idea of ideasData.data.slice(0, 20)) {
        try {
          const sessionsRes = await fetch(
            `${API_BASE}/api/ideas/${idea.slug}/events/sessions`,
          );
          const sessionsData = await sessionsRes.json();

          if (sessionsData.success && sessionsData.data) {
            for (const session of sessionsData.data) {
              allSessions.push({
                ...session,
                idea_slug: idea.slug,
                idea_title: idea.title,
              });
            }
          }
        } catch {
          // Skip ideas with no sessions
        }
      }

      allSessions.sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      );

      setSessions(allSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch sessions");
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionEvents = async (sessionId: string, ideaSlug: string) => {
    setEventsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/ideas/${ideaSlug}/events?sessionId=${sessionId}`,
      );
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch events");
      }

      setEvents(data.data);
      setSelectedSession(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    } finally {
      setEventsLoading(false);
    }
  };

  const toggleEvent = (index: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const apiCalls = useMemo(
    () => events.filter((e) => e.event_type === "api:call"),
    [events],
  );

  const regularEvents = useMemo(
    () => events.filter((e) => e.event_type !== "api:call"),
    [events],
  );

  const eventTypes = [
    ...new Set(regularEvents.map((e) => e.event_type)),
  ].sort();

  const filteredEvents = useMemo(() => {
    if (activeTab === "api-calls") {
      return apiCalls;
    }
    return eventTypeFilter
      ? regularEvents.filter((e) => e.event_type === eventTypeFilter)
      : regularEvents;
  }, [activeTab, apiCalls, regularEvents, eventTypeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <span className="text-red-700">{error}</span>
        <button
          onClick={() => {
            setError(null);
            fetchSessions();
          }}
          className="ml-auto text-red-600 hover:text-red-800"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header clarifying what this tab shows */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">
            Debate & Evaluation Events
          </h2>
          <p className="text-sm text-gray-500">
            View events from idea evaluations, red team debates, and arbiter
            verdicts
          </p>
        </div>
        <button
          onClick={fetchSessions}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Sessions List */}
        <div className="lg:col-span-1 flex flex-col min-h-0">
          <div className="bg-white rounded-lg shadow flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-sm font-medium text-gray-700">Sessions</h2>
            </div>
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <ScrollText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No evaluation sessions yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 overflow-y-auto flex-1">
                {sessions.map((session) => (
                  <li key={`${session.idea_slug}-${session.session_id}`}>
                    <div
                      onClick={() =>
                        fetchSessionEvents(
                          session.session_id,
                          session.idea_slug,
                        )
                      }
                      className={clsx(
                        "w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer",
                        selectedSession === session.session_id &&
                          "bg-primary-50 border-l-4 border-primary-500",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {session.idea_title}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {session.event_count} events
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatDate(session.started_at)}
                        </span>
                        <CopyButton text={session.session_id} label="ID" />
                      </div>
                      <div className="mt-1 text-xs text-gray-400 font-mono truncate">
                        {session.session_id.substring(0, 8)}...
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Events Table */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="bg-white rounded-lg shadow flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Tabs */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setActiveTab("events")}
                  className={clsx(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    activeTab === "events"
                      ? "bg-white text-primary-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                  )}
                >
                  <ScrollText className="h-4 w-4 inline mr-1.5" />
                  Events{" "}
                  {selectedSession &&
                    activeTab === "events" &&
                    `(${regularEvents.length})`}
                </button>
                <button
                  onClick={() => setActiveTab("api-calls")}
                  className={clsx(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    activeTab === "api-calls"
                      ? "bg-white text-primary-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
                  )}
                >
                  <Zap className="h-4 w-4 inline mr-1.5" />
                  API Calls{" "}
                  {selectedSession &&
                    activeTab === "api-calls" &&
                    `(${apiCalls.length})`}
                </button>
              </div>
              {activeTab === "events" && events.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value)}
                    className="text-xs border-gray-300 rounded-md"
                  >
                    <option value="">All types</option>
                    {eventTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {eventsLoading ? (
              <div className="p-8 flex items-center justify-center flex-1">
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              </div>
            ) : !selectedSession ? (
              <div className="p-8 text-center text-gray-500 flex-1 flex flex-col items-center justify-center">
                <ScrollText className="h-12 w-12 mb-3 text-gray-300" />
                <p>Select a session to view events</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500 flex-1">
                <p>
                  {activeTab === "api-calls"
                    ? "No API calls recorded"
                    : "No events found"}
                </p>
                {activeTab === "api-calls" && (
                  <p className="text-xs mt-2 text-gray-400">
                    API calls are captured during new evaluations
                  </p>
                )}
              </div>
            ) : activeTab === "api-calls" ? (
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Operation
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tokens
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEvents.map((event, index) => (
                      <React.Fragment key={`api-${index}-${event.created_at}`}>
                        <tr
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleEvent(index)}
                        >
                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                            {new Date(event.created_at).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-2">
                            <span className="text-sm font-medium text-gray-900">
                              {String(event.event_data.message || "Unknown")}
                            </span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="flex items-center space-x-1 text-xs">
                              <span className="text-blue-600 font-medium flex items-center">
                                <ArrowRight className="h-3 w-3 mr-0.5" />
                                {Number(
                                  event.event_data.inputTokens || 0,
                                ).toLocaleString()}
                              </span>
                              <span className="text-gray-400">/</span>
                              <span className="text-green-600 font-medium flex items-center">
                                <ArrowLeft className="h-3 w-3 mr-0.5" />
                                {Number(
                                  event.event_data.outputTokens || 0,
                                ).toLocaleString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-right">
                            <span className="inline-flex items-center text-xs font-medium text-emerald-700">
                              <DollarSign className="h-3 w-3" />
                              {Number(event.event_data.cost || 0).toFixed(4)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {expandedEvents.has(index) ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </td>
                        </tr>
                        {expandedEvents.has(index) && (
                          <tr>
                            <td colSpan={5} className="px-4 py-3 bg-gray-50">
                              <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(event.event_data, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                {/* API Calls Summary */}
                <div className="px-4 py-3 bg-gray-100 border-t border-gray-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      Total: {apiCalls.length} API call
                      {apiCalls.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-600">
                        Tokens:{" "}
                        {apiCalls
                          .reduce(
                            (sum, e) =>
                              sum + Number(e.event_data.inputTokens || 0),
                            0,
                          )
                          .toLocaleString()}{" "}
                        in /{" "}
                        {apiCalls
                          .reduce(
                            (sum, e) =>
                              sum + Number(e.event_data.outputTokens || 0),
                            0,
                          )
                          .toLocaleString()}{" "}
                        out
                      </span>
                      <span className="font-medium text-emerald-700">
                        Total Cost: $
                        {apiCalls
                          .reduce(
                            (sum, e) => sum + Number(e.event_data.cost || 0),
                            0,
                          )
                          .toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEvents.map((event, index) => (
                      <React.Fragment
                        key={`event-${index}-${event.created_at}`}
                      >
                        <tr
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleEvent(index)}
                        >
                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                            {new Date(event.created_at).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span
                              className={clsx(
                                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                getEventColor(event.event_type),
                              )}
                            >
                              {event.event_type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-600 max-w-md truncate">
                            {event.event_type === "budget:status" && (
                              <>
                                <span className="font-medium text-cyan-700">
                                  $
                                  {Number(event.event_data.spent || 0).toFixed(
                                    2,
                                  )}{" "}
                                  spent
                                </span>
                                <span className="mx-1 text-gray-400">|</span>
                                <span className="text-gray-500">
                                  $
                                  {Number(
                                    event.event_data.remaining || 0,
                                  ).toFixed(2)}{" "}
                                  remaining
                                </span>
                              </>
                            )}
                            {event.event_type !== "budget:status" && (
                              <>
                                {"criterion" in event.event_data && (
                                  <span className="font-medium">
                                    {String(event.event_data.criterion)}
                                  </span>
                                )}
                                {"score" in event.event_data && (
                                  <span className="ml-2 text-gray-500">
                                    Score: {String(event.event_data.score)}
                                  </span>
                                )}
                                {"message" in event.event_data &&
                                  !("criterion" in event.event_data) && (
                                    <span>
                                      {String(
                                        event.event_data.message,
                                      ).substring(0, 50)}
                                      ...
                                    </span>
                                  )}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {expandedEvents.has(index) ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </td>
                        </tr>
                        {expandedEvents.has(index) && (
                          <tr>
                            <td colSpan={4} className="px-4 py-3 bg-gray-50">
                              <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(event.event_data, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedSession && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Session ID:</span>
                  <div className="flex items-center space-x-2">
                    <code className="text-xs font-mono text-gray-800 bg-white px-2 py-1 rounded border">
                      {selectedSession}
                    </code>
                    <CopyButton text={selectedSession} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
