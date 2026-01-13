/**
 * Task Agent Telegram Commands
 *
 * Handles Telegram commands for task management:
 * - /newtask - Create a new task in Evaluation Queue
 * - /queue - Show Evaluation Queue status
 * - /suggest - Get grouping suggestions
 * - /parallel - Show parallelism opportunities
 * - /agents - Show active Build Agents
 *
 * Part of: PTE-096 to PTE-103
 */

import { EventEmitter } from 'events';
import evaluationQueueManager from '../evaluation-queue-manager.js';
import taskCreationService from '../task-creation-service.js';
import taskAnalysisPipeline from '../task-analysis-pipeline.js';
import autoGroupingEngine from '../auto-grouping-engine.js';
import buildAgentOrchestrator from '../build-agent-orchestrator.js';
import parallelismCalculator from '../parallelism-calculator.js';
import naturalLanguageParser, {
  ParsedTaskIntent,
  ConfirmationMessage,
} from '../natural-language-parser.js';
import type { ReceivedMessage, ReceivedCallback } from '../../../communication/telegram-receiver.js';
import type { TaskCategory } from '../../../../types/task-agent.js';

// Pending task confirmations (chatId -> confirmation state)
interface PendingConfirmation {
  intent: ParsedTaskIntent;
  originalInput: string;
  timestamp: Date;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

// Clean up old pending confirmations after 5 minutes
const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Task Agent Telegram Command Handler
 */
export class TaskAgentTelegramHandler extends EventEmitter {
  constructor() {
    super();
    // Cleanup interval
    setInterval(() => this.cleanupPendingConfirmations(), 60000);
  }

  /**
   * Handle incoming Telegram message
   */
  async handleMessage(message: ReceivedMessage): Promise<string | null> {
    const { text, chatId } = message;

    // Check for pending confirmation first
    const pending = pendingConfirmations.get(chatId);
    if (pending) {
      return this.handleConfirmationResponse(chatId, text, pending);
    }

    // Handle commands
    if (text.startsWith('/newtask')) {
      return this.handleNewTask(chatId, text.slice(8).trim());
    }

    if (text.startsWith('/queue')) {
      return this.handleQueueStatus();
    }

    if (text.startsWith('/suggest')) {
      return this.handleSuggestions();
    }

    if (text.startsWith('/parallel')) {
      const args = text.slice(9).trim();
      return this.handleParallelStatus(args);
    }

    if (text.startsWith('/agents')) {
      return this.handleAgentsStatus();
    }

    // Natural language task creation (for forwarded messages or free text)
    if (this.looksLikeTask(text)) {
      return this.handleNaturalLanguageTask(chatId, text);
    }

    return null;
  }

  /**
   * Handle callback queries (button presses)
   */
  async handleCallback(callback: ReceivedCallback): Promise<string | null> {
    const { data, chatId } = callback;
    const parts = data.split(':');

    if (parts[0] === 'task') {
      if (parts[1] === 'confirm' && parts[2]) {
        const pending = pendingConfirmations.get(chatId);
        if (pending) {
          return this.createTaskFromIntent(chatId, pending.intent);
        }
      }

      if (parts[1] === 'cancel') {
        pendingConfirmations.delete(chatId);
        return '❌ Task creation cancelled.';
      }

      if (parts[1] === 'edit') {
        return '✏️ Please type your corrections (e.g., "title: New Title" or "category: bug")';
      }
    }

    if (parts[0] === 'grouping') {
      if (parts[1] === 'accept' && parts[2]) {
        try {
          await autoGroupingEngine.acceptSuggestion(parts[2]);
          return '✅ Task list created! Tasks have been grouped together.';
        } catch (err) {
          return `❌ Failed to accept suggestion: ${err instanceof Error ? err.message : 'Unknown error'}`;
        }
      }

      if (parts[1] === 'reject' && parts[2]) {
        try {
          await autoGroupingEngine.rejectSuggestion(parts[2]);
          return '⏭️ Suggestion rejected. Tasks remain in Evaluation Queue.';
        } catch (err) {
          return `❌ Failed to reject suggestion: ${err instanceof Error ? err.message : 'Unknown error'}`;
        }
      }
    }

    return null;
  }

  /**
   * Handle /newtask command
   */
  private async handleNewTask(chatId: string, description: string): Promise<string> {
    if (!description) {
      return `📝 **Create New Task**

Usage: \`/newtask <description>\`

Example: \`/newtask Add user authentication to the login page\`

Or just type your task description and I'll help you create it.`;
    }

    return this.handleNaturalLanguageTask(chatId, description);
  }

