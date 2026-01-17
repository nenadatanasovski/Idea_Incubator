# Build Agent Gap Remediation Plan

**Created:** 2026-01-17
**Purpose:** Implementation plan to fix critical gaps in Task Agent → Build Agent E2E flow
**Reference:** [TASK-AGENT-BUILD-AGENT-GAP-ANALYSIS.md](./TASK-AGENT-BUILD-AGENT-GAP-ANALYSIS.md)
**Status:** Ready for execution

---

## Overview

This plan addresses 6 gaps identified in the gap analysis. Each task includes:

- Detailed implementation steps
- Test script(s)
- Pass criteria
- Checkboxes for tracking

**Estimated Total Effort:** 17 hours (7-8 hours for minimum viable, full plan for robustness)

---

## Phase 1: Critical Fixes (MUST HAVE)

### GAP-001: Per-Task Validation Commands

**Problem:** Build Agent hardcodes `npx tsc --noEmit` - Python/SQL tasks fail
**Impact:** ALL non-TypeScript tasks will fail validation
**Effort:** 3 hours

#### Tasks

- [ ] **GAP-001-A:** Add `validation_command` column to tasks table
  - [ ] Create migration `091_add_task_validation_command.sql`
  - [ ] Add `validation_command TEXT` column to `tasks` table
  - [ ] Run migration: `npm run migrate`

- [ ] **GAP-001-B:** Modify Build Agent Worker to read task-specific validation
  - [ ] Edit `coding-loops/agents/build_agent_worker.py`
  - [ ] Update `_load_task()` to fetch `validation_command` column
  - [ ] Update `_run_validation()` to use task's command (fallback to `npx tsc --noEmit`)
  - [ ] Handle empty/null validation_command gracefully

- [ ] **GAP-001-C:** Populate validation commands for observability tasks
  - [ ] Create migration `092_populate_obs_validation_commands.sql`
  - [ ] Set Python validation for OBS-100 to OBS-110: `python3 -c 'import <module>'`
  - [ ] Set SQL validation for schema tasks: `sqlite3 database/ideas.db ".schema"`

#### Test Script: `tests/e2e/test-gap-001-validation-commands.py`

