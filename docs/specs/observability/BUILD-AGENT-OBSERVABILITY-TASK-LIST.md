# Build Agent & Observability Integration Task List

> **Location:** `docs/specs/observability/BUILD-AGENT-OBSERVABILITY-TASK-LIST.md`
> **Created:** 2026-01-16
> **Status:** Ready for execution
> **Priority:** P0 (Critical)

---

## Master Progress Tracker

### Phase 1: Schema Verification

- [ ] **OBS-SCHEMA-001**: Verify Observability Schema Applied

### Phase 2: Python Producer Classes

- [ ] **OBS-PY-001**: Create TranscriptWriter Class
- [ ] **OBS-PY-002**: Create ToolUseLogger Class
- [ ] **OBS-PY-003**: Create AssertionRecorder Class
- [ ] **OBS-PY-004**: Create SkillTracer Class

### Phase 3: TypeScript Infrastructure

- [ ] **OBS-TS-001**: Create UnifiedEventEmitter
- [ ] **OBS-TS-002**: Create Execution Run Management

### Phase 4: Build Agent Worker Integration

- [ ] **OBS-BA-001**: Add Observability CLI Arguments
- [ ] **OBS-BA-002**: Initialize Observability Producers
- [ ] **OBS-BA-003**: Replace \_log_event with TranscriptWriter
- [ ] **OBS-BA-004**: Add Assertion Recording for Validation

### Phase 5: Orchestrator Integration

- [ ] **OBS-OR-001**: Create Execution Run on Start
- [ ] **OBS-OR-002**: Pass Execution Context to Agents
- [ ] **OBS-OR-003**: Emit Wave Lifecycle Events

### Phase 6: Testing & Validation

- [ ] **OBS-TEST-001**: Schema Validation Tests
- [ ] **OBS-TEST-002**: Producer Unit Tests
- [ ] **OBS-TEST-003**: E2E Integration Test

**Progress: 0/17 tasks complete**

---

## Executive Summary

This task list addresses the **complete disconnect** between the Build Agent and Observability System identified in the deep dive analysis. The Build Agent currently writes to legacy `task_executions` table instead of the observability tables (`transcript_entries`, `tool_uses`, `assertion_results`).

### Gap Summary

| Component               | Current State              | Target State                   |
| ----------------------- | -------------------------- | ------------------------------ |
| Python Producer Classes | ❌ NOT FOUND               | ✅ 4 classes implemented       |
| Build Agent Worker      | ❌ Uses `task_executions`  | ✅ Uses observability tables   |
| Orchestrator            | ❌ No execution_id/wave_id | ✅ Passes execution context    |
| TypeScript Emitter      | ❌ NOT FOUND               | ✅ UnifiedEventEmitter created |
| Observability Tables    | ✅ Exist (empty)           | ✅ Populated with data         |

---

## Phase 1: Schema Verification

### OBS-SCHEMA-001: Verify Observability Schema Applied

| Field            | Value               |
| ---------------- | ------------------- |
| **ID**           | OBS-SCHEMA-001      |
| **Phase**        | database            |
| **Action**       | VERIFY              |
| **File**         | `database/ideas.db` |
| **Status**       | pending             |
| **Dependencies** | None                |

#### Acceptance Criteria

- [ ] Migration 087_observability_schema.sql has been applied
- [ ] Migration 088_parallel_execution_observability.sql has been applied
- [ ] All 8 tables exist: `transcript_entries`, `tool_uses`, `skill_traces`, `assertion_results`, `assertion_chains`, `message_bus_log`, `wave_statistics`, `concurrent_execution_sessions`
- [ ] All required indexes exist (37+)
- [ ] Views `v_wave_progress` and `v_active_agents` exist
- [ ] Trigger `tr_event_to_log` exists

#### Test Validation

| Test ID | Test Description | Command                                                                                                                                                                                                         | Expected Result | Pass |
| ------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---- |
| T1.1    | Tables exist     | `sqlite3 database/ideas.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('transcript_entries', 'tool_uses', 'skill_traces', 'assertion_results', 'assertion_chains', 'wave_statistics')"` | `6`             | ☐    |
| T1.2    | Indexes exist    | `sqlite3 database/ideas.db "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"`                                                                                                       | `≥ 37`          | ☐    |
| T1.3    | Views exist      | `sqlite3 database/ideas.db "SELECT COUNT(*) FROM sqlite_master WHERE type='view' AND name IN ('v_wave_progress', 'v_active_agents')"`                                                                           | `2`             | ☐    |
| T1.4    | Trigger exists   | `sqlite3 database/ideas.db "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name='tr_event_to_log'"`                                                                                                | `1`             | ☐    |

#### Pass Criteria

✅ **PASS**: All 4 tests return expected values
❌ **FAIL**: Any test returns unexpected value - run `npm run migrate` and retry

#### Gotchas

- If tables don't exist, run: `npm run migrate`
- SQLite requires `PRAGMA foreign_keys = ON` for FK enforcement

---

## Phase 2: Python Producer Classes

### OBS-PY-001: Create TranscriptWriter Class

| Field            | Value                                      |
| ---------------- | ------------------------------------------ |
| **ID**           | OBS-PY-001                                 |
| **Phase**        | types                                      |
| **Action**       | CREATE                                     |
| **File**         | `coding-loops/shared/transcript_writer.py` |
| **Status**       | pending                                    |
| **Dependencies** | OBS-SCHEMA-001                             |

#### Acceptance Criteria

- [ ] File `coding-loops/shared/transcript_writer.py` exists
- [ ] Class `TranscriptWriter` is defined with `__init__`, `write`, `flush`, `close`, `get_sequence` methods
- [ ] Dual output: writes to JSONL file AND SQLite database
- [ ] Sequence numbers are monotonically increasing per execution_id
- [ ] Thread-safe implementation using `threading.Lock`
- [ ] Supports all entry_types: phase_start, phase_end, task_start, task_end, tool_use, assertion, discovery, error, checkpoint, lock_acquire, lock_release
- [ ] Supports event-agnostic source field: agent, telegram, script, webhook, user, system, ideation, custom
- [ ] JSONL file created at `coding-loops/transcripts/{execution_id}/unified.jsonl`

