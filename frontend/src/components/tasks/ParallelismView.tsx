/**
 * ParallelismView Component
 *
 * Visualizes task execution waves and Build Agent status for parallel execution.
 *
 * Features:
 * - Shows execution waves as swimlanes
 * - Real-time status updates via WebSocket
 * - Build Agent status cards with health indicators
 * - Opportunity indicators for potential parallelism
 * - Progress tracking per wave and overall
 *
 * Part of: PTE-091 to PTE-095
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Layers,
  Activity,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  RefreshCw,
  ChevronRight,
  Server,
  Heart,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type {
  TaskListParallelism,
  ExecutionWave,
  BuildAgentInstance,
  TaskIdentity,
} from "../../types/task-agent";

interface ParallelismViewProps {
  /** Task list ID to show parallelism for */
  taskListId: string;
  /** Task list name for display */
  taskListName?: string;
  /** WebSocket connection for real-time updates */
  wsUrl?: string;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
  /** Callback when user starts execution */
  onStartExecution?: () => void;
  /** Callback when user pauses execution */
  onPauseExecution?: () => void;
}

// Status configurations
const WAVE_STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  pending: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    border: "border-gray-200",
  },
  executing: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-300",
  },
  completed: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-300",
  },
  failed: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
};

const AGENT_STATUS_CONFIG: Record<string, { color: string; pulse: boolean }> = {
  spawning: { color: "text-yellow-500", pulse: true },
  running: { color: "text-green-500", pulse: true },
  completed: { color: "text-blue-500", pulse: false },
  failed: { color: "text-red-500", pulse: false },
  terminated: { color: "text-gray-400", pulse: false },
};

