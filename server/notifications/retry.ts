/**
 * Retry Processor
 * Handles failed notification retries with exponential backoff
 */
import {
  getFailedDeliveries,
  getNotificationById,
  markDeliveryForRetry,
  updateDeliveryStatus
} from '../../database/db.js';
import { NotificationChannel, Notification, NotificationDelivery } from '../../types/notification.js';
import { inAppChannel } from './channels/in-app.js';
import { emailChannel } from './channels/email.js';
import { telegramChannel } from './channels/telegram.js';

// Exponential backoff intervals in minutes
const BACKOFF_MINUTES = [1, 5, 15, 60];
const MAX_RETRIES = 4;

// Channel interface for retry
interface RetryableChannel {
  send(notification: Notification): Promise<NotificationDelivery>;
}

/**
 * RetryProcessor handles retrying failed notification deliveries
 * with exponential backoff
 */
class RetryProcessor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  private channels: Record<NotificationChannel, RetryableChannel> = {
    in_app: inAppChannel,
    email: emailChannel,
    telegram: telegramChannel
  };

  /**
   * Start the retry processor
   * @param intervalMs - How often to check for retries (default: 1 minute)
   */
  start(intervalMs = 60000): void {
    if (this.intervalId) {
      console.warn('[RetryProcessor] Already running');
      return;
    }

    console.log(`[RetryProcessor] Starting with interval ${intervalMs}ms`);
    this.intervalId = setInterval(() => this.processRetries(), intervalMs);

    // Also run immediately on start
    this.processRetries();
  }

  /**
   * Stop the retry processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[RetryProcessor] Stopped');
    }
  }

  /**
   * Check if processor is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Calculate the next retry time based on retry count
   */
  private calculateNextRetry(retryCount: number): Date {
    const minutesIndex = Math.min(retryCount, BACKOFF_MINUTES.length - 1);
    const minutes = BACKOFF_MINUTES[minutesIndex];
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  /**
   * Process all pending retries
   */
  async processRetries(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get all failed deliveries that are due for retry
      const deliveries = await getFailedDeliveries();

      if (deliveries.length === 0) {
        return;
      }

      console.log(`[RetryProcessor] Processing ${deliveries.length} failed deliveries`);

      for (const delivery of deliveries) {
        await this.retryDelivery(delivery);
      }
    } catch (error) {
      console.error('[RetryProcessor] Error processing retries:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry a single delivery
   */
  private async retryDelivery(delivery: {
    id: string;
    notificationId: string;
    channel: string;
    retryCount: number;
  }): Promise<void> {
    // Get the original notification
    const notification = await getNotificationById(delivery.notificationId);
    if (!notification) {
      // Notification was deleted, mark delivery as skipped
      await updateDeliveryStatus(delivery.id, 'skipped', 'Notification deleted');
      return;
    }

    // Get the channel
    const channel = this.channels[delivery.channel as NotificationChannel];
    if (!channel) {
      await updateDeliveryStatus(delivery.id, 'failed', `Unknown channel: ${delivery.channel}`);
      return;
    }

    try {
      // Attempt to send
      await channel.send(notification);

      // Success! The channel will have updated the delivery status
      console.log(
        `[RetryProcessor] Retry successful for delivery ${delivery.id} (attempt ${delivery.retryCount + 1})`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (delivery.retryCount >= MAX_RETRIES - 1) {
        // Max retries exceeded, mark as permanently failed
        await updateDeliveryStatus(
          delivery.id,
          'failed',
          `Max retries (${MAX_RETRIES}) exceeded: ${errorMessage}`
        );
        console.warn(
          `[RetryProcessor] Delivery ${delivery.id} permanently failed after ${MAX_RETRIES} attempts`
        );
      } else {
        // Schedule next retry
        const nextRetry = this.calculateNextRetry(delivery.retryCount + 1);
        await markDeliveryForRetry(delivery.id, nextRetry.toISOString());
        console.log(
          `[RetryProcessor] Delivery ${delivery.id} scheduled for retry at ${nextRetry.toISOString()}`
        );
      }
    }
  }

  /**
   * Manually trigger retry processing (for testing)
   */
  async triggerProcessing(): Promise<void> {
    await this.processRetries();
  }

  /**
   * Get retry statistics
   */
  getStats(): { isRunning: boolean; isProcessing: boolean } {
    return {
      isRunning: this.isRunning(),
      isProcessing: this.isProcessing
    };
  }
}

// Singleton instance
export const retryProcessor = new RetryProcessor();
