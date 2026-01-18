# Phase 10: Log Retention & Archival - Task Checklist

> **Location:** `docs/specs/observability/tasks/phase-10-tasks.md`
> **Implementation Plan:** [implementation-plan-phase-10.md](../implementation-plan-phase-10.md)
> **Status:** Ready for execution

---

## Quick Reference

| ID       | Task                         | File                                              | Status |
| -------- | ---------------------------- | ------------------------------------------------- | ------ |
| OBS-1000 | Create Archive Configuration | `coding-loops/shared/archive_config.py`           | [ ]    |
| OBS-1001 | Create Archive Writer        | `coding-loops/shared/archive_writer.py`           | [ ]    |
| OBS-1002 | Create Database Archiver     | `coding-loops/shared/database_archiver.py`        | [ ]    |
| OBS-1003 | Create Archive Cleanup       | `coding-loops/shared/archive_cleanup.py`          | [ ]    |
| OBS-1004 | Create Log Archival Job      | `coding-loops/jobs/log_archival.py`               | [ ]    |
| OBS-1005 | Create Main CLI              | `coding-loops/cli.py`                             | [ ]    |
| OBS-1006 | Unit Tests - Archive Config  | `coding-loops/tests/test_archive_config.py`       | [ ]    |
| OBS-1007 | Unit Tests - Archive Writer  | `coding-loops/tests/test_archive_writer.py`       | [ ]    |
| OBS-1008 | Integration Tests            | `coding-loops/tests/test_archival_integration.py` | [ ]    |
| OBS-1009 | Cron Configuration           | `coding-loops/cron/archival-schedule.md`          | [ ]    |
| OBS-1010 | Package **init**.py Files    | `coding-loops/jobs/__init__.py`                   | [ ]    |
| OBS-1011 | CLI Help Documentation       | `coding-loops/README.md`                          | [ ]    |
| OBS-1012 | E2E Validation Script        | `coding-loops/tests/e2e/test_archival_e2e.sh`     | [ ]    |

---

## Task Details

### OBS-1000: Create Archive Configuration

**File:** `coding-loops/shared/archive_config.py`

#### Checklist

- [ ] Create `RetentionPolicy` dataclass with hot/warm/cold days
- [ ] Define `RETENTION_POLICIES` dictionary for all tables
- [ ] Create `EXEMPT_TABLES` list (execution summaries)
- [ ] Create `ArchiveConfig` dataclass with paths
- [ ] Implement `get_policy()` helper function
- [ ] Implement `is_exempt()` helper function
- [ ] Add `ensure_directories()` method

#### Test Script

```bash
python3 -c "
from coding_loops.shared.archive_config import (
    RETENTION_POLICIES, ArchiveConfig, get_policy, is_exempt
)
assert 'transcript_entries' in RETENTION_POLICIES
assert get_policy('transcript_entries').hot_days == 7
assert not is_exempt('transcript_entries')
print('OBS-1000: PASS')
"
```

#### Pass Criteria

- [ ] Script exits 0
- [ ] All assertions pass

---

### OBS-1001: Create Archive Writer

**File:** `coding-loops/shared/archive_writer.py`

#### Checklist

- [ ] Create `ArchiveWriter` class with context manager
- [ ] Implement gzip compression support
- [ ] Add `_archived_at` metadata to records
- [ ] Create `ArchiveReader` class for reading archives
- [ ] Implement `list_archives()` function
- [ ] Implement `get_archive_stats()` function
- [ ] Support date filtering in `list_archives()`

#### Test Script

```bash
python3 -c "
import tempfile
from pathlib import Path
from datetime import datetime
from coding_loops.shared.archive_writer import ArchiveWriter, ArchiveReader

with tempfile.TemporaryDirectory() as tmpdir:
    with ArchiveWriter(Path(tmpdir), 'test', datetime.now()) as w:
        w.write_record({'id': '1'})
    assert w.records_written == 1
    print('OBS-1001: PASS')
"
```

#### Pass Criteria

- [ ] Script exits 0
- [ ] Archive file created with gzip compression

---

### OBS-1002: Create Database Archiver

**File:** `coding-loops/shared/database_archiver.py`

#### Checklist

