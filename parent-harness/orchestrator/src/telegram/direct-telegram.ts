/**
 * Direct Telegram Bot API Integration - Multi-Bot Architecture
 * 
 * Each agent type has its OWN dedicated bot.
 * Uses IPv4 to avoid Node.js IPv6 timeout issues.
 */

import https from 'https';
import { logTelegramMessage } from '../db/telegram.js';
import { ws } from '../websocket.js';

// Bot tokens per agent type
const BOT_TOKENS: Record<string, string> = {
  // System/Admin
  system: process.env.TELEGRAM_BOT_SYSTEM || '8289522845:AAGsvjg3dnCrodJW1W1EhLjdp2s07LGe6CU',
  monitor: process.env.TELEGRAM_BOT_MONITOR || '8411912868:AAG8zE_B1RhpQcBcKepJkBjJZ1CtZHk0neQ',
  orchestrator: process.env.TELEGRAM_BOT_ORCHESTRATOR || '8437865967:AAEwfQ46b5tF94_7TRV90fzt1nOXdRJv86I',
  
  // Agent bots
  build: process.env.TELEGRAM_BOT_BUILD || '8258850025:AAFQUFfaIgC0N1a5GZykcBEJE-sLJrc9lpA',
  spec: process.env.TELEGRAM_BOT_SPEC || '8293978861:AAHNCRkaEn1xnanYekLNU1jTZcES7HX0k2A',
  validation: process.env.TELEGRAM_BOT_VALIDATION || '8497591949:AAFqIpnUdIQors9v5pzFRNGPqv0gQ2ZkWx4',
  sia: process.env.TELEGRAM_BOT_SIA || '8209489629:AAF-TRcCdxrw5lIU6UJS8ogWc94iVN-cQ1Y',
  planning: process.env.TELEGRAM_BOT_PLANNING || '8567955026:AAHTA8GNPBheu7m59d6TZue6Y-65fnbbH5w',
  clarification: process.env.TELEGRAM_BOT_CLARIFICATION || '8136650121:AAGjQQV3JS9HS-00A11IL6uqLFeSdV9s-Mw',
  human: process.env.TELEGRAM_HUMAN_SIM_BOT_TOKEN || '8537180647:AAEb6zO11b4sGkwaYglpLmX9Qcb1W57Yahg',
};

// Map agent types to their bot
const AGENT_BOT_MAP: Record<string, string> = {
  build: 'build', build_agent: 'build',
  spec: 'spec', spec_agent: 'spec',
  decomposition: 'spec', decomposition_agent: 'spec',
  planning: 'planning', planning_agent: 'planning',
  clarification: 'clarification', clarification_agent: 'clarification',
  qa: 'validation', qa_agent: 'validation', validation: 'validation', 
  validation_agent: 'validation', test: 'validation', test_agent: 'validation',
  research: 'monitor', research_agent: 'monitor', evaluator: 'monitor', evaluator_agent: 'monitor',
  task: 'system', task_agent: 'system',
  sia: 'sia', sia_agent: 'sia',
  orchestrator: 'orchestrator', system: 'system',
};

// Admin chat ID
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '8397599412';

// Rate limiting: Track recent messages to prevent spam
const recentMessages = new Map<string, number>(); // hash -> timestamp
const RATE_LIMIT_MS = 60000; // Don't repeat same message within 60s
const MAX_MESSAGES_PER_MINUTE = 10; // Max messages per minute per chat
const chatMessageCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if message is rate limited
 */
function isRateLimited(chatId: string, text: string): boolean {
  const now = Date.now();
  
  // Check for exact duplicate message
  const hash = `${chatId}:${text.slice(0, 100)}`;
  const lastSent = recentMessages.get(hash);
  if (lastSent && now - lastSent < RATE_LIMIT_MS) {
    console.log('📱 Rate limited: duplicate message within 60s');
    return true;
  }
  
  // Check per-chat rate limit
  const chatLimit = chatMessageCounts.get(chatId);
  if (chatLimit) {
    if (now > chatLimit.resetAt) {
      // Reset counter
      chatMessageCounts.set(chatId, { count: 1, resetAt: now + 60000 });
    } else if (chatLimit.count >= MAX_MESSAGES_PER_MINUTE) {
      console.log('📱 Rate limited: too many messages this minute');
      return true;
    } else {
      chatLimit.count++;
    }
  } else {
    chatMessageCounts.set(chatId, { count: 1, resetAt: now + 60000 });
  }
  
  // Mark message as sent
  recentMessages.set(hash, now);
  
  // Cleanup old entries
  if (recentMessages.size > 1000) {
    for (const [key, time] of recentMessages) {
      if (now - time > RATE_LIMIT_MS * 2) {
        recentMessages.delete(key);
      }
    }
  }
  
  return false;
}

