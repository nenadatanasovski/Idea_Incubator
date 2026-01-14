/**
 * Task Agent Telegram Command Handler
 *
 * Handles Telegram commands specific to the Task Agent functionality:
 * - /newtask - Create new task
 * - /edit - Edit a task (PTE-133)
 * - /override - Override file impacts (PTE-134)
 * - /queue - View Evaluation Queue
 * - /suggest - Get grouping suggestions
 * - /parallel - View parallelism status
 * - /agents - View active Build Agents
 * - /accept - Accept grouping suggestion
 * - /reject - Reject grouping suggestion
 * - /execute - Start executing a task list (BA-065)
 * - /pause - Pause execution of a task list
 * - /resume - Resume execution of a paused task list
 * - /stop - Terminate a specific Build Agent
 *
 * Part of: PTE-133 to PTE-135, BA-065 to BA-076
 */

import { ReceivedMessage } from './telegram-receiver.js';
import { TelegramSender } from './telegram-sender.js';
import { BotRegistry } from './bot-registry.js';
import { ChatLinker } from './chat-linker.js';
import { AgentType } from './types.js';

// Import task agent services
import taskCreationService from '../services/task-agent/task-creation-service.js';
import evaluationQueueManager from '../services/task-agent/evaluation-queue-manager.js';
import autoGroupingEngine from '../services/task-agent/auto-grouping-engine.js';
import parallelismCalculator from '../services/task-agent/parallelism-calculator.js';
import buildAgentOrchestrator, { orchestratorEvents } from '../services/task-agent/build-agent-orchestrator.js';
import fileImpactAnalyzer from '../services/task-agent/file-impact-analyzer.js';

/**
 * Standard recommendation footer for actionable messages (PTE-135)
 */
const RECOMMENDATION_FOOTER = `
---
💡 *Recommendations:*
• Use \`/edit <id>\` to modify a task
• Use \`/override <id>\` to specify file impacts
• Use \`/suggest\` for grouping suggestions
• Use \`/help\` for all commands`;

/**
 * Task Agent Telegram Command Handler
 */
export class TaskAgentTelegramHandler {
  private sender: TelegramSender;

  constructor(botRegistry: BotRegistry, chatLinker?: ChatLinker, primaryUserId: string = 'default_user') {
    this.sender = new TelegramSender(botRegistry, chatLinker as ChatLinker, primaryUserId);
  }

  /**
   * Handle /newtask command
   * Creates a new task in the Evaluation Queue
   */
  async handleNewTask(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const args = message.text.replace('/newtask', '').trim();

    if (!args) {
      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `❌ *Usage:* \`/newtask <task description>\`

Example: \`/newtask Add user authentication to API\``,
        false // Don't add recommendations to error messages
      );
      return;
    }

    try {
      const result = await taskCreationService.createListlessTask({
        title: args,
      });

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `✅ *Task Created!*

📋 *ID:* \`${result.task.displayId}\`
📝 *Title:* ${result.task.title}
📊 *Status:* ${result.task.status}
📂 *Queue:* Evaluation Queue

The task will be analyzed for file impacts and grouping suggestions.`,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'create task', error);
    }
  }

  /**
   * Handle /edit command (PTE-133)
   * Shows task details and allows editing
   */
  async handleEdit(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const args = message.text.replace('/edit', '').trim();

    if (!args) {
      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `❌ *Usage:* \`/edit <task_id>\`

Example: \`/edit TU-PROJ-FEA-042\``,
        false
      );
      return;
    }

    try {
      // Try to find by display ID first, then by UUID
      let task = await taskCreationService.getTaskByDisplayId(args);
      if (!task) {
        task = await taskCreationService.getTaskById(args);
      }

      if (!task) {
        await this.sender.sendToChatId(
          message.botType,
          chatId,
          `❌ Task \`${args}\` not found.`
        );
        return;
      }

      // Get file impacts for this task
      const impacts = await fileImpactAnalyzer.getFileImpacts(task.id);

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `📝 *Edit Task: ${task.displayId}*

📋 *Title:* ${task.title}
${task.description ? `📄 *Description:* ${task.description}\n` : ''}
🏷️ *Category:* ${task.category}
⚡ *Priority:* ${task.priority}
⏱️ *Effort:* ${task.effort}
📊 *Status:* ${task.status}

📁 *File Impacts:* ${impacts.length}
${impacts.slice(0, 5).map(i => `  • \`${i.operation}\` ${i.filePath} (${Math.round(i.confidence * 100)}%)`).join('\n')}
${impacts.length > 5 ? `  ... and ${impacts.length - 5} more` : ''}

