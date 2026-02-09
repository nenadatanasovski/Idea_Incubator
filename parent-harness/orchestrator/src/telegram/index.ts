/**
 * Telegram Notifications - Multi-Bot Architecture
 * 
 * Re-exports from direct-telegram.ts.
 * Each agent type has its own dedicated bot.
 */

export {
  initTelegram,
  sendMessage,
  notifyAdmin,
  notifyAgent,
  notify,
  sendToBot,
  validateTelegramConfigOrThrow,
  default,
} from './direct-telegram.js';
