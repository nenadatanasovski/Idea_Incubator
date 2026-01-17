# Build Agent Gap Remediation Implementation Plan

> **Created**: 2026-01-17
> **Status**: Draft
> **Priority**: Critical gaps must be fixed before production use

## Overview

This plan addresses 14 identified gaps in the Build Agent system, organized by severity. Each gap includes implementation checkboxes, test scripts, and pass criteria.

### Summary by Severity

| Severity    | Count | Action Required                |
| ----------- | ----- | ------------------------------ |
| 🔴 CRITICAL | 2     | Must fix before production use |
| 🟠 HIGH     | 2     | Should fix soon                |
| 🟡 MEDIUM   | 6     | Fix when possible              |
| 🟢 LOW      | 4     | Nice to have                   |

---

## 🔴 CRITICAL GAPS

### GAP-001: `_run_test_levels()` Never Called

**ID**: GAP-003
**Severity**: 🔴 CRITICAL
**Category**: Multi-level Testing
**Location**: `coding-loops/agents/build_agent_worker.py:1383`

#### Description

Method `_run_test_levels()` is defined but never invoked in the execution flow. Multi-level tests (API/UI) are never executed - tasks pass without running integration tests.

#### Impact

- Tasks marked as complete without running integration tests
- API and UI test failures go undetected
- False positive task completions

#### Implementation Checklist

- [ ] **1. Locate insertion point in execution flow**
  - Find the acceptance criteria check in `_execute_task_impl()`
  - Identify the correct position after acceptance criteria passes

- [ ] **2. Add test level determination call**

  ```python
  # After acceptance criteria check passes
  test_levels = self._determine_test_levels()
  ```

- [ ] **3. Add test execution call**

  ```python
  if test_levels:
      test_results = self._run_test_levels(test_levels)
      if not test_results.all_passed:
          return self._record_failure(
              task_id=task.id,
              error_type="test_level_failure",
              error_message=f"Test levels failed: {test_results.failures}"
          )
  ```

- [ ] **4. Ensure proper error handling**
  - Handle test timeout scenarios
  - Handle test infrastructure failures vs test assertion failures
  - Log detailed test output for debugging

- [ ] **5. Update task status based on test results**
  - Record which test levels passed/failed in task_executions
  - Include test output in execution logs

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-001-test-levels.sh

echo "=== GAP-001: Test Levels Execution Test ==="

# 1. Create a task with multi-level test requirements
cat > /tmp/test-task.json << 'EOF'
{
  "title": "Test task with API tests",
  "description": "Task requiring API-level testing",
  "validation_command": "echo 'basic validation passed'",
  "test_levels": ["unit", "api"]
}
EOF

# 2. Create task via API
TASK_ID=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d @/tmp/test-task.json | jq -r '.id')

echo "Created task: $TASK_ID"

# 3. Execute the task
python3 coding-loops/agents/build_agent_worker.py --task-id "$TASK_ID" --dry-run

# 4. Check execution log for test level execution
sqlite3 database/ideas.db << EOF
SELECT
  te.id,
  te.task_id,
  tel.message
FROM task_executions te
JOIN task_execution_log tel ON tel.execution_id = te.id
WHERE te.task_id = '$TASK_ID'
  AND tel.message LIKE '%test_level%'
ORDER BY tel.timestamp;
EOF

# 5. Verify test levels were actually run
RESULT=$(sqlite3 database/ideas.db "SELECT COUNT(*) FROM task_execution_log WHERE execution_id IN (SELECT id FROM task_executions WHERE task_id = '$TASK_ID') AND message LIKE '%_run_test_levels%'")

if [ "$RESULT" -gt 0 ]; then
  echo "✅ PASS: _run_test_levels() was called"
  exit 0
else
  echo "❌ FAIL: _run_test_levels() was NOT called"
  exit 1
fi
```

#### Pass Criteria

| Criterion                 | Expected Result                                       | Verification Method                 |
| ------------------------- | ----------------------------------------------------- | ----------------------------------- |
| Method invocation         | `_run_test_levels()` called during task execution     | Grep execution logs for method call |
| Test levels determined    | `_determine_test_levels()` returns appropriate levels | Unit test with mocked task          |
| Test results recorded     | test_execution_log contains test level results        | Query database after execution      |
| Failures block completion | Task with failing test levels stays incomplete        | Execute task with failing tests     |
| All levels run            | Unit, API, UI tests run when specified                | Check logs for each level           |

---

### GAP-002: Orchestrator Doesn't Call Error-Handling Functions

**ID**: GAP-006
**Severity**: 🔴 CRITICAL
**Category**: SIA Integration
**Location**: `server/services/task-agent/build-agent-orchestrator.ts`

#### Description

`build-agent-orchestrator.ts` doesn't import from `error-handling.ts`. As a result, `consecutive_failures` is never incremented, `task_failure_history` is never written, and SIA escalation is never triggered.

#### Impact

- Failed tasks don't accumulate failure counts
- SIA never receives escalations for stuck tasks
- No pattern detection for recurring failures
- Task failure history not maintained

#### Implementation Checklist

- [ ] **1. Add imports to build-agent-orchestrator.ts**

  ```typescript
  import {
    incrementConsecutiveFailures,
    recordTaskFailure,
    checkNeedsNoProgressReview,
    escalateToSIA,
  } from "./error-handling";
  ```

- [ ] **2. Call incrementConsecutiveFailures in handleAgentFailure**

  ```typescript
  async handleAgentFailure(agentId: string, taskId: string, error: Error): Promise<void> {
    // Existing failure handling...

    // Add: Increment consecutive failures
    const failureCount = await incrementConsecutiveFailures(taskId);

    // Add: Record failure in history
    await recordTaskFailure(taskId, {
      error_type: this.classifyError(error),
      error_message: error.message,
      stack_trace: error.stack
    });

    // Add: Check if needs SIA review
    if (await checkNeedsNoProgressReview(taskId)) {
      await escalateToSIA(taskId, 'no_progress');
    }
  }
  ```

- [ ] **3. Add error classification method**

  ```typescript
  private classifyError(error: Error): string {
    if (error.message.includes('ENOENT')) return 'file_not_found';
    if (error.message.includes('timeout')) return 'timeout';
    if (error.message.includes('syntax')) return 'syntax_error';
    return 'unknown';
  }
  ```

- [ ] **4. Wire up SIA escalation event handling**
  - Ensure WebSocket emits `sia:escalation` event
  - Add listener that spawns SIA agent on escalation

- [ ] **5. Add failure threshold configuration**
  ```typescript
  const FAILURE_THRESHOLDS = {
    consecutiveFailuresForSIA: 3,
    totalFailuresForBlock: 5,
  };
  ```

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-002-error-handling.sh

echo "=== GAP-002: Error Handling Integration Test ==="

# 1. Create a task that will fail
TASK_ID=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task designed to fail",
    "validation_command": "exit 1"
  }' | jq -r '.id')

echo "Created failing task: $TASK_ID"

# 2. Execute the task 3 times (should trigger SIA escalation)
for i in 1 2 3; do
  echo "Execution attempt $i..."
  curl -s -X POST "http://localhost:3001/api/task-agent/tasks/$TASK_ID/execute"
  sleep 2
done

# 3. Check consecutive_failures was incremented
FAILURES=$(sqlite3 database/ideas.db "SELECT consecutive_failures FROM tasks WHERE id = '$TASK_ID'")
echo "Consecutive failures: $FAILURES"

# 4. Check task_failure_history was written
HISTORY_COUNT=$(sqlite3 database/ideas.db "SELECT COUNT(*) FROM task_failure_history WHERE task_id = '$TASK_ID'")
echo "Failure history records: $HISTORY_COUNT"

# 5. Check SIA escalation was triggered
ESCALATION=$(sqlite3 database/ideas.db "SELECT COUNT(*) FROM sia_escalations WHERE task_id = '$TASK_ID'")
echo "SIA escalations: $ESCALATION"

# 6. Verify results
if [ "$FAILURES" -ge 3 ] && [ "$HISTORY_COUNT" -ge 3 ] && [ "$ESCALATION" -ge 1 ]; then
  echo "✅ PASS: Error handling functions properly integrated"
  exit 0
else
  echo "❌ FAIL: Error handling not fully integrated"
  echo "  Expected: failures >= 3, history >= 3, escalation >= 1"
  echo "  Got: failures = $FAILURES, history = $HISTORY_COUNT, escalation = $ESCALATION"
  exit 1
fi
```

