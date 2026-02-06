// WebSocket Event Types

// Server → Client
export type ServerEvent =
  | { type: 'agent:status'; agentId: string; status: string; taskId?: string }
  | { type: 'task:updated'; task: Task }
  | { type: 'iteration:started'; sessionId: string; iteration: number }
  | { type: 'iteration:completed'; sessionId: string; iteration: number; qaResult: string }
  | { type: 'iteration:log'; sessionId: string; iteration: number; line: string }
  | { type: 'wave:started'; runId: string; waveNumber: number }
  | { type: 'wave:completed'; runId: string; waveNumber: number }
  | { type: 'event:new'; event: ObservabilityEvent };

// Client → Server
export type ClientCommand =
  | { type: 'subscribe'; channels: string[] }
  | { type: 'task:assign'; taskId: string; agentId: string }
  | { type: 'session:terminate'; sessionId: string }
  | { type: 'qa:trigger'; iterationId: string };

// Event types for observability
export const EVENT_TYPES = {
  TASK: ['task:assigned', 'task:started', 'task:completed', 'task:failed', 'task:blocked', 'task:progress'],
  AGENT: ['agent:started', 'agent:idle', 'agent:error', 'agent:heartbeat', 'agent:stuck'],
  TOOL: ['tool:started', 'tool:completed', 'tool:error'],
  FILE: ['file:read', 'file:modified', 'file:created', 'file:deleted'],
  GIT: ['git:commit', 'git:push', 'git:branch', 'git:pr'],
  QA: ['qa:scheduled', 'qa:started', 'qa:passed', 'qa:failed'],
  CRON: ['cron:tick', 'cron:qa_cycle'],
  TELEGRAM: ['telegram:sent', 'telegram:error'],
  WAVE: ['wave:started', 'wave:completed', 'wave:failed'],
} as const;
