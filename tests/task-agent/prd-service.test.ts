/**
 * PRD Service Tests
 *
 * Unit tests for the PRD service.
 * Part of: Task System V2 Implementation Plan (IMPL-8.3)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prdService } from '../../server/services/prd-service';
import { run, saveDb } from '../../database/db';

const TEST_PREFIX = 'PRD-TEST-';

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(`DELETE FROM prds WHERE title LIKE '${TEST_PREFIX}%'`);
  await saveDb();
}

describe('PRDService', () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('create', () => {
    it('should create a new PRD', async () => {
      const prd = await prdService.create({
        title: `${TEST_PREFIX}Test PRD`,
        description: 'A test PRD description',
        status: 'draft'
      });

      expect(prd).toBeDefined();
      expect(prd.id).toBeDefined();
      expect(prd.title).toBe(`${TEST_PREFIX}Test PRD`);
      expect(prd.status).toBe('draft');
    });

    it('should create a child PRD with parent reference', async () => {
      const parent = await prdService.create({
        title: `${TEST_PREFIX}Parent PRD`,
        status: 'draft'
      });

      const child = await prdService.create({
        title: `${TEST_PREFIX}Child PRD`,
        status: 'draft',
        parentId: parent.id
      });

      expect(child.parentId).toBe(parent.id);
    });
  });

  describe('getById', () => {
    it('should return a PRD by ID', async () => {
      const created = await prdService.create({
        title: `${TEST_PREFIX}Get By ID Test`,
        status: 'draft'
      });

      const found = await prdService.getById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe(`${TEST_PREFIX}Get By ID Test`);
    });

    it('should return null for non-existent ID', async () => {
      const found = await prdService.getById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all PRDs', async () => {
      await prdService.create({ title: `${TEST_PREFIX}PRD 1`, status: 'draft' });
      await prdService.create({ title: `${TEST_PREFIX}PRD 2`, status: 'draft' });

      const prds = await prdService.getAll();

      expect(prds.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      await prdService.create({ title: `${TEST_PREFIX}Draft PRD`, status: 'draft' });
      const approved = await prdService.create({ title: `${TEST_PREFIX}Approved PRD`, status: 'draft' });
      await prdService.approve(approved.id, 'test-user');

      const draftPrds = await prdService.getByStatus('draft');
      const approvedPrds = await prdService.getByStatus('approved');

      expect(draftPrds.some(p => p.title === `${TEST_PREFIX}Draft PRD`)).toBe(true);
      expect(approvedPrds.some(p => p.title === `${TEST_PREFIX}Approved PRD`)).toBe(true);
    });
  });

  describe('update', () => {
    it('should update PRD fields', async () => {
      const prd = await prdService.create({
        title: `${TEST_PREFIX}Original Title`,
        description: 'Original description',
        status: 'draft'
      });

      const updated = await prdService.update(prd.id, {
        title: `${TEST_PREFIX}Updated Title`,
        description: 'Updated description'
      });

      expect(updated.title).toBe(`${TEST_PREFIX}Updated Title`);
      expect(updated.description).toBe('Updated description');
    });
  });

  describe('approve', () => {
    it('should approve a PRD', async () => {
      const prd = await prdService.create({
        title: `${TEST_PREFIX}To Approve`,
        status: 'draft'
      });

      const approved = await prdService.approve(prd.id, 'test-approver');

      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe('test-approver');
      expect(approved.approvedAt).toBeDefined();
    });

    it('should throw when approving non-existent PRD', async () => {
      await expect(
        prdService.approve('non-existent-id', 'test-user')
      ).rejects.toThrow();
    });
  });

  describe('archive', () => {
    it('should archive a PRD', async () => {
      const prd = await prdService.create({
        title: `${TEST_PREFIX}To Archive`,
        status: 'draft'
      });

      const archived = await prdService.archive(prd.id);

      expect(archived.status).toBe('archived');
    });
  });

  describe('getChildren', () => {
    it('should return child PRDs', async () => {
      const parent = await prdService.create({
        title: `${TEST_PREFIX}Parent`,
        status: 'draft'
      });

      await prdService.create({
        title: `${TEST_PREFIX}Child 1`,
        status: 'draft',
        parentId: parent.id
      });

      await prdService.create({
        title: `${TEST_PREFIX}Child 2`,
        status: 'draft',
        parentId: parent.id
      });

      const children = await prdService.getChildren(parent.id);

      expect(children.length).toBe(2);
    });
  });

  describe('delete', () => {
    it('should delete a PRD', async () => {
      const prd = await prdService.create({
        title: `${TEST_PREFIX}To Delete`,
        status: 'draft'
      });

      await prdService.delete(prd.id);

      const found = await prdService.getById(prd.id);
      expect(found).toBeNull();
    });
  });
});
