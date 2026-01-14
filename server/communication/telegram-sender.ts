// server/communication/telegram-sender.ts
// COM-004: Telegram Message Sender

import { BotRegistry } from './bot-registry';
import { ChatLinker } from './chat-linker';
import { AgentType, RegisteredBot, InlineButton, SendOptions, SendResult } from './types';

export class TelegramSender {
  private botRegistry: BotRegistry;
  private chatLinker: ChatLinker;
  private primaryUserId: string;
  private maxRetryAttempts: number;
  private baseRetryDelayMs: number;

  constructor(
    botRegistry: BotRegistry,
    chatLinker: ChatLinker,
    primaryUserId: string,
    maxRetryAttempts: number = 3,
    baseRetryDelayMs: number = 1000
  ) {
    this.botRegistry = botRegistry;
    this.chatLinker = chatLinker;
    this.primaryUserId = primaryUserId;
    this.maxRetryAttempts = maxRetryAttempts;
    this.baseRetryDelayMs = baseRetryDelayMs;
  }

  /**
   * Send a message to the primary user via the appropriate bot.
   */
  async sendMessage(options: SendOptions): Promise<SendResult> {
    const bot = this.botRegistry.getBot(options.agentType);

    if (!bot) {
      return { success: false, error: 'No bot available for agent type: ' + options.agentType };
    }

    const chatId = await this.chatLinker.getChatId(this.primaryUserId, options.agentType);

    if (!chatId) {
      // Try system bot as fallback
      const systemChatId = await this.chatLinker.getChatId(this.primaryUserId, 'system');
      if (systemChatId) {
        const systemBot = this.botRegistry.getBot('system');
        if (systemBot) {
          console.warn(`[TelegramSender] Using system bot as fallback for ${options.agentType}`);
          const result = await this.doSend(systemBot, systemChatId, options);
          return { ...result, usedFallback: true };
        }
      }
      return { success: false, error: 'No linked chat ID for agent type: ' + options.agentType };
    }

    return this.doSend(bot, chatId, options);
  }

  /**
   * Send a message with inline keyboard buttons.
   */
  async sendWithButtons(
    agentType: AgentType,
    text: string,
    buttons: InlineButton[][]
  ): Promise<SendResult> {
    return this.sendMessage({
      agentType,
      text,
      parseMode: 'Markdown',
      buttons,
    });
  }

  /**
   * Send a question with predefined options as buttons.
   */
  async sendQuestion(
    agentType: AgentType,
    questionId: string,
    questionText: string,
    options: { label: string; value: string }[]
  ): Promise<SendResult> {
    const buttons: InlineButton[][] = options.map(opt => [{
      text: opt.label,
      callbackData: `answer:${questionId}:${opt.value}`,
    }]);

    // Add "Other" option for free-form response
    buttons.push([{
      text: 'Other (type reply)',
      callbackData: `answer:${questionId}:__other__`,
    }]);

    return this.sendWithButtons(agentType, questionText, buttons);
  }

  /**
   * Send a simple notification.
   */
  async sendNotification(
    agentType: AgentType,
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
  ): Promise<SendResult> {
    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨',
    }[severity];

    const text = `${emoji} *${title}*\n\n${message}`;

