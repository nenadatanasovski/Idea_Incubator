/**
 * Agent Spawner - Uses Claude CLI directly
 * 
 * NO OpenClaw. Spawns Claude CLI processes directly.
 * Agents use Claude CLI's built-in tools (Read, Write, Edit, exec).
 */

import { spawn, ChildProcess } from 'child_process';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import * as tasks from '../db/tasks.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';
import { notify } from '../telegram/direct-telegram.js';
import * as git from '../git/index.js';

// Codebase root
const CODEBASE_ROOT = process.env.CODEBASE_ROOT || '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

// Max concurrent (limit to avoid overwhelming system)
const MAX_CONCURRENT = 8;

// Track running processes
const runningProcesses = new Map<string, { 
  process: ChildProcess;
  startTime: number;
}>();

// Check if claude CLI is available
let claudeAvailable = false;

async function checkClaudeCLI(): Promise<boolean> {
  return new Promise((resolve) => {
    const check = spawn('which', ['claude'], { stdio: 'pipe' });
    check.on('close', (code) => resolve(code === 0));
    check.on('error', () => resolve(false));
    setTimeout(() => { check.kill(); resolve(false); }, 3000);
  });
}

// Check on startup
checkClaudeCLI().then(available => {
  claudeAvailable = available;
  if (available) {
    console.log('✅ Claude CLI available for agent spawning');
  } else {
    console.warn('⚠️ Claude CLI not found - agent spawning disabled');
  }
});

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

/**
 * Build system prompt for agent
 */
