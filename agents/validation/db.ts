// agents/validation/db.ts

import { getDb } from "../../database/db.js";
import { ValidationRun, ValidatorResult } from "../../types/validation.js";

export async function saveValidationRun(run: ValidationRun): Promise<void> {
  const db = await getDb();
  db.run(
    `
    INSERT INTO validation_runs (id, build_id, level, status, started_at, completed_at, passed, summary_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      run.id,
      run.buildId,
      run.level,
      run.status,
      run.startedAt,
      run.completedAt,
      run.passed ? 1 : 0,
      run.summaryJson,
    ],
  );
}

export async function saveValidatorResult(
  result: ValidatorResult,
): Promise<void> {
  const db = await getDb();
  db.run(
    `
    INSERT INTO validator_results (id, run_id, validator_name, status, passed, output, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [
      result.id,
      result.runId,
      result.validatorName,
      result.status,
      result.passed ? 1 : 0,
      result.output,
      result.durationMs,
    ],
  );
}

export async function getValidationRun(
  id: string,
): Promise<ValidationRun | null> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM validation_runs WHERE id = ?");
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return {
    id: row.id as string,
    buildId: row.build_id as string | null,
    level: row.level as ValidationRun["level"],
    status: row.status as ValidationRun["status"],
    passed: row.passed === 1,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | null,
    summaryJson: row.summary_json as string | null,
  };
}

export async function getValidatorResults(
  runId: string,
): Promise<ValidatorResult[]> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM validator_results WHERE run_id = ?");
  stmt.bind([runId]);
  const results: ValidatorResult[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.id as string,
      runId: row.run_id as string,
      validatorName: row.validator_name as string,
      status: row.status as ValidatorResult["status"],
      passed: row.passed === 1,
      output: row.output as string | null,
      durationMs: row.duration_ms as number | null,
      createdAt: row.created_at as string,
    });
  }
  stmt.free();
  return results;
}

export async function getValidationHistory(
  limit: number = 20,
): Promise<ValidationRun[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT * FROM validation_runs
    ORDER BY started_at DESC
    LIMIT ?
  `);
  stmt.bind([limit]);
  const results: ValidationRun[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.id as string,
      buildId: row.build_id as string | null,
      level: row.level as ValidationRun["level"],
      status: row.status as ValidationRun["status"],
      passed: row.passed === 1,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | null,
      summaryJson: row.summary_json as string | null,
    });
  }
  stmt.free();
  return results;
}