*To update:*
Reply with the field you want to change:
• \`title: New title here\`
• \`description: New description\`
• \`category: feature|bug|task|...\`
• \`priority: P1|P2|P3|P4\``,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'edit task', error);
    }
  }

  /**
   * Handle /override command (PTE-134)
   * Override file impacts for a task
   */
  async handleOverride(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const args = message.text.replace('/override', '').trim();

    if (!args) {
      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `❌ *Usage:* \`/override <task_id>\` or \`/override <task_id> <operation> <file_path>\`

Examples:
• \`/override TU-PROJ-FEA-042\` - View current impacts
• \`/override TU-PROJ-FEA-042 CREATE server/routes/new.ts\`
• \`/override TU-PROJ-FEA-042 UPDATE types/api.ts\`
• \`/override TU-PROJ-FEA-042 DELETE old/file.ts\``,
        false
      );
      return;
    }

    const parts = args.split(/\s+/);
    const taskIdArg = parts[0];

    try {
      // Find the task
      let task = await taskCreationService.getTaskByDisplayId(taskIdArg);
      if (!task) {
        task = await taskCreationService.getTaskById(taskIdArg);
      }

      if (!task) {
        await this.sender.sendToChatId(
          message.botType,
          chatId,
          `❌ Task \`${taskIdArg}\` not found.`
        );
        return;
      }

      // If no operation provided, show current impacts
      if (parts.length === 1) {
        const impacts = await fileImpactAnalyzer.getFileImpacts(task.id);

        await this.sendWithRecommendation(
          message.botType,
          chatId,
          `📁 *File Impacts for ${task.displayId}*

${impacts.length === 0 ? 'No file impacts predicted.' : impacts.map(i =>
  `• \`${i.operation}\` ${i.filePath}
    ↳ ${Math.round(i.confidence * 100)}% confidence (${i.source})`
).join('\n')}

*To add an override:*
\`/override ${task.displayId} CREATE|UPDATE|DELETE|READ <file_path>\`

*To remove an impact:*
\`/override ${task.displayId} REMOVE <file_path> <operation>\``,
          true
        );
        return;
      }

      // Handle override
      if (parts.length >= 3) {
        const operation = parts[1].toUpperCase();
        const filePath = parts.slice(2).join(' ');

        const validOperations = ['CREATE', 'UPDATE', 'DELETE', 'READ', 'REMOVE'];
        if (!validOperations.includes(operation)) {
          await this.sender.sendToChatId(
            message.botType,
            chatId,
            `❌ Invalid operation. Use: CREATE, UPDATE, DELETE, READ, or REMOVE`
          );
          return;
        }

        if (operation === 'REMOVE') {
          // Remove an existing impact
          const removeOp = parts[3]?.toUpperCase() || 'UPDATE';
          await fileImpactAnalyzer.removeFileImpact(task.id, filePath, removeOp as any);
          await parallelismCalculator.invalidateAnalysis(task.id);

          await this.sendWithRecommendation(
            message.botType,
            chatId,
            `✅ Removed file impact: \`${removeOp}\` ${filePath}

Parallelism analysis has been recalculated.`,
            true
          );
        } else {
          // Add new impact
          await fileImpactAnalyzer.setFileImpact(task.id, {
            filePath,
            operation: operation as any,
            confidence: 1.0,
            source: 'user_declared',
          });
          await parallelismCalculator.invalidateAnalysis(task.id);

          await this.sendWithRecommendation(
            message.botType,
            chatId,
            `✅ Added file impact: \`${operation}\` ${filePath}

Parallelism analysis has been recalculated.`,
            true
          );
        }
      }
    } catch (error) {
      await this.sendError(message.botType, chatId, 'override file impacts', error);
    }
  }

  /**
   * Handle /queue command
   * Show Evaluation Queue status
   */
  async handleQueue(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;

    try {
      const tasks = await evaluationQueueManager.getQueuedTasks();
      const stats = await evaluationQueueManager.getQueueStats();

      if (tasks.length === 0) {
        await this.sendWithRecommendation(
          message.botType,
          chatId,
          `📭 *Evaluation Queue is empty*

Use \`/newtask <description>\` to add a task.`,
          true
        );
        return;
      }

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `📬 *Evaluation Queue*

📊 *Stats:*
• Total: ${stats.totalQueued}
• Stale (>3 days): ${stats.staleCount}
• New today: ${stats.newToday}
• Avg days in queue: ${stats.avgDaysInQueue.toFixed(1)}

📋 *Recent Tasks:*
${tasks.slice(0, 10).map(t =>
  `• \`${t.displayId}\` ${t.title.substring(0, 40)}${t.title.length > 40 ? '...' : ''}`
).join('\n')}
${tasks.length > 10 ? `\n... and ${tasks.length - 10} more` : ''}`,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'get queue', error);
    }
  }

  /**
   * Handle /suggest command
   * Get auto-grouping suggestions
   */
  async handleSuggest(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;

    try {
      const suggestions = await autoGroupingEngine.getPendingSuggestions();

      if (suggestions.length === 0) {
        // Trigger analysis
        await this.sender.sendToChatId(
          message.botType,
          chatId,
          '🔍 Analyzing tasks for grouping suggestions...'
        );

        const newSuggestions = await autoGroupingEngine.analyzeTasks();

        if (newSuggestions.length === 0) {
          await this.sendWithRecommendation(
            message.botType,
            chatId,
            `🤔 *No grouping suggestions*

