/**
 * Agent Spawner - Uses Claude CLI for OAuth-based execution
 * 
 * Claude CLI handles OAuth internally, so we don't need API keys.
 * Agents use Claude CLI's built-in tools (Read, Write, exec).
 */

import { spawn } from 'child_process';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import * as tasks from '../db/tasks.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';
import { notify } from '../telegram/index.js';
import * as git from '../git/index.js';

// Codebase root
const CODEBASE_ROOT = process.env.CODEBASE_ROOT || '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

// Check if claude CLI is available
let claudeAvailable = false;
try {
  const { execSync } = await import('child_process');
  execSync('which claude', { stdio: 'ignore' });
  claudeAvailable = true;
  console.log('✅ Claude CLI available for agent spawning');
} catch {
  console.warn('⚠️ Claude CLI not found - agent spawning disabled');
}

interface SpawnOptions {
  taskId: string;
  agentId: string;
  model?: string;
  timeout?: number;
}

interface SpawnResult {
  success: boolean;
  sessionId: string;
  output?: string;
  error?: string;
  filesModified?: string[];
}

// Running sessions
const runningSessions = new Map<string, { process: ReturnType<typeof spawn>; aborted: boolean }>();

/**
 * Build system prompt for agent
 */
function getSystemPrompt(agentType: string): string {
  const base = `You are an autonomous AI agent working on the Vibe Platform codebase at ${CODEBASE_ROOT}.

Your tools: Read (files), Write (files), exec (shell commands)

WORKFLOW:
1. Read relevant files to understand the task
2. Make changes using Write
3. Test with exec (npm test, npm run build)
4. When done, output: TASK_COMPLETE: <summary>
5. If stuck, output: TASK_FAILED: <reason>

RULES:
- Verify your changes work before completing
- Write clean, documented code
- Don't make unnecessary changes
`;

  const roles: Record<string, string> = {
    build_agent: 'You are a Build Agent - implement features and fix bugs.',
    qa_agent: 'You are a QA Agent - verify implementations and run tests.',
    spec_agent: 'You are a Spec Agent - create technical specifications.',
    planning_agent: 'You are a Planning Agent - analyze codebase and plan work.',
  };

  return base + '\n' + (roles[agentType] || roles.build_agent);
}

/**
 * Build task prompt
 */
function buildTaskPrompt(task: tasks.Task): string {
  let prompt = `# Task: ${task.display_id}\n\n## Title\n${task.title}\n\n`;
  if (task.description) prompt += `## Description\n${task.description}\n\n`;
  if (task.pass_criteria) {
    try {
      const criteria = JSON.parse(task.pass_criteria);
      if (Array.isArray(criteria)) {
        prompt += `## Pass Criteria\n${criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}\n\n`;
      }
    } catch { /* ignore */ }
  }
  prompt += `\nComplete this task. Output TASK_COMPLETE when done or TASK_FAILED if stuck.`;
  return prompt;
}

/**
 * Spawn agent using Claude CLI
 */
