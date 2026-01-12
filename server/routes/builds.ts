/**
 * Build Agent API Routes
 *
 * REST API for managing build executions.
 */

import { Router, Request, Response } from 'express';
import {
  createBuildExecution,
  getBuildExecution,
  listBuildExecutions,
  updateBuildExecution,
  listTaskExecutions,
  getLatestCheckpoint,
  saveDb
} from '../../database/db.js';
import {
  BuildNotFoundError,
  BuildAlreadyRunningError,
  BuildNotRunningError,
  SpecNotFoundError,
  asyncHandler
} from '../errors/build-errors.js';
import { TaskLoader } from '../../agents/build/task-loader.js';
import { emitBuildEvent } from '../websocket.js';
import * as fs from 'fs';

const router = Router();

/**
 * POST /api/builds
 * Start a new build execution
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { specPath, options } = req.body;

  // Validate spec path
  if (!specPath || typeof specPath !== 'string') {
    return res.status(400).json({
      error: 'specPath is required',
      code: 'INVALID_REQUEST'
    });
  }

  // Check if spec file exists
  if (!fs.existsSync(specPath)) {
    throw new SpecNotFoundError(specPath);
  }

  // Load and parse tasks
  const loader = new TaskLoader();
  const result = loader.load(specPath);

  if (!result.success || !result.file) {
    return res.status(400).json({
      error: result.error || 'Failed to parse tasks file',
      code: 'INVALID_SPEC'
    });
  }

  // Create build execution
  const buildId = await createBuildExecution({
    specId: result.file.frontmatter.id,
    specPath,
    tasksTotal: result.file.tasks.length,
    options
  });

  await saveDb();

  // Emit WebSocket event
  emitBuildEvent('build:created', buildId, {
    specId: result.file.frontmatter.id,
    specPath,
    tasksTotal: result.file.tasks.length
  });

  return res.status(201).json({
    id: buildId,
    specId: result.file.frontmatter.id,
    specPath,
    status: 'pending',
    tasksTotal: result.file.tasks.length,
    tasksCompleted: 0,
    tasksFailed: 0
  });
}));

/**
 * GET /api/builds
 * List all build executions
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, specId, limit } = req.query;

  const builds = await listBuildExecutions({
    status: status as string | undefined,
    specId: specId as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined
  });

  return res.json({
    builds: builds.map(b => ({
      id: b.id,
      specId: b.spec_id,
      specPath: b.spec_path,
      status: b.status,
      tasksTotal: b.tasks_total,
      tasksCompleted: b.tasks_completed,
      tasksFailed: b.tasks_failed,
      startedAt: b.started_at,
      completedAt: b.completed_at,
      createdAt: b.created_at
    })),
    count: builds.length
  });
}));

/**
 * GET /api/builds/:id
 * Get build execution details
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const build = await getBuildExecution(id);
  if (!build) {
    throw new BuildNotFoundError(id);
  }

  return res.json({
    id: build.id,
    specId: build.spec_id,
    specPath: build.spec_path,
    status: build.status,
    currentTaskId: build.current_task_id,
    tasksTotal: build.tasks_total,
    tasksCompleted: build.tasks_completed,
    tasksFailed: build.tasks_failed,
    startedAt: build.started_at,
    completedAt: build.completed_at,
    errorMessage: build.error_message,
    createdAt: build.created_at,
    updatedAt: build.updated_at
  });
}));

/**
 * GET /api/builds/:id/tasks
 * Get task execution history for a build
 */
router.get('/:id/tasks', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, phase } = req.query;

  const build = await getBuildExecution(id);
  if (!build) {
    throw new BuildNotFoundError(id);
  }

  const tasks = await listTaskExecutions(id, {
    status: status as string | undefined,
    phase: phase as string | undefined
  });

  return res.json({
    buildId: id,
    tasks: tasks.map(t => ({
      id: t.id,
      taskId: t.task_id,
      phase: t.phase,
      action: t.action,
      filePath: t.file_path,
      attempt: t.attempt,
      status: t.status,
      startedAt: t.started_at,
      completedAt: t.completed_at,
      validationSuccess: t.validation_success === 1,
      durationMs: t.duration_ms,
      errorMessage: t.error_message
    })),
    count: tasks.length
  });
}));

