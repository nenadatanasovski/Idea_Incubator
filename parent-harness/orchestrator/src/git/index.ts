/**
 * Git Integration
 *
 * Provides git operations for agents:
 * - Auto-commit changes
 * - Create branches
 * - Push to remote
 * - Track file changes per task
 */

import { exec } from "child_process";
import { promisify } from "util";
import { run, query, getOne } from "../db/index.js";
import { events } from "../db/events.js";
import { notify } from "../telegram/index.js";
import { v4 as uuidv4 } from "uuid";

const execAsync = promisify(exec);

// Codebase root
const CODEBASE_ROOT =
  process.env.CODEBASE_ROOT ||
  "/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator";

export interface GitCommit {
  id: string;
  task_id: string | null;
  session_id: string | null;
  agent_id: string | null;
  commit_hash: string;
  message: string;
  branch: string;
  files_changed: string; // JSON array
  insertions: number;
  deletions: number;
  created_at: string;
}

// Ensure git commits table exists
function ensureGitTable(): void {
  run(
    `
    CREATE TABLE IF NOT EXISTS git_commits (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      session_id TEXT,
      agent_id TEXT,
      commit_hash TEXT NOT NULL,
      message TEXT NOT NULL,
      branch TEXT NOT NULL,
      files_changed TEXT,
      insertions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,
    [],
  );

  run(
    `CREATE INDEX IF NOT EXISTS idx_git_commits_task ON git_commits(task_id)`,
    [],
  );
  run(
    `CREATE INDEX IF NOT EXISTS idx_git_commits_hash ON git_commits(commit_hash)`,
    [],
  );
}

ensureGitTable();

/**
 * Execute git command
 */
async function gitExec(
  command: string,
  cwd: string = CODEBASE_ROOT,
): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`git ${command}`, {
      cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    throw new Error(`Git error: ${err.stderr || err.message}`);
  }
}

/**
 * Get current branch
 */
export async function getCurrentBranch(): Promise<string> {
  return gitExec("rev-parse --abbrev-ref HEAD");
}

/**
 * Get current commit hash
 */
export async function getCurrentHash(): Promise<string> {
  return gitExec("rev-parse HEAD");
}

/**
 * Check if working directory is clean
 */
export async function isWorkingDirectoryClean(): Promise<boolean> {
  const status = await gitExec("status --porcelain");
  return status.length === 0;
}

/**
 * Get list of changed files
 */
export async function getChangedFiles(): Promise<string[]> {
  const status = await gitExec("status --porcelain");
  if (!status) return [];

  return status
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter((file) => file.length > 0);
}

/**
 * Get diff stats
 */
export async function getDiffStats(): Promise<{
  insertions: number;
  deletions: number;
}> {
  try {
    const stats = await gitExec("diff --stat --cached");
    const match = stats.match(
      /(\d+) insertions?\(\+\).*?(\d+) deletions?\(-\)/,
    );
    if (match) {
      return {
        insertions: parseInt(match[1], 10),
        deletions: parseInt(match[2], 10),
      };
    }
    return { insertions: 0, deletions: 0 };
  } catch {
    return { insertions: 0, deletions: 0 };
  }
}

/**
 * Stage all changes
 */
export async function stageAll(): Promise<void> {
  await gitExec("add -A");
}

/**
 * Commit changes
 */
export async function commit(
  message: string,
  options?: { taskId?: string; sessionId?: string; agentId?: string },
): Promise<GitCommit | null> {
  // Stage all changes
  await stageAll();

  // Check if there are changes to commit
  const changedFiles = await getChangedFiles();
  if (changedFiles.length === 0) {
    console.log("📝 No changes to commit");
    return null;
  }

  // Get stats before commit
  const stats = await getDiffStats();
  const branch = await getCurrentBranch();

  // Commit
  await gitExec(`commit -m "${message.replace(/"/g, '\\"')}"`);

  // Get commit hash
  const hash = await getCurrentHash();

  // Record in database
  const id = uuidv4();
  run(
    `
    INSERT INTO git_commits (id, task_id, session_id, agent_id, commit_hash, message, branch, files_changed, insertions, deletions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      options?.taskId || null,
      options?.sessionId || null,
      options?.agentId || null,
      hash,
      message,
      branch,
      JSON.stringify(changedFiles),
      stats.insertions,
      stats.deletions,
    ],
  );

  // Log event
  events.toolCompleted(
    options?.agentId || "git",
    options?.sessionId || "",
    "git_commit",
    `${hash.slice(0, 7)}: ${message}`,
  );

  console.log(
    `📝 Committed ${hash.slice(0, 7)}: ${message} (${changedFiles.length} files)`,
  );

  return getCommit(id);
}

/**
 * Push to remote
 */
export async function push(
  remote: string = "origin",
  branch?: string,
): Promise<boolean> {
  try {
    const currentBranch = branch || (await getCurrentBranch());
    await gitExec(`push ${remote} ${currentBranch}`);

    // Notify via Telegram
    await notify.systemStatus(0, 0, 0); // Would need custom notification
    console.log(`⬆️ Pushed to ${remote}/${currentBranch}`);

    return true;
  } catch (error) {
    console.error("Push failed:", error);
    return false;
  }
}

/**
 * Create and checkout a branch
 */
export async function createBranch(branchName: string): Promise<boolean> {
  try {
    await gitExec(`checkout -b ${branchName}`);
    console.log(`🌿 Created branch ${branchName}`);
    return true;
  } catch (error) {
    console.error("Branch creation failed:", error);
    return false;
  }
}

/**
 * Checkout existing branch
 */
export async function checkout(branchName: string): Promise<boolean> {
  try {
    await gitExec(`checkout ${branchName}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get commit record
 */
export function getCommit(id: string): GitCommit | null {
  return (
    getOne<GitCommit>("SELECT * FROM git_commits WHERE id = ?", [id]) || null
  );
}

/**
 * Get commits for a task
 */
export function getTaskCommits(taskId: string): GitCommit[] {
  return query<GitCommit>(
    "SELECT * FROM git_commits WHERE task_id = ? ORDER BY created_at DESC",
    [taskId],
  );
}

/**
 * Get recent commits
 */
export function getRecentCommits(limit: number = 10): GitCommit[] {
  return query<GitCommit>(
    "SELECT * FROM git_commits ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
}

/**
 * Auto-commit for a task completion
 */
export async function autoCommitForTask(
  taskId: string,
  taskDisplayId: string,
  agentId: string,
  sessionId: string,
): Promise<GitCommit | null> {
  const message = `feat(${taskDisplayId}): Task completed by ${agentId}`;
  return commit(message, { taskId, sessionId, agentId });
}

export default {
  getCurrentBranch,
  getCurrentHash,
  isWorkingDirectoryClean,
  getChangedFiles,
  getDiffStats,
  stageAll,
  commit,
  push,
  createBranch,
  checkout,
  getCommit,
  getTaskCommits,
  getRecentCommits,
  autoCommitForTask,
};
