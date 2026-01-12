/**
 * Types for Notification System
 */

// Priority levels for notifications
export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

// Available delivery channels
export type NotificationChannel = 'in_app' | 'email' | 'telegram';

// Delivery status
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped';

// Notification categories
export type NotificationCategory = 'agent' | 'session' | 'system' | 'build' | 'evaluation' | 'idea';

/**
 * Main notification interface
 */
export interface Notification {
  id: string;
  userId: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  priority: NotificationPriority;
  readAt: string | null;
  archivedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * Notification as stored in database (snake_case)
 */
export interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  data: string | null;
  priority: string;
  read_at: string | null;
  archived_at: string | null;
  expires_at: string | null;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Delivery tracking for each channel
 */
export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  error: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

/**
 * Delivery as stored in database (snake_case)
 */
export interface DbNotificationDelivery {
  id: string;
  notification_id: string;
  channel: string;
  status: string;
  error: string | null;
  retry_count: number;
  next_retry_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  [key: string]: unknown;
}

/**
 * Notification template for rendering
 */
export interface NotificationTemplate {
  id: string;
  type: string;
  titleTemplate: string;
  bodyTemplate: string;
  emailSubject: string | null;
  emailBody: string | null;
  telegramText: string | null;
  defaultChannels: NotificationChannel[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Template as stored in database (snake_case)
 */
export interface DbNotificationTemplate {
  id: string;
  type: string;
  title_template: string;
  body_template: string;
  email_subject: string | null;
  email_body: string | null;
  telegram_text: string | null;
  default_channels: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * User channel preference for a notification type
 */
export interface ChannelPreference {
  id: string;
  userId: string;
  notificationType: string;
  channels: NotificationChannel[];
  mutedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Channel preference as stored in database (snake_case)
 */
export interface DbChannelPreference {
  id: string;
  user_id: string;
  notification_type: string;
  channels: string;
  muted_until: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * Input for creating a notification
 */
export interface CreateNotificationInput {
  userId: string;
  type: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  expiresAt?: string;
  // These are optional - will be filled from template if not provided
  title?: string;
  body?: string;
  category?: NotificationCategory;
}

/**
 * Filter options for listing notifications
 */
export interface NotificationListFilters {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  category?: NotificationCategory;
  type?: string;
}

/**
 * Result of listing notifications
 */
export interface NotificationListResult {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

/**
 * WebSocket notification event
 */
export interface NotificationEvent {
  event: string;
  data: Notification | { id: string; readAt: string } | { count: number };
}

/**
 * Digest configuration
 */
export type DigestType = 'hourly' | 'daily' | 'weekly';

export interface NotificationDigest {
  id: string;
  userId: string;
  digestType: DigestType;
  notificationIds: string[];
  sentAt: string | null;
  createdAt: string;
}
