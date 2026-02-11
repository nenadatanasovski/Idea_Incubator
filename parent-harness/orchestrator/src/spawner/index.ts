/**
 * Agent Spawner - Uses Claude CLI directly
 *
 * NO OpenClaw. Spawns Claude CLI processes directly.
 * Agents use Claude CLI's built-in tools (Read, Write, Edit, exec).
 */

import { spawn, ChildProcess } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as agents from "../db/agents.js";
import * as sessions from "../db/sessions.js";
import * as tasks from "../db/tasks.js";
import { events } from "../db/events.js";
import * as executions from "../db/executions.js";
import * as activities from "../db/activities.js";
import { buildIntrospectionContext } from "../memory/prompt-builder.js";
import { ws } from "../websocket.js";
import { notify } from "../telegram/direct-telegram.js";
import * as git from "../git/index.js";
import * as config from "../config/index.js";
import * as budget from "../budget/index.js";
import {
  shouldAllowSpawn as checkBuildHealth,
  initBuildHealth,
  getBuildHealth,
} from "../build-health/index.js";
import {
  rateLimiter,
  estimateTokens as estimateTokensForRateLimit,
  initializeRateLimiter,
} from "./rate-limiter.js";
import {
  setRateLimitBackoff,
  isRateLimited,
  getRateLimitStatus,
} from "../rate-limit/backoff-state.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Codebase root
const CODEBASE_ROOT =
  process.env.CODEBASE_ROOT ||
  "/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator";

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
    const totalTokens =
      dailyUsage.totalInputTokens + dailyUsage.totalOutputTokens;
    const limit = cfg.budget.daily_token_limit;

    if (totalTokens >= limit) {
      return {
        allowed: false,
        reason: `Daily token limit reached (${totalTokens.toLocaleString()} / ${limit.toLocaleString()})`,
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // Allow if budget system fails
  }
}

/**
 * Estimate tokens for a prompt (rough estimate - fallback only)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token (used only as fallback)
  return Math.ceil(text.length / 4);
}

// ============ RATE LIMIT PROTECTION: Rolling 5-Hour Window Tracking ============
// PERSISTED to database to survive restarts

import {
  run as dbRun,
  query as dbQuery,
  getOne as dbGetOne,
} from "../db/index.js";

// Alias to avoid confusion with other 'run' functions
const run = dbRun;
const query = dbQuery;
const getOne = dbGetOne;

interface SpawnRecord {
  id?: number;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

const ROLLING_WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours

// Get limits from config (with defaults)
function getRollingWindowLimits(): { maxSpawns: number; maxCostUsd: number } {
  try {
    const cfg = config.getConfig();
    return {
      maxSpawns: (cfg as any).rate_limit?.max_spawns_per_window ?? 400,
      maxCostUsd: (cfg as any).rate_limit?.max_cost_per_window_usd ?? 20,
    };
  } catch {
    return { maxSpawns: 400, maxCostUsd: 20 };
  }
}

// Ensure spawn_window table exists
function ensureSpawnWindowTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS spawn_window (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      model TEXT NOT NULL
    )
  `);
  run(
    `CREATE INDEX IF NOT EXISTS idx_spawn_window_timestamp ON spawn_window(timestamp)`,
  );
}

// Initialize on module load
ensureSpawnWindowTable();

/**
 * Add a spawn record to the rolling window (PERSISTED)
 */
function recordSpawnInWindow(record: SpawnRecord): void {
  // Insert new record
  run(
    `
    INSERT INTO spawn_window (timestamp, input_tokens, output_tokens, cost_usd, model)
    VALUES (?, ?, ?, ?, ?)
  `,
    [
      record.timestamp,
      record.inputTokens,
      record.outputTokens,
      record.costUsd,
      record.model,
    ],
  );

  // Prune old records (older than 5 hours)
  const cutoff = Date.now() - ROLLING_WINDOW_MS;
  run(`DELETE FROM spawn_window WHERE timestamp < ?`, [cutoff]);
}

/**
 * Get rolling window statistics (FROM DATABASE - survives restarts)
 */
function getRollingWindowStats(): {
  spawnsInWindow: number;
  tokensInWindow: number;
  costInWindow: number;
  oldestTimestamp: number | null;
} {
  const cutoff = Date.now() - ROLLING_WINDOW_MS;

  const stats = getOne<{
    count: number;
    total_input: number;
    total_output: number;
    total_cost: number;
    oldest: number | null;
  }>(
    `
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(input_tokens), 0) as total_input,
      COALESCE(SUM(output_tokens), 0) as total_output,
      COALESCE(SUM(cost_usd), 0) as total_cost,
      MIN(timestamp) as oldest
    FROM spawn_window 
    WHERE timestamp >= ?
  `,
    [cutoff],
  );

  return {
    spawnsInWindow: stats?.count ?? 0,
    tokensInWindow: (stats?.total_input ?? 0) + (stats?.total_output ?? 0),
    costInWindow: stats?.total_cost ?? 0,
    oldestTimestamp: stats?.oldest ?? null,
  };
}

/**
 * Check if we should allow spawning based on rolling window
 */
function checkRollingWindowAllowsSpawn(): {
  allowed: boolean;
  reason?: string;
  stats: ReturnType<typeof getRollingWindowStats>;
} {
  const stats = getRollingWindowStats();
  const limits = getRollingWindowLimits();

  // Check spawn count (80% threshold)
  if (stats.spawnsInWindow >= limits.maxSpawns * 0.8) {
    console.warn(
      `⚠️ Rolling window spawn limit: ${stats.spawnsInWindow}/${limits.maxSpawns}`,
    );
    return {
      allowed: false,
      reason: `Rolling window at ${stats.spawnsInWindow}/${limits.maxSpawns} spawns (80% threshold)`,
      stats,
    };
  }

  // Check cost (80% threshold)
  if (stats.costInWindow >= limits.maxCostUsd * 0.8) {
    console.warn(
      `⚠️ Rolling window cost limit: $${stats.costInWindow.toFixed(2)}/$${limits.maxCostUsd}`,
    );
    return {
      allowed: false,
      reason: `Rolling window cost at $${stats.costInWindow.toFixed(2)}/$${limits.maxCostUsd} (80% threshold)`,
      stats,
    };
  }

  return { allowed: true, stats };
}

