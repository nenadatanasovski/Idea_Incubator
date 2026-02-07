/**
 * Stuck Agent Handler
 * 
 * Reacts to 'agent:stuck' events and resets stuck agents.
 * Re-queues their tasks for retry.
 */

import { bus } from './bus.js';
import { transitionTask } from './task-state-machine.js';
import * as agents from '../db/agents.js';
import * as tasks from '../db/tasks.js';
import { run } from '../db/index.js';

class StuckAgentHandler {
  private handledAgents = new Set<string>();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    bus.on('agent:stuck', async ({ agent, reason }) => {
      // Debounce - don't handle same agent twice in short period
      if (this.handledAgents.has(agent.id)) {
        return;
      }
      this.handledAgents.add(agent.id);
      
      // Clear from debounce set after 5 minutes
      setTimeout(() => {
        this.handledAgents.delete(agent.id);
      }, 5 * 60 * 1000);

      await this.handleStuckAgent(agent, reason);
    });
  }

  private async handleStuckAgent(
    agent: ReturnType<typeof agents.getAgent>,
    reason: string
  ): Promise<void> {
    if (!agent) return;

    console.log(`🔧 Stuck Agent Handler: Resetting ${agent.name}`);

    // Reset agent to idle
    agents.updateAgentStatus(agent.id, 'idle', null, null);
    agents.updateHeartbeat(agent.id);

    // If agent was working on a task, re-queue it
    if (agent.current_task_id) {
      const task = tasks.getTask(agent.current_task_id);
      if (task && task.status === 'in_progress') {
        console.log(`🔧 Stuck Agent Handler: Re-queuing task ${task.display_id}`);
        
        // Increment retry count via raw SQL
        run(`UPDATE tasks SET retry_count = COALESCE(retry_count, 0) + 1 WHERE id = ?`, [task.id]);
        const retryCount = (task.retry_count || 0) + 1;

        // If too many retries, block the task
        if (retryCount >= 5) {
          transitionTask(task.id, 'blocked', { 
            reason: `Stuck 5 times on different agents` 
          });
        } else {
          // First transition to failed, then to pending (in_progress -> pending not valid)
          transitionTask(task.id, 'failed', { error: 'Agent stuck' });
          transitionTask(task.id, 'pending', {});
        }
      }
    }

    // Emit agent now idle
    bus.emit('agent:idle', { agent: agents.getAgent(agent.id)! });

    console.log(`🔧 Stuck Agent Handler: ${agent.name} reset to idle`);
  }

  getHandledCount(): number {
    return this.handledAgents.size;
  }
}

// Singleton
export const stuckAgentHandler = new StuckAgentHandler();

export default stuckAgentHandler;
