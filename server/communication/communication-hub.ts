// server/communication/communication-hub.ts
// COM-015: Communication Hub - Central communication coordinator

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { AgentType } from './types';
import { BotRegistry, getBotRegistry } from './bot-registry';
import { ChatLinker } from './chat-linker';
import { TelegramSender } from './telegram-sender';
import { TelegramReceiver, ReceivedMessage, ReceivedCallback } from './telegram-receiver';
import { QuestionDelivery, Question, DeliveryResult } from './question-delivery';
import { AnswerProcessor, ProcessedAnswer, PendingQuestion } from './answer-processor';
import { EmailSender } from './email-sender';
import { EmailChecker } from './email-checker';
import { NotificationDispatcher, Notification, NotificationResult } from './notification-dispatcher';
import { ExecutionGate, GateCheckResult } from './execution-gate';
import { HaltController, HaltReason, HaltEvent } from './halt-controller';
import { AgentHandshake, AgentRegistration, HandshakeSession } from './agent-handshake';
import { MessageTemplates } from './message-templates';
import { loadConfig, CommunicationConfig } from './config';

interface Database {
  run(sql: string, params?: unknown[]): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

interface EmailTransport {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ messageId: string }>;
}

export interface CommunicationHubConfig {
  primaryUserId: string;
  primaryEmail: string;
  baseUrl: string;
  enableEmail: boolean;
  enableTelegram: boolean;
  pollIntervalMs: number;
}

const DEFAULT_CONFIG: CommunicationHubConfig = {
  primaryUserId: 'default_user',
  primaryEmail: 'user@example.com',
  baseUrl: 'http://localhost:3000',
  enableEmail: false,
  enableTelegram: true,
  pollIntervalMs: 1000,
};

// Singleton instance
let hubInstance: CommunicationHub | null = null;

export class CommunicationHub extends EventEmitter {
  private db: Database;
  private config: CommunicationHubConfig;
  private commConfig: CommunicationConfig;

  // Core components
  private botRegistry: BotRegistry;
  private chatLinker: ChatLinker;
  private telegramSender: TelegramSender;
  private telegramReceiver: TelegramReceiver;
  private questionDelivery: QuestionDelivery;
  private answerProcessor: AnswerProcessor;
  private notificationDispatcher: NotificationDispatcher;
  private executionGate: ExecutionGate;
  private haltController: HaltController;
  private agentHandshake: AgentHandshake;
  private messageTemplates: MessageTemplates;

  // Optional email components
  private emailSender: EmailSender | null = null;
  private emailChecker: EmailChecker | null = null;

  private running: boolean = false;

  private constructor(
    db: Database,
    config: Partial<CommunicationHubConfig> = {},
    emailTransport?: EmailTransport
  ) {
    super();
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.commConfig = loadConfig();

    // Initialize components (bot registry initialization is deferred to start())
    this.botRegistry = getBotRegistry();
    this.chatLinker = new ChatLinker(db, null, this.commConfig);
    this.telegramSender = new TelegramSender(
      this.botRegistry,
      this.chatLinker,
      this.config.primaryUserId
    );
    this.telegramReceiver = new TelegramReceiver(this.botRegistry, this.config.pollIntervalMs);
    this.questionDelivery = new QuestionDelivery(this.telegramSender);
    this.answerProcessor = new AnswerProcessor(db);
    this.messageTemplates = new MessageTemplates();

    // Initialize email if transport provided
    if (emailTransport && this.config.enableEmail) {
      this.emailSender = new EmailSender(emailTransport, {
        fromAddress: this.config.primaryEmail,
        fromName: 'Vibe Communication',
        toAddress: this.config.primaryEmail,
      }, this.config.baseUrl);
    }

    // Initialize notification dispatcher
    this.notificationDispatcher = new NotificationDispatcher(
      db,
      this.telegramSender,
      this.emailSender
    );

    // Initialize execution gate
    this.executionGate = new ExecutionGate(db, this.answerProcessor);

    // Initialize halt controller
    this.haltController = new HaltController(
      db,
      this.executionGate,
      this.notificationDispatcher
    );

    // Initialize agent handshake
    this.agentHandshake = new AgentHandshake(db);

    // Wire up event handlers
    this.setupEventHandlers();
  }