#### Pass Criteria

| Criterion          | Expected Result                                | Verification Method     |
| ------------------ | ---------------------------------------------- | ----------------------- |
| Import exists      | error-handling.ts imported in orchestrator     | Grep source file        |
| Failures increment | consecutive_failures increases on each failure | Query tasks table       |
| History recorded   | task_failure_history has entry per failure     | Query history table     |
| SIA escalation     | sia_escalations created after threshold        | Query escalations table |
| Event emitted      | WebSocket receives sia:escalation event        | Monitor WebSocket       |

---

## 🟠 HIGH SEVERITY GAPS

### GAP-003: Python Worker Doesn't Update `last_error_message`

**ID**: GAP-006 (sub-issue)
**Severity**: 🟠 HIGH
**Category**: Error Tracking
**Location**: `coding-loops/agents/build_agent_worker.py:_record_failure()`

#### Description

`_record_failure()` writes to `task_executions` but not `tasks.last_error_message`. The `checkNeedsNoProgressReview()` function queries `last_error_message` but it's always null.

#### Impact

- No-progress detection doesn't work correctly
- SIA lacks error context for diagnosis
- Dashboard shows no error info for failed tasks

#### Implementation Checklist

- [ ] **1. Locate \_record_failure() method**
  - File: `coding-loops/agents/build_agent_worker.py`
  - Find the method that records task failures

- [ ] **2. Add SQL to update tasks.last_error_message**

  ```python
  def _record_failure(self, task_id: str, error_type: str, error_message: str):
      # Existing code to insert into task_executions...

      # Add: Update tasks.last_error_message
      self.db.execute("""
          UPDATE tasks
          SET last_error_message = ?,
              updated_at = datetime('now')
          WHERE id = ?
      """, (error_message[:1000], task_id))  # Truncate to prevent overflow
      self.db.commit()
  ```

- [ ] **3. Add truncation for long error messages**
  - Limit to 1000 characters
  - Preserve most useful part (usually the beginning)

- [ ] **4. Test that checkNeedsNoProgressReview works**
  - Verify the query finds tasks with same error message

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-003-last-error-message.sh

echo "=== GAP-003: last_error_message Update Test ==="

# 1. Create a task
TASK_ID=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test error message recording",
    "validation_command": "echo 'Specific error XYZ-123' && exit 1"
  }' | jq -r '.id')

echo "Created task: $TASK_ID"

# 2. Execute (will fail)
python3 coding-loops/agents/build_agent_worker.py --task-id "$TASK_ID" 2>&1 || true

# 3. Check last_error_message is populated
ERROR_MSG=$(sqlite3 database/ideas.db "SELECT last_error_message FROM tasks WHERE id = '$TASK_ID'")
echo "Last error message: $ERROR_MSG"

# 4. Verify it's not null/empty
if [ -n "$ERROR_MSG" ]; then
  echo "✅ PASS: last_error_message is populated"

  # 5. Verify checkNeedsNoProgressReview would find it
  REPEATED=$(sqlite3 database/ideas.db << EOF
    SELECT COUNT(*) FROM tasks
    WHERE last_error_message = '$ERROR_MSG'
      AND consecutive_failures >= 2
EOF
  )
  echo "Tasks with repeated error: $REPEATED"
  exit 0
else
  echo "❌ FAIL: last_error_message is NULL or empty"
  exit 1
