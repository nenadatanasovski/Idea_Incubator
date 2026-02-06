import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { AgentStatusCard, mockAgents } from '../components/AgentStatusCard'
import { EventStream, mockEvents } from '../components/EventStream'
import { TaskCard, mockTasks } from '../components/TaskCard'
import { WaveProgressBar, WaveProgressCompact } from '../components/WaveProgressBar'
import { LaneGrid } from '../components/LaneGrid'
import { TaskDetailModal } from '../components/TaskDetailModal'
import { useAgents } from '../hooks/useAgents'
import { useTasks } from '../hooks/useTasks'
import { useEvents } from '../hooks/useEvents'
import { useWebSocket } from '../hooks/useWebSocket'
import type { Agent, Task, ObservabilityEvent } from '../api/types'
import type { Wave, Lane, LaneTask } from '../types/pipeline'

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

// Generate mock waves and lanes from tasks
function generateWavesFromTasks(tasks: Task[]): Wave[] {
  // Group tasks by wave (using priority as a proxy for wave number)
  const priorityToWave: Record<string, number> = { P0: 1, P1: 2, P2: 3, P3: 4, P4: 5 };
  const waveMap = new Map<number, { total: number; completed: number; running: number; blocked: number }>();
  
  tasks.forEach(task => {
    const waveNum = priorityToWave[task.priority] || 3;
    const existing = waveMap.get(waveNum) || { total: 0, completed: 0, running: 0, blocked: 0 };
    existing.total++;
    if (task.status === 'completed') existing.completed++;
    if (task.status === 'in_progress') existing.running++;
    if (task.status === 'blocked') existing.blocked++;
    waveMap.set(waveNum, existing);
  });

  return Array.from(waveMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([waveNum, stats]) => ({
      id: `wave-${waveNum}`,
      waveNumber: waveNum,
      status: stats.completed === stats.total ? 'complete' as const :
              stats.running > 0 ? 'active' as const : 'pending' as const,
      tasksTotal: stats.total,
      tasksCompleted: stats.completed,
      tasksRunning: stats.running,
      tasksBlocked: stats.blocked,
      actualParallelism: stats.running,
    }));
}

function generateLanesFromTasks(tasks: Task[]): Lane[] {
  // Group tasks by category as lanes
  const categoryToLane: Record<string, string> = {
    feature: 'api',
    bug: 'types',
    documentation: 'ui',
    test: 'tests',
    infrastructure: 'infrastructure',
  };
  
  const laneMap = new Map<string, { name: string; category: string; tasks: Task[] }>();
  
  tasks.forEach(task => {
    const category = categoryToLane[task.category || 'feature'] || 'api';
    const existing = laneMap.get(category) || { 
      name: category.charAt(0).toUpperCase() + category.slice(1), 
      category, 
      tasks: [] 
    };
    existing.tasks.push(task);
    laneMap.set(category, existing);
  });

  const priorityToWave: Record<string, number> = { P0: 1, P1: 2, P2: 3, P3: 4, P4: 5 };

  return Array.from(laneMap.entries()).map(([id, lane]) => ({
    id,
    name: lane.name,
    category: lane.category as Lane['category'],
    status: lane.tasks.every(t => t.status === 'completed') ? 'complete' as const :
            lane.tasks.some(t => t.status === 'blocked') ? 'blocked' as const :
            lane.tasks.some(t => t.status === 'in_progress') ? 'active' as const : 'pending' as const,
    tasksTotal: lane.tasks.length,
    tasksCompleted: lane.tasks.filter(t => t.status === 'completed').length,
    tasks: lane.tasks.map(t => ({
      taskId: t.id,
      displayId: t.display_id,
      title: t.title,
      waveNumber: priorityToWave[t.priority] || 3,
      status: t.status === 'in_progress' ? 'running' as const :
              t.status === 'completed' ? 'complete' as const :
              t.status === 'failed' ? 'failed' as const :
              t.status === 'blocked' ? 'blocked' as const : 'pending' as const,
      agentId: t.assigned_agent_id ?? undefined,
      agentName: t.assigned_agent_id ?? undefined,
    })),
  }));
}

export function Dashboard() {
  const { agents, loading: agentsLoading, error: agentsError, refetch: refetchAgents } = useAgents()
  const { tasks, loading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks()
  const { events, loading: eventsLoading, error: eventsError } = useEvents()
  const { connected, subscribe } = useWebSocket()
  
  const [wsEvents, setWsEvents] = useState<ObservabilityEvent[]>([])
  const [viewMode, setViewMode] = useState<'cards' | 'waves'>('cards')
  const [selectedWave, setSelectedWave] = useState<number | undefined>(undefined)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

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

  // Generate waves and lanes from tasks
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
  const lanes = generateLanesFromTasks(taskData)
  const activeWave = waves.find(w => w.status === 'active')?.waveNumber || 1

  const handleTaskClick = (task: LaneTask) => {
    setSelectedTaskId(task.taskId)
  }

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
          
          {/* Wave Progress Compact in sidebar */}
          {waves.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h3 className="text-xs font-medium text-gray-400 mb-2">Wave Progress</h3>
              <WaveProgressCompact waves={waves} activeWaveNumber={activeWave} />
            </div>
          )}
        </div>
      }
      rightPanel={
        <div className="space-y-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'cards' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              📋 Cards
            </button>
            <button
              onClick={() => setViewMode('waves')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'waves' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              🌊 Waves
            </button>
          </div>

          {tasksError && (
            <div className="text-red-400 text-xs mb-2">
              ⚠️ Using mock data
            </div>
          )}

          {viewMode === 'cards' ? (
            taskCards.map((task) => (
              <div key={task.id} onClick={() => setSelectedTaskId(task.id)} className="cursor-pointer">
                <TaskCard {...task} />
              </div>
            ))
          ) : (
            <div className="space-y-4">
              <WaveProgressBar
                waves={waves}
                activeWaveNumber={activeWave}
                selectedWaveNumber={selectedWave}
                onWaveClick={setSelectedWave}
              />
              <LaneGrid
                lanes={lanes}
                waves={waves}
                activeWaveNumber={activeWave}
                selectedWaveNumber={selectedWave}
                onTaskClick={handleTaskClick}
              />
            </div>
          )}
        </div>
      }
    >
      {eventsError && wsEvents.length === 0 && (
        <div className="text-red-400 text-xs mb-2">
          ⚠️ Using mock data
        </div>
      )}
      <EventStream events={eventItems} />

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
