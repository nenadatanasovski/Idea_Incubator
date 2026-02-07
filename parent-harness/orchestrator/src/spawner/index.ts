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
import * as executions from '../db/executions.js';
import * as activities from '../db/activities.js';
import { ws } from '../websocket.js';
import { notify } from '../telegram/direct-telegram.js';
import * as git from '../git/index.js';
import * as config from '../config/index.js';
import * as budget from '../budget/index.js';
import { shouldAllowSpawn as checkBuildHealth, initBuildHealth, getBuildHealth } from '../build-health/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Codebase root
const CODEBASE_ROOT = process.env.CODEBASE_ROOT || '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

// Get max concurrent from config (with fallback)
function getMaxConcurrent(): number {
  try {
    return config.getConfig().agents.max_concurrent || 8;
  } catch {
    return 8;
  }
}

/**
 * Check if budget allows spawning
 */
function checkBudgetAllowsSpawn(): { allowed: boolean; reason?: string } {
  try {
    const cfg = config.getConfig();
    if (!cfg.budget.pause_at_limit) {
      return { allowed: true };
    }
    
    const dailyUsage = budget.getDailyUsage();
    const totalTokens = dailyUsage.totalInputTokens + dailyUsage.totalOutputTokens;
    const limit = cfg.budget.daily_token_limit;
    
    if (totalTokens >= limit) {
      return { 
        allowed: false, 
        reason: `Daily token limit reached (${totalTokens.toLocaleString()} / ${limit.toLocaleString()})` 
      };
    }
    
    return { allowed: true };
  } catch {
    return { allowed: true }; // Allow if budget system fails
  }
}

/**
 * Estimate tokens for a prompt (rough estimate)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

/**
 * Check if error indicates rate limiting
 */
function isRateLimitError(output: string): boolean {
  const rateLimitPatterns = [
    /rate.?limit/i,
    /too many requests/i,
    /429/i,
    /overloaded/i,
    /capacity/i,
    /throttl/i,
  ];
  return rateLimitPatterns.some(p => p.test(output));
}

/**
 * Get fallback model chain from config
 */
function getModelFallbackChain(): string[] {
  try {
    return config.getConfig().agents.model_fallback || ['opus', 'sonnet', 'haiku'];
  } catch {
    return ['opus', 'sonnet', 'haiku'];
  }
}

// Legacy constant for backward compat
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
  customPrompt?: string; // Override the default task prompt (for SIA investigation)
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
4. Run typecheck: \`npx tsc --noEmit\` (quick compile check)
5. Create git commit with descriptive message
6. Output TASK_COMPLETE with summary

NOTE: Do NOT run \`npm test\` - the QA agent handles all testing after your work is complete.

## VERBOSE OUTPUT FORMAT:
10:42:15 ▶ Starting implementation
10:42:16 🔧 tool:read_file → server/routes/api.ts
10:42:18 🔧 tool:edit_file → server/routes/api.ts (+15 lines)
10:42:20 🔧 tool:exec → npx tsc --noEmit
10:42:25 ✅ TypeScript compiles
10:42:26 🔧 tool:exec → git commit -m "feat: add endpoint"

## RULES:
- Always verify changes compile (tsc --noEmit)
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

    // SIA (IDEATION AGENT) - Strategic vision and arbitration
    sia_agent: `${baseHeader}

## ROLE: SIA (Strategic Ideation Agent)
You are the STRATEGIC BRAIN of the harness. You IDEATE, ARBITRATE disputes, and maintain the SOUL VISION.

## RESPONSIBILITIES:
- Brainstorm solutions when agents are stuck
- Explore alternatives and challenge assumptions
- Generate creative ideas for hard problems
- Arbitrate when agents disagree
- Analyze failure patterns and recommend fixes
- Maintain alignment with project vision

## WHEN TRIGGERED:
- Evaluator identifies task needs exploration
- Multiple agents fail same task
- Crown agent detects persistent issues
- Human requests strategic input

