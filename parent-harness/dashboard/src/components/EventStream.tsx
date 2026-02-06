import { useState } from 'react'

interface Event {
  id: string
  timestamp: string
  type: string
  message: string
  agentId?: string
  severity?: 'debug' | 'info' | 'warning' | 'error'
}

interface EventStreamProps {
  events: Event[]
}

const typeColors: Record<string, string> = {
  'task:assigned': 'text-blue-400',
  'task:completed': 'text-green-400',
  'task:failed': 'text-red-400',
  'agent:started': 'text-purple-400',
  'agent:idle': 'text-gray-400',
  'agent:error': 'text-red-400',
  'tool:started': 'text-yellow-400',
  'tool:completed': 'text-yellow-300',
  'qa:passed': 'text-green-400',
  'qa:failed': 'text-red-400',
  'cron:tick': 'text-gray-500',
}

const typeIcons: Record<string, string> = {
  'task:assigned': '📋',
  'task:completed': '✅',
  'task:failed': '❌',
  'agent:started': '🚀',
  'agent:idle': '💤',
  'agent:error': '🔴',
  'tool:started': '🔧',
  'tool:completed': '🔧',
  'qa:passed': '✅',
  'qa:failed': '❌',
  'cron:tick': '⏰',
}

export function EventStream({ events }: EventStreamProps) {
  const [autoScroll, setAutoScroll] = useState(true)

  return (
    <div data-testid="event-stream" className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{events.length} events</span>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`text-xs px-2 py-1 rounded ${
            autoScroll ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
          }`}
        >
          Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {events.map((event) => (
          <div
            key={event.id}
            data-testid="event-item"
            className="flex items-start gap-2 text-sm py-1 border-b border-gray-700/50"
          >
            <span className="text-gray-500 text-xs whitespace-nowrap">
              {event.timestamp}
            </span>
            <span className="text-base">
              {typeIcons[event.type] || '📌'}
            </span>
            <span className={`font-mono text-xs ${typeColors[event.type] || 'text-gray-400'}`}>
              {event.type}
            </span>
            <span className="text-gray-300 text-xs flex-1">
              {event.message}
            </span>
            {event.agentId && (
              <span className="text-xs text-gray-500">
                [{event.agentId}]
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Mock data for development
export const mockEvents: Event[] = [
  {
    id: '1',
    timestamp: '14:23:45',
    type: 'task:assigned',
    message: 'TASK-042 assigned to Build Agent',
    agentId: 'build_agent',
  },
  {
    id: '2',
    timestamp: '14:23:46',
    type: 'tool:started',
    message: 'read_file → server/routes/api.ts',
    agentId: 'build_agent',
  },
  {
    id: '3',
    timestamp: '14:23:48',
    type: 'tool:completed',
    message: 'read_file completed (2.4KB)',
    agentId: 'build_agent',
  },
  {
    id: '4',
    timestamp: '14:23:50',
    type: 'tool:started',
    message: 'edit_file → server/routes/api.ts',
    agentId: 'build_agent',
  },
  {
    id: '5',
    timestamp: '14:23:55',
    type: 'tool:completed',
    message: 'edit_file (+26 lines)',
    agentId: 'build_agent',
  },
  {
    id: '6',
    timestamp: '14:24:00',
    type: 'task:completed',
    message: 'TASK-042 completed successfully',
    agentId: 'build_agent',
  },
  {
    id: '7',
    timestamp: '14:24:01',
    type: 'qa:passed',
    message: 'TASK-042 validation passed',
    agentId: 'qa_agent',
  },
  {
    id: '8',
    timestamp: '14:25:00',
    type: 'cron:tick',
    message: 'Tick #143: 3 agents working, 4 idle',
  },
]

export default EventStream