Not enough similar tasks in the Evaluation Queue to suggest groupings.
Add more tasks with \`/newtask\` and try again.`,
            true
          );
          return;
        }

        await this.sendSuggestions(message.botType, chatId, newSuggestions);
      } else {
        await this.sendSuggestions(message.botType, chatId, suggestions);
      }
    } catch (error) {
      await this.sendError(message.botType, chatId, 'get suggestions', error);
    }
  }

  /**
   * Send grouping suggestions
   */
  private async sendSuggestions(
    botType: AgentType,
    chatId: string,
    suggestions: any[]
  ): Promise<void> {
    await this.sendWithRecommendation(
      botType,
      chatId,
      `💡 *Grouping Suggestions*

${suggestions.slice(0, 5).map((s, i) =>
  `*${i + 1}. ${s.suggestedName}*
  📦 ${s.suggestedTasks.length} tasks
  📝 ${s.groupingReason}
  ↳ \`/accept ${s.id.slice(0, 8)}\` or \`/reject ${s.id.slice(0, 8)}\``
).join('\n\n')}
${suggestions.length > 5 ? `\n... and ${suggestions.length - 5} more` : ''}`,
      true
    );
  }

  /**
   * Handle /parallel command
   * Show parallelism status for a task list
   */
  async handleParallel(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const args = message.text.replace('/parallel', '').trim();

    try {
      if (!args) {
        // Show summary of all task lists
        const taskListOrchestrator = (await import('../services/task-agent/task-list-orchestrator.js')).default;
        const status = await taskListOrchestrator.getOrchestratorStatus();

        await this.sendWithRecommendation(
          message.botType,
          chatId,
          `⚡ *Orchestrator Status*

📊 *Config:*
• Max concurrent lists: ${status.config.maxConcurrentLists}
• Max global agents: ${status.config.maxGlobalAgents}
• Cross-list conflict detection: ${status.config.enableCrossListConflictDetection ? 'ON' : 'OFF'}

📋 *Active Lists:* ${status.activeLists.length}
${status.activeLists.map(l => `• ${l.name} (${l.completedTasks}/${l.totalTasks} done)`).join('\n') || 'None'}

🤖 *Agent Pool:*
• Total active: ${status.globalAgentPool.totalActive}
• Available slots: ${status.globalAgentPool.availableSlots}`,
          true
        );
        return;
      }

      // Show parallelism for specific task list
      const parallelism = await parallelismCalculator.getTaskListParallelism(args);

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `⚡ *Parallelism Analysis*

📊 *Summary:*
• Total tasks: ${parallelism.totalTasks}
• Total waves: ${parallelism.totalWaves}
• Max parallelism: ${parallelism.maxWave}
• Parallel opportunities: ${parallelism.parallelOpportunities}

🌊 *Execution Waves:*
${parallelism.waves.map(w =>
  `Wave ${w.waveNumber}: ${w.taskCount} tasks (${w.status})`
).join('\n')}`,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'get parallelism', error);
    }
  }

  /**
   * Handle /agents command
   * Show active Build Agents
   */
  async handleAgents(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;

    try {
      const agents = await buildAgentOrchestrator.getActiveAgents();

      if (agents.length === 0) {
        await this.sendWithRecommendation(
          message.botType,
          chatId,
          `🤖 *No Active Build Agents*

