/**
 * Suggestion Engine - Continuous Suggestion Loop
 *
 * Implements the proactive Task Agent behavior described in task-agent-arch.md.
 * The Task Agent continuously analyzes state and sends suggestions via Telegram.
 *
 * Loop behavior (from architecture):
 * 1. Analyze current state (ready lists, parallel opportunities, blockers)
 * 2. Formulate suggestion
 * 3. Send suggestion via Telegram
 * 4. Await user response
 * 5. Execute on approval
 * 6. Report result
 * 7. Loop back to step 1
 *
 * Triggering:
 * - Active session (user responded within 30 min): Continuous suggestions
 * - Inactive: Daily summary with top 3 task lists
 * - Always: Immediate notification for blockers/failures
 *
 * Part of: PTE-144 Continuous Suggestion Loop
 */

import { EventEmitter } from "events";
import { query } from "../../../database/db.js";
import evaluationQueueManager from "./evaluation-queue-manager.js";
import autoGroupingEngine from "./auto-grouping-engine.js";
import taskListOrchestrator from "./task-list-orchestrator.js";
import parallelismCalculator from "./parallelism-calculator.js";
import buildAgentOrchestrator from "./build-agent-orchestrator.js";
import {
  incrementSuggestionsMade,
  getActiveTaskAgents,
} from "./task-agent-instance-manager.js";

// Import TelegramSender types (we'll create a singleton instance)
import { TelegramSender } from "../../communication/telegram-sender.js";
import { BotRegistry } from "../../communication/bot-registry.js";
import { ChatLinker } from "../../communication/chat-linker.js";
import { InlineButton } from "../../communication/types.js";

/**
 * Suggestion types that can be sent to the user
 */
type SuggestionType =
  | "task_list_ready"
  | "parallel_opportunity"
  | "grouping_suggestion"
  | "blocker_detected"
  | "stale_tasks"
  | "daily_summary"
  | "execution_complete"
  | "execution_failed";

interface SuggestionContext {
  type: SuggestionType;
  priority: number;
  message: string;
  buttons: InlineButton[][];
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the suggestion engine
 */
interface SuggestionEngineConfig {
  /** Interval for active session checks (ms) - default 30 seconds */
  activeCheckIntervalMs: number;
  /** Interval for inactive session checks (ms) - default 1 hour */
  inactiveCheckIntervalMs: number;
  /** Time until session is considered inactive (ms) - default 30 minutes */
  sessionTimeoutMs: number;
  /** Time for daily summary (HH:MM) - default 09:00 */
  dailySummaryTime: string;
  /** Whether to send proactive suggestions */
  enabled: boolean;
  /** Primary user ID for Telegram messages */
  primaryUserId: string;
}

const DEFAULT_CONFIG: SuggestionEngineConfig = {
  activeCheckIntervalMs: 30000, // 30 seconds
  inactiveCheckIntervalMs: 3600000, // 1 hour
  sessionTimeoutMs: 1800000, // 30 minutes
  dailySummaryTime: "09:00",
  enabled: true,
  primaryUserId: "default_user",
};

/**
 * Suggestion Engine - implements the Continuous Suggestion Loop
 */
class SuggestionEngine extends EventEmitter {
  private config: SuggestionEngineConfig;
  private sender: TelegramSender | null = null;
  private lastUserActivity: Date = new Date();
  private isRunning: boolean = false;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private dailySummaryTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastSuggestionSent: Date | null = null;
  private pendingSuggestionId: string | null = null;

