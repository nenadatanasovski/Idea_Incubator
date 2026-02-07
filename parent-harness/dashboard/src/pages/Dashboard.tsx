import { useEffect, useState, useCallback } from 'react'
import { Layout } from '../components/Layout'
import { AgentStatusCard, mockAgents } from '../components/AgentStatusCard'
import { EventStream, mockEvents } from '../components/EventStream'
import { TaskCard, mockTasks } from '../components/TaskCard'
import { WaveProgressCompact } from '../components/WaveProgressBar'
import { TaskDetailModal } from '../components/TaskDetailModal'
import { useAgents } from '../hooks/useAgents'
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'
import { useWebSocket } from '../hooks/useWebSocket'
import { formatRelativeTime, formatTime } from '../utils/format'
import { generateWavesFromTasks } from '../utils/task-pipeline'
import type { Agent, Task, ObservabilityEvent } from '../api/types'

const API_BASE = 'http://localhost:3333/api'

interface BuildHealth {
  status: 'healthy' | 'degraded' | 'failing'
  errorCount: number
  topErrors: { error: string; count: number }[]
}

interface StabilityHealth {
  status: 'stable' | 'unstable' | 'critical'
  crashCount: number
  uptime: number
  memory: { used: number; total: number }
}

interface AlertData {
  rules: { id: string; name: string; enabled: boolean }[]
  recentAlerts: { id: string; rule: string; message: string; severity: 'info' | 'warning' | 'critical'; timestamp: string }[]
}

interface CircuitBreakerStatus {
  [agentType: string]: { state: 'closed' | 'open' | 'half-open'; failures: number; lastFailure?: string }
}

function mapAgentToCard(agent: Agent) {
  return {
    id: agent.id,
    name: agent.name,
    status: agent.status as 'idle' | 'working' | 'error' | 'stuck',
    currentTask: agent.current_task_id ? `Task: ${agent.current_task_id}` : undefined,
    lastHeartbeat: agent.last_heartbeat
      ? formatRelativeTime(agent.last_heartbeat)
      : undefined,
    telegramChannel: agent.telegram_channel ?? undefined,
    runningInstances: (agent as Agent & { running_instances?: number }).running_instances ?? 0,
  }
}

function mapTaskToCard(task: Task) {
  return {
    id: task.id,
    displayId: task.display_id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assignedAgent: task.assigned_agent_id ?? undefined,
    category: task.category ?? undefined,
  }
}

function mapEventToStream(event: ObservabilityEvent) {
  return {
    id: event.id,
    timestamp: formatTime(event.created_at),
    type: event.type,
    message: event.message,
    agentId: event.agent_id ?? undefined,
    severity: event.severity,
  }
}