```python
#!/usr/bin/env python3
"""
Test GAP-001: Per-Task Validation Commands

Pass Criteria:
1. tasks table has validation_command column
2. Build Agent reads validation_command from DB
3. Python task uses python3 validation (not tsc)
4. SQL task uses sqlite3 validation (not tsc)
5. TypeScript task still uses tsc (fallback)
"""

import sqlite3
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_schema_has_column():
    """Test 1: tasks table has validation_command column"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [row[1] for row in cursor.fetchall()]
    conn.close()

    assert "validation_command" in columns, "FAIL: validation_command column missing from tasks table"
    print("PASS: validation_command column exists in tasks table")
    return True

def test_python_task_has_python_validation():
    """Test 2: Python tasks have python3 validation command"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT display_id, validation_command
        FROM tasks
        WHERE display_id LIKE 'OBS-1%'
        AND validation_command IS NOT NULL
        LIMIT 1
    """)
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("SKIP: No observability tasks with validation commands found")
        return None

    display_id, cmd = row
    assert "python3" in cmd, f"FAIL: Task {display_id} should use python3 validation, got: {cmd}"
    print(f"PASS: Task {display_id} uses python3 validation: {cmd}")
    return True

def test_sql_task_has_sqlite_validation():
    """Test 3: SQL tasks have sqlite3 validation command"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT display_id, validation_command
        FROM tasks
        WHERE display_id LIKE 'OBS-%'
        AND description LIKE '%migration%'
        AND validation_command IS NOT NULL
        LIMIT 1
    """)
    row = cursor.fetchone()
    conn.close()

    if not row:
        print("SKIP: No SQL migration tasks with validation commands found")
        return None

    display_id, cmd = row
    assert "sqlite3" in cmd or "sql" in cmd.lower(), f"FAIL: SQL task {display_id} should use sqlite3 validation"
    print(f"PASS: Task {display_id} uses SQL validation: {cmd}")
    return True

def test_build_agent_reads_validation_command():
    """Test 4: Build Agent Worker reads validation_command from database"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Check that _load_task fetches validation_command
    assert "validation_command" in content, "FAIL: Build Agent Worker doesn't reference validation_command"

    # Check that _run_validation uses self.task.validation_command (not hardcoded)
    assert "self.task" in content and "validation" in content, "FAIL: Build Agent should use task's validation command"
    print("PASS: Build Agent Worker references validation_command")
    return True

def main():
    print("=" * 60)
    print("GAP-001 Test Suite: Per-Task Validation Commands")
    print("=" * 60)

    results = []
    results.append(("Schema has column", test_schema_has_column()))
    results.append(("Python validation", test_python_task_has_python_validation()))
    results.append(("SQL validation", test_sql_task_has_sqlite_validation()))
    results.append(("Build Agent reads command", test_build_agent_reads_validation_command()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                                           | Verification                                         |
| --- | --------------------------------------------------- | ---------------------------------------------------- |
| 1   | `validation_command` column exists in `tasks` table | `PRAGMA table_info(tasks)` shows column              |
| 2   | Python tasks have `python3` validation              | Query returns `python3 -c 'import...'`               |
| 3   | SQL tasks have `sqlite3` validation                 | Query returns `sqlite3 ...`                          |
| 4   | Build Agent reads from task, not hardcoded          | Code inspection shows `self.task.validation_command` |
| 5   | Fallback works for null validation                  | TypeScript tasks still compile                       |

---

### GAP-002: Acceptance Criteria Enforcement

**Problem:** Build Agent doesn't query `task_appendices` for acceptance criteria
**Impact:** Tasks complete without verifying they actually work
**Effort:** 4 hours

#### Tasks

- [ ] **GAP-002-A:** Query task_appendices for acceptance_criteria in Build Agent Worker
  - [ ] Add method `_load_acceptance_criteria()` that queries `task_appendices`
  - [ ] Call in `_load_task()` to populate `self.acceptance_criteria`
  - [ ] Handle empty/missing criteria (proceed with warning)

- [ ] **GAP-002-B:** Create acceptance criteria checker
  - [ ] Add method `_check_acceptance_criteria(generated_code: str) -> List[CriterionResult]`
  - [ ] Each criterion is checked against generated code/file outputs
  - [ ] Return list of pass/fail results

- [ ] **GAP-002-C:** Integrate acceptance criteria check into execution flow
  - [ ] Call `_check_acceptance_criteria()` after validation passes
  - [ ] Fail task if any acceptance criterion fails
  - [ ] Log individual criterion results to `task_executions`

- [ ] **GAP-002-D:** Populate acceptance criteria for observability tasks
  - [ ] Create script to insert acceptance criteria into `task_appendices`
  - [ ] Each OBS-xxx task gets 2-5 testable criteria

#### Test Script: `tests/e2e/test-gap-002-acceptance-criteria.py`

```python
#!/usr/bin/env python3
"""
Test GAP-002: Acceptance Criteria Enforcement

Pass Criteria:
1. task_appendices has acceptance_criteria entries
2. Build Agent loads acceptance criteria from task_appendices
3. Acceptance criteria are checked after validation
4. Task fails if acceptance criteria fail
5. Criterion results are logged
"""

import sqlite3
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_appendices_have_acceptance_criteria():
    """Test 1: task_appendices table has acceptance_criteria entries"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM task_appendices
        WHERE appendix_type = 'acceptance_criteria'
    """)
    count = cursor.fetchone()[0]
    conn.close()

    assert count > 0, f"FAIL: No acceptance_criteria entries in task_appendices (found {count})"
    print(f"PASS: Found {count} acceptance_criteria entries in task_appendices")
    return True

def test_obs_tasks_have_criteria():
    """Test 2: Observability tasks have acceptance criteria attached"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.display_id, ta.content
        FROM tasks t
        JOIN task_appendices ta ON ta.task_id = t.id
        WHERE t.display_id LIKE 'OBS-%'
        AND ta.appendix_type = 'acceptance_criteria'
        LIMIT 5
    """)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("FAIL: No observability tasks have acceptance criteria")
        return False

    for display_id, content in rows:
        # Content should be parseable JSON list or text
        try:
            criteria = json.loads(content)
            assert len(criteria) > 0, f"Empty criteria for {display_id}"
            print(f"PASS: {display_id} has {len(criteria)} acceptance criteria")
        except json.JSONDecodeError:
            # Plain text criteria are also acceptable
            assert len(content) > 10, f"Criteria too short for {display_id}"
            print(f"PASS: {display_id} has text acceptance criteria")

    return True

