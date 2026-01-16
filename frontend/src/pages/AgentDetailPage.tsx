import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  Play,
  Square,
  RefreshCw,
} from "lucide-react";

interface AgentDetail {
  id: string;
  name: string;
  type: string;
  status: "idle" | "running" | "error" | "waiting" | "halted";
  lastHeartbeat: string;
  currentTask: string | null;
  sessionId: string | null;
  errorMessage: string | null;
  recentTasks: TaskExecution[];
  pendingQuestions: PendingQuestion[];
}

interface TaskExecution {
  id: string;
  task_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error: string | null;
}

interface PendingQuestion {
  id: string;
  type: string;
  content: string;
  priority: number;
  blocking: number;
  created_at: string;
}

interface AgentLog {
  id: string;
  agent_id: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

const statusConfig: Record<
  string,
  { bg: string; text: string; icon: typeof Activity }
> = {
  idle: { bg: "bg-gray-100", text: "text-gray-700", icon: Clock },
  running: { bg: "bg-green-100", text: "text-green-700", icon: Activity },
  error: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
  waiting: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
  halted: { bg: "bg-red-100", text: "text-red-700", icon: AlertTriangle },
};

const taskStatusConfig: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-gray-100", text: "text-gray-700" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700" },
  complete: { bg: "bg-green-100", text: "text-green-700" },
  failed: { bg: "bg-red-100", text: "text-red-700" },
  blocked: { bg: "bg-amber-100", text: "text-amber-700" },
};

export default function AgentDetailPage(): JSX.Element {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "questions" | "logs">(
    "tasks",
  );

  useEffect(() => {
    fetchAgentDetails();
    fetchAgentLogs();
  }, [agentId]);

  async function fetchAgentDetails(): Promise<void> {
    try {
      const response = await fetch(`/api/agents/${agentId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch agent details");
      }
      const data = await response.json();
      setAgent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgentLogs(): Promise<void> {
    try {
      const response = await fetch(`/api/agents/${agentId}/logs?limit=50`);
      if (!response.ok) return;
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }

  async function handleStartAgent(): Promise<void> {
    try {
      await fetch(`/api/agents/${agentId}/start`, { method: "POST" });
      fetchAgentDetails();
    } catch (err) {
      console.error("Failed to start agent:", err);
    }
  }

  async function handleStopAgent(): Promise<void> {
    try {
      await fetch(`/api/agents/${agentId}/stop`, { method: "POST" });
      fetchAgentDetails();
    } catch (err) {
      console.error("Failed to stop agent:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-4">
        <Link
          to="/agents"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-700">{error || "Agent not found"}</p>
        </div>
      </div>
    );
  }

  const config = statusConfig[agent.status] || statusConfig.idle;
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/agents"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
        <button
          onClick={fetchAgentDetails}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
              <span
                className={`px-2 py-1 text-xs font-medium rounded ${config.bg} ${config.text} flex items-center gap-1`}
              >
                <StatusIcon className="h-3 w-3" />
                {agent.status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Type: {agent.type}</p>
            {agent.sessionId && (
              <p className="text-xs text-gray-400 mt-1">
                Session: {agent.sessionId}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {agent.status === "idle" || agent.status === "halted" ? (
              <button
                onClick={handleStartAgent}
                className="btn btn-primary flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Start
              </button>
            ) : (
              <button
                onClick={handleStopAgent}
                className="btn btn-secondary flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            )}
          </div>
        </div>

        {agent.currentTask && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-800">
              Currently Working On:
            </p>
            <p className="text-sm text-blue-700">{agent.currentTask}</p>
          </div>
        )}

        {agent.errorMessage && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <p className="text-sm font-medium text-red-800">Error:</p>
            <p className="text-sm text-red-700">{agent.errorMessage}</p>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-400">
          Last heartbeat: {new Date(agent.lastHeartbeat).toLocaleString()}
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {(["tasks", "questions", "logs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "tasks" && `Recent Tasks (${agent.recentTasks.length})`}
              {tab === "questions" && (
                <span className="flex items-center gap-1">
                  Questions
                  {agent.pendingQuestions.length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                      {agent.pendingQuestions.length}
                    </span>
                  )}
                </span>
              )}
              {tab === "logs" && `Logs (${logs.length})`}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "tasks" && (
        <div className="space-y-3">
          {agent.recentTasks.length === 0 ? (
            <div className="card text-center text-gray-500">
              No recent tasks
            </div>
          ) : (
            agent.recentTasks.map((task) => {
              const taskConfig =
                taskStatusConfig[task.status] || taskStatusConfig.pending;
              return (
                <div key={task.id} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {task.status === "complete" && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {task.status === "failed" && (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      {task.status === "in_progress" && (
                        <Activity className="h-5 w-5 text-blue-500 animate-spin" />
                      )}
                      {(task.status === "pending" ||
                        task.status === "blocked") && (
                        <Clock className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {task.task_id}
                        </p>
                        {task.started_at && (
                          <p className="text-xs text-gray-500">
                            Started:{" "}
                            {new Date(task.started_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${taskConfig.bg} ${taskConfig.text}`}
                      >
                        {task.status}
                      </span>
                      {task.duration_ms && (
                        <p className="text-xs text-gray-500 mt-1">
                          {(task.duration_ms / 1000).toFixed(1)}s
                        </p>
                      )}
                    </div>
                  </div>
                  {task.error && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                      {task.error}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "questions" && (
        <div className="space-y-3">
          {agent.pendingQuestions.length === 0 ? (
            <div className="card text-center text-gray-500">
              No pending questions
            </div>
          ) : (
            agent.pendingQuestions.map((q) => (
              <div key={q.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          {q.type}
                        </span>
                        {q.blocking === 1 && (
                          <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                            BLOCKING
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          Priority: {q.priority}
                        </span>
                      </div>
                      <p className="text-gray-900">{q.content}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Asked: {new Date(q.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-2">
          {logs.length === 0 ? (
            <div className="card text-center text-gray-500">
              No logs available
            </div>
          ) : (
            <div className="card bg-gray-900 text-gray-100 font-mono text-sm overflow-auto max-h-96">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`py-1 px-2 ${
                    log.level === "error"
                      ? "text-red-400"
                      : log.level === "warn"
                        ? "text-yellow-400"
                        : log.level === "info"
                          ? "text-blue-400"
                          : "text-gray-400"
                  }`}
                >
                  <span className="text-gray-500">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>{" "}
                  <span className="font-bold">[{log.level.toUpperCase()}]</span>{" "}
                  {log.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
