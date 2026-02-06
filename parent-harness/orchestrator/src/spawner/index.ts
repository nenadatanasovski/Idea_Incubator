/**
 * Agent Spawner - Executes tasks using Claude with REAL tool execution
 * 
 * This module runs Claude agents with:
 * - File read/write tools
 * - Shell execution
 * - Multi-turn conversation loop
 * - Tool call tracking and Telegram notifications
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

const execAsync = promisify(exec);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Codebase root
const CODEBASE_ROOT = '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

// Tool definitions for Claude
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file (relative to codebase root or absolute)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file (creates directories if needed)',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file (relative to codebase root or absolute)',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command and return the output',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (optional, defaults to codebase root)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'list_directory',
    description: 'List contents of a directory',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the directory',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'task_complete',
    description: 'Signal that the task is complete with a summary',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Summary of what was accomplished',
        },
        files_modified: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files that were modified',
        },
      },
      required: ['summary'],
    },
  },
  {
    name: 'task_failed',
    description: 'Signal that the task failed with an error',
    input_schema: {
      type: 'object',
      properties: {
        error: {
          type: 'string',
          description: 'Description of what went wrong',
        },
        reason: {
          type: 'string',
          description: 'Why the task cannot be completed',
        },
      },
      required: ['error'],
    },
  },
];

interface SpawnOptions {
  taskId: string;
  agentId: string;
  timeout?: number; // seconds
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

interface ToolResult {
  success: boolean;
  output: string;
}

// Track running sessions (for cancellation)
const runningSessions = new Map<string, { aborted: boolean }>();

/**
 * Resolve path relative to codebase root
 */