- [ ] Create `DatabaseArchiver` class with context manager
- [ ] Implement `archive_table()` with batch processing
- [ ] Implement `archive_all()` for all tables
- [ ] Implement `archive_transcripts()` convenience method
- [ ] Implement `archive_assertions()` convenience method
- [ ] Implement `get_table_stats()` for statistics
- [ ] Implement `get_all_stats()` for all tables
- [ ] Support dry run mode
- [ ] Delete records from database after successful archive

#### Test Script

```bash
python3 -c "
from coding_loops.shared.database_archiver import DatabaseArchiver
from coding_loops.shared.archive_config import ArchiveConfig

config = ArchiveConfig.default()
with DatabaseArchiver(config) as archiver:
    stats = archiver.get_all_stats()
    assert len(stats) > 0
print('OBS-1002: PASS')
"
```

#### Pass Criteria

- [ ] Script exits 0
- [ ] Stats returned for all tables

---

### OBS-1003: Create Archive Cleanup

**File:** `coding-loops/shared/archive_cleanup.py`

#### Checklist

- [ ] Create `ArchiveCleanup` class
- [ ] Implement `consolidate_to_cold()` - warm -> cold tar.gz
- [ ] Implement `purge_expired()` - delete past retention
- [ ] Implement `cleanup_all()` - run both operations
- [ ] Implement `get_retention_status()` - tier statistics
- [ ] Support dry run mode
- [ ] Remove empty directories after cleanup

#### Test Script

```bash
python3 -c "
from coding_loops.shared.archive_cleanup import ArchiveCleanup
from coding_loops.shared.archive_config import ArchiveConfig

cleanup = ArchiveCleanup(ArchiveConfig.default())
status = cleanup.get_retention_status()
assert 'warm' in status
assert 'cold' in status
print('OBS-1003: PASS')
"
```

#### Pass Criteria

- [ ] Script exits 0
- [ ] Status contains warm and cold sections

---

### OBS-1004: Create Log Archival Job

**File:** `coding-loops/jobs/log_archival.py`

#### Checklist

- [ ] Create `run_daily_archival()` function
- [ ] Create `run_weekly_archival()` function
- [ ] Create `run_monthly_cleanup()` function
- [ ] Create `run_full_archival()` function
- [ ] Implement CLI with argparse
- [ ] Support `--mode` argument (daily/weekly/monthly/full)
- [ ] Support `--dry-run` flag
- [ ] Support `--output` for JSON results
- [ ] Return exit code 0 on success

#### Test Script

```bash
python3 coding-loops/jobs/log_archival.py --mode daily --dry-run
# Should output JSON with "dry_run": true
```

#### Pass Criteria

- [ ] Command exits 0
- [ ] JSON output contains "dry_run": true

---

### OBS-1005: Create Main CLI

**File:** `coding-loops/cli.py`

#### Checklist

- [ ] Create main CLI with subcommands
- [ ] Implement `archive` command with targets
- [ ] Implement `cleanup` command
- [ ] Implement `retention status` subcommand
- [ ] Implement `retention policy` subcommand
- [ ] Implement `parse_duration()` for d/w/m/y suffixes
- [ ] Support `--dry-run` on all modification commands
- [ ] Support `--json` for machine-readable output
- [ ] Add comprehensive help text

#### Test Script

```bash
python3 coding-loops/cli.py --help
python3 coding-loops/cli.py archive transcripts --older-than 7d --dry-run
python3 coding-loops/cli.py retention status
python3 coding-loops/cli.py retention policy --json
```

#### Pass Criteria

- [ ] All commands exit 0
- [ ] Help displays correctly
- [ ] JSON output is valid

---

### OBS-1006: Unit Tests - Archive Config

**File:** `coding-loops/tests/test_archive_config.py`

#### Checklist

- [ ] Test `RetentionPolicy` threshold calculations
- [ ] Test zero cold_days edge case
- [ ] Test all required tables have policies
- [ ] Test `get_policy()` for existing/nonexistent tables
- [ ] Test `is_exempt()` for exempt/non-exempt tables
- [ ] Test `ArchiveConfig.default()`
- [ ] Test `ensure_directories()` creates folders

#### Test Script

```bash
cd coding-loops && python3 -m pytest tests/test_archive_config.py -v
```

#### Pass Criteria

- [ ] All tests pass
- [ ] No warnings

---

### OBS-1007: Unit Tests - Archive Writer

**File:** `coding-loops/tests/test_archive_writer.py`

