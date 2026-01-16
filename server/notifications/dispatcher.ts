/**
 * Notification Dispatcher
 * Routes notifications to appropriate channels based on user preferences
 */
import { Notification, NotificationChannel } from "../../types/notification.js";
import { notificationPreferences } from "./preferences.js";
import { inAppChannel } from "./channels/in-app.js";
import { emailChannel } from "./channels/email.js";
import { telegramChannel } from "./channels/telegram.js";

/**
 * Channel interface for type-safe dispatch
 */
interface Channel {
  send(notification: Notification): Promise<unknown>;
}

/**
 * NotificationDispatcher routes notifications to the appropriate channels
 * based on user preferences
 */
class NotificationDispatcher {
  private channels: Record<NotificationChannel, Channel> = {
    in_app: inAppChannel,
    email: emailChannel,
    telegram: telegramChannel,
  };

  /**
   * Dispatch a notification to all configured channels for the user
   */
  async dispatch(notification: Notification): Promise<void> {
    // Get effective channels for this user and notification type
    const channels = await notificationPreferences.getChannels(
      notification.userId,
      notification.type,
    );

    if (channels.length === 0) {
      console.log(
        `[Dispatcher] Notification ${notification.id} skipped - no active channels for user ${notification.userId}`,
      );
      return;
    }

    console.log(
      `[Dispatcher] Dispatching notification ${notification.id} to channels: ${channels.join(", ")}`,
    );

    // Dispatch to all channels in parallel
    // Each channel handles its own error reporting
    const results = await Promise.allSettled(
      channels.map(async (channelName) => {
        const channel = this.channels[channelName];
        if (!channel) {
          console.warn(`[Dispatcher] Unknown channel: ${channelName}`);
          return;
        }

        try {
          await channel.send(notification);
        } catch (error) {
          // Log but don't fail other channels
          console.error(
            `[Dispatcher] Channel ${channelName} failed for notification ${notification.id}:`,
            error,
          );
          throw error; // Re-throw so Promise.allSettled captures it
        }
      }),
    );

    // Log results summary
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      console.warn(
        `[Dispatcher] Notification ${notification.id}: ${succeeded} succeeded, ${failed} failed`,
      );
    }
  }

  /**
   * Dispatch to a specific channel (bypass preferences)
   * Useful for retry logic or testing
   */
  async dispatchToChannel(
    notification: Notification,
    channelName: NotificationChannel,
  ): Promise<void> {
    const channel = this.channels[channelName];
    if (!channel) {
      throw new Error(`Unknown channel: ${channelName}`);
    }
    await channel.send(notification);
  }

  /**
   * Get available channel names
   */
  getAvailableChannels(): NotificationChannel[] {
    return Object.keys(this.channels) as NotificationChannel[];
  }
}

// Singleton instance
export const notificationDispatcher = new NotificationDispatcher();
