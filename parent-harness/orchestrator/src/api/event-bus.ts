/**
 * Event Bus API - Real-time observability endpoint
 */

import { Router } from 'express';
import { 
  bus, 
  getEventSystemStatus,
  qaService,
  spawnService,
  resourceMonitor,
  getScannerStatus,
  stuckAgentHandler,
} from '../events/index.js';
import type { HarnessEventName, HarnessEvents } from '../events/bus.js';

export const eventBusRouter = Router();

// Store recent events in memory (ring buffer)
const MAX_EVENTS = 500;
const recentEvents: EventRecord[] = [];

interface EventRecord {
  id: number;
  timestamp: string;
  type: HarnessEventName;
  data: unknown;
  taskId?: string;
  agentId?: string;
  sessionId?: string;
  summary: string;
}

let eventCounter = 0;

// Subscribe to all events and record them
function setupEventRecording() {
  const eventTypes: HarnessEventName[] = [
    'task:created', 'task:updated', 'task:deleted',
    'task:pending', 'task:assigned', 'task:started',
    'task:completed', 'task:failed', 'task:blocked',
    'task:ready_for_qa', 'task:qa_passed', 'task:qa_failed',
    'agent:registered', 'agent:idle', 'agent:working',
    'agent:stuck', 'agent:heartbeat', 'agent:rate_limited',
    'session:started', 'session:output', 'session:completed',
    'session:failed', 'session:timeout',
    'system:startup', 'system:shutdown', 'system:error',
    'system:cpu_high', 'system:cpu_normal',
    'system:memory_high', 'system:memory_normal',
    'budget:warning', 'budget:exceeded', 'budget:reset',
    'schedule:planning_due', 'schedule:qa_due',
    'schedule:cleanup_due', 'schedule:crown_due',
  ];

  for (const eventType of eventTypes) {
    bus.on(eventType, (data: HarnessEvents[typeof eventType]) => {
      recordEvent(eventType, data);
    });
  }
}

function recordEvent(type: HarnessEventName, data: unknown): void {
  const record: EventRecord = {
    id: ++eventCounter,
    timestamp: new Date().toISOString(),
    type,
    data,
    summary: extractSummary(type, data),
    ...extractIds(type, data),
  };

  recentEvents.push(record);
  
  // Keep only last MAX_EVENTS
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.shift();
  }

  // Broadcast to WebSocket clients (if ws is available)
  try {
    const { ws } = require('../websocket.js');
    ws.broadcast('event:bus', record);
  } catch {
    // WebSocket not available
  }
}

function extractSummary(type: HarnessEventName, data: unknown): string {
  const d = data as Record<string, unknown>;
  
  switch (type) {
    case 'task:pending':
    case 'task:started':
    case 'task:completed':
    case 'task:failed':
    case 'task:blocked':
    case 'task:ready_for_qa':
      const task = d.task as Record<string, unknown>;
      return `${task?.display_id || 'Unknown'}: ${task?.title || ''}`.slice(0, 100);
    
    case 'task:assigned':
      const t = d.task as Record<string, unknown>;
      return `${t?.display_id} → ${d.agentId}`;
    
    case 'agent:idle':
    case 'agent:working':
    case 'agent:stuck':
      const agent = d.agent as Record<string, unknown>;
      return `${agent?.name || d.agentId || 'Unknown'}`;
    
    case 'session:started':
    case 'session:completed':
    case 'session:failed':
      return `Session ${(d.sessionId as string)?.slice(0, 8) || '?'}`;
    
    case 'system:cpu_high':
    case 'system:memory_high':
      return `${d.usage}% (threshold: ${d.threshold}%)`;
    
    case 'system:cpu_normal':
    case 'system:memory_normal':
      return `${d.usage}%`;
    
    case 'budget:warning':
      return `${d.percent}% of budget used`;
    
    case 'budget:exceeded':
      return `${d.current?.toLocaleString()} / ${d.limit?.toLocaleString()} tokens`;
    
    default:
      return JSON.stringify(data).slice(0, 100);
  }
}

function extractIds(type: HarnessEventName, data: unknown): { taskId?: string; agentId?: string; sessionId?: string } {
  const d = data as Record<string, unknown>;
  const result: { taskId?: string; agentId?: string; sessionId?: string } = {};

  // Extract taskId
  if (d.taskId) result.taskId = d.taskId as string;
  if (d.task && typeof d.task === 'object') {
    const task = d.task as Record<string, unknown>;
    result.taskId = (task.display_id as string) || (task.id as string);
  }

  // Extract agentId
  if (d.agentId) result.agentId = d.agentId as string;
  if (d.agent && typeof d.agent === 'object') {
    const agent = d.agent as Record<string, unknown>;
    result.agentId = (agent.name as string) || (agent.id as string);
  }

  // Extract sessionId
  if (d.sessionId) result.sessionId = d.sessionId as string;

  return result;
}

