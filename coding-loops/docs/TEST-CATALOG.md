# Test Catalog

**Version:** 1.0
**Total Tests:** 116+
**Framework:** pytest

---

## Test Categories

| Category | Prefix | Count | Description |
|----------|--------|-------|-------------|
| Message Bus | BUS | 8 | Event bus functionality |
| Verification | VER | 7 | Independent verification |
| Git | GIT | 6 | Branch management |
| Checkpoint | CHK | 6 | Checkpoint/rollback |
| Budget | BUD | 5 | Usage tracking |
| Knowledge | KB | 6 | Knowledge base |
| Regression | REG | 6 | Regression detection |
| Deadlock | DLK | 5 | Deadlock detection |
| Semantic | SEM | 5 | Semantic analysis |
| Error | ERR | 6 | Error classification |
| Degradation | DEG | 5 | Graceful degradation |
| Orphan | ORP | 5 | Orphan cleanup |
| Monitor | MON | 8 | Monitor agent |
| PM | PM | 8 | PM agent |
| Human | HUM | 8 | Human interface |
| Integration | INT | 7 | Loop integration |
| E2E | E2E | 5 | End-to-end scenarios |
| Acceptance | SAT | 10 | System acceptance |

---

## Message Bus (BUS)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| BUS-001 | Publish event | Event in database with correct timestamp, source, type, payload |
| BUS-002 | Subscribe to events | Subscription created, poll returns matching events only |
| BUS-003 | Acknowledge event | Event marked acknowledged, not returned in subsequent polls |
| BUS-004 | Timeline query | Returns events in timestamp order with correct filters applied |
| BUS-005 | File locking | Lock acquired returns True, second attempt returns False, unlock works |
| BUS-006 | Lock expiry | Lock with TTL expires, can be reacquired after expiry |
| BUS-007 | Concurrent access | 3 processes publish/poll simultaneously without corruption |
| BUS-008 | Integration | Loop publishes test_started, test_passed events correctly |

---

## Verification Gate (VER)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| VER-001 | TypeScript check | `npx tsc --noEmit` runs, exit code checked correctly |
| VER-002 | Test execution | Relevant test file found and executed, result captured |
| VER-003 | Build check | `npm run build` runs, exit code checked correctly |
| VER-004 | Lint check | Lint runs on changed files, errors detected |
| VER-005 | Regression check | Previously passing tests are re-run, failures detected |
| VER-006 | Block false pass | Agent claims pass but tsc fails → test stays in_progress |
| VER-007 | Confirm true pass | Agent claims pass, all checks pass → test marked passed |

---

## Git Manager (GIT)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| GIT-001 | Branch creation | `loop-1/working` branch created, exists in git |
| GIT-002 | Rebase from main | Loop branch rebased without conflicts, commits preserved |
| GIT-003 | Conflict detection | Modified files detected before merge attempt |
| GIT-004 | PR creation | PR created (if GitHub), correct base/head branches |
| GIT-005 | Commit changes | Commit created with correct message, files staged |
| GIT-006 | Main protection | Direct commits to main blocked, only via merge |

---

## Checkpoint Manager (CHK)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| CHK-001 | Create checkpoint | Git ref created, checkpoint recorded in database |
| CHK-002 | Rollback | Files restored to checkpoint state, working directory clean |
| CHK-003 | Delete checkpoint | Git ref deleted, database record marked deleted |
| CHK-004 | List checkpoints | Returns all active checkpoints with correct metadata |
| CHK-005 | Loop integration | Loop creates checkpoint before each test automatically |
| CHK-006 | Auto-rollback | Build break triggers rollback without human intervention |

---

## Budget Manager (BUD)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| BUD-001 | Record usage | Usage record stored with tokens, duration, files |
| BUD-002 | Warning threshold | (Reporting only) Shows when usage is high |
| BUD-003 | Report generation | Daily/weekly report with breakdown by loop/test |
| BUD-004 | Query usage | Can query usage by loop, by date, by test |
| BUD-005 | Integration | Loops report usage after each test attempt |

---

## Knowledge Base (KB)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| KB-001 | Record fact | Fact stored with metadata, queryable |
| KB-002 | Record decision | Decision stored with rationale and affected areas |
| KB-003 | Query by topic | Returns relevant items sorted by relevance |
| KB-004 | Context injection | get_context_for_test returns formatted context |
| KB-005 | Consistency | Agent follows recorded decisions in subsequent tests |
| KB-006 | Conflict detection | Conflicting knowledge triggers decision_needed event |

---

## Regression Monitor (REG)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| REG-001 | Record passing | Passing test + commit recorded in database |
| REG-002 | Detect regression | Test that passed at commit A fails at commit B → detected |
| REG-003 | Blame attribution | Correct loop/test identified as cause via git history |
| REG-004 | Event published | regression_detected event published with details |
| REG-005 | PM notification | PM agent receives event and takes action |
| REG-006 | Auto-rollback | Regression can trigger automatic rollback of blamed loop |

---

## Deadlock Detector (DLK)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| DLK-001 | Record waits | Wait graph updated when lock acquisition fails |
| DLK-002 | Cycle detection | A→B→A cycle detected within 30 seconds |
| DLK-003 | Victim selection | Lower priority loop selected as victim |
| DLK-004 | Force release | Victim receives force_release event, releases locks |
| DLK-005 | Recovery | Both loops continue working after deadlock resolution |

---

## Semantic Analyzer (SEM)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| SEM-001 | Export detection | New exports identified with types/signatures |
| SEM-002 | Naming check | camelCase/PascalCase violations flagged |
| SEM-003 | Boundary check | Cross-boundary imports (frontend→server) flagged |
| SEM-004 | Conflict detection | Duplicate exports across loops detected |
| SEM-005 | Architecture compliance | Violations of architecture-rules.yaml blocked |

