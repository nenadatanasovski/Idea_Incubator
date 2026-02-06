interface AgentStatusCardProps {
  id: string
  name: string
  status: 'idle' | 'working' | 'error' | 'stuck'
  currentTask?: string
  lastHeartbeat?: string
  telegramChannel?: string
  runningInstances?: number  // Number of active sessions for this agent type
}

const statusColors = {
  idle: 'bg-gray-500',
  working: 'bg-green-500',
  error: 'bg-red-500',
  stuck: 'bg-yellow-500',
}

const statusLabels = {
  idle: 'Idle',
  working: 'Working',
  error: 'Error',
  stuck: 'Stuck',
}

export function AgentStatusCard({
  id,
  name,
  status,
  currentTask,
  lastHeartbeat,
  telegramChannel,
  runningInstances = 0,
}: AgentStatusCardProps) {
  return (
    <div
      data-testid="agent-card"
      data-agent-id={id}
      className="bg-gray-700 rounded-lg p-3 mb-3"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{name}</span>
          {/* Instance count badge */}
          {runningInstances > 0 && (
            <span 
              className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
              title={`${runningInstances} instance${runningInstances > 1 ? 's' : ''} running`}
            >
              {runningInstances}
            </span>
          )}
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status]} text-white`}
        >
          {statusLabels[status]}
        </span>
      </div>

      {currentTask && (
        <div className="text-xs text-gray-400 mb-1">
          <span className="text-gray-500">Task:</span> {currentTask}
        </div>
      )}

      {lastHeartbeat && (
        <div className="text-xs text-gray-500">
          Last seen: {lastHeartbeat}
        </div>
      )}

      {telegramChannel && (
        <a
          href={`https://t.me/${telegramChannel.replace('@', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
        >
          {telegramChannel}
        </a>
      )}
    </div>
  )
}

// Mock data for development
export const mockAgents: AgentStatusCardProps[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    status: 'working',
    lastHeartbeat: '2s ago',
    telegramChannel: '@vibe-orchestrator',
    runningInstances: 1,
  },
  {
    id: 'planning_agent',
    name: 'Planning Agent',
    status: 'idle',
    lastHeartbeat: '15s ago',
    telegramChannel: '@vibe-planning',
    runningInstances: 0,
  },
  {
    id: 'build_agent',
    name: 'Build Agent',
    status: 'working',
    currentTask: 'TASK-042: Add auth endpoint',
    lastHeartbeat: '1s ago',
    telegramChannel: '@vibe-build',
    runningInstances: 3,  // Multiple build agents can run in parallel
  },
  {
    id: 'spec_agent',
    name: 'Spec Agent',
    status: 'idle',
    lastHeartbeat: '30s ago',
    telegramChannel: '@vibe-spec',
    runningInstances: 0,
  },
  {
    id: 'qa_agent',
    name: 'QA Agent',
    status: 'working',
    currentTask: 'Validating TASK-041',
    lastHeartbeat: '5s ago',
    telegramChannel: '@vibe-qa',
    runningInstances: 2,
  },
  {
    id: 'task_agent',
    name: 'Task Agent',
    status: 'idle',
    lastHeartbeat: '45s ago',
    telegramChannel: '@vibe-task',
    runningInstances: 0,
  },
  {
    id: 'sia_agent',
    name: 'SIA',
    status: 'error',
    lastHeartbeat: '2m ago',
    telegramChannel: '@vibe-sia',
    runningInstances: 0,
  },
]

export default AgentStatusCard
