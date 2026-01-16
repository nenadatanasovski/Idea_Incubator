// agents/ux/db.ts - UX Agent database operations

import { v4 as uuid } from "uuid";
import { getDb } from "../../database/db.js";
import {
  UXRun,
  UXStepResult,
  UXAccessibilityIssue,
  StepResult,
  AccessibilityIssue,
} from "../../types/ux.js";

/**
 * Database row type for ux_runs table
 */
interface UXRunRow {
  id: string;
  build_id: string | null;
  journey_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  passed: number;
  summary_json: string;
}

/**
 * Database row type for ux_step_results table
 */
interface UXStepResultRow {
  id: string;
  run_id: string;
  step_index: number;
  action: string;
  target: string | null;
  status: string;
  passed: number;
  error: string | null;
  screenshot_path: string | null;
  duration_ms: number;
  created_at: string;
}

/**
 * Database row type for ux_accessibility_issues table
 */
interface UXAccessibilityIssueRow {
  id: string;
  run_id: string;
  rule_id: string;
  impact: string;
  description: string;
  selector: string;
  help_url: string;
  created_at: string;
}

/**
 * Map database row to UXRun model
 */
function mapRowToUXRun(row: UXRunRow): UXRun {
  return {
    id: row.id,
    buildId: row.build_id,
    journeyId: row.journey_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    passed: row.passed,
    summaryJson: row.summary_json,
  };
}

/**
 * Map database row to UXStepResult model
 */
function mapRowToStepResult(row: UXStepResultRow): UXStepResult {
  return {
    id: row.id,
    runId: row.run_id,
    stepIndex: row.step_index,
    action: row.action,
    target: row.target,
    status: row.status,
    passed: row.passed,
    error: row.error,
    screenshotPath: row.screenshot_path,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

/**
 * Map database row to UXAccessibilityIssue model
 */
function mapRowToAccessibilityIssue(
  row: UXAccessibilityIssueRow,
): UXAccessibilityIssue {
  return {
    id: row.id,
    runId: row.run_id,
    ruleId: row.rule_id,
    impact: row.impact,
    description: row.description,
    selector: row.selector,
    helpUrl: row.help_url,
    createdAt: row.created_at,
  };
}

/**
 * Save a UX run to the database
 */
export async function saveUXRun(run: UXRun): Promise<void> {
  const db = await getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO ux_runs (id, build_id, journey_id, status, started_at, completed_at, passed, summary_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    run.id,
    run.buildId,
    run.journeyId,
    run.status,
    run.startedAt,
    run.completedAt,
    run.passed,
    run.summaryJson,
  ]);
  stmt.step();
  stmt.free();
}

/**
 * Save step results for a run
 */
export async function saveStepResults(
  runId: string,
  steps: StepResult[],
): Promise<void> {
  const db = await getDb();

  for (const step of steps) {
    const stmt = db.prepare(`
      INSERT INTO ux_step_results (id, run_id, step_index, action, target, status, passed, error, screenshot_path, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.bind([
      uuid(),
      runId,
      step.stepIndex,
      step.action,
      step.target || null,
      step.status,
      step.status === "passed" ? 1 : 0,
      step.error || null,
      step.screenshotPath || null,
      step.durationMs,
    ]);
    stmt.step();
    stmt.free();
  }
}

/**
 * Save accessibility issues for a run
 */
export async function saveAccessibilityIssues(
  runId: string,
  issues: AccessibilityIssue[],
): Promise<void> {
  const db = await getDb();

  for (const issue of issues) {
    const stmt = db.prepare(`
      INSERT INTO ux_accessibility_issues (id, run_id, rule_id, impact, description, selector, help_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.bind([
      uuid(),
      runId,
      issue.ruleId,
      issue.impact,
      issue.description,
      issue.selector,
      issue.helpUrl,
    ]);
    stmt.step();
    stmt.free();
  }
}

/**
 * Get a UX run by ID
 */
export async function getUXRun(id: string): Promise<UXRun | null> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM ux_runs WHERE id = ?");
  stmt.bind([id]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as UXRunRow;
    stmt.free();
    return mapRowToUXRun(row);
  }

  stmt.free();
  return null;
}

/**
 * Get step results for a run
 */
export async function getStepResults(runId: string): Promise<UXStepResult[]> {
  const db = await getDb();
  const stmt = db.prepare(
    "SELECT * FROM ux_step_results WHERE run_id = ? ORDER BY step_index",
  );
  stmt.bind([runId]);

  const results: UXStepResult[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as UXStepResultRow;
    results.push(mapRowToStepResult(row));
  }
  stmt.free();
  return results;
}

/**
 * Get accessibility issues for a run
 */
export async function getAccessibilityIssues(
  runId: string,
): Promise<UXAccessibilityIssue[]> {
  const db = await getDb();
  const stmt = db.prepare(
    "SELECT * FROM ux_accessibility_issues WHERE run_id = ?",
  );
  stmt.bind([runId]);

  const results: UXAccessibilityIssue[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as UXAccessibilityIssueRow;
    results.push(mapRowToAccessibilityIssue(row));
  }
  stmt.free();
  return results;
}

/**
 * Get recent UX runs
 */
export async function getRecentRuns(limit: number = 20): Promise<UXRun[]> {
  const db = await getDb();
  const stmt = db.prepare(
    "SELECT * FROM ux_runs ORDER BY started_at DESC LIMIT ?",
  );
  stmt.bind([limit]);

  const results: UXRun[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as UXRunRow;
    results.push(mapRowToUXRun(row));
  }
  stmt.free();
  return results;
}

/**
 * Get runs by journey ID
 */
export async function getRunsByJourney(
  journeyId: string,
  limit: number = 10,
): Promise<UXRun[]> {
  const db = await getDb();
  const stmt = db.prepare(
    "SELECT * FROM ux_runs WHERE journey_id = ? ORDER BY started_at DESC LIMIT ?",
  );
  stmt.bind([journeyId, limit]);

  const results: UXRun[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as UXRunRow;
    results.push(mapRowToUXRun(row));
  }
  stmt.free();
  return results;
}
