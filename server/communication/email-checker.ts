// server/communication/email-checker.ts
// COM-009: Email Checker - Check for email replies as answers

import { EventEmitter } from 'events';

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  date: Date;
  inReplyTo?: string;
  references?: string[];
}

interface ImapClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  openBox(mailbox: string, readOnly: boolean): Promise<{ messages: { total: number } }>;
  search(criteria: string[]): Promise<number[]>;
  fetch(ids: number[], options: { bodies: string[]; markSeen: boolean }): AsyncIterable<{
    uid: number;
    attrs: { envelope: unknown; date: Date };
    parts: Array<{ which: string; body: string }>;
  }>;
  addFlags(uid: number, flags: string[]): Promise<void>;
  moveMessage(uid: number, mailbox: string): Promise<void>;
}

export interface ParsedEmailAnswer {
  questionId?: string;
  approvalId?: string;
  answer: string;
  answerType: 'approval' | 'question' | 'unknown';
  fromEmail: string;
  receivedAt: Date;
  originalMessageId: string;
}

export interface EmailCheckerConfig {
  pollIntervalMs: number;
  processedFolder: string;
  lookbackDays: number;
}

const DEFAULT_CONFIG: EmailCheckerConfig = {
  pollIntervalMs: 60 * 1000, // 1 minute
  processedFolder: 'Processed',
  lookbackDays: 7,
};

export class EmailChecker extends EventEmitter {
  private config: EmailCheckerConfig;
  private client: ImapClient | null = null;
  private running: boolean = false;
  private pollTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    imapConfig: ImapConfig,
    config: Partial<EmailCheckerConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start checking for email replies.
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('[EmailChecker] Already running');
      return;
    }

    this.running = true;
    console.log('[EmailChecker] Starting email checker');

    // Do initial check
    await this.checkEmails();

    this.emit('checker:started');
  }

  /**
   * Stop checking for emails.
   */
  async stop(): Promise<void> {
    console.log('[EmailChecker] Stopping');
    this.running = false;

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = undefined;
    }

    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (error) {
        console.error('[EmailChecker] Error disconnecting:', error);
      }
      this.client = null;
    }

    this.emit('checker:stopped');
  }

  /**
   * Check for new email replies.
   */
  private async checkEmails(): Promise<void> {
    if (!this.running) return;

    try {
      const emails = await this.fetchUnreadReplies();

      for (const email of emails) {
        const parsed = this.parseEmailReply(email);

        if (parsed) {
          this.emit('email:answer', parsed);
          console.log(`[EmailChecker] Found answer: ${parsed.answerType} - "${parsed.answer.substring(0, 50)}..."`);
        }
      }

      this.emit('check:complete', { emailsProcessed: emails.length });
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[EmailChecker] Check failed: ${errorMessage}`);
      this.emit('check:error', { error: errorMessage });
    }

    // Schedule next check
    if (this.running) {
      this.pollTimeout = setTimeout(() => {
        this.checkEmails();
      }, this.config.pollIntervalMs);
    }
  }

  /**
   * Fetch unread reply emails.
   */
  private async fetchUnreadReplies(): Promise<EmailMessage[]> {
    // This is a stub implementation
    // In production, this would use a real IMAP library like 'imap' or 'imapflow'

    console.log('[EmailChecker] Fetching unread replies (stub implementation)');

    // Return empty array - actual implementation would:
    // 1. Connect to IMAP server
    // 2. Search for unread emails that are replies (have In-Reply-To header)
    // 3. Parse the email content
    // 4. Return the messages

    return [];
  }

  /**
   * Parse an email reply to extract the answer.
   */
  private parseEmailReply(email: EmailMessage): ParsedEmailAnswer | null {
    const text = this.extractReplyText(email.text);

    // Check for approval keywords
    const approvalMatch = text.match(/\b(approve|approved|yes|accept)\b/i);
    const rejectMatch = text.match(/\b(reject|rejected|no|decline|denied)\b/i);

    // Extract question/approval ID from subject
    const questionIdMatch = email.subject.match(/\[Q:([a-z0-9-]+)\]/i);
    const approvalIdMatch = email.subject.match(/\[A:([a-z0-9-]+)\]/i);

    if (approvalIdMatch) {
      // This is a reply to an approval request
      const approved = approvalMatch && !rejectMatch;
      return {
        approvalId: approvalIdMatch[1],
        answer: approved ? 'yes' : 'no',
        answerType: 'approval',
        fromEmail: email.from,
        receivedAt: email.date,
        originalMessageId: email.id,
      };
    }

    if (questionIdMatch) {
      // This is a reply to a question
      // Try to extract a numbered choice
      const numberMatch = text.match(/^\s*(\d+)\s*$/m);

      return {
        questionId: questionIdMatch[1],
        answer: numberMatch ? numberMatch[1] : text.trim(),
        answerType: 'question',
        fromEmail: email.from,
        receivedAt: email.date,
        originalMessageId: email.id,
      };
    }

    // Unknown reply format
    return {
      answer: text.trim(),
      answerType: 'unknown',
      fromEmail: email.from,
      receivedAt: email.date,
      originalMessageId: email.id,
    };
  }

  /**
   * Extract just the reply text, removing quoted content.
   */
  private extractReplyText(fullText: string): string {
    // Common reply separators
    const separators = [
      /^On .+ wrote:$/m,
      /^-+\s*Original Message\s*-+$/im,
      /^>+\s/m,
      /^From:\s/m,
      /^Sent:\s/m,
    ];

    let text = fullText;

    for (const separator of separators) {
      const match = text.match(separator);
      if (match && match.index !== undefined) {
        text = text.substring(0, match.index);
      }
    }

    // Remove signature
    const sigMatch = text.match(/^--\s*$/m);
    if (sigMatch && sigMatch.index !== undefined) {
      text = text.substring(0, sigMatch.index);
    }

    return text.trim();
  }

  /**
   * Mark an email as processed.
   */
  async markProcessed(messageId: string): Promise<void> {
    // In production, this would move the email to the processed folder
    // or add a processed flag
    console.log(`[EmailChecker] Marked processed: ${messageId}`);
  }
}

/**
 * Create an email checker with nodemailer-style config.
 */
export function createEmailChecker(
  host: string,
  port: number,
  user: string,
  password: string,
  config?: Partial<EmailCheckerConfig>
): EmailChecker {
  return new EmailChecker(
    {
      host,
      port,
      user,
      password,
      tls: port === 993,
    },
    config
  );
}
