/**
 * Notification API Routes
 * Handles notification listing, read/archive actions, and preferences
 */
import { Router, Request, Response } from 'express';
import {
  getNotifications,
  getNotificationCount,
  getUnreadCount,
  getNotificationById,
  markNotificationRead,
  markNotificationArchived,
  markAllNotificationsRead,
  getAllUserChannelPrefs,
  getAllTemplates
} from '../../database/db.js';
import { notificationPreferences } from '../notifications/preferences.js';
import { notificationRealtime } from '../notifications/realtime.js';
import { NotificationChannel, NotificationCategory } from '../../types/notification.js';

const router = Router();

function getUserId(req: Request): string {
  return (req as Request & { user?: { id: string } }).user?.id
    || req.headers['x-user-id'] as string
    || 'anonymous';
}

async function verifyNotificationAccess(req: Request, res: Response): Promise<{ userId: string; notificationId: string } | null> {
  const userId = getUserId(req);
  const notification = await getNotificationById(req.params.id);

  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return null;
  }
  if (notification.userId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return null;
  }
  return { userId, notificationId: notification.id };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread === 'true';
    const category = req.query.category as NotificationCategory | undefined;
    const type = req.query.type as string | undefined;

    const [notifications, total, unreadCount] = await Promise.all([
      getNotifications(userId, { limit, offset, unreadOnly, category, type }),
      getNotificationCount(userId, { unreadOnly, category, type }),
      getUnreadCount(userId)
    ]);

    res.json({ notifications, total, unreadCount, limit, offset });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    res.json({ count: await getUnreadCount(getUserId(req)) });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const access = await verifyNotificationAccess(req, res);
    if (!access) return;
    return res.json(await getNotificationById(req.params.id));
  } catch (error) {
    console.error('Error getting notification:', error);
    return res.status(500).json({ error: 'Failed to get notification' });
  }
});

router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const access = await verifyNotificationAccess(req, res);
    if (!access) return;

    const updated = await markNotificationRead(req.params.id);
    await notificationRealtime.broadcastUnreadCount(access.userId);
    return res.json(updated);
  } catch (error) {
    console.error('Error marking notification read:', error);
    return res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

router.post('/:id/archive', async (req: Request, res: Response) => {
  try {
    const access = await verifyNotificationAccess(req, res);
    if (!access) return;

    const updated = await markNotificationArchived(req.params.id);
    await notificationRealtime.broadcastUnreadCount(access.userId);
    return res.json(updated);
  } catch (error) {
    console.error('Error archiving notification:', error);
    return res.status(500).json({ error: 'Failed to archive notification' });
  }
});

router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const count = await markAllNotificationsRead(userId);
    await notificationRealtime.broadcastUnreadCount(userId);
    res.json({ count, message: `Marked ${count} notifications as read` });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications read' });
  }
});

// ==================== Preferences ====================

/**
 * GET /api/notifications/preferences
 * Get all notification preferences for the current user
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const preferences = await getAllUserChannelPrefs(userId);

    // Also get available templates to show all notification types
    const templates = await getAllTemplates();

    res.json({
      preferences,
      availableTypes: templates.map((t) => ({
        type: t.type,
        title: t.titleTemplate,
        defaultChannels: t.defaultChannels
      }))
    });
  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 * Body: { preferences: [{ notificationType, channels, mutedUntil? }] }
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { preferences } = req.body as {
      preferences: Array<{
        notificationType: string;
        channels: NotificationChannel[];
        mutedUntil?: string;
      }>;
    };

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: 'preferences must be an array' });
    }

    // Validate and update each preference
    for (const pref of preferences) {
      if (!pref.notificationType) {
        return res.status(400).json({ error: 'notificationType is required' });
      }

      if (!Array.isArray(pref.channels)) {
        return res.status(400).json({ error: 'channels must be an array' });
      }

      // Validate channel values
      const validChannels: NotificationChannel[] = ['in_app', 'email', 'telegram'];
      for (const ch of pref.channels) {
        if (!validChannels.includes(ch)) {
          return res.status(400).json({ error: `Invalid channel: ${ch}` });
        }
      }

      await notificationPreferences.setPreference(
        userId,
        pref.notificationType,
        pref.channels,
        pref.mutedUntil
      );
    }

    // Return updated preferences
    const updatedPreferences = await getAllUserChannelPrefs(userId);
    return res.json({ preferences: updatedPreferences });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * POST /api/notifications/preferences/:type/mute
 * Mute a notification type
 * Body: { duration: number } - duration in minutes
 */
router.post('/preferences/:type/mute', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { type } = req.params;
    const { duration } = req.body as { duration: number };

    if (!duration || typeof duration !== 'number' || duration <= 0) {
      return res.status(400).json({ error: 'duration must be a positive number (minutes)' });
    }

    // Convert minutes to milliseconds
    const durationMs = duration * 60 * 1000;
    const pref = await notificationPreferences.mute(userId, type, durationMs);

    return res.json(pref);
  } catch (error) {
    console.error('Error muting notification type:', error);
    return res.status(500).json({ error: 'Failed to mute notification type' });
  }
});

/**
 * POST /api/notifications/preferences/:type/unmute
 * Unmute a notification type
 */
router.post('/preferences/:type/unmute', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { type } = req.params;

    const pref = await notificationPreferences.unmute(userId, type);

    return res.json(pref);
  } catch (error) {
    console.error('Error unmuting notification type:', error);
    return res.status(500).json({ error: 'Failed to unmute notification type' });
  }
});

// ==================== Templates (for admin/debugging) ====================

/**
 * GET /api/notifications/templates
 * Get all notification templates
 */
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await getAllTemplates();
    res.json({ templates });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

/**
 * POST /api/notifications/test-telegram
 * Send a test notification via Telegram (direct API call)
 */
router.post('/test-telegram', async (req: Request, res: Response) => {
  try {
    const { message, botType = 'monitor' } = req.body;

    // Get test chat ID from environment
    const testChatId = process.env.TELEGRAM_TEST_CHAT_ID;
    if (!testChatId) {
      return res.status(400).json({
        error: 'TELEGRAM_TEST_CHAT_ID not configured in environment',
      });
    }

    // Get bot token based on type
    const { getBotToken } = await import('../communication/config.js');
    const agentTypeMap: Record<string, 'monitoring' | 'orchestrator' | 'spec' | 'build' | 'validation' | 'sia' | 'system'> = {
      monitor: 'monitoring',
      monitoring: 'monitoring',
      orchestrator: 'orchestrator',
      spec: 'spec',
      build: 'build',
      validation: 'validation',
      sia: 'sia',
      system: 'system',
    };

    // Map input to AgentType (defaults to system for unknown types)
    type AgentType = 'monitoring' | 'orchestrator' | 'spec' | 'build' | 'validation' | 'sia' | 'system';
    const agentType = (agentTypeMap[botType] || 'system') as AgentType;
    const botToken = getBotToken(agentType);

    if (!botToken) {
      return res.status(400).json({
        error: `No bot token configured for agent type: ${botType}`,
      });
    }

    // Send directly via Telegram API
    const text = message || `🧪 *Test Notification*\n\nFrom: Task Executor\nTime: ${new Date().toISOString()}\nBot Type: ${botType}`;

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: testChatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    const data = await telegramResponse.json();

    if (data.ok) {
      return res.json({
        success: true,
        messageId: data.result?.message_id,
        chatId: testChatId,
        botType,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: data.description,
        errorCode: data.error_code,
      });
    }
  } catch (error) {
    console.error('Error sending test Telegram notification:', error);
    return res.status(500).json({
      error: 'Failed to send test notification',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