/**
 * Parse Claude CLI JSON output for real token counts
 */
interface ClaudeJsonOutput {
  type: string;
  subtype?: string;
  is_error: boolean;
  result: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  duration_ms?: number;
  num_turns?: number;
}

function parseClaudeJsonOutput(output: string): ClaudeJsonOutput | null {
  try {
    // Try to find and parse JSON in the output
    // The output might have multiple lines or be wrapped
    const lines = output.trim().split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const parsed = JSON.parse(trimmed);
        if (parsed.type === "result" && parsed.usage) {
          return parsed as ClaudeJsonOutput;
        }
      }
    }
    // If no valid JSON found, try parsing the whole output
    const parsed = JSON.parse(output.trim());
    if (parsed.type === "result" && parsed.usage) {
      return parsed as ClaudeJsonOutput;
    }
  } catch {
    // JSON parsing failed - output is not JSON
  }
  return null;
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
  return rateLimitPatterns.some((p) => p.test(output));
}

/**
 * Get fallback model chain from config
 */
function getModelFallbackChain(): string[] {
  try {
    return (
      config.getConfig().agents.model_fallback || ["opus", "sonnet", "haiku"]
    );
  } catch {
    return ["opus", "sonnet", "haiku"];
  }
}

// Legacy constant for backward compat
const MAX_CONCURRENT = 8;

// ============ RATE LIMIT PROTECTION ============
// PERSISTED state to survive restarts

// Ensure spawner_state table exists
function ensureSpawnerStateTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS spawner_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}
ensureSpawnerStateTable();

// Get persisted state value
function getSpawnerState(key: string): string | null {
  const row = getOne<{ value: string }>(
    `SELECT value FROM spawner_state WHERE key = ?`,
    [key],
  );
  return row?.value ?? null;
}

// Set persisted state value
function setSpawnerState(key: string, value: string): void {
  run(
    `
    INSERT INTO spawner_state (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
  `,
    [key, value, Date.now(), value, Date.now()],
  );
}

// Serial execution lock for build agents (only 1 at a time)
// Queue is persisted to database
const buildAgentLock = {
  get locked(): boolean {
    return getSpawnerState("build_agent_locked") === "true";
  },
  set locked(val: boolean) {
    setSpawnerState("build_agent_locked", val ? "true" : "false");
  },
  get queue(): string[] {
    const val = getSpawnerState("build_agent_queue");
    return val ? JSON.parse(val) : [];
  },
  addToQueue(taskId: string): void {
    const q = this.queue;
    // Deduplicate - don't add if already queued
    if (!q.includes(taskId)) {
      q.push(taskId);
      setSpawnerState("build_agent_queue", JSON.stringify(q));
    }
  },
  isQueued(taskId: string): boolean {
    return this.queue.includes(taskId);
  },
  shiftQueue(): string | undefined {
    const q = this.queue;
    const next = q.shift();
    setSpawnerState("build_agent_queue", JSON.stringify(q));
    return next;
  },
};

// Spawn cooldown to prevent burst consumption (PERSISTED)
const MIN_SPAWN_DELAY_MS = 5000; // 5 seconds between any spawns

function getLastSpawnTime(): number {
  const val = getSpawnerState("last_spawn_time");
  return val ? parseInt(val, 10) : 0;
}

function setLastSpawnTime(time: number): void {
  setSpawnerState("last_spawn_time", String(time));
}

// Model selection by agent type (save expensive models for coding)
const MODEL_BY_AGENT_TYPE: Record<string, string> = {
  build_agent: "opus", // Needs quality for implementation
  build: "opus",
  qa_agent: "sonnet", // Validation doesn't need Opus
  qa: "sonnet",
  validation_agent: "sonnet",
  validation: "sonnet",
  planning_agent: "haiku", // Already cheap
  planning: "haiku",
  research_agent: "haiku", // Lightweight
  research: "haiku",
  decomposition_agent: "haiku",
  decomposition: "haiku",
  spec_agent: "sonnet", // Specs need some quality
  spec: "sonnet",
  sia_agent: "sonnet", // Strategic thinking
  sia: "sonnet",
  evaluator_agent: "haiku", // Simple assessment
  evaluator: "haiku",
  clarification_agent: "haiku",
  clarification: "haiku",
  task_agent: "haiku",
  task: "haiku",
  human_sim_agent: "sonnet",
  human_sim: "sonnet",
};

/**
 * Get appropriate model for agent type (rate limit optimization)
 */
function getModelForAgentType(agentType: string): string {
  return MODEL_BY_AGENT_TYPE[agentType] || "sonnet"; // Default to sonnet, not opus
}

/**
 * Enforce spawn cooldown (PERSISTED - survives restarts)
 */
