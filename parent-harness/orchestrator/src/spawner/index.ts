/**
 * Agent Spawner - Executes tasks via OpenClaw sessions_spawn
 * 
 * Uses OpenClaw's sub-agent spawning which:
 * - Handles OAuth authentication automatically
 * - Provides full tool access (file, exec, browser)
 * - Returns results when complete
 * 
 * NO API KEYS NEEDED - uses OpenClaw's OAuth session
 */

import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import * as tasks from '../db/tasks.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';
import { notify } from '../telegram/index.js';

// Codebase root
const CODEBASE_ROOT = '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

// OpenClaw Gateway URL
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3030';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;

interface SpawnOptions {
  taskId: string;
  agentId: string;
  timeout?: number; // seconds
  model?: string;
}

interface SpawnResult {
  success: boolean;
  sessionId: string;
  output?: string;
  error?: string;
  tokensUsed?: number;
  filesModified?: string[];
}

// Track running sessions (for cancellation)
const runningSessions = new Map<string, { aborted: boolean }>();

/**
 * Get the system prompt for an agent type
 */
function getAgentSystemPrompt(agentType: string): string {
  const basePrompt = `You are an autonomous AI agent working on the Vibe Platform codebase.

## CODEBASE LOCATION
${CODEBASE_ROOT}

## AVAILABLE TOOLS
Use the standard file and exec tools:
- Read: Read file contents
- Write: Create or modify files  
- exec: Execute shell commands (npm, git, etc.)

## WORKFLOW
1. Understand the task requirements
2. Explore relevant files using Read
3. Make changes using Write
4. Test your changes using exec (npm test, npm run build, etc.)
5. When done, output "TASK_COMPLETE:" followed by a summary
6. If you cannot complete the task, output "TASK_FAILED:" followed by the reason

## RULES
- Always verify your changes work before completing
- Write clean, documented code
- Don't make unnecessary changes
- If stuck, explain why in TASK_FAILED

`;

  const typePrompts: Record<string, string> = {
    build_agent: `## ROLE: Build Agent
You implement features and fix bugs. Focus on:
- Clean, maintainable code
- Proper TypeScript types
- Unit tests for new code
- No regressions`,

    qa_agent: `## ROLE: QA Agent
You verify implementations and find bugs. Focus on:
- Running test suites
- Checking edge cases
- Verifying requirements met
- Reporting issues clearly`,

    spec_agent: `## ROLE: Specification Agent
You create technical specifications. Focus on:
- Clear requirements
- Testable acceptance criteria
- Technical approach
- Dependencies and risks`,

    planning_agent: `## ROLE: Planning Agent
You analyze the codebase and plan work. Focus on:
- Identifying gaps and improvements
- Breaking work into tasks
- Setting priorities
- Tracking dependencies`,

    research_agent: `## ROLE: Research Agent
You investigate and gather information. Focus on:
- Finding relevant documentation
- Analyzing code patterns
- Synthesizing findings
- Actionable recommendations`,
  };

  return basePrompt + (typePrompts[agentType] || typePrompts.build_agent);
}

/**
 * Build the task prompt for an agent
 */
function buildTaskPrompt(task: tasks.Task): string {
  let prompt = `# Task: ${task.display_id}\n\n`;
  prompt += `## Title\n${task.title}\n\n`;

  if (task.description) {
    prompt += `## Description\n${task.description}\n\n`;
  }

  if (task.spec_content) {
    prompt += `## Specification\n${task.spec_content}\n\n`;
  }

  if (task.implementation_plan) {
    prompt += `## Implementation Plan\n${task.implementation_plan}\n\n`;
  }

  if (task.pass_criteria) {
    try {
      const criteria = JSON.parse(task.pass_criteria);
      if (Array.isArray(criteria)) {
        prompt += `## Pass Criteria (ALL must be met)\n`;
        criteria.forEach((c: string, i: number) => {
          prompt += `${i + 1}. ${c}\n`;
        });
        prompt += '\n';
      }
    } catch {
      prompt += `## Pass Criteria\n${task.pass_criteria}\n\n`;
    }
  }

  prompt += `## Instructions\n`;
  prompt += `1. Read relevant files to understand the current state\n`;
  prompt += `2. Implement the required changes\n`;
  prompt += `3. Run tests to verify (npm test, npm run build)\n`;
  prompt += `4. Output TASK_COMPLETE: with a summary when done\n`;
  prompt += `5. Output TASK_FAILED: with reason if you cannot proceed\n`;

  return prompt;
}

/**
 * Call OpenClaw Gateway to spawn a sub-agent
 */
