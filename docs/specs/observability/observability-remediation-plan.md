# Observability Remediation Implementation Plan

**Status**: Draft
**Created**: 2026-01-18
**Author**: Claude

---

## Problem Statement

The observability system is **80% architecturally complete but 0% functional**:

- 14 advanced UI components are built but hidden from navigation
- Data producer services exist in both TypeScript and Python but aren't called by agents
- Database tables are empty because no code writes to them

---

## Track 1: Wire Up Hidden UI Components

### Task 1.1: Add ObservabilityView Type Extensions

**Files**: `frontend/src/types/observability/index.ts`

**Checklist**:

- [ ] Add new view types to `ObservabilityView` union type: `"heatmap" | "unified" | "messages"`

**Test Script**:

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "(observability|ObservabilityView)" || echo "PASS: No type errors"
```

**Pass Criteria**:

- [ ] No TypeScript errors related to ObservabilityView
- [ ] Type union includes all 8 view types

---

### Task 1.2: Extend ViewSelector with 3 New Tabs

**Files**: `frontend/src/components/observability/ViewSelector.tsx`

**Checklist**:

- [ ] Import new icons: `Grid` (heatmap), `FileText` (unified), `MessageSquare` (messages)
- [ ] Add 3 new entries to `views` array:
  - `{ id: "heatmap", label: "Heatmap", icon: Grid, shortcut: "g h", tooltip: "Tool usage patterns over time" }`
  - `{ id: "unified", label: "Unified", icon: FileText, shortcut: "g f", tooltip: "Unified log stream with all events" }`
  - `{ id: "messages", label: "Messages", icon: MessageSquare, shortcut: "g m", tooltip: "Message bus events" }`

**Test Script**:

```bash
cd frontend && npx tsc --noEmit && echo "PASS: TypeScript compiles"
grep -c "id:" src/components/observability/ViewSelector.tsx | xargs -I {} test {} -eq 8 && echo "PASS: 8 views defined"
```

**Pass Criteria**:

- [ ] TypeScript compiles without errors
- [ ] ViewSelector.tsx contains exactly 8 view definitions
- [ ] All 3 new shortcuts (g+h, g+f, g+m) are defined

---

### Task 1.3: Add Keyboard Shortcuts for New Views

**Files**: `frontend/src/components/observability/ObservabilityHub.tsx`

**Checklist**:

- [ ] Extend `VIEW_SHORTCUTS` mapping (line 37):
  ```typescript
  const VIEW_SHORTCUTS: Record<string, ObservabilityView> = {
    t: "timeline",
    u: "tool-uses",
    a: "assertions",
    s: "skills",
    l: "logs",
    h: "heatmap", // NEW
    f: "unified", // NEW
    m: "messages", // NEW
  };
  ```

**Test Script**:

```bash
grep -E "h:|f:|m:" frontend/src/components/observability/ObservabilityHub.tsx && echo "PASS: Shortcuts added"
```

**Pass Criteria**:

- [ ] VIEW_SHORTCUTS contains all 8 mappings
- [ ] Pressing g+h/g+f/g+m switches to respective views

---

### Task 1.4: Add View Routing in ObservabilityHub

**Files**: `frontend/src/components/observability/ObservabilityHub.tsx`

**Checklist**:

- [ ] Import 3 hidden components at top of file:
  ```typescript
  import ToolUseHeatMap from "./ToolUseHeatMap";
  import UnifiedLogViewer from "./UnifiedLogViewer";
  import MessageBusLogViewer from "./MessageBusLogViewer";
  ```
- [ ] Add 3 new cases in `ViewContent` switch statement (around line 398):
  ```typescript
  case "heatmap":
    return <ToolUseHeatMap executionId={executionId} />;
  case "unified":
    return <UnifiedLogViewer executionId={executionId} />;
  case "messages":
    return <MessageBusLogViewer executionId={executionId} />;
  ```

**Test Script**:

```bash
cd frontend && npx tsc --noEmit && echo "PASS: TypeScript compiles"
grep -c "case \"" src/components/observability/ObservabilityHub.tsx | xargs -I {} test {} -ge 8 && echo "PASS: 8+ switch cases"
```

**Pass Criteria**:

- [ ] All 3 components import successfully
- [ ] Switch statement handles all 8 views
- [ ] No "Unknown view" fallback triggered for new views

---

### Task 1.5: Replace ExecutionReviewPage with ExecutionReviewDashboard

**Files**: `frontend/src/pages/ExecutionReviewPage.tsx`

**Checklist**:

- [ ] Import `ExecutionReviewDashboard` and `WaveProgressPanel`
- [ ] Replace `<ObservabilityHub executionId={id} />` with:
  ```tsx
  <div className="space-y-6">
    <WaveProgressPanel executionId={id} />
    <ExecutionReviewDashboard executionId={id} />
  </div>
  ```

**Test Script**:

```bash
cd frontend && npx tsc --noEmit && echo "PASS: TypeScript compiles"
grep -q "ExecutionReviewDashboard" src/pages/ExecutionReviewPage.tsx && echo "PASS: Dashboard imported"
grep -q "WaveProgressPanel" src/pages/ExecutionReviewPage.tsx && echo "PASS: WaveProgress imported"
```

**Pass Criteria**:

- [ ] ExecutionReviewPage renders ExecutionReviewDashboard
- [ ] WaveProgressPanel shows wave execution progress
- [ ] No console errors when viewing execution details

---

### Task 1.6: Embed Visualizations in AnalyticsTab

**Files**: `frontend/src/components/observability/AnalyticsTab.tsx`

**Checklist**:

- [ ] Import `AssertionDashboard` and `AgentActivityGraph`
- [ ] Add AssertionDashboard section with heading "Assertion Trends"
- [ ] Add AgentActivityGraph section with heading "Agent Activity"
- [ ] Wrap each in collapsible accordion or card layout

**Test Script**:

```bash
cd frontend && npx tsc --noEmit && echo "PASS: TypeScript compiles"
grep -q "AssertionDashboard" src/components/observability/AnalyticsTab.tsx && echo "PASS: AssertionDashboard embedded"
grep -q "AgentActivityGraph" src/components/observability/AnalyticsTab.tsx && echo "PASS: AgentActivityGraph embedded"
```

**Pass Criteria**:

- [ ] AnalyticsTab shows assertion pass/fail trends
- [ ] AnalyticsTab shows agent activity timeline
- [ ] Components handle empty data gracefully

---

## Track 2: Connect Data Producers

### Task 2.1: Create Python Observability API Client

**Files**: `coding-loops/shared/observability_api.py` (NEW)

**Checklist**:

- [ ] Create new file with HTTP client for observability API
- [ ] Implement `create_execution_run(task_list_id, source)` → returns execution_id
- [ ] Implement `complete_execution_run(execution_id, status)`
- [ ] Implement `record_heartbeat(execution_id, instance_id)`
- [ ] Add error handling with retries for network failures
- [ ] Export in `coding-loops/shared/__init__.py`

**Test Script**:

```bash
python3 -c "from coding_loops_shared import create_execution_run; print('PASS: API client imports')" 2>/dev/null || \
python3 -c "import sys; sys.path.insert(0, 'coding-loops/shared'); from observability_api import create_execution_run; print('PASS: API client imports')"
```

**Pass Criteria**:

- [ ] API client imports without errors
- [ ] Functions have type hints and docstrings
- [ ] Network errors are caught and retried

---

### Task 2.2: Complete BuildAgentWorker Observability Integration

**Files**: `coding-loops/agents/build_agent_worker.py`

**Checklist**:

- [ ] Import `observability_api` functions at top
- [ ] In `__init__` or `execute()`, create execution run:
  ```python
  if OBSERVABLE_AVAILABLE:
      self._execution_id = create_execution_run(
          task_list_id=self.task_list_id,
          source="build-agent-worker"
      )
      super().__init__(
          execution_id=self._execution_id,
          instance_id=self.agent_id,
          agent_type="build-agent"
      )
  ```
- [ ] Wrap `_generate_code()` with tool logging:
  ```python
  tool_id = self.log_tool_start("CodeGenerator", {...}, self.task.id)
  # ... generate code ...
  self.log_tool_end(tool_id, result, is_error=False)
  ```
- [ ] Add assertion recording in validation:
  ```python
  chain_id = self.start_assertion_chain(task_id, "Validation")
  self.assert_typescript_compiles(task_id)
  self.end_assertion_chain(chain_id)
  ```
- [ ] Call `complete_execution_run()` on exit

**Test Script**:

```bash
# Dry run test
python3 coding-loops/agents/build_agent_worker.py --help 2>&1 | grep -q "agent-id" && echo "PASS: Worker runs"

