/**
 * AgentsTab - Agent monitoring view within Observability
 * Shows agent status, blocking questions, sessions/lineage, and recent activity
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bot,
  HelpCircle,
  Activity,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Clock,
  GitBranch,
  LayoutGrid,
} from "lucide-react";
import clsx from "clsx";
import AgentSessionsView from "./AgentSessionsView";

const API_BASE = "http://localhost:3001";

// Sub-tabs for the Agents section
type AgentSubTab = "monitoring" | "sessions";

// Types
interface Agent {
  id: string;
  name: string;
  type: string;
  status: "idle" | "running" | "error" | "waiting" | "halted";
  lastHeartbeat: string;
  currentTask?: string;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    avgDuration: number;
    questionsAsked: number;
    questionsAnswered: number;
  };
}

interface Question {
  id: string;
  agentId: string;
  question: string;
  status: "pending" | "answered" | "skipped" | "expired";
  createdAt: string;
  priority: number;
}

export default function AgentsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSubTab =
    (searchParams.get("view") as AgentSubTab) || "monitoring";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveSubTab = (tab: AgentSubTab) => {
    setSearchParams({ view: tab });
  };

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [agentsRes, questionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/agents`),
        fetch(`${API_BASE}/api/questions/pending`),
      ]);

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        if (agentsData.success) {
          setAgents(agentsData.data || []);
        }
      }

      if (questionsRes.ok) {
        const questionsData = await questionsRes.json();
        if (questionsData.success) {
          setQuestions(questionsData.data || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch agent data:", err);
      setError("Failed to load agent data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Count agents by status
  const statusCounts = {
    total: agents.length,
    running: agents.filter((a) => a.status === "running").length,
    blocked: agents.filter(
      (a) => a.status === "waiting" || a.status === "halted",
    ).length,
    error: agents.filter((a) => a.status === "error").length,
  };

  return (
    <div className="p-6 flex flex-col h-full">
      {/* Header with inline sub-tabs - visible background */}
      <div className="flex-shrink-0 flex items-center justify-between bg-white rounded-lg px-4 py-3 mb-4 shadow-sm">
        <div className="flex items-center gap-6">
          {/* Title */}
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              Agent Monitoring
            </h2>
            <p className="text-sm text-gray-500">
              Monitor agents, questions, and sessions
            </p>
          </div>

          {/* Inline sub-tabs */}
          <nav
            className="flex gap-1 bg-gray-100 rounded-lg p-1"
            aria-label="Agent sub-tabs"
          >
            <button
              onClick={() => setActiveSubTab("monitoring")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeSubTab === "monitoring"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Status
            </button>
            <button
              onClick={() => setActiveSubTab("sessions")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeSubTab === "sessions"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900",
              )}
            >
              <GitBranch className="h-4 w-4" />
              Sessions
            </button>
          </nav>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <Link
            to="/agents"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Full Dashboard →
          </Link>
        </div>
      </div>

      {/* Render based on active sub-tab - flex-1 to fill remaining space */}
      {activeSubTab === "sessions" ? (
        <AgentSessionsView className="flex-1 min-h-0" />
      ) : (
        <>
          {/* Original monitoring content */}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {error}
            </div>
          )}

          {/* Agent Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Agents"
              value={statusCounts.total || 0}
              icon={Bot}
              color="gray"
            />
            <SummaryCard
              label="Running"
              value={statusCounts.running}
              icon={Activity}
              color="blue"
            />
            <SummaryCard
              label="Blocked"
              value={statusCounts.blocked}
              icon={Clock}
              color={statusCounts.blocked > 0 ? "orange" : "gray"}
            />
            <SummaryCard
              label="Errors"
              value={statusCounts.error}
              icon={AlertTriangle}
              color={statusCounts.error > 0 ? "red" : "gray"}
            />
          </div>

          {/* Agent Status Grid */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Agent Status
              </h3>
            </div>
            {agents.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Bot className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No agents registered</p>
                <p className="text-sm text-gray-400 mt-1">
                  Agents will appear here when they connect
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </div>

          {/* Blocking Questions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Blocking Questions ({questions.length})
              </h3>
            </div>
            {questions.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <HelpCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No blocking questions</p>
                <p className="text-sm text-gray-400 mt-1">
                  Questions from agents will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.slice(0, 5).map((q) => (
                  <QuestionCard key={q.id} question={q} />
                ))}
                {questions.length > 5 && (
                  <Link
                    to="/agents"
                    className="block text-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    View all {questions.length} questions →
                  </Link>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Summary Card
interface SummaryCardProps {
  label: string;
  value: number;
  icon: typeof Bot;
  color: "gray" | "blue" | "orange" | "red" | "green";
}

function SummaryCard({ label, value, icon: Icon, color }: SummaryCardProps) {
  const colors = {
    gray: "bg-gray-50 text-gray-600 border-gray-200",
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
    red: "bg-red-50 text-red-600 border-red-200",
    green: "bg-green-50 text-green-600 border-green-200",
  };

  return (
    <div className={clsx("border rounded-lg p-4", colors[color])}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm opacity-80">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Agent Card component
interface AgentCardProps {
  agent: Agent;
}

function AgentCard({ agent }: AgentCardProps) {
  const statusColors = {
    idle: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
    running: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
    waiting: {
      bg: "bg-orange-50",
      text: "text-orange-600",
      dot: "bg-orange-500",
    },
    halted: {
      bg: "bg-yellow-50",
      text: "text-yellow-600",
      dot: "bg-yellow-500",
    },
    error: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500" },
  };

  const colors = statusColors[agent.status] || statusColors.idle;

  return (
    <Link
      to={`/agents/${agent.id}`}
      className={clsx(
        colors.bg,
        "border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Bot className={clsx("h-4 w-4", colors.text)} />
        <span className="text-sm font-medium text-gray-900 truncate">
          {agent.name || agent.id}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={clsx("w-2 h-2 rounded-full", colors.dot)} />
        <span className={clsx("text-xs capitalize", colors.text)}>
          {agent.status}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        Tasks: {agent.metrics?.tasksCompleted || 0}
      </div>
    </Link>
  );
}

// Question Card
interface QuestionCardProps {
  question: Question;
}

function QuestionCard({ question }: QuestionCardProps) {
  const priorityColors = {
    high: "border-l-red-500 bg-red-50",
    medium: "border-l-orange-500 bg-orange-50",
    low: "border-l-gray-300 bg-gray-50",
  };

  const priorityLevel =
    question.priority >= 80
      ? "high"
      : question.priority >= 40
        ? "medium"
        : "low";

  return (
    <div
      className={clsx(
        "border-l-4 rounded-r-lg p-3",
        priorityColors[priorityLevel],
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-900">{question.question}</p>
          <p className="text-xs text-gray-500 mt-1">
            From: {question.agentId} •{" "}
            {new Date(question.createdAt).toLocaleTimeString()}
          </p>
        </div>
        <Link
          to={`/agents?question=${question.id}`}
          className="text-xs text-blue-600 hover:text-blue-800 ml-2"
        >
          Answer
        </Link>
      </div>
    </div>
  );
}
