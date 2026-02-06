import { Layout } from '../components/Layout'
import { useSessions, type Session } from '../hooks/useSessions'
import { AgentSessionsView } from '../components/AgentSessionsView'

export function Sessions() {
  const { sessions, loading, error } = useSessions()

  // Generate mock sessions for demo if none exist
  const displaySessions = sessions.length > 0 ? sessions : generateMockSessions()

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Sessions</h1>
            <p className="text-gray-400">View agent session history, iterations, and logs</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Auto-refresh every 5s
            </span>
            {loading && (
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Enhanced Agent Sessions View with iterations and lineage */}
        <AgentSessionsView sessions={displaySessions} />

        <div className="text-gray-500 text-sm flex items-center gap-4">
          <span>Total sessions: {displaySessions.length}</span>
          <span>•</span>
          <span>Running: {displaySessions.filter(s => s.status === 'running').length}</span>
          <span>•</span>
          <span>Completed: {displaySessions.filter(s => s.status === 'completed').length}</span>
        </div>
      </div>
    </Layout>
  )
}

// Generate mock sessions for demonstration
function generateMockSessions(): Session[] {
  const now = new Date()
  
  return [
    {
      id: 'session-001-abc123',
      agent_id: 'build-agent-01',
      task_id: 'task-042',
      run_id: null,
      wave_number: 2,
      lane_id: 'api',
      status: 'running',
      started_at: new Date(now.getTime() - 3600000).toISOString(),
      completed_at: null,
      current_iteration: 3,
      total_iterations: 5,
      tasks_completed: 12,
      tasks_failed: 2,
      parent_session_id: null,
      metadata: null,
    },
    {
      id: 'session-002-def456',
      agent_id: 'build-agent-02',
      task_id: 'task-044',
      run_id: null,
      wave_number: 1,
      lane_id: 'ui',
      status: 'completed',
      started_at: new Date(now.getTime() - 7200000).toISOString(),
      completed_at: new Date(now.getTime() - 5400000).toISOString(),
      current_iteration: 2,
      total_iterations: 2,
      tasks_completed: 8,
      tasks_failed: 0,
      parent_session_id: null,
      metadata: null,
    },
    {
      id: 'session-003-ghi789',
      agent_id: 'test-agent-01',
      task_id: 'task-045',
      run_id: null,
      wave_number: 2,
      lane_id: 'tests',
      status: 'completed',
      started_at: new Date(now.getTime() - 6000000).toISOString(),
      completed_at: new Date(now.getTime() - 4800000).toISOString(),
      current_iteration: 1,
      total_iterations: 1,
      tasks_completed: 6,
      tasks_failed: 0,
      parent_session_id: 'session-002-def456',
      metadata: null,
    },
    {
      id: 'session-004-jkl012',
      agent_id: 'build-agent-03',
      task_id: 'task-046',
      run_id: null,
      wave_number: 3,
      lane_id: 'database',
      status: 'failed',
      started_at: new Date(now.getTime() - 10800000).toISOString(),
      completed_at: new Date(now.getTime() - 9000000).toISOString(),
      current_iteration: 3,
      total_iterations: 3,
      tasks_completed: 2,
      tasks_failed: 5,
      parent_session_id: null,
      metadata: null,
    },
    {
      id: 'session-005-mno345',
      agent_id: 'spec-agent-01',
      task_id: 'task-043',
      run_id: null,
      wave_number: 1,
      lane_id: 'types',
      status: 'paused',
      started_at: new Date(now.getTime() - 1800000).toISOString(),
      completed_at: null,
      current_iteration: 2,
      total_iterations: 4,
      tasks_completed: 3,
      tasks_failed: 0,
      parent_session_id: null,
      metadata: null,
    },
  ]
}

export default Sessions
