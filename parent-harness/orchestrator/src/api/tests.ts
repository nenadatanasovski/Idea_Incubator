import { Router } from "express";
import { query, getOne, run } from "../db/index.js";
import { v4 as uuidv4 } from "uuid";

export const testsRouter = Router();

interface TestSuite {
  id: string;
  name: string;
  description: string | null;
  type: string;
  source: string | null;
  phase: number | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface TestRun {
  id: string;
  suite_id: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  skipped_cases: number;
  triggered_by: string | null;
  created_at: string;
}

/**
 * GET /api/tests/suites
 * List all test suites
 */
testsRouter.get("/suites", (_req, res) => {
  const suites = query<TestSuite>(
    "SELECT * FROM test_suites ORDER BY phase ASC, name ASC",
  );
  res.json(suites);
});

/**
 * GET /api/tests/suites/:id
 * Get a single test suite with cases
 */
testsRouter.get("/suites/:id", (req, res) => {
  const suite = getOne<TestSuite>("SELECT * FROM test_suites WHERE id = ?", [
    req.params.id,
  ]);
  if (!suite) {
    return res.status(404).json({ error: "Test suite not found", status: 404 });
  }

  const cases = query(
    "SELECT * FROM test_cases WHERE suite_id = ? ORDER BY created_at ASC",
    [req.params.id],
  );

  res.json({ ...suite, cases });
});

/**
 * GET /api/tests/runs
 * List test runs
 */
testsRouter.get("/runs", (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const offset = req.query.offset
    ? parseInt(req.query.offset as string, 10)
    : 0;

  const runs = query<TestRun>(
    "SELECT * FROM test_runs ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [limit, offset],
  );

  res.json(runs);
});

/**
 * GET /api/tests/runs/:id
 * Get a single test run with results
 */
testsRouter.get("/runs/:id", (req, res) => {
  const testRun = getOne<TestRun>("SELECT * FROM test_runs WHERE id = ?", [
    req.params.id,
  ]);
  if (!testRun) {
    return res.status(404).json({ error: "Test run not found", status: 404 });
  }

  const suiteResults = query(
    "SELECT * FROM test_suite_results WHERE run_id = ?",
    [req.params.id],
  );

  const caseResults = query(
    "SELECT * FROM test_case_results WHERE run_id = ?",
    [req.params.id],
  );

  res.json({
    ...testRun,
    suiteResults,
    caseResults,
  });
});

/**
 * POST /api/tests/runs
 * Trigger a new test run
 */
testsRouter.post("/runs", (req, res) => {
  const { suiteId, triggeredBy } = req.body;

  const id = uuidv4();

  run(
    `
    INSERT INTO test_runs (id, suite_id, status, started_at, triggered_by)
    VALUES (?, ?, 'running', datetime('now'), ?)
  `,
    [id, suiteId ?? null, triggeredBy ?? "api"],
  );

  const testRun = getOne<TestRun>("SELECT * FROM test_runs WHERE id = ?", [id]);
  res.status(201).json(testRun);
});

/**
 * PATCH /api/tests/runs/:id
 * Update a test run
 */
testsRouter.patch("/runs/:id", (req, res) => {
  const testRun = getOne<TestRun>("SELECT * FROM test_runs WHERE id = ?", [
    req.params.id,
  ]);
  if (!testRun) {
    return res.status(404).json({ error: "Test run not found", status: 404 });
  }

  const { status, totalCases, passedCases, failedCases, skippedCases } =
    req.body;

  const updates: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (status) {
    updates.push("status = ?");
    params.push(status);
    if (status === "passed" || status === "failed" || status === "cancelled") {
      updates.push("ended_at = datetime('now')");
    }
  }
  if (totalCases !== undefined) {
    updates.push("total_cases = ?");
    params.push(totalCases);
  }
  if (passedCases !== undefined) {
    updates.push("passed_cases = ?");
    params.push(passedCases);
  }
  if (failedCases !== undefined) {
    updates.push("failed_cases = ?");
    params.push(failedCases);
  }
  if (skippedCases !== undefined) {
    updates.push("skipped_cases = ?");
    params.push(skippedCases);
  }

  params.push(req.params.id);
  run(`UPDATE test_runs SET ${updates.join(", ")} WHERE id = ?`, params);

  const updated = getOne<TestRun>("SELECT * FROM test_runs WHERE id = ?", [
    req.params.id,
  ]);
  res.json(updated);
});
