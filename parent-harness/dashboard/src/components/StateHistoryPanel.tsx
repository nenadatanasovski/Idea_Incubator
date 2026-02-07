import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3333/api'

interface StateChange {
  id: string
  task_id: string
  from_status: string | null
  to_status: string
  changed_by: string
  actor_type: 'user' | 'agent' | 'system'
  reason: string | null
  created_at: string
}

interface StateHistoryPanelProps {
  taskId: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  pending_verification: 'bg-purple-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  blocked: 'bg-yellow-500',
}

export function StateHistoryPanel({ taskId }: StateHistoryPanelProps) {
  const [history, setHistory] = useState<StateChange[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/tasks/${taskId}/history`)
      .then(res => res.json())
      .then(data => {
        setHistory(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [taskId])

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading history...</div>
  }

  if (history.length === 0) {
    return <div className="text-gray-500 text-sm">No state history recorded</div>
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDate = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-300 mb-3">State History</h4>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-700" />
        
        {history.map((change) => (
          <div key={change.id} className="relative pl-8 pb-4">
            {/* Timeline dot */}
            <div className={`absolute left-1.5 w-3 h-3 rounded-full ${statusColors[change.to_status] || 'bg-gray-500'}`} />
            
            <div className="bg-gray-800 rounded p-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">{formatDate(change.created_at)}</span>
                <span className="text-gray-500">{formatTime(change.created_at)}</span>
                <span className="text-gray-400">→</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  change.to_status === 'completed' ? 'bg-green-900 text-green-300' :
                  change.to_status === 'failed' ? 'bg-red-900 text-red-300' :
                  change.to_status === 'in_progress' ? 'bg-blue-900 text-blue-300' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {change.to_status}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span className={`${
                  change.actor_type === 'agent' ? 'text-blue-400' :
                  change.actor_type === 'system' ? 'text-purple-400' :
                  'text-gray-400'
                }`}>
                  {change.changed_by}
                </span>
                {change.from_status && (
                  <span className="text-gray-600">from {change.from_status}</span>
                )}
              </div>
              
              {change.reason && (
                <div className="mt-1 text-xs text-gray-400 italic">
                  {change.reason}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default StateHistoryPanel
