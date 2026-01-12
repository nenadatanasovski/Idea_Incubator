/**
 * Agent Management API Routes
 *
 * REST API for monitoring and managing build pipeline agents.
 */

import { Router, Request, Response } from 'express';
import { query, getOne, run } from '../../database/db.js';
import { getTaskExecutor } from '../services/task-executor.js';

const router = Router();

// Agent type definitions
export interface AgentInfo {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'error' | 'waiting' | 'halted';
  lastHeartbeat: string;
  currentTask?: string;
  currentTaskListName?: string;
  currentProjectName?: string;
  sessionId?: string;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    avgDuration: number;
    questionsAsked: number;
    questionsAnswered: number;
  };
}

/**
 * Extract project name from a file path
 * Looks for patterns like ideas/{project}/... or docs/{project}/...
 */
function extractProjectName(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;

  const parts = filePath.split('/');

  // Look for ideas/{project-name}/...
  const ideasIndex = parts.indexOf('ideas');
  if (ideasIndex !== -1 && parts[ideasIndex + 1]) {
    return parts[ideasIndex + 1];
  }

  // Look for docs/{project-name}/...
  const docsIndex = parts.indexOf('docs');
  if (docsIndex !== -1 && parts[docsIndex + 1]) {
    return parts[docsIndex + 1];
  }

  return undefined;
}

/**
 * Extract task list name from a file path
 */
function extractTaskListName(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;

  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  if (fileName) {
    return fileName.replace(/\.(md|txt)$/i, '');
  }
  return undefined;
}

/**
 * Maps database agent status to frontend-compatible status
 * Database: 'working', 'idle', 'blocked', 'error'
 * Frontend: 'running', 'idle', 'waiting', 'error', 'halted'
 */
function mapAgentStatus(dbStatus: string | undefined): AgentInfo['status'] {
  if (!dbStatus) return 'idle';

  switch (dbStatus) {
    case 'working':
      return 'running';
    case 'blocked':
      return 'waiting';
    case 'idle':
      return 'idle';
    case 'error':
      return 'error';
    case 'halted':
      return 'halted';
    default:
      console.warn(`[AgentsAPI] Unknown status: ${dbStatus}, defaulting to idle`);
      return 'idle';
  }
}

