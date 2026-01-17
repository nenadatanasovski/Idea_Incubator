# Build Agent & Observability Investigation Report

**Date**: 2026-01-17
**Investigator**: Claude Code
**Status**: Critical gaps identified

---

## Executive Summary

A systematic investigation of the Build Agent execution system and Observability infrastructure has revealed **fundamental architectural disconnects** that prevent the system from functioning as designed. The core issue: **observability data is never written during task execution**.

### Key Findings

| Finding                                                     | Severity     | Impact                             |
| ----------------------------------------------------------- | ------------ | ---------------------------------- |
| Observability tables completely empty                       | **CRITICAL** | No visibility into agent execution |
| Build agent worker doesn't use observability infrastructure | **CRITICAL** | Logs go to wrong tables            |
| Zombie agent records in database                            | **HIGH**     | False status in UI, resource leaks |
| UI doesn't reflect actual database state                    | **HIGH**     | Misleading dashboard               |
| No process cleanup on server restart                        | **MEDIUM**   | Orphaned processes possible        |

---

## Detailed Findings

### 1. CRITICAL: Observability Infrastructure Not Connected

**Evidence:**

```sql
-- All observability tables are EMPTY
SELECT COUNT(*) FROM transcript_entries;  -- 0
SELECT COUNT(*) FROM tool_uses;           -- 0
SELECT COUNT(*) FROM assertion_results;   -- 0
```

**Root Cause Analysis:**

The observability system has three layers that are **completely disconnected**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1: Database Infrastructure (EXISTS)                          │
│ - transcript_entries table (migration 087)                         │
│ - tool_uses table                                                  │
│ - assertion_results, skill_traces tables                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ (NOT CONNECTED)
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 2: Writers (EXIST BUT NOT USED)                              │
│ - TypeScript: UnifiedEventEmitter (server/services/observability/) │
│ - Python: TranscriptWriter (coding-loops/shared/)                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ (NOT CONNECTED)
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 3: Build Agent Worker (WRITES TO DIFFERENT TABLES)           │
│ - Python: build_agent_worker.py                                    │
│ - Writes to: task_execution_log, task_executions                   │
│ - Does NOT import: TranscriptWriter                                │
└─────────────────────────────────────────────────────────────────────┘
```

**File References:**

- [build_agent_worker.py](coding-loops/agents/build_agent_worker.py) - Line 23-37: imports only standard libraries, no observability
- [build_agent_worker.py:931-950](coding-loops/agents/build_agent_worker.py#L931-L950) - `_log_continuous()` writes to `task_execution_log`, not `transcript_entries`
- [unified-event-emitter.ts](server/services/observability/unified-event-emitter.ts) - Line 287: Has `INSERT INTO transcript_entries` but never called by orchestrator
- [build-agent-orchestrator.ts](server/services/task-agent/build-agent-orchestrator.ts) - Zero imports of `eventEmitter` or observability services

### 2. CRITICAL: Build Agent Worker Missing Observability Integration

**Current State of build_agent_worker.py:**

```python
# Line 23-37 - Only standard library imports
import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
import threading
import time
import traceback
# ... NO observability imports
```

**Missing Integration Points:**

1. No `from shared.transcript_writer import TranscriptWriter`
2. No `from shared.tool_use_logger import ToolUseLogger`
3. `_log_continuous()` method writes to wrong table

**Where Logs Actually Go:**
| Method | Target Table | Should Be |
|--------|--------------|-----------|
| `_log_continuous()` | task_execution_log | transcript_entries |
| `_log_event()` | task_executions | transcript_entries + tool_uses |
| heartbeats | agent_heartbeats | agent_heartbeats + transcript_entries |

### 3. HIGH: Zombie Agent Records

**Evidence:**

```sql
-- Agents marked "running" but processes are dead
SELECT id, status, last_heartbeat_at FROM build_agent_instances WHERE status = 'running';
-- Returns 4 records with heartbeats from 4+ hours to 1+ day ago
```

**Process Verification:**

```bash
ps aux | grep -E "21604|69534|69548|69561"  # Process IDs from "running" agents
# Result: No matching processes (all dead)
```

**Impact:**

- Dashboard shows incorrect "Running: 0" (should show zombie state)
- No mechanism to detect/cleanup stale agents
- Resource tracking is incorrect

### 4. HIGH: UI/Database State Mismatch

**Agent Dashboard Screenshot Analysis:**

- Shows "Running: 0" when database has 4 "running" records
- Shows "Last heartbeat: Just now" when actual heartbeats are hours old
- Shows all agents as "Idle" with 0 metrics

**Causes:**

1. Dashboard may be reading from different data source
2. "Just now" display logic doesn't check actual timestamp
3. No stale agent detection/display

### 5. MEDIUM: No Heartbeat Timeout Enforcement

**Current Implementation:**

- Heartbeat expected every 30 seconds
- Timeout check configured for 90 seconds
- BUT: No active process to check/enforce timeouts

**File Reference:** [build-agent-orchestrator.ts:400-426](server/services/task-agent/build-agent-orchestrator.ts#L400-L426)

---

## Architectural Gaps Matrix

| Component          | Expected Behavior           | Actual Behavior              | Gap          |
| ------------------ | --------------------------- | ---------------------------- | ------------ |
| Build Agent Worker | Write to transcript_entries | Writes to task_execution_log | **CRITICAL** |
| Orchestrator       | Emit observability events   | Spawns process only          | **CRITICAL** |
| Heartbeat Monitor  | Detect stuck agents         | No active monitoring         | **HIGH**     |
| Agent Cleanup      | Terminate dead processes    | No cleanup on restart        | **HIGH**     |
| UI Dashboard       | Show real agent state       | Shows cached/wrong state     | **HIGH**     |
| WebSocket Events   | Stream real-time logs       | No events emitted            | **HIGH**     |

---

## Root Cause: Disconnected Development

The observability system was designed as a comprehensive logging infrastructure but was never integrated with the actual execution layer:

1. **Database Schema**: Well-designed with proper indexes and relationships
2. **TypeScript Services**: `UnifiedEventEmitter`, `ExecutionManager` exist
3. **Python Services**: `TranscriptWriter`, `ToolUseLogger` exist
4. **Frontend Components**: `ObservabilityHub`, hooks exist
5. **Integration**: **MISSING** - No code connects these layers

---

## Recommendations

### Phase 1: Critical Fixes (Must Have)

1. **Integrate TranscriptWriter into Build Agent Worker**

```python
# Add to build_agent_worker.py
from shared.transcript_writer import TranscriptWriter

