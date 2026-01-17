# Build Agent UI Execution Controls - Implementation Plan

**Created:** 2026-01-17
**Purpose:** Add execution control buttons (Start/Stop/Pause/Resume/Retry) to PipelineDashboard
**Estimated Effort:** 3-4 hours
**Priority:** HIGH - Required for Build Agent usability

---

## Summary

The backend for Build Agent execution is **READY**. The frontend is **MISSING** execution controls in the Pipeline Dashboard. This plan adds the UI components needed to trigger and manage task execution.

### Current State

| Component                   | Status     | Location                                      |
| --------------------------- | ---------- | --------------------------------------------- |
| Start Execution API         | ✅ Ready   | `POST /api/task-agent/task-lists/:id/execute` |
| Stop Execution API          | ✅ Ready   | `POST /api/task-agent/task-lists/:id/stop`    |
| Retry Task API              | ✅ Ready   | `POST /api/task-agent/tasks/:id/retry`        |
| Wave Calculation            | ✅ Ready   | `parallelism-calculator.ts`                   |
| Agent Spawning              | ✅ Ready   | `build-agent-orchestrator.ts`                 |
| WebSocket Events            | ✅ Ready   | `websocket.ts`                                |
| **Execution Control Panel** | ❌ Missing | `PipelineDashboard.tsx`                       |
| **Task Retry Button**       | ❌ Missing | `TaskDetailModal.tsx`                         |

---

## Implementation Tasks

### Phase 1: Execution Control Panel (PipelineDashboard)

#### Task 1.1: Add Icon Imports

