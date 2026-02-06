import { query, getOne, run } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface Task {
  id: string;
  display_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  assigned_agent_id: string | null;
  task_list_id: string;
  parent_task_id: string | null;
  source: string | null;
  spec_content: string | null;
  implementation_plan: string | null;
  pass_criteria: string | null;
  complexity_estimate: number | null;
  wave_number: number | null;
  execution_order: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  display_id: string;
  title: string;
  description?: string;
  category?: string;
  priority?: Task['priority'];
  task_list_id: string;
  parent_task_id?: string;
  pass_criteria?: string[];
}

/**
 * Get all tasks
 */
export function getTasks(filters?: {
  status?: Task['status'];
  priority?: Task['priority'];
  assignedAgentId?: string;
  taskListId?: string;
}): Task[] {
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: unknown[] = [];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.priority) {
    sql += ' AND priority = ?';
    params.push(filters.priority);
  }
  if (filters?.assignedAgentId) {
    sql += ' AND assigned_agent_id = ?';
    params.push(filters.assignedAgentId);
  }
  if (filters?.taskListId) {
    sql += ' AND task_list_id = ?';
    params.push(filters.taskListId);
  }

  sql += ' ORDER BY priority ASC, created_at ASC';
  return query<Task>(sql, params);
}

/**
 * Get a single task by ID
 */
export function getTask(id: string): Task | undefined {
  return getOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
}

/**
 * Get a task by display ID
 */
export function getTaskByDisplayId(displayId: string): Task | undefined {
  return getOne<Task>('SELECT * FROM tasks WHERE display_id = ?', [displayId]);
}

/**
 * Get pending tasks (ready to be assigned)
 */
export function getPendingTasks(): Task[] {
  return query<Task>(`
    SELECT t.* FROM tasks t
    WHERE t.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM task_relationships tr
        JOIN tasks dep ON dep.id = tr.target_task_id
        WHERE tr.source_task_id = t.id
          AND tr.relationship_type = 'depends_on'
          AND dep.status NOT IN ('completed')
      )
    ORDER BY t.priority ASC, t.created_at ASC
  `);
}

/**
 * Create a new task
 */
export function createTask(input: CreateTaskInput): Task {
  const id = uuidv4();
  const passCriteria = input.pass_criteria ? JSON.stringify(input.pass_criteria) : null;

  run(`
    INSERT INTO tasks (
      id, display_id, title, description, category, 
      priority, task_list_id, parent_task_id, pass_criteria, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [
    id,
    input.display_id,
    input.title,
    input.description ?? null,
    input.category ?? null,
    input.priority ?? 'P2',
    input.task_list_id,
    input.parent_task_id ?? null,
    passCriteria,
  ]);

  return getTask(id)!;
}

/**
 * Update a task
 */
export function updateTask(
  id: string,
  updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assigned_agent_id' | 'spec_content' | 'implementation_plan'>>
): Task | undefined {
  const setClauses: string[] = ['updated_at = datetime(\'now\')'];
  const params: unknown[] = [];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    params.push(updates.description);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
    
    if (updates.status === 'in_progress') {
      setClauses.push('started_at = datetime(\'now\')');
    } else if (updates.status === 'completed' || updates.status === 'failed') {
      setClauses.push('completed_at = datetime(\'now\')');
    }
  }
  if (updates.priority !== undefined) {
    setClauses.push('priority = ?');
    params.push(updates.priority);
  }
  if (updates.assigned_agent_id !== undefined) {
    setClauses.push('assigned_agent_id = ?');
    params.push(updates.assigned_agent_id);
  }
  if (updates.spec_content !== undefined) {
    setClauses.push('spec_content = ?');
    params.push(updates.spec_content);
  }
  if (updates.implementation_plan !== undefined) {
    setClauses.push('implementation_plan = ?');
    params.push(updates.implementation_plan);
  }

  params.push(id);
  run(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`, params);

  return getTask(id);
}

/**
 * Delete a task
 */
export function deleteTask(id: string): boolean {
  const result = run('DELETE FROM tasks WHERE id = ?', [id]);
  return result.changes > 0;
}

/**
 * Assign a task to an agent
 */
export function assignTask(taskId: string, agentId: string): Task | undefined {
  return updateTask(taskId, {
    status: 'in_progress',
    assigned_agent_id: agentId,
  });
}

/**
 * Complete a task
 */
export function completeTask(taskId: string): Task | undefined {
  return updateTask(taskId, { status: 'completed' });
}

/**
 * Fail a task
 */
export function failTask(taskId: string): Task | undefined {
  return updateTask(taskId, { status: 'failed' });
}

export default {
  getTasks,
  getTask,
  getTaskByDisplayId,
  getPendingTasks,
  createTask,
  updateTask,
  deleteTask,
  assignTask,
  completeTask,
  failTask,
};
