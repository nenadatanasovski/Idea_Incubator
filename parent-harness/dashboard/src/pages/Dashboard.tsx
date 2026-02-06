import { Layout } from '../components/Layout'
import { AgentStatusCard, mockAgents } from '../components/AgentStatusCard'
import { EventStream, mockEvents } from '../components/EventStream'
import { TaskCard, mockTasks } from '../components/TaskCard'
import { useAgents } from '../hooks/useAgents'
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'
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
  const { agents, loading: agentsLoading, error: agentsError } = useAgents()
  const { tasks, loading: tasksLoading, error: tasksError } = useTasks()
  const { events, loading: eventsLoading, error: eventsError } = useEvents()

  // Use real data if available, fall back to mock data
  const agentCards = agentsLoading || agentsError 
    ? mockAgents 
    : agents.map(mapAgentToCard)
  
  const taskCards = tasksLoading || tasksError 
    ? mockTasks 
    : tasks.map(mapTaskToCard)
  
  const eventItems = eventsLoading || eventsError 
    ? mockEvents 
    : events.map(mapEventToStream)

  return (
    <Layout
      leftPanel={
        <div className="space-y-2">
          {agentsError && (
            <div className="text-red-400 text-xs mb-2">
              ⚠️ Using mock data (API: {agentsError})
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
              ⚠️ Using mock data (API: {tasksError})
            </div>
          )}
          {taskCards.map((task) => (
            <TaskCard key={task.id} {...task} />
          ))}
        </div>
      }
    >
      {eventsError && (
        <div className="text-red-400 text-xs mb-2">
          ⚠️ Using mock data (API: {eventsError})
        </div>
      )}
      <EventStream events={eventItems} />
    </Layout>
  )
}

export default Dashboard
