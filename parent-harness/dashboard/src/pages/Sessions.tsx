import { Layout } from '../components/Layout'
import { useSessions } from '../hooks/useSessions'
import type { Session } from '../hooks/useSessions'

const statusColors: Record<string, string> = {
  starting: 'bg-yellow-500',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  paused: 'bg-gray-500',
}

const statusLabels: Record<string, string> = {
  starting: '🔄 Starting',
  running: '▶️ Running',
  completed: '✅ Completed',
  failed: '❌ Failed',
  paused: '⏸️ Paused',
}

function SessionCard({ session }: { session: Session }) {
  const statusColor = statusColors[session.status] || 'bg-gray-500'
  const statusLabel = statusLabels[session.status] || session.status
  
  const startedAt = new Date(session.started_at).toLocaleString()
  const completedAt = session.completed_at 
    ? new Date(session.completed_at).toLocaleString()
    : null

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-white font-semibold">{session.agent_id}</h3>
          <p className="text-gray-400 text-sm">Session: {session.id.slice(0, 8)}...</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs text-white ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-500">Started:</span>
          <span className="text-gray-300 ml-2">{startedAt}</span>
        </div>
        {completedAt && (
          <div>
            <span className="text-gray-500">Completed:</span>
            <span className="text-gray-300 ml-2">{completedAt}</span>
          </div>
        )}
        <div>
          <span className="text-gray-500">Iteration:</span>
          <span className="text-gray-300 ml-2">
            {session.current_iteration}
            {session.total_iterations > 0 && ` / ${session.total_iterations}`}
          </span>
        </div>
        {session.task_id && (
          <div>
            <span className="text-gray-500">Task:</span>
            <span className="text-gray-300 ml-2">{session.task_id.slice(0, 8)}...</span>
          </div>
        )}
      </div>
      
      {(session.tasks_completed > 0 || session.tasks_failed > 0) && (
        <div className="mt-3 pt-3 border-t border-gray-700 flex gap-4">
          <span className="text-green-400 text-sm">
            ✓ {session.tasks_completed} completed
          </span>
          {session.tasks_failed > 0 && (
            <span className="text-red-400 text-sm">
              ✗ {session.tasks_failed} failed
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function Sessions() {
  const { sessions, loading, error } = useSessions()

  const runningSessions = sessions.filter(s => s.status === 'running')
  const completedSessions = sessions.filter(s => s.status === 'completed')
  const failedSessions = sessions.filter(s => s.status === 'failed')
  const otherSessions = sessions.filter(s => 
    !['running', 'completed', 'failed'].includes(s.status)
  )

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Sessions</h1>
          <p className="text-gray-400">View agent session history and iterations</p>
        </div>

        {loading && sessions.length === 0 && (
          <div className="bg-gray-700 rounded-lg p-6 text-center">
            <p className="text-gray-400">Loading sessions...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="bg-gray-700 rounded-lg p-6 text-center">
            <p className="text-gray-400">No sessions found. Sessions will appear here when agents start working.</p>
          </div>
        )}

        {/* Running Sessions */}
        {runningSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
              Running ({runningSessions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {runningSessions.map(session => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Other Active Sessions */}
        {otherSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">
              Other ({otherSessions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherSessions.map(session => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Completed Sessions */}
        {completedSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">
              Completed ({completedSessions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedSessions.map(session => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        {/* Failed Sessions */}
        {failedSessions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">
              Failed ({failedSessions.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {failedSessions.map(session => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )}

        <div className="text-gray-500 text-sm">
          Total sessions: {sessions.length} • Refreshing every 5s
        </div>
      </div>
    </Layout>
  )
}

export default Sessions
