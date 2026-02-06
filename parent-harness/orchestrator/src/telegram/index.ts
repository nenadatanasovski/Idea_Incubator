/**
 * Telegram Bot Integration
 * 
 * Sends notifications to agent-specific Telegram channels
 * for task updates, errors, and status changes.
 */

import TelegramBot from 'node-telegram-bot-api';
import * as agents from '../db/agents.js';

// Get token from environment
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

let bot: TelegramBot | null = null;

/**
 * Initialize the Telegram bot
 */
export function initTelegram(): boolean {
  if (!BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set - Telegram notifications disabled');
    return false;
  }

  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: false });
    console.log('📱 Telegram bot initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error);
    return false;
  }
}

/**
 * Send a message to a chat
 */
export async function sendMessage(
  chatId: string | number,
  message: string,
  options?: { parseMode?: 'HTML' | 'Markdown' }
): Promise<boolean> {
  if (!bot) return false;

  try {
    await bot.sendMessage(chatId, message, {
      parse_mode: options?.parseMode || 'HTML',
    });
    return true;
  } catch (error) {
    console.error(`Failed to send Telegram message to ${chatId}:`, error);
    return false;
  }
}

/**
 * Send notification to admin channel
 */
export async function notifyAdmin(message: string): Promise<boolean> {
  if (!ADMIN_CHAT_ID) return false;
  return sendMessage(ADMIN_CHAT_ID, message);
}

/**
 * Send notification to an agent's channel
 */
export async function notifyAgent(agentId: string, message: string): Promise<boolean> {
  const agent = agents.getAgent(agentId);
  if (!agent?.telegram_channel) return false;

  // telegram_channel format: @channel_name or chat_id
  const chatId = agent.telegram_channel.startsWith('@') 
    ? agent.telegram_channel 
    : agent.telegram_channel;

  return sendMessage(chatId, message);
}

/**
 * Notification templates
 */
export const notify = {
  /**
   * Task assigned to agent
   */
  taskAssigned: async (agentId: string, taskDisplayId: string, taskTitle: string) => {
    const message = `📋 <b>Task Assigned</b>\n\n<code>${taskDisplayId}</code>\n${taskTitle}`;
    await notifyAgent(agentId, message);
    await notifyAdmin(`📋 ${taskDisplayId} → ${agentId}`);
  },

  /**
   * Task completed
   */
  taskCompleted: async (agentId: string, taskDisplayId: string, taskTitle: string) => {
    const message = `✅ <b>Task Completed</b>\n\n<code>${taskDisplayId}</code>\n${taskTitle}`;
    await notifyAgent(agentId, message);
    await notifyAdmin(`✅ ${taskDisplayId} completed by ${agentId}`);
  },

  /**
   * Task failed
   */
  taskFailed: async (agentId: string, taskDisplayId: string, error: string) => {
    const message = `❌ <b>Task Failed</b>\n\n<code>${taskDisplayId}</code>\n${error}`;
    await notifyAgent(agentId, message);
    await notifyAdmin(`❌ ${taskDisplayId} failed: ${error}`);
  },

  /**
   * Agent stuck
   */
  agentStuck: async (agentId: string, taskDisplayId?: string) => {
    const message = taskDisplayId
      ? `⚠️ <b>Agent Stuck</b>\n\nWorking on: <code>${taskDisplayId}</code>\nNo response for 15+ minutes`
      : `⚠️ <b>Agent Stuck</b>\n\nNo response for 15+ minutes`;
    await notifyAgent(agentId, message);
    await notifyAdmin(`⚠️ ${agentId} stuck${taskDisplayId ? ` on ${taskDisplayId}` : ''}`);
  },

  /**
   * Agent error
   */
  agentError: async (agentId: string, error: string) => {
    const message = `🔴 <b>Agent Error</b>\n\n${error}`;
    await notifyAgent(agentId, message);
    await notifyAdmin(`🔴 ${agentId} error: ${error}`);
  },

  /**
   * QA passed
   */
  qaPassed: async (agentId: string, taskDisplayId: string) => {
    const message = `✅ <b>QA Passed</b>\n\n<code>${taskDisplayId}</code>`;
    await notifyAgent(agentId, message);
  },

  /**
   * QA failed
   */
  qaFailed: async (agentId: string, taskDisplayId: string, reason: string) => {
    const message = `❌ <b>QA Failed</b>\n\n<code>${taskDisplayId}</code>\n${reason}`;
    await notifyAgent(agentId, message);
    await notifyAdmin(`❌ QA failed for ${taskDisplayId}: ${reason}`);
  },

  /**
   * Wave started
   */
  waveStarted: async (waveNumber: number, taskCount: number) => {
    await notifyAdmin(`🌊 Wave ${waveNumber} started with ${taskCount} tasks`);
  },

  /**
   * Wave completed
   */
  waveCompleted: async (waveNumber: number, passed: number, failed: number) => {
    const status = failed > 0 ? '⚠️' : '✅';
    await notifyAdmin(`${status} Wave ${waveNumber} complete: ${passed} passed, ${failed} failed`);
  },

  /**
   * System status
   */
  systemStatus: async (workingCount: number, idleCount: number, pendingTasks: number) => {
    const message = `📊 <b>System Status</b>\n\n` +
      `Agents: ${workingCount} working, ${idleCount} idle\n` +
      `Pending tasks: ${pendingTasks}`;
    await notifyAdmin(message);
  },

  /**
   * Tool use notification
   */
  toolUse: async (agentId: string, toolName: string, args: Record<string, unknown>) => {
    const argsStr = JSON.stringify(args).slice(0, 100);
    const message = `🔧 <b>${toolName}</b>\n<code>${argsStr}${argsStr.length >= 100 ? '...' : ''}</code>`;
    await notifyAgent(agentId, message);
  },

  /**
   * File edit notification
   */
  fileEdit: async (agentId: string, filePath: string, linesChanged: number) => {
    const fileName = filePath.split('/').pop() || filePath;
    const message = `✏️ <b>File Modified</b>\n<code>${fileName}</code>\n${linesChanged} lines`;
    await notifyAgent(agentId, message);
    await notifyAdmin(`✏️ ${agentId}: ${fileName} (${linesChanged} lines)`);
  },

  /**
   * Command execution notification
   */
  commandRun: async (agentId: string, command: string, success: boolean) => {
    const icon = success ? '✅' : '❌';
    const cmdShort = command.length > 50 ? command.slice(0, 50) + '...' : command;
    const message = `${icon} <code>${cmdShort}</code>`;
    await notifyAgent(agentId, message);
  },

  /**
   * Session started
   */
  sessionStarted: async (agentId: string, taskDisplayId: string) => {
    const message = `🚀 <b>Session Started</b>\n\nWorking on: <code>${taskDisplayId}</code>`;
    await notifyAgent(agentId, message);
  },

  /**
   * Session iteration
   */
  sessionIteration: async (agentId: string, iteration: number, maxIterations: number) => {
    const message = `📍 Iteration ${iteration}/${maxIterations}`;
    await notifyAgent(agentId, message);
  },
};

export default {
  initTelegram,
  sendMessage,
  notifyAdmin,
  notifyAgent,
  notify,
};