/**
 * POST /api/builds/:id/start
 * Start or resume a build execution
 */
router.post('/:id/start', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const build = await getBuildExecution(id);
  if (!build) {
    throw new BuildNotFoundError(id);
  }

  if (build.status === 'running') {
    throw new BuildAlreadyRunningError(id);
  }

  if (build.status === 'completed' || build.status === 'cancelled') {
    return res.status(400).json({
      error: `Build has already ${build.status}`,
      code: 'BUILD_FINISHED'
    });
  }

  // Update status to running
  await updateBuildExecution(id, {
    status: 'running',
    startedAt: new Date().toISOString()
  });
  await saveDb();

  // Emit WebSocket event
  emitBuildEvent('build:started', id, {
    specId: build.spec_id
  });

  return res.json({
    id,
    status: 'running',
    message: 'Build started'
  });
}));

/**
 * POST /api/builds/:id/pause
 * Pause a running build
 */
router.post('/:id/pause', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const build = await getBuildExecution(id);
  if (!build) {
    throw new BuildNotFoundError(id);
  }

  if (build.status !== 'running') {
    throw new BuildNotRunningError(id, build.status);
  }

  await updateBuildExecution(id, { status: 'paused' });
  await saveDb();

  // Emit WebSocket event
  emitBuildEvent('build:paused', id, {});

  return res.json({
    id,
    status: 'paused',
    message: 'Build paused'
  });
}));

/**
 * POST /api/builds/:id/resume
 * Resume a paused build from checkpoint
 */
router.post('/:id/resume', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const build = await getBuildExecution(id);
  if (!build) {
    throw new BuildNotFoundError(id);
  }

  if (build.status !== 'paused' && build.status !== 'failed') {
    return res.status(400).json({
      error: 'Build can only be resumed from paused or failed state',
      code: 'INVALID_STATE',
      currentStatus: build.status
    });
  }

  // Get latest checkpoint
  const checkpoint = await getLatestCheckpoint(id);

  await updateBuildExecution(id, {
    status: 'running'
  });
  await saveDb();

  // Emit WebSocket event
  emitBuildEvent('build:resumed', id, {
    fromCheckpoint: checkpoint?.id || null
  });

  return res.json({
    id,
    status: 'running',
    message: 'Build resumed',
    checkpoint: checkpoint ? {
      id: checkpoint.id,
      taskId: checkpoint.task_id,
      createdAt: checkpoint.created_at
    } : null
  });
}));

/**
 * POST /api/builds/:id/cancel
 * Cancel a build execution
 */
router.post('/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const build = await getBuildExecution(id);
  if (!build) {
    throw new BuildNotFoundError(id);
  }

  if (build.status === 'completed' || build.status === 'cancelled') {
    return res.status(400).json({
      error: `Build has already ${build.status}`,
      code: 'BUILD_FINISHED'
    });
  }

  await updateBuildExecution(id, {
    status: 'cancelled',
    completedAt: new Date().toISOString()
  });
  await saveDb();

  // Emit WebSocket event
  emitBuildEvent('build:cancelled', id, {});

  return res.json({
    id,
    status: 'cancelled',
    message: 'Build cancelled'
  });
}));

/**
 * GET /api/builds/:id/checkpoint
 * Get the latest checkpoint for a build
 */
router.get('/:id/checkpoint', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const build = await getBuildExecution(id);
  if (!build) {
    throw new BuildNotFoundError(id);
  }

  const checkpoint = await getLatestCheckpoint(id);

  if (!checkpoint) {
    return res.status(404).json({
      error: 'No checkpoint found',
      code: 'CHECKPOINT_NOT_FOUND',
      buildId: id
    });
  }

  return res.json({
    id: checkpoint.id,
    buildId: checkpoint.build_id,
    taskId: checkpoint.task_id,
    type: checkpoint.checkpoint_type,
    state: JSON.parse(checkpoint.state_json),
    completedTasks: checkpoint.completed_tasks ? JSON.parse(checkpoint.completed_tasks) : [],
    pendingTasks: checkpoint.pending_tasks ? JSON.parse(checkpoint.pending_tasks) : [],
    createdAt: checkpoint.created_at
  });
}));

export default router;
