/**
 * Orchestrator API - External triggers for cron jobs
 */
import { Router } from 'express';
import * as agents from '../db/agents.js';
import * as tasks from '../db/tasks.js';
import * as sessions from '../db/sessions.js';
import { getEvents } from '../db/events.js';
import { notify } from '../telegram/index.js';
import { getRuntimeMode, isEventMode } from '../runtime/mode.js';

const router = Router();

/**
 * GET /api/orchestrator/status
 * Get current orchestrator status
 */
router.get('/status', async (_req, res) => {
  const { isOrchestratorRunning } = await import('../orchestrator/index.js');
  const mode = getRuntimeMode();
  const legacyRunning = isOrchestratorRunning();

  const allAgents = agents.getAgents();
  const workingAgents = allAgents.filter(a => a.status === 'working');
  const idleAgents = allAgents.filter(a => a.status === 'idle');
  const stuckAgents = allAgents.filter(a => a.status === 'stuck');

  const pendingTasks = tasks.getTasks({ status: 'pending' });
  const inProgressTasks = tasks.getTasks({ status: 'in_progress' });
  const pendingVerifyTasks = tasks.getTasks({ status: 'pending_verification' });

  const recentSessions = sessions.getSessions({ limit: 10 });
  const recentEvents = getEvents({ limit: 20 });

  res.json({
    status: 'operational',
    mode,
    running: mode === 'legacy' ? legacyRunning : true,
    timestamp: new Date().toISOString(),
    agents: {
      total: allAgents.length,
      working: workingAgents.length,
      idle: idleAgents.length,
      stuck: stuckAgents.length,
      details: allAgents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        currentTaskId: a.current_task_id,
        tasksCompleted: a.tasks_completed,
        tasksFailed: a.tasks_failed,
      })),
    },
    tasks: {
      pending: pendingTasks.length,
      inProgress: inProgressTasks.length,
      pendingVerification: pendingVerifyTasks.length,
    },
    recentSessions: recentSessions.map(s => ({
      id: s.id,
      agentId: s.agent_id,
      status: s.status,
      startedAt: s.started_at,
    })),
    recentEvents: recentEvents.slice(0, 5).map(e => ({
      type: e.type,
      message: e.message,
      createdAt: e.created_at,
    })),
  });
});

/**
 * POST /api/orchestrator/pause
 * Pause the orchestrator tick loop
 */
router.post('/pause', async (_req, res) => {
  try {
    if (isEventMode()) {
      return res.status(409).json({
        success: false,
        error: 'pause/resume is only supported in legacy mode',
        mode: getRuntimeMode(),
      });
    }

    const { stopOrchestrator, isOrchestratorRunning } = await import('../orchestrator/index.js');

    if (!isOrchestratorRunning()) {
      return res.json({ success: true, running: false, message: 'Already paused' });
    }

    stopOrchestrator();
    res.json({ success: true, running: false, message: 'Orchestrator paused' });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * POST /api/orchestrator/resume
 * Resume the orchestrator tick loop
 */
router.post('/resume', async (_req, res) => {
  try {
    if (isEventMode()) {
      return res.status(409).json({
        success: false,
        error: 'pause/resume is only supported in legacy mode',
        mode: getRuntimeMode(),
      });
    }

    const { startOrchestrator, isOrchestratorRunning } = await import('../orchestrator/index.js');

    if (isOrchestratorRunning()) {
      return res.json({ success: true, running: true, message: 'Already running' });
    }

    startOrchestrator();
    res.json({ success: true, running: true, message: 'Orchestrator resumed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * POST /api/orchestrator/trigger
 * Manually trigger orchestration tick (for cron jobs)
 */
router.post('/trigger', async (req, res) => {
  const { notify: shouldNotify = false, source = 'api' } = req.body || {};
  
  try {
    if (isEventMode()) {
      return res.status(409).json({
        success: false,
        error: 'manual tick trigger is only supported in legacy mode',
        mode: getRuntimeMode(),
      });
    }

    // Import orchestrator dynamically to avoid circular deps
    const { manualTick } = await import('../orchestrator/index.js');
    
    const result = await manualTick();
    
    if (shouldNotify) {
      await notify.systemStatus(
        result.workingCount,
        result.idleCount,
        result.pendingTasks
      );
    }
    
    res.json({
      success: true,
      triggered: true,
      source,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/orchestrator/spawn
 * Manually spawn an agent for a specific task
 */
router.post('/spawn', async (req, res) => {
  const { taskId, agentId } = req.body || {};
  
  if (!taskId || !agentId) {
    return res.status(400).json({
      success: false,
      error: 'taskId and agentId are required',
    });
  }
  
  try {
    const { spawnAgentSession } = await import('../spawner/index.js');
    
    const result = await spawnAgentSession({
      taskId,
      agentId,
    });
    
    res.json({
      success: result.success,
      sessionId: result.sessionId,
      output: result.output,
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/orchestrator/summary
 * Get a text summary suitable for Telegram
 */
router.get('/summary', (_req, res) => {
  const allAgents = agents.getAgents();
  const workingAgents = allAgents.filter(a => a.status === 'working');
  const idleAgents = allAgents.filter(a => a.status === 'idle');
  
  const pendingTasks = tasks.getTasks({ status: 'pending' });
  const inProgressTasks = tasks.getTasks({ status: 'in_progress' });
  const pendingVerifyTasks = tasks.getTasks({ status: 'pending_verification' });
  
  let summary = `📊 <b>Harness Status</b>\n\n`;
  summary += `<b>Agents:</b>\n`;
  summary += `• ${workingAgents.length} working\n`;
  summary += `• ${idleAgents.length} idle\n`;
  
  if (workingAgents.length > 0) {
    summary += `\n<b>Working on:</b>\n`;
    for (const a of workingAgents) {
      const task = a.current_task_id ? tasks.getTask(a.current_task_id) : null;
      summary += `• ${a.name}: ${task?.display_id || 'unknown'}\n`;
    }
  }
  
  summary += `\n<b>Tasks:</b>\n`;
  summary += `• ${pendingTasks.length} pending\n`;
  summary += `• ${inProgressTasks.length} in progress\n`;
  summary += `• ${pendingVerifyTasks.length} awaiting QA\n`;
  
  res.type('text/html').send(summary);
});

/**
 * POST /api/orchestrator/shutdown
 * Gracefully shut down the entire server process
 */
router.post('/shutdown', async (_req, res) => {
  const { stopOrchestrator } = await import('../orchestrator/index.js');
  stopOrchestrator();
  res.json({ success: true, message: 'Shutting down' });
  // Give the response time to flush, then exit
  setTimeout(() => process.exit(0), 500);
});

export { router as orchestratorRouter };
