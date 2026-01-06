# Multi-Agent Coordination System - Complete Implementation Plan

**Created:** 2026-01-07
**Version:** 2.0 (Merged from v1 + Critical Gaps Addendum)
**Purpose:** Comprehensive plan to build a truly autonomous multi-agent development system
**Status:** READY FOR CODING AGENT HANDOFF
**Total Tests:** 116
**Estimated Effort:** 6 weeks

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [First Principles Analysis](#first-principles-analysis)
3. [Gap Analysis](#gap-analysis)
4. [Architecture Design](#architecture-design)
5. [Component Specifications](#component-specifications)
   - [Message Bus](#component-1-message-bus)
   - [Monitor Agent](#component-2-monitor-agent)
   - [PM Agent](#component-3-pm-agent)
   - [Human Interface Agent](#component-4-human-interface-agent)
   - [Checkpoint & Rollback Manager](#component-5-checkpoint--rollback-manager)
   - [Budget Manager](#component-6-budget-manager)
   - [Verification Gate](#component-7-verification-gate)
   - [Git Manager](#component-8-git-manager)
   - [Semantic Analyzer](#component-9-semantic-analyzer)
   - [Knowledge Base](#component-10-knowledge-base)
   - [Regression Monitor](#component-11-regression-monitor)
   - [Deadlock Detector](#component-12-deadlock-detector)
   - [Error Classifier](#component-13-error-classifier)
   - [Degradation Manager](#component-14-degradation-manager)
   - [Orphan Cleaner](#component-15-orphan-cleaner)
   - [Loop Integration Updates](#component-16-loop-integration-updates)
6. [Implementation Plan](#implementation-plan)
7. [Test Execution Plan](#test-execution-plan)
8. [File Structure](#file-structure)
9. [Dependencies](#dependencies)
10. [Success Metrics](#success-metrics)
11. [Risk Mitigation](#risk-mitigation)
12. [Operator Runbook](#operator-runbook)
13. [Handoff Checklist](#handoff-checklist)
14. [Appendix](#appendix)

---

## Executive Summary

The current "coding loop system" is NOT autonomous. It's 3 isolated scripts that happen to run in parallel. True autonomous multi-agent development requires:

1. **Communication Bus** - Agents must talk to each other
2. **Monitor Agent** - Something must watch all agents
3. **PM Agent** - Something must coordinate priorities and resolve conflicts
4. **Human Agent** - Humans need an interface to intervene
5. **Verification Gate** - Independent validation that work is actually complete
6. **Git Strategy** - Branch-per-loop with controlled merges
7. **Knowledge Sharing** - Cross-agent context and decisions
8. **Digression Detection** - Detect when agents are stuck or going in circles
9. **Rollback Capability** - Revert when things go wrong
10. **Resource Management** - Track and limit API/time usage
11. **Graceful Degradation** - System survives component failures

**Current State:** 15% complete
**Target State:** Production-ready multi-agent orchestration

### Critical Insight

> "When an agent says 'TEST PASSED', how do we KNOW it actually passed?"

**Answer: We don't.** Without independent verification, the agent could be hallucinating, wrong, or lying. This single oversight makes the entire system unreliable. The Verification Gate component addresses this.

---

## First Principles Analysis

### What Does "Autonomous Multi-Agent Development" Actually Mean?

| Requirement | Description | Current State |
|-------------|-------------|---------------|
| **Concurrent execution** | Multiple agents work simultaneously | Partial - can run, but isolated |
| **Awareness of each other** | Agents know what others are doing | Zero awareness |
| **Conflict avoidance** | Don't overwrite each other's work | No mechanism |
| **Conflict resolution** | When conflicts happen, resolve them | No mechanism |
| **Shared context** | All agents see the same state | Each has own state |
| **Coordination** | Work together toward common goal | No coordination |
| **Monitoring** | Something watches for problems | Health files exist but nothing reads them |
| **Human oversight** | Humans can intervene when needed | No interface |
| **Verification** | Independent check that work is correct | No verification |
| **Learning** | System improves from failures | No learning |
| **Recovery** | Graceful handling of failures | Only basic retry |

---

## Gap Analysis

### Gap 1: No Communication Bus

**Problem:** Agents are completely isolated. They cannot:
- Tell other agents what they're working on
- Warn about files they're modifying
- Ask for help or coordination
- Report completion or blocking

**Consequence:**
- Loop 1 modifies `server/api.ts`
- Loop 2 also modifies `server/api.ts`
- They overwrite each other's changes
- Neither knows this happened
- Both keep "fixing" the file forever

**Required:** Event bus with timeline, subscriptions, and persistence

---

### Gap 2: No Monitor Agent

**Problem:** Nothing watches the loops. Health files are written but never read.

**Consequence:**
- Loop stuck for 2 hours? No one notices
- Same error repeating 50 times? No intervention
- API credits exhausted? Crash with no warning
- Agent going in circles? Runs forever

**Required:** Active monitoring agent that reads health, detects anomalies, alerts

---

### Gap 3: No PM Agent

**Problem:** No coordination across loops.

**Consequence:**
- Loop 1 blocks on auth, Loop 2 is building auth - no connection
- Priority changes? No one can tell loops to reprioritize
- Conflicting approaches to same problem? No resolution
- Overall architecture consistency? No enforcement

**Required:** PM agent that coordinates, prioritizes, resolves conflicts

---

### Gap 4: No Human Interface Agent

**Problem:** Humans can only watch logs or manually edit JSON files.

**Consequence:**
- "What's happening?" requires reading multiple files
- "Pause everything" requires killing processes
- "Skip this test" requires editing JSON
- Decisions pending? No notification

**Required:** Human agent that summarizes, presents decisions, accepts input

---

### Gap 5: No Shared Event Timeline

**Problem:** Each loop has its own transcript. No unified view.

**Consequence:**
- Can't see "what happened across all loops at 3pm"
- Can't correlate events (A happened, then B failed)
- No audit trail for debugging
- No way to replay/understand failures

**Required:** Centralized event log with queryable timeline

---

### Gap 6: No Independent Verification

**Problem:** Agent says "TEST PASSED". Current system trusts the claim blindly.

**What if:**
- Agent hallucinated success
- Code compiles but tests fail
- Tests pass locally but CI fails
- Implementation doesn't match spec
- Agent just said "passed" to escape a loop

**Required:** Verification Gate with independent TypeScript/test/build checks

---

### Gap 7: No Git Branching Strategy

**Problem:** Multiple agents committing to same branch = chaos.

**Unanswered:**
- What branch does each loop work on?
- When/how do changes merge to main?
- Who resolves git merge conflicts?
- What if main moves while loop is working?

**Required:** Branch-per-loop with PM-controlled merges

---

### Gap 8: No Semantic Conflict Detection

**Problem:** File locking prevents byte-level conflicts but not semantic conflicts:

| Agent A | Agent B | Problem |
|---------|---------|---------|
| Adds `function foo()` in utils/a.ts | Adds `function foo()` in utils/b.ts | Duplicate function names |
| Exports `interface User { id: number }` | Expects `interface User { id: string }` | Type mismatch |
| Uses camelCase | Uses snake_case | Style inconsistency |
| Implements REST `/api/users` | Implements GraphQL `query users` | Architecture inconsistency |

**Required:** Semantic analyzer for cross-agent compatibility

---

### Gap 9: No Cross-Agent Context Sharing

**Problem:** Agent 1 learns "the auth system uses JWT" but Agent 2 doesn't know.

**Consequence:**
- Starts with fresh context
- Rediscovers same information
- Makes inconsistent decisions
- Wastes context on repeated exploration

**Required:** Shared knowledge base

---

### Gap 10: No Regression Detection

**Problem:** Agent modifies shared code. Previously passing test breaks. No one notices.

**Required:** Continuous regression testing with blame attribution

---

### Gap 11: No Deadlock Detection

**Problem:**
| Time | Loop 1 | Loop 2 |
|------|--------|--------|
| T0 | Locks file A | Locks file B |
| T1 | Needs file B, waits | Needs file A, waits |
| T2 | Waiting forever | Waiting forever |

**Required:** Wait graph with cycle detection and victim selection

---

### Gap 12: No Error Categorization

**Problem:** All errors treated the same. An API timeout is different from "file not found" is different from "impossible requirement".

**Required:** Error taxonomy with per-category handling

---

### Gap 13: No Graceful Degradation

**Problem:** When one component dies, what happens to the rest?

| Component Dies | Current Behavior | Should Happen |
|----------------|------------------|---------------|
| Monitor | Loops run blind | Loops slow down, alert human |
| PM | No conflict resolution | Loops pause on any conflict |
| Message Bus | Complete failure | Loops fall back to file-based |

**Required:** Degraded mode protocols

---

### Gap 14: No Orphan Cleanup

**Problem:**
| Scenario | Orphan Created | Problem |
|----------|----------------|---------|
| Agent dies mid-test | File lock held forever | Other agents blocked |
| Agent dies mid-write | Half-written file | Corruption |
| Agent dies after checkpoint | Checkpoint never deleted | Disk fills up |

**Required:** Automatic orphan detection and cleanup

---

### Gap 15: No Rollback Capability

**Problem:** If an agent makes things worse, no way to recover.

**Consequence:**
- Agent breaks the build? Manual git revert needed
- Agent introduces bugs? No detection
- Multiple agents break things? Chaos

**Required:** Git checkpoints, regression detection, automated rollback

---

### Gap 16: No Resource Management

**Problem:** No tracking or limiting of resources.

**Consequence:**
- One loop consumes all API credits
- Tests run for hours with no timeout
- No visibility into costs
- No fairness across loops

**Required:** Budget tracking, timeouts, usage reporting

---

## Architecture Design

### System Overview

```
+---------------------------------------------------------------------------+
|                             HUMAN LAYER                                     |
|  +-----------------------------------------------------------------------+ |
|  |  Dashboard / CLI / Notifications / Operator Runbook                   | |
|  +-----------------------------------------------------------------------+ |
+-------------------------------------+-------------------------------------+
                                      |
+-------------------------------------v-------------------------------------+
|                          ORCHESTRATION LAYER                               |
|  +----------+ +----------+ +----------+ +----------+ +----------+         |
|  |  Human   | |    PM    | | Monitor  | | Semantic | |Knowledge |         |
|  |  Agent   | |   Agent  | |  Agent   | | Analyzer | |   Base   |         |
|  +----+-----+ +----+-----+ +----+-----+ +----+-----+ +----+-----+         |
|       |            |            |            |            |               |
|  +----v------------v------------v------------v------------v-----+         |
|  |                    MESSAGE BUS (SQLite)                      |         |
|  |  Events | Subscriptions | Locks | Deadlock | Knowledge       |         |
|  +--------------------------------+-----------------------------+         |
+-----------------------------------+-----------------------------------+
                                    |
+-----------------------------------v-----------------------------------+
|                           EXECUTION LAYER                              |
|  +-----------+          +-----------+          +-----------+          |
|  |  Loop 1   |          |  Loop 2   |          |  Loop 3   |          |
|  |  branch   |          |  branch   |          |  branch   |          |
|  +-----+-----+          +-----+-----+          +-----+-----+          |
|        |                      |                      |                |
|  +-----v----------------------v----------------------v-----+          |
|  |              VERIFICATION GATE                          |          |
|  |  TypeScript | Tests | Build | Lint | Regression         |          |
|  +-----------------------------------------------------+          |
+-----------------------------------+-----------------------------------+
                                    |
+-----------------------------------v-----------------------------------+
|                            SAFETY LAYER                                |
|  +----------+ +----------+ +----------+ +----------+ +----------+     |
|  |Checkpoint| |  Budget  | |  Error   | |Degradation| | Orphan  |     |
|  | Manager  | | Manager  | |Classifier| |  Manager  | | Cleaner |     |
|  +----------+ +----------+ +----------+ +----------+ +----------+     |
+-----------------------------------+-----------------------------------+
                                    |
+-----------------------------------v-----------------------------------+
|                             GIT LAYER                                  |
|  +-------------------------------------------------------------------+|
|  |  Git Manager: Branches | Rebases | PRs | Merges | Conflicts       ||
|  +-------------------------------------------------------------------+|
|                                    |                                   |
|                               +----v----+                              |
|                               |  main   | (protected)                  |
|                               +---------+                              |
+-----------------------------------------------------------------------+
```

---

## Component Specifications

### Component 1: Message Bus

**Purpose:** Enable inter-agent communication with persistence and queryability.

**Location:** `coding-loops/shared/message_bus.py`

**Database:** `coding-loops/coordination.db` (SQLite)

**Schema:**

```sql
-- Events table
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL,  -- loop-1, loop-2, loop-3, monitor, pm, human
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,  -- JSON
    correlation_id TEXT,
    priority INTEGER DEFAULT 5,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT
);

-- Indices
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_source ON events(source);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_unack ON events(acknowledged) WHERE acknowledged = 0;

-- Subscriptions table
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    subscriber TEXT NOT NULL,
    event_types TEXT NOT NULL,  -- JSON array
    filter_sources TEXT,  -- JSON array (null = all)
    active INTEGER DEFAULT 1
);

-- File locks table
CREATE TABLE file_locks (
    file_path TEXT PRIMARY KEY,
    locked_by TEXT NOT NULL,
    locked_at TEXT NOT NULL,
    lock_reason TEXT,
    expires_at TEXT
);
```

**Event Types:**

| Type | Source | Description |
|------|--------|-------------|
| `test_started` | loop-* | Agent started working on a test |
| `test_passed` | loop-* | Test passed |
| `test_failed` | loop-* | Test failed (will retry) |
| `test_blocked` | loop-* | Test blocked (max attempts) |
| `file_locked` | loop-* | Agent is modifying a file |
| `file_unlocked` | loop-* | Agent finished with file |
| `file_conflict` | monitor | Two agents touched same file |
| `digression_detected` | monitor | Agent going off-track |
| `stuck_detected` | monitor | Agent making no progress |
| `resource_warning` | monitor | Budget/time running low |
| `regression_detected` | monitor | Previously passing test now fails |
| `decision_needed` | pm | Human decision required |
| `priority_changed` | pm | Work priority changed |
| `pause_requested` | pm/human | Pause a loop |
| `resume_requested` | pm/human | Resume a loop |
| `rollback_triggered` | pm | Rolling back changes |
| `human_message` | human | Message from human |
| `summary_requested` | human | Human wants status update |
| `force_release` | deadlock_detector | Force loop to release locks |

**Python API:**

```python
class MessageBus:
    def __init__(self, db_path: Path):
        """Initialize with SQLite database path."""

    def publish(self, source: str, event_type: str, payload: dict,
                priority: int = 5, correlation_id: str = None) -> str:
        """Publish an event. Returns event ID."""

    def subscribe(self, subscriber: str, event_types: list[str],
                  filter_sources: list[str] = None) -> str:
        """Subscribe to event types. Returns subscription ID."""

    def poll(self, subscriber: str, limit: int = 10) -> list[dict]:
        """Poll for unacknowledged events matching subscriptions."""

    def acknowledge(self, event_id: str, subscriber: str) -> None:
        """Mark event as acknowledged by subscriber."""

    def get_timeline(self, since: datetime = None, until: datetime = None,
                     sources: list[str] = None, types: list[str] = None,
                     limit: int = 100) -> list[dict]:
        """Query event timeline with filters."""

    def lock_file(self, file_path: str, locked_by: str,
                  reason: str = None, ttl_seconds: int = 300) -> bool:
        """Acquire file lock. Returns True if acquired."""

    def unlock_file(self, file_path: str, locked_by: str) -> None:
        """Release file lock."""

    def check_lock(self, file_path: str) -> dict | None:
        """Check if file is locked. Returns lock info or None."""

    def release_expired_locks(self) -> int:
        """Release all expired locks. Returns count."""

    def release_all_locks(self, loop_id: str) -> int:
        """Release all locks held by a loop. Returns count."""
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| BUS-001 | Publish event | Event appears in database with correct fields |
| BUS-002 | Subscribe to events | Subscription created, poll returns matching events |
| BUS-003 | Acknowledge event | Event marked acknowledged, not returned in poll |
| BUS-004 | Timeline query | Returns events in timestamp order with correct filters |
| BUS-005 | File locking | Lock acquired, second attempt fails, unlock works |
| BUS-006 | Lock expiry | Expired locks auto-released, can be reacquired |
| BUS-007 | Concurrent access | Multiple processes can publish/poll without corruption |
| BUS-008 | Integration with loop | Loop publishes test_started/passed/failed events |

---

### Component 2: Monitor Agent

**Purpose:** Watch all loops, detect anomalies, alert PM and humans.

**Location:** `coding-loops/agents/monitor_agent.py`

**Runs as:** Separate process, polls every 30 seconds

**Responsibilities:**

1. **Health Monitoring**
   - Read health.json from all loops every 30s
   - Detect stale heartbeats (>2 minutes old)
   - Detect loops that stopped unexpectedly

2. **Progress Monitoring**
   - Track test pass rate over time
   - Detect stuck loops (same test failing >3 times consecutively)
   - Detect no progress (0 tests passed in 30 minutes)

3. **Conflict Detection**
   - Watch file_locked/unlocked events
   - Detect when two loops modify same file within 5 minutes
   - Publish file_conflict event

4. **Digression Detection**
   - Track files modified per test
   - Flag if agent modifies >20 files for one test
   - Flag if agent touches files outside expected scope
   - Detect circular patterns (same error message 5+ times)

5. **Resource Monitoring**
   - Track API calls per loop (from transcripts)
   - Warn at 80% of budget
   - Alert at 95% of budget

6. **Regression Monitoring** (every 10 minutes)
   - Run all previously-passing tests
   - Detect any that now fail
   - Publish regression_detected with blame

**State File:** `coding-loops/monitor-state.json`

```json
{
  "lastCheck": "ISO8601",
  "loops": {
    "loop-1-critical-path": {
      "lastHeartbeat": "ISO8601",
      "status": "running|stopped|stuck|unknown",
      "currentTest": "CP-UFS-001",
      "consecutiveFailures": 0,
      "testsPassedLast30Min": 2,
      "filesModifiedThisTest": ["file1.ts", "file2.ts"],
      "apiCallsEstimate": 150
    }
  },
  "alerts": [
    {
      "id": "uuid",
      "timestamp": "ISO8601",
      "severity": "warning|error|critical",
      "type": "stuck|conflict|digression|resource|regression",
      "message": "Loop 1 stuck on CP-UFS-001 for 45 minutes",
      "acknowledged": false
    }
  ]
}
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| MON-001 | Health check | Reads all health.json files, updates monitor-state.json |
| MON-002 | Stale detection | Publishes alert when heartbeat >2 min old |
| MON-003 | Stuck detection | Publishes stuck_detected after 3 consecutive failures on same test |
| MON-004 | Conflict detection | Publishes file_conflict when two loops modify same file |
| MON-005 | Digression detection | Publishes digression_detected when >20 files modified |
| MON-006 | Resource warning | Publishes resource_warning at 80% budget |
| MON-007 | Continuous operation | Runs for 10 minutes without crashing, handles loop restarts |
| MON-008 | Integration | Monitor alerts visible in human dashboard |

---

### Component 3: PM Agent

**Purpose:** Coordinate work across loops, resolve conflicts, manage priorities.

**Location:** `coding-loops/agents/pm_agent.py`

**Runs as:** Separate process, event-driven (polls message bus)

**Responsibilities:**

1. **Priority Management**
   - Maintain priority queue of work
   - Reorder based on dependencies and urgency
   - Publish priority_changed events

2. **Conflict Resolution**
   - Receive file_conflict events from monitor
   - Decide winner (based on priority, progress, scope)
   - Publish pause_requested to loser
   - Publish rollback_triggered if needed

3. **Dependency Coordination**
   - Track cross-loop dependencies
   - When Loop 1 completes auth interface, notify Loop 2
   - Pause loops waiting for dependencies

4. **Escalation**
   - Detect situations requiring human decision
   - Format decision request clearly
   - Publish decision_needed event
   - Wait for and apply human response

5. **Work Distribution**
   - If one loop finishes, assign overflow work
   - Balance load across loops
   - Handle loop failures gracefully

**Decision Types Requiring Human:**

| Situation | Decision Needed |
|-----------|-----------------|
| Two valid approaches | Which approach to take |
| Conflicting requirements | Which requirement to prioritize |
| Budget exceeded | Continue or stop |
| Loop stuck >1 hour | Skip test or investigate |
| Architecture inconsistency | Which pattern to follow |
| Regression detected | Rollback or fix forward |

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| PM-001 | Receive conflict | Subscribes to file_conflict, processes within 30s |
| PM-002 | Resolve conflict | Publishes pause_requested to lower-priority loop |
| PM-003 | Track dependencies | When dep satisfied, publishes resume_requested |
| PM-004 | Escalate decision | Publishes decision_needed with clear options |
| PM-005 | Apply human decision | Receives human response, updates priorities |
| PM-006 | Handle loop failure | Redistributes work when loop stops unexpectedly |
| PM-007 | Continuous operation | Runs for 10 minutes, handles all event types |
| PM-008 | Integration | PM decisions reflected in loop behavior |

---

### Component 4: Human Interface Agent

**Purpose:** Provide humans with visibility and control over the system.

**Location:** `coding-loops/agents/human_agent.py`

**Components:**
1. CLI interface (`coding-loops/cli.py`)
2. Web dashboard (optional, Phase 2)
3. Notification system (Slack/email, optional)

**CLI Commands:**

```bash
# Status
python3 coding-loops/cli.py status              # Overall status
python3 coding-loops/cli.py status loop-1       # Specific loop status
python3 coding-loops/cli.py timeline            # Recent events
python3 coding-loops/cli.py timeline --since 1h # Events in last hour
python3 coding-loops/cli.py health              # Health of all components

# Control
python3 coding-loops/cli.py pause loop-1        # Pause a loop
python3 coding-loops/cli.py resume loop-1       # Resume a loop
python3 coding-loops/cli.py pause all           # Pause all loops
python3 coding-loops/cli.py skip CP-UFS-001     # Skip a test
python3 coding-loops/cli.py reset CP-UFS-001    # Reset test to pending
python3 coding-loops/cli.py rollback loop-1     # Rollback loop's changes
python3 coding-loops/cli.py restart loop-1      # Restart a loop

# Locks
python3 coding-loops/cli.py locks               # Show all locks
python3 coding-loops/cli.py force-unlock loop-1 # Force release locks
python3 coding-loops/cli.py deadlocks           # Show deadlock status

# Decisions
python3 coding-loops/cli.py decisions           # Show pending decisions
python3 coding-loops/cli.py decide DEC-001 A    # Make decision

# Analysis
python3 coding-loops/cli.py summary             # AI-generated summary
python3 coding-loops/cli.py conflicts           # Show recent conflicts
python3 coding-loops/cli.py stuck               # Show stuck tests
python3 coding-loops/cli.py regressions         # Show regressions
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| HUM-001 | Status command | Shows all loops with current test, progress, health |
| HUM-002 | Timeline command | Shows recent events in readable format |
| HUM-003 | Pause command | Loop stops working within 30s |
| HUM-004 | Resume command | Loop resumes from where it stopped |
| HUM-005 | Skip command | Test marked skipped, loop moves to next |
| HUM-006 | Decision command | Decision applied, PM notified |
| HUM-007 | Summary command | Generates coherent 1-page summary |
| HUM-008 | Web dashboard | (Phase 2) Dashboard shows real-time status |

---

### Component 5: Checkpoint & Rollback Manager

**Purpose:** Create checkpoints before risky operations, enable rollback.

**Location:** `coding-loops/shared/checkpoint_manager.py`

**Mechanism:**

1. Before each test, create git stash or branch
2. Track checkpoint -> test mapping
3. If test fails badly (breaks build), offer rollback
4. If rollback triggered, restore to checkpoint

**Checkpoint Strategy:**

```
main branch
    |
    +-- checkpoint/loop-1/CP-UFS-001 (before test)
    |       |
    |       +-- (test runs, modifies files)
    |           |
    |           +-- SUCCESS: delete checkpoint branch
    |           +-- FAILURE: keep for potential rollback
    |
    +-- checkpoint/loop-1/CP-UFS-002
    ...
```

**API:**

```python
class CheckpointManager:
    def create_checkpoint(self, loop_id: str, test_id: str) -> str:
        """Create checkpoint before test. Returns checkpoint ID."""

    def rollback(self, checkpoint_id: str) -> bool:
        """Rollback to checkpoint. Returns success."""

    def rollback_if_exists(self, loop_id: str) -> bool:
        """Rollback current checkpoint if exists. Returns success."""

    def delete_checkpoint(self, checkpoint_id: str) -> None:
        """Delete checkpoint (call after test passes)."""

    def list_checkpoints(self, loop_id: str = None,
                         older_than: timedelta = None) -> list[dict]:
        """List available checkpoints with optional filters."""
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| CHK-001 | Create checkpoint | Git branch/stash created, checkpoint recorded |
| CHK-002 | Rollback | Files restored to checkpoint state |
| CHK-003 | Delete checkpoint | Branch/stash removed, record deleted |
| CHK-004 | List checkpoints | Returns all checkpoints with metadata |
| CHK-005 | Integration | Loop creates checkpoint before each test |
| CHK-006 | Auto-rollback | On build break, auto-rollback and retry |

---

### Component 6: Budget Manager

**Purpose:** Track and limit resource usage.

**Location:** `coding-loops/shared/budget_manager.py`

**Tracking:**

1. Estimate API tokens from transcript length
2. Track wall-clock time per test
3. Track total time per loop
4. Persist to database

**Limits:**

| Resource | Warning | Hard Limit |
|----------|---------|------------|
| Tokens per test | 100K | 500K |
| Time per test | 30 min | 2 hours |
| Tests per day | 50 | 100 |
| Total tokens per day | 1M | 5M |

**API:**

```python
class BudgetManager:
    def record_usage(self, loop_id: str, test_id: str,
                     tokens: int, duration_seconds: int) -> None:
        """Record resource usage for a test."""

    def check_budget(self, loop_id: str) -> dict:
        """Check current budget status. Returns warnings/limits."""

    def get_report(self, period: str = "day") -> dict:
        """Get usage report for period."""
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| BUD-001 | Record usage | Usage stored in database |
| BUD-002 | Warning threshold | Publishes resource_warning at 80% |
| BUD-003 | Hard limit | Loop paused at 100% |
| BUD-004 | Report generation | Accurate usage report by loop/test |
| BUD-005 | Integration | Loops report usage after each test |

---

### Component 7: Verification Gate

**Purpose:** Independently verify agent claims of success.

**Location:** `coding-loops/shared/verification_gate.py`

**Problem Addressed:** Agent says "TEST PASSED: CP-UFS-001". Current system trusts the claim. What if agent is wrong?

**Solution:** Every "passed" claim must be independently verified.

**API:**

```python
class VerificationResult:
    verified: bool
    checks: dict[str, bool]  # check_name -> passed
    errors: list[str]

class VerificationGate:
    """Independent verification of agent claims."""

    def verify_test_passed(self, loop_id: str, test_id: str) -> VerificationResult:
        """
        Run independent verification after agent claims passed.
        """
        results = {}

        # 1. TypeScript compilation
        results["typescript"] = self._run_tsc()

        # 2. Run actual tests (if defined)
        results["tests"] = self._run_tests(test_id)

        # 3. Build passes
        results["build"] = self._run_build()

        # 4. Lint passes
        results["lint"] = self._run_lint()

        # 5. No regressions
        results["regression"] = self._check_regressions()

        return VerificationResult(
            verified=all(results.values()),
            checks=results,
            errors=self._collect_errors()
        )

    def _run_tsc(self) -> bool:
        """Run npx tsc --noEmit, return True if exit 0."""

    def _run_tests(self, test_id: str) -> bool:
        """Run relevant test file if exists."""

    def _run_build(self) -> bool:
        """Run npm run build."""

    def _run_lint(self) -> bool:
        """Run npm run lint on changed files."""

    def _check_regressions(self) -> bool:
        """Check all previously passing tests still pass."""
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| VER-001 | TypeScript check | `npx tsc --noEmit` exits 0 |
| VER-002 | Test execution | Relevant test file passes |
| VER-003 | Build check | `npm run build` exits 0 |
| VER-004 | Lint check | `npm run lint` exits 0 (or no lint errors in changed files) |
| VER-005 | Regression check | All previously passing tests still pass |
| VER-006 | Verification blocks false pass | Agent claims pass, verification fails -> test NOT marked passed |
| VER-007 | Verification confirms true pass | Agent claims pass, verification passes -> test marked passed |

---

### Component 8: Git Manager

**Purpose:** Manage branch-per-loop strategy with controlled merges.

**Location:** `coding-loops/shared/git_manager.py`

**Branch Strategy:**

```
main (protected)
  |
  +-- loop-1/working --> (loop 1 works here)
  |       |
  |       +-- PR to main (reviewed by PM/human)
  |
  +-- loop-2/working --> (loop 2 works here)
  |       |
  |       +-- PR to main (reviewed by PM/human)
  |
  +-- loop-3/working --> (loop 3 works here)
          |
          +-- PR to main (reviewed by PM/human)
```

**Rules:**
1. Each loop works on its own branch
2. Loops rebase from main every N tests (configurable)
3. PM triggers merge to main when milestone reached
4. Human reviews PRs before merge
5. Git conflicts = human decision

**API:**

```python
class GitManager:
    def ensure_branch(self, loop_id: str) -> str:
        """Ensure loop's working branch exists, create if not."""

    def rebase_from_main(self, loop_id: str) -> RebaseResult:
        """Rebase loop's branch from main. Returns conflicts if any."""

    def create_pr(self, loop_id: str, title: str, body: str) -> str:
        """Create PR from loop branch to main. Returns PR URL."""

    def merge_pr(self, pr_url: str) -> MergeResult:
        """Merge PR to main. Requires human approval first."""

    def detect_conflicts(self, loop_id: str) -> list[str]:
        """Detect files that would conflict on merge."""

    def get_branch(self, loop_id: str) -> str:
        """Get branch name for loop."""

    def checkout_branch(self, loop_id: str) -> None:
        """Checkout loop's working branch."""
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| GIT-001 | Branch creation | Each loop has dedicated branch |
| GIT-002 | Rebase from main | Loop rebases without human intervention (no conflicts) |
| GIT-003 | Conflict detection | Conflicts detected BEFORE merge attempted |
| GIT-004 | PR creation | PR created with correct base/head branches |
| GIT-005 | PR blocks on review | Merge blocked until human approves |
| GIT-006 | Main stays clean | Main never has failing tests |

---

### Component 9: Semantic Analyzer

**Purpose:** Detect semantic conflicts beyond file-level locking.

**Location:** `coding-loops/shared/semantic_analyzer.py`

**Problem Addressed:** File locking prevents byte-level conflicts but not:
- Duplicate function names across files
- Type mismatches (one exports `id: number`, other expects `id: string`)
- Style inconsistencies (camelCase vs snake_case)
- Architecture inconsistencies (REST vs GraphQL)

**API:**

```python
class SemanticAnalyzer:
    def analyze_changes(self, loop_id: str, files: list[str]) -> SemanticReport:
        """
        Analyze semantic impact of changes.

        Checks:
        - New exports: names, types, signatures
        - New imports: what's being consumed
        - New dependencies: package.json changes
        - API changes: endpoint definitions
        - Naming conventions: style consistency
        """

    def detect_conflicts(self, report_a: SemanticReport,
                        report_b: SemanticReport) -> list[SemanticConflict]:
        """Find semantic conflicts between two change sets."""

    def check_architecture_compliance(self, report: SemanticReport,
                                       rules: ArchRules) -> list[Violation]:
        """Check if changes follow architectural rules."""
```

**Architecture Rules File:** `coding-loops/architecture-rules.yaml`

```yaml
naming:
  variables: camelCase
  functions: camelCase
  classes: PascalCase
  constants: SCREAMING_SNAKE_CASE
  files: kebab-case

structure:
  api_style: REST
  state_management: React Context
  database: SQLite
  auth: JWT

boundaries:
  - frontend/** cannot import from server/**
  - server/** cannot import from frontend/**
  - utils/** must be pure functions
  - agents/** cannot directly access database

prohibited:
  - eval()
  - document.write()
  - any use of `any` type without comment
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| SEM-001 | Export detection | All new exports identified with types |
| SEM-002 | Naming check | Violations of naming rules flagged |
| SEM-003 | Boundary check | Cross-boundary imports flagged |
| SEM-004 | Conflict detection | Conflicting exports across loops detected |
| SEM-005 | Architecture compliance | Violations of architecture rules blocked |

---

### Component 10: Knowledge Base

**Purpose:** Share learned facts, decisions, and patterns across agents.

**Location:** `coding-loops/shared/knowledge_base.py`

**Problem Addressed:** Agent 1 learns "the auth system uses JWT" but Agent 2 doesn't know. Each agent rediscovers same information, wastes context.

**Database Schema Addition:**

```sql
CREATE TABLE knowledge (
    id TEXT PRIMARY KEY,
    loop_id TEXT NOT NULL,
    item_type TEXT NOT NULL,  -- fact, decision, pattern, warning
    content TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    evidence TEXT,
    affected_areas TEXT,  -- JSON array
    created_at TEXT NOT NULL,
    superseded_by TEXT  -- ID of newer knowledge
);

CREATE INDEX idx_knowledge_type ON knowledge(item_type);
CREATE INDEX idx_knowledge_areas ON knowledge(affected_areas);
```

**API:**

```python
class KnowledgeBase:
    """Shared knowledge across all agents."""

    def record_fact(self, loop_id: str, fact: str,
                    confidence: float, evidence: str) -> str:
        """Record a learned fact. Returns fact ID."""

    def record_decision(self, loop_id: str, decision: str,
                        rationale: str, affected_areas: list[str]) -> str:
        """Record an architectural/design decision."""

    def record_pattern(self, loop_id: str, pattern_name: str,
                       description: str, example_file: str) -> str:
        """Record a code pattern that should be followed."""

    def query(self, topic: str, limit: int = 10) -> list[KnowledgeItem]:
        """Query knowledge base by topic."""

    def get_context_for_test(self, test_id: str) -> str:
        """Generate context summary for a specific test."""
```

**Injection into Agent Prompts:**

```python
def build_prompt(self, test: dict) -> str:
    # Get relevant knowledge
    kb = KnowledgeBase(self.db_path)
    knowledge = kb.get_context_for_test(test["id"])

    prompt = f"""
## Shared Knowledge

The following facts/decisions have been recorded by other agents:

{knowledge}

Please follow these patterns and decisions. If you discover something that conflicts,
publish a decision_needed event instead of making a different choice.

## Your Task: {test['id']}
...
"""
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| KB-001 | Record fact | Fact stored with correct metadata |
| KB-002 | Record decision | Decision stored, affects future prompts |
| KB-003 | Query by topic | Returns relevant knowledge items |
| KB-004 | Context injection | Agent prompts include relevant knowledge |
| KB-005 | Consistency | Agent follows recorded decisions |
| KB-006 | Conflict detection | Agent flags when it would contradict recorded knowledge |

---

### Component 11: Regression Monitor

**Purpose:** Continuously monitor for regressions from agent changes.

**Location:** `coding-loops/shared/regression_monitor.py`

**Problem Addressed:** Agent modifies shared code. Previously passing test breaks. No one notices until human runs tests manually.

**API:**

```python
class Regression:
    test_id: str
    last_passed_commit: str
    current_commit: str

class BlameResult:
    loop_id: str
    test_id: str
    commit: str

class RegressionMonitor:
    """Continuously monitors for regressions."""

    def __init__(self, test_state_files: list[Path]):
        self.test_states = test_state_files
        self.last_known_good: dict[str, str] = {}  # test_id -> git commit

    def record_passing(self, test_id: str, commit: str) -> None:
        """Record that test passed at this commit."""

    def check_regressions(self) -> list[Regression]:
        """
        Run all previously-passing tests.
        Return list of tests that now fail.
        """

    def get_blame(self, test_id: str) -> BlameResult:
        """
        Find which commit/loop caused regression.
        Uses git bisect internally.
        """
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| REG-001 | Record passing | Passing tests recorded with commit |
| REG-002 | Detect regression | Test that was passing now fails -> detected |
| REG-003 | Blame attribution | Correct loop/test blamed for regression |
| REG-004 | Event published | regression_detected event published |
| REG-005 | PM notified | PM receives regression, pauses blamed loop |
| REG-006 | Auto-rollback option | Regression can trigger automatic rollback |

---

### Component 12: Deadlock Detector

**Purpose:** Detect and resolve deadlocks in file locking.

**Location:** `coding-loops/shared/deadlock_detector.py`

**Problem Addressed:**
| Time | Loop 1 | Loop 2 |
|------|--------|--------|
| T0 | Locks file A | Locks file B |
| T1 | Needs file B, waits | Needs file A, waits |
| T2 | Waiting forever | Waiting forever |

**API:**

```python
class DeadlockDetector:
    """Detects and resolves deadlocks in file locking."""

    def __init__(self, bus: MessageBus):
        self.bus = bus
        self.wait_graph: dict[str, set[str]] = {}  # who waits for whom

    def record_wait(self, waiter: str, holder: str, resource: str) -> None:
        """Record that waiter is waiting for holder to release resource."""
        if waiter not in self.wait_graph:
            self.wait_graph[waiter] = set()
        self.wait_graph[waiter].add(holder)

        # Check for cycle
        if self._has_cycle():
            self._resolve_deadlock()

    def _has_cycle(self) -> bool:
        """Detect cycle in wait graph using DFS."""

    def _choose_victim(self) -> str:
        """
        Choose victim based on:
        - Lower priority loop
        - Less work done
        - Easier to rollback
        """

    def _resolve_deadlock(self) -> None:
        """Force victim to release and rollback."""
        victim = self._choose_victim()
        self.bus.publish(
            source="deadlock_detector",
            event_type="force_release",
            payload={
                "loop_id": victim,
                "reason": "Deadlock detected",
                "must_rollback": True
            }
        )
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| DLK-001 | Record waits | Wait graph updated when lock fails |
| DLK-002 | Cycle detection | Deadlock detected within 30s |
| DLK-003 | Victim selection | Lower priority loop selected as victim |
| DLK-004 | Force release | Victim releases locks and rolls back |
| DLK-005 | Recovery | Both loops continue after deadlock resolved |

---

### Component 13: Error Classifier

**Purpose:** Categorize errors for appropriate handling.

**Location:** `coding-loops/shared/error_classifier.py`

**Problem Addressed:** All errors treated the same. An API timeout is different from "file not found" is different from "impossible requirement".

**Error Categories:**

```python
class ErrorCategory(Enum):
    TRANSIENT = "transient"      # Retry will likely work
    PERMANENT = "permanent"       # Retry won't help, need different approach
    SYSTEM = "system"            # Bug in the coordination system itself
    CODE = "code"                # Bug in the codebase being developed
    SPEC = "spec"                # Problem with the specification
    RESOURCE = "resource"        # Out of resources (time, tokens, etc.)
    DEPENDENCY = "dependency"    # Waiting for something else
    HUMAN = "human"              # Needs human decision
```

**Handling by Category:**

| Category | Handling |
|----------|----------|
| TRANSIENT | Retry with exponential backoff (max 3) |
| PERMANENT | Mark test blocked, try different approach |
| SYSTEM | Alert human, stop all loops |
| CODE | Attempt fix, if 3 failures escalate |
| SPEC | Escalate to human for clarification |
| RESOURCE | Pause, alert human |
| DEPENDENCY | Wait for dependency, timeout after 30 min |
| HUMAN | Publish decision_needed, wait for response |

**API:**

```python
class ErrorClassifier:
    """Classify errors for appropriate handling."""

    def classify(self, error: Exception, context: dict) -> ErrorCategory:
        """Classify an error into a category."""
        error_str = str(error).lower()

        # Transient errors (retry)
        if any(x in error_str for x in ["timeout", "rate limit", "503", "502", "connection"]):
            return ErrorCategory.TRANSIENT

        # Resource errors
        if any(x in error_str for x in ["context length", "max tokens", "budget"]):
            return ErrorCategory.RESOURCE

        # System errors (stop everything)
        if any(x in error_str for x in ["database", "sqlite", "message bus"]):
            return ErrorCategory.SYSTEM

        # ... etc

    def get_handling(self, category: ErrorCategory) -> ErrorHandling:
        """Get handling instructions for error category."""
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| ERR-001 | Transient classification | Timeout classified as transient |
| ERR-002 | Transient handling | Transient errors retried with backoff |
| ERR-003 | System classification | Database error classified as system |
| ERR-004 | System handling | System error stops all loops |
| ERR-005 | Human classification | Ambiguous spec classified as human |
| ERR-006 | Human handling | Human error triggers decision_needed |

---

### Component 14: Degradation Manager

**Purpose:** Manage graceful degradation when components fail.

**Location:** `coding-loops/shared/degradation_manager.py`

**Problem Addressed:** When one component dies, what happens to the rest?

**API:**

```python
class DegradedMode:
    description: str
    loop_behavior: str  # "normal", "slow_mode", "conservative", "file_based"
    human_alert: bool

class DegradationManager:
    """Manages graceful degradation when components fail."""

    def __init__(self, bus: MessageBus):
        self.bus = bus
        self.component_health: dict[str, datetime] = {}

    def heartbeat(self, component: str) -> None:
        """Record heartbeat from component."""
        self.component_health[component] = datetime.now(timezone.utc)

    def check_components(self) -> dict[str, str]:
        """
        Check all component health.
        Returns dict of component -> status (healthy/degraded/dead)
        """
        now = datetime.now(timezone.utc)
        status = {}
        for comp, last_beat in self.component_health.items():
            age = (now - last_beat).total_seconds()
            if age < 60:
                status[comp] = "healthy"
            elif age < 300:
                status[comp] = "degraded"
            else:
                status[comp] = "dead"
        return status

    def get_degraded_behavior(self, missing_component: str) -> DegradedMode:
        """Get instructions for how to behave when component is missing."""
        behaviors = {
            "monitor": DegradedMode(
                description="No monitoring - proceed with caution",
                loop_behavior="slow_mode",
                human_alert=True
            ),
            "pm": DegradedMode(
                description="No PM - pause on any conflict",
                loop_behavior="conservative",
                human_alert=True
            ),
            "message_bus": DegradedMode(
                description="No bus - fall back to file-based",
                loop_behavior="file_based",
                human_alert=True
            )
        }
        return behaviors.get(missing_component)
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| DEG-001 | Component death detected | Missing heartbeat detected within 2 min |
| DEG-002 | Human alerted | Alert published when component dies |
| DEG-003 | Loops adapt | Loops switch to degraded behavior |
| DEG-004 | Recovery | Components recover gracefully |
| DEG-005 | File-based fallback | Loops work (slowly) without message bus |

---

### Component 15: Orphan Cleaner

**Purpose:** Clean up orphaned resources from dead agents.

**Location:** `coding-loops/shared/orphan_cleaner.py`

**Problem Addressed:**
| Scenario | Orphan Created | Problem |
|----------|----------------|---------|
| Agent dies mid-test | File lock held forever | Other agents blocked |
| Agent dies mid-write | Half-written file | Corruption |
| Agent dies after checkpoint | Checkpoint never deleted | Disk fills up |

**API:**

```python
class CleanupResult:
    locks_released: int
    rolled_back: bool
    test_reset: bool

class OrphanCleaner:
    """Cleans up orphaned resources."""

    def __init__(self, bus: MessageBus, checkpoint_mgr: CheckpointManager):
        self.bus = bus
        self.checkpoint_mgr = checkpoint_mgr

    def cleanup_expired_locks(self) -> int:
        """Release all expired file locks. Returns count."""
        return self.bus.release_expired_locks()

    def cleanup_stale_checkpoints(self, max_age_hours: int = 24) -> int:
        """Delete checkpoints older than max_age. Returns count."""
        old_checkpoints = self.checkpoint_mgr.list_checkpoints(
            older_than=timedelta(hours=max_age_hours)
        )
        for cp in old_checkpoints:
            self.checkpoint_mgr.delete_checkpoint(cp.id)
        return len(old_checkpoints)

    def detect_partial_writes(self) -> list[str]:
        """Detect files that may be partially written."""
        # Check for files modified recently with no corresponding unlock event

    def cleanup_dead_loop(self, loop_id: str) -> CleanupResult:
        """Full cleanup after loop death."""
        result = CleanupResult()

        # Release all locks
        result.locks_released = self.bus.release_all_locks(loop_id)

        # Rollback any in-progress test
        result.rolled_back = self.checkpoint_mgr.rollback_if_exists(loop_id)

        # Update test state to reflect death
        result.test_reset = self._reset_in_progress_test(loop_id)

        return result
```

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| ORP-001 | Expired lock cleanup | Locks released after TTL |
| ORP-002 | Stale checkpoint cleanup | Old checkpoints deleted |
| ORP-003 | Dead loop cleanup | All resources released when loop dies |
| ORP-004 | Partial write detection | Half-written files detected |
| ORP-005 | Recovery after cleanup | Other loops can proceed after cleanup |

---

### Component 16: Loop Integration Updates

**Purpose:** Update existing loops to integrate with coordination system.

**Changes Required:**

1. **Publish events to message bus**
   - test_started when beginning test
   - test_passed/failed/blocked when complete
   - file_locked before modifying files
   - file_unlocked when done with files

2. **Check for pause requests**
   - Poll message bus for pause_requested events
   - Gracefully pause when requested
   - Resume on resume_requested

3. **Create checkpoints**
   - Call CheckpointManager before each test
   - Delete checkpoint on pass
   - Keep checkpoint on fail

4. **Report budget usage**
   - Estimate tokens from transcript
   - Report time spent
   - Check budget before starting test

5. **Use Verification Gate**
   - After claiming pass, submit to Verification Gate
   - Only mark passed if verification succeeds

6. **Use Knowledge Base**
   - Inject knowledge context into prompts
   - Record learned facts and decisions

7. **Handle digression alerts**
   - Receive digression_detected events
   - Stop and report status

8. **Work on dedicated branch**
   - Checkout loop's branch before work
   - Commit changes to loop branch

**Pass Criteria:**

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| INT-001 | Event publishing | Loop publishes all required events |
| INT-002 | Pause handling | Loop pauses within 30s of request |
| INT-003 | Resume handling | Loop resumes correctly |
| INT-004 | Checkpoint creation | Checkpoint exists before each test |
| INT-005 | Budget reporting | Usage recorded after each test |
| INT-006 | File locking | Locks acquired before file modification |
| INT-007 | Concurrent operation | 3 loops run without conflicts (file locks work) |

---

## Implementation Plan

### Phase 0: Dependencies (Day 0)

**Before ANY coding:**

1. Document all dependencies
2. Create requirements.txt
3. Update verify-system.py to check dependencies
4. Create system-requirements.yaml

### Phase 1: Foundation (Week 1)

**Goal:** Message bus, verification, git strategy, basic monitoring

| Day | Task | Deliverable | Tests |
|-----|------|-------------|-------|
| 1 | Message Bus implementation | `message_bus.py`, database schema | BUS-001 to BUS-008 |
| 2 | Verification Gate | `verification_gate.py` | VER-001 to VER-007 |
| 3 | Git Manager | `git_manager.py`, branch strategy | GIT-001 to GIT-006 |
| 4 | Monitor Agent basic | Health checking, stale detection | MON-001 to MON-003 |
| 5 | Loop integration | Loops publish events | INT-001 |

**Phase 1 Exit Criteria:**
- [ ] Message bus operational
- [ ] Verification gate blocks false passes
- [ ] Each loop has dedicated branch
- [ ] Monitor detects stuck loops
- [ ] 3 loops running with event publishing

---

### Phase 2: Coordination (Week 2)

**Goal:** PM agent, conflict resolution, semantic analysis, deadlock handling

| Day | Task | Deliverable | Tests |
|-----|------|-------------|-------|
| 1 | File locking | Lock mechanism in loops | BUS-005, BUS-006, INT-006 |
| 2 | Semantic Analyzer | `semantic_analyzer.py`, architecture rules | SEM-001 to SEM-005 |
| 3 | Deadlock Detector | `deadlock_detector.py` | DLK-001 to DLK-005 |
| 4 | PM Agent | Conflict resolution, priority | PM-001 to PM-008 |
| 5 | Pause/resume | CLI and loop integration | HUM-003, HUM-004, INT-002, INT-003 |

**Phase 2 Exit Criteria:**
- [ ] File locking prevents conflicts
- [ ] Semantic conflicts detected
- [ ] Deadlocks detected and resolved
- [ ] PM resolves conflicts automatically
- [ ] 3 loops run without stepping on each other

---

### Phase 3: Safety (Week 3-4)

**Goal:** Checkpoints, rollback, budget, regression detection, knowledge sharing

| Day | Task | Deliverable | Tests |
|-----|------|-------------|-------|
| 1 | Checkpoint Manager | Git-based checkpoints | CHK-001 to CHK-006 |
| 2 | Budget Manager | Usage tracking, limits | BUD-001 to BUD-005 |
| 3 | Regression Monitor | Continuous testing | REG-001 to REG-006 |
| 4 | Knowledge Base | Cross-agent context | KB-001 to KB-006 |
| 5 | Error Classifier | Error taxonomy | ERR-001 to ERR-006 |
| 6 | Loop integration | Checkpoints, budget, knowledge | INT-004, INT-005 |
| 7 | End-to-end test | Rollback scenario | E2E-004 |

**Phase 3 Exit Criteria:**
- [ ] Checkpoints created before each test
- [ ] Rollback restores correct state
- [ ] Budget tracked and limits enforced
- [ ] Regressions detected with blame
- [ ] Knowledge shared across agents

---

### Phase 4: Resilience & Human Interface (Week 5-6)

**Goal:** Degradation, cleanup, full CLI, 24-hour stability

| Day | Task | Deliverable | Tests |
|-----|------|-------------|-------|
| 1 | Degradation Manager | Graceful degradation | DEG-001 to DEG-005 |
| 2 | Orphan Cleaner | Resource cleanup | ORP-001 to ORP-005 |
| 3 | Human Interface | Full CLI | HUM-001 to HUM-008 |
| 4 | Decision system | PM escalates, human responds | PM-004, PM-005, HUM-006 |
| 5 | Summary generation | AI-generated status | HUM-007 |
| 6 | Continuous operation | 24-hour test | SAT-006 |
| 7 | Documentation | Operator runbook, user guide | SAT-* |

**Phase 4 Exit Criteria:**
- [ ] Full CLI operational
- [ ] System survives component failures
- [ ] Orphans cleaned up automatically
- [ ] Decisions flow human -> PM -> loops
- [ ] System runs 24h without intervention
- [ ] All SAT-* tests passing

---

## Test Execution Plan

### Test Environment Setup

```bash
# Create test database
python3 -c "from coding_loops.shared.message_bus import MessageBus; MessageBus('coding-loops/test-coordination.db')"

# Run all tests
python3 -m pytest coding-loops/tests/ -v

# Run specific component tests
python3 -m pytest coding-loops/tests/test_message_bus.py -v
python3 -m pytest coding-loops/tests/test_verification.py -v
python3 -m pytest coding-loops/tests/test_git_manager.py -v
python3 -m pytest coding-loops/tests/test_monitor.py -v
python3 -m pytest coding-loops/tests/test_pm.py -v
python3 -m pytest coding-loops/tests/test_semantic.py -v
python3 -m pytest coding-loops/tests/test_deadlock.py -v
python3 -m pytest coding-loops/tests/test_checkpoint.py -v
python3 -m pytest coding-loops/tests/test_budget.py -v
python3 -m pytest coding-loops/tests/test_regression.py -v
python3 -m pytest coding-loops/tests/test_knowledge.py -v
python3 -m pytest coding-loops/tests/test_error.py -v
python3 -m pytest coding-loops/tests/test_degradation.py -v
python3 -m pytest coding-loops/tests/test_orphan.py -v
python3 -m pytest coding-loops/tests/test_human.py -v
python3 -m pytest coding-loops/tests/test_integration.py -v
python3 -m pytest coding-loops/tests/test_acceptance.py -v
```

### End-to-End Test Scenarios

#### Scenario E2E-001: Basic Concurrent Operation

**Setup:**
1. Start Monitor Agent
2. Start PM Agent
3. Start Loop 1, 2, 3

**Expected:**
- All loops publish test_started events
- Monitor reads all health files
- Timeline shows interleaved events from all sources
- No conflicts (loops work on different files)

**Pass Definition:**
- 3 loops run for 30 minutes
- Each passes at least 1 test
- All tests verified by Verification Gate
- No errors in any agent logs
- Timeline shows events from all sources

---

#### Scenario E2E-002: Conflict Resolution

**Setup:**
1. Start all agents
2. Modify Loop 1 and Loop 2 to both target same file

**Expected:**
- Both loops attempt to lock file
- One succeeds, one fails
- Monitor detects conflict
- PM pauses lower-priority loop
- Higher-priority loop completes
- PM resumes other loop

**Pass Definition:**
- Conflict detected within 60s
- Lower-priority loop paused
- No file corruption
- Both loops eventually complete their work

---

#### Scenario E2E-003: Stuck Loop Recovery

**Setup:**
1. Start all agents
2. Introduce impossible test in Loop 1

**Expected:**
- Loop 1 fails test 3 times
- Monitor detects stuck pattern
- PM escalates to human (decision_needed)
- Human skips test via CLI
- Loop 1 continues to next test

**Pass Definition:**
- Stuck detected after 3 failures
- Decision request published
- CLI shows decision
- Skip command works
- Loop continues

---

#### Scenario E2E-004: Rollback on Break

**Setup:**
1. Start all agents
2. Loop introduces change that breaks build

**Expected:**
- Loop modifies file
- Verification Gate runs TypeScript check
- TypeScript check fails
- Checkpoint available
- Rollback triggered
- Build passes again

**Pass Definition:**
- Build break detected by Verification Gate
- Rollback executed
- Files restored to checkpoint
- Build passes after rollback

---

#### Scenario E2E-005: 24-Hour Continuous Operation

**Setup:**
1. Start all agents with realistic test load
2. Run for 24 hours with periodic human checks

**Expected:**
- All agents remain responsive
- No memory leaks
- No database corruption
- Tests continue to pass
- Conflicts resolved automatically
- Stuck tests escalated properly

**Pass Definition:**
- All agents running after 24h
- Logs show no crashes/restarts
- Progress made (tests passing)
- No human intervention required for routine operations

---

### System Acceptance Tests

| Test ID | Description | Pass Definition |
|---------|-------------|-----------------|
| SAT-001 | 3 loops, 1 hour, no conflicts | All loops run 1 hour, each passes 3+ tests, zero conflicts |
| SAT-002 | Conflict injection | Inject conflict, PM resolves within 2 min, no data loss |
| SAT-003 | Loop death recovery | Kill loop, system recovers, other loops continue |
| SAT-004 | Monitor death recovery | Kill monitor, loops switch to degraded, human alerted |
| SAT-005 | PM death recovery | Kill PM, loops pause on conflict, human alerted |
| SAT-006 | Full 24-hour run | All components run 24h, >50 tests passed total, <5 human interventions |
| SAT-007 | Rollback effectiveness | Inject breaking change, rollback succeeds, build passes |
| SAT-008 | Human decision flow | Escalate decision, human responds via CLI, applied correctly |
| SAT-009 | Budget enforcement | Exhaust budget, loop pauses, no over-spend |
| SAT-010 | Zero data loss | After 24h run, all events in database, no corruption |

---

## File Structure

```
coding-loops/
+-- shared/
|   +-- __init__.py
|   +-- ralph_loop_base.py         # Updated with integration
|   +-- message_bus.py             # NEW: Event bus
|   +-- verification_gate.py       # NEW: Independent verification
|   +-- git_manager.py             # NEW: Branch strategy
|   +-- semantic_analyzer.py       # NEW: Semantic conflicts
|   +-- knowledge_base.py          # NEW: Cross-agent knowledge
|   +-- checkpoint_manager.py      # NEW: Git checkpoints
|   +-- budget_manager.py          # NEW: Resource tracking
|   +-- regression_monitor.py      # NEW: Regression detection
|   +-- deadlock_detector.py       # NEW: Deadlock handling
|   +-- error_classifier.py        # NEW: Error taxonomy
|   +-- degradation_manager.py     # NEW: Graceful degradation
|   +-- orphan_cleaner.py          # NEW: Orphan cleanup
|   +-- config_schema.json
|   +-- test_state_schema.json
+-- agents/
|   +-- __init__.py
|   +-- monitor_agent.py           # NEW: Monitoring
|   +-- pm_agent.py                # NEW: Project management
|   +-- human_agent.py             # NEW: Human interface
+-- cli.py                         # NEW: CLI tool
+-- coordination.db                # NEW: SQLite database
+-- monitor-state.json             # NEW: Monitor state
+-- architecture-rules.yaml        # NEW: Architecture rules
+-- tests/
|   +-- __init__.py
|   +-- test_message_bus.py        # NEW
|   +-- test_verification.py       # NEW
|   +-- test_git_manager.py        # NEW
|   +-- test_semantic.py           # NEW
|   +-- test_knowledge.py          # NEW
|   +-- test_monitor.py            # NEW
|   +-- test_pm.py                 # NEW
|   +-- test_checkpoint.py         # NEW
|   +-- test_budget.py             # NEW
|   +-- test_regression.py         # NEW
|   +-- test_deadlock.py           # NEW
|   +-- test_error.py              # NEW
|   +-- test_degradation.py        # NEW
|   +-- test_orphan.py             # NEW
|   +-- test_human.py              # NEW
|   +-- test_integration.py        # NEW
|   +-- test_acceptance.py         # NEW
+-- docs/
|   +-- OPERATOR-RUNBOOK.md        # NEW
|   +-- USER-GUIDE.md              # NEW
+-- loop-1-critical-path/
+-- loop-2-infrastructure/
+-- loop-3-polish/
+-- verify-system.py
+-- requirements.txt               # NEW
+-- system-requirements.yaml       # NEW
+-- README.md
+-- 20260107-multi-agent-coordination-system-FINAL.md  # This file
```

---

## Dependencies

### Python Requirements (`coding-loops/requirements.txt`)

```
# Core (built-in, but document)
# sqlite3

# Schema validation
jsonschema>=4.0.0

# Testing
pytest>=7.0.0
pytest-asyncio>=0.21.0

# CLI interface
rich>=13.0.0
click>=8.0.0

# YAML config
pyyaml>=6.0.0
```

### System Requirements (`coding-loops/system-requirements.yaml`)

```yaml
python:
  minimum: "3.10"
  recommended: "3.12"

node:
  minimum: "18.0.0"
  recommended: "20.0.0"

claude_cli:
  minimum: "2.0.0"
  recommended: "2.0.76"

git:
  minimum: "2.30.0"

disk_space:
  minimum: "10GB"  # For checkpoints, transcripts, database

memory:
  minimum: "4GB"
  recommended: "8GB"
```

### Dependency Verification

Add to `verify-system.py`:

```python
def check_dependencies() -> list[str]:
    """Check all dependencies are available. Returns list of issues."""
    issues = []

    # Python version
    if sys.version_info < (3, 10):
        issues.append(f"Python 3.10+ required, found {sys.version}")

    # Node version
    result = subprocess.run(["node", "--version"], capture_output=True, text=True)
    node_version = result.stdout.strip().lstrip("v")
    if version.parse(node_version) < version.parse("18.0.0"):
        issues.append(f"Node 18+ required, found {node_version}")

    # Claude CLI
    result = subprocess.run(["claude", "--version"], capture_output=True, text=True)
    # Parse and check version

    # Git
    result = subprocess.run(["git", "--version"], capture_output=True, text=True)
    # Parse and check version

    # Disk space
    usage = shutil.disk_usage(".")
    if usage.free < 10 * 1024 * 1024 * 1024:  # 10GB
        issues.append(f"Need 10GB free disk, have {usage.free / 1024 / 1024 / 1024:.1f}GB")

    return issues
```

---

## Success Metrics

### Quantitative

| Metric | Target |
|--------|--------|
| Conflict resolution time | <2 minutes |
| Stuck detection time | <5 minutes |
| Verification gate latency | <60 seconds |
| Human response to decision | <1 hour (during work hours) |
| System uptime | >99% |
| Tests passing per day | >10 per loop |
| False positive alerts | <10% |
| False positive "passed" claims | 0% (verified) |

### Qualitative

- Humans can understand system state from CLI
- Conflicts are resolved without file corruption
- Stuck loops don't waste resources
- Rollback actually restores working state
- Multiple loops work together effectively
- Agent claims are verified independently
- Knowledge is shared across agents

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Database corruption | WAL mode, regular backups |
| Agent crash | Systemd/supervisor auto-restart |
| Infinite loop in agent | Timeout all operations |
| Git conflicts | Each loop works on branch, PM merges |
| API rate limits | Budget manager enforces limits |
| Human unavailable | Auto-skip after timeout |
| False "passed" claims | Verification Gate with independent checks |
| Semantic conflicts | Semantic Analyzer cross-checks |
| Deadlock | Deadlock Detector with victim selection |
| Component failure | Graceful degradation protocols |
| Orphaned resources | Orphan Cleaner with TTLs |

---

## Operator Runbook

See `coding-loops/docs/OPERATOR-RUNBOOK.md` for full runbook.

### Quick Reference

**Quick Status Check:**
```bash
python3 coding-loops/cli.py status
python3 coding-loops/cli.py health
```

**Loop Stuck:**
```bash
python3 coding-loops/cli.py status loop-1
cat coding-loops/loop-1-critical-path/specs/health.json
python3 coding-loops/cli.py skip CP-UFS-001  # If stuck on test
python3 coding-loops/cli.py restart loop-1   # If frozen
```

**Monitor Not Responding:**
```bash
ps aux | grep monitor_agent
python3 coding-loops/agents/monitor_agent.py &  # Restart
```

**Database Corruption:**
```bash
sqlite3 coding-loops/coordination.db "PRAGMA integrity_check"
# Stop all agents
cp coding-loops/backups/coordination-*.db coding-loops/coordination.db
# Restart agents
```

**All Loops Blocked:**
```bash
python3 coding-loops/cli.py locks
python3 coding-loops/cli.py deadlocks
python3 coding-loops/cli.py force-unlock loop-1
python3 coding-loops/cli.py pause all && python3 coding-loops/cli.py resume all
```

---

## Handoff Checklist

Before handing to coding agent:

- [x] This document reviewed and complete
- [x] Database schema finalized
- [x] Event types finalized
- [x] CLI commands finalized
- [x] Test scenarios cover all failure modes
- [x] Pass definitions are unambiguous
- [x] File structure is clear
- [x] Dependencies identified
- [x] Architecture rules defined
- [x] Verification Gate specified
- [x] Git branching strategy defined
- [x] Knowledge Base schema defined
- [x] Error taxonomy defined
- [x] Graceful degradation protocols defined
- [x] Operator runbook outlined
- [x] All 116 tests specified

---

## Appendix

### Complete Test Summary

| Component | Tests |
|-----------|-------|
| Message Bus (BUS) | 8 |
| Monitor (MON) | 8 |
| PM (PM) | 8 |
| Human (HUM) | 8 |
| Checkpoint (CHK) | 6 |
| Budget (BUD) | 5 |
| Verification (VER) | 7 |
| Git (GIT) | 6 |
| Semantic (SEM) | 5 |
| Knowledge (KB) | 6 |
| Regression (REG) | 6 |
| Deadlock (DLK) | 5 |
| Error (ERR) | 6 |
| Degradation (DEG) | 5 |
| Orphan (ORP) | 5 |
| Integration (INT) | 7 |
| E2E | 5 |
| Acceptance (SAT) | 10 |
| **Total** | **116** |

### Event Payload Schemas

#### test_started
```json
{
  "test_id": "CP-UFS-001",
  "loop_id": "loop-1-critical-path",
  "attempt": 1,
  "spec_summary": "Complete remaining SC-* tests"
}
```

#### test_passed/failed/blocked
```json
{
  "test_id": "CP-UFS-001",
  "loop_id": "loop-1-critical-path",
  "attempt": 1,
  "duration_seconds": 180,
  "tokens_used": 15000,
  "files_modified": ["file1.ts", "file2.ts"],
  "verified": true,
  "verification_checks": {"typescript": true, "build": true, "tests": true},
  "error_message": null
}
```

#### file_locked/unlocked
```json
{
  "file_path": "server/api.ts",
  "loop_id": "loop-1-critical-path",
  "test_id": "CP-UFS-001",
  "reason": "Modifying API endpoint"
}
```

#### file_conflict
```json
{
  "file_path": "server/api.ts",
  "loop_a": "loop-1-critical-path",
  "loop_b": "loop-2-infrastructure",
  "time_a": "2026-01-07T10:00:00Z",
  "time_b": "2026-01-07T10:02:00Z"
}
```

#### regression_detected
```json
{
  "test_id": "CP-UFS-001",
  "last_passed_commit": "abc123",
  "current_commit": "def456",
  "blamed_loop": "loop-2-infrastructure",
  "blamed_test": "CP-INF-003"
}
```

#### decision_needed
```json
{
  "decision_id": "DEC-001",
  "type": "conflict_resolution",
  "summary": "Loop 1 and Loop 2 both modified server/api.ts",
  "options": [
    {"id": "A", "description": "Keep Loop 1's changes (auth middleware)"},
    {"id": "B", "description": "Keep Loop 2's changes (credit endpoint)"},
    {"id": "C", "description": "Manual merge required"}
  ],
  "default": "A",
  "timeout_minutes": 60
}
```

#### force_release
```json
{
  "loop_id": "loop-2-infrastructure",
  "reason": "Deadlock detected",
  "must_rollback": true
}
```

#### human_message
```json
{
  "message_type": "decision_response",
  "decision_id": "DEC-001",
  "choice": "A",
  "comment": "Auth is higher priority"
}
```

---

*Plan created: 2026-01-07*
*Version: 2.0 FINAL*
*Ready for coding agent handoff*
*Total tests: 116*
*Estimated effort: 6 weeks*