#### Test Validation

| Test ID | Test Description    | Command                                                                                                                                                                                                                                                                                                                                                                                                                                               | Expected Result | Pass |
| ------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---- |
| T2.1    | File exists         | `test -f coding-loops/shared/transcript_writer.py && echo "exists"`                                                                                                                                                                                                                                                                                                                                                                                   | `exists`        | ☐    |
| T2.2    | Class imports       | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; print('OK')"`                                                                                                                                                                                                                                                                                                                                                        | `OK`            | ☐    |
| T2.3    | Write entry         | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; tw = TranscriptWriter('test-exec-001', 'test-inst'); eid = tw.write({'entry_type': 'phase_start', 'category': 'lifecycle', 'summary': 'test'}); tw.close(); print(len(eid) == 36)"`                                                                                                                                                                                  | `True`          | ☐    |
| T2.4    | Sequence increments | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; tw = TranscriptWriter('test-exec-002', 'test-inst'); tw.write({'entry_type': 'phase_start', 'category': 'lifecycle', 'summary': 'a'}); tw.write({'entry_type': 'phase_end', 'category': 'lifecycle', 'summary': 'b'}); print(tw.get_sequence() == 2); tw.close()"`                                                                                                   | `True`          | ☐    |
| T2.5    | DB insert           | `python3 -c "import sqlite3; from coding_loops.shared.transcript_writer import TranscriptWriter; tw = TranscriptWriter('test-exec-003', 'test-inst'); tw.write({'entry_type': 'phase_start', 'category': 'lifecycle', 'summary': 'test'}); tw.flush(); tw.close(); conn = sqlite3.connect('database/ideas.db'); c = conn.execute('SELECT COUNT(*) FROM transcript_entries WHERE execution_id = ?', ('test-exec-003',)); print(c.fetchone()[0] >= 1)"` | `True`          | ☐    |
| T2.6    | JSONL created       | `python3 -c "from pathlib import Path; from coding_loops.shared.transcript_writer import TranscriptWriter; tw = TranscriptWriter('test-exec-004', 'test-inst'); tw.write({'entry_type': 'phase_start', 'category': 'lifecycle', 'summary': 'test'}); tw.flush(); tw.close(); print(Path('coding-loops/transcripts/test-exec-004/unified.jsonl').exists())"`                                                                                           | `True`          | ☐    |

#### Pass Criteria

✅ **PASS**: All 6 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Use TEXT for timestamps, not DATETIME (SQLite convention)
- Use `threading.local()` for thread-local connections
- Sequence must reset to 1 for each new execution_id
- Handle concurrent access with Lock for sequence increment

---

### OBS-PY-002: Create ToolUseLogger Class

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| **ID**           | OBS-PY-002                               |
| **Phase**        | types                                    |
| **Action**       | CREATE                                   |
| **File**         | `coding-loops/shared/tool_use_logger.py` |
| **Status**       | pending                                  |
| **Dependencies** | OBS-PY-001                               |

#### Acceptance Criteria

- [ ] File `coding-loops/shared/tool_use_logger.py` exists
- [ ] Class `ToolUseLogger` is defined with `log_start`, `log_end`, `log_blocked` methods
- [ ] Tracks tool invocations with start/end timing
- [ ] Calculates `duration_ms` automatically
- [ ] Supports all tool categories: file_read, file_write, shell, browser, network, agent, custom
- [ ] Records blocked commands with reason
- [ ] Links to transcript entries via `transcript_entry_id`
- [ ] Stores input/output with summaries (truncated to 500 chars)

#### Test Validation

| Test ID | Test Description     | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Expected Result | Pass |
| ------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---- |
| T3.1    | File exists          | `test -f coding-loops/shared/tool_use_logger.py && echo "exists"`                                                                                                                                                                                                                                                                                                                                                                                                                                        | `exists`        | ☐    |
| T3.2    | Class imports        | `python3 -c "from coding_loops.shared.tool_use_logger import ToolUseLogger; print('OK')"`                                                                                                                                                                                                                                                                                                                                                                                                                | `OK`            | ☐    |
| T3.3    | Log start returns ID | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.tool_use_logger import ToolUseLogger; tw = TranscriptWriter('test-tool-001', 'inst'); tl = ToolUseLogger(tw); class Mock: name='Read'; input={'path': '/test'}; tid = tl.log_start(Mock()); print(len(tid) == 36); tw.close()"`                                                                                                                                                                | `True`          | ☐    |
| T3.4    | Duration calculated  | `python3 -c "import time; from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.tool_use_logger import ToolUseLogger; tw = TranscriptWriter('test-tool-002', 'inst'); tl = ToolUseLogger(tw); class Mock: name='Read'; input={}; class Res: content='ok'; is_error=False; tid = tl.log_start(Mock()); time.sleep(0.1); tl.log_end(tid, Res()); tw.close(); print('OK')"`                                                                                          | `OK`            | ☐    |
| T3.5    | Blocked recorded     | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.tool_use_logger import ToolUseLogger; tw = TranscriptWriter('test-tool-003', 'inst'); tl = ToolUseLogger(tw); class Mock: name='Bash'; input={'command': 'rm -rf /'}; tid = tl.log_start(Mock()); tl.log_blocked(tid, 'Dangerous command'); tw.close(); print('OK')"`                                                                                                                          | `OK`            | ☐    |
| T3.6    | DB insert            | `python3 -c "import sqlite3; from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.tool_use_logger import ToolUseLogger; tw = TranscriptWriter('test-tool-004', 'inst'); tl = ToolUseLogger(tw); class Mock: name='Read'; input={}; tid = tl.log_start(Mock()); tw.flush(); tw.close(); conn = sqlite3.connect('database/ideas.db'); c = conn.execute('SELECT COUNT(*) FROM tool_uses WHERE execution_id = ?', ('test-tool-004',)); print(c.fetchone()[0] >= 1)"` | `True`          | ☐    |

#### Pass Criteria

✅ **PASS**: All 6 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Truncate `input_summary` and `output_summary` to 500 chars max
- Store full input/output in JSON column for debugging
- Handle `is_error` boolean correctly (SQLite uses 0/1)
- Calculate `duration_ms` using `time.time()` for millisecond precision

