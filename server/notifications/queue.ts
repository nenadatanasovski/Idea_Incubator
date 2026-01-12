/**
 * Notification Queue
 * Handles notification creation with deduplication and template rendering
 */
import { EventEmitter } from 'events';
import {
  createNotification,
  getTemplate
} from '../../database/db.js';
import {
  CreateNotificationInput,
  Notification,
  NotificationCategory
} from '../../types/notification.js';
import { renderTemplate } from './templates.js';

/**
 * NotificationQueue manages the creation and queuing of notifications
 * - Applies templates to generate title/body
 * - Deduplicates similar notifications within a time window
 * - Emits events for new notifications
 */
class NotificationQueue extends EventEmitter {
  private dedupeCache = new Map<string, number>();
  private readonly DEDUPE_TTL = 60 * 60 * 1000; // 1 hour

  // Clean up expired dedup entries periodically
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of expired dedup cache entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.dedupeCache.entries()) {
        if (now - timestamp > this.DEDUPE_TTL) {
          this.dedupeCache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generate a deduplication key from the input
   * Key is based on userId + type + data hash
   */
  private getDedupeKey(input: CreateNotificationInput): string {
    const dataStr = input.data ? JSON.stringify(input.data) : '';
    return `${input.userId}:${input.type}:${dataStr}`;
  }

  /**
   * Determine category from notification type
   */
  private getCategoryFromType(type: string): NotificationCategory {
    if (type.startsWith('agent_')) return 'agent';
    if (type.startsWith('session_')) return 'session';
    if (type.startsWith('build_')) return 'build';
    if (type.startsWith('evaluation_')) return 'evaluation';
    if (type.startsWith('idea_')) return 'idea';
    return 'system';
  }

  /**
   * Check if a notification is a duplicate (sent within the TTL window)
   */
  isDuplicate(input: CreateNotificationInput): boolean {
    const dedupeKey = this.getDedupeKey(input);
    const lastSent = this.dedupeCache.get(dedupeKey);
    return !!(lastSent && Date.now() - lastSent < this.DEDUPE_TTL);
  }

  /**
   * Enqueue a new notification
   * Returns null if deduplicated, the notification if created
   */
  async enqueue(input: CreateNotificationInput): Promise<Notification | null> {
    // Check deduplication
    const dedupeKey = this.getDedupeKey(input);
    const lastSent = this.dedupeCache.get(dedupeKey);

    if (lastSent && Date.now() - lastSent < this.DEDUPE_TTL) {
      // Duplicate notification, skip
      return null;
    }

    // Get template for this notification type
    const template = await getTemplate(input.type);
    if (!template) {
      console.error(`[NotificationQueue] Unknown notification type: ${input.type}`);
      throw new Error(`Unknown notification type: ${input.type}`);
    }

    // Render title and body from template
    const data = input.data || {};
    const title = input.title || renderTemplate(template.titleTemplate, data);
    const body = input.body || renderTemplate(template.bodyTemplate, data);
    const category = input.category || this.getCategoryFromType(input.type);

    // Create the notification in the database
    const notification = await createNotification({
      ...input,
      title,
      body,
      category
    });

    // Update dedup cache
    this.dedupeCache.set(dedupeKey, Date.now());

    // Emit event for dispatching
    this.emit('notification', notification);

    return notification;
  }

  /**
   * Force enqueue (bypass deduplication)
   * Use for urgent/high priority notifications that must be sent
   */
  async forceEnqueue(input: CreateNotificationInput): Promise<Notification> {
    const template = await getTemplate(input.type);
    if (!template) {
      throw new Error(`Unknown notification type: ${input.type}`);
    }

    const data = input.data || {};
    const title = input.title || renderTemplate(template.titleTemplate, data);
    const body = input.body || renderTemplate(template.bodyTemplate, data);
    const category = input.category || this.getCategoryFromType(input.type);

    const notification = await createNotification({
      ...input,
      title,
      body,
      category
    });

    // Update dedup cache even for forced notifications
    const dedupeKey = this.getDedupeKey(input);
    this.dedupeCache.set(dedupeKey, Date.now());

    this.emit('notification', notification);

    return notification;
  }

  /**
   * Clear the dedup cache (useful for testing)
   */
  clearDedupeCache(): void {
    this.dedupeCache.clear();
  }

  /**
   * Get the size of the dedup cache (for monitoring)
   */
  getDedupeCacheSize(): number {
    return this.dedupeCache.size;
  }
}

// Singleton instance
export const notificationQueue = new NotificationQueue();