  constructor(config: Partial<SuggestionEngineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the suggestion engine with Telegram sender
   */
  initialize(botRegistry: BotRegistry, chatLinker: ChatLinker): void {
    this.sender = new TelegramSender(
      botRegistry,
      chatLinker,
      this.config.primaryUserId,
    );
    console.log("[SuggestionEngine] Initialized with Telegram sender");
  }

  /**
   * Start the continuous suggestion loop
   */
  start(): void {
    if (this.isRunning) {
      console.log("[SuggestionEngine] Already running");
      return;
    }

    if (!this.config.enabled) {
      console.log("[SuggestionEngine] Disabled by configuration");
      return;
    }

    if (!this.sender) {
      console.log(
        "[SuggestionEngine] Not initialized - call initialize() first",
      );
      return;
    }

    this.isRunning = true;
    console.log("[SuggestionEngine] Starting continuous suggestion loop");

    // Start the check interval
    this.scheduleNextCheck();

    // Schedule daily summary
    this.scheduleDailySummary();

    // Send initial greeting
    this.sendGreeting();
  }

  /**
   * Stop the suggestion loop
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.dailySummaryTimeout) {
      clearTimeout(this.dailySummaryTimeout);
      this.dailySummaryTimeout = null;
    }

    console.log("[SuggestionEngine] Stopped");
  }

  /**
   * Record user activity (called when user responds via Telegram)
   */
  recordUserActivity(): void {
    this.lastUserActivity = new Date();
    console.log("[SuggestionEngine] User activity recorded");

    // If we were in inactive mode, switch to active mode
    if (this.getCheckInterval() === this.config.inactiveCheckIntervalMs) {
      console.log("[SuggestionEngine] Switching to active mode");
      this.scheduleNextCheck();
    }
  }

  /**
   * Record suggestion approval (for tracking)
   */
  recordSuggestionApproval(suggestionId: string): void {
    if (this.pendingSuggestionId === suggestionId) {
      this.pendingSuggestionId = null;
      this.recordUserActivity();
    }
  }

  /**
   * Get whether the session is active
   */
  isSessionActive(): boolean {
    const timeSinceActivity = Date.now() - this.lastUserActivity.getTime();
    return timeSinceActivity < this.config.sessionTimeoutMs;
  }

  /**
   * Get the appropriate check interval based on session activity
   */
  private getCheckInterval(): number {
    return this.isSessionActive()
      ? this.config.activeCheckIntervalMs
      : this.config.inactiveCheckIntervalMs;
  }

  /**
   * Schedule the next suggestion check
   */
  private scheduleNextCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    const interval = this.getCheckInterval();
    console.log(
      `[SuggestionEngine] Scheduling checks every ${interval / 1000}s (${
        this.isSessionActive() ? "active" : "inactive"
      } mode)`,
    );

    this.checkInterval = setInterval(() => this.runSuggestionLoop(), interval);
  }

  /**
   * Schedule daily summary
   */
  private scheduleDailySummary(): void {
    const [hours, minutes] = this.config.dailySummaryTime
      .split(":")
      .map(Number);
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setHours(hours, minutes, 0, 0);

    // If target time has passed today, schedule for tomorrow
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    const msUntilSummary = targetTime.getTime() - now.getTime();

    console.log(
      `[SuggestionEngine] Daily summary scheduled for ${targetTime.toISOString()}`,
    );

    this.dailySummaryTimeout = setTimeout(() => {
      this.sendDailySummary();
      this.scheduleDailySummary(); // Reschedule for next day
    }, msUntilSummary);
  }

  /**
   * Send initial greeting when engine starts
   */
  private async sendGreeting(): Promise<void> {
    if (!this.sender) {
      console.log("[SuggestionEngine] No sender available for greeting");
      return;
    }

    try {
      const result = await this.sender.sendMessage({
        agentType: "orchestrator",
        text: `🤖 *Task Agent Online*

Hey! I'm your Task Agent. I'll proactively suggest task lists to execute and keep you updated on progress.

📊 *Quick Status:*
• Evaluation Queue tasks pending
• Grouping suggestions available
• Ready to help organize your work

Type /queue to see pending tasks or /suggest for grouping ideas.`,
        parseMode: "Markdown",
      });

      if (result.success) {
        console.log(
          "[SuggestionEngine] Greeting sent successfully, messageId:",
          result.messageId,
        );
      } else {
        console.error("[SuggestionEngine] Greeting failed:", result.error);
      }
    } catch (error) {
      console.error("[SuggestionEngine] Failed to send greeting:", error);
    }
  }

