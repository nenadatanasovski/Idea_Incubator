// agents/sia/pattern-extractor.ts - Extract reusable patterns from successful tasks

import { ExtractedPattern, TaskResult } from "../../types/sia.js";
import { inferActionType } from "./extraction-rules.js";

/**
 * Extract reusable patterns from successful task results
 */
export function extractPatterns(successes: TaskResult[]): ExtractedPattern[] {
  const patterns: ExtractedPattern[] = [];

  for (const success of successes) {
    const pattern = identifyPattern(success);
    if (pattern) {
      patterns.push(pattern);
    }
  }

  return deduplicatePatterns(patterns);
}

/**
 * Identify if a successful task contains a reusable pattern
 */
export function identifyPattern(task: TaskResult): ExtractedPattern | null {
  if (!task.codeWritten || task.status !== "success") {
    return null;
  }

  // Look for common reusable patterns
  const patterns = [
    detectRouterPattern(task),
    detectDatabasePattern(task),
    detectValidatorPattern(task),
    detectTestPattern(task),
  ];

  return patterns.find((p) => p !== null) || null;
}

/**
 * Detect Express router pattern
 */
function detectRouterPattern(task: TaskResult): ExtractedPattern | null {
  const code = task.codeWritten || "";

  if (
    code.includes("Router()") &&
    code.includes("router.get") &&
    code.includes("export default router")
  ) {
    return {
      description: "Express Router with async handlers",
      codeTemplate: `import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Implementation
    res.json({ data: [] });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;`,
      filePattern: "server/routes/*.ts",
      actionType: inferActionType(task.action),
      taskId: task.taskId,
    };
  }

  return null;
}

/**
 * Detect database query pattern
 */
function detectDatabasePattern(task: TaskResult): ExtractedPattern | null {
  const code = task.codeWritten || "";

  if (
    code.includes("getDb()") &&
    code.includes("db.prepare") &&
    code.includes("stmt.free()")
  ) {
    return {
      description: "sql.js database query with proper resource cleanup",
      codeTemplate: `import { getDb } from '../../database/db.js';

export async function queryData(id: string): Promise<DataType | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM table WHERE id = ?');
  stmt.bind([id]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject();
  stmt.free();

  return {
    id: row.id as string,
    // ... map other fields
  };
}`,
      filePattern: "*.ts",
      actionType: inferActionType(task.action),
      taskId: task.taskId,
    };
  }

  return null;
}

/**
 * Detect validator pattern
 */
function detectValidatorPattern(task: TaskResult): ExtractedPattern | null {
  const code = task.codeWritten || "";

  if (
    code.includes("spawn") &&
    code.includes("validator") &&
    code.includes("passed")
  ) {
    return {
      description: "Subprocess validator with timeout",
      codeTemplate: `import { spawn } from 'child_process';
import { v4 as uuid } from 'uuid';
import { ValidatorResult } from '../../types/validation.js';

export async function runValidator(
  runId: string,
  args: string[],
  timeoutMs: number
): Promise<ValidatorResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const proc = spawn('command', args);

    let output = '';
    let passed = true;

    const timeout = setTimeout(() => {
      proc.kill();
      passed = false;
    }, timeoutMs);

    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        id: uuid(),
        runId,
        validatorName: 'validator-name',
        status: 'completed',
        passed: code === 0 && passed,
        output,
        durationMs: Date.now() - startTime,
        createdAt: new Date().toISOString(),
      });
    });
  });
}`,
      filePattern: "agents/*/validators/*.ts",
      actionType: inferActionType(task.action),
      taskId: task.taskId,
    };
  }

  return null;
}

/**
 * Detect test pattern
 */
function detectTestPattern(task: TaskResult): ExtractedPattern | null {
  const code = task.codeWritten || "";

  if (
    code.includes("describe") &&
    code.includes("it(") &&
    code.includes("expect")
  ) {
    return {
      description: "Vitest test suite structure",
      codeTemplate: `import { describe, it, expect } from 'vitest';

describe('FeatureName', () => {
  describe('SubFeature', () => {
    it('should do something', () => {
      const result = functionToTest();
      expect(result).toBe(expectedValue);
    });

    it('should handle edge case', () => {
      expect(() => functionToTest(null)).toThrow();
    });
  });
});`,
      filePattern: "tests/*.ts",
      actionType: inferActionType(task.action),
      taskId: task.taskId,
    };
  }

  return null;
}

/**
 * Remove duplicate patterns (same description)
 */
function deduplicatePatterns(patterns: ExtractedPattern[]): ExtractedPattern[] {
  const seen = new Map<string, ExtractedPattern>();

  for (const pattern of patterns) {
    if (!seen.has(pattern.description)) {
      seen.set(pattern.description, pattern);
    }
  }

  return Array.from(seen.values());
}
