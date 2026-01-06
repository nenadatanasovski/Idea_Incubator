# Operator Runbook

**Version:** 1.0
**Created:** 2026-01-07

Quick reference for operating and troubleshooting the coordination system.

---

## Quick Status Check

```bash
# Overall system status
python3 coding-loops/cli.py status

# Health of all components
python3 coding-loops/cli.py health

# Recent events
python3 coding-loops/cli.py timeline --since 1h
```

---

## Starting the System

### Start All Components

```bash
# Terminal 1: Monitor Agent
python3 coding-loops/agents/monitor_agent.py

# Terminal 2: PM Agent
python3 coding-loops/agents/pm_agent.py

# Terminal 3: Loop 1 (Critical Path)
python3 coding-loops/loop-1-critical-path/run_loop.py

# Terminal 4: Loop 2 (Infrastructure)
python3 coding-loops/loop-2-infrastructure/run_loop.py

# Terminal 5: Loop 3 (Polish)
python3 coding-loops/loop-3-polish/run_loop.py
```

### Verify Startup

```bash
# Check all components are healthy
python3 coding-loops/cli.py health

# Expected output:
# monitor: healthy (last heartbeat: 5s ago)
# pm: healthy (last heartbeat: 3s ago)
# loop-1: running (current test: CP-UFS-001)
# loop-2: running (current test: INF-AUTH-001)
# loop-3: running (current test: POL-MON-001)
```

---

## Common Issues

### Loop Stuck on Same Test

**Symptoms:** Same test showing for >30 minutes

**Diagnosis:**
```bash
# Check loop status
python3 coding-loops/cli.py status loop-1

# Check health file (legacy)
cat coding-loops/loop-1-critical-path/specs/health.json | jq

# Check recent events for that test
python3 coding-loops/cli.py timeline --filter test_id=CP-UFS-001
```

**Resolution:**
```bash
# Option 1: Skip the test
python3 coding-loops/cli.py skip CP-UFS-001

# Option 2: Reset and retry
python3 coding-loops/cli.py reset CP-UFS-001

# Option 3: Restart the loop
python3 coding-loops/cli.py restart loop-1
```

---

### Monitor Not Responding

**Symptoms:** No alerts for known issues, health showing stale

**Diagnosis:**
```bash
# Check if process is running
ps aux | grep monitor_agent

# Check last heartbeat
python3 coding-loops/cli.py health

# Check monitor state
sqlite3 coding-loops/coordination.db "SELECT * FROM component_health WHERE component='monitor'"
```

**Resolution:**
```bash
# Restart monitor
pkill -f monitor_agent.py
python3 coding-loops/agents/monitor_agent.py &

# Loops will auto-switch to degraded mode
# Check degraded behavior
python3 coding-loops/cli.py status
```

---

### All Loops Blocked

**Symptoms:** No progress, all loops waiting

**Diagnosis:**
```bash
# Check for locks
python3 coding-loops/cli.py locks

# Check for deadlocks
python3 coding-loops/cli.py deadlocks

# Check pending decisions
python3 coding-loops/cli.py decisions
```

**Resolution:**
```bash
# If deadlock detected
python3 coding-loops/cli.py force-unlock loop-1

# If waiting for decision
python3 coding-loops/cli.py decide DEC-001 A

# Nuclear option: pause all and resume
python3 coding-loops/cli.py pause all
python3 coding-loops/cli.py resume all
```

---

### Database Issues

**Symptoms:** SQLite errors in logs

**Diagnosis:**
```bash
# Check database integrity
sqlite3 coding-loops/coordination.db "PRAGMA integrity_check"

# Check database size
ls -la coding-loops/coordination.db

# Check WAL mode
sqlite3 coding-loops/coordination.db "PRAGMA journal_mode"
```

**Resolution:**
```bash
# Stop all agents first
python3 coding-loops/cli.py pause all

# If integrity check fails, restore from backup
cp coding-loops/backups/coordination-latest.db coding-loops/coordination.db

# Restart agents
python3 coding-loops/cli.py resume all
```

---

### Conflict Between Loops

**Symptoms:** file_conflict event, one loop paused

