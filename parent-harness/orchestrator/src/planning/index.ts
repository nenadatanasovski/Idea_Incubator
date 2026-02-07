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
import * as planCache from './plan-cache.js';

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
 * Build STRATEGIC planning prompt - vision, architecture, approach
 */
function buildStrategicPlanningPrompt(): string {
  return `You are a Strategic Planning Agent for the Vibe Platform at ${CODEBASE_ROOT}.

## YOUR MISSION
Analyze the project's VISION, ARCHITECTURE, and DIRECTION. Create a comprehensive strategic plan.

## PHASE 1: UNDERSTAND THE VISION
1. Read CLAUDE.md, README.md, docs/*.md to understand:
   - What is the Vibe Platform? What problem does it solve?
   - Who are the users? What are their needs?
   - What is the business model/goal?
2. Read parent-harness/docs/ for autonomous agent architecture

## PHASE 2: ASSESS CURRENT STATE  
1. Explore the codebase structure: \`find . -name "*.ts" -type f | head -50\`
2. Check what's implemented vs planned
3. Identify technical debt and architectural issues
4. Run \`npm run build 2>&1 | tail -50\` to check build status

## PHASE 3: CREATE STRATEGIC PLAN
Output your analysis in this EXACT format:

### STRATEGIC_PLAN_START ###

## VISION SUMMARY
<2-3 sentences capturing the project's purpose and goals>

## CURRENT STATE ASSESSMENT
- Architecture: <assessment>
- Code Quality: <assessment>
- Test Coverage: <assessment>
- Key Gaps: <list main missing pieces>

## RECOMMENDED APPROACH
<Describe the high-level approach in 3-5 phases>

### PHASE: <Phase Name>
GOAL: <What this phase achieves>
PRIORITY: P0|P1|P2
ESTIMATED_EFFORT: small|medium|large
DEPENDENCIES: <What must be done first, or "none">
KEY_DELIVERABLES:
- <deliverable 1>
- <deliverable 2>
- <deliverable 3>
---

### PHASE: <Next Phase Name>
...

### STRATEGIC_PLAN_END ###

## RULES
1. Think STRATEGICALLY - what moves the project forward most?
2. Consider dependencies - what enables what?
3. Balance quick wins with foundational work
4. Be specific about deliverables
5. 3-6 phases is ideal
6. Each phase should be 1-3 days of work for the agent swarm

Output: TASK_COMPLETE: Strategic plan created with X phases
`;
}

/**
 * Build TACTICAL planning prompt - atomic tasks from approved plan
 */
function buildTacticalPlanningPrompt(approvedPlan: string): string {
  return `You are a Task Decomposition Agent for the Vibe Platform at ${CODEBASE_ROOT}.

## YOUR MISSION
Break down the approved strategic plan into atomic, executable tasks.

## APPROVED STRATEGIC PLAN
${approvedPlan}

## YOUR JOB
1. Take each phase from the plan
2. Break it into atomic tasks (5-15 minutes each)
3. Identify dependencies between tasks
4. Assign wave numbers for parallel execution

## OUTPUT FORMAT
### TASK_LIST_START ###
TASK: <specific action title>
CATEGORY: feature|bug|test|documentation|improvement
PRIORITY: P0|P1|P2|P3
WAVE: <number, starting from 1>
DEPENDS_ON: <comma-separated task titles, or "none">
DESCRIPTION: <exactly what to do, files to modify>
PASS_CRITERIA:
- <verifiable criterion 1>
- <verifiable criterion 2>
---
TASK: <next task>
...
### TASK_LIST_END ###

## WAVE RULES
- WAVE 1: Tasks with no dependencies (can run in parallel)
- WAVE 2: Tasks that depend on WAVE 1 completion
- WAVE 3: Tasks that depend on WAVE 2, etc.

## TASK RULES
1. Each task = ONE specific action
2. 5-15 minutes to complete
3. Clear pass criteria that can be verified
4. Specific file paths when relevant
5. Create 10-20 atomic tasks

Output: TASK_COMPLETE: Created X atomic tasks across Y waves
`;
}

/**
 * Build the planning agent prompt (legacy - for backward compat)
 */
