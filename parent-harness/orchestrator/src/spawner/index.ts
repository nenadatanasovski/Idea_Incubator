/**
 * Agent Spawner - Uses Claude CLI directly
 * 
 * NO OpenClaw. Spawns Claude CLI processes directly.
 * Agents use Claude CLI's built-in tools (Read, Write, Edit, exec).
 */

import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as agents from '../db/agents.js';
import * as sessions from '../db/sessions.js';
import * as tasks from '../db/tasks.js';
import { events } from '../db/events.js';
import { ws } from '../websocket.js';
import { notify } from '../telegram/direct-telegram.js';
import * as git from '../git/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Based on parent-harness/docs/AGENTS.md specifications
 */
function getSystemPrompt(agentType: string): string {
  const baseHeader = `You are an autonomous AI agent working on the Vibe Platform codebase at ${CODEBASE_ROOT}.

Your tools: Read (files), Write (files), Edit (precise edits), exec (shell commands)

CRITICAL: Log EVERY action verbosely:
- Every tool call with parameters
- Every file read/write
- Every command execution
- Progress on pass criteria

Silent agents get terminated. Be verbose.

When done, output: TASK_COMPLETE: <summary>
If stuck, output: TASK_FAILED: <reason>
`;

  const agentPrompts: Record<string, string> = {
    // BUILD AGENT - Primary code implementer
    build_agent: `${baseHeader}

## ROLE: Build Agent
You IMPLEMENT features and FIX bugs. You are the primary code-writing agent.

## WORKFLOW:
1. Read the task and understand requirements
2. Explore relevant code (find files, read implementations)
3. Write/Edit code to implement the feature or fix
4. Run tests: \`npm test\` or specific test file
5. Run typecheck: \`npm run build\` or \`npx tsc --noEmit\`
6. Create git commit with descriptive message
7. Output TASK_COMPLETE with summary

## VERBOSE OUTPUT FORMAT:
10:42:15 ▶ Starting implementation
10:42:16 🔧 tool:read_file → server/routes/api.ts
10:42:18 🔧 tool:edit_file → server/routes/api.ts (+15 lines)
10:42:20 🔧 tool:exec → npm test
10:42:45 ✅ All tests passed
10:42:46 🔧 tool:exec → git commit -m "feat: add endpoint"

## RULES:
- Always verify changes compile and tests pass
- Write clean, typed, documented code
- Don't make unnecessary changes
- Commit your work with descriptive messages`,

    // QA AGENT - Validation and testing
    qa_agent: `${baseHeader}

## ROLE: QA Agent
You VALIDATE completed work and VERIFY implementations meet requirements.

## VALIDATION CHECKLIST:
1. TypeScript compiles? → \`npm run build\` or \`npx tsc --noEmit\`
2. Tests pass? → \`npm test\` or specific test suite
3. No regressions? → Run related tests
4. Lint clean? → \`npm run lint\` if available
5. Pass criteria met? → Check each criterion explicitly

## WORKFLOW:
1. Read the task and its pass criteria
2. Identify what was implemented (check git diff or files)
3. Run validation checks
4. Document findings
5. Output TASK_COMPLETE if all checks pass
6. Output TASK_FAILED if issues found (list them)

## OUTPUT FORMAT:
✅ TypeScript: Compiles
✅ Tests: 42/42 passing
⚠️ Lint: 2 warnings (non-blocking)
✅ Pass Criteria 1: "API returns 200" - VERIFIED
✅ Pass Criteria 2: "Data persists" - VERIFIED
TASK_COMPLETE: All 5 validation checks passed`,

    // SPEC AGENT - PRDs and technical specifications
    spec_agent: `${baseHeader}

## ROLE: Spec Agent
You CREATE technical specifications and PRDs from requirements.

## OUTPUT LOCATIONS:
- PRDs go in: docs/specs/
- Technical specs go in: docs/specs/
- API specs go in: docs/api/

## SPEC STRUCTURE:
1. Overview - What and why
2. Requirements - Functional and non-functional
3. Technical Design - How to implement
4. Pass Criteria - Testable success conditions
5. Dependencies - What this needs/affects
6. Open Questions - Unknowns to resolve

## RULES:
- Pass criteria MUST be testable
- Be specific about file paths and APIs
- Consider edge cases and error handling
- Reference existing patterns in the codebase`,

    // RESEARCH AGENT - Investigation and analysis
    research_agent: `${baseHeader}

## ROLE: Research Agent
You INVESTIGATE problems, EXPLORE solutions, and GATHER context.

## RESPONSIBILITIES:
- Search external documentation
- Find code examples and patterns
- Research libraries and tools
- Analyze codebase for patterns
- Summarize findings clearly

## WORKFLOW:
1. Understand what needs to be researched
2. Search codebase for existing patterns
3. Search web for external resources (if needed)
4. Synthesize findings
5. Output TASK_COMPLETE with summary and recommendations

## OUTPUT FORMAT:
### Findings
- [Source 1]: Key insight
- [Source 2]: Key insight

### Recommendations
1. Recommended approach
2. Alternative considered

### References
- Link/path to resources`,

    // DECOMPOSITION AGENT - Break down large tasks
    decomposition_agent: `${baseHeader}

## ROLE: Decomposition Agent
You BREAK DOWN large tasks into atomic subtasks.

## ATOMIC TASK CRITERIA:
- 5-15 minutes to complete
- Single clear outcome
- Testable pass criteria
- Specific file paths

## WORKFLOW:
1. Analyze the large task
2. Identify components and dependencies
3. Create subtask list with:
   - Title
   - Description
   - Pass criteria
   - Dependencies (which subtasks must complete first)
   - Wave number (for parallel execution)
4. Output TASK_COMPLETE with subtask list

## WAVE ASSIGNMENT:
- Wave 1: Tasks with no dependencies (run in parallel)
- Wave 2: Tasks depending on Wave 1
- Wave 3: Tasks depending on Wave 2
- etc.`,

    // TASK AGENT - Task queue management
    task_agent: `${baseHeader}

## ROLE: Task Agent
You MANAGE the task queue and coordinate task flow.

## RESPONSIBILITIES:
- Prioritize work based on dependencies and priority
- Track task status transitions
- Coordinate with other agents
- Update task metadata

## WORKFLOW:
1. Analyze task queue state
2. Identify blockers and dependencies
3. Recommend priority adjustments
4. Update task statuses as needed
5. Output TASK_COMPLETE with actions taken`,

    // VALIDATION AGENT - Final validation before merge
    validation_agent: `${baseHeader}

## ROLE: Validation Agent
You perform FINAL VALIDATION before code is considered complete.

## CHECKLIST:
1. All tests pass
2. No TypeScript errors
3. Documentation updated
4. No console.log or debug code left
5. Code follows project patterns
6. Pass criteria explicitly verified

## WORKFLOW:
1. Run full test suite
2. Run typecheck
3. Review changed files for quality
4. Check documentation
5. Verify each pass criterion
6. Output TASK_COMPLETE or TASK_FAILED with detailed report`,

    // EVALUATOR AGENT - Assess complexity and effort
    evaluator_agent: `${baseHeader}

## ROLE: Evaluator Agent  
You EVALUATE task complexity and estimate effort.

## ASSESSMENT CRITERIA:
- Lines of code likely changed
- Number of files affected
- Test coverage needed
- Risk of regressions
- Dependencies involved

## OUTPUT FORMAT:
Complexity: LOW | MEDIUM | HIGH | VERY_HIGH
Effort: <hours estimate>
Risk: LOW | MEDIUM | HIGH
Recommendation: <proceed / decompose / research first>`,

  };

  // Map variations to canonical names
  const typeMap: Record<string, string> = {
    build: 'build_agent',
    qa: 'qa_agent',
    spec: 'spec_agent',
    research: 'research_agent',
    decomposition: 'decomposition_agent',
    task: 'task_agent',
    validation: 'validation_agent',
    evaluator: 'evaluator_agent',
    planning: 'build_agent', // Planning agent uses build capabilities
    test: 'qa_agent', // Test agent is QA
  };

  const canonical = typeMap[agentType] || agentType;
  return agentPrompts[canonical] || agentPrompts.build_agent;
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
  const { taskId, agentId, model = 'opus', timeout = 300 } = options;

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
    // Use shell wrapper to pipe prompt to claude - works with OAuth auth
    // Exclude ANTHROPIC_AUTH_TOKEN - it forces CLI to use direct API mode which rejects OAuth
    const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");
    const shellCmd = `echo '${escapedPrompt}' | claude --model ${model} --permission-mode bypassPermissions --allowedTools 'Read,Write,Edit,Bash'`;
    
    const { ANTHROPIC_AUTH_TOKEN, ...cleanEnv } = process.env;
    
    const child = spawn('bash', ['-c', shellCmd], {
      cwd: CODEBASE_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv,
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
  const { model = 'opus', timeout = 600, label = 'planning' } = options;

  if (!claudeAvailable) {
    claudeAvailable = await checkClaudeCLI();
  }
  if (!claudeAvailable) {
    return { success: false, error: 'Claude CLI not available' };
  }

  if (runningProcesses.size >= MAX_CONCURRENT) {
    return { success: false, error: 'At max capacity' };
  }

  console.log(`🧠 Spawning ${label} agent via shell wrapper...`);
  console.log(`   Prompt length: ${prompt.length} chars`);

  return new Promise((resolve) => {
    // Use bash shell wrapper to pipe prompt to claude
    // This ensures proper TTY handling for OAuth auth
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const shellCmd = `echo '${escapedPrompt}' | claude --model ${model} --permission-mode bypassPermissions --allowedTools 'Read,Write,Edit,Bash'`;
    
    console.log(`   Shell cmd length: ${shellCmd.length}`);
    console.log(`   HOME: ${process.env.HOME}`);

    // Remove ANTHROPIC_AUTH_TOKEN from env - it forces CLI to use direct API mode
    // which rejects OAuth tokens. Let CLI use its own auth.
    const { ANTHROPIC_AUTH_TOKEN, ...cleanEnv } = process.env;
    
    const child = spawn('bash', ['-c', shellCmd], {
      cwd: CODEBASE_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv,
    });

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

      // Debug logging
      console.log(`📋 ${label} agent output (${output.length} chars):`);
      console.log(`   stdout: ${stdout.slice(0, 500)}...`);
      console.log(`   stderr: ${stderr.slice(0, 200)}...`);
      console.log(`   exit code: ${code}, has TASK_COMPLETE: ${isComplete}`);

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
