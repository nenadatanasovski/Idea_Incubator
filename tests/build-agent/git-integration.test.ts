/**
 * Git Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  GitIntegration,
  createGitIntegration,
} from "../../agents/build/git-integration.js";

// Mock child_process
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

import { exec } from "child_process";

describe("git-integration", () => {
  let git: GitIntegration;
  const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

  // Helper to mock exec
  const mockExecSuccess = (stdout: string = "", stderr: string = "") => {
    mockExec.mockImplementation(
      (
        cmd: string,
        opts: unknown,
        callback?: (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void,
      ) => {
        const cb = typeof opts === "function" ? opts : callback;
        if (cb) {
          cb(null, { stdout, stderr });
        }
      },
    );
  };

  const mockExecError = (error: Error) => {
    mockExec.mockImplementation(
      (
        cmd: string,
        opts: unknown,
        callback?: (
          err: Error | null,
          result: { stdout: string; stderr: string },
        ) => void,
      ) => {
        const cb = typeof opts === "function" ? opts : callback;
        if (cb) {
          cb(error, { stdout: "", stderr: "" });
        }
      },
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    git = new GitIntegration();
    mockExecSuccess();
  });

  describe("constructor", () => {
    it("should create integration with default options", () => {
      const defaultGit = new GitIntegration();
      expect(defaultGit).toBeDefined();
      expect(defaultGit.getCommitPrefix()).toBe("build(auto)");
      expect(defaultGit.getAutoStage()).toBe(true);
    });

    it("should accept custom commit prefix", () => {
      const customGit = new GitIntegration({ commitPrefix: "feat(build)" });
      expect(customGit.getCommitPrefix()).toBe("feat(build)");
    });

    it("should accept custom cwd", () => {
      const customGit = new GitIntegration({ cwd: "/custom/path" });
      expect(customGit.getCwd()).toBe("/custom/path");
    });

    it("should accept autoStage option", () => {
      const customGit = new GitIntegration({ autoStage: false });
      expect(customGit.getAutoStage()).toBe(false);
    });
  });

  describe("isGitRepo", () => {
    it("should return true for git repo", async () => {
      mockExecSuccess("true");

      const result = await git.isGitRepo();

      expect(result).toBe(true);
    });

    it("should return false for non-git directory", async () => {
      mockExecError(new Error("not a git repository"));

      const result = await git.isGitRepo();

      expect(result).toBe(false);
    });
  });

  describe("hasChanges", () => {
    it("should return true for unstaged changes", async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback?: (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void,
        ) => {
          const cb = typeof opts === "function" ? opts : callback;
          if (cmd.includes("diff --name-only") && !cmd.includes("--cached")) {
            cb?.(null, { stdout: "changed-file.ts\n", stderr: "" });
          } else {
            cb?.(null, { stdout: "", stderr: "" });
          }
        },
      );

      const result = await git.hasChanges("changed-file.ts");

      expect(result).toBe(true);
    });

    it("should return true for untracked files", async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback?: (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void,
        ) => {
          const cb = typeof opts === "function" ? opts : callback;
          if (cmd.includes("ls-files --others")) {
            cb?.(null, { stdout: "new-file.ts\n", stderr: "" });
          } else {
            cb?.(null, { stdout: "", stderr: "" });
          }
        },
      );

      const result = await git.hasChanges("new-file.ts");

      expect(result).toBe(true);
    });

    it("should return true for staged changes", async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback?: (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void,
        ) => {
          const cb = typeof opts === "function" ? opts : callback;
          if (cmd.includes("diff --cached")) {
            cb?.(null, { stdout: "staged-file.ts\n", stderr: "" });
          } else {
            cb?.(null, { stdout: "", stderr: "" });
          }
        },
      );

      const result = await git.hasChanges("staged-file.ts");

      expect(result).toBe(true);
    });

    it("should return false for no changes", async () => {
      mockExecSuccess("");

      const result = await git.hasChanges("unchanged-file.ts");

      expect(result).toBe(false);
    });
  });

  describe("stageFile", () => {
    it("should stage file successfully", async () => {
      mockExecSuccess();

      const result = await git.stageFile("file.ts");

      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      mockExecError(new Error("git add failed"));

      const result = await git.stageFile("file.ts");

      expect(result).toBe(false);
    });
  });

  describe("unstageFile", () => {
    it("should unstage file successfully", async () => {
      mockExecSuccess();

      const result = await git.unstageFile("file.ts");

      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      mockExecError(new Error("git reset failed"));

      const result = await git.unstageFile("file.ts");

      expect(result).toBe(false);
    });
  });

  describe("commit", () => {
    it("should commit file successfully", async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback?: (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void,
        ) => {
          const cb = typeof opts === "function" ? opts : callback;
          if (cmd.includes("rev-parse --is-inside-work-tree")) {
            cb?.(null, { stdout: "true", stderr: "" });
          } else if (cmd.includes("diff") || cmd.includes("ls-files")) {
            cb?.(null, { stdout: "file.ts\n", stderr: "" });
          } else if (cmd.includes("git add")) {
            cb?.(null, { stdout: "", stderr: "" });
          } else if (cmd.includes("git commit")) {
            cb?.(null, {
              stdout: "[main abc1234] build(auto): complete T-001",
              stderr: "",
            });
          } else {
            cb?.(null, { stdout: "", stderr: "" });
          }
        },
      );

      const result = await git.commit("T-001", "file.ts");

      expect(result.success).toBe(true);
      expect(result.commitHash).toBe("abc1234");
    });

    it("should fail if not a git repo", async () => {
      mockExecError(new Error("not a git repo"));

      const result = await git.commit("T-001", "file.ts");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not a git repository");
    });

    it("should fail if no changes", async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback?: (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void,
        ) => {
          const cb = typeof opts === "function" ? opts : callback;
          if (cmd.includes("rev-parse --is-inside-work-tree")) {
            cb?.(null, { stdout: "true", stderr: "" });
          } else {
            cb?.(null, { stdout: "", stderr: "" }); // No changes
          }
        },
      );

      const result = await git.commit("T-001", "file.ts");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No changes");
    });

    it("should include description in message", async () => {
      let capturedCmd = "";
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback?: (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void,
        ) => {
          const cb = typeof opts === "function" ? opts : callback;
          if (cmd.includes("git commit")) {
            capturedCmd = cmd;
          }
          if (cmd.includes("rev-parse --is-inside-work-tree")) {
            cb?.(null, { stdout: "true", stderr: "" });
          } else if (cmd.includes("diff") || cmd.includes("ls-files")) {
            cb?.(null, { stdout: "file.ts\n", stderr: "" });
          } else if (cmd.includes("git commit")) {
            cb?.(null, { stdout: "[main abc1234] commit", stderr: "" });
          } else {
            cb?.(null, { stdout: "", stderr: "" });
          }
        },
      );

      await git.commit("T-001", "file.ts", "add new feature");

      expect(capturedCmd).toContain("add new feature");
    });
  });

  describe("commitMultiple", () => {
    it("should commit multiple files", async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback?: (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void,
        ) => {
          const cb = typeof opts === "function" ? opts : callback;
          if (cmd.includes("rev-parse --is-inside-work-tree")) {
            cb?.(null, { stdout: "true", stderr: "" });
          } else if (
            cmd.includes("diff --cached --name-only") &&
            !cmd.includes('"')
          ) {
            cb?.(null, { stdout: "file1.ts\nfile2.ts\n", stderr: "" });
          } else if (cmd.includes("diff") || cmd.includes("ls-files")) {
            cb?.(null, { stdout: "file.ts\n", stderr: "" });
          } else if (cmd.includes("git commit")) {
            cb?.(null, { stdout: "[main def5678] commit", stderr: "" });
          } else {
            cb?.(null, { stdout: "", stderr: "" });
          }
        },
      );

      const result = await git.commitMultiple("T-001", [
        "file1.ts",
        "file2.ts",
      ]);

      expect(result.success).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("should return status with changes", async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          opts: unknown,
          callback?: (
            err: Error | null,
            result: { stdout: string; stderr: string },
          ) => void,
        ) => {
          const cb = typeof opts === "function" ? opts : callback;
          if (cmd.includes("diff --cached")) {
            cb?.(null, { stdout: "staged.ts\n", stderr: "" });
          } else if (cmd.includes("diff --name-only")) {
            cb?.(null, { stdout: "modified.ts\n", stderr: "" });
          } else if (cmd.includes("ls-files --others")) {
            cb?.(null, { stdout: "untracked.ts\n", stderr: "" });
          } else {
            cb?.(null, { stdout: "", stderr: "" });
          }
        },
      );

      const status = await git.getStatus();

      expect(status.hasChanges).toBe(true);
      expect(status.staged).toContain("staged.ts");
      expect(status.unstaged).toContain("modified.ts");
      expect(status.untracked).toContain("untracked.ts");
    });

    it("should return empty status on error", async () => {
      mockExecError(new Error("git error"));

      const status = await git.getStatus();

      expect(status.hasChanges).toBe(false);
      expect(status.staged).toEqual([]);
    });
  });

  describe("getCurrentBranch", () => {
    it("should return branch name", async () => {
      mockExecSuccess("main\n");

      const branch = await git.getCurrentBranch();

      expect(branch).toBe("main");
    });

    it("should return null on error", async () => {
      mockExecError(new Error("not a git repo"));

      const branch = await git.getCurrentBranch();

      expect(branch).toBeNull();
    });
  });

  describe("getLastCommitHash", () => {
    it("should return commit hash", async () => {
      mockExecSuccess("abc123def456\n");

      const hash = await git.getLastCommitHash();

      expect(hash).toBe("abc123def456");
    });

    it("should return null on error", async () => {
      mockExecError(new Error("no commits"));

      const hash = await git.getLastCommitHash();

      expect(hash).toBeNull();
    });
  });

  describe("formatCommitMessage", () => {
    it("should format with default description", () => {
      const message = git.formatCommitMessage("T-001", "file.ts");

      expect(message).toContain("build(auto)");
      expect(message).toContain("T-001");
      expect(message).toContain("file.ts");
      expect(message).toContain("complete T-001");
    });

    it("should format with custom description", () => {
      const message = git.formatCommitMessage(
        "T-001",
        "file.ts",
        "add new feature",
      );

      expect(message).toContain("add new feature");
    });

    it("should use custom prefix", () => {
      git.setCommitPrefix("feat(build)");
      const message = git.formatCommitMessage("T-001", "file.ts");

      expect(message).toContain("feat(build)");
    });
  });

  describe("setters", () => {
    it("should set cwd", () => {
      git.setCwd("/new/path");
      expect(git.getCwd()).toBe("/new/path");
    });

    it("should set commit prefix", () => {
      git.setCommitPrefix("fix");
      expect(git.getCommitPrefix()).toBe("fix");
    });

    it("should set auto stage", () => {
      git.setAutoStage(false);
      expect(git.getAutoStage()).toBe(false);
    });
  });

  describe("createGitIntegration", () => {
    it("should create instance", () => {
      const instance = createGitIntegration();
      expect(instance).toBeInstanceOf(GitIntegration);
    });

    it("should pass options", () => {
      const instance = createGitIntegration({ commitPrefix: "chore" });
      expect(instance.getCommitPrefix()).toBe("chore");
    });
  });
});
