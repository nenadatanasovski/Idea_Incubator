---
id: "{{id}}"
title: "{{title}}"
idea_type: "{{idea_type}}"
creator: "{{creator}}"
created: "{{created}}"
updated: "{{updated}}"
spec_version: "1.0"
total_tasks: 0
completed_tasks: 0
status: "pending"
---

# Build Tasks: {{title}}

## Summary

**Spec Reference:** `build/spec.md`
**Total Tasks:** 0
**Completed:** 0
**In Progress:** 0
**Failed:** 0
**Blocked:** 0

**Last Updated:**

---

## Context Loading

<!--
Build Agent should load these before starting execution.
This is the "prime" step from PIV Loop.
-->

### Required Context

- [ ] `build/spec.md` - Technical specification
- [ ] `CLAUDE.md` - Project conventions (sections: \_\_\_)
- [ ] Knowledge Base gotchas for: \_\_\_

### Idea Context

- [ ] `README.md` - Idea overview
- [ ] `problem-solution.md` - Problem framing
- [ ] `target-users.md` - User personas

---

## Phase 1: Database

<!--
Database migrations and schema changes.
These typically run first as other phases depend on them.
-->

### Task 1

```yaml
id: T-001
phase: database
action: CREATE
file: "database/migrations/XXX_description.sql"
status: pending

requirements:
  - "Create table with columns: ..."
  - "Add foreign key to ..."
  - "Include created_at and updated_at timestamps"

gotchas:
  - "Use TEXT for dates in SQLite, not DATETIME"
  - "Always include IF NOT EXISTS"
  - "Foreign keys require PRAGMA foreign_keys = ON"

validation:
  command: "sqlite3 :memory: < database/migrations/XXX_description.sql && echo 'OK'"
  expected: "OK"

code_template: |
  -- Migration XXX:
  -- Created: {{date}}
  -- Purpose:

  CREATE TABLE IF NOT EXISTS table_name (
      id TEXT PRIMARY KEY,
      -- columns here
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_table_column ON table_name(column);

depends_on: []
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 2: Types & Interfaces

<!--
TypeScript types and interfaces.
Define these before implementation code.
-->

### Task 2

```yaml
id: T-002
phase: types
action: CREATE
file: "types/feature.ts"
status: pending

requirements:
  - "Define interface for ..."
  - "Export types for use by other modules"
  - "Follow existing type patterns in types/"

gotchas:
  - "Use string for IDs, not number"
  - "Dates should be ISO strings"
  - "Export at file bottom for consistent style"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  /**
   * Types for feature
   */

  export interface FeatureItem {
    id: string;
    // fields
    createdAt: string;
    updatedAt: string;
  }

  export type FeatureCreateInput = Omit<FeatureItem, 'id' | 'createdAt' | 'updatedAt'>;

depends_on: []
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 3: Database Queries

<!--
Database query functions.
-->

### Task 3

```yaml
id: T-003
phase: database
action: UPDATE
file: "database/db.ts"
status: pending

requirements:
  - "Add query functions for CRUD operations"
  - "Follow existing patterns in file"
  - "Use parameterized queries"

gotchas:
  - "Always use prepared statements"
  - "Return arrays, not raw results"
  - "Handle null gracefully"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add to existing file

  export async function getFeatures(): Promise<Feature[]> {
    const stmt = db.prepare('SELECT * FROM features ORDER BY created_at DESC');
    return stmt.all() as Feature[];
  }

  export async function createFeature(input: FeatureCreateInput): Promise<Feature> {
    const id = generateId();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO features (id, ..., created_at, updated_at)
      VALUES (?, ..., ?, ?)
    `);
    stmt.run(id, ..., now, now);
    return getFeatureById(id);
  }

depends_on: ["T-001", "T-002"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 4: API Routes

<!--
Server routes and endpoints.
-->

### Task 4

```yaml
id: T-004
phase: api
action: CREATE
file: "server/routes/feature.ts"
status: pending

requirements:
  - "Create router with CRUD endpoints"
  - "Follow existing route patterns"
  - "Add input validation"
  - "Return appropriate status codes"

gotchas:
  - "Import router from existing pattern"
  - "Use async handlers"
  - "Always validate input before database calls"
  - "Return 404 for not found, not empty result"

validation:
  command: "npx tsc --noEmit && curl -s http://localhost:3000/api/features | jq"
  expected: "valid JSON response"

code_template: |
  /**
   * Feature routes
   */
  import { Router } from 'express';
  import { getFeatures, createFeature } from '../../database/db.js';

  const router = Router();

  // GET /api/features
  router.get('/', async (req, res) => {
    try {
      const features = await getFeatures();
      res.json(features);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch features' });
    }
  });

  // POST /api/features
  router.post('/', async (req, res) => {
    try {
      const feature = await createFeature(req.body);
      res.status(201).json(feature);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create feature' });
    }
  });

  export default router;

depends_on: ["T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

### Task 5

```yaml
id: T-005
phase: api
action: UPDATE
file: "server/api.ts"
status: pending

requirements:
  - "Import and mount the new router"
  - "Add at appropriate position in middleware chain"

gotchas:
  - "Import order matters"
  - "Mount before catch-all routes"
  - "Use consistent path prefix"

validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"

code_template: |
  // Add import at top
  import featureRouter from './routes/feature.js';

  // Add mount after other routes
  app.use('/api/features', featureRouter);

depends_on: ["T-004"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Phase 5: Tests

<!--
Unit and integration tests.
-->

### Task 6

```yaml
id: T-006
phase: tests
action: CREATE
file: "tests/feature.test.ts"
status: pending

requirements:
  - "Test CRUD operations"
  - "Test error cases"
  - "Follow existing test patterns"

gotchas:
  - "Use test database, not production"
  - "Clean up after tests"
  - "Mock external dependencies"

validation:
  command: "npm test -- --grep 'feature'"
  expected: "all tests pass"

code_template: |
  import { describe, it, expect, beforeEach, afterEach } from 'vitest';
  import { createFeature, getFeatures } from '../database/db.js';

  describe('Feature', () => {
    beforeEach(async () => {
      // Setup test data
    });

    afterEach(async () => {
      // Cleanup
    });

    it('should create a feature', async () => {
      const feature = await createFeature({ ... });
      expect(feature.id).toBeDefined();
    });

    it('should list features', async () => {
      const features = await getFeatures();
      expect(Array.isArray(features)).toBe(true);
    });
  });

depends_on: ["T-003"]
assigned_to: null
started_at: null
completed_at: null
notes: null
```

---

## Execution Log

<!--
Build Agent updates this section during execution.
-->

| Task | Status | Started | Completed | Duration | Notes |
| ---- | ------ | ------- | --------- | -------- | ----- |
|      |        |         |           |          |       |

---

## Discoveries

<!--
New patterns or gotchas discovered during execution.
Build Agent records these for SIA to process.
-->

### Patterns Discovered

| Pattern | Context | Confidence |
| ------- | ------- | ---------- |
|         |         |            |

### Gotchas Discovered

| Gotcha | Context | Should Propagate? |
| ------ | ------- | ----------------- |
|        |         |                   |

---

## Validation Results

<!--
Results of final validation run.
-->

### TypeScript Check

```
[output of npx tsc --noEmit]
```

### Test Results

```
[output of npm test]
```

### Lint Check

```
[output of npm run lint]
```

---

## Completion Checklist

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Tests passing
- [ ] Discoveries recorded in Knowledge Base
- [ ] Execution log updated

---

## Sign-off

**Completed By:**
**Completed At:**
**Final Status:**
**Commits:**

---

_Generated by Specification Agent_
_Executed by Build Agent_
