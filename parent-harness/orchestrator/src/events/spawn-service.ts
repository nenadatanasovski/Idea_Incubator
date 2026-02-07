/**
 * Spawn Service - Handles agent spawning with backpressure
 * 
 * Decoupled from tick loop. Reacts to events:
 * - 'task:pending' - Consider spawning an agent
 * - 'agent:idle' - Agent available, check for work
 * - Respects CPU/memory limits before spawning
 * 
 * This is Phase 4 of the event-driven architecture.
 */

import { bus } from './bus.js';
import { transitionTask } from './task-state-machine.js';
import * as spawner from '../spawner/index.js';
import * as agents from '../db/agents.js';
import * as tasks from '../db/tasks.js';
import * as config from '../config/index.js';
import type { Task } from '../db/tasks.js';
import type { Agent } from '../db/agents.js';

interface SpawnRequest {
  task: Task;
  priority: number;
  addedAt: Date;
}

class SpawnService {
  private queue: SpawnRequest[] = [];
  private processing = false;
  private enabled = true;
  private cpuOk = true;
  private memoryOk = true;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Subscribe to relevant events
   */
  private setupEventListeners(): void {
    // When a task becomes pending, consider it for spawning
    bus.on('task:pending', ({ task }) => {
      this.considerTask(task);
    });

    // When an agent becomes idle, check for work
    bus.on('agent:idle', ({ agent }) => {
      this.processQueue();
    });

    // Backpressure: pause on high CPU
    bus.on('system:cpu_high', ({ usage }) => {
      console.log(`🚀 Spawn Service: Pausing (CPU at ${usage}%)`);
      this.cpuOk = false;
    });

    bus.on('system:cpu_normal', () => {
      console.log('🚀 Spawn Service: CPU normalized, resuming');
      this.cpuOk = true;
      this.processQueue();
    });

    // Backpressure: pause on high memory
    bus.on('system:memory_high', ({ usage }) => {
      console.log(`🚀 Spawn Service: Pausing (Memory at ${usage}%)`);
      this.memoryOk = false;
    });

    bus.on('system:memory_normal', () => {
      console.log('🚀 Spawn Service: Memory normalized, resuming');
      this.memoryOk = true;
      this.processQueue();
    });

    // Budget exceeded: stop spawning
    bus.on('budget:exceeded', () => {
      console.log('🚀 Spawn Service: Budget exceeded, stopping');
      this.enabled = false;
    });

    bus.on('budget:reset', () => {
      console.log('🚀 Spawn Service: Budget reset, resuming');
      this.enabled = true;
      this.processQueue();
    });

    // System shutdown
    bus.on('system:shutdown', () => {
      this.enabled = false;
    });
  }

  /**
   * Consider a task for spawning
   */
  considerTask(task: Task): void {
    // Skip if already in queue
    if (this.queue.some(r => r.task.id === task.id)) {
      return;
    }

    // Calculate priority (P0 = 100, P1 = 50, P2 = 25)
    const priorityMap: Record<string, number> = { P0: 100, P1: 50, P2: 25 };
    const priority = priorityMap[task.priority || 'P2'] || 25;

    this.queue.push({
      task,
      priority,
      addedAt: new Date(),
    });

    // Sort by priority (higher first)
    this.queue.sort((a, b) => b.priority - a.priority);

    console.log(`🚀 Spawn Service: Queued ${task.display_id} (priority: ${priority}, queue: ${this.queue.length})`);

    this.processQueue();
  }

  /**
   * Check if spawning is allowed
   */
  private canSpawn(): boolean {
    if (!this.enabled) return false;
    if (!this.cpuOk) return false;
    if (!this.memoryOk) return false;

    // Check concurrent agent limit
    const cfg = config.getConfig();
    const workingAgents = agents.getWorkingAgents();
    if (workingAgents.length >= cfg.agents.max_concurrent) {
      return false;
    }

    return true;
  }

  /**
   * Find best agent for a task
   */
  private findAgentForTask(task: Task): Agent | null {
    const idleAgents = agents.getIdleAgents();
    if (idleAgents.length === 0) return null;

    // Prefer agent types that match task category
    const categoryToType: Record<string, string> = {
      feature: 'build',
      bug: 'build',
      improvement: 'build',
      spec: 'spec',
      research: 'research',
    };

    const preferredType = categoryToType[task.category || 'feature'] || 'build';
    
    // Try to find preferred type first
    let agent = idleAgents.find(a => a.type === preferredType);
    
    // Fall back to any idle build agent
    if (!agent) {
      agent = idleAgents.find(a => a.type === 'build');
    }

    // Fall back to any idle agent
    if (!agent) {
      agent = idleAgents[0];
    }

    return agent || null;
  }

  /**
   * Process the spawn queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) return;
    if (!this.canSpawn()) return;

    this.processing = true;

    while (this.queue.length > 0 && this.canSpawn()) {
      const request = this.queue[0];
      const agent = this.findAgentForTask(request.task);

      if (!agent) {
        // No agent available, stop processing
        break;
      }

      // Remove from queue
      this.queue.shift();

      // Spawn the agent
      try {
        console.log(`🚀 Spawn Service: Spawning ${agent.name} for ${request.task.display_id}`);
        
        // Update heartbeat BEFORE transition to prevent stuck detection race condition
        agents.updateHeartbeat(agent.id);
        
        // Transition task to in_progress
        transitionTask(request.task.id, 'in_progress', { agentId: agent.id });

        // Actually spawn
        const result = await spawner.spawnAgentSession({
          taskId: request.task.id,
          agentId: agent.id,
          model: config.getConfig().agents.model,
        });

        if (!result.success) {
          console.log(`🚀 Spawn Service: Spawn failed - ${result.error}`);
          // Transition back to pending for retry
          transitionTask(request.task.id, 'failed', { error: result.error });
        }
      } catch (err) {
        console.error(`🚀 Spawn Service: Error spawning for ${request.task.display_id}:`, err);
        transitionTask(request.task.id, 'failed', { 
          error: err instanceof Error ? err.message : 'Spawn error' 
        });
      }
    }

    this.processing = false;
  }

  /**
   * Get service status
   */
  getStatus(): {
    queueSize: number;
    processing: boolean;
    enabled: boolean;
    canSpawn: boolean;
    cpuOk: boolean;
    memoryOk: boolean;
  } {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      enabled: this.enabled,
      canSpawn: this.canSpawn(),
      cpuOk: this.cpuOk,
      memoryOk: this.memoryOk,
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
   * Get queue contents
   */
  getQueue(): SpawnRequest[] {
    return [...this.queue];
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = [];
  }
}

// Singleton instance
export const spawnService = new SpawnService();

export default spawnService;