# Check observability integration
grep -q "log_tool_start" coding-loops/agents/build_agent_worker.py && echo "PASS: Tool logging added"
grep -q "start_assertion_chain" coding-loops/agents/build_agent_worker.py && echo "PASS: Assertion chains added"
grep -q "create_execution_run" coding-loops/agents/build_agent_worker.py && echo "PASS: Execution run creation added"
```

**Pass Criteria**:

- [ ] Worker starts without import errors
- [ ] Tool uses are logged to database when OBSERVABLE_AVAILABLE=True
- [ ] Assertion results are recorded for validation steps
- [ ] Execution run is created and completed

---

### Task 2.3: Add Ralph Loop Base Observability

**Files**: `coding-loops/shared/ralph_loop_base.py`

**Checklist**:

- [ ] Add optional ObservableAgent composition:
  ```python
  def _setup_observability(self, execution_id: str):
      if OBSERVABLE_AVAILABLE:
          self._observable = ObservableAgent(...)
  ```
- [ ] Log agent session starts/ends with `log_phase_start/end`
- [ ] Parse transcript for tool calls and log with `log_tool_simple`
- [ ] Complete execution on loop exit

**Test Script**:

```bash
grep -q "ObservableAgent" coding-loops/shared/ralph_loop_base.py && echo "PASS: ObservableAgent integrated"
grep -q "log_phase_start" coding-loops/shared/ralph_loop_base.py && echo "PASS: Phase logging added"
```

**Pass Criteria**:

- [ ] All 3 Ralph loops inherit observability automatically
- [ ] Agent sessions are logged with timing
- [ ] Tool uses from transcript are captured

---

## Verification Tests

### V1: UI Smoke Test

```bash
# Start frontend and verify tabs render
cd frontend && npm run build 2>&1 | tail -5
# Manual: Navigate to /observability and verify 8 tabs visible
```

**Pass Criteria**:

- [ ] Frontend builds without errors
- [ ] All 8 tabs visible in ViewSelector
- [ ] Clicking each tab doesn't cause errors

---

### V2: Data Flow Test

```bash
# Check database has data after running a task
sqlite3 database/ideas.db "SELECT COUNT(*) as count FROM transcript_entries;" 2>/dev/null
sqlite3 database/ideas.db "SELECT COUNT(*) as count FROM tool_uses;" 2>/dev/null
sqlite3 database/ideas.db "SELECT COUNT(*) as count FROM assertion_results;" 2>/dev/null
```

**Pass Criteria**:

- [ ] `transcript_entries` has > 0 rows after task execution
- [ ] `tool_uses` has > 0 rows after task execution
- [ ] `assertion_results` has > 0 rows after validation

---

### V3: End-to-End Integration Test

```bash
# Run a BuildAgentWorker task and verify observability data
python3 coding-loops/agents/build_agent_worker.py \
  --agent-id test-$(date +%s) \
  --task-id test-task \
  --task-list-id test-list \
  --dry-run 2>&1 | tee /tmp/build-agent-output.log