export interface AgentLog {
  id: string;
  agentId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

// Default agents configuration
const AGENT_CONFIGS = [
  { id: 'spec-agent', name: 'Spec Agent', type: 'specification' },
  { id: 'build-agent', name: 'Build Agent', type: 'build' },
  { id: 'validation-agent', name: 'Validation Agent', type: 'validation' },
  { id: 'sia', name: 'Self-Improvement Agent', type: 'sia' },
  { id: 'ux-agent', name: 'UX Agent', type: 'ux' },
  { id: 'monitoring-agent', name: 'Monitoring Agent', type: 'monitoring' },
];

/**
 * GET /api/agents
 * List all agents with their current status
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get agent states from database
    let agentStates: Array<{
      agent_id: string;
      agent_type?: string;
      status: string;
      session_id: string | null;
      current_task: string | null;
      last_activity: string;
    }> = [];

    try {
      agentStates = await query<{
        agent_id: string;
        agent_type?: string;
        status: string;
        session_id: string | null;
        current_task: string | null;
        last_activity: string;
      }>(`SELECT agent_id, agent_type, status, session_id, current_task, last_activity FROM agent_states`);
    } catch {
      // Table may not exist yet
    }

    // Get task metrics per agent
    let taskMetrics: Array<{
      agent_id: string;
      completed_tasks: number;
      failed_tasks: number;
      avg_duration_ms: number;
    }> = [];

    try {
      taskMetrics = await query<{
        agent_id: string;
        completed_tasks: number;
        failed_tasks: number;
        avg_duration_ms: number;
      }>(`
        SELECT
          agent_id,
          completed_tasks,
          failed_tasks,
          avg_duration_ms
        FROM v_agent_task_metrics
      `);
    } catch {
      // View may not exist yet
    }

    // Get question metrics per agent
    let questionMetrics: Array<{
      agent_id: string;
      asked: number;
      answered: number;
    }> = [];

    try {
      questionMetrics = await query<{
        agent_id: string;
        asked: number;
        answered: number;
      }>(`
        SELECT
          agent_id,
          COUNT(*) as asked,
          COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered
        FROM questions
        GROUP BY agent_id
      `);
    } catch {
      // Table may not exist yet
    }

    // Get task executor status for Build Agent metrics
    let executorStatus: { running: boolean; completedTasks: number; failedTasks: number; taskListPath: string; currentTask?: { id: string; description: string } } | null = null;
    try {
      const executor = getTaskExecutor();
      const status = executor.getStatus();
      executorStatus = {
        running: status.running,
        completedTasks: status.completedTasks,
        failedTasks: status.failedTasks,
        taskListPath: status.taskListPath || '',
        currentTask: status.currentTask ? { id: status.currentTask.id, description: status.currentTask.description } : undefined,
      };
    } catch {
      // Executor may not be initialized yet
    }

    // Build agent list
    const agents: AgentInfo[] = AGENT_CONFIGS.map(config => {
      const state = agentStates.find(s => s.agent_id === config.id);
      const metrics = taskMetrics.find(m => m.agent_id === config.id);
      const questions = questionMetrics.find(q => q.agent_id === config.id);

      // Special handling for build-agent: use executor status for accurate metrics
      const isBuildAgent = config.id === 'build-agent';
      const buildAgentStatus = isBuildAgent && executorStatus?.running ? 'running' : mapAgentStatus(state?.status);
      const buildAgentCurrentTask = isBuildAgent && executorStatus?.currentTask
        ? `${executorStatus.currentTask.id}: ${executorStatus.currentTask.description}`
        : state?.current_task || undefined;

      // Extract project and task list context for build-agent
      const taskListPath = isBuildAgent ? executorStatus?.taskListPath : undefined;
      const projectName = isBuildAgent ? extractProjectName(taskListPath) : undefined;
      const taskListName = isBuildAgent ? extractTaskListName(taskListPath) : undefined;

      return {
        id: config.id,
        name: config.name,
        type: config.type,
        status: isBuildAgent ? buildAgentStatus : mapAgentStatus(state?.status),
        lastHeartbeat: state?.last_activity || new Date().toISOString(),
        currentTask: isBuildAgent ? buildAgentCurrentTask : (state?.current_task || undefined),
        currentTaskListName: taskListName,
        currentProjectName: projectName,
        sessionId: state?.session_id || undefined,
        metrics: {
          // For build-agent, prioritize executor metrics over database metrics
          tasksCompleted: isBuildAgent && executorStatus ? executorStatus.completedTasks : (metrics?.completed_tasks || 0),
          tasksFailed: isBuildAgent && executorStatus ? executorStatus.failedTasks : (metrics?.failed_tasks || 0),
          avgDuration: metrics?.avg_duration_ms || 0,
          questionsAsked: questions?.asked || 0,
          questionsAnswered: questions?.answered || 0,
        },
      };
    });

    res.json(agents);
  } catch (error) {
    console.error('[AgentsAPI] Error listing agents:', error);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

/**
 * GET /api/agents/:id
 * Get detailed agent information
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const config = AGENT_CONFIGS.find(c => c.id === id);
    if (!config) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Get agent state
    let state: {
      agent_id: string;
      status: string;
      session_id: string | null;
      current_task: string | null;
      last_activity: string;
      error_message: string | null;
    } | null = null;

    try {
      state = await getOne<{
        agent_id: string;
        status: string;
        session_id: string | null;
        current_task: string | null;
        last_activity: string;
        error_message: string | null;
      }>(`SELECT * FROM agent_states WHERE agent_id = ?`, [id]);
    } catch {
      // Table may not exist yet
    }

    // Get recent tasks for this agent
    let recentTasks: Array<{
      id: string;
      task_id: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      duration_ms: number | null;
      error: string | null;
    }> = [];

    try {
      recentTasks = await query<{
        id: string;
        task_id: string;
        status: string;
        started_at: string;
        completed_at: string | null;
        duration_ms: number | null;
        error: string | null;
      }>(`
        SELECT * FROM task_executions
        WHERE build_id IN (SELECT id FROM build_executions ORDER BY created_at DESC LIMIT 1)
        ORDER BY started_at DESC
        LIMIT 20
      `);
    } catch {
      // Table may not exist yet
    }

    // Get pending questions
    let pendingQuestions: Array<{
      id: string;
      type: string;
      content: string;
      priority: number;
      blocking: number;
      created_at: string;
    }> = [];

    try {
      pendingQuestions = await query<{
        id: string;
        type: string;
        content: string;
        priority: number;
        blocking: number;
        created_at: string;
      }>(`
        SELECT * FROM questions
        WHERE agent_id = ? AND status = 'pending'
        ORDER BY priority DESC, created_at ASC
      `, [id]);
    } catch {
      // Table may not exist yet
    }

    res.json({
      id: config.id,
      name: config.name,
      type: config.type,
      status: mapAgentStatus(state?.status),
      lastHeartbeat: state?.last_activity || new Date().toISOString(),
      currentTask: state?.current_task || null,
      sessionId: state?.session_id || null,
      errorMessage: state?.error_message || null,
      recentTasks,
      pendingQuestions,
    });
  } catch (error) {
    console.error('[AgentsAPI] Error getting agent:', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

/**
 * GET /api/agents/:id/tasks
 * Get tasks assigned to or executed by an agent
 */
router.get('/:id/tasks', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, limit = '50' } = req.query;