---

### OBS-PY-003: Create AssertionRecorder Class

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| **ID**           | OBS-PY-003                                  |
| **Phase**        | types                                       |
| **Action**       | CREATE                                      |
| **File**         | `coding-loops/shared/assertion_recorder.py` |
| **Status**       | pending                                     |
| **Dependencies** | OBS-PY-001                                  |

#### Acceptance Criteria

- [ ] File `coding-loops/shared/assertion_recorder.py` exists
- [ ] Class `AssertionRecorder` is defined with `start_chain`, `end_chain`, and assertion methods
- [ ] Supports assertion chains that group related assertions
- [ ] Tracks pass/fail counts per chain
- [ ] Records `first_failure_id` when first failure occurs
- [ ] Computes `overall_result`: pass (all pass), fail (any fail), skip (none run)
- [ ] Built-in assertions: `assert_file_created`, `assert_file_modified`, `assert_file_deleted`, `assert_typescript_compiles`, `assert_lint_passes`, `assert_tests_pass`, `assert_custom`
- [ ] Stores evidence JSON with command output, exit codes, file info
- [ ] Writes transcript entry for each assertion

#### Test Validation

| Test ID | Test Description    | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Expected Result | Pass |
| ------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---- |
| T4.1    | File exists         | `test -f coding-loops/shared/assertion_recorder.py && echo "exists"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `exists`        | ☐    |
| T4.2    | Class imports       | `python3 -c "from coding_loops.shared.assertion_recorder import AssertionRecorder; print('OK')"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `OK`            | ☐    |
| T4.3    | Start chain         | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.assertion_recorder import AssertionRecorder; tw = TranscriptWriter('test-assert-001', 'inst'); ar = AssertionRecorder(tw, 'test-assert-001'); cid = ar.start_chain('task-1', 'Test chain'); print(len(cid) == 36); tw.close()"`                                                                                                                                                                                                                                                | `True`          | ☐    |
| T4.4    | File assertion pass | `python3 -c "import tempfile; from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.assertion_recorder import AssertionRecorder; tw = TranscriptWriter('test-assert-002', 'inst'); ar = AssertionRecorder(tw, 'test-assert-002'); f = tempfile.NamedTemporaryFile(delete=False); f.close(); ar.start_chain('task-1', 'Test'); ar.assert_file_created('task-1', f.name); result = ar.end_chain(ar._current_chain_id); print(result.overall_result == 'pass'); tw.close()"`                                                                         | `True`          | ☐    |
| T4.5    | File assertion fail | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.assertion_recorder import AssertionRecorder; tw = TranscriptWriter('test-assert-003', 'inst'); ar = AssertionRecorder(tw, 'test-assert-003'); ar.start_chain('task-1', 'Test'); ar.assert_file_created('task-1', '/nonexistent/file.txt'); result = ar.end_chain(ar._current_chain_id); print(result.overall_result == 'fail'); tw.close()"`                                                                                                                                   | `True`          | ☐    |
| T4.6    | Chain counts        | `python3 -c "import tempfile; from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.assertion_recorder import AssertionRecorder; tw = TranscriptWriter('test-assert-004', 'inst'); ar = AssertionRecorder(tw, 'test-assert-004'); f = tempfile.NamedTemporaryFile(delete=False); f.close(); cid = ar.start_chain('task-1', 'Test'); ar.assert_file_created('task-1', f.name); ar.assert_file_created('task-1', '/nonexistent'); result = ar.end_chain(cid); print(result.pass_count == 1 and result.fail_count == 1); tw.close()"`                | `True`          | ☐    |
| T4.7    | DB insert           | `python3 -c "import sqlite3; from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.assertion_recorder import AssertionRecorder; tw = TranscriptWriter('test-assert-005', 'inst'); ar = AssertionRecorder(tw, 'test-assert-005'); cid = ar.start_chain('task-1', 'Test'); ar.assert_file_created('task-1', '/test'); ar.end_chain(cid); tw.flush(); tw.close(); conn = sqlite3.connect('database/ideas.db'); c = conn.execute('SELECT COUNT(*) FROM assertion_chains WHERE execution_id = ?', ('test-assert-005',)); print(c.fetchone()[0] >= 1)"` | `True`          | ☐    |

#### Pass Criteria

✅ **PASS**: All 7 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Evidence should capture full command output for debugging
- File existence checks use `os.path.exists()`
- TypeScript compilation uses `npx tsc --noEmit`
- `overall_result` is 'fail' if ANY assertion fails
- Handle `subprocess.TimeoutExpired` for long-running validations

---

### OBS-PY-004: Create SkillTracer Class

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| **ID**           | OBS-PY-004                            |
| **Phase**        | types                                 |
| **Action**       | CREATE                                |
| **File**         | `coding-loops/shared/skill_tracer.py` |
| **Status**       | pending                               |
| **Dependencies** | OBS-PY-001, OBS-PY-002                |

#### Acceptance Criteria

- [ ] File `coding-loops/shared/skill_tracer.py` exists
- [ ] Class `SkillTracer` is defined with `trace_start`, `trace_end`, `add_tool_call` methods
- [ ] `SkillReference` dataclass is defined with `skill_name`, `skill_file`, `line_number`, `section_title`
- [ ] Tracks skill invocations with file:line references
- [ ] Links tool calls to skill traces via `within_skill` field
- [ ] Records `tool_calls` as JSON array in `skill_traces` table
- [ ] Writes transcript entries for `skill_invoke` and `skill_complete`
- [ ] Supports status: success, partial, failed

#### Test Validation

