import { useState, useEffect, useCallback, useRef } from 'react'
import { Layout } from '../components/Layout'

interface EventRecord {
  id: number
  timestamp: string
  type: string
  data: unknown
  taskId?: string
  agentId?: string
  sessionId?: string
  summary: string
}

interface EventStats {
  total: number
  byType: Record<string, number>
  eventRate: number
}

interface SystemStatus {
  initialized: boolean
  qaService: { queueSize: number; processing: boolean; enabled: boolean }
  spawnService: { queueSize: number; processing: boolean; enabled: boolean; canSpawn: boolean }
  resourceMonitor: { cpuUsage: number; memoryUsage: number; cpuStatus: string; memoryStatus: string }
  recentEventsCount: number
}

const API_BASE = 'http://localhost:3333/api'
const WS_URL = 'ws://localhost:3333/ws'

const typeColors: Record<string, string> = {
  'task': 'text-blue-400',
  'agent': 'text-green-400',
  'session': 'text-purple-400',
  'system': 'text-yellow-400',
  'budget': 'text-orange-400',
  'schedule': 'text-cyan-400',
}

const typeEmojis: Record<string, string> = {
  'task:pending': '📋',
  'task:started': '▶️',
  'task:completed': '✅',
  'task:failed': '❌',
  'task:blocked': '🚫',
  'task:ready_for_qa': '🔍',
  'task:qa_passed': '✅',
  'task:qa_failed': '❌',
  'task:assigned': '📌',
  'agent:idle': '😴',
  'agent:working': '⚡',
  'agent:stuck': '🔴',
  'agent:heartbeat': '💓',
  'session:started': '🚀',
  'session:completed': '🏁',
  'session:failed': '💥',
  'system:startup': '🟢',
  'system:shutdown': '🔴',
  'system:cpu_high': '🔥',
  'system:cpu_normal': '❄️',
  'system:memory_high': '📈',
  'system:memory_normal': '📉',
  'budget:warning': '⚠️',
  'budget:exceeded': '🛑',
  'schedule:planning_due': '🧠',
  'schedule:cleanup_due': '🧹',
}

