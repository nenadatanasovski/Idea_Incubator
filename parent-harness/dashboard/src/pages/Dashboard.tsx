import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { AgentStatusCard, mockAgents } from '../components/AgentStatusCard'
import { EventStream, mockEvents } from '../components/EventStream'
import { TaskCard, mockTasks } from '../components/TaskCard'
import { useAgents } from '../hooks/useAgents'
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'
import { useWebSocket } from '../hooks/useWebSocket'
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

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function Dashboard() {
  const { agents, loading: agentsLoading, error: agentsError, refetch: refetchAgents } = useAgents()
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks()
  const { events, loading: eventsLoading, error: eventsError } = useEvents()
  const { connected, subscribe } = useWebSocket()
  
  const [wsEvents, setWsEvents] = useState<ObservabilityEvent[]>([])

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      // Refetch data on relevant events
      if (message.type.startsWith('agent:')) {
        refetchAgents()
      }
      if (message.type.startsWith('task:')) {
        refetchTasks()
      }
      if (message.type === 'event') {
        // Add new event to the list
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

  return (
    <Layout
      leftPanel={
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">
              {connected ? 'Live' : 'Connecting...'}
            </span>
          </div>
          {agentsError && (
            <div className="text-red-400 text-xs mb-2">
              ⚠️ Using mock data
            </div>
          )}
          {agentCards.map((agent) => (
            <AgentStatusCard key={agent.id} {...agent} />
          ))}
        </div>
      }
      rightPanel={
        <div className="space-y-2">
          {tasksError && (
            <div className="text-red-400 text-xs mb-2">
              ⚠️ Using mock data
            </div>
          )}
          {taskCards.map((task) => (
            <TaskCard key={task.id} {...task} />
          ))}
        </div>
      }
    >
      {eventsError && wsEvents.length === 0 && (
        <div className="text-red-400 text-xs mb-2">
          ⚠️ Using mock data
        </div>
      )}
      <EventStream events={eventItems} />
    </Layout>
  )
}

export default Dashboard
