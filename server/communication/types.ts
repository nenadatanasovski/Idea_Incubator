// server/communication/types.ts
// Shared types for communication module

export type AgentType =
  | 'monitoring'
  | 'orchestrator'
  | 'spec'
  | 'build'
  | 'validation'
  | 'sia'
  | 'system';

export interface TelegramBot {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface RegisteredBot {
  agentType: AgentType;
  token: string;
  botId: number;
  username: string;
  displayName: string;
  healthy: boolean;
  lastChecked: Date;
}

export interface InlineButton {
  text: string;
  callbackData: string;
}

export interface SendOptions {
  agentType: AgentType;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
  buttons?: InlineButton[][];
  replyToMessageId?: number;
}

export interface SendResult {
  success: boolean;
  messageId?: number;
  error?: string;
  usedFallback?: boolean;
}

export interface ChatLink {
  id: string;
  userId: string;
  botAgentType: AgentType;
  chatId: string;
  phoneNumber: string | null;
  verified: boolean;
  verificationCode: string | null;
  verificationSentAt: Date | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  agentId: string;
  sessionId: string | null;
  type: 'blocking' | 'non-blocking' | 'approval' | 'confirmation';
  content: string;
  options: QuestionOption[] | null;
  context: Record<string, unknown> | null;
  status: 'pending' | 'delivered' | 'answered' | 'timeout' | 'cancelled';
  blocking: boolean;
  timeoutMs: number | null;
  defaultAnswer: string | null;
  telegramMessageId: string | null;
  emailMessageId: string | null;
  deliveredVia: 'telegram' | 'email' | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionOption {
  label: string;
  value: string;
  description?: string;
}

export interface QuestionAnswer {
  id: number;
  questionId: string;
  answerType: 'button' | 'text' | 'timeout' | 'default';
  answerValue: string | null;
  answeredVia: 'telegram' | 'email' | 'web' | null;
  answeredAt: Date;
  rawResponse: string | null;
  createdAt: Date;
}

export interface Notification {
  id: number;
  agentId: string;
  agentType: AgentType;
  notificationType: string;
  content: string;
  channel: 'telegram' | 'email';
  status: 'pending' | 'delivered' | 'failed';
  telegramMessageId: string | null;
  emailMessageId: string | null;
  errorMessage: string | null;
  retryCount: number;
  deliveredAt: Date | null;
  createdAt: Date;
}

export interface AgentState {
  agentId: string;
  agentType: AgentType;
  sessionId: string | null;
  state: 'REGISTERING' | 'HELLO_SENT' | 'AWAITING_ACK' | 'READY' | 'DEGRADED' | 'DISCONNECTED';
  assignedBot: string;
  registeredAt: Date;
  lastHeartbeat: Date;
  ackReceived: boolean;
  ackReceivedAt: Date | null;
  capabilities: Record<string, unknown> | null;
}

export interface CommunicationHealth {
  agentId: string;
  checkType: 'heartbeat' | 'handshake' | 'delivery';
  status: 'ok' | 'degraded' | 'failed';
  latencyMs: number | null;
  errorMessage: string | null;
  checkedAt: Date;
}
