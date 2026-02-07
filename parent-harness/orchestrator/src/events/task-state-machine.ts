/**
 * Task State Machine
 * 
 * Validates state transitions and emits events.
 * Ensures tasks can only move through valid state progressions.
 * 
 * Valid transitions:
 * pending -> in_progress -> pending_verification -> completed
 *                       \-> failed -> pending (retry)
 *                       \-> blocked (manual intervention needed)
 */

import { bus } from './bus.js';
import * as tasks from '../db/tasks.js';
import type { Task } from '../db/tasks.js';
import * as stateHistory from '../db/state-history.js';

// Valid task states
export type TaskState = 
  | 'pending'
  | 'in_progress'
  | 'pending_verification'
  | 'completed'
  | 'failed'
  | 'blocked';

// Valid state transitions
const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  pending: ['in_progress', 'blocked'],
  in_progress: ['pending_verification', 'failed', 'blocked'],
  pending_verification: ['completed', 'failed'],
  completed: [], // Terminal state
  failed: ['pending', 'blocked'], // Can retry or block
  blocked: ['pending'], // Can unblock
};

export interface TransitionResult {
  success: boolean;
  previousState: TaskState;
  newState: TaskState;
  error?: string;
}

export interface TransitionContext {
  agentId?: string;
  sessionId?: string;
  output?: string;
  error?: string;
  reason?: string;
  failures?: string[];
}

/**
 * Check if a transition is valid
 */
export function isValidTransition(from: TaskState, to: TaskState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

/**
 * Transition a task to a new state with validation and event emission
 */
export function transitionTask(
  taskId: string,
  toState: TaskState,
  context: TransitionContext = {}
): TransitionResult {
  const task = tasks.getTask(taskId);
  if (!task) {
    return {
      success: false,
      previousState: 'pending',
      newState: toState,
      error: 'Task not found',
    };
  }

  const fromState = task.status as TaskState;

  // Validate transition
  if (!isValidTransition(fromState, toState)) {
    console.warn(`⚠️ Invalid transition: ${fromState} -> ${toState} for task ${task.display_id}`);
    return {
      success: false,
      previousState: fromState,
      newState: toState,
      error: `Invalid transition from ${fromState} to ${toState}`,
    };
  }

  // Perform the transition
  const updateData: Partial<Task> = { status: toState };
  
  if (context.agentId) {
    updateData.assigned_agent_id = context.agentId;
  }

  tasks.updateTask(taskId, updateData);
  const updatedTask = tasks.getTask(taskId)!;

  // Log the state transition to history
  try {
    const actorType = context.agentId ? 'agent' : 'system';
    const changedBy = context.agentId || 'system';
    
    stateHistory.logStateTransition({
      task_id: taskId,
      from_status: fromState,
      to_status: toState,
      changed_by: changedBy,
      actor_type: actorType,
      reason: context.reason || context.error,
      metadata: {
        sessionId: context.sessionId,
        output: context.output?.slice(0, 500),  // Truncate for storage
        failures: context.failures,
      },
    });
  } catch (err) {
    console.warn('Failed to log state transition:', err);
  }

  // Emit appropriate events
  emitTransitionEvents(updatedTask, fromState, toState, context);

  console.log(`🔄 Task ${task.display_id}: ${fromState} -> ${toState}`);

  return {
    success: true,
    previousState: fromState,
    newState: toState,
  };
}

/**
 * Emit events for a state transition
 */
function emitTransitionEvents(
  task: Task,
  fromState: TaskState,
  toState: TaskState,
  context: TransitionContext
): void {
  // Always emit the generic update event
  bus.emit('task:updated', { 
    task, 
    changes: { status: toState } 
  });

  // Emit specific state events
  switch (toState) {
    case 'pending':
      bus.emit('task:pending', { task });
      break;

    case 'in_progress':
      if (context.agentId && context.sessionId) {
        bus.emit('task:started', {
          task,
          agentId: context.agentId,
          sessionId: context.sessionId,
        });
      } else if (context.agentId) {
        bus.emit('task:assigned', {
          task,
          agentId: context.agentId,
        });
      }
      break;

    case 'pending_verification':
      // This is the key event that triggers QA
      bus.emit('task:ready_for_qa', { task });
      break;

    case 'completed':
      bus.emit('task:completed', { 
        task, 
        output: context.output 
      });
      
      // Also emit QA passed if coming from verification
      if (fromState === 'pending_verification') {
        bus.emit('task:qa_passed', { task });
      }
      break;

    case 'failed':
      bus.emit('task:failed', { 
        task, 
        error: context.error || 'Unknown error' 
      });
      
      // If coming from QA, emit QA failed
      if (fromState === 'pending_verification') {
        bus.emit('task:qa_failed', { 
          task, 
          failures: context.failures || [context.error || 'QA failed'] 
        });
      }
      break;

    case 'blocked':
      bus.emit('task:blocked', { 
        task, 
        reason: context.reason || 'Task blocked' 
      });
      break;
  }
}

// ============ CONVENIENCE FUNCTIONS ============

/**
 * Start a task (pending -> in_progress)
 */
export function startTask(taskId: string, agentId: string, sessionId: string): TransitionResult {
  return transitionTask(taskId, 'in_progress', { agentId, sessionId });
}

/**
 * Complete agent work (in_progress -> pending_verification)
 */
export function submitForQA(taskId: string, output?: string): TransitionResult {
  return transitionTask(taskId, 'pending_verification', { output });
}

/**
 * QA passed (pending_verification -> completed)
 */
export function completeTask(taskId: string): TransitionResult {
  return transitionTask(taskId, 'completed', {});
}

/**
 * Task failed
 */
export function failTask(taskId: string, error: string): TransitionResult {
  return transitionTask(taskId, 'failed', { error });
}

/**
 * Task blocked (needs human intervention)
 */
export function blockTask(taskId: string, reason: string): TransitionResult {
  return transitionTask(taskId, 'blocked', { reason });
}

/**
 * Retry a failed task (failed -> pending)
 */
export function retryTask(taskId: string): TransitionResult {
  return transitionTask(taskId, 'pending', {});
}

/**
 * Unblock a task (blocked -> pending)
 */
export function unblockTask(taskId: string): TransitionResult {
  return transitionTask(taskId, 'pending', {});
}

export default {
  isValidTransition,
  transitionTask,
  startTask,
  submitForQA,
  completeTask,
  failTask,
  blockTask,
  retryTask,
  unblockTask,
};
