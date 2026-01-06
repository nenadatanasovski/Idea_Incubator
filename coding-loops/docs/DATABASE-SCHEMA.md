# Database Schema Reference

**Version:** 1.0
**Database:** `coding-loops/coordination.db` (SQLite)
**Schema File:** `coding-loops/database/schema.sql`

---

## Overview

The coordination system uses a single SQLite database as the source of truth for all state. This eliminates the previous `test-state.json` files and provides:

- ACID transactions
- Concurrent access via WAL mode
- Queryable event history
- Single source of truth

---

## Tables

### loops

Registered execution loops.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Loop identifier (e.g., `loop-1-critical-path`) |
| name | TEXT | Human-readable name |
| priority | INTEGER | 1 = highest priority |
| branch | TEXT | Git branch name |
| status | TEXT | `running`, `stopped`, `paused`, `error` |
| current_test_id | TEXT | Currently working on |
| pid | INTEGER | Process ID when running |
| created_at | TEXT | ISO8601 |
| updated_at | TEXT | ISO8601 |

---

### tests

Test definitions and progress (replaces test-state.json).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Test identifier (e.g., `CP-UFS-001`) |
| loop_id | TEXT FK | Owning loop |
| category | TEXT | `ufs`, `specification`, `build`, etc. |
| status | TEXT | `pending`, `in_progress`, `passed`, `failed`, `blocked`, `skipped` |
| attempts | INTEGER | Number of attempts |
| max_attempts | INTEGER | Max before blocking (default: 3) |
| last_result | TEXT | `pass`, `fail`, `blocked` |
| depends_on | TEXT | Test ID dependency |
| automatable | INTEGER | 1 = can be automated |
| notes | TEXT | Description/specification |
| spec_content | TEXT | Full specification text |
| last_attempt_at | TEXT | ISO8601 |
| passed_at | TEXT | ISO8601 |
| verified_at | TEXT | When verification gate confirmed |
| created_at | TEXT | ISO8601 |

**Indexes:** `loop_id`, `status`, `depends_on`

---

### events

Event bus messages.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| timestamp | TEXT | ISO8601 |
| source | TEXT | `loop-1`, `monitor`, `pm`, `human`, etc. |
| event_type | TEXT | See EVENT-CATALOG.md |
| payload | TEXT | JSON |
| correlation_id | TEXT | For related events |
| priority | INTEGER | 1 = highest |
| acknowledged | INTEGER | 0 or 1 |
| acknowledged_by | TEXT | Who acknowledged |
| acknowledged_at | TEXT | ISO8601 |

**Indexes:** `timestamp`, `source`, `event_type`, `acknowledged` (partial), `correlation_id`

---

### subscriptions

Event subscriptions for polling.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Subscription ID |
| subscriber | TEXT | Who is subscribing |
| event_types | TEXT | JSON array of types |
| filter_sources | TEXT | JSON array (null = all) |
| last_poll_at | TEXT | ISO8601 |
| active | INTEGER | 0 or 1 |

---

### file_locks

File locking for conflict prevention.

| Column | Type | Description |
|--------|------|-------------|
| file_path | TEXT PK | Locked file path |
| locked_by | TEXT | Loop ID |
| locked_at | TEXT | ISO8601 |
| lock_reason | TEXT | Why locked |
| expires_at | TEXT | TTL-based expiry |
| test_id | TEXT | Which test acquired |

---

### wait_graph

For deadlock detection.

| Column | Type | Description |
|--------|------|-------------|
| waiter | TEXT | Loop waiting |
| holder | TEXT | Loop holding |
| resource | TEXT | File path |
| waiting_since | TEXT | ISO8601 |

**Primary Key:** (waiter, holder, resource)

---

### knowledge

Cross-agent knowledge base.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Knowledge ID |
| loop_id | TEXT FK | Who recorded |
| item_type | TEXT | `fact`, `decision`, `pattern`, `warning` |
| topic | TEXT | For querying |
| content | TEXT | The knowledge |
| confidence | REAL | 0.0 to 1.0 |
| evidence | TEXT | Supporting evidence |
| affected_areas | TEXT | JSON array of file patterns |
| superseded_by | TEXT | ID of newer knowledge |
| created_at | TEXT | ISO8601 |

---

### resources

Shared resource ownership tracking.

| Column | Type | Description |
|--------|------|-------------|
| path | TEXT PK | File path or resource ID |
| owner_loop | TEXT FK | Owning loop |
| resource_type | TEXT | `file`, `type`, `interface`, `endpoint`, `migration` |
| description | TEXT | What this resource is |
| created_at | TEXT | ISO8601 |

---

### change_requests

Requests to modify non-owned resources.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Request ID |
| resource_path | TEXT FK | Resource being changed |
| requestor_loop | TEXT FK | Who is requesting |
| owner_loop | TEXT FK | Who owns |
| request_type | TEXT | `modify`, `extend`, `delete` |
| description | TEXT | What change is needed |
| status | TEXT | `pending`, `approved`, `rejected`, `applied` |
| requested_at | TEXT | ISO8601 |
| resolved_at | TEXT | ISO8601 |
| resolved_by | TEXT | `human` or `pm` |

