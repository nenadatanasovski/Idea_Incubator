// server/communication/answer-processor.ts
// COM-007: Answer Processor - Matches answers to pending questions

import { EventEmitter } from 'events';
import { AgentType } from './types';
import { QuestionType } from './question-delivery';

interface Database {
  run(sql: string, params?: unknown[]): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface PendingQuestion {
  id: string;
  agentId: string;
  agentType: AgentType;
  type: QuestionType;
  content: string;
  options: { label: string; action: string }[];
  blocking: boolean;
  priority: number;
  messageId?: number;
  chatId?: string;
  createdAt: Date;
  expiresAt?: Date;
  defaultOption?: string;
}

export interface ProcessedAnswer {
  questionId: string;
  agentId: string;
  agentType: AgentType;
  answer: string;
  answerType: 'button' | 'text' | 'timeout' | 'default';
  fromUserId: number;
  fromUsername?: string;
  processedAt: Date;
  wasBlocking: boolean;
}

export interface AnswerProcessorConfig {
  defaultTimeoutMs: number;
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: AnswerProcessorConfig = {
  defaultTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
};

export class AnswerProcessor extends EventEmitter {
  private db: Database;
  private pendingQuestions: Map<string, PendingQuestion> = new Map();
  private config: AnswerProcessorConfig;
  private cleanupInterval?: ReturnType<typeof setInterval>;
  private awaitingFreeText: Map<string, string> = new Map(); // chatId -> questionId

  constructor(db: Database, config: Partial<AnswerProcessorConfig> = {}) {
    super();
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the answer processor (cleanup timer, load pending questions).
   */
  async start(): Promise<void> {
    // Load pending questions from database
    await this.loadPendingQuestions();

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.checkTimeouts();
    }, this.config.cleanupIntervalMs);

    console.log(`[AnswerProcessor] Started with ${this.pendingQuestions.size} pending questions`);
  }

  /**
   * Stop the answer processor.
   */
  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    console.log('[AnswerProcessor] Stopped');
  }

  /**
   * Register a new pending question.
   */
  async registerQuestion(question: PendingQuestion): Promise<void> {
    // Calculate expiry if not set
    if (!question.expiresAt) {
      question.expiresAt = new Date(Date.now() + this.config.defaultTimeoutMs);
    }

    this.pendingQuestions.set(question.id, question);

    // Store in database
    await this.storeQuestion(question);

    console.log(`[AnswerProcessor] Registered question ${question.id} for ${question.agentId}`);
  }

  /**
   * Process a button answer from Telegram callback.
   */
  async processButtonAnswer(
    questionId: string,
    action: string,
    fromUserId: number,
    fromUsername?: string
  ): Promise<ProcessedAnswer | null> {
    const question = this.pendingQuestions.get(questionId);

    if (!question) {
      console.warn(`[AnswerProcessor] No pending question found: ${questionId}`);
      return null;
    }

    // Handle "Other" button - wait for free text
    if (action === '__other__') {
      if (question.chatId) {
        this.awaitingFreeText.set(question.chatId, questionId);
      }
      this.emit('awaiting:freetext', { questionId, question });
      return null;
    }

    return this.completeAnswer(question, action, 'button', fromUserId, fromUsername);
  }

  /**
   * Process a text answer (free-text response).
   */
  async processTextAnswer(
    chatId: string,
    text: string,
    fromUserId: number,
    fromUsername?: string
  ): Promise<ProcessedAnswer | null> {
    // Check if we're awaiting free text for this chat
    const questionId = this.awaitingFreeText.get(chatId);

    if (!questionId) {
      // Not awaiting free text - might be unsolicited
      console.log(`[AnswerProcessor] Unsolicited text from chat ${chatId}: "${text.substring(0, 50)}..."`);
      this.emit('message:unsolicited', { chatId, text, fromUserId, fromUsername });
      return null;
    }

    const question = this.pendingQuestions.get(questionId);

    if (!question) {
      this.awaitingFreeText.delete(chatId);
      return null;
    }

    // Clear awaiting state
    this.awaitingFreeText.delete(chatId);

    return this.completeAnswer(question, text, 'text', fromUserId, fromUsername);
  }

  /**
   * Get all pending questions for an agent.
   */
  getPendingQuestionsForAgent(agentId: string): PendingQuestion[] {
    const questions: PendingQuestion[] = [];
    for (const q of this.pendingQuestions.values()) {
      if (q.agentId === agentId) {
        questions.push(q);
      }
    }
    return questions;
  }

  /**
   * Get all blocking questions.
   */
  getBlockingQuestions(): PendingQuestion[] {
    const questions: PendingQuestion[] = [];
    for (const q of this.pendingQuestions.values()) {
      if (q.blocking) {
        questions.push(q);
      }
    }
    return questions;
  }

  /**
   * Check if an agent has any blocking questions.
   */
  isAgentBlocked(agentId: string): boolean {
    for (const q of this.pendingQuestions.values()) {
      if (q.agentId === agentId && q.blocking) {
        return true;
      }
    }
    return false;
  }