function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
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
): Promise<ToolResult> {
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
        
        // Create directory if needed
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, content);
        events.fileEdit(agentId, sessionId, filePath, content.split('\n').length);
        return { success: true, output: `File written: ${filePath}` };
      }

      case 'run_command': {
        const command = toolInput.command as string;
        const cwd = toolInput.cwd ? resolvePath(toolInput.cwd as string) : CODEBASE_ROOT;
        
        try {
          const { stdout, stderr } = await execAsync(command, { 
            cwd, 
            timeout: 60000,
            maxBuffer: 10 * 1024 * 1024, // 10MB
          });
          events.toolUse(agentId, sessionId, 'run_command', { command, cwd });
          return { 
            success: true, 
            output: stdout + (stderr ? `\nSTDERR:\n${stderr}` : '') 
          };
        } catch (err: unknown) {
          const error = err as { stdout?: string; stderr?: string; message?: string };
          return { 
            success: false, 
            output: `Command failed: ${error.stderr || error.message || 'Unknown error'}\nSTDOUT: ${error.stdout || ''}` 
          };
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

      case 'task_complete': {
        return { 
          success: true, 
          output: `TASK_COMPLETE: ${toolInput.summary}` 
        };
      }

      case 'task_failed': {
        return { 
          success: false, 
          output: `TASK_FAILED: ${toolInput.error}` 
        };
      }

      default:
        return { success: false, output: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { 
      success: false, 
      output: `Tool execution error: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Get the system prompt for an agent type
 */
function getAgentSystemPrompt(agentType: string): string {
  const basePrompt = `You are an autonomous AI agent working on the Vibe Platform codebase.

## CODEBASE LOCATION
${CODEBASE_ROOT}

## AVAILABLE TOOLS
- read_file: Read file contents
- write_file: Create or modify files
- run_command: Execute shell commands (npm, git, etc.)
- list_directory: List directory contents
- task_complete: Signal task completion with summary
- task_failed: Signal task failure with reason

## WORKFLOW
1. Understand the task requirements
2. Explore relevant files using read_file and list_directory
3. Make changes using write_file
4. Test your changes using run_command (npm test, npm run build, etc.)
5. If tests pass, call task_complete with a summary
6. If you cannot complete the task, call task_failed with the reason

## RULES
- Always verify your changes work before completing
- Write clean, documented code
- Don't make unnecessary changes
- If stuck, explain why in task_failed

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
  prompt += `4. Call task_complete when done, or task_failed if you cannot proceed\n`;

  return prompt;
}

/**
 * Spawn an agent session with full tool execution loop
 */
export async function spawnAgentSession(options: SpawnOptions): Promise<SpawnResult> {
  const { 
    taskId, 
    agentId, 
    model = 'claude-sonnet-4-20250514',
    maxIterations = 20 
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

  // Log event
  events.agentStarted(agentId, session.id);
  ws.sessionStarted(session);
  ws.agentStatusChanged(agents.getAgent(agentId));

  // Build prompts
  const systemPrompt = getAgentSystemPrompt(agent.type);
  const taskPrompt = buildTaskPrompt(task);

  console.log(`🚀 Spawning ${agent.name} for ${task.display_id} (with tools, max ${maxIterations} iterations)`);

  // Track session for cancellation
  const sessionState = { aborted: false };
  runningSessions.set(session.id, sessionState);

  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalToolCalls = 0;
  const filesModified: string[] = [];

  // Conversation history
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: taskPrompt }
  ];

  let iteration = 0;
  let taskCompleted = false;
  let taskFailed = false;
  let finalOutput = '';

  try {
    // Main conversation loop
    while (iteration < maxIterations && !sessionState.aborted && !taskCompleted && !taskFailed) {
      iteration++;
      console.log(`  📍 Iteration ${iteration}/${maxIterations}`);

      // Call Claude
      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 8192,
        system: systemPrompt,
        tools: TOOLS,
        messages: messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Update heartbeat
      agents.updateHeartbeat(agentId);

      // Process response
      const assistantContent: Anthropic.ContentBlock[] = [];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        assistantContent.push(block);

        if (block.type === 'text') {
          finalOutput += block.text + '\n';
        } else if (block.type === 'tool_use') {
          totalToolCalls++;
          console.log(`    🔧 Tool: ${block.name}`);

          // Execute tool
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            session.id,
            agentId
          );

          // Track file modifications
          if (block.name === 'write_file') {
            const filePath = (block.input as { path: string }).path;
            if (!filesModified.includes(filePath)) {
              filesModified.push(filePath);
            }
          }

          // Check for completion signals
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
            content: result.output.slice(0, 50000), // Limit result size
          });
        }
      }

      // Add assistant response to history
      messages.push({ role: 'assistant', content: assistantContent });

      // If there were tool calls, add results and continue
      if (toolResults.length > 0 && !taskCompleted && !taskFailed) {
        messages.push({ role: 'user', content: toolResults });
      }

      // If model stopped without tool calls and didn't complete, prompt it
      if (response.stop_reason === 'end_turn' && !taskCompleted && !taskFailed) {
        messages.push({ 
          role: 'user', 
          content: 'Please continue working on the task. Use task_complete when done or task_failed if you cannot proceed.' 
        });
      }

      // Log iteration
      sessions.logIteration(session.id, iteration, {
        outputMessage: finalOutput.slice(-1000),
        tokensInput: response.usage.input_tokens,
        tokensOutput: response.usage.output_tokens,
        toolCalls: toolResults.map(r => ({ tool_use_id: r.tool_use_id })),
        cost: (response.usage.input_tokens * 0.000003) + (response.usage.output_tokens * 0.000015),
        durationMs: Date.now() - startTime,
        status: taskCompleted ? 'completed' : taskFailed ? 'failed' : 'running',
      });
    }

    const durationMs = Date.now() - startTime;
    runningSessions.delete(session.id);

    const tokensUsed = totalInputTokens + totalOutputTokens;

    if (taskCompleted) {
      // Mark session completed
      sessions.updateSessionStatus(session.id, 'completed', finalOutput);

      // Mark task as pending_verification (not completed - QA needs to verify)
      tasks.updateTask(task.id, { status: 'pending_verification' });
      agents.incrementTasksCompleted(agentId);

      events.taskCompleted(taskId, agentId, task.title);
      ws.taskCompleted(tasks.getTask(taskId));

      console.log(`✅ ${agent.name} completed ${task.display_id} (${tokensUsed} tokens, ${totalToolCalls} tools, ${durationMs}ms)`);

      return {
        success: true,
        sessionId: session.id,
        output: finalOutput,
        tokensUsed,
        filesModified,
        toolCalls: totalToolCalls,
      };
    } else {
      // Task failed or ran out of iterations
      const errorMsg = taskFailed ? finalOutput : `Max iterations (${maxIterations}) reached without completion`;
      
      sessions.updateSessionStatus(session.id, 'failed', undefined, errorMsg);
      tasks.failTask(taskId);
      agents.incrementTasksFailed(agentId);

      events.taskFailed(taskId, agentId, task.title, errorMsg);
      ws.taskFailed(tasks.getTask(taskId), errorMsg);

      console.log(`❌ ${agent.name} failed ${task.display_id}: ${errorMsg.slice(0, 100)}`);

      return {
        success: false,
        sessionId: session.id,
        error: errorMsg,
        tokensUsed,
        filesModified,
        toolCalls: totalToolCalls,
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

    // Reset agent to idle
    agents.updateAgentStatus(agentId, 'idle', null, null);
    ws.agentStatusChanged(agents.getAgent(agentId));
    ws.sessionEnded(sessions.getSession(session.id));

    console.log(`❌ ${agent.name} error on ${task.display_id}: ${errorMessage}`);

    return {
      success: false,
      sessionId: session.id,
      error: errorMessage,
      tokensUsed: totalInputTokens + totalOutputTokens,
      toolCalls: totalToolCalls,
    };
  } finally {
    // Always reset agent to idle
    agents.updateAgentStatus(agentId, 'idle', null, null);
    ws.agentStatusChanged(agents.getAgent(agentId));
    ws.sessionEnded(sessions.getSession(session.id));
  }
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
