import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Square,
  SkipForward,
  Upload,
  ArrowLeft,
} from "lucide-react";

interface Task {
  id: string;
  taskId?: string;
  phase: string;
  action: string;
  file: string;
  status: TaskStatus;
  description?: string;
  priority?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  buildId?: string;
  projectName?: string; // The idea/project this task belongs to
  sourcePath?: string; // Full path to the task list file
}

type TaskStatus = "pending" | "in_progress" | "complete" | "failed" | "blocked";

interface KanbanColumn {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  count: number;
}

interface KanbanData {
  buildId: string | null;
  columns: KanbanColumn[];
  totalTasks: number;
}

interface TaskListSummary {
  filePath: string;
  fileName: string;
  title: string;
  total: number;
  pending: number;
  inProgress: number;
  complete: number;
  percentComplete: number;
  lastModified: string;
}

interface ExecutorStatus {
  running: boolean;
  paused: boolean;
  currentTask?: { id: string; description: string };
  taskListPath: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
}

interface ParsedTask {
  id: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status: "pending" | "in_progress" | "complete";
  section: string;
}

const columnConfig: Record<
  TaskStatus,
  { bg: string; border: string; icon: typeof Activity; iconColor: string }
> = {
  pending: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    icon: Clock,
    iconColor: "text-gray-500",
  },
  in_progress: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: Activity,
    iconColor: "text-blue-500",
  },
  complete: {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: CheckCircle,
    iconColor: "text-green-500",
  },
  failed: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: XCircle,
    iconColor: "text-red-500",
  },
  blocked: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
};

const phaseColors: Record<string, string> = {
  database: "bg-purple-100 text-purple-700",
  types: "bg-blue-100 text-blue-700",
  api: "bg-green-100 text-green-700",
  ui: "bg-pink-100 text-pink-700",
  tests: "bg-orange-100 text-orange-700",
  unknown: "bg-gray-100 text-gray-700",
};

