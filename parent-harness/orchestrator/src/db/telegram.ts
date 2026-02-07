/**
 * Telegram Message History Database
 * 
 * Tracks all messages sent to/from Telegram bots for
 * visibility in the dashboard and correlation with tasks.
 */

import { query, getOne, run } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface TelegramMessage {
  id: string;
  bot_type: string;           // 'build', 'qa', 'planning', etc.
  direction: 'outgoing' | 'incoming';
  chat_id: string;
  message_type: string;       // 'task_assigned', 'task_completed', etc.
  message_text: string;
  task_id: string | null;
  task_display_id: string | null;
  agent_id: string | null;
  session_id: string | null;
  telegram_message_id: number | null;  // Telegram's message ID if available
  sent_at: string;
  created_at: string;
}

// Ensure telegram_messages table exists
function ensureTelegramTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS telegram_messages (
      id TEXT PRIMARY KEY,
      bot_type TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'outgoing',
      chat_id TEXT NOT NULL,
      message_type TEXT NOT NULL,
      message_text TEXT NOT NULL,
      task_id TEXT,
      task_display_id TEXT,
      agent_id TEXT,
      session_id TEXT,
      telegram_message_id INTEGER,
      sent_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `, []);

  run(`CREATE INDEX IF NOT EXISTS idx_telegram_bot ON telegram_messages(bot_type)`, []);
  run(`CREATE INDEX IF NOT EXISTS idx_telegram_task ON telegram_messages(task_id)`, []);
  run(`CREATE INDEX IF NOT EXISTS idx_telegram_agent ON telegram_messages(agent_id)`, []);
  run(`CREATE INDEX IF NOT EXISTS idx_telegram_sent ON telegram_messages(sent_at)`, []);
}

ensureTelegramTable();

/**
 * Log a sent telegram message
 */
export function logTelegramMessage(input: {
  botType: string;
  chatId: string;
  messageType: string;
  messageText: string;
  taskId?: string;
  taskDisplayId?: string;
  agentId?: string;
  sessionId?: string;
  telegramMessageId?: number;
  direction?: 'outgoing' | 'incoming';
}): TelegramMessage {
  const id = uuidv4();
  const sentAt = new Date().toISOString();

  run(`
    INSERT INTO telegram_messages (
      id, bot_type, direction, chat_id, message_type, message_text,
      task_id, task_display_id, agent_id, session_id, telegram_message_id, sent_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    input.botType,
    input.direction || 'outgoing',
    input.chatId,
    input.messageType,
    input.messageText,
    input.taskId || null,
    input.taskDisplayId || null,
    input.agentId || null,
    input.sessionId || null,
    input.telegramMessageId || null,
    sentAt,
  ]);

  return {
    id,
    bot_type: input.botType,
    direction: input.direction || 'outgoing',
    chat_id: input.chatId,
    message_type: input.messageType,
    message_text: input.messageText,
    task_id: input.taskId || null,
    task_display_id: input.taskDisplayId || null,
    agent_id: input.agentId || null,
    session_id: input.sessionId || null,
    telegram_message_id: input.telegramMessageId || null,
    sent_at: sentAt,
    created_at: sentAt,
  };
}

/**
 * Get messages with filters
 */
export function getTelegramMessages(filters?: {
  botType?: string;
  taskId?: string;
  agentId?: string;
  direction?: 'outgoing' | 'incoming';
  since?: string;
  limit?: number;
  offset?: number;
}): TelegramMessage[] {
  let sql = 'SELECT * FROM telegram_messages WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.botType) {
    sql += ' AND bot_type = ?';
    params.push(filters.botType);
  }
  if (filters?.taskId) {
    sql += ' AND task_id = ?';
    params.push(filters.taskId);
  }
  if (filters?.agentId) {
    sql += ' AND agent_id = ?';
    params.push(filters.agentId);
  }
  if (filters?.direction) {
    sql += ' AND direction = ?';
    params.push(filters.direction);
  }
  if (filters?.since) {
    sql += ' AND sent_at >= ?';
    params.push(filters.since);
  }

  sql += ' ORDER BY sent_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  if (filters?.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return query<TelegramMessage>(sql, params);
}

/**
 * Get messages grouped by bot type (for channel view)
 */
export function getMessagesByChannel(limit: number = 50): Record<string, TelegramMessage[]> {
  const messages = getTelegramMessages({ limit: limit * 10 }); // Get more to distribute
  
  const grouped: Record<string, TelegramMessage[]> = {};
  
  for (const msg of messages) {
    if (!grouped[msg.bot_type]) {
      grouped[msg.bot_type] = [];
    }
    if (grouped[msg.bot_type].length < limit) {
      grouped[msg.bot_type].push(msg);
    }
  }
  
  return grouped;
}

/**
 * Get message stats
 */
export function getTelegramStats(): {
  total: number;
  byBot: Record<string, number>;
  byType: Record<string, number>;
  last24h: number;
} {
  const total = getOne<{ count: number }>('SELECT COUNT(*) as count FROM telegram_messages')?.count || 0;
  
  const byBotRows = query<{ bot_type: string; count: number }>(
    'SELECT bot_type, COUNT(*) as count FROM telegram_messages GROUP BY bot_type'
  );
  const byBot: Record<string, number> = {};
  for (const row of byBotRows) {
    byBot[row.bot_type] = row.count;
  }
  
  const byTypeRows = query<{ message_type: string; count: number }>(
    'SELECT message_type, COUNT(*) as count FROM telegram_messages GROUP BY message_type'
  );
  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    byType[row.message_type] = row.count;
  }
  
  const last24h = getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM telegram_messages WHERE sent_at > datetime('now', '-1 day')"
  )?.count || 0;
  
  return { total, byBot, byType, last24h };
}

/**
 * Get messages for a specific task
 */
export function getMessagesForTask(taskId: string): TelegramMessage[] {
  return query<TelegramMessage>(
    'SELECT * FROM telegram_messages WHERE task_id = ? OR task_display_id = ? ORDER BY sent_at ASC',
    [taskId, taskId]
  );
}

export default {
  logTelegramMessage,
  getTelegramMessages,
  getMessagesByChannel,
  getTelegramStats,
  getMessagesForTask,
};