function getSystemPrompt(agentType: string): string {
  const base = `You are an autonomous AI agent working on the Vibe Platform codebase at ${CODEBASE_ROOT}.

Your tools: Read (files), Write (files), Edit (precise edits), exec (shell commands)

WORKFLOW:
1. Read relevant files to understand the task
2. Make changes using Write or Edit
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
    build: 'You are a Build Agent - implement features and fix bugs.',
    qa_agent: 'You are a QA Agent - verify implementations and run tests.',
    qa: 'You are a QA Agent - verify implementations and run tests.',
    spec_agent: 'You are a Spec Agent - create technical specifications.',
    spec: 'You are a Spec Agent - create technical specifications.',
    planning_agent: 'You are a Planning Agent - analyze codebase and plan work.',
    planning: 'You are a Planning Agent - analyze codebase and plan work.',
    test_agent: 'You are a Test Agent - write and run tests.',
    test: 'You are a Test Agent - write and run tests.',
    validation_agent: 'You are a Validation Agent - validate completed work.',
    validation: 'You are a Validation Agent - validate completed work.',
    research_agent: 'You are a Research Agent - investigate and analyze.',
    research: 'You are a Research Agent - investigate and analyze.',
    evaluator_agent: 'You are an Evaluator Agent - assess quality.',
    evaluator: 'You are an Evaluator Agent - assess quality.',
    decomposition_agent: 'You are a Decomposition Agent - break down complex tasks.',
    decomposition: 'You are a Decomposition Agent - break down complex tasks.',
    task_agent: 'You are a Task Agent - execute specific tasks.',
    task: 'You are a Task Agent - execute specific tasks.',
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

  // Check capacity
  if (runningProcesses.size >= MAX_CONCURRENT) {
    return { 
      success: false, 
      sessionId: '', 
      error: `At max capacity (${MAX_CONCURRENT} concurrent agents)` 
    };
  }

  // Check CLI availability
  if (!claudeAvailable) {
    claudeAvailable = await checkClaudeCLI();
  }
  if (!claudeAvailable) {
    return { success: false, sessionId: '', error: 'Claude CLI not available' };
  }

  const taskData = tasks.getTask(taskId);
  const agentData = agents.getAgent(agentId);
  if (!taskData || !agentData) {
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

  // Notify agent's dedicated channel
  await notify.agentSpawned(agentData.type, taskData.display_id).catch(() => {});

  const systemPrompt = getSystemPrompt(agentData.type);
  const taskPrompt = buildTaskPrompt(taskData);
  const fullPrompt = `${systemPrompt}\n\n---\n\n${taskPrompt}`;

  console.log(`🚀 Spawning ${agentData.name} for ${taskData.display_id} via Claude CLI`);

  // Store refs for use in callbacks
  const task = taskData;
  const agent = agentData;

  return new Promise((resolve) => {
    const args = [
      '--print',
      '--model', model,
      '--allowedTools', 'Read,Write,Edit,exec',
      '--dangerously-skip-permissions',
      fullPrompt
    ];

    const child = spawn('claude', args, {
      cwd: CODEBASE_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    runningProcesses.set(session.id, {
      process: child,
      startTime: Date.now(),
    });

    let stdout = '';
    let stderr = '';

    // Timeout handler
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      finishSession(false, `Timeout after ${timeout}s`);
    }, timeout * 1000);

    // Heartbeat interval
    const heartbeatInterval = setInterval(() => {
      agents.updateHeartbeat(agentId);
    }, 10000);

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    function finishSession(success: boolean, errorMsg?: string) {
      clearTimeout(timeoutId);
      clearInterval(heartbeatInterval);
      runningProcesses.delete(session.id);

      const output = stdout + stderr;
      const filesModified = extractFilesModified(output);

      if (success) {
        sessions.updateSessionStatus(session.id, 'completed', output);
        tasks.updateTask(task.id, { status: 'pending_verification' });
        agents.incrementTasksCompleted(agentId);
        events.taskCompleted(taskId, agentId, task.title);
        ws.taskCompleted(tasks.getTask(taskId));

        // Notify agent's channel
        notify.taskCompleted(agent.type, task.display_id, task.title, extractSummary(output)).catch(() => {});

        // Auto-commit
        if (filesModified.length > 0) {
          git.autoCommitForTask(taskId, task.display_id, agentId, session.id).catch(() => {});
        }

        console.log(`✅ ${agent.name} completed ${task.display_id}`);
        resolve({ success: true, sessionId: session.id, output, filesModified });
      } else {
        sessions.updateSessionStatus(session.id, 'failed', output, errorMsg);
        tasks.failTask(taskId);
        agents.incrementTasksFailed(agentId);
        events.taskFailed(taskId, agentId, task.title, errorMsg || 'Unknown error');
        ws.taskFailed(tasks.getTask(taskId), errorMsg || 'Unknown error');

        // Notify agent's channel
        notify.taskFailed(agent.type, task.display_id, errorMsg || 'Unknown error').catch(() => {});

        console.log(`❌ ${agent.name} failed ${task.display_id}: ${(errorMsg || '').slice(0, 100)}`);
        resolve({ success: false, sessionId: session.id, error: errorMsg, output, filesModified });
      }

      // Cleanup
      agents.updateAgentStatus(agentId, 'idle', null, null);
      ws.agentStatusChanged(agents.getAgent(agentId));
      ws.sessionEnded(sessions.getSession(session.id));
    }

    child.on('close', (code) => {
      const output = stdout + stderr;
      const isComplete = output.includes('TASK_COMPLETE');
      const isFailed = output.includes('TASK_FAILED') || code !== 0;

      if (isComplete && !isFailed) {
        finishSession(true);
      } else {
        const errorMsg = extractError(output) || `Exit code ${code}`;
        finishSession(false, errorMsg);
      }
    });

    child.on('error', (err) => {
      finishSession(false, `Spawn error: ${err.message}`);
    });
  });
}

function extractFilesModified(output: string): string[] {
  const files: string[] = [];
  const patterns = [
    /(?:Write|wrote|created|modified|Wrote to)\s+(?:to\s+)?([\/\w.-]+\.[a-z]+)/gi,
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

function extractError(output: string): string {
  const match = output.match(/TASK_FAILED:\s*(.+)/);
  return match ? match[1].trim() : '';
}

function extractSummary(output: string): string {
  const match = output.match(/TASK_COMPLETE:\s*(.+)/s);
  return match ? match[1].trim().slice(0, 500) : '';
}

export function killSession(sessionId: string): boolean {
  const running = runningProcesses.get(sessionId);
  if (!running) return false;
  
  running.process.kill('SIGTERM');
  runningProcesses.delete(sessionId);
  sessions.updateSessionStatus(sessionId, 'terminated');
  ws.sessionEnded(sessions.getSession(sessionId));
  return true;
}

export function getRunningSessions(): string[] {
  return Array.from(runningProcesses.keys());
}

export function getRunningCount(): number {
  return runningProcesses.size;
}

export function isEnabled(): boolean {
  return claudeAvailable;
}

export function canSpawnMore(): boolean {
  return claudeAvailable && runningProcesses.size < MAX_CONCURRENT;
}

/**
 * Spawn an agent with a custom prompt (for planning, etc.)
 * Doesn't require a task in the database.
 */
export async function spawnWithPrompt(
  prompt: string,
  options: { model?: string; timeout?: number; label?: string } = {}
): Promise<{ success: boolean; output?: string; error?: string }> {
  const { model = 'sonnet', timeout = 600, label = 'planning' } = options;

  if (!claudeAvailable) {
    claudeAvailable = await checkClaudeCLI();
  }
  if (!claudeAvailable) {
    return { success: false, error: 'Claude CLI not available' };
  }

  if (runningProcesses.size >= MAX_CONCURRENT) {
    return { success: false, error: 'At max capacity' };
  }

  console.log(`🧠 Spawning ${label} agent...`);

  return new Promise((resolve) => {
    // Use stdin for large prompts (avoid CLI arg length limits)
    const useStdin = prompt.length > 10000;
    
    const args = [
      '--print',
      '--model', model,
      '--no-session-persistence',
      '--tools', 'Read,Write,Edit,Bash',
      '--allowedTools', 'Read,Write,Edit,Bash',
    ];
    
    if (!useStdin) {
      args.push(prompt);
    }

    // Clean environment (remove API tokens so CLI uses its OAuth session)
    const { ANTHROPIC_AUTH_TOKEN, ANTHROPIC_API_KEY, ...cleanEnv } = process.env;

    const child = spawn('claude', args, {
      cwd: CODEBASE_ROOT,
      stdio: [useStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: {
        ...cleanEnv,
        HOME: process.env.HOME,
        PATH: process.env.PATH,
      },
    });

    // Write prompt to stdin if needed
    if (useStdin) {
      child.stdin?.write(prompt);
      child.stdin?.end();
    }

    const sessionId = `${label}-${Date.now()}`;
    runningProcesses.set(sessionId, {
      process: child,
      startTime: Date.now(),
    });

    let stdout = '';
    let stderr = '';

    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ success: false, error: `Timeout after ${timeout}s` });
    }, timeout * 1000);

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      runningProcesses.delete(sessionId);

      const output = stdout + stderr;
      const isComplete = output.includes('TASK_COMPLETE');

      if (isComplete) {
        console.log(`✅ ${label} agent completed`);
        resolve({ success: true, output });
      } else {
        console.log(`❌ ${label} agent failed (code ${code})`);
        resolve({ success: false, output, error: `Exit code ${code}` });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      runningProcesses.delete(sessionId);
      resolve({ success: false, error: err.message });
    });
  });
}

export default { 
  spawnAgentSession, 
  spawnWithPrompt,
  killSession, 
  getRunningSessions, 
  getRunningCount,
  isEnabled,
  canSpawnMore,
};
