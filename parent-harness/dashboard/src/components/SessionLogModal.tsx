import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3333/api'

interface SessionDetails {
  id: string
  agent_id: string
  task_id: string | null
  status: string
  started_at: string
  completed_at: string | null
  output: string | null
  metadata: string | null
}

interface SessionLogModalProps {
  sessionId: string
  onClose: () => void
}

export function SessionLogModal({ sessionId, onClose }: SessionLogModalProps) {
  const [session, setSession] = useState<SessionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`${API_BASE}/sessions/${sessionId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setSession(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session')
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [sessionId])

  const formatTime = (ts: string | null) => {
    if (!ts) return '-'
    return new Date(ts).toLocaleString('en-AU', { 
      dateStyle: 'short', 
      timeStyle: 'medium' 
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold">Session Log</h2>
            <span className="text-gray-400 text-sm font-mono">{sessionId.slice(0, 8)}...</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500 rounded p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {session && (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Agent:</span>{' '}
                  <span className="text-white">{session.agent_id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Task:</span>{' '}
                  <span className="text-blue-400">{session.task_id || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className={
                    session.status === 'completed' ? 'text-green-400' :
                    session.status === 'failed' ? 'text-red-400' :
                    session.status === 'running' ? 'text-blue-400' :
                    'text-gray-400'
                  }>{session.status}</span>
                </div>
                <div>
                  <span className="text-gray-500">Started:</span>{' '}
                  <span className="text-white">{formatTime(session.started_at)}</span>
                </div>
                {session.completed_at && (
                  <div>
                    <span className="text-gray-500">Completed:</span>{' '}
                    <span className="text-white">{formatTime(session.completed_at)}</span>
                  </div>
                )}
              </div>

              {/* Output */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Output</h3>
                {session.output ? (
                  <pre className="bg-gray-900 rounded p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                    {session.output}
                  </pre>
                ) : (
                  <p className="text-gray-500 italic">No output captured</p>
                )}
              </div>

              {/* Metadata JSON */}
              {session.metadata && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Metadata</h3>
                  <pre className="bg-gray-900 rounded p-4 text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(JSON.parse(session.metadata), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionLogModal
