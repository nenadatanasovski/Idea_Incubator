/**
 * Direct Telegram Bot API Integration
 * 
 * NO OpenClaw. Direct HTTPS calls to Telegram Bot API.
 * Each agent type has its own dedicated channel (loaded from database).
 */

import * as agents from '../db/agents.js';

// Bot token from environment
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Admin channel (fallback for all notifications)
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';

/**
 * Send a message directly via Telegram Bot API
 */
async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'Markdown'
): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set, skipping notification');
    return false;
  }

  if (!chatId) {
    console.warn('⚠️ No chat ID provided, skipping notification');
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn(`❌ Telegram API error (${response.status}):`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`❌ Telegram send failed:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Get the channel for an agent (from database or fallback to admin)
 */
function getAgentChannel(agentId: string): string {
  try {
    const agent = agents.getAgent(agentId);
    if (agent?.telegram_channel) {
      return agent.telegram_channel;
    }
  } catch {
    // Database might not be ready
  }
  return ADMIN_CHAT_ID;
}

/**
 * Get the channel for an agent type (find first agent of that type)
 */
function getAgentTypeChannel(agentType: string): string {
  try {
    const allAgents = agents.getAgents();
    const agent = allAgents.find(a => a.type === agentType || a.id === agentType || a.id === `${agentType}_agent`);
    if (agent?.telegram_channel) {
      return agent.telegram_channel;
    }
  } catch {
    // Database might not be ready
  }
  return ADMIN_CHAT_ID;
}

/**
 * Initialize Telegram (validate token)
 */
export async function initTelegram(): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set - Telegram notifications disabled');
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/getMe`);
    if (response.ok) {
      const data = await response.json() as { result?: { username?: string } };
      console.log(`📱 Telegram bot initialized`);
      return true;
    }
    return false;
  } catch {
    console.warn('⚠️ Could not connect to Telegram');
    return false;
  }
}

/**
 * Send a message to a specific chat
 */
export async function sendMessage(
  chatId: string | number,
  message: string,
  options?: { parseMode?: 'HTML' | 'Markdown' }
): Promise<boolean> {
  return sendTelegramMessage(String(chatId), message, options?.parseMode || 'Markdown');
}

/**
 * Send notification to admin
 */
export async function notifyAdmin(message: string): Promise<boolean> {
  return sendTelegramMessage(ADMIN_CHAT_ID, message);
}

/**
 * Send notification to an agent's dedicated channel
 */
export async function notifyAgent(agentIdOrType: string, message: string): Promise<boolean> {
  const channel = getAgentChannel(agentIdOrType) || getAgentTypeChannel(agentIdOrType);
  return sendTelegramMessage(channel, message);
}

/**
 * Notification templates
 */
export const notify = {
  taskAssigned: async (agentIdOrType: string, taskDisplayId: string, taskTitle: string) => {
    const msg = `📋 *Task Assigned*\n\`${taskDisplayId}\`\n${taskTitle}`;
    await notifyAgent(agentIdOrType, msg);
  },

  taskCompleted: async (agentIdOrType: string, taskDisplayId: string, taskTitle: string, summary?: string) => {
    let msg = `✅ *Task Completed*\n\`${taskDisplayId}\`\n${taskTitle}`;
    if (summary) {
      msg += `\n\n${summary.slice(0, 500)}`;
    }
    await notifyAgent(agentIdOrType, msg);
  },

  taskFailed: async (agentIdOrType: string, taskDisplayId: string, error: string) => {
    const msg = `❌ *Task Failed*\n\`${taskDisplayId}\`\n${error.slice(0, 300)}`;
    await notifyAgent(agentIdOrType, msg);
    // Also notify admin for visibility
    await notifyAdmin(`❌ ${agentIdOrType}: ${taskDisplayId} failed`);
  },

  agentSpawned: async (agentIdOrType: string, taskDisplayId: string) => {
    const msg = `🚀 *Agent Spawned*\nWorking on: \`${taskDisplayId}\``;
    await notifyAgent(agentIdOrType, msg);
  },

  agentOutput: async (agentIdOrType: string, taskDisplayId: string, output: string) => {
    // Truncate long output
    const truncated = output.length > 2000 
      ? output.slice(0, 2000) + '\n\n... (truncated)'
      : output;
    const msg = `📤 *Agent Output*\n\`${taskDisplayId}\`\n\n\`\`\`\n${truncated}\n\`\`\``;
    await notifyAgent(agentIdOrType, msg);
  },

  agentError: async (agentIdOrType: string, error: string) => {
    const msg = `🔴 *Agent Error*\n${error.slice(0, 300)}`;
    await notifyAgent(agentIdOrType, msg);
  },

  sessionStarted: async (agentIdOrType: string, taskDisplayId: string) => {
    const msg = `🚀 *Session Started*\nWorking on: \`${taskDisplayId}\``;
    await notifyAgent(agentIdOrType, msg);
  },

  sessionIteration: async (_agentId: string, _iteration: number, _maxIterations: number) => {
    // Don't spam iterations
  },

  waveStarted: async (waveNumber: number, taskCount: number) => {
    await notifyAdmin(`🌊 *Wave ${waveNumber}* started with ${taskCount} tasks`);
  },

  waveCompleted: async (waveNumber: number, passed: number, failed: number) => {
    const icon = failed > 0 ? '⚠️' : '✅';
    await notifyAdmin(`${icon} *Wave ${waveNumber}* complete: ${passed} passed, ${failed} failed`);
  },

  systemStatus: async (workingCount: number, idleCount: number, pendingTasks: number) => {
    const msg = `📊 *System Status*\nAgents: ${workingCount} working, ${idleCount} idle\nPending: ${pendingTasks} tasks`;
    await notifyAdmin(msg);
  },

  fileEdit: async (agentIdOrType: string, filePath: string, linesChanged: number) => {
    const fileName = filePath.split('/').pop() || filePath;
    const msg = `✏️ *File Edit*\n${fileName} (${linesChanged} lines)`;
    await notifyAgent(agentIdOrType, msg);
  },

  testResults: async (agentIdOrType: string, passed: number, failed: number, skipped: number) => {
    const icon = failed > 0 ? '⚠️' : '✅';
    const msg = `${icon} *Test Results*\n✅ ${passed} passed | ❌ ${failed} failed | ⏭️ ${skipped} skipped`;
    await notifyAgent(agentIdOrType, msg);
  },

  buildResult: async (agentIdOrType: string, success: boolean, errors?: number) => {
    if (success) {
      await notifyAgent(agentIdOrType, `✅ *Build Passed*`);
    } else {
      await notifyAgent(agentIdOrType, `❌ *Build Failed* (${errors || '?'} errors)`);
    }
  },

  commitMade: async (agentIdOrType: string, hash: string, message: string) => {
    const msg = `📝 *Commit*\n\`${hash.slice(0, 7)}\` ${message.slice(0, 100)}`;
    await notifyAgent(agentIdOrType, msg);
  },
};

export default {
  initTelegram,
  sendMessage,
  notifyAdmin,
  notifyAgent,
  notify,
};
