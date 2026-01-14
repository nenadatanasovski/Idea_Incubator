# Task System V2 Implementation Plan

**Document ID:** IMPL-TASK-V2
**Version:** 1.0.0
**Created:** 2026-01-14
**Status:** Draft
**Depends On:** [TASK-ATOMIC-ANATOMY.md](./TASK-ATOMIC-ANATOMY.md)

---

## Executive Summary

This document provides a comprehensive implementation plan for the Task System V2, which extends the existing task infrastructure with:

- **PRD Integration** - Product Requirements Documents with hierarchical linking
- **Task Impacts** - File/API/Function/Database/Type impact tracking with CRUD operations
- **Task Appendices** - Attachable context for Build Agents
- **Cascade System** - Change propagation with approval controls
- **Version History** - Full audit trail and rollback capability
- **Three-Level Testing** - Syntax, unit, and integration validation

**Total Implementation Items:** 62
**Estimated Phases:** 8
**Critical Path:** Phase 1 → Phase 2 → Phase 3 → Phase 4

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Phase 1: Database Schema](#phase-1-database-schema)
3. [Phase 2: TypeScript Types](#phase-2-typescript-types)
4. [Phase 3: Core Services](#phase-3-core-services)
5. [Phase 4: Task Agent Services](#phase-4-task-agent-services)
6. [Phase 5: API Routes](#phase-5-api-routes)
7. [Phase 6: Telegram Integration](#phase-6-telegram-integration)
8. [Phase 7: UI Components](#phase-7-ui-components)
9. [Phase 8: Testing & Validation](#phase-8-testing--validation)
10. [Rollout Strategy](#rollout-strategy)
11. [Risk Mitigation](#risk-mitigation)

---

## 1. Prerequisites

Before starting implementation, ensure:

- [ ] Current `task-data-model.md` schema is implemented and stable
- [ ] `tasks` table exists with current schema
- [ ] `task_lists_v2` table exists
- [ ] `task_relationships` table exists
- [ ] Build Agent infrastructure is operational
- [ ] Telegram bot is connected and responding

**Verification Command:**
```bash
npm run migrate:status
```

---

## Phase 1: Database Schema

**Goal:** Create all new database tables and columns required for Task System V2.

**Dependencies:** None (foundation phase)
**Blocking:** Phase 2, Phase 3

### IMPL-1.1: Create `task_impacts` Table

**File:** `server/db/migrations/YYYYMMDD_create_task_impacts.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS task_impacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Impact classification
  impact_type TEXT NOT NULL CHECK (impact_type IN ('file', 'api', 'function', 'database', 'type')),
  operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'READ', 'UPDATE', 'DELETE')),

  -- Target identification
  target_path TEXT NOT NULL,           -- e.g., "server/routes/auth.ts"
  target_name TEXT,                    -- e.g., "loginHandler" for functions
  target_signature TEXT,               -- e.g., "(req: Request, res: Response) => void"

  -- Confidence tracking
  confidence REAL NOT NULL DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'pattern', 'user', 'validated')),

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_task_impacts_task_id ON task_impacts(task_id);
CREATE INDEX idx_task_impacts_type_op ON task_impacts(impact_type, operation);
CREATE INDEX idx_task_impacts_target ON task_impacts(target_path);
```

**Acceptance Criteria:**
- [ ] Table created successfully
- [ ] Foreign key constraint enforced
- [ ] Indexes created
- [ ] All CHECK constraints validated
- [ ] `npm run migrate` passes

---

### IMPL-1.2: Create `task_appendices` Table

**File:** `server/db/migrations/YYYYMMDD_create_task_appendices.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS task_appendices (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Appendix classification
  appendix_type TEXT NOT NULL CHECK (appendix_type IN (
    'prd_reference',
    'code_context',
    'gotcha_list',
    'rollback_plan',
    'test_context',
    'dependency_notes',
    'architecture_decision',
    'user_story',
    'acceptance_criteria',
    'research_notes',
    'api_contract'
  )),

  -- Content storage (hybrid: inline or reference)
  content_type TEXT NOT NULL CHECK (content_type IN ('inline', 'reference')),
  content TEXT,                        -- For inline storage
  reference_id TEXT,                   -- For reference storage
  reference_table TEXT,                -- e.g., "knowledge_base", "prds"

  -- Ordering
  position INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_task_appendices_task_id ON task_appendices(task_id);
CREATE INDEX idx_task_appendices_type ON task_appendices(appendix_type);
```

**Acceptance Criteria:**
- [ ] Table created successfully
- [ ] All 11 appendix types in CHECK constraint
- [ ] Both inline and reference storage supported
- [ ] Position ordering works correctly

---

### IMPL-1.3: Create `prds` Table

**File:** `server/db/migrations/YYYYMMDD_create_prds.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS prds (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,

  -- Ownership
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),

  -- Hierarchy (self-referential for summary PRDs)
  parent_prd_id TEXT REFERENCES prds(id),

  -- Core content
  problem_statement TEXT,
  target_users TEXT,
  functional_description TEXT,

  -- Structured data (JSON arrays)
  success_criteria TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
  constraints TEXT NOT NULL DEFAULT '[]',         -- JSON array of strings
  out_of_scope TEXT NOT NULL DEFAULT '[]',        -- JSON array of strings

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),

  -- Approval workflow
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id),

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_prds_user_id ON prds(user_id);
CREATE INDEX idx_prds_project_id ON prds(project_id);
CREATE INDEX idx_prds_parent ON prds(parent_prd_id);
CREATE INDEX idx_prds_status ON prds(status);
```

**Acceptance Criteria:**
- [ ] Table created with all columns
- [ ] Self-referential FK for hierarchy works
- [ ] Slug uniqueness enforced
- [ ] JSON columns default to empty arrays
- [ ] Status workflow constraints enforced

---

### IMPL-1.4: Create `prd_task_lists` Junction Table

**File:** `server/db/migrations/YYYYMMDD_create_prd_task_lists.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS prd_task_lists (
  id TEXT PRIMARY KEY,
  prd_id TEXT NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
  task_list_id TEXT NOT NULL REFERENCES task_lists_v2(id) ON DELETE CASCADE,

  -- Ordering within PRD
  position INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(prd_id, task_list_id)
);

CREATE INDEX idx_prd_task_lists_prd ON prd_task_lists(prd_id);
CREATE INDEX idx_prd_task_lists_list ON prd_task_lists(task_list_id);
```

**Acceptance Criteria:**
- [ ] Junction table created
- [ ] Unique constraint prevents duplicate links
- [ ] Cascading deletes work correctly
- [ ] Bidirectional queries perform well

---

### IMPL-1.5: Create `prd_tasks` Junction Table

**File:** `server/db/migrations/YYYYMMDD_create_prd_tasks.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS prd_tasks (
  id TEXT PRIMARY KEY,
  prd_id TEXT NOT NULL REFERENCES prds(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Traceability
  requirement_ref TEXT,                -- e.g., "success_criteria[0]"
  link_type TEXT NOT NULL DEFAULT 'implements' CHECK (link_type IN ('implements', 'tests', 'related')),

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(prd_id, task_id)
);

CREATE INDEX idx_prd_tasks_prd ON prd_tasks(prd_id);
CREATE INDEX idx_prd_tasks_task ON prd_tasks(task_id);
```

**Acceptance Criteria:**
- [ ] Junction table created
- [ ] Requirement reference supports traceability
- [ ] Link types constrained correctly

---

### IMPL-1.6: Create `task_test_results` Table

**File:** `server/db/migrations/YYYYMMDD_create_task_test_results.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS task_test_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- Test identification
  test_level INTEGER NOT NULL CHECK (test_level IN (1, 2, 3)),  -- 1=syntax, 2=unit, 3=e2e
  test_name TEXT,

  -- Execution details
  command TEXT NOT NULL,
  exit_code INTEGER NOT NULL,
  stdout TEXT,
  stderr TEXT,
  duration_ms INTEGER NOT NULL,

  -- Result
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),

  -- Context
  execution_id TEXT,                   -- Links to parallel execution
  agent_id TEXT,                       -- Which Build Agent ran this

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_task_test_results_task ON task_test_results(task_id);
CREATE INDEX idx_task_test_results_level ON task_test_results(test_level);
CREATE INDEX idx_task_test_results_execution ON task_test_results(execution_id);
```

**Acceptance Criteria:**
- [ ] Table created with all columns
- [ ] Three test levels supported
- [ ] Links to execution context work
- [ ] Query by task_id is fast

---

### IMPL-1.7: Create `task_state_history` Table

**File:** `server/db/migrations/YYYYMMDD_create_task_state_history.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS task_state_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  -- State transition
  from_status TEXT,                    -- NULL for creation
  to_status TEXT NOT NULL,

  -- Actor
  changed_by TEXT NOT NULL,            -- user_id, agent_id, or 'system'
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),

  -- Context
  reason TEXT,
  metadata TEXT,                       -- JSON for additional context

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_task_state_history_task ON task_state_history(task_id);
CREATE INDEX idx_task_state_history_time ON task_state_history(created_at);
CREATE INDEX idx_task_state_history_status ON task_state_history(to_status);
```

**Acceptance Criteria:**
- [ ] Table created with all columns
- [ ] Full audit trail preserved
- [ ] Efficient time-range queries
- [ ] Actor type properly tracked

---

### IMPL-1.8: Create `task_versions` Table

**File:** `server/db/migrations/YYYYMMDD_create_task_versions.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS task_versions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,

  -- Snapshot of task state
  snapshot TEXT NOT NULL,              -- JSON of entire task at this version

  -- Change tracking
  changed_fields TEXT NOT NULL,        -- JSON array of field names
  change_reason TEXT,

  -- Checkpoint support
  is_checkpoint INTEGER NOT NULL DEFAULT 0,
  checkpoint_name TEXT,

  -- Actor
  created_by TEXT NOT NULL,

  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(task_id, version)
);

CREATE INDEX idx_task_versions_task ON task_versions(task_id);
CREATE INDEX idx_task_versions_checkpoint ON task_versions(is_checkpoint) WHERE is_checkpoint = 1;
```

**Acceptance Criteria:**
- [ ] Table created with all columns
- [ ] Version numbers auto-increment per task
- [ ] Checkpoints queryable efficiently
- [ ] Full snapshot stored as JSON

---

### IMPL-1.9: Add `auto_approve_reviews` to `task_lists_v2`

**File:** `server/db/migrations/YYYYMMDD_add_auto_approve_reviews.sql`

**Schema:**
```sql
ALTER TABLE task_lists_v2
ADD COLUMN auto_approve_reviews INTEGER NOT NULL DEFAULT 0;
```

**Acceptance Criteria:**
- [ ] Column added to existing table
- [ ] Default value is 0 (false)
- [ ] Existing rows have default value

---

### Phase 1 Verification

**Run all migrations:**
```bash
npm run migrate
npm run migrate:status
```

**Verify tables exist:**
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'task_%';
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'prd%';
```

---

## Phase 2: TypeScript Types

**Goal:** Create TypeScript interfaces for all new entities.

**Dependencies:** Phase 1 (schema must exist for validation)
**Blocking:** Phase 3, Phase 4, Phase 5

### IMPL-2.1: Create `types/task-impact.ts`

**File:** `server/types/task-impact.ts`

```typescript
/**
 * Impact types representing what a task affects
 */
export type ImpactType = 'file' | 'api' | 'function' | 'database' | 'type';

/**
 * CRUD operations for impacts
 */
export type ImpactOperation = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';

/**
 * Source of impact prediction
 */
export type ImpactSource = 'ai' | 'pattern' | 'user' | 'validated';

/**
 * Task Impact entity
 */
export interface TaskImpact {
  id: string;
  taskId: string;

  impactType: ImpactType;
  operation: ImpactOperation;

  targetPath: string;
  targetName?: string;
  targetSignature?: string;

  confidence: number;  // 0.0 - 1.0
  source: ImpactSource;

  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a task impact
 */
export interface CreateTaskImpactInput {
  taskId: string;
  impactType: ImpactType;
  operation: ImpactOperation;
  targetPath: string;
  targetName?: string;
  targetSignature?: string;
  confidence?: number;
  source?: ImpactSource;
}

/**
 * Conflict detection result
 */
export interface ImpactConflict {
  taskAId: string;
  taskBId: string;
  conflictType: 'write-write' | 'write-delete' | 'delete-delete' | 'delete-read';
  targetPath: string;
  severity: 'blocking' | 'warning';
}
```

**Acceptance Criteria:**
- [ ] All types exported correctly
- [ ] Imports work in other files
- [ ] Type guards work correctly

---

### IMPL-2.2: Create `types/task-appendix.ts`

**File:** `server/types/task-appendix.ts`

```typescript
/**
 * All supported appendix types
 */
export type AppendixType =
  | 'prd_reference'
  | 'code_context'
  | 'gotcha_list'
  | 'rollback_plan'
  | 'test_context'
  | 'dependency_notes'
  | 'architecture_decision'
  | 'user_story'
  | 'acceptance_criteria'
  | 'research_notes'
  | 'api_contract';

/**
 * Storage type for appendix content
 */
export type AppendixContentType = 'inline' | 'reference';

/**
 * Task Appendix entity
 */
export interface TaskAppendix {
  id: string;
  taskId: string;

  appendixType: AppendixType;
  contentType: AppendixContentType;

  // For inline storage
  content?: string;

  // For reference storage
  referenceId?: string;
  referenceTable?: string;

  position: number;

  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating an appendix
 */
export interface CreateTaskAppendixInput {
  taskId: string;
  appendixType: AppendixType;
  content?: string;
  referenceId?: string;
  referenceTable?: string;
  position?: number;
}

/**
 * Resolved appendix with content loaded
 */
export interface ResolvedAppendix extends TaskAppendix {
  resolvedContent: string;
}
```

**Acceptance Criteria:**
- [ ] All 11 appendix types defined
- [ ] Both storage types supported
- [ ] ResolvedAppendix interface for loaded content

---

### IMPL-2.3: Create `types/prd.ts`

**File:** `server/types/prd.ts`

```typescript
/**
 * PRD status lifecycle
 */
export type PrdStatus = 'draft' | 'review' | 'approved' | 'archived';

/**
 * PRD link types for task relationships
 */
export type PrdLinkType = 'implements' | 'tests' | 'related';

/**
 * Product Requirements Document entity
 */
export interface PRD {
  id: string;
  slug: string;
  title: string;

  userId: string;
  projectId?: string;
  parentPrdId?: string;

  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;

  successCriteria: string[];
  constraints: string[];
  outOfScope: string[];

  status: PrdStatus;

  approvedAt?: string;
  approvedBy?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * PRD with resolved relationships
 */
export interface PRDWithRelations extends PRD {
  parentPrd?: PRD;
  childPrds: PRD[];
  taskLists: PrdTaskListLink[];
  tasks: PrdTaskLink[];
}

/**
 * PRD to Task List junction
 */
export interface PrdTaskListLink {
  id: string;
  prdId: string;
  taskListId: string;
  position: number;
  createdAt: string;
}

/**
 * PRD to Task junction
 */
export interface PrdTaskLink {
  id: string;
  prdId: string;
  taskId: string;
  requirementRef?: string;
  linkType: PrdLinkType;
  createdAt: string;
}

/**
 * Input for creating a PRD
 */
export interface CreatePrdInput {
  title: string;
  slug?: string;  // Auto-generated if not provided
  projectId?: string;
  parentPrdId?: string;
  problemStatement?: string;
  targetUsers?: string;
  functionalDescription?: string;
  successCriteria?: string[];
  constraints?: string[];
  outOfScope?: string[];
}

/**
 * PRD coverage statistics
 */
export interface PrdCoverage {
  prdId: string;
  totalRequirements: number;
  coveredRequirements: number;
  coveragePercent: number;

  bySection: {
    successCriteria: { total: number; covered: number };
    constraints: { total: number; verified: number };
  };

  linkedTaskLists: number;
  linkedTasks: number;
  completedTasks: number;
}
```

**Acceptance Criteria:**
- [ ] All PRD types defined
- [ ] Coverage tracking types complete
- [ ] Junction types match DB schema

---

### IMPL-2.4: Create `types/task-test.ts`

**File:** `server/types/task-test.ts`

```typescript
/**
 * Test levels
 * 1 = Syntax/compile check
 * 2 = Unit tests
 * 3 = Integration/E2E tests
 */
export type TestLevel = 1 | 2 | 3;

/**
 * Test result entity
 */
export interface TaskTestResult {
  id: string;
  taskId: string;

  testLevel: TestLevel;
  testName?: string;

  command: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  durationMs: number;

  passed: boolean;

  executionId?: string;
  agentId?: string;

  createdAt: string;
}

/**
 * Test configuration for a task
 */
export interface TaskTestConfig {
  level: TestLevel;
  command: string;
  expectedExitCode: number;
  timeout: number;
  description: string;
}

/**
 * Validation result summary
 */
export interface ValidationResult {
  taskId: string;
  overallPassed: boolean;
  totalDuration: number;

  levels: {
    level: TestLevel;
    passed: boolean;
    results: TaskTestResult[];
  }[];
}

/**
 * Input for running validation
 */
export interface RunValidationInput {
  taskId: string;
  levels?: TestLevel[];  // Default: all levels
  executionId?: string;
  agentId?: string;
}
```

**Acceptance Criteria:**
- [ ] Three test levels defined
- [ ] Configuration and result types complete
- [ ] Validation summary type supports UI

---

### IMPL-2.5: Create `types/cascade.ts`

**File:** `server/types/cascade.ts`

```typescript
/**
 * Types of changes that trigger cascade
 */
export type CascadeTrigger =
  | 'file_impact_changed'
  | 'api_impact_changed'
  | 'function_impact_changed'
  | 'database_impact_changed'
  | 'type_impact_changed'
  | 'status_changed'
  | 'dependency_changed'
  | 'priority_changed';

/**
 * Cascade effect on a related task
 */
export interface CascadeEffect {
  affectedTaskId: string;
  affectedTaskDisplayId: string;

  trigger: CascadeTrigger;
  reason: string;

  impactType: 'direct' | 'transitive';
  depth: number;  // 1 = direct, 2+ = transitive

  suggestedAction: 'review' | 'auto_update' | 'block' | 'notify';
  autoApprovable: boolean;
}

/**
 * Cascade analysis result
 */
export interface CascadeAnalysis {
  sourceTaskId: string;
  changeType: CascadeTrigger;

  directEffects: CascadeEffect[];
  transitiveEffects: CascadeEffect[];

  totalAffected: number;
  requiresReview: number;
  autoApprovable: number;

  taskListAutoApprove: boolean;  // From task_lists_v2.auto_approve_reviews
}

/**
 * Cascade execution result
 */
export interface CascadeExecutionResult {
  sourceTaskId: string;

  applied: {
    taskId: string;
    action: string;
    success: boolean;
  }[];

  flaggedForReview: string[];  // Task IDs
  failed: {
    taskId: string;
    error: string;
  }[];
}
```

**Acceptance Criteria:**
- [ ] All cascade trigger types defined
- [ ] Effect depth tracking supports visualization
- [ ] Execution result matches API needs

---

### IMPL-2.6: Create `types/task-version.ts`

**File:** `server/types/task-version.ts`

```typescript
/**
 * Task version entity
 */
export interface TaskVersion {
  id: string;
  taskId: string;
  version: number;

  snapshot: Record<string, unknown>;  // Full task state
  changedFields: string[];
  changeReason?: string;

  isCheckpoint: boolean;
  checkpointName?: string;

  createdBy: string;
  createdAt: string;
}

/**
 * Version diff between two versions
 */
export interface VersionDiff {
  fromVersion: number;
  toVersion: number;

  changes: {
    field: string;
    from: unknown;
    to: unknown;
  }[];
}

/**
 * Input for creating a checkpoint
 */
export interface CreateCheckpointInput {
  taskId: string;
  name: string;
  reason?: string;
}

/**
 * Input for restoring a version
 */
export interface RestoreVersionInput {
  taskId: string;
  targetVersion: number;
  reason?: string;
}
```

**Acceptance Criteria:**
- [ ] Version snapshot stores complete state
- [ ] Diff calculation types support UI
- [ ] Checkpoint and restore inputs defined

---

### IMPL-2.7: Update `types/task.ts`

**File:** `server/types/task.ts` (existing file - update)

Add the following to existing Task interface:

```typescript
import { TaskImpact } from './task-impact';
import { TaskAppendix } from './task-appendix';

// Add to existing Task interface or create extended version
export interface TaskWithRelations extends Task {
  impacts: TaskImpact[];
  appendices: TaskAppendix[];
  testResults: TaskTestResult[];
  stateHistory: TaskStateHistoryEntry[];
  versions: TaskVersion[];

  // PRD linkage (if any)
  linkedPrds: {
    prdId: string;
    prdTitle: string;
    requirementRef?: string;
  }[];
}

/**
 * State history entry
 */
export interface TaskStateHistoryEntry {
  id: string;
  taskId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  actorType: 'user' | 'agent' | 'system';
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

**Acceptance Criteria:**
- [ ] Existing types preserved
- [ ] New relationships added
- [ ] Imports work correctly

---

### Phase 2 Verification

```bash
npx tsc --noEmit
```

All type files should compile without errors.

---

## Phase 3: Core Services

**Goal:** Implement CRUD services for all new entities.

**Dependencies:** Phase 1, Phase 2
**Blocking:** Phase 4, Phase 5

### IMPL-3.1: Create `task-impact-service.ts`

**File:** `server/services/task-agent/task-impact-service.ts`

**Functions:**
```typescript
export class TaskImpactService {
  // CRUD
  async create(input: CreateTaskImpactInput): Promise<TaskImpact>
  async getById(id: string): Promise<TaskImpact | null>
  async getByTaskId(taskId: string): Promise<TaskImpact[]>
  async update(id: string, updates: Partial<CreateTaskImpactInput>): Promise<TaskImpact>
  async delete(id: string): Promise<void>
  async deleteByTaskId(taskId: string): Promise<void>

  // Bulk operations
  async createBulk(taskId: string, impacts: CreateTaskImpactInput[]): Promise<TaskImpact[]>
  async replaceAll(taskId: string, impacts: CreateTaskImpactInput[]): Promise<TaskImpact[]>

  // Queries
  async getByTargetPath(targetPath: string): Promise<TaskImpact[]>
  async getByImpactType(impactType: ImpactType): Promise<TaskImpact[]>

  // Validation
  async validateActualImpact(taskId: string, actualFiles: string[]): Promise<void>
  async updateConfidence(id: string, newConfidence: number, source: ImpactSource): Promise<void>
}
```

**Acceptance Criteria:**
- [ ] All CRUD operations work
- [ ] Bulk operations are transactional
- [ ] Validation updates confidence scores

---

### IMPL-3.2: Create `task-appendix-service.ts`

**File:** `server/services/task-agent/task-appendix-service.ts`

**Functions:**
```typescript
export class TaskAppendixService {
  // CRUD
  async create(input: CreateTaskAppendixInput): Promise<TaskAppendix>
  async getById(id: string): Promise<TaskAppendix | null>
  async getByTaskId(taskId: string): Promise<TaskAppendix[]>
  async getByTaskIdAndType(taskId: string, type: AppendixType): Promise<TaskAppendix[]>
  async update(id: string, updates: Partial<CreateTaskAppendixInput>): Promise<TaskAppendix>
  async delete(id: string): Promise<void>

  // Resolution
  async resolve(appendix: TaskAppendix): Promise<ResolvedAppendix>
  async resolveAll(taskId: string): Promise<ResolvedAppendix[]>

  // Reordering
  async reorder(taskId: string, appendixIds: string[]): Promise<void>

  // Bulk
  async attachFromKnowledgeBase(taskId: string, kbEntryIds: string[]): Promise<TaskAppendix[]>
}
```

**Acceptance Criteria:**
- [ ] Inline content stored directly
- [ ] Reference content resolved from other tables
- [ ] Ordering preserved and updatable

---

### IMPL-3.3: Create `prd-service.ts`

**File:** `server/services/prd-service.ts`

**Functions:**
```typescript
export class PrdService {
  // CRUD
  async create(input: CreatePrdInput, userId: string): Promise<PRD>
  async getById(id: string): Promise<PRD | null>
  async getBySlug(slug: string): Promise<PRD | null>
  async getByUserId(userId: string): Promise<PRD[]>
  async getByProjectId(projectId: string): Promise<PRD[]>
  async update(id: string, updates: Partial<CreatePrdInput>): Promise<PRD>
  async delete(id: string): Promise<void>

  // Hierarchy
  async getChildren(prdId: string): Promise<PRD[]>
  async getParent(prdId: string): Promise<PRD | null>
  async getHierarchy(prdId: string): Promise<PRDWithRelations>

  // Status
  async updateStatus(id: string, status: PrdStatus, userId?: string): Promise<PRD>
  async approve(id: string, userId: string): Promise<PRD>

  // Slug generation
  async generateSlug(title: string, projectId?: string): Promise<string>
}
```

**Acceptance Criteria:**
- [ ] Slug auto-generation works
- [ ] Hierarchy traversal efficient
- [ ] Approval workflow enforced

---

### IMPL-3.4: Create `prd-link-service.ts`

**File:** `server/services/prd-link-service.ts`

**Functions:**
```typescript
export class PrdLinkService {
  // Task List links
  async linkTaskList(prdId: string, taskListId: string, position?: number): Promise<PrdTaskListLink>
  async unlinkTaskList(prdId: string, taskListId: string): Promise<void>
  async getLinkedTaskLists(prdId: string): Promise<PrdTaskListLink[]>
  async reorderTaskLists(prdId: string, taskListIds: string[]): Promise<void>

  // Task links
  async linkTask(prdId: string, taskId: string, requirementRef?: string, linkType?: PrdLinkType): Promise<PrdTaskLink>
  async unlinkTask(prdId: string, taskId: string): Promise<void>
  async getLinkedTasks(prdId: string): Promise<PrdTaskLink[]>
  async getTasksByRequirement(prdId: string, requirementRef: string): Promise<PrdTaskLink[]>

  // Reverse lookups
  async getPrdsForTaskList(taskListId: string): Promise<PRD[]>
  async getPrdsForTask(taskId: string): Promise<PRD[]>

  // Auto-linking
  async suggestLinks(prdId: string): Promise<{ taskLists: string[]; tasks: string[] }>
  async autoLink(prdId: string, minConfidence: number): Promise<{ linked: number; skipped: number }>
}
```

**Acceptance Criteria:**
- [ ] Bidirectional linking works
- [ ] Position ordering maintained
- [ ] Auto-link suggestions based on content similarity

---

### IMPL-3.5: Create `prd-coverage-service.ts`

**File:** `server/services/prd-coverage-service.ts`

**Functions:**
```typescript
export class PrdCoverageService {
  // Coverage calculation
  async calculateCoverage(prdId: string): Promise<PrdCoverage>
  async getCoverageBySection(prdId: string): Promise<Record<string, number>>

  // Requirement tracking
  async getUncoveredRequirements(prdId: string): Promise<string[]>
  async getRequirementCoverage(prdId: string, requirementRef: string): Promise<{ covered: boolean; tasks: string[] }>

  // Progress
  async getCompletionProgress(prdId: string): Promise<{ total: number; completed: number; percentage: number }>

  // Notifications
  async checkCoverageThreshold(prdId: string, threshold: number): Promise<boolean>
}
```

**Acceptance Criteria:**
- [ ] Coverage calculated from linked tasks
- [ ] Per-requirement tracking works
- [ ] Progress updates in real-time

---

### IMPL-3.6: Create `task-version-service.ts`

**File:** `server/services/task-agent/task-version-service.ts`

**Functions:**
```typescript
export class TaskVersionService {
  // Version creation (called automatically on task changes)
  async createVersion(taskId: string, changedFields: string[], reason?: string, userId?: string): Promise<TaskVersion>

  // Queries
  async getVersions(taskId: string): Promise<TaskVersion[]>
  async getVersion(taskId: string, version: number): Promise<TaskVersion | null>
  async getLatestVersion(taskId: string): Promise<TaskVersion | null>

  // Comparison
  async diff(taskId: string, fromVersion: number, toVersion: number): Promise<VersionDiff>

  // Checkpoints
  async createCheckpoint(input: CreateCheckpointInput, userId: string): Promise<TaskVersion>
  async getCheckpoints(taskId: string): Promise<TaskVersion[]>

  // Restoration
  async restore(input: RestoreVersionInput, userId: string): Promise<Task>
  async previewRestore(taskId: string, targetVersion: number): Promise<VersionDiff>
}
```

**Acceptance Criteria:**
- [ ] Versions created automatically on changes
- [ ] Checkpoints queryable separately
- [ ] Restore creates new version (not overwrite)

---

### IMPL-3.7: Create `task-state-history-service.ts`

**File:** `server/services/task-agent/task-state-history-service.ts`

**Functions:**
```typescript
export class TaskStateHistoryService {
  // Recording (called automatically on status changes)
  async record(taskId: string, fromStatus: string | null, toStatus: string, changedBy: string, actorType: 'user' | 'agent' | 'system', reason?: string): Promise<TaskStateHistoryEntry>

  // Queries
  async getHistory(taskId: string): Promise<TaskStateHistoryEntry[]>
  async getHistoryInRange(taskId: string, from: Date, to: Date): Promise<TaskStateHistoryEntry[]>
  async getLastTransition(taskId: string): Promise<TaskStateHistoryEntry | null>

  // Analytics
  async getTimeInStatus(taskId: string, status: string): Promise<number>  // milliseconds
  async getTransitionCount(taskId: string): Promise<number>
  async getAverageTimeToComplete(taskListId: string): Promise<number>
}
```

**Acceptance Criteria:**
- [ ] All status changes recorded
- [ ] Actor properly attributed
- [ ] Analytics queries performant

---

### IMPL-3.8: Create `cascade-analyzer-service.ts`

**File:** `server/services/task-agent/cascade-analyzer-service.ts`

**Functions:**
```typescript
export class CascadeAnalyzerService {
  // Analysis
  async analyze(taskId: string, changeType: CascadeTrigger, changes: Record<string, unknown>): Promise<CascadeAnalysis>

  // Direct effects
  async findDirectlyAffected(taskId: string, changeType: CascadeTrigger): Promise<CascadeEffect[]>

  // Transitive effects
  async findTransitivelyAffected(directEffects: CascadeEffect[], maxDepth?: number): Promise<CascadeEffect[]>

  // Conflict detection
  async detectFileConflicts(taskId: string, newImpacts: TaskImpact[]): Promise<ImpactConflict[]>

  // Auto-approve check
  async checkAutoApprove(taskId: string): Promise<boolean>
}
```

**Acceptance Criteria:**
- [ ] Direct effects identified by file/API overlap
- [ ] Transitive effects follow dependency chain
- [ ] Auto-approve respects task list setting

---

### IMPL-3.9: Create `cascade-executor-service.ts`

**File:** `server/services/task-agent/cascade-executor-service.ts`

**Functions:**
```typescript
export class CascadeExecutorService {
  // Execution
  async execute(analysis: CascadeAnalysis, approveAll?: boolean): Promise<CascadeExecutionResult>

  // Selective execution
  async executeSelected(analysis: CascadeAnalysis, selectedTaskIds: string[]): Promise<CascadeExecutionResult>

  // Flagging
  async flagForReview(taskIds: string[], reason: string): Promise<void>
  async clearReviewFlag(taskId: string): Promise<void>

  // Notifications
  async notifyAffectedTasks(analysis: CascadeAnalysis): Promise<void>
}
```

**Acceptance Criteria:**
- [ ] Changes applied atomically
- [ ] Review flags visible in UI
- [ ] Notifications sent to appropriate channels

---

### IMPL-3.10: Create `task-test-service.ts`

**File:** `server/services/task-agent/task-test-service.ts`

**Functions:**
```typescript
export class TaskTestService {
  // Configuration
  async setTestConfig(taskId: string, configs: TaskTestConfig[]): Promise<void>
  async getTestConfig(taskId: string): Promise<TaskTestConfig[]>

  // Execution
  async runValidation(input: RunValidationInput): Promise<ValidationResult>
  async runLevel(taskId: string, level: TestLevel, executionContext?: { executionId?: string; agentId?: string }): Promise<TaskTestResult>

  // Results
  async getResults(taskId: string): Promise<TaskTestResult[]>
  async getLatestResults(taskId: string): Promise<ValidationResult | null>
  async getResultsByExecution(executionId: string): Promise<TaskTestResult[]>

  // Acceptance criteria
  async checkAcceptanceCriteria(taskId: string): Promise<{ passed: boolean; criteria: { text: string; met: boolean }[] }>
}
```

**Acceptance Criteria:**
- [ ] Three test levels execute correctly
- [ ] Results stored with full output
- [ ] Acceptance criteria checked separately

---

## Phase 4: Task Agent Services

**Goal:** Implement AI-powered and analysis services specific to Task Agent functionality.

**Dependencies:** Phase 3
**Blocking:** Phase 5

### IMPL-4.1: Create `file-impact-analyzer.ts`

**File:** `server/services/task-agent/file-impact-analyzer.ts`

**Functions:**
```typescript
export class FileImpactAnalyzer {
  // AI estimation
  async estimateImpacts(task: Task): Promise<TaskImpact[]>

  // Pattern matching
  async matchHistoricalPatterns(title: string, category: TaskCategory): Promise<TaskImpact[]>

  // Merging
  async mergeEstimates(aiEstimates: TaskImpact[], patternEstimates: TaskImpact[]): Promise<TaskImpact[]>

  // Validation
  async validatePredictions(taskId: string, actualFiles: string[]): Promise<{ accuracy: number; missed: string[]; extra: string[] }>

  // Learning
  async recordActualImpact(taskId: string, filePath: string, operation: ImpactOperation): Promise<void>
}
```

**Acceptance Criteria:**
- [ ] AI estimates have reasonable confidence
- [ ] Patterns improve over time
- [ ] Validation feedback loop works

---

### IMPL-4.2: Create `file-conflict-detector.ts`

**File:** `server/services/task-agent/file-conflict-detector.ts`

**Functions:**
```typescript
export class FileConflictDetector {
  // Conflict detection
  async detectConflicts(taskAId: string, taskBId: string): Promise<ImpactConflict[]>
  async canRunParallel(taskAId: string, taskBId: string): Promise<boolean>

  // Conflict matrix
  async getConflictMatrix(taskIds: string[]): Promise<Map<string, Map<string, ImpactConflict[]>>>

  // Conflict type determination
  getConflictType(opA: ImpactOperation, opB: ImpactOperation): 'blocking' | 'warning' | null

  // Batch check
  async findAllConflicts(taskListId: string): Promise<ImpactConflict[]>
}
```

**Conflict Matrix:**
| Task A | Task B | Conflict? |
|--------|--------|-----------|
| CREATE | CREATE | blocking |
| CREATE | UPDATE | blocking |
| CREATE | DELETE | blocking |
| UPDATE | UPDATE | blocking |
| UPDATE | DELETE | blocking |
| DELETE | DELETE | blocking |
| READ | READ | none |
| READ | CREATE | none |
| READ | UPDATE | warning |
| READ | DELETE | blocking |

**Acceptance Criteria:**
- [ ] Conflict matrix implemented correctly
- [ ] Parallel check fast for many tasks
- [ ] Warnings vs blocking distinguished

---

### IMPL-4.3: Create `atomicity-validator.ts`

**File:** `server/services/task-agent/atomicity-validator.ts`

**Functions:**
```typescript
export class AtomicityValidator {
  // Validation
  async validate(task: Task): Promise<AtomicityResult>
  async validateAll(taskIds: string[]): Promise<Map<string, AtomicityResult>>

  // Individual rules
  async checkSingleConcern(task: Task): Promise<RuleResult>
  async checkBoundedFiles(task: Task, maxFiles?: number): Promise<RuleResult>
  async checkTimeBounded(task: Task, maxHours?: number): Promise<RuleResult>
  async checkTestable(task: Task): Promise<RuleResult>
  async checkIndependent(task: Task): Promise<RuleResult>
  async checkClearCompletion(task: Task): Promise<RuleResult>
}

interface AtomicityResult {
  isAtomic: boolean;
  score: number;  // 0-100
  rules: RuleResult[];
  suggestedSplits?: string[];
}

interface RuleResult {
  rule: string;
  passed: boolean;
  score: number;
  reason?: string;
}
```

**Six Atomicity Rules:**
1. **Single Concern** - One logical change only
2. **Bounded Files** - ≤5 files touched
3. **Time Bounded** - Completable in <1 day
4. **Testable** - Has clear validation criteria
5. **Independent** - Minimal dependencies
6. **Clear Completion** - Unambiguous done state

**Acceptance Criteria:**
- [ ] All 6 rules implemented
- [ ] Scoring reflects severity
- [ ] Split suggestions actionable

---

### IMPL-4.4: Create `task-decomposer.ts`

**File:** `server/services/task-agent/task-decomposer.ts`

**Functions:**
```typescript
export class TaskDecomposer {
  // Decomposition
  async decompose(taskId: string): Promise<DecompositionResult>
  async suggestSplits(task: Task): Promise<SplitSuggestion[]>

  // Execution
  async executeDecomposition(taskId: string, splits: SplitSuggestion[]): Promise<Task[]>

  // Decision tree
  async shouldDecompose(task: Task): Promise<{ should: boolean; reasons: string[] }>
}

interface DecompositionResult {
  originalTaskId: string;
  suggestedTasks: SplitSuggestion[];
  totalEstimatedEffort: string;
  decompositionReason: string;
}

interface SplitSuggestion {
  title: string;
  description: string;
  category: TaskCategory;
  estimatedEffort: string;
  dependencies: string[];  // References to other splits
  impacts: CreateTaskImpactInput[];
}
```

**Acceptance Criteria:**
- [ ] Decomposition preserves all scope
- [ ] Dependencies between splits set correctly
- [ ] Original task marked as superseded

---

### IMPL-4.5: Create `nlp-parser.ts`

**File:** `server/services/task-agent/nlp-parser.ts`

**Functions:**
```typescript
export class NlpParser {
  // Parsing
  async parse(input: string): Promise<ParsedTask>

  // Extraction
  extractTitle(input: string): { title: string; confidence: number }
  extractCategory(input: string): { category: TaskCategory; confidence: number; signals: string[] }
  extractPriority(input: string): { priority: number; confidence: number; signals: string[] }
  extractEntities(input: string): { files: string[]; components: string[]; functions: string[]; endpoints: string[] }
  extractRelationships(input: string): { type: string; targetHint: string; confidence: number }[]

  // Questions
  generateClarifyingQuestions(parsed: ParsedTask): string[]
}
```

**Acceptance Criteria:**
- [ ] Handles various input formats
- [ ] Confidence scores accurate
- [ ] Clarifying questions relevant

---

### IMPL-4.6: Create `display-id-generator.ts`

**File:** `server/services/task-agent/display-id-generator.ts`

**Functions:**
```typescript
export class DisplayIdGenerator {
  // Generation
  async generate(projectCode: string, categoryCode: string): Promise<string>
  async generateBatch(projectCode: string, categoryCode: string, count: number): Promise<string[]>

  // Parsing
  parse(displayId: string): { projectCode: string; categoryCode: string; sequence: number } | null

  // Lookup
  async getNextSequence(projectCode: string, categoryCode: string): Promise<number>

  // Project codes
  async getProjectCode(projectId: string): Promise<string>
  async createProjectCode(projectId: string, code: string): Promise<void>
}
```

**Format:** `TU-{PROJECT}-{CATEGORY}-{SEQUENCE}`
- Example: `TU-IDEA-FEA-042`

**Acceptance Criteria:**
- [ ] Sequence numbers never duplicate
- [ ] Batch generation atomic
- [ ] Parse/format round-trip works

---

### IMPL-4.7: Create `question-engine.ts`

**File:** `server/services/task-agent/question-engine.ts`

**Functions:**
```typescript
export class QuestionEngine {
  // Question generation
  async generateQuestions(task: Task, maxQuestions?: number): Promise<Question[]>
  async getNextQuestions(taskId: string, previousAnswers: Answer[]): Promise<Question[]>

  // Gap analysis
  async analyzeGaps(task: Task): Promise<GapAnalysis>
  async getCompletenessScore(task: Task): Promise<CompletenessScore>

  // Answer processing
  async processAnswer(taskId: string, questionId: string, answer: string): Promise<ProcessedAnswer>
  async applyAnswers(taskId: string, answers: Answer[]): Promise<Task>

  // Categories
  getQuestionCategories(): QuestionCategory[]
}

interface Question {
  id: string;
  category: QuestionCategory;
  text: string;
  priority: number;
  targetField?: string;
}

type QuestionCategory = 'outcome' | 'scope' | 'implementation' | 'dependencies' | 'testing' | 'risks' | 'acceptance' | 'context';
```

**Acceptance Criteria:**
- [ ] Questions prioritized by importance
- [ ] No minimum - asks until complete
- [ ] Answers update task appropriately

---

### IMPL-4.8: Create `priority-calculator.ts`

**File:** `server/services/task-agent/priority-calculator.ts`

**Functions:**
```typescript
export class PriorityCalculator {
  // Calculation
  async calculate(taskId: string): Promise<PriorityResult>
  async calculateForList(taskListId: string): Promise<Map<string, PriorityResult>>

  // Factors
  async getBlockingCount(taskId: string): Promise<number>
  async getDependencyDepth(taskId: string): Promise<number>
  async getEffortScore(task: Task): Promise<number>
  async getQuickWinScore(task: Task): Promise<number>

  // Sorting
  async sortByPriority(taskIds: string[]): Promise<string[]>
}

interface PriorityResult {
  taskId: string;
  score: number;
  factors: {
    blockingCount: number;
    dependencyDepth: number;
    effortScore: number;
    quickWinBonus: number;
    userPriority: number;
  };
  isQuickWin: boolean;
}
```

**Priority Formula:**
```
score = (blockingCount * 10) + (1/dependencyDepth * 5) + effortScore + quickWinBonus + (userPriority * 2)
```

**Acceptance Criteria:**
- [ ] Blocking tasks prioritized higher
- [ ] Quick wins identified
- [ ] User priority respected

---

## Phase 5: API Routes

**Goal:** Expose all functionality via REST API endpoints.

**Dependencies:** Phase 3, Phase 4
**Blocking:** Phase 6, Phase 7

### IMPL-5.1: Task Impact Routes

**File:** `server/routes/task-agent/task-impacts.ts`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/task-agent/tasks/:taskId/impacts` | Get all impacts for task |
| POST | `/api/task-agent/tasks/:taskId/impacts` | Add impact(s) to task |
| PUT | `/api/task-agent/tasks/:taskId/impacts/:impactId` | Update impact |
| DELETE | `/api/task-agent/tasks/:taskId/impacts/:impactId` | Delete impact |
| POST | `/api/task-agent/tasks/:taskId/impacts/estimate` | AI estimate impacts |
| POST | `/api/task-agent/tasks/:taskId/impacts/validate` | Validate against actual |

---

### IMPL-5.2: Task Appendix Routes

**File:** `server/routes/task-agent/task-appendices.ts`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/task-agent/tasks/:taskId/appendices` | Get all appendices |
| GET | `/api/task-agent/tasks/:taskId/appendices/resolved` | Get with content resolved |
| POST | `/api/task-agent/tasks/:taskId/appendices` | Attach appendix |
| PUT | `/api/task-agent/tasks/:taskId/appendices/:appendixId` | Update appendix |
| DELETE | `/api/task-agent/tasks/:taskId/appendices/:appendixId` | Remove appendix |
| POST | `/api/task-agent/tasks/:taskId/appendices/reorder` | Reorder appendices |

---

### IMPL-5.3: PRD Routes

**File:** `server/routes/prds.ts`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/prds` | List PRDs (with filters) |
| GET | `/api/prds/:id` | Get PRD by ID |
| GET | `/api/prds/slug/:slug` | Get PRD by slug |
| POST | `/api/prds` | Create PRD |
| PUT | `/api/prds/:id` | Update PRD |
| DELETE | `/api/prds/:id` | Delete PRD |
| POST | `/api/prds/:id/approve` | Approve PRD |
| GET | `/api/prds/:id/hierarchy` | Get PRD with parent/children |

---

### IMPL-5.4: PRD Link Routes

**File:** `server/routes/prd-links.ts`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/prds/:prdId/links` | Get all links |
| POST | `/api/prds/:prdId/link-list` | Link task list |
| DELETE | `/api/prds/:prdId/link-list/:taskListId` | Unlink task list |
| POST | `/api/prds/:prdId/link-task` | Link task |
| DELETE | `/api/prds/:prdId/link-task/:taskId` | Unlink task |
| POST | `/api/prds/:prdId/links/reorder` | Reorder links |
| POST | `/api/prds/:prdId/auto-link` | Auto-link by content |

---

### IMPL-5.5: PRD Coverage Routes

**File:** `server/routes/prd-coverage.ts`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/prds/:prdId/coverage` | Get coverage stats |
| GET | `/api/prds/:prdId/coverage/gaps` | Get uncovered requirements |
| GET | `/api/prds/:prdId/progress` | Get completion progress |

---

### IMPL-5.6: PRD Decompose Routes

**File:** `server/routes/prd-decompose.ts`

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/prds/:prdId/decompose` | Preview task extraction |
| POST | `/api/prds/:prdId/decompose/execute` | Create tasks from PRD |

---

### IMPL-5.7: Task Version Routes

**File:** `server/routes/task-agent/task-versions.ts`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/task-agent/tasks/:taskId/versions` | Get version history |
| GET | `/api/task-agent/tasks/:taskId/versions/:version` | Get specific version |
| GET | `/api/task-agent/tasks/:taskId/versions/diff` | Compare versions |
| POST | `/api/task-agent/tasks/:taskId/versions/checkpoint` | Create checkpoint |
| GET | `/api/task-agent/tasks/:taskId/versions/checkpoints` | List checkpoints |
| POST | `/api/task-agent/tasks/:taskId/versions/restore` | Restore version |
| POST | `/api/task-agent/tasks/:taskId/versions/restore/preview` | Preview restore |

---

### IMPL-5.8: Task Cascade Routes

**File:** `server/routes/task-agent/task-cascade.ts`

| Method | Path | Handler |
|--------|------|---------|
| POST | `/api/task-agent/tasks/:taskId/cascade/analyze` | Analyze cascade effects |
| POST | `/api/task-agent/tasks/:taskId/cascade/execute` | Apply cascade |
| GET | `/api/task-agent/task-lists/:listId/auto-approve` | Get auto-approve setting |
| PUT | `/api/task-agent/task-lists/:listId/auto-approve` | Set auto-approve |

---

### IMPL-5.9: Task Test Routes

**File:** `server/routes/task-agent/task-tests.ts`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/task-agent/tasks/:taskId/tests/config` | Get test configuration |
| POST | `/api/task-agent/tasks/:taskId/tests/config` | Set test configuration |
| POST | `/api/task-agent/tasks/:taskId/tests/validate` | Run validation |
| GET | `/api/task-agent/tasks/:taskId/tests/results` | Get test results |
| GET | `/api/task-agent/tasks/:taskId/tests/results/latest` | Get latest results |

---

### IMPL-5.10: Task State History Routes

**File:** `server/routes/task-agent/task-history.ts`

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/task-agent/tasks/:taskId/history` | Get full history |
| GET | `/api/task-agent/tasks/:taskId/history/states` | Get state transitions |
| GET | `/api/task-agent/tasks/:taskId/history/analytics` | Get time analytics |

---

### IMPL-5.11: Register All Routes

**File:** `server/routes/index.ts` (update)

```typescript
import taskImpactsRouter from './task-agent/task-impacts';
import taskAppendicesRouter from './task-agent/task-appendices';
import prdsRouter from './prds';
import prdLinksRouter from './prd-links';
import prdCoverageRouter from './prd-coverage';
import prdDecomposeRouter from './prd-decompose';
import taskVersionsRouter from './task-agent/task-versions';
import taskCascadeRouter from './task-agent/task-cascade';
import taskTestsRouter from './task-agent/task-tests';
import taskHistoryRouter from './task-agent/task-history';

// Register routes
app.use('/api/task-agent/tasks', taskImpactsRouter);
app.use('/api/task-agent/tasks', taskAppendicesRouter);
app.use('/api/prds', prdsRouter);
app.use('/api/prds', prdLinksRouter);
app.use('/api/prds', prdCoverageRouter);
app.use('/api/prds', prdDecomposeRouter);
app.use('/api/task-agent/tasks', taskVersionsRouter);
app.use('/api/task-agent', taskCascadeRouter);
app.use('/api/task-agent/tasks', taskTestsRouter);
app.use('/api/task-agent/tasks', taskHistoryRouter);
```

---

## Phase 6: Telegram Integration

**Goal:** Add Telegram commands for PRD and impact management.

**Dependencies:** Phase 5
**Blocking:** None

### IMPL-6.1: PRD Commands

**File:** `server/communication/task-agent-telegram-handler.ts` (update)

| Command | Description |
|---------|-------------|
| `/prd create <title>` | Start PRD creation flow |
| `/prd list` | List user's PRDs |
| `/prd show <slug>` | Show PRD details |
| `/prd link <slug> <list>` | Link PRD to task list |
| `/prd coverage <slug>` | Show coverage stats |
| `/prd decompose <slug>` | Extract tasks from PRD |

---

### IMPL-6.2: Impact Commands

**File:** `server/communication/task-agent-telegram-handler.ts` (update)

| Command | Description |
|---------|-------------|
| `/impact <taskId>` | Show task impacts |
| `/impact add <taskId> <file>` | Add file impact |
| `/impact estimate <taskId>` | AI estimate impacts |
| `/conflict <taskId>` | Check for conflicts |

---

### IMPL-6.3: Enhanced `/newtask`

**File:** `server/communication/task-agent-telegram-handler.ts` (update)

Update existing `/newtask` to:
- Auto-estimate impacts after creation
- Show conflict warnings
- Suggest PRD linking if context matches

---

## Phase 7: UI Components

**Goal:** Build frontend components for new functionality.

**Dependencies:** Phase 5
**Blocking:** None

### IMPL-7.1: PRD Components

| Component | File | Description |
|-----------|------|-------------|
| PrdList | `src/components/prd/PrdList.tsx` | List PRDs with filters |
| PrdDetail | `src/components/prd/PrdDetail.tsx` | Full PRD view |
| PrdForm | `src/components/prd/PrdForm.tsx` | Create/edit PRD |
| PrdHierarchy | `src/components/prd/PrdHierarchy.tsx` | Tree view of PRD hierarchy |
| PrdCoverage | `src/components/prd/PrdCoverage.tsx` | Coverage visualization |

---

### IMPL-7.2: Task Impact Components

| Component | File | Description |
|-----------|------|-------------|
| TaskImpactList | `src/components/task/TaskImpactList.tsx` | List impacts |
| TaskImpactEditor | `src/components/task/TaskImpactEditor.tsx` | Add/edit impacts |
| ImpactConflictWarning | `src/components/task/ImpactConflictWarning.tsx` | Conflict alert |

---

### IMPL-7.3: Task Appendix Components

| Component | File | Description |
|-----------|------|-------------|
| AppendixList | `src/components/task/AppendixList.tsx` | List appendices |
| AppendixAttacher | `src/components/task/AppendixAttacher.tsx` | Attach new appendix |
| AppendixViewer | `src/components/task/AppendixViewer.tsx` | View resolved content |

---

### IMPL-7.4: Version & History Components

| Component | File | Description |
|-----------|------|-------------|
| VersionTimeline | `src/components/task/VersionTimeline.tsx` | Version history |
| VersionDiff | `src/components/task/VersionDiff.tsx` | Side-by-side diff |
| StateHistory | `src/components/task/StateHistory.tsx` | State transition log |

---

### IMPL-7.5: Cascade Components

| Component | File | Description |
|-----------|------|-------------|
| CascadePreview | `src/components/task/CascadePreview.tsx` | Preview cascade effects |
| CascadeApproval | `src/components/task/CascadeApproval.tsx` | Approve/reject cascade |

---

## Phase 8: Testing & Validation

**Goal:** Comprehensive test coverage for all new functionality.

**Dependencies:** All previous phases
**Blocking:** None

### IMPL-8.1: Unit Tests

| Test File | Coverage |
|-----------|----------|
| `task-impact-service.test.ts` | TaskImpactService |
| `task-appendix-service.test.ts` | TaskAppendixService |
| `prd-service.test.ts` | PrdService |
| `prd-link-service.test.ts` | PrdLinkService |
| `cascade-analyzer.test.ts` | CascadeAnalyzerService |
| `atomicity-validator.test.ts` | AtomicityValidator |
| `file-conflict-detector.test.ts` | FileConflictDetector |
| `display-id-generator.test.ts` | DisplayIdGenerator |

---

### IMPL-8.2: Integration Tests

| Test File | Coverage |
|-----------|----------|
| `prd-api.test.ts` | PRD REST API |
| `task-impacts-api.test.ts` | Task Impacts REST API |
| `cascade-api.test.ts` | Cascade REST API |
| `version-api.test.ts` | Version REST API |

---

### IMPL-8.3: E2E Tests

| Test File | Scenario |
|-----------|----------|
| `prd-to-execution.e2e.ts` | PRD → Tasks → Execution |
| `impact-conflicts.e2e.ts` | Conflict detection and resolution |
| `cascade-propagation.e2e.ts` | Change cascade across tasks |
| `version-restore.e2e.ts` | Version history and restore |

---

## Rollout Strategy

### Stage 1: Database & Types (Week 1)
- Run all migrations
- Deploy types
- Verify schema

### Stage 2: Core Services (Week 2)
- Deploy services
- Internal testing
- Fix bugs

### Stage 3: API Routes (Week 3)
- Deploy routes
- API testing
- Documentation

### Stage 4: Telegram & UI (Week 4)
- Deploy Telegram commands
- Deploy UI components
- User acceptance testing

### Stage 5: Production (Week 5)
- Feature flag rollout
- Monitor metrics
- Full release

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Migration failure | Test on copy of production DB first |
| Performance degradation | Add indexes, profile queries |
| Breaking existing features | Comprehensive integration tests |
| Data loss | Backup before migration, version snapshots |
| Cascade loops | Max depth limit, cycle detection |

---

## Appendix: File Checklist

### New Files to Create

**Migrations (9 files):**
- [ ] `server/db/migrations/YYYYMMDD_create_task_impacts.sql`
- [ ] `server/db/migrations/YYYYMMDD_create_task_appendices.sql`
- [ ] `server/db/migrations/YYYYMMDD_create_prds.sql`
- [ ] `server/db/migrations/YYYYMMDD_create_prd_task_lists.sql`
- [ ] `server/db/migrations/YYYYMMDD_create_prd_tasks.sql`
- [ ] `server/db/migrations/YYYYMMDD_create_task_test_results.sql`
- [ ] `server/db/migrations/YYYYMMDD_create_task_state_history.sql`
- [ ] `server/db/migrations/YYYYMMDD_create_task_versions.sql`
- [ ] `server/db/migrations/YYYYMMDD_add_auto_approve_reviews.sql`

**Types (7 files):**
- [ ] `server/types/task-impact.ts`
- [ ] `server/types/task-appendix.ts`
- [ ] `server/types/prd.ts`
- [ ] `server/types/task-test.ts`
- [ ] `server/types/cascade.ts`
- [ ] `server/types/task-version.ts`
- [ ] `server/types/task.ts` (update)

**Services (18 files):**
- [ ] `server/services/task-agent/task-impact-service.ts`
- [ ] `server/services/task-agent/task-appendix-service.ts`
- [ ] `server/services/prd-service.ts`
- [ ] `server/services/prd-link-service.ts`
- [ ] `server/services/prd-coverage-service.ts`
- [ ] `server/services/task-agent/task-version-service.ts`
- [ ] `server/services/task-agent/task-state-history-service.ts`
- [ ] `server/services/task-agent/cascade-analyzer-service.ts`
- [ ] `server/services/task-agent/cascade-executor-service.ts`
- [ ] `server/services/task-agent/task-test-service.ts`
- [ ] `server/services/task-agent/file-impact-analyzer.ts`
- [ ] `server/services/task-agent/file-conflict-detector.ts`
- [ ] `server/services/task-agent/atomicity-validator.ts`
- [ ] `server/services/task-agent/task-decomposer.ts`
- [ ] `server/services/task-agent/nlp-parser.ts`
- [ ] `server/services/task-agent/display-id-generator.ts`
- [ ] `server/services/task-agent/question-engine.ts`
- [ ] `server/services/task-agent/priority-calculator.ts`

**Routes (10 files):**
- [ ] `server/routes/task-agent/task-impacts.ts`
- [ ] `server/routes/task-agent/task-appendices.ts`
- [ ] `server/routes/prds.ts`
- [ ] `server/routes/prd-links.ts`
- [ ] `server/routes/prd-coverage.ts`
- [ ] `server/routes/prd-decompose.ts`
- [ ] `server/routes/task-agent/task-versions.ts`
- [ ] `server/routes/task-agent/task-cascade.ts`
- [ ] `server/routes/task-agent/task-tests.ts`
- [ ] `server/routes/task-agent/task-history.ts`

**UI Components (15 files):**
- [ ] `src/components/prd/PrdList.tsx`
- [ ] `src/components/prd/PrdDetail.tsx`
- [ ] `src/components/prd/PrdForm.tsx`
- [ ] `src/components/prd/PrdHierarchy.tsx`
- [ ] `src/components/prd/PrdCoverage.tsx`
- [ ] `src/components/task/TaskImpactList.tsx`
- [ ] `src/components/task/TaskImpactEditor.tsx`
- [ ] `src/components/task/ImpactConflictWarning.tsx`
- [ ] `src/components/task/AppendixList.tsx`
- [ ] `src/components/task/AppendixAttacher.tsx`
- [ ] `src/components/task/AppendixViewer.tsx`
- [ ] `src/components/task/VersionTimeline.tsx`
- [ ] `src/components/task/VersionDiff.tsx`
- [ ] `src/components/task/StateHistory.tsx`
- [ ] `src/components/task/CascadePreview.tsx`

**Tests (11 files):**
- [ ] `tests/unit/task-impact-service.test.ts`
- [ ] `tests/unit/task-appendix-service.test.ts`
- [ ] `tests/unit/prd-service.test.ts`
- [ ] `tests/unit/prd-link-service.test.ts`
- [ ] `tests/unit/cascade-analyzer.test.ts`
- [ ] `tests/unit/atomicity-validator.test.ts`
- [ ] `tests/unit/file-conflict-detector.test.ts`
- [ ] `tests/unit/display-id-generator.test.ts`
- [ ] `tests/e2e/prd-to-execution.e2e.ts`
- [ ] `tests/e2e/impact-conflicts.e2e.ts`
- [ ] `tests/e2e/cascade-propagation.e2e.ts`

---

**Total Files:** ~70
**Total Implementation Items:** 62

---

*End of Implementation Plan*
