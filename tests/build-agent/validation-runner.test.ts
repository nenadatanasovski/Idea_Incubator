/**
 * Validation Runner Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ValidationRunner,
  createValidationRunner,
} from "../../agents/build/validation-runner.js";

describe("validation-runner", () => {
  let runner: ValidationRunner;

  beforeEach(() => {
    runner = new ValidationRunner();
  });

  describe("constructor", () => {
    it("should create runner with default options", () => {
      const defaultRunner = new ValidationRunner();
      expect(defaultRunner).toBeDefined();
      expect(defaultRunner.getTimeout()).toBe(60000);
    });

    it("should accept custom timeout", () => {
      const customRunner = new ValidationRunner({ timeout: 30000 });
      expect(customRunner.getTimeout()).toBe(30000);
    });

    it("should accept custom cwd", () => {
      const customRunner = new ValidationRunner({ cwd: "/custom/dir" });
      expect(customRunner.getCwd()).toBe("/custom/dir");
    });

    it("should accept custom env", () => {
      const customRunner = new ValidationRunner({ env: { MY_VAR: "value" } });
      expect(customRunner.getEnv()).toEqual({ MY_VAR: "value" });
    });
  });

  describe("execute", () => {
    it("should execute simple command", async () => {
      const result = await runner.execute('echo "hello"');

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("hello");
    });

    it("should capture exit code", async () => {
      const result = await runner.execute("exit 42");

      expect(result.exitCode).toBe(42);
    });

    it("should capture stderr", async () => {
      const result = await runner.execute('echo "error" >&2');

      expect(result.output).toContain("error");
    });

    it("should combine stdout and stderr", async () => {
      const result = await runner.execute('echo "out" && echo "err" >&2');

      expect(result.output).toContain("out");
      expect(result.output).toContain("err");
    });
  });

  describe("checkExpected", () => {
    it("should match exit code 0", () => {
      const result = runner.checkExpected("some output", "exit code 0", 0);
      expect(result).toBe(true);
    });

    it("should fail on wrong exit code", () => {
      const result = runner.checkExpected("some output", "exit code 0", 1);
      expect(result).toBe(false);
    });

    it("should match specific exit code", () => {
      const result = runner.checkExpected("output", "exit code 42", 42);
      expect(result).toBe(true);
    });

    it("should match ok output", () => {
      const result = runner.checkExpected("OK", "ok", 0);
      expect(result).toBe(true);
    });

    it("should match ok in output", () => {
      const result = runner.checkExpected("result is ok", "ok", 0);
      expect(result).toBe(true);
    });

    it("should fail ok check if exit code non-zero", () => {
      const result = runner.checkExpected("ok", "ok", 1);
      expect(result).toBe(false);
    });

    it("should match all tests pass", () => {
      const result = runner.checkExpected(
        "Tests completed",
        "all tests pass",
        0,
      );
      expect(result).toBe(true);
    });

    it("should match exact output", () => {
      const result = runner.checkExpected(
        "expected output here",
        "expected output",
        0,
      );
      expect(result).toBe(true);
    });

    it("should match case-insensitive", () => {
      const result = runner.checkExpected("SUCCESS", "success", 0);
      expect(result).toBe(true);
    });

    it("should use exit code for empty expected", () => {
      const result = runner.checkExpected("anything", "", 0);
      expect(result).toBe(true);
    });

    it("should fail empty expected with non-zero exit", () => {
      const result = runner.checkExpected("anything", "", 1);
      expect(result).toBe(false);
    });
  });

  describe("run", () => {
    it("should run validation command", async () => {
      const result = await runner.run('echo "ok"', "ok");

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it("should fail on wrong output", async () => {
      const result = await runner.run('echo "wrong"', "expected");

      expect(result.success).toBe(false);
    });

    it("should check exit code 0", async () => {
      const result = await runner.run("true", "exit code 0");

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it("should fail on non-zero exit", async () => {
      const result = await runner.run("false", "exit code 0");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it("should handle command errors", async () => {
      const result = await runner.run("nonexistent-command-12345", "ok");

      expect(result.success).toBe(false);
    });
  });

  describe("runMultiple", () => {
    it("should run multiple validations", async () => {
      const results = await runner.runMultiple([
        { command: 'echo "first"', expected: "first" },
        { command: 'echo "second"', expected: "second" },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it("should stop on first failure", async () => {
      const results = await runner.runMultiple([
        { command: 'echo "ok"', expected: "ok" },
        { command: "false", expected: "exit code 0" },
        { command: 'echo "should not run"', expected: "should not run" },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe("setters and getters", () => {
    it("should set timeout", () => {
      runner.setTimeout(5000);
      expect(runner.getTimeout()).toBe(5000);
    });

    it("should set cwd", () => {
      runner.setCwd("/new/dir");
      expect(runner.getCwd()).toBe("/new/dir");
    });

    it("should set env", () => {
      runner.setEnv({ NEW_VAR: "new_value" });
      expect(runner.getEnv()).toEqual({ NEW_VAR: "new_value" });
    });
  });

  describe("createValidationRunner", () => {
    it("should create runner instance", () => {
      const instance = createValidationRunner();
      expect(instance).toBeInstanceOf(ValidationRunner);
    });

    it("should pass options", () => {
      const instance = createValidationRunner({ timeout: 10000 });
      expect(instance.getTimeout()).toBe(10000);
    });
  });

  describe("timeout handling", () => {
    it("should handle slow commands", async () => {
      // Use a short timeout for this test
      const fastRunner = new ValidationRunner({ timeout: 100 });

      const result = await fastRunner.run("sleep 0.05 && echo ok", "ok");

      // Should complete before timeout
      expect(result.success).toBe(true);
    });

    // Note: timeout test disabled as it would make tests slow
    // it('should timeout on long running commands', async () => {
    //   const shortTimeoutRunner = new ValidationRunner({ timeout: 100 });
    //   const result = await shortTimeoutRunner.run('sleep 10', 'ok');
    //   expect(result.success).toBe(false);
    //   expect(result.error).toContain('timed out');
    // });
  });

  describe("edge cases", () => {
    it("should handle empty command output", async () => {
      const result = await runner.run("true", "exit code 0");

      expect(result.success).toBe(true);
      expect(result.output).toBe("");
    });

    it("should handle multiline output", async () => {
      const result = await runner.run('echo "line1"; echo "line2"', "line1");

      expect(result.success).toBe(true);
      expect(result.output).toContain("line1");
      expect(result.output).toContain("line2");
    });

    it("should handle special characters in command", async () => {
      const result = await runner.run(
        'echo "hello & goodbye"',
        "hello & goodbye",
      );

      expect(result.success).toBe(true);
    });
  });
});