| Test ID | Test Description | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Expected Result | Pass |
| ------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---- |
| T5.1    | File exists      | `test -f coding-loops/shared/skill_tracer.py && echo "exists"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `exists`        | ☐    |
| T5.2    | Class imports    | `python3 -c "from coding_loops.shared.skill_tracer import SkillTracer, SkillReference; print('OK')"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `OK`            | ☐    |
| T5.3    | Trace start      | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.tool_use_logger import ToolUseLogger; from coding_loops.shared.skill_tracer import SkillTracer, SkillReference; tw = TranscriptWriter('test-skill-001', 'inst'); tl = ToolUseLogger(tw); st = SkillTracer(tw, tl); tid = st.trace_start(SkillReference('test', 'test.md', 1, 'Test')); print(len(tid) == 36); tw.close()"`                                                                                                                                                                                                                 | `True`          | ☐    |
| T5.4    | Trace end        | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.tool_use_logger import ToolUseLogger; from coding_loops.shared.skill_tracer import SkillTracer, SkillReference; tw = TranscriptWriter('test-skill-002', 'inst'); tl = ToolUseLogger(tw); st = SkillTracer(tw, tl); tid = st.trace_start(SkillReference('test', 'test.md', 1, 'Test')); st.trace_end(tid, 'success'); print('OK'); tw.close()"`                                                                                                                                                                                             | `OK`            | ☐    |
| T5.5    | Add tool call    | `python3 -c "from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.tool_use_logger import ToolUseLogger; from coding_loops.shared.skill_tracer import SkillTracer, SkillReference; tw = TranscriptWriter('test-skill-003', 'inst'); tl = ToolUseLogger(tw); st = SkillTracer(tw, tl); class Mock: name='Read'; input={}; tid = st.trace_start(SkillReference('test', 'test.md', 1, 'Test')); tool_id = tl.log_start(Mock()); st.add_tool_call(tid, tool_id); st.trace_end(tid, 'success'); print('OK'); tw.close()"`                                                                                          | `OK`            | ☐    |
| T5.6    | DB insert        | `python3 -c "import sqlite3; from coding_loops.shared.transcript_writer import TranscriptWriter; from coding_loops.shared.tool_use_logger import ToolUseLogger; from coding_loops.shared.skill_tracer import SkillTracer, SkillReference; tw = TranscriptWriter('test-skill-004', 'inst'); tl = ToolUseLogger(tw); st = SkillTracer(tw, tl); tid = st.trace_start(SkillReference('test', 'test.md', 1, 'Test')); st.trace_end(tid, 'success'); tw.flush(); tw.close(); conn = sqlite3.connect('database/ideas.db'); c = conn.execute('SELECT COUNT(*) FROM skill_traces WHERE execution_id = ?', ('test-skill-004',)); print(c.fetchone()[0] >= 1)"` | `True`          | ☐    |

#### Pass Criteria

✅ **PASS**: All 6 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Update `tool_uses.within_skill` when linking tool calls
- Store `tool_calls` as JSON array of tool_use IDs
- Calculate `duration_ms` from trace_start to trace_end

---

## Phase 3: TypeScript Infrastructure

### OBS-TS-001: Create UnifiedEventEmitter

| Field            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| **ID**           | OBS-TS-001                                               |
| **Phase**        | api                                                      |
| **Action**       | CREATE                                                   |
| **File**         | `server/services/observability/unified-event-emitter.ts` |
| **Status**       | pending                                                  |
| **Dependencies** | OBS-SCHEMA-001                                           |

#### Acceptance Criteria

- [ ] Directory `server/services/observability/` exists
- [ ] File `server/services/observability/unified-event-emitter.ts` exists
- [ ] Class `UnifiedEventEmitter` is defined with `emit` method
- [ ] Supports all event sources: agent, telegram, script, webhook, user, system, ideation, custom
- [ ] Maintains sequence numbers per execution (for agent events)
- [ ] Inserts into `transcript_entries` table with all context fields
- [ ] Exports singleton `eventEmitter` instance

#### Test Validation

| Test ID | Test Description    | Command                                                                                             | Expected Result | Pass |
| ------- | ------------------- | --------------------------------------------------------------------------------------------------- | --------------- | ---- |
| T6.1    | Directory exists    | `test -d server/services/observability && echo "exists"`                                            | `exists`        | ☐    |
| T6.2    | File exists         | `test -f server/services/observability/unified-event-emitter.ts && echo "exists"`                   | `exists`        | ☐    |
| T6.3    | TypeScript compiles | `npx tsc --noEmit server/services/observability/unified-event-emitter.ts 2>&1 && echo "OK"`         | Contains `OK`   | ☐    |
| T6.4    | Class exported      | `grep -c "export class UnifiedEventEmitter" server/services/observability/unified-event-emitter.ts` | `≥ 1`           | ☐    |
| T6.5    | Singleton exported  | `grep -c "export const eventEmitter" server/services/observability/unified-event-emitter.ts`        | `≥ 1`           | ☐    |
| T6.6    | Emit method defined | `grep -c "emit(" server/services/observability/unified-event-emitter.ts`                            | `≥ 1`           | ☐    |

#### Pass Criteria

✅ **PASS**: All 6 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Create directory first: `mkdir -p server/services/observability/`
- Use better-sqlite3 synchronous API (not sql.js)
- Handle null context fields correctly
- TypeScript strict mode requires explicit null checks

---

### OBS-TS-002: Create Execution Run Management

| Field            | Value                                                |
| ---------------- | ---------------------------------------------------- |
| **ID**           | OBS-TS-002                                           |
| **Phase**        | api                                                  |
| **Action**       | CREATE                                               |
| **File**         | `server/services/observability/execution-manager.ts` |
| **Status**       | pending                                              |
| **Dependencies** | OBS-TS-001                                           |

#### Acceptance Criteria

- [ ] File `server/services/observability/execution-manager.ts` exists
- [ ] Function `createExecutionRun(taskListId)` is exported
- [ ] Function `completeExecutionRun(executionId, status)` is exported
- [ ] Inserts record into `task_list_execution_runs` table
- [ ] Generates UUID for `execution_id`
- [ ] Tracks status: pending, running, completed, failed
- [ ] Uses ISO timestamp format for `started_at`, `completed_at`

#### Test Validation