/**
 * Make HTTPS POST with IPv4 forced (avoids timeout issues)
 */
function httpsPostIPv4(url: string, body: object, timeoutMs = 10000): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const bodyString = JSON.stringify(body);
    
    const req = https.request({
      method: 'POST',
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      family: 4, // Force IPv4
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ ok: false, error: 'Invalid JSON' });
        }
      });
    });
    
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Timeout' });
    });
    
    req.write(bodyString);
    req.end();
  });
}

/**
 * Make HTTPS GET with IPv4 forced
 */
function httpsGetIPv4(url: string, timeoutMs = 10000): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    
    const req = https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      family: 4, // Force IPv4
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ ok: false, error: 'Invalid JSON' });
        }
      });
    });
    
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Timeout' });
    });
  });
}

/**
 * Get bot token for an agent type
 */
function getBotToken(agentType: string): string {
  const botKey = AGENT_BOT_MAP[agentType] || 'system';
  return BOT_TOKENS[botKey] || BOT_TOKENS.system;
}

// Context for message logging
interface MessageContext {
  messageType?: string;
  taskId?: string;
  taskDisplayId?: string;
  agentId?: string;
  sessionId?: string;
}

// Current context (set before sending messages)
let currentContext: MessageContext = {};

/**
 * Set context for the next message(s) to be sent
 */
export function setMessageContext(ctx: MessageContext): void {
  currentContext = ctx;
}

/**
 * Clear message context
 */
export function clearMessageContext(): void {
  currentContext = {};
}

/**
 * Send a message via a specific bot (with rate limiting and logging)
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'Markdown',
  botType: string = 'system'
): Promise<boolean> {
  if (!botToken || !chatId) return false;
  
  // Check rate limit
  if (isRateLimited(chatId, text)) {
    return false;
  }

  const result = await httpsPostIPv4(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }
  );

  if (!result.ok) {
    const errorDesc = result.error || (result as any).description || JSON.stringify(result);
    console.warn(`❌ Telegram send failed: ${errorDesc}`);
    return false;
  }
  
  // Log to database
  try {
    const telegramMessageId = (result.result as any)?.message_id;
    const logged = logTelegramMessage({
      botType,
      chatId,
      messageType: currentContext.messageType || 'general',
      messageText: text,
      taskId: currentContext.taskId,
      taskDisplayId: currentContext.taskDisplayId,
      agentId: currentContext.agentId || botType,
      sessionId: currentContext.sessionId,
      telegramMessageId,
    });
    
    // Broadcast via WebSocket
    ws.telegramMessage(logged);
  } catch (err) {
    console.warn('Failed to log telegram message:', err);
  }
  
  return true;
}

/**
 * Initialize Telegram (validate all bot tokens)
 */
export async function initTelegram(): Promise<boolean> {
  let anyValid = false;
  
  for (const [name, token] of Object.entries(BOT_TOKENS)) {
    if (!token) continue;
    
    const result = await httpsGetIPv4(`https://api.telegram.org/bot${token}/getMe`);
    
    if (result.ok && result.result) {
      const botInfo = result.result as { username?: string };
      console.log(`📱 Bot ${name}: @${botInfo.username}`);
      anyValid = true;
    } else {
      console.warn(`⚠️ Bot ${name}: ${result.error || 'failed'}`);
    }
  }
  
  if (anyValid) {
    console.log(`📱 Telegram multi-bot system ready`);
  } else {
    console.warn('⚠️ No Telegram bots available');
  }
  
  return anyValid;
}

/**
 * Send a message to a specific chat
 */
export async function sendMessage(
  chatId: string | number,
  message: string,
  options?: { parseMode?: 'HTML' | 'Markdown'; botType?: string }
): Promise<boolean> {
  const token = options?.botType ? getBotToken(options.botType) : BOT_TOKENS.system;
  return sendTelegramMessage(token, String(chatId), message, options?.parseMode || 'Markdown');
}

/**
 * Send notification to admin
 */
export async function notifyAdmin(message: string): Promise<boolean> {
  return sendTelegramMessage(BOT_TOKENS.system, ADMIN_CHAT_ID, message);
}

/**
 * Send notification from an agent's dedicated bot
 */