  /**
   * Get or create the singleton hub instance.
   */
  static getInstance(
    db: Database,
    config?: Partial<CommunicationHubConfig>,
    emailTransport?: EmailTransport
  ): CommunicationHub {
    if (!hubInstance) {
      hubInstance = new CommunicationHub(db, config, emailTransport);
    }
    return hubInstance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    if (hubInstance) {
      hubInstance.stop();
      hubInstance = null;
    }
  }

  /**
   * Start all communication services.
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('[CommunicationHub] Already running');
      return;
    }

    console.log('[CommunicationHub] Starting...');

    // Initialize bot registry
    await this.botRegistry.initialize();

    // Start components
    await this.answerProcessor.start();
    await this.executionGate.start();
    await this.haltController.start();
    await this.agentHandshake.start();

    // Start Telegram receiver if enabled
    if (this.config.enableTelegram) {
      await this.telegramReceiver.start();
    }

    // Start email checker if enabled
    if (this.emailChecker && this.config.enableEmail) {
      await this.emailChecker.start();
    }

    this.running = true;
    this.emit('hub:started');
    console.log('[CommunicationHub] Started successfully');
  }

  /**
   * Stop all communication services.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log('[CommunicationHub] Stopping...');

    await this.telegramReceiver.stop();
    await this.answerProcessor.stop();
    await this.executionGate.stop();
    await this.haltController.stop();
    await this.agentHandshake.stop();
    this.botRegistry.stop();

    if (this.emailChecker) {
      await this.emailChecker.stop();
    }

    this.running = false;
    this.emit('hub:stopped');
    console.log('[CommunicationHub] Stopped');
  }

  // ============================================================
  // Agent Registration API
  // ============================================================

  /**
   * Register an agent with the communication system.
   */
  async registerAgent(registration: AgentRegistration): Promise<HandshakeSession> {
    return this.agentHandshake.register(registration);
  }

  /**
   * Check if an agent is registered and ready.
   */
  isAgentReady(agentId: string): boolean {
    return this.agentHandshake.isReady(agentId);
  }

  /**
   * Disconnect an agent.
   */
  async disconnectAgent(agentId: string, reason?: string): Promise<void> {
    return this.agentHandshake.disconnect(agentId, reason);
  }

  /**
   * Acknowledge agent handshake (for in-process agents).
   * This completes the handshake by sending ACK back to the handshake manager.
   */
  async acknowledgeAgent(agentId: string): Promise<boolean> {
    return this.agentHandshake.receiveAck(agentId);
  }

  /**
   * Send heartbeat for an agent.
   */
  async sendHeartbeat(agentId: string): Promise<boolean> {
    return this.agentHandshake.heartbeat(agentId);
  }

  // ============================================================
  // Question API
  // ============================================================

  /**
   * Ask a question to the user.
   */
  async askQuestion(question: Question): Promise<DeliveryResult> {
    // Create pending question
    const pendingQuestion: PendingQuestion = {
      id: question.id,
      agentId: question.agentId,
      agentType: this.extractAgentType(question.agentId),
      type: question.type,
      content: question.content,
      options: question.options,
      blocking: question.blocking,
      priority: question.priority,
      defaultOption: question.defaultOption,
      createdAt: new Date(),
    };

    // Register with answer processor
    await this.answerProcessor.registerQuestion(pendingQuestion);

    // Deliver question
    const result = await this.questionDelivery.deliverQuestion(question);

    // If blocking, block the agent
    if (question.blocking && result.success) {
      await this.executionGate.blockAgent(
        question.agentId,
        pendingQuestion.agentType,
        'Waiting for answer',
        [question.id]
      );
    }

    return result;
  }

  /**
   * Wait for an answer to a question (blocking).
   */
  async waitForAnswer(questionId: string, timeoutMs?: number): Promise<ProcessedAnswer | null> {
    return new Promise((resolve) => {
      const handler = (answer: ProcessedAnswer) => {
        if (answer.questionId === questionId) {
          this.answerProcessor.off('answer:received', handler);
          resolve(answer);
        }
      };

      this.answerProcessor.on('answer:received', handler);

      // Set timeout if provided
      if (timeoutMs) {
        setTimeout(() => {
          this.answerProcessor.off('answer:received', handler);
          resolve(null);
        }, timeoutMs);
      }
    });
  }