| Test ID | Test Description              | Command                                                                                     | Expected Result | Pass |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------- | --------------- | ---- |
| T7.1    | File exists                   | `test -f server/services/observability/execution-manager.ts && echo "exists"`               | `exists`        | ☐    |
| T7.2    | TypeScript compiles           | `npx tsc --noEmit server/services/observability/execution-manager.ts 2>&1 && echo "OK"`     | Contains `OK`   | ☐    |
| T7.3    | createExecutionRun exported   | `grep -c "export.*createExecutionRun" server/services/observability/execution-manager.ts`   | `≥ 1`           | ☐    |
| T7.4    | completeExecutionRun exported | `grep -c "export.*completeExecutionRun" server/services/observability/execution-manager.ts` | `≥ 1`           | ☐    |
| T7.5    | Uses task_list_execution_runs | `grep -c "task_list_execution_runs" server/services/observability/execution-manager.ts`     | `≥ 1`           | ☐    |

#### Pass Criteria

✅ **PASS**: All 5 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- `task_list_execution_runs` must exist from earlier migrations
- Use ISO timestamp format for `started_at`, `completed_at`

---

## Phase 4: Build Agent Worker Integration

### OBS-BA-001: Add Observability CLI Arguments

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| **ID**           | OBS-BA-001                                  |
| **Phase**        | api                                         |
| **Action**       | UPDATE                                      |
| **File**         | `coding-loops/agents/build_agent_worker.py` |
| **Status**       | pending                                     |
| **Dependencies** | OBS-PY-001, OBS-PY-002, OBS-PY-003          |

#### Acceptance Criteria

- [ ] `--execution-id` CLI argument added (required for observability)
- [ ] `--wave-id` CLI argument added (optional)
- [ ] `--wave-number` CLI argument added (optional, integer)
- [ ] Arguments visible in `--help` output
- [ ] Arguments stored in worker configuration

#### Test Validation

| Test ID | Test Description        | Command                                                                                   | Expected Result | Pass |
| ------- | ----------------------- | ----------------------------------------------------------------------------------------- | --------------- | ---- |
| T8.1    | Help shows execution-id | `python3 coding-loops/agents/build_agent_worker.py --help 2>&1 \| grep -c "execution-id"` | `≥ 1`           | ☐    |
| T8.2    | Help shows wave-id      | `python3 coding-loops/agents/build_agent_worker.py --help 2>&1 \| grep -c "wave-id"`      | `≥ 1`           | ☐    |
| T8.3    | Help shows wave-number  | `python3 coding-loops/agents/build_agent_worker.py --help 2>&1 \| grep -c "wave-number"`  | `≥ 1`           | ☐    |
| T8.4    | Args in argparse        | `grep -c "add_argument.*--execution-id" coding-loops/agents/build_agent_worker.py`        | `≥ 1`           | ☐    |

#### Pass Criteria

✅ **PASS**: All 4 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Use `argparse.add_argument` with appropriate flags
- `wave_id` and `wave_number` are optional (single-task execution may not have them)

---

### OBS-BA-002: Initialize Observability Producers

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| **ID**           | OBS-BA-002                                  |
| **Phase**        | api                                         |
| **Action**       | UPDATE                                      |
| **File**         | `coding-loops/agents/build_agent_worker.py` |
| **Status**       | pending                                     |
| **Dependencies** | OBS-BA-001                                  |

#### Acceptance Criteria

- [ ] Import statements for `TranscriptWriter`, `ToolUseLogger`, `AssertionRecorder` added
- [ ] Observability producers initialized in `BuildAgentWorker.__init__()` with `execution_id` and `wave_id`
- [ ] Stored as instance attributes: `self.transcript`, `self.tool_logger`, `self.assertions`
- [ ] `self.transcript.close()` called in finally block of main execution
- [ ] Graceful fallback when observability not available (OBSERVABILITY_AVAILABLE flag)

#### Test Validation

| Test ID | Test Description         | Command                                                                                                 | Expected Result | Pass |
| ------- | ------------------------ | ------------------------------------------------------------------------------------------------------- | --------------- | ---- |
| T9.1    | Import TranscriptWriter  | `grep -c "from.*transcript_writer import TranscriptWriter" coding-loops/agents/build_agent_worker.py`   | `≥ 1`           | ☐    |
| T9.2    | Import ToolUseLogger     | `grep -c "from.*tool_use_logger import ToolUseLogger" coding-loops/agents/build_agent_worker.py`        | `≥ 1`           | ☐    |
| T9.3    | Import AssertionRecorder | `grep -c "from.*assertion_recorder import AssertionRecorder" coding-loops/agents/build_agent_worker.py` | `≥ 1`           | ☐    |
| T9.4    | self.transcript assigned | `grep -c "self.transcript" coding-loops/agents/build_agent_worker.py`                                   | `≥ 2`           | ☐    |
| T9.5    | Fallback flag exists     | `grep -c "OBSERVABILITY_AVAILABLE" coding-loops/agents/build_agent_worker.py`                           | `≥ 1`           | ☐    |

#### Pass Criteria

✅ **PASS**: All 5 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Use relative import or `sys.path` manipulation for imports
- Handle import errors gracefully for backwards compatibility

---

### OBS-BA-003: Replace \_log_event with TranscriptWriter

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| **ID**           | OBS-BA-003                                  |
| **Phase**        | api                                         |
| **Action**       | UPDATE                                      |
| **File**         | `coding-loops/agents/build_agent_worker.py` |
| **Status**       | pending                                     |
| **Dependencies** | OBS-BA-002                                  |

#### Acceptance Criteria

- [ ] New method `_log_event_obs()` or similar that uses `self.transcript.write()`
- [ ] Map existing event types to TranscriptEntryType enum
- [ ] Add `phase_start`/`phase_end` events at execution boundaries
- [ ] Add `task_start`/`task_end` events around task execution
- [ ] Preserve backwards compatibility: keep `_log_event` as fallback when observability not available
- [ ] At least 10 calls to `self.transcript.write()` throughout the code

#### Test Validation