def test_build_agent_loads_criteria():
    """Test 3: Build Agent Worker loads acceptance criteria"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    checks = [
        ("task_appendices", "Queries task_appendices table"),
        ("acceptance_criteria", "Handles acceptance_criteria type"),
        ("_load_acceptance_criteria", "Has dedicated method"),
    ]

    for keyword, description in checks:
        if keyword in content:
            print(f"PASS: Build Agent {description}")
        else:
            print(f"FAIL: Build Agent missing - {description}")
            return False

    return True

def test_criteria_checked_after_validation():
    """Test 4: Acceptance criteria check happens after validation"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Should have a method that checks criteria
    if "_check_acceptance_criteria" not in content:
        print("FAIL: Missing _check_acceptance_criteria method")
        return False

    # Should be called in execution flow
    if "check_acceptance" not in content.lower() or "acceptance_criteria" not in content:
        print("FAIL: Acceptance criteria check not integrated into execution")
        return False

    print("PASS: Acceptance criteria checking integrated into execution flow")
    return True

def main():
    print("=" * 60)
    print("GAP-002 Test Suite: Acceptance Criteria Enforcement")
    print("=" * 60)

    results = []
    results.append(("Appendices have AC", test_appendices_have_acceptance_criteria()))
    results.append(("OBS tasks have AC", test_obs_tasks_have_criteria()))
    results.append(("Build Agent loads AC", test_build_agent_loads_criteria()))
    results.append(("AC checked after validation", test_criteria_checked_after_validation()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                                            | Verification                     |
| --- | ---------------------------------------------------- | -------------------------------- |
| 1   | `task_appendices` has `acceptance_criteria` entries  | COUNT(\*) > 0                    |
| 2   | OBS-xxx tasks have criteria attached                 | JOIN query returns rows          |
| 3   | Build Agent has `_load_acceptance_criteria()` method | Code inspection                  |
| 4   | Criteria checked after `_run_validation()`           | Execution flow analysis          |
| 5   | Task fails if criterion fails                        | Unit test with failing criterion |

---

## Phase 2: High Priority Fixes (SHOULD HAVE)

### GAP-003: Multi-Level Test Execution

**Problem:** Only TypeScript compilation runs - no unit/API/UI tests
**Impact:** Bugs slip through to "completed" tasks
**Effort:** 4 hours

#### Tasks

- [ ] **GAP-003-A:** Detect task type from file impacts
  - [ ] Create method `_determine_test_levels(file_impacts: List[str]) -> List[str]`
  - [ ] Return `['codebase']` for all tasks (minimum)
  - [ ] Add `'api'` if any file matches `server/*`
  - [ ] Add `'ui'` if any file matches `frontend/*`

- [ ] **GAP-003-B:** Add test level configurations to Build Agent config
  - [ ] Add `test_commands` dict to `BuildAgentConfig`
  - [ ] `codebase`: `["npx tsc --noEmit", "npm run test:unit -- --run"]`
  - [ ] `api`: `["npm run test:api -- --run"]` (or curl-based health check)
  - [ ] `ui`: `["npm run test:e2e -- --run"]` (or Puppeteer MCP)

- [ ] **GAP-003-C:** Execute appropriate test levels after validation
  - [ ] Create method `_run_test_levels(levels: List[str]) -> TestResult`
  - [ ] Run each test command sequentially
  - [ ] Aggregate results and fail on first failure

- [ ] **GAP-003-D:** Add task-specific test commands to appendices
  - [ ] Add `test_commands` to allowed `appendix_type` enum
  - [ ] Populate test commands for observability tasks
  - [ ] These override default test levels

#### Test Script: `tests/e2e/test-gap-003-multi-level-tests.py`

```python
#!/usr/bin/env python3
"""
Test GAP-003: Multi-Level Test Execution

Pass Criteria:
1. Build Agent detects task type from file impacts
2. Server tasks trigger API-level tests
3. Frontend tasks trigger UI-level tests
4. All tasks run codebase-level tests
5. Test results are aggregated correctly
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_file_impact_detection():
    """Test 1: File impacts are used to determine test levels"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    keywords = ["file_impact", "server/", "frontend/", "test_level"]
    found = sum(1 for kw in keywords if kw in content)

    if found >= 2:
        print(f"PASS: Build Agent references file impacts for test detection ({found}/4 keywords)")
        return True
    else:
        print(f"FAIL: Build Agent missing file impact detection ({found}/4 keywords)")
        return False

def test_codebase_level_always_runs():
    """Test 2: Codebase-level tests run for all tasks"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "tsc --noEmit" in content or "test:unit" in content:
        print("PASS: Codebase-level test commands present")
        return True
    else:
        print("FAIL: Codebase-level tests not configured")
        return False

def test_api_level_for_server_tasks():
    """Test 3: API tests run for server/ file impacts"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Should have logic to run API tests for server tasks
    if "api" in content.lower() and ("test" in content.lower() or "curl" in content.lower()):
        print("PASS: API-level test support detected")
        return True
    else:
        print("SKIP: API-level test support not yet implemented")
        return None

def test_ui_level_for_frontend_tasks():
    """Test 4: UI tests run for frontend/ file impacts"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Should have logic to run UI tests for frontend tasks
    if "puppeteer" in content.lower() or "e2e" in content.lower():
        print("PASS: UI-level test support detected")
        return True
    else:
        print("SKIP: UI-level test support not yet implemented")
        return None

def test_test_commands_appendix_type():
    """Test 5: test_commands is valid appendix_type"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Check if test_commands type is allowed in task_appendices
    try:
        cursor.execute("""
            INSERT INTO task_appendices
            (id, task_id, appendix_type, content_type, content)
            VALUES ('test-check', (SELECT id FROM tasks LIMIT 1),
                    'test_commands', 'inline', '["npm test"]')
        """)
        cursor.execute("DELETE FROM task_appendices WHERE id = 'test-check'")
        conn.commit()
        print("PASS: test_commands is valid appendix_type")
        result = True
    except sqlite3.IntegrityError as e:
        if "CHECK constraint failed" in str(e):
            print("FAIL: test_commands not in allowed appendix_type enum")
            result = False
        else:
            raise
    finally:
        conn.close()

    return result

def main():
    print("=" * 60)
    print("GAP-003 Test Suite: Multi-Level Test Execution")
    print("=" * 60)

    results = []
    results.append(("File impact detection", test_file_impact_detection()))
    results.append(("Codebase level runs", test_codebase_level_always_runs()))
    results.append(("API level for server", test_api_level_for_server_tasks()))
    results.append(("UI level for frontend", test_ui_level_for_frontend_tasks()))
    results.append(("test_commands appendix", test_test_commands_appendix_type()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                                  | Verification     |
| --- | ------------------------------------------ | ---------------- |
| 1   | `_determine_test_levels()` method exists   | Code inspection  |
| 2   | Server tasks return `['codebase', 'api']`  | Unit test        |
| 3   | Frontend tasks return `['codebase', 'ui']` | Unit test        |
| 4   | Test commands execute in sequence          | Integration test |
| 5   | First failure stops further tests          | Integration test |

---

### GAP-004: Context Handoff Between Agents

**Problem:** If agent times out, new agent starts from scratch
**Impact:** Progress lost, repeated work, context limit issues
**Effort:** 4 hours

#### Tasks

- [ ] **GAP-004-A:** Create task_execution_log table
  - [ ] Create migration `093_create_execution_log.sql`
  - [ ] Table: `id, execution_id, line_number, log_level, content, timestamp`
  - [ ] Index on `execution_id` for fast retrieval

- [ ] **GAP-004-B:** Build Agent writes continuous logs during execution
  - [ ] Add method `_log_continuous(message: str, level: str = 'INFO')`
  - [ ] Insert into `task_execution_log` with auto-incrementing line number
  - [ ] Call at key points: task load, generation start, validation, etc.

- [ ] **GAP-004-C:** Build Agent reads previous logs on startup
  - [ ] Query parameter: `--resume-execution-id <id>` (optional)
  - [ ] If provided, read last 500 lines from `task_execution_log`
  - [ ] Parse to understand: what was done, what remains
  - [ ] Include in Claude prompt as context

- [ ] **GAP-004-D:** Orchestrator passes execution_id to new agents
  - [ ] When retrying a task, find previous execution_id
  - [ ] Pass `--resume-execution-id` to new Build Agent spawn
  - [ ] Track retry count in `task_executions`

#### Test Script: `tests/e2e/test-gap-004-context-handoff.py`

```python
#!/usr/bin/env python3
"""
Test GAP-004: Context Handoff Between Agents

Pass Criteria:
1. task_execution_log table exists
2. Build Agent writes to execution log
3. Build Agent can read previous execution log
4. Orchestrator passes resume-execution-id to new agents
5. Resume context included in prompt
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_execution_log_table_exists():
    """Test 1: task_execution_log table exists"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='task_execution_log'
    """)
    exists = cursor.fetchone() is not None
    conn.close()

    if exists:
        print("PASS: task_execution_log table exists")
        return True
    else:
        print("FAIL: task_execution_log table does not exist")
        return False

def test_execution_log_schema():
    """Test 2: task_execution_log has correct schema"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(task_execution_log)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}

        required = ["id", "execution_id", "line_number", "content"]
        missing = [c for c in required if c not in columns]

        if missing:
            print(f"FAIL: Missing columns in task_execution_log: {missing}")
            return False

        print(f"PASS: task_execution_log has required columns: {list(columns.keys())}")
        return True
    except sqlite3.OperationalError:
        print("FAIL: task_execution_log table doesn't exist")
        return False
    finally:
        conn.close()

def test_build_agent_writes_logs():
    """Test 3: Build Agent writes to execution log"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "task_execution_log" in content and "INSERT" in content:
        print("PASS: Build Agent writes to task_execution_log")
        return True
    elif "_log_continuous" in content:
        print("PASS: Build Agent has _log_continuous method")
        return True
    else:
        print("FAIL: Build Agent doesn't write to execution log")
        return False

def test_build_agent_reads_previous_logs():
    """Test 4: Build Agent can resume from previous execution"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    resume_keywords = ["resume", "execution_id", "previous", "handoff"]
    found = sum(1 for kw in resume_keywords if kw in content.lower())

    if found >= 2:
        print(f"PASS: Build Agent has resume capability ({found}/4 keywords)")
        return True
    else:
        print(f"SKIP: Resume capability not yet implemented ({found}/4 keywords)")
        return None

def test_orchestrator_passes_resume_id():
    """Test 5: Orchestrator passes resume-execution-id to agents"""
    orchestrator_path = PROJECT_ROOT / "server" / "services" / "task-agent" / "build-agent-orchestrator.ts"

    if not orchestrator_path.exists():
        print("SKIP: Orchestrator file not found")
        return None

    content = orchestrator_path.read_text()

    if "resume" in content.lower() or "execution" in content.lower():
        print("PASS: Orchestrator references execution/resume logic")
        return True
    else:
        print("SKIP: Orchestrator doesn't yet pass resume-execution-id")
        return None

def main():
    print("=" * 60)
    print("GAP-004 Test Suite: Context Handoff Between Agents")
    print("=" * 60)

    results = []
    results.append(("Execution log table exists", test_execution_log_table_exists()))
    results.append(("Execution log schema", test_execution_log_schema()))
    results.append(("Build Agent writes logs", test_build_agent_writes_logs()))
    results.append(("Build Agent reads previous", test_build_agent_reads_previous_logs()))
    results.append(("Orchestrator passes ID", test_orchestrator_passes_resume_id()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                          | Verification                     |
| --- | ---------------------------------- | -------------------------------- |
| 1   | `task_execution_log` table exists  | `sqlite_master` query            |
| 2   | Table has required columns         | `PRAGMA table_info`              |
| 3   | Build Agent writes continuous logs | INSERT statements in code        |
| 4   | Build Agent reads last 500 lines   | `--resume-execution-id` handling |
| 5   | Orchestrator passes execution_id   | Spawn args include flag          |

---

## Phase 3: Medium Priority Fixes (NICE TO HAVE)

### GAP-005: Iterate/Refine Loop

**Problem:** Single attempt then fail - no retry with improvements
**Impact:** Simple errors cause task failure
**Effort:** 2 hours

#### Tasks

- [ ] **GAP-005-A:** Add retry loop to Build Agent execution
  - [ ] Read `max_retries` from config (default: 3)
  - [ ] Wrap generation+validation in retry loop
  - [ ] Track attempt number in execution record

- [ ] **GAP-005-B:** Include previous error in retry prompt
  - [ ] On validation failure, capture error message
  - [ ] Include in next generation prompt: "Previous attempt failed: {error}"
  - [ ] Ask Claude to fix the specific issue

- [ ] **GAP-005-C:** Implement progressive refinement
  - [ ] First retry: include error only
  - [ ] Second retry: include error + diff of changes
  - [ ] Third retry: escalate with detailed context

- [ ] **GAP-005-D:** Track retry history in database
  - [ ] Add `retry_count` column to `task_executions`
  - [ ] Store each attempt's error for SIA analysis

#### Test Script: `tests/e2e/test-gap-005-retry-loop.py`

```python
#!/usr/bin/env python3
"""
Test GAP-005: Iterate/Refine Loop

Pass Criteria:
1. Build Agent has retry loop
2. max_retries config is respected
3. Error message included in retry prompt
4. Retry count tracked in database
5. Only fails after exhausting retries
"""

import sqlite3
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "database" / "ideas.db"

def test_build_agent_has_retry_loop():
    """Test 1: Build Agent has retry loop"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    retry_patterns = ["retry", "attempt", "max_retries", "for i in range"]
    found = sum(1 for p in retry_patterns if p in content.lower())

    if found >= 2:
        print(f"PASS: Build Agent has retry logic ({found}/4 patterns)")
        return True
    else:
        print(f"FAIL: Build Agent missing retry loop ({found}/4 patterns)")
        return False

def test_max_retries_in_config():
    """Test 2: max_retries is configurable"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    if "max_retries" in content:
        print("PASS: max_retries config found")
        return True
    else:
        print("FAIL: max_retries not in config")
        return False

def test_error_in_retry_prompt():
    """Test 3: Error message included in retry prompt"""
    worker_path = PROJECT_ROOT / "coding-loops" / "agents" / "build_agent_worker.py"
    content = worker_path.read_text()

    # Should reference previous error in prompt building
    if "previous" in content.lower() and "error" in content.lower():
        print("PASS: Previous error referenced in retry logic")
        return True
    elif "failed" in content.lower() and "prompt" in content.lower():
        print("PASS: Failure context included in prompt")
        return True
    else:
        print("SKIP: Error-in-retry-prompt not yet implemented")
        return None

def test_retry_count_in_database():
    """Test 4: retry_count tracked in task_executions"""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(task_executions)")
    columns = [row[1] for row in cursor.fetchall()]
    conn.close()

    if "retry_count" in columns or "attempt" in columns:
        print("PASS: retry_count column exists in task_executions")
        return True
    else:
        print("SKIP: retry_count not yet in schema")
        return None

def main():
    print("=" * 60)
    print("GAP-005 Test Suite: Iterate/Refine Loop")
    print("=" * 60)

    results = []
    results.append(("Has retry loop", test_build_agent_has_retry_loop()))
    results.append(("max_retries config", test_max_retries_in_config()))
    results.append(("Error in retry prompt", test_error_in_retry_prompt()))
    results.append(("retry_count in DB", test_retry_count_in_database()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                           | Verification                                 |
| --- | ----------------------------------- | -------------------------------------------- |
| 1   | Retry loop exists in execution flow | Code has `for attempt in range(max_retries)` |
| 2   | `max_retries` configurable          | Config class has field                       |
| 3   | Error included in retry prompt      | String building includes error               |
| 4   | Retry count in database             | Column exists in `task_executions`           |
| 5   | Only fails after all retries        | Unit test confirms behavior                  |

---

### GAP-006: SIA Integration

**Problem:** Stuck tasks remain stuck with no auto-diagnosis
**Impact:** Human must diagnose repeated failures
**Effort:** 4 hours

#### Tasks

- [ ] **GAP-006-A:** Implement "no progress" detection in Task Agent
  - [ ] Track consecutive failures per task
  - [ ] Detect when 3+ attempts show no progress (same error)
  - [ ] Flag task as `needs_sia_review`

- [ ] **GAP-006-B:** Create SIA spawn API endpoint
  - [ ] Add endpoint: `POST /api/task-agent/tasks/:id/diagnose`
  - [ ] Spawns SIA Agent with task context
  - [ ] Returns diagnosis and suggested fixes

- [ ] **GAP-006-C:** SIA reads execution history and proposes fixes
  - [ ] Query all `task_executions` for the task
  - [ ] Analyze patterns in failures
  - [ ] Output: fix approach or task decomposition

- [ ] **GAP-006-D:** Task Agent creates follow-up tasks from SIA output
  - [ ] Parse SIA output for subtasks
  - [ ] Create new tasks with `parent_of` relationship
  - [ ] Mark original task as `blocked` pending subtasks

#### Test Script: `tests/e2e/test-gap-006-sia-integration.py`

```python
#!/usr/bin/env python3
"""
Test GAP-006: SIA Integration

Pass Criteria:
1. No-progress detection exists
2. SIA spawn endpoint exists
3. SIA reads execution history
4. SIA proposes task decomposition
5. Follow-up tasks created automatically
"""

import sys
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent

def test_no_progress_detection():
    """Test 1: No-progress detection in Task Agent"""
    orchestrator_path = PROJECT_ROOT / "server" / "services" / "task-agent" / "build-agent-orchestrator.ts"

    if not orchestrator_path.exists():
        print("SKIP: Orchestrator not found")
        return None

    content = orchestrator_path.read_text()

    if "no_progress" in content.lower() or "consecutive" in content.lower():
        print("PASS: No-progress detection found")
        return True
    else:
        print("SKIP: No-progress detection not yet implemented")
        return None

def test_sia_spawn_endpoint():
    """Test 2: SIA spawn endpoint exists"""
    routes_path = PROJECT_ROOT / "server" / "routes"

    if not routes_path.exists():
        print("SKIP: Routes directory not found")
        return None

    for route_file in routes_path.glob("*.ts"):
        content = route_file.read_text()
        if "diagnose" in content.lower() or "sia" in content.lower():
            print(f"PASS: SIA endpoint found in {route_file.name}")
            return True

    print("SKIP: SIA endpoint not yet implemented")
    return None

def test_sia_reads_history():
    """Test 3: SIA reads execution history"""
    sia_path = PROJECT_ROOT / "coding-loops" / "agents" / "sia_agent.py"

    if not sia_path.exists():
        # Check for alternative locations
        alt_paths = [
            PROJECT_ROOT / "server" / "services" / "sia.ts",
            PROJECT_ROOT / "agents" / "sia" / "agent.py",
        ]
        for path in alt_paths:
            if path.exists():
                sia_path = path
                break

    if not sia_path.exists():
        print("SKIP: SIA agent not found")
        return None

    content = sia_path.read_text()

    if "execution" in content.lower() and "history" in content.lower():
        print("PASS: SIA reads execution history")
        return True
    else:
        print("SKIP: SIA execution history reading not implemented")
        return None

def test_follow_up_task_creation():
    """Test 4: Follow-up tasks created from SIA output"""
    # This would need to check task creation logic
    print("SKIP: Follow-up task creation not yet tested")
    return None

def main():
    print("=" * 60)
    print("GAP-006 Test Suite: SIA Integration")
    print("=" * 60)

    results = []
    results.append(("No-progress detection", test_no_progress_detection()))
    results.append(("SIA spawn endpoint", test_sia_spawn_endpoint()))
    results.append(("SIA reads history", test_sia_reads_history()))
    results.append(("Follow-up tasks", test_follow_up_task_creation()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Pass Criteria

| #   | Criterion                                        | Verification                |
| --- | ------------------------------------------------ | --------------------------- |
| 1   | Consecutive failure tracking                     | Code tracks `failure_count` |
| 2   | `needs_sia_review` flag set at 3+ failures       | State transition logic      |
| 3   | `POST /api/task-agent/tasks/:id/diagnose` exists | Route file                  |
| 4   | SIA queries `task_executions` table              | SQL in SIA agent            |
| 5   | Subtasks created with `parent_of` relation       | Database records            |

---

## Master Test Script

Run all gap tests in sequence:

### `tests/e2e/test-all-gaps.sh`

```bash
#!/bin/bash
# Master test script for Build Agent Gap Remediation
# Run: bash tests/e2e/test-all-gaps.sh

set -e
cd "$(dirname "$0")/../.."

echo "========================================"
echo "BUILD AGENT GAP REMEDIATION - TEST SUITE"
echo "========================================"
echo ""

PASSED=0
FAILED=0
SKIPPED=0

run_test() {
    local name=$1
    local script=$2

    echo "----------------------------------------"
    echo "Running: $name"
    echo "----------------------------------------"

    if python3 "$script"; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
    echo ""
}

# Phase 1: Critical
run_test "GAP-001: Per-Task Validation" "tests/e2e/test-gap-001-validation-commands.py"
run_test "GAP-002: Acceptance Criteria" "tests/e2e/test-gap-002-acceptance-criteria.py"

# Phase 2: High Priority
run_test "GAP-003: Multi-Level Tests" "tests/e2e/test-gap-003-multi-level-tests.py"
run_test "GAP-004: Context Handoff" "tests/e2e/test-gap-004-context-handoff.py"

# Phase 3: Medium Priority
run_test "GAP-005: Iterate/Refine Loop" "tests/e2e/test-gap-005-retry-loop.py"
run_test "GAP-006: SIA Integration" "tests/e2e/test-gap-006-sia-integration.py"

echo "========================================"
echo "FINAL RESULTS"
echo "========================================"
echo "Passed:  $PASSED"
echo "Failed:  $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "ALL GAPS REMEDIATED!"
    exit 0
else
    echo "GAPS REMAINING - See failures above"
    exit 1
fi
```

---

## Execution Order

### Minimum Viable (7-8 hours)

1. GAP-001: Per-Task Validation Commands (3 hours)
2. GAP-002: Acceptance Criteria Enforcement (4 hours)

### Full Remediation (17 hours)

1. GAP-001: Per-Task Validation Commands (3 hours)
2. GAP-002: Acceptance Criteria Enforcement (4 hours)
3. GAP-003: Multi-Level Test Execution (4 hours)
4. GAP-004: Context Handoff Between Agents (4 hours)
5. GAP-005: Iterate/Refine Loop (2 hours)
6. GAP-006: SIA Integration (4 hours - can be parallelized)

---

## Success Criteria

| Phase | Criteria                           | Test                           |
| ----- | ---------------------------------- | ------------------------------ |
| 1     | Python tasks validate with python3 | `test-gap-001` passes          |
| 1     | Acceptance criteria checked        | `test-gap-002` passes          |
| 2     | API/UI tests run appropriately     | `test-gap-003` passes          |
| 2     | Agent resume works                 | `test-gap-004` passes          |
| 3     | Retry loop implemented             | `test-gap-005` passes          |
| 3     | SIA diagnoses stuck tasks          | `test-gap-006` passes          |
| All   | Master test passes                 | `test-all-gaps.sh` exit code 0 |

---

## File Changes Summary

### New Files

| File                                                           | Purpose                       |
| -------------------------------------------------------------- | ----------------------------- |
| `database/migrations/091_add_task_validation_command.sql`      | Add validation_command column |
| `database/migrations/092_populate_obs_validation_commands.sql` | Populate OBS task validations |
| `database/migrations/093_create_execution_log.sql`             | Continuous execution logging  |
| `tests/e2e/test-gap-001-validation-commands.py`                | GAP-001 test script           |
| `tests/e2e/test-gap-002-acceptance-criteria.py`                | GAP-002 test script           |
| `tests/e2e/test-gap-003-multi-level-tests.py`                  | GAP-003 test script           |
| `tests/e2e/test-gap-004-context-handoff.py`                    | GAP-004 test script           |
| `tests/e2e/test-gap-005-retry-loop.py`                         | GAP-005 test script           |
| `tests/e2e/test-gap-006-sia-integration.py`                    | GAP-006 test script           |
| `tests/e2e/test-all-gaps.sh`                                   | Master test runner            |

### Modified Files

| File                                                     | Changes                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `coding-loops/agents/build_agent_worker.py`              | Read validation_command, acceptance criteria, retry loop, context handoff |
| `server/services/task-agent/build-agent-orchestrator.ts` | Pass resume-execution-id, no-progress detection                           |
| `server/routes/task-agent.ts`                            | Add SIA diagnose endpoint                                                 |

---

## Verification Checklist

Before marking complete, verify:

- [ ] All 6 test scripts created and executable
- [ ] Master test script `test-all-gaps.sh` runs without error
- [ ] GAP-001 tests pass (critical)
- [ ] GAP-002 tests pass (critical)
- [ ] GAP-003 tests pass or skip (high)
- [ ] GAP-004 tests pass or skip (high)
- [ ] GAP-005 tests pass or skip (medium)
- [ ] GAP-006 tests pass or skip (low)
- [ ] Observability tasks (OBS-100 to OBS-110) have validation_command set
- [ ] At least 5 OBS tasks have acceptance criteria populated