export function Dashboard() {
  const { agents, loading: agentsLoading, error: agentsError, refetch: refetchAgents } = useAgents()
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks()
  const { events, loading: eventsLoading, error: eventsError } = useEvents()
  const { connected, subscribe } = useWebSocket()

  const [wsEvents, setWsEvents] = useState<ObservabilityEvent[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  
  // System health state
  const [buildHealth, setBuildHealth] = useState<BuildHealth | null>(null)
  const [stabilityHealth, setStabilityHealth] = useState<StabilityHealth | null>(null)
  const [alerts, setAlerts] = useState<AlertData | null>(null)
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerStatus | null>(null)

  // Fetch system health data
  const fetchHealthData = useCallback(async () => {
    try {
      const [buildRes, stabilityRes, alertsRes, circuitRes] = await Promise.all([
        fetch(`${API_BASE}/build-health`).catch(() => null),
        fetch(`${API_BASE}/stability/health`).catch(() => null),
        fetch(`${API_BASE}/alerts`).catch(() => null),
        fetch(`${API_BASE}/circuit-breakers`).catch(() => null),
      ])
      
      if (buildRes?.ok) setBuildHealth(await buildRes.json())
      if (stabilityRes?.ok) setStabilityHealth(await stabilityRes.json())
      if (alertsRes?.ok) setAlerts(await alertsRes.json())
      if (circuitRes?.ok) setCircuitBreakers(await circuitRes.json())
    } catch (err) {
      console.error('Failed to fetch health data:', err)
    }
  }, [])

  useEffect(() => {
    fetchHealthData()
    const interval = setInterval(fetchHealthData, 30000)
    return () => clearInterval(interval)
  }, [fetchHealthData])

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message.type.startsWith('agent:')) {
        refetchAgents()
      }
      if (message.type.startsWith('task:')) {
        refetchTasks()
      }
      if (message.type === 'event') {
        const event = message.payload as ObservabilityEvent
        setWsEvents(prev => [event, ...prev].slice(0, 50))
      }
    })

    return unsubscribe
  }, [subscribe, refetchAgents, refetchTasks])

  // Use real data if available, fall back to mock data
  const agentCards = agentsLoading || agentsError
    ? mockAgents
    : agents.map(mapAgentToCard)

  const taskCards = tasksLoading || tasksError
    ? mockTasks
    : tasks.map(mapTaskToCard)

  // Combine API events with WebSocket events
  const allEvents = [...wsEvents, ...(eventsLoading || eventsError ? [] : events)]
  const eventItems = allEvents.length > 0
    ? allEvents.map(mapEventToStream)
    : mockEvents

  // Generate waves for compact progress display
  const taskData = tasksLoading || tasksError ? mockTasks.map(t => ({
    ...t,
    id: t.id,
    display_id: t.displayId,
    description: null,
    task_list_id: 'default',
    parent_task_id: null,
    pass_criteria: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assigned_agent_id: t.assignedAgent ?? null,
  } as Task)) : tasks

  const waves = generateWavesFromTasks(taskData)
  const activeWave = waves.find(w => w.status === 'active')?.waveNumber || 1

  return (
    <Layout>
      {/* System Health Panel */}
      <SystemHealthPanel
        buildHealth={buildHealth}
        stabilityHealth={stabilityHealth}
        alerts={alerts}
        circuitBreakers={circuitBreakers}
      />
      
      {/* Dashboard owns its 3-column layout */}
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-10rem)]">
        {/* Left sidebar - Agent Status */}
        <aside className="col-span-2 bg-gray-800 rounded-lg p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Agent Status
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {connected ? 'Live' : 'Connecting...'}
              </span>
            </div>
            {agentsError && (
              <div className="text-red-400 text-xs mb-2">
                Using mock data
              </div>
            )}
            {agentCards.map((agent) => (
              <AgentStatusCard key={agent.id} {...agent} />
            ))}

            {/* Wave Progress Compact */}
            {waves.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="text-xs font-medium text-gray-400 mb-2">Wave Progress</h3>
                <WaveProgressCompact waves={waves} activeWaveNumber={activeWave} />
              </div>
            )}
          </div>
        </aside>

        {/* Center - Event Stream */}
        <div className="col-span-7 bg-gray-800 rounded-lg p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Event Stream
          </h2>
          {eventsError && wsEvents.length === 0 && (
            <div className="text-red-400 text-xs mb-2">
              Using mock data
            </div>
          )}
          <EventStream events={eventItems} />
        </div>

        {/* Right sidebar - Task Queue */}
        <aside className="col-span-3 bg-gray-800 rounded-lg p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Task Queue
          </h2>
          <div className="space-y-2">
            {tasksError && (
              <div className="text-red-400 text-xs mb-2">
                Using mock data
              </div>
            )}
            {taskCards.map((task) => (
              <div key={task.id} onClick={() => setSelectedTaskId(task.id)} className="cursor-pointer">
                <TaskCard {...task} />
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onNavigateToTask={(id) => setSelectedTaskId(id)}
        />
      )}
    </Layout>
  )
}