// Initialize recording on module load
setupEventRecording();

/**
 * GET /api/event-bus/events
 * Get recent events (with optional filters)
 */
eventBusRouter.get('/events', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, MAX_EVENTS);
  const type = req.query.type as string;
  const taskId = req.query.taskId as string;
  const agentId = req.query.agentId as string;
  const since = req.query.since ? parseInt(req.query.since as string) : undefined;

  let filtered = [...recentEvents];

  if (type) {
    filtered = filtered.filter(e => e.type === type || e.type.startsWith(type + ':'));
  }
  if (taskId) {
    filtered = filtered.filter(e => e.taskId === taskId);
  }
  if (agentId) {
    filtered = filtered.filter(e => e.agentId === agentId);
  }
  if (since) {
    filtered = filtered.filter(e => e.id > since);
  }

  // Return most recent first
  const events = filtered.slice(-limit).reverse();

  res.json({
    events,
    total: recentEvents.length,
    oldestId: recentEvents[0]?.id || 0,
    newestId: recentEvents[recentEvents.length - 1]?.id || 0,
  });
});

/**
 * GET /api/event-bus/status
 * Get event system status
 */
eventBusRouter.get('/status', (_req, res) => {
  res.json({
    ...getEventSystemStatus(),
    recentEventsCount: recentEvents.length,
    oldestEvent: recentEvents[0]?.timestamp,
    newestEvent: recentEvents[recentEvents.length - 1]?.timestamp,
  });
});

/**
 * GET /api/event-bus/stats
 * Get event statistics
 */
eventBusRouter.get('/stats', (_req, res) => {
  const stats: Record<string, number> = {};
  
  for (const event of recentEvents) {
    const category = event.type.split(':')[0];
    stats[category] = (stats[category] || 0) + 1;
    stats[event.type] = (stats[event.type] || 0) + 1;
  }

  res.json({
    total: recentEvents.length,
    byType: stats,
    eventRate: calculateEventRate(),
  });
});

function calculateEventRate(): number {
  if (recentEvents.length < 2) return 0;
  
  const newest = new Date(recentEvents[recentEvents.length - 1].timestamp).getTime();
  const oldest = new Date(recentEvents[0].timestamp).getTime();
  const durationSeconds = (newest - oldest) / 1000;
  
  if (durationSeconds <= 0) return 0;
  return Math.round((recentEvents.length / durationSeconds) * 100) / 100;
}

/**
 * GET /api/event-bus/components
 * Get detailed status for all 7 event system components
 */
