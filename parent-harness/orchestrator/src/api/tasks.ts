import { Router } from 'express';
import * as tasks from '../db/tasks.js';

export const tasksRouter = Router();

/**
 * GET /api/tasks
 * List tasks with optional filters
 */
tasksRouter.get('/', (req, res) => {
  const filters = {
    status: req.query.status as tasks.Task['status'] | undefined,
    priority: req.query.priority as tasks.Task['priority'] | undefined,
    assignedAgentId: req.query.assignedAgentId as string | undefined,
    taskListId: req.query.taskListId as string | undefined,
  };

  const allTasks = tasks.getTasks(filters);
  res.json(allTasks);
});

/**
 * GET /api/tasks/pending
 * Get tasks ready to be assigned (no unmet dependencies)
 */
tasksRouter.get('/pending', (_req, res) => {
  const pendingTasks = tasks.getPendingTasks();
  res.json(pendingTasks);
});

/**
 * GET /api/tasks/:id
 * Get a single task
 */
tasksRouter.get('/:id', (req, res) => {
  const task = tasks.getTask(req.params.id) || tasks.getTaskByDisplayId(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found', status: 404 });
  }
  res.json(task);
});

/**
 * POST /api/tasks
 * Create a new task
 */
tasksRouter.post('/', (req, res) => {
  const { display_id, title, description, category, priority, task_list_id, parent_task_id, pass_criteria } = req.body;

  if (!display_id || !title || !task_list_id) {
    return res.status(400).json({
      error: 'Missing required fields: display_id, title, task_list_id',
      status: 400,
    });
  }

  const task = tasks.createTask({
    display_id,
    title,
    description,
    category,
    priority,
    task_list_id,
    parent_task_id,
    pass_criteria,
  });

  res.status(201).json(task);
});

/**
 * PATCH /api/tasks/:id
 * Update a task
 */
tasksRouter.patch('/:id', (req, res) => {
  const task = tasks.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found', status: 404 });
  }

  const { title, description, status, priority, assigned_agent_id, spec_content, implementation_plan } = req.body;

  const updated = tasks.updateTask(req.params.id, {
    title,
    description,
    status,
    priority,
    assigned_agent_id,
    spec_content,
    implementation_plan,
  });

  res.json(updated);
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
tasksRouter.delete('/:id', (req, res) => {
  const task = tasks.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found', status: 404 });
  }

  const deleted = tasks.deleteTask(req.params.id);
  res.json({ success: deleted });
});

/**
 * POST /api/tasks/:id/assign
 * Assign a task to an agent
 */
tasksRouter.post('/:id/assign', (req, res) => {
  const { agentId } = req.body;
  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId', status: 400 });
  }

  const task = tasks.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found', status: 404 });
  }

  const updated = tasks.assignTask(req.params.id, agentId);
  res.json(updated);
});

/**
 * POST /api/tasks/:id/complete
 * Mark a task as completed
 */
tasksRouter.post('/:id/complete', (req, res) => {
  const task = tasks.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found', status: 404 });
  }

  const updated = tasks.completeTask(req.params.id);
  res.json(updated);
});

/**
 * POST /api/tasks/:id/fail
 * Mark a task as failed
 */
tasksRouter.post('/:id/fail', (req, res) => {
  const task = tasks.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found', status: 404 });
  }

  const updated = tasks.failTask(req.params.id);
  res.json(updated);
});
