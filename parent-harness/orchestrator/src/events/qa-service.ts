/**
 * Event-Driven QA Service
 *
 * Instead of polling every N ticks, QA now:
 * 1. Subscribes to 'task:ready_for_qa' events
 * 2. Queues tasks for verification
 * 3. Processes queue with concurrency control
 * 4. Emits 'task:qa_passed' or 'task:qa_failed'
 *
 * This is Phase 3 of the event-driven architecture.
 */

import { bus } from "./bus.js";
import { transitionTask } from "./task-state-machine.js";
import * as qa from "../qa/index.js";
import * as agents from "../db/agents.js";
import type { Task } from "../db/tasks.js";

interface QueuedTask {
  task: Task;
  addedAt: Date;
  attempts: number;
}

class QAService {
  private queue: QueuedTask[] = [];
  private processing = false;
  private maxConcurrent = 1; // Only one QA at a time
  private activeCount = 0;
  private enabled = true;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Subscribe to relevant events
   */
  private setupEventListeners(): void {
    // When a task is ready for QA, add it to the queue
    bus.on("task:ready_for_qa", ({ task }) => {
      console.log(
        `✅ QA Service: Task ${task.display_id} ready for verification`,
      );
      this.enqueue(task);
    });

    // Listen for system events that might affect processing
    bus.on("system:shutdown", () => {
      this.enabled = false;
      console.log("✅ QA Service: Shutting down");
    });

    // React to CPU high events (backpressure)
    bus.on("system:cpu_high", () => {
      console.log("✅ QA Service: Pausing due to high CPU");
      this.enabled = false;
    });

    bus.on("system:cpu_normal", () => {
      console.log("✅ QA Service: Resuming after CPU normalized");
      this.enabled = true;
      this.processQueue();
    });
  }

  /**
   * Add a task to the QA queue
   */
  enqueue(task: Task): void {
    // Check if already in queue
    if (this.queue.some((q) => q.task.id === task.id)) {
      console.log(`✅ QA Service: Task ${task.display_id} already in queue`);
      return;
    }

    this.queue.push({
      task,
      addedAt: new Date(),
      attempts: 0,
    });

    console.log(
      `✅ QA Service: Queued ${task.display_id} (queue size: ${this.queue.length})`,
    );

    // Start processing if not already
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process the QA queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || !this.enabled) return;
    if (this.queue.length === 0) return;
    if (this.activeCount >= this.maxConcurrent) return;

    this.processing = true;

    while (
      this.queue.length > 0 &&
      this.enabled &&
      this.activeCount < this.maxConcurrent
    ) {
      const queued = this.queue.shift();
      if (!queued) break;

      this.activeCount++;

      try {
        await this.verifyTask(queued);
      } catch (err) {
        console.error(
          `✅ QA Service: Error verifying ${queued.task.display_id}:`,
          err,
        );

        // Re-queue with incremented attempts if under limit
        if (queued.attempts < 3) {
          queued.attempts++;
          this.queue.push(queued);
        }
      }

      this.activeCount--;
    }

    this.processing = false;
  }

  /**
   * Run QA verification on a task
   */
  private async verifyTask(queued: QueuedTask): Promise<void> {
    const { task } = queued;
    console.log(`✅ QA Service: Verifying ${task.display_id}...`);

    // Update QA agent status
    const qaAgent = agents.getAgent("qa_agent");
    if (qaAgent) {
      agents.updateAgentStatus("qa_agent", "working", task.id, null);
      bus.emit("agent:working", { agent: qaAgent, taskId: task.id });
    }

    try {
      // Run actual QA verification
      const result = await qa.verifyTask(task.id);

      if (result.passed) {
        // Transition to completed
        transitionTask(task.id, "completed", {});
        console.log(`✅ QA Service: ${task.display_id} PASSED`);
      } else {
        // Transition to failed with QA failures
        transitionTask(task.id, "failed", {
          error: result.summary,
          failures: result.checks.filter((c) => !c.passed).map((c) => c.name),
        });
        console.log(
          `✅ QA Service: ${task.display_id} FAILED - ${result.summary}`,
        );
      }
    } finally {
      // Reset QA agent to idle
      if (qaAgent) {
        agents.updateAgentStatus("qa_agent", "idle", null, null);
        bus.emit("agent:idle", { agent: agents.getAgent("qa_agent")! });
      }
    }
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueSize: number;
    processing: boolean;
    enabled: boolean;
    activeCount: number;
  } {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      enabled: this.enabled,
      activeCount: this.activeCount,
    };
  }

  /**
   * Enable/disable the service
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) {
      this.processQueue();
    }
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = [];
  }
}

// Singleton instance
export const qaService = new QAService();

export default qaService;