fi
```

#### Pass Criteria

| Criterion          | Expected Result                          | Verification Method        |
| ------------------ | ---------------------------------------- | -------------------------- |
| Column updated     | tasks.last_error_message contains error  | Query tasks table          |
| Error preserved    | Message matches actual error             | Compare with execution log |
| Truncation works   | Long errors truncated to 1000 chars      | Test with 2000 char error  |
| Repeated detection | checkNeedsNoProgressReview finds matches | Execute same task twice    |

---

### GAP-004: Missing `/api/task-agent/tasks/:id/diagnose` Endpoint

**ID**: GAP-006 (sub-issue)
**Severity**: 🟠 HIGH
**Category**: SIA Integration
**Location**: `server/routes/task-agent.ts`

#### Description

The implementation plan specifies a `/diagnose` endpoint but it doesn't exist. There's no API to manually trigger SIA diagnosis for stuck tasks.

#### Impact

- Cannot manually trigger SIA for stuck tasks
- No way to get diagnostic context via API
- Dashboard cannot offer "Diagnose" action

#### Implementation Checklist

- [ ] **1. Add endpoint to task-agent.ts routes**

  ```typescript
  // POST /api/task-agent/tasks/:id/diagnose
  router.post("/tasks/:id/diagnose", async (req, res) => {
    try {
      const { id } = req.params;
      const context = await getDiagnosisContext(id);

      // Trigger SIA analysis
      const escalation = await escalateToSIA(id, "manual_diagnosis");

      res.json({
        task_id: id,
        diagnosis_context: context,
        escalation_id: escalation.id,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  ```

- [ ] **2. Import getDiagnosisContext function**

  ```typescript
  import {
    getDiagnosisContext,
    escalateToSIA,
  } from "../services/task-agent/error-handling";
  ```

- [ ] **3. Add getDiagnosisContext if missing**

  ```typescript
  export async function getDiagnosisContext(
    taskId: string,
  ): Promise<DiagnosisContext> {
    const db = getDatabase();

    // Get task details
    const task = await db.get("SELECT * FROM tasks WHERE id = ?", taskId);

    // Get recent failures
    const failures = await db.all(
      `
      SELECT * FROM task_failure_history
      WHERE task_id = ?
      ORDER BY failed_at DESC
      LIMIT 10
    `,
      taskId,
    );

    // Get execution logs
    const logs = await db.all(
      `
      SELECT tel.* FROM task_execution_log tel
      JOIN task_executions te ON te.id = tel.execution_id
      WHERE te.task_id = ?
      ORDER BY tel.timestamp DESC
      LIMIT 100
    `,
      taskId,
    );

    return { task, failures, logs };
  }
  ```

- [ ] **4. Add OpenAPI documentation for endpoint**

- [ ] **5. Add frontend "Diagnose" button (optional)**

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-004-diagnose-endpoint.sh

echo "=== GAP-004: Diagnose Endpoint Test ==="

# 1. Create a task with some failures
TASK_ID=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task for diagnosis",
    "status": "failed"
  }' | jq -r '.id')

echo "Created task: $TASK_ID"

# 2. Call diagnose endpoint
RESPONSE=$(curl -s -X POST "http://localhost:3001/api/task-agent/tasks/$TASK_ID/diagnose")
echo "Diagnose response: $RESPONSE"

# 3. Check response structure
HAS_CONTEXT=$(echo "$RESPONSE" | jq 'has("diagnosis_context")')
HAS_ESCALATION=$(echo "$RESPONSE" | jq 'has("escalation_id")')

# 4. Verify endpoint works
if [ "$HAS_CONTEXT" = "true" ] && [ "$HAS_ESCALATION" = "true" ]; then
  echo "✅ PASS: Diagnose endpoint returns expected structure"

  # 5. Verify escalation was created
  ESCALATION_ID=$(echo "$RESPONSE" | jq -r '.escalation_id')
  ESCALATION_EXISTS=$(sqlite3 database/ideas.db "SELECT COUNT(*) FROM sia_escalations WHERE id = '$ESCALATION_ID'")

  if [ "$ESCALATION_EXISTS" -eq 1 ]; then
    echo "✅ PASS: SIA escalation created"
    exit 0
  else
    echo "❌ FAIL: SIA escalation not found in database"
    exit 1
  fi
else
  echo "❌ FAIL: Diagnose endpoint response malformed"
  echo "  has diagnosis_context: $HAS_CONTEXT"
  echo "  has escalation_id: $HAS_ESCALATION"
  exit 1
fi
```

#### Pass Criteria

| Criterion              | Expected Result                                     | Verification Method  |
| ---------------------- | --------------------------------------------------- | -------------------- |
| Endpoint exists        | POST /api/task-agent/tasks/:id/diagnose returns 200 | curl returns success |
| Context returned       | Response includes diagnosis_context object          | Check JSON structure |
| Escalation created     | sia_escalations table has new entry                 | Query database       |
| Task failures included | diagnosis_context.failures array populated          | Check response       |
| Logs included          | diagnosis_context.logs array populated              | Check response       |

---

## 🟡 MEDIUM SEVERITY GAPS

### GAP-005: `test_commands` Not in `appendix_type` Enum

**ID**: GAP-003 (sub-issue)
**Severity**: 🟡 MEDIUM
**Category**: Multi-level Testing
**Location**: `database/migrations/` (schema)

#### Description

Plan mentions storing test commands in `task_appendices` but `test_commands` may not be in the allowed `appendix_type` CHECK constraint.

#### Impact

- Cannot store per-task test commands in appendices
- Test configuration not portable with task

#### Implementation Checklist

- [ ] **1. Check current appendix_type constraint**

  ```sql
  SELECT sql FROM sqlite_master
  WHERE type='table' AND name='task_appendices';
  ```

- [ ] **2. Create migration to add test_commands type**

  ```sql
  -- File: database/migrations/100_add_test_commands_appendix_type.sql

  -- SQLite doesn't support ALTER CHECK, so we need to:
  -- 1. Create new table with updated constraint
  -- 2. Copy data
  -- 3. Drop old table
  -- 4. Rename new table

  CREATE TABLE task_appendices_new (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    appendix_type TEXT NOT NULL CHECK (
      appendix_type IN (
        'code_context', 'research_notes', 'gotchas',
        'rollback_plan', 'test_cases', 'dependencies',
        'acceptance_criteria', 'technical_notes', 'related_files',
        'api_contracts', 'test_commands'  -- Added
      )
    ),
    content TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  INSERT INTO task_appendices_new SELECT * FROM task_appendices;
  DROP TABLE task_appendices;
  ALTER TABLE task_appendices_new RENAME TO task_appendices;
  ```

- [ ] **3. Run migration**

  ```bash
  npm run migrate
  ```

- [ ] **4. Update TypeScript types**

  ```typescript
  // types/task-agent.ts
  export type AppendixType =
    | "code_context"
    | "research_notes"
    | "gotchas"
    | "rollback_plan"
    | "test_cases"
    | "dependencies"
    | "acceptance_criteria"
    | "technical_notes"
    | "related_files"
    | "api_contracts"
    | "test_commands"; // Added
  ```

- [ ] **5. Test inserting test_commands appendix**

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-005-test-commands-appendix.sh

echo "=== GAP-005: test_commands Appendix Type Test ==="

# 1. First, ensure migration is run
npm run migrate 2>/dev/null

# 2. Create a task
TASK_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

sqlite3 database/ideas.db << EOF
INSERT INTO tasks (id, title, status, created_at, updated_at)
VALUES ('$TASK_ID', 'Test task', 'pending', datetime('now'), datetime('now'));
EOF

# 3. Try to insert a test_commands appendix
APPENDIX_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

sqlite3 database/ideas.db << EOF
INSERT INTO task_appendices (id, task_id, appendix_type, content)
VALUES ('$APPENDIX_ID', '$TASK_ID', 'test_commands', '{"unit": "npm test", "api": "pytest tests/api/"}');
EOF

RESULT=$?

# 4. Check if insert succeeded
if [ $RESULT -eq 0 ]; then
  echo "✅ PASS: test_commands appendix type accepted"

  # Verify it was stored
  STORED=$(sqlite3 database/ideas.db "SELECT appendix_type FROM task_appendices WHERE id = '$APPENDIX_ID'")
  echo "Stored type: $STORED"

  # Cleanup
  sqlite3 database/ideas.db "DELETE FROM task_appendices WHERE id = '$APPENDIX_ID'"
  sqlite3 database/ideas.db "DELETE FROM tasks WHERE id = '$TASK_ID'"
  exit 0
else
  echo "❌ FAIL: test_commands appendix type rejected by CHECK constraint"
  exit 1
fi
```

#### Pass Criteria

| Criterion       | Expected Result                              | Verification Method |
| --------------- | -------------------------------------------- | ------------------- |
| Migration runs  | No errors from npm run migrate               | Check exit code     |
| Insert succeeds | test_commands appendix can be inserted       | SQL INSERT works    |
| Type validated  | TypeScript types include test_commands       | tsc compiles        |
| Retrieval works | Can query appendices with type=test_commands | SELECT query        |

---

### GAP-006: No Delay Between Retries

**ID**: GAP-005
**Severity**: 🟡 MEDIUM
**Category**: Retry Logic
**Location**: `coding-loops/agents/build_agent_worker.py`

#### Description

Retries happen immediately in a tight loop with no delay between attempts.

#### Impact

- Resource exhaustion (CPU, API limits)
- Transient errors may repeat immediately
- No time for external systems to recover

#### Implementation Checklist

- [ ] **1. Add retry configuration**

  ```python
  RETRY_CONFIG = {
      'base_delay_seconds': 5,
      'max_delay_seconds': 60,
      'exponential_base': 2,
      'jitter': True
  }
  ```

- [ ] **2. Implement exponential backoff with jitter**

  ```python
  import time
  import random

  def _get_retry_delay(self, attempt: int) -> float:
      """Calculate delay with exponential backoff and jitter."""
      base = RETRY_CONFIG['base_delay_seconds']
      max_delay = RETRY_CONFIG['max_delay_seconds']
      exp_base = RETRY_CONFIG['exponential_base']

      delay = min(base * (exp_base ** attempt), max_delay)

      if RETRY_CONFIG['jitter']:
          delay = delay * (0.5 + random.random())  # 50-150% of delay

      return delay
  ```

- [ ] **3. Add delay before retry in execution loop**

  ```python
  def _execute_with_retry(self, task):
      for attempt in range(self.max_retries):
          try:
              return self._execute_task_impl(task)
          except RetryableError as e:
              if attempt < self.max_retries - 1:
                  delay = self._get_retry_delay(attempt)
                  self._log(f"Retrying in {delay:.1f}s (attempt {attempt + 1})")
                  time.sleep(delay)
              else:
                  raise
  ```

- [ ] **4. Make delays configurable via environment**

  ```python
  RETRY_CONFIG['base_delay_seconds'] = int(os.getenv('RETRY_BASE_DELAY', 5))
  ```

- [ ] **5. Log retry delays for observability**

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-006-retry-delay.sh

echo "=== GAP-006: Retry Delay Test ==="

# 1. Create a task that will fail on first 2 attempts
TASK_ID=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task to test retry delays",
    "validation_command": "test $(cat /tmp/attempt_count_'$$') -ge 3"
  }' | jq -r '.id')

echo "0" > /tmp/attempt_count_$$

# 2. Track start time
START=$(date +%s)

# 3. Execute (will retry)
export RETRY_BASE_DELAY=2  # Short for testing
python3 coding-loops/agents/build_agent_worker.py --task-id "$TASK_ID" 2>&1 &
PID=$!

# 4. Increment attempt counter on each attempt (detected by file access)
for i in 1 2 3; do
  sleep 1
  CURRENT=$(cat /tmp/attempt_count_$$)
  echo $((CURRENT + 1)) > /tmp/attempt_count_$$
done

wait $PID

# 5. Check elapsed time
END=$(date +%s)
ELAPSED=$((END - START))

echo "Total time: ${ELAPSED}s"

# 6. With 2 retries at 2s base delay with exponential backoff:
# Attempt 1: immediate
# Attempt 2: ~2s delay
# Attempt 3: ~4s delay
# Total: at least 6s (without execution time)

if [ $ELAPSED -ge 4 ]; then
  echo "✅ PASS: Retries have appropriate delays (took ${ELAPSED}s)"
  exit 0
else
  echo "❌ FAIL: Retries too fast (only ${ELAPSED}s for 3 attempts)"
  exit 1
fi

# Cleanup
rm -f /tmp/attempt_count_$$
```

#### Pass Criteria

| Criterion          | Expected Result                       | Verification Method    |
| ------------------ | ------------------------------------- | ---------------------- |
| Delay applied      | Sleep occurs between retries          | Time multiple retries  |
| Exponential growth | 2nd retry waits longer than 1st       | Check timing logs      |
| Max delay capped   | Delay never exceeds max_delay_seconds | Test with many retries |
| Jitter works       | Delays vary slightly each time        | Compare multiple runs  |
| Configurable       | RETRY_BASE_DELAY env var works        | Set env and verify     |

---

### GAP-007: No Error Classification

**ID**: GAP-005 (sub-issue)
**Severity**: 🟡 MEDIUM
**Category**: Retry Logic
**Location**: `coding-loops/agents/build_agent_worker.py`

#### Description

All errors are treated the same (transient vs permanent). Retries are wasted on permanent errors (e.g., missing file, syntax error).

#### Impact

- Wasted retries on unrecoverable errors
- Delayed failure detection
- Resource waste

#### Implementation Checklist

- [ ] **1. Define error categories**

  ```python
  class ErrorCategory(Enum):
      TRANSIENT = "transient"      # Network, timeout, rate limit
      PERMANENT = "permanent"      # Syntax, missing file, invalid config
      UNKNOWN = "unknown"          # Default, treat as transient
  ```

- [ ] **2. Create error classifier**

  ```python
  def _classify_error(self, error: Exception) -> ErrorCategory:
      error_msg = str(error).lower()

      # Permanent errors - don't retry
      permanent_patterns = [
          'syntax error',
          'file not found',
          'no such file',
          'permission denied',
          'invalid configuration',
          'missing required',
          'import error',
          'module not found'
      ]
      for pattern in permanent_patterns:
          if pattern in error_msg:
              return ErrorCategory.PERMANENT

      # Transient errors - retry
      transient_patterns = [
          'timeout',
          'connection refused',
          'rate limit',
          'temporarily unavailable',
          'network error',
          'econnreset'
      ]
      for pattern in transient_patterns:
          if pattern in error_msg:
              return ErrorCategory.TRANSIENT

      return ErrorCategory.UNKNOWN
  ```

- [ ] **3. Skip retries for permanent errors**

  ```python
  def _execute_with_retry(self, task):
      for attempt in range(self.max_retries):
          try:
              return self._execute_task_impl(task)
          except Exception as e:
              category = self._classify_error(e)

              if category == ErrorCategory.PERMANENT:
                  self._log(f"Permanent error, not retrying: {e}")
                  raise

              if attempt < self.max_retries - 1:
                  delay = self._get_retry_delay(attempt)
                  self._log(f"Transient error, retrying in {delay:.1f}s")
                  time.sleep(delay)
              else:
                  raise
  ```

- [ ] **4. Record error category in failure history**

- [ ] **5. Add metrics for error categories**

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-007-error-classification.sh

echo "=== GAP-007: Error Classification Test ==="

# Test 1: Permanent error (should not retry)
echo "Test 1: Permanent error (syntax error)"

TASK_ID=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Permanent error task",
    "validation_command": "python3 -c \"syntax error here\""
  }' | jq -r '.id')

START=$(date +%s)
python3 coding-loops/agents/build_agent_worker.py --task-id "$TASK_ID" 2>&1 || true
END=$(date +%s)
ELAPSED=$((END - START))

# Should fail fast (no retries)
if [ $ELAPSED -lt 5 ]; then
  echo "✅ Permanent error: Failed fast (${ELAPSED}s)"
else
  echo "❌ Permanent error: Retried unnecessarily (${ELAPSED}s)"
  exit 1
fi

# Test 2: Transient error (should retry)
echo "Test 2: Transient error (timeout simulation)"

TASK_ID2=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Transient error task",
    "validation_command": "curl --connect-timeout 1 http://localhost:99999"
  }' | jq -r '.id')

START=$(date +%s)
timeout 30 python3 coding-loops/agents/build_agent_worker.py --task-id "$TASK_ID2" 2>&1 || true
END=$(date +%s)
ELAPSED=$((END - START))

# Should retry (takes longer)
if [ $ELAPSED -ge 5 ]; then
  echo "✅ Transient error: Retried appropriately (${ELAPSED}s)"
  exit 0
else
  echo "❌ Transient error: Did not retry (${ELAPSED}s)"
  exit 1
fi
```

#### Pass Criteria

| Criterion             | Expected Result                       | Verification Method   |
| --------------------- | ------------------------------------- | --------------------- |
| Permanent detected    | Syntax errors classified as permanent | Unit test classifier  |
| Transient detected    | Timeouts classified as transient      | Unit test classifier  |
| No retry on permanent | Execution stops immediately           | Time execution        |
| Retry on transient    | Multiple attempts made                | Count attempts in log |
| Category recorded     | task_failure_history.error_type set   | Query database        |

---

### GAP-008: No Cleanup for `task_execution_log`

**ID**: GAP-004
**Severity**: 🟡 MEDIUM
**Category**: Context Handoff
**Location**: Database schema / maintenance

#### Description

`task_execution_log` table grows unbounded with no retention policy.

#### Impact

- Database bloat over time
- Slower queries as table grows
- Increased backup size

#### Implementation Checklist

- [ ] **1. Add retention policy configuration**

  ```typescript
  const LOG_RETENTION = {
    task_execution_log: 30, // days
    task_failure_history: 90,
    sia_escalations: 180,
  };
  ```

- [ ] **2. Create cleanup function**

  ```typescript
  // server/services/maintenance/log-cleanup.ts
  export async function cleanupOldLogs(): Promise<CleanupResult> {
    const db = getDatabase();

    const results = {
      task_execution_log: 0,
      task_failure_history: 0,
      sia_escalations: 0,
    };

    // Clean task_execution_log
    const logResult = await db.run(`
      DELETE FROM task_execution_log
      WHERE timestamp < datetime('now', '-30 days')
    `);
    results.task_execution_log = logResult.changes;

    // Clean task_failure_history
    const historyResult = await db.run(`
      DELETE FROM task_failure_history
      WHERE failed_at < datetime('now', '-90 days')
    `);
    results.task_failure_history = historyResult.changes;

    return results;
  }
  ```

- [ ] **3. Add cron job or scheduled task**

  ```typescript
  // Run daily at 3 AM
  import cron from "node-cron";

  cron.schedule("0 3 * * *", async () => {
    const results = await cleanupOldLogs();
    console.log("Log cleanup complete:", results);
  });
  ```

- [ ] **4. Add manual cleanup endpoint**

  ```typescript
  // POST /api/maintenance/cleanup-logs
  router.post("/cleanup-logs", async (req, res) => {
    const results = await cleanupOldLogs();
    res.json(results);
  });
  ```

- [ ] **5. Add metrics for table sizes**

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-008-log-cleanup.sh

echo "=== GAP-008: Log Cleanup Test ==="

# 1. Insert old test records
sqlite3 database/ideas.db << EOF
-- Create a task for testing
INSERT OR IGNORE INTO tasks (id, title, status, created_at, updated_at)
VALUES ('cleanup-test-task', 'Cleanup Test', 'pending', datetime('now'), datetime('now'));

-- Create an execution
INSERT OR IGNORE INTO task_executions (id, task_id, status, started_at)
VALUES ('cleanup-test-exec', 'cleanup-test-task', 'completed', datetime('now'));

-- Insert old log entries (40 days old)
INSERT INTO task_execution_log (id, execution_id, timestamp, level, message)
VALUES
  ('old-log-1', 'cleanup-test-exec', datetime('now', '-40 days'), 'info', 'Old log 1'),
  ('old-log-2', 'cleanup-test-exec', datetime('now', '-40 days'), 'info', 'Old log 2');

-- Insert recent log entries (5 days old)
INSERT INTO task_execution_log (id, execution_id, timestamp, level, message)
VALUES
  ('new-log-1', 'cleanup-test-exec', datetime('now', '-5 days'), 'info', 'Recent log 1');
EOF

# 2. Count records before cleanup
BEFORE=$(sqlite3 database/ideas.db "SELECT COUNT(*) FROM task_execution_log WHERE execution_id = 'cleanup-test-exec'")
echo "Records before cleanup: $BEFORE"

# 3. Run cleanup
RESPONSE=$(curl -s -X POST http://localhost:3001/api/maintenance/cleanup-logs)
echo "Cleanup response: $RESPONSE"

# 4. Count records after cleanup
AFTER=$(sqlite3 database/ideas.db "SELECT COUNT(*) FROM task_execution_log WHERE execution_id = 'cleanup-test-exec'")
echo "Records after cleanup: $AFTER"

# 5. Verify old records deleted, recent kept
if [ "$BEFORE" -eq 3 ] && [ "$AFTER" -eq 1 ]; then
  echo "✅ PASS: Old logs cleaned up, recent logs retained"
  exit 0
else
  echo "❌ FAIL: Cleanup didn't work as expected"
  echo "  Expected: 3 before, 1 after"
  echo "  Got: $BEFORE before, $AFTER after"
  exit 1
fi
```

#### Pass Criteria

| Criterion        | Expected Result                           | Verification Method |
| ---------------- | ----------------------------------------- | ------------------- |
| Old logs deleted | Records > 30 days removed                 | Query after cleanup |
| Recent logs kept | Records < 30 days retained                | Query after cleanup |
| API works        | /api/maintenance/cleanup-logs returns 200 | curl check          |
| Scheduled run    | Cron job executes daily                   | Check cron log      |
| Count returned   | Cleanup returns number deleted            | Check response      |

---

### GAP-009: Many Acceptance Criteria "Assumed Pass"

**ID**: GAP-002
**Severity**: 🟡 MEDIUM
**Category**: Acceptance Criteria
**Location**: `coding-loops/agents/build_agent_worker.py:_check_acceptance_criteria()`

#### Description

`_check_acceptance_criteria()` returns pass for unverifiable criteria, leading to false positives.

#### Impact

- Bugs slip through unverified
- False confidence in task completion
- Quality degradation

#### Implementation Checklist

- [ ] **1. Add verification status enum**

  ```python
  class VerificationStatus(Enum):
      VERIFIED_PASS = "verified_pass"
      VERIFIED_FAIL = "verified_fail"
      UNVERIFIABLE = "unverifiable"
      SKIPPED = "skipped"
  ```

- [ ] **2. Track unverifiable criteria separately**

  ```python
  def _check_acceptance_criteria(self, criteria: List[str]) -> CriteriaResult:
      results = []

      for criterion in criteria:
          if self._can_verify(criterion):
              passed = self._verify_criterion(criterion)
              results.append({
                  'criterion': criterion,
                  'status': VerificationStatus.VERIFIED_PASS if passed else VerificationStatus.VERIFIED_FAIL
              })
          else:
              results.append({
                  'criterion': criterion,
                  'status': VerificationStatus.UNVERIFIABLE
              })
              self._log(f"⚠️ WARNING: Cannot verify: {criterion}")

      return CriteriaResult(
          all_passed=all(r['status'] != VerificationStatus.VERIFIED_FAIL for r in results),
          unverifiable_count=sum(1 for r in results if r['status'] == VerificationStatus.UNVERIFIABLE),
          results=results
      )
  ```

- [ ] **3. Add configuration for unverifiable handling**

  ```python
  CRITERIA_CONFIG = {
      'fail_on_unverifiable': False,  # If True, unverifiable = fail
      'max_unverifiable_ratio': 0.5,  # Fail if > 50% unverifiable
      'log_unverifiable': True
  }
  ```

- [ ] **4. Add warning threshold**

  ```python
  if result.unverifiable_count > len(criteria) * 0.5:
      self._log("⚠️ HIGH: More than 50% of criteria unverifiable")
      if CRITERIA_CONFIG['fail_on_unverifiable']:
          return CriteriaResult(all_passed=False, ...)
  ```

- [ ] **5. Record unverifiable criteria in execution log**

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-009-acceptance-criteria.sh

echo "=== GAP-009: Acceptance Criteria Verification Test ==="

# 1. Create task with mix of verifiable and unverifiable criteria
TASK_ID=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Criteria test task",
    "acceptance_criteria": [
      "File src/test.ts exists",
      "User experience is intuitive",
      "Function returns correct value",
      "Code is clean and maintainable"
    ]
  }' | jq -r '.id')

echo "Created task: $TASK_ID"

# 2. Execute the task
python3 coding-loops/agents/build_agent_worker.py --task-id "$TASK_ID" 2>&1 | tee /tmp/criteria-output.txt

# 3. Check for unverifiable warnings
WARNINGS=$(grep -c "WARNING.*Cannot verify" /tmp/criteria-output.txt || echo 0)
echo "Unverifiable warnings logged: $WARNINGS"

# 4. Check execution log for unverifiable count
UNVERIFIABLE=$(sqlite3 database/ideas.db << EOF
SELECT COUNT(*) FROM task_execution_log tel
JOIN task_executions te ON te.id = tel.execution_id
WHERE te.task_id = '$TASK_ID'
  AND tel.message LIKE '%unverifiable%'
EOF
)

echo "Unverifiable criteria in log: $UNVERIFIABLE"

# 5. Verify warnings are logged
if [ "$WARNINGS" -ge 2 ]; then
  echo "✅ PASS: Unverifiable criteria properly warned"
  exit 0
else
  echo "❌ FAIL: Missing warnings for unverifiable criteria"
  exit 1
fi
```

#### Pass Criteria

| Criterion          | Expected Result                        | Verification Method         |
| ------------------ | -------------------------------------- | --------------------------- |
| Warnings logged    | Unverifiable criteria trigger warnings | Check log output            |
| Status tracked     | VerificationStatus.UNVERIFIABLE set    | Check execution record      |
| Ratio calculated   | unverifiable_count accurate            | Compare to total            |
| Config respected   | fail_on_unverifiable works when true   | Test with config            |
| Threshold enforced | > 50% unverifiable triggers action     | Test with many unverifiable |

---

### GAP-010: No Validation Command Sanitization

**ID**: GAP-001
**Severity**: 🟡 MEDIUM
**Category**: Validation Commands
**Location**: `coding-loops/agents/build_agent_worker.py`

#### Description

`validation_command` is executed via `shell=True` with no sanitization, creating potential command injection risk.

#### Impact

- Security vulnerability if malicious commands stored
- Potential for unintended system changes
- Risk of data exfiltration

#### Implementation Checklist

- [ ] **1. Create command allowlist**

  ```python
  ALLOWED_COMMAND_PREFIXES = [
      'npm ', 'npx ', 'node ', 'python3 ',
      'pytest ', 'jest ', 'vitest ',
      'tsc ', 'eslint ', 'prettier ',
      'curl ', 'grep ', 'test ', 'echo ',
      'sqlite3 ', 'cat ', 'ls '
  ]
  ```

- [ ] **2. Add command validation function**

  ```python
  def _validate_command(self, command: str) -> bool:
      """Validate command against allowlist."""
      command = command.strip()

      # Check against allowlist
      for prefix in ALLOWED_COMMAND_PREFIXES:
          if command.startswith(prefix):
              return True

      # Check for dangerous patterns
      dangerous_patterns = [
          'rm -rf', 'sudo', '> /dev',
          '| sh', '| bash', 'curl | ',
          'eval ', 'exec ', '$(', '`'
      ]
      for pattern in dangerous_patterns:
          if pattern in command:
              self._log(f"⚠️ BLOCKED: Dangerous pattern in command: {pattern}")
              return False

      return False  # Not in allowlist = blocked
  ```

- [ ] **3. Add sandboxed execution option**

  ```python
  def _execute_validation_command(self, command: str) -> ValidationResult:
      if not self._validate_command(command):
          return ValidationResult(
              success=False,
              error="Command blocked by security policy"
          )

      # Use restricted environment
      restricted_env = {
          'PATH': '/usr/bin:/usr/local/bin',
          'HOME': '/tmp/sandbox',
          'USER': 'nobody'
      }

      result = subprocess.run(
          command,
          shell=True,
          capture_output=True,
          timeout=60,
          env=restricted_env,
          cwd='/tmp/sandbox'
      )

      return ValidationResult(
          success=result.returncode == 0,
          stdout=result.stdout.decode(),
          stderr=result.stderr.decode()
      )
  ```

- [ ] **4. Log all command executions for audit**

- [ ] **5. Add bypass flag for trusted commands (optional)**

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-010-command-sanitization.sh

echo "=== GAP-010: Command Sanitization Test ==="

# Test 1: Allowed command should work
echo "Test 1: Allowed command (npm test)"
TASK1=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Safe command", "validation_command": "npm test -- --version"}' \
  | jq -r '.id')

RESULT1=$(python3 coding-loops/agents/build_agent_worker.py --task-id "$TASK1" --validate-only 2>&1)
if echo "$RESULT1" | grep -q "blocked"; then
  echo "❌ FAIL: Safe command was blocked"
  exit 1
else
  echo "✅ Allowed command accepted"
fi

# Test 2: Dangerous command should be blocked
echo "Test 2: Dangerous command (rm -rf)"
TASK2=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Dangerous command", "validation_command": "rm -rf /"}' \
  | jq -r '.id')

RESULT2=$(python3 coding-loops/agents/build_agent_worker.py --task-id "$TASK2" --validate-only 2>&1)
if echo "$RESULT2" | grep -q "blocked\|BLOCKED"; then
  echo "✅ Dangerous command blocked"
else
  echo "❌ FAIL: Dangerous command was NOT blocked"
  exit 1
fi

# Test 3: Command injection attempt
echo "Test 3: Command injection (;)"
TASK3=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Injection attempt", "validation_command": "echo safe; rm -rf /"}' \
  | jq -r '.id')

RESULT3=$(python3 coding-loops/agents/build_agent_worker.py --task-id "$TASK3" --validate-only 2>&1)
if echo "$RESULT3" | grep -q "blocked\|BLOCKED"; then
  echo "✅ Injection attempt blocked"
  exit 0
else
  echo "❌ FAIL: Injection attempt was NOT blocked"
  exit 1
fi
```

#### Pass Criteria

| Criterion         | Expected Result                 | Verification Method     |
| ----------------- | ------------------------------- | ----------------------- |
| Allowlist works   | npm/pytest/tsc commands allowed | Test allowed commands   |
| Dangerous blocked | rm -rf/sudo blocked             | Test dangerous commands |
| Injection blocked | ; and && chains blocked         | Test injection attempts |
| Audit logged      | All executions logged           | Check execution_log     |
| Error returned    | Blocked commands return error   | Check response          |

---

## 🟢 LOW SEVERITY GAPS

### GAP-011: 500 Line Context Limit May Be Insufficient

**ID**: GAP-004 (sub-issue)
**Severity**: 🟢 LOW
**Category**: Context Handoff
**Location**: `coding-loops/agents/build_agent_worker.py:_load_previous_context()`

#### Description

`_load_previous_context()` is limited to 500 lines, which may be insufficient for complex tasks.

#### Impact

- Complex tasks may lose important context
- Debugging harder without full history

#### Implementation Checklist

- [ ] **1. Make limit configurable**

  ```python
  CONTEXT_CONFIG = {
      'default_line_limit': 500,
      'max_line_limit': 2000,
      'include_full_on_failure': True
  }
  ```

- [ ] **2. Add environment variable override**

  ```python
  line_limit = int(os.getenv('CONTEXT_LINE_LIMIT', CONTEXT_CONFIG['default_line_limit']))
  ```

- [ ] **3. Add intelligent truncation**

  ```python
  def _load_previous_context(self, task_id: str, line_limit: int = None) -> str:
      limit = line_limit or CONTEXT_CONFIG['default_line_limit']

      # Get all context
      full_context = self._get_full_context(task_id)

      if len(full_context.split('\n')) <= limit:
          return full_context

      # Intelligent truncation: keep start and end
      lines = full_context.split('\n')
      keep_start = limit // 3
      keep_end = limit // 3

      truncated = (
          '\n'.join(lines[:keep_start]) +
          f'\n\n... ({len(lines) - keep_start - keep_end} lines truncated) ...\n\n' +
          '\n'.join(lines[-keep_end:])
      )

      return truncated
  ```

- [ ] **4. Add task complexity detection**
  - Increase limit for tasks with many file impacts
  - Increase limit for tasks with long failure history

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-011-context-limit.sh

echo "=== GAP-011: Context Line Limit Test ==="

# 1. Create task with extensive context
TASK_ID=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Context limit test"}' | jq -r '.id')

# 2. Add lots of execution log entries
for i in $(seq 1 600); do
  sqlite3 database/ideas.db << EOF
INSERT INTO task_execution_log (id, execution_id, timestamp, level, message)
VALUES ('log-$i-$TASK_ID', (SELECT id FROM task_executions WHERE task_id = '$TASK_ID' LIMIT 1),
        datetime('now'), 'info', 'Log line $i with some content for testing');
EOF
done

# 3. Load context with default limit
DEFAULT_CONTEXT=$(CONTEXT_LINE_LIMIT=500 python3 -c "
from coding_loops.agents.build_agent_worker import BuildAgentWorker
worker = BuildAgentWorker()
print(len(worker._load_previous_context('$TASK_ID').split('\n')))
")

echo "Lines with default limit: $DEFAULT_CONTEXT"

# 4. Load context with increased limit
INCREASED_CONTEXT=$(CONTEXT_LINE_LIMIT=1000 python3 -c "
from coding_loops.agents.build_agent_worker import BuildAgentWorker
worker = BuildAgentWorker()
print(len(worker._load_previous_context('$TASK_ID').split('\n')))
")

echo "Lines with increased limit: $INCREASED_CONTEXT"

# 5. Verify configurable
if [ "$INCREASED_CONTEXT" -gt "$DEFAULT_CONTEXT" ]; then
  echo "✅ PASS: Context limit is configurable"
  exit 0
else
  echo "❌ FAIL: Context limit not respecting configuration"
  exit 1
fi
```

#### Pass Criteria

| Criterion        | Expected Result               | Verification Method       |
| ---------------- | ----------------------------- | ------------------------- |
| Default works    | 500 lines returned by default | Check output length       |
| Config works     | Env var changes limit         | Set and verify            |
| Truncation smart | Start and end preserved       | Check truncated output    |
| Max enforced     | Cannot exceed max_line_limit  | Test with very high value |

---

### GAP-012: SIA Escalation Creates Record But Doesn't Spawn SIA

**ID**: GAP-006 (sub-issue)
**Severity**: 🟢 LOW
**Category**: SIA Integration
**Location**: `server/services/task-agent/error-handling.ts`

#### Description

`escalateToSIA()` writes to `sia_escalations` and emits an event, but no automatic SIA analysis is triggered.

#### Impact

- SIA escalations require manual trigger
- No automatic analysis of stuck tasks

#### Implementation Checklist

- [ ] **1. Create SIA spawner service**

  ```typescript
  // server/services/sia/sia-spawner.ts
  export async function spawnSIAForEscalation(
    escalationId: string,
  ): Promise<void> {
    const escalation = await getEscalation(escalationId);
    const context = await getDiagnosisContext(escalation.task_id);

    // Spawn SIA agent
    const agent = await spawnAgent({
      type: "sia",
      task_id: escalation.task_id,
      escalation_id: escalationId,
      context,
    });

    // Update escalation with agent reference
    await db.run("UPDATE sia_escalations SET agent_id = ? WHERE id = ?", [
      agent.id,
      escalationId,
    ]);
  }
  ```

- [ ] **2. Wire up event listener**

  ```typescript
  // server/websocket.ts or event handler
  eventBus.on("sia:escalation", async (event) => {
    await spawnSIAForEscalation(event.escalation_id);
  });
  ```

- [ ] **3. Add SIA agent configuration**

  ```typescript
  const SIA_CONFIG = {
    auto_spawn: true,
    max_concurrent: 2,
    timeout_minutes: 30,
  };
  ```

- [ ] **4. Add escalation status tracking**
  - pending → analyzing → resolved / unresolved

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-012-sia-spawn.sh

echo "=== GAP-012: SIA Auto-Spawn Test ==="

# 1. Create escalation
TASK_ID=$(curl -s -X POST http://localhost:3001/api/task-agent/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "SIA test task", "status": "failed"}' | jq -r '.id')

# 2. Trigger escalation
ESCALATION=$(curl -s -X POST "http://localhost:3001/api/task-agent/tasks/$TASK_ID/diagnose")
ESCALATION_ID=$(echo "$ESCALATION" | jq -r '.escalation_id')

echo "Escalation ID: $ESCALATION_ID"

# 3. Wait for SIA to spawn
sleep 5

# 4. Check if SIA agent was spawned
AGENT_ID=$(sqlite3 database/ideas.db "SELECT agent_id FROM sia_escalations WHERE id = '$ESCALATION_ID'")

if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "null" ]; then
  echo "✅ PASS: SIA agent spawned: $AGENT_ID"

  # Check agent status
  AGENT_STATUS=$(sqlite3 database/ideas.db "SELECT status FROM build_agent_instances WHERE id = '$AGENT_ID'")
  echo "Agent status: $AGENT_STATUS"
  exit 0
else
  echo "❌ FAIL: SIA agent was not spawned"
  exit 1
fi
```

#### Pass Criteria

| Criterion            | Expected Result                        | Verification Method |
| -------------------- | -------------------------------------- | ------------------- |
| Event triggers spawn | sia:escalation → spawnSIAForEscalation | Check logs          |
| Agent created        | build_agent_instances has SIA entry    | Query database      |
| Escalation linked    | sia_escalations.agent_id populated     | Query database      |
| Status tracked       | Escalation status updates              | Query database      |

---

### GAP-013: TypeScript Uses `require("os")` in ESM Context

**ID**: General
**Severity**: 🟢 LOW
**Category**: Code Quality
**Location**: `server/services/task-agent/build-agent-orchestrator.ts:149`

#### Description

Line 149 uses CJS `require` in an ESM module, which may cause issues in strict ESM environments.

#### Impact

- Potential runtime issues in ESM-only environments
- Inconsistent import style

#### Implementation Checklist

- [ ] **1. Locate the require statement**

  ```bash
  grep -n "require.*os" server/services/task-agent/build-agent-orchestrator.ts
  ```

- [ ] **2. Replace with ESM import**

  ```typescript
  // Before
  const os = require("os");

  // After
  import os from "os";
  ```

- [ ] **3. Move import to top of file**
  - Ensure it's with other imports

- [ ] **4. Verify no other CJS requires exist**

  ```bash
  grep -r "require(" server/services/task-agent/
  ```

- [ ] **5. Run TypeScript compilation**
  ```bash
  npx tsc --noEmit
  ```

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-013-esm-imports.sh

echo "=== GAP-013: ESM Import Consistency Test ==="

# 1. Check for CJS requires in task-agent services
CJS_REQUIRES=$(grep -r "require(" server/services/task-agent/ --include="*.ts" | grep -v "node_modules" || true)

if [ -z "$CJS_REQUIRES" ]; then
  echo "✅ No CJS requires found in task-agent services"
else
  echo "❌ CJS requires found:"
  echo "$CJS_REQUIRES"
fi

# 2. Specifically check build-agent-orchestrator.ts
OS_REQUIRE=$(grep 'require.*os' server/services/task-agent/build-agent-orchestrator.ts || true)

if [ -z "$OS_REQUIRE" ]; then
  echo "✅ No require('os') in build-agent-orchestrator.ts"
else
  echo "❌ Found require('os'):"
  echo "$OS_REQUIRE"
  exit 1
fi

# 3. Verify ESM import exists
OS_IMPORT=$(grep "import.*os.*from" server/services/task-agent/build-agent-orchestrator.ts || true)

if [ -n "$OS_IMPORT" ]; then
  echo "✅ ESM import found: $OS_IMPORT"
else
  echo "⚠️ No ESM os import found (may not be needed)"
fi

# 4. TypeScript compilation check
echo "Running TypeScript compilation..."
npx tsc --noEmit 2>&1

if [ $? -eq 0 ]; then
  echo "✅ PASS: TypeScript compiles successfully"
  exit 0
else
  echo "❌ FAIL: TypeScript compilation failed"
  exit 1
fi
```

#### Pass Criteria

| Criterion          | Expected Result              | Verification Method |
| ------------------ | ---------------------------- | ------------------- |
| No CJS require     | No require() calls in file   | grep returns empty  |
| ESM import present | import os from "os" at top   | grep finds import   |
| Compiles           | npx tsc --noEmit succeeds    | Exit code 0         |
| Runtime works      | Server starts without errors | Start server        |

---

### GAP-014: OBS Tasks Missing Validation Commands

**ID**: GAP-001 (sub-issue)
**Severity**: 🟢 LOW
**Category**: Validation Commands
**Location**: Database migration

#### Description

Tests show "SKIP: No observability tasks with validation commands found". OBS Python/SQL tasks won't use correct validation.

#### Impact

- Observability tasks can't be properly validated
- Test coverage gap for OBS features

#### Implementation Checklist

- [ ] **1. Verify migration 095 exists**

  ```bash
  ls database/migrations/095_populate_obs_validation_commands.sql
  ```

- [ ] **2. Check migration content**
  - Should populate validation_command for OBS tasks
  - Should match task types (Python, SQL, TypeScript)

- [ ] **3. Run the migration**

  ```bash
  npm run migrate
  ```

- [ ] **4. Verify tasks have commands**

  ```sql
  SELECT id, title, validation_command
  FROM tasks
  WHERE title LIKE '%observability%'
    OR title LIKE '%OBS%'
    AND validation_command IS NOT NULL;
  ```

- [ ] **5. Add missing validation commands if needed**
  ```sql
  -- Example update
  UPDATE tasks
  SET validation_command = 'python3 -m pytest tests/e2e/test-obs-*.py -v'
  WHERE title LIKE '%OBS%Python%'
    AND validation_command IS NULL;
  ```

#### Test Script

```bash
#!/bin/bash
# File: tests/e2e/test-gap-014-obs-validation.sh

echo "=== GAP-014: OBS Validation Commands Test ==="

# 1. Run migration
echo "Running migrations..."
npm run migrate 2>&1

# 2. Check for OBS tasks with validation commands
OBS_TASKS=$(sqlite3 database/ideas.db << EOF
SELECT COUNT(*) FROM tasks
WHERE (title LIKE '%observability%' OR title LIKE '%OBS%')
  AND validation_command IS NOT NULL
  AND validation_command != '';
EOF
)

echo "OBS tasks with validation commands: $OBS_TASKS"

# 3. Check for OBS tasks without validation commands
MISSING=$(sqlite3 database/ideas.db << EOF
SELECT id, title FROM tasks
WHERE (title LIKE '%observability%' OR title LIKE '%OBS%')
  AND (validation_command IS NULL OR validation_command = '')
LIMIT 5;
EOF
)

if [ -n "$MISSING" ]; then
  echo "⚠️ OBS tasks missing validation commands:"
  echo "$MISSING"
fi

# 4. Verify at least some have commands
if [ "$OBS_TASKS" -gt 0 ]; then
  echo "✅ PASS: Found $OBS_TASKS OBS tasks with validation commands"
  exit 0
else
  echo "❌ FAIL: No OBS tasks have validation commands"
  echo "Run: npm run migrate"
  exit 1
fi
```

#### Pass Criteria

| Criterion        | Expected Result                                  | Verification Method |
| ---------------- | ------------------------------------------------ | ------------------- |
| Migration exists | 095_populate_obs_validation_commands.sql present | File exists         |
| Migration runs   | No errors during npm run migrate                 | Exit code 0         |
| Tasks populated  | OBS tasks have validation_command                | Query database      |
| Commands valid   | Commands execute successfully                    | Test execution      |

---

## Implementation Order

### Phase 1: Critical (Week 1)

1. **GAP-001**: \_run_test_levels() never called
2. **GAP-002**: Orchestrator error-handling integration

### Phase 2: High (Week 2)

3. **GAP-003**: Python worker last_error_message
4. **GAP-004**: Missing diagnose endpoint

### Phase 3: Medium (Week 3-4)

5. **GAP-005**: test_commands appendix type
6. **GAP-006**: Retry delays
7. **GAP-007**: Error classification
8. **GAP-008**: Log cleanup
9. **GAP-009**: Acceptance criteria verification
10. **GAP-010**: Command sanitization

### Phase 4: Low (Backlog)

11. **GAP-011**: Context limit configuration
12. **GAP-012**: SIA auto-spawn
13. **GAP-013**: ESM import fix
14. **GAP-014**: OBS validation commands

---

## Verification Summary

After implementing all gaps, run the full test suite:

```bash
#!/bin/bash
# File: tests/e2e/test-all-gaps.sh

echo "=== Running All Gap Remediation Tests ==="

PASSED=0
FAILED=0

for test in tests/e2e/test-gap-*.sh; do
  echo ""
  echo "Running: $test"
  echo "----------------------------------------"

  if bash "$test"; then
    ((PASSED++))
  else
    ((FAILED++))
  fi
done

echo ""
echo "========================================"
echo "RESULTS: $PASSED passed, $FAILED failed"
echo "========================================"

if [ $FAILED -eq 0 ]; then
  echo "✅ All gap remediations verified!"
  exit 0
else
  echo "❌ Some gaps still need attention"
  exit 1
fi
```

---

## Appendix: Database Schema Updates Required

```sql
-- File: database/migrations/100_gap_remediation_schema.sql

-- Add test_commands to appendix_type (GAP-005)
-- (See GAP-005 implementation for full migration)

-- Add agent_id to sia_escalations (GAP-012)
ALTER TABLE sia_escalations ADD COLUMN agent_id TEXT REFERENCES build_agent_instances(id);

-- Add error_category to task_failure_history (GAP-007)
ALTER TABLE task_failure_history ADD COLUMN error_category TEXT
  CHECK (error_category IN ('transient', 'permanent', 'unknown'));

-- Index for log cleanup (GAP-008)
CREATE INDEX IF NOT EXISTS idx_task_execution_log_timestamp
  ON task_execution_log(timestamp);
```

---

## Appendix: TypeScript Types Updates Required

```typescript
// types/task-agent.ts additions

// GAP-005: Add test_commands to AppendixType
export type AppendixType =
  | "code_context"
  | "research_notes"
  | "gotchas"
  | "rollback_plan"
  | "test_cases"
  | "dependencies"
  | "acceptance_criteria"
  | "technical_notes"
  | "related_files"
  | "api_contracts"
  | "test_commands";

// GAP-007: Error category enum
export type ErrorCategory = "transient" | "permanent" | "unknown";

// GAP-009: Verification status
export type VerificationStatus =
  | "verified_pass"
  | "verified_fail"
  | "unverifiable"
  | "skipped";

// GAP-004: Diagnosis context
export interface DiagnosisContext {
  task: Task;
  failures: TaskFailureHistory[];
  logs: TaskExecutionLog[];
  escalation_id?: string;
}
```
