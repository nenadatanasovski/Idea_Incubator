/**
 * Task Executor Service
 *
 * Autonomous task execution engine that:
 * 1. Loads tasks from markdown task lists
 * 2. Executes tasks using the appropriate agents
 * 3. Updates task status in real-time
 * 4. Handles failures and retries
 */

import { EventEmitter } from "events";
import { query, run, getOne } from "../../database/db.js";
import {
  parseTaskList,
  updateTaskStatus as updateMarkdownStatus,
  getNextPendingTask,
  ParsedTask,
  TaskList,
} from "./task-loader.js";
import { getBotToken } from "../communication/config.js";
import { emitTaskExecutorEvent } from "../websocket.js";
import { getAgentRunner, AgentRunner } from "./agent-runner.js";
import {
  getTaskResultCollector,
  TaskResultCollector,
} from "./task-result-collector.js";

export interface ExecutionConfig {
  taskListPath: string;
  autoStart: boolean;
  maxConcurrent: number;
  retryAttempts: number;
  retryDelayMs: number;
  executionTimeoutMs: number;
  minPriority: "P1" | "P2" | "P3" | "P4";
  dryRun: boolean;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  taskListPath: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  error?: string;
  output?: string;
  assignedAgent?: string;
}

export interface ExecutorStatus {
  running: boolean;
  paused: boolean;
  currentTask?: ParsedTask;
  taskListPath: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  skippedTasks: number;
  executionHistory: TaskExecution[];
}

// Agent type mapping based on task ID prefix
const AGENT_MAPPING: Record<string, string> = {
  COM: "monitoring-agent",
  FND: "build-agent",
  UFS: "build-agent",
  IDE: "spec-agent",
  EVL: "validation-agent",
  AGT: "spec-agent",
  SPC: "spec-agent",
  BLD: "build-agent",
  VAL: "validation-agent",
  SIA: "sia",
  UXA: "ux-agent",
  ORC: "monitoring-agent",
  KNW: "sia",
  VER: "validation-agent",
  MON: "monitoring-agent",
  PMA: "monitoring-agent",
  WEB: "build-agent",
  WSK: "build-agent",
  NTF: "build-agent",
  QUE: "build-agent",
  SEC: "build-agent",
  DOC: "spec-agent",
};

export class TaskExecutor extends EventEmitter {
  private config: ExecutionConfig;
  private status: ExecutorStatus;
  private taskList: TaskList | null = null;
  private executionQueue: ParsedTask[] = [];
  private activeExecutions: Map<string, TaskExecution> = new Map();
  private intervalHandle: NodeJS.Timeout | null = null;
  private notificationsEnabled: boolean = true;
  private resultCollector: TaskResultCollector;
  private executorStateId: string = "";

  constructor(config: Partial<ExecutionConfig> = {}) {
    super();
    this.resultCollector = getTaskResultCollector();
    this.config = {
      taskListPath: "",
      autoStart: false,
      maxConcurrent: 1,
      retryAttempts: 2,
      retryDelayMs: 5000,
      executionTimeoutMs: 5 * 60 * 1000, // 5 minutes
      minPriority: "P4",
      dryRun: false,
      ...config,
    };

    this.status = {
      running: false,
      paused: false,
      taskListPath: this.config.taskListPath,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      skippedTasks: 0,
      executionHistory: [],
    };
  }

