/**
 * File Writer Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  FileWriter,
  createFileWriter,
} from "../../agents/build/file-writer.js";

describe("file-writer", () => {
  let writer: FileWriter;
  let testDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-writer-test-"));
    writer = new FileWriter({ projectRoot: testDir });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("should create writer with default options", () => {
      const defaultWriter = new FileWriter();
      expect(defaultWriter).toBeDefined();
    });

    it("should accept custom project root", () => {
      const customWriter = new FileWriter({ projectRoot: "/custom/root" });
      expect(customWriter.getProjectRoot()).toBe("/custom/root");
    });

    it("should accept custom backup dir", () => {
      const customWriter = new FileWriter({ backupDir: "my-backups" });
      expect(customWriter).toBeDefined();
    });
  });

  describe("write", () => {
    it("should write new file", async () => {
      const filePath = "test.txt";
      const content = "Hello, World!";

      const result = await writer.write(filePath, content);

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(testDir, filePath))).toBe(true);
      expect(fs.readFileSync(path.join(testDir, filePath), "utf-8")).toBe(
        content,
      );
    });

    it("should create directories if needed", async () => {
      const filePath = "nested/dir/test.txt";
      const content = "Nested content";

      const result = await writer.write(filePath, content);

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(testDir, filePath))).toBe(true);
    });

    it("should create backup of existing file", async () => {
      const filePath = "existing.txt";
      const fullPath = path.join(testDir, filePath);

      // Create existing file
      fs.writeFileSync(fullPath, "Original content");

      const result = await writer.write(filePath, "New content");

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(fs.existsSync(result.backupPath!)).toBe(true);
    });

    it("should not create backup if disabled", async () => {
      const noBackupWriter = new FileWriter({
        projectRoot: testDir,
        createBackup: false,
      });

      const filePath = "no-backup.txt";
      const fullPath = path.join(testDir, filePath);

      // Create existing file
      fs.writeFileSync(fullPath, "Original content");

      const result = await noBackupWriter.write(filePath, "New content");

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeUndefined();
    });

    it("should preserve file permissions", async () => {
      const filePath = "permission-test.txt";
      const fullPath = path.join(testDir, filePath);

      // Create file with specific permissions
      fs.writeFileSync(fullPath, "Original");
      fs.chmodSync(fullPath, 0o755);

      await writer.write(filePath, "Updated");

      const stats = fs.statSync(fullPath);
      expect(stats.mode & 0o777).toBe(0o755);
    });

    it("should fail if file is locked", async () => {
      const filePath = "locked.txt";

      // Lock the file
      writer.lock(filePath);

      const result = await writer.write(filePath, "Content");

      expect(result.success).toBe(false);
      expect(result.error).toContain("locked");
    });

    it("should clean up temp file on error", async () => {
      // Test that temp files are cleaned up - mock fs to fail on rename
      const filePath = "cleanup-test.txt";
      const tempPath = path.join(testDir, filePath + ".tmp");

      // Create a directory where the file should be to cause rename to fail
      const fullPath = path.join(testDir, filePath);
      fs.mkdirSync(fullPath); // This will cause writeFileSync to succeed but rename to fail

      const result = await writer.write(filePath, "Content");

      expect(result.success).toBe(false);
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });

  describe("backup", () => {
    it("should create backup of existing file", () => {
      const filePath = "backup-test.txt";
      const fullPath = path.join(testDir, filePath);
      fs.writeFileSync(fullPath, "Content to backup");

      const backupPath = writer.backup(filePath);

      expect(backupPath).not.toBeNull();
      expect(fs.existsSync(backupPath!)).toBe(true);
    });

    it("should return null for non-existent file", () => {
      const backupPath = writer.backup("nonexistent.txt");
      expect(backupPath).toBeNull();
    });

    it("should include timestamp in backup name", () => {
      const filePath = "timestamp-test.txt";
      const fullPath = path.join(testDir, filePath);
      fs.writeFileSync(fullPath, "Content");

      const backupPath = writer.backup(filePath);

      expect(backupPath).toContain(".backup");
      expect(backupPath).toMatch(/\d{4}-\d{2}-\d{2}/); // Date pattern
    });
  });

  describe("restore", () => {
    it("should restore file from backup", async () => {
      const filePath = "restore-test.txt";
      const fullPath = path.join(testDir, filePath);

      // Create original file
      fs.writeFileSync(fullPath, "Original");

      // Create backup
      const backupPath = writer.backup(filePath)!;

      // Modify file
      fs.writeFileSync(fullPath, "Modified");

      // Restore
      const restored = writer.restore(filePath, backupPath);

      expect(restored).toBe(true);
      expect(fs.readFileSync(fullPath, "utf-8")).toBe("Original");
    });

    it("should return false for non-existent backup", () => {
      const restored = writer.restore("test.txt", "/nonexistent/backup.txt");
      expect(restored).toBe(false);
    });
  });

  describe("ensureDirectory", () => {
    it("should create nested directories", () => {
      const filePath = "a/b/c/file.txt";
      const dirPath = path.join(testDir, "a/b/c");

      writer.ensureDirectory(filePath);

      expect(fs.existsSync(dirPath)).toBe(true);
    });

    it("should not fail if directory exists", () => {
      const filePath = "existing-dir/file.txt";
      const dirPath = path.join(testDir, "existing-dir");
      fs.mkdirSync(dirPath);

      expect(() => writer.ensureDirectory(filePath)).not.toThrow();
    });
  });

  describe("locking", () => {
    it("should lock file", () => {
      const filePath = "lock-test.txt";

      const locked = writer.lock(filePath);

      expect(locked).toBe(true);
      expect(writer.isLocked(filePath)).toBe(true);
    });

    it("should not lock already locked file", () => {
      const filePath = "double-lock.txt";

      writer.lock(filePath);
      const secondLock = writer.lock(filePath);

      expect(secondLock).toBe(false);
    });

    it("should unlock file", () => {
      const filePath = "unlock-test.txt";

      writer.lock(filePath);
      const unlocked = writer.unlock(filePath);

      expect(unlocked).toBe(true);
      expect(writer.isLocked(filePath)).toBe(false);
    });

    it("should return false when unlocking non-locked file", () => {
      const unlocked = writer.unlock("not-locked.txt");
      expect(unlocked).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete existing file", () => {
      const filePath = "delete-test.txt";
      const fullPath = path.join(testDir, filePath);
      fs.writeFileSync(fullPath, "To delete");

      const deleted = writer.delete(filePath);

      expect(deleted).toBe(true);
      expect(fs.existsSync(fullPath)).toBe(false);
    });

    it("should return false for non-existent file", () => {
      const deleted = writer.delete("nonexistent.txt");
      expect(deleted).toBe(false);
    });
  });

  describe("exists", () => {
    it("should return true for existing file", () => {
      const filePath = "exists-test.txt";
      fs.writeFileSync(path.join(testDir, filePath), "Content");

      expect(writer.exists(filePath)).toBe(true);
    });

    it("should return false for non-existent file", () => {
      expect(writer.exists("nonexistent.txt")).toBe(false);
    });
  });

  describe("read", () => {
    it("should read existing file", () => {
      const filePath = "read-test.txt";
      const content = "Read this content";
      fs.writeFileSync(path.join(testDir, filePath), content);

      const result = writer.read(filePath);

      expect(result).toBe(content);
    });

    it("should return null for non-existent file", () => {
      const result = writer.read("nonexistent.txt");
      expect(result).toBeNull();
    });
  });

  describe("cleanupBackups", () => {
    it("should keep only last N backups", async () => {
      const filePath = "cleanup-backup.txt";
      const fullPath = path.join(testDir, filePath);

      // Create multiple backups
      for (let i = 0; i < 10; i++) {
        fs.writeFileSync(fullPath, `Content ${i}`);
        writer.backup(filePath);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const deleted = writer.cleanupBackups(3);

      expect(deleted).toBe(7);
    });

    it("should return 0 if no backup directory", () => {
      const noBackupWriter = new FileWriter({
        projectRoot: testDir,
        backupDir: "nonexistent-backups",
      });

      const deleted = noBackupWriter.cleanupBackups();

      expect(deleted).toBe(0);
    });
  });

  describe("setProjectRoot", () => {
    it("should update project root", () => {
      writer.setProjectRoot("/new/root");
      expect(writer.getProjectRoot()).toBe("/new/root");
    });
  });

  describe("createFileWriter", () => {
    it("should create writer instance", () => {
      const instance = createFileWriter();
      expect(instance).toBeInstanceOf(FileWriter);
    });

    it("should pass options", () => {
      const instance = createFileWriter({ projectRoot: "/custom" });
      expect(instance.getProjectRoot()).toBe("/custom");
    });
  });
});
