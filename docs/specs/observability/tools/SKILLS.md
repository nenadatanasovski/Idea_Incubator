# Observability SQL Tools - Agent Skills

> **Purpose:** Discoverable skills for agents to query, validate, and analyze observability data
> **Location:** `docs/specs/observability/tools/SKILLS.md`
> **Database:** `database/observability.db` (SQLite)

---

## How to Use These Skills

Agents can invoke these SQL tools by:

1. Reading the SQL template from [OBSERVABILITY-SQL-TOOLS.md](./OBSERVABILITY-SQL-TOOLS.md)
2. Replacing `?` placeholders with actual values
3. Executing via SQLite against `database/observability.db`

### Example Invocation

```bash
sqlite3 database/observability.db "SELECT * FROM tool_uses WHERE execution_id = 'exec-123' AND result_status = 'error' LIMIT 10;"
```

---

## Skill: `/obs-validate`

**Purpose:** Run all validation checks on an execution to verify data integrity

**When to Use:**

- After an execution completes
- Before generating reports
- When data seems inconsistent

**Checks Performed:**
| Check | Tool ID | What It Validates |
|-------|---------|-------------------|
| Sequence Integrity | V001 | No gaps in transcript sequence numbers |
| Tool Use Linkage | V002 | All tool_uses have transcript_entries |
| Temporal Consistency | V003 | start_time < end_time for all operations |
| Lock Balance | V004 | Lock acquires match releases |
| Chain Completeness | V005 | All assertion chains completed |
| Wave Task Counts | V006 | Statistics match actual counts |
| FK Integrity | V007 | All foreign keys are valid |

**Usage:**

```
/obs-validate {execution_id}
```

**Output:** List of validation failures (empty = all passed)

---

## Skill: `/obs-errors`

**Purpose:** Find all errors across an execution with root cause identification

**When to Use:**

- Execution failed
- Need to understand what went wrong
- Investigating blocked operations

**Tools Used:** T001, T002, T003

**Usage:**

```
/obs-errors {execution_id}
```

**Output:**

- First error (root cause)
- All subsequent errors (cascade)
- Blocked commands with reasons
- Incomplete operations

---

## Skill: `/obs-task-trace`

**Purpose:** Get complete execution history for a single task

**When to Use:**

- Debugging a specific failed task
- Understanding task behavior
- Reviewing what happened

**Tools Used:** I001, I007

**Usage:**

```
/obs-task-trace {task_id}
```

**Output:**

- Chronological transcript entries
- Tool uses with results
- Assertions with evidence
- Decision points

---

## Skill: `/obs-summary`

**Purpose:** Generate high-level execution metrics for dashboards

**When to Use:**

- Building dashboard views
- Reporting to users
- Comparing executions

**Tools Used:** A001, A002, A004

**Usage:**

```
/obs-summary {execution_id}
```

**Output:**

- Execution duration and status
- Task completion breakdown
- Pass rate by category
- Error and blocked counts

---

## Skill: `/obs-parallel-health`

**Purpose:** Analyze parallel execution health and detect issues

**When to Use:**

- Multi-agent execution in progress
- Suspected parallelization issues
- Wave not completing

**Tools Used:** P001, P002, P003, P004

**Usage:**

```
/obs-parallel-health {execution_id}
```

**Output:**

- Wave progress overview
- Stuck agents (no heartbeat)
- File conflicts detected
- Utilization efficiency

---

## Skill: `/obs-anomalies`

**Purpose:** Detect unusual patterns and potential issues

**When to Use:**

- Proactive monitoring
- Something seems wrong but unclear why
- Performance degradation

**Tools Used:** D001, D002, D004, D005, D006

**Usage:**

```
/obs-anomalies {execution_id}
```

**Output:**

- Unusual tool durations (>3x average)
- Error cascades detected
- Activity spikes
- Orphaned resources
- Circular wait patterns

---

## Skill: `/obs-compare`

**Purpose:** Compare metrics across multiple executions

**When to Use:**

- Regression detection
- Performance trending
- Before/after analysis

**Tools Used:** A006, D003