export function EventBus() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [stats, setStats] = useState<EventStats | null>(null)
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [filter, setFilter] = useState({ type: '', taskId: '', agentId: '' })
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const tableRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const lastEventIdRef = useRef(0)

  // Fetch initial events and stats
  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, statsRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/event-bus/events?limit=200`),
        fetch(`${API_BASE}/event-bus/stats`),
        fetch(`${API_BASE}/event-bus/status`),
      ])

      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setEvents(data.events)
        if (data.events.length > 0) {
          lastEventIdRef.current = data.events[0].id
        }
      }
      if (statsRes.ok) setStats(await statsRes.json())
      if (statusRes.ok) setStatus(await statusRes.json())
    } catch (err) {
      console.error('Failed to fetch event bus data:', err)
    }
  }, [])

  // WebSocket for real-time updates
  useEffect(() => {
    fetchData()

    // Connect to WebSocket
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('EventBus WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'event:bus' && !paused) {
          const newEvent = msg.payload as EventRecord
          setEvents(prev => {
            // Add to front, keep max 500
            const updated = [newEvent, ...prev].slice(0, 500)
            return updated
          })
          lastEventIdRef.current = newEvent.id
        }
      } catch (err) {
        // Ignore parse errors
      }
    }

    ws.onclose = () => {
      console.log('EventBus WebSocket disconnected')
    }

    // Polling fallback (every 2 seconds when paused or WS disconnected)
    const interval = setInterval(async () => {
      if (paused) return
      if (ws.readyState !== WebSocket.OPEN) {
        // Fallback to polling
        try {
          const res = await fetch(`${API_BASE}/event-bus/events?since=${lastEventIdRef.current}&limit=50`)
          if (res.ok) {
            const data = await res.json()
            if (data.events.length > 0) {
              setEvents(prev => {
                const newEvents = data.events.filter((e: EventRecord) => 
                  !prev.some(p => p.id === e.id)
                )
                return [...newEvents, ...prev].slice(0, 500)
              })
              lastEventIdRef.current = data.events[0].id
            }
          }
        } catch {
          // Ignore errors
        }
      }
    }, 2000)

    // Stats refresh every 5 seconds
    const statsInterval = setInterval(async () => {
      try {
        const [statsRes, statusRes] = await Promise.all([
          fetch(`${API_BASE}/event-bus/stats`),
          fetch(`${API_BASE}/event-bus/status`),
        ])
        if (statsRes.ok) setStats(await statsRes.json())
        if (statusRes.ok) setStatus(await statusRes.json())
      } catch {
        // Ignore
      }
    }, 5000)

    return () => {
      ws.close()
      clearInterval(interval)
      clearInterval(statsInterval)
    }
  }, [fetchData, paused])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && tableRef.current) {
      tableRef.current.scrollTop = 0
    }
  }, [events, autoScroll])

  // Filter events
  const filteredEvents = events.filter(e => {
    if (filter.type && !e.type.includes(filter.type)) return false
    if (filter.taskId && e.taskId !== filter.taskId) return false
    if (filter.agentId && e.agentId !== filter.agentId) return false
    return true
  })

  const formatTime = (timestamp: string) => {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('en-AU', { hour12: false })
  }

  const getTypeColor = (type: string) => {
    const category = type.split(':')[0]
    return typeColors[category] || 'text-gray-400'
  }

  return (
    <Layout>
      <div className="p-4 h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">📡 Event Bus</h1>
            <p className="text-gray-400 text-sm">Real-time event observability</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Stats */}
            {stats && (
              <div className="flex gap-4 text-sm">
                <div className="px-3 py-1 bg-gray-800 rounded">
                  <span className="text-gray-400">Events:</span>{' '}
                  <span className="font-bold">{stats.total}</span>
                </div>
                <div className="px-3 py-1 bg-gray-800 rounded">
                  <span className="text-gray-400">Rate:</span>{' '}
                  <span className="font-bold">{stats.eventRate}/s</span>
                </div>
              </div>
            )}

            {/* Controls */}
            <button
              onClick={() => setPaused(!paused)}
              className={`px-3 py-1.5 rounded font-medium ${
                paused ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'
              }`}
            >
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1.5 rounded ${
                autoScroll ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              {autoScroll ? '📌 Auto-scroll ON' : '📌 Auto-scroll OFF'}
            </button>
          </div>
        </div>

        {/* System Status */}
        {status && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            <StatusCard
              title="CPU"
              value={`${status.resourceMonitor.cpuUsage}%`}
              status={status.resourceMonitor.cpuStatus}
            />
            <StatusCard
              title="Memory"
              value={`${status.resourceMonitor.memoryUsage}%`}
              status={status.resourceMonitor.memoryStatus}
            />
            <StatusCard
              title="Spawn Queue"
              value={status.spawnService.queueSize}
              status={status.spawnService.canSpawn ? 'normal' : 'high'}
            />
            <StatusCard
              title="QA Queue"
              value={status.qaService.queueSize}
              status={status.qaService.enabled ? 'normal' : 'high'}
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <select
            value={filter.type}
            onChange={(e) => setFilter(f => ({ ...f, type: e.target.value }))}
            className="bg-gray-800 rounded px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="task">📋 Task</option>
            <option value="agent">🤖 Agent</option>
            <option value="session">💬 Session</option>
            <option value="system">⚙️ System</option>
            <option value="budget">💰 Budget</option>
            <option value="schedule">⏰ Schedule</option>
          </select>
          <input
            type="text"
            placeholder="Filter by Task ID..."
            value={filter.taskId}
            onChange={(e) => setFilter(f => ({ ...f, taskId: e.target.value }))}
            className="bg-gray-800 rounded px-3 py-2 text-sm w-48"
          />
          <input
            type="text"
            placeholder="Filter by Agent..."
            value={filter.agentId}
            onChange={(e) => setFilter(f => ({ ...f, agentId: e.target.value }))}
            className="bg-gray-800 rounded px-3 py-2 text-sm w-48"
          />
          {(filter.type || filter.taskId || filter.agentId) && (
            <button
              onClick={() => setFilter({ type: '', taskId: '', agentId: '' })}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✕ Clear
            </button>
          )}
          <div className="flex-1" />
          <span className="text-gray-500 text-sm self-center">
            Showing {filteredEvents.length} events
          </span>
        </div>

        {/* Event Table */}
        <div 
          ref={tableRef}
          className="flex-1 overflow-auto bg-gray-900 rounded-lg"
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800">
              <tr>
                <th className="text-left p-2 w-24">Time</th>
                <th className="text-left p-2 w-40">Type</th>
                <th className="text-left p-2 w-32">Task</th>
                <th className="text-left p-2 w-32">Agent</th>
                <th className="text-left p-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr 
                  key={event.id}
                  className="border-t border-gray-800 hover:bg-gray-800/50"
                >
                  <td className="p-2 text-gray-500 font-mono text-xs">
                    {formatTime(event.timestamp)}
                  </td>
                  <td className={`p-2 font-mono text-xs ${getTypeColor(event.type)}`}>
                    <span className="mr-1">{typeEmojis[event.type] || '📦'}</span>
                    {event.type.split(':')[1]}
                  </td>
                  <td className="p-2 font-mono text-xs text-blue-400">
                    {event.taskId || '-'}
                  </td>
                  <td className="p-2 font-mono text-xs text-green-400">
                    {event.agentId || '-'}
                  </td>
                  <td className="p-2 text-gray-300 truncate max-w-md">
                    {event.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredEvents.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No events to display
            </div>
          )}
        </div>

        {/* Event Type Legend */}
        {stats && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(stats.byType)
              .filter(([key]) => !key.includes(':'))
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <span
                  key={type}
                  className={`px-2 py-1 bg-gray-800 rounded text-xs ${typeColors[type] || 'text-gray-400'}`}
                >
                  {type}: {count}
                </span>
              ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

function StatusCard({ title, value, status }: { title: string; value: string | number; status: string }) {
  const statusColors = {
    normal: 'border-green-500 bg-green-900/20',
    high: 'border-red-500 bg-red-900/20',
  }
  
  return (
    <div className={`p-3 rounded-lg border ${statusColors[status as keyof typeof statusColors] || statusColors.normal}`}>
      <div className="text-xs text-gray-400">{title}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className={`text-xs ${status === 'high' ? 'text-red-400' : 'text-green-400'}`}>
        {status}
      </div>
    </div>
  )
}

export default EventBus