export async function spawnAgentSession(options: SpawnOptions): Promise<SpawnResult> {
  const { taskId, agentId, model = 'sonnet', timeout = 300 } = options;

  if (!claudeAvailable) {
    return { success: false, sessionId: '', error: 'Claude CLI not available' };
  }

  const task = tasks.getTask(taskId);
  const agent = agents.getAgent(agentId);
  if (!task || !agent) {
    return { success: false, sessionId: '', error: 'Task or agent not found' };
  }

  // Create session
  const session = sessions.createSession(agentId, taskId);
  sessions.updateSessionStatus(session.id, 'running');
  agents.updateAgentStatus(agentId, 'working', taskId, session.id);
  agents.updateHeartbeat(agentId);

  events.agentStarted(agentId, session.id);
  ws.sessionStarted(session);
  ws.agentStatusChanged(agents.getAgent(agentId));
  notify.sessionStarted(agentId, task.display_id).catch(() => {});

  const systemPrompt = getSystemPrompt(agent.type);
  const taskPrompt = buildTaskPrompt(task);
  const fullPrompt = `${systemPrompt}\n\n---\n\n${taskPrompt}`;

  console.log(`🚀 Spawning ${agent.name} for ${task.display_id} via Claude CLI`);

  return new Promise((resolve) => {
    const args = [
      '--print',
      '--model', model,
      '--system-prompt', systemPrompt,
      '--allowedTools', 'Read,Write,Edit,exec',
      '--no-session-persistence',
      fullPrompt
    ];

    const child = spawn('claude', args, {
      cwd: CODEBASE_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeout * 1000,
    });

    const sessionState = { process: child, aborted: false };
    runningSessions.set(session.id, sessionState);

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      agents.updateHeartbeat(agentId);
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', async (code) => {
      runningSessions.delete(session.id);
      
      const output = stdout + stderr;
      const isComplete = output.includes('TASK_COMPLETE');
      const isFailed = output.includes('TASK_FAILED') || code !== 0;

      // Extract files modified from output
      const filesModified = extractFilesModified(output);

      if (isComplete && !isFailed) {
        sessions.updateSessionStatus(session.id, 'completed', output);
        tasks.updateTask(task.id, { status: 'pending_verification' });
        agents.incrementTasksCompleted(agentId);
        events.taskCompleted(taskId, agentId, task.title);
        ws.taskCompleted(tasks.getTask(taskId));
        notify.taskCompleted(agentId, task.display_id, task.title).catch(() => {});

        // Auto-commit if files were modified
        if (filesModified.length > 0) {
          await git.autoCommitForTask(taskId, task.display_id, agentId, session.id).catch(() => {});
        }

        console.log(`✅ ${agent.name} completed ${task.display_id}`);
        resolve({ success: true, sessionId: session.id, output, filesModified });
      } else {
        const errorMsg = extractError(output) || `Exit code ${code}`;
        sessions.updateSessionStatus(session.id, 'failed', undefined, errorMsg);
        tasks.failTask(taskId);
        agents.incrementTasksFailed(agentId);
        events.taskFailed(taskId, agentId, task.title, errorMsg);
        ws.taskFailed(tasks.getTask(taskId), errorMsg);
        notify.taskFailed(agentId, task.display_id, errorMsg).catch(() => {});

        console.log(`❌ ${agent.name} failed ${task.display_id}: ${errorMsg.slice(0, 100)}`);
        resolve({ success: false, sessionId: session.id, error: errorMsg, filesModified });
      }

      agents.updateAgentStatus(agentId, 'idle', null, null);
      ws.agentStatusChanged(agents.getAgent(agentId));
      ws.sessionEnded(sessions.getSession(session.id));
    });

    child.on('error', (err) => {
      runningSessions.delete(session.id);
      const errorMsg = err.message;
      
      sessions.updateSessionStatus(session.id, 'failed', undefined, errorMsg);
      tasks.failTask(taskId);
      agents.incrementTasksFailed(agentId);
      
      agents.updateAgentStatus(agentId, 'idle', null, null);
      ws.agentStatusChanged(agents.getAgent(agentId));
      ws.sessionEnded(sessions.getSession(session.id));

      console.log(`❌ ${agent.name} error: ${errorMsg}`);
      resolve({ success: false, sessionId: session.id, error: errorMsg });
    });
  });
}

/**
 * Extract files modified from output
 */
function extractFilesModified(output: string): string[] {
  const files: string[] = [];
  const patterns = [
    /(?:Write|wrote|created|modified)\s+(?:to\s+)?([\/\w.-]+\.[a-z]+)/gi,
    /File written:\s*([\/\w.-]+)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      if (!files.includes(match[1])) {
        files.push(match[1]);
      }
    }
  }
  return files;
}

/**
 * Extract error message from output
 */
function extractError(output: string): string {
  const match = output.match(/TASK_FAILED:\s*(.+)/);
  return match ? match[1].trim() : '';
}

export function killSession(sessionId: string): boolean {
  const state = runningSessions.get(sessionId);
  if (!state) return false;
  
  state.aborted = true;
  state.process.kill('SIGTERM');
  runningSessions.delete(sessionId);
  
  sessions.updateSessionStatus(sessionId, 'terminated');
  ws.sessionEnded(sessions.getSession(sessionId));
  return true;
}

export function getRunningSessions(): string[] {
  return Array.from(runningSessions.keys());
}

export function isEnabled(): boolean {
  return claudeAvailable;
}

export default { spawnAgentSession, killSession, getRunningSessions, isEnabled };
