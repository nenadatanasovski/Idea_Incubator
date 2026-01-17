/**
 * PipelineDashboard Page
 *
 * Main view for the parallelization-centric UI showing lanes, waves, agents, and conflicts.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  Grid3X3,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Play,
  Square,
} from "lucide-react";
import type { PipelineStatus, Lane, LaneTask } from "../types/pipeline";
import {
  LaneGrid,
  WaveProgressBar,
  AgentPool,
  ExecutionStream,
  LaneDetailPanel,
  ConflictMatrix,
  TaskDetailModal,
} from "../components/pipeline";
import ParallelismControls from "../components/pipeline/ParallelismControls";
import ParallelismPreview from "../components/pipeline/ParallelismPreview";
import usePipelineWebSocket, {
  usePipelineStatus,
  usePipelineEvents,
  usePipelineFilters,
} from "../hooks/usePipelineWebSocket";

type ViewMode = "grid" | "conflicts" | "stream";

export default function PipelineDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get("view") as ViewMode) || "grid",
  );
  const [selectedLane, setSelectedLane] = useState<Lane | null>(null);
  const [selectedWaveNumber, setSelectedWaveNumber] = useState<
    number | undefined
  >(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Filter state synced with URL
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    searchParams.get("projectId") || "all",
  );
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>(
    searchParams.get("taskListId") || "all",
  );

  // Execution state
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [showParallelismPreview, setShowParallelismPreview] = useState(false);

  // Fetch filter options
  const {
    projects,
    taskLists,
    loading: filtersLoading,
    refetchTaskLists,
  } = usePipelineFilters();

  // Data fetching with filters
  const { status, loading, error, refetch } = usePipelineStatus({
    projectId: selectedProjectId,
    taskListId: selectedTaskListId,
  });
  const { events: initialEvents } = usePipelineEvents(100);

  // Memoize the status change handler to prevent infinite reconnection loop
  const handleStatusChange = useCallback(() => {
    // Refetch full status when we get an update
    refetch();
  }, [refetch]);

  // WebSocket for real-time updates
  const {
    isConnected,
    events: wsEvents,
    reconnect,
  } = usePipelineWebSocket({
    enabled: true,
    onStatusChange: handleStatusChange,
  });

  // Combine initial events with WebSocket events
  const allEvents = [...initialEvents, ...wsEvents];

  // Update URL when view mode or filters change
  useEffect(() => {
    const params: Record<string, string> = { view: viewMode };
    if (selectedProjectId && selectedProjectId !== "all") {
      params.projectId = selectedProjectId;
    }
    if (selectedTaskListId && selectedTaskListId !== "all") {
      params.taskListId = selectedTaskListId;
    }
    setSearchParams(params);
  }, [viewMode, selectedProjectId, selectedTaskListId, setSearchParams]);

  // Refetch task lists when project changes
  useEffect(() => {
    refetchTaskLists(selectedProjectId);
    // Reset task list selection when project changes (unless it's initial load)
    if (selectedProjectId !== "all") {
      setSelectedTaskListId("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // Handlers
  const handleTaskClick = useCallback((task: LaneTask) => {
    // Open task detail modal
    setSelectedTaskId(task.taskId);
  }, []);

  const handleCloseTaskDetail = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const handleNavigateToTask = useCallback((taskId: string) => {
    // Navigate within modal to another task
    setSelectedTaskId(taskId);
  }, []);

  const handleLaneClick = useCallback((lane: Lane) => {
    setSelectedLane(lane);
  }, []);

  const handleWaveClick = useCallback((waveNumber: number) => {
    setSelectedWaveNumber((prev) =>
      prev === waveNumber ? undefined : waveNumber,
    );
  }, []);

  const handleCloseLaneDetail = useCallback(() => {
    setSelectedLane(null);
  }, []);

  // Execution control handlers
  const handleStartExecution = async () => {
    if (selectedTaskListId === "all") return;
    setExecutionError(null);
    try {
      const response = await fetch(
        `/api/task-agent/task-lists/${selectedTaskListId}/execute`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to start execution");
      }
      refetch();
    } catch (error) {
      setExecutionError(
        error instanceof Error ? error.message : "Unknown error",
      );
      console.error("Failed to start execution:", error);
    }
  };

  const handleStopExecution = async () => {
    if (selectedTaskListId === "all") return;
    try {
      await fetch(`/api/task-agent/task-lists/${selectedTaskListId}/stop`, {
        method: "POST",
      });
      refetch();
    } catch (error) {
      console.error("Failed to stop execution:", error);
    }
  };

  // Loading state
  if (loading && !status) {
    return (
      <div
        data-testid="pipeline-dashboard"
        className="flex items-center justify-center h-64"
      >
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading pipeline status...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !status) {
    return (
      <div
        data-testid="pipeline-dashboard"
        className="flex items-center justify-center h-64"
      >
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-3" />
          <p className="text-red-600 mb-2">Failed to load pipeline status</p>
          <p className="text-gray-500 text-sm mb-4">{error.message}</p>
          <button onClick={refetch} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Use default empty status if none available
  const pipelineStatus: PipelineStatus = status || {
    sessionId: "",
    status: "idle",
    lanes: [],
    waves: [],
    activeWaveNumber: 0,
    agents: [],
    conflicts: [],
    totalTasks: 0,
    completedTasks: 0,
    percentComplete: 0,
  };

  return (
    <div data-testid="pipeline-dashboard" className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary-600" />
          <h1 className="text-xl font-semibold text-gray-900">
            Pipeline Dashboard
          </h1>
          {pipelineStatus.sessionId && (
            <span className="text-sm text-gray-500">
              Session: {pipelineStatus.sessionId.slice(0, 8)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div
            className={`flex items-center gap-1.5 text-sm ${isConnected ? "text-green-600" : "text-red-600"}`}
          >
            {isConnected ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span>{isConnected ? "Connected" : "Disconnected"}</span>
            {!isConnected && (
              <button
                onClick={reconnect}
                className="ml-1 text-primary-600 hover:text-primary-700"
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Execution Controls */}
          {selectedTaskListId !== "all" && (
            <div className="flex items-center gap-2 border-r border-gray-300 pr-4 mr-2">
              <button
                onClick={() =>
                  setShowParallelismPreview(!showParallelismPreview)
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  showParallelismPreview
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                data-testid="toggle-parallelism-preview-btn"
              >
                Preview
              </button>

              <button
                onClick={handleStartExecution}
                disabled={
                  pipelineStatus.status === "running" ||
                  pipelineStatus.status === "paused"
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pipelineStatus.status === "running" ||
                  pipelineStatus.status === "paused"
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                <Play className="w-4 h-4" />
                Start
              </button>

              <button
                onClick={handleStopExecution}
                disabled={
                  pipelineStatus.status !== "running" &&
                  pipelineStatus.status !== "paused"
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pipelineStatus.status !== "running" &&
                  pipelineStatus.status !== "paused"
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                <Square className="w-4 h-4" />
                Stop
              </button>

              {executionError && (
                <span
                  className="text-xs text-red-600 max-w-48 truncate"
                  title={executionError}
                >
                  {executionError}
                </span>
              )}
            </div>
          )}

          {/* Filter dropdowns */}
          <div className="flex items-center gap-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={filtersLoading}
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectCode !== "N/A"
                    ? `${p.projectName} [${p.projectCode}]`
                    : p.projectName}{" "}
                  ({p.taskCount})
                </option>
              ))}
            </select>

            <select
              value={selectedTaskListId}
              onChange={(e) => setSelectedTaskListId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={filtersLoading || taskLists.length === 0}
            >
              <option value="all">All Task Lists</option>
              {taskLists.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.name} ({tl.taskCount})
                </option>
              ))}
            </select>
          </div>

          {/* View mode tabs */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              Grid
            </button>
            <button
              onClick={() => setViewMode("conflicts")}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors ${
                viewMode === "conflicts"
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Conflicts
            </button>
            <button
              onClick={() => setViewMode("stream")}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors ${
                viewMode === "stream"
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Activity className="w-4 h-4" />
              Stream
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={refetch}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Execution Overview Bar */}
      <div
        data-testid="execution-overview"
        className="grid grid-cols-6 gap-4 p-4 bg-gray-50 border-b border-gray-200"
      >
        <div className="text-center">
          <div
            className={`text-2xl font-bold ${
              pipelineStatus.status === "running"
                ? "text-green-600"
                : pipelineStatus.status === "paused"
                  ? "text-amber-600"
                  : "text-gray-900"
            }`}
          >
            {pipelineStatus.status === "running" && (
              <span className="inline-block animate-pulse">●</span>
            )}{" "}
            {pipelineStatus.status.charAt(0).toUpperCase() +
              pipelineStatus.status.slice(1)}
          </div>
          <div className="text-xs text-gray-500 uppercase">Status</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {pipelineStatus.completedTasks}/{pipelineStatus.totalTasks}
          </div>
          <div className="text-xs text-gray-500 uppercase">Tasks</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {pipelineStatus.lanes.length}
          </div>
          <div className="text-xs text-gray-500 uppercase">Lanes</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {pipelineStatus.waves.length}
          </div>
          <div className="text-xs text-gray-500 uppercase">Waves</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {pipelineStatus.agents.filter((a) => a.status === "working").length}
          </div>
          <div className="text-xs text-gray-500 uppercase">Active Agents</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {pipelineStatus.percentComplete}%
          </div>
          <div className="text-xs text-gray-500 uppercase">Done</div>
        </div>
      </div>

      {/* Wave Progress Bar */}
      <div className="p-4 border-b border-gray-200">
        <WaveProgressBar
          waves={pipelineStatus.waves}
          activeWaveNumber={pipelineStatus.activeWaveNumber}
          selectedWaveNumber={selectedWaveNumber}
          onWaveClick={handleWaveClick}
        />
      </div>

      {/* Parallelism Controls & Preview */}
      {selectedTaskListId !== "all" && (
        <div className="p-4 border-b border-gray-200 space-y-4">
          <ParallelismControls
            taskListId={selectedTaskListId}
            onRecalculateComplete={(stats) => {
              console.log("Parallelism recalculated:", stats);
              refetch();
            }}
          />

          {showParallelismPreview && (
            <ParallelismPreview
              taskListId={selectedTaskListId}
              onStartExecution={handleStartExecution}
              onPauseExecution={handleStopExecution}
              isExecuting={pipelineStatus.status === "running"}
            />
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-auto p-4">
          {viewMode === "grid" && (
            <LaneGrid
              lanes={pipelineStatus.lanes}
              waves={pipelineStatus.waves}
              activeWaveNumber={pipelineStatus.activeWaveNumber}
              selectedWaveNumber={selectedWaveNumber}
              onTaskClick={handleTaskClick}
              onLaneClick={handleLaneClick}
            />
          )}

          {viewMode === "conflicts" && (
            <ConflictMatrix
              tasks={pipelineStatus.lanes.flatMap((l) =>
                l.tasks.map((t) => ({
                  id: t.taskId,
                  displayId: t.displayId,
                  title: t.title,
                })),
              )}
              conflicts={pipelineStatus.conflicts}
            />
          )}

          {viewMode === "stream" && (
            <ExecutionStream
              events={allEvents}
              maxHeight="calc(100vh - 400px)"
            />
          )}
        </div>

        {/* Sidebar: Execution Stream (in grid mode) */}
        {viewMode === "grid" && (
          <div className="w-80 border-l border-gray-200 flex flex-col">
            <div className="flex-1 overflow-hidden">
              <ExecutionStream events={allEvents} maxHeight="100%" />
            </div>
          </div>
        )}
      </div>

      {/* Agent Pool Footer */}
      <div className="border-t border-gray-200">
        <AgentPool agents={pipelineStatus.agents} />
      </div>

      {/* Lane Detail Panel (slide-out) */}
      {selectedLane && (
        <LaneDetailPanel
          lane={selectedLane}
          onClose={handleCloseLaneDetail}
          onTaskClick={handleTaskClick}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          onNavigateToTask={handleNavigateToTask}
        />
      )}
    </div>
  );
}