  /**
   * Main suggestion loop - analyzes state and sends suggestions
   */
  private async runSuggestionLoop(): Promise<void> {
    if (!this.sender) return;

    // Skip if we have a pending suggestion waiting for response
    if (this.pendingSuggestionId) {
      console.log(
        "[SuggestionEngine] Waiting for response to pending suggestion",
      );
      return;
    }

    try {
      console.log("[SuggestionEngine] Running suggestion loop...");

      // 1. Check for blockers/failures (highest priority - always notify)
      const blockerSuggestion = await this.checkForBlockers();
      if (blockerSuggestion) {
        await this.sendSuggestion(blockerSuggestion);
        return;
      }

      // 2. Check for execution completions/failures
      const executionSuggestion = await this.checkExecutionStatus();
      if (executionSuggestion) {
        await this.sendSuggestion(executionSuggestion);
        return;
      }

      // 3. Check for ready task lists
      const readySuggestion = await this.checkForReadyTaskLists();
      if (readySuggestion) {
        await this.sendSuggestion(readySuggestion);
        return;
      }

      // 4. Check for parallel execution opportunities
      const parallelSuggestion = await this.checkForParallelOpportunities();
      if (parallelSuggestion) {
        await this.sendSuggestion(parallelSuggestion);
        return;
      }

      // 5. Check for grouping suggestions
      const groupingSuggestion = await this.checkForGroupingSuggestions();
      if (groupingSuggestion) {
        await this.sendSuggestion(groupingSuggestion);
        return;
      }

      // 6. Check for stale tasks
      const staleSuggestion = await this.checkForStaleTasks();
      if (staleSuggestion) {
        await this.sendSuggestion(staleSuggestion);
        return;
      }

      console.log("[SuggestionEngine] No suggestions to send");
    } catch (error) {
      console.error("[SuggestionEngine] Error in suggestion loop:", error);
    }
  }

  /**
   * Check for blockers that need immediate attention
   */
  private async checkForBlockers(): Promise<SuggestionContext | null> {
    try {
      const agents = await buildAgentOrchestrator.getActiveAgents();
      const blockedAgents = agents.filter(
        (a) => (a.status as string) === "blocked" || (a.status as string) === "waiting",
      );

      if (blockedAgents.length > 0) {
        const agent = blockedAgents[0];
        return {
          type: "blocker_detected",
          priority: 100,
          message: `🚨 *Build Agent Blocked*

Agent \`${agent.id.slice(0, 8)}\` is waiting for input.

📋 *Task:* ${agent.taskId || "Unknown"}
⏱️ *Blocked since:* ${agent.spawnedAt}

Please review and provide guidance.`,
          buttons: [
            [
              {
                text: "📋 View Details",
                callbackData: `agent:view:${agent.id}`,
              },
              { text: "⏭️ Skip Task", callbackData: `agent:skip:${agent.id}` },
            ],
          ],
        };
      }
    } catch (error) {
      console.error("[SuggestionEngine] Error checking blockers:", error);
    }

    return null;
  }

  /**
   * Check for execution status updates
   */
  private async checkExecutionStatus(): Promise<SuggestionContext | null> {
    try {
      const status = await taskListOrchestrator.getOrchestratorStatus();

      // Check for recently completed lists
      for (const list of status.activeLists) {
        if (list.completedTasks === list.totalTasks && list.totalTasks > 0) {
          return {
            type: "execution_complete",
            priority: 90,
            message: `🎉 *Task List Complete!*

*${list.name}*
✅ ${list.completedTasks} tasks completed

Nice work! What's next?`,
            buttons: [
              [
                {
                  text: "📋 View Results",
                  callbackData: `list:view:${list.id}`,
                },
                { text: "➡️ Next Suggestion", callbackData: "suggest:next" },
              ],
            ],
          };
        }
      }
    } catch (error) {
      console.error(
        "[SuggestionEngine] Error checking execution status:",
        error,
      );
    }

    return null;
  }

  /**
   * Check for task lists ready to execute
   */
  private async checkForReadyTaskLists(): Promise<SuggestionContext | null> {
    try {
      const status = await taskListOrchestrator.getOrchestratorStatus();

      // Check if we have capacity for more lists
      if (status.activeLists.length >= status.config.maxConcurrentLists) {
        return null; // At capacity
      }

      // Query for task lists that are ready to execute
      const readyLists = await query<{ id: string; name: string; total_tasks: number }>(
        `SELECT id, name, total_tasks FROM task_lists_v2
         WHERE status = 'ready'
         AND total_tasks > 0
         ORDER BY created_at ASC
         LIMIT 1`,
      );

      if (!readyLists || readyLists.length === 0) {
        return null; // No ready lists
      }

      const readyList = readyLists[0];
      return {
        type: "task_list_ready",
        message: `Task list "${readyList.name}" is ready to execute (${readyList.total_tasks} tasks)`,
        priority: 2,
        buttons: [
          [
            { text: "✅ Execute", callbackData: `task_execute:${readyList.id}` },
            { text: "📋 Details", callbackData: `task_details:${readyList.id}` },
            { text: "❌ Skip", callbackData: `task_skip:${readyList.id}` },
          ],
        ],
        metadata: { taskListId: readyList.id },
      };
    } catch (error) {
      console.error("[SuggestionEngine] Error checking ready lists:", error);
      return null;
    }
  }

