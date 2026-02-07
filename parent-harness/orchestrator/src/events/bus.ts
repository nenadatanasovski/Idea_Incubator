/**
 * Event Bus - Central event-driven architecture for the harness
 * 
 * Replaces polling with reactive events:
 * - Components emit events when state changes
 * - Other components subscribe to events they care about
 * - No more "check everything every 30 seconds"
 * 
 * This is Phase 1 of the architectural shift.
 */

import { EventEmitter } from 'events';
import type { Task } from '../db/tasks.js';
import type { Agent } from '../db/agents.js';

// ============ EVENT TYPES ============

export interface TaskEvents {
  // Lifecycle events
  'task:created': { task: Task };
  'task:updated': { task: Task; changes: Partial<Task> };
  'task:deleted': { taskId: string };
  
  // State transition events
  'task:pending': { task: Task };
  'task:assigned': { task: Task; agentId: string };
  'task:started': { task: Task; agentId: string; sessionId: string };
  'task:completed': { task: Task; output?: string };
  'task:failed': { task: Task; error: string };
  'task:blocked': { task: Task; reason: string };
  
  // QA events (triggers QA agent)
  'task:ready_for_qa': { task: Task };
  'task:qa_passed': { task: Task };
  'task:qa_failed': { task: Task; failures: string[] };
}

export interface AgentEvents {
  'agent:registered': { agent: Agent };
  'agent:idle': { agent: Agent };
  'agent:working': { agent: Agent; taskId: string };
  'agent:stuck': { agent: Agent; reason: string };
  'agent:heartbeat': { agentId: string; timestamp: Date };
  'agent:rate_limited': { agentId: string; model: string };
}

export interface SessionEvents {
  'session:started': { sessionId: string; agentId: string; taskId: string };
  'session:output': { sessionId: string; chunk: string };
  'session:completed': { sessionId: string; output: string };
  'session:failed': { sessionId: string; error: string };
  'session:timeout': { sessionId: string };
}

export interface SystemEvents {
  'system:startup': { timestamp: Date };
  'system:shutdown': { reason: string };
  'system:error': { source: string; error: Error };
  
  // Resource events (for backpressure)
  'system:cpu_high': { usage: number; threshold: number };
  'system:cpu_normal': { usage: number };
  'system:memory_high': { usage: number; threshold: number };
  'system:memory_normal': { usage: number };
  
  // Budget events
  'budget:warning': { percent: number; threshold: number };
  'budget:exceeded': { current: number; limit: number };
  'budget:reset': {};
}

export interface ScheduleEvents {
  'schedule:planning_due': {};
  'schedule:qa_due': {};
  'schedule:cleanup_due': {};
  'schedule:crown_due': {};
}

// Combined event map
export interface HarnessEvents extends TaskEvents, AgentEvents, SessionEvents, SystemEvents, ScheduleEvents {}

// Event names as union type
export type HarnessEventName = keyof HarnessEvents;

// ============ TYPED EVENT BUS ============

class TypedEventBus {
  private emitter = new EventEmitter();
  private eventCounts = new Map<string, number>();
  private listeners = new Map<string, number>();
  
  constructor() {
    // Increase max listeners for production use
    this.emitter.setMaxListeners(100);
  }

  /**
   * Emit a typed event
   */
  emit<K extends HarnessEventName>(event: K, data: HarnessEvents[K]): boolean {
    // Track event counts for metrics
    const count = this.eventCounts.get(event) || 0;
    this.eventCounts.set(event, count + 1);
    
    console.log(`📡 Event: ${event}`, JSON.stringify(data).slice(0, 200));
    return this.emitter.emit(event, data);
  }

  /**
   * Subscribe to a typed event
   */
  on<K extends HarnessEventName>(event: K, handler: (data: HarnessEvents[K]) => void): this {
    const count = this.listeners.get(event) || 0;
    this.listeners.set(event, count + 1);
    
    this.emitter.on(event, handler);
    return this;
  }

  /**
   * Subscribe to a typed event (once)
   */
  once<K extends HarnessEventName>(event: K, handler: (data: HarnessEvents[K]) => void): this {
    this.emitter.once(event, handler);
    return this;
  }

  /**
   * Unsubscribe from a typed event
   */
  off<K extends HarnessEventName>(event: K, handler: (data: HarnessEvents[K]) => void): this {
    const count = this.listeners.get(event) || 0;
    this.listeners.set(event, Math.max(0, count - 1));
    
    this.emitter.off(event, handler);
    return this;
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends HarnessEventName>(event?: K): this {
    if (event) {
      this.listeners.set(event, 0);
    } else {
      this.listeners.clear();
    }
    this.emitter.removeAllListeners(event);
    return this;
  }

  /**
   * Get event statistics
   */
  getStats(): { eventCounts: Record<string, number>; listenerCounts: Record<string, number> } {
    return {
      eventCounts: Object.fromEntries(this.eventCounts),
      listenerCounts: Object.fromEntries(this.listeners),
    };
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends HarnessEventName>(event: K): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Wait for an event (Promise-based)
   */
  waitFor<K extends HarnessEventName>(event: K, timeoutMs?: number): Promise<HarnessEvents[K]> {
    return new Promise((resolve, reject) => {
      const handler = (data: HarnessEvents[K]) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(data);
      };

      let timeoutId: NodeJS.Timeout | undefined;
      if (timeoutMs) {
        timeoutId = setTimeout(() => {
          this.off(event, handler);
          reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeoutMs);
      }

      this.once(event, handler);
    });
  }
}

// ============ SINGLETON INSTANCE ============

export const bus = new TypedEventBus();

// ============ CONVENIENCE FUNCTIONS ============

/**
 * Emit task state change
 */
export function emitTaskState(task: Task, previousStatus?: string): void {
  const status = task.status;
  
  switch (status) {
    case 'pending':
      bus.emit('task:pending', { task });
      break;
    case 'in_progress':
      if (task.assigned_agent_id) {
        bus.emit('task:started', { 
          task, 
          agentId: task.assigned_agent_id,
          sessionId: '' // Will be set by spawner
        });
      }
      break;
    case 'pending_verification':
      bus.emit('task:ready_for_qa', { task });
      break;
    case 'completed':
      bus.emit('task:completed', { task });
      break;
    case 'failed':
      bus.emit('task:failed', { task, error: 'Task failed' });
      break;
    case 'blocked':
      bus.emit('task:blocked', { task, reason: 'Blocked by dependencies or retries' });
      break;
  }
}

/**
 * Emit agent state change
 */
export function emitAgentState(agent: Agent): void {
  const status = agent.status;
  
  switch (status) {
    case 'idle':
      bus.emit('agent:idle', { agent });
      break;
    case 'working':
      if (agent.current_task_id) {
        bus.emit('agent:working', { agent, taskId: agent.current_task_id });
      }
      break;
    case 'stuck':
      bus.emit('agent:stuck', { agent, reason: 'No heartbeat' });
      break;
  }
}

export default bus;
