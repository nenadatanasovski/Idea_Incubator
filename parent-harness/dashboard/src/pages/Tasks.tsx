import { useEffect, useState, useMemo } from "react";
import { Layout } from "../components/Layout";
import { TaskCard, mockTasks } from "../components/TaskCard";
import { WaveProgressBar } from "../components/WaveProgressBar";
import { LaneGrid } from "../components/LaneGrid";
import { TaskDetailModal } from "../components/TaskDetailModal";
import { useTasks } from "../hooks/useTasks";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  generateWavesFromTasks,
  generateLanesFromTasks,
} from "../utils/task-pipeline";
import type { Task } from "../api/types";
import type { LaneTask } from "../types/pipeline";

type TabView = "board" | "waves";
type StatusFilter =
  | "all"
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked";
type PriorityFilter = "all" | "P0" | "P1" | "P2" | "P3" | "P4";

function mapTaskToCard(task: Task) {
  return {
    id: task.id,
    displayId: task.display_id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assignedAgent: task.assigned_agent_id ?? undefined,
    category: task.category ?? undefined,
  };
}

export function Tasks() {
  const { tasks, loading, error, refetch } = useTasks();
  const { connected, subscribe } = useWebSocket();

  const [activeTab, setActiveTab] = useState<TabView>("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedWave, setSelectedWave] = useState<number | undefined>(
    undefined,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Real-time task updates via WebSocket
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type.startsWith("task:")) {
        refetch();
      }
    });
    return unsubscribe;
  }, [subscribe, refetch]);

  // Use real data, fall back to mock
  const rawTasks =
    loading || error
      ? mockTasks.map(
          (t) =>
            ({
              ...t,
              id: t.id,
              display_id: t.displayId,
              description: null,
              task_list_id: "default",
              parent_task_id: null,
              pass_criteria: null,
              started_at: null,
              completed_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              assigned_agent_id: t.assignedAgent ?? null,
            }) as Task,
        )
      : tasks;

  const taskCards = loading || error ? mockTasks : tasks.map(mapTaskToCard);

  // Filtered tasks for Board tab
  const filteredCards = useMemo(() => {
    return taskCards.filter((task) => {
      const matchesSearch =
        searchQuery === "" ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.displayId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.assignedAgent
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ??
          false);

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [taskCards, searchQuery, statusFilter, priorityFilter]);

  // Wave/Lane data for Waves tab
  const waves = useMemo(() => generateWavesFromTasks(rawTasks), [rawTasks]);
  const lanes = useMemo(() => generateLanesFromTasks(rawTasks), [rawTasks]);
  const activeWave = waves.find((w) => w.status === "active")?.waveNumber || 1;

  const handleTaskClick = (task: LaneTask) => {
    setSelectedTaskId(task.taskId);
  };

  // Status counts for quick stats
  const statusCounts = useMemo(() => {
    const counts = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
    };
    taskCards.forEach((t) => {
      if (t.status in counts) counts[t.status as keyof typeof counts]++;
    });
    return counts;
  }, [taskCards]);

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Tasks</h1>
            <p className="text-gray-400 text-sm">
              {taskCards.length} total
              {statusCounts.in_progress > 0 &&
                ` | ${statusCounts.in_progress} in progress`}
              {statusCounts.pending > 0 && ` | ${statusCounts.pending} pending`}
              {statusCounts.failed > 0 && ` | ${statusCounts.failed} failed`}
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

        {error && <div className="text-red-400 text-xs">Using mock data</div>}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-gray-700">
          <button
            onClick={() => setActiveTab("board")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "board"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setActiveTab("waves")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "waves"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Waves
          </button>
        </div>

        {/* Board Tab */}
        {activeTab === "board" && (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-64"
              />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="blocked">Blocked</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as PriorityFilter)
                }
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Priority</option>
                <option value="P0">P0 - Critical</option>
                <option value="P1">P1 - High</option>
                <option value="P2">P2 - Medium</option>
                <option value="P3">P3 - Low</option>
                <option value="P4">P4 - Trivial</option>
              </select>
              {(searchQuery ||
                statusFilter !== "all" ||
                priorityFilter !== "all") && (
                <span className="text-xs text-gray-500">
                  {filteredCards.length} of {taskCards.length} tasks
                </span>
              )}
            </div>

            {/* Task Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCards.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="cursor-pointer"
                >
                  <TaskCard {...task} />
                </div>
              ))}
            </div>

            {filteredCards.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No tasks match your filters</p>
                <p className="text-sm mt-1">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}
          </div>
        )}

        {/* Waves Tab */}
        {activeTab === "waves" && (
          <div className="space-y-6">
            {waves.length > 0 ? (
              <>
                <WaveProgressBar
                  waves={waves}
                  activeWaveNumber={activeWave}
                  selectedWaveNumber={selectedWave}
                  onWaveClick={setSelectedWave}
                />
                <LaneGrid
                  lanes={lanes}
                  waves={waves}
                  activeWaveNumber={activeWave}
                  selectedWaveNumber={selectedWave}
                  onTaskClick={handleTaskClick}
                />
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No wave data available</p>
                <p className="text-sm mt-1">
                  Tasks will be organized into waves when available
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onNavigateToTask={(id) => setSelectedTaskId(id)}
        />
      )}
    </Layout>
  );
}

export default Tasks;