- [ ] **File:** [PipelineDashboard.tsx](frontend/src/pages/PipelineDashboard.tsx#L10-L17)
- [ ] Add `Play`, `Square`, `Pause`, `RotateCcw` from lucide-react

**Pass Criteria:**

- Icons imported without TypeScript errors
- No unused imports

**Test Script:**

```bash
cd frontend && npx tsc --noEmit
```

---

#### Task 1.2: Add Execution State Tracking

- [ ] **File:** [PipelineDashboard.tsx](frontend/src/pages/PipelineDashboard.tsx)
- [ ] Add state: `const [isExecuting, setIsExecuting] = useState(false);`
- [ ] Add state: `const [executionError, setExecutionError] = useState<string | null>(null);`
- [ ] Sync `isExecuting` from `pipelineStatus.status === 'running'`

**Pass Criteria:**

- State initializes correctly
- State updates when WebSocket events arrive
- No stale state after refetch

**Test Script:**

```bash
# Manual: Open /pipeline, check state in React DevTools
```

---

#### Task 1.3: Add Handler Functions

- [ ] **File:** [PipelineDashboard.tsx](frontend/src/pages/PipelineDashboard.tsx)
- [ ] Add `handleStartExecution()` - POST to `/api/task-agent/task-lists/:id/execute`
- [ ] Add `handleStopExecution()` - POST to `/api/task-agent/task-lists/:id/stop`
- [ ] Add error handling with toast or inline error display

**Code Template:**

```typescript
const handleStartExecution = async () => {
  if (selectedTaskListId === "all") return;
  setExecutionError(null);
  try {
    const response = await fetch(
      `/api/task-agent/task-lists/${selectedTaskListId}/execute`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to start execution");
    }
    refetch();
  } catch (error) {
    setExecutionError(error instanceof Error ? error.message : "Unknown error");
    console.error("Failed to start execution:", error);
  }
};

const handleStopExecution = async () => {
  if (selectedTaskListId === "all") return;
  try {
    await fetch(`/api/task-agent/task-lists/${selectedTaskListId}/stop`, {
      method: "POST",
    });
    refetch();
  } catch (error) {
    console.error("Failed to stop execution:", error);
  }
};
```

**Pass Criteria:**

- Functions compile without errors
- Correct API endpoints called
- Error state captured and displayed

**Test Script:**

```bash
# API Test
curl -X POST http://localhost:3001/api/task-agent/task-lists/test-id/execute
# Expected: { "error": "..." } or { "success": true }
```

---

#### Task 1.4: Add Execution Control Buttons to Header

- [ ] **File:** [PipelineDashboard.tsx:206-260](frontend/src/pages/PipelineDashboard.tsx#L206-L260)
- [ ] Add execution control group before filter dropdowns
- [ ] Show buttons only when `selectedTaskListId !== "all"`
- [ ] Disable Start when executing, disable Stop when idle

**Code Template:**

```tsx
{
  /* Execution Controls */
}
{
  selectedTaskListId !== "all" && (
    <div className="flex items-center gap-2 border-r border-gray-300 pr-4 mr-2">
      <button
        onClick={handleStartExecution}
        disabled={
          pipelineStatus.status === "running" ||
          pipelineStatus.status === "paused"
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          pipelineStatus.status === "running" ||
          pipelineStatus.status === "paused"
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        <Play className="w-4 h-4" />
        Start
      </button>

      <button
        onClick={handleStopExecution}
        disabled={
          pipelineStatus.status !== "running" &&
          pipelineStatus.status !== "paused"
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          pipelineStatus.status !== "running" &&
          pipelineStatus.status !== "paused"
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
      >
        <Square className="w-4 h-4" />
        Stop
      </button>

      {executionError && (
        <span
          className="text-xs text-red-600 max-w-48 truncate"
          title={executionError}
        >
          {executionError}
        </span>
      )}
    </div>
  );
}
```

**Pass Criteria:**

- Buttons render only when task list selected
- Buttons have correct disabled states
- Visual feedback on hover/click
- Error message displays when API fails

**Test Script:**

```bash
# E2E Test
cd frontend && npm run test -- --grep "PipelineDashboard"
```

---

#### Task 1.5: Add Execution Status Indicator

- [ ] **File:** [PipelineDashboard.tsx:309-344](frontend/src/pages/PipelineDashboard.tsx#L309-L344) (Execution Overview Bar)
- [ ] Add status indicator showing: `idle | running | paused | stopped`
- [ ] Visual animation when running (pulse/spin)

**Code Template:**

```tsx
{
  /* Add to Execution Overview Bar */
}
<div className="text-center">
  <div
    className={`text-2xl font-bold ${
      pipelineStatus.status === "running"
        ? "text-green-600"
        : pipelineStatus.status === "paused"
          ? "text-amber-600"
          : "text-gray-900"
    }`}
  >
    {pipelineStatus.status === "running" && (
      <span className="inline-block animate-pulse">●</span>
    )}{" "}
    {pipelineStatus.status.charAt(0).toUpperCase() +
      pipelineStatus.status.slice(1)}
  </div>
  <div className="text-xs text-gray-500 uppercase">Status</div>
</div>;
```

**Pass Criteria:**

- Status displays correct value from API
- Animation visible when running
- Color coding matches state

---

### Phase 2: Task Retry Button (TaskDetailModal)

#### Task 2.1: Add Retry Handler

- [ ] **File:** [TaskDetailModal.tsx](frontend/src/components/pipeline/TaskDetailModal.tsx)
- [ ] Add `handleRetryTask(taskId)` function
- [ ] POST to `/api/task-agent/tasks/:id/retry`
- [ ] Add loading state for retry button

**Code Template:**

```typescript
const [retrying, setRetrying] = useState(false);
const [retryError, setRetryError] = useState<string | null>(null);

const handleRetryTask = async () => {
  if (!task) return;
  setRetrying(true);
  setRetryError(null);
  try {
    const response = await fetch(`/api/task-agent/tasks/${task.id}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to retry task");
    }
    // Refetch task details
    await fetchTaskDetail();
  } catch (error) {
    setRetryError(error instanceof Error ? error.message : "Unknown error");
  } finally {
    setRetrying(false);
  }
};
```

**Pass Criteria:**

- Function compiles without errors
- Correct API endpoint called
- Loading state prevents double-clicks
- Error displayed on failure

---

#### Task 2.2: Add Retry Button to Header

- [ ] **File:** [TaskDetailModal.tsx:122-147](frontend/src/components/pipeline/TaskDetailModal.tsx#L122-L147)
- [ ] Add Retry button next to close button
- [ ] Show only when `task.status === 'failed'`
- [ ] Disable while retrying

**Code Template:**

```tsx
{
  /* Add before close button in header */
}
{
  task && task.status === "failed" && (
    <button
      onClick={handleRetryTask}
      disabled={retrying}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
        retrying
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : "bg-amber-600 text-white hover:bg-amber-700"
      }`}
    >
      <RotateCcw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
      {retrying ? "Retrying..." : "Retry Task"}
    </button>
  );
}
```

**Pass Criteria:**

- Button only visible for failed tasks
- Loading spinner while retrying
- Task status updates after successful retry

---

#### Task 2.3: Add Retry Error Display

- [ ] **File:** [TaskDetailModal.tsx](frontend/src/components/pipeline/TaskDetailModal.tsx)
- [ ] Show error inline below header when retry fails

**Code Template:**

```tsx
{
  retryError && (
    <div className="px-4 py-2 bg-red-50 border-b border-red-200">
      <p className="text-sm text-red-600 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        {retryError}
      </p>
    </div>
  );
}
```

**Pass Criteria:**

- Error message appears on retry failure
- Error clears on next retry attempt
- Error styling matches design system

---

### Phase 3: Integration Tests

#### Task 3.1: Add PipelineDashboard Execution Tests

- [ ] **File:** `frontend/src/pages/__tests__/PipelineDashboard.test.tsx` (create if needed)
- [ ] Test: Start button disabled when no task list selected
- [ ] Test: Start button calls correct API
- [ ] Test: Stop button enabled only when running
- [ ] Test: Error state displays correctly

**Test Script:**

```typescript
// frontend/src/pages/__tests__/PipelineDashboard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PipelineDashboard from '../PipelineDashboard';

describe('PipelineDashboard Execution Controls', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('shows execution controls when task list is selected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lanes: [], waves: [], agents: [], status: 'idle' })
    });

    render(
      <BrowserRouter>
        <PipelineDashboard />
      </BrowserRouter>
    );

    // Select a task list
    const taskListSelect = await screen.findByRole('combobox', { name: /task list/i });
    fireEvent.change(taskListSelect, { target: { value: 'test-list-id' } });

    // Execution controls should appear
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('calls execute API when Start clicked', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'idle' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

    // ... test implementation
  });
});
```

**Pass Criteria:**

- All tests pass
- Coverage > 80% for new code

**Test Command:**

```bash
cd frontend && npm test -- --coverage --watchAll=false
```

---

#### Task 3.2: Add TaskDetailModal Retry Tests

- [ ] **File:** `frontend/src/components/pipeline/__tests__/TaskDetailModal.test.tsx` (create if needed)
- [ ] Test: Retry button visible only for failed tasks
- [ ] Test: Retry button calls correct API
- [ ] Test: Loading state during retry
- [ ] Test: Error display on failure

---

### Phase 4: E2E Validation

#### Task 4.1: Manual E2E Test Checklist

- [ ] Navigate to `/pipeline`
- [ ] Select a project with tasks
- [ ] Select a task list
- [ ] Verify Start button appears and is enabled
- [ ] Click Start - verify API call succeeds
- [ ] Verify status changes to "running"
- [ ] Verify Stop button becomes enabled
- [ ] Click Stop - verify execution halts
- [ ] Click a failed task
- [ ] Verify Retry button appears
- [ ] Click Retry - verify task re-executes

**Test Script:**

```bash
#!/bin/bash
# tests/e2e/test-execution-controls.sh

echo "=== E2E Test: Execution Controls ==="

# Start servers
echo "Starting backend..."
npm run dev:server &
sleep 3

echo "Starting frontend..."
npm run dev:client &
sleep 5

# Run Puppeteer test
node tests/e2e/test-execution-controls.js

# Cleanup
pkill -f "npm run dev"
```

---

## Files to Modify

| File                                                                        | Changes                                 |
| --------------------------------------------------------------------------- | --------------------------------------- |
| [PipelineDashboard.tsx](frontend/src/pages/PipelineDashboard.tsx)           | Add execution controls, handlers, state |
| [TaskDetailModal.tsx](frontend/src/components/pipeline/TaskDetailModal.tsx) | Add retry button, handler               |
| `frontend/src/types/pipeline.ts`                                            | Add execution status types if needed    |

## Files to Create

| File                                                                  | Purpose                           |
| --------------------------------------------------------------------- | --------------------------------- |
| `frontend/src/pages/__tests__/PipelineDashboard.test.tsx`             | Unit tests for execution controls |
| `frontend/src/components/pipeline/__tests__/TaskDetailModal.test.tsx` | Unit tests for retry button       |
| `tests/e2e/test-execution-controls.sh`                                | E2E test script                   |

---

## Validation Checklist

### Build Passes

- [ ] `cd frontend && npm run build` exits with code 0
- [ ] `cd frontend && npx tsc --noEmit` exits with code 0

### Tests Pass

- [ ] `cd frontend && npm test` all tests pass
- [ ] Coverage report shows >80% for modified files

### E2E Works

- [ ] Start button triggers execution
- [ ] Stop button halts execution
- [ ] Retry button re-runs failed tasks
- [ ] WebSocket updates status in real-time

### No Regressions

- [ ] Pipeline dashboard still loads correctly
- [ ] Filter dropdowns still work
- [ ] View mode tabs still work
- [ ] Task modal still opens correctly

---

## Implementation Order

```
1. Task 1.1 (Icons) → 2 min
2. Task 1.2 (State) → 5 min
3. Task 1.3 (Handlers) → 15 min
4. Task 1.4 (Buttons) → 15 min
5. Task 1.5 (Status) → 10 min
6. Task 2.1 (Retry Handler) → 10 min
7. Task 2.2 (Retry Button) → 10 min
8. Task 2.3 (Error Display) → 5 min
9. Task 3.1 (Dashboard Tests) → 30 min
10. Task 3.2 (Modal Tests) → 30 min
11. Task 4.1 (E2E Validation) → 20 min
```

**Total: ~2.5 hours**

---

## Known Backend Gaps (Out of Scope)

These issues exist in the backend but are **not addressed** by this UI plan:

| Gap ID  | Description                        | Severity |
| ------- | ---------------------------------- | -------- |
| GAP-001 | No per-task validation commands    | CRITICAL |
| GAP-002 | No acceptance criteria enforcement | CRITICAL |
| GAP-003 | No 3-level test execution          | HIGH     |
| GAP-004 | No context handoff between agents  | HIGH     |

See: [TASK-AGENT-BUILD-AGENT-GAP-ANALYSIS.md](docs/specs/observability/TASK-AGENT-BUILD-AGENT-GAP-ANALYSIS.md)

---

## Success Metrics

1. **User can start task list execution** from Pipeline Dashboard
2. **User can stop running execution** from Pipeline Dashboard
3. **User can retry failed tasks** from Task Detail Modal
4. **Real-time status updates** reflect execution state
5. **Error messages** are displayed when API calls fail