export async function notifyAgent(agentIdOrType: string, message: string): Promise<boolean> {
  const botKey = AGENT_BOT_MAP[agentIdOrType] || 'system';
  const token = getBotToken(agentIdOrType);
  return sendTelegramMessage(token, ADMIN_CHAT_ID, message, 'Markdown', botKey);
}

/**
 * Notification templates
 */
export const notify = {
  taskAssigned: async (agentIdOrType: string, taskDisplayId: string, taskTitle: string) => {
    setMessageContext({ messageType: 'task_assigned', taskDisplayId, agentId: agentIdOrType });
    await notifyAgent(agentIdOrType, `📋 *Task Assigned*\n\`${taskDisplayId}\`\n${taskTitle}`);
    clearMessageContext();
  },

  taskCompleted: async (agentIdOrType: string, taskDisplayId: string, taskTitle: string, summary?: string) => {
    setMessageContext({ messageType: 'task_completed', taskDisplayId, agentId: agentIdOrType });
    let msg = `✅ *Task Completed*\n\`${taskDisplayId}\`\n${taskTitle}`;
    if (summary) msg += `\n\n${summary.slice(0, 500)}`;
    await notifyAgent(agentIdOrType, msg);
    clearMessageContext();
  },

  taskFailed: async (agentIdOrType: string, taskDisplayId: string, error: string) => {
    setMessageContext({ messageType: 'task_failed', taskDisplayId, agentId: agentIdOrType });
    await notifyAgent(agentIdOrType, `❌ *Task Failed*\n\`${taskDisplayId}\`\n${error.slice(0, 300)}`);
    clearMessageContext();
  },

  agentSpawned: async (agentIdOrType: string, taskDisplayId: string) => {
    setMessageContext({ messageType: 'agent_spawned', taskDisplayId, agentId: agentIdOrType });
    await notifyAgent(agentIdOrType, `🚀 *Agent Spawned*\nWorking on: \`${taskDisplayId}\``);
    clearMessageContext();
  },

  agentOutput: async (agentIdOrType: string, taskDisplayId: string, output: string) => {
    const truncated = output.length > 1500 ? output.slice(0, 1500) + '...' : output;
    await notifyAgent(agentIdOrType, `📤 *Output*\n\`${taskDisplayId}\`\n\n\`\`\`\n${truncated}\n\`\`\``);
  },

  agentError: async (agentIdOrType: string, error: string) => {
    // Send to agent's own bot
    await notifyAgent(agentIdOrType, `🔴 *Error*\n${error.slice(0, 300)}`);
    // Also forward to monitor bot for centralized error tracking
    await notifyAgent('monitor', `🔴 *${agentIdOrType} Error*\n${error.slice(0, 300)}`);
  },

  sessionStarted: async (agentIdOrType: string, taskDisplayId: string) => {
    await notifyAgent(agentIdOrType, `🚀 *Session Started*\nWorking on: \`${taskDisplayId}\``);
  },

  sessionIteration: async () => { /* Don't spam */ },

  waveStarted: async (waveNumber: number, taskCount: number) => {
    await notifyAgent('orchestrator', `🌊 *Wave ${waveNumber}* started with ${taskCount} tasks`);
  },

  waveCompleted: async (waveNumber: number, passed: number, failed: number) => {
    const icon = failed > 0 ? '⚠️' : '✅';
    await notifyAgent('orchestrator', `${icon} *Wave ${waveNumber}* complete: ${passed} passed, ${failed} failed`);
  },

  systemStatus: async (workingCount: number, idleCount: number, pendingTasks: number) => {
    await notifyAdmin(`📊 *Status*\nAgents: ${workingCount} working, ${idleCount} idle\nPending: ${pendingTasks}`);
  },

  toolUse: async (agentIdOrType: string, toolName: string, details?: Record<string, unknown>) => {
    const detailStr = details ? `\n${JSON.stringify(details).slice(0, 200)}` : '';
    await notifyAgent(agentIdOrType, `🔧 *Tool Use*\n${toolName}${detailStr}`);
  },

  fileEdit: async (agentIdOrType: string, filePath: string, linesChanged: number) => {
    const fileName = filePath.split('/').pop() || filePath;
    await notifyAgent(agentIdOrType, `✏️ *File Edit*\n${fileName} (${linesChanged} lines)`);
  },

  testResults: async (agentIdOrType: string, passed: number, failed: number, skipped: number) => {
    const icon = failed > 0 ? '⚠️' : '✅';
    await notifyAgent(agentIdOrType, `${icon} *Tests*\n✅ ${passed} | ❌ ${failed} | ⏭️ ${skipped}`);
  },

  buildResult: async (agentIdOrType: string, success: boolean, errors?: number) => {
    if (success) {
      await notifyAgent(agentIdOrType, `✅ *Build Passed*`);
    } else {
      await notifyAgent(agentIdOrType, `❌ *Build Failed* (${errors || '?'} errors)`);
    }
  },

  commitMade: async (agentIdOrType: string, hash: string, message: string) => {
    await notifyAgent(agentIdOrType, `📝 *Commit*\n\`${hash.slice(0, 7)}\` ${message.slice(0, 100)}`);
  },

  // Planning & Approval workflow
  taskProposed: async (taskId: string, title: string, description: string, priority: string, passCriteria: string[]) => {
    const criteriaList = passCriteria.slice(0, 5).map((c, i) => `  ${i + 1}. ${c}`).join('\n');
    const msg = `📋 *Task Proposal*

*ID:* \`${taskId}\`
*Title:* ${title}
*Priority:* ${priority}

*Description:*
${description.slice(0, 500)}

*Pass Criteria:*
${criteriaList}

Reply with:
✅ /approve ${taskId}
❌ /reject ${taskId} <reason>
❓ /clarify ${taskId} <question>`;
    await notifyAgent('planning', msg);
  },

  planningStarted: async () => {
    await notifyAgent('planning', `🧠 *Planning Agent Started*\nAnalyzing codebase and creating task proposals...`);
  },

  planningComplete: async (taskCount: number) => {
    await notifyAgent('planning', `✅ *Planning Complete*\n${taskCount} tasks proposed for your review.`);
  },

  clarificationRequest: async (taskId: string, question: string) => {
    const msg = `❓ *Clarification Needed*

*Task:* \`${taskId}\`

${question}

Please provide clarification or type /skip to proceed without.`;
    await notifyAgent('clarification', msg);
  },

  clarificationResponse: async (taskId: string, response: string) => {
    await notifyAgent('clarification', `📝 *Clarification Received*\n\`${taskId}\`\n\n${response.slice(0, 500)}`);
  },

  taskApproved: async (taskId: string) => {
    await notifyAgent('planning', `✅ *Task Approved*\n\`${taskId}\` - Moving to execution queue.`);
  },

  taskRejected: async (taskId: string, reason: string) => {
    await notifyAgent('planning', `❌ *Task Rejected*\n\`${taskId}\`\nReason: ${reason}`);
  },

  strategicPlanReady: async (phaseCount: number) => {
    await notifyAgent('clarification', `🧠 *Strategic Plan Ready*\n${phaseCount} phases proposed. Check your messages for approval.`);
  },

  // Forward any error to monitor bot for centralized tracking
  forwardError: async (source: string, error: string) => {
    await notifyAgent('monitor', `🚨 *${source}*\n${error.slice(0, 500)}`);
  },
};