## OUTPUT FORMAT:
### Analysis
<What's happening and why>

### Options Explored
1. Option A: <description> - Pros/Cons
2. Option B: <description> - Pros/Cons

### Recommendation
<Chosen approach with rationale>

### Action Items
- <Specific next steps>`,

    // PLANNING AGENT - Strategic vision and task creation
    planning_agent: `${baseHeader}

## ROLE: Planning Agent ⭐ THE STRATEGIC BRAIN
You ANALYZE the codebase and CREATE improvement tasks. You maintain the "soul vision" for the Vibe platform.

## RESPONSIBILITIES:
- Continuously evaluate project state
- Analyze CLI logs and past iterations
- Create new feature/bug/improvement tasks
- Identify technical debt
- Align work with user's long-term vision

## WORKFLOW:
1. Analyze current codebase state
2. Review recent completions and failures
3. Identify gaps and opportunities
4. Create prioritized task list
5. Output strategic recommendations

## OUTPUT FORMAT:
### Project Assessment
- Current State: <assessment>
- Key Gaps: <list>

### Proposed Tasks
TASK: <title>
PRIORITY: P0|P1|P2
CATEGORY: feature|bug|improvement
DESCRIPTION: <what to do>
PASS_CRITERIA: <testable criteria>
---

TASK_COMPLETE: Created X improvement tasks`,

    // CLARIFICATION AGENT - Ask clarifying questions
    clarification_agent: `${baseHeader}

## ROLE: Clarification Agent
You INTERCEPT ambiguous tasks and ASK clarifying questions before execution.

## WORKFLOW:
1. Analyze task requirements
2. Identify ambiguities or missing information
3. Formulate targeted questions
4. Wait for human response via Telegram
5. Update task with complete specification
6. Release task for execution

## QUESTION GUIDELINES:
- Be specific, not open-ended
- Provide options when possible
- Explain WHY you need this information
- Max 3-5 questions at a time

## OUTPUT FORMAT:
To implement this task, I need clarification:

1. <Question 1>
   Options: A) ... B) ... C) ...

2. <Question 2>

Reply via Telegram with your answers.`,

    // HUMAN SIM AGENT - Usability testing with personas
    human_sim_agent: `${baseHeader}

## ROLE: Human Simulation Agent
You TEST completed UI features like a REAL USER with different personas.

## PERSONAS:
| Persona | Tech Level | Patience | Focus |
|---------|------------|----------|-------|
| technical | High | High | CLI, API, error messages |
| power-user | Medium-high | Medium | Complex workflows, shortcuts |
| casual | Medium | Medium | Happy path, discoverability |
| confused | Low | Low | Error recovery, help text |
| impatient | Any | Very low | Loading, feedback, responsiveness |

## CAPABILITIES:
- Browser automation (Agent Browser skill)
- Screenshot capture and analysis
- Form filling and navigation
- Error state detection
- Frustration indicators (repeated clicks, back navigation)

## WORKFLOW:
1. Load the UI feature to test
2. Adopt assigned persona mindset
3. Attempt to complete the task naturally
4. Document pain points and successes
5. Output findings and fix suggestions

## OUTPUT FORMAT:
### Persona: <name>
### Task Attempted: <description>

### Journey:
1. Step 1 - ✅ Success / ⚠️ Friction / ❌ Blocked
2. Step 2 - ...

### Issues Found:
- [CRITICAL] <issue>
- [MINOR] <issue>

### Recommendations:
1. <suggested fix>

