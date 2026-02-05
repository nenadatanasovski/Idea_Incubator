import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Bot,
  AlertTriangle,
  Clock,
  MessageSquare,
  LayoutGrid,
  RefreshCw,
  FileText,
  PlayCircle,
} from "lucide-react";
import AgentStatusCard from "../components/agents/AgentStatusCard.js";
import QuestionQueue from "../components/agents/QuestionQueue.js";
import AgentActivityFeed from "../components/agents/AgentActivityFeed.js";
import type {
  AgentInfo,
  AgentQuestion,
  ActivityEvent,
} from "../types/agent.js";
import { priorityBadgeColors } from "../types/agent.js";

interface ExecutorStatus {
  running: boolean;
  paused: boolean;
  taskListPath: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
}

export default function AgentDashboard(): JSX.Element {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [questions, setQuestions] = useState<AgentQuestion[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] =
    useState<AgentQuestion | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [executorStatus, setExecutorStatus] = useState<ExecutorStatus | null>(
    null,
  );

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // WebSocket for real-time updates with reconnection (WSK-004)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const baseDelay = 1000;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.hostname;
      const wsPort = window.location.port || "3000"; // Use same port as frontend (Vite proxies /ws to backend)
      ws = new WebSocket(
        `${wsProtocol}//${wsHost}:${wsPort}/ws?executor=tasks`,
      );

      ws.onopen = () => {
        console.log("[AgentDashboard] WebSocket connected");
        reconnectAttempts = 0; // Reset on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Refresh on task events to keep metrics in sync
          if (
            data.type?.startsWith("task:") ||
            data.type?.startsWith("executor:")
          ) {
            fetchData();
          }
        } catch (err) {
          console.error("WebSocket parse error:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("[AgentDashboard] WebSocket error:", error);
      };

      ws.onclose = () => {
        if (!mounted) return;

        // Reconnect with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(
            baseDelay * Math.pow(2, reconnectAttempts),
            30000,
          );
          console.log(
            `[AgentDashboard] WebSocket closed, reconnecting in ${delay}ms...`,
          );
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, delay);
        } else {
          console.error("[AgentDashboard] Max reconnection attempts reached");
        }
      };
    };

    connect();

    return () => {
      mounted = false;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  async function fetchData(): Promise<void> {
    try {
      const [agentsRes, questionsRes, executorRes, activitiesRes] =
        await Promise.all([
          fetch("/api/agents"),
          fetch("/api/questions/pending"),
          fetch("/api/executor/status"),
          fetch("/api/agents/activities/recent?limit=20"),
        ]);

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData);
      }

      if (questionsRes.ok) {
        const questionsData = await questionsRes.json();
        // API returns { questions: [...] } with already-transformed data
        const questionsArray = questionsData.questions || [];
        setQuestions(questionsArray);
      }

      if (executorRes.ok) {
        const executorData = await executorRes.json();
        setExecutorStatus(executorData);
      }

      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        setActivities(activitiesData.activities || []);
      } else {
        // Fallback to empty if API not available
        setActivities([]);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswerQuestion(questionId: string, answer: string): Promise<void> {
    try {
      const response = await fetch(`/api/questions/${questionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to submit answer" }));
        console.error("Failed to answer question:", error);
        return;
      }

      console.log("Question answered:", questionId);
      setQuestions((qs) => qs.filter((q) => q.id !== questionId));
      setSelectedQuestion(null);
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }
  }

  const runningAgents = agents.filter((a) => a.status === "running").length;
  const waitingAgents = agents.filter((a) => a.status === "waiting").length;
  const errorAgents = agents.filter((a) => a.status === "error").length;
  const blockingQuestions = questions.filter((q) => q.blocking).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and control the build pipeline agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchData}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/tasks"
            className="btn btn-secondary flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Task Lists
          </Link>
          <Link
            to="/tasks/kanban"
            className="btn btn-primary flex items-center gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          label="Running"
          value={runningAgents}
        />
        <StatCard
          icon={Clock}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          label="Waiting"
          value={waitingAgents}
        />
        <StatCard
          icon={AlertTriangle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          label="Errors"
          value={errorAgents}
        />
        <StatCard
          icon={MessageSquare}
          iconBg={blockingQuestions > 0 ? "bg-red-100" : "bg-blue-100"}
          iconColor={blockingQuestions > 0 ? "text-red-600" : "text-blue-600"}
          label="Blocking"
          value={blockingQuestions}
        />
      </div>

      {executorStatus && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Task Executor Status
            </h2>
            <div className="flex items-center gap-2">
              {executorStatus.running ? (
                <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                  <PlayCircle className="h-3 w-3" />
                  Running
                </span>
              ) : executorStatus.paused ? (
                <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                  <Clock className="h-3 w-3" />
                  Paused
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                  Idle
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {executorStatus.totalTasks}
              </p>
              <p className="text-xs text-gray-500">Total Tasks</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {executorStatus.completedTasks}
              </p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">
                {executorStatus.failedTasks}
              </p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">
                {executorStatus.skippedTasks}
              </p>
              <p className="text-xs text-gray-500">Skipped</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {executorStatus.totalTasks -
                  executorStatus.completedTasks -
                  executorStatus.failedTasks -
                  executorStatus.skippedTasks}
              </p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
          {executorStatus.taskListPath && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-400 truncate flex-1">
                Source: {executorStatus.taskListPath}
              </p>
              <Link
                to={`/tasks/kanban?file=${encodeURIComponent(executorStatus.taskListPath)}`}
                className="ml-2 text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
              >
                View in Kanban →
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentStatusCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Questions ({questions.length})
          </h2>
          <QuestionQueue
            questions={questions}
            onSelectQuestion={setSelectedQuestion}
            onAnswerQuestion={handleAnswerQuestion}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </h2>
        <AgentActivityFeed activities={activities} />
      </div>

      {selectedQuestion && (
        <QuestionDetailModal
          question={selectedQuestion}
          onClose={() => setSelectedQuestion(null)}
          onAnswer={handleAnswerQuestion}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  icon: typeof Activity;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
}: StatCardProps): JSX.Element {
  return (
    <div className="card flex items-center gap-3">
      <div className={`p-2 rounded-lg ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

interface QuestionDetailModalProps {
  question: AgentQuestion;
  onClose: () => void;
  onAnswer: (questionId: string, answer: string) => void;
}

function QuestionDetailModal({
  question,
  onClose,
  onAnswer,
}: QuestionDetailModalProps): JSX.Element {
  const [customAnswer, setCustomAnswer] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${priorityBadgeColors[question.priority]}`}
                >
                  {question.priority.toUpperCase()}
                </span>
                {question.blocking && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800">
                    BLOCKING
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {question.agentName}
              </h3>
              <p className="text-sm text-gray-500">{question.type}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              x
            </button>
          </div>

          <div className="mb-6">
            <p className="text-gray-700">{question.content}</p>
            <p className="text-xs text-gray-400 mt-2">
              Asked {new Date(question.createdAt).toLocaleString()}
            </p>
          </div>

          {question.options && (
            <div className="space-y-2 mb-4">
              {question.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => onAnswer(question.id, option)}
                  className="w-full text-left px-4 py-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or provide a custom answer:
            </label>
            <textarea
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm"
              rows={3}
              placeholder="Type your answer..."
            />
            <button
              onClick={() =>
                customAnswer && onAnswer(question.id, customAnswer)
              }
              disabled={!customAnswer}
              className="mt-2 w-full btn btn-primary disabled:opacity-50"
            >
              Submit Custom Answer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
