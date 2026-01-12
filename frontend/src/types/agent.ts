// Agent Dashboard Types

export type AgentStatus = 'idle' | 'running' | 'error' | 'waiting';

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  avgDuration: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  lastHeartbeat: string;
  currentTask?: string;
  currentTaskListName?: string;
  currentProjectName?: string;
  metrics: AgentMetrics;
}

export type AgentQuestionType = 'APPROVAL' | 'CLARIFICATION' | 'ESCALATION' | 'ALERT';
export type AgentQuestionPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentQuestion {
  id: string;
  agentId: string;
  agentName: string;
  type: AgentQuestionType;
  priority: AgentQuestionPriority;
  content: string;
  options?: string[];
  createdAt: string;
  expiresAt?: string;
  blocking: boolean;
  taskListName?: string;
  projectName?: string;
  taskId?: string;
}

export type ActivityEventType =
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'question_asked'
  | 'question_answered';

export interface ActivityEvent {
  id: string;
  agentId: string;
  agentName: string;
  type: ActivityEventType;
  description: string;
  timestamp: string;
  taskListName?: string;
  projectName?: string;
  taskId?: string;
}

// Status configuration for consistent styling
export const agentStatusConfig: Record<
  AgentStatus,
  { color: string; bg: string; label: string }
> = {
  idle: { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Idle' },
  running: { color: 'text-green-600', bg: 'bg-green-100', label: 'Running' },
  error: { color: 'text-red-600', bg: 'bg-red-100', label: 'Error' },
  waiting: { color: 'text-amber-600', bg: 'bg-amber-100', label: 'Waiting' },
};

// Priority colors for questions
export const priorityColors: Record<AgentQuestionPriority, string> = {
  low: 'border-l-gray-300',
  medium: 'border-l-blue-400',
  high: 'border-l-amber-400',
  critical: 'border-l-red-500',
};

export const priorityBadgeColors: Record<AgentQuestionPriority, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

// Activity event configuration for consistent styling
export const activityEventConfig: Record<
  ActivityEventType,
  { color: string; bg: string }
> = {
  task_started: { color: 'text-blue-500', bg: 'bg-blue-100' },
  task_completed: { color: 'text-green-500', bg: 'bg-green-100' },
  task_failed: { color: 'text-red-500', bg: 'bg-red-100' },
  question_asked: { color: 'text-amber-500', bg: 'bg-amber-100' },
  question_answered: { color: 'text-purple-500', bg: 'bg-purple-100' },
};
