# Comprehensive Task Decomposition Implementation Plan

## Overview

Implement intelligent task decomposition that properly splits non-atomic tasks into focused subtasks, each with inherited/generated acceptance criteria, appropriate test commands, file impacts, and dependencies.

## Problem Statement

When a task fails the atomicity check (e.g., "Task mentions 3 different components"), clicking "Auto-Fill" should:

1. Analyze the task using PRD/spec context
2. Generate atomic subtasks
3. Split or generate acceptance criteria per subtask
4. Assign appropriate test commands per subtask type
5. Distribute file impacts to relevant subtasks
6. Create proper dependencies between subtasks
7. Allow user review before execution

## Current State Analysis

### What Exists ✅

| Component              | Location                                                   | Status                                 |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------- |
| TaskDecomposer service | `server/services/task-agent/task-decomposer.ts`            | Basic strategies                       |
| AtomicityValidator     | `server/services/task-agent/atomicity-validator.ts`        | Working                                |
| TaskCompletionModal    | `frontend/src/components/pipeline/TaskCompletionModal.tsx` | Shows Auto-Fill                        |
| TaskDecomposer UI      | `frontend/src/components/task-agent/TaskDecomposer.tsx`    | Basic editing                          |
| Auto-populate service  | `server/services/task-agent/task-auto-populate-service.ts` | AC, tests, impacts                     |
| Task relationships     | `schema/entities/task-relationship.ts`                     | 12 types including parent_of, child_of |

### What's Missing ❌

| Gap                                               | Impact                                           |
| ------------------------------------------------- | ------------------------------------------------ |
| No `/api/task-agent/tasks/:id/decompose` endpoint | Frontend can't trigger decomposition             |
| No AC splitting logic                             | Subtasks get no acceptance criteria              |
| No test command distribution                      | All subtasks get same generic tests              |
| No PRD/spec context loading                       | Decomposition lacks domain knowledge             |
| No preview flow                                   | Users can't see/edit before creation             |
| Auto-Fill doesn't trigger decomposition           | Description failures don't lead to decomposition |

## Implementation Plan

### Phase 1: Enhanced Backend Decomposition Service

#### 1.1 Add PRD/Spec Context Loading

**File:** `server/services/task-agent/task-decomposer.ts`

```typescript
// New method to load context
async loadContext(taskId: string): Promise<DecompositionContext> {
  // 1. Load task appendices (acceptance_criteria, prd_reference, etc.)
  // 2. Load linked PRDs via prd_tasks table
  // 3. Load related tasks (implements, inspired_by relationships)
  // 4. Return unified context object
}
```

**Context Structure:**

```typescript
interface DecompositionContext {
  task: Task;
  appendices: TaskAppendix[];
  linkedPrds: PrdInfo[];
  relatedTasks: TaskRelation[];
  fileImpacts: FileImpact[];
  existingAcceptanceCriteria: string[];
}
```

#### 1.2 Intelligent AC Splitting

**New Method:** `splitAcceptanceCriteria()`

```typescript
async splitAcceptanceCriteria(
  criteria: string[],
  subtasks: SplitSuggestion[]
): Promise<Map<number, string[]>> {
  // For each criterion:
  // 1. Analyze keywords (database, API, UI, etc.)
  // 2. Match to subtask by component type
  // 3. If criterion spans multiple subtasks, duplicate or split
  // 4. Generate new criteria for subtasks with none
}
```

**Matching Rules:**
| Criterion Keywords | Target Subtask Type |
|-------------------|---------------------|
| database, table, migration, schema | database |
| API, endpoint, route, request | api |
| component, UI, button, form | ui |
| test, spec, coverage | test |
| type, interface, enum | types |

#### 1.3 Test Command Distribution

**New Method:** `assignTestCommands()`

```typescript
async assignTestCommands(
  subtasks: SplitSuggestion[]
): Promise<SplitSuggestion[]> {
  return subtasks.map(subtask => ({
    ...subtask,
    testCommands: this.getTestsForComponent(subtask.category, subtask.impacts)
  }));
}
```

**Test Command Mapping:**
| Subtask Type | Test Commands |
|--------------|---------------|
| database | `npm run test:db`, `npx tsc --noEmit` |
| api | `npm run test:server`, `npx tsc --noEmit` |
| ui | `npm run test:frontend`, `npx tsc --noEmit` |
| test | `npm test -- --passWithNoTests` |
| types | `npx tsc --noEmit` |

#### 1.4 Enhanced Split Suggestion Interface

