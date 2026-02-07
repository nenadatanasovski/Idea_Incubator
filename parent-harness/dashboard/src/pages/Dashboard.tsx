import { useEffect, useState } from 'react'
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
      {/* Dashboard owns its 3-column layout */}
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-5rem)]">
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

export default Dashboard
