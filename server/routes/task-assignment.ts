/**
 * Task Assignment API Routes
 *
 * REST API for agents to claim and work on tasks autonomously.
 * Enables multi-agent coordination by providing a work queue system.
 */

import { Router, Request, Response } from 'express';
import { query, run, getOne } from '../../database/db.js';
import {
  parseTaskList,
  updateTaskStatus,
  getNextPendingTask,
  TaskList,
  ParsedTask,
} from '../services/task-loader.js';
import { emitTaskExecutorEvent } from '../websocket.js';

const router = Router();

interface TaskClaim {
  taskId: string;
  taskExecutionId: string;
  agentId: string;
  claimedAt: string;
  buildId: string;
}

interface ClaimRequest {
  agentId: string;
  capabilities?: string[];
  minPriority?: 'P1' | 'P2' | 'P3' | 'P4';
  buildId?: string;
}

interface ReleaseRequest {
  taskExecutionId: string;
  agentId: string;
  reason?: string;
}

interface CompleteRequest {
  taskExecutionId: string;
  agentId: string;
  success: boolean;
  output?: string;
  error?: string;
  validationCommand?: string;
  validationOutput?: string;
  validationSuccess?: boolean;
  generatedCode?: string;
}

/**
 * POST /api/task-assignment/claim
 * Claim the next available task for an agent to work on
 *
 * Body: {
 *   agentId: string;
 *   capabilities?: string[];
 *   minPriority?: 'P1' | 'P2' | 'P3' | 'P4';
 *   buildId?: string;
 * }
 */
router.post('/claim', async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId, capabilities, minPriority = 'P4', buildId }: ClaimRequest = req.body;

    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    // Get the active build or use provided buildId
    let targetBuildId = buildId;
    if (!targetBuildId) {
      try {
        const activeBuild = await getOne<{ id: string; spec_path: string; status: string }>(
          `SELECT id, spec_path, status FROM build_executions
           WHERE status IN ('pending', 'running', 'paused')
           ORDER BY created_at DESC LIMIT 1`
        );

        if (!activeBuild) {
          res.status(404).json({ error: 'No active builds available' });
          return;
        }

        targetBuildId = activeBuild.id;
      } catch (error) {
        console.error('[TaskAssignment] Error finding active build:', error);
        res.status(500).json({ error: 'Failed to find active build' });
        return;
      }
    }

    // Get build info to locate tasks file
    let build;
    try {
      build = await getOne<{ id: string; spec_path: string; status: string }>(
        `SELECT id, spec_path, status FROM build_executions WHERE id = ?`,
        [targetBuildId]
      );

      if (!build) {
        res.status(404).json({ error: 'Build not found' });
        return;
      }
    } catch (error) {
      console.error('[TaskAssignment] Error getting build:', error);
      res.status(500).json({ error: 'Failed to get build info' });
      return;
    }

    // Load tasks from markdown file
    const tasksPath = build.spec_path.replace('spec.md', 'tasks.md');
    let taskList: TaskList;
    try {
      taskList = parseTaskList(tasksPath);
    } catch (error) {
      console.error('[TaskAssignment] Error parsing task list:', error);
      res.status(500).json({ error: 'Failed to parse task list' });
      return;
    }

    // Get already claimed/completed tasks from database
    let claimedTaskIds: Set<string>;
    try {
      const claimed = await query<{ task_id: string }>(
        `SELECT task_id FROM task_executions
         WHERE build_id = ? AND status IN ('running', 'completed')`,
        [targetBuildId]
      );
      claimedTaskIds = new Set(claimed.map(t => t.task_id));
    } catch (error) {
      console.error('[TaskAssignment] Error getting claimed tasks:', error);
      claimedTaskIds = new Set();
    }

    // Filter available tasks based on status and capabilities
    const availableTasks = taskList.tasks.filter(task => {
      // Must be pending
      if (task.status !== 'pending') return false;

      // Must not be already claimed
      if (claimedTaskIds.has(task.id)) return false;

      // Check priority threshold
      const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
      if (priorityOrder[task.priority] > priorityOrder[minPriority]) return false;

      // TODO: Check capabilities match (future enhancement)
      // For now, we'll use task ID prefix to match agent types

      return true;
    });

    if (availableTasks.length === 0) {
      res.status(404).json({
        error: 'No available tasks',
        message: 'All tasks are either claimed, in progress, or completed'
      });
      return;
    }

    // Get highest priority available task
    const nextTask = availableTasks.sort((a, b) => {
      const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })[0];

    // Create task execution record and claim it
    const taskExecutionId = `te-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      await run(
        `INSERT INTO task_executions (
          id, build_id, task_id, phase, action, file_path,
          status, started_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          taskExecutionId,
          targetBuildId,
          nextTask.id,
          nextTask.section || 'unknown',
          'UPDATE', // Default action, will be updated based on task details
          nextTask.description, // Using description as placeholder for file_path
          'running',
        ]
      );

      // Record the agent assignment in a separate tracking table (future enhancement)
      // For now, we'll track it in memory via the status

    } catch (error) {
      console.error('[TaskAssignment] Error creating task execution:', error);
      res.status(500).json({ error: 'Failed to claim task' });
      return;
    }

    // Broadcast task claim event
    emitTaskExecutorEvent('task:claimed', {
      taskId: nextTask.id,
      taskExecutionId,
      agentId,
      buildId: targetBuildId,
      priority: nextTask.priority,
      description: nextTask.description,
    });

    const claim: TaskClaim = {
      taskId: nextTask.id,
      taskExecutionId,
      agentId,
      claimedAt: new Date().toISOString(),
      buildId: targetBuildId,
    };

    res.json({
      success: true,
      claim,
      task: {
        id: nextTask.id,
        description: nextTask.description,
        priority: nextTask.priority,
        section: nextTask.section,
        subsection: nextTask.subsection,
      },
    });
  } catch (error) {
    console.error('[TaskAssignment] Error claiming task:', error);
    res.status(500).json({ error: 'Failed to claim task' });
  }
});