```typescript
interface EnhancedSplitSuggestion extends SplitSuggestion {
  acceptanceCriteria: string[]; // NEW: Per-subtask AC
  testCommands: string[]; // NEW: Per-subtask tests
  sourceContext: {
    // NEW: Provenance
    fromPrd?: string;
    fromParentCriteria?: number[];
    reasoning: string;
  };
}

interface DecompositionResult {
  originalTaskId: string;
  suggestedTasks: EnhancedSplitSuggestion[];
  totalEstimatedEffort: string;
  decompositionReason: string;
  contextUsed: {
    // NEW: What context informed the split
    prdsUsed: string[];
    criteriaDistributed: number;
    criteriaGenerated: number;
  };
}
```

### Phase 2: API Routes

#### 2.1 Add Decomposition Endpoints

**File:** `server/routes/task-agent.ts`

```typescript
/**
 * POST /api/task-agent/tasks/:id/decompose
 * Analyze task and generate decomposition suggestions
 */
router.post("/tasks/:taskId/decompose", async (req, res) => {
  const { taskId } = req.params;
  const result = await taskDecomposer.decompose(taskId);
  return res.json(result);
});

/**
 * POST /api/task-agent/tasks/:id/decompose/execute
 * Execute decomposition with user-edited subtasks
 */
router.post("/tasks/:taskId/decompose/execute", async (req, res) => {
  const { taskId } = req.params;
  const { subtasks } = req.body;
  const createdTasks = await taskDecomposer.executeDecomposition(
    taskId,
    subtasks,
  );
  return res.json({
    success: true,
    subtaskIds: createdTasks.map((t) => t.id),
    parentStatus: "skipped",
  });
});

/**
 * GET /api/task-agent/tasks/:id/decompose/preview
 * Preview what decomposition would create (dry-run)
 */
router.get("/tasks/:taskId/decompose/preview", async (req, res) => {
  const { taskId } = req.params;
  const preview = await taskDecomposer.preview(taskId);
  return res.json(preview);
});
```

#### 2.2 Connect Auto-Populate to Decomposition

**File:** `server/services/task-agent/task-auto-populate-service.ts`

When `field === 'description'` and atomicity fails:

```typescript
async suggest(taskId: string, field: AutoPopulateField) {
  if (field === 'description') {
    const atomicity = await atomicityValidator.validate(task);

    if (!atomicity.isAtomic && atomicity.rules.singleConcern.score < 50) {
      // Return decomposition suggestion instead of description suggestions
      return {
        taskId,
        field: 'description',
        suggestions: [],
        requiresDecomposition: true,
        decompositionReason: atomicity.suggestedSplits,
        redirectTo: `/api/task-agent/tasks/${taskId}/decompose`
      };
    }
  }
  // ... existing logic
}
```

### Phase 3: Enhanced Frontend

#### 3.1 Update TaskCompletionModal

**File:** `frontend/src/components/pipeline/TaskCompletionModal.tsx`

Add decomposition flow when Description Auto-Fill returns `requiresDecomposition`:

```typescript
const handleAutoFill = async (section: string) => {
  const result = await fetch(`/api/pipeline/tasks/${taskId}/auto-populate`, {
    method: 'POST',
    body: JSON.stringify({ field: section })
  }).then(r => r.json());

  if (result.requiresDecomposition) {
    // Open TaskDecomposer instead of applying suggestions
    setShowDecomposer(true);
    setDecompositionReason(result.decompositionReason);
    return;
  }
  // ... existing apply logic
};

// Add state for decomposer
const [showDecomposer, setShowDecomposer] = useState(false);

// Render decomposer modal when needed
{showDecomposer && (
  <TaskDecomposerModal
    taskId={taskId}
    taskTitle={taskTitle}
    reason={decompositionReason}
    onClose={() => setShowDecomposer(false)}
    onDecompose={(subtaskIds) => {
      onDecompose?.(subtaskIds);
      onClose();
    }}
  />
)}
```

#### 3.2 Enhanced TaskDecomposer Component

**File:** `frontend/src/components/task-agent/TaskDecomposer.tsx`

Add sections for:

1. **Acceptance Criteria per subtask** (editable list)
2. **Test Commands per subtask** (editable list)
3. **File Impacts per subtask** (tag display)
4. **Dependencies between subtasks** (visual arrows)

```typescript
interface ProposedSubtask {
  title: string;
  description?: string;
  category: string;
  estimatedEffort: string;
  fileImpacts: string[];
  acceptanceCriteria: string[]; // NEW
  testCommands: string[]; // NEW
  dependsOnIndex?: number; // NEW: Index of subtask this depends on
}
```

**UI Enhancements:**

- Expandable sections for AC and tests
- "Add criterion" / "Add test command" buttons
- Drag-to-reorder subtasks
- Visual dependency lines between subtasks
- Preview of what will be created

### Phase 4: Execution with Full Context

#### 4.1 Enhanced executeDecomposition

**File:** `server/services/task-agent/task-decomposer.ts`