  /**
   * Cancel a pending question.
   */
  async cancelQuestion(questionId: string, reason: string): Promise<void> {
    return this.answerProcessor.cancelQuestion(questionId, reason);
  }

  // ============================================================
  // Notification API
  // ============================================================

  /**
   * Send a notification.
   */
  async notify(notification: Notification): Promise<NotificationResult> {
    return this.notificationDispatcher.dispatch(notification);
  }

  /**
   * Send a simple notification.
   */
  async notifySimple(
    agentType: AgentType,
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
  ): Promise<NotificationResult> {
    return this.notificationDispatcher.dispatch({
      id: uuid(),
      agentType,
      category: severity === 'critical' || severity === 'error' ? 'error' : 'progress',
      severity,
      title,
      message,
    });
  }

  // ============================================================
  // Execution Gate API
  // ============================================================

  /**
   * Check if an agent can proceed with execution.
   */
  checkGate(agentId: string): GateCheckResult {
    return this.executionGate.checkGate(agentId);
  }

  /**
   * Block an agent's execution.
   */
  async blockAgent(
    agentId: string,
    agentType: AgentType,
    reason: string,
    questionIds: string[]
  ): Promise<void> {
    return this.executionGate.blockAgent(agentId, agentType, reason, questionIds);
  }

  /**
   * Unblock an agent.
   */
  async unblockAgent(agentId: string): Promise<void> {
    return this.executionGate.unblockAgent(agentId);
  }

  // ============================================================
  // Halt API
  // ============================================================

  /**
   * Halt an agent.
   */
  async haltAgent(
    agentId: string,
    agentType: AgentType,
    reason: HaltReason,
    details: string
  ): Promise<HaltEvent> {
    return this.haltController.haltAgent(agentId, agentType, reason, details);
  }

  /**
   * Resume a halted agent.
   */
  async resumeAgent(agentId: string, resumedBy: string = 'user'): Promise<boolean> {
    return this.haltController.resumeAgent(agentId, resumedBy);
  }

  /**
   * Global halt all agents.
   */
  async globalHalt(reason: string): Promise<void> {
    return this.executionGate.globalHaltAll(reason);
  }

  /**
   * Resume from global halt.
   */
  async globalResume(): Promise<void> {
    return this.executionGate.globalResume();
  }

  // ============================================================
  // Status API
  // ============================================================

  /**
   * Get overall communication status.
   */
  getStatus(): {
    running: boolean;
    botCount: number;
    healthyBots: number;
    readyAgents: number;
    blockedAgents: number;
    haltedAgents: number;
    pendingQuestions: number;
  } {
    const healthyBots = this.botRegistry.getHealthyBots();

    return {
      running: this.running,
      botCount: this.botRegistry.getAllBots().length,
      healthyBots: healthyBots.length,
      readyAgents: this.agentHandshake.getReadyAgents().length,
      blockedAgents: this.executionGate.getBlockedAgents().length,
      haltedAgents: this.haltController.getAllActiveHalts().length,
      pendingQuestions: this.answerProcessor.getBlockingQuestions().length,
    };
  }

  /**
   * Get status for a specific agent.
   */
  getAgentStatus(agentId: string): {
    registered: boolean;
    ready: boolean;
    gateStatus: GateCheckResult;
    halted: boolean;
    haltEvent?: HaltEvent;
    pendingQuestions: PendingQuestion[];
  } {
    const session = this.agentHandshake.getSession(agentId);
    const haltEvent = this.haltController.getHaltStatus(agentId);
    const pendingQuestions = this.answerProcessor.getPendingQuestionsForAgent(agentId);

    return {
      registered: !!session,
      ready: session?.state === 'ready',
      gateStatus: this.executionGate.checkGate(agentId),
      halted: !!haltEvent,
      haltEvent: haltEvent || undefined,
      pendingQuestions,
    };
  }

  // ============================================================
  // Template API
  // ============================================================

