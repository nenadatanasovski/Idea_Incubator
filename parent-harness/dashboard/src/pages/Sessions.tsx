import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { useSessions, type Session } from "../hooks/useSessions";
import { useWebSocket } from "../hooks/useWebSocket";
import { AgentSessionsView } from "../components/AgentSessionsView";
import { SessionLogModal } from "../components/SessionLogModal";

export function Sessions() {
  const { sessions, loading, error, refetch } = useSessions();
  const { connected, subscribe } = useWebSocket();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  // Real-time session updates via WebSocket
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type.startsWith("session:")) {
        refetch();
      }
    });
    return unsubscribe;
  }, [subscribe, refetch]);

  // Generate mock sessions for demo if none exist
  const displaySessions =
    sessions.length > 0 ? sessions : generateMockSessions();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Sessions</h1>
            <p className="text-gray-400">
              View agent session history, iterations, and logs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="text-xs text-gray-500">
                {connected ? "Live" : "Connecting..."}
              </span>
            </div>
            {loading && (
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Recent Sessions Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="font-semibold">Recent Sessions</h2>
            <p className="text-xs text-gray-500">Click a row to view logs</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Agent</th>
                <th className="text-left p-3">Task</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Started</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displaySessions.slice(0, 20).map((session) => (
                <tr
                  key={session.id}
                  className="border-t border-gray-700 hover:bg-gray-700/50 cursor-pointer"
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  <td className="p-3 font-mono text-xs text-gray-400">
                    {session.id.slice(0, 8)}...
                  </td>
                  <td className="p-3 text-blue-400">{session.agent_id}</td>
                  <td className="p-3 text-gray-300">
                    {session.task_id || "-"}
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        session.status === "completed"
                          ? "text-green-400"
                          : session.status === "failed"
                            ? "text-red-400"
                            : session.status === "running"
                              ? "text-blue-400"
                              : "text-gray-400"
                      }
                    >
                      {session.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {new Date(session.started_at).toLocaleString("en-AU", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSessionId(session.id);
                      }}
                      className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                    >
                      📋 Logs
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Full-width Agent Sessions View with iterations and lineage */}
        <AgentSessionsView sessions={displaySessions} />

        <div className="text-gray-500 text-sm flex items-center gap-4">
          <span>Total sessions: {displaySessions.length}</span>
          <span>|</span>
          <span>
            Running:{" "}
            {displaySessions.filter((s) => s.status === "running").length}
          </span>
          <span>|</span>
          <span>
            Completed:{" "}
            {displaySessions.filter((s) => s.status === "completed").length}
          </span>
          <span>|</span>
          <span>
            Failed:{" "}
            {displaySessions.filter((s) => s.status === "failed").length}
          </span>
        </div>

        {/* Session Log Modal */}
        {selectedSessionId && (
          <SessionLogModal
            sessionId={selectedSessionId}
            onClose={() => setSelectedSessionId(null)}
          />
        )}
      </div>
    </Layout>
  );
}

// Generate mock sessions for demonstration
function generateMockSessions(): Session[] {
  const now = new Date();

  return [
    {
      id: "session-001-abc123",
      agent_id: "build-agent-01",
      task_id: "task-042",
      run_id: null,
      wave_number: 2,
      lane_id: "api",
      status: "running",
      started_at: new Date(now.getTime() - 3600000).toISOString(),
      completed_at: null,
      current_iteration: 3,
      total_iterations: 5,
      tasks_completed: 12,
      tasks_failed: 2,
      parent_session_id: null,
      metadata: null,
    },
    {
      id: "session-002-def456",
      agent_id: "build-agent-02",
      task_id: "task-044",
      run_id: null,
      wave_number: 1,
      lane_id: "ui",
      status: "completed",
      started_at: new Date(now.getTime() - 7200000).toISOString(),
      completed_at: new Date(now.getTime() - 5400000).toISOString(),
      current_iteration: 2,
      total_iterations: 2,
      tasks_completed: 8,
      tasks_failed: 0,
      parent_session_id: null,
      metadata: null,
    },
    {
      id: "session-003-ghi789",
      agent_id: "test-agent-01",
      task_id: "task-045",
      run_id: null,
      wave_number: 2,
      lane_id: "tests",
      status: "completed",
      started_at: new Date(now.getTime() - 6000000).toISOString(),
      completed_at: new Date(now.getTime() - 4800000).toISOString(),
      current_iteration: 1,
      total_iterations: 1,
      tasks_completed: 6,
      tasks_failed: 0,
      parent_session_id: "session-002-def456",
      metadata: null,
    },
    {
      id: "session-004-jkl012",
      agent_id: "build-agent-03",
      task_id: "task-046",
      run_id: null,
      wave_number: 3,
      lane_id: "database",
      status: "failed",
      started_at: new Date(now.getTime() - 10800000).toISOString(),
      completed_at: new Date(now.getTime() - 9000000).toISOString(),
      current_iteration: 3,
      total_iterations: 3,
      tasks_completed: 2,
      tasks_failed: 5,
      parent_session_id: null,
      metadata: null,
    },
    {
      id: "session-005-mno345",
      agent_id: "spec-agent-01",
      task_id: "task-043",
      run_id: null,
      wave_number: 1,
      lane_id: "types",
      status: "paused",
      started_at: new Date(now.getTime() - 1800000).toISOString(),
      completed_at: null,
      current_iteration: 2,
      total_iterations: 4,
      tasks_completed: 3,
      tasks_failed: 0,
      parent_session_id: null,
      metadata: null,
    },
  ];
}

export default Sessions;
