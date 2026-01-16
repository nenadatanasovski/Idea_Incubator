/**
 * Checkpoint Manager for Build Agent
 *
 * Saves and restores build state for resumable execution.
 */

import * as fs from "fs";
import * as path from "path";
import { BuildCheckpoint } from "../../types/build-agent.js";

const DEFAULT_CHECKPOINT_DIR = ".build-checkpoints";

export interface BuildState {
  buildId: string;
  completedTasks: string[];
  failedTasks: string[];
  currentTaskIndex: number;
  context: Record<string, unknown>;
  startedAt: string;
  lastUpdatedAt: string;
}

export interface CheckpointManagerOptions {
  checkpointDir?: string;
  projectRoot?: string;
  maxCheckpoints?: number;
}

export class CheckpointManager {
  private checkpointDir: string;
  private projectRoot: string;
  private maxCheckpoints: number;

  constructor(options: CheckpointManagerOptions = {}) {
    this.checkpointDir = options.checkpointDir || DEFAULT_CHECKPOINT_DIR;
    this.projectRoot = options.projectRoot || process.cwd();
    this.maxCheckpoints = options.maxCheckpoints || 10;
  }

  /**
   * Save checkpoint for a build
   */
  save(buildId: string, taskId: string, state: BuildState): string {
    const checkpointPath = this.getCheckpointPath(buildId);
    this.ensureDirectory();

    const checkpoint: BuildCheckpoint = {
      id: this.generateId(),
      buildId,
      taskId,
      stateJson: JSON.stringify(state),
      createdAt: new Date().toISOString(),
    };

    // Load existing checkpoints
    const checkpoints = this.loadCheckpoints(buildId);
    checkpoints.push(checkpoint);

    // Write checkpoints
    fs.writeFileSync(
      checkpointPath,
      JSON.stringify(checkpoints, null, 2),
      "utf-8",
    );

    // Cleanup old checkpoints if needed
    this.cleanup(buildId, this.maxCheckpoints);

    return checkpoint.id;
  }

  /**
   * Load latest checkpoint for a build
   */
  load(buildId: string): BuildState | null {
    const checkpoints = this.loadCheckpoints(buildId);

    if (checkpoints.length === 0) {
      return null;
    }

    // Get the latest checkpoint
    const latest = checkpoints[checkpoints.length - 1];

    try {
      return JSON.parse(latest.stateJson);
    } catch {
      return null;
    }
  }

  /**
   * Load checkpoint by ID
   */
  loadById(buildId: string, checkpointId: string): BuildState | null {
    const checkpoints = this.loadCheckpoints(buildId);
    const checkpoint = checkpoints.find((cp) => cp.id === checkpointId);

    if (!checkpoint) {
      return null;
    }

    try {
      return JSON.parse(checkpoint.stateJson);
    } catch {
      return null;
    }
  }

  /**
   * Load all checkpoints for a build
   */
  loadCheckpoints(buildId: string): BuildCheckpoint[] {
    const checkpointPath = this.getCheckpointPath(buildId);

    if (!fs.existsSync(checkpointPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(checkpointPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  /**
   * Get checkpoint at specific task
   */
  getCheckpointAtTask(buildId: string, taskId: string): BuildState | null {
    const checkpoints = this.loadCheckpoints(buildId);
    const checkpoint = checkpoints.find((cp) => cp.taskId === taskId);

    if (!checkpoint) {
      return null;
    }

    try {
      return JSON.parse(checkpoint.stateJson);
    } catch {
      return null;
    }
  }

  /**
   * List all build IDs with checkpoints
   */
  listBuilds(): string[] {
    const dirPath = this.getCheckpointDir();

    if (!fs.existsSync(dirPath)) {
      return [];
    }

    try {
      return fs
        .readdirSync(dirPath)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));
    } catch {
      return [];
    }
  }

  /**
   * Clean up old checkpoints, keeping only the last N
   */
  cleanup(buildId: string, keepLast: number): number {
    const checkpointPath = this.getCheckpointPath(buildId);
    const checkpoints = this.loadCheckpoints(buildId);

    if (checkpoints.length <= keepLast) {
      return 0;
    }

    const toKeep = checkpoints.slice(-keepLast);
    const removed = checkpoints.length - toKeep.length;

    fs.writeFileSync(checkpointPath, JSON.stringify(toKeep, null, 2), "utf-8");

    return removed;
  }

  /**
   * Delete all checkpoints for a build
   */
  delete(buildId: string): boolean {
    const checkpointPath = this.getCheckpointPath(buildId);

    if (!fs.existsSync(checkpointPath)) {
      return false;
    }

    try {
      fs.unlinkSync(checkpointPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if build has checkpoints
   */
  hasCheckpoints(buildId: string): boolean {
    const checkpoints = this.loadCheckpoints(buildId);
    return checkpoints.length > 0;
  }

  /**
   * Get checkpoint count for a build
   */
  getCheckpointCount(buildId: string): number {
    const checkpoints = this.loadCheckpoints(buildId);
    return checkpoints.length;
  }

  /**
   * Create initial build state
   */
  createInitialState(buildId: string): BuildState {
    return {
      buildId,
      completedTasks: [],
      failedTasks: [],
      currentTaskIndex: 0,
      context: {},
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  /**
   * Update state with task completion
   */
  updateStateWithTask(
    state: BuildState,
    taskId: string,
    success: boolean,
  ): BuildState {
    const updatedState = { ...state };

    if (success) {
      updatedState.completedTasks = [...state.completedTasks, taskId];
    } else {
      updatedState.failedTasks = [...state.failedTasks, taskId];
    }

    updatedState.currentTaskIndex = state.currentTaskIndex + 1;
    updatedState.lastUpdatedAt = new Date().toISOString();

    return updatedState;
  }

  /**
   * Get checkpoint directory path
   */
  private getCheckpointDir(): string {
    return path.join(this.projectRoot, this.checkpointDir);
  }

  /**
   * Get checkpoint file path for a build
   */
  private getCheckpointPath(buildId: string): string {
    return path.join(this.getCheckpointDir(), `${buildId}.json`);
  }

  /**
   * Ensure checkpoint directory exists
   */
  private ensureDirectory(): void {
    const dirPath = this.getCheckpointDir();

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Generate unique checkpoint ID
   */
  private generateId(): string {
    return `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Set project root
   */
  setProjectRoot(projectRoot: string): void {
    this.projectRoot = projectRoot;
  }

  /**
   * Get project root
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Set max checkpoints
   */
  setMaxCheckpoints(max: number): void {
    this.maxCheckpoints = max;
  }

  /**
   * Get max checkpoints
   */
  getMaxCheckpoints(): number {
    return this.maxCheckpoints;
  }
}

/**
 * Create a checkpoint manager instance
 */
export function createCheckpointManager(
  options?: CheckpointManagerOptions,
): CheckpointManager {
  return new CheckpointManager(options);
}
