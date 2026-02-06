/**
 * Planning Agent System
 * 
 * Spawns a planning agent to analyze the codebase and create implementation tasks.
 * This is the brain of the autonomous system.
 */

import { query, run, getOne } from '../db/index.js';
import * as tasks from '../db/tasks.js';
import * as spawner from '../spawner/index.js';
import { notify } from '../telegram/index.js';
import { v4 as uuidv4 } from 'uuid';

const CODEBASE_ROOT = process.env.CODEBASE_ROOT || '/home/ned-atanasovski/Documents/Idea_Incubator/Idea_Incubator';

export interface PlanningSession {
  id: string;
  type: 'daily' | 'weekly' | 'incident' | 'optimization' | 'initial';
  status: 'planning' | 'completed' | 'cancelled';
  input_data: string;
  analysis: string | null;
  recommendations: string | null;
  tasks_created: string | null;
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
 * Build the planning agent prompt
 */
function buildPlanningPrompt(): string {
  return `You are a Planning Agent for the Vibe Platform codebase at ${CODEBASE_ROOT}.

## YOUR MISSION
Analyze the current state of the codebase and create a prioritized implementation plan.

## WHAT TO ANALYZE
1. Read CLAUDE.md, README.md, or any project documentation to understand the project
2. Check parent-harness/docs/ for architecture and requirements
3. Look at existing test failures: run \`npm test 2>&1 | tail -100\`
4. Check TypeScript errors: run \`npm run build 2>&1 | tail -100\`
5. Review any TODO comments or incomplete features

## OUTPUT FORMAT
Create a prioritized list of tasks in this exact format:

### TASK_LIST_START ###
TASK: <title>
CATEGORY: feature|bug|test|documentation|improvement
PRIORITY: P0|P1|P2|P3
DESCRIPTION: <detailed description of what needs to be done>
PASS_CRITERIA:
- <criterion 1>
- <criterion 2>
- <criterion 3>
---
TASK: <next task title>
...
### TASK_LIST_END ###

## PRIORITIES
- P0: Critical blockers (tests failing, build broken)
- P1: High priority features or bugs
- P2: Normal priority improvements
- P3: Nice to have, tech debt

## RULES
1. Create 5-10 actionable tasks
2. Each task should be completable by a single agent in 5-15 minutes
3. Order tasks by dependency (foundational tasks first)
4. Be specific - vague tasks are useless
5. Include pass criteria that can be verified

Now analyze the codebase and create the task list.

When done, output: TASK_COMPLETE: Planning analysis finished with X tasks created
`;
}

/**
 * Parse tasks from planning agent output
 */
function parseTasksFromOutput(output: string): Array<{
  title: string;
  category: string;
  priority: string;
  description: string;
  passCriteria: string[];
}> {
  const tasks: Array<{
    title: string;
    category: string;
    priority: string;
    description: string;
    passCriteria: string[];
  }> = [];

  // Find task list section
  const startMatch = output.match(/### TASK_LIST_START ###/);
  const endMatch = output.match(/### TASK_LIST_END ###/);
  
  if (!startMatch || !endMatch) {
    console.warn('⚠️ Could not find task list markers in planning output');
    return tasks;
  }

  const startIdx = startMatch.index! + startMatch[0].length;
  const endIdx = endMatch.index!;
  const taskSection = output.slice(startIdx, endIdx);

  // Split by task delimiter
  const taskBlocks = taskSection.split('---').filter(b => b.trim());

  for (const block of taskBlocks) {
    const titleMatch = block.match(/TASK:\s*(.+)/);
    const categoryMatch = block.match(/CATEGORY:\s*(\w+)/);
    const priorityMatch = block.match(/PRIORITY:\s*(P\d)/);
    const descMatch = block.match(/DESCRIPTION:\s*(.+?)(?=PASS_CRITERIA:|$)/s);
    const criteriaMatch = block.match(/PASS_CRITERIA:\s*([\s\S]+)/);

    if (titleMatch) {
      const passCriteria: string[] = [];
      if (criteriaMatch) {
        const criteriaLines = criteriaMatch[1].split('\n');
        for (const line of criteriaLines) {
          const cleaned = line.replace(/^[-*]\s*/, '').trim();
          if (cleaned && !cleaned.startsWith('TASK:')) {
            passCriteria.push(cleaned);
          }
        }
      }

      tasks.push({
        title: titleMatch[1].trim(),
        category: categoryMatch?.[1]?.toLowerCase() || 'improvement',
        priority: priorityMatch?.[1] || 'P2',
        description: descMatch?.[1]?.trim() || '',
        passCriteria: passCriteria.slice(0, 5), // Max 5 criteria
      });
    }
  }

  return tasks;
}

/**
 * Create a task from planning output
 */
async function createTaskFromPlan(
  taskListId: string,
  plan: {
    title: string;
    category: string;
    priority: string;
    description: string;
    passCriteria: string[];
  }
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
    title: plan.title,
    description: plan.description || undefined,
    category: plan.category || undefined,
    priority: (plan.priority || 'P2') as tasks.Task['priority'],
    task_list_id: taskListId,
    pass_criteria: plan.passCriteria,
  });
}

/**
 * Create planning session record
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
 * Complete planning session
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
 * Get planning session
 */
export function getPlanningSession(id: string): PlanningSession | undefined {
  return getOne<PlanningSession>('SELECT * FROM planning_sessions WHERE id = ?', [id]);
}

/**
 * Run the planning agent
 */
export async function runDailyPlanning(taskListId: string): Promise<PlanningSession> {
  console.log('🧠 Starting planning agent...');
  
  // Create session record
  const session = createPlanningSession('daily', { taskListId });
  
  // Notify via Telegram that planning is starting
  await notify.planningStarted().catch(() => {});

  // Check if spawner is available
  if (!spawner.isEnabled()) {
    console.warn('⚠️ Spawner not available, skipping planning agent');
    await notify.agentError('planning', 'Spawner not available').catch(() => {});
    completePlanningSession(session.id, 'Spawner not available', [], []);
    return getPlanningSession(session.id)!;
  }

  // Spawn the planning agent with custom prompt
  const prompt = buildPlanningPrompt();
  
  const result = await spawner.spawnWithPrompt(prompt, {
    model: 'sonnet',
    timeout: 600, // 10 minutes for thorough analysis
    label: 'planning',
  });

  if (!result.success || !result.output) {
    console.error('❌ Planning agent failed:', result.error);
    await notify.agentError('planning', result.error || 'Planning failed').catch(() => {});
    completePlanningSession(session.id, result.error || 'Planning failed', [], []);
    return getPlanningSession(session.id)!;
  }

  // Parse tasks from output
  const plannedTasks = parseTasksFromOutput(result.output);
  console.log(`📋 Planning agent created ${plannedTasks.length} task proposals`);

  // Create tasks and send each to Telegram for approval
  const createdTaskIds: string[] = [];
  for (const plan of plannedTasks) {
    try {
      console.log(`   📝 Creating task: ${plan.title} (category: ${plan.category}, priority: ${plan.priority})`);
      const task = await createTaskFromPlan(taskListId, plan);
      createdTaskIds.push(task.id);
      console.log(`   ✅ Created: ${task.display_id} - ${task.title}`);
      
      // Send task proposal to Telegram for human approval
      await notify.taskProposed(
        task.display_id,
        task.title,
        plan.description || 'No description',
        plan.priority,
        plan.passCriteria
      ).catch(() => {});
      
      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`   ⚠️ Failed to create task: ${plan.title}`);
      console.error(`      Error: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`      Stack: ${err instanceof Error ? err.stack?.split('\n')[1] : ''}`);
    }
  }

  // Complete session
  completePlanningSession(
    session.id,
    `Planning complete: ${createdTaskIds.length} tasks proposed`,
    plannedTasks.map(t => t.title),
    createdTaskIds
  );

  // Notify completion
  await notify.planningComplete(createdTaskIds.length).catch(() => {});

  console.log(`🧠 Planning complete: ${createdTaskIds.length} tasks proposed for approval`);

  return getPlanningSession(session.id)!;
}

/**
 * Analyze performance (lightweight version for status checks)
 */
export function analyzePerformance(): {
  successRate: number;
  avgTaskDuration: number;
  commonErrors: string[];
  bottlenecks: string[];
  recommendations: string[];
} {
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

  return {
    successRate,
    avgTaskDuration: 0,
    commonErrors: [],
    bottlenecks: [],
    recommendations: [],
  };
}

export default {
  analyzePerformance,
  createPlanningSession,
  completePlanningSession,
  getPlanningSession,
  runDailyPlanning,
};