| Test ID | Test Description             | Command                                                                     | Expected Result | Pass |
| ------- | ---------------------------- | --------------------------------------------------------------------------- | --------------- | ---- |
| T10.1   | transcript.write calls       | `grep -c "self.transcript.write" coding-loops/agents/build_agent_worker.py` | `≥ 10`          | ☐    |
| T10.2   | phase_start used             | `grep -c "phase_start" coding-loops/agents/build_agent_worker.py`           | `≥ 1`           | ☐    |
| T10.3   | task_start used              | `grep -c "task_start" coding-loops/agents/build_agent_worker.py`            | `≥ 1`           | ☐    |
| T10.4   | task_end used                | `grep -c "task_end" coding-loops/agents/build_agent_worker.py`              | `≥ 1`           | ☐    |
| T10.5   | Legacy \_log_event preserved | `grep -c "def _log_event" coding-loops/agents/build_agent_worker.py`        | `≥ 1`           | ☐    |

#### Pass Criteria

✅ **PASS**: All 5 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Check `self.transcript is not None` before writing
- Keep `_log_event` for backwards compatibility when observability not available
- Map: task_started → task_start, task_completed → task_end, task_failed → error

---

### OBS-BA-004: Add Assertion Recording for Validation

| Field            | Value                                       |
| ---------------- | ------------------------------------------- |
| **ID**           | OBS-BA-004                                  |
| **Phase**        | api                                         |
| **Action**       | UPDATE                                      |
| **File**         | `coding-loops/agents/build_agent_worker.py` |
| **Status**       | pending                                     |
| **Dependencies** | OBS-BA-003                                  |

#### Acceptance Criteria

- [ ] Assertion chain started before validation
- [ ] `AssertionRecorder` used for file_created/modified checks
- [ ] `AssertionRecorder` used for TypeScript compilation check
- [ ] Assertion chain ended and overall result checked
- [ ] At least 5 references to `self.assertions` in the code
- [ ] Task validation result derived from assertion chain result

#### Test Validation

| Test ID | Test Description           | Command                                                                                         | Expected Result | Pass |
| ------- | -------------------------- | ----------------------------------------------------------------------------------------------- | --------------- | ---- |
| T11.1   | self.assertions calls      | `grep -c "self.assertions" coding-loops/agents/build_agent_worker.py`                           | `≥ 5`           | ☐    |
| T11.2   | start_chain called         | `grep -c "start_chain" coding-loops/agents/build_agent_worker.py`                               | `≥ 1`           | ☐    |
| T11.3   | end_chain called           | `grep -c "end_chain" coding-loops/agents/build_agent_worker.py`                                 | `≥ 1`           | ☐    |
| T11.4   | assert_file_created        | `grep -c "assert_file_created\|assert_file_modified" coding-loops/agents/build_agent_worker.py` | `≥ 1`           | ☐    |
| T11.5   | assert_typescript_compiles | `grep -c "assert_typescript_compiles" coding-loops/agents/build_agent_worker.py`                | `≥ 1`           | ☐    |

#### Pass Criteria

✅ **PASS**: All 5 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Start chain BEFORE running validations
- End chain AFTER all validations complete
- Check `overall_result` to determine task success/failure

---

## Phase 5: Orchestrator Integration

### OBS-OR-001: Create Execution Run on Start

| Field            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| **ID**           | OBS-OR-001                                               |
| **Phase**        | api                                                      |
| **Action**       | UPDATE                                                   |
| **File**         | `server/services/task-agent/build-agent-orchestrator.ts` |
| **Status**       | pending                                                  |
| **Dependencies** | OBS-TS-002                                               |

#### Acceptance Criteria

- [ ] Import `createExecutionRun` from execution-manager
- [ ] Import `completeExecutionRun` from execution-manager
- [ ] Call `createExecutionRun(taskListId)` at start of `startExecution()`
- [ ] Store `execution_id` in execution context (Map or similar)
- [ ] Call `completeExecutionRun()` when all waves complete

#### Test Validation

| Test ID | Test Description            | Command                                                                                     | Expected Result | Pass |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------- | --------------- | ---- |
| T12.1   | Import createExecutionRun   | `grep -c "createExecutionRun" server/services/task-agent/build-agent-orchestrator.ts`       | `≥ 2`           | ☐    |
| T12.2   | Import completeExecutionRun | `grep -c "completeExecutionRun" server/services/task-agent/build-agent-orchestrator.ts`     | `≥ 2`           | ☐    |
| T12.3   | execution-manager imported  | `grep -c "from.*execution-manager" server/services/task-agent/build-agent-orchestrator.ts`  | `≥ 1`           | ☐    |
| T12.4   | TypeScript compiles         | `npx tsc --noEmit server/services/task-agent/build-agent-orchestrator.ts 2>&1 && echo "OK"` | Contains `OK`   | ☐    |

#### Pass Criteria

✅ **PASS**: All 4 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- `execution_id` must be generated BEFORE spawning any agents
- Store in module-level or class-level map for retrieval

---

### OBS-OR-002: Pass Execution Context to Agents

| Field            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| **ID**           | OBS-OR-002                                               |
| **Phase**        | api                                                      |
| **Action**       | UPDATE                                                   |
| **File**         | `server/services/task-agent/build-agent-orchestrator.ts` |
| **Status**       | pending                                                  |
| **Dependencies** | OBS-OR-001                                               |

#### Acceptance Criteria

- [ ] `spawnBuildAgent()` modified to accept `executionId` and `waveId` parameters
- [ ] `--execution-id` added to Python spawn arguments
- [ ] `--wave-id` added to Python spawn arguments
- [ ] `--wave-number` added to Python spawn arguments
- [ ] All callers of `spawnBuildAgent` updated with new parameters

#### Test Validation

| Test ID | Test Description        | Command                                                                                     | Expected Result | Pass |
| ------- | ----------------------- | ------------------------------------------------------------------------------------------- | --------------- | ---- |
| T13.1   | --execution-id in spawn | `grep -c "execution-id" server/services/task-agent/build-agent-orchestrator.ts`             | `≥ 1`           | ☐    |
| T13.2   | --wave-id in spawn      | `grep -c "wave-id" server/services/task-agent/build-agent-orchestrator.ts`                  | `≥ 1`           | ☐    |
| T13.3   | --wave-number in spawn  | `grep -c "wave-number" server/services/task-agent/build-agent-orchestrator.ts`              | `≥ 1`           | ☐    |
| T13.4   | executionId parameter   | `grep -c "executionId.*string" server/services/task-agent/build-agent-orchestrator.ts`      | `≥ 1`           | ☐    |
| T13.5   | TypeScript compiles     | `npx tsc --noEmit server/services/task-agent/build-agent-orchestrator.ts 2>&1 && echo "OK"` | Contains `OK`   | ☐    |