function buildPlanningPrompt(): string {
  return buildStrategicPlanningPrompt();
}

/**
 * Parse STRATEGIC plan from planning agent output
 */
export function parseStrategicPlan(output: string): {
  visionSummary: string;
  currentState: string;
  approach: string;
  phases: Array<{
    name: string;
    goal: string;
    priority: string;
    effort: string;
    dependencies: string;
    deliverables: string[];
  }>;
} | null {
  const startMatch = output.match(/### STRATEGIC_PLAN_START ###/);
  const endMatch = output.match(/### STRATEGIC_PLAN_END ###/);
  
  if (!startMatch) {
    console.warn('⚠️ Could not find strategic plan start marker');
    return null;
  }

  // End marker is optional - use it if found, otherwise take everything after start
  const planSection = endMatch 
    ? output.slice(startMatch.index! + startMatch[0].length, endMatch.index!)
    : output.slice(startMatch.index! + startMatch[0].length);
  
  console.log(`📋 Parsing strategic plan (${planSection.length} chars)`);
  
  // Parse vision
  const visionMatch = planSection.match(/## VISION SUMMARY\n([\s\S]*?)(?=## CURRENT STATE|$)/);
  const visionSummary = visionMatch?.[1]?.trim() || '';

  // Parse current state
  const stateMatch = planSection.match(/## CURRENT STATE ASSESSMENT\n([\s\S]*?)(?=## RECOMMENDED APPROACH|$)/);
  const currentState = stateMatch?.[1]?.trim() || '';

  // Parse approach
  const approachMatch = planSection.match(/## RECOMMENDED APPROACH\n([\s\S]*?)(?=### PHASE:|$)/);
  const approach = approachMatch?.[1]?.trim() || '';

  // Parse phases - try multiple formats
  const phases: Array<{
    name: string;
    goal: string;
    priority: string;
    effort: string;
    dependencies: string;
    deliverables: string[];
  }> = [];

  // Try strict format first
  let phaseMatches = planSection.matchAll(/### PHASE:\s*(.+)\nGOAL:\s*(.+)\nPRIORITY:\s*(P\d)\nESTIMATED_EFFORT:\s*(\w+)\nDEPENDENCIES:\s*(.+)\nKEY_DELIVERABLES:\n([\s\S]*?)(?=---|### PHASE:|### STRATEGIC_PLAN_END|$)/g);

  for (const match of phaseMatches) {
    const deliverables = match[6]
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);

    phases.push({
      name: match[1].trim(),
      goal: match[2].trim(),
      priority: match[3].trim(),
      effort: match[4].trim(),
      dependencies: match[5].trim(),
      deliverables,
    });
  }

  // If no phases found with strict format, try looser patterns
  if (phases.length === 0) {
    console.log('📋 Trying alternative phase format...');
    // Try format: ### Phase N: Name or ### PHASE N: Name
    const altPhaseMatches = planSection.matchAll(/###\s*(?:PHASE|Phase)\s*\d*:?\s*(.+?)(?:\n|\r\n)([\s\S]*?)(?=###\s*(?:PHASE|Phase)|### STRATEGIC_PLAN_END|$)/gi);
    
    let phaseNum = 1;
    for (const match of altPhaseMatches) {
      const phaseContent = match[2];
      // Extract goal, priority etc from content if present
      const goalMatch = phaseContent.match(/(?:GOAL|Goal|Objective)[:\s]*(.+?)(?:\n|$)/i);
      const priorityMatch = phaseContent.match(/(?:PRIORITY|Priority)[:\s]*(P\d)/i);
      const effortMatch = phaseContent.match(/(?:EFFORT|Effort|Estimated)[:\s]*(\w+)/i);
      
      // Get deliverables from bullet points
      const deliverables = phaseContent
        .split('\n')
        .filter(line => line.match(/^[-*•]\s/))
        .map(line => line.replace(/^[-*•]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 5);

      phases.push({
        name: match[1].trim(),
        goal: goalMatch?.[1]?.trim() || `Complete phase ${phaseNum}`,
        priority: priorityMatch?.[1] || 'P1',
        effort: effortMatch?.[1]?.toLowerCase() || 'medium',
        dependencies: phaseNum === 1 ? 'none' : `Phase ${phaseNum - 1}`,
        deliverables: deliverables.length > 0 ? deliverables : ['Complete phase objectives'],
      });
      phaseNum++;
    }
  }

  console.log(`📋 Parsed ${phases.length} phases`);
  return { visionSummary, currentState, approach, phases };
}

/**
 * Parse TACTICAL tasks from output (with wave support)
 */
function parseTasksWithWaves(output: string): Array<{
  title: string;
  category: string;
  priority: string;
  wave: number;
  dependsOn: string[];
  description: string;
  passCriteria: string[];
}> {
  const tasks: Array<{
    title: string;
    category: string;
    priority: string;
    wave: number;
    dependsOn: string[];
    description: string;
    passCriteria: string[];
  }> = [];

  const startMatch = output.match(/### TASK_LIST_START ###/);
  const endMatch = output.match(/### TASK_LIST_END ###/);
  
  if (!startMatch || !endMatch) return tasks;

  const taskSection = output.slice(startMatch.index! + startMatch[0].length, endMatch.index!);
  const taskBlocks = taskSection.split('---').filter(b => b.trim());

  for (const block of taskBlocks) {
    const titleMatch = block.match(/TASK:\s*(.+)/);
    const categoryMatch = block.match(/CATEGORY:\s*(\w+)/);
    const priorityMatch = block.match(/PRIORITY:\s*(P\d)/);
    const waveMatch = block.match(/WAVE:\s*(\d+)/);
    const dependsMatch = block.match(/DEPENDS_ON:\s*(.+)/);
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

      const dependsOnRaw = dependsMatch?.[1]?.trim() || 'none';
      const dependsOn = dependsOnRaw.toLowerCase() === 'none' 
        ? [] 
        : dependsOnRaw.split(',').map(d => d.trim());

      tasks.push({
        title: titleMatch[1].trim(),
        category: categoryMatch?.[1]?.toLowerCase() || 'improvement',
        priority: priorityMatch?.[1] || 'P2',
        wave: parseInt(waveMatch?.[1] || '1', 10),
        dependsOn,
        description: descMatch?.[1]?.trim() || '',
        passCriteria: passCriteria.slice(0, 5),
      });
    }
  }

  return tasks;
}

/**
 * Parse tasks from planning agent output (legacy format)
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
    model: 'haiku',
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

/**
 * Run STRATEGIC planning - creates high-level plan for clarification
 * 
 * Checks for cached approved plan first to avoid redundant token usage.
 */
export async function runStrategicPlanning(taskListId: string): Promise<{
  session: PlanningSession;
  plan: ReturnType<typeof parseStrategicPlan>;
  fromCache?: boolean;
}> {
  // Check for cached approved plan first
  const cached = planCache.loadPlanFromCache();
  if (cached && cached.taskListId === taskListId) {
    console.log('✅ Using cached approved plan - skipping strategic planning agent');
    
    // Create a session record for tracking
    const session = createPlanningSession('initial', { taskListId, type: 'strategic', fromCache: true });
    completePlanningSession(
      session.id,
      JSON.stringify(cached),
      cached.phases.map(p => p.name),
      []
    );
    
    return { 
      session: getPlanningSession(session.id)!, 
      plan: cached,
      fromCache: true,
    };
  }

  console.log('🧠 Starting STRATEGIC planning agent...');
  
  const session = createPlanningSession('initial', { taskListId, type: 'strategic' });
  
  await notify.planningStarted().catch(() => {});

  if (!spawner.isEnabled()) {
    console.warn('⚠️ Spawner not available');
    completePlanningSession(session.id, 'Spawner not available', [], []);
    return { session: getPlanningSession(session.id)!, plan: null };
  }

  const prompt = buildStrategicPlanningPrompt();
  
  const result = await spawner.spawnWithPrompt(prompt, {
    model: 'haiku',
    timeout: 900, // 15 minutes for strategic analysis
    label: 'strategic-planning',
  });

  if (!result.success || !result.output) {
    console.error('❌ Strategic planning failed:', result.error);
    completePlanningSession(session.id, result.error || 'Planning failed', [], []);
    return { session: getPlanningSession(session.id)!, plan: null };
  }

  const plan = parseStrategicPlan(result.output);
  
  if (!plan) {
    console.error('❌ Could not parse strategic plan');
    completePlanningSession(session.id, 'Could not parse plan', [], []);
    return { session: getPlanningSession(session.id)!, plan: null };
  }

  console.log(`📋 Strategic plan created: ${plan.phases.length} phases`);

  // Store plan in session analysis
  completePlanningSession(
    session.id,
    JSON.stringify(plan),
    plan.phases.map(p => p.name),
    []
  );

  return { session: getPlanningSession(session.id)!, plan };
}

/**
 * Cache an approved plan (call after human approval)
 */
export function cacheApprovedPlan(
  plan: ReturnType<typeof parseStrategicPlan>,
  taskListId: string
): void {
  if (!plan) return;
  planCache.savePlanToCache(plan, taskListId);
}

/**
 * Clear the plan cache (force fresh planning)
 */
export function clearPlanCache(): void {
  planCache.clearPlanCache();
}

/**
 * Run TACTICAL planning - breaks approved plan into atomic tasks
 */
export async function runTacticalPlanning(
  taskListId: string, 
  approvedPlan: string
): Promise<{
  session: PlanningSession;
  tasks: ReturnType<typeof parseTasksWithWaves>;
}> {
  console.log('🔧 Starting TACTICAL planning agent...');
  
  const session = createPlanningSession('daily', { taskListId, type: 'tactical' });

  if (!spawner.isEnabled()) {
    console.warn('⚠️ Spawner not available');
    completePlanningSession(session.id, 'Spawner not available', [], []);
    return { session: getPlanningSession(session.id)!, tasks: [] };
  }

  const prompt = buildTacticalPlanningPrompt(approvedPlan);
  
  const result = await spawner.spawnWithPrompt(prompt, {
    model: 'haiku',
    timeout: 600,
    label: 'tactical-planning',
  });

  if (!result.success || !result.output) {
    console.error('❌ Tactical planning failed:', result.error);
    completePlanningSession(session.id, result.error || 'Planning failed', [], []);
    return { session: getPlanningSession(session.id)!, tasks: [] };
  }

  const plannedTasks = parseTasksWithWaves(result.output);
  console.log(`📋 Tactical plan: ${plannedTasks.length} atomic tasks`);

  // Create tasks in database with wave assignments
  const createdTaskIds: string[] = [];
  for (const plan of plannedTasks) {
    try {
      // Generate display ID
      const lastTask = getOne<{ display_id: string }>(
        "SELECT display_id FROM tasks ORDER BY created_at DESC LIMIT 1"
      );
      const lastNum = lastTask?.display_id 
        ? parseInt(lastTask.display_id.replace('TASK-', ''), 10) 
        : 0;
      const displayId = `TASK-${String(lastNum + 1).padStart(3, '0')}`;

      const task = tasks.createTask({
        display_id: displayId,
        title: plan.title,
        description: plan.description || undefined,
        category: plan.category || undefined,
        priority: (plan.priority || 'P2') as tasks.Task['priority'],
        task_list_id: taskListId,
        pass_criteria: plan.passCriteria,
        wave_number: plan.wave,
      });

      createdTaskIds.push(task.id);
      console.log(`   ✅ Created: ${displayId} (Wave ${plan.wave}) - ${plan.title}`);
    } catch (err) {
      console.error(`   ⚠️ Failed to create task: ${plan.title}`, err);
    }
  }

  completePlanningSession(
    session.id,
    `Created ${createdTaskIds.length} tasks across ${Math.max(...plannedTasks.map(t => t.wave))} waves`,
    plannedTasks.map(t => t.title),
    createdTaskIds
  );

  return { session: getPlanningSession(session.id)!, tasks: plannedTasks };
}

export default {
  analyzePerformance,
  createPlanningSession,
  completePlanningSession,
  getPlanningSession,
  runDailyPlanning,
  runStrategicPlanning,
  runTacticalPlanning,
  parseStrategicPlan,
  cacheApprovedPlan,
  clearPlanCache,
};
