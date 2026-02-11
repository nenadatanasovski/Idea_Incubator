/**
 * Wave Execution System
 *
 * Manages parallel execution of tasks in waves.
 * Each wave contains independent tasks that can run concurrently.
 * Tasks depend on previous waves being complete.
 */

import { query, run, getOne } from "../db/index.js";
import * as tasks from "../db/tasks.js";
import { events } from "../db/events.js";
import { ws } from "../websocket.js";
import { v4 as uuidv4 } from "uuid";

export interface Wave {
  id: string;
  run_id: string;
  wave_number: number;
  status: "pending" | "running" | "completed" | "failed";
  task_ids: string[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WaveRun {
  id: string;
  task_list_id: string;
  status: "planning" | "running" | "completed" | "failed" | "cancelled";
  total_waves: number;
  current_wave: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

// Ensure wave tables exist
function ensureWaveTables(): void {
  run(
    `
    CREATE TABLE IF NOT EXISTS wave_runs (
      id TEXT PRIMARY KEY,
      task_list_id TEXT NOT NULL,
      status TEXT DEFAULT 'planning',
      total_waves INTEGER DEFAULT 0,
      current_wave INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,
    [],
  );

  run(
    `
    CREATE TABLE IF NOT EXISTS waves (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      wave_number INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      task_ids TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES wave_runs(id)
    )
  `,
    [],
  );

  run(`CREATE INDEX IF NOT EXISTS idx_waves_run ON waves(run_id)`, []);
}

ensureWaveTables();

/**
 * Analyze tasks and create wave plan
 */
export function planWaves(taskListId: string): WaveRun {
  const allTasks = tasks.getTasks({ taskListId });

  // Get task dependencies
  const dependencies = query<{
    source_task_id: string;
    target_task_id: string;
  }>(
    `SELECT source_task_id, target_task_id 
     FROM task_relationships 
     WHERE relationship_type = 'depends_on'
     AND source_task_id IN (SELECT id FROM tasks WHERE task_list_id = ?)`,
    [taskListId],
  );

  // Build dependency map
  const dependsOn = new Map<string, Set<string>>();
  for (const dep of dependencies) {
    if (!dependsOn.has(dep.source_task_id)) {
      dependsOn.set(dep.source_task_id, new Set());
    }
    dependsOn.get(dep.source_task_id)!.add(dep.target_task_id);
  }

  // Assign wave numbers using topological sort
  const waveAssignments = new Map<string, number>();
  const visited = new Set<string>();

  function getWaveNumber(taskId: string): number {
    if (waveAssignments.has(taskId)) {
      return waveAssignments.get(taskId)!;
    }

    if (visited.has(taskId)) {
      // Cycle detected
      return 0;
    }

    visited.add(taskId);

    const deps = dependsOn.get(taskId);
    if (!deps || deps.size === 0) {
      waveAssignments.set(taskId, 0);
      return 0;
    }

    let maxDepWave = -1;
    for (const depId of deps) {
      maxDepWave = Math.max(maxDepWave, getWaveNumber(depId));
    }

    const wave = maxDepWave + 1;
    waveAssignments.set(taskId, wave);
    return wave;
  }

  // Calculate wave for each task
  for (const task of allTasks) {
    getWaveNumber(task.id);
  }

  // Group tasks by wave
  const waveGroups = new Map<number, string[]>();
  for (const task of allTasks) {
    const wave = waveAssignments.get(task.id) ?? 0;
    if (!waveGroups.has(wave)) {
      waveGroups.set(wave, []);
    }
    waveGroups.get(wave)!.push(task.id);
  }

  // Create wave run
  const runId = uuidv4();
  const totalWaves = Math.max(...Array.from(waveGroups.keys())) + 1;

  run(
    `
    INSERT INTO wave_runs (id, task_list_id, status, total_waves, current_wave)
    VALUES (?, ?, 'planning', ?, 0)
  `,
    [runId, taskListId, totalWaves],
  );

  // Create wave records
  for (const [waveNum, taskIds] of waveGroups.entries()) {
    run(
      `
      INSERT INTO waves (id, run_id, wave_number, status, task_ids)
      VALUES (?, ?, ?, 'pending', ?)
    `,
      [uuidv4(), runId, waveNum, JSON.stringify(taskIds)],
    );

    // Update tasks with wave number
    for (const taskId of taskIds) {
      tasks.updateTask(taskId, { wave_number: waveNum } as any);
    }
  }

  console.log(`📋 Planned ${totalWaves} waves for task list ${taskListId}`);

  return getWaveRun(runId)!;
}

/**
 * Start executing waves
 */
export function startWaveRun(runId: string): WaveRun | null {
  const waveRun = getWaveRun(runId);
  if (!waveRun) return null;

  run(`UPDATE wave_runs SET status = 'running' WHERE id = ?`, [runId]);

  // Start first wave
  startNextWave(runId);

  return getWaveRun(runId);
}

/**
 * Start the next wave
 */
export function startNextWave(runId: string): Wave | null {
  const waveRun = getWaveRun(runId);
  if (!waveRun) return null;

  // Find next pending wave
  const nextWave = getOne<Wave & { task_ids: string }>(
    `SELECT * FROM waves WHERE run_id = ? AND status = 'pending' ORDER BY wave_number ASC LIMIT 1`,
    [runId],
  );

  if (!nextWave) {
    // All waves complete
    run(
      `UPDATE wave_runs SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
      [runId],
    );
    console.log(`✅ Wave run ${runId} completed`);
    return null;
  }

  // Start the wave
  run(
    `UPDATE waves SET status = 'running', started_at = datetime('now') WHERE id = ?`,
    [nextWave.id],
  );
  run(`UPDATE wave_runs SET current_wave = ? WHERE id = ?`, [
    nextWave.wave_number,
    runId,
  ]);

  // Set tasks in wave to pending (ready for assignment)
  const taskIds = JSON.parse(nextWave.task_ids) as string[];
  for (const taskId of taskIds) {
    tasks.updateTask(taskId, { status: "pending" });
  }

  console.log(
    `🌊 Started wave ${nextWave.wave_number} with ${taskIds.length} tasks`,
  );

  return {
    ...nextWave,
    task_ids: taskIds,
  };
}

/**
 * Check if current wave is complete
 */
export function checkWaveCompletion(runId: string): boolean {
  const waveRun = getWaveRun(runId);
  if (!waveRun) return false;

  const currentWave = getOne<Wave & { task_ids: string }>(
    `SELECT * FROM waves WHERE run_id = ? AND status = 'running'`,
    [runId],
  );

  if (!currentWave) return false;

  const taskIds = JSON.parse(currentWave.task_ids) as string[];

  // Check if all tasks in wave are complete or failed
  const taskStatuses = tasks.getTasks({}).filter((t) => taskIds.includes(t.id));
  const allDone = taskStatuses.every(
    (t) => t.status === "completed" || t.status === "failed",
  );

  if (allDone) {
    // Mark wave as complete
    const anyFailed = taskStatuses.some((t) => t.status === "failed");
    run(
      `
      UPDATE waves 
      SET status = ?, completed_at = datetime('now') 
      WHERE id = ?
    `,
      [anyFailed ? "failed" : "completed", currentWave.id],
    );

    if (anyFailed) {
      console.log(`⚠️ Wave ${currentWave.wave_number} completed with failures`);
    } else {
      console.log(`✅ Wave ${currentWave.wave_number} completed successfully`);
    }

    // Start next wave
    startNextWave(runId);
    return true;
  }

  return false;
}

/**
 * Get wave run details
 */
export function getWaveRun(runId: string): WaveRun | null {
  return (
    getOne<WaveRun>("SELECT * FROM wave_runs WHERE id = ?", [runId]) ?? null
  );
}

/**
 * Get waves for a run
 */
export function getWaves(runId: string): Wave[] {
  const rows = query<Wave & { task_ids: string }>(
    "SELECT * FROM waves WHERE run_id = ? ORDER BY wave_number ASC",
    [runId],
  );

  return rows.map((row) => ({
    ...row,
    task_ids: JSON.parse(row.task_ids),
  }));
}

/**
 * Get all wave runs
 */
export function getWaveRuns(): WaveRun[] {
  return query<WaveRun>("SELECT * FROM wave_runs ORDER BY created_at DESC");
}

export default {
  planWaves,
  startWaveRun,
  startNextWave,
  checkWaveCompletion,
  getWaveRun,
  getWaves,
  getWaveRuns,
};