/**
 * POST /api/task-assignment/release
 * Release a claimed task back to the queue
 *
 * Body: {
 *   taskExecutionId: string;
 *   agentId: string;
 *   reason?: string;
 * }
 */
router.post('/release', async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskExecutionId, agentId, reason }: ReleaseRequest = req.body;

    if (!taskExecutionId || !agentId) {
      res.status(400).json({ error: 'taskExecutionId and agentId are required' });
      return;
    }

    // Get task execution details
    let taskExecution;
    try {
      taskExecution = await getOne<{
        id: string;
        task_id: string;
        build_id: string;
        status: string;
      }>(
        `SELECT id, task_id, build_id, status FROM task_executions WHERE id = ?`,
        [taskExecutionId]
      );

      if (!taskExecution) {
        res.status(404).json({ error: 'Task execution not found' });
        return;
      }

      if (taskExecution.status === 'completed') {
        res.status(400).json({ error: 'Cannot release a completed task' });
        return;
      }
    } catch (error) {
      console.error('[TaskAssignment] Error getting task execution:', error);
      res.status(500).json({ error: 'Failed to get task execution' });
      return;
    }

    // Update status to pending and clear timestamps
    try {
      await run(
        `UPDATE task_executions
         SET status = 'pending', started_at = NULL, error_message = ?
         WHERE id = ?`,
        [reason || 'Released by agent', taskExecutionId]
      );
    } catch (error) {
      console.error('[TaskAssignment] Error releasing task:', error);
      res.status(500).json({ error: 'Failed to release task' });
      return;
    }

    // Broadcast release event
    emitTaskExecutorEvent('task:released', {
      taskId: taskExecution.task_id,
      taskExecutionId,
      agentId,
      reason,
    });

    res.json({
      success: true,
      message: 'Task released back to queue',
      taskId: taskExecution.task_id,
    });
  } catch (error) {
    console.error('[TaskAssignment] Error releasing task:', error);
    res.status(500).json({ error: 'Failed to release task' });
  }
});

/**
 * POST /api/task-assignment/complete
 * Mark a task as complete
 *
 * Body: {
 *   taskExecutionId: string;
 *   agentId: string;
 *   success: boolean;
 *   output?: string;
 *   error?: string;
 *   validationCommand?: string;
 *   validationOutput?: string;
 *   validationSuccess?: boolean;
 *   generatedCode?: string;
 * }
 */