async function callOpenClawSpawn(
  task: string,
  options: { label?: string; model?: string; timeoutSeconds?: number }
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/sessions/spawn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(GATEWAY_TOKEN ? { 'Authorization': `Bearer ${GATEWAY_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        task,
        label: options.label,
        model: options.model || 'sonnet',
        runTimeoutSeconds: options.timeoutSeconds || 300,
        cleanup: 'delete',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Gateway error: ${response.status} ${errorText}` };
    }

    const result = await response.json();
    return { 
      success: !result.error,
      output: result.output || result.result,
      error: result.error,
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Failed to call OpenClaw: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Spawn an agent session via OpenClaw
 */
export async function spawnAgentSession(options: SpawnOptions): Promise<SpawnResult> {
  const { 
    taskId, 
    agentId, 
    model = 'sonnet',
    timeout = 300,
  } = options;

  // Get task and agent details
  const task = tasks.getTask(taskId);
  const agent = agents.getAgent(agentId);

  if (!task || !agent) {
    return {
      success: false,
      sessionId: '',
      error: `Task ${taskId} or agent ${agentId} not found`,
    };
  }

  // Create session record
  const session = sessions.createSession(agentId, taskId);
  sessions.updateSessionStatus(session.id, 'running');

  // Update agent status
  agents.updateAgentStatus(agentId, 'working', taskId, session.id);
  agents.updateHeartbeat(agentId);

  // Log event & notify
  events.agentStarted(agentId, session.id);
  ws.sessionStarted(session);
  ws.agentStatusChanged(agents.getAgent(agentId));
  
  // Telegram notification
  await notify.sessionStarted(agentId, task.display_id).catch(() => {});

  // Build the full task prompt with system context
  const systemPrompt = getAgentSystemPrompt(agent.type);
  const taskPrompt = buildTaskPrompt(task);
  const fullTask = `${systemPrompt}\n\n---\n\n${taskPrompt}`;

  console.log(`🚀 Spawning ${agent.name} for ${task.display_id} via OpenClaw...`);

  // Track session for cancellation
  const sessionState = { aborted: false };
  runningSessions.set(session.id, sessionState);

  const startTime = Date.now();

  try {
    // Call OpenClaw to spawn the agent
    const result = await callOpenClawSpawn(fullTask, {
      label: `harness-${agent.type}-${task.display_id}`,
      model: model,
      timeoutSeconds: timeout,
    });

    const durationMs = Date.now() - startTime;
    runningSessions.delete(session.id);

    // Parse the result
    const output = result.output || '';
    const isComplete = output.includes('TASK_COMPLETE:');
    const isFailed = output.includes('TASK_FAILED:') || !result.success;

    if (isComplete && !isFailed) {
      // Extract files modified from output (heuristic)
      const filesModified = extractFilesModified(output);

      // Mark session completed
      sessions.updateSessionStatus(session.id, 'completed', output);

      // Mark task as pending_verification
      tasks.updateTask(task.id, { status: 'pending_verification' });
      agents.incrementTasksCompleted(agentId);

      events.taskCompleted(taskId, agentId, task.title);
      ws.taskCompleted(tasks.getTask(taskId));

      // Telegram notification
      await notify.taskCompleted(agentId, task.display_id, task.title).catch(() => {});

      console.log(`✅ ${agent.name} completed ${task.display_id} (${durationMs}ms)`);

      return {
        success: true,
        sessionId: session.id,
        output,
        filesModified,
      };
    } else {
      // Task failed
      const errorMsg = isFailed 
        ? output.split('TASK_FAILED:')[1]?.trim() || result.error || 'Unknown failure'
        : result.error || 'No completion signal received';
      
      sessions.updateSessionStatus(session.id, 'failed', undefined, errorMsg);
      tasks.failTask(taskId);
      agents.incrementTasksFailed(agentId);

      events.taskFailed(taskId, agentId, task.title, errorMsg);
      ws.taskFailed(tasks.getTask(taskId), errorMsg);

      // Telegram notification
      await notify.taskFailed(agentId, task.display_id, errorMsg).catch(() => {});

      console.log(`❌ ${agent.name} failed ${task.display_id}: ${errorMsg.slice(0, 100)}`);

      return {
        success: false,
        sessionId: session.id,
        error: errorMsg,
      };
    }

  } catch (error) {
    const durationMs = Date.now() - startTime;
    runningSessions.delete(session.id);

    const errorMessage = error instanceof Error ? error.message : String(error);

    sessions.updateSessionStatus(session.id, 'failed', undefined, errorMessage);
    tasks.failTask(taskId);
    agents.incrementTasksFailed(agentId);

    events.taskFailed(taskId, agentId, task.title, errorMessage);
    ws.taskFailed(tasks.getTask(taskId), errorMessage);

    // Telegram notification
    await notify.taskFailed(agentId, task.display_id, errorMessage).catch(() => {});

    console.log(`❌ ${agent.name} error on ${task.display_id}: ${errorMessage}`);

    return {
      success: false,
      sessionId: session.id,
      error: errorMessage,
    };
  } finally {
    // Always reset agent to idle
    agents.updateAgentStatus(agentId, 'idle', null, null);
    ws.agentStatusChanged(agents.getAgent(agentId));
    ws.sessionEnded(sessions.getSession(session.id));
  }
}

/**
 * Extract modified files from agent output (heuristic)
 */
function extractFilesModified(output: string): string[] {
  const files: string[] = [];
  
  // Look for Write tool usage patterns
  const writePattern = /(?:Write|write_file|wrote|created|modified).*?([\/\w.-]+\.[a-z]+)/gi;
  let match;
  while ((match = writePattern.exec(output)) !== null) {
    if (!files.includes(match[1])) {
      files.push(match[1]);
    }
  }

  return files;
}

/**
 * Kill a running agent session
 */
export function killSession(sessionId: string): boolean {
  const state = runningSessions.get(sessionId);
  if (!state) return false;

  state.aborted = true;
  runningSessions.delete(sessionId);

  sessions.updateSessionStatus(sessionId, 'terminated');
  ws.sessionEnded(sessions.getSession(sessionId));

  console.log(`🛑 Killed session ${sessionId}`);
  return true;
}

/**
 * Get list of running sessions
 */
export function getRunningSessions(): string[] {
  return Array.from(runningSessions.keys());
}

export default {
  spawnAgentSession,
  killSession,
  getRunningSessions,
};