  /**
   * Load a task list for execution
   */
  async loadTaskList(filePath: string): Promise<TaskList> {
    this.taskList = parseTaskList(filePath);
    this.config.taskListPath = filePath;
    this.status.taskListPath = filePath;
    this.status.totalTasks = this.taskList.summary.total;
    this.status.completedTasks = this.taskList.summary.complete;

    // Try to restore from database first
    const restored = await this.restoreQueueFromDatabase(filePath);

    if (restored) {
      console.log(
        `[TaskExecutor] Restored ${this.executionQueue.length} tasks from database`,
      );
    } else {
      // Build execution queue from pending tasks
      this.executionQueue = this.taskList.tasks
        .filter((t) => t.status === "pending")
        .sort((a, b) => {
          const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

      // Persist initial queue to database
      await this.persistQueueToDatabase();
    }

    this.emit("taskList:loaded", {
      filePath,
      title: this.taskList.title,
      totalTasks: this.taskList.summary.total,
      pendingTasks: this.taskList.summary.pending,
    });

    // Broadcast via WebSocket
    emitTaskExecutorEvent("tasklist:loaded", {
      taskListPath: filePath,
      totalTasks: this.taskList.summary.total,
      pendingTasks: this.taskList.summary.pending,
      completedTasks: this.taskList.summary.complete,
    });

    return this.taskList;
  }

  /**
   * Persist the current execution queue to database
   */
  private async persistQueueToDatabase(): Promise<void> {
    if (!this.config.taskListPath) return;

    try {
      // Clear existing queue for this task list
      await run("DELETE FROM task_queue WHERE task_list_path = ?", [
        this.config.taskListPath,
      ]);

      // Insert current queue items
      for (let i = 0; i < this.executionQueue.length; i++) {
        const task = this.executionQueue[i];
        const queueId = `queue-${Date.now()}-${task.id}`;

        await run(
          `
          INSERT INTO task_queue (
            id, task_list_path, task_id, priority, section, description,
            dependencies, status, assigned_agent, position
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            queueId,
            this.config.taskListPath,
            task.id,
            task.priority,
            task.section || "",
            task.description,
            task.dependencies ? JSON.stringify(task.dependencies) : null,
            "queued",
            this.getAgentForTask(task),
            i,
          ],
        );
      }

      // Update or create executor state
      await this.persistExecutorState();

      console.log(
        `[TaskExecutor] Persisted ${this.executionQueue.length} tasks to database`,
      );
    } catch (error) {
      console.error(
        "[TaskExecutor] Error persisting queue to database:",
        error,
      );
    }
  }

  /**
   * Restore execution queue from database
   */
  private async restoreQueueFromDatabase(filePath: string): Promise<boolean> {
    try {
      const queueItems = await query(
        `
        SELECT * FROM task_queue
        WHERE task_list_path = ? AND status = 'queued'
        ORDER BY position ASC
      `,
        [filePath],
      );

      if (!queueItems || queueItems.length === 0) {
        return false;
      }

      // Restore executor state
      const executorState = await getOne(
        `
        SELECT * FROM executor_state WHERE task_list_path = ?
      `,
        [filePath],
      );

      if (executorState) {
        this.executorStateId = executorState.id as string;
        this.status.completedTasks =
          (executorState.completed_tasks as number) || 0;
        this.status.failedTasks = (executorState.failed_tasks as number) || 0;
        this.status.skippedTasks = (executorState.skipped_tasks as number) || 0;
      }

      // Rebuild execution queue from database
      this.executionQueue = [];
      for (const item of queueItems) {
        // Find the task in the loaded task list
        const task = this.taskList?.tasks.find((t) => t.id === item.task_id);
        if (task) {
          this.executionQueue.push(task);
        }
      }

      return this.executionQueue.length > 0;
    } catch (error) {
      console.error(
        "[TaskExecutor] Error restoring queue from database:",
        error,
      );
      return false;
    }
  }

  /**
   * Persist executor state to database
   */
  private async persistExecutorState(): Promise<void> {
    if (!this.config.taskListPath) return;

    try {
      if (!this.executorStateId) {
        this.executorStateId = `executor-${Date.now()}`;
      }

      const configJson = JSON.stringify({
        maxConcurrent: this.config.maxConcurrent,
        retryAttempts: this.config.retryAttempts,
        retryDelayMs: this.config.retryDelayMs,
        executionTimeoutMs: this.config.executionTimeoutMs,
        minPriority: this.config.minPriority,
        dryRun: this.config.dryRun,
      });

      const statusValue = this.status.running
        ? this.status.paused
          ? "paused"
          : "running"
        : "stopped";

      await run(
        `
        INSERT OR REPLACE INTO executor_state (
          id, task_list_path, status, config_json, total_tasks,
          completed_tasks, failed_tasks, skipped_tasks, current_task_id,
          started_at, paused_at, stopped_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
        [
          this.executorStateId,
          this.config.taskListPath,
          statusValue,
          configJson,
          this.status.totalTasks,
          this.status.completedTasks,
          this.status.failedTasks,
          this.status.skippedTasks,
          this.status.currentTask?.id || null,
          this.status.running ? new Date().toISOString() : null,
          this.status.paused ? new Date().toISOString() : null,
          !this.status.running ? new Date().toISOString() : null,
        ],
      );
    } catch (error) {
      console.error("[TaskExecutor] Error persisting executor state:", error);
    }
  }

  /**
   * Update task status in database queue
   */
  private async updateTaskQueueStatus(
    taskId: string,
    status: string,
  ): Promise<void> {
    if (!this.config.taskListPath) return;

    try {
      await run(
        `
        UPDATE task_queue
        SET status = ?,
            updated_at = datetime('now'),
            started_at = CASE WHEN ? = 'running' THEN datetime('now') ELSE started_at END,
            completed_at = CASE WHEN ? IN ('completed', 'failed', 'skipped') THEN datetime('now') ELSE completed_at END
        WHERE task_list_path = ? AND task_id = ?
      `,
        [status, status, status, this.config.taskListPath, taskId],
      );
    } catch (error) {
      console.error("[TaskExecutor] Error updating task queue status:", error);
    }
  }

  /**
   * Start autonomous execution
   */
  async start(): Promise<void> {
    if (this.status.running) {
      console.log("[TaskExecutor] Already running");
      return;
    }

    if (!this.taskList) {
      throw new Error("No task list loaded. Call loadTaskList() first.");
    }

    this.status.running = true;
    this.status.paused = false;

    // Persist state change
    await this.persistExecutorState();

    this.emit("executor:started", {
      taskListPath: this.config.taskListPath,
      pendingTasks: this.executionQueue.length,
    });

    // Send Telegram notification
    this.sendTelegramNotification("executor_started", {
      taskListPath: this.config.taskListPath,
      pendingTasks: this.executionQueue.length,
    });

    // Broadcast via WebSocket
    emitTaskExecutorEvent("executor:started", {
      taskListPath: this.config.taskListPath,
      pendingTasks: this.executionQueue.length,
    });

    console.log(
      `[TaskExecutor] Started execution of ${this.config.taskListPath}`,
    );
    console.log(
      `[TaskExecutor] ${this.executionQueue.length} pending tasks in queue`,
    );

    // Start the execution loop
    this.runExecutionLoop();
  }

  /**
   * Pause execution (completes current task)
   */
  async pause(): Promise<void> {
    this.status.paused = true;
    await this.persistExecutorState();
    this.emit("executor:paused", { reason: "user_requested" });
    console.log("[TaskExecutor] Paused");
  }

  /**
   * Resume execution
   */
  async resume(): Promise<void> {
    if (!this.status.running) {
      console.log("[TaskExecutor] Not running. Call start() instead.");
      return;
    }
    this.status.paused = false;
    await this.persistExecutorState();
    this.emit("executor:resumed");
    console.log("[TaskExecutor] Resumed");
  }

  /**
   * Stop execution
   */
  async stop(): Promise<void> {
    this.status.running = false;
    this.status.paused = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    // Persist state change
    await this.persistExecutorState();

    this.emit("executor:stopped", {
      completedTasks: this.status.completedTasks,
      failedTasks: this.status.failedTasks,
    });

    console.log("[TaskExecutor] Stopped");
  }

  /**
   * Get current executor status
   */
  getStatus(): ExecutorStatus {
    return { ...this.status };
  }

  /**
   * Get the next task to execute
   */
  getNextTask(): ParsedTask | null {
    if (!this.taskList) return null;

    // Filter by minimum priority
    const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
    const maxPriorityIndex = priorityOrder[this.config.minPriority];

    const eligibleTasks = this.executionQueue.filter(
      (t) => priorityOrder[t.priority] <= maxPriorityIndex,
    );

    return eligibleTasks[0] || null;
  }

  /**
   * Execute a single task
   */
  async executeTask(task: ParsedTask): Promise<TaskExecution> {
    const executionId = `exec-${Date.now()}-${task.id}`;
    const execution: TaskExecution = {
      id: executionId,
      taskId: task.id,
      taskListPath: this.config.taskListPath,
      status: "running",
      startedAt: new Date().toISOString(),
      attempts: 0,
      assignedAgent: this.getAgentForTask(task),
    };

    this.activeExecutions.set(executionId, execution);
    this.status.currentTask = task;

    this.emit("task:started", {
      taskId: task.id,
      executionId,
      description: task.description,
      priority: task.priority,
      agent: execution.assignedAgent,
    });

    // Send Telegram notification
    this.sendTelegramNotification("started", {
      taskId: task.id,
      description: task.description,
      agent: execution.assignedAgent,
      priority: task.priority,
    });

    // Broadcast via WebSocket
    emitTaskExecutorEvent("task:started", {
      taskId: task.id,
      description: task.description,
      agent: execution.assignedAgent,
      priority: task.priority,
      status: "running",
    });

    // Update markdown file to mark as in_progress
    if (!this.config.dryRun) {
      updateMarkdownStatus(this.config.taskListPath, task.id, "in_progress");
      // Update database queue status
      await this.updateTaskQueueStatus(task.id, "running");
      await this.persistExecutorState();
    }

    // Start progress reporting interval
    const progressInterval = setInterval(() => {
      const elapsedMs = Date.now() - new Date(execution.startedAt).getTime();
      emitTaskExecutorEvent("task:progress", {
        taskId: task.id,
        executionId,
        status: "running",
        elapsedMs,
        description: task.description,
      });
    }, 30000); // Report progress every 30 seconds

    try {
      // Execute the task with timeout enforcement
      const timeoutPromise = new Promise<TaskResult>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Task execution timed out after ${this.config.executionTimeoutMs}ms`,
            ),
          );
        }, this.config.executionTimeoutMs);
      });

      const result = await Promise.race([
        this.performTaskExecution(task, execution),
        timeoutPromise,
      ]);

      clearInterval(progressInterval);
      execution.status = result.success ? "completed" : "failed";
      execution.output = result.output;
      execution.error = result.error;
      execution.completedAt = new Date().toISOString();

      // Update markdown file
      if (!this.config.dryRun) {
        updateMarkdownStatus(
          this.config.taskListPath,
          task.id,
          result.success ? "complete" : "pending",
        );
        // Update database queue status
        await this.updateTaskQueueStatus(
          task.id,
          result.success ? "completed" : "failed",
        );
      }

      // Record in database
      await this.recordExecution(execution);

      if (result.success) {
        this.status.completedTasks++;
        // Remove from queue
        this.executionQueue = this.executionQueue.filter(
          (t) => t.id !== task.id,
        );
        // Persist updated queue to database
        await this.persistQueueToDatabase();

        this.emit("task:completed", {
          taskId: task.id,
          executionId,
          output: result.output,
        });

        // Send Telegram notification
        this.sendTelegramNotification("completed", {
          taskId: task.id,
          output: result.output,
        });

        // Broadcast via WebSocket
        emitTaskExecutorEvent("task:completed", {
          taskId: task.id,
          output: result.output,
          status: "completed",
          completedTasks: this.status.completedTasks,
          totalTasks: this.status.totalTasks,
          pendingTasks: this.executionQueue.length,
        });
      } else {
        this.status.failedTasks++;
        execution.attempts++;

        if (execution.attempts < this.config.retryAttempts) {
          // Will retry
          this.emit("task:retry", {
            taskId: task.id,
            executionId,
            attempt: execution.attempts,
            error: result.error,
          });
        } else {
          // Max retries exceeded
          this.emit("task:failed", {
            taskId: task.id,
            executionId,
            error: result.error,
            attempts: execution.attempts,
          });

          // Send Telegram notification
          this.sendTelegramNotification("failed", {
            taskId: task.id,
            error: result.error,
            attempts: execution.attempts,
          });

          // Broadcast via WebSocket
          emitTaskExecutorEvent("task:failed", {
            taskId: task.id,
            error: result.error,
            attempts: execution.attempts,
            status: "failed",
            failedTasks: this.status.failedTasks,
          });
        }
      }
    } catch (err) {
      clearInterval(progressInterval);
      execution.status = "failed";
      execution.error = err instanceof Error ? err.message : "Unknown error";
      execution.completedAt = new Date().toISOString();

      // Emit timeout or error event
      const isTimeout = execution.error.includes("timed out");
      emitTaskExecutorEvent(isTimeout ? "task:timeout" : "task:error", {
        taskId: task.id,
        executionId,
        error: execution.error,
        status: "failed",
      });

      this.emit("task:error", {
        taskId: task.id,
        executionId,
        error: execution.error,
      });
    } finally {
      this.activeExecutions.delete(executionId);
      this.status.currentTask = undefined;
      this.status.executionHistory.push(execution);
    }

    return execution;
  }

  /**
   * Main execution loop
   */
  private async runExecutionLoop(): Promise<void> {
    while (this.status.running) {
      // Check if paused
      if (this.status.paused) {
        await this.sleep(1000);
        continue;
      }

      // Check concurrent limit
      if (this.activeExecutions.size >= this.config.maxConcurrent) {
        await this.sleep(1000);
        continue;
      }

      // Get next task
      const nextTask = this.getNextTask();
      if (!nextTask) {
        // No more tasks
        this.emit("executor:complete", {
          completed: this.status.completedTasks,
          failed: this.status.failedTasks,
        });

        // Send Telegram notification
        this.sendTelegramNotification("executor_complete", {
          completed: this.status.completedTasks,
          failed: this.status.failedTasks,
        });

        // Broadcast via WebSocket
        emitTaskExecutorEvent("executor:complete", {
          completedTasks: this.status.completedTasks,
          failedTasks: this.status.failedTasks,
        });

        this.stop();
        break;
      }

      // Execute the task
      await this.executeTask(nextTask);

      // Small delay between tasks
      await this.sleep(500);
    }
  }

  /**
   * Perform the actual task execution using AgentRunner
   */
  private async performTaskExecution(
    task: ParsedTask,
    execution: TaskExecution,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    console.log(
      `[TaskExecutor] Executing task ${task.id}: ${task.description}`,
    );

    if (this.config.dryRun) {
      console.log(
        `[TaskExecutor] DRY RUN - Would execute: ${task.description}`,
      );
      return {
        success: true,
        output: `DRY RUN: Task ${task.id} would be executed`,
      };
    }

    // Start tracking execution with result collector
    const buildId = "autonomous-" + Date.now();
    const agentType = execution.assignedAgent || this.getAgentForTask(task);

    await this.resultCollector.startExecution(
      task,
      this.config.taskListPath,
      buildId,
      agentType,
    );

    // Emit event that task is starting
    this.emit("task:execute", {
      taskId: task.id,
      description: task.description,
      agent: agentType,
      section: task.section,
    });

    try {
      // Get the appropriate agent runner
      const runner = await getAgentRunner(agentType);

      // Set task list context for Telegram message identification
      const taskListName =
        this.config.taskListPath.split("/").pop() || this.config.taskListPath;
      runner.setTaskListContext({
        projectName: this.taskList?.title || "Unknown Project",
        projectSlug: taskListName
          .replace(/\.md$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
        taskListName: taskListName,
      });

      console.log(
        `[TaskExecutor] Running task ${task.id} with agent ${runner.getAgentId()}`,
      );

      // Actually execute the task using the AgentRunner (this waits for completion)
      const result = await runner.executeTask(task);

      // Record completion in result collector
      await this.resultCollector.recordCompletion(execution.id, result);

      // Log execution details
      console.log(`[TaskExecutor] Task ${task.id} result:`, {
        success: result.success,
        questionsAsked: result.questionsAsked,
        tokensUsed: result.tokensUsed,
        filesModified: result.filesModified,
      });

      if (result.success) {
        return {
          success: true,
          output: result.output || `Task ${task.id} completed successfully`,
        };
      } else {
        return {
          success: false,
          error: result.error || "Unknown error during execution",
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[TaskExecutor] Error executing task ${task.id}:`, error);

      // Record failure in result collector
      await this.resultCollector.recordFailure(
        execution.id,
        errorMessage,
        false,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the appropriate agent for a task
   */
  private getAgentForTask(task: ParsedTask): string {
    const prefix = task.id.split("-")[0];
    return AGENT_MAPPING[prefix] || "build-agent";
  }

  /**
   * Record execution in database
   */
  private async recordExecution(execution: TaskExecution): Promise<void> {
    try {
      await run(
        `
        UPDATE task_executions
        SET status = ?, completed_at = ?, error = ?, output = ?
        WHERE id = ?
      `,
        [
          execution.status === "completed" ? "complete" : "failed",
          execution.completedAt ?? null,
          execution.error ?? null,
          execution.output ?? null,
          execution.id,
        ],
      );
    } catch (e) {
      // Table may not exist
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Escape special characters for Telegram Markdown
   */
  private escapeMarkdown(text: string): string {
    if (typeof text !== "string") return String(text || "");
    return text.replace(/[_*]/g, "\\$&");
  }

  /**
   * Send Telegram notification for task events
   */
  private async sendTelegramNotification(
    type:
      | "started"
      | "completed"
      | "failed"
      | "executor_started"
      | "executor_complete",
    data: Record<string, unknown>,
  ): Promise<void> {
    console.log(`[TaskExecutor] Sending Telegram notification: ${type}`);

    if (!this.notificationsEnabled) {
      console.log("[TaskExecutor] Notifications disabled, skipping");
      return;
    }

    const testChatId = process.env.TELEGRAM_TEST_CHAT_ID;
    if (!testChatId) {
      console.log(
        "[TaskExecutor] TELEGRAM_TEST_CHAT_ID not set, skipping notification",
      );
      return;
    }

    const botToken = getBotToken("monitoring");
    if (!botToken) {
      console.log(
        "[TaskExecutor] No monitoring bot token configured, skipping notification",
      );
      return;
    }
    console.log(`[TaskExecutor] Sending to chat ${testChatId}`);

    // Helper to safely escape markdown in dynamic content
    const esc = (val: unknown) => this.escapeMarkdown(String(val || ""));

    // Get task list context for project identification
    const projectHeader = this.taskList?.title
      ? `📦 *${esc(this.taskList.title)}* | 📋 ${esc(this.config.taskListPath.split("/").pop())}\n\n`
      : "";

    let emoji: string;
    let title: string;
    let body: string;

    switch (type) {
      case "started":
        emoji = "🚀";
        title = "Task Started";
        body = `*Task:* \`${data.taskId}\`\n*Description:* ${esc(data.description)}\n*Agent:* ${esc(data.agent)}\n*Priority:* ${data.priority}`;
        break;
      case "completed":
        emoji = "✅";
        title = "Task Completed";
        body = `*Task:* \`${data.taskId}\`\n*Output:* ${esc(data.output || "Success")}`;
        break;
      case "failed":
        emoji = "❌";
        title = "Task Failed";
        body = `*Task:* \`${data.taskId}\`\n*Error:* ${esc(data.error)}\n*Attempts:* ${data.attempts}`;
        break;
      case "executor_started":
        emoji = "▶️";
        title = "Executor Started";
        body = `*Task List:* ${esc(data.taskListPath)}\n*Pending Tasks:* ${data.pendingTasks}`;
        break;
      case "executor_complete":
        emoji = "🏁";
        title = "Executor Complete";
        body = `*Completed:* ${data.completed}\n*Failed:* ${data.failed}`;
        break;
      default:
        return;
    }

    const text = `${projectHeader}${emoji} *${title}*\n\n${body}`;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: testChatId,
            text,
            parse_mode: "Markdown",
          }),
        },
      );

      const result = await response.json();
      if (result.ok) {
        console.log(
          `[TaskExecutor] Telegram notification sent (messageId: ${result.result?.message_id})`,
        );
      } else {
        console.error(
          "[TaskExecutor] Telegram notification failed:",
          result.description,
        );
      }
    } catch (error) {
      console.error(
        "[TaskExecutor] Failed to send Telegram notification:",
        error,
      );
    }
  }

  /**
   * Enable or disable notifications
   */
  setNotificationsEnabled(enabled: boolean): void {
    this.notificationsEnabled = enabled;
  }

  /**
   * Skip a task
   */
  async skipTask(taskId: string): Promise<void> {
    this.executionQueue = this.executionQueue.filter((t) => t.id !== taskId);
    this.status.skippedTasks++;

    // Update database - just update status, don't call persistQueueToDatabase
    // as that would delete the row we just updated
    await this.updateTaskQueueStatus(taskId, "skipped");

    this.emit("task:skipped", { taskId });
  }

  /**
   * Requeue a failed task
   */
  async requeueTask(taskId: string): Promise<void> {
    if (!this.taskList) return;

    const task = this.taskList.tasks.find((t) => t.id === taskId);
    if (task && !this.executionQueue.find((t) => t.id === taskId)) {
      this.executionQueue.push(task);
      this.executionQueue.sort((a, b) => {
        const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Update database
      await this.updateTaskQueueStatus(taskId, "queued");
      await this.persistQueueToDatabase();

      this.emit("task:requeued", { taskId });
    }
  }

  /**
   * Wait for a specific task execution to complete
   * Useful for external monitoring or testing
   */
  async waitForTaskCompletion(
    executionId: string,
    timeoutMs?: number,
  ): Promise<any> {
    return this.resultCollector.waitForCompletion(executionId, timeoutMs);
  }

  /**
   * Get execution metrics
   */
  async getExecutionMetrics(buildId?: string): Promise<any> {
    return this.resultCollector.getMetrics(buildId);
  }

  /**
   * Get execution history for a specific task
   */
  async getTaskExecutionHistory(taskId: string): Promise<any[]> {
    return this.resultCollector.getExecutionsByTaskId(taskId);
  }

  /**
   * Get all executions for current build
   */
  async getBuildExecutions(buildId: string): Promise<any[]> {
    return this.resultCollector.getExecutionsByBuildId(buildId);
  }

  /**
   * Get result collector instance (for advanced usage)
   */
  getResultCollector(): TaskResultCollector {
    return this.resultCollector;
  }
}

// Singleton executor instance
let executorInstance: TaskExecutor | null = null;

export function getTaskExecutor(): TaskExecutor {
  if (!executorInstance) {
    executorInstance = new TaskExecutor();
  }
  return executorInstance;
}

export function createTaskExecutor(
  config?: Partial<ExecutionConfig>,
): TaskExecutor {
  executorInstance = new TaskExecutor(config);
  return executorInstance;
}
