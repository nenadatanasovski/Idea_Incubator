// server/communication/chat-linker.ts
// COM-003: Chat ID Linking (User Verification)

import { AgentType, ChatLink } from './types';
import { CommunicationConfig } from './config';

interface Database {
  run(sql: string, params?: unknown[]): Promise<{ lastID: number; changes: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

interface EmailSender {
  send(options: { to: string; subject: string; text: string; html?: string }): Promise<boolean>;
}

export class ChatLinker {
  private db: Database;
  private emailSender: EmailSender | null;
  private config: CommunicationConfig;

  constructor(db: Database, emailSender: EmailSender | null, config: CommunicationConfig) {
    this.db = db;
    this.emailSender = emailSender;
    this.config = config;
  }

  /**
   * Handle /start command from a user.
   * Initiates verification process.
   */
  async handleStartCommand(botAgentType: AgentType, chatId: string, userId: string): Promise<string> {
    // Check if already linked and verified
    const existing = await this.getLink(userId, botAgentType);

    if (existing?.verified) {
      return `Already linked and verified! You'll receive ${botAgentType} notifications here.`;
    }

    // Generate verification code
    const code = this.generateCode();

    // Store pending link
    await this.storePendingLink({
      userId,
      botAgentType,
      chatId,
      verificationCode: code,
    });

    // Send code via email if email sender is available
    if (this.emailSender) {
      try {
        await this.emailSender.send({
          to: this.config.primaryEmail,
          subject: `Vibe ${botAgentType} Bot Verification Code`,
          text: `Your verification code is: ${code}\n\nEnter this code in Telegram to link your account.\n\nExpires in ${this.config.verificationCodeExpiryMinutes} minutes.`,
        });
      } catch (error) {
        console.error('[ChatLinker] Failed to send verification email:', error);
      }
    }

    return `Verification code sent to ${this.maskEmail(this.config.primaryEmail)}.\n\nReply with the 6-digit code to complete linking.`;
  }

  /**
   * Handle verification code submission.
   */
  async handleVerificationCode(
    botAgentType: AgentType,
    chatId: string,
    code: string
  ): Promise<{ success: boolean; message: string }> {
    const link = await this.getLinkByChatId(chatId, botAgentType);

    if (!link) {
      return { success: false, message: 'No pending verification. Send /start first.' };
    }

    if (link.verified) {
      return { success: false, message: 'Already verified!' };
    }

    if (!link.verificationCode) {
      return { success: false, message: 'No verification code found. Send /start to get a new code.' };
    }

    // Check expiry
    if (link.verificationSentAt) {
      const expiresAt = new Date(link.verificationSentAt.getTime() + this.config.verificationCodeExpiryMinutes * 60 * 1000);
      if (new Date() > expiresAt) {
        return { success: false, message: 'Code expired. Send /start to get a new code.' };
      }
    }

    if (link.verificationCode !== code) {
      return { success: false, message: 'Invalid code. Please try again.' };
    }

    // Mark as verified
    await this.markVerified(link.id);

    return {
      success: true,
      message: `Verified! You'll receive ${botAgentType} notifications here.\n\nTo link other agent bots, message each one with /start.`,
    };
  }

  /**
   * Get chat ID for a user and bot type.
   * Returns null if not linked or not verified.
   */
  async getChatId(userId: string, botAgentType: AgentType): Promise<string | null> {
    const link = await this.getLink(userId, botAgentType);
    return link?.verified ? link.chatId : null;
  }

  /**
   * Get all verified chat IDs for a user.
   */
  async getVerifiedChatIds(userId: string): Promise<Map<AgentType, string>> {
    const links = await this.getAllLinks(userId);
    const result = new Map<AgentType, string>();

    for (const link of links) {
      if (link.verified) {
        result.set(link.botAgentType, link.chatId);
      }
    }

    return result;
  }

  /**
   * Check if a user is linked to a specific bot.
   */
  async isLinked(userId: string, botAgentType: AgentType): Promise<boolean> {
    const link = await this.getLink(userId, botAgentType);
    return link?.verified ?? false;
  }

  /**
   * Link all bots with the same chat ID (user verified once).
   */
  async linkAllBots(userId: string, chatId: string): Promise<void> {
    const botTypes: AgentType[] = ['monitoring', 'orchestrator', 'spec', 'build', 'validation', 'sia', 'system'];

    for (const botType of botTypes) {
      await this.storePendingLink({
        userId,
        botAgentType: botType,
        chatId,
        verificationCode: null,
      });
      await this.markVerifiedByUserId(userId, botType);
    }
  }

  /**
   * Generate a 6-digit verification code.
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Mask email for display (ne***@gmail.com).
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }

  // Database methods

  private async getLink(userId: string, botAgentType: AgentType): Promise<ChatLink | null> {
    const row = await this.db.get<{
      id: string;
      user_id: string;
      bot_agent_type: string;
      chat_id: string;
      phone_number: string | null;
      verified: number;
      verification_code: string | null;
      verification_sent_at: string | null;
      verified_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT * FROM telegram_chat_links WHERE user_id = ? AND bot_agent_type = ?',
      [userId, botAgentType]
    );

    if (!row) return null;

    return this.mapRowToLink(row);
  }

  private async getLinkByChatId(chatId: string, botAgentType: AgentType): Promise<ChatLink | null> {
    const row = await this.db.get<{
      id: string;
      user_id: string;
      bot_agent_type: string;
      chat_id: string;
      phone_number: string | null;
      verified: number;
      verification_code: string | null;
      verification_sent_at: string | null;
      verified_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT * FROM telegram_chat_links WHERE chat_id = ? AND bot_agent_type = ?',
      [chatId, botAgentType]
    );

    if (!row) return null;

    return this.mapRowToLink(row);
  }

  private async getAllLinks(userId: string): Promise<ChatLink[]> {
    const rows = await this.db.all<{
      id: string;
      user_id: string;
      bot_agent_type: string;
      chat_id: string;
      phone_number: string | null;
      verified: number;
      verification_code: string | null;
      verification_sent_at: string | null;
      verified_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      'SELECT * FROM telegram_chat_links WHERE user_id = ?',
      [userId]
    );

    return rows.map(row => this.mapRowToLink(row));
  }

  private async storePendingLink(link: {
    userId: string;
    botAgentType: AgentType;
    chatId: string;
    verificationCode: string | null;
  }): Promise<void> {
    const now = new Date().toISOString();

    await this.db.run(
      `INSERT INTO telegram_chat_links (user_id, bot_agent_type, chat_id, verification_code, verification_sent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, bot_agent_type) DO UPDATE SET
         chat_id = excluded.chat_id,
         verification_code = excluded.verification_code,
         verification_sent_at = excluded.verification_sent_at,
         updated_at = excluded.updated_at`,
      [link.userId, link.botAgentType, link.chatId, link.verificationCode, link.verificationCode ? now : null, now, now]
    );
  }

  private async markVerified(linkId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      'UPDATE telegram_chat_links SET verified = 1, verified_at = ?, verification_code = NULL WHERE id = ?',
      [now, linkId]
    );
  }

  private async markVerifiedByUserId(userId: string, botAgentType: AgentType): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      'UPDATE telegram_chat_links SET verified = 1, verified_at = ?, verification_code = NULL WHERE user_id = ? AND bot_agent_type = ?',
      [now, userId, botAgentType]
    );
  }

  private mapRowToLink(row: {
    id: string;
    user_id: string;
    bot_agent_type: string;
    chat_id: string;
    phone_number: string | null;
    verified: number;
    verification_code: string | null;
    verification_sent_at: string | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
  }): ChatLink {
    return {
      id: row.id.toString(),
      userId: row.user_id,
      botAgentType: row.bot_agent_type as AgentType,
      chatId: row.chat_id,
      phoneNumber: row.phone_number,
      verified: row.verified === 1,
      verificationCode: row.verification_code,
      verificationSentAt: row.verification_sent_at ? new Date(row.verification_sent_at) : null,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
