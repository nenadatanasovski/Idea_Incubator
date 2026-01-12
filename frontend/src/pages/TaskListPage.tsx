import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Filter,
  LayoutGrid,
} from 'lucide-react';

interface Task {
  id: string;
  taskId: string;
  buildId: string;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  specPath: string | null;
}

type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'failed' | 'blocked';

interface TaskSummary {
  total: number;
  pending: number;
  in_progress: number;
  complete: number;
  failed: number;
  blocked: number;
}

const statusConfig: Record<TaskStatus, { bg: string; text: string; icon: typeof Activity }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Activity },
  complete: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  failed: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  blocked: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
};

export default function TaskListPage(): JSX.Element {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    fetchTasks();
    fetchSummary();
  }, [statusFilter, limit]);

  async function fetchTasks(): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      params.set('limit', limit.toString());

      const response = await fetch(`/api/tasks?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const data = await response.json();
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSummary(): Promise<void> {
    try {
      const response = await fetch('/api/tasks/summary');
      if (!response.ok) return;
      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }

  function formatDuration(ms: number | null): string {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Task List</h1>
          <p className="mt-1 text-sm text-gray-500">
            {summary ? `${summary.total} total tasks` : 'Loading summary...'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={fetchTasks} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link to="/tasks/kanban" className="btn btn-primary flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Kanban View
          </Link>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <SummaryCard label="Total" value={summary.total} color="bg-gray-100 text-gray-700" />
          <SummaryCard label="Pending" value={summary.pending} color="bg-gray-100 text-gray-700" />
          <SummaryCard label="In Progress" value={summary.in_progress} color="bg-blue-100 text-blue-700" />
          <SummaryCard label="Complete" value={summary.complete} color="bg-green-100 text-green-700" />
          <SummaryCard label="Failed" value={summary.failed} color="bg-red-100 text-red-700" />
          <SummaryCard label="Blocked" value={summary.blocked} color="bg-amber-100 text-amber-700" />
        </div>
      )}

      {error && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-4 mb-4 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
              <option value="failed">Failed</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Show:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No tasks found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Task ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Started</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Completed</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Duration</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Error</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const config = statusConfig[task.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <tr key={task.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs">{task.taskId}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${config.bg} ${config.text}`}>
                          <StatusIcon className="h-3 w-3" />
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {task.startedAt ? new Date(task.startedAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {task.completedAt ? new Date(task.completedAt).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {formatDuration(task.durationMs)}
                      </td>
                      <td className="py-3 px-4">
                        {task.error && (
                          <span className="text-xs text-red-600 max-w-xs truncate block" title={task.error}>
                            {task.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  color: string;
}

function SummaryCard({ label, value, color }: SummaryCardProps): JSX.Element {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
