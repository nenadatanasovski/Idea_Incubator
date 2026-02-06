/**
 * Agent Spawner - Executes tasks using Claude via Anthropic SDK
 * 
 * This module runs Claude agents directly using the Anthropic SDK,
 * following the same pattern as the Vibe platform's agent-runner.
 */

import Anthropic from '@anthropic-ai/sdk';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import * as tasks from '../db/tasks.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
}

// Track running sessions (for cancellation)
const runningSessions = new Map<string, AbortController>();

/**
 * Get the system prompt for an agent type
 */
function getAgentSystemPrompt(agentType: string): string {
  const prompts: Record<string, string> = {
    build_agent: `You are a senior software engineer. Your job is to implement features and fix bugs.

## APPROACH
1. Read the task requirements carefully
2. Plan your implementation before coding
3. Write clean, well-documented code
4. Add appropriate tests
5. Verify your changes work

## OUTPUT
When you complete the task, provide:
- Summary of changes made
- Files modified/created
- Tests added
- Any follow-up tasks needed`,

    qa_agent: `You are a QA engineer. Your job is to test implementations and find bugs.

## APPROACH
1. Understand what was implemented
2. Write comprehensive test cases
3. Test edge cases and error handling
4. Verify performance if applicable

## OUTPUT
Provide a test report including:
- Tests run and results
- Bugs found (if any)
- Recommendations`,

    spec_agent: `You are a technical writer and architect. Your job is to create specifications.

## APPROACH
1. Understand the requirements
2. Define clear acceptance criteria
3. Document technical approach
4. Identify dependencies and risks

## OUTPUT
Provide a specification document with:
- Overview
- Requirements
- Technical approach
- Acceptance criteria`,

    planning_agent: `You are a project planner. Your job is to analyze work and create actionable tasks.

## APPROACH
1. Analyze the codebase and current state
2. Identify gaps and improvements needed
3. Break work into small, actionable tasks
4. Prioritize based on impact and dependencies

## OUTPUT
Provide a list of tasks with:
- Clear titles
- Descriptions
- Priority (P0-P4)
- Dependencies`,

    research_agent: `You are a research analyst. Your job is to investigate and provide insights.

## APPROACH
1. Understand what needs to be researched
2. Gather relevant information
3. Analyze and synthesize findings
4. Provide actionable recommendations

## OUTPUT
Provide a research report with:
- Findings
- Analysis
- Recommendations`,
  };

  return prompts[agentType] || prompts.build_agent;
}

/**
 * Build the task prompt for an agent
 */
function buildTaskPrompt(task: tasks.Task, agent: agents.Agent): string {
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
        criteria.forEach((c: string, i: number) => {
          prompt += `${i + 1}. ${c}\n`;
        });
        prompt += '\n';
      }
    } catch {
      prompt += `## Pass Criteria\n${task.pass_criteria}\n\n`;
    }
  }

  // Add codebase context
  prompt += `## Codebase\n`;
  prompt += `Working directory: /home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator\n`;
  prompt += `This is a TypeScript project with React frontend and Express backend.\n\n`;

  prompt += `## Instructions\n`;
  prompt += `1. Implement the task according to the specification\n`;
  prompt += `2. Ensure all pass criteria are met\n`;
  prompt += `3. Write tests to verify the implementation\n`;
  prompt += `4. Provide a summary of your changes\n`;

  return prompt;
}

/**
 * Spawn an agent session to work on a task
 */
export async function spawnAgentSession(options: SpawnOptions): Promise<SpawnResult> {
  const { taskId, agentId, model = 'claude-sonnet-4-20250514' } = options;

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

  // Build prompts
  const systemPrompt = getAgentSystemPrompt(agent.type);
  const taskPrompt = buildTaskPrompt(task, agent);

  console.log(`🚀 Spawning ${agent.name} for ${task.display_id} (using Anthropic SDK)`);

  // Create abort controller for cancellation
  const abortController = new AbortController();
  runningSessions.set(session.id, abortController);

  const startTime = Date.now();

  try {
    // Call Claude via Anthropic SDK
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        { role: 'user', content: taskPrompt }
      ],
    });

    const durationMs = Date.now() - startTime;
    runningSessions.delete(session.id);

    // Extract response text
    const output = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('\n');

    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    // Log iteration
    sessions.logIteration(session.id, 1, {
      outputMessage: output,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      cost: tokensUsed * 0.00001, // Rough estimate
      durationMs,
      status: 'completed',
    });

    // Mark session completed
    sessions.updateSessionStatus(session.id, 'completed', output);

    // Mark task completed
    tasks.completeTask(taskId);
    agents.incrementTasksCompleted(agentId);

    events.taskCompleted(taskId, agentId, task.title);
    ws.taskCompleted(tasks.getTask(taskId));

    // Reset agent to idle
    agents.updateAgentStatus(agentId, 'idle', null, null);
    ws.agentStatusChanged(agents.getAgent(agentId));
    ws.sessionEnded(sessions.getSession(session.id));

    console.log(`✅ ${agent.name} completed ${task.display_id} (${tokensUsed} tokens, ${durationMs}ms)`);

    return {
      success: true,
      sessionId: session.id,
      output,
      tokensUsed,
    };

  } catch (error) {
    const durationMs = Date.now() - startTime;
    runningSessions.delete(session.id);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log failed iteration
    sessions.logIteration(session.id, 1, {
      outputMessage: '',
      tokensInput: 0,
      tokensOutput: 0,
      cost: 0,
      durationMs,
      status: 'failed',
      errorMessage: errorMessage,
    });

    // Mark session failed
    sessions.updateSessionStatus(session.id, 'failed', undefined, errorMessage);

    // Mark task failed
    tasks.failTask(taskId);
    agents.incrementTasksFailed(agentId);

    events.taskFailed(taskId, agentId, task.title, errorMessage);
    ws.taskFailed(tasks.getTask(taskId), errorMessage);

    // Reset agent to idle
    agents.updateAgentStatus(agentId, 'idle', null, null);
    ws.agentStatusChanged(agents.getAgent(agentId));
    ws.sessionEnded(sessions.getSession(session.id));

    console.log(`❌ ${agent.name} failed ${task.display_id}: ${errorMessage}`);

    return {
      success: false,
      sessionId: session.id,
      error: errorMessage,
    };
  }
}

/**
 * Kill a running agent session
 */
export function killSession(sessionId: string): boolean {
  const controller = runningSessions.get(sessionId);
  if (!controller) return false;

  controller.abort();
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