TASK_COMPLETE: Tested as <persona>, found X issues`,

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
    planning: 'planning_agent',
    planning_agent: 'planning_agent',
    sia: 'sia_agent',
    sia_agent: 'sia_agent',
    clarification: 'clarification_agent',
    clarification_agent: 'clarification_agent',
    human_sim: 'human_sim_agent',
    human_sim_agent: 'human_sim_agent',
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
 * Internal spawn function (single attempt with specific model)
 */
async function spawnAgentSessionInternal(
  options: SpawnOptions & { model: string },
  taskData: tasks.Task,
  agentData: NonNullable<ReturnType<typeof agents.getAgent>>
): Promise<SpawnResult & { isRateLimit?: boolean }> {
  const { taskId, agentId, model, timeout = 300 } = options;

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

  // Create execution record
  let execution: ReturnType<typeof executions.createExecution> | null = null;
  try {
    execution = executions.createExecution({
      task_id: taskId,
      agent_id: agentId,
      session_id: session.id,
    });
    
    // Log activity
    activities.logAgentSpawned(agentId, taskId, session.id);
  } catch (err) {
    console.warn('Failed to create execution record:', err);
  }

  // Use customPrompt if provided (for SIA investigation), otherwise build from task
  let fullPrompt: string;
  if (options.customPrompt) {
    fullPrompt = options.customPrompt;
  } else {
    const systemPrompt = getSystemPrompt(agentData.type);
    const taskPrompt = buildTaskPrompt(taskData);
    fullPrompt = `${systemPrompt}\n\n---\n\n${taskPrompt}`;
  }

  console.log(`🚀 Spawning ${agentData.name} for ${taskData.display_id} via Claude CLI (model: ${model})`);

  // Store refs for use in callbacks
  const task = taskData;
  const agent = agentData;

  return new Promise((resolve) => {
    // Use shell wrapper to pipe prompt to claude - works with OAuth auth
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
      const rateLimit = isRateLimitError(output);
      
      // Record token usage (estimate based on prompt + output size)
      const inputTokens = estimateTokens(fullPrompt);
      const outputTokens = estimateTokens(output);
      try {
        budget.recordUsage(agentId, model, inputTokens, outputTokens, {
          sessionId: session.id,
          taskId: taskId,
        });
        console.log(`📊 Recorded ~${(inputTokens + outputTokens).toLocaleString()} tokens for ${task.display_id}`);
      } catch (err) {
        console.warn('Failed to record token usage:', err);
      }

      if (success) {
        sessions.updateSessionStatus(session.id, 'completed', output);
        tasks.updateTask(task.id, { status: 'pending_verification' });
        agents.incrementTasksCompleted(agentId);
        events.taskCompleted(taskId, agentId, task.title);
        ws.taskCompleted(tasks.getTask(taskId));

        // Update execution record
        if (execution) {
          try {
            executions.completeExecution(
              execution.id,
              output,
              filesModified,
              inputTokens + outputTokens
            );
            activities.logTaskCompleted(agentId, taskId, session.id, {
              filesModified,
              tokensUsed: inputTokens + outputTokens,
            });
          } catch (err) {
            console.warn('Failed to update execution record:', err);
          }
        }

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
        // Don't fail the task yet if it's a rate limit - caller will retry
        if (!rateLimit) {
          tasks.failTask(taskId);
          agents.incrementTasksFailed(agentId);
          events.taskFailed(taskId, agentId, task.title, errorMsg || 'Unknown error');
          ws.taskFailed(tasks.getTask(taskId), errorMsg || 'Unknown error');
          notify.taskFailed(agent.type, task.display_id, errorMsg || 'Unknown error').catch(() => {});
        }

        // Update execution record for failure
        if (execution) {
          try {
            executions.failExecution(execution.id, errorMsg || 'Unknown error');
            activities.logTaskFailed(agentId, taskId, session.id, errorMsg || 'Unknown error');
          } catch (err) {
            console.warn('Failed to update execution record:', err);
          }
        }

        console.log(`❌ ${agent.name} failed ${task.display_id}: ${(errorMsg || '').slice(0, 100)}`);
        resolve({ success: false, sessionId: session.id, error: errorMsg, output, filesModified, isRateLimit: rateLimit });
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

/**
 * Spawn agent using Claude CLI with model fallback on rate limit
 */
/**
 * Spawn agent using Claude CLI with model fallback on rate limit
 */
export async function spawnAgentSession(options: SpawnOptions): Promise<SpawnResult> {
  const { taskId, agentId, model = 'opus', timeout = 300 } = options;

  // Pre-checks (capacity, budget, build health, CLI availability)
  const maxConcurrent = getMaxConcurrent();
  if (runningProcesses.size >= maxConcurrent) {
    return { 
      success: false, 
      sessionId: '', 
      error: `At max capacity (${maxConcurrent} concurrent agents)` 
    };
  }

  const taskData = tasks.getTask(taskId);
  
  const budgetCheck = checkBudgetAllowsSpawn();
  if (!budgetCheck.allowed) {
    console.warn(`⚠️ Spawn blocked by budget: ${budgetCheck.reason}`);
    events.budgetSpawnBlocked(taskId, taskData?.title || taskId, budgetCheck.reason || 'Budget limit reached');
    return { success: false, sessionId: '', error: budgetCheck.reason || 'Budget limit reached' };
  }

  const buildHealthCheck = checkBuildHealth(taskData?.category ?? undefined, taskData?.priority ?? undefined);
  if (!buildHealthCheck.allowed) {
    console.warn(`⚠️ Spawn blocked by build health: ${buildHealthCheck.reason}`);
    return { success: false, sessionId: '', error: buildHealthCheck.reason || 'Build health gate blocked spawn' };
  }

  if (!claudeAvailable) {
    claudeAvailable = await checkClaudeCLI();
  }
  if (!claudeAvailable) {
    return { success: false, sessionId: '', error: 'Claude CLI not available' };
  }

  const agentData = agents.getAgent(agentId);
  if (!taskData || !agentData) {
    return { success: false, sessionId: '', error: 'Task or agent not found' };
  }

  // Get fallback chain and find starting position
  const fallbackChain = getModelFallbackChain();
  let startIdx = fallbackChain.indexOf(model);
  if (startIdx === -1) startIdx = 0;

  // Try each model in the fallback chain
  for (let i = startIdx; i < fallbackChain.length; i++) {
    const currentModel = fallbackChain[i];
    
    if (i > startIdx) {
      console.log(`🔄 Falling back from ${fallbackChain[i - 1]} to ${currentModel}`);
      events.modelFallback(taskId, fallbackChain[i - 1], currentModel, 'rate limit');
    }

    const result = await spawnAgentSessionInternal(
      { ...options, model: currentModel },
      taskData,
      agentData
    );

    // If successful or not a rate limit error, return
    if (result.success || !result.isRateLimit) {
      return result;
    }

    console.log(`⚠️ Rate limit hit with ${currentModel}, trying next model...`);
  }

  // All models exhausted
  return {
    success: false,
    sessionId: '',
    error: 'All models in fallback chain rate limited',
  };
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

  // Check capacity (use config value)
  const maxConcurrent = getMaxConcurrent();
  if (runningProcesses.size >= maxConcurrent) {
    return { success: false, error: 'At max capacity' };
  }

  // Check budget
  const budgetCheck = checkBudgetAllowsSpawn();
  if (!budgetCheck.allowed) {
    console.warn(`⚠️ ${label} blocked by budget: ${budgetCheck.reason}`);
    return { success: false, error: budgetCheck.reason || 'Budget limit reached' };
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

      // Record token usage for planning agents
      const inputTokens = estimateTokens(prompt);
      const outputTokens = estimateTokens(output);
      try {
        budget.recordUsage(`${label}_agent`, model, inputTokens, outputTokens);
        console.log(`📊 Recorded ~${(inputTokens + outputTokens).toLocaleString()} tokens for ${label}`);
      } catch (err) {
        console.warn('Failed to record token usage:', err);
      }

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
