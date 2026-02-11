import { useState, useEffect, useCallback } from "react";
import { Layout } from "../components/Layout";

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  status: "idle" | "running" | "error";
  configPath: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  payload: {
    kind: string;
    text?: string;
    message?: string;
  };
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

const API_BASE = "http://localhost:3333/api";

// Harness scheduled tasks (built-in)
const HARNESS_TASKS: ScheduledTask[] = [
  {
    id: "planning",
    name: "🧠 Strategic Planning",
    description:
      "Runs strategic planning cycle to analyze codebase and create improvement tasks",
    schedule: "Every 24 hours",
    enabled: true,
    lastRun: null,
    nextRun: null,
    status: "idle",
    configPath: "planning.enabled",
  },
  {
    id: "qa",
    name: "✅ QA Validation",
    description: "Validates tasks in pending_verification status",
    schedule: "Every 10 ticks (~10 min)",
    enabled: true,
    lastRun: null,
    nextRun: null,
    status: "idle",
    configPath: "qa.enabled",
  },
  {
    id: "crown",
    name: "👑 Crown Agent (SIA Monitor)",
    description:
      "Monitors agent health, detects stuck agents, and triggers interventions",
    schedule: "Every 10 minutes",
    enabled: true,
    lastRun: null,
    nextRun: null,
    status: "idle",
    configPath: "always_on",
  },
  {
    id: "cleanup",
    name: "🧹 Session Cleanup",
    description: "Removes old session data based on retention policy",
    schedule: "On startup",
    enabled: true,
    lastRun: null,
    nextRun: null,
    status: "idle",
    configPath: "cleanup.auto_cleanup",
  },
  {
    id: "tick",
    name: "⏰ Orchestrator Tick",
    description: "Main orchestration loop - assigns tasks to agents",
    schedule: "Every 60 seconds",
    enabled: true,
    lastRun: null,
    nextRun: null,
    status: "idle",
    configPath: "agents.enabled",
  },
];