router.post('/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      taskExecutionId,
      agentId,
      success,
      output,
      error,
      validationCommand,
      validationOutput,
      validationSuccess,
      generatedCode,
    }: CompleteRequest = req.body;

    if (!taskExecutionId || !agentId || success === undefined) {
      res.status(400).json({ error: 'taskExecutionId, agentId, and success are required' });
      return;
    }

    // Get task execution details
    let taskExecution;
    try {
      taskExecution = await getOne<{
        id: string;
        task_id: string;
        build_id: string;
        started_at: string;
      }>(
        `SELECT id, task_id, build_id, started_at FROM task_executions WHERE id = ?`,
        [taskExecutionId]
      );

      if (!taskExecution) {
        res.status(404).json({ error: 'Task execution not found' });
        return;
      }
    } catch (error) {
      console.error('[TaskAssignment] Error getting task execution:', error);
      res.status(500).json({ error: 'Failed to get task execution' });
      return;
    }

    // Calculate duration
    const startTime = new Date(taskExecution.started_at).getTime();
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Update task execution with completion data
    const finalStatus = success ? 'completed' : 'failed';

    try {
      await run(
        `UPDATE task_executions
         SET status = ?,
             completed_at = datetime('now'),
             duration_ms = ?,
             error_message = ?,
             generated_code = ?,
             validation_command = ?,
             validation_output = ?,
             validation_success = ?
         WHERE id = ?`,
        [
          finalStatus,
          durationMs,
          error || null,
          generatedCode || null,
          validationCommand || null,
          validationOutput || null,
          validationSuccess !== undefined ? (validationSuccess ? 1 : 0) : null,
          taskExecutionId,
        ]
      );

      // Update build execution counters
      await run(
        `UPDATE build_executions
         SET tasks_completed = tasks_completed + ?,
             tasks_failed = tasks_failed + ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [success ? 1 : 0, success ? 0 : 1, taskExecution.build_id]
      );
    } catch (error) {
      console.error('[TaskAssignment] Error completing task:', error);
      res.status(500).json({ error: 'Failed to complete task' });
      return;
    }

    // Broadcast completion event
    emitTaskExecutorEvent('task:completed', {
      taskId: taskExecution.task_id,
      taskExecutionId,
      agentId,
      success,
      durationMs,
      buildId: taskExecution.build_id,
    });

    res.json({
      success: true,
      message: `Task ${success ? 'completed successfully' : 'failed'}`,
      taskId: taskExecution.task_id,
      durationMs,
      status: finalStatus,
    });
  } catch (error) {
    console.error('[TaskAssignment] Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

/**
 * GET /api/task-assignment/available
 * Get list of available tasks without claiming
 *
 * Query params:
 *   buildId?: string
 *   minPriority?: 'P1' | 'P2' | 'P3' | 'P4'
 *   limit?: number
 */
router.get('/available', async (req: Request, res: Response): Promise<void> => {
  try {
    const { buildId, minPriority = 'P4', limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    // Get the active build or use provided buildId
    let targetBuildId = buildId as string | undefined;
    if (!targetBuildId) {
      try {
        const activeBuild = await getOne<{ id: string }>(
          `SELECT id FROM build_executions
           WHERE status IN ('pending', 'running', 'paused')
           ORDER BY created_at DESC LIMIT 1`
        );
        targetBuildId = activeBuild?.id;
      } catch (error) {
        // Table may not exist
      }
    }

    if (!targetBuildId) {
      res.json({ available: [], total: 0 });
      return;
    }

    // Get build info
    let build;
    try {
      build = await getOne<{ spec_path: string }>(
        `SELECT spec_path FROM build_executions WHERE id = ?`,
        [targetBuildId]
      );

      if (!build) {
        res.status(404).json({ error: 'Build not found' });
        return;
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get build' });
      return;
    }

    // Load tasks
    const tasksPath = build.spec_path.replace('spec.md', 'tasks.md');
    let taskList: TaskList;
    try {
      taskList = parseTaskList(tasksPath);
    } catch (error) {
      res.status(500).json({ error: 'Failed to parse task list' });
      return;
    }

    // Get claimed tasks
    let claimedTaskIds: Set<string>;
    try {
      const claimed = await query<{ task_id: string }>(
        `SELECT task_id FROM task_executions
         WHERE build_id = ? AND status IN ('running', 'completed')`,
        [targetBuildId]
      );
      claimedTaskIds = new Set(claimed.map(t => t.task_id));
    } catch (error) {
      claimedTaskIds = new Set();
    }

    // Filter and sort available tasks
    const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
    const availableTasks = taskList.tasks
      .filter(task => {
        if (task.status !== 'pending') return false;
        if (claimedTaskIds.has(task.id)) return false;
        if (priorityOrder[task.priority] > priorityOrder[minPriority as 'P1' | 'P2' | 'P3' | 'P4']) return false;
        return true;
      })
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, limitNum)
      .map(task => ({
        id: task.id,
        description: task.description,
        priority: task.priority,
        section: task.section,
        subsection: task.subsection,
      }));

    res.json({
      available: availableTasks,
      total: availableTasks.length,
      buildId: targetBuildId,
    });
  } catch (error) {
    console.error('[TaskAssignment] Error getting available tasks:', error);
    res.status(500).json({ error: 'Failed to get available tasks' });
  }
});

/**
 * GET /api/task-assignment/claimed/:agentId
 * Get tasks currently claimed by a specific agent
 */
router.get('/claimed/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.params;

    // For now, we don't have an agent assignment table,
    // so this would need to be enhanced when we add agent tracking
    // Currently returning empty as a placeholder

    res.json({
      agentId,
      claimed: [],
      total: 0,
      message: 'Agent tracking not yet implemented',
    });
  } catch (error) {
    console.error('[TaskAssignment] Error getting claimed tasks:', error);
    res.status(500).json({ error: 'Failed to get claimed tasks' });
  }
});

export default router;
