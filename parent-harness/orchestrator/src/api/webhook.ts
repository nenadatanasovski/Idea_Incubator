/**
 * Telegram Webhook Router
 * 
 * Receives incoming updates from Telegram for each bot type.
 * Parses commands and routes to appropriate handlers.
 */
import { Router, Request, Response } from 'express';
import { logTelegramMessage } from '../db/telegram.js';
import { ws } from '../websocket.js';

// Webhook secret for verification (set when registering webhooks)
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'harness-webhook-secret-2026';

// Admin chat ID - only accept commands from admin
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '8397599412';

export const webhookRouter = Router();

// Command handlers registry
type CommandHandler = (args: string[], chatId: string, messageId: number, botType: string) => Promise<string | void>;
const commandHandlers: Map<string, Map<string, CommandHandler>> = new Map();

/**
 * Register a command handler for a specific bot type
 */
export function registerCommand(botType: string, command: string, handler: CommandHandler): void {
  if (!commandHandlers.has(botType)) {
    commandHandlers.set(botType, new Map());
  }
  commandHandlers.get(botType)!.set(command.toLowerCase(), handler);
  console.log(`📝 Registered command /${command} for ${botType} bot`);
}

/**
 * Register a command handler for all bot types
 */
export function registerGlobalCommand(command: string, handler: CommandHandler): void {
  const botTypes = ['system', 'monitor', 'orchestrator', 'build', 'spec', 'validation', 'sia', 'planning', 'clarification', 'human'];
  for (const botType of botTypes) {
    registerCommand(botType, command, handler);
  }
}

/**
 * Parse command and arguments from message text
 */
function parseCommand(text: string): { command: string; args: string[] } | null {
  if (!text || !text.startsWith('/')) return null;
  
  const parts = text.trim().split(/\s+/);
  const command = parts[0].slice(1).toLowerCase().split('@')[0]; // Remove / and @botname
  const args = parts.slice(1);
  
  return { command, args };
}

/**
 * Telegram Update object (simplified)
 */
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
    reply_to_message?: {
      message_id: number;
      text?: string;
    };
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: { id: number };
    };
    data?: string;
  };
}

/**
 * Process incoming webhook update
 */
async function processUpdate(botType: string, update: TelegramUpdate): Promise<string | null> {
  // Handle regular messages
  if (update.message?.text) {
    const msg = update.message;
    const chatId = String(msg.chat.id);
    const messageId = msg.message_id;
    const text = msg.text || '';
    const fromId = String(msg.from?.id || '');
    
    // Log incoming message
    const logged = logTelegramMessage({
      botType,
      chatId,
      direction: 'incoming',
      messageType: 'command',
      messageText: text || '(empty)',
      telegramMessageId: messageId,
      agentId: botType,
    });
    
    // Broadcast via WebSocket
    ws.telegramMessage(logged);
    
    // Security: Only process commands from admin
    if (chatId !== ADMIN_CHAT_ID && fromId !== ADMIN_CHAT_ID) {
      console.log(`⚠️ Ignoring message from non-admin: ${fromId}`);
      return null;
    }
    
    // Parse command
    const parsed = parseCommand(text);
    if (!parsed) {
      // Not a command, just log it
      return null;
    }
    
    const { command, args } = parsed;
    console.log(`📨 Received /${command} from ${botType} bot: ${args.join(' ')}`);
    
    // Find handler
    const botHandlers = commandHandlers.get(botType);
    const handler = botHandlers?.get(command);
    
    if (handler) {
      try {
        const response = await handler(args, chatId, messageId, botType);
        return response || null;
      } catch (err) {
        console.error(`❌ Command handler error:`, err);
        return `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    } else {
      // Unknown command
      const availableCommands = botHandlers ? Array.from(botHandlers.keys()).map(c => `/${c}`).join(', ') : 'none';
      return `Unknown command: /${command}\n\nAvailable: ${availableCommands}`;
    }
  }
  
  // Handle callback queries (inline button clicks)
  if (update.callback_query) {
    const query = update.callback_query;
    const data = query.data || '';
    const chatId = String(query.message?.chat.id || '');
    const messageId = query.message?.message_id || 0;
    
    console.log(`🔘 Callback query from ${botType}: ${data}`);
    
    // Log callback
    logTelegramMessage({
      botType,
      chatId,
      direction: 'incoming',
      messageType: 'callback',
      messageText: data,
      telegramMessageId: messageId,
      agentId: botType,
    });
    
    // Parse callback data as command
    // Format: command:arg1:arg2:...
    const parts = data.split(':');
    const command = parts[0];
    const args = parts.slice(1);
    
    const botHandlers = commandHandlers.get(botType);
    const handler = botHandlers?.get(command);
    
    if (handler) {
      try {
        const response = await handler(args, chatId, messageId, botType);
        return response || '✅';
      } catch (err) {
        console.error(`❌ Callback handler error:`, err);
        return `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    }
  }
  
  return null;
}

/**
 * Webhook endpoint for each bot type
 * POST /webhook/:botType
 */
webhookRouter.post('/:botType', async (req: Request, res: Response) => {
  const botType = String(req.params.botType);
  
  // Verify secret token (Telegram sends this in header)
  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
  if (secretHeader !== WEBHOOK_SECRET) {
    console.warn(`⚠️ Invalid webhook secret for ${botType}`);
    res.status(401).json({ error: 'Invalid secret' });
    return;
  }
  
  const update = req.body as TelegramUpdate;
  
  // Respond immediately (Telegram expects quick response)
  res.status(200).json({ ok: true });
  
  // Process update async
  try {
    const response = await processUpdate(botType, update);
    
    // If handler returned a response, send it back
    if (response) {
      const { notifyAgent } = await import('../telegram/direct-telegram.js');
      await notifyAgent(botType, response);
    }
  } catch (err) {
    console.error(`❌ Webhook processing error:`, err);
  }
});

/**
 * Get webhook status
 * GET /webhook/status
 */
webhookRouter.get('/status', (_req: Request, res: Response) => {
  const handlers: Record<string, string[]> = {};
  
  for (const [botType, cmds] of commandHandlers) {
    handlers[botType] = Array.from(cmds.keys()).map(c => `/${c}`);
  }
  
  res.json({
    webhookSecret: WEBHOOK_SECRET ? 'configured' : 'not set',
    adminChatId: ADMIN_CHAT_ID,
    registeredHandlers: handlers,
  });
});

export default webhookRouter;
