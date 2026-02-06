/**
 * Git API Routes
 */
import { Router } from 'express';
import * as git from '../git/index.js';

const router = Router();

/**
 * GET /api/git/status
 * Get git status
 */
router.get('/status', async (_req, res) => {
  try {
    const [branch, hash, clean, changedFiles] = await Promise.all([
      git.getCurrentBranch(),
      git.getCurrentHash(),
      git.isWorkingDirectoryClean(),
      git.getChangedFiles(),
    ]);

    res.json({
      branch,
      hash,
      clean,
      changedFiles,
      changedCount: changedFiles.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/git/commits
 * Get recent commits
 */
router.get('/commits', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const commits = git.getRecentCommits(limit);
  res.json(commits);
});

/**
 * GET /api/git/commits/task/:taskId
 * Get commits for a task
 */
router.get('/commits/task/:taskId', (req, res) => {
  const commits = git.getTaskCommits(req.params.taskId);
  res.json(commits);
});

/**
 * POST /api/git/commit
 * Create a commit
 */
router.post('/commit', async (req, res) => {
  const { message, taskId, sessionId, agentId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const commit = await git.commit(message, { taskId, sessionId, agentId });
    
    if (!commit) {
      return res.json({ success: false, message: 'No changes to commit' });
    }

    res.json({ success: true, commit });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/git/push
 * Push to remote
 */
router.post('/push', async (req, res) => {
  const { remote = 'origin', branch } = req.body;

  try {
    const success = await git.push(remote, branch);
    res.json({ success });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/git/branch
 * Create a branch
 */
router.post('/branch', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const success = await git.createBranch(name);
    res.json({ success, branch: name });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as gitRouter };