  /**
   * Cancel a pending question.
   */
  async cancelQuestion(questionId: string, reason: string): Promise<void> {
    const question = this.pendingQuestions.get(questionId);

    if (!question) {
      return;
    }

    this.pendingQuestions.delete(questionId);

    // Update database
    await this.db.run(
      'UPDATE questions SET status = ?, answered_at = ? WHERE id = ?',
      ['cancelled', new Date().toISOString(), questionId]
    );

    this.emit('question:cancelled', { questionId, reason, question });
    console.log(`[AnswerProcessor] Cancelled question ${questionId}: ${reason}`);
  }

  /**
   * Complete an answer and emit events.
   */
  private async completeAnswer(
    question: PendingQuestion,
    answer: string,
    answerType: 'button' | 'text' | 'timeout' | 'default',
    fromUserId: number,
    fromUsername?: string
  ): Promise<ProcessedAnswer> {
    const processedAnswer: ProcessedAnswer = {
      questionId: question.id,
      agentId: question.agentId,
      agentType: question.agentType,
      answer,
      answerType,
      fromUserId,
      fromUsername,
      processedAt: new Date(),
      wasBlocking: question.blocking,
    };

    // Remove from pending
    this.pendingQuestions.delete(question.id);

    // Store answer in database
    await this.storeAnswer(processedAnswer);

    // Emit events
    this.emit('answer:received', processedAnswer);

    if (question.blocking) {
      this.emit('agent:unblocked', {
        agentId: question.agentId,
        agentType: question.agentType,
        answer: processedAnswer,
      });
    }

    console.log(`[AnswerProcessor] Processed ${answerType} answer for ${question.id}: "${answer.substring(0, 50)}..."`);

    return processedAnswer;
  }

  /**
   * Check for timed-out questions and apply defaults.
   */
  private async checkTimeouts(): Promise<void> {
    const now = new Date();
    const timedOut: PendingQuestion[] = [];

    for (const question of this.pendingQuestions.values()) {
      if (question.expiresAt && now > question.expiresAt) {
        timedOut.push(question);
      }
    }

    for (const question of timedOut) {
      if (question.defaultOption) {
        // Apply default answer
        console.log(`[AnswerProcessor] Applying default for timed-out question ${question.id}`);
        await this.completeAnswer(question, question.defaultOption, 'default', 0);
      } else {
        // No default - emit timeout event
        this.pendingQuestions.delete(question.id);

        await this.db.run(
          'UPDATE questions SET status = ?, answered_at = ? WHERE id = ?',
          ['timeout', now.toISOString(), question.id]
        );

        this.emit('question:timeout', { question });

        if (question.blocking) {
          this.emit('agent:timeout', {
            agentId: question.agentId,
            agentType: question.agentType,
            question,
          });
        }

        console.log(`[AnswerProcessor] Question ${question.id} timed out without default`);
      }
    }
  }

  /**
   * Load pending questions from database.
   */
  private async loadPendingQuestions(): Promise<void> {
    const rows = await this.db.all<{
      id: string;
      agent_id: string;
      agent_type: string;
      type: string;
      content: string;
      options: string;
      blocking: number;
      priority: number;
      message_id: number | null;
      chat_id: string | null;
      default_option: string | null;
      expires_at: string | null;
      created_at: string;
    }>(
      'SELECT * FROM questions WHERE status = ?',
      ['pending']
    );

    for (const row of rows) {
      const question: PendingQuestion = {
        id: row.id,
        agentId: row.agent_id,
        agentType: row.agent_type as AgentType,
        type: row.type as QuestionType,
        content: row.content,
        options: JSON.parse(row.options || '[]'),
        blocking: row.blocking === 1,
        priority: row.priority,
        messageId: row.message_id ?? undefined,
        chatId: row.chat_id ?? undefined,
        defaultOption: row.default_option ?? undefined,
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
        createdAt: new Date(row.created_at),
      };

      this.pendingQuestions.set(question.id, question);
    }
  }

  /**
   * Store a question in the database.
   */
  private async storeQuestion(question: PendingQuestion): Promise<void> {
    const now = new Date().toISOString();

    await this.db.run(
      `INSERT INTO questions (id, agent_id, agent_type, type, content, options, blocking, priority, message_id, chat_id, default_option, expires_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         message_id = excluded.message_id,
         chat_id = excluded.chat_id,
         status = excluded.status`,
      [
        question.id,
        question.agentId,
        question.agentType,
        question.type,
        question.content,
        JSON.stringify(question.options),
        question.blocking ? 1 : 0,
        question.priority,
        question.messageId ?? null,
        question.chatId ?? null,
        question.defaultOption ?? null,
        question.expiresAt?.toISOString() ?? null,
        'pending',
        now,
      ]
    );
  }

  /**
   * Store an answer in the database.
   */
  private async storeAnswer(answer: ProcessedAnswer): Promise<void> {
    const now = new Date().toISOString();

    // Update question status
    await this.db.run(
      'UPDATE questions SET status = ?, answered_at = ? WHERE id = ?',
      ['answered', now, answer.questionId]
    );

    // Store answer record
    await this.db.run(
      `INSERT INTO question_answers (question_id, answer_value, answer_type, answered_by_user_id, answered_by_username, answered_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        answer.questionId,
        answer.answer,
        answer.answerType,
        answer.fromUserId,
        answer.fromUsername ?? null,
        now,
      ]
    );
  }
}
