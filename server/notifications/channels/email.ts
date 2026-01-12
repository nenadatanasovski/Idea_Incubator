/**
 * Email Notification Channel
 * Handles delivery via email sender service
 */
import { Notification, NotificationDelivery } from '../../../types/notification.js';
import { createDelivery, updateDeliveryStatus, getTemplate, getUserEmail } from '../../../database/db.js';
import { renderTemplate, renderHtmlTemplate } from '../templates.js';

interface EmailSender {
  send(options: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

const defaultEmailSender: EmailSender = {
  async send(options) {
    console.log('[EmailChannel] Would send email:', { to: options.to, subject: options.subject });
  }
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class EmailChannel {
  private sender: EmailSender;

  constructor(sender?: EmailSender) {
    this.sender = sender || defaultEmailSender;
  }

  setSender(sender: EmailSender): void {
    this.sender = sender;
  }

  async send(notification: Notification): Promise<NotificationDelivery> {
    const delivery = await createDelivery(notification.id, 'email');

    try {
      const email = await getUserEmail(notification.userId);
      if (!email) {
        await updateDeliveryStatus(delivery.id, 'skipped', 'No email address configured');
        return { ...delivery, status: 'skipped', error: 'No email address configured' };
      }

      const template = await getTemplate(notification.type);
      const data = notification.data || {};
      const subject = template?.emailSubject
        ? renderTemplate(template.emailSubject, data)
        : notification.title;
      const html = template?.emailBody
        ? renderHtmlTemplate(template.emailBody, data)
        : `<p>${notification.body}</p>`;

      await this.sender.send({ to: email, subject, html, text: notification.body });
      await updateDeliveryStatus(delivery.id, 'sent');
      return { ...delivery, status: 'sent', sentAt: new Date().toISOString() };
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      await updateDeliveryStatus(delivery.id, 'failed', errorMessage);
      return { ...delivery, status: 'failed', error: errorMessage };
    }
  }
}

// Singleton instance
export const emailChannel = new EmailChannel();