#### Pass Criteria

✅ **PASS**: All 5 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- `waveId` comes from `parallel_execution_waves` table
- `waveNumber` is 1-indexed integer
- Must update all callers of `spawnBuildAgent`

---

### OBS-OR-003: Emit Wave Lifecycle Events

| Field            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| **ID**           | OBS-OR-003                                               |
| **Phase**        | api                                                      |
| **Action**       | UPDATE                                                   |
| **File**         | `server/services/task-agent/build-agent-orchestrator.ts` |
| **Status**       | pending                                                  |
| **Dependencies** | OBS-OR-002, OBS-TS-001                                   |

#### Acceptance Criteria

- [ ] Import `eventEmitter` from unified-event-emitter
- [ ] Emit `wave_start` event when starting a wave
- [ ] Emit `wave_complete` event when wave finishes
- [ ] Emit `execution_complete` event when all waves done
- [ ] Include wave statistics in event details (waveNumber, taskCount, passRate, durationMs)

#### Test Validation

| Test ID | Test Description      | Command                                                                                     | Expected Result | Pass |
| ------- | --------------------- | ------------------------------------------------------------------------------------------- | --------------- | ---- |
| T14.1   | eventEmitter imported | `grep -c "eventEmitter" server/services/task-agent/build-agent-orchestrator.ts`             | `≥ 3`           | ☐    |
| T14.2   | wave_start emitted    | `grep -c "wave_start" server/services/task-agent/build-agent-orchestrator.ts`               | `≥ 1`           | ☐    |
| T14.3   | wave_complete emitted | `grep -c "wave_complete" server/services/task-agent/build-agent-orchestrator.ts`            | `≥ 1`           | ☐    |
| T14.4   | emit method called    | `grep -c "eventEmitter.emit" server/services/task-agent/build-agent-orchestrator.ts`        | `≥ 3`           | ☐    |
| T14.5   | TypeScript compiles   | `npx tsc --noEmit server/services/task-agent/build-agent-orchestrator.ts 2>&1 && echo "OK"` | Contains `OK`   | ☐    |

#### Pass Criteria

✅ **PASS**: All 5 tests return expected values
❌ **FAIL**: Any test fails - check implementation against spec

#### Gotchas

- Wave events are system events, not agent events
- Include `wave_number`, `task_count` in details
- Calculate `pass_rate` from completed tasks

---

## Phase 6: Testing & Validation

### OBS-TEST-001: Schema Validation Tests

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| **ID**           | OBS-TEST-001                          |
| **Phase**        | tests                                 |
| **Action**       | CREATE                                |
| **File**         | `tests/e2e/test-obs-phase1-schema.ts` |
| **Status**       | pending                               |
| **Dependencies** | OBS-SCHEMA-001                        |

#### Acceptance Criteria

- [ ] Test file `tests/e2e/test-obs-phase1-schema.ts` exists
- [ ] 10 test cases implemented from IMPLEMENTATION-PLAN-PHASES-1-2.md
- [ ] Verifies all 8 tables exist
- [ ] Verifies `transcript_entries` schema is event-agnostic (has source field)
- [ ] Verifies all 37+ indexes exist
- [ ] Verifies views exist
- [ ] Verifies trigger exists
- [ ] Tests data insertion works
- [ ] Tests SQL tool queries compile

#### Test Validation

| Test ID | Test Description    | Command                                                                      | Expected Result   | Pass |
| ------- | ------------------- | ---------------------------------------------------------------------------- | ----------------- | ---- |
| T15.1   | File exists         | `test -f tests/e2e/test-obs-phase1-schema.ts && echo "exists"`               | `exists`          | ☐    |
| T15.2   | Test runs           | `npx tsx tests/e2e/test-obs-phase1-schema.ts 2>&1`                           | Contains `PASSED` | ☐    |
| T15.3   | All tables verified | `npx tsx tests/e2e/test-obs-phase1-schema.ts 2>&1 \| grep -c "Table exists"` | `≥ 6`             | ☐    |

#### Pass Criteria

✅ **PASS**: Test execution outputs "ALL PHASE 1 TESTS PASSED"
❌ **FAIL**: Any test case fails

---

### OBS-TEST-002: Producer Unit Tests

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| **ID**           | OBS-TEST-002                                   |
| **Phase**        | tests                                          |
| **Action**       | CREATE                                         |
| **File**         | `tests/e2e/test-obs-phase2-producers.py`       |
| **Status**       | pending                                        |
| **Dependencies** | OBS-PY-001, OBS-PY-002, OBS-PY-003, OBS-PY-004 |

#### Acceptance Criteria

- [ ] Test file `tests/e2e/test-obs-phase2-producers.py` exists
- [ ] 7 test cases implemented from IMPLEMENTATION-PLAN-PHASES-1-2.md
- [ ] Tests TranscriptWriter writes and sequences
- [ ] Tests ToolUseLogger creates records and timing
- [ ] Tests ToolUseLogger handles blocked commands
- [ ] Tests AssertionRecorder chains and aggregates
- [ ] Tests SkillTracer links tool calls
- [ ] Tests ObservabilitySkills queries execute
- [ ] Tests SQL invariants hold (sequence monotonicity, FK integrity, temporal consistency)

#### Test Validation

| Test ID | Test Description | Command                                                                         | Expected Result   | Pass |
| ------- | ---------------- | ------------------------------------------------------------------------------- | ----------------- | ---- |
| T16.1   | File exists      | `test -f tests/e2e/test-obs-phase2-producers.py && echo "exists"`               | `exists`          | ☐    |
| T16.2   | Test runs        | `python3 tests/e2e/test-obs-phase2-producers.py 2>&1`                           | Contains `PASSED` | ☐    |
| T16.3   | All tests pass   | `python3 tests/e2e/test-obs-phase2-producers.py 2>&1 \| grep -c "TEST.*PASSED"` | `≥ 7`             | ☐    |

