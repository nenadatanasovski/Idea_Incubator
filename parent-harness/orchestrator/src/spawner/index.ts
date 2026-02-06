/**
 * Agent Spawner - STANDALONE Anthropic SDK execution
 * 
 * The harness runs ITSELF. No OpenClaw dependency.
 * Uses ANTHROPIC_API_KEY directly for tool-based agent execution.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import * as tasks from '../db/tasks.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';
import { notify } from '../telegram/index.js';
import * as budget from '../budget/index.js';
import * as git from '../git/index.js';

const execAsync = promisify(exec);

// Codebase root
const CODEBASE_ROOT = process.env.CODEBASE_ROOT || '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

// Initialize Anthropic client - REQUIRES ANTHROPIC_API_KEY
const apiKey = process.env.ANTHROPIC_API_KEY;
let anthropic: Anthropic | null = null;

if (apiKey) {
  anthropic = new Anthropic({ apiKey });
  console.log('✅ Anthropic client initialized');
} else {
  console.warn('⚠️ ANTHROPIC_API_KEY not set - agent spawning disabled');
}

// Tool definitions
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path to the file (relative to codebase root or absolute)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file (creates directories if needed)',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (optional)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'list_directory',
    description: 'List contents of a directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Path to the directory' },
      },
      required: ['path'],
    },
  },
  {
    name: 'task_complete',
    description: 'Signal that the task is complete',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'Summary of what was accomplished' },
        files_modified: { type: 'array', items: { type: 'string' }, description: 'List of modified files' },
      },
      required: ['summary'],
    },
  },
  {
    name: 'task_failed',
    description: 'Signal that the task cannot be completed',
    input_schema: {
      type: 'object' as const,
      properties: {
        error: { type: 'string', description: 'What went wrong' },
        reason: { type: 'string', description: 'Why it cannot be completed' },
      },
      required: ['error'],
    },
  },
];

interface SpawnOptions {
  taskId: string;
  agentId: string;
  model?: string;
  maxIterations?: number;
}

interface SpawnResult {
  success: boolean;
  sessionId: string;
  output?: string;
  error?: string;
  tokensUsed?: number;
  filesModified?: string[];
  toolCalls?: number;
}

// Running sessions for cancellation
const runningSessions = new Map<string, { aborted: boolean }>();

/**
 * Resolve path relative to codebase root
 */
function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(CODEBASE_ROOT, filePath);
}