Start execution with \`/parallel <task_list_id>\` or through the UI.`,
          true
        );
        return;
      }

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `🤖 *Active Build Agents: ${agents.length}*

${agents.map(a =>
  `• \`${a.id.slice(0, 8)}\` - ${a.status}
    ↳ Task: ${a.taskId || 'None'}
    ↳ Completed: ${a.tasksCompleted} | Failed: ${a.tasksFailed}`
).join('\n')}`,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'get agents', error);
    }
  }

  /**
   * Handle /lists command
   * Show all task lists
   */
  async handleLists(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    console.log('[TaskAgentHandler] handleLists called for chatId:', chatId);

    try {
      console.log('[TaskAgentHandler] Importing task-list-orchestrator...');
      const taskListOrchestrator = (await import('../services/task-agent/task-list-orchestrator.js')).default;
      console.log('[TaskAgentHandler] Getting orchestrator status...');
      const status = await taskListOrchestrator.getOrchestratorStatus();
      console.log('[TaskAgentHandler] Got status with', status.activeLists.length, 'lists');

      if (status.activeLists.length === 0) {
        console.log('[TaskAgentHandler] No active lists, sending empty message');
        await this.sendWithRecommendation(
          message.botType,
          chatId,
          `📋 *No Task Lists*

Create tasks with \`/newtask\` and use \`/suggest\` to group them into lists.`,
          true
        );
        return;
      }

      // Build list text - escape markdown chars in names
      const listItems = status.activeLists.map(l => {
        const name = this.escapeMarkdown(l.name || 'Unnamed');
        const id = l.id?.slice(0, 8) || 'N/A';
        return `• *${name}*\n  Progress: ${l.completedTasks}/${l.totalTasks}\n  ID: \`${id}\``;
      }).join('\n\n');

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `📋 *Task Lists (${status.activeLists.length})*

${listItems}`,
        true
      );
    } catch (error) {
      console.error('[TaskAgentHandler] Error in handleLists:', error);
      await this.sendError(message.botType, chatId, 'get task lists', error);
    }
  }

  /**
   * Handle /task command
   * Show task details
   */
  async handleTask(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const args = message.text.replace('/task', '').trim();

    if (!args) {
      await this.sender.sendToChatId(
        message.botType,
        chatId,
        `❌ Usage: /task [task_id]

Example: /task TU-PROJ-FEA-042

Use /queue to see tasks in Evaluation Queue.`,
        'HTML'
      );
      return;
    }

    try {
      // Try to find by display ID first, then by UUID
      let task = await taskCreationService.getTaskByDisplayId(args);
      if (!task) {
        task = await taskCreationService.getTaskById(args);
      }

      if (!task) {
        await this.sender.sendToChatId(
          message.botType,
          chatId,
          `❌ Task "${this.escapeHtml(args)}" not found.`,
          'HTML'
        );
        return;
      }

      // Get file impacts for this task
      const impacts = await fileImpactAnalyzer.getFileImpacts(task.id);

      // Escape HTML chars in dynamic content
      const title = this.escapeHtml(task.title);
      const description = task.description ? this.escapeHtml(task.description) : '';

      const impactsList = impacts.length === 0
        ? 'None predicted'
        : impacts.slice(0, 5).map(i => `  • ${i.operation} ${this.escapeHtml(i.filePath)}`).join('\n');

      await this.sender.sendToChatId(
        message.botType,
        chatId,
        `📋 Task: ${task.displayId}

📝 Title: ${title}
${description ? `📄 Description: ${description}\n` : ''}🏷️ Category: ${task.category}
⚡ Priority: ${task.priority}
⏱️ Effort: ${task.effort}
📊 Status: ${task.status}
📂 Queue: ${task.taskListId ? 'In Task List' : 'Evaluation Queue'}
${task.taskListId ? `📋 List ID: ${task.taskListId.slice(0, 8)}` : ''}

📁 File Impacts (${impacts.length}):
${impactsList}
${impacts.length > 5 ? `  ... and ${impacts.length - 5} more` : ''}

---
💡 Use /edit ${task.displayId} to modify, /help for all commands`,
        'HTML'
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'get task', error);
    }
  }

  /**
   * Handle /accept command
   * Accept a grouping suggestion
   */
  async handleAccept(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const suggestionId = message.text.replace('/accept', '').trim();

    if (!suggestionId) {
      await this.sender.sendToChatId(
        message.botType,
        chatId,
        `❌ *Usage:* \`/accept <suggestion_id>\``
      );
      return;
    }

    try {
      const result = await autoGroupingEngine.acceptSuggestion(suggestionId);

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `✅ *Suggestion Accepted!*

📋 *Task List Created:* ${result.taskListId.slice(0, 8)}
📦 *Tasks Moved:* ${result.tasksMoved}

The tasks have been grouped into a new task list.`,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'accept suggestion', error);
    }
  }

  /**
   * Handle /reject command
   * Reject a grouping suggestion
   */
  async handleReject(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const suggestionId = message.text.replace('/reject', '').trim();

    if (!suggestionId) {
      await this.sender.sendToChatId(
        message.botType,
        chatId,
        `❌ *Usage:* \`/reject <suggestion_id>\``
      );
      return;
    }

    try {
      await autoGroupingEngine.rejectSuggestion(suggestionId);

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `✅ Suggestion rejected.`,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'reject suggestion', error);
    }
  }

  /**
   * Handle grouping callback (inline button press)
   * Processes Accept/Reject from suggestion buttons
   */
  async handleGroupingCallback(
    suggestionId: string,
    action: 'accept' | 'reject',
    chatId: string,
    botType: AgentType
  ): Promise<void> {
    try {
      if (action === 'accept') {
        const result = await autoGroupingEngine.acceptSuggestion(suggestionId);

        await this.sendWithRecommendation(
          botType,
          chatId,
          `✅ *Suggestion Accepted!*

📋 *Task List Created:* ${result.taskListId.slice(0, 8)}
📦 *Tasks Moved:* ${result.tasksMoved}

The tasks have been grouped into a new task list.`,
          true
        );
      } else {
        await autoGroupingEngine.rejectSuggestion(suggestionId);

        await this.sender.sendToChatId(
          botType,
          chatId,
          `✅ Suggestion rejected.`
        );
      }
    } catch (error) {
      await this.sendError(botType, chatId, `${action} suggestion`, error);
    }
  }

  /**
   * Handle "View All" grouping suggestions callback
   */
  async handleGroupingViewAll(chatId: string, botType: AgentType): Promise<void> {
    try {
      const suggestions = await autoGroupingEngine.getPendingSuggestions();

      if (suggestions.length === 0) {
        await this.sender.sendToChatId(
          botType,
          chatId,
          `📭 *No pending suggestions*

Use \`/suggest\` to analyze tasks for new grouping opportunities.`
        );
        return;
      }

      await this.sendSuggestions(botType, chatId, suggestions);
    } catch (error) {
      await this.sendError(botType, chatId, 'get all suggestions', error);
    }
  }

  /**
   * Handle /execute command (BA-065)
   * Start executing a task list
   */
  async handleExecute(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const taskListId = message.text.replace('/execute', '').trim();

    if (!taskListId) {
      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `❌ *Usage:* \`/execute <task_list_id>\`

Example: \`/execute abc123\`

Use \`/parallel\` to see available task lists.`,
        false
      );
      return;
    }

    try {
      // Validate task list exists and has tasks (BA-066)
      const taskListOrchestrator = (await import('../services/task-agent/task-list-orchestrator.js')).default;
      const validation = await this.validateTaskListForExecution(taskListId);

      if (!validation.valid) {
        await this.sender.sendToChatId(
          message.botType,
          chatId,
          `❌ ${validation.error}`
        );
        return;
      }

      // Store pending execution for approval (BA-076)
      this.storePendingExecution(taskListId, chatId, message.botType);

      // Send approval message with inline keyboard (BA-067)
      await this.sender.sendWithButtonsToChatId(
        message.botType,
        chatId,
        `🚀 *Execute Task List?*

📋 *List:* ${validation.taskList!.name}
📊 *Tasks:* ${validation.taskCount} total
⚡ *Waves:* ${validation.waveCount} execution waves
🤖 *Max Parallel:* ${validation.taskList!.maxParallelAgents} agents

*Estimated:* ~${Math.ceil(validation.taskCount! * 2)} minutes

⚠️ This will spawn Build Agents to execute all tasks.`,
        [
          [
            { text: '✅ Start Execution', callbackData: `execute:${taskListId}:start` },
            { text: '❌ Cancel', callbackData: `execute:${taskListId}:cancel` },
          ],
        ]
      );

      // Start approval timeout (BA-075) - 5 minutes
      this.startApprovalTimeout(taskListId, chatId, message.botType, 5 * 60 * 1000);

    } catch (error) {
      await this.sendError(message.botType, chatId, 'validate task list', error);
    }
  }

  /**
   * Handle execute callback (BA-069)
   * Process Start/Cancel button clicks
   */
  async handleExecuteCallback(
    taskListId: string,
    action: 'start' | 'cancel',
    chatId: string,
    botType: AgentType
  ): Promise<void> {
    // Clear the timeout
    this.clearApprovalTimeout(taskListId);

    // Remove from pending executions
    const pending = this.getPendingExecution(taskListId);
    this.removePendingExecution(taskListId);

    if (action === 'cancel') {
      await this.sender.sendToChatId(
        botType,
        chatId,
        `❌ Execution cancelled.`
      );
      return;
    }

    // Start execution (BA-070)
    try {
      await this.sender.sendToChatId(
        botType,
        chatId,
        `🚀 *Starting execution...*`
      );

      // Subscribe to notifications before starting (BA-096)
      this.subscribeToExecutionNotifications(taskListId, chatId, botType);

      const result = await buildAgentOrchestrator.startExecution(taskListId);

      await this.sender.sendToChatId(
        botType,
        chatId,
        `✅ *Execution Started!*

📋 *Task List:* ${taskListId.slice(0, 8)}
🤖 *Agents Spawned:* ${result.agentsSpawned}
🌊 *First Wave:* ${result.firstWaveTasks.length} tasks

You'll receive notifications as tasks complete.`
      );

    } catch (error) {
      // Unsubscribe on error
      this.notificationSubscriptions.delete(taskListId);
      await this.sendError(botType, chatId, 'start execution', error);
    }
  }

  /**
   * Handle /pause command
   * Pause execution of a task list
   */
  async handlePause(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const taskListId = message.text.replace('/pause', '').trim();

    if (!taskListId) {
      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `❌ *Usage:* \`/pause <task_list_id>\`

Example: \`/pause human-e2e-001\`

Use \`/parallel\` to see active task lists.`,
        false
      );
      return;
    }

    try {
      // Check if task list is running
      const parallelism = await parallelismCalculator.getTaskListParallelism(taskListId);
      if (!parallelism) {
        await this.sender.sendToChatId(
          message.botType,
          chatId,
          `❌ Task list \`${taskListId}\` not found.`
        );
        return;
      }

      await buildAgentOrchestrator.pauseExecution(taskListId);

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `⏸️ *Execution Paused*

📋 *Task List:* \`${taskListId}\`

Running agents will complete their current tasks, but no new agents will be spawned.

Use \`/resume ${taskListId}\` to continue execution.`,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'pause execution', error);
    }
  }

  /**
   * Handle /resume command
   * Resume execution of a paused task list
   */
  async handleResume(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const taskListId = message.text.replace('/resume', '').trim();

    if (!taskListId) {
      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `❌ *Usage:* \`/resume <task_list_id>\`

Example: \`/resume human-e2e-001\`

Use \`/parallel\` to see task lists.`,
        false
      );
      return;
    }

    try {
      // Check if task list exists
      const parallelism = await parallelismCalculator.getTaskListParallelism(taskListId);
      if (!parallelism) {
        await this.sender.sendToChatId(
          message.botType,
          chatId,
          `❌ Task list \`${taskListId}\` not found.`
        );
        return;
      }

      await buildAgentOrchestrator.resumeExecution(taskListId);

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `▶️ *Execution Resumed*

📋 *Task List:* \`${taskListId}\`

New agents will be spawned for pending tasks.`,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'resume execution', error);
    }
  }

  /**
   * Handle /stop command
   * Terminate a specific Build Agent
   */
  async handleStop(message: ReceivedMessage): Promise<void> {
    const chatId = message.chatId;
    const agentId = message.text.replace('/stop', '').trim();

    if (!agentId) {
      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `❌ *Usage:* \`/stop <agent_id>\`

Example: \`/stop abc12345\`

Use \`/agents\` to see active agents.`,
        false
      );
      return;
    }

    try {
      // Get active agents to find the one being terminated
      const agents = await buildAgentOrchestrator.getActiveAgents();
      const agent = agents.find(a => a.id === agentId || a.id.startsWith(agentId));

      if (!agent) {
        await this.sender.sendToChatId(
          message.botType,
          chatId,
          `❌ Agent \`${agentId}\` not found or not active.

Use \`/agents\` to see active agents.`
        );
        return;
      }

      await buildAgentOrchestrator.terminateAgent(agent.id, 'user_requested');

      await this.sendWithRecommendation(
        message.botType,
        chatId,
        `🛑 *Agent Terminated*

🤖 *Agent:* \`${agent.id.slice(0, 8)}\`
📋 *Task:* ${agent.taskId || 'None'}
⚠️ *Reason:* User requested

The agent's current task will be marked for retry.`,
        true
      );
    } catch (error) {
      await this.sendError(message.botType, chatId, 'stop agent', error);
    }
  }

  /**
   * Validate a task list for execution (BA-066)
   */
  private async validateTaskListForExecution(taskListId: string): Promise<{
    valid: boolean;
    error?: string;
    taskList?: any;
    taskCount?: number;
    waveCount?: number;
  }> {
    try {
      // Check if task list exists
      const taskListOrchestrator = (await import('../services/task-agent/task-list-orchestrator.js')).default;
      const lists = await taskListOrchestrator.getOrchestratorStatus();

      // Try to get the task list
      const parallelism = await parallelismCalculator.getTaskListParallelism(taskListId);

      if (!parallelism || parallelism.totalTasks === 0) {
        return {
          valid: false,
          error: `Task list \`${taskListId}\` not found or has no tasks.`,
        };
      }

      // Check if already running
      const activeAgents = await buildAgentOrchestrator.getActiveAgents();
      const runningOnList = activeAgents.filter(a => a.taskListId === taskListId);
      if (runningOnList.length > 0) {
        return {
          valid: false,
          error: `Task list is already being executed (${runningOnList.length} agents active).`,
        };
      }

      return {
        valid: true,
        taskList: {
          name: taskListId.slice(0, 8),
          maxParallelAgents: 3,
        },
        taskCount: parallelism.totalTasks,
        waveCount: parallelism.totalWaves,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to validate task list: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ============================================================
  // Pending Execution Management (BA-076)
  // ============================================================

  private pendingExecutions = new Map<string, {
    chatId: string;
    botType: AgentType;
    createdAt: Date;
    timeoutId?: NodeJS.Timeout;
  }>();

  private storePendingExecution(taskListId: string, chatId: string, botType: AgentType): void {
    this.pendingExecutions.set(taskListId, {
      chatId,
      botType,
      createdAt: new Date(),
    });
  }

  private getPendingExecution(taskListId: string) {
    return this.pendingExecutions.get(taskListId);
  }

  private removePendingExecution(taskListId: string): void {
    this.pendingExecutions.delete(taskListId);
  }

  private startApprovalTimeout(
    taskListId: string,
    chatId: string,
    botType: AgentType,
    timeoutMs: number
  ): void {
    const pending = this.pendingExecutions.get(taskListId);
    if (pending) {
      pending.timeoutId = setTimeout(async () => {
        this.removePendingExecution(taskListId);
        await this.sender.sendToChatId(
          botType,
          chatId,
          `⏰ *Approval expired* for task list \`${taskListId.slice(0, 8)}\`.

Use \`/execute ${taskListId}\` to try again.`
        );
      }, timeoutMs);
    }
  }

  private clearApprovalTimeout(taskListId: string): void {
    const pending = this.pendingExecutions.get(taskListId);
    if (pending?.timeoutId) {
      clearTimeout(pending.timeoutId);
    }
  }

  // ============================================================
  // Execution Notifier (BA-094 to BA-098)
  // ============================================================

  /**
   * Notification subscription tracking
   */
  private notificationSubscriptions = new Map<string, {
    chatId: string;
    botType: AgentType;
    subscribedAt: Date;
  }>();

  /**
   * Subscribe to execution notifications for a task list (BA-094)
   */
  subscribeToExecutionNotifications(
    taskListId: string,
    chatId: string,
    botType: AgentType
  ): void {
    this.notificationSubscriptions.set(taskListId, {
      chatId,
      botType,
      subscribedAt: new Date(),
    });
  }

  /**
   * Initialize event listeners for orchestrator events (BA-095)
   */
  initializeExecutionNotifier(): void {
    // Listen for execution started events (BA-092)
    orchestratorEvents.on('execution.started', async (event: {
      taskListId: string;
      totalTasks: number;
      totalWaves: number;
      maxParallelAgents: number;
    }) => {
      const subscription = this.notificationSubscriptions.get(event.taskListId);
      if (subscription) {
        await this.sender.sendToChatId(
          subscription.botType,
          subscription.chatId,
          `🚀 *Execution Started!*

📋 *Task List:* \`${event.taskListId.slice(0, 8)}\`
📊 *Total Tasks:* ${event.totalTasks}
🌊 *Waves:* ${event.totalWaves}
🤖 *Max Parallel Agents:* ${event.maxParallelAgents}

You'll receive notifications as tasks complete.`
        );
      }
    });

    // Listen for agent spawned events (BA-061)
    orchestratorEvents.on('agent.spawned', async (event: {
      agentId: string;
      taskId: string;
      taskListId: string;
    }) => {
      // We could notify on each spawn, but that might be too noisy
      // Just log for now
      console.log(`[TaskAgentTelegramHandler] Agent ${event.agentId.slice(0, 8)} spawned for task ${event.taskId}`);
    });

    // Listen for task completion events
    orchestratorEvents.on('task.completed', async (event: {
      taskId: string;
      agentId: string;
      taskListId: string;
    }) => {
      const subscription = this.notificationSubscriptions.get(event.taskListId);
      if (subscription) {
        // Get task info for notification
        const task = await taskCreationService.getTaskById(event.taskId);
        if (task) {
          await this.sender.sendToChatId(
            subscription.botType,
            subscription.chatId,
            `✅ *Task Completed:* \`${task.displayId}\`\n${task.title.substring(0, 50)}${task.title.length > 50 ? '...' : ''}`
          );
        }
      }
    });

    // Listen for task failure events
    orchestratorEvents.on('task.failed', async (event: {
      taskId: string;
      agentId: string;
      taskListId: string;
      error?: string;
    }) => {
      const subscription = this.notificationSubscriptions.get(event.taskListId);
      if (subscription) {
        const task = await taskCreationService.getTaskById(event.taskId);
        if (task) {
          await this.sender.sendToChatId(
            subscription.botType,
            subscription.chatId,
            `❌ *Task Failed:* \`${task.displayId}\`\n${task.title.substring(0, 50)}${task.title.length > 50 ? '...' : ''}\n\n_${event.error || 'Unknown error'}_`
          );
        }
      }
    });

    // Listen for execution completion events
    orchestratorEvents.on('execution.completed', async (event: {
      taskListId: string;
      completed: number;
      failed: number;
      duration: number;
    }) => {
      const subscription = this.notificationSubscriptions.get(event.taskListId);
      if (subscription) {
        const durationMins = Math.round(event.duration / 60000);
        const emoji = event.failed === 0 ? '🎉' : '⚠️';

        await this.sender.sendToChatId(
          subscription.botType,
          subscription.chatId,
          `${emoji} *Execution Complete!*

📋 *Task List:* \`${event.taskListId.slice(0, 8)}\`
✅ *Completed:* ${event.completed}
❌ *Failed:* ${event.failed}
⏱️ *Duration:* ${durationMins} min

${event.failed === 0 ? 'All tasks completed successfully!' : `${event.failed} task(s) require attention.`}`
        );

        // Unsubscribe after completion
        this.notificationSubscriptions.delete(event.taskListId);
      }
    });

    // Listen for build.stuck events (BA-046, SIA escalation)
    orchestratorEvents.on('build.stuck', async (event: {
      taskId: string;
      taskListId: string;
      consecutiveFailures: number;
      lastErrors: string[];
      noProgressReason: string;
    }) => {
      const subscription = this.notificationSubscriptions.get(event.taskListId);
      if (subscription) {
        const task = await taskCreationService.getTaskById(event.taskId);
        const taskName = task ? `\`${task.displayId}\`\n${task.title.substring(0, 50)}` : event.taskId;
        const errorSample = event.lastErrors[0]?.substring(0, 100) || 'Unknown error';

        await this.sender.sendToChatId(
          subscription.botType,
          subscription.chatId,
          `🆘 *Task Stuck - SIA Escalation*

📋 *Task:* ${taskName}
❌ *Failures:* ${event.consecutiveFailures} consecutive
⚠️ *Reason:* ${event.noProgressReason}

*Last Error:*
\`\`\`
${errorSample}
\`\`\`

🔄 SIA (Self-Improvement Agent) will analyze this failure and propose a fix.`
        );
      }
    });

    console.log('[TaskAgentTelegramHandler] Execution notifier initialized');
  }

  /**
   * Send a message with recommendation footer (PTE-135)
   */
  private async sendWithRecommendation(
    botType: AgentType,
    chatId: string,
    text: string,
    includeRecommendation: boolean
  ): Promise<void> {
    const finalText = includeRecommendation
      ? text + RECOMMENDATION_FOOTER
      : text;

    await this.sender.sendToChatId(botType, chatId, finalText);
  }

  /**
   * Escape markdown special characters
   */
  private escapeMarkdown(text: string): string {
    if (!text) return '';
    // Only escape underscores and asterisks which break markdown parsing
    return text.replace(/[_*]/g, '\\$&');
  }

  /**
   * Escape HTML special characters for safe Telegram HTML parsing
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Send error message
   */
  private async sendError(
    botType: AgentType,
    chatId: string,
    action: string,
    error: unknown
  ): Promise<void> {
    console.error(`[TaskAgentTelegramHandler] Error in ${action}:`, error);
    await this.sender.sendToChatId(
      botType,
      chatId,
      `❌ *Error:* Failed to ${action}.\n${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export default TaskAgentTelegramHandler;