#### Pass Criteria

✅ **PASS**: Test execution outputs "ALL PHASE 2 TESTS PASSED"
❌ **FAIL**: Any test case fails

---

### OBS-TEST-003: E2E Integration Test

| Field            | Value                                |
| ---------------- | ------------------------------------ |
| **ID**           | OBS-TEST-003                         |
| **Phase**        | tests                                |
| **Action**       | CREATE                               |
| **File**         | `tests/e2e/test-obs-integration.py`  |
| **Status**       | pending                              |
| **Dependencies** | OBS-BA-004, OBS-OR-003, OBS-TEST-002 |

#### Acceptance Criteria

- [ ] Test file `tests/e2e/test-obs-integration.py` exists
- [ ] Executes a real task list with observability enabled
- [ ] Verifies `transcript_entries` populated with entries
- [ ] Verifies `tool_uses` populated with records
- [ ] Verifies `assertion_results` populated with results
- [ ] Verifies `wave_statistics` populated (via trigger)
- [ ] Queries using ObservabilitySkills and verifies results
- [ ] Checks invariants: sequence monotonicity, FK integrity, temporal consistency
- [ ] Cleans up test data after test

#### Test Validation

| Test ID | Test Description | Command                                                                                    | Expected Result   | Pass |
| ------- | ---------------- | ------------------------------------------------------------------------------------------ | ----------------- | ---- |
| T17.1   | File exists      | `test -f tests/e2e/test-obs-integration.py && echo "exists"`                               | `exists`          | ☐    |
| T17.2   | Test runs        | `python3 tests/e2e/test-obs-integration.py 2>&1`                                           | Contains `PASSED` | ☐    |
| T17.3   | DB populated     | `python3 tests/e2e/test-obs-integration.py 2>&1 \| grep -c "entries exist\|records found"` | `≥ 3`             | ☐    |

#### Pass Criteria

✅ **PASS**: Test execution outputs "E2E INTEGRATION TESTS PASSED"
❌ **FAIL**: Any test case fails

#### Gotchas

- Use a small test task list with 2-3 tasks
- Clean up test data after test
- May need to mock Claude API calls

---

## Final Verification Commands

After completing all tasks, run these commands to verify full integration:

```bash
# 1. Verify schema
sqlite3 database/ideas.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%transcript%' OR name LIKE '%tool_use%' OR name LIKE '%assertion%';"

# 2. Run Phase 1 tests
npx tsx tests/e2e/test-obs-phase1-schema.ts

# 3. Run Phase 2 tests
python3 tests/e2e/test-obs-phase2-producers.py

# 4. Run E2E integration test
python3 tests/e2e/test-obs-integration.py

# 5. Check transcript entries exist
sqlite3 database/ideas.db "SELECT COUNT(*) as count, source FROM transcript_entries GROUP BY source;"

# 6. Check tool uses logged
sqlite3 database/ideas.db "SELECT tool, COUNT(*) as count FROM tool_uses GROUP BY tool ORDER BY count DESC LIMIT 10;"

# 7. Check assertion results
sqlite3 database/ideas.db "SELECT result, COUNT(*) as count FROM assertion_results GROUP BY result;"

# 8. Check wave statistics populated
sqlite3 database/ideas.db "SELECT * FROM wave_statistics LIMIT 5;"

# 9. Verify TypeScript compiles
npx tsc --noEmit

# 10. Run full test suite
npm run test
```

### Final Pass Criteria

✅ **FULL INTEGRATION COMPLETE** when:

1. All 17 tasks marked complete in Master Progress Tracker
2. All individual task tests pass
3. Phase 1 schema tests: ALL PASSED
4. Phase 2 producer tests: ALL PASSED
5. E2E integration test: ALL PASSED
6. `transcript_entries` has rows
7. `tool_uses` has rows
8. `assertion_results` has rows
9. TypeScript compilation succeeds
10. Full test suite passes

---

## Summary

### Total Tasks: 17

| Phase            | Tasks | Description                       |
| ---------------- | ----- | --------------------------------- |
| 1 - Schema       | 1     | Verify migrations applied         |
| 2 - Python       | 4     | Producer classes                  |
| 3 - TypeScript   | 2     | Event emitter + execution manager |
| 4 - Build Agent  | 4     | Worker integration                |
| 5 - Orchestrator | 3     | Execution context passing         |
| 6 - Testing      | 3     | Validation tests                  |

### Critical Path

```
OBS-SCHEMA-001
    ├── OBS-PY-001 (TranscriptWriter)
    │   ├── OBS-PY-002 (ToolUseLogger)
    │   │   └── OBS-PY-004 (SkillTracer)
    │   └── OBS-PY-003 (AssertionRecorder)
    │
    ├── OBS-TS-001 (UnifiedEventEmitter)
    │   └── OBS-TS-002 (ExecutionManager)
    │       └── OBS-OR-001 (Create execution run)
    │           └── OBS-OR-002 (Pass context)
    │               └── OBS-OR-003 (Wave events)
    │
    └── OBS-BA-001 (CLI args)
        └── OBS-BA-002 (Init producers)
            └── OBS-BA-003 (Replace _log_event)
                └── OBS-BA-004 (Assertions)
                    └── OBS-TEST-003 (E2E test)
```

---

## Related Documents

| Document                                                                 | Purpose                      |
| ------------------------------------------------------------------------ | ---------------------------- |
| [SPEC.md](./SPEC.md)                                                     | Full system specification    |
| [IMPLEMENTATION-PLAN-PHASES-1-2.md](./IMPLEMENTATION-PLAN-PHASES-1-2.md) | Detailed implementation plan |
| [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md)         | Integration patterns         |
| [tools/OBSERVABILITY-SQL-TOOLS.md](./tools/OBSERVABILITY-SQL-TOOLS.md)   | SQL query tools              |
| [appendices/DATABASE.md](./appendices/DATABASE.md)                       | Full SQL schema              |
| [appendices/TYPES.md](./appendices/TYPES.md)                             | Type definitions             |

---

_Task list for Build Agent & Observability Integration - Bridging the gap between spec and implementation_
