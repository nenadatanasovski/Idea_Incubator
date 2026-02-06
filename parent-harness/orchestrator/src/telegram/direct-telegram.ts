/**
 * Direct Telegram Bot API Integration - Multi-Bot Architecture
 * 
 * Each agent type has its OWN dedicated bot.
 * Uses IPv4 to avoid Node.js IPv6 timeout issues.
 */

import https from 'https';

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
  sia: process.env.TELEGRAM_BOT_SIA || '8366604835:AAG2xGWqVoc4gDTenPxGk9SfNbGg_wFvRGc',
  planning: process.env.TELEGRAM_BOT_PLANNING || '8567955026:AAHTA8GNPBheu7m59d6TZue6Y-65fnbbH5w',
  clarification: process.env.TELEGRAM_BOT_CLARIFICATION || '8136650121:AAGjQQV3JS9HS-00A11IL6uqLFeSdV9s-Mw',
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

/**
 * Send a message via a specific bot
 */
async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'Markdown'
): Promise<boolean> {
  if (!botToken || !chatId) return false;

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
    console.warn(`❌ Telegram: ${result.error}`);
    return false;
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
  const token = getBotToken(agentIdOrType);
  return sendTelegramMessage(token, ADMIN_CHAT_ID, message);
}

/**
 * Notification templates
 */
export const notify = {
  taskAssigned: async (agentIdOrType: string, taskDisplayId: string, taskTitle: string) => {
    await notifyAgent(agentIdOrType, `📋 *Task Assigned*\n\`${taskDisplayId}\`\n${taskTitle}`);
  },

  taskCompleted: async (agentIdOrType: string, taskDisplayId: string, taskTitle: string, summary?: string) => {
    let msg = `✅ *Task Completed*\n\`${taskDisplayId}\`\n${taskTitle}`;
    if (summary) msg += `\n\n${summary.slice(0, 500)}`;
    await notifyAgent(agentIdOrType, msg);
  },

  taskFailed: async (agentIdOrType: string, taskDisplayId: string, error: string) => {
    await notifyAgent(agentIdOrType, `❌ *Task Failed*\n\`${taskDisplayId}\`\n${error.slice(0, 300)}`);
  },

  agentSpawned: async (agentIdOrType: string, taskDisplayId: string) => {
    await notifyAgent(agentIdOrType, `🚀 *Agent Spawned*\nWorking on: \`${taskDisplayId}\``);
  },

  agentOutput: async (agentIdOrType: string, taskDisplayId: string, output: string) => {
    const truncated = output.length > 1500 ? output.slice(0, 1500) + '...' : output;
    await notifyAgent(agentIdOrType, `📤 *Output*\n\`${taskDisplayId}\`\n\n\`\`\`\n${truncated}\n\`\`\``);
  },

  agentError: async (agentIdOrType: string, error: string) => {
    await notifyAgent(agentIdOrType, `🔴 *Error*\n${error.slice(0, 300)}`);
  },

  sessionStarted: async (agentIdOrType: string, taskDisplayId: string) => {
    await notifyAgent(agentIdOrType, `🚀 *Session Started*\nWorking on: \`${taskDisplayId}\``);
  },

  sessionIteration: async () => { /* Don't spam */ },

  waveStarted: async (waveNumber: number, taskCount: number) => {
    await notifyAdmin(`🌊 *Wave ${waveNumber}* started with ${taskCount} tasks`);
  },

  waveCompleted: async (waveNumber: number, passed: number, failed: number) => {
    const icon = failed > 0 ? '⚠️' : '✅';
    await notifyAdmin(`${icon} *Wave ${waveNumber}* complete: ${passed} passed, ${failed} failed`);
  },

  systemStatus: async (workingCount: number, idleCount: number, pendingTasks: number) => {
    await notifyAdmin(`📊 *Status*\nAgents: ${workingCount} working, ${idleCount} idle\nPending: ${pendingTasks}`);
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
};

export default { initTelegram, sendMessage, notifyAdmin, notifyAgent, notify };