eventBusRouter.get('/components', (_req, res) => {
  const busStats = bus.getStats();
  const scannerStatus = getScannerStatus();
  const spawnStatus = spawnService.getStatus();
  const qaStatus = qaService.getStatus();
  const resourceState = resourceMonitor.getState();

  // Get recent events for each component (last 10)
  const getRecentEventsForComponent = (prefix: string) => {
    return recentEvents
      .filter(e => e.type.startsWith(prefix))
      .slice(-10)
      .reverse()
      .map(e => ({
        id: e.id,
        type: e.type,
        summary: e.summary,
        timestamp: e.timestamp,
      }));
  };

  res.json({
    timestamp: new Date().toISOString(),
    components: {
      // 1. Event Bus
      eventBus: {
        name: 'Event Bus',
        emoji: '⚡',
        description: 'Central typed event emitter - routes all system events',
        status: 'active',
        metrics: {
          totalEventsFired: Object.values(busStats.eventCounts).reduce((a, b) => a + b, 0),
          activeListeners: Object.values(busStats.listenerCounts).reduce((a, b) => a + b, 0),
          uniqueEventTypes: Object.keys(busStats.eventCounts).length,
        },
        eventCounts: busStats.eventCounts,
        listenerCounts: busStats.listenerCounts,
        recentEvents: recentEvents.slice(-10).reverse().map(e => ({
          id: e.id,
          type: e.type,
          summary: e.summary,
          timestamp: e.timestamp,
        })),
      },

      // 2. Task State Machine
      taskStateMachine: {
        name: 'Task State Machine',
        emoji: '🔄',
        description: 'Validates state transitions - pending → in_progress → verification → completed',
        status: 'active',
        transitions: {
          pending: ['in_progress', 'blocked'],
          in_progress: ['pending_verification', 'failed', 'blocked'],
          pending_verification: ['completed', 'failed'],
          completed: [],
          failed: ['pending', 'blocked'],
          blocked: ['pending'],
        },
        recentEvents: getRecentEventsForComponent('task:'),
      },

      // 3. QA Service
      qaService: {
        name: 'QA Service',
        emoji: '✅',
        description: 'Handles task verification - subscribes to task:ready_for_qa events',
        status: qaStatus.enabled ? (qaStatus.processing ? 'processing' : 'idle') : 'paused',
        metrics: {
          queueSize: qaStatus.queueSize,
          processing: qaStatus.processing,
          activeCount: qaStatus.activeCount,
          enabled: qaStatus.enabled,
        },
        subscribedEvents: ['task:ready_for_qa', 'system:shutdown', 'system:cpu_high', 'system:cpu_normal'],
        emitsEvents: ['task:qa_passed', 'task:qa_failed', 'agent:idle', 'agent:working'],
        recentEvents: getRecentEventsForComponent('task:qa'),
      },

      // 4. Spawn Service
      spawnService: {
        name: 'Spawn Service',
        emoji: '🚀',
        description: 'Handles agent spawning with backpressure - reacts to task:pending events',
        status: spawnStatus.enabled 
          ? (spawnStatus.canSpawn 
            ? (spawnStatus.processing ? 'spawning' : 'ready') 
            : 'paused') 
          : 'disabled',
        metrics: {
          queueSize: spawnStatus.queueSize,
          processing: spawnStatus.processing,
          enabled: spawnStatus.enabled,
          canSpawn: spawnStatus.canSpawn,
          cpuOk: spawnStatus.cpuOk,
          memoryOk: spawnStatus.memoryOk,
        },
        subscribedEvents: [
          'task:pending', 'agent:idle',
          'system:cpu_high', 'system:cpu_normal',
          'system:memory_high', 'system:memory_normal',
          'budget:exceeded', 'budget:reset',
        ],
        emitsEvents: ['task:started', 'task:failed'],
        recentEvents: [...getRecentEventsForComponent('session:started'), ...getRecentEventsForComponent('task:started')].slice(0, 10),
      },

      // 5. Resource Monitor
      resourceMonitor: {
        name: 'Resource Monitor',
        emoji: '📊',
        description: 'Monitors CPU/memory usage - emits backpressure events when thresholds crossed',
        status: resourceState.cpuStatus === 'normal' && resourceState.memoryStatus === 'normal' ? 'healthy' : 'warning',
        metrics: {
          cpuUsage: resourceState.cpuUsage,
          memoryUsage: resourceState.memoryUsage,
          cpuStatus: resourceState.cpuStatus,
          memoryStatus: resourceState.memoryStatus,
          loadAverage: resourceState.loadAverage,
        },
        thresholds: {
          cpuHigh: 80,
          cpuNormal: 60,
          memoryHigh: 85,
          memoryNormal: 70,
        },
        emitsEvents: ['system:cpu_high', 'system:cpu_normal', 'system:memory_high', 'system:memory_normal'],
        recentEvents: getRecentEventsForComponent('system:cpu').concat(getRecentEventsForComponent('system:memory')),
      },

      // 6. Scanners
      scanners: {
        name: 'Scanners',
        emoji: '🔍',
        description: 'Lightweight periodic checks that emit events when conditions met',
        status: 'active',
        scannerList: [
          {
            name: 'Pending Task Scanner',
            description: 'Finds pending tasks with idle agents → emits task:pending',
            ...scannerStatus.pendingTask,
            emitsEvent: 'task:pending',
          },
          {
            name: 'Stuck Agent Scanner',
            description: 'Finds agents without heartbeat for 15+ min → emits agent:stuck',
            ...scannerStatus.stuckAgent,
            emitsEvent: 'agent:stuck',
          },
          {
            name: 'Planning Scanner',
            description: 'Checks if planning cycle is due → emits schedule:planning_due',
            ...scannerStatus.planning,
            emitsEvent: 'schedule:planning_due',
          },
          {
            name: 'Cleanup Scanner',
            description: 'Triggers daily cleanup → emits schedule:cleanup_due',
            ...scannerStatus.cleanup,
            emitsEvent: 'schedule:cleanup_due',
          },
        ],
        recentEvents: [
          ...getRecentEventsForComponent('schedule:'),
          ...getRecentEventsForComponent('task:pending'),
          ...getRecentEventsForComponent('agent:stuck'),
        ].slice(0, 10),
      },

      // 7. Stuck Agent Handler
      stuckAgentHandler: {
        name: 'Stuck Agent Handler',
        emoji: '🔧',
        description: 'Resets stuck agents and re-queues their tasks for retry',
        status: 'active',
        metrics: {
          handledInLastHour: stuckAgentHandler.getHandledCount(),
        },
        subscribedEvents: ['agent:stuck'],
        emitsEvents: ['agent:idle', 'task:failed', 'task:pending'],
        recentEvents: getRecentEventsForComponent('agent:stuck'),
      },
    },
  });
});

export default eventBusRouter;
