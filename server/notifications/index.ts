/**
 * Notification System Exports
 * Main entry point for the notification module
 */

// Core components
export { notificationQueue } from './queue.js';
export { notificationDispatcher } from './dispatcher.js';
export { notificationPreferences } from './preferences.js';
export { notificationRealtime } from './realtime.js';
export { retryProcessor } from './retry.js';

// Template utilities
export { renderTemplate, renderHtmlTemplate, escapeHtml } from './templates.js';

// Channels
export { inAppChannel } from './channels/in-app.js';
export { emailChannel } from './channels/email.js';
export { telegramChannel } from './channels/telegram.js';

// Re-export types
export type {
  Notification,
  NotificationDelivery,
  NotificationTemplate,
  ChannelPreference,
  NotificationPriority,
  NotificationChannel,
  NotificationCategory,
  DeliveryStatus,
  CreateNotificationInput,
  NotificationListFilters,
  NotificationListResult
} from '../../types/notification.js';

/**
 * Convenience function to send a notification
 * This is the main entry point for other modules to send notifications
 *
 * @param userId - The user to notify
 * @param type - The notification type (must match a template)
 * @param data - Data to render the template with
 * @param priority - Optional priority (default: 'normal')
 * @returns The created notification, or null if deduplicated
 */
export async function notify(
  userId: string,
  type: string,
  data?: Record<string, unknown>,
  priority?: 'urgent' | 'high' | 'normal' | 'low'
): Promise<import('../../types/notification.js').Notification | null> {
  const { notificationQueue } = await import('./queue.js');
  return notificationQueue.enqueue({ userId, type, data, priority });
}

/**
 * Force send a notification (bypass deduplication)
 * Use for urgent notifications that must be delivered
 */
export async function notifyForce(
  userId: string,
  type: string,
  data?: Record<string, unknown>,
  priority?: 'urgent' | 'high' | 'normal' | 'low'
): Promise<import('../../types/notification.js').Notification> {
  const { notificationQueue } = await import('./queue.js');
  return notificationQueue.forceEnqueue({ userId, type, data, priority });
}

// Import instances for init/shutdown functions
import { notificationRealtime as realtime } from './realtime.js';
import { retryProcessor as retry } from './retry.js';
import { notificationQueue as queue } from './queue.js';
import { notificationPreferences as prefs } from './preferences.js';

/**
 * Initialize the notification system
 * Should be called during server startup
 */
export function initNotificationSystem(): void {
  // Initialize realtime (sets up event listeners)
  realtime.init();

  // Start retry processor (default: check every minute)
  retry.start(60000);

  console.log('[Notifications] System initialized');
}

/**
 * Shutdown the notification system
 * Should be called during graceful server shutdown
 */
export function shutdownNotificationSystem(): void {
  // Stop retry processor
  retry.stop();

  // Stop queue cleanup
  queue.stopCleanup();

  // Clear caches
  prefs.clearCache();

  console.log('[Notifications] System shut down');
}
