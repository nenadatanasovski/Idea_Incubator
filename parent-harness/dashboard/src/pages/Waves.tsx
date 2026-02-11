import { useState, useEffect } from "react";

const API_BASE = "http://localhost:3333/api";

interface Wave {
  id: string;
  wave_number: number;
  task_list_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  task_count: number;
  completed_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface WaveRun {
  id: string;
  task_list_id: string;
  status: "pending" | "running" | "completed" | "failed";
  total_waves: number;
  current_wave: number;
  created_at: string;
}

interface WaveTask {
  id: string;
  display_id: string;
  title: string;
  status: string;
  wave_number: number;
  assigned_agent_id: string | null;
}

export function Waves() {
  const [, setWaves] = useState<Wave[]>([]);
  const [waveRuns, setWaveRuns] = useState<WaveRun[]>([]);
  const [tasks, setTasks] = useState<WaveTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWave, setSelectedWave] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/waves`)
        .then((r) => r.json())
        .catch(() => []),
      fetch(`${API_BASE}/wave-runs`)
        .then((r) => r.json())
        .catch(() => []),
      fetch(`${API_BASE}/tasks`)
        .then((r) => r.json())
        .catch(() => []),
    ]).then(([wavesData, runsData, tasksData]) => {
      setWaves(Array.isArray(wavesData) ? wavesData : []);
      setWaveRuns(Array.isArray(runsData) ? runsData : []);
      setTasks(
        Array.isArray(tasksData)
          ? tasksData.filter((t: WaveTask) => t.wave_number)
          : [],
      );
      setLoading(false);
    });
  }, []);

  const getWaveTasks = (waveNum: number) => {
    return tasks.filter((t) => t.wave_number === waveNum);
  };

  const getWaveStats = () => {
    const waveNumbers = [...new Set(tasks.map((t) => t.wave_number))].sort(
      (a, b) => a - b,
    );
    return waveNumbers.map((num) => {
      const waveTasks = getWaveTasks(num);
      return {
        wave: num,
        total: waveTasks.length,
        completed: waveTasks.filter((t) => t.status === "completed").length,
        failed: waveTasks.filter((t) => t.status === "failed").length,
        inProgress: waveTasks.filter((t) => t.status === "in_progress").length,
        pending: waveTasks.filter((t) => t.status === "pending").length,
      };
    });
  };

  const waveStats = getWaveStats();

  if (loading) {
    return <div className="p-6 text-gray-400">Loading waves...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Wave Execution</h1>

      {/* Wave Runs */}
      {waveRuns.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">
            Active Runs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waveRuns.map((run) => (
              <div key={run.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">
                    Run {run.id.slice(0, 8)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      run.status === "completed"
                        ? "bg-green-900 text-green-300"
                        : run.status === "running"
                          ? "bg-blue-900 text-blue-300"
                          : run.status === "failed"
                            ? "bg-red-900 text-red-300"
                            : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  Wave {run.current_wave} of {run.total_waves}
                </div>
                <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{
                      width: `${(run.current_wave / run.total_waves) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wave Statistics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">
          Wave Statistics
        </h2>
        {waveStats.length === 0 ? (
          <div className="text-gray-500">No waves with assigned tasks</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {waveStats.map((stat) => (
              <div
                key={stat.wave}
                className={`bg-gray-800 rounded-lg p-4 cursor-pointer border-2 transition-colors ${
                  selectedWave === stat.wave
                    ? "border-blue-500"
                    : "border-transparent hover:border-gray-600"
                }`}
                onClick={() =>
                  setSelectedWave(selectedWave === stat.wave ? null : stat.wave)
                }
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl font-bold text-white">
                    Wave {stat.wave}
                  </span>
                  <span className="text-sm text-gray-400">
                    {stat.total} tasks
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden flex">
                  {stat.completed > 0 && (
                    <div
                      className="bg-green-500 h-full"
                      style={{
                        width: `${(stat.completed / stat.total) * 100}%`,
                      }}
                    />
                  )}
                  {stat.inProgress > 0 && (
                    <div
                      className="bg-blue-500 h-full"
                      style={{
                        width: `${(stat.inProgress / stat.total) * 100}%`,
                      }}
                    />
                  )}
                  {stat.failed > 0 && (
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${(stat.failed / stat.total) * 100}%` }}
                    />
                  )}
                </div>

                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-green-400">✓ {stat.completed}</span>
                  <span className="text-blue-400">▶ {stat.inProgress}</span>
                  <span className="text-red-400">✗ {stat.failed}</span>
                  <span className="text-gray-400">⏳ {stat.pending}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Wave Tasks */}
      {selectedWave !== null && (
        <div>
          <h2 className="text-lg font-semibold text-gray-300 mb-4">
            Wave {selectedWave} Tasks
          </h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Agent
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {getWaveTasks(selectedWave).map((task) => (
                  <tr key={task.id} className="hover:bg-gray-750">
                    <td className="px-4 py-3 text-sm font-mono text-gray-400">
                      {task.display_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {task.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          task.status === "completed"
                            ? "bg-green-900 text-green-300"
                            : task.status === "in_progress"
                              ? "bg-blue-900 text-blue-300"
                              : task.status === "failed"
                                ? "bg-red-900 text-red-300"
                                : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-400">
                      {task.assigned_agent_id || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {waveStats.length === 0 && waveRuns.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">🌊</div>
          <p>No wave executions yet</p>
          <p className="text-sm mt-2">
            Tasks with wave_number will appear here
          </p>
        </div>
      )}
    </div>
  );
}

export default Waves;
