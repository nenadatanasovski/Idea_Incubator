/**
 * Planning Agent System
 * 
 * Strategic planning for improvements and task generation.
 * Analyzes patterns and creates high-level improvement tasks.
 */

import { query, run, getOne } from '../db/index.js';
import * as tasks from '../db/tasks.js';
import * as memory from '../memory/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface PlanningSession {
  id: string;
  type: 'daily' | 'weekly' | 'incident' | 'optimization';
  status: 'planning' | 'completed' | 'cancelled';
  input_data: string; // JSON
  analysis: string | null;
  recommendations: string | null; // JSON array
  tasks_created: string | null; // JSON array of task IDs
  created_at: string;
  completed_at: string | null;
}

// Ensure planning table exists
function ensurePlanningTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS planning_sessions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'planning',
      input_data TEXT NOT NULL,
      analysis TEXT,
      recommendations TEXT,
      tasks_created TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `, []);
}

ensurePlanningTable();

/**
 * Analyze recent performance and patterns
 */
export function analyzePerformance(): {
  successRate: number;
  avgTaskDuration: number;
  commonErrors: string[];
  bottlenecks: string[];
  recommendations: string[];
} {
  // Get recent task statistics
  const taskStats = getOne<{ total: number; completed: number; failed: number }>(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM tasks 
    WHERE created_at > datetime('now', '-7 days')`
  );

  const successRate = taskStats && taskStats.total > 0
    ? (taskStats.completed / taskStats.total) * 100
    : 100;

  // Get common error patterns from agent memory
  const errorPatterns = query<{ key: string; access_count: number }>(
    `SELECT key, access_count FROM agent_memory 
     WHERE type = 'error_pattern' 
     ORDER BY access_count DESC LIMIT 5`
  );

  // Identify bottlenecks
  const bottlenecks: string[] = [];
  
  // Check for tasks stuck too long
  const stuckTasks = getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM tasks 
     WHERE status = 'in_progress' 
     AND started_at < datetime('now', '-2 hours')`
  );
  if ((stuckTasks?.count ?? 0) > 0) {
    bottlenecks.push(`${stuckTasks!.count} tasks stuck for 2+ hours`);
  }

  // Check agent utilization
  const agentStats = getOne<{ working: number; idle: number }>(
    `SELECT 
      SUM(CASE WHEN status = 'working' THEN 1 ELSE 0 END) as working,
      SUM(CASE WHEN status = 'idle' THEN 1 ELSE 0 END) as idle
    FROM agents`
  );
  if (agentStats && agentStats.idle > agentStats.working * 2) {
    bottlenecks.push('Low agent utilization - consider adding more tasks');
  }

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (successRate < 80) {
    recommendations.push('Improve task specifications to reduce failures');
  }
  if (errorPatterns.length > 0) {
    recommendations.push(`Address recurring error: ${errorPatterns[0].key}`);
  }
  if (bottlenecks.length > 0) {
    recommendations.push('Review and resolve identified bottlenecks');
  }

  return {
    successRate,
    avgTaskDuration: 0, // Would calculate from completed tasks
    commonErrors: errorPatterns.map(e => e.key),
    bottlenecks,
    recommendations,
  };
}

/**
 * Create a planning session
 */
export function createPlanningSession(
  type: PlanningSession['type'],
  inputData: object
): PlanningSession {
  const id = uuidv4();

  run(`
    INSERT INTO planning_sessions (id, type, input_data)
    VALUES (?, ?, ?)
  `, [id, type, JSON.stringify(inputData)]);

  return getPlanningSession(id)!;
}

/**
 * Complete a planning session with analysis
 */
export function completePlanningSession(
  sessionId: string,
  analysis: string,
  recommendations: string[],
  createdTaskIds: string[]
): PlanningSession | undefined {
  run(`
    UPDATE planning_sessions 
    SET status = 'completed',
        analysis = ?,
        recommendations = ?,
        tasks_created = ?,
        completed_at = datetime('now')
    WHERE id = ?
  `, [
    analysis,
    JSON.stringify(recommendations),
    JSON.stringify(createdTaskIds),
    sessionId,
  ]);

  return getPlanningSession(sessionId);
}

/**
 * Get a planning session
 */
export function getPlanningSession(id: string): PlanningSession | undefined {
  return getOne<PlanningSession>('SELECT * FROM planning_sessions WHERE id = ?', [id]);
}

/**
 * Create improvement task from recommendation
 */
export async function createImprovementTask(
  taskListId: string,
  recommendation: string,
  priority: tasks.Task['priority'] = 'P2'
): Promise<tasks.Task> {
  // Generate display ID
  const lastTask = getOne<{ display_id: string }>(
    "SELECT display_id FROM tasks ORDER BY created_at DESC LIMIT 1"
  );
  const lastNum = lastTask?.display_id 
    ? parseInt(lastTask.display_id.replace('TASK-', ''), 10) 
    : 0;
  const displayId = `TASK-${String(lastNum + 1).padStart(3, '0')}`;

  return tasks.createTask({
    display_id: displayId,
    title: recommendation,
    description: `Auto-generated improvement task from planning analysis.`,
    category: 'improvement',
    priority,
    task_list_id: taskListId,
    pass_criteria: [
      'Implementation complete',
      'No regressions introduced',
      'Tests pass',
    ],
  });
}

/**
 * Run daily planning analysis
 */
export async function runDailyPlanning(taskListId: string): Promise<PlanningSession> {
  // Create planning session
  const analysis = analyzePerformance();
  const session = createPlanningSession('daily', analysis);

  // Create tasks for recommendations
  const createdTaskIds: string[] = [];
  
  for (const rec of analysis.recommendations.slice(0, 3)) { // Max 3 tasks
    const task = await createImprovementTask(taskListId, rec, 'P3');
    createdTaskIds.push(task.id);
  }

  // Complete the session
  completePlanningSession(
    session.id,
    `Daily analysis: ${analysis.successRate.toFixed(1)}% success rate, ${analysis.bottlenecks.length} bottlenecks identified`,
    analysis.recommendations,
    createdTaskIds
  );

  console.log(`📊 Daily planning complete: ${createdTaskIds.length} improvement tasks created`);

  return getPlanningSession(session.id)!;
}

export default {
  analyzePerformance,
  createPlanningSession,
  completePlanningSession,
  getPlanningSession,
  createImprovementTask,
  runDailyPlanning,
};