---

### migrations

Database migration ordering.

| Column | Type | Description |
|--------|------|-------------|
| number | INTEGER PK | Migration number |
| name | TEXT | Migration name |
| loop_id | TEXT FK | Who created |
| file_path | TEXT | Path to .sql file |
| status | TEXT | `pending`, `applied`, `failed` |
| allocated_at | TEXT | ISO8601 |
| applied_at | TEXT | ISO8601 |

---

### checkpoints

Git checkpoint tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Checkpoint ID |
| loop_id | TEXT FK | Owning loop |
| test_id | TEXT FK | For which test |
| git_ref | TEXT | Branch or commit |
| checkpoint_type | TEXT | `branch`, `stash`, `tag` |
| created_at | TEXT | ISO8601 |
| deleted_at | TEXT | ISO8601 (null if active) |

---

### passing_tests

For regression detection.

| Column | Type | Description |
|--------|------|-------------|
| test_id | TEXT | Test that passed |
| commit_hash | TEXT | At which commit |
| passed_at | TEXT | ISO8601 |

**Primary Key:** (test_id, commit_hash)

---

### decisions

Pending human decisions.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Decision ID |
| decision_type | TEXT | `conflict`, `stuck`, `architecture`, etc. |
| summary | TEXT | What needs deciding |
| options | TEXT | JSON array of options |
| default_option | TEXT | Default if timeout |
| context | TEXT | JSON with details |
| timeout_minutes | INTEGER | Auto-resolve after |
| status | TEXT | `pending`, `decided`, `auto_resolved`, `expired` |
| requested_at | TEXT | ISO8601 |
| requested_by | TEXT | Which agent |
| decided_at | TEXT | ISO8601 |
| decided_by | TEXT | `human` or `auto` |
| choice | TEXT | Selected option |
| comment | TEXT | Human comment |

---

### usage

Resource usage tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Usage record ID |
| loop_id | TEXT FK | Which loop |
| test_id | TEXT | Which test |
| tokens_estimated | INTEGER | Token count |
| duration_seconds | INTEGER | Time spent |
| files_modified | TEXT | JSON array |
| recorded_at | TEXT | ISO8601 |

---

### component_health

Component heartbeat tracking.

| Column | Type | Description |
|--------|------|-------------|
| component | TEXT PK | Component name |
| last_heartbeat | TEXT | ISO8601 |
| status | TEXT | `healthy`, `degraded`, `dead`, `unknown` |
| metadata | TEXT | JSON with details |

---

### alerts

System alerts.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Alert ID |
| severity | TEXT | `info`, `warning`, `error`, `critical` |
| alert_type | TEXT | `stuck`, `conflict`, `digression`, `resource`, `regression` |
| source | TEXT | Which component |
| message | TEXT | Alert message |
| context | TEXT | JSON details |
| acknowledged | INTEGER | 0 or 1 |
| acknowledged_by | TEXT | Who ack'd |
| acknowledged_at | TEXT | ISO8601 |
| created_at | TEXT | ISO8601 |

---

### transaction_log

For atomic operations with replay.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Transaction ID |
| operation | TEXT | `test_pass`, `file_write`, etc. |
| loop_id | TEXT FK | Which loop |
| steps | TEXT | JSON array of steps |
| status | TEXT | `in_progress`, `committed`, `rolled_back` |
| started_at | TEXT | ISO8601 |
| completed_at | TEXT | ISO8601 |

---

## Common Queries

### Get pending tests for a loop

```sql
SELECT * FROM tests
WHERE loop_id = ?
  AND status = 'pending'
  AND (depends_on IS NULL OR depends_on IN (
    SELECT id FROM tests WHERE status = 'passed'
  ))
ORDER BY id;
```

### Get unacknowledged events for subscriber

```sql
SELECT e.* FROM events e
JOIN subscriptions s ON s.subscriber = ?
WHERE e.acknowledged = 0
  AND json_extract(s.event_types, '$') LIKE '%' || e.event_type || '%'
  AND (s.filter_sources IS NULL OR json_extract(s.filter_sources, '$') LIKE '%' || e.source || '%')
ORDER BY e.timestamp;
```

### Check for file lock

```sql
SELECT * FROM file_locks
WHERE file_path = ?
  AND (expires_at IS NULL OR expires_at > datetime('now'));
```

### Get loop progress

```sql
SELECT
  loop_id,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
FROM tests
GROUP BY loop_id;
```

---

## Backup & Recovery

```bash
# Backup
sqlite3 coordination.db ".backup backup.db"

# Integrity check
sqlite3 coordination.db "PRAGMA integrity_check"

# Export as SQL
sqlite3 coordination.db ".dump" > dump.sql
```

---

*See `database/schema.sql` for complete DDL.*