  /**
   * Check for parallel execution opportunities
   */
  private async checkForParallelOpportunities(): Promise<SuggestionContext | null> {
    try {
      const status = await taskListOrchestrator.getOrchestratorStatus();

      // Check if we have capacity and active lists
      if (
        status.activeLists.length === 0 ||
        status.globalAgentPool.availableSlots === 0
      ) {
        return null;
      }

      // Find ready lists that could run in parallel
      const readyLists = await query<{
        id: string;
        name: string;
        total_tasks: number;
        project_id: string | null;
      }>(
        `SELECT id, name, total_tasks, project_id FROM task_lists_v2
         WHERE status = 'ready'
         AND total_tasks > 0
         ORDER BY created_at ASC
         LIMIT 3`,
      );

      if (!readyLists || readyLists.length === 0) {
        return null;
      }

      // Get active list project IDs to check for conflicts
      const activeProjectIds = new Set(
        status.activeLists.map((l) => l.projectId).filter(Boolean),
      );

      // Find a list that doesn't conflict with active lists (different project)
      const nonConflicting = readyLists.find(
        (list) => !list.project_id || !activeProjectIds.has(list.project_id),
      );

      if (!nonConflicting) {
        return null; // All ready lists would conflict
      }

      return {
        type: "parallel_opportunity",
        message: `"${nonConflicting.name}" can run in parallel with current execution (${status.globalAgentPool.availableSlots} agents available)`,
        priority: 3,
        buttons: [
          [
            {
              text: "▶️ Start Parallel",
              callbackData: `task_parallel:${nonConflicting.id}`,
            },
            { text: "⏭️ Later", callbackData: `task_later:${nonConflicting.id}` },
          ],
        ],
        metadata: {
          taskListId: nonConflicting.id,
          availableSlots: status.globalAgentPool.availableSlots,
        },
      };
    } catch (error) {
      console.error(
        "[SuggestionEngine] Error checking parallel opportunities:",
        error,
      );
      return null;
    }
  }

  /**
   * Check for grouping suggestions
   */
  private async checkForGroupingSuggestions(): Promise<SuggestionContext | null> {
    try {
      const suggestions = await autoGroupingEngine.getPendingSuggestions();

      if (suggestions.length > 0) {
        const topSuggestion = suggestions[0];
        const taskCount = topSuggestion.suggestedTasks?.length || 0;

        return {
          type: "grouping_suggestion",
          priority: 60,
          message: `💡 *Grouping Suggestion*

I found ${suggestions.length} grouping opportunit${suggestions.length > 1 ? "ies" : "y"}!

*Top suggestion:* ${topSuggestion.suggestedName}
📦 ${taskCount} related tasks
📝 ${topSuggestion.groupingReason?.substring(0, 100)}${
            (topSuggestion.groupingReason?.length || 0) > 100 ? "..." : ""
          }

Want to group these tasks together?`,
          buttons: [
            [
              {
                text: "✅ Accept",
                callbackData: `grouping:accept:${topSuggestion.id}`,
              },
              {
                text: "❌ Reject",
                callbackData: `grouping:reject:${topSuggestion.id}`,
              },
            ],
            [{ text: "📋 View All", callbackData: "grouping:viewall" }],
          ],
        };
      }
    } catch (error) {
      console.error(
        "[SuggestionEngine] Error checking grouping suggestions:",
        error,
      );
    }

    return null;
  }

  /**
   * Check for stale tasks in the evaluation queue
   */
  private async checkForStaleTasks(): Promise<SuggestionContext | null> {
    try {
      const stats = await evaluationQueueManager.getQueueStats();

      if (stats.staleCount > 0) {
        return {
          type: "stale_tasks",
          priority: 40,
          message: `⚠️ *Stale Tasks Alert*

You have ${stats.staleCount} task${stats.staleCount > 1 ? "s" : ""} in the Evaluation Queue for more than 3 days.

📊 Queue Status:
• Total: ${stats.totalQueued}
• Stale: ${stats.staleCount}
• New today: ${stats.newToday}
• Avg days: ${stats.avgDaysInQueue.toFixed(1)}

Want me to suggest groupings for these tasks?`,
          buttons: [
            [
              { text: "💡 Get Suggestions", callbackData: "stale:suggest" },
              { text: "📋 View Queue", callbackData: "queue:view" },
            ],
          ],
        };
      }
    } catch (error) {
      console.error("[SuggestionEngine] Error checking stale tasks:", error);
    }

    return null;
  }

