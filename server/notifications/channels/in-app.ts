/**
 * In-App Notification Channel
 * Handles delivery via WebSocket broadcast
 */
import { Notification, NotificationDelivery } from '../../../types/notification.js';
import { createDelivery, updateDeliveryStatus } from '../../../database/db.js';
import { broadcastToUser } from '../../websocket.js';

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class InAppChannel {
  async send(notification: Notification): Promise<NotificationDelivery> {
    const delivery = await createDelivery(notification.id, 'in_app');

    try {
      broadcastToUser(notification.userId, 'notification:new', notification);
      await updateDeliveryStatus(delivery.id, 'sent');
      return { ...delivery, status: 'sent', sentAt: new Date().toISOString() };
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      await updateDeliveryStatus(delivery.id, 'failed', errorMessage);
      return { ...delivery, status: 'failed', error: errorMessage };
    }
  }

  broadcastUnreadCount(userId: string, count: number): void {
    broadcastToUser(userId, 'notification:unread-count', { count });
  }

  broadcastReadStatus(userId: string, notificationId: string, readAt: string): void {
    broadcastToUser(userId, 'notification:read', { id: notificationId, readAt });
  }
}

// Singleton instance
export const inAppChannel = new InAppChannel();
