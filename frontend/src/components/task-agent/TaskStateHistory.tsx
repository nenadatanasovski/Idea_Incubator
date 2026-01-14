/**
 * Task State History Component
 *
 * Displays task state transitions with timeline visualization.
 * Part of: Task System V2 Implementation Plan (IMPL-7.9)
 */

import { useState, useEffect } from 'react'
import {
  History,
  Circle,
  Play,
  CheckCircle,
  XCircle,
  PauseCircle,
  Clock,
  ArrowRight,
  User,
  Bot
} from 'lucide-react'

type TaskStatus = 'draft' | 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'

interface TaskStateHistoryEntry {
  id: string
  taskId: string
  fromStatus?: TaskStatus
  toStatus: TaskStatus
  reason?: string
  triggeredBy: string
  agentId?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

interface TimeInStatus {
  [status: string]: number
}

interface TaskStateHistoryProps {
  taskId: string
}

const statusConfig: Record<TaskStatus, { icon: typeof Circle; color: string; bgColor: string; label: string }> = {
  draft: { icon: Circle, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Draft' },
  pending: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Pending' },
  in_progress: { icon: Play, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'In Progress' },
  completed: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Failed' },
  blocked: { icon: PauseCircle, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Blocked' }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

export default function TaskStateHistory({ taskId }: TaskStateHistoryProps) {
  const [history, setHistory] = useState<TaskStateHistoryEntry[]>([])
  const [timeInStatus, setTimeInStatus] = useState<TimeInStatus>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
  }, [taskId])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const [historyRes, analyticsRes] = await Promise.all([
        fetch(`/api/task-agent/tasks/${taskId}/history`),
        fetch(`/api/task-agent/tasks/${taskId}/history/analytics`)
      ])

      if (historyRes.ok) {
        setHistory(await historyRes.json())
      }
      if (analyticsRes.ok) {
        const analytics = await analyticsRes.json()
        setTimeInStatus(analytics.timeInStatus || {})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg" />
        ))}
      </div>
    )
  }

  // Calculate time spent stats
  const totalTime = Object.values(timeInStatus).reduce((a, b) => a + b, 0)
  const maxTime = Math.max(...Object.values(timeInStatus), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-gray-400" />
        <h3 className="font-medium">State History</h3>
        <span className="text-sm text-gray-500">({history.length} transitions)</span>
      </div>

      {/* Time in Status Breakdown */}
      {totalTime > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Time in Each Status</h4>
          <div className="space-y-2">
            {(Object.entries(statusConfig) as [TaskStatus, typeof statusConfig[TaskStatus]][]).map(([status, config]) => {
              const time = timeInStatus[status] || 0
              const percentage = (time / maxTime) * 100

              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-24 flex items-center gap-1.5">
                    <config.icon className={`h-4 w-4 ${config.color}`} />
                    <span className="text-sm text-gray-600">{config.label}</span>
                  </div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.bgColor} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-20 text-sm text-gray-500 text-right">
                    {formatDuration(time)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-4">
          {history.map((entry, index) => {
            const toConfig = statusConfig[entry.toStatus]
            const ToIcon = toConfig.icon
            const isLatest = index === 0
            const isSystemTriggered = entry.triggeredBy === 'system' || entry.agentId

            return (
              <div key={entry.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className={`
                  absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${toConfig.bgColor} border-white shadow-sm
                `}>
                  <ToIcon className={`h-3 w-3 ${toConfig.color}`} />
                </div>

                <div className={`
                  p-3 rounded-lg border transition-all
                  ${isLatest ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}
                `}>
                  <div className="flex items-center gap-2">
                    {entry.fromStatus && (
                      <>
                        <span className={`
                          px-2 py-0.5 rounded text-xs
                          ${statusConfig[entry.fromStatus].bgColor}
                          ${statusConfig[entry.fromStatus].color}
                        `}>
                          {statusConfig[entry.fromStatus].label}
                        </span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                      </>
                    )}
                    <span className={`
                      px-2 py-0.5 rounded text-xs font-medium
                      ${toConfig.bgColor} ${toConfig.color}
                    `}>
                      {toConfig.label}
                    </span>
                    {isLatest && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                        Current
                      </span>
                    )}
                  </div>

                  {entry.reason && (
                    <p className="mt-2 text-sm text-gray-600">{entry.reason}</p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    <span className="flex items-center gap-1">
                      {isSystemTriggered ? (
                        <Bot className="h-3 w-3" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                      {entry.agentId ? `Agent ${entry.agentId.slice(0, 6)}` : entry.triggeredBy}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {history.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No state transitions recorded</p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
