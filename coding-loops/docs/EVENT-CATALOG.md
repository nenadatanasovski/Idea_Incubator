# Event Catalog

**Version:** 1.0
**Created:** 2026-01-07

All events are published to the Message Bus and stored in the `events` table.

---

## Event Structure

```json
{
  "id": "uuid",
  "timestamp": "ISO8601",
  "source": "loop-1-critical-path",
  "event_type": "test_started",
  "payload": { ... },
  "correlation_id": "uuid (optional)",
  "priority": 5
}
```

---

## Loop Events

### test_started

Published when a loop begins working on a test.

```json
{
  "test_id": "CP-UFS-001",
  "loop_id": "loop-1-critical-path",
  "attempt": 1,
  "spec_summary": "Complete remaining SC-* tests"
}
```

### test_passed

Published when a test passes verification.

```json
{
  "test_id": "CP-UFS-001",
  "loop_id": "loop-1-critical-path",
  "attempt": 1,
  "duration_seconds": 180,
  "tokens_estimated": 15000,
  "files_modified": ["file1.ts", "file2.ts"],
  "verified": true,
  "verification_checks": {
    "typescript": true,
    "build": true,
    "tests": true,
    "lint": true
  }
}
```

### test_failed

Published when a test attempt fails.

```json
{
  "test_id": "CP-UFS-001",
  "loop_id": "loop-1-critical-path",
  "attempt": 2,
  "error_category": "code",
  "error_message": "TypeScript compilation failed",
  "will_retry": true
}
```

### test_blocked

Published when a test is blocked (max attempts reached).

```json
{
  "test_id": "CP-UFS-001",
  "loop_id": "loop-1-critical-path",
  "attempts": 3,
  "last_error": "Unable to resolve type mismatch",
  "blocking_dependents": ["CP-UFS-002", "CP-UFS-003"]
}
```

---

## Lock Events

### file_locked

Published when a loop acquires a file lock.

```json
{
  "file_path": "server/api.ts",
  "loop_id": "loop-1-critical-path",
  "test_id": "CP-UFS-001",
  "reason": "Modifying API endpoint",
  "ttl_seconds": 300
}
```

### file_unlocked

Published when a loop releases a file lock.

```json
{
  "file_path": "server/api.ts",
  "loop_id": "loop-1-critical-path",
  "held_for_seconds": 45
}
```

---

## Monitor Events

### file_conflict

Published when monitor detects two loops modified the same file.

```json
{
  "file_path": "server/api.ts",
  "loop_a": "loop-1-critical-path",
  "loop_b": "loop-2-infrastructure",
  "time_a": "2026-01-07T10:00:00Z",
  "time_b": "2026-01-07T10:02:00Z"
}
```

### stuck_detected

Published when a loop is stuck on the same test.

```json
{
  "loop_id": "loop-1-critical-path",
  "test_id": "CP-UFS-001",
  "consecutive_failures": 3,
  "stuck_for_minutes": 45,
  "last_error": "Type mismatch"
}
```

### digression_detected

Published when a loop is going off-track.

```json
{
  "loop_id": "loop-1-critical-path",
  "test_id": "CP-UFS-001",
  "files_modified": 25,
  "expected_scope": ["server/routes/ideation.ts"],
  "actual_scope": ["server/**", "types/**", "utils/**"]
}
```

### regression_detected

Published when a previously passing test now fails.

```json
{
  "test_id": "CP-UFS-001",
  "last_passed_commit": "abc123",
  "current_commit": "def456",
  "blamed_loop": "loop-2-infrastructure",
  "blamed_test": "INF-AUTH-003"
}
```

### resource_warning

Published when resource usage is high.

```json
{
  "loop_id": "loop-1-critical-path",
  "resource": "tokens",
  "current": 800000,
  "limit": 1000000,
  "percentage": 80
}
```

---

## PM Events

### decision_needed

Published when human decision is required.

```json
{
  "decision_id": "DEC-001",
  "decision_type": "conflict_resolution",
  "summary": "Loop 1 and Loop 2 both modified server/api.ts",
  "options": [
    {"id": "A", "description": "Keep Loop 1's changes (auth middleware)"},
    {"id": "B", "description": "Keep Loop 2's changes (credit endpoint)"},
    {"id": "C", "description": "Manual merge required"}
  ],
  "default_option": "A",
  "timeout_minutes": 60,
  "context": {
    "loop_1_changes": "...",
    "loop_2_changes": "..."
  }
}
```

### priority_changed

Published when work priority changes.

```json
{
  "loop_id": "loop-2-infrastructure",
  "old_priority": 2,
  "new_priority": 1,
  "reason": "Blocking critical path"
}
```

### pause_requested

Published to pause a loop.

```json
{
  "loop_id": "loop-2-infrastructure",
  "reason": "Conflict with higher priority loop",
  "requested_by": "pm"
}
```

### resume_requested

Published to resume a paused loop.

```json
{
  "loop_id": "loop-2-infrastructure",
  "reason": "Conflict resolved",
  "requested_by": "pm"
}
```

### rollback_triggered

Published when rollback is initiated.

```json
{
  "loop_id": "loop-1-critical-path",
  "checkpoint_id": "chk-123",
  "reason": "Build break detected",
  "triggered_by": "pm"
}
```

---

## Deadlock Events

### force_release

Published to force a loop to release locks.

```json
{
  "loop_id": "loop-2-infrastructure",
  "reason": "Deadlock detected",
  "locks_held": ["server/api.ts", "types/auth.ts"],
  "must_rollback": true
}
```

---

## Human Events

### human_message

Published when human provides input.

```json
{
  "message_type": "decision_response",
  "decision_id": "DEC-001",
  "choice": "A",
  "comment": "Auth is higher priority",
  "source": "telegram"
}
```

### summary_requested

Published when human requests a summary.

```json
{
  "requested_by": "human",
  "scope": "all",
  "since_hours": 24
}
```

---

## Knowledge Events

### knowledge_recorded

Published when new knowledge is recorded.

```json
{
  "knowledge_id": "kb-123",
  "loop_id": "loop-1-critical-path",
  "item_type": "decision",
  "topic": "auth",
  "content": "Using JWT with 24-hour expiry"
}
```

### knowledge_conflict

Published when new knowledge conflicts with existing.

```json
{
  "new_knowledge_id": "kb-124",
  "existing_knowledge_id": "kb-100",
  "conflict_description": "Conflicting auth token expiry times"
}
```

---

## System Events

### component_started

Published when a component starts.

```json
{
  "component": "monitor",
  "pid": 12345,
  "version": "1.0"
}
```

### component_stopped

Published when a component stops.

```json
{
  "component": "monitor",
  "reason": "graceful_shutdown"
}
```

### component_degraded

Published when a component is degraded.

```json
{
  "component": "monitor",
  "last_heartbeat": "2026-01-07T10:00:00Z",
  "status": "degraded"
}
```
