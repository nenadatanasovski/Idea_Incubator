// =============================================================================
// FILE: frontend/src/components/ideation/SessionList.tsx
// Lists previous ideation sessions for resume/delete
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  Trash2,
  Clock,
  Lightbulb,
  Loader2,
  Search,
} from "lucide-react";
import {
  getIdeationSessions,
  deleteIdeationSession,
  type IdeationSessionSummary,
} from "../../api/client";

interface SessionListProps {
  profileId: string;
  onSelectSession: (sessionId: string) => void;
  onClose?: () => void;
}

export function SessionList({ profileId, onSelectSession }: SessionListProps) {
  const [sessions, setSessions] = useState<IdeationSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (session) =>
        session.candidateTitle?.toLowerCase().includes(query) ||
        session.lastMessagePreview?.toLowerCase().includes(query),
    );
  }, [sessions, searchQuery]);

  useEffect(() => {
    loadSessions();
  }, [profileId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getIdeationSessions(profileId, { includeAll: true });
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        "Are you sure you want to delete this session? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setDeletingId(sessionId);
      await deleteIdeationSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
            Active
          </span>
        );
      case "completed":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading sessions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadSessions}
          className="text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="mb-2">No previous sessions</p>
        <p className="text-sm">Start a new conversation to begin.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder-gray-400 text-gray-900"
        />
      </div>

      {/* Sessions list */}
      <div className="max-h-[640px] overflow-y-auto">
        <div className="space-y-2 p-2">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="mb-2">No sessions found</p>
              <p className="text-sm">Try a different search term.</p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(session.id)}
                onKeyDown={(e) =>
                  e.key === "Enter" && onSelectSession(session.id)
                }
                className="w-full p-3 border border-gray-200 rounded-lg hover:border-blue-400
                       hover:bg-blue-50/50 transition-all text-left group relative cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {session.candidateTitle ? (
                        <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="font-medium text-gray-900 truncate">
                        {session.candidateTitle || "Untitled Session"}
                      </span>
                      {getStatusBadge(session.status)}
                    </div>

                    {session.lastMessagePreview && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-1">
                        {session.lastMessagePreview}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(session.lastMessageAt)}
                      </span>
                      <span>{session.messageCount} messages</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(session.id, e)}
                    disabled={deletingId === session.id}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50
                           rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete session"
                  >
                    {deletingId === session.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default SessionList;