export default function ParallelismView({
  taskListId,
  taskListName,
  wsUrl,
  refreshInterval = 5000,
  onStartExecution,
  onPauseExecution,
}: ParallelismViewProps): JSX.Element {
  const [parallelism, setParallelism] = useState<TaskListParallelism | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWave, setSelectedWave] = useState<ExecutionWave | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch parallelism data
  const fetchParallelism = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/task-agent/task-lists/${taskListId}/parallelism`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch parallelism data");
      }
      const data: TaskListParallelism = await response.json();
      setParallelism(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [taskListId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchParallelism();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchParallelism, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchParallelism, refreshInterval]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!wsUrl) return;

    let reconnectAttempts = 0;
    const maxReconnects = 10;

    const connect = () => {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("[ParallelismView] WebSocket connected");
        reconnectAttempts = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type?.startsWith("wave:") ||
            data.type?.startsWith("agent:") ||
            data.type?.startsWith("task:")
          ) {
            fetchParallelism();
          }
        } catch (err) {
          console.error("WebSocket parse error:", err);
        }
      };

      wsRef.current.onclose = () => {
        if (reconnectAttempts < maxReconnects) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, delay);
        }
      };
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [wsUrl, fetchParallelism]);

  // Calculate overall progress
  const calculateProgress = () => {
    if (!parallelism) return { completed: 0, total: 0, percentage: 0 };

    const completed = parallelism.waves.reduce(
      (sum, w) => sum + w.completedCount,
      0,
    );
    const total = parallelism.totalTasks;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  };

  const progress = calculateProgress();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchParallelism}
          className="mt-2 text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!parallelism) {
    return (
      <div className="text-center py-12 text-gray-500">
        No parallelism data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary-600" />
            Parallel Execution
          </h2>
          {taskListName && (
            <p className="text-sm text-gray-500 mt-1">{taskListName}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchParallelism}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {onStartExecution && (
            <button
              onClick={onStartExecution}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play className="h-4 w-4" />
              Start Execution
            </button>
          )}
          {onPauseExecution && (
            <button
              onClick={onPauseExecution}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Layers className="h-5 w-5 text-blue-600" />}
          label="Total Waves"
          value={parallelism.totalWaves}
          bg="bg-blue-50"
        />
        <SummaryCard
          icon={<Zap className="h-5 w-5 text-purple-600" />}
          label="Max Parallelism"
          value={parallelism.maxParallelism}
          bg="bg-purple-50"
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5 text-green-600" />}
          label="Parallel Opportunities"
          value={parallelism.parallelOpportunities}
          bg="bg-green-50"
        />
        <SummaryCard
          icon={<Server className="h-5 w-5 text-orange-600" />}
          label="Active Agents"
          value={parallelism.activeAgents.length}
          bg="bg-orange-50"
        />
      </div>

      {/* Overall Progress */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Overall Progress
          </span>
          <span className="text-sm text-gray-500">
            {progress.completed} / {progress.total} tasks ({progress.percentage}
            %)
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* Execution Waves */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Execution Waves</h3>
        {parallelism.waves.map((wave) => (
          <WaveCard
            key={wave.id}
            wave={wave}
            isSelected={selectedWave?.id === wave.id}
            onClick={() =>
              setSelectedWave(selectedWave?.id === wave.id ? null : wave)
            }
            agents={parallelism.activeAgents.filter(
              (a) => a.waveId === wave.id,
            )}
          />
        ))}
      </div>

      {/* Active Build Agents */}
      {parallelism.activeAgents.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Server className="h-5 w-5 text-primary-600" />
            Active Build Agents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {parallelism.activeAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Summary Card Component
interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}

function SummaryCard({
  icon,
  label,
  value,
  bg,
}: SummaryCardProps): JSX.Element {
  return (
    <div className={`${bg} rounded-lg p-4`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Wave Card Component
interface WaveCardProps {
  wave: ExecutionWave;
  isSelected: boolean;
  onClick: () => void;
  agents: BuildAgentInstance[];
}

function WaveCard({
  wave,
  isSelected,
  onClick,
  agents,
}: WaveCardProps): JSX.Element {
  const config = WAVE_STATUS_CONFIG[wave.status] || WAVE_STATUS_CONFIG.pending;
  const progressPercentage =
    wave.taskCount > 0
      ? Math.round((wave.completedCount / wave.taskCount) * 100)
      : 0;

  return (
    <div
      className={`rounded-lg border transition-all ${config.border} ${
        isSelected ? "ring-2 ring-primary-200 shadow-md" : "hover:shadow"
      }`}
    >
      <button onClick={onClick} className={`w-full p-4 text-left ${config.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              {wave.status === "executing" ? (
                <Activity className={`h-5 w-5 ${config.text} animate-pulse`} />
              ) : wave.status === "completed" ? (
                <CheckCircle className={`h-5 w-5 ${config.text}`} />
              ) : wave.status === "failed" ? (
                <XCircle className={`h-5 w-5 ${config.text}`} />
              ) : (
                <Clock className={`h-5 w-5 ${config.text}`} />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">
                Wave {wave.waveNumber}
              </h4>
              <p className="text-sm text-gray-500">
                {wave.taskCount} task{wave.taskCount !== 1 ? "s" : ""} •{" "}
                {agents.length} agent{agents.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}
              >
                {wave.status}
              </span>
              <p className="text-xs text-gray-500 mt-1">
                {wave.completedCount}/{wave.taskCount} done
              </p>
            </div>
            <ChevronRight
              className={`h-5 w-5 text-gray-400 transition-transform ${
                isSelected ? "rotate-90" : ""
              }`}
            />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-white/50 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              wave.status === "failed"
                ? "bg-red-500"
                : wave.status === "completed"
                  ? "bg-green-500"
                  : "bg-blue-500"
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </button>

      {/* Expanded task list */}
      {isSelected && (
        <div className="px-4 pb-4 border-t border-gray-200 bg-white">
          <div className="pt-3 space-y-2">
            <h5 className="text-xs font-medium text-gray-500 uppercase">
              Tasks in Wave
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {wave.tasks.map((task) => (
                <TaskChip key={task.id} task={task} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Task Chip Component
interface TaskChipProps {
  task: TaskIdentity;
}

function TaskChip({ task }: TaskChipProps): JSX.Element {
  return (
    <div className="px-2 py-1.5 bg-gray-50 rounded border border-gray-200 text-xs">
      <span className="font-mono text-gray-600">{task.displayId}</span>
    </div>
  );
}

// Agent Card Component
interface AgentCardProps {
  agent: BuildAgentInstance;
}

function AgentCard({ agent }: AgentCardProps): JSX.Element {
  const config =
    AGENT_STATUS_CONFIG[agent.status] || AGENT_STATUS_CONFIG.spawning;

  // Calculate time since last heartbeat
  const heartbeatAge = agent.lastHeartbeat
    ? Math.floor((Date.now() - new Date(agent.lastHeartbeat).getTime()) / 1000)
    : null;
  const isHealthy = heartbeatAge === null || heartbeatAge < 60;

  return (
    <div className="bg-white rounded-lg border p-3 hover:shadow transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Server className={`h-5 w-5 ${config.color}`} />
          <div>
            <p className="font-medium text-sm text-gray-900">Agent</p>
            <p className="text-xs text-gray-500 font-mono truncate max-w-[120px]">
              {agent.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 text-xs rounded ${
            agent.status === "running"
              ? "bg-green-100 text-green-700"
              : agent.status === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {agent.status}
        </span>
      </div>

      <div className="mt-2 pt-2 border-t">
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <Zap className="h-3 w-3" />
          <span className="font-mono">{agent.taskDisplayId}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs">
            <Heart
              className={`h-3 w-3 ${
                isHealthy ? "text-green-500" : "text-red-500"
              } ${config.pulse ? "animate-pulse" : ""}`}
            />
            <span className={isHealthy ? "text-green-600" : "text-red-600"}>
              {heartbeatAge !== null
                ? heartbeatAge < 60
                  ? `${heartbeatAge}s ago`
                  : `${Math.floor(heartbeatAge / 60)}m ago`
                : "No heartbeat"}
            </span>
          </div>
          {!isHealthy && <AlertTriangle className="h-3 w-3 text-amber-500" />}
        </div>
      </div>

      {agent.error && (
        <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600 truncate">
          {agent.error}
        </div>
      )}
    </div>
  );
}

export { ParallelismView, WaveCard, AgentCard };