export default function KanbanBoard(): JSX.Element {
  const [kanbanData, setKanbanData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskStatus>>(
    new Set(),
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Executor and task list state
  const [taskLists, setTaskLists] = useState<TaskListSummary[]>([]);
  const [selectedListPath, setSelectedListPath] = useState<string>("");
  const [executorStatus, setExecutorStatus] = useState<ExecutorStatus | null>(
    null,
  );
  const selectedListPathRef = useRef<string>("");

  // Fetch task lists
  const fetchTaskLists = useCallback(async () => {
    try {
      const res = await fetch("/api/task-lists");
      if (res.ok) {
        const data = await res.json();
        setTaskLists(data);
      }
    } catch (err) {
      console.error("Failed to fetch task lists:", err);
    }
  }, []);

  // Fetch executor status
  const fetchExecutorStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/executor/status");
      if (res.ok) {
        const data = await res.json();
        setExecutorStatus(data);
        // Always sync with executor's active task list for proper dashboard sync
        if (
          data.taskListPath &&
          data.taskListPath !== selectedListPathRef.current
        ) {
          setSelectedListPath(data.taskListPath);
          selectedListPathRef.current = data.taskListPath;
        }
      }
    } catch (err) {
      // Executor may not be running
    }
  }, []);

  // Load task list into executor
  const loadIntoExecutor = async () => {
    if (!selectedListPath) return;
    try {
      const res = await fetch("/api/executor/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedListPath }),
      });
      if (res.ok) {
        await fetchExecutorStatus();
        await fetchKanbanFromTaskList();
      }
    } catch (err) {
      setError("Failed to load task list");
    }
  };

  // Start executor
  const startExecutor = async () => {
    try {
      const res = await fetch("/api/executor/start", { method: "POST" });
      if (res.ok) await fetchExecutorStatus();
    } catch (err) {
      setError("Failed to start executor");
    }
  };

  // Pause executor
  const pauseExecutor = async () => {
    try {
      const res = await fetch("/api/executor/pause", { method: "POST" });
      if (res.ok) await fetchExecutorStatus();
    } catch (err) {
      setError("Failed to pause executor");
    }
  };

  // Resume executor
  const resumeExecutor = async () => {
    try {
      const res = await fetch("/api/executor/resume", { method: "POST" });
      if (res.ok) await fetchExecutorStatus();
    } catch (err) {
      setError("Failed to resume executor");
    }
  };

  // Stop executor
  const stopExecutor = async () => {
    try {
      const res = await fetch("/api/executor/stop", { method: "POST" });
      if (res.ok) await fetchExecutorStatus();
    } catch (err) {
      setError("Failed to stop executor");
    }
  };

  // Execute one task
  const executeOneTask = async () => {
    try {
      const res = await fetch("/api/executor/execute-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await fetchExecutorStatus();
        await fetchKanbanFromTaskList();
      }
    } catch (err) {
      setError("Failed to execute task");
    }
  };

  // Fetch kanban data from task list
  const fetchKanbanFromTaskList = useCallback(async () => {
    const path = selectedListPathRef.current || selectedListPath;
    if (!path) {
      // Fall back to original kanban endpoint
      await fetchKanbanData();
      return;
    }

    try {
      const res = await fetch(
        `/api/task-lists/parse?path=${encodeURIComponent(path)}`,
      );
      if (!res.ok) {
        await fetchKanbanData();
        return;
      }

      const taskList = await res.json();

      // Extract project name from path
      // Patterns: users/{user}/ideas/{idea}/... or docs/{folder}/... or just filename
      const extractProjectName = (filePath: string): string => {
        const parts = filePath.split("/");
        // Check for ideas folder pattern
        const ideasIndex = parts.indexOf("ideas");
        if (ideasIndex !== -1 && parts[ideasIndex + 1]) {
          return parts[ideasIndex + 1]; // Return the idea slug
        }
        // Check for docs folder pattern
        const docsIndex = parts.indexOf("docs");
        if (docsIndex !== -1 && parts[docsIndex + 1]) {
          return parts[docsIndex + 1]; // Return the docs subfolder
        }
        // Fall back to file name without extension
        const fileName = parts[parts.length - 1];
        return fileName.replace(/\.(md|txt)$/i, "");
      };

      const projectName = extractProjectName(path);

      // Convert task list to kanban format
      const columns: KanbanColumn[] = [
        { id: "pending", title: "Pending", tasks: [], count: 0 },
        { id: "in_progress", title: "In Progress", tasks: [], count: 0 },
        { id: "complete", title: "Complete", tasks: [], count: 0 },
        { id: "failed", title: "Failed", tasks: [], count: 0 },
        { id: "blocked", title: "Blocked", tasks: [], count: 0 },
      ];

      taskList.tasks.forEach((task: ParsedTask) => {
        const kanbanTask: Task = {
          id: task.id,
          taskId: task.id,
          phase: task.section || "unknown",
          action: task.priority,
          file: task.description,
          status: task.status as TaskStatus,
          description: task.description,
          priority: task.priority,
          projectName: projectName,
          sourcePath: path,
        };

        const column = columns.find((c) => c.id === task.status);
        if (column) {
          column.tasks.push(kanbanTask);
          column.count++;
        }
      });

      setKanbanData({
        buildId: path.split("/").pop() || null,
        columns,
        totalTasks: taskList.tasks.length,
      });
      setError(null);
      setLoading(false);
    } catch (err) {
      await fetchKanbanData();
    } finally {
      setLoading(false);
    }
  }, [selectedListPath]);

  // Update ref when selectedListPath changes
  useEffect(() => {
    selectedListPathRef.current = selectedListPath;
  }, [selectedListPath]);

  // When selectedListPath changes, fetch the corresponding kanban data
  useEffect(() => {
    if (selectedListPath) {
      fetchKanbanFromTaskList();
    }
  }, [selectedListPath, fetchKanbanFromTaskList]);

  useEffect(() => {
    fetchTaskLists();
    // Fetch executor status first - it will sync selectedListPath which triggers kanban fetch
    fetchExecutorStatus();
  }, [fetchTaskLists, fetchExecutorStatus]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchExecutorStatus();
      if (selectedListPath) {
        fetchKanbanFromTaskList();
      } else {
        fetchKanbanData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [
    autoRefresh,
    selectedListPath,
    fetchExecutorStatus,
    fetchKanbanFromTaskList,
  ]);

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
      const wsPort = "3001";
      ws = new WebSocket(
        `${wsProtocol}//${wsHost}:${wsPort}/ws?executor=tasks`,
      );

      ws.onopen = () => {
        console.log("[KanbanBoard] WebSocket connected");
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type?.startsWith("task:") ||
            data.type?.startsWith("executor:")
          ) {
            fetchExecutorStatus();
            if (selectedListPathRef.current) {
              fetchKanbanFromTaskList();
            } else {
              fetchKanbanData();
            }
          }
          if (data.type === "tasklist:loaded") {
            fetchTaskLists();
          }
        } catch (err) {
          console.error("WebSocket parse error:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("[KanbanBoard] WebSocket error:", error);
      };

      ws.onclose = () => {
        if (!mounted) return;

        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(
            baseDelay * Math.pow(2, reconnectAttempts),
            30000,
          );
          console.log(
            `[KanbanBoard] WebSocket closed, reconnecting in ${delay}ms...`,
          );
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, delay);
        } else {
          console.error("[KanbanBoard] Max reconnection attempts reached");
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
  }, [fetchExecutorStatus, fetchKanbanFromTaskList, fetchTaskLists]);

  async function fetchKanbanData(): Promise<void> {
    try {
      const response = await fetch("/api/tasks/kanban");
      if (!response.ok) {
        throw new Error("Failed to fetch kanban data");
      }
      const data = await response.json();
      setKanbanData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function toggleColumn(status: TaskStatus): void {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
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
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Task Kanban Board
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {kanbanData?.buildId
              ? `Build: ${kanbanData.buildId}`
              : "No active build"}
            {kanbanData?.totalTasks !== undefined &&
              ` - ${kanbanData.totalTasks} total tasks`}
          </p>
        </div>
        <div className="flex items-center gap-4">
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
            onClick={() =>
              selectedListPath ? fetchKanbanFromTaskList() : fetchKanbanData()
            }
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/tasks"
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Task Lists
          </Link>
          <Link
            to="/agents"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Agent Dashboard
          </Link>
        </div>
      </div>

      {/* Executor Control Panel */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Task List Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Task List:
              </label>
              <select
                value={selectedListPath}
                onChange={(e) => {
                  setSelectedListPath(e.target.value);
                  if (e.target.value) {
                    selectedListPathRef.current = e.target.value;
                    fetchKanbanFromTaskList();
                  }
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm min-w-[200px]"
              >
                <option value="">Select a task list...</option>
                {taskLists.map((list) => (
                  <option key={list.filePath} value={list.filePath}>
                    {list.title} ({list.pending} pending)
                  </option>
                ))}
              </select>
            </div>

            {/* Executor Status */}
            <div className="flex items-center gap-2">
              {executorStatus?.running ? (
                <span
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    executorStatus.paused
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {executorStatus.paused ? "Paused" : "Running"}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  Stopped
                </span>
              )}
              {executorStatus?.taskListPath && (
                <span className="text-xs text-gray-500">
                  {executorStatus.completedTasks}/{executorStatus.totalTasks}{" "}
                  done
                  {executorStatus.failedTasks > 0 &&
                    `, ${executorStatus.failedTasks} failed`}
                </span>
              )}
            </div>
          </div>

          {/* Executor Controls */}
          <div className="flex items-center gap-2">
            {selectedListPath && !executorStatus?.running && (
              <>
                <button
                  onClick={loadIntoExecutor}
                  className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 flex items-center gap-1"
                >
                  <Upload className="h-4 w-4" />
                  Load
                </button>
                {executorStatus?.taskListPath && (
                  <button
                    onClick={startExecutor}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1"
                  >
                    <Play className="h-4 w-4" />
                    Start Auto
                  </button>
                )}
              </>
            )}
            {executorStatus?.running && !executorStatus?.paused && (
              <button
                onClick={pauseExecutor}
                className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 flex items-center gap-1"
              >
                <Pause className="h-4 w-4" />
                Pause
              </button>
            )}
            {executorStatus?.running && executorStatus?.paused && (
              <button
                onClick={resumeExecutor}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1"
              >
                <Play className="h-4 w-4" />
                Resume
              </button>
            )}
            {executorStatus?.running && (
              <button
                onClick={stopExecutor}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center gap-1"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            )}
            {executorStatus?.taskListPath && !executorStatus?.running && (
              <button
                onClick={executeOneTask}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
              >
                <SkipForward className="h-4 w-4" />
                Execute Next
              </button>
            )}
          </div>
        </div>

        {/* Current Task */}
        {executorStatus?.currentTask && (
          <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Current Task:</span>{" "}
              <span className="font-mono">{executorStatus.currentTask.id}</span>{" "}
              - {executorStatus.currentTask.description}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {kanbanData?.columns.map((column) => {
          const config = columnConfig[column.id];
          const Icon = config.icon;
          const isCollapsed = collapsedColumns.has(column.id);

          return (
            <div
              key={column.id}
              className={`flex-shrink-0 w-72 rounded-lg border ${config.border} ${config.bg}`}
            >
              <button
                onClick={() => toggleColumn(column.id)}
                className="w-full px-4 py-3 flex items-center justify-between border-b border-inherit"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${config.iconColor}`} />
                  <span className="font-semibold text-gray-900">
                    {column.title}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-white rounded-full text-gray-600">
                    {column.count}
                  </span>
                </div>
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {!isCollapsed && (
                <div className="p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {column.tasks.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No tasks
                    </div>
                  ) : (
                    column.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onClick={() => setSelectedTask(task)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

function TaskCard({ task, onClick }: TaskCardProps): JSX.Element {
  const phaseColor = phaseColors[task.phase] || phaseColors.unknown;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Project/Source badge */}
      {task.projectName && (
        <div className="flex items-center gap-1 mb-2 pb-2 border-b border-gray-100">
          <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
            {task.projectName}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded ${phaseColor}`}
        >
          {task.phase}
        </span>
        <span className="text-xs text-gray-400">{task.action}</span>
      </div>
      <p
        className="text-sm font-medium text-gray-900 truncate"
        title={task.file}
      >
        {task.file.split("/").pop() || task.file}
      </p>
      {task.description && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
          {task.description}
        </p>
      )}
      {task.startedAt && (
        <p className="text-xs text-gray-400 mt-2">
          Started: {new Date(task.startedAt).toLocaleTimeString()}
        </p>
      )}
      {task.error && (
        <div
          className="mt-2 p-1.5 bg-red-50 rounded text-xs text-red-600 truncate"
          title={task.error}
        >
          {task.error}
        </div>
      )}
    </button>
  );
}

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
}

function TaskDetailModal({ task, onClose }: TaskDetailModalProps): JSX.Element {
  const statusConfig = columnConfig[task.status];
  const StatusIcon = statusConfig.icon;
  const phaseColor = phaseColors[task.phase] || phaseColors.unknown;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${phaseColor}`}
                >
                  {task.phase}
                </span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 ${statusConfig.bg} ${statusConfig.iconColor}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {task.status}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {task.file}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{task.action}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              &times;
            </button>
          </div>

          {task.description && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-1">
                Description
              </h4>
              <p className="text-sm text-gray-600">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            {task.projectName && (
              <div className="col-span-2">
                <span className="text-gray-500">Project/Idea:</span>
                <p className="font-medium">
                  <span className="inline-flex items-center px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                    {task.projectName}
                  </span>
                </p>
              </div>
            )}
            {task.sourcePath && (
              <div className="col-span-2">
                <span className="text-gray-500">Source File:</span>
                <p
                  className="font-mono text-xs text-gray-600 truncate"
                  title={task.sourcePath}
                >
                  {task.sourcePath}
                </p>
              </div>
            )}
            {task.startedAt && (
              <div>
                <span className="text-gray-500">Started:</span>
                <p className="font-medium">
                  {new Date(task.startedAt).toLocaleString()}
                </p>
              </div>
            )}
            {task.completedAt && (
              <div>
                <span className="text-gray-500">Completed:</span>
                <p className="font-medium">
                  {new Date(task.completedAt).toLocaleString()}
                </p>
              </div>
            )}
            {task.buildId && (
              <div className="col-span-2">
                <span className="text-gray-500">Build ID:</span>
                <p className="font-mono text-xs">{task.buildId}</p>
              </div>
            )}
          </div>

          {task.error && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <h4 className="text-sm font-medium text-red-800 mb-1">Error</h4>
              <p className="text-sm text-red-700 font-mono whitespace-pre-wrap">
                {task.error}
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
