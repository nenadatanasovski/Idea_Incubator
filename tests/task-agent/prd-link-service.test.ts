/**
 * PRD Link Service Tests
 *
 * Unit tests for the PRD link service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.1)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { prdLinkService } from '../../server/services/prd-link-service';
import { prdService } from '../../server/services/prd-service';
import { run, saveDb } from '../../database/db';

const TEST_PREFIX = 'LINK-TEST-';

// Create test task
async function createTestTask(): Promise<string> {
  const taskId = uuidv4();
  await run(
    `INSERT INTO tasks (id, display_id, title, status, category, priority, effort, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 'feature', 'P2', 'medium', datetime('now'), datetime('now'))`,
    [taskId, `${TEST_PREFIX}${taskId.slice(0, 8)}`, `${TEST_PREFIX}Test Task`]
  );
  await saveDb();
  return taskId;
}

// Create test task list
async function createTestTaskList(): Promise<string> {
  const listId = uuidv4();
  await run(
    `INSERT INTO task_lists_v2 (id, name, created_at, updated_at)
     VALUES (?, ?, datetime('now'), datetime('now'))`,
    [listId, `${TEST_PREFIX}List`]
  );
  await saveDb();
  return listId;
}

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(`DELETE FROM prd_tasks WHERE prd_id IN (SELECT id FROM prds WHERE title LIKE '${TEST_PREFIX}%')`);
  await run(`DELETE FROM prd_task_lists WHERE prd_id IN (SELECT id FROM prds WHERE title LIKE '${TEST_PREFIX}%')`);
  await run(`DELETE FROM prds WHERE title LIKE '${TEST_PREFIX}%'`);
  await run(`DELETE FROM tasks WHERE display_id LIKE '${TEST_PREFIX}%'`);
  await run(`DELETE FROM task_lists_v2 WHERE name LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe('PRDLinkService', () => {
  let testPrdId: string;

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
    const prd = await prdService.create(
      { title: `${TEST_PREFIX}Test PRD` },
      'test-user'
    );
    testPrdId = prd.id;
  });

  describe('linkTaskList', () => {
    it('should link a task list to PRD', async () => {
      const taskListId = await createTestTaskList();

      const link = await prdLinkService.linkTaskList(testPrdId, taskListId);

      expect(link).toBeDefined();
      expect(link.prdId).toBe(testPrdId);
      expect(link.taskListId).toBe(taskListId);
    });

    it('should set position when linking multiple task lists', async () => {
      const list1 = await createTestTaskList();
      const list2 = await createTestTaskList();

      await prdLinkService.linkTaskList(testPrdId, list1, 0);
      await prdLinkService.linkTaskList(testPrdId, list2, 1);

      const links = await prdLinkService.getLinkedTaskLists(testPrdId);

      expect(links.length).toBe(2);
      expect(links.find(l => l.taskListId === list1)?.position).toBe(0);
      expect(links.find(l => l.taskListId === list2)?.position).toBe(1);
    });
  });

  describe('unlinkTaskList', () => {
    it('should unlink a task list from PRD', async () => {
      const taskListId = await createTestTaskList();
      await prdLinkService.linkTaskList(testPrdId, taskListId);

      await prdLinkService.unlinkTaskList(testPrdId, taskListId);

      const links = await prdLinkService.getLinkedTaskLists(testPrdId);
      expect(links.length).toBe(0);
    });
  });

  describe('linkTask', () => {
    it('should link a task to PRD', async () => {
      const taskId = await createTestTask();

      const link = await prdLinkService.linkTask(testPrdId, taskId);

      expect(link).toBeDefined();
      expect(link.prdId).toBe(testPrdId);
      expect(link.taskId).toBe(taskId);
      expect(link.linkType).toBe('implements');
    });

    it('should link task with requirement reference', async () => {
      const taskId = await createTestTask();

      const link = await prdLinkService.linkTask(testPrdId, taskId, 'success_criteria[0]');

      expect(link.requirementRef).toBe('success_criteria[0]');
    });

    it('should link task with different link types', async () => {
      const taskId = await createTestTask();

      const link = await prdLinkService.linkTask(testPrdId, taskId, undefined, 'tests');

      expect(link.linkType).toBe('tests');
    });
  });

  describe('unlinkTask', () => {
    it('should unlink a task from PRD', async () => {
      const taskId = await createTestTask();
      await prdLinkService.linkTask(testPrdId, taskId);

      await prdLinkService.unlinkTask(testPrdId, taskId);

      const links = await prdLinkService.getLinkedTasks(testPrdId);
      expect(links.length).toBe(0);
    });
  });

  describe('getLinkedTaskLists', () => {
    it('should return all linked task lists', async () => {
      const list1 = await createTestTaskList();
      const list2 = await createTestTaskList();

      await prdLinkService.linkTaskList(testPrdId, list1);
      await prdLinkService.linkTaskList(testPrdId, list2);

      const links = await prdLinkService.getLinkedTaskLists(testPrdId);

      expect(links.length).toBe(2);
    });

    it('should return empty array for PRD with no links', async () => {
      const links = await prdLinkService.getLinkedTaskLists(testPrdId);
      expect(links).toEqual([]);
    });
  });

  describe('getLinkedTasks', () => {
    it('should return all linked tasks', async () => {
      const task1 = await createTestTask();
      const task2 = await createTestTask();

      await prdLinkService.linkTask(testPrdId, task1);
      await prdLinkService.linkTask(testPrdId, task2);

      const links = await prdLinkService.getLinkedTasks(testPrdId);

      expect(links.length).toBe(2);
    });
  });

  describe('getTasksByRequirement', () => {
    it('should return tasks linked to specific requirement', async () => {
      const task1 = await createTestTask();
      const task2 = await createTestTask();

      await prdLinkService.linkTask(testPrdId, task1, 'success_criteria[0]');
      await prdLinkService.linkTask(testPrdId, task2, 'success_criteria[1]');

      const links = await prdLinkService.getTasksByRequirement(testPrdId, 'success_criteria[0]');

      expect(links.length).toBe(1);
      expect(links[0].taskId).toBe(task1);
    });
  });

  describe('getPrdsForTask', () => {
    it('should return PRDs linked to a task', async () => {
      const taskId = await createTestTask();
      await prdLinkService.linkTask(testPrdId, taskId);

      const prds = await prdLinkService.getPrdsForTask(taskId);

      expect(prds.length).toBe(1);
      expect(prds[0].id).toBe(testPrdId);
    });
  });

  describe('getPrdsForTaskList', () => {
    it('should return PRDs linked to a task list', async () => {
      const taskListId = await createTestTaskList();
      await prdLinkService.linkTaskList(testPrdId, taskListId);

      const prds = await prdLinkService.getPrdsForTaskList(taskListId);

      expect(prds.length).toBe(1);
      expect(prds[0].id).toBe(testPrdId);
    });
  });
});