    let sql = `
      SELECT te.*, be.spec_path, be.status as build_status
      FROM task_executions te
      JOIN build_executions be ON te.build_id = be.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (status) {
      sql += ` AND te.status = ?`;
      params.push(status as string);
    }

    sql += ` ORDER BY te.started_at DESC LIMIT ?`;
    params.push(parseInt(limit as string, 10));

    let tasks: Array<Record<string, unknown>> = [];
    try {
      tasks = await query<Record<string, unknown>>(sql, params);
    } catch {
      // Table may not exist yet
    }

    res.json(tasks);
  } catch (error) {
    console.error('[AgentsAPI] Error getting agent tasks:', error);
    res.status(500).json({ error: 'Failed to get agent tasks' });
  }
});

/**
 * GET /api/agents/:id/logs
 * Get execution logs for an agent
 */
router.get('/:id/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { level, limit = '100', since } = req.query;

    let sql = `
      SELECT * FROM agent_logs
      WHERE agent_id = ?
    `;
    const params: (string | number)[] = [id];

    if (level) {
      sql += ` AND level = ?`;
      params.push(level as string);
    }

    if (since) {
      sql += ` AND timestamp > ?`;
      params.push(since as string);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(parseInt(limit as string, 10));

    let logs: Array<Record<string, unknown>> = [];
    try {
      logs = await query<Record<string, unknown>>(sql, params);
    } catch {
      // Table may not exist yet
    }

    res.json(logs);
  } catch (error) {
    console.error('[AgentsAPI] Error getting agent logs:', error);
    res.status(500).json({ error: 'Failed to get agent logs' });
  }
});

/**
 * POST /api/agents/:id/heartbeat
 * Record agent heartbeat
 */
router.post('/:id/heartbeat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, currentTask, sessionId } = req.body;

    try {
      await run(`
        INSERT INTO agent_states (agent_id, agent_type, status, session_id, current_task, last_activity, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(agent_id) DO UPDATE SET
          status = excluded.status,
          session_id = excluded.session_id,
          current_task = excluded.current_task,
          last_activity = excluded.last_activity,
          updated_at = excluded.updated_at
      `, [id, AGENT_CONFIGS.find(c => c.id === id)?.type || 'unknown', status || 'idle', sessionId || null, currentTask || null]);
    } catch {
      // Table may not exist yet - that's okay for heartbeats
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[AgentsAPI] Error recording heartbeat:', error);
    res.status(500).json({ error: 'Failed to record heartbeat' });
  }
});

/**
 * POST /api/agents/:id/start
 * Start an agent
 */
router.post('/:id/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    try {
      await run(`
        UPDATE agent_states
        SET status = 'running', last_activity = datetime('now'), updated_at = datetime('now')
        WHERE agent_id = ?
      `, [id]);
    } catch {
      // Table may not exist yet
    }

    res.json({ success: true, message: `Agent ${id} started` });
  } catch (error) {
    console.error('[AgentsAPI] Error starting agent:', error);
    res.status(500).json({ error: 'Failed to start agent' });
  }
});

/**
 * POST /api/agents/:id/stop
 * Stop an agent
 */
router.post('/:id/stop', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    try {
      await run(`
        UPDATE agent_states
        SET status = 'idle', current_task = NULL, last_activity = datetime('now'), updated_at = datetime('now')
        WHERE agent_id = ?
      `, [id]);
    } catch {
      // Table may not exist yet
    }

    res.json({ success: true, message: `Agent ${id} stopped` });
  } catch (error) {
    console.error('[AgentsAPI] Error stopping agent:', error);
    res.status(500).json({ error: 'Failed to stop agent' });
  }
});

/**
 * GET /api/agents/activities
 * Get recent activities across all agents
 */
router.get('/activities/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = '20' } = req.query;

    let activities: Array<{
      id: number;
      agent_id: string;
      type: string;
      description: string;
      metadata: string | null;
      created_at: string;
    }> = [];

    try {
      activities = await query<{
        id: number;
        agent_id: string;
        type: string;
        description: string;
        metadata: string | null;
        created_at: string;
      }>(`
        SELECT id, agent_id, type, description, metadata, created_at
        FROM activity_log
        ORDER BY created_at DESC
        LIMIT ?
      `, [parseInt(limit as string, 10)]);
    } catch {
      // Table may not exist yet
    }

    // Map to frontend format
    const mappedActivities = activities.map(act => {
      const metadata = act.metadata ? JSON.parse(act.metadata) : {};
      const agentConfig = AGENT_CONFIGS.find(c => c.id === act.agent_id);

      return {
        id: `act-${act.id}`,
        agentId: act.agent_id || 'unknown',
        agentName: agentConfig?.name || act.agent_id || 'Unknown Agent',
        type: mapActivityType(act.type),
        description: act.description,
        timestamp: act.created_at,
        taskListName: metadata.taskListName || extractTaskListName(metadata.taskListPath),
        projectName: metadata.projectName || extractProjectName(metadata.taskListPath),
        taskId: metadata.taskId,
      };
    });

    res.json({ activities: mappedActivities });
  } catch (error) {
    console.error('[AgentsAPI] Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

/**
 * Map activity type string to frontend ActivityEventType
 */
function mapActivityType(type: string): 'task_started' | 'task_completed' | 'task_failed' | 'question_asked' | 'question_answered' {
  switch (type) {
    case 'task_started':
    case 'task:started':
      return 'task_started';
    case 'task_completed':
    case 'task:completed':
      return 'task_completed';
    case 'task_failed':
    case 'task:failed':
      return 'task_failed';
    case 'question_asked':
    case 'question:asked':
      return 'question_asked';
    case 'question_answered':
    case 'question:answered':
      return 'question_answered';
    default:
      return 'task_started';
  }
}

export default router;
