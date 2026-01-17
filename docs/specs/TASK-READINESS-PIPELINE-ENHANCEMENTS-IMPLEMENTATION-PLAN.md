# Task Readiness & Pipeline Enhancements Implementation Plan

**Created:** 2026-01-17
**Purpose:** Add task readiness validation, parallelism visibility, and task completion UI to the Pipeline Dashboard
**Status:** Ready for Review
**Estimated Effort:** 8-10 development sessions

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Gap Analysis](#2-gap-analysis)
3. [Phase 1: Task Readiness Calculation Service](#phase-1-task-readiness-calculation-service)
4. [Phase 2: Parallelism Visibility & Controls](#phase-2-parallelism-visibility--controls)
5. [Phase 3: Task Completion Modal](#phase-3-task-completion-modal)
6. [Phase 4: Auto-Populate Integration](#phase-4-auto-populate-integration)
7. [Phase 5: Hard Gate Enforcement](#phase-5-hard-gate-enforcement)
8. [Phase 6: E2E Testing](#phase-6-e2e-testing)
9. [Test Scripts & Pass Criteria](#test-scripts--pass-criteria)
10. [Reference Documents](#reference-documents)

---

## 1. Executive Summary

### 1.1 Problem Statement

The Pipeline Dashboard currently allows tasks to execute without validating they have sufficient context. Per [TASK-ATOMIC-ANATOMY.md](TASK-ATOMIC-ANATOMY.md), tasks must pass **6 atomicity rules** before execution, but these are not enforced in the UI.

**Current Gaps:**

| Gap                       | Impact                                | Documented Requirement    |
| ------------------------- | ------------------------------------- | ------------------------- |
| No readiness validation   | Build agents fail on incomplete tasks | §2.4 Atomicity Rules      |
| No parallelism visibility | Users can't optimize before execution | §5 Parallelism Engine     |
| No task completion UI     | Users can't see what's missing        | §7 Task Creation Pipeline |
| No auto-populate in UI    | Suggestions only via Telegram         | §7 Auto-Grouping          |
| No hard gate enforcement  | Tasks execute without AC/tests        | §10.3 Decision Interfaces |

### 1.2 Solution Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TASK READINESS SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  READINESS CALCULATION                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  6 Atomicity Rules → Readiness Score (0-100%)                       │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │    │
│  │  │ Single       │ │ Bounded      │ │ Time         │                │    │
│  │  │ Concern      │ │ Files (≤3)   │ │ Bounded (≤1h)│                │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │    │
│  │  │ Testable     │ │ Independent  │ │ Clear        │                │    │
│  │  │ (has tests)  │ │ (deps met)   │ │ Completion   │                │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│                            ▼                                                 │
│  PIPELINE DASHBOARD ENHANCEMENTS                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │    │
│  │  │ Readiness    │ │ Parallelism  │ │ Task         │                │    │
│  │  │ Indicator    │ │ Controls     │ │ Completion   │                │    │
│  │  │ (per task)   │ │ (recalc btn) │ │ Modal        │                │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│                            ▼                                                 │
│  HARD GATE ENFORCEMENT                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Readiness < 70% → Execution Blocked                                │    │
│  │  Readiness ≥ 70% → Execution Allowed                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Deliverables

| Deliverable                        | Description                                     | Priority |
| ---------------------------------- | ----------------------------------------------- | -------- |
| **Task Readiness Service**         | Backend service calculating 6 atomicity rules   | P1       |
| **Readiness Indicator Component**  | Visual badge showing readiness % per task       | P1       |
| **Parallelism Recalculate Button** | UI control to trigger parallelism refresh       | P1       |
| **Task Completion Modal**          | Modal showing missing fields with auto-populate | P1       |
| **Hard Gate Enforcement**          | Block execution for tasks below threshold       | P2       |
| **API Endpoints**                  | REST endpoints for readiness calculation        | P1       |

---

## 2. Gap Analysis

### 2.1 Current State vs. Documented Requirements

| Requirement (from TASK-ATOMIC-ANATOMY.md) | Current State          | Gap                   |
| ----------------------------------------- | ---------------------- | --------------------- |
| **§2.4 Status = pending**                 | ✅ Enforced            | None                  |
| **§2.4 Single Concern**                   | ❌ Not validated       | AI analysis needed    |
| **§2.4 Bounded Files (≤3)**               | ⚠️ Data exists         | Not enforced          |
| **§2.4 Time Bounded (≤1h)**               | ⚠️ Effort field exists | Not mapped to hours   |
| **§2.4 Testable**                         | ❌ Not validated       | Check test appendix   |
| **§2.4 Independent**                      | ⚠️ Deps tracked        | Not validated at exec |
| **§2.4 Clear Completion**                 | ❌ Not validated       | Check AC appendix     |

### 2.2 File Impact on Parallelism

From [PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md](PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md) §5:

**Recalculation triggers documented but no UI**:

- Task status change ✅ (backend)
- Dependencies changed ✅ (backend)
- File impacts changed ✅ (backend)
- **User request** ❌ (no button)
- **Pre-flight analysis** ❌ (no view)

### 2.3 User Journey Gap

**Current Flow:**

```
User creates task → Task in queue → User clicks "Execute" → Build Agent may fail
```

**Desired Flow:**

```
User creates task → Task shows readiness → User sees what's missing →
User clicks auto-populate → Task reaches 100% → User executes → Success
```

---

## Phase 1: Task Readiness Calculation Service

### 1.1 Overview

Create a backend service that calculates task readiness based on the 6 atomicity rules from TASK-ATOMIC-ANATOMY.md §2.4.

### 1.2 Tasks

- [ ] **1.2.1** Create `server/services/task-agent/task-readiness-service.ts`
- [ ] **1.2.2** Implement 6 atomicity rule checks
- [ ] **1.2.3** Create readiness score calculation (weighted average)
- [ ] **1.2.4** Add caching layer for readiness scores
- [ ] **1.2.5** Create invalidation triggers (task changes)
- [ ] **1.2.6** Add API endpoint `GET /api/pipeline/tasks/:id/readiness`
- [ ] **1.2.7** Add bulk endpoint `GET /api/pipeline/task-lists/:id/readiness`

### 1.3 Readiness Score Formula

```typescript
interface ReadinessScore {
  overall: number; // 0-100
  rules: {
    singleConcern: {
      score: number;
      weight: number;
      status: "pass" | "fail" | "warning";
    };
    boundedFiles: {
      score: number;
      weight: number;
      status: "pass" | "fail" | "warning";
    };
    timeBounded: {
      score: number;
      weight: number;
      status: "pass" | "fail" | "warning";
    };
    testable: {
      score: number;
      weight: number;
      status: "pass" | "fail" | "warning";
    };
    independent: {
      score: number;
      weight: number;
      status: "pass" | "fail" | "warning";
    };
    clearCompletion: {
      score: number;
      weight: number;
      status: "pass" | "fail" | "warning";
    };
  };
  threshold: number; // 70
  isReady: boolean; // overall >= threshold
  missingItems: string[]; // Human-readable list
}
```

**Rule Weights (per documentation):**

| Rule                 | Weight | Pass Criteria                          |
| -------------------- | ------ | -------------------------------------- |
| Single Concern       | 15%    | AI analysis or user confirmation       |
| Bounded Files        | 15%    | ≤3 files in `task_file_impacts`        |
| Time Bounded         | 10%    | effort ∈ {trivial, small, medium}      |
| **Testable**         | 25%    | Has `test_commands` appendix           |
| Independent          | 10%    | All dependencies in `completed` status |
| **Clear Completion** | 25%    | Has `acceptance_criteria` appendix     |

### 1.4 Implementation Details

```typescript
// server/services/task-agent/task-readiness-service.ts

export class TaskReadinessService {
  private cache: Map<string, { score: ReadinessScore; timestamp: number }>;
  private cacheTTL = 60000; // 1 minute

  async calculateReadiness(taskId: string): Promise<ReadinessScore>;
  async calculateBulkReadiness(
    taskListId: string,
  ): Promise<Map<string, ReadinessScore>>;
  async invalidateCache(taskId: string): Promise<void>;

  private async checkSingleConcern(task: Task): Promise<RuleResult>;
  private async checkBoundedFiles(task: Task): Promise<RuleResult>;
  private async checkTimeBounded(task: Task): Promise<RuleResult>;
  private async checkTestable(task: Task): Promise<RuleResult>;
  private async checkIndependent(task: Task): Promise<RuleResult>;
  private async checkClearCompletion(task: Task): Promise<RuleResult>;
}
```

### 1.5 Pass Criteria

- [ ] Service returns readiness score for any task
- [ ] Score correctly reflects 6 atomicity rules
- [ ] Cache invalidates when task changes
- [ ] API returns readiness within 100ms (cached)
- [ ] Bulk endpoint handles 50+ tasks efficiently

---

## Phase 2: Parallelism Visibility & Controls

### 2.1 Overview

Add UI controls for parallelism visibility and manual recalculation per [PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md](PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md) §5.

### 2.2 Tasks

- [ ] **2.2.1** Add "Recalculate Parallelism" button to Pipeline Dashboard header
- [ ] **2.2.2** Create `ParallelismStatsCard` component showing:
  - Max parallel tasks
  - Current wave count
  - Conflict count
  - Estimated time savings
- [ ] **2.2.3** Add loading state during recalculation
- [ ] **2.2.4** Show toast notification on recalculation complete
- [ ] **2.2.5** Add parallelism preview before execution
- [ ] **2.2.6** Integrate with existing `parallelism-calculator.ts`

### 2.3 UI Components

```typescript
// frontend/src/components/pipeline/ParallelismControls.tsx

interface ParallelismControlsProps {
  taskListId: string;
  onRecalculate: () => void;
  isLoading: boolean;
}

// Renders:
// - "Recalculate" button with refresh icon
// - Stats badge: "3 waves | 5 max parallel | 2 conflicts"
// - Loading spinner during recalculation
```

```typescript
// frontend/src/components/pipeline/ParallelismPreview.tsx

interface ParallelismPreviewProps {
  taskListId: string;
}

// Renders:
// - Wave breakdown visualization
// - Per-wave task counts
// - Conflict warnings
// - "Start Execution" button (disabled if conflicts)
```

### 2.4 API Endpoints

```typescript
// Existing (enhance):
GET /api/task-agent/task-lists/:id/parallelism
// Add: lastCalculated timestamp, conflictDetails, optimizationSuggestions

// New:
POST /api/task-agent/task-lists/:id/parallelism/recalculate
// Force recalculation, returns new analysis

GET /api/task-agent/task-lists/:id/parallelism/preview
// Returns wave breakdown without starting execution
```

### 2.5 Pass Criteria

- [ ] "Recalculate" button triggers fresh parallelism analysis
- [ ] Stats card shows accurate wave/conflict counts
- [ ] Loading state shows during 500ms+ operations
- [ ] Toast confirms recalculation complete
- [ ] Preview shows wave breakdown before execution

---

## Phase 3: Task Completion Modal

### 3.1 Overview

Create a modal overlay (per user preference) showing missing task details with completion actions.

### 3.2 Tasks

- [ ] **3.2.1** Create `TaskCompletionModal.tsx` component
- [ ] **3.2.2** Add readiness indicator to task cards in LaneGrid
- [ ] **3.2.3** Implement click-to-open completion modal
- [ ] **3.2.4** Create section for each missing field:
  - Description (if empty)
  - File Impacts (if none)
  - Acceptance Criteria (if no appendix)
  - Test Commands (if no appendix)
  - Dependencies (if flagged as needed)
- [ ] **3.2.5** Add progress bar showing readiness %
- [ ] **3.2.6** Integrate with existing TaskDetailModal patterns

### 3.3 UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Task Completion: TU-PROJ-FEA-042                        [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Readiness: ████████░░ 75%                    [Run Anyway ▼]    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ✅ Description                                           │    │
│  │    "Implement user authentication with JWT tokens"       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ✅ File Impacts (2 files)                                │    │
│  │    src/auth/jwt.ts (CREATE)                              │    │
│  │    src/middleware/auth.ts (UPDATE)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ❌ Acceptance Criteria                      [Auto-Fill]  │    │
│  │    No acceptance criteria defined.                       │    │
│  │                                                          │    │
│  │    ┌──────────────────────────────────────────────┐     │    │
│  │    │ + Add criterion manually                     │     │    │
│  │    └──────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ❌ Test Commands                            [Auto-Fill]  │    │
│  │    No test commands configured.                          │    │
│  │                                                          │    │
│  │    ┌──────────────────────────────────────────────┐     │    │
│  │    │ + Add test command manually                  │     │    │
│  │    └──────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│                              [Save & Close]  [Execute Now]      │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Component Structure

```typescript
// frontend/src/components/pipeline/TaskCompletionModal.tsx

interface TaskCompletionModalProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onExecute: () => void;
}

// Sections:
// - ReadinessProgressBar
// - CompletionSection (for each field type)
// - AutoFillButton (triggers AI suggestion)
// - ManualAddButton (inline form)
```

### 3.5 Pass Criteria

- [ ] Modal opens when clicking incomplete task indicator
- [ ] Shows readiness progress bar with accurate %
- [ ] Lists all missing fields with clear icons (✅/❌)
- [ ] "Auto-Fill" button visible for each missing section
- [ ] Manual add option available for each section
- [ ] "Execute Now" only enabled when readiness ≥ 70%

---

## Phase 4: Auto-Populate Integration

### 4.1 Overview

Integrate the existing Suggestion Engine (currently Telegram-only) into the Pipeline UI.

### 4.2 Tasks

- [ ] **4.2.1** Create `TaskAutoPopulateService` bridging UI to existing suggestion engine
- [ ] **4.2.2** Add API endpoint `POST /api/pipeline/tasks/:id/auto-populate`
- [ ] **4.2.3** Implement field-specific auto-populate:
  - `?field=acceptance_criteria` - Generate AC from description
  - `?field=file_impacts` - Infer from task title/description
  - `?field=test_commands` - Generate from file impacts
  - `?field=dependencies` - Suggest from related tasks
- [ ] **4.2.4** Create `AutoPopulateButton` component with loading state
- [ ] **4.2.5** Add preview before applying suggestions
- [ ] **4.2.6** Track auto-populate usage for improvement

### 4.3 Auto-Populate Logic

```typescript
// server/services/task-agent/task-auto-populate-service.ts

export class TaskAutoPopulateService {
  async suggestAcceptanceCriteria(
    taskId: string,
  ): Promise<AcceptanceCriteria[]>;
  async suggestFileImpacts(taskId: string): Promise<FileImpact[]>;
  async suggestTestCommands(taskId: string): Promise<TestCommand[]>;
  async suggestDependencies(taskId: string): Promise<TaskRelationship[]>;

  // Calls existing services:
  // - task-analysis-pipeline.ts for relationships
  // - file-impact-analyzer.ts for file impacts
  // - LLM for AC and test commands
}
```

### 4.4 API Endpoint

```typescript
POST /api/pipeline/tasks/:id/auto-populate
Body: { field: 'acceptance_criteria' | 'file_impacts' | 'test_commands' | 'dependencies' }
Response: {
  suggestions: Array<{
    id: string;
    content: any;
    confidence: number;  // 0-1
    source: 'ai' | 'pattern' | 'related_task';
  }>;
  preview: string;  // Human-readable preview
}

POST /api/pipeline/tasks/:id/auto-populate/apply
Body: { field: string; suggestionIds: string[] }
Response: { applied: number; task: Task }
```

### 4.5 Pass Criteria

- [ ] Auto-populate endpoint returns suggestions for all 4 field types
- [ ] Suggestions include confidence scores
- [ ] Preview shows before applying
- [ ] Apply endpoint creates appropriate appendices
- [ ] Readiness score updates after applying

---

## Phase 5: Hard Gate Enforcement

### 5.1 Overview

Implement hard gate enforcement per [TASK-ATOMIC-ANATOMY.md](TASK-ATOMIC-ANATOMY.md) §10.3: tasks below 70% readiness cannot execute.

### 5.2 Tasks

- [ ] **5.2.1** Add readiness check to execution start endpoint
- [ ] **5.2.2** Return detailed error when task below threshold
- [ ] **5.2.3** Add UI warning before execution attempt
- [ ] **5.2.4** Create override mechanism for admin users
- [ ] **5.2.5** Add `allow_incomplete_execution` flag to task lists
- [ ] **5.2.6** Log all override attempts for audit

### 5.3 Enforcement Logic

```typescript
// In build-agent-orchestrator.ts or execution start handler

async startExecution(taskListId: string, options?: { allowIncomplete?: boolean }) {
  const readiness = await this.readinessService.calculateBulkReadiness(taskListId);

  const incompleteTasks = Array.from(readiness.entries())
    .filter(([_, score]) => !score.isReady);

  if (incompleteTasks.length > 0 && !options?.allowIncomplete) {
    throw new ExecutionBlockedError({
      reason: 'INCOMPLETE_TASKS',
      taskCount: incompleteTasks.length,
      tasks: incompleteTasks.map(([id, score]) => ({
        id,
        readiness: score.overall,
        missing: score.missingItems
      })),
      suggestion: 'Complete missing fields or use --allow-incomplete flag'
    });
  }

  // Proceed with execution...
}
```

### 5.4 UI Enforcement

```typescript
// In PipelineDashboard.tsx

const handleStartExecution = async () => {
  const readiness = await fetchTaskListReadiness(taskListId);

  if (!readiness.allReady) {
    // Show confirmation dialog
    const proceed = await showConfirmDialog({
      title: "Incomplete Tasks Detected",
      message: `${readiness.incompleteCount} tasks are below 70% readiness.
                Execution may fail. Continue anyway?`,
      confirmLabel: "Execute Anyway",
      cancelLabel: "Complete Tasks First",
    });

    if (!proceed) {
      // Open task completion modal for first incomplete task
      openTaskCompletionModal(readiness.incompleteTasks[0].id);
      return;
    }
  }

  await startExecution(taskListId, { allowIncomplete: true });
};
```

### 5.5 Pass Criteria

- [ ] Execution blocked when any task < 70% readiness
- [ ] Error response includes list of incomplete tasks
- [ ] UI shows confirmation dialog before override
- [ ] Override logged with user ID and timestamp
- [ ] Task list flag `allow_incomplete_execution` respected

---

## Phase 6: E2E Testing

### 6.1 Overview

Comprehensive test coverage for all new functionality.

### 6.2 Tasks

- [ ] **6.2.1** Create unit tests for `TaskReadinessService`
- [ ] **6.2.2** Create integration tests for readiness API endpoints
- [ ] **6.2.3** Create E2E tests for Task Completion Modal
- [ ] **6.2.4** Create E2E tests for parallelism controls
- [ ] **6.2.5** Create E2E tests for hard gate enforcement
- [ ] **6.2.6** Create E2E tests for auto-populate flow

### 6.3 Test File Structure

```
tests/
├── unit/
│   └── task-readiness/
│       ├── task-readiness-service.test.ts
│       ├── atomicity-rules.test.ts
│       └── readiness-cache.test.ts
├── integration/
│   └── task-readiness/
│       ├── readiness-api.test.ts
│       ├── auto-populate-api.test.ts
│       └── hard-gate-enforcement.test.ts
└── e2e/
    ├── test-task-readiness-001-calculation.py
    ├── test-task-readiness-002-modal.sh
    ├── test-task-readiness-003-parallelism.py
    ├── test-task-readiness-004-auto-populate.py
    └── test-task-readiness-005-hard-gate.py
```

---

## Test Scripts & Pass Criteria

### Test Script 1: Readiness Calculation

**File:** `tests/e2e/test-task-readiness-001-calculation.py`

```python
#!/usr/bin/env python3
"""
Test: Task Readiness Calculation
Pass Criteria:
  - [ ] Readiness score returns 0-100 for any task
  - [ ] Score reflects 6 atomicity rules accurately
  - [ ] Tasks with all fields = 100%
  - [ ] Tasks missing AC = max 75%
  - [ ] Tasks missing tests = max 75%
  - [ ] Bulk endpoint handles 50+ tasks under 2s
"""

import requests
import time

BASE_URL = "http://localhost:3001/api"

def test_single_task_readiness():
    """Test readiness calculation for single task"""
    # Create minimal task
    task = create_task({"title": "Test task"})

    # Get readiness
    response = requests.get(f"{BASE_URL}/pipeline/tasks/{task['id']}/readiness")
    assert response.status_code == 200

    readiness = response.json()
    assert 0 <= readiness["overall"] <= 100
    assert "rules" in readiness
    assert len(readiness["rules"]) == 6
    assert readiness["isReady"] == (readiness["overall"] >= 70)
    print(f"✅ Single task readiness: {readiness['overall']}%")

def test_complete_task_readiness():
    """Test task with all fields = 100%"""
    task = create_complete_task()

    response = requests.get(f"{BASE_URL}/pipeline/tasks/{task['id']}/readiness")
    readiness = response.json()

    assert readiness["overall"] == 100
    assert readiness["isReady"] == True
    assert len(readiness["missingItems"]) == 0
    print("✅ Complete task = 100% readiness")

def test_missing_acceptance_criteria():
    """Test task without AC capped at 75%"""
    task = create_task_without_ac()

    response = requests.get(f"{BASE_URL}/pipeline/tasks/{task['id']}/readiness")
    readiness = response.json()

    assert readiness["overall"] <= 75
    assert "acceptance_criteria" in str(readiness["missingItems"])
    print("✅ Missing AC caps readiness at 75%")

def test_bulk_readiness_performance():
    """Test bulk endpoint handles 50+ tasks under 2s"""
    task_list = create_task_list_with_tasks(50)

    start = time.time()
    response = requests.get(f"{BASE_URL}/pipeline/task-lists/{task_list['id']}/readiness")
    duration = time.time() - start

    assert response.status_code == 200
    assert duration < 2.0
    print(f"✅ Bulk readiness for 50 tasks: {duration:.2f}s")

if __name__ == "__main__":
    test_single_task_readiness()
    test_complete_task_readiness()
    test_missing_acceptance_criteria()
    test_bulk_readiness_performance()
    print("\n✅ All readiness calculation tests passed!")
```

### Test Script 2: Task Completion Modal

**File:** `tests/e2e/test-task-readiness-002-modal.sh`

```bash
#!/bin/bash
# Test: Task Completion Modal
# Pass Criteria:
#   - [ ] Modal opens when clicking incomplete task
#   - [ ] Shows readiness progress bar
#   - [ ] Lists missing fields with icons
#   - [ ] Auto-fill buttons visible
#   - [ ] Execute button disabled when < 70%

set -e

echo "Test: Task Completion Modal"

# Start browser test
npx playwright test tests/e2e/browser/task-completion-modal.spec.ts

# Verify test results
if [ $? -eq 0 ]; then
  echo "✅ Task Completion Modal tests passed!"
else
  echo "❌ Task Completion Modal tests failed!"
  exit 1
fi
```

### Test Script 3: Parallelism Controls

**File:** `tests/e2e/test-task-readiness-003-parallelism.py`

```python
#!/usr/bin/env python3
"""
Test: Parallelism Visibility & Controls
Pass Criteria:
  - [ ] Recalculate button triggers fresh analysis
  - [ ] Stats card shows accurate counts
  - [ ] Preview shows wave breakdown
  - [ ] Conflicts prevent parallel execution
"""

import requests

BASE_URL = "http://localhost:3001/api"

def test_recalculate_parallelism():
    """Test manual recalculation trigger"""
    task_list = create_task_list_with_conflicts()

    # Get initial analysis
    initial = requests.get(f"{BASE_URL}/task-agent/task-lists/{task_list['id']}/parallelism")

    # Trigger recalculation
    response = requests.post(f"{BASE_URL}/task-agent/task-lists/{task_list['id']}/parallelism/recalculate")
    assert response.status_code == 200

    result = response.json()
    assert "waveCount" in result
    assert "maxParallel" in result
    assert "conflictCount" in result
    assert result["lastCalculated"] > initial.json()["lastCalculated"]
    print("✅ Recalculation returns updated analysis")

def test_parallelism_preview():
    """Test wave breakdown preview"""
    task_list = create_task_list_with_tasks(10)

    response = requests.get(f"{BASE_URL}/task-agent/task-lists/{task_list['id']}/parallelism/preview")
    assert response.status_code == 200

    preview = response.json()
    assert "waves" in preview
    assert len(preview["waves"]) > 0
    assert all("taskIds" in wave for wave in preview["waves"])
    print(f"✅ Preview shows {len(preview['waves'])} waves")

if __name__ == "__main__":
    test_recalculate_parallelism()
    test_parallelism_preview()
    print("\n✅ All parallelism control tests passed!")
```

### Test Script 4: Auto-Populate

**File:** `tests/e2e/test-task-readiness-004-auto-populate.py`

```python
#!/usr/bin/env python3
"""
Test: Auto-Populate Integration
Pass Criteria:
  - [ ] Returns suggestions for all field types
  - [ ] Suggestions include confidence scores
  - [ ] Apply creates appropriate appendices
  - [ ] Readiness updates after applying
"""

import requests

BASE_URL = "http://localhost:3001/api"

def test_auto_populate_acceptance_criteria():
    """Test AC auto-population"""
    task = create_task({"title": "Add user login with OAuth", "description": "Implement OAuth2 login"})

    response = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task['id']}/auto-populate",
        json={"field": "acceptance_criteria"}
    )
    assert response.status_code == 200

    result = response.json()
    assert len(result["suggestions"]) > 0
    assert all("confidence" in s for s in result["suggestions"])
    print(f"✅ Auto-populate AC: {len(result['suggestions'])} suggestions")

def test_apply_suggestions():
    """Test applying suggestions updates task"""
    task = create_task({"title": "Test task"})

    # Get suggestions
    suggestions = requests.post(
        f"{BASE_URL}/pipeline/tasks/{task['id']}/auto-populate",
        json={"field": "acceptance_criteria"}
    ).json()

    # Get initial readiness
    initial_readiness = requests.get(
        f"{BASE_URL}/pipeline/tasks/{task['id']}/readiness"
    ).json()["overall"]

    # Apply suggestions
    requests.post(
        f"{BASE_URL}/pipeline/tasks/{task['id']}/auto-populate/apply",
        json={"field": "acceptance_criteria", "suggestionIds": [s["id"] for s in suggestions["suggestions"]]}
    )

    # Check readiness increased
    new_readiness = requests.get(
        f"{BASE_URL}/pipeline/tasks/{task['id']}/readiness"
    ).json()["overall"]

    assert new_readiness > initial_readiness
    print(f"✅ Readiness improved: {initial_readiness}% → {new_readiness}%")

if __name__ == "__main__":
    test_auto_populate_acceptance_criteria()
    test_apply_suggestions()
    print("\n✅ All auto-populate tests passed!")
```

### Test Script 5: Hard Gate Enforcement

**File:** `tests/e2e/test-task-readiness-005-hard-gate.py`

```python
#!/usr/bin/env python3
"""
Test: Hard Gate Enforcement
Pass Criteria:
  - [ ] Execution blocked when task < 70%
  - [ ] Error includes incomplete task list
  - [ ] Override flag allows execution
  - [ ] Override logged for audit
"""

import requests

BASE_URL = "http://localhost:3001/api"

def test_execution_blocked_incomplete():
    """Test execution blocked for incomplete tasks"""
    task_list = create_task_list_with_incomplete_tasks()

    response = requests.post(f"{BASE_URL}/task-agent/task-lists/{task_list['id']}/execute")

    assert response.status_code == 400
    error = response.json()
    assert error["code"] == "INCOMPLETE_TASKS"
    assert "tasks" in error
    assert len(error["tasks"]) > 0
    print("✅ Execution blocked for incomplete tasks")

def test_override_allows_execution():
    """Test override flag allows execution"""
    task_list = create_task_list_with_incomplete_tasks()

    response = requests.post(
        f"{BASE_URL}/task-agent/task-lists/{task_list['id']}/execute",
        json={"allowIncomplete": True}
    )

    assert response.status_code == 200
    print("✅ Override allows execution")

def test_override_logged():
    """Test override attempts are logged"""
    task_list = create_task_list_with_incomplete_tasks()

    requests.post(
        f"{BASE_URL}/task-agent/task-lists/{task_list['id']}/execute",
        json={"allowIncomplete": True}
    )

    # Check audit log
    logs = requests.get(f"{BASE_URL}/audit/overrides").json()
    assert any(log["taskListId"] == task_list["id"] for log in logs)
    print("✅ Override logged for audit")

if __name__ == "__main__":
    test_execution_blocked_incomplete()
    test_override_allows_execution()
    test_override_logged()
    print("\n✅ All hard gate enforcement tests passed!")
```

---

## Summary: Pass Criteria Checklist

### Phase 1: Task Readiness Service

- [ ] P1.1: `TaskReadinessService` calculates scores for 6 atomicity rules
- [ ] P1.2: Readiness score is 0-100 weighted average
- [ ] P1.3: Cache invalidates on task changes
- [ ] P1.4: API `GET /tasks/:id/readiness` returns within 100ms
- [ ] P1.5: Bulk endpoint handles 50+ tasks under 2s

### Phase 2: Parallelism Controls

- [ ] P2.1: "Recalculate" button triggers fresh analysis
- [ ] P2.2: Stats card shows wave/conflict counts
- [ ] P2.3: Preview shows wave breakdown before execution
- [ ] P2.4: Loading state visible during operations

### Phase 3: Task Completion Modal

- [ ] P3.1: Modal opens for incomplete tasks
- [ ] P3.2: Shows readiness progress bar
- [ ] P3.3: Lists missing fields with ✅/❌ icons
- [ ] P3.4: Auto-fill button visible per section
- [ ] P3.5: "Execute Now" disabled when < 70%

### Phase 4: Auto-Populate Integration

- [ ] P4.1: Endpoint returns suggestions for all 4 field types
- [ ] P4.2: Suggestions include confidence scores
- [ ] P4.3: Preview available before applying
- [ ] P4.4: Readiness updates after applying

### Phase 5: Hard Gate Enforcement

- [ ] P5.1: Execution blocked when any task < 70%
- [ ] P5.2: Error includes list of incomplete tasks
- [ ] P5.3: Override logged with user/timestamp
- [ ] P5.4: Task list flag `allow_incomplete_execution` works

### Phase 6: E2E Testing

- [ ] P6.1: All unit tests pass
- [ ] P6.2: All integration tests pass
- [ ] P6.3: All E2E tests pass
- [ ] P6.4: Test coverage ≥ 80%

---

## Reference Documents

| Document                                                                                         | Purpose                                                 |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| [TASK-ATOMIC-ANATOMY.md](TASK-ATOMIC-ANATOMY.md)                                                 | Defines 6 atomicity rules, status lifecycle, hard gates |
| [PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md](PARALLEL-TASK-EXECUTION-IMPLEMENTATION-PLAN.md) | Parallelism engine, recalculation triggers              |
| [CLAUDE.md](../../CLAUDE.md)                                                                     | Project conventions, API patterns                       |

---

## Implementation Order

1. **Phase 1** (Foundation) - Must be done first, other phases depend on it
2. **Phase 3** (Modal) - Can start after Phase 1 API is available
3. **Phase 2** (Parallelism) - Independent, can parallel with Phase 3
4. **Phase 4** (Auto-Populate) - Requires Phase 3 modal to integrate
5. **Phase 5** (Hard Gate) - Requires Phase 1 service
6. **Phase 6** (Testing) - Continuous throughout

**Estimated Timeline:** 8-10 development sessions