export function Cron() {
  const [harnessTasks, setHarnessTasks] =
    useState<ScheduledTask[]>(HARNESS_TASKS);
  const [_customJobs, _setCustomJobs] = useState<CronJob[]>([]);
  const [config, setConfig] = useState<Record<
    string,
    Record<string, unknown>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [_showNewJobForm, _setShowNewJobForm] = useState(false);
  const [_newJob, _setNewJob] = useState({ name: "", schedule: "", text: "" });

  const fetchData = useCallback(async () => {
    try {
      const [configRes, orchestratorRes] = await Promise.all([
        fetch(`${API_BASE}/config`),
        fetch(`${API_BASE}/orchestrator/status`),
      ]);

      if (configRes.ok) {
        const cfg = await configRes.json();
        setConfig(cfg);

        // Update task enabled states from config
        setHarnessTasks((prev) =>
          prev.map((task) => {
            if (task.configPath === "planning.enabled") {
              return { ...task, enabled: cfg.planning?.enabled ?? true };
            }
            if (task.configPath === "qa.enabled") {
              return { ...task, enabled: cfg.qa?.enabled ?? true };
            }
            if (task.configPath === "cleanup.auto_cleanup") {
              return { ...task, enabled: cfg.cleanup?.auto_cleanup ?? true };
            }
            if (task.configPath === "agents.enabled") {
              return { ...task, enabled: cfg.agents?.enabled ?? true };
            }
            return task;
          }),
        );
      }

      if (orchestratorRes.ok) {
        const status = await orchestratorRes.json();
        // Update last run times if available
        setHarnessTasks((prev) =>
          prev.map((task) => {
            if (task.id === "tick" && status.lastTick) {
              return {
                ...task,
                lastRun: status.lastTick,
                status: status.running ? "running" : "idle",
              };
            }
            if (task.id === "planning" && status.lastPlanning) {
              return { ...task, lastRun: status.lastPlanning };
            }
            return task;
          }),
        );
      }
    } catch (err) {
      console.error("Failed to fetch cron data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function toggleTask(taskId: string, enabled: boolean) {
    const task = harnessTasks.find((t) => t.id === taskId);
    if (!task || task.configPath === "always_on") return;

    try {
      // Build config update based on path
      const path = task.configPath.split(".");
      const update: Record<string, any> = {};

      if (path.length === 2) {
        update[path[0]] = { [path[1]]: enabled };
      }

      const res = await fetch(`${API_BASE}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });

      if (res.ok) {
        setHarnessTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, enabled } : t)),
        );
        setMessage({
          type: "success",
          text: `${task.name} ${enabled ? "enabled" : "disabled"}`,
        });
      } else {
        setMessage({ type: "error", text: "Failed to update config" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error" });
    }
  }

  async function triggerTask(taskId: string) {
    setMessage(null);

    try {
      let endpoint = "";
      switch (taskId) {
        case "tick":
          endpoint = "/api/orchestrator/tick";
          break;
        case "planning":
          endpoint = "/api/orchestrator/planning";
          break;
        case "qa":
          endpoint = "/api/qa/run";
          break;
        case "crown":
          endpoint = "/api/crown/check";
          break;
        case "cleanup":
          endpoint = "/api/memory/cleanup";
          break;
        default:
          return;
      }

      const res = await fetch(`http://localhost:3333${endpoint}`, {
        method: "POST",
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Triggered ${taskId}` });
        fetchData();
      } else {
        setMessage({ type: "error", text: `Failed to trigger ${taskId}` });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Server not responding" });
    }
  }

  function formatTime(timestamp: string | null): string {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-400">
          Loading scheduled tasks...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">⏰ Scheduled Tasks</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage harness scheduled processes and cron jobs
            </p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-3 rounded text-sm ${
              message.type === "success"
                ? "bg-green-900/50 text-green-300"
                : "bg-red-900/50 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Harness Scheduled Tasks */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>🔄</span> Harness Scheduled Processes
          </h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-700/50">
                  <th className="text-left p-4 text-sm font-medium text-gray-400">
                    Task
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">
                    Schedule
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">
                    Last Run
                  </th>
                  <th className="text-left p-4 text-sm font-medium text-gray-400">
                    Status
                  </th>
                  <th className="text-right p-4 text-sm font-medium text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {harnessTasks.map((task) => (
                  <tr key={task.id} className="border-t border-gray-700/50">
                    <td className="p-4">
                      <div className="font-medium text-white">{task.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {task.description}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">
                      {task.schedule}
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {formatTime(task.lastRun)}
                    </td>
                    <td className="p-4">
                      <StatusBadge
                        status={task.status}
                        enabled={task.enabled}
                      />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {task.configPath !== "always_on" && (
                          <button
                            onClick={() => toggleTask(task.id, !task.enabled)}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                              task.enabled
                                ? "bg-yellow-900/50 text-yellow-300 hover:bg-yellow-900"
                                : "bg-green-900/50 text-green-300 hover:bg-green-900"
                            }`}
                          >
                            {task.enabled ? "⏸ Pause" : "▶ Enable"}
                          </button>
                        )}
                        <button
                          onClick={() => triggerTask(task.id)}
                          disabled={!task.enabled}
                          className="px-3 py-1.5 bg-blue-900/50 text-blue-300 hover:bg-blue-900 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ⚡ Trigger
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Config Summary */}
        {config && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">
              📊 Current Schedule Settings
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <ConfigCard
                label="Planning Interval"
                value={`${(config.planning?.interval_hours as number) || 24}h`}
                icon="🧠"
              />
              <ConfigCard
                label="QA Every N Ticks"
                value={(config.qa?.every_n_ticks as number) || 10}
                icon="✅"
              />
              <ConfigCard
                label="Max Concurrent Agents"
                value={(config.agents?.max_concurrent as number) || 8}
                icon="🤖"
              />
              <ConfigCard
                label="Retention Days"
                value={`${(config.cleanup?.retention_days as number) || 7}d`}
                icon="🧹"
              />
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Edit these values in the{" "}
              <a href="/config" className="text-blue-400 hover:underline">
                Config page
              </a>
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatusBadge({
  status,
  enabled,
}: {
  status: string;
  enabled: boolean;
}) {
  if (!enabled) {
    return (
      <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs font-medium">
        Paused
      </span>
    );
  }

  const styles: Record<string, string> = {
    idle: "bg-gray-700 text-gray-300",
    running: "bg-blue-900/50 text-blue-300",
    error: "bg-red-900/50 text-red-300",
  };

  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.idle}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ConfigCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

export default Cron;