**Diagnosis:**
```bash
# Check conflict details
python3 coding-loops/cli.py conflicts

# Check which loop has priority
python3 coding-loops/cli.py status
```

**Resolution:**
```bash
# Usually auto-resolved by PM Agent
# If stuck, manually decide:
python3 coding-loops/cli.py decisions

# Choose winner
python3 coding-loops/cli.py decide DEC-001 A
```

---

### Regression Detected

**Symptoms:** regression_detected event, previously passing test fails

**Diagnosis:**
```bash
# Check regression details
python3 coding-loops/cli.py regressions

# See which commit broke it
sqlite3 coding-loops/coordination.db "SELECT * FROM passing_tests WHERE test_id='CP-UFS-001'"
```

**Resolution:**
```bash
# Option 1: Rollback blamed loop
python3 coding-loops/cli.py rollback loop-2

# Option 2: Fix forward (skip regression, file issue)
python3 coding-loops/cli.py skip CP-UFS-001 --reason "Regression from INF-AUTH-003"
```

---

## Telegram Commands

When away from desk, you can respond to decisions via Telegram:

| Message | Action |
|---------|--------|
| `/status` | Get current system status |
| `/decisions` | List pending decisions |
| `/decide DEC-001 A` | Make a decision |
| `/pause all` | Pause all loops |
| `/resume all` | Resume all loops |
| `/skip CP-UFS-001` | Skip a stuck test |

---

## Backup Procedures

### Daily Backup (Automated)

```bash
# Add to crontab
0 2 * * * sqlite3 /path/to/coding-loops/coordination.db ".backup /path/to/backups/coordination-$(date +%Y%m%d).db"
```

### Manual Backup

```bash
# Create backup
sqlite3 coding-loops/coordination.db ".backup coding-loops/backups/coordination-manual.db"

# Verify backup
sqlite3 coding-loops/backups/coordination-manual.db "PRAGMA integrity_check"
```

### Restore from Backup

```bash
# Stop all agents
python3 coding-loops/cli.py pause all

# Wait for agents to stop
sleep 10

# Replace database
cp coding-loops/backups/coordination-YYYYMMDD.db coding-loops/coordination.db

# Restart agents
python3 coding-loops/cli.py resume all
```

---

## Monitoring Dashboard

### Key Metrics to Watch

| Metric | Warning | Critical |
|--------|---------|----------|
| Tests passed / hour | <1 | 0 for 2 hours |
| Conflicts / hour | >5 | >10 |
| Stuck loops | 1 | 2+ |
| Decisions pending | >3 | >5 or oldest >1h |
| Database size | >500MB | >1GB |

### Recommended Check Frequency

| When | Check |
|------|-------|
| Morning | `cli.py summary` |
| Every few hours | `cli.py status` |
| End of day | `cli.py timeline --since 8h` |
| Weekly | Review transcripts, archive old checkpoints |

---

## Emergency Procedures

### Complete System Freeze

```bash
# Kill all Python processes
pkill -f "python3.*coding-loops"

# Wait
sleep 5

# Check database
sqlite3 coding-loops/coordination.db "PRAGMA integrity_check"

# If OK, restart from scratch
# (follow Starting the System section)
```

### Recovery After Crash

```bash
# Check what was in progress
sqlite3 coding-loops/coordination.db "SELECT * FROM tests WHERE status='in_progress'"

# Reset in-progress tests to pending
sqlite3 coding-loops/coordination.db "UPDATE tests SET status='pending' WHERE status='in_progress'"

# Cleanup orphaned locks
python3 coding-loops/cli.py force-unlock-all

# Cleanup stale checkpoints
# (checkpoint manager handles this on startup)

# Start system normally
```

---

## Log Locations

| Component | Log Location |
|-----------|--------------|
| Monitor Agent | stdout (redirect as needed) |
| PM Agent | stdout |
| Loop transcripts | `loop-*/specs/logs/transcripts/` |
| Database | `coordination.db` (query events table) |

---

## Contact

When all else fails:
1. Check the timeline for clues: `cli.py timeline --since 1h`
2. Check transcripts for the stuck loop
3. Consider resetting and retrying from last known good state

---

*Last Updated: 2026-01-07*