async function enforceSpawnCooldown(): Promise<void> {
  const now = Date.now();
  const lastSpawn = getLastSpawnTime();
  const timeSinceLastSpawn = now - lastSpawn;

  if (timeSinceLastSpawn < MIN_SPAWN_DELAY_MS) {
    const delay = MIN_SPAWN_DELAY_MS - timeSinceLastSpawn;
    console.log(`⏱️ Spawn cooldown: waiting ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }

  setLastSpawnTime(Date.now());
}

/**
 * Check if this is a build agent type
 */
function isBuildAgentType(agentType: string): boolean {
  return agentType === "build_agent" || agentType === "build";
}

// Track running processes
const runningProcesses = new Map<
  string,
  {
    process: ChildProcess;
    startTime: number;
  }
>();

// Check if claude CLI is available
let claudeAvailable = false;

async function checkClaudeCLI(): Promise<boolean> {
  return new Promise((resolve) => {
    const check = spawn("which", ["claude"], { stdio: "pipe" });
    check.on("close", (code) => resolve(code === 0));
    check.on("error", () => resolve(false));
    setTimeout(() => {
      check.kill();
      resolve(false);
    }, 3000);
  });
}

// Check on startup
checkClaudeCLI().then((available) => {
  claudeAvailable = available;
  if (available) {
    console.log("✅ Claude CLI available for agent spawning");
  } else {
    console.warn("⚠️ Claude CLI not found - agent spawning disabled");
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
  actualTokens?: number; // Real token usage (input + output) for rate limiter
}

/**
 * Build system prompt for agent
 *
 * RATE LIMIT OPTIMIZATION: Minimized prompts to reduce token consumption
 * Target: ~300-500 tokens per prompt (was ~1500)
 */
function getSystemPrompt(agentType: string): string {
  // Minimal base header - essential info only
  const baseHeader = `Autonomous AI agent. Codebase: ${CODEBASE_ROOT}
Tools: Read, Write, Edit, exec (Bash)
Output TASK_COMPLETE: <summary> when done, or TASK_FAILED: <reason> if stuck.
`;

  // Minimized prompts - essential instructions only
  const agentPrompts: Record<string, string> = {
    build_agent: `${baseHeader}
ROLE: Build Agent - implement features and fix bugs.
1. Read task requirements
2. Find and modify relevant code
3. Run \`npx tsc --noEmit\` to verify
4. Git commit with descriptive message
5. Output TASK_COMPLETE

Do NOT run tests - QA agent handles that.`,

    qa_agent: `${baseHeader}
ROLE: QA Agent - validate implementations.
1. Run \`npx tsc --noEmit\` (compiles?)
2. Run \`npm test\` (tests pass?)
3. Check each pass criterion explicitly
4. Output TASK_COMPLETE if all pass, TASK_FAILED if issues`,

    spec_agent: `${baseHeader}
ROLE: Spec Agent - create technical specifications.
Write to docs/specs/ with: Overview, Requirements, Technical Design, Pass Criteria, Dependencies.
Pass criteria must be testable. Reference existing codebase patterns.`,

    research_agent: `${baseHeader}
ROLE: Research Agent - investigate problems, find solutions.
Search codebase and web. Summarize findings with recommendations.`,

    decomposition_agent: `${baseHeader}
ROLE: Decomposition Agent - break large tasks into atomic subtasks.
Each subtask: 5-15 min, single outcome, testable criteria.
Assign wave numbers (1=no deps, 2=depends on 1, etc).`,

    task_agent: `${baseHeader}
ROLE: Task Agent - manage task queue.
Analyze queue, identify blockers, recommend priorities.`,

    validation_agent: `${baseHeader}
ROLE: Validation Agent - final validation before merge.
Run tests, typecheck, review code quality, verify all pass criteria.`,

    evaluator_agent: `${baseHeader}
ROLE: Evaluator Agent - assess task complexity.
Output: Complexity (LOW/MEDIUM/HIGH), Effort (hours), Risk, Recommendation.`,

    sia_agent: `${baseHeader}
ROLE: SIA - strategic ideation and arbitration.
Brainstorm when stuck, analyze failures, recommend fixes.
Output: Analysis, Options with pros/cons, Recommendation, Action Items.`,

    planning_agent: `${baseHeader}
ROLE: Planning Agent - create improvement tasks.
Analyze codebase, identify gaps, create prioritized tasks.
Format: TASK: title, PRIORITY: P0/P1/P2, DESCRIPTION, PASS_CRITERIA`,

    clarification_agent: `${baseHeader}
ROLE: Clarification Agent - ask questions for ambiguous tasks.
Formulate specific questions with options. Max 3-5 questions.`,

    human_sim_agent: `${baseHeader}
ROLE: Human Sim Agent - test UI as real user.
Personas: technical, power-user, casual, confused, impatient.
Document journey, pain points, recommendations.`,
  };

  // Map variations to canonical names
  const typeMap: Record<string, string> = {
    build: "build_agent",
    qa: "qa_agent",
    spec: "spec_agent",
    research: "research_agent",
    decomposition: "decomposition_agent",
    task: "task_agent",
    validation: "validation_agent",
    evaluator: "evaluator_agent",
    planning: "planning_agent",
    planning_agent: "planning_agent",
    sia: "sia_agent",
    sia_agent: "sia_agent",
    clarification: "clarification_agent",
    clarification_agent: "clarification_agent",
    human_sim: "human_sim_agent",
    human_sim_agent: "human_sim_agent",
    test: "qa_agent", // Test agent is QA
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
        prompt += `## Pass Criteria\n${criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}\n\n`;
      }
    } catch {
      /* ignore */
    }
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
  agentData: NonNullable<ReturnType<typeof agents.getAgent>>,
): Promise<SpawnResult & { isRateLimit?: boolean }> {
  const { taskId, agentId, model, timeout = 300 } = options;

  // Create session
  const session = sessions.createSession(agentId, taskId);
  sessions.updateSessionStatus(session.id, "running");
  agents.updateAgentStatus(agentId, "working", taskId, session.id);
  agents.updateHeartbeat(agentId);

  events.agentStarted(agentId, session.id);
  ws.sessionStarted(session);
  ws.agentStatusChanged(agents.getAgent(agentId));

  // Notify agent's dedicated channel
  await notify
    .agentSpawned(agentData.type, taskData.display_id, {
      taskId: taskData.id,
      taskDisplayId: taskData.display_id,
      sessionId: session.id,
      agentId: agentData.id,
    })
    .catch(() => {});

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
    console.warn("Failed to create execution record:", err);
  }

  // Use customPrompt if provided (for SIA investigation), otherwise build from task
  let fullPrompt: string;
  if (options.customPrompt) {
    fullPrompt = options.customPrompt;
  } else {
    const systemPrompt = getSystemPrompt(agentData.type);
    const taskPrompt = buildTaskPrompt(taskData);

    // Inject introspection context (past sessions, error/success patterns)
    let introspectionContext = "";
    try {
      introspectionContext = buildIntrospectionContext(agentId, taskData);
      if (introspectionContext) {
        console.log(
          `🔍 Introspection: injected historical context for ${agentData.name}`,
        );
      }
    } catch (err) {
      console.warn("Failed to build introspection context:", err);
    }

    fullPrompt = `${systemPrompt}\n\n---\n\n${taskPrompt}${introspectionContext}`;
  }

  console.log(
    `🚀 Spawning ${agentData.name} for ${taskData.display_id} via Claude CLI (model: ${model})`,
  );

  // Store refs for use in callbacks
  const task = taskData;
  const agent = agentData;

  return new Promise((resolve) => {
    // Use shell wrapper to pipe prompt to claude - works with OAuth auth
    // RATE LIMIT PROTECTION: Use --print --output-format json to get real token counts
    const escapedPrompt = fullPrompt.replace(/'/g, "'\\''");
    const shellCmd = `echo '${escapedPrompt}' | claude --model ${model} --permission-mode bypassPermissions --allowedTools 'Read,Write,Edit,Bash' --print --output-format json`;

    const { ANTHROPIC_AUTH_TOKEN, ...cleanEnv } = process.env;

    const child = spawn("bash", ["-c", shellCmd], {
      cwd: CODEBASE_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: cleanEnv,
    });

    runningProcesses.set(session.id, {
      process: child,
      startTime: Date.now(),
    });

    let stdout = "";
    let stderr = "";

    // Timeout handler
    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      finishSession(false, `Timeout after ${timeout}s`);
    }, timeout * 1000);

    // Heartbeat interval
    const heartbeatInterval = setInterval(() => {
      agents.updateHeartbeat(agentId);
    }, 10000);

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    function finishSession(success: boolean, errorMsg?: string) {
      clearTimeout(timeoutId);
      clearInterval(heartbeatInterval);
      const sessionStartTime =
        runningProcesses.get(session.id)?.startTime || Date.now();
      runningProcesses.delete(session.id);

      const rawOutput = stdout + stderr;

      // ============ RATE LIMIT PROTECTION: Parse JSON for real token counts ============
      const jsonOutput = parseClaudeJsonOutput(rawOutput);

      // Extract the actual result text (for TASK_COMPLETE detection)
      // If JSON parsing failed, fall back to raw output
      const output = jsonOutput?.result || rawOutput;

      const filesModified = extractFilesModified(output);
      const rateLimit = isRateLimitError(rawOutput);

      // Get REAL token counts from Claude CLI JSON output (or estimate as fallback)
      let inputTokens: number;
      let outputTokens: number;
      let costUsd: number;

      if (jsonOutput?.usage) {
        // Use REAL token counts from Claude CLI
        inputTokens =
          jsonOutput.usage.input_tokens +
          (jsonOutput.usage.cache_read_input_tokens || 0);
        outputTokens = jsonOutput.usage.output_tokens;
        costUsd = jsonOutput.total_cost_usd;
        console.log(
          `📊 REAL token usage for ${task.display_id}: ${inputTokens.toLocaleString()} in, ${outputTokens.toLocaleString()} out, $${costUsd.toFixed(4)}`,
        );
      } else {
        // Fallback to estimation (shouldn't happen with JSON output)
        inputTokens = estimateTokens(fullPrompt);
        outputTokens = estimateTokens(output);
        costUsd = budget.calculateCost(model, inputTokens, outputTokens);
        console.log(
          `📊 Estimated tokens for ${task.display_id}: ~${(inputTokens + outputTokens).toLocaleString()} (JSON parse failed)`,
        );
      }

      // Record in rolling window for rate limit protection
      recordSpawnInWindow({
        timestamp: Date.now(),
        inputTokens,
        outputTokens,
        costUsd,
        model,
      });

      // Trigger backoff on actual API rate limit (429) detection
      if (rateLimit) {
        setRateLimitBackoff();
      }

      // Record in budget system
      try {
        budget.recordUsage(agentId, model, inputTokens, outputTokens, {
          sessionId: session.id,
          taskId: taskId,
        });
      } catch (err) {
        console.warn("Failed to record token usage:", err);
      }

      if (success) {
        sessions.updateSessionStatus(session.id, "completed", output);
        try {
          sessions.logIteration(session.id, 1, {
            tokensInput: inputTokens,
            tokensOutput: outputTokens,
            cost: costUsd,
            durationMs: Date.now() - sessionStartTime,
            status: "completed",
            outputMessage: extractSummary(output) || output.slice(0, 2000),
          });
        } catch {
          // Non-fatal: iteration logging should not break completion.
        }
        tasks.updateTask(task.id, { status: "pending_verification" });
        agents.incrementTasksCompleted(agentId);
        events.taskCompleted(taskId, agentId, task.title, {
          source: "spawner",
          taskDisplayId: task.display_id,
          sessionId: session.id,
          filesModifiedCount: filesModified.length,
        });
        ws.taskCompleted(tasks.getTask(taskId));

        // Update execution record
        if (execution) {
          try {
            executions.completeExecution(
              execution.id,
              output,
              filesModified,
              inputTokens + outputTokens,
            );
            activities.logTaskCompleted(agentId, taskId, session.id, {
              filesModified,
              tokensUsed: inputTokens + outputTokens,
            });
          } catch (err) {
            console.warn("Failed to update execution record:", err);
          }
        }

        // Notify agent's channel
        notify
          .taskCompleted(
            agent.type,
            task.display_id,
            task.title,
            extractSummary(output),
            {
              taskId: task.id,
              taskDisplayId: task.display_id,
              sessionId: session.id,
              agentId: agent.id,
            },
          )
          .catch(() => {});

        // Auto-commit
        if (filesModified.length > 0) {
          git
            .autoCommitForTask(taskId, task.display_id, agentId, session.id)
            .catch(() => {});
        }

        console.log(`✅ ${agent.name} completed ${task.display_id}`);
        resolve({
          success: true,
          sessionId: session.id,
          output,
          filesModified,
          actualTokens: inputTokens + outputTokens,
        });
      } else {
        sessions.updateSessionStatus(session.id, "failed", output, errorMsg);
        const normalizedError = normalizeFailureReason(
          errorMsg || extractError(output) || output,
        );
        try {
          sessions.logIteration(session.id, 1, {
            tokensInput: inputTokens,
            tokensOutput: outputTokens,
            cost: costUsd,
            durationMs: Date.now() - sessionStartTime,
            status: "failed",
            errorMessage: normalizedError,
            outputMessage: output.slice(0, 2000),
          });
        } catch {
          // Non-fatal: iteration logging should not block failure handling.
        }
        // Don't fail the task yet if it's a rate limit - caller will retry
        if (!rateLimit) {
          tasks.failTaskWithContext(taskId, {
            error: normalizedError,
            agentId,
            sessionId: session.id,
            source: "spawner",
          });
          agents.incrementTasksFailed(agentId);
          events.taskFailed(taskId, agentId, task.title, normalizedError, {
            source: "spawner",
            taskDisplayId: task.display_id,
            sessionId: session.id,
          });
          ws.taskFailed(tasks.getTask(taskId), normalizedError);
          notify
            .taskFailed(agent.type, task.display_id, normalizedError, {
              taskId: task.id,
              taskDisplayId: task.display_id,
              sessionId: session.id,
              agentId: agent.id,
            })
            .catch(() => {});
        }

        // Update execution record for failure
        if (execution) {
          try {
            executions.failExecution(execution.id, normalizedError);
            activities.logTaskFailed(
              agentId,
              taskId,
              session.id,
              normalizedError,
            );
          } catch (err) {
            console.warn("Failed to update execution record:", err);
          }
        }

        console.log(
          `❌ ${agent.name} failed ${task.display_id}: ${normalizedError.slice(0, 100)}`,
        );
        resolve({
          success: false,
          sessionId: session.id,
          error: normalizedError,
          output,
          filesModified,
          isRateLimit: rateLimit,
          actualTokens: inputTokens + outputTokens,
        });
      }

      // Cleanup
      agents.updateAgentStatus(agentId, "idle", null, null);
      ws.agentStatusChanged(agents.getAgent(agentId));
      ws.sessionEnded(sessions.getSession(session.id));
    }

    child.on("close", (code) => {
      const rawOutput = stdout + stderr;

      // Parse JSON output to get the actual result text
      const jsonOutput = parseClaudeJsonOutput(rawOutput);
      const resultText = jsonOutput?.result || rawOutput;

      // Check for TASK_COMPLETE/TASK_FAILED in the result text
      const isComplete = resultText.includes("TASK_COMPLETE");
      const isFailed = resultText.includes("TASK_FAILED") || code !== 0;

      // Also check for errors in JSON output
      const isJsonError =
        jsonOutput?.is_error || jsonOutput?.subtype === "error";

      if (isComplete && !isFailed && !isJsonError) {
        finishSession(true);
      } else {
        const errorMsg =
          extractError(resultText) ||
          (isJsonError ? "Claude CLI error" : `Exit code ${code}`);
        finishSession(false, errorMsg);
      }
    });

    child.on("error", (err) => {
      finishSession(false, `Spawn error: ${err.message}`);
    });
  });
}

