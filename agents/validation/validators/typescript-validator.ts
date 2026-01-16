// agents/validation/validators/typescript-validator.ts

import { spawn } from "child_process";
import { ValidatorResult } from "../../../types/validation";
import { v4 as uuid } from "uuid";

export async function runTypescriptValidator(
  runId: string,
  args: string[] = ["--noEmit"],
  timeoutMs: number = 30000,
): Promise<ValidatorResult> {
  const startTime = Date.now();
  const id = uuid();

  return new Promise((resolve) => {
    let output = "";
    const proc = spawn("npx", ["tsc", ...args], { shell: true });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), 5000);
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });
    proc.stderr.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      resolve({
        id,
        runId,
        validatorName: "typescript",
        status: "completed",
        passed: code === 0,
        output,
        durationMs,
        createdAt: new Date().toISOString(),
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        id,
        runId,
        validatorName: "typescript",
        status: "failed",
        passed: false,
        output: err.message,
        durationMs: Date.now() - startTime,
        createdAt: new Date().toISOString(),
      });
    });
  });
}
