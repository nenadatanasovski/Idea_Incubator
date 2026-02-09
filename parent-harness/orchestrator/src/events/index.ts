/**
 * Event-Driven Architecture - Main Entry Point
 * 
 * This replaces the monolithic tick loop with a reactive system:
 * 
 * BEFORE (Polling):
 *   Every 30 seconds:
 *     - Check all pending tasks
 *     - Check all agent states
 *     - Check all timers
 *     - Do everything
 * 
 * AFTER (Event-Driven):
 *   Scanners:
 *     - PendingTaskScanner emits 'task:pending' when work available
 *     - StuckAgentScanner emits 'agent:stuck' when agent needs reset
 *     - PlanningScanner emits 'schedule:planning_due' when time
 *   
 *   Services (react to events):
 *     - SpawnService listens to 'task:pending', spawns agents
 *     - QAService listens to 'task:ready_for_qa', verifies tasks
 *     - Both respect 'system:cpu_high' for backpressure
 *   
 *   ResourceMonitor:
 *     - Checks CPU/memory every 10s
 *     - Emits 'system:cpu_high'/'system:cpu_normal'
 *     - Services pause/resume accordingly
 * 
 * The fundamental shift: React to changes, don't poll everything.
 */

// Core event bus
export { bus, emitTaskState, emitAgentState } from './bus.js';
export type { 
  HarnessEvents, 
  HarnessEventName,
  TaskEvents,
  AgentEvents,
  SessionEvents,
  SystemEvents,
  ScheduleEvents,
} from './bus.js';

// Task state machine
export { 
  transitionTask,
  isValidTransition,
  startTask,
  submitForQA,
  completeTask,
  failTask,
  blockTask,
  retryTask,
  unblockTask,
} from './task-state-machine.js';
export type { TaskState, TransitionResult, TransitionContext } from './task-state-machine.js';

// Services
export { qaService } from './qa-service.js';
export { spawnService } from './spawn-service.js';

// Resource monitoring
export { resourceMonitor } from './resource-monitor.js';
export type { ResourceState } from './resource-monitor.js';

// Scanners
export { 
  pendingTaskScanner,
  stuckAgentScanner,
  planningScanner,
  cleanupScanner,
  startAllScanners,
  stopAllScanners,
  getScannerStatus,
} from './scanners.js';

// Handlers
export { stuckAgentHandler } from './stuck-agent-handler.js';

// ============ INITIALIZATION ============

import { bus } from './bus.js';
import { qaService } from './qa-service.js';
import { spawnService } from './spawn-service.js';
import { resourceMonitor } from './resource-monitor.js';
import { startAllScanners, stopAllScanners } from './scanners.js';
import { stuckAgentHandler } from './stuck-agent-handler.js';
import { startCrown, stopCrown } from '../crown/index.js';
import { createEvent } from '../db/events.js';

let initialized = false;
let observabilityBridgeInstalled = false;

function installObservabilityBridge(): void {
  if (observabilityBridgeInstalled) return;

  bus.on('system:error', ({ source, error }) => {
    createEvent({
      type: 'system:error',
      message: `System error in ${source}: ${error.message}`,
      agentId: source,
      severity: 'error',
      metadata: {
        source,
      },
    });
  });

  observabilityBridgeInstalled = true;
}

/**
 * Initialize the event-driven system
 * Call this instead of starting the old tick loop
 */
export function initEventSystem(): void {
  if (initialized) {
    console.log('⚡ Event system already initialized');
    return;
  }

  console.log('⚡ Initializing event-driven architecture...');

  // Start resource monitoring first (for backpressure)
  resourceMonitor.start();
  installObservabilityBridge();

  // Services auto-subscribe to events in their constructors
  // Just referencing them ensures they're initialized
  console.log('⚡ QA Service:', qaService.getStatus());
  console.log('⚡ Spawn Service:', spawnService.getStatus());
  console.log('⚡ Stuck Agent Handler: active');

  // Start all scanners
  startAllScanners();

  // Start Crown (SIA) monitoring - runs every 10 minutes
  startCrown();

  // Emit startup event
  bus.emit('system:startup', { timestamp: new Date() });

  initialized = true;
  console.log('⚡ Event-driven architecture initialized');
}

/**
 * Shutdown the event-driven system
 */
export function shutdownEventSystem(): void {
  if (!initialized) return;

  console.log('⚡ Shutting down event-driven architecture...');

  // Stop Crown monitoring
  stopCrown();

  // Emit shutdown event (services will react)
  bus.emit('system:shutdown', { reason: 'Manual shutdown' });

  // Stop all scanners
  stopAllScanners();

  // Stop resource monitor
  resourceMonitor.stop();

  // Clear event listeners
  bus.removeAllListeners();

  initialized = false;
  console.log('⚡ Event-driven architecture shut down');
}

/**
 * Get system status
 */
export function getEventSystemStatus() {
  const { getScannerStatus } = require('./scanners.js');
  return {
    initialized,
    qaService: qaService.getStatus(),
    spawnService: spawnService.getStatus(),
    resourceMonitor: resourceMonitor.getState(),
    scanners: getScannerStatus(),
    eventStats: bus.getStats(),
  };
}

// Default export without bus to avoid private property issues
export default {
  initEventSystem,
  shutdownEventSystem,
  getEventSystemStatus,
};