/**
 * Spawn agent using Claude CLI with model fallback on rate limit
 *
 * RATE LIMIT PROTECTION:
 * 1. Serial execution for build agents (only 1 at a time)
 * 2. 5-second cooldown between ALL spawns
 * 3. Model selection by agent type (not all Opus)
 */
export async function spawnAgentSession(
  options: SpawnOptions,
): Promise<SpawnResult> {
  const { taskId, agentId, timeout = 300 } = options;

  // Get agent data first to check type
  const agentData = agents.getAgent(agentId);
  const taskData = tasks.getTask(taskId);

  if (!taskData || !agentData) {
    return { success: false, sessionId: "", error: "Task or agent not found" };
  }

  // ============ RATE LIMIT PROTECTION: Serial Build Agent Execution ============
  if (isBuildAgentType(agentData.type)) {
    // Skip if already queued (prevents duplicate queue entries from repeated assign attempts)
    if (buildAgentLock.isQueued(taskId)) {
      return {
        success: false,
        sessionId: "",
        error: `Already queued for serial execution`,
      };
    }

    if (buildAgentLock.locked) {
      console.log(`🔒 Build agent busy - ${taskData.display_id} queued`);
      buildAgentLock.addToQueue(taskId);
      const queueLen = buildAgentLock.queue.length;
      return {
        success: false,
        sessionId: "",
        error: `Build agent queue: ${queueLen} waiting (serial execution mode)`,
      };
    }
    buildAgentLock.locked = true;
    console.log(`🔓 Build agent lock acquired for ${taskData.display_id}`);
  }

  try {
    // ============ RATE LIMIT PROTECTION: Backoff Check ============
    if (isRateLimited()) {
      const status = getRateLimitStatus();
      console.warn(
        `⏸️ Rate limit backoff active - ${status.remainingMs}ms remaining (${status.consecutiveCount} consecutive)`,
      );
      return {
        success: false,
        sessionId: "",
        error: `Rate limit backoff active (${Math.ceil(status.remainingMs / 1000)}s remaining)`,
      };
    }

    // ============ RATE LIMIT PROTECTION: Spawn Cooldown ============
    await enforceSpawnCooldown();

    // ============ RATE LIMIT PROTECTION: Rolling Window Check ============
    const windowCheck = checkRollingWindowAllowsSpawn();
    if (!windowCheck.allowed) {
      console.warn(`⚠️ Spawn blocked by rolling window: ${windowCheck.reason}`);
      console.log(
        `   Window stats: ${windowCheck.stats.spawnsInWindow} spawns, $${windowCheck.stats.costInWindow.toFixed(2)} cost`,
      );
      return {
        success: false,
        sessionId: "",
        error: windowCheck.reason || "Rolling window rate limit",
      };
    }

    // Log window stats for monitoring
    if (windowCheck.stats.spawnsInWindow > 0) {
      const limits = getRollingWindowLimits();
      console.log(
        `📈 Rolling window: ${windowCheck.stats.spawnsInWindow}/${limits.maxSpawns} spawns, $${windowCheck.stats.costInWindow.toFixed(2)}/$${limits.maxCostUsd}`,
      );
    }

    // ============ RATE LIMIT PROTECTION: Model Selection by Agent Type ============
    // Use appropriate model for agent type instead of defaulting to Opus
    const model = options.model || getModelForAgentType(agentData.type);
    console.log(`🎯 Model selection: ${agentData.type} → ${model}`);

    // Pre-checks (capacity, budget, build health, CLI availability)
    const maxConcurrent = getMaxConcurrent();
    if (runningProcesses.size >= maxConcurrent) {
      return {
        success: false,
        sessionId: "",
        error: `At max capacity (${maxConcurrent} concurrent agents)`,
      };
    }

    const budgetCheck = checkBudgetAllowsSpawn();
    if (!budgetCheck.allowed) {
      console.warn(`⚠️ Spawn blocked by budget: ${budgetCheck.reason}`);
      events.budgetSpawnBlocked(
        taskId,
        taskData?.title || taskId,
        budgetCheck.reason || "Budget limit reached",
      );
      return {
        success: false,
        sessionId: "",
        error: budgetCheck.reason || "Budget limit reached",
      };
    }

    const buildHealthCheck = checkBuildHealth(
      taskData?.category ?? undefined,
      taskData?.priority ?? undefined,
    );
    if (!buildHealthCheck.allowed) {
      console.warn(
        `⚠️ Spawn blocked by build health: ${buildHealthCheck.reason}`,
      );
      return {
        success: false,
        sessionId: "",
        error: buildHealthCheck.reason || "Build health gate blocked spawn",
      };
    }

    if (!claudeAvailable) {
      claudeAvailable = await checkClaudeCLI();
    }
    if (!claudeAvailable) {
      return {
        success: false,
        sessionId: "",
        error: "Claude CLI not available",
      };
    }

    // ============ RATE LIMIT PROTECTION: Per-Minute Sliding Window Check ============
    // All cheap pre-checks passed - now acquire reservation
    const systemPromptText = getSystemPrompt(agentData.type);
    const taskPromptText = buildTaskPrompt(taskData);
    // Estimate input tokens only - actual output tokens are recorded via recordSpawnEnd
    const estimatedTokens = estimateTokensForRateLimit(
      taskPromptText,
      systemPromptText,
      0, // Don't pre-estimate output; record actual usage after completion
    );

    const perMinuteCheck = rateLimiter.canSpawnAndReserve(estimatedTokens);
    if (!perMinuteCheck.allowed) {
      console.warn(`⏸️ Per-minute rate limit: ${perMinuteCheck.reason}`);
      const pmStats = perMinuteCheck.stats;
      console.warn(
        `   Stats: ${pmStats.currentRequests} req/min, ${pmStats.currentTokens.toLocaleString()} tok/min, ${pmStats.concurrent} concurrent, ${pmStats.reserved} reserved`,
      );
      // NOTE: Do NOT trigger backoff here - this is a local denial, not an API 429
      return {
        success: false,
        sessionId: "",
        error: perMinuteCheck.reason || "Per-minute rate limit",
      };
    }
    const reservationId = perMinuteCheck.reservationId!;

    // Confirm reservation start - converts reserved slot to active slot
    rateLimiter.confirmSpawnStart(reservationId, estimatedTokens);

    // Reservation lifecycle: try/finally ensures concurrentActive is always decremented
    let spawnResult: (SpawnResult & { isRateLimit?: boolean }) | undefined;
    try {
      // Get fallback chain and find starting position
      const fallbackChain = getModelFallbackChain();
      let startIdx = fallbackChain.indexOf(model);
      if (startIdx === -1) startIdx = 0;

      // Try each model in the fallback chain
      for (let i = startIdx; i < fallbackChain.length; i++) {
        const currentModel = fallbackChain[i];

        if (i > startIdx) {
          console.log(
            `🔄 Falling back from ${fallbackChain[i - 1]} to ${currentModel}`,
          );
          events.modelFallback(
            taskId,
            fallbackChain[i - 1],
            currentModel,
            "rate limit",
          );
        }

        const result = await spawnAgentSessionInternal(
          { ...options, model: currentModel },
          taskData,
          agentData,
        );

        // If successful or not a rate limit error, we're done
        if (result.success || !result.isRateLimit) {
          spawnResult = result;
          break;
        }

        console.log(
          `⚠️ Rate limit hit with ${currentModel}, trying next model...`,
        );

        // Trigger backoff on actual API 429
        setRateLimitBackoff();
      }

      if (!spawnResult) {
        return {
          success: false,
          sessionId: "",
          error: "All models in fallback chain rate limited",
        };
      }

      return spawnResult;
    } finally {
      // Always release concurrent slot with actual token usage from final attempt
      rateLimiter.recordSpawnEnd(reservationId, spawnResult?.actualTokens ?? 0);
    }
  } finally {
    // ============ Release build agent lock ============
    if (isBuildAgentType(agentData.type)) {
      buildAgentLock.locked = false;
      const nextInQueue = buildAgentLock.shiftQueue();
      console.log(
        `🔓 Build agent lock released for ${taskData.display_id}` +
          (nextInQueue ? ` (next in queue: ${nextInQueue})` : ""),
      );

      // ============ PROCESS QUEUE: Spawn next waiting task ============
      if (nextInQueue) {
        console.log(`📋 Processing queued task: ${nextInQueue}`);
        // Find the agent assigned to this task and respawn
        // This is async but we don't await - let it run in background
        const nextTask = tasks.getTask(nextInQueue);
        if (nextTask && nextTask.assigned_agent_id) {
          // Trigger spawn for queued task (fire and forget)
          setImmediate(() => {
            spawnAgentSession({
              taskId: nextInQueue,
              agentId: nextTask.assigned_agent_id!,
            }).catch((err) =>
              console.error(`Failed to spawn queued task ${nextInQueue}:`, err),
            );
          });
        }
      }
    }
  }
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
  const explicit = output.match(/TASK_FAILED:\s*(.+)/i);
  if (explicit?.[1]) {
    return explicit[1].trim();
  }

  const commonPatterns = [
    /Error:\s*([^\n]+)/i,
    /Exception:\s*([^\n]+)/i,
    /failed:\s*([^\n]+)/i,
  ];
  for (const pattern of commonPatterns) {
    const match = output.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function normalizeFailureReason(error: string): string {
  const trimmed = (error || "").trim();
  if (!trimmed) {
    return "Unclassified failure";
  }
  return trimmed.slice(0, 2000);
}

function extractSummary(output: string): string {
  const match = output.match(/TASK_COMPLETE:\s*(.+)/s);
  return match ? match[1].trim().slice(0, 500) : "";
}

export function killSession(sessionId: string): boolean {
  const running = runningProcesses.get(sessionId);
  if (!running) return false;

  running.process.kill("SIGTERM");
  runningProcesses.delete(sessionId);
  sessions.updateSessionStatus(sessionId, "terminated");
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
 *
 * RATE LIMIT PROTECTION: Uses appropriate model for label type
 */
export async function spawnWithPrompt(
  prompt: string,
  options: { model?: string; timeout?: number; label?: string } = {},
): Promise<{ success: boolean; output?: string; error?: string }> {
  const { timeout = 600, label = "planning" } = options;

  // ============ RATE LIMIT PROTECTION: Model Selection by Label ============
  // Default to haiku for planning/admin tasks, only use opus if explicitly requested
  const model = options.model || getModelForAgentType(`${label}_agent`);
  console.log(`🎯 spawnWithPrompt model selection: ${label} → ${model}`);

  // ============ RATE LIMIT PROTECTION: Backoff Check ============
  if (isRateLimited()) {
    const status = getRateLimitStatus();
    return {
      success: false,
      error: `Rate limit backoff active (${Math.ceil(status.remainingMs / 1000)}s remaining)`,
    };
  }

  // ============ RATE LIMIT PROTECTION: Spawn Cooldown ============
  await enforceSpawnCooldown();

  if (!claudeAvailable) {
    claudeAvailable = await checkClaudeCLI();
  }
  if (!claudeAvailable) {
    return { success: false, error: "Claude CLI not available" };
  }

  // Check capacity (use config value)
  const maxConcurrent = getMaxConcurrent();
  if (runningProcesses.size >= maxConcurrent) {
    return { success: false, error: "At max capacity" };
  }

  // Check budget
  const budgetCheck = checkBudgetAllowsSpawn();
  if (!budgetCheck.allowed) {
    console.warn(`⚠️ ${label} blocked by budget: ${budgetCheck.reason}`);
    return {
      success: false,
      error: budgetCheck.reason || "Budget limit reached",
    };
  }

  console.log(
    `🧠 Spawning ${label} agent via shell wrapper (model: ${model})...`,
  );
  console.log(`   Prompt length: ${prompt.length} chars`);

  // ============ RATE LIMIT PROTECTION: Rolling Window Check ============
  const windowCheck = checkRollingWindowAllowsSpawn();
  if (!windowCheck.allowed) {
    console.warn(
      `⚠️ ${label} blocked by rolling window: ${windowCheck.reason}`,
    );
    return {
      success: false,
      error: windowCheck.reason || "Rolling window rate limit",
    };
  }

  // ============ RATE LIMIT PROTECTION: Per-Minute Sliding Window Check ============
  const estimatedTokens = estimateTokensForRateLimit(prompt, undefined, 0);
  const perMinuteCheck = rateLimiter.canSpawnAndReserve(estimatedTokens);
  if (!perMinuteCheck.allowed) {
    console.warn(
      `⏸️ ${label} blocked by per-minute limit: ${perMinuteCheck.reason}`,
    );
    return {
      success: false,
      error: perMinuteCheck.reason || "Per-minute rate limit",
    };
  }
  const promptReservationId = perMinuteCheck.reservationId!;
  rateLimiter.confirmSpawnStart(promptReservationId, estimatedTokens);

  return new Promise((resolve) => {
    // Use bash shell wrapper to pipe prompt to claude
    // RATE LIMIT PROTECTION: Use --print --output-format json for real token counts
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const shellCmd = `echo '${escapedPrompt}' | claude --model ${model} --permission-mode bypassPermissions --allowedTools 'Read,Write,Edit,Bash' --print --output-format json`;

    console.log(`   Shell cmd length: ${shellCmd.length}`);
    console.log(`   HOME: ${process.env.HOME}`);

    // Remove ANTHROPIC_AUTH_TOKEN from env - it forces CLI to use direct API mode
    // which rejects OAuth tokens. Let CLI use its own auth.
    const { ANTHROPIC_AUTH_TOKEN, ...cleanEnv } = process.env;

    const child = spawn("bash", ["-c", shellCmd], {
      cwd: CODEBASE_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: cleanEnv,
    });

    const sessionId = `${label}-${Date.now()}`;
    runningProcesses.set(sessionId, {
      process: child,
      startTime: Date.now(),
    });

    let stdout = "";
    let stderr = "";

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ success: false, error: `Timeout after ${timeout}s` });
    }, timeout * 1000);

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      runningProcesses.delete(sessionId);

      const rawOutput = stdout + stderr;

      // ============ RATE LIMIT PROTECTION: Parse JSON for real token counts ============
      const jsonOutput = parseClaudeJsonOutput(rawOutput);
      const output = jsonOutput?.result || rawOutput;
      const isComplete = output.includes("TASK_COMPLETE");
      const isJsonError =
        jsonOutput?.is_error || jsonOutput?.subtype === "error";

      // Debug logging
      console.log(`📋 ${label} agent output (${output.length} chars):`);
      console.log(`   exit code: ${code}, has TASK_COMPLETE: ${isComplete}`);

      // Get REAL token counts from Claude CLI JSON output (or estimate as fallback)
      let inputTokens: number;
      let outputTokens: number;
      let costUsd: number;

      if (jsonOutput?.usage) {
        inputTokens =
          jsonOutput.usage.input_tokens +
          (jsonOutput.usage.cache_read_input_tokens || 0);
        outputTokens = jsonOutput.usage.output_tokens;
        costUsd = jsonOutput.total_cost_usd;
        console.log(
          `📊 REAL token usage for ${label}: ${inputTokens.toLocaleString()} in, ${outputTokens.toLocaleString()} out, $${costUsd.toFixed(4)}`,
        );
      } else {
        inputTokens = estimateTokens(prompt);
        outputTokens = estimateTokens(output);
        costUsd = budget.calculateCost(model, inputTokens, outputTokens);
        console.log(
          `📊 Estimated tokens for ${label}: ~${(inputTokens + outputTokens).toLocaleString()} (JSON parse failed)`,
        );
      }

      // Record in rolling window for rate limit protection
      recordSpawnInWindow({
        timestamp: Date.now(),
        inputTokens,
        outputTokens,
        costUsd,
        model,
      });

      // Record actual tokens in per-minute rate limiter
      rateLimiter.recordSpawnEnd(
        promptReservationId,
        inputTokens + outputTokens,
      );

      // Record in budget system
      try {
        budget.recordUsage(`${label}_agent`, model, inputTokens, outputTokens);
      } catch (err) {
        console.warn("Failed to record token usage:", err);
      }

      if (isComplete && !isJsonError) {
        console.log(`✅ ${label} agent completed`);
        resolve({ success: true, output });
      } else {
        console.log(`❌ ${label} agent failed (code ${code})`);
        resolve({
          success: false,
          output,
          error: isJsonError ? "Claude CLI error" : `Exit code ${code}`,
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      runningProcesses.delete(sessionId);
      // Release rate limiter slot on spawn error
      rateLimiter.recordSpawnEnd(promptReservationId, 0);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Get build agent queue status (for dashboard)
 */
export function getBuildAgentQueueStatus(): {
  locked: boolean;
  queueLength: number;
  queuedTaskIds: string[];
} {
  return {
    locked: buildAgentLock.locked,
    queueLength: buildAgentLock.queue.length,
    queuedTaskIds: [...buildAgentLock.queue],
  };
}

/**
 * Get rate limit protection status
 */
export function getRateLimitProtectionStatus(): {
  serialBuildAgents: boolean;
  spawnCooldownMs: number;
  lastSpawnTime: number;
  modelByAgentType: Record<string, string>;
} {
  return {
    serialBuildAgents: true,
    spawnCooldownMs: MIN_SPAWN_DELAY_MS,
    lastSpawnTime: getLastSpawnTime(),
    modelByAgentType: MODEL_BY_AGENT_TYPE,
  };
}

/**
 * Get rolling window statistics for dashboard
 */
export { getRollingWindowStats };

/**
 * Get per-minute rate limiter stats for dashboard
 */
export function getPerMinuteRateLimitStats() {
  return {
    ...rateLimiter.getStats(),
    backoff: getRateLimitStatus(),
    debug: rateLimiter.getDebugInfo(),
  };
}

/**
 * Reconcile rate limiter's concurrent count with actual running processes.
 * Call periodically (e.g., from orchestrator tick) to correct any drift.
 */
export function reconcileRateLimiterState(): void {
  rateLimiter.reconcileConcurrent(runningProcesses.size);
}

/**
 * Re-export rate limiter initialization for server startup
 */
export { initializeRateLimiter };

export default {
  spawnAgentSession,
  spawnWithPrompt,
  killSession,
  getRunningSessions,
  getRunningCount,
  isEnabled,
  canSpawnMore,
  getBuildAgentQueueStatus,
  getRateLimitProtectionStatus,
  getRollingWindowStats,
  getPerMinuteRateLimitStats,
  reconcileRateLimiterState,
  initializeRateLimiter,
};
