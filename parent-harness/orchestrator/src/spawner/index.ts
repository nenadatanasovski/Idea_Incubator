/**
 * Agent Spawner - Creates OpenClaw agent sessions via CLI
 * 
 * This module spawns actual Claude agents using the OpenClaw CLI
 * to work on tasks in isolated sessions.
 */

import { spawn, ChildProcess } from 'child_process';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import * as tasks from '../db/tasks.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';

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
}

// Track running processes
const runningProcesses = new Map<string, ChildProcess>();

/**
 * Spawn an agent session to work on a task
 */
export async function spawnAgentSession(options: SpawnOptions): Promise<SpawnResult> {
  const { taskId, agentId, timeout = 1800, model = 'opus' } = options;

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

  // Log event
  events.agentStarted(agentId, session.id);
  ws.sessionStarted(session);
  ws.agentStatusChanged(agents.getAgent(agentId));

  // Build the task prompt
  const taskPrompt = buildTaskPrompt(task);

  console.log(`🚀 Spawning ${agent.name} for ${task.display_id}`);

  return new Promise((resolve) => {
    // Spawn OpenClaw CLI with sessions_spawn
    const proc = spawn('openclaw', [
      'run',
      '--model', model,
      '--timeout', String(timeout),
      '--message', taskPrompt,
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENCLAW_SESSION_LABEL: `harness-${agent.id}-${task.display_id}`,
      },
    });

    runningProcesses.set(session.id, proc);

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
      
      // Log iteration (simplified - real impl would parse tool calls)
      const iterationNum = session.total_iterations + 1;
      sessions.logIteration(session.id, iterationNum, {
        outputMessage: data.toString(),
        tokensInput: 0,
        tokensOutput: 100, // estimate
        cost: 0,
        durationMs: 0,
        status: 'completed',
      });

      // Update heartbeat
      agents.updateHeartbeat(agentId);
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      runningProcesses.delete(session.id);

      const success = code === 0;

      if (success) {
        // Mark session completed
        sessions.updateSessionStatus(session.id, 'completed', stdout);

        // Mark task completed
        tasks.completeTask(taskId);
        agents.incrementTasksCompleted(agentId);

        events.taskCompleted(taskId, agentId, task.title);
        ws.taskCompleted(tasks.getTask(taskId));

        console.log(`✅ ${agent.name} completed ${task.display_id}`);
      } else {
        // Mark session failed
        sessions.updateSessionStatus(session.id, 'failed', undefined, stderr || `Exit code ${code}`);

        // Mark task failed
        tasks.failTask(taskId);
        agents.incrementTasksFailed(agentId);

        events.taskFailed(taskId, agentId, task.title, stderr || `Exit code ${code}`);
        ws.taskFailed(tasks.getTask(taskId), stderr || `Exit code ${code}`);

        console.log(`❌ ${agent.name} failed ${task.display_id}`);
      }

      // Reset agent to idle
      agents.updateAgentStatus(agentId, 'idle', null, null);
      ws.agentStatusChanged(agents.getAgent(agentId));
      ws.sessionEnded(sessions.getSession(session.id));

      resolve({
        success,
        sessionId: session.id,
        output: success ? stdout : undefined,
        error: success ? undefined : stderr,
      });
    });

    proc.on('error', (error) => {
      runningProcesses.delete(session.id);

      sessions.updateSessionStatus(session.id, 'failed', undefined, error.message);
      agents.updateAgentStatus(agentId, 'error', null, null);
      agents.incrementTasksFailed(agentId);

      events.agentError(agentId, error.message);
      ws.agentStatusChanged(agents.getAgent(agentId));

      resolve({
        success: false,
        sessionId: session.id,
        error: error.message,
      });
    });
  });
}

/**
 * Build a task prompt for the agent
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
        prompt += `## Pass Criteria\n`;
        criteria.forEach((c, i) => {
          prompt += `${i + 1}. ${c}\n`;
        });
        prompt += '\n';
      }
    } catch {
      prompt += `## Pass Criteria\n${task.pass_criteria}\n\n`;
    }
  }

  prompt += `## Instructions\n`;
  prompt += `1. Implement the task according to the specification\n`;
  prompt += `2. Ensure all pass criteria are met\n`;
  prompt += `3. Write tests to verify the implementation\n`;
  prompt += `4. Commit your changes with a descriptive message\n`;

  return prompt;
}

/**
 * Kill a running agent session
 */
export function killSession(sessionId: string): boolean {
  const proc = runningProcesses.get(sessionId);
  if (!proc) return false;

  proc.kill('SIGTERM');
  runningProcesses.delete(sessionId);

  sessions.updateSessionStatus(sessionId, 'terminated');
  ws.sessionEnded(sessions.getSession(sessionId));

  console.log(`🛑 Killed session ${sessionId}`);
  return true;
}

/**
 * Get list of running sessions
 */
export function getRunningSessions(): string[] {
  return Array.from(runningProcesses.keys());
}

export default {
  spawnAgentSession,
  killSession,
  getRunningSessions,
};