  /**
   * Handle natural language task creation
   */
  private async handleNaturalLanguageTask(chatId: string, text: string): Promise<string> {
    try {
      const intent = await naturalLanguageParser.parseTaskIntent(text);

      if (!intent.isValidTask) {
        return `❓ I couldn't understand that as a task.\n\n${intent.validationMessage}\n\nTry: \`/newtask Add a dark mode toggle to settings\``;
      }

      // Store pending confirmation
      pendingConfirmations.set(chatId, {
        intent,
        originalInput: text,
        timestamp: new Date(),
      });

      const confirmation = naturalLanguageParser.generateConfirmation(intent, text);

      // Add callback buttons
      return `${confirmation.text}

[Create Task](callback:task:confirm:${chatId}) | [Edit](callback:task:edit) | [Cancel](callback:task:cancel)`;
    } catch (err) {
      console.error('[TaskAgentTelegram] Natural language parsing failed:', err);
      return `❌ Failed to parse task: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  /**
   * Handle confirmation response
   */
  private async handleConfirmationResponse(
    chatId: string,
    text: string,
    pending: PendingConfirmation
  ): Promise<string> {
    if (naturalLanguageParser.isConfirmation(text)) {
      return this.createTaskFromIntent(chatId, pending.intent);
    }

    if (naturalLanguageParser.isRejection(text)) {
      pendingConfirmations.delete(chatId);
      return '❌ Task creation cancelled.';
    }

    // Check for edits
    const edits = naturalLanguageParser.parseEditIntent(text);
    if (edits) {
      const updatedIntent = naturalLanguageParser.applyEdits(pending.intent, edits);
      pendingConfirmations.set(chatId, {
        ...pending,
        intent: updatedIntent,
      });

      const confirmation = naturalLanguageParser.generateConfirmation(
        updatedIntent,
        pending.originalInput
      );
      return `✏️ **Updated:**\n\n${confirmation.text}`;
    }

    // Treat as replacement description
    return this.handleNaturalLanguageTask(chatId, text);
  }

  /**
   * Create task from parsed intent
   */
  private async createTaskFromIntent(chatId: string, intent: ParsedTaskIntent): Promise<string> {
    try {
      pendingConfirmations.delete(chatId);

      const result = await taskCreationService.createListlessTask({
        title: intent.title,
        description: intent.description,
        category: intent.category as TaskCategory | undefined,
      });

      // Trigger async analysis
      taskAnalysisPipeline.analyzeTask(result.task.id).catch(console.error);

      let response = `✅ **Task Created:** ${result.task.displayId}

📝 **Title:** ${result.task.title}`;

      if (result.task.category) {
        response += `\n🏷️ **Category:** ${result.task.category}`;
      }

      response += `\n📊 **Status:** In Evaluation Queue

🔍 Analyzing for related tasks and grouping opportunities...`;

      return response;
    } catch (err) {
      console.error('[TaskAgentTelegram] Task creation failed:', err);
      return `❌ Failed to create task: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  /**
   * Handle /queue command
   */
  private async handleQueueStatus(): Promise<string> {
    try {
      const stats = await evaluationQueueManager.getQueueStats();
      const tasks = await evaluationQueueManager.getQueuedTasks();

      let response = `📬 **Evaluation Queue Status**

📊 **Summary:**
• Total: ${stats.totalQueued} tasks
• Stale (>3 days): ${stats.staleCount}
• New today: ${stats.newToday}
• Avg time: ${stats.avgDaysInQueue.toFixed(1)} days`;

      if (tasks.length > 0) {
        response += `\n\n📝 **Recent Tasks:**`;
        for (const task of tasks.slice(0, 5)) {
          const staleIcon = task.isStale ? '⚠️' : '';
          response += `\n• ${staleIcon} \`${task.displayId}\`: ${task.title.substring(0, 40)}${task.title.length > 40 ? '...' : ''}`;
        }
        if (tasks.length > 5) {
          response += `\n\n_...and ${tasks.length - 5} more_`;
        }
      } else {
        response += `\n\n✨ Queue is empty!`;
      }

      if (stats.staleCount > 0) {
        response += `\n\n💡 **Recommendation:** Review the ${stats.staleCount} stale tasks and group them or assign to task lists.`;
      }

      return response;
    } catch (err) {
      console.error('[TaskAgentTelegram] Queue status failed:', err);
      return `❌ Failed to get queue status: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  /**
   * Handle /suggest command
   */
  private async handleSuggestions(): Promise<string> {
    try {
      // Trigger new analysis
      const suggestions = await autoGroupingEngine.analyzeTasks();

      if (suggestions.length === 0) {
        return `🔍 **Grouping Suggestions**

No grouping suggestions at this time.

💡 Add more tasks to the Evaluation Queue to get grouping suggestions.`;
      }

      let response = `🔍 **Grouping Suggestions**\n\n`;

      for (const suggestion of suggestions.slice(0, 3)) {
        const score = suggestion.similarityScore || 0;
        response += `📁 **${suggestion.suggestedName}**
• Tasks: ${suggestion.suggestedTasks.length}
• Score: ${Math.round(score * 100)}%
• Reason: ${suggestion.groupingReason.substring(0, 80)}${suggestion.groupingReason.length > 80 ? '...' : ''}

[Accept](callback:grouping:accept:${suggestion.id}) | [Reject](callback:grouping:reject:${suggestion.id})\n\n`;
      }

      if (suggestions.length > 3) {
        response += `_...and ${suggestions.length - 3} more suggestions_`;
      }

      return response;
    } catch (err) {
      console.error('[TaskAgentTelegram] Suggestions failed:', err);
      return `❌ Failed to get suggestions: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  /**
   * Handle /parallel command
   */
  private async handleParallelStatus(taskListId?: string): Promise<string> {
    try {
      // Show overview of active agents
      const agents = await buildAgentOrchestrator.getActiveAgents();

      let response = `⚡ **Parallelism Status**\n\n`;
      response += `👷 **Active Agents:** ${agents.length}\n\n`;

      if (!taskListId) {
        response += `Use \`/parallel <task_list_id>\` to see parallelism analysis for a specific task list.`;
        return response;
      }

      // Show specific task list parallelism
      const parallelismInfo = await parallelismCalculator.getTaskListParallelism(taskListId);

      if (!parallelismInfo) {
        return `❓ Task list not found or no parallelism data available.`;
      }

      response += `📋 **Task List Parallelism**

📊 **Summary:**
• Total Tasks: ${parallelismInfo.totalTasks}
• Total Waves: ${parallelismInfo.totalWaves}
• Max Parallelism: ${parallelismInfo.parallelOpportunities}

🌊 **Execution Waves:**`;

      for (const wave of parallelismInfo.waves.slice(0, 5)) {
        const statusIcon =
          wave.status === 'completed'
            ? '✅'
            : wave.status === 'in_progress'
            ? '🔄'
            : wave.status === 'failed'
            ? '❌'
            : '⏳';
        response += `\n• ${statusIcon} Wave ${wave.waveNumber}: ${wave.taskCount} tasks`;
      }

      return response;
    } catch (err) {
      console.error('[TaskAgentTelegram] Parallel status failed:', err);
      return `❌ Failed to get parallelism status: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  /**
   * Handle /agents command
   */
  private async handleAgentsStatus(): Promise<string> {
    try {
      const agents = await buildAgentOrchestrator.getActiveAgents();

      if (agents.length === 0) {
        return `🤖 **Build Agents**

No active Build Agents.

Start execution on a task list to spawn Build Agents.`;
      }

      let response = `🤖 **Build Agents** (${agents.length} active)\n\n`;

      for (const agent of agents.slice(0, 10)) {
        const statusIcon =
          agent.status === 'running'
            ? '🟢'
            : agent.status === 'spawning'
            ? '🟡'
            : agent.status === 'completing'
            ? '✅'
            : agent.status === 'terminated'
            ? '❌'
            : '⚪';

        const heartbeatAge = agent.lastHeartbeatAt
          ? Math.floor((Date.now() - new Date(agent.lastHeartbeatAt).getTime()) / 1000)
          : null;
        const healthWarning = heartbeatAge && heartbeatAge > 60 ? ' ⚠️' : '';

        response += `${statusIcon} **Agent ${agent.id.slice(0, 8)}**${healthWarning}
   Status: ${agent.status}
   ${heartbeatAge !== null ? `Heartbeat: ${heartbeatAge}s ago` : 'No heartbeat'}\n\n`;
      }

      if (agents.length > 10) {
        response += `_...and ${agents.length - 10} more agents_`;
      }

      return response;
    } catch (err) {
      console.error('[TaskAgentTelegram] Agents status failed:', err);
      return `❌ Failed to get agent status: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }

  /**
   * Check if text looks like a task description
   */
  private looksLikeTask(text: string): boolean {
    // Skip commands
    if (text.startsWith('/')) return false;

    // Skip very short messages
    if (text.length < 10) return false;

    // Look for task-like patterns
    const taskPatterns = [
      /\b(add|create|implement|build|fix|update|remove|delete|refactor|test|document)\b/i,
      /\b(should|need|want|must|could|would)\b/i,
      /\b(feature|bug|issue|task|todo|work)\b/i,
    ];

    return taskPatterns.some((p) => p.test(text));
  }

  /**
   * Cleanup old pending confirmations
   */
  private cleanupPendingConfirmations(): void {
    const now = Date.now();
    for (const [chatId, pending] of pendingConfirmations) {
      if (now - pending.timestamp.getTime() > CONFIRMATION_TIMEOUT_MS) {
        pendingConfirmations.delete(chatId);
      }
    }
  }
}

// Singleton instance
let instance: TaskAgentTelegramHandler | null = null;

export function getTaskAgentTelegramHandler(): TaskAgentTelegramHandler {
  if (!instance) {
    instance = new TaskAgentTelegramHandler();
  }
  return instance;
}

export default {
  TaskAgentTelegramHandler,
  getTaskAgentTelegramHandler,
};