/**
 * Split long message into chunks that fit Telegram's 4096 char limit
 */
function chunkMessage(message: string, maxLen = 4000): string[] {
  if (message.length <= maxLen) return [message];
  
  const chunks: string[] = [];
  let remaining = message;
  let partNum = 1;
  
  while (remaining.length > 0) {
    let chunk = remaining.slice(0, maxLen);
    
    // Try to break at newline for cleaner splits
    if (remaining.length > maxLen) {
      const lastNewline = chunk.lastIndexOf('\n');
      if (lastNewline > maxLen * 0.5) {
        chunk = chunk.slice(0, lastNewline);
      }
    }
    
    const totalParts = Math.ceil(message.length / maxLen);
    chunks.push(`[${partNum}/${totalParts}]\n${chunk}`);
    remaining = remaining.slice(chunk.length);
    partNum++;
  }
  
  return chunks;
}

/**
 * Send message to a specific bot type (auto-chunks long messages)
 */
export async function sendToBot(botType: string, message: string, parseMode?: 'HTML' | 'Markdown'): Promise<boolean> {
  const botKey = botType.toLowerCase().replace('_agent', '').replace('agent', '');
  const token = BOT_TOKENS[botKey];
  
  if (!token) {
    console.error(`❌ Unknown bot type: ${botType}`);
    return false;
  }

  // Chunk message if too long
  const chunks = chunkMessage(message);
  console.log(`📤 Sending ${chunks.length} message(s) to ${botType} bot`);

  for (const chunk of chunks) {
    // Send without parse_mode for plain text
    if (!parseMode) {
      if (!token || !ADMIN_CHAT_ID) return false;
      const result = await httpsPostIPv4(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          chat_id: ADMIN_CHAT_ID,
          text: chunk,
          disable_web_page_preview: true,
        }
      );
      if (!result.ok) {
        const errorDesc = result.error || (result as any).description || JSON.stringify(result);
        console.warn(`❌ Telegram send failed: ${errorDesc}`);
        return false;
      }
    } else {
      const success = await sendTelegramMessage(token, ADMIN_CHAT_ID, chunk, parseMode);
      if (!success) return false;
    }
    
    // Small delay between chunks to avoid rate limiting
    if (chunks.length > 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  return true;
}

/**
 * Get webhook info for a specific bot
 */
export async function getWebhookInfo(botToken: string): Promise<{
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
} | null> {
  const result = await httpsGetIPv4(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  if (result.ok && result.result) {
    return result.result as any;
  }
  return null;
}

/**
 * Get bot info (getMe)
 */
export async function getBotInfo(botToken: string): Promise<{
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
} | null> {
  const result = await httpsGetIPv4(`https://api.telegram.org/bot${botToken}/getMe`);
  if (result.ok && result.result) {
    return result.result as any;
  }
  return null;
}

/**
 * Get status of all bots (username, webhook info)
 */
export async function getAllBotsStatus(): Promise<Array<{
  type: string;
  username: string | null;
  webhookUrl: string | null;
  webhookActive: boolean;
  pendingUpdates: number;
  lastError: string | null;
  lastErrorDate: string | null;
}>> {
  const statuses = [];
  
  for (const [type, token] of Object.entries(BOT_TOKENS)) {
    if (!token) continue;
    
    const [botInfo, webhookInfo] = await Promise.all([
      getBotInfo(token),
      getWebhookInfo(token),
    ]);
    
    statuses.push({
      type,
      username: botInfo?.username ? `@${botInfo.username}` : null,
      webhookUrl: webhookInfo?.url || null,
      webhookActive: !!webhookInfo?.url,
      pendingUpdates: webhookInfo?.pending_update_count || 0,
      lastError: webhookInfo?.last_error_message || null,
      lastErrorDate: webhookInfo?.last_error_date 
        ? new Date(webhookInfo.last_error_date * 1000).toISOString() 
        : null,
    });
  }
  
  return statuses;
}

// Webhook secret for verification
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'harness-webhook-secret-2026';

/**
 * Set webhook for a specific bot
 */
export async function setWebhook(botToken: string, webhookUrl: string): Promise<boolean> {
  const result = await httpsPostIPv4(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      url: webhookUrl,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    }
  );
  
  if (!result.ok) {
    console.error(`❌ Failed to set webhook: ${result.error || JSON.stringify(result)}`);
    return false;
  }
  
  console.log(`✅ Webhook set for ${webhookUrl}`);
  return true;
}

/**
 * Delete webhook for a specific bot (revert to polling)
 */
export async function deleteWebhook(botToken: string): Promise<boolean> {
  const result = await httpsPostIPv4(
    `https://api.telegram.org/bot${botToken}/deleteWebhook`,
    { drop_pending_updates: false }
  );
  
  return result.ok === true;
}

/**
 * Set webhooks for all bots
 * @param baseUrl - Base URL of the server (e.g., https://abc123.ngrok.io)
 */
export async function setAllWebhooks(baseUrl: string): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];
  
  // Ensure base URL doesn't end with /
  const base = baseUrl.replace(/\/$/, '');
  
  for (const [botType, token] of Object.entries(BOT_TOKENS)) {
    if (!token) continue;
    
    const webhookUrl = `${base}/webhook/${botType}`;
    const ok = await setWebhook(token, webhookUrl);
    
    if (ok) {
      success.push(botType);
      console.log(`📱 Webhook set for ${botType}: ${webhookUrl}`);
    } else {
      failed.push(botType);
      console.error(`❌ Failed to set webhook for ${botType}`);
    }
  }
  
  return { success, failed };
}

/**
 * Delete webhooks for all bots (revert to polling)
 */
export async function deleteAllWebhooks(): Promise<void> {
  for (const [botType, token] of Object.entries(BOT_TOKENS)) {
    if (!token) continue;
    
    const ok = await deleteWebhook(token);
    if (ok) {
      console.log(`📱 Webhook deleted for ${botType}`);
    }
  }
}

export default { initTelegram, sendMessage, notifyAdmin, notifyAgent, notify, sendToBot, getAllBotsStatus, setAllWebhooks, deleteAllWebhooks };