---

## Error Classifier (ERR)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| ERR-001 | Transient classification | Timeout/rate limit classified as TRANSIENT |
| ERR-002 | Transient handling | TRANSIENT errors retried with exponential backoff |
| ERR-003 | System classification | Database/SQLite error classified as SYSTEM |
| ERR-004 | System handling | SYSTEM error stops all loops, alerts human |
| ERR-005 | Human classification | Ambiguous spec classified as HUMAN |
| ERR-006 | Human handling | HUMAN error triggers decision_needed event |

---

## Degradation Manager (DEG)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| DEG-001 | Death detection | Missing heartbeat >2 min triggers degraded status |
| DEG-002 | Human alert | Alert published when component marked dead |
| DEG-003 | Loop adaptation | Loops switch to slow_mode when monitor dead |
| DEG-004 | Recovery | Component restart detected, normal mode resumes |
| DEG-005 | File fallback | Loops work (slowly) if message bus unavailable |

---

## Orphan Cleaner (ORP)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| ORP-001 | Lock cleanup | Locks released after TTL regardless of owner state |
| ORP-002 | Checkpoint cleanup | Checkpoints older than 24h deleted |
| ORP-003 | Dead loop cleanup | All resources released when loop dies |
| ORP-004 | Partial write detection | Files modified without unlock event flagged |
| ORP-005 | Recovery | Other loops proceed after orphan cleanup |

---

## Monitor Agent (MON)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| MON-001 | Health check | Reads all loop health, updates component_health table |
| MON-002 | Stale detection | Alert published when heartbeat >2 min old |
| MON-003 | Stuck detection | stuck_detected after 3 consecutive failures same test |
| MON-004 | Conflict detection | file_conflict when two loops modify same file |
| MON-005 | Digression detection | digression_detected when >20 files modified |
| MON-006 | Resource warning | resource_warning published (informational only) |
| MON-007 | Continuous operation | Runs 10 min without crash, handles loop restarts |
| MON-008 | CLI integration | Monitor alerts visible via `cli.py status` |

---

## PM Agent (PM)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| PM-001 | Receive conflict | Subscribes to file_conflict, processes within 30s |
| PM-002 | Resolve conflict | pause_requested sent to lower-priority loop |
| PM-003 | Track dependencies | resume_requested sent when dependency satisfied |
| PM-004 | Escalate decision | decision_needed published with clear options |
| PM-005 | Apply decision | Human response applied, loops notified |
| PM-006 | Handle loop failure | Work redistributed when loop dies |
| PM-007 | Continuous operation | Runs 10 min, handles all event types |
| PM-008 | Integration | PM decisions affect loop behavior |

---

## Human Interface (HUM)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| HUM-001 | Status command | Shows all loops with test, progress, health |
| HUM-002 | Timeline command | Shows recent events in readable format |
| HUM-003 | Pause command | Loop stops within 30s of command |
| HUM-004 | Resume command | Loop resumes from correct state |
| HUM-005 | Skip command | Test marked skipped, loop moves to next |
| HUM-006 | Decision command | Decision applied, PM notified |
| HUM-007 | Summary command | AI generates coherent summary |
| HUM-008 | Telegram | Notifications send, responses received |

---

## Integration (INT)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| INT-001 | Event publishing | Loop publishes test_started, passed, failed |
| INT-002 | Pause handling | Loop pauses within 30s of pause_requested |
| INT-003 | Resume handling | Loop resumes correctly from pause |
| INT-004 | Checkpoint creation | Checkpoint exists before each test |
| INT-005 | Budget reporting | Usage recorded after each test |
| INT-006 | File locking | Locks acquired before modification |
| INT-007 | Concurrent operation | 3 loops run without conflicts |

---

## End-to-End (E2E)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| E2E-001 | Basic concurrent | 3 loops 30 min, each passes 1+ tests, no conflicts |
| E2E-002 | Conflict resolution | Conflict injected, PM resolves <2 min, no data loss |
| E2E-003 | Stuck recovery | Loop stuck 3x, decision_needed, skip works |
| E2E-004 | Rollback | Breaking change detected, rollback succeeds |
| E2E-005 | Extended operation | 1 hour, all agents stable, progress made |

---

## System Acceptance (SAT)

| ID | Description | Pass Definition |
|----|-------------|-----------------|
| SAT-001 | 3 loops 1 hour | Each passes 3+ tests, zero conflicts |
| SAT-002 | Conflict injection | PM resolves <2 min, no data loss |
| SAT-003 | Loop death recovery | Kill loop, system recovers, others continue |
| SAT-004 | Monitor death | Loops switch to degraded, human alerted |
| SAT-005 | PM death | Loops pause on conflict, human alerted |
| SAT-006 | 24-hour run | >50 tests passed, <5 human interventions |
| SAT-007 | Rollback effectiveness | Breaking change rolled back, build passes |
| SAT-008 | Human decision | Decision flows CLI→PM→loops correctly |
| SAT-009 | Usage reporting | Usage tracked accurately for entire run |
| SAT-010 | Data integrity | All events in DB, integrity check passes |

---

## Running Tests

```bash
# All tests
python3 -m pytest coding-loops/tests/ -v

# By category
python3 -m pytest coding-loops/tests/test_message_bus.py -v
python3 -m pytest coding-loops/tests/ -k "BUS" -v

# With coverage
python3 -m pytest coding-loops/tests/ --cov=coding-loops/shared

# E2E only (slow)
python3 -m pytest coding-loops/tests/test_e2e.py -v --timeout=3600
```

---

*Total: 116 tests across 18 categories*