  /**
   * Get message templates.
   */
  getTemplates(): MessageTemplates {
    return this.messageTemplates;
  }

  // ============================================================
  // Event Handlers
  // ============================================================

  private setupEventHandlers(): void {
    // Handle incoming Telegram messages
    this.telegramReceiver.on('command:start', async (msg: ReceivedMessage) => {
      const response = await this.chatLinker.handleStartCommand(
        msg.botType,
        msg.chatId,
        this.config.primaryUserId
      );
      await this.telegramSender.sendMessage({
        agentType: msg.botType,
        text: response,
        parseMode: 'Markdown',
      });
    });

    this.telegramReceiver.on('verification:code', async (msg: ReceivedMessage) => {
      const result = await this.chatLinker.handleVerificationCode(
        msg.botType,
        msg.chatId,
        msg.text
      );
      await this.telegramSender.sendMessage({
        agentType: msg.botType,
        text: result.message,
        parseMode: 'Markdown',
      });
    });

    this.telegramReceiver.on('message:text', async (msg: ReceivedMessage) => {
      const answer = await this.answerProcessor.processTextAnswer(
        msg.chatId,
        msg.text,
        msg.fromUserId,
        msg.fromUsername
      );

      if (answer) {
        this.emit('answer:received', answer);
      }
    });

    this.telegramReceiver.on('answer:button', async (data: ReceivedCallback & { questionId: string; action: string }) => {
      const answer = await this.answerProcessor.processButtonAnswer(
        data.questionId,
        data.action,
        data.fromUserId
      );

      if (answer) {
        this.emit('answer:received', answer);
      }
    });

    this.telegramReceiver.on('approval:response', async (data: ReceivedCallback & { approvalId: string; approved: boolean }) => {
      this.emit('approval:response', {
        approvalId: data.approvalId,
        approved: data.approved,
        fromUserId: data.fromUserId,
      });
    });

    this.telegramReceiver.on('command:status', async (msg: ReceivedMessage) => {
      const status = this.getStatus();
      const text = this.messageTemplates.renderTelegram('status.agent_started', {
        agentType: msg.botType,
        sessionId: 'current',
        ideaName: 'Active Ideas',
      }) || `Status: ${status.readyAgents} agents ready, ${status.pendingQuestions} pending questions`;

      await this.telegramSender.sendMessage({
        agentType: msg.botType,
        text,
        parseMode: 'Markdown',
      });
    });

    this.telegramReceiver.on('command:help', async (msg: ReceivedMessage) => {
      const text = this.messageTemplates.renderTelegram('help.commands', {}) || 'Use /status, /summary, or /start';
      await this.telegramSender.sendMessage({
        agentType: msg.botType,
        text,
        parseMode: 'Markdown',
      });
    });

    // Forward important events
    this.answerProcessor.on('answer:received', (answer: ProcessedAnswer) => {
      this.emit('answer:received', answer);
    });

    this.executionGate.on('agent:blocked', (data) => {
      this.emit('agent:blocked', data);
    });

    this.executionGate.on('agent:unblocked', (data) => {
      this.emit('agent:unblocked', data);
    });

    this.haltController.on('halt:created', (event: HaltEvent) => {
      this.emit('agent:halted', event);
    });

    this.haltController.on('halt:resumed', (event: HaltEvent) => {
      this.emit('agent:resumed', event);
    });

    this.agentHandshake.on('agent:ready', (data: { agentId: string; session: HandshakeSession }) => {
      this.emit('agent:ready', data);
    });
  }

  /**
   * Extract agent type from agent ID.
   */
  private extractAgentType(agentId: string): AgentType {
    const id = agentId.toLowerCase();
    if (id.includes('monitor')) return 'monitoring';
    if (id.includes('orchestrat')) return 'orchestrator';
    if (id.includes('spec')) return 'spec';
    if (id.includes('build')) return 'build';
    if (id.includes('valid')) return 'validation';
    if (id.includes('sia')) return 'sia';
    return 'system';
  }
}

// Convenience function
export function getCommunicationHub(
  db: Database,
  config?: Partial<CommunicationHubConfig>
): CommunicationHub {
  return CommunicationHub.getInstance(db, config);
}