// System Health Panel Component
function SystemHealthPanel({
  buildHealth,
  stabilityHealth,
  alerts,
  circuitBreakers,
}: {
  buildHealth: BuildHealth | null
  stabilityHealth: StabilityHealth | null
  alerts: AlertData | null
  circuitBreakers: CircuitBreakerStatus | null
}) {
  const [expanded, setExpanded] = useState(true)

  const statusColors = {
    healthy: 'bg-green-500',
    stable: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unstable: 'bg-yellow-500',
    failing: 'bg-red-500',
    critical: 'bg-red-500',
  }

  const circuitStateColors = {
    closed: 'bg-green-500',
    open: 'bg-red-500',
    'half-open': 'bg-yellow-500',
  }

  const hasCriticalAlerts = alerts?.recentAlerts.some(a => a.severity === 'critical')
  const hasOpenCircuits = circuitBreakers && Object.values(circuitBreakers).some(cb => cb.state === 'open')

  return (
    <div className="mb-4">
      {/* Header with collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors ${
          (hasCriticalAlerts || hasOpenCircuits) ? 'border border-red-500/50' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">📊</span>
          <span className="font-semibold">System Health</span>
          {buildHealth && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              buildHealth.status === 'healthy' ? 'bg-green-900/50 text-green-300' :
              buildHealth.status === 'degraded' ? 'bg-yellow-900/50 text-yellow-300' :
              'bg-red-900/50 text-red-300'
            }`}>
              Build: {buildHealth.status}
            </span>
          )}
          {hasOpenCircuits && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-300 animate-pulse">
              ⚡ Circuit(s) Open
            </span>
          )}
          {hasCriticalAlerts && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-300 animate-pulse">
              🚨 Critical Alerts
            </span>
          )}
        </div>
        <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="grid grid-cols-4 gap-4 mt-4">
          {/* Build Health Card */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">🔨 Build Health</h3>
              {buildHealth && (
                <span className={`w-3 h-3 rounded-full ${statusColors[buildHealth.status]}`} />
              )}
            </div>
            {buildHealth ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-medium capitalize ${
                    buildHealth.status === 'healthy' ? 'text-green-400' :
                    buildHealth.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                  }`}>{buildHealth.status}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Errors:</span>
                  <span className="text-white font-mono">{buildHealth.errorCount}</span>
                </div>
                {buildHealth.topErrors.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-500 mb-1">Top Errors:</div>
                    {buildHealth.topErrors.slice(0, 3).map((err, i) => (
                      <div key={i} className="text-xs text-red-400 truncate">
                        {err.count}× {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">Loading...</div>
            )}
          </div>

          {/* Stability Health Card */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">⚡ Stability</h3>
              {stabilityHealth && (
                <span className={`w-3 h-3 rounded-full ${statusColors[stabilityHealth.status]}`} />
              )}
            </div>
            {stabilityHealth ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-medium capitalize ${
                    stabilityHealth.status === 'stable' ? 'text-green-400' :
                    stabilityHealth.status === 'unstable' ? 'text-yellow-400' : 'text-red-400'
                  }`}>{stabilityHealth.status}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Crashes:</span>
                  <span className="text-white font-mono">{stabilityHealth.crashCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Uptime:</span>
                  <span className="text-white font-mono">{formatUptime(stabilityHealth.uptime)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Memory:</span>
                  <span className="text-white font-mono">
                    {Math.round(stabilityHealth.memory.used / 1024 / 1024)}MB
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">Loading...</div>
            )}
          </div>

          {/* Circuit Breakers Card */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">🔴 Circuit Breakers</h3>
            {circuitBreakers && Object.keys(circuitBreakers).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(circuitBreakers).map(([type, status]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 capitalize">{type}</span>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${circuitStateColors[status.state]}`} />
                      <span className={`text-xs font-medium ${
                        status.state === 'closed' ? 'text-green-400' :
                        status.state === 'open' ? 'text-red-400' : 'text-yellow-400'
                      }`}>{status.state}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No circuit breakers active</div>
            )}
          </div>

          {/* Recent Alerts Card */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">🚨 Recent Alerts</h3>
            {alerts && alerts.recentAlerts.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {alerts.recentAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className={`text-xs p-2 rounded ${
                    alert.severity === 'critical' ? 'bg-red-900/30 text-red-300' :
                    alert.severity === 'warning' ? 'bg-yellow-900/30 text-yellow-300' :
                    'bg-blue-900/30 text-blue-300'
                  }`}>
                    <div className="flex items-center gap-1 mb-1">
                      <span>{alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}</span>
                      <span className="font-medium">{alert.rule}</span>
                    </div>
                    <div className="truncate">{alert.message}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No recent alerts</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export default Dashboard
