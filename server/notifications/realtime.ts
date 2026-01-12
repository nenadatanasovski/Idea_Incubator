/**
 * Real-time Notification Updates
 * Integrates notification queue with WebSocket broadcasting
 */
import { notificationQueue } from './queue.js';
import { notificationDispatcher } from './dispatcher.js';
import {
  getUnreadCount,
  markNotificationRead,
  markNotificationArchived,
  markAllNotificationsRead
} from '../../database/db.js';
import { broadcastToUser, onUserEvent } from '../websocket.js';

/**
 * NotificationRealtime coordinates real-time notification delivery
 * - Listens for new notifications from the queue
 * - Dispatches to appropriate channels
 * - Handles client events (mark read, archive)
 * - Broadcasts unread count updates
 */
class NotificationRealtime {
  private initialized = false;

  /**
   * Initialize the realtime system
   * Sets up event listeners for queue and WebSocket events
   */
  init(): void {
    if (this.initialized) {
      console.warn('[NotificationRealtime] Already initialized');
      return;
    }

    console.log('[NotificationRealtime] Initializing...');

    // Listen for new notifications from the queue
    notificationQueue.on('notification', async (notification) => {
      try {
        await notificationDispatcher.dispatch(notification);
      } catch (error) {
        console.error('[NotificationRealtime] Error dispatching notification:', error);
      }
    });

    // Listen for client events via WebSocket
    this.setupClientEventHandlers();

    this.initialized = true;
    console.log('[NotificationRealtime] Initialized');
  }

  /**
   * Set up handlers for client-initiated events
   */
  private setupClientEventHandlers(): void {
    // Handle mark read
    onUserEvent('notification:mark-read', async (userId, data) => {
      try {
        const notificationId = data.notificationId as string;
        if (!notificationId) return;

        const notification = await markNotificationRead(notificationId);
        if (notification && notification.userId === userId) {
          // Broadcast read status to all user's connections
          broadcastToUser(userId, 'notification:read', {
            id: notification.id,
            readAt: notification.readAt
          });

          // Broadcast updated unread count
          await this.broadcastUnreadCount(userId);
        }
      } catch (error) {
        console.error('[NotificationRealtime] Error marking notification read:', error);
      }
    });

    // Handle archive
    onUserEvent('notification:archive', async (userId, data) => {
      try {
        const notificationId = data.notificationId as string;
        if (!notificationId) return;

        const notification = await markNotificationArchived(notificationId);
        if (notification && notification.userId === userId) {
          // Broadcast archived status
          broadcastToUser(userId, 'notification:archived', {
            id: notification.id,
            archivedAt: notification.archivedAt
          });

          // Broadcast updated unread count
          await this.broadcastUnreadCount(userId);
        }
      } catch (error) {
        console.error('[NotificationRealtime] Error archiving notification:', error);
      }
    });

    // Handle mark all read
    onUserEvent('notification:mark-all-read', async (userId) => {
      try {
        const count = await markAllNotificationsRead(userId);

        // Broadcast all-read event
        broadcastToUser(userId, 'notification:all-read', { count });

        // Broadcast updated unread count (should be 0)
        await this.broadcastUnreadCount(userId);
      } catch (error) {
        console.error('[NotificationRealtime] Error marking all notifications read:', error);
      }
    });

    // Handle request for unread count
    onUserEvent('notification:get-unread-count', async (userId) => {
      try {
        await this.broadcastUnreadCount(userId);
      } catch (error) {
        console.error('[NotificationRealtime] Error getting unread count:', error);
      }
    });
  }

  /**
   * Broadcast unread count to a user
   */
  async broadcastUnreadCount(userId: string): Promise<void> {
    const count = await getUnreadCount(userId);
    broadcastToUser(userId, 'notification:unread-count', { count });
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const notificationRealtime = new NotificationRealtime();
