/**
 * Git Integration for Build Agent
 *
 * Handles git operations for automatic commits after successful tasks.
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const DEFAULT_COMMIT_PREFIX = "build(auto)";

export interface GitCommitResult {
  success: boolean;
  commitHash?: string;
  message?: string;
  error?: string;
}

export interface GitStatusResult {
  hasChanges: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export interface GitIntegrationOptions {
  cwd?: string;
  commitPrefix?: string;
  autoStage?: boolean;
}

export class GitIntegration {
  private cwd: string;
  private commitPrefix: string;
  private autoStage: boolean;

  constructor(options: GitIntegrationOptions = {}) {
    this.cwd = options.cwd || process.cwd();
    this.commitPrefix = options.commitPrefix || DEFAULT_COMMIT_PREFIX;
    this.autoStage = options.autoStage ?? true;
  }

  /**
   * Commit a file after successful task
   */
  async commit(
    taskId: string,
    filePath: string,
    description?: string,
  ): Promise<GitCommitResult> {
    try {
      // Check if git is available
      if (!(await this.isGitRepo())) {
        return {
          success: false,
          error: "Not a git repository",
        };
      }

      // Check if file has changes
      if (!(await this.hasChanges(filePath))) {
        return {
          success: false,
          error: "No changes to commit",
        };
      }

      // Stage the file if autoStage is enabled
      if (this.autoStage) {
        await this.stageFile(filePath);
      }

      // Create commit message
      const message = this.formatCommitMessage(taskId, filePath, description);

      // Commit
      const { stdout } = await execAsync(
        `git commit -m "${this.escapeQuotes(message)}"`,
        {
          cwd: this.cwd,
        },
      );

      // Extract commit hash
      const hashMatch = stdout.match(/\[.+ ([a-f0-9]+)\]/);
      const commitHash = hashMatch ? hashMatch[1] : undefined;

      return {
        success: true,
        commitHash,
        message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Commit multiple files
   */
  async commitMultiple(
    taskId: string,
    filePaths: string[],
    description?: string,
  ): Promise<GitCommitResult> {
    try {
      if (!(await this.isGitRepo())) {
        return { success: false, error: "Not a git repository" };
      }

      // Stage all files
      if (this.autoStage) {
        for (const filePath of filePaths) {
          if (await this.hasChanges(filePath)) {
            await this.stageFile(filePath);
          }
        }
      }

      // Check if anything is staged
      const status = await this.getStatus();
      if (status.staged.length === 0) {
        return { success: false, error: "No changes to commit" };
      }

      // Create commit message
      const message = this.formatCommitMessage(
        taskId,
        filePaths.join(", "),
        description,
      );

      const { stdout } = await execAsync(
        `git commit -m "${this.escapeQuotes(message)}"`,
        {
          cwd: this.cwd,
        },
      );

      const hashMatch = stdout.match(/\[.+ ([a-f0-9]+)\]/);

      return {
        success: true,
        commitHash: hashMatch?.[1],
        message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if current directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await execAsync("git rev-parse --is-inside-work-tree", { cwd: this.cwd });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file has changes
   */
  async hasChanges(filePath: string): Promise<boolean> {
    try {
      // Check for unstaged changes
      const { stdout: unstaged } = await execAsync(
        `git diff --name-only "${filePath}"`,
        {
          cwd: this.cwd,
        },
      );

      // Check for untracked files
      const { stdout: untracked } = await execAsync(
        `git ls-files --others --exclude-standard "${filePath}"`,
        {
          cwd: this.cwd,
        },
      );

      // Check for staged changes
      const { stdout: staged } = await execAsync(
        `git diff --cached --name-only "${filePath}"`,
        {
          cwd: this.cwd,
        },
      );

      return (
        unstaged.trim() !== "" ||
        untracked.trim() !== "" ||
        staged.trim() !== ""
      );
    } catch {
      return false;
    }
  }

  /**
   * Stage a file for commit
   */
  async stageFile(filePath: string): Promise<boolean> {
    try {
      await execAsync(`git add "${filePath}"`, { cwd: this.cwd });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Unstage a file
   */
  async unstageFile(filePath: string): Promise<boolean> {
    try {
      await execAsync(`git reset HEAD "${filePath}"`, { cwd: this.cwd });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get git status
   */
  async getStatus(): Promise<GitStatusResult> {
    try {
      const { stdout: stagedOutput } = await execAsync(
        "git diff --cached --name-only",
        {
          cwd: this.cwd,
        },
      );

      const { stdout: unstagedOutput } = await execAsync(
        "git diff --name-only",
        {
          cwd: this.cwd,
        },
      );

      const { stdout: untrackedOutput } = await execAsync(
        "git ls-files --others --exclude-standard",
        {
          cwd: this.cwd,
        },
      );

      const staged = stagedOutput.trim().split("\n").filter(Boolean);
      const unstaged = unstagedOutput.trim().split("\n").filter(Boolean);
      const untracked = untrackedOutput.trim().split("\n").filter(Boolean);

      return {
        hasChanges:
          staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
        staged,
        unstaged,
        untracked,
      };
    } catch {
      return {
        hasChanges: false,
        staged: [],
        unstaged: [],
        untracked: [],
      };
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string | null> {
    try {
      const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", {
        cwd: this.cwd,
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Get last commit hash
   */
  async getLastCommitHash(): Promise<string | null> {
    try {
      const { stdout } = await execAsync("git rev-parse HEAD", {
        cwd: this.cwd,
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Format commit message using conventional commit format
   */
  formatCommitMessage(
    taskId: string,
    filePath: string,
    description?: string,
  ): string {
    const desc = description || `complete ${taskId}`;
    return `${this.commitPrefix}: ${desc}\n\nTask: ${taskId}\nFile: ${filePath}`;
  }

  /**
   * Escape quotes in string for shell
   */
  private escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"');
  }

  /**
   * Set working directory
   */
  setCwd(cwd: string): void {
    this.cwd = cwd;
  }

  /**
   * Get working directory
   */
  getCwd(): string {
    return this.cwd;
  }

  /**
   * Set commit prefix
   */
  setCommitPrefix(prefix: string): void {
    this.commitPrefix = prefix;
  }

  /**
   * Get commit prefix
   */
  getCommitPrefix(): string {
    return this.commitPrefix;
  }

  /**
   * Set auto stage
   */
  setAutoStage(autoStage: boolean): void {
    this.autoStage = autoStage;
  }

  /**
   * Get auto stage
   */
  getAutoStage(): boolean {
    return this.autoStage;
  }
}

/**
 * Create a git integration instance
 */
export function createGitIntegration(
  options?: GitIntegrationOptions,
): GitIntegration {
  return new GitIntegration(options);
}
