/**
 * Task List Browser Page
 *
 * Full-width table view with expandable rows, execution metadata,
 * and debugging info for stuck tasks.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";

// Types
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

interface BlockingQuestion {
  id: string;
  content: string;
  type: string;
  priority: string;
  createdAt: string;
  options?: string[];
}

interface EnrichedTask {
  id: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status: "pending" | "in_progress" | "complete";
  section: string;
  subsection?: string;
  lineNumber: number;
  dependencies?: string[];
  // Execution data
  assignedAgent?: string;
  agentType?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  attempts?: number;
  error?: string;
  // Blocking info
  blockingQuestion?: BlockingQuestion;
  // Computed
  isStuck?: boolean;
  stuckReason?: string;
  elapsedMs?: number;
}

interface TaskSection {
  name: string;
  description?: string;
  tasks: EnrichedTask[];
}

interface TaskList {
  filePath: string;
  fileName: string;
  title: string;
  description?: string;
  sections: TaskSection[];
  tasks: EnrichedTask[];
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    complete: number;
    byPriority: Record<string, number>;
  };
  lastModified: string;
  enriched?: boolean;
}

interface ExecutorStatus {
  running: boolean;
  paused: boolean;
  currentTask?: EnrichedTask;
  taskListPath: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
}

interface TaskDetail {
  id: string;
  title: string;
  summary: string;
  requirements: string[];
  passCriteria: string[];
  rawContent: string;
  filePath: string;
}

// Priority colors
const priorityColors: Record<string, string> = {
  P1: "bg-red-500/20 text-red-400",
  P2: "bg-orange-500/20 text-orange-400",
  P3: "bg-yellow-500/20 text-yellow-400",
  P4: "bg-gray-500/20 text-gray-400",
};

// Status colors
const statusColors: Record<string, string> = {
  pending: "text-gray-400",
  in_progress: "text-blue-400",
  complete: "text-green-400",
};

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export default function TaskListBrowser() {
  const [taskLists, setTaskLists] = useState<TaskListSummary[]>([]);
  const [selectedList, setSelectedList] = useState<TaskList | null>(null);
  const [executorStatus, setExecutorStatus] = useState<ExecutorStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [taskDetails, setTaskDetails] = useState<
    Record<string, TaskDetail | null>
  >({});
  const [loadingTaskDetail, setLoadingTaskDetail] = useState<string | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<string>("in_progress");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  // Fetch all task lists
  const fetchTaskLists = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/task-lists");
      if (!res.ok) throw new Error("Failed to fetch task lists");
      const data = await res.json();
      setTaskLists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch enriched task list details
  const fetchTaskListDetails = useCallback(async (filePath: string) => {
    try {
      setLoadingDetails(true);
      const res = await fetch(
        `/api/task-lists/enriched?path=${encodeURIComponent(filePath)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch task list details");
      const data = await res.json();
      setSelectedList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  // Fetch task detail (from markdown file)
  const fetchTaskDetail = useCallback(
    async (taskId: string) => {
      // Check if already loaded or loading
      if (taskDetails[taskId] !== undefined || loadingTaskDetail === taskId)
        return;

      try {
        setLoadingTaskDetail(taskId);
        const res = await fetch(
          `/api/task-lists/task-detail?id=${encodeURIComponent(taskId)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setTaskDetails((prev) => ({ ...prev, [taskId]: data }));
        } else {
          // File doesn't exist - mark as null
          setTaskDetails((prev) => ({ ...prev, [taskId]: null }));
        }
      } catch {
        setTaskDetails((prev) => ({ ...prev, [taskId]: null }));
      } finally {
        setLoadingTaskDetail(null);
      }
    },
    [taskDetails, loadingTaskDetail],
  );

  // Update task status
  const updateTaskStatus = async (
    taskId: string,
    newStatus: "pending" | "in_progress" | "complete",
  ) => {
    if (!selectedList) return;
    try {
      const res = await fetch("/api/task-lists/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedList.filePath,
          taskId,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error("Failed to update task status");
      await fetchTaskListDetails(selectedList.filePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  // Fetch executor status
  const fetchExecutorStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/executor/status");
      if (res.ok) {
        const data = await res.json();
        setExecutorStatus(data);
      }
    } catch {
      // Executor may not be running
    }
  }, []);

  // Executor controls
  const loadIntoExecutor = async () => {
    if (!selectedList) return;
    try {
      const res = await fetch("/api/executor/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedList.filePath }),
      });
      if (!res.ok) throw new Error("Failed to load");
      await fetchExecutorStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  const startExecutor = async () => {
    try {
      const res = await fetch("/api/executor/start", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start");
      await fetchExecutorStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    }
  };

  const pauseExecutor = async () => {
    try {
      const res = await fetch("/api/executor/pause", { method: "POST" });
      if (!res.ok) throw new Error("Failed to pause");
      await fetchExecutorStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause");
    }
  };

  const resumeExecutor = async () => {
    try {
      const res = await fetch("/api/executor/resume", { method: "POST" });
      if (!res.ok) throw new Error("Failed to resume");
      await fetchExecutorStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume");
    }
  };

  const stopExecutor = async () => {
    try {
      const res = await fetch("/api/executor/stop", { method: "POST" });
      if (!res.ok) throw new Error("Failed to stop");
      await fetchExecutorStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop");
    }
  };

  // Toggle task expansion
  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
        // Fetch task detail when expanding
        fetchTaskDetail(taskId);
      }
      return next;
    });
  };

  // WebSocket for real-time updates with reconnection
  const selectedListPathRef = useRef<string | null>(null);
  useEffect(() => {
    selectedListPathRef.current = selectedList?.filePath || null;
  }, [selectedList]);

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
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "task:started":
            case "task:completed":
            case "task:failed":
            case "task:skipped":
              fetchExecutorStatus();
              if (selectedListPathRef.current) {
                fetchTaskListDetails(selectedListPathRef.current);
              }
              break;
            case "executor:started":
            case "executor:paused":
            case "executor:resumed":
            case "executor:stopped":
            case "executor:complete":
              fetchExecutorStatus();
              break;
            case "tasklist:loaded":
              fetchExecutorStatus();
              fetchTaskLists();
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(
            baseDelay * Math.pow(2, reconnectAttempts),
            30000,
          );
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, delay);
        }
      };
    };

    connect();

    return () => {
      mounted = false;
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [fetchExecutorStatus, fetchTaskLists, fetchTaskListDetails]);

  useEffect(() => {
    fetchTaskLists();
    fetchExecutorStatus();
  }, [fetchTaskLists, fetchExecutorStatus]);

  // Filter tasks
  const getFilteredTasks = () => {
    if (!selectedList) return [];
    return selectedList.tasks.filter((t) => {
      // Status filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      // Section filter
      if (sectionFilter !== "all" && t.section !== sectionFilter) return false;
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesId = t.id.toLowerCase().includes(q);
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesSection = t.section.toLowerCase().includes(q);
        const matchesAgent =
          t.agentType?.toLowerCase().includes(q) ||
          t.assignedAgent?.toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesSection && !matchesAgent)
          return false;
      }
      return true;
    });
  };

  // Get next action text
  const getNextAction = (
    task: EnrichedTask,
  ): { label: string; color: string; urgent?: boolean } => {
    if (task.status === "complete")
      return { label: "Done", color: "text-green-400" };
    if (task.blockingQuestion)
      return {
        label: "Awaiting Input",
        color: "text-yellow-400",
        urgent: true,
      };
    if (task.isStuck)
      return {
        label: task.stuckReason || "Stuck",
        color: "text-red-400",
        urgent: true,
      };
    if (task.status === "in_progress") {
      if (task.assignedAgent)
        return {
          label: task.agentType || "Agent working",
          color: "text-blue-400",
        };
      return { label: "Waiting for agent", color: "text-yellow-400" };
    }
    if (task.error)
      return { label: "Needs retry", color: "text-red-400", urgent: true };
    return { label: "Ready", color: "text-gray-500" };
  };

  // Get unique sections
  const getSections = () => {
    if (!selectedList) return [];
    return [...new Set(selectedList.tasks.map((t) => t.section))];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const filteredTasks = getFilteredTasks();

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col bg-gray-900 text-gray-100 overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Task Lists</h1>
            <p className="text-gray-400 text-xs">
              Browse and manage task lists from markdown files
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/tasks/kanban"
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 hover:bg-gray-600"
            >
              Kanban Board
            </Link>
            <Link
              to="/agents"
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Agent Dashboard
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mx-4 mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div
          className={`${sidebarCollapsed ? "w-10" : "w-56"} flex-shrink-0 border-r border-gray-700 flex flex-col transition-all`}
        >
          <div className="p-2 border-b border-gray-700 flex items-center justify-between bg-gray-800">
            {!sidebarCollapsed && (
              <span className="text-xs font-medium text-gray-400">
                TASK LISTS
              </span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 text-xs"
            >
              {sidebarCollapsed ? ">" : "<"}
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto">
              {taskLists.map((list) => (
                <button
                  key={list.filePath}
                  onClick={() => fetchTaskListDetails(list.filePath)}
                  className={`w-full p-2 text-left hover:bg-gray-800 border-b border-gray-800 ${
                    selectedList?.filePath === list.filePath
                      ? "bg-blue-900/30 border-l-2 border-l-blue-500"
                      : ""
                  }`}
                >
                  <div className="text-sm font-medium text-gray-200 truncate">
                    {list.title}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {list.fileName}
                  </div>
                  <div className="mt-1 flex gap-2 text-xs">
                    <span className="text-green-400">{list.complete}</span>
                    <span className="text-blue-400">{list.inProgress}</span>
                    <span className="text-gray-500">{list.pending}</span>
                  </div>
                  <div className="mt-1 h-1 bg-gray-700 rounded-full">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${list.percentComplete}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {loadingDetails ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : selectedList ? (
            <>
              {/* Task List Header */}
              <div className="flex-shrink-0 p-4 bg-gray-800/50 border-b border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold">{selectedList.title}</h2>
                    <p className="text-xs text-gray-500 font-mono">
                      {selectedList.filePath}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {/* Executor Controls - Simplified */}
                    {executorStatus?.running ? (
                      <>
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                          Executing: {executorStatus.completedTasks}/
                          {executorStatus.totalTasks}
                        </span>
                        {executorStatus.paused ? (
                          <button
                            onClick={resumeExecutor}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Resume
                          </button>
                        ) : (
                          <button
                            onClick={pauseExecutor}
                            className="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700"
                          >
                            Pause
                          </button>
                        )}
                        <button
                          onClick={stopExecutor}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          Stop
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={loadIntoExecutor}
                          className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
                        >
                          Load into Executor
                        </button>
                        {executorStatus?.taskListPath ===
                          selectedList.filePath && (
                          <button
                            onClick={startExecutor}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Start Auto-Execute
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => setShowAddTaskModal(true)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      + Add Task
                    </button>
                  </div>
                </div>

                {/* Stats + Search + Filters Row */}
                <div className="flex items-center gap-4">
                  {/* Stats */}
                  <div className="flex items-center gap-3 text-sm flex-shrink-0">
                    <span>
                      <strong className="text-xl">
                        {selectedList.summary.total}
                      </strong>{" "}
                      <span className="text-gray-500">total</span>
                    </span>
                    <span className="text-gray-600">|</span>
                    <span>
                      <strong className="text-xl text-green-400">
                        {selectedList.summary.complete}
                      </strong>{" "}
                      <span className="text-gray-500">done</span>
                    </span>
                    <span>
                      <strong className="text-xl text-blue-400">
                        {selectedList.summary.inProgress}
                      </strong>{" "}
                      <span className="text-gray-500">active</span>
                    </span>
                    <span>
                      <strong className="text-xl text-gray-400">
                        {selectedList.summary.pending}
                      </strong>{" "}
                      <span className="text-gray-500">pending</span>
                    </span>
                  </div>

                  {/* Priority Tags */}
                  <div className="flex gap-1 flex-shrink-0">
                    {Object.entries(selectedList.summary.byPriority).map(
                      ([p, count]) => (
                        <span
                          key={p}
                          className={`px-2 py-0.5 text-xs rounded ${priorityColors[p]}`}
                        >
                          {p}: {count}
                        </span>
                      ),
                    )}
                  </div>

                  {/* Search Bar - Prominent, centered in remaining space */}
                  <div className="flex-1 flex justify-center px-4">
                    <div className="relative w-full max-w-md">
                      <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-700 border-2 border-gray-500 focus:border-blue-500 rounded-lg px-4 py-2 text-sm placeholder-gray-400 outline-none transition-colors"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-lg"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">Active</option>
                      <option value="complete">Complete</option>
                    </select>
                    <select
                      value={sectionFilter}
                      onChange={(e) => setSectionFilter(e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs max-w-[150px]"
                    >
                      <option value="all">All Sections</option>
                      {getSections().map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {filteredTasks.length} of {selectedList.tasks.length}
                  </span>
                </div>
              </div>

              {/* Task Table - Single table with sticky header */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-800 z-10">
                    <tr className="border-b border-gray-700">
                      <th className="w-8 px-2 py-2 text-left text-xs font-medium text-gray-400"></th>
                      <th className="w-20 px-2 py-2 text-left text-xs font-medium text-gray-400">
                        ID
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">
                        DESCRIPTION
                      </th>
                      <th className="w-12 px-2 py-2 text-left text-xs font-medium text-gray-400">
                        PRI
                      </th>
                      <th className="w-20 px-2 py-2 text-left text-xs font-medium text-gray-400">
                        STATUS
                      </th>
                      <th className="w-24 px-2 py-2 text-left text-xs font-medium text-gray-400">
                        AGENT
                      </th>
                      <th className="w-20 px-2 py-2 text-left text-xs font-medium text-gray-400">
                        STARTED
                      </th>
                      <th className="w-28 px-2 py-2 text-left text-xs font-medium text-gray-400">
                        NEXT ACTION
                      </th>
                      <th className="w-20 px-2 py-2 text-left text-xs font-medium text-gray-400">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => {
                      const isExpanded = expandedTasks.has(task.id);
                      const nextAction = getNextAction(task);

                      return (
                        <React.Fragment key={task.id}>
                          <tr
                            className={`border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer ${
                              task.status === "complete" ? "opacity-50" : ""
                            } ${task.status === "in_progress" ? "bg-blue-900/10" : ""} ${task.isStuck ? "bg-red-900/10" : ""}`}
                            onClick={() => toggleTaskExpanded(task.id)}
                          >
                            <td className="px-2 py-1.5 text-gray-500">
                              {isExpanded ? "▼" : "▶"}
                            </td>
                            <td className="px-2 py-1.5 font-mono text-xs text-gray-400">
                              {task.id}
                            </td>
                            <td className="px-2 py-1.5">
                              <span
                                className={`${task.status === "complete" ? "line-through text-gray-500" : ""}`}
                              >
                                {task.description.length > 80
                                  ? task.description.slice(0, 80) + "..."
                                  : task.description}
                              </span>
                            </td>
                            <td className="px-2 py-1.5">
                              <span
                                className={`px-1.5 py-0.5 text-xs rounded ${priorityColors[task.priority]}`}
                              >
                                {task.priority}
                              </span>
                            </td>
                            <td className="px-2 py-1.5">
                              <span
                                className={`text-xs ${statusColors[task.status]}`}
                              >
                                {task.status === "in_progress"
                                  ? "active"
                                  : task.status}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-xs text-gray-400">
                              {task.agentType ||
                                task.assignedAgent?.slice(0, 8) ||
                                "-"}
                            </td>
                            <td className="px-2 py-1.5 text-xs text-gray-400">
                              {task.startedAt
                                ? formatRelativeTime(task.startedAt)
                                : "-"}
                            </td>
                            <td className="px-2 py-1.5">
                              <span className={`text-xs ${nextAction.color}`}>
                                {nextAction.urgent && "⚠ "}
                                {nextAction.label}
                              </span>
                            </td>
                            <td
                              className="px-2 py-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <select
                                value={task.status}
                                onChange={(e) =>
                                  updateTaskStatus(
                                    task.id,
                                    e.target.value as
                                      | "pending"
                                      | "in_progress"
                                      | "complete",
                                  )
                                }
                                className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs"
                              >
                                <option value="pending">Pending</option>
                                <option value="in_progress">Active</option>
                                <option value="complete">Done</option>
                              </select>
                            </td>
                          </tr>

                          {/* Expanded Row */}
                          {isExpanded && (
                            <tr className="bg-gray-850 border-b border-gray-800">
                              <td colSpan={9} className="px-4 py-4">
                                {/* Loading state for task detail */}
                                {loadingTaskDetail === task.id && (
                                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                                    Loading task details...
                                  </div>
                                )}

                                {/* Task Detail from Markdown */}
                                {taskDetails[task.id] && (
                                  <div className="mb-4">
                                    <h3 className="text-lg font-semibold text-blue-400 mb-2">
                                      {taskDetails[task.id]!.title}
                                    </h3>

                                    {taskDetails[task.id]!.summary && (
                                      <div className="mb-4">
                                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">
                                          Summary
                                        </div>
                                        <p className="text-sm text-gray-200 bg-gray-800 rounded p-3">
                                          {taskDetails[task.id]!.summary}
                                        </p>
                                      </div>
                                    )}

                                    {taskDetails[task.id]!.requirements.length >
                                      0 && (
                                      <div className="mb-4">
                                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">
                                          Requirements
                                        </div>
                                        <ul className="list-disc list-inside text-sm text-gray-300 bg-gray-800 rounded p-3 space-y-1">
                                          {taskDetails[
                                            task.id
                                          ]!.requirements.map((req, i) => (
                                            <li key={i}>{req}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {taskDetails[task.id]!.passCriteria.length >
                                      0 && (
                                      <div className="mb-4">
                                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">
                                          Pass Criteria
                                        </div>
                                        <ul className="text-sm text-gray-300 bg-gray-800 rounded p-3 space-y-1">
                                          {taskDetails[
                                            task.id
                                          ]!.passCriteria.map((crit, i) => (
                                            <li
                                              key={i}
                                              className="flex items-start gap-2"
                                            >
                                              <span
                                                className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-xs ${task.status === "complete" ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"}`}
                                              >
                                                {task.status === "complete"
                                                  ? "✓"
                                                  : i + 1}
                                              </span>
                                              <span>{crit}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    <div className="text-xs text-gray-500 font-mono">
                                      File: {taskDetails[task.id]!.filePath}
                                    </div>
                                  </div>
                                )}

                                {/* Fallback: Basic info when no detail file exists */}
                                {taskDetails[task.id] === null && (
                                  <div className="mb-4">
                                    <div className="text-xs font-medium text-gray-400 uppercase mb-1">
                                      Description
                                    </div>
                                    <p className="text-sm text-gray-200 bg-gray-800 rounded p-3">
                                      {task.description}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2 italic">
                                      No detailed task file found for {task.id}
                                    </p>
                                  </div>
                                )}

                                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700">
                                  {/* Task Metadata */}
                                  <div className="col-span-2">
                                    <div className="grid grid-cols-4 gap-2 text-xs">
                                      <div>
                                        <span className="text-gray-500">
                                          Section:
                                        </span>{" "}
                                        <span className="text-gray-300">
                                          {task.section}
                                        </span>
                                      </div>
                                      {task.subsection && (
                                        <div>
                                          <span className="text-gray-500">
                                            Subsection:
                                          </span>{" "}
                                          <span className="text-gray-300">
                                            {task.subsection}
                                          </span>
                                        </div>
                                      )}
                                      <div>
                                        <span className="text-gray-500">
                                          Line:
                                        </span>{" "}
                                        <span className="text-gray-300">
                                          {task.lineNumber}
                                        </span>
                                      </div>
                                      {task.attempts !== undefined &&
                                        task.attempts > 0 && (
                                          <div>
                                            <span className="text-gray-500">
                                              Attempts:
                                            </span>{" "}
                                            <span className="text-gray-300">
                                              {task.attempts}
                                            </span>
                                          </div>
                                        )}
                                      {task.durationMs && (
                                        <div>
                                          <span className="text-gray-500">
                                            Duration:
                                          </span>{" "}
                                          <span className="text-gray-300">
                                            {formatDuration(task.durationMs)}
                                          </span>
                                        </div>
                                      )}
                                      {task.elapsedMs &&
                                        task.status === "in_progress" && (
                                          <div>
                                            <span className="text-gray-500">
                                              Elapsed:
                                            </span>{" "}
                                            <span
                                              className={
                                                task.elapsedMs > 3600000
                                                  ? "text-red-400"
                                                  : "text-gray-300"
                                              }
                                            >
                                              {formatDuration(task.elapsedMs)}
                                            </span>
                                          </div>
                                        )}
                                    </div>

                                    {task.dependencies &&
                                      task.dependencies.length > 0 && (
                                        <div className="mt-2 text-xs">
                                          <span className="text-gray-500">
                                            Dependencies:
                                          </span>{" "}
                                          <span className="text-gray-300">
                                            {task.dependencies.join(", ")}
                                          </span>
                                        </div>
                                      )}
                                  </div>

                                  {/* Status Panel */}
                                  <div>
                                    {task.error && (
                                      <div className="bg-red-900/30 border border-red-800/50 rounded p-2 mb-2">
                                        <div className="text-xs font-medium text-red-400 mb-1">
                                          Error
                                        </div>
                                        <pre className="text-xs text-red-300 whitespace-pre-wrap">
                                          {task.error}
                                        </pre>
                                      </div>
                                    )}

                                    {task.blockingQuestion && (
                                      <div className="bg-yellow-900/30 border border-yellow-800/50 rounded p-2 mb-2">
                                        <div className="text-xs font-medium text-yellow-400 mb-1">
                                          Awaiting Human Response
                                        </div>
                                        <p className="text-xs text-yellow-200 mb-2">
                                          {task.blockingQuestion.content}
                                        </p>
                                        {task.blockingQuestion.options && (
                                          <div className="flex flex-wrap gap-1">
                                            {task.blockingQuestion.options.map(
                                              (opt, i) => (
                                                <button
                                                  key={i}
                                                  className="px-2 py-0.5 bg-yellow-700 hover:bg-yellow-600 rounded text-xs text-yellow-100"
                                                >
                                                  {opt}
                                                </button>
                                              ),
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {task.isStuck && !task.blockingQuestion && (
                                      <div className="bg-red-900/30 border border-red-800/50 rounded p-2 mb-2">
                                        <div className="text-xs font-medium text-red-400 mb-1">
                                          Task Stuck
                                        </div>
                                        <p className="text-xs text-red-300 mb-2">
                                          {task.stuckReason}
                                        </p>
                                        <button
                                          onClick={() =>
                                            updateTaskStatus(task.id, "pending")
                                          }
                                          className="px-2 py-0.5 bg-red-700 hover:bg-red-600 rounded text-xs text-red-100"
                                        >
                                          Reset to Pending
                                        </button>
                                      </div>
                                    )}

                                    {task.status === "pending" &&
                                      !task.error && (
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() =>
                                              updateTaskStatus(
                                                task.id,
                                                "in_progress",
                                              )
                                            }
                                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white"
                                          >
                                            Start Task
                                          </button>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {filteredTasks.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    {searchQuery
                      ? `No tasks matching "${searchQuery}"`
                      : "No tasks match the current filters"}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-2 opacity-50">📋</div>
                <div>Select a task list to view details</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && selectedList && (
        <AddTaskModal
          taskList={selectedList}
          onClose={() => setShowAddTaskModal(false)}
          onAdd={async (task) => {
            try {
              const res = await fetch("/api/task-lists/task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: selectedList.filePath, ...task }),
              });
              if (!res.ok) throw new Error("Failed to add task");
              await fetchTaskListDetails(selectedList.filePath);
              setShowAddTaskModal(false);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Failed to add task",
              );
            }
          }}
        />
      )}
    </div>
  );
}

// Need to import React for React.Fragment
import React from "react";

// Add Task Modal
function AddTaskModal({
  taskList,
  onClose,
  onAdd,
}: {
  taskList: TaskList;
  onClose: () => void;
  onAdd: (task: {
    section: string;
    id: string;
    description: string;
    priority: "P1" | "P2" | "P3" | "P4";
  }) => void;
}) {
  const [section, setSection] = useState(taskList.sections[0]?.name || "");
  const [id, setId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"P1" | "P2" | "P3" | "P4">("P2");

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <h3 className="text-lg font-bold mb-4">Add New Task</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Section</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            >
              {taskList.sections.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Task ID</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              placeholder="e.g., NEW-001"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Priority</label>
            <div className="flex gap-2">
              {(["P1", "P2", "P3", "P4"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 rounded ${priority === p ? priorityColors[p] : "bg-gray-700 text-gray-400"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onAdd({ section, id, description, priority })}
            disabled={!id || !description}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
}