**Usage:**

```
/obs-compare {task_list_id} [limit=10]
```

**Output:**

- Side-by-side metrics for recent executions
- Assertion regressions (passed → failed)
- Duration trends

---

## Skill: `/obs-bottlenecks`

**Purpose:** Identify performance bottlenecks

**When to Use:**

- Execution is slow
- Optimizing parallel execution
- Capacity planning

**Tools Used:** A005, P005, D001

**Usage:**

```
/obs-bottlenecks {execution_id}
```

**Output:**

- Duration percentiles by tool (P50, P90, P99)
- Slowest tasks per wave
- Unusual duration outliers

---

## Skill: `/obs-file-activity`

**Purpose:** Analyze file access patterns

**When to Use:**

- Understanding what files were touched
- Detecting hot files (many accesses)
- Investigating file errors

**Tools Used:** I004, P003

**Usage:**

```
/obs-file-activity {execution_id}
```

**Output:**

- Most accessed files with operation counts
- Success/error rates per file
- Potential conflicts

---

## Skill: `/obs-stuck`

**Purpose:** Find operations that appear stuck or incomplete

**When to Use:**

- Execution seems hung
- Task not progressing
- Agent not responding

**Tools Used:** T004, P002, D005

**Usage:**

```
/obs-stuck {execution_id}
```

**Output:**

- Incomplete tool uses (>5 min old)
- Agents without recent heartbeat
- Unclosed assertion chains
- Unreleased locks

---

## Quick Reference Matrix

| Scenario                           | Skill                  | Primary Tool IDs |
| ---------------------------------- | ---------------------- | ---------------- |
| Verify execution completed cleanly | `/obs-validate`        | V001-V007        |
| Debug failed execution             | `/obs-errors`          | T001-T003        |
| Understand single task             | `/obs-task-trace`      | I001, I007       |
| Dashboard metrics                  | `/obs-summary`         | A001, A002, A004 |
| Parallel issues                    | `/obs-parallel-health` | P001-P004        |
| Find weird patterns                | `/obs-anomalies`       | D001-D006        |
| Compare runs                       | `/obs-compare`         | A006, D003       |
| Find slow parts                    | `/obs-bottlenecks`     | A005, P005, D001 |
| File analysis                      | `/obs-file-activity`   | I004, P003       |
| Find stuck things                  | `/obs-stuck`           | T004, P002, D005 |

---

## Sub-Agent Integration

### For Build Agent Workers

```python
from observability.skills import ObservabilitySkills

# After task execution
skills = ObservabilitySkills(db_path="database/observability.db")
validation_result = skills.validate(execution_id)
if validation_result.has_errors:
    skills.log_errors(execution_id)
```

### For Monitoring Agent

```python
# Periodic health check
health = skills.parallel_health(execution_id)
if health.stuck_agents:
    alert("Stuck agents detected", health.stuck_agents)
if health.file_conflicts:
    alert("File conflicts in wave", health.file_conflicts)
```

### For SIA (Self-Improvement Agent)

```python
# Learn from failures
anomalies = skills.detect_anomalies(execution_id)
for cascade in anomalies.error_cascades:
    sia.record_gotcha(cascade.root_cause, cascade.pattern)
```

---

## Tool Index by Purpose

### Truth Verification

- V001: Sequence gaps (data corruption)
- V002: Orphaned records (logging failure)
- V003: Temporal paradoxes (clock issues)
- V007: FK violations (referential integrity)

### Quick Error Spotting

- T001: All errors unified view
- T003: First error (root cause)
- T005: Repeated failures (systemic issues)

### Pattern Recognition

- I002: Tool usage patterns
- I003: Skill execution patterns
- D002: Error cascade patterns
- I006: Decision point reconstruction

### Parallelization Issues

- P002: Stuck agents (no heartbeat)
- P003: File conflicts in wave
- D006: Circular waits (deadlock)
- P006: Concurrent overlaps

---

_See [OBSERVABILITY-SQL-TOOLS.md](./OBSERVABILITY-SQL-TOOLS.md) for full SQL implementations_
