/**
 * Telegram Notification Channel
 * Handles delivery via Telegram Bot API
 */
import { Notification, NotificationDelivery } from '../../../types/notification.js';
import { createDelivery, updateDeliveryStatus, getTemplate, getUserTelegram } from '../../../database/db.js';
import { renderTemplate } from '../templates.js';

interface TelegramSender {
  send(chatId: string, text: string, options?: { parse_mode?: 'Markdown' | 'HTML' }): Promise<void>;
}

const defaultTelegramSender: TelegramSender = {
  async send(chatId, text, options) {
    console.log('[TelegramChannel] Would send message:', {
      chatId,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      parseMode: options?.parse_mode
    });
  }
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class TelegramChannel {
  private sender: TelegramSender;

  constructor(sender?: TelegramSender) {
    this.sender = sender || defaultTelegramSender;
  }

  setSender(sender: TelegramSender): void {
    this.sender = sender;
  }

  async send(notification: Notification): Promise<NotificationDelivery> {
    const delivery = await createDelivery(notification.id, 'telegram');

    try {
      const telegramChatId = await getUserTelegram(notification.userId);
      if (!telegramChatId) {
        await updateDeliveryStatus(delivery.id, 'skipped', 'No Telegram configured');
        return { ...delivery, status: 'skipped', error: 'No Telegram configured' };
      }

      const template = await getTemplate(notification.type);
      const data = notification.data || {};
      const text = template?.telegramText
        ? renderTemplate(template.telegramText, data)
        : `*${this.escapeMarkdown(notification.title)}*\n${notification.body}`;

      await this.sender.send(telegramChatId, text, { parse_mode: 'Markdown' });
      await updateDeliveryStatus(delivery.id, 'sent');
      return { ...delivery, status: 'sent', sentAt: new Date().toISOString() };
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      await updateDeliveryStatus(delivery.id, 'failed', errorMessage);
      return { ...delivery, status: 'failed', error: errorMessage };
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }
}

// Singleton instance
export const telegramChannel = new TelegramChannel();