/**
 * Execute a tool call
 */
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  sessionId: string,
  agentId: string
): Promise<{ success: boolean; output: string }> {
  try {
    switch (toolName) {
      case 'read_file': {
        const filePath = resolvePath(toolInput.path as string);
        if (!fs.existsSync(filePath)) {
          return { success: false, output: `File not found: ${filePath}` };
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        events.toolUse(agentId, sessionId, 'read_file', { path: filePath });
        return { success: true, output: content };
      }

      case 'write_file': {
        const filePath = resolvePath(toolInput.path as string);
        const content = toolInput.content as string;
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
        const linesChanged = content.split('\n').length;
        events.fileEdit(agentId, sessionId, filePath, linesChanged);
        notify.fileEdit(agentId, filePath, linesChanged).catch(() => {});
        return { success: true, output: `File written: ${filePath}` };
      }

      case 'run_command': {
        const command = toolInput.command as string;
        const cwd = toolInput.cwd ? resolvePath(toolInput.cwd as string) : CODEBASE_ROOT;
        try {
          const { stdout, stderr } = await execAsync(command, { cwd, timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
          events.toolUse(agentId, sessionId, 'run_command', { command, cwd });
          return { success: true, output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : '') };
        } catch (err: unknown) {
          const error = err as { stdout?: string; stderr?: string; message?: string };
          return { success: false, output: `Command failed: ${error.stderr || error.message}\nSTDOUT: ${error.stdout || ''}` };
        }
      }

      case 'list_directory': {
        const dirPath = resolvePath(toolInput.path as string);
        if (!fs.existsSync(dirPath)) {
          return { success: false, output: `Directory not found: ${dirPath}` };
        }
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const listing = entries.map(e => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`).join('\n');
        return { success: true, output: listing };
      }

      case 'task_complete':
        return { success: true, output: `TASK_COMPLETE: ${toolInput.summary}` };

      case 'task_failed':
        return { success: false, output: `TASK_FAILED: ${toolInput.error}` };

      default:
        return { success: false, output: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { success: false, output: `Tool error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Build system prompt for agent type
 */
function getSystemPrompt(agentType: string): string {
  const base = `You are an autonomous AI agent working on the Vibe Platform codebase at ${CODEBASE_ROOT}.

TOOLS: read_file, write_file, run_command, list_directory, task_complete, task_failed

WORKFLOW:
1. Understand the task
2. Explore relevant files
3. Implement changes
4. Test with run_command (npm test, npm run build)
5. Call task_complete when done, or task_failed if stuck

RULES:
- Verify changes work before completing
- Write clean code
- Don't make unnecessary changes
`;

  const roles: Record<string, string> = {
    build_agent: 'ROLE: Build Agent - Implement features and fix bugs.',
    qa_agent: 'ROLE: QA Agent - Verify implementations, run tests, find bugs.',
    spec_agent: 'ROLE: Spec Agent - Create technical specifications.',
    planning_agent: 'ROLE: Planning Agent - Analyze codebase, plan work.',
  };

  return base + '\n' + (roles[agentType] || roles.build_agent);
}

/**
 * Build task prompt
 */
function buildTaskPrompt(task: tasks.Task): string {
  let prompt = `# Task: ${task.display_id}\n\n## Title\n${task.title}\n\n`;
  if (task.description) prompt += `## Description\n${task.description}\n\n`;
  if (task.spec_content) prompt += `## Specification\n${task.spec_content}\n\n`;
  if (task.pass_criteria) {
    try {
      const criteria = JSON.parse(task.pass_criteria);
      if (Array.isArray(criteria)) {
        prompt += `## Pass Criteria\n${criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}\n\n`;
      }
    } catch { /* ignore */ }
  }
  return prompt;
}

/**
 * Spawn an agent session - FULLY AUTONOMOUS
 */
export async function spawnAgentSession(options: SpawnOptions): Promise<SpawnResult> {
  const { taskId, agentId, model = 'claude-sonnet-4-20250514', maxIterations = 20 } = options;

  if (!anthropic) {
    return { success: false, sessionId: '', error: 'ANTHROPIC_API_KEY not set' };
  }

  const task = tasks.getTask(taskId);
  const agent = agents.getAgent(agentId);
  if (!task || !agent) {
    return { success: false, sessionId: '', error: `Task or agent not found` };
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

  console.log(`🚀 Spawning ${agent.name} for ${task.display_id}`);

  const sessionState = { aborted: false };
  runningSessions.set(session.id, sessionState);

  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalToolCalls = 0;
  const filesModified: string[] = [];

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: taskPrompt }];

  let iteration = 0;
  let taskCompleted = false;
  let taskFailed = false;
  let finalOutput = '';

  try {
    while (iteration < maxIterations && !sessionState.aborted && !taskCompleted && !taskFailed) {
      iteration++;
      console.log(`  📍 Iteration ${iteration}/${maxIterations}`);

      const response = await anthropic.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
      agents.updateHeartbeat(agentId);

      // Track budget
      budget.recordUsage(agentId, model, response.usage.input_tokens, response.usage.output_tokens, {
        sessionId: session.id,
        taskId,
      });

      const assistantContent: Anthropic.ContentBlock[] = [];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        assistantContent.push(block);

        if (block.type === 'text') {
          finalOutput += block.text + '\n';
        } else if (block.type === 'tool_use') {
          totalToolCalls++;
          console.log(`    🔧 Tool: ${block.name}`);

          const result = await executeTool(block.name, block.input as Record<string, unknown>, session.id, agentId);

          if (block.name === 'write_file') {
            const filePath = (block.input as { path: string }).path;
            if (!filesModified.includes(filePath)) filesModified.push(filePath);
          }

          if (block.name === 'task_complete') {
            taskCompleted = true;
            finalOutput = result.output;
          } else if (block.name === 'task_failed') {
            taskFailed = true;
            finalOutput = result.output;
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result.output.slice(0, 50000),
          });
        }
      }

      messages.push({ role: 'assistant', content: assistantContent });

      if (toolResults.length > 0 && !taskCompleted && !taskFailed) {
        messages.push({ role: 'user', content: toolResults });
      }

      if (response.stop_reason === 'end_turn' && !taskCompleted && !taskFailed) {
        messages.push({ role: 'user', content: 'Continue. Use task_complete when done or task_failed if stuck.' });
      }
    }

    runningSessions.delete(session.id);
    const tokensUsed = totalInputTokens + totalOutputTokens;

    if (taskCompleted) {
      sessions.updateSessionStatus(session.id, 'completed', finalOutput);
      tasks.updateTask(task.id, { status: 'pending_verification' });
      agents.incrementTasksCompleted(agentId);
      events.taskCompleted(taskId, agentId, task.title);
      ws.taskCompleted(tasks.getTask(taskId));
      notify.taskCompleted(agentId, task.display_id, task.title).catch(() => {});

      // Auto-commit
      if (filesModified.length > 0) {
        await git.autoCommitForTask(taskId, task.display_id, agentId, session.id);
      }

      console.log(`✅ ${agent.name} completed ${task.display_id}`);
      return { success: true, sessionId: session.id, output: finalOutput, tokensUsed, filesModified, toolCalls: totalToolCalls };
    } else {
      const errorMsg = taskFailed ? finalOutput : `Max iterations reached`;
      sessions.updateSessionStatus(session.id, 'failed', undefined, errorMsg);
      tasks.failTask(taskId);
      agents.incrementTasksFailed(agentId);
      events.taskFailed(taskId, agentId, task.title, errorMsg);
      ws.taskFailed(tasks.getTask(taskId), errorMsg);
      notify.taskFailed(agentId, task.display_id, errorMsg).catch(() => {});

      console.log(`❌ ${agent.name} failed ${task.display_id}`);
      return { success: false, sessionId: session.id, error: errorMsg, tokensUsed, filesModified, toolCalls: totalToolCalls };
    }
  } catch (error) {
    runningSessions.delete(session.id);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sessions.updateSessionStatus(session.id, 'failed', undefined, errorMessage);
    tasks.failTask(taskId);
    agents.incrementTasksFailed(agentId);
    events.taskFailed(taskId, agentId, task.title, errorMessage);
    ws.taskFailed(tasks.getTask(taskId), errorMessage);

    console.log(`❌ ${agent.name} error: ${errorMessage}`);
    return { success: false, sessionId: session.id, error: errorMessage };
  } finally {
    agents.updateAgentStatus(agentId, 'idle', null, null);
    ws.agentStatusChanged(agents.getAgent(agentId));
    ws.sessionEnded(sessions.getSession(session.id));
  }
}

export function killSession(sessionId: string): boolean {
  const state = runningSessions.get(sessionId);
  if (!state) return false;
  state.aborted = true;
  runningSessions.delete(sessionId);
  sessions.updateSessionStatus(sessionId, 'terminated');
  ws.sessionEnded(sessions.getSession(sessionId));
  return true;
}

export function getRunningSessions(): string[] {
  return Array.from(runningSessions.keys());
}

export function isEnabled(): boolean {
  return !!anthropic;
}

export default { spawnAgentSession, killSession, getRunningSessions, isEnabled };
