/**
 * Task Version Routes
 *
 * REST API endpoints for task version history and checkpoints.
 * Part of: Task System V2 Implementation Plan (IMPL-5.7)
 */

import { Router, Request, Response } from 'express';
import { taskVersionService } from '../../services/task-agent/task-version-service.js';

const router = Router();

/**
 * Get version history
 * GET /api/task-agent/tasks/:taskId/versions
 */
router.get('/:taskId/versions', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const versions = await taskVersionService.getVersions(taskId);
    return res.json(versions);
  } catch (err) {
    console.error('[task-versions] Error getting versions:', err);
    return res.status(500).json({
      error: 'Failed to get versions',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * Get specific version
 * GET /api/task-agent/tasks/:taskId/versions/:version
 */
router.get('/:taskId/versions/:version', async (req: Request, res: Response) => {
  try {
    const { taskId, version } = req.params;
    const v = await taskVersionService.getVersion(taskId, parseInt(version, 10));

    if (!v) {
      return res.status(404).json({ error: 'Version not found' });
    }

    return res.json(v);
  } catch (err) {
    console.error('[task-versions] Error getting version:', err);
    return res.status(500).json({
      error: 'Failed to get version',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * Compare versions (diff)
 * GET /api/task-agent/tasks/:taskId/versions/diff
 */
router.get('/:taskId/versions/diff', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to version numbers are required' });
    }

    const diff = await taskVersionService.diff(
      taskId,
      parseInt(from as string, 10),
      parseInt(to as string, 10)
    );
    return res.json(diff);
  } catch (err) {
    console.error('[task-versions] Error calculating diff:', err);
    return res.status(500).json({
      error: 'Failed to calculate diff',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * Create checkpoint
 * POST /api/task-agent/tasks/:taskId/versions/checkpoint
 */
router.post('/:taskId/versions/checkpoint', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { name, reason, userId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Checkpoint name is required' });
    }

    const checkpoint = await taskVersionService.createCheckpoint(
      { taskId, name, reason },
      userId || 'system'
    );
    return res.status(201).json(checkpoint);
  } catch (err) {
    console.error('[task-versions] Error creating checkpoint:', err);
    return res.status(500).json({
      error: 'Failed to create checkpoint',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * List checkpoints
 * GET /api/task-agent/tasks/:taskId/versions/checkpoints
 */
router.get('/:taskId/versions/checkpoints', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const checkpoints = await taskVersionService.getCheckpoints(taskId);
    return res.json(checkpoints);
  } catch (err) {
    console.error('[task-versions] Error getting checkpoints:', err);
    return res.status(500).json({
      error: 'Failed to get checkpoints',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * Restore to version
 * POST /api/task-agent/tasks/:taskId/versions/restore
 */
router.post('/:taskId/versions/restore', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { targetVersion, reason, userId } = req.body;

    if (targetVersion === undefined) {
      return res.status(400).json({ error: 'targetVersion is required' });
    }

    const task = await taskVersionService.restore(
      { taskId, targetVersion, reason },
      userId || 'system'
    );
    return res.json(task);
  } catch (err) {
    console.error('[task-versions] Error restoring version:', err);
    return res.status(500).json({
      error: 'Failed to restore version',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * Preview restore
 * POST /api/task-agent/tasks/:taskId/versions/restore/preview
 */
router.post('/:taskId/versions/restore/preview', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { targetVersion } = req.body;

    if (targetVersion === undefined) {
      return res.status(400).json({ error: 'targetVersion is required' });
    }

    const diff = await taskVersionService.previewRestore(taskId, targetVersion);
    return res.json(diff);
  } catch (err) {
    console.error('[task-versions] Error previewing restore:', err);
    return res.status(500).json({
      error: 'Failed to preview restore',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