#### Checklist

- [ ] Test compressed file creation
- [ ] Test uncompressed file creation
- [ ] Test `_archived_at` metadata added
- [ ] Test `records_written` counter
- [ ] Test `ArchiveReader` with compressed files
- [ ] Test `ArchiveReader` with uncompressed files
- [ ] Test `list_archives()` filtering
- [ ] Test `get_archive_stats()` calculations

#### Test Script

```bash
cd coding-loops && python3 -m pytest tests/test_archive_writer.py -v
```

#### Pass Criteria

- [ ] All tests pass

---

### OBS-1008: Integration Tests

**File:** `coding-loops/tests/test_archival_integration.py`

#### Checklist

- [ ] Create test database fixture with old/new records
- [ ] Test full archive workflow end-to-end
- [ ] Test dry run preserves all data
- [ ] Test exempt tables skipped
- [ ] Test cleanup consolidation creates tar.gz
- [ ] Test statistics tracking accuracy

#### Test Script

```bash
cd coding-loops && python3 -m pytest tests/test_archival_integration.py -v
```

#### Pass Criteria

- [ ] All tests pass
- [ ] No database modifications in dry run tests

---

### OBS-1009: Cron Configuration

**File:** `coding-loops/cron/archival-schedule.md`

#### Checklist

- [ ] Document daily cron schedule (2 AM)
- [ ] Document weekly cron schedule (Sunday 3 AM)
- [ ] Document monthly cron schedule (1st at 4 AM)
- [ ] Provide systemd timer alternative
- [ ] Include monitoring recommendations
- [ ] Include disk space planning

#### Test Script

```bash
# Verify cron syntax
echo "0 2 * * * /bin/true" | crontab - 2>/dev/null && echo "Cron syntax valid"
```

#### Pass Criteria

- [ ] Cron syntax is valid
- [ ] All schedules documented

---

### OBS-1010: Package **init**.py Files

**File:** `coding-loops/jobs/__init__.py` and update `coding-loops/shared/__init__.py`

#### Checklist

- [ ] Create `coding-loops/jobs/__init__.py`
- [ ] Update `coding-loops/shared/__init__.py` with archive exports
- [ ] Export all archive classes and functions
- [ ] Add module docstrings

#### Test Script

```bash
python3 -c "
from coding_loops.shared import ArchiveConfig, DatabaseArchiver
from coding_loops.jobs import JOBS_DIR
print('OBS-1010: PASS')
"
```

#### Pass Criteria

- [ ] Imports work without errors

---

### OBS-1011: CLI Help Documentation

**File:** Update `coding-loops/README.md`

#### Checklist

- [ ] Add "Observability Log Retention" section
- [ ] Document retention policies table
- [ ] Document all CLI commands with examples
- [ ] Document cron schedules
- [ ] Document archive directory structure

#### Test Script

```bash
grep -q "Log Retention" coding-loops/README.md
```

#### Pass Criteria

- [ ] README contains retention documentation

---

### OBS-1012: E2E Validation Script

**File:** `coding-loops/tests/e2e/test_archival_e2e.sh`

#### Checklist

- [ ] Test all CLI help commands
- [ ] Test archive commands in dry run mode
- [ ] Test cleanup commands in dry run mode
- [ ] Test retention commands
- [ ] Test Python module imports
- [ ] Test job modes (daily/weekly/monthly)
- [ ] Track pass/fail counts
- [ ] Exit 0 only if all pass

#### Test Script

```bash
chmod +x coding-loops/tests/e2e/test_archival_e2e.sh
./coding-loops/tests/e2e/test_archival_e2e.sh
```

#### Pass Criteria

- [ ] Script exits 0
- [ ] Output shows "All E2E tests PASSED"

---

## Final Validation

After completing all tasks, run:

```bash
# 1. Unit tests
cd coding-loops && python3 -m pytest tests/test_archive*.py -v

# 2. Integration tests
python3 -m pytest tests/test_archival_integration.py -v

# 3. E2E validation
./tests/e2e/test_archival_e2e.sh

# 4. Manual verification
python3 ../coding-loops/cli.py retention status

# 5. Full project tests (no regressions)
cd .. && npm test
```

### Phase 10 Complete When

- [ ] All 13 tasks checked off
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E script passes
- [ ] No regressions in existing tests
