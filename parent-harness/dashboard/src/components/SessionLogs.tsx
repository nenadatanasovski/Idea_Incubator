import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3333/api'

interface LogEvent {
  id: number
  type: string
  message: string
  severity: 'debug' | 'info' | 'warning' | 'error'
  agent_id: string
  task_id: string | null
  created_at: string
}

interface SessionLogsProps {
  taskId: string
  taskTitle: string
  isOpen: boolean
  onClose: () => void
}

const severityColors: Record<string, string> = {
  debug: 'text-gray-500',
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
}

const severityIcons: Record<string, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
}

export function SessionLogs({ taskId, taskTitle, isOpen, onClose }: SessionLogsProps) {
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/events?taskId=${taskId}&limit=100`)
      if (!res.ok) throw new Error('Failed to fetch logs')
      const data = await res.json()
      setLogs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchLogs()
    }
  }, [isOpen, taskId])

  // Auto-refresh every 5 seconds when enabled
  useEffect(() => {
    if (!isOpen || !autoRefresh) return
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [isOpen, autoRefresh, taskId])

  if (!isOpen) return null

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
    })
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Session Logs</h2>
            <p className="text-sm text-gray-400 truncate max-w-lg">{taskTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-gray-700 border-gray-600"
              />
              Auto-refresh
            </label>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm disabled:opacity-50"
            >
              {loading ? '...' : '🔄 Refresh'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl px-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded p-3 mb-4 text-red-400">
              {error}
            </div>
          )}

          {loading && logs.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              Loading logs...
            </div>
          )}

          {!loading && logs.length === 0 && !error && (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">📭</div>
              <p>No logs found for this task</p>
              <p className="text-sm mt-1">Events will appear here as the task is processed</p>
            </div>
          )}

          {logs.length > 0 && (
            <div className="space-y-2 font-mono text-sm">
              {logs.map((log) => (
                <div 
                  key={log.id}
                  className="flex items-start gap-3 py-2 px-3 bg-gray-900/50 rounded hover:bg-gray-900"
                >
                  <span className="text-gray-500 whitespace-nowrap">
                    {formatDate(log.created_at)} {formatTime(log.created_at)}
                  </span>
                  <span className="whitespace-nowrap">
                    {severityIcons[log.severity] || '📋'}
                  </span>
                  <span className="text-gray-500 whitespace-nowrap text-xs bg-gray-800 px-1.5 py-0.5 rounded">
                    {log.type}
                  </span>
                  <span className={`flex-1 ${severityColors[log.severity] || 'text-gray-300'}`}>
                    {log.message}
                  </span>
                  {log.agent_id && log.agent_id !== 'system' && (
                    <span className="text-xs text-blue-400 whitespace-nowrap">
                      {log.agent_id}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-4 py-2 text-xs text-gray-500">
          {logs.length > 0 
            ? `${logs.length} event${logs.length !== 1 ? 's' : ''} • Task ID: ${taskId}`
            : `Task ID: ${taskId}`
          }
        </div>
      </div>
    </div>
  )
}

export default SessionLogs