    return this.sendMessage({
      agentType,
      text,
      parseMode: 'Markdown',
    });
  }

  /**
   * Send an approval request with Yes/No buttons.
   */
  async sendApprovalRequest(
    agentType: AgentType,
    approvalId: string,
    title: string,
    description: string,
    details?: string
  ): Promise<SendResult> {
    let text = `🔴 *Approval Required*\n\n*${title}*\n\n${description}`;

    if (details) {
      text += `\n\n_Details:_\n\`\`\`\n${details}\n\`\`\``;
    }

    const buttons: InlineButton[][] = [
      [
        { text: '✅ Approve', callbackData: `approve:${approvalId}:yes` },
        { text: '❌ Reject', callbackData: `approve:${approvalId}:no` },
      ],
    ];

    return this.sendWithButtons(agentType, text, buttons);
  }

  /**
   * Edit an existing message.
   */
  async editMessage(
    agentType: AgentType,
    messageId: number,
    newText: string,
    newButtons?: InlineButton[][]
  ): Promise<SendResult> {
    const bot = this.botRegistry.getBot(agentType);
    if (!bot) {
      return { success: false, error: 'No bot available' };
    }

    const chatId = await this.chatLinker.getChatId(this.primaryUserId, agentType);
    if (!chatId) {
      return { success: false, error: 'No linked chat ID' };
    }

    const url = `https://api.telegram.org/bot${bot.token}/editMessageText`;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      parse_mode: 'Markdown',
    };

    if (newButtons) {
      body.reply_markup = {
        inline_keyboard: newButtons.map(row =>
          row.map(btn => ({
            text: btn.text,
            callback_data: btn.callbackData,
          }))
        ),
      };
    }

    return this.sendWithRetry(url, body);
  }

  /**
   * Delete a message.
   */
  async deleteMessage(agentType: AgentType, messageId: number): Promise<SendResult> {
    const bot = this.botRegistry.getBot(agentType);
    if (!bot) {
      return { success: false, error: 'No bot available' };
    }

    const chatId = await this.chatLinker.getChatId(this.primaryUserId, agentType);
    if (!chatId) {
      return { success: false, error: 'No linked chat ID' };
    }

    const url = `https://api.telegram.org/bot${bot.token}/deleteMessage`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
    };

    return this.sendWithRetry(url, body);
  }

  /**
   * Send a message to a specific chat ID (used by command handlers).
   */
  async sendToChatId(
    agentType: AgentType,
    chatId: string,
    text: string,
    parseMode: 'Markdown' | 'HTML' = 'Markdown'
  ): Promise<SendResult> {
    const bot = this.botRegistry.getBot(agentType);
    if (!bot) {
      return { success: false, error: 'No bot available for agent type: ' + agentType };
    }

    return this.doSend(bot, chatId, { agentType, text, parseMode });
  }

  /**
   * Send a message with inline keyboard buttons to a specific chat ID.
   */
  async sendWithButtonsToChatId(
    agentType: AgentType,
    chatId: string,
    text: string,
    buttons: InlineButton[][]
  ): Promise<SendResult> {
    const bot = this.botRegistry.getBot(agentType);
    if (!bot) {
      return { success: false, error: 'No bot available for agent type: ' + agentType };
    }

    return this.doSend(bot, chatId, { agentType, text, parseMode: 'Markdown', buttons });
  }

  /**
   * Internal method to send a message.
   */
  private async doSend(
    bot: RegisteredBot,
    chatId: string,
    options: SendOptions
  ): Promise<SendResult> {
    const url = `https://api.telegram.org/bot${bot.token}/sendMessage`;

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: options.text,
      parse_mode: options.parseMode || 'Markdown',
    };

    if (options.buttons) {
      body.reply_markup = {
        inline_keyboard: options.buttons.map(row =>
          row.map(btn => ({
            text: btn.text,
            callback_data: btn.callbackData,
          }))
        ),
      };
    }

    if (options.replyToMessageId) {
      body.reply_to_message_id = options.replyToMessageId;
    }

    return this.sendWithRetry(url, body);
  }

  /**
   * Send with retry logic and exponential backoff.
   */
  private async sendWithRetry(
    url: string,
    body: Record<string, unknown>,
    attempt: number = 1
  ): Promise<SendResult> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.ok) {
        return { success: true, messageId: data.result?.message_id };
      }

      // Rate limited - wait and retry
      if (data.error_code === 429) {
        const retryAfter = data.parameters?.retry_after || 30;
        console.warn(`[TelegramSender] Rate limited, retrying after ${retryAfter}s (attempt ${attempt})`);

        if (attempt < this.maxRetryAttempts) {
          await this.delay(retryAfter * 1000);
          return this.sendWithRetry(url, body, attempt + 1);
        }
      }

      console.error(`[TelegramSender] API error: ${data.description}`);
      return { success: false, error: data.description };
    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`[TelegramSender] Network error (attempt ${attempt}): ${errorMessage}`);

      if (attempt < this.maxRetryAttempts) {
        const delayMs = this.baseRetryDelayMs * Math.pow(2, attempt - 1);
        await this.delay(delayMs);
        return this.sendWithRetry(url, body, attempt + 1);
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delay helper.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