class BuildAgentWorker:
    def __init__(self, ...):
        self.transcript = TranscriptWriter(
            execution_id=self.build_execution_id,
            instance_id=self.agent_id
        )

    def _log_continuous(self, message, level='INFO'):
        self.transcript.write_entry(
            entry_type='tool_use' if level == 'INFO' else 'error',
            summary=message,
            category='action'
        )
```

2. **Add Observability Events to Orchestrator**

```typescript
// In build-agent-orchestrator.ts
import { eventEmitter } from '../observability/unified-event-emitter';

async spawnBuildAgent(taskId, taskListId) {
    await eventEmitter.emit(
        { source: 'agent', executionId, instanceId: agentId, taskId },
        { entryType: 'task_start', category: 'lifecycle', summary: `Starting task ${taskId}` }
    );
    // ... existing spawn logic
}
```

3. **Implement Agent Cleanup Cron**

```typescript
// New file: server/services/task-agent/agent-cleanup.ts
async function cleanupStaleAgents() {
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  const staleAgents = await query(`
        SELECT * FROM build_agent_instances
        WHERE status = 'running'
        AND datetime(last_heartbeat_at) < datetime('now', '-5 minutes')
    `);

  for (const agent of staleAgents) {
    await run(
      `UPDATE build_agent_instances SET status = 'terminated',
            termination_reason = 'stale_heartbeat' WHERE id = ?`,
      [agent.id],
    );
  }
}
```

### Phase 2: High Priority Fixes

4. **Fix Dashboard Data Source** - Ensure UI reads from actual database tables
5. **Add Stale Agent Indicator** - Show visual warning for agents without recent heartbeat
6. **Implement WebSocket Event Streaming** - Push observability events to connected clients

### Phase 3: Improvements

7. **Add Integration Tests** - Verify end-to-end logging flow
8. **Implement Log Retention** - Archive old observability data
9. **Add Observability Metrics** - Track logging latency, throughput

---

## Verification Commands

Run these to verify the current state:

```bash
# Check observability tables are empty
sqlite3 database/ideas.db "SELECT COUNT(*) FROM transcript_entries;"
sqlite3 database/ideas.db "SELECT COUNT(*) FROM tool_uses;"

# Check for zombie agents
sqlite3 database/ideas.db "SELECT id, status, last_heartbeat_at FROM build_agent_instances WHERE status = 'running';"

# Verify processes are dead
ps aux | grep build_agent_worker

# Check what tables ARE being written to
sqlite3 database/ideas.db "SELECT COUNT(*) FROM task_execution_log;"
sqlite3 database/ideas.db "SELECT COUNT(*) FROM task_executions;"
```

---

## Conclusion

The Build Agent and Observability systems are **architecturally sound but completely disconnected**. The infrastructure exists at all layers (database, services, frontend) but no integration code connects them. Tasks execute but produce no observable output in the intended monitoring systems.

**Priority**: Fix the integration between `build_agent_worker.py` and the observability infrastructure as the first step - this is the root cause of all visibility issues.
