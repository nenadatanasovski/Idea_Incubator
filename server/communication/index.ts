// server/communication/index.ts
// Communication Module - Main Export File

// Core types
export * from "./types";
export * from "./config";

// Bot management
export {
  BotRegistry,
  getBotRegistry,
  initializeBotRegistry,
} from "./bot-registry";

// User linking
export { ChatLinker } from "./chat-linker";

// Message sending
export { TelegramSender } from "./telegram-sender";

// Message receiving
export {
  TelegramReceiver,
  ReceivedMessage,
  ReceivedCallback,
} from "./telegram-receiver";

// Question delivery
export {
  QuestionDelivery,
  QuestionType,
  Question,
  DeliveryResult,
} from "./question-delivery";

// Answer processing
export {
  AnswerProcessor,
  PendingQuestion,
  ProcessedAnswer,
  AnswerProcessorConfig,
} from "./answer-processor";

// Email (fallback)
export {
  EmailSender,
  EmailConfig,
  EmailSendResult,
  EmailQuestion,
} from "./email-sender";
export {
  EmailChecker,
  ParsedEmailAnswer,
  createEmailChecker,
} from "./email-checker";

// Notifications
export {
  NotificationDispatcher,
  Notification,
  NotificationResult,
  NotificationChannel,
  NotificationSeverity,
  NotificationCategory,
} from "./notification-dispatcher";

// Execution control
export {
  ExecutionGate,
  GateStatus,
  GateState,
  GateCheckResult,
} from "./execution-gate";

// Halt management
export {
  HaltController,
  HaltReason,
  HaltEvent,
  HaltPolicy,
} from "./halt-controller";

// Message templates
export {
  MessageTemplates,
  TemplateCategory,
  TemplateContext,
  MessageTemplate,
} from "./message-templates";

// Agent handshake
export {
  AgentHandshake,
  AgentRegistration,
  HandshakeSession,
  HandshakeState,
} from "./agent-handshake";

// Main hub
export {
  CommunicationHub,
  CommunicationHubConfig,
  getCommunicationHub,
} from "./communication-hub";
