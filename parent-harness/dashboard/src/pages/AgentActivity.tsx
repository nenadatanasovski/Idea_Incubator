import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:3333/api'

interface Activity {
  id: string
  agent_id: string
  activity_type: string
  task_id: string | null
  session_id: string | null
  details: string | null
  created_at: string
}

const activityIcons: Record<string, string> = {
  task_assigned: '📋',
  task_started: '▶️',
  task_completed: '✅',
  task_failed: '❌',
  file_read: '📖',
  file_write: '✏️',
  command_executed: '⚡',
  error_occurred: '🚨',
  heartbeat: '💓',
  idle: '😴',
}

const activityColors: Record<string, string> = {
  task_assigned: 'text-blue-400',
  task_started: 'text-blue-400',
  task_completed: 'text-green-400',
  task_failed: 'text-red-400',
  file_read: 'text-gray-400',
  file_write: 'text-yellow-400',
  command_executed: 'text-purple-400',
  error_occurred: 'text-red-500',
  heartbeat: 'text-gray-500',
  idle: 'text-gray-500',
}

export function AgentActivity() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchActivities = () => {
    fetch(`${API_BASE}/agents/activities/recent?limit=100`)
      .then(res => res.json())
      .then(data => {
        setActivities(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchActivities()
    if (autoRefresh) {
      const interval = setInterval(fetchActivities, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const filteredActivities = activities.filter(a => {
    if (filter !== 'all' && a.activity_type !== filter) return false
    if (agentFilter !== 'all' && a.agent_id !== agentFilter) return false
    return true
  })

  const uniqueAgents = [...new Set(activities.map(a => a.agent_id))]
  const uniqueTypes = [...new Set(activities.map(a => a.activity_type))]

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    
    if (diffMs < 60000) return 'just now'
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
  }

  const parseDetails = (details: string | null): Record<string, unknown> => {
    if (!details) return {}
    try {
      return JSON.parse(details)
    } catch {
      return { raw: details }
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Agent Activity</h1>
        
        <div className="flex items-center gap-4">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm"
          >
            <option value="all">All Agents</option>
            {uniqueAgents.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm"
          >
            <option value="all">All Types</option>
            {uniqueTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-gray-700"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading activities...</div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Activity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Task</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredActivities.map((activity) => {
                const details = parseDetails(activity.details)
                return (
                  <tr key={activity.id} className="hover:bg-gray-750">
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                      {formatTime(activity.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-400">
                      {activity.agent_id}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={activityColors[activity.activity_type] || 'text-gray-400'}>
                        {activityIcons[activity.activity_type] || '📌'} {activity.activity_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                      {activity.task_id?.slice(0, 8) || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {String(details.error || details.files || details.command || details.raw || '-')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {filteredActivities.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No activities found
            </div>
          )}
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredActivities.length} of {activities.length} activities
      </div>
    </div>
  )
}

export default AgentActivity