```typescript
async executeDecomposition(
  taskId: string,
  subtasks: EnhancedSplitSuggestion[]
): Promise<Task[]> {
  const createdTasks: Task[] = [];
  const idMapping = new Map<number, string>();

  for (let i = 0; i < subtasks.length; i++) {
    const subtask = subtasks[i];

    // 1. Create task
    const newTask = await this.createSubtask(taskId, subtask, i);
    idMapping.set(i, newTask.id);

    // 2. Create acceptance_criteria appendix
    if (subtask.acceptanceCriteria.length > 0) {
      await this.createAppendix(newTask.id, 'acceptance_criteria',
        JSON.stringify(subtask.acceptanceCriteria));
    }

    // 3. Create test_context appendix
    if (subtask.testCommands.length > 0) {
      await this.createAppendix(newTask.id, 'test_context',
        JSON.stringify({ commands: subtask.testCommands }));
    }

    // 4. Create file impacts
    for (const impact of subtask.impacts) {
      await this.createFileImpact(newTask.id, impact);
    }

    createdTasks.push(newTask);
  }

  // 5. Create dependencies between subtasks
  for (let i = 0; i < subtasks.length; i++) {
    if (subtasks[i].dependsOnIndex !== undefined) {
      const sourceId = idMapping.get(i);
      const targetId = idMapping.get(subtasks[i].dependsOnIndex!);
      await this.createRelationship(sourceId, targetId, 'depends_on');
    }
  }

  // 6. Create parent-child relationships
  for (const task of createdTasks) {
    await this.createRelationship(task.id, taskId, 'child_of');
  }

  // 7. Mark original as skipped
  await this.updateTaskStatus(taskId, 'skipped');

  return createdTasks;
}
```

### Phase 5: Integration & Polish

#### 5.1 Add Decomposition to Readiness Flow

When readiness score is low due to `singleConcern` rule:

- Show "Decompose" button prominently
- Disable "Execute Now" until decomposed or atomic

#### 5.2 Track Decomposition History

Add to task state history:

```typescript
{
  fromStatus: 'pending',
  toStatus: 'skipped',
  changedBy: 'task-decomposer',
  actorType: 'system',
  reason: 'Decomposed into 3 subtasks',
  metadata: {
    subtaskIds: ['uuid1', 'uuid2', 'uuid3'],
    decompositionReason: 'Task mentioned 3 different components'
  }
}
```

#### 5.3 WebSocket Events

Emit events for real-time updates:

```typescript
ws.emit("task:decomposed", {
  originalTaskId: taskId,
  subtaskIds: createdTasks.map((t) => t.id),
  timestamp: new Date().toISOString(),
});
```

## File Changes Summary

| File                                                       | Changes                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `server/services/task-agent/task-decomposer.ts`            | Add context loading, AC splitting, test assignment |
| `server/routes/task-agent.ts`                              | Add decompose, execute, preview endpoints          |
| `server/services/task-agent/task-auto-populate-service.ts` | Connect description to decomposition               |
| `frontend/src/components/pipeline/TaskCompletionModal.tsx` | Add decomposition flow                             |
| `frontend/src/components/task-agent/TaskDecomposer.tsx`    | Add AC/test editing                                |

## Database Schema (No Changes Needed)

Existing schema supports all requirements:

- `tasks` - Stores subtasks
- `task_relationships` - `child_of`, `depends_on` relationships
- `task_appendices` - `acceptance_criteria`, `test_context` storage
- `task_file_impacts` - File impact per subtask
- `task_state_history` - Decomposition audit trail

## Testing Strategy

### Unit Tests

- `task-decomposer.test.ts`: Test each split strategy
- `ac-splitter.test.ts`: Test criteria distribution
- `test-assigner.test.ts`: Test command mapping

### Integration Tests

- Full decomposition flow: non-atomic → subtasks with AC/tests
- Verify relationships created correctly
- Verify appendices attached to subtasks

### E2E Tests

- Click Auto-Fill on non-atomic task → decomposition modal
- Edit subtasks → create → verify in database
- Check readiness recalculation after decomposition

## Success Criteria

1. ✅ Clicking Auto-Fill on Description (when non-atomic) opens decomposition flow
2. ✅ Each subtask has relevant acceptance criteria (split or generated)
3. ✅ Each subtask has appropriate test commands based on type
4. ✅ File impacts distributed to relevant subtasks
5. ✅ Dependencies created between sequential subtasks
6. ✅ Parent task marked as skipped with audit trail
7. ✅ Subtasks pass readiness check (≥70% each)
8. ✅ User can edit everything before execution

## Execution Order

1. **Backend first**: Enhance decomposer service with full context
2. **API routes**: Add decompose endpoints to task-agent
3. **Connect auto-populate**: Make description trigger decomposition
4. **Frontend modal**: Update TaskCompletionModal to show decomposer
5. **Frontend decomposer**: Add AC/test editing UI
6. **Integration**: Test full flow end-to-end
7. **Polish**: Add loading states, error handling, WebSocket events
