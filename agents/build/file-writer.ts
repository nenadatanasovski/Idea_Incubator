/**
 * File Writer for Build Agent
 *
 * Writes files with backup, atomic operations, and locking.
 */

import * as fs from "fs";
import * as path from "path";
import { FileWriterInterface } from "./task-executor.js";

const BACKUP_SUFFIX = ".backup";
const TEMP_SUFFIX = ".tmp";
const DEFAULT_BACKUP_DIR = ".build-backups";

export interface WriteResult {
  success: boolean;
  backupPath?: string;
  error?: string;
}

export interface FileWriterOptions {
  createBackup?: boolean;
  backupDir?: string;
  preservePermissions?: boolean;
  projectRoot?: string;
}

export class FileWriter implements FileWriterInterface {
  private createBackup: boolean;
  private backupDir: string;
  private preservePermissions: boolean;
  private projectRoot: string;
  private locks: Set<string>;

  constructor(options: FileWriterOptions = {}) {
    this.createBackup = options.createBackup ?? true;
    this.backupDir = options.backupDir || DEFAULT_BACKUP_DIR;
    this.preservePermissions = options.preservePermissions ?? true;
    this.projectRoot = options.projectRoot || process.cwd();
    this.locks = new Set();
  }

  /**
   * Write content to a file with backup and atomic operations
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    const fullPath = this.resolvePath(filePath);

    // Check lock
    if (this.isLocked(fullPath)) {
      return {
        success: false,
        error: `File is locked: ${filePath}`,
      };
    }

    try {
      // Acquire lock
      this.lock(fullPath);

      // Ensure directory exists
      this.ensureDirectory(fullPath);

      // Get existing file permissions if file exists
      let mode: number | undefined;
      if (this.preservePermissions && fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        mode = stats.mode;
      }

      // Create backup if file exists
      let backupPath: string | undefined;
      if (this.createBackup && fs.existsSync(fullPath)) {
        backupPath = this.backup(fullPath) ?? undefined;
      }

      // Write to temp file first
      const tempPath = fullPath + TEMP_SUFFIX;
      fs.writeFileSync(tempPath, content, "utf-8");

      // Apply permissions to temp file if preserved
      if (mode !== undefined) {
        fs.chmodSync(tempPath, mode);
      }

      // Atomic rename
      fs.renameSync(tempPath, fullPath);

      return {
        success: true,
        backupPath,
      };
    } catch (error) {
      // Clean up temp file if it exists
      const tempPath = fullPath + TEMP_SUFFIX;
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Release lock
      this.unlock(fullPath);
    }
  }

  /**
   * Create a backup of the file
   */
  backup(filePath: string): string | null {
    const fullPath = this.resolvePath(filePath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    try {
      // Create backup directory
      const backupDirPath = path.join(this.projectRoot, this.backupDir);
      if (!fs.existsSync(backupDirPath)) {
        fs.mkdirSync(backupDirPath, { recursive: true });
      }

      // Create backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const basename = path.basename(fullPath);
      const backupName = `${basename}.${timestamp}${BACKUP_SUFFIX}`;
      const backupPath = path.join(backupDirPath, backupName);

      // Copy file to backup
      fs.copyFileSync(fullPath, backupPath);

      return backupPath;
    } catch {
      return null;
    }
  }

  /**
   * Restore a file from backup
   */
  restore(filePath: string, backupPath: string): boolean {
    const fullPath = this.resolvePath(filePath);

    if (!fs.existsSync(backupPath)) {
      return false;
    }

    try {
      fs.copyFileSync(backupPath, fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure the directory for a file exists
   */
  ensureDirectory(filePath: string): void {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Lock a file for exclusive access
   */
  lock(filePath: string): boolean {
    const fullPath = this.resolvePath(filePath);

    if (this.locks.has(fullPath)) {
      return false;
    }

    this.locks.add(fullPath);
    return true;
  }

  /**
   * Unlock a file
   */
  unlock(filePath: string): boolean {
    const fullPath = this.resolvePath(filePath);
    return this.locks.delete(fullPath);
  }

  /**
   * Check if a file is locked
   */
  isLocked(filePath: string): boolean {
    const fullPath = this.resolvePath(filePath);
    return this.locks.has(fullPath);
  }

  /**
   * Delete a file
   */
  delete(filePath: string): boolean {
    const fullPath = this.resolvePath(filePath);

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    try {
      fs.unlinkSync(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file exists
   */
  exists(filePath: string): boolean {
    const fullPath = this.resolvePath(filePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Read a file
   */
  read(filePath: string): string | null {
    const fullPath = this.resolvePath(filePath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    try {
      return fs.readFileSync(fullPath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Resolve a relative path to absolute
   */
  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.projectRoot, filePath);
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
   * Clean up old backups (keep only last N)
   */
  cleanupBackups(keepLast: number = 5): number {
    const backupDirPath = path.join(this.projectRoot, this.backupDir);

    if (!fs.existsSync(backupDirPath)) {
      return 0;
    }

    try {
      const files = fs
        .readdirSync(backupDirPath)
        .filter((f) => f.endsWith(BACKUP_SUFFIX))
        .map((f) => ({
          name: f,
          path: path.join(backupDirPath, f),
          mtime: fs.statSync(path.join(backupDirPath, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      let deleted = 0;
      for (let i = keepLast; i < files.length; i++) {
        fs.unlinkSync(files[i].path);
        deleted++;
      }

      return deleted;
    } catch {
      return 0;
    }
  }
}

/**
 * Create a file writer instance
 */
export function createFileWriter(options?: FileWriterOptions): FileWriter {
  return new FileWriter(options);
}