# Verify observability writes
grep -q "log_tool_start\|log_phase_start\|start_assertion_chain" /tmp/build-agent-output.log && echo "PASS: Observability calls made"
```

**Pass Criteria**:

- [ ] BuildAgentWorker completes without errors
- [ ] Observability methods are called (visible in output)
- [ ] Data appears in database tables

---

## Implementation Order

| Priority | Task ID | Description                       | Dependencies |
| -------- | ------- | --------------------------------- | ------------ |
| 1        | 1.1     | Add ObservabilityView types       | None         |
| 2        | 1.2     | Extend ViewSelector               | 1.1          |
| 3        | 1.3     | Add keyboard shortcuts            | 1.1          |
| 4        | 1.4     | Add view routing                  | 1.2, 1.3     |
| 5        | 2.1     | Create Python API client          | None         |
| 6        | 2.2     | Complete BuildAgentWorker         | 2.1          |
| 7        | 1.5     | Replace ExecutionReviewPage       | 1.4          |
| 8        | 1.6     | Embed Analytics visualizations    | 1.4          |
| 9        | 2.3     | Add Ralph Loop base observability | 2.1          |

---

## Summary

| Track          | Tasks | Files Modified | Files Created |
| -------------- | ----- | -------------- | ------------- |
| Track 1 (UI)   | 6     | 5              | 0             |
| Track 2 (Data) | 3     | 2              | 1             |
| **Total**      | **9** | **7**          | **1**         |

---

## Hidden Components Reference

The following 14 components are built but hidden from navigation:

| Component                | Purpose                             | Target Location             |
| ------------------------ | ----------------------------------- | --------------------------- |
| ExecutionReviewDashboard | Full review interface for execution | ExecutionReviewPage         |
| UnifiedLogViewer         | Enhanced log viewer with filtering  | New tab in ObservabilityHub |
| ToolUseHeatMap           | Tool usage pattern visualization    | New tab in ObservabilityHub |
| AssertionDashboard       | Assertion pass/fail trends          | AnalyticsTab                |
| SkillTraceViewer         | Skill invocation details            | Detail page component       |
| ToolUseLog               | Detailed tool use log               | ExecutionReviewDashboard    |
| MessageBusLogViewer      | Message bus event viewer            | New tab in ObservabilityHub |
| DeepLinkPanel            | Cross-navigation helper             | Sidebar in detail pages     |
| WaveProgressPanel        | Wave execution visualization        | ExecutionReviewPage         |
| SkillFlowDiagram         | Skill dependency visualization      | SkillTraceViewer            |
| AgentActivityGraph       | Agent activity over time            | AnalyticsTab                |
| EvidenceViewerModal      | Evidence modal for assertions       | AssertionList               |
| FullERDModal             | Database schema viewer              | AnalyticsTab                |
| CrossReferencePanel      | Related entity navigation           | All detail pages            |
