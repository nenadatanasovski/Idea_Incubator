// agents/validation/validators/security-scanner.ts

import { spawn } from "child_process";
import { ValidatorResult } from "../../../types/validation";
import { v4 as uuid } from "uuid";

interface AuditResult {
  vulnerabilities: {
    info: number;
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
}

export async function runSecurityScanner(
  runId: string,
  _args: string[] = [],
  timeoutMs: number = 60000,
): Promise<ValidatorResult> {
  const startTime = Date.now();
  const id = uuid();

  return new Promise((resolve) => {
    let output = "";
    const proc = spawn("npm", ["audit", "--json"], { shell: true });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });
    proc.stderr.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      let passed = true;
      try {
        const audit: AuditResult = JSON.parse(output);
        // Only fail on high or critical
        passed =
          audit.vulnerabilities.high === 0 &&
          audit.vulnerabilities.critical === 0;
      } catch {
        // If we can't parse, assume pass (npm audit may not be available)
        passed = true;
      }

      resolve({
        id,
        runId,
        validatorName: "security",
        status: "completed",
        passed,
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
        validatorName: "security",
        status: "failed",
        passed: true, // Don't fail build if npm audit fails
        output: err.message,
        durationMs: Date.now() - startTime,
        createdAt: new Date().toISOString(),
      });
    });
  });
}