  /**
   * Send a suggestion via Telegram
   */
  private async sendSuggestion(suggestion: SuggestionContext): Promise<void> {
    if (!this.sender) return;

    try {
      const suggestionId = `sug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const result = await this.sender.sendWithButtons(
        "orchestrator",
        suggestion.message,
        suggestion.buttons,
      );

      if (result.success) {
        this.lastSuggestionSent = new Date();
        this.pendingSuggestionId = suggestionId;

        // Track suggestion for active agents
        const agents = await getActiveTaskAgents();
        for (const agent of agents) {
          await incrementSuggestionsMade(agent.id);
        }

        console.log(
          `[SuggestionEngine] Sent ${suggestion.type} suggestion (id: ${suggestionId})`,
        );

        this.emit("suggestion:sent", {
          id: suggestionId,
          type: suggestion.type,
          priority: suggestion.priority,
        });
      } else {
        console.error(
          "[SuggestionEngine] Failed to send suggestion:",
          result.error,
        );
      }
    } catch (error) {
      console.error("[SuggestionEngine] Error sending suggestion:", error);
    }
  }

  /**
   * Send daily summary
   */
  private async sendDailySummary(): Promise<void> {
    if (!this.sender) return;

    try {
      const queueStats = await evaluationQueueManager.getQueueStats();
      const orchestratorStatus =
        await taskListOrchestrator.getOrchestratorStatus();
      const agents = await buildAgentOrchestrator.getActiveAgents();

      const summary = `📊 *Daily Summary*

Good morning! Here's your task status:

*Evaluation Queue:*
• ${queueStats.totalQueued} tasks pending
• ${queueStats.staleCount} stale (>3 days)
• ${queueStats.newToday} added today

*Active Execution:*
• ${orchestratorStatus.activeLists.length} task lists running
• ${agents.length} Build Agents active

*Next Steps:*
${
  queueStats.staleCount > 0
    ? `⚠️ Review ${queueStats.staleCount} stale tasks`
    : "✅ No stale tasks"
}
${queueStats.totalQueued > 5 ? "💡 Consider grouping tasks into lists" : ""}

Reply /suggest for grouping ideas or /queue to view pending tasks.`;

      await this.sender.sendMessage({
        agentType: "orchestrator",
        text: summary,
        parseMode: "Markdown",
      });

      console.log("[SuggestionEngine] Daily summary sent");
    } catch (error) {
      console.error("[SuggestionEngine] Failed to send daily summary:", error);
    }
  }

  /**
   * Get engine status
   */
  getStatus(): {
    running: boolean;
    sessionActive: boolean;
    lastActivity: Date;
    lastSuggestion: Date | null;
    pendingSuggestion: string | null;
    checkInterval: number;
  } {
    return {
      running: this.isRunning,
      sessionActive: this.isSessionActive(),
      lastActivity: this.lastUserActivity,
      lastSuggestion: this.lastSuggestionSent,
      pendingSuggestion: this.pendingSuggestionId,
      checkInterval: this.getCheckInterval(),
    };
  }
}

// Singleton instance
let instance: SuggestionEngine | null = null;

export function getSuggestionEngine(): SuggestionEngine {
  if (!instance) {
    instance = new SuggestionEngine();
  }
  return instance;
}

export function initializeSuggestionEngine(
  botRegistry: BotRegistry,
  chatLinker: ChatLinker,
): SuggestionEngine {
  const engine = getSuggestionEngine();
  engine.initialize(botRegistry, chatLinker);
  return engine;
}

export function startSuggestionEngine(): void {
  const engine = getSuggestionEngine();
  engine.start();
}

export function stopSuggestionEngine(): void {
  const engine = getSuggestionEngine();
  engine.stop();
}

export default {
  getSuggestionEngine,
  initializeSuggestionEngine,
  startSuggestionEngine,
  stopSuggestionEngine,
};
