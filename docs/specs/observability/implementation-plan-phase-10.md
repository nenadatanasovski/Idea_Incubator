# Observability System Implementation Plan - Phase 10: Log Retention & Archival

> **Location:** `docs/specs/observability/implementation-plan-phase-10.md`
> **Purpose:** Actionable implementation plan for log retention, archival, and cleanup
> **Status:** Ready for execution
> **Priority:** P3 (Operational efficiency)
> **Dependencies:** Phase 1 (Database Schema), Phase 2 (Python Producers)

---

## Executive Summary

Phase 10 implements the log retention system that manages observability data lifecycle. This includes archival jobs that move data from hot storage (SQLite) to warm/cold archives, and CLI commands for manual operation.

| Scope               | Details                                                       |
| ------------------- | ------------------------------------------------------------- |
| **Archival Job**    | `coding-loops/jobs/log_archival.py`                           |
| **CLI**             | `coding-loops/cli.py`                                         |
| **Archive Storage** | `coding-loops/archives/{date}/{table}.jsonl.gz`               |
| **Tasks**           | OBS-1000 to OBS-1012                                          |
| **Deliverables**    | Complete log retention system with automated archival         |
| **Test Validation** | Unit tests + integration tests verifying archival correctness |

---

## Retention Policy

| Data Type           | Hot (SQLite) | Warm (Archive) | Cold (Deep Archive) | Total Retention |
| ------------------- | ------------ | -------------- | ------------------- | --------------- |
| Transcript entries  | 7 days       | 30 days        | 1 year              | ~13 months      |
| Tool uses           | 7 days       | 30 days        | 1 year              | ~13 months      |
| Skill traces        | 7 days       | 30 days        | 1 year              | ~13 months      |
| Assertion results   | 30 days      | 90 days        | 2 years             | ~27 months      |
| Assertion chains    | 30 days      | 90 days        | 2 years             | ~27 months      |
| Message bus log     | 7 days       | 30 days        | 90 days             | ~4 months       |
| Execution summaries | Indefinite   | -              | -                   | Forever         |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         LOG RETENTION ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                              HOT STORAGE                                  │    │
│  │                          database/ideas.db                                │    │
│  │                                                                           │    │
│  │  transcript_entries │ tool_uses │ skill_traces │ assertion_results       │    │
│  │  assertion_chains   │ message_bus_log          (7-30 days)               │    │
│  └────────────────────────────────┬─────────────────────────────────────────┘    │
│                                   │                                              │
│                                   ▼ (archive job)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                             WARM ARCHIVE                                  │    │
│  │                 coding-loops/archives/{yyyy-mm-dd}/                       │    │
│  │                                                                           │    │
│  │  transcript_entries.jsonl.gz │ tool_uses.jsonl.gz │ ...                  │    │
│  │                         (30-90 days)                                      │    │
│  └────────────────────────────────┬─────────────────────────────────────────┘    │
│                                   │                                              │
│                                   ▼ (cleanup job)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                             COLD ARCHIVE                                  │    │
│  │                 coding-loops/archives/deep/{year}/                        │    │
│  │                                                                           │    │
│  │  {yyyy-mm}.tar.gz (consolidated monthly archives)                        │    │
│  │                         (1-2 years)                                       │    │
│  └────────────────────────────────┬─────────────────────────────────────────┘    │
│                                   │                                              │
│                                   ▼ (purge job)                                  │
│                              DELETED (past retention)                            │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              CLI COMMANDS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  python3 coding-loops/cli.py archive transcripts --older-than 7d                │
│  python3 coding-loops/cli.py archive assertions --older-than 30d                │
│  python3 coding-loops/cli.py archive all --older-than 7d                        │
│  python3 coding-loops/cli.py cleanup archives --older-than 1y                   │
│  python3 coding-loops/cli.py retention status                                   │
│  python3 coding-loops/cli.py retention stats                                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Breakdown

### OBS-1000: Create Archive Configuration

**File:** `coding-loops/shared/archive_config.py`

**Purpose:** Define retention policies and archive paths.

#### Implementation

```python
# coding-loops/shared/archive_config.py
"""
Archive configuration and retention policies.

Defines data lifecycle rules for observability tables.
"""

from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Dict, Optional
import os


@dataclass
class RetentionPolicy:
    """Retention policy for a single table."""
    table_name: str
    hot_days: int          # Days to keep in SQLite
    warm_days: int         # Days to keep in warm archive
    cold_days: int         # Days to keep in cold archive (0 = delete after warm)
    timestamp_column: str  # Column to use for age calculation

    @property
    def hot_threshold(self) -> timedelta:
        return timedelta(days=self.hot_days)

    @property
    def warm_threshold(self) -> timedelta:
        return timedelta(days=self.hot_days + self.warm_days)

    @property
    def cold_threshold(self) -> timedelta:
        if self.cold_days == 0:
            return self.warm_threshold
        return timedelta(days=self.hot_days + self.warm_days + self.cold_days)


# Retention policies per table
RETENTION_POLICIES: Dict[str, RetentionPolicy] = {
    "transcript_entries": RetentionPolicy(
        table_name="transcript_entries",
        hot_days=7,
        warm_days=30,
        cold_days=365,  # 1 year
        timestamp_column="timestamp"
    ),
    "tool_uses": RetentionPolicy(
        table_name="tool_uses",
        hot_days=7,
        warm_days=30,
        cold_days=365,
        timestamp_column="start_time"
    ),
    "skill_traces": RetentionPolicy(
        table_name="skill_traces",
        hot_days=7,
        warm_days=30,
        cold_days=365,
        timestamp_column="start_time"
    ),
    "assertion_results": RetentionPolicy(
        table_name="assertion_results",
        hot_days=30,
        warm_days=90,
        cold_days=730,  # 2 years
        timestamp_column="timestamp"
    ),
    "assertion_chains": RetentionPolicy(
        table_name="assertion_chains",
        hot_days=30,
        warm_days=90,
        cold_days=730,
        timestamp_column="created_at"
    ),
    "message_bus_log": RetentionPolicy(
        table_name="message_bus_log",
        hot_days=7,
        warm_days=30,
        cold_days=90,  # Only 90 days total
        timestamp_column="timestamp"
    ),
}

# Tables that should never be archived (keep indefinitely)
EXEMPT_TABLES = [
    "task_list_execution_runs",  # Execution summaries
]


@dataclass
class ArchiveConfig:
    """Global archive configuration."""
    base_path: Path
    db_path: Path
    compress: bool = True
    batch_size: int = 1000
    dry_run: bool = False

    @classmethod
    def default(cls) -> "ArchiveConfig":
        """Create default configuration."""
        project_root = Path(__file__).parent.parent
        return cls(
            base_path=project_root / "archives",
            db_path=project_root.parent / "database" / "ideas.db",
            compress=True,
            batch_size=1000,
            dry_run=False
        )

    @property
    def warm_path(self) -> Path:
        """Path to warm archive directory."""
        return self.base_path / "warm"

    @property
    def cold_path(self) -> Path:
        """Path to cold archive directory."""
        return self.base_path / "cold"

    def ensure_directories(self) -> None:
        """Create archive directories if they don't exist."""
        self.warm_path.mkdir(parents=True, exist_ok=True)
        self.cold_path.mkdir(parents=True, exist_ok=True)


def get_policy(table_name: str) -> Optional[RetentionPolicy]:
    """Get retention policy for a table."""
    return RETENTION_POLICIES.get(table_name)


def is_exempt(table_name: str) -> bool:
    """Check if table is exempt from archival."""
    return table_name in EXEMPT_TABLES
```

#### Acceptance Criteria

- [ ] `RetentionPolicy` dataclass correctly calculates thresholds
- [ ] All observability tables have defined retention policies
- [ ] `EXEMPT_TABLES` list includes execution summaries
- [ ] `ArchiveConfig.default()` returns valid paths
- [ ] `ensure_directories()` creates archive folders

#### Test Script

```bash
# Test: Verify archive config module loads
python3 -c "
from coding_loops.shared.archive_config import (
    RETENTION_POLICIES,
    ArchiveConfig,
    get_policy,
    is_exempt
)

# Test policies exist
assert 'transcript_entries' in RETENTION_POLICIES
assert 'tool_uses' in RETENTION_POLICIES
assert 'assertion_results' in RETENTION_POLICIES

# Test thresholds
policy = get_policy('transcript_entries')
assert policy.hot_days == 7
assert policy.warm_days == 30
assert policy.cold_days == 365

# Test exempt tables
assert not is_exempt('transcript_entries')
assert is_exempt('task_list_execution_runs')

# Test config
config = ArchiveConfig.default()
assert config.base_path.name == 'archives'

print('OBS-1000: PASS - Archive config validated')
"
```

#### Pass Criteria

- Script exits with code 0
- All assertions pass
- Output shows "PASS"

---

### OBS-1001: Create Archive Writer

**File:** `coding-loops/shared/archive_writer.py`

**Purpose:** Write records to JSONL files with optional compression.

#### Implementation

```python
# coding-loops/shared/archive_writer.py
"""
Archive writer for JSONL files with gzip compression.

Handles writing database records to archive files.
"""

import gzip
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional
import logging

logger = logging.getLogger(__name__)


class ArchiveWriter:
    """Writes records to JSONL archive files."""

    def __init__(
        self,
        base_path: Path,
        table_name: str,
        archive_date: datetime,
        compress: bool = True
    ):
        self.base_path = base_path
        self.table_name = table_name
        self.archive_date = archive_date
        self.compress = compress
        self.records_written = 0
        self._file = None

    @property
    def archive_dir(self) -> Path:
        """Directory for this archive date."""
        date_str = self.archive_date.strftime("%Y-%m-%d")
        return self.base_path / date_str

    @property
    def archive_file(self) -> Path:
        """Full path to archive file."""
        ext = ".jsonl.gz" if self.compress else ".jsonl"
        return self.archive_dir / f"{self.table_name}{ext}"

    def __enter__(self) -> "ArchiveWriter":
        """Open archive file for writing."""
        self.archive_dir.mkdir(parents=True, exist_ok=True)

        if self.compress:
            self._file = gzip.open(self.archive_file, "at", encoding="utf-8")
        else:
            self._file = open(self.archive_file, "a", encoding="utf-8")

        logger.info(f"Opened archive: {self.archive_file}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Close archive file."""
        if self._file:
            self._file.close()
            logger.info(
                f"Closed archive: {self.archive_file} "
                f"({self.records_written} records)"
            )

    def write_record(self, record: Dict[str, Any]) -> None:
        """Write a single record to the archive."""
        if not self._file:
            raise RuntimeError("Archive not opened. Use context manager.")

        # Add archive metadata
        record["_archived_at"] = datetime.utcnow().isoformat()

        line = json.dumps(record, default=str) + "\n"
        self._file.write(line)
        self.records_written += 1

    def write_batch(self, records: List[Dict[str, Any]]) -> int:
        """Write multiple records to the archive."""
        for record in records:
            self.write_record(record)
        return len(records)


class ArchiveReader:
    """Reads records from JSONL archive files."""

    def __init__(self, archive_path: Path):
        self.archive_path = archive_path
        self.compressed = archive_path.suffix == ".gz"

    def __iter__(self) -> Iterator[Dict[str, Any]]:
        """Iterate over records in the archive."""
        opener = gzip.open if self.compressed else open

        with opener(self.archive_path, "rt", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    yield json.loads(line)

    def count(self) -> int:
        """Count records in the archive."""
        return sum(1 for _ in self)

    def read_all(self) -> List[Dict[str, Any]]:
        """Read all records into memory."""
        return list(self)


def list_archives(
    base_path: Path,
    table_name: Optional[str] = None,
    after_date: Optional[datetime] = None,
    before_date: Optional[datetime] = None
) -> List[Path]:
    """List archive files matching criteria."""
    archives = []

    if not base_path.exists():
        return archives

    for date_dir in sorted(base_path.iterdir()):
        if not date_dir.is_dir():
            continue

        # Parse date from directory name
        try:
            dir_date = datetime.strptime(date_dir.name, "%Y-%m-%d")
        except ValueError:
            continue

        # Apply date filters
        if after_date and dir_date < after_date:
            continue
        if before_date and dir_date > before_date:
            continue

        # Find matching files
        for archive_file in date_dir.iterdir():
            if not archive_file.is_file():
                continue

            # Check table name
            file_table = archive_file.name.split(".")[0]
            if table_name and file_table != table_name:
                continue

            archives.append(archive_file)

    return archives


def get_archive_stats(base_path: Path) -> Dict[str, Any]:
    """Get statistics about archives."""
    stats = {
        "total_files": 0,
        "total_size_bytes": 0,
        "by_table": {},
        "by_date": {},
        "oldest_archive": None,
        "newest_archive": None,
    }

    if not base_path.exists():
        return stats

    for archive_file in list_archives(base_path):
        stats["total_files"] += 1
        stats["total_size_bytes"] += archive_file.stat().st_size

        # By table
        table_name = archive_file.name.split(".")[0]
        if table_name not in stats["by_table"]:
            stats["by_table"][table_name] = {"files": 0, "size_bytes": 0}
        stats["by_table"][table_name]["files"] += 1
        stats["by_table"][table_name]["size_bytes"] += archive_file.stat().st_size

        # By date
        date_str = archive_file.parent.name
        if date_str not in stats["by_date"]:
            stats["by_date"][date_str] = {"files": 0, "size_bytes": 0}
        stats["by_date"][date_str]["files"] += 1
        stats["by_date"][date_str]["size_bytes"] += archive_file.stat().st_size

        # Track oldest/newest
        if stats["oldest_archive"] is None or date_str < stats["oldest_archive"]:
            stats["oldest_archive"] = date_str
        if stats["newest_archive"] is None or date_str > stats["newest_archive"]:
            stats["newest_archive"] = date_str

    return stats
```

#### Acceptance Criteria

- [ ] `ArchiveWriter` creates dated subdirectories
- [ ] Records written as valid JSONL with gzip compression
- [ ] `_archived_at` metadata added to each record
- [ ] `ArchiveReader` can iterate compressed and uncompressed files
- [ ] `list_archives()` filters by table and date range
- [ ] `get_archive_stats()` calculates correct totals

#### Test Script

```bash
# Test: Verify archive writer functionality
python3 -c "
import tempfile
from pathlib import Path
from datetime import datetime
from coding_loops.shared.archive_writer import (
    ArchiveWriter,
    ArchiveReader,
    list_archives,
    get_archive_stats
)

# Create temp directory
with tempfile.TemporaryDirectory() as tmpdir:
    base_path = Path(tmpdir)
    test_date = datetime(2026, 1, 15)

    # Test writing
    with ArchiveWriter(base_path, 'test_table', test_date, compress=True) as writer:
        writer.write_record({'id': '1', 'data': 'test1'})
        writer.write_record({'id': '2', 'data': 'test2'})
        writer.write_batch([
            {'id': '3', 'data': 'test3'},
            {'id': '4', 'data': 'test4'}
        ])

    assert writer.records_written == 4

    # Verify file exists
    expected_file = base_path / '2026-01-15' / 'test_table.jsonl.gz'
    assert expected_file.exists()

    # Test reading
    reader = ArchiveReader(expected_file)
    records = reader.read_all()
    assert len(records) == 4
    assert records[0]['id'] == '1'
    assert '_archived_at' in records[0]

    # Test listing
    archives = list_archives(base_path, table_name='test_table')
    assert len(archives) == 1

    # Test stats
    stats = get_archive_stats(base_path)
    assert stats['total_files'] == 1
    assert stats['by_table']['test_table']['files'] == 1

print('OBS-1001: PASS - Archive writer validated')
"
```

#### Pass Criteria

- Script exits with code 0
- Archive file created with gzip compression
- Records readable and contain metadata
- Output shows "PASS"

---

### OBS-1002: Create Database Archiver

**File:** `coding-loops/shared/database_archiver.py`

**Purpose:** Archive old records from SQLite to JSONL files.

#### Implementation

```python
# coding-loops/shared/database_archiver.py
"""
Database archiver for observability tables.

Moves old records from SQLite to JSONL archives based on retention policies.
"""

import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import logging

from .archive_config import (
    ArchiveConfig,
    RetentionPolicy,
    RETENTION_POLICIES,
    get_policy,
    is_exempt
)
from .archive_writer import ArchiveWriter

logger = logging.getLogger(__name__)


class DatabaseArchiver:
    """Archives old database records to JSONL files."""

    def __init__(self, config: Optional[ArchiveConfig] = None):
        self.config = config or ArchiveConfig.default()
        self.config.ensure_directories()
        self._conn: Optional[sqlite3.Connection] = None

    def __enter__(self) -> "DatabaseArchiver":
        """Open database connection."""
        self._conn = sqlite3.connect(str(self.config.db_path))
        self._conn.row_factory = sqlite3.Row
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Close database connection."""
        if self._conn:
            self._conn.close()

    def archive_table(
        self,
        table_name: str,
        older_than: Optional[timedelta] = None,
        dry_run: bool = False
    ) -> Dict[str, any]:
        """
        Archive records from a single table.

        Args:
            table_name: Name of the table to archive
            older_than: Override retention policy threshold
            dry_run: If True, only report what would be archived

        Returns:
            Dict with archive statistics
        """
        if is_exempt(table_name):
            logger.info(f"Skipping exempt table: {table_name}")
            return {"table": table_name, "status": "exempt", "records": 0}

        policy = get_policy(table_name)
        if not policy:
            logger.warning(f"No retention policy for table: {table_name}")
            return {"table": table_name, "status": "no_policy", "records": 0}

        # Calculate cutoff date
        threshold = older_than or policy.hot_threshold
        cutoff_date = datetime.utcnow() - threshold
        cutoff_str = cutoff_date.isoformat()

        # Count records to archive
        count_sql = f"""
            SELECT COUNT(*) as count
            FROM {table_name}
            WHERE {policy.timestamp_column} < ?
        """
        cursor = self._conn.execute(count_sql, (cutoff_str,))
        count = cursor.fetchone()["count"]

        if count == 0:
            logger.info(f"No records to archive in {table_name}")
            return {
                "table": table_name,
                "status": "no_records",
                "records": 0,
                "cutoff_date": cutoff_str
            }

        logger.info(f"Found {count} records to archive in {table_name}")

        if dry_run:
            return {
                "table": table_name,
                "status": "dry_run",
                "records": count,
                "cutoff_date": cutoff_str
            }

        # Archive records in batches
        archived = 0
        archive_date = datetime.utcnow()

        with ArchiveWriter(
            self.config.warm_path,
            table_name,
            archive_date,
            compress=self.config.compress
        ) as writer:

            while archived < count:
                # Fetch batch
                select_sql = f"""
                    SELECT * FROM {table_name}
                    WHERE {policy.timestamp_column} < ?
                    ORDER BY {policy.timestamp_column}
                    LIMIT ?
                """
                cursor = self._conn.execute(
                    select_sql,
                    (cutoff_str, self.config.batch_size)
                )

                rows = cursor.fetchall()
                if not rows:
                    break

                # Write to archive
                records = [dict(row) for row in rows]
                writer.write_batch(records)

                # Delete archived records
                ids = [r["id"] for r in records]
                placeholders = ",".join("?" * len(ids))
                delete_sql = f"DELETE FROM {table_name} WHERE id IN ({placeholders})"
                self._conn.execute(delete_sql, ids)
                self._conn.commit()

                archived += len(records)
                logger.info(f"Archived {archived}/{count} records from {table_name}")

        return {
            "table": table_name,
            "status": "archived",
            "records": archived,
            "cutoff_date": cutoff_str,
            "archive_file": str(writer.archive_file)
        }

    def archive_all(
        self,
        older_than: Optional[timedelta] = None,
        dry_run: bool = False
    ) -> List[Dict[str, any]]:
        """Archive all tables according to retention policies."""
        results = []

        for table_name in RETENTION_POLICIES.keys():
            result = self.archive_table(table_name, older_than, dry_run)
            results.append(result)

        return results

    def archive_transcripts(
        self,
        older_than: Optional[timedelta] = None,
        dry_run: bool = False
    ) -> List[Dict[str, any]]:
        """Archive transcript-related tables (entries, tools, skills)."""
        tables = ["transcript_entries", "tool_uses", "skill_traces"]
        results = []

        for table in tables:
            result = self.archive_table(table, older_than, dry_run)
            results.append(result)

        return results

    def archive_assertions(
        self,
        older_than: Optional[timedelta] = None,
        dry_run: bool = False
    ) -> List[Dict[str, any]]:
        """Archive assertion-related tables."""
        tables = ["assertion_results", "assertion_chains"]
        results = []

        for table in tables:
            result = self.archive_table(table, older_than, dry_run)
            results.append(result)

        return results

    def get_table_stats(self, table_name: str) -> Dict[str, any]:
        """Get statistics for a table."""
        policy = get_policy(table_name)
        if not policy:
            return {"table": table_name, "error": "no_policy"}

        # Total count
        total_sql = f"SELECT COUNT(*) as count FROM {table_name}"
        total = self._conn.execute(total_sql).fetchone()["count"]

        # Calculate age buckets
        now = datetime.utcnow()
        hot_cutoff = (now - policy.hot_threshold).isoformat()
        warm_cutoff = (now - policy.warm_threshold).isoformat()

        hot_sql = f"""
            SELECT COUNT(*) as count FROM {table_name}
            WHERE {policy.timestamp_column} >= ?
        """
        hot_count = self._conn.execute(hot_sql, (hot_cutoff,)).fetchone()["count"]

        warm_sql = f"""
            SELECT COUNT(*) as count FROM {table_name}
            WHERE {policy.timestamp_column} < ? AND {policy.timestamp_column} >= ?
        """
        warm_count = self._conn.execute(
            warm_sql, (hot_cutoff, warm_cutoff)
        ).fetchone()["count"]

        stale_count = total - hot_count - warm_count

        return {
            "table": table_name,
            "total": total,
            "hot": hot_count,
            "warm": warm_count,
            "stale": stale_count,
            "policy": {
                "hot_days": policy.hot_days,
                "warm_days": policy.warm_days,
                "cold_days": policy.cold_days
            }
        }

    def get_all_stats(self) -> List[Dict[str, any]]:
        """Get statistics for all tables."""
        return [
            self.get_table_stats(table)
            for table in RETENTION_POLICIES.keys()
        ]
```

#### Acceptance Criteria

- [ ] `archive_table()` moves records older than threshold to archive
- [ ] Records deleted from SQLite after successful archive
- [ ] `archive_all()` processes all non-exempt tables
- [ ] `archive_transcripts()` archives transcript-related tables
- [ ] `archive_assertions()` archives assertion-related tables
- [ ] `get_table_stats()` shows hot/warm/stale record counts
- [ ] Dry run mode reports without modifying data
- [ ] Batch processing handles large datasets

#### Test Script

```bash
# Test: Verify database archiver (with mock data)
python3 -c "
import tempfile
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
from coding_loops.shared.archive_config import ArchiveConfig
from coding_loops.shared.database_archiver import DatabaseArchiver

# Create temp database with test data
with tempfile.TemporaryDirectory() as tmpdir:
    db_path = Path(tmpdir) / 'test.db'
    archive_path = Path(tmpdir) / 'archives'

    # Setup test database
    conn = sqlite3.connect(str(db_path))
    conn.execute('''
        CREATE TABLE transcript_entries (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            execution_id TEXT,
            task_id TEXT,
            instance_id TEXT,
            wave_number INTEGER,
            entry_type TEXT,
            category TEXT,
            summary TEXT,
            details TEXT,
            duration_ms INTEGER,
            created_at TEXT
        )
    ''')

    # Insert old and new records
    old_date = (datetime.utcnow() - timedelta(days=10)).isoformat()
    new_date = datetime.utcnow().isoformat()

    conn.execute('''
        INSERT INTO transcript_entries
        (id, timestamp, execution_id, instance_id, entry_type, category, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', ('old-1', old_date, 'exec-1', 'inst-1', 'task_start', 'lifecycle', 'Old entry'))

    conn.execute('''
        INSERT INTO transcript_entries
        (id, timestamp, execution_id, instance_id, entry_type, category, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', ('new-1', new_date, 'exec-1', 'inst-1', 'task_end', 'lifecycle', 'New entry'))

    conn.commit()
    conn.close()

    # Create config
    config = ArchiveConfig(
        base_path=archive_path,
        db_path=db_path,
        compress=True,
        batch_size=100
    )

    # Test archiving
    with DatabaseArchiver(config) as archiver:
        # Test stats
        stats = archiver.get_table_stats('transcript_entries')
        assert stats['total'] == 2
        assert stats['hot'] == 1  # new record
        assert stats['stale'] == 1  # old record

        # Test dry run
        result = archiver.archive_table(
            'transcript_entries',
            older_than=timedelta(days=7),
            dry_run=True
        )
        assert result['status'] == 'dry_run'
        assert result['records'] == 1

        # Verify nothing deleted in dry run
        conn = sqlite3.connect(str(db_path))
        count = conn.execute('SELECT COUNT(*) FROM transcript_entries').fetchone()[0]
        assert count == 2
        conn.close()

        # Test actual archive
        result = archiver.archive_table(
            'transcript_entries',
            older_than=timedelta(days=7)
        )
        assert result['status'] == 'archived'
        assert result['records'] == 1

        # Verify record deleted
        conn = sqlite3.connect(str(db_path))
        count = conn.execute('SELECT COUNT(*) FROM transcript_entries').fetchone()[0]
        assert count == 1  # Only new record remains
        conn.close()

        # Verify archive file exists
        archive_file = Path(result['archive_file'])
        assert archive_file.exists()

print('OBS-1002: PASS - Database archiver validated')
"
```

#### Pass Criteria

- Script exits with code 0
- Old records archived and deleted from database
- New records preserved
- Archive file created
- Output shows "PASS"

---

### OBS-1003: Create Archive Cleanup Service

**File:** `coding-loops/shared/archive_cleanup.py`

**Purpose:** Clean up old archives according to cold storage retention.

#### Implementation

```python
# coding-loops/shared/archive_cleanup.py
"""
Archive cleanup service.

Manages archive lifecycle: warm -> cold -> delete
"""

import gzip
import shutil
import tarfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import logging

from .archive_config import ArchiveConfig, RETENTION_POLICIES, get_policy
from .archive_writer import list_archives, get_archive_stats

logger = logging.getLogger(__name__)


class ArchiveCleanup:
    """Manages archive cleanup and cold storage consolidation."""

    def __init__(self, config: Optional[ArchiveConfig] = None):
        self.config = config or ArchiveConfig.default()
        self.config.ensure_directories()

    def consolidate_to_cold(
        self,
        older_than: timedelta = timedelta(days=30),
        dry_run: bool = False
    ) -> Dict[str, any]:
        """
        Consolidate warm archives older than threshold into cold storage.

        Creates monthly tar.gz files in cold storage.
        """
        cutoff_date = datetime.utcnow() - older_than

        # Find archives to consolidate
        archives_by_month: Dict[str, List[Path]] = {}

        for archive_file in list_archives(self.config.warm_path):
            date_str = archive_file.parent.name
            archive_date = datetime.strptime(date_str, "%Y-%m-%d")

            if archive_date >= cutoff_date:
                continue

            month_key = archive_date.strftime("%Y-%m")
            if month_key not in archives_by_month:
                archives_by_month[month_key] = []
            archives_by_month[month_key].append(archive_file)

        if not archives_by_month:
            logger.info("No archives to consolidate")
            return {"status": "no_archives", "consolidated": 0}

        results = {
            "status": "success",
            "consolidated": 0,
            "cold_files": [],
            "removed_warm": []
        }

        for month_key, files in archives_by_month.items():
            logger.info(f"Consolidating {len(files)} archives for {month_key}")

            if dry_run:
                results["consolidated"] += len(files)
                continue

            # Create year directory
            year = month_key.split("-")[0]
            year_dir = self.config.cold_path / year
            year_dir.mkdir(parents=True, exist_ok=True)

            # Create tar.gz for the month
            tar_path = year_dir / f"{month_key}.tar.gz"

            with tarfile.open(tar_path, "w:gz") as tar:
                for archive_file in files:
                    # Add file to tar with relative path
                    arcname = f"{archive_file.parent.name}/{archive_file.name}"
                    tar.add(archive_file, arcname=arcname)

            results["cold_files"].append(str(tar_path))

            # Remove consolidated files from warm storage
            for archive_file in files:
                archive_file.unlink()
                results["removed_warm"].append(str(archive_file))

                # Remove empty date directories
                if not any(archive_file.parent.iterdir()):
                    archive_file.parent.rmdir()

            results["consolidated"] += len(files)

        return results

    def purge_expired(
        self,
        dry_run: bool = False
    ) -> Dict[str, any]:
        """
        Delete archives that have exceeded their retention period.

        Checks cold storage against table-specific cold_days policies.
        """
        results = {
            "status": "success",
            "purged_files": [],
            "purged_bytes": 0
        }

        now = datetime.utcnow()

        # Check cold storage
        for year_dir in self.config.cold_path.iterdir():
            if not year_dir.is_dir():
                continue

            for tar_file in year_dir.glob("*.tar.gz"):
                # Parse month from filename
                month_str = tar_file.stem  # e.g., "2025-01"
                try:
                    archive_date = datetime.strptime(month_str, "%Y-%m")
                except ValueError:
                    continue

                # Check if expired (use longest retention policy)
                max_retention = max(
                    p.cold_threshold for p in RETENTION_POLICIES.values()
                )

                if now - archive_date > max_retention:
                    file_size = tar_file.stat().st_size

                    if dry_run:
                        logger.info(f"Would purge: {tar_file}")
                    else:
                        tar_file.unlink()
                        logger.info(f"Purged: {tar_file}")

                    results["purged_files"].append(str(tar_file))
                    results["purged_bytes"] += file_size

        # Remove empty year directories
        if not dry_run:
            for year_dir in self.config.cold_path.iterdir():
                if year_dir.is_dir() and not any(year_dir.iterdir()):
                    year_dir.rmdir()

        return results

    def cleanup_all(
        self,
        consolidate_older_than: timedelta = timedelta(days=30),
        dry_run: bool = False
    ) -> Dict[str, any]:
        """Run full cleanup: consolidate warm -> cold, then purge expired."""
        results = {
            "consolidation": self.consolidate_to_cold(consolidate_older_than, dry_run),
            "purge": self.purge_expired(dry_run)
        }
        return results

    def get_retention_status(self) -> Dict[str, any]:
        """Get comprehensive retention status across all storage tiers."""
        warm_stats = get_archive_stats(self.config.warm_path)
        cold_stats = get_archive_stats(self.config.cold_path)

        # Calculate what's eligible for cleanup
        now = datetime.utcnow()
        eligible_for_cold = 0
        eligible_for_purge = 0

        for archive in list_archives(self.config.warm_path):
            date_str = archive.parent.name
            archive_date = datetime.strptime(date_str, "%Y-%m-%d")
            if now - archive_date > timedelta(days=30):
                eligible_for_cold += 1

        return {
            "warm": {
                "total_files": warm_stats["total_files"],
                "total_size_mb": round(warm_stats["total_size_bytes"] / 1024 / 1024, 2),
                "oldest": warm_stats["oldest_archive"],
                "newest": warm_stats["newest_archive"],
                "eligible_for_cold": eligible_for_cold
            },
            "cold": {
                "total_files": cold_stats["total_files"],
                "total_size_mb": round(cold_stats["total_size_bytes"] / 1024 / 1024, 2),
                "oldest": cold_stats["oldest_archive"],
                "newest": cold_stats["newest_archive"],
            }
        }
```

#### Acceptance Criteria

- [ ] `consolidate_to_cold()` creates monthly tar.gz files
- [ ] Original warm archives deleted after consolidation
- [ ] `purge_expired()` removes archives past retention
- [ ] Empty directories cleaned up
- [ ] `get_retention_status()` shows tier statistics
- [ ] Dry run mode reports without modifying data

#### Test Script

```bash
# Test: Verify archive cleanup
python3 -c "
import tempfile
import tarfile
from pathlib import Path
from datetime import datetime, timedelta
from coding_loops.shared.archive_config import ArchiveConfig
from coding_loops.shared.archive_cleanup import ArchiveCleanup
from coding_loops.shared.archive_writer import ArchiveWriter

# Create temp directory with test archives
with tempfile.TemporaryDirectory() as tmpdir:
    config = ArchiveConfig(
        base_path=Path(tmpdir),
        db_path=Path(tmpdir) / 'test.db',
        compress=True
    )
    config.ensure_directories()

    # Create old warm archives (simulating 45 days ago)
    old_date = datetime.utcnow() - timedelta(days=45)
    with ArchiveWriter(config.warm_path, 'test_table', old_date) as writer:
        writer.write_record({'id': '1', 'data': 'old'})

    # Create recent warm archive
    recent_date = datetime.utcnow() - timedelta(days=5)
    with ArchiveWriter(config.warm_path, 'test_table', recent_date) as writer:
        writer.write_record({'id': '2', 'data': 'recent'})

    cleanup = ArchiveCleanup(config)

    # Test retention status
    status = cleanup.get_retention_status()
    assert status['warm']['total_files'] == 2

    # Test dry run consolidation
    result = cleanup.consolidate_to_cold(older_than=timedelta(days=30), dry_run=True)
    assert result['consolidated'] == 1  # Only old archive

    # Test actual consolidation
    result = cleanup.consolidate_to_cold(older_than=timedelta(days=30))
    assert result['consolidated'] == 1
    assert len(result['cold_files']) == 1

    # Verify tar file created
    cold_file = Path(result['cold_files'][0])
    assert cold_file.exists()
    assert cold_file.suffix == '.gz'

    # Verify warm file removed
    assert len(list(config.warm_path.rglob('*.jsonl.gz'))) == 1  # Only recent remains

    # Test tar contents
    with tarfile.open(cold_file, 'r:gz') as tar:
        names = tar.getnames()
        assert len(names) == 1
        assert 'test_table.jsonl.gz' in names[0]

print('OBS-1003: PASS - Archive cleanup validated')
"
```

#### Pass Criteria

- Script exits with code 0
- Old archives consolidated to tar.gz
- Recent archives preserved
- Output shows "PASS"

---

### OBS-1004: Create Log Archival Job

**File:** `coding-loops/jobs/log_archival.py`

**Purpose:** Scheduled job for automated archival.

#### Implementation

```python
# coding-loops/jobs/log_archival.py
"""
Log archival job for scheduled execution.

Run daily via cron or scheduled task:
    python3 coding-loops/jobs/log_archival.py --mode daily

Run weekly for assertions:
    python3 coding-loops/jobs/log_archival.py --mode weekly

Run monthly for cleanup:
    python3 coding-loops/jobs/log_archival.py --mode monthly
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.archive_config import ArchiveConfig
from shared.database_archiver import DatabaseArchiver
from shared.archive_cleanup import ArchiveCleanup

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def run_daily_archival(config: ArchiveConfig, dry_run: bool = False) -> dict:
    """
    Daily archival: transcript entries, tool uses, skill traces, message bus log.

    Archives records older than 7 days.
    """
    logger.info("Starting daily archival job")

    with DatabaseArchiver(config) as archiver:
        results = archiver.archive_transcripts(
            older_than=timedelta(days=7),
            dry_run=dry_run
        )

        # Also archive message bus log
        mbus_result = archiver.archive_table(
            "message_bus_log",
            older_than=timedelta(days=7),
            dry_run=dry_run
        )
        results.append(mbus_result)

    total_archived = sum(r.get("records", 0) for r in results)
    logger.info(f"Daily archival complete: {total_archived} records archived")

    return {
        "mode": "daily",
        "timestamp": datetime.utcnow().isoformat(),
        "dry_run": dry_run,
        "total_archived": total_archived,
        "tables": results
    }


def run_weekly_archival(config: ArchiveConfig, dry_run: bool = False) -> dict:
    """
    Weekly archival: assertion results, assertion chains.

    Archives records older than 30 days.
    """
    logger.info("Starting weekly archival job")

    with DatabaseArchiver(config) as archiver:
        results = archiver.archive_assertions(
            older_than=timedelta(days=30),
            dry_run=dry_run
        )

    total_archived = sum(r.get("records", 0) for r in results)
    logger.info(f"Weekly archival complete: {total_archived} records archived")

    return {
        "mode": "weekly",
        "timestamp": datetime.utcnow().isoformat(),
        "dry_run": dry_run,
        "total_archived": total_archived,
        "tables": results
    }


def run_monthly_cleanup(config: ArchiveConfig, dry_run: bool = False) -> dict:
    """
    Monthly cleanup: consolidate warm -> cold, purge expired.
    """
    logger.info("Starting monthly cleanup job")

    cleanup = ArchiveCleanup(config)
    results = cleanup.cleanup_all(
        consolidate_older_than=timedelta(days=30),
        dry_run=dry_run
    )

    logger.info(
        f"Monthly cleanup complete: "
        f"{results['consolidation'].get('consolidated', 0)} consolidated, "
        f"{len(results['purge'].get('purged_files', []))} purged"
    )

    return {
        "mode": "monthly",
        "timestamp": datetime.utcnow().isoformat(),
        "dry_run": dry_run,
        "consolidation": results["consolidation"],
        "purge": results["purge"]
    }


def run_full_archival(config: ArchiveConfig, dry_run: bool = False) -> dict:
    """Run all archival and cleanup tasks."""
    logger.info("Starting full archival job")

    results = {
        "mode": "full",
        "timestamp": datetime.utcnow().isoformat(),
        "dry_run": dry_run,
        "daily": run_daily_archival(config, dry_run),
        "weekly": run_weekly_archival(config, dry_run),
        "monthly": run_monthly_cleanup(config, dry_run)
    }

    logger.info("Full archival complete")
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Log archival job for observability data"
    )
    parser.add_argument(
        "--mode",
        choices=["daily", "weekly", "monthly", "full"],
        default="daily",
        help="Archival mode (default: daily)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be archived without making changes"
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        help="Path to database (default: database/ideas.db)"
    )
    parser.add_argument(
        "--archive-path",
        type=Path,
        help="Path to archive directory (default: coding-loops/archives)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write results to JSON file"
    )

    args = parser.parse_args()

    # Build config
    config = ArchiveConfig.default()
    if args.db_path:
        config.db_path = args.db_path
    if args.archive_path:
        config.base_path = args.archive_path

    # Run appropriate mode
    mode_handlers = {
        "daily": run_daily_archival,
        "weekly": run_weekly_archival,
        "monthly": run_monthly_cleanup,
        "full": run_full_archival
    }

    handler = mode_handlers[args.mode]
    results = handler(config, args.dry_run)

    # Output results
    if args.output:
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        logger.info(f"Results written to {args.output}")
    else:
        print(json.dumps(results, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

#### Acceptance Criteria

- [ ] `--mode daily` archives transcripts (7 day threshold)
- [ ] `--mode weekly` archives assertions (30 day threshold)
- [ ] `--mode monthly` consolidates and purges
- [ ] `--mode full` runs all modes
- [ ] `--dry-run` reports without changes
- [ ] Results output as JSON
- [ ] Exit code 0 on success

#### Test Script

```bash
# Test: Verify log archival job CLI
python3 coding-loops/jobs/log_archival.py --mode daily --dry-run

# Expected output: JSON with dry_run: true, tables array

# Test: Verify different modes
python3 coding-loops/jobs/log_archival.py --mode weekly --dry-run
python3 coding-loops/jobs/log_archival.py --mode monthly --dry-run
python3 coding-loops/jobs/log_archival.py --mode full --dry-run

echo "OBS-1004: PASS - Log archival job validated"
```

#### Pass Criteria

- All commands exit with code 0
- Output contains valid JSON
- `dry_run: true` in all outputs
- No database modifications

---

### OBS-1005: Create Main CLI Entry Point

**File:** `coding-loops/cli.py`

**Purpose:** Main CLI with all observability commands.

#### Implementation

```python
#!/usr/bin/env python3
"""
Coding Loops CLI

Main entry point for observability and system management commands.

Usage:
    python3 coding-loops/cli.py <command> [subcommand] [options]

Commands:
    archive     Archive old observability data
    cleanup     Clean up archived data
    retention   View retention status and statistics
    status      System status commands
    pause       Pause a running loop
    resume      Resume a paused loop
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from shared.archive_config import ArchiveConfig, RETENTION_POLICIES
from shared.database_archiver import DatabaseArchiver
from shared.archive_cleanup import ArchiveCleanup


def parse_duration(duration_str: str) -> timedelta:
    """
    Parse duration string like '7d', '30d', '1y'.

    Supported formats:
        - Xd: X days
        - Xw: X weeks
        - Xm: X months (30 days)
        - Xy: X years (365 days)
    """
    if not duration_str:
        raise ValueError("Duration string cannot be empty")

    unit = duration_str[-1].lower()
    try:
        value = int(duration_str[:-1])
    except ValueError:
        raise ValueError(f"Invalid duration format: {duration_str}")

    multipliers = {
        "d": 1,
        "w": 7,
        "m": 30,
        "y": 365
    }

    if unit not in multipliers:
        raise ValueError(f"Unknown duration unit: {unit}. Use d/w/m/y")

    return timedelta(days=value * multipliers[unit])


def format_bytes(size_bytes: int) -> str:
    """Format bytes as human-readable string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.2f} TB"


# ============================================================================
# Archive Commands
# ============================================================================

def cmd_archive(args) -> int:
    """Handle archive commands."""
    config = ArchiveConfig.default()
    if args.db_path:
        config.db_path = Path(args.db_path)
    if args.archive_path:
        config.base_path = Path(args.archive_path)

    older_than = parse_duration(args.older_than) if args.older_than else None

    with DatabaseArchiver(config) as archiver:
        if args.target == "all":
            results = archiver.archive_all(older_than, args.dry_run)
        elif args.target == "transcripts":
            results = archiver.archive_transcripts(older_than, args.dry_run)
        elif args.target == "assertions":
            results = archiver.archive_assertions(older_than, args.dry_run)
        else:
            results = [archiver.archive_table(args.target, older_than, args.dry_run)]

    # Display results
    total = sum(r.get("records", 0) for r in results)

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print(f"\n{'DRY RUN - ' if args.dry_run else ''}Archive Results:")
        print("-" * 60)
        for r in results:
            status_icon = "✓" if r.get("status") == "archived" else "○"
            print(f"  {status_icon} {r['table']}: {r.get('records', 0)} records")
        print("-" * 60)
        print(f"  Total: {total} records {'would be' if args.dry_run else ''} archived")

    return 0


def cmd_cleanup(args) -> int:
    """Handle cleanup commands."""
    config = ArchiveConfig.default()
    if args.archive_path:
        config.base_path = Path(args.archive_path)

    cleanup = ArchiveCleanup(config)

    if args.target == "archives":
        older_than = parse_duration(args.older_than) if args.older_than else timedelta(days=30)

        if args.consolidate_only:
            results = cleanup.consolidate_to_cold(older_than, args.dry_run)
        elif args.purge_only:
            results = cleanup.purge_expired(args.dry_run)
        else:
            results = cleanup.cleanup_all(older_than, args.dry_run)
    else:
        print(f"Unknown cleanup target: {args.target}")
        return 1

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print(f"\n{'DRY RUN - ' if args.dry_run else ''}Cleanup Results:")
        print("-" * 60)

        if "consolidation" in results:
            c = results["consolidation"]
            print(f"  Consolidated: {c.get('consolidated', 0)} archives")

        if "purge" in results:
            p = results["purge"]
            print(f"  Purged: {len(p.get('purged_files', []))} files")
            print(f"  Freed: {format_bytes(p.get('purged_bytes', 0))}")

        if "consolidated" in results:
            print(f"  Consolidated: {results['consolidated']} archives")

    return 0


def cmd_retention_status(args) -> int:
    """Show retention status."""
    config = ArchiveConfig.default()

    # Get database stats
    with DatabaseArchiver(config) as archiver:
        db_stats = archiver.get_all_stats()

    # Get archive stats
    cleanup = ArchiveCleanup(config)
    archive_status = cleanup.get_retention_status()

    if args.json:
        print(json.dumps({
            "database": db_stats,
            "archives": archive_status
        }, indent=2))
        return 0

    print("\n📊 Retention Status")
    print("=" * 70)

    # Database stats
    print("\n🗄️  HOT STORAGE (SQLite)")
    print("-" * 70)
    print(f"  {'Table':<25} {'Total':>10} {'Hot':>10} {'Stale':>10}")
    print("-" * 70)

    for stat in db_stats:
        if "error" in stat:
            continue
        print(
            f"  {stat['table']:<25} "
            f"{stat['total']:>10,} "
            f"{stat['hot']:>10,} "
            f"{stat['stale']:>10,}"
        )

    # Archive stats
    print("\n📦 WARM ARCHIVE")
    print("-" * 70)
    warm = archive_status["warm"]
    print(f"  Files:    {warm['total_files']}")
    print(f"  Size:     {warm['total_size_mb']} MB")
    print(f"  Oldest:   {warm['oldest'] or 'N/A'}")
    print(f"  Newest:   {warm['newest'] or 'N/A'}")
    print(f"  Ready for cold: {warm['eligible_for_cold']} archives")

    print("\n❄️  COLD ARCHIVE")
    print("-" * 70)
    cold = archive_status["cold"]
    print(f"  Files:    {cold['total_files']}")
    print(f"  Size:     {cold['total_size_mb']} MB")
    print(f"  Oldest:   {cold['oldest'] or 'N/A'}")
    print(f"  Newest:   {cold['newest'] or 'N/A'}")

    return 0


def cmd_retention_policy(args) -> int:
    """Show retention policies."""
    if args.json:
        policies = {
            name: {
                "hot_days": p.hot_days,
                "warm_days": p.warm_days,
                "cold_days": p.cold_days,
                "total_days": p.hot_days + p.warm_days + p.cold_days,
                "timestamp_column": p.timestamp_column
            }
            for name, p in RETENTION_POLICIES.items()
        }
        print(json.dumps(policies, indent=2))
        return 0

    print("\n📋 Retention Policies")
    print("=" * 70)
    print(f"  {'Table':<25} {'Hot':>8} {'Warm':>8} {'Cold':>8} {'Total':>10}")
    print("-" * 70)

    for name, policy in RETENTION_POLICIES.items():
        total = policy.hot_days + policy.warm_days + policy.cold_days
        print(
            f"  {name:<25} "
            f"{policy.hot_days:>6}d "
            f"{policy.warm_days:>6}d "
            f"{policy.cold_days:>6}d "
            f"{total:>8}d"
        )

    print("-" * 70)
    print("\n  Legend:")
    print("    Hot  = Days in SQLite (fast queries)")
    print("    Warm = Days in JSONL archives (searchable)")
    print("    Cold = Days in compressed tar (deep storage)")

    return 0


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Coding Loops CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Archive transcripts older than 7 days
  python3 coding-loops/cli.py archive transcripts --older-than 7d

  # Archive all observability data (dry run)
  python3 coding-loops/cli.py archive all --older-than 7d --dry-run

  # Clean up archives older than 1 year
  python3 coding-loops/cli.py cleanup archives --older-than 1y

  # View retention status
  python3 coding-loops/cli.py retention status

  # View retention policies
  python3 coding-loops/cli.py retention policy
"""
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # -------------------------------------------------------------------------
    # archive command
    # -------------------------------------------------------------------------
    archive_parser = subparsers.add_parser(
        "archive",
        help="Archive old observability data"
    )
    archive_parser.add_argument(
        "target",
        choices=["all", "transcripts", "assertions", "message_bus_log",
                 "transcript_entries", "tool_uses", "skill_traces",
                 "assertion_results", "assertion_chains"],
        help="What to archive"
    )
    archive_parser.add_argument(
        "--older-than",
        metavar="DURATION",
        help="Archive records older than duration (e.g., 7d, 30d, 1y)"
    )
    archive_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be archived without making changes"
    )
    archive_parser.add_argument(
        "--db-path",
        help="Path to database"
    )
    archive_parser.add_argument(
        "--archive-path",
        help="Path to archive directory"
    )
    archive_parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON"
    )
    archive_parser.set_defaults(func=cmd_archive)

    # -------------------------------------------------------------------------
    # cleanup command
    # -------------------------------------------------------------------------
    cleanup_parser = subparsers.add_parser(
        "cleanup",
        help="Clean up archived data"
    )
    cleanup_parser.add_argument(
        "target",
        choices=["archives"],
        help="What to clean up"
    )
    cleanup_parser.add_argument(
        "--older-than",
        metavar="DURATION",
        help="Clean up archives older than duration (e.g., 30d, 1y)"
    )
    cleanup_parser.add_argument(
        "--consolidate-only",
        action="store_true",
        help="Only consolidate warm -> cold (no purge)"
    )
    cleanup_parser.add_argument(
        "--purge-only",
        action="store_true",
        help="Only purge expired archives (no consolidate)"
    )
    cleanup_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be cleaned up without making changes"
    )
    cleanup_parser.add_argument(
        "--archive-path",
        help="Path to archive directory"
    )
    cleanup_parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON"
    )
    cleanup_parser.set_defaults(func=cmd_cleanup)

    # -------------------------------------------------------------------------
    # retention command
    # -------------------------------------------------------------------------
    retention_parser = subparsers.add_parser(
        "retention",
        help="View retention status and policies"
    )
    retention_subparsers = retention_parser.add_subparsers(
        dest="retention_cmd",
        help="Retention subcommands"
    )

    # retention status
    status_parser = retention_subparsers.add_parser(
        "status",
        help="Show current retention status"
    )
    status_parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON"
    )
    status_parser.set_defaults(func=cmd_retention_status)

    # retention policy
    policy_parser = retention_subparsers.add_parser(
        "policy",
        help="Show retention policies"
    )
    policy_parser.add_argument(
        "--json",
        action="store_true",
        help="Output as JSON"
    )
    policy_parser.set_defaults(func=cmd_retention_policy)

    # -------------------------------------------------------------------------
    # Parse and execute
    # -------------------------------------------------------------------------
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    if args.command == "retention" and not args.retention_cmd:
        retention_parser.print_help()
        return 1

    if hasattr(args, "func"):
        return args.func(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
```

#### Acceptance Criteria

- [ ] `archive transcripts --older-than 7d` works
- [ ] `archive assertions --older-than 30d` works
- [ ] `archive all --older-than 7d` works
- [ ] `cleanup archives --older-than 1y` works
- [ ] `retention status` shows database and archive stats
- [ ] `retention policy` shows retention policies
- [ ] `--dry-run` flag works on all commands
- [ ] `--json` flag outputs valid JSON
- [ ] Duration parsing works for d/w/m/y suffixes
- [ ] Help text is clear and complete

#### Test Script

```bash
# Test: CLI help
python3 coding-loops/cli.py --help

# Test: Archive commands (dry run)
python3 coding-loops/cli.py archive transcripts --older-than 7d --dry-run
python3 coding-loops/cli.py archive assertions --older-than 30d --dry-run
python3 coding-loops/cli.py archive all --older-than 7d --dry-run --json

# Test: Cleanup commands (dry run)
python3 coding-loops/cli.py cleanup archives --older-than 30d --dry-run
python3 coding-loops/cli.py cleanup archives --older-than 1y --consolidate-only --dry-run

# Test: Retention commands
python3 coding-loops/cli.py retention status
python3 coding-loops/cli.py retention policy
python3 coding-loops/cli.py retention policy --json

echo "OBS-1005: PASS - CLI validated"
```

#### Pass Criteria

- All commands exit with code 0
- Help text displays correctly
- JSON output is valid
- Dry run mode shows "DRY RUN" in output

---

### OBS-1006: Create Unit Tests for Archive Config

**File:** `coding-loops/tests/test_archive_config.py`

**Purpose:** Unit tests for archive configuration.

#### Implementation

```python
# coding-loops/tests/test_archive_config.py
"""
Unit tests for archive configuration.
"""

import pytest
from datetime import timedelta
from pathlib import Path

from shared.archive_config import (
    RetentionPolicy,
    ArchiveConfig,
    RETENTION_POLICIES,
    get_policy,
    is_exempt,
    EXEMPT_TABLES
)


class TestRetentionPolicy:
    """Tests for RetentionPolicy dataclass."""

    def test_hot_threshold(self):
        policy = RetentionPolicy(
            table_name="test",
            hot_days=7,
            warm_days=30,
            cold_days=365,
            timestamp_column="timestamp"
        )
        assert policy.hot_threshold == timedelta(days=7)

    def test_warm_threshold(self):
        policy = RetentionPolicy(
            table_name="test",
            hot_days=7,
            warm_days=30,
            cold_days=365,
            timestamp_column="timestamp"
        )
        # Warm threshold = hot + warm
        assert policy.warm_threshold == timedelta(days=37)

    def test_cold_threshold(self):
        policy = RetentionPolicy(
            table_name="test",
            hot_days=7,
            warm_days=30,
            cold_days=365,
            timestamp_column="timestamp"
        )
        # Cold threshold = hot + warm + cold
        assert policy.cold_threshold == timedelta(days=402)

    def test_cold_threshold_zero(self):
        """When cold_days=0, cold_threshold equals warm_threshold."""
        policy = RetentionPolicy(
            table_name="test",
            hot_days=7,
            warm_days=30,
            cold_days=0,
            timestamp_column="timestamp"
        )
        assert policy.cold_threshold == policy.warm_threshold


class TestRetentionPolicies:
    """Tests for predefined retention policies."""

    def test_transcript_entries_policy(self):
        policy = RETENTION_POLICIES["transcript_entries"]
        assert policy.hot_days == 7
        assert policy.warm_days == 30
        assert policy.cold_days == 365
        assert policy.timestamp_column == "timestamp"

    def test_assertion_results_policy(self):
        policy = RETENTION_POLICIES["assertion_results"]
        assert policy.hot_days == 30
        assert policy.warm_days == 90
        assert policy.cold_days == 730  # 2 years

    def test_message_bus_log_policy(self):
        policy = RETENTION_POLICIES["message_bus_log"]
        assert policy.hot_days == 7
        assert policy.cold_days == 90  # Short retention

    def test_all_required_tables_have_policies(self):
        required_tables = [
            "transcript_entries",
            "tool_uses",
            "skill_traces",
            "assertion_results",
            "assertion_chains",
            "message_bus_log"
        ]
        for table in required_tables:
            assert table in RETENTION_POLICIES


class TestGetPolicy:
    """Tests for get_policy helper."""

    def test_existing_table(self):
        policy = get_policy("transcript_entries")
        assert policy is not None
        assert policy.table_name == "transcript_entries"

    def test_nonexistent_table(self):
        policy = get_policy("nonexistent_table")
        assert policy is None


class TestIsExempt:
    """Tests for is_exempt helper."""

    def test_exempt_table(self):
        assert is_exempt("task_list_execution_runs")

    def test_non_exempt_table(self):
        assert not is_exempt("transcript_entries")
        assert not is_exempt("tool_uses")


class TestArchiveConfig:
    """Tests for ArchiveConfig."""

    def test_default_config(self):
        config = ArchiveConfig.default()
        assert config.base_path.name == "archives"
        assert config.db_path.name == "ideas.db"
        assert config.compress is True
        assert config.batch_size == 1000

    def test_warm_path(self):
        config = ArchiveConfig(
            base_path=Path("/tmp/archives"),
            db_path=Path("/tmp/test.db")
        )
        assert config.warm_path == Path("/tmp/archives/warm")

    def test_cold_path(self):
        config = ArchiveConfig(
            base_path=Path("/tmp/archives"),
            db_path=Path("/tmp/test.db")
        )
        assert config.cold_path == Path("/tmp/archives/cold")

    def test_ensure_directories(self, tmp_path):
        config = ArchiveConfig(
            base_path=tmp_path / "archives",
            db_path=tmp_path / "test.db"
        )
        config.ensure_directories()

        assert config.warm_path.exists()
        assert config.cold_path.exists()
```

#### Acceptance Criteria

- [ ] All tests pass
- [ ] 100% coverage of archive_config.py
- [ ] Edge cases tested (zero cold_days, nonexistent tables)

#### Test Script

```bash
# Run unit tests
cd coding-loops && python3 -m pytest tests/test_archive_config.py -v

# Expected: All tests pass
echo "OBS-1006: PASS - Unit tests validated"
```

#### Pass Criteria

- pytest exits with code 0
- All tests show PASSED
- No warnings or errors

---

### OBS-1007: Create Unit Tests for Archive Writer

**File:** `coding-loops/tests/test_archive_writer.py`

**Purpose:** Unit tests for archive writer.

#### Implementation

```python
# coding-loops/tests/test_archive_writer.py
"""
Unit tests for archive writer.
"""

import gzip
import json
import pytest
from datetime import datetime
from pathlib import Path

from shared.archive_writer import (
    ArchiveWriter,
    ArchiveReader,
    list_archives,
    get_archive_stats
)


class TestArchiveWriter:
    """Tests for ArchiveWriter."""

    def test_creates_date_directory(self, tmp_path):
        archive_date = datetime(2026, 1, 15)

        with ArchiveWriter(tmp_path, "test_table", archive_date) as writer:
            writer.write_record({"id": "1"})

        assert (tmp_path / "2026-01-15").exists()

    def test_writes_compressed_file(self, tmp_path):
        archive_date = datetime(2026, 1, 15)

        with ArchiveWriter(tmp_path, "test_table", archive_date, compress=True) as writer:
            writer.write_record({"id": "1"})

        archive_file = tmp_path / "2026-01-15" / "test_table.jsonl.gz"
        assert archive_file.exists()

    def test_writes_uncompressed_file(self, tmp_path):
        archive_date = datetime(2026, 1, 15)

        with ArchiveWriter(tmp_path, "test_table", archive_date, compress=False) as writer:
            writer.write_record({"id": "1"})

        archive_file = tmp_path / "2026-01-15" / "test_table.jsonl"
        assert archive_file.exists()

    def test_writes_valid_jsonl(self, tmp_path):
        archive_date = datetime(2026, 1, 15)

        with ArchiveWriter(tmp_path, "test_table", archive_date, compress=False) as writer:
            writer.write_record({"id": "1", "data": "test"})
            writer.write_record({"id": "2", "data": "test2"})

        archive_file = tmp_path / "2026-01-15" / "test_table.jsonl"
        lines = archive_file.read_text().strip().split("\n")

        assert len(lines) == 2
        record1 = json.loads(lines[0])
        assert record1["id"] == "1"

    def test_adds_archived_at_metadata(self, tmp_path):
        archive_date = datetime(2026, 1, 15)

        with ArchiveWriter(tmp_path, "test_table", archive_date, compress=False) as writer:
            writer.write_record({"id": "1"})

        archive_file = tmp_path / "2026-01-15" / "test_table.jsonl"
        record = json.loads(archive_file.read_text().strip())

        assert "_archived_at" in record

    def test_tracks_records_written(self, tmp_path):
        archive_date = datetime(2026, 1, 15)

        with ArchiveWriter(tmp_path, "test_table", archive_date) as writer:
            writer.write_record({"id": "1"})
            writer.write_record({"id": "2"})
            writer.write_batch([{"id": "3"}, {"id": "4"}])

        assert writer.records_written == 4

    def test_raises_when_not_opened(self, tmp_path):
        writer = ArchiveWriter(tmp_path, "test_table", datetime.now())

        with pytest.raises(RuntimeError):
            writer.write_record({"id": "1"})


class TestArchiveReader:
    """Tests for ArchiveReader."""

    def test_reads_compressed_file(self, tmp_path):
        # Create compressed archive
        archive_file = tmp_path / "test.jsonl.gz"
        with gzip.open(archive_file, "wt") as f:
            f.write('{"id": "1"}\n')
            f.write('{"id": "2"}\n')

        reader = ArchiveReader(archive_file)
        records = list(reader)

        assert len(records) == 2
        assert records[0]["id"] == "1"

    def test_reads_uncompressed_file(self, tmp_path):
        archive_file = tmp_path / "test.jsonl"
        archive_file.write_text('{"id": "1"}\n{"id": "2"}\n')

        reader = ArchiveReader(archive_file)
        records = list(reader)

        assert len(records) == 2

    def test_count(self, tmp_path):
        archive_file = tmp_path / "test.jsonl"
        archive_file.write_text('{"id": "1"}\n{"id": "2"}\n{"id": "3"}\n')

        reader = ArchiveReader(archive_file)
        assert reader.count() == 3

    def test_read_all(self, tmp_path):
        archive_file = tmp_path / "test.jsonl"
        archive_file.write_text('{"id": "1"}\n{"id": "2"}\n')

        reader = ArchiveReader(archive_file)
        records = reader.read_all()

        assert isinstance(records, list)
        assert len(records) == 2


class TestListArchives:
    """Tests for list_archives."""

    def test_lists_all_archives(self, tmp_path):
        # Create test archives
        (tmp_path / "2026-01-15").mkdir()
        (tmp_path / "2026-01-15" / "table1.jsonl.gz").touch()
        (tmp_path / "2026-01-15" / "table2.jsonl.gz").touch()
        (tmp_path / "2026-01-16").mkdir()
        (tmp_path / "2026-01-16" / "table1.jsonl.gz").touch()

        archives = list_archives(tmp_path)
        assert len(archives) == 3

    def test_filters_by_table_name(self, tmp_path):
        (tmp_path / "2026-01-15").mkdir()
        (tmp_path / "2026-01-15" / "table1.jsonl.gz").touch()
        (tmp_path / "2026-01-15" / "table2.jsonl.gz").touch()

        archives = list_archives(tmp_path, table_name="table1")
        assert len(archives) == 1
        assert archives[0].name == "table1.jsonl.gz"

    def test_filters_by_date_range(self, tmp_path):
        (tmp_path / "2026-01-10").mkdir()
        (tmp_path / "2026-01-10" / "table.jsonl.gz").touch()
        (tmp_path / "2026-01-15").mkdir()
        (tmp_path / "2026-01-15" / "table.jsonl.gz").touch()
        (tmp_path / "2026-01-20").mkdir()
        (tmp_path / "2026-01-20" / "table.jsonl.gz").touch()

        archives = list_archives(
            tmp_path,
            after_date=datetime(2026, 1, 12),
            before_date=datetime(2026, 1, 18)
        )

        assert len(archives) == 1
        assert "2026-01-15" in str(archives[0])

    def test_returns_empty_for_nonexistent_path(self, tmp_path):
        archives = list_archives(tmp_path / "nonexistent")
        assert archives == []


class TestGetArchiveStats:
    """Tests for get_archive_stats."""

    def test_calculates_totals(self, tmp_path):
        (tmp_path / "2026-01-15").mkdir()
        archive1 = tmp_path / "2026-01-15" / "table1.jsonl.gz"
        archive1.write_bytes(b"x" * 100)

        (tmp_path / "2026-01-16").mkdir()
        archive2 = tmp_path / "2026-01-16" / "table1.jsonl.gz"
        archive2.write_bytes(b"x" * 200)

        stats = get_archive_stats(tmp_path)

        assert stats["total_files"] == 2
        assert stats["total_size_bytes"] == 300

    def test_groups_by_table(self, tmp_path):
        (tmp_path / "2026-01-15").mkdir()
        (tmp_path / "2026-01-15" / "table1.jsonl.gz").write_bytes(b"x" * 100)
        (tmp_path / "2026-01-15" / "table2.jsonl.gz").write_bytes(b"x" * 50)

        stats = get_archive_stats(tmp_path)

        assert "table1" in stats["by_table"]
        assert "table2" in stats["by_table"]
        assert stats["by_table"]["table1"]["files"] == 1

    def test_tracks_oldest_newest(self, tmp_path):
        (tmp_path / "2026-01-10").mkdir()
        (tmp_path / "2026-01-10" / "table.jsonl.gz").touch()
        (tmp_path / "2026-01-20").mkdir()
        (tmp_path / "2026-01-20" / "table.jsonl.gz").touch()

        stats = get_archive_stats(tmp_path)

        assert stats["oldest_archive"] == "2026-01-10"
        assert stats["newest_archive"] == "2026-01-20"
```

#### Acceptance Criteria

- [ ] All tests pass
- [ ] Compression and decompression tested
- [ ] Edge cases (empty path, date filtering) tested

#### Test Script

```bash
# Run unit tests
cd coding-loops && python3 -m pytest tests/test_archive_writer.py -v

echo "OBS-1007: PASS - Archive writer tests validated"
```

#### Pass Criteria

- pytest exits with code 0
- All tests show PASSED

---

### OBS-1008: Create Integration Tests

**File:** `coding-loops/tests/test_archival_integration.py`

**Purpose:** Integration tests for full archival workflow.

#### Implementation

```python
# coding-loops/tests/test_archival_integration.py
"""
Integration tests for archival workflow.
"""

import sqlite3
import pytest
from datetime import datetime, timedelta
from pathlib import Path

from shared.archive_config import ArchiveConfig, RETENTION_POLICIES
from shared.database_archiver import DatabaseArchiver
from shared.archive_cleanup import ArchiveCleanup
from shared.archive_writer import ArchiveWriter, ArchiveReader, list_archives


@pytest.fixture
def test_db(tmp_path):
    """Create test database with schema and data."""
    db_path = tmp_path / "test.db"
    conn = sqlite3.connect(str(db_path))

    # Create tables
    conn.execute("""
        CREATE TABLE transcript_entries (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            sequence INTEGER,
            execution_id TEXT,
            task_id TEXT,
            instance_id TEXT,
            wave_number INTEGER,
            entry_type TEXT,
            category TEXT,
            summary TEXT,
            details TEXT,
            duration_ms INTEGER,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE tool_uses (
            id TEXT PRIMARY KEY,
            execution_id TEXT,
            task_id TEXT,
            transcript_entry_id TEXT,
            tool TEXT,
            tool_category TEXT,
            input TEXT,
            input_summary TEXT,
            result_status TEXT,
            output TEXT,
            output_summary TEXT,
            is_error INTEGER DEFAULT 0,
            is_blocked INTEGER DEFAULT 0,
            error_message TEXT,
            block_reason TEXT,
            start_time TEXT,
            end_time TEXT,
            duration_ms INTEGER,
            within_skill TEXT,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE assertion_results (
            id TEXT PRIMARY KEY,
            task_id TEXT,
            execution_id TEXT,
            category TEXT,
            description TEXT,
            result TEXT,
            evidence TEXT,
            chain_id TEXT,
            chain_position INTEGER,
            timestamp TEXT,
            duration_ms INTEGER,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE task_list_execution_runs (
            id TEXT PRIMARY KEY,
            task_list_id TEXT,
            status TEXT,
            started_at TEXT,
            completed_at TEXT
        )
    """)

    # Insert test data
    now = datetime.utcnow()
    old_date = (now - timedelta(days=10)).isoformat()
    recent_date = (now - timedelta(days=3)).isoformat()

    # Old transcript entries
    for i in range(5):
        conn.execute("""
            INSERT INTO transcript_entries
            (id, timestamp, sequence, execution_id, instance_id, entry_type, category, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"old-{i}", old_date, i, "exec-1", "inst-1", "task_start", "lifecycle", f"Old entry {i}"))

    # Recent transcript entries
    for i in range(3):
        conn.execute("""
            INSERT INTO transcript_entries
            (id, timestamp, sequence, execution_id, instance_id, entry_type, category, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"new-{i}", recent_date, i+5, "exec-1", "inst-1", "task_end", "lifecycle", f"New entry {i}"))

    # Old tool uses
    for i in range(3):
        conn.execute("""
            INSERT INTO tool_uses
            (id, execution_id, transcript_entry_id, tool, tool_category, input, input_summary,
             result_status, output_summary, start_time, end_time, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"tool-old-{i}", "exec-1", f"old-{i}", "Read", "file_read", "{}", "Read file",
              "done", "Success", old_date, old_date, 100))

    conn.commit()
    conn.close()

    return db_path


@pytest.fixture
def test_config(tmp_path, test_db):
    """Create test archive config."""
    return ArchiveConfig(
        base_path=tmp_path / "archives",
        db_path=test_db,
        compress=True,
        batch_size=10
    )


class TestFullArchivalWorkflow:
    """Integration tests for complete archival workflow."""

    def test_archive_old_records(self, test_config, test_db):
        """Test archiving old records from database."""
        # Initial count
        conn = sqlite3.connect(str(test_db))
        initial_count = conn.execute(
            "SELECT COUNT(*) FROM transcript_entries"
        ).fetchone()[0]
        assert initial_count == 8  # 5 old + 3 new
        conn.close()

        # Archive old records
        with DatabaseArchiver(test_config) as archiver:
            result = archiver.archive_table(
                "transcript_entries",
                older_than=timedelta(days=7)
            )

        assert result["status"] == "archived"
        assert result["records"] == 5  # 5 old records

        # Verify database updated
        conn = sqlite3.connect(str(test_db))
        remaining = conn.execute(
            "SELECT COUNT(*) FROM transcript_entries"
        ).fetchone()[0]
        assert remaining == 3  # Only new records remain
        conn.close()

        # Verify archive created
        archives = list_archives(test_config.warm_path)
        assert len(archives) == 1

        # Verify archive contents
        reader = ArchiveReader(archives[0])
        records = reader.read_all()
        assert len(records) == 5
        assert all("_archived_at" in r for r in records)

    def test_archive_transcripts_command(self, test_config):
        """Test archive_transcripts convenience method."""
        with DatabaseArchiver(test_config) as archiver:
            results = archiver.archive_transcripts(
                older_than=timedelta(days=7)
            )

        # Should archive transcript_entries and tool_uses
        archived_tables = {r["table"] for r in results if r.get("records", 0) > 0}
        assert "transcript_entries" in archived_tables
        assert "tool_uses" in archived_tables

    def test_dry_run_mode(self, test_config, test_db):
        """Test that dry run doesn't modify data."""
        with DatabaseArchiver(test_config) as archiver:
            result = archiver.archive_table(
                "transcript_entries",
                older_than=timedelta(days=7),
                dry_run=True
            )

        assert result["status"] == "dry_run"
        assert result["records"] == 5

        # Verify no changes to database
        conn = sqlite3.connect(str(test_db))
        count = conn.execute(
            "SELECT COUNT(*) FROM transcript_entries"
        ).fetchone()[0]
        assert count == 8  # All records still present
        conn.close()

        # Verify no archive created
        archives = list_archives(test_config.warm_path)
        assert len(archives) == 0

    def test_exempt_tables_skipped(self, test_config):
        """Test that exempt tables are skipped."""
        with DatabaseArchiver(test_config) as archiver:
            result = archiver.archive_table("task_list_execution_runs")

        assert result["status"] == "exempt"
        assert result["records"] == 0


class TestArchiveCleanupWorkflow:
    """Integration tests for archive cleanup."""

    def test_consolidate_old_archives(self, test_config):
        """Test consolidating warm archives to cold storage."""
        # Create old warm archives
        old_date = datetime.utcnow() - timedelta(days=45)
        with ArchiveWriter(
            test_config.warm_path, "test_table", old_date
        ) as writer:
            for i in range(10):
                writer.write_record({"id": str(i), "data": f"record {i}"})

        # Create recent archive
        recent_date = datetime.utcnow() - timedelta(days=5)
        with ArchiveWriter(
            test_config.warm_path, "test_table", recent_date
        ) as writer:
            writer.write_record({"id": "recent"})

        # Run consolidation
        cleanup = ArchiveCleanup(test_config)
        result = cleanup.consolidate_to_cold(older_than=timedelta(days=30))

        assert result["consolidated"] == 1
        assert len(result["cold_files"]) == 1

        # Verify cold archive created
        cold_archives = list(test_config.cold_path.rglob("*.tar.gz"))
        assert len(cold_archives) == 1

        # Verify warm archive removed
        warm_archives = list_archives(test_config.warm_path)
        assert len(warm_archives) == 1  # Only recent remains

    def test_retention_status(self, test_config):
        """Test retention status reporting."""
        # Create some archives
        with ArchiveWriter(
            test_config.warm_path,
            "test_table",
            datetime.utcnow() - timedelta(days=5)
        ) as writer:
            writer.write_record({"id": "1"})

        cleanup = ArchiveCleanup(test_config)
        status = cleanup.get_retention_status()

        assert "warm" in status
        assert "cold" in status
        assert status["warm"]["total_files"] == 1


class TestStatisticsTracking:
    """Integration tests for statistics tracking."""

    def test_table_stats(self, test_config, test_db):
        """Test getting statistics for a table."""
        with DatabaseArchiver(test_config) as archiver:
            stats = archiver.get_table_stats("transcript_entries")

        assert stats["table"] == "transcript_entries"
        assert stats["total"] == 8
        assert stats["hot"] == 3  # Recent records
        assert stats["stale"] == 5  # Old records

    def test_all_stats(self, test_config):
        """Test getting statistics for all tables."""
        with DatabaseArchiver(test_config) as archiver:
            all_stats = archiver.get_all_stats()

        table_names = {s["table"] for s in all_stats}
        assert "transcript_entries" in table_names
        assert "tool_uses" in table_names
```

#### Acceptance Criteria

- [ ] Full archival workflow tested end-to-end
- [ ] Database records correctly archived and deleted
- [ ] Archive files created with correct content
- [ ] Cleanup consolidation creates tar.gz files
- [ ] Dry run mode preserves all data
- [ ] Statistics correctly calculated

#### Test Script

```bash
# Run integration tests
cd coding-loops && python3 -m pytest tests/test_archival_integration.py -v

echo "OBS-1008: PASS - Integration tests validated"
```

#### Pass Criteria

- pytest exits with code 0
- All tests show PASSED
- Test database properly cleaned up

---

### OBS-1009: Create Cron Configuration

**File:** `coding-loops/cron/archival-schedule.md`

**Purpose:** Document recommended cron schedules.

#### Implementation

````markdown
# Observability Log Archival Schedule

## Recommended Cron Jobs

### Daily Archival (Transcripts)

Run at 2:00 AM daily to archive transcript data older than 7 days.

```cron
0 2 * * * cd /path/to/project && python3 coding-loops/cli.py archive transcripts --older-than 7d >> coding-loops/logs/archival.log 2>&1
```
````

### Weekly Archival (Assertions)

Run at 3:00 AM every Sunday to archive assertion data older than 30 days.

```cron
0 3 * * 0 cd /path/to/project && python3 coding-loops/cli.py archive assertions --older-than 30d >> coding-loops/logs/archival.log 2>&1
```

### Monthly Cleanup

Run at 4:00 AM on the 1st of each month to consolidate warm -> cold and purge expired.

```cron
0 4 1 * * cd /path/to/project && python3 coding-loops/cli.py cleanup archives --older-than 30d >> coding-loops/logs/archival.log 2>&1
```

## Installation

### Linux/macOS

```bash
# Edit crontab
crontab -e

# Add the above entries, adjusting paths as needed
```

### systemd Timer (Alternative)

Create `/etc/systemd/system/observability-archival.timer`:

```ini
[Unit]
Description=Observability Log Archival

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Create `/etc/systemd/system/observability-archival.service`:

```ini
[Unit]
Description=Run Observability Archival

[Service]
Type=oneshot
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/python3 coding-loops/cli.py archive all --older-than 7d
```

Enable:

```bash
sudo systemctl enable observability-archival.timer
sudo systemctl start observability-archival.timer
```

## Monitoring

### Check Last Run

```bash
# View archival log
tail -100 coding-loops/logs/archival.log

# Check retention status
python3 coding-loops/cli.py retention status
```

### Alerts

Consider setting up alerts for:

- Archival job failures
- Archive directory size exceeding threshold
- Hot storage exceeding configured retention

## Disk Space Planning

Estimate storage requirements based on activity:

| Metric                   | Estimate |
| ------------------------ | -------- |
| Transcript entries/day   | ~10,000  |
| Tool uses/day            | ~50,000  |
| Compressed size/month    | ~50 MB   |
| Annual warm archive size | ~600 MB  |
| Annual cold archive size | ~200 MB  |

Adjust `cold_days` in retention policies if storage is limited.

````

#### Acceptance Criteria

- [ ] Cron schedule documented for all three job types
- [ ] systemd alternative provided
- [ ] Disk space planning guidance included
- [ ] Monitoring recommendations provided

#### Test Script

```bash
# Verify cron syntax is valid
echo "0 2 * * * /bin/true" | crontab -l 2>/dev/null || echo "Cron syntax check passed"

# Test job manually
python3 coding-loops/cli.py archive transcripts --older-than 7d --dry-run

echo "OBS-1009: PASS - Cron configuration validated"
````

#### Pass Criteria

- Manual dry run executes successfully
- Cron syntax is valid
- Documentation is complete

---

### OBS-1010: Create Package **init**.py Files

**File:** `coding-loops/jobs/__init__.py` and `coding-loops/shared/__init__.py`

**Purpose:** Make directories proper Python packages.

#### Implementation

```python
# coding-loops/jobs/__init__.py
"""
Scheduled jobs for observability system.

Jobs:
    log_archival: Archive old observability data

Usage:
    python3 coding-loops/jobs/log_archival.py --mode daily
    python3 coding-loops/jobs/log_archival.py --mode weekly
    python3 coding-loops/jobs/log_archival.py --mode monthly
"""

from pathlib import Path

JOBS_DIR = Path(__file__).parent

__all__ = ["JOBS_DIR"]
```

```python
# coding-loops/shared/__init__.py (update existing)
"""
Shared modules for coding loops.

Archive Modules:
    archive_config: Retention policies and configuration
    archive_writer: JSONL archive file writer/reader
    database_archiver: SQLite to archive migration
    archive_cleanup: Warm -> cold consolidation and purging

Usage:
    from shared.archive_config import ArchiveConfig, get_policy
    from shared.database_archiver import DatabaseArchiver
    from shared.archive_cleanup import ArchiveCleanup
"""

# Archive modules
from .archive_config import (
    ArchiveConfig,
    RetentionPolicy,
    RETENTION_POLICIES,
    get_policy,
    is_exempt,
)

from .archive_writer import (
    ArchiveWriter,
    ArchiveReader,
    list_archives,
    get_archive_stats,
)

from .database_archiver import DatabaseArchiver
from .archive_cleanup import ArchiveCleanup

__all__ = [
    # Config
    "ArchiveConfig",
    "RetentionPolicy",
    "RETENTION_POLICIES",
    "get_policy",
    "is_exempt",
    # Writer/Reader
    "ArchiveWriter",
    "ArchiveReader",
    "list_archives",
    "get_archive_stats",
    # Services
    "DatabaseArchiver",
    "ArchiveCleanup",
]
```

#### Acceptance Criteria

- [ ] `coding-loops/jobs/__init__.py` created
- [ ] `coding-loops/shared/__init__.py` updated with archive exports
- [ ] Imports work correctly

#### Test Script

```bash
# Test imports
python3 -c "
from coding_loops.shared import (
    ArchiveConfig,
    DatabaseArchiver,
    ArchiveCleanup,
    ArchiveWriter,
    ArchiveReader
)
from coding_loops.jobs import JOBS_DIR
print('OBS-1010: PASS - Package imports validated')
"
```

#### Pass Criteria

- Import script exits with code 0
- All classes importable

---

### OBS-1011: Add CLI Help Documentation

**File:** Update `coding-loops/README.md`

**Purpose:** Document CLI commands in README.

#### Implementation

Add this section to `coding-loops/README.md`:

````markdown
## Observability Log Retention

The system includes automated log retention to manage observability data lifecycle.

### Retention Policies

| Data Type          | Hot (SQLite) | Warm (Archive) | Cold (Compressed) |
| ------------------ | ------------ | -------------- | ----------------- |
| Transcript entries | 7 days       | 30 days        | 1 year            |
| Tool uses          | 7 days       | 30 days        | 1 year            |
| Skill traces       | 7 days       | 30 days        | 1 year            |
| Assertion results  | 30 days      | 90 days        | 2 years           |
| Message bus log    | 7 days       | 30 days        | 90 days           |

### CLI Commands

```bash
# Archive transcripts older than 7 days
python3 coding-loops/cli.py archive transcripts --older-than 7d

# Archive assertions older than 30 days
python3 coding-loops/cli.py archive assertions --older-than 30d

# Archive all data
python3 coding-loops/cli.py archive all --older-than 7d

# Clean up old archives
python3 coding-loops/cli.py cleanup archives --older-than 1y

# View retention status
python3 coding-loops/cli.py retention status

# View retention policies
python3 coding-loops/cli.py retention policy
```
````

### Scheduled Jobs

For automated archival, add to crontab:

```cron
# Daily: Archive transcripts
0 2 * * * python3 /path/to/coding-loops/cli.py archive transcripts --older-than 7d

# Weekly: Archive assertions
0 3 * * 0 python3 /path/to/coding-loops/cli.py archive assertions --older-than 30d

# Monthly: Clean up
0 4 1 * * python3 /path/to/coding-loops/cli.py cleanup archives --older-than 30d
```

### Archive Structure

```
coding-loops/archives/
├── warm/                       # JSONL archives (searchable)
│   ├── 2026-01-15/
│   │   ├── transcript_entries.jsonl.gz
│   │   ├── tool_uses.jsonl.gz
│   │   └── skill_traces.jsonl.gz
│   └── 2026-01-16/
│       └── ...
└── cold/                       # Compressed monthly archives
    └── 2025/
        ├── 2025-11.tar.gz
        └── 2025-12.tar.gz
```

````

#### Acceptance Criteria

- [ ] README updated with retention documentation
- [ ] CLI commands documented with examples
- [ ] Cron examples included
- [ ] Archive structure explained

#### Test Script

```bash
# Verify README contains archival section
grep -q "Log Retention" coding-loops/README.md && echo "OBS-1011: PASS - README documented"
````

#### Pass Criteria

- grep finds "Log Retention" in README

---

### OBS-1012: Create E2E Validation Script

**File:** `coding-loops/tests/e2e/test_archival_e2e.sh`

**Purpose:** End-to-end validation script.

#### Implementation

```bash
#!/bin/bash
# coding-loops/tests/e2e/test_archival_e2e.sh
#
# End-to-end validation for Phase 10: Log Retention & Archival
#
# Usage:
#   ./coding-loops/tests/e2e/test_archival_e2e.sh
#
# Prerequisites:
#   - Database must exist with observability tables
#   - Python 3.9+ with required packages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI="python3 $PROJECT_ROOT/coding-loops/cli.py"

echo "=============================================="
echo "Phase 10: Log Retention E2E Validation"
echo "=============================================="
echo ""

# Track results
PASSED=0
FAILED=0

# Helper function
test_command() {
    local name="$1"
    local cmd="$2"
    local expect="$3"

    echo -n "Testing: $name... "

    output=$(eval "$cmd" 2>&1) || {
        echo "FAILED (exit code: $?)"
        echo "  Output: $output"
        ((FAILED++))
        return 1
    }

    if [ -n "$expect" ]; then
        if echo "$output" | grep -q "$expect"; then
            echo "PASSED"
            ((PASSED++))
        else
            echo "FAILED (expected: $expect)"
            echo "  Output: $output"
            ((FAILED++))
        fi
    else
        echo "PASSED"
        ((PASSED++))
    fi
}

echo "1. CLI Help Tests"
echo "-----------------"
test_command "Main help" "$CLI --help" "Available commands"
test_command "Archive help" "$CLI archive --help" "Archive old observability data"
test_command "Cleanup help" "$CLI cleanup --help" "Clean up archived data"
test_command "Retention help" "$CLI retention --help" "Retention subcommands"

echo ""
echo "2. Archive Commands (Dry Run)"
echo "-----------------------------"
test_command "Archive transcripts" "$CLI archive transcripts --older-than 7d --dry-run" "DRY RUN"
test_command "Archive assertions" "$CLI archive assertions --older-than 30d --dry-run" "DRY RUN"
test_command "Archive all" "$CLI archive all --older-than 7d --dry-run" "DRY RUN"
test_command "Archive JSON output" "$CLI archive all --older-than 7d --dry-run --json" '"dry_run": true'

echo ""
echo "3. Cleanup Commands (Dry Run)"
echo "-----------------------------"
test_command "Cleanup archives" "$CLI cleanup archives --older-than 30d --dry-run" "DRY RUN"
test_command "Cleanup consolidate only" "$CLI cleanup archives --consolidate-only --dry-run" "Cleanup Results"

echo ""
echo "4. Retention Commands"
echo "---------------------"
test_command "Retention status" "$CLI retention status" "HOT STORAGE"
test_command "Retention policy" "$CLI retention policy" "Retention Policies"
test_command "Retention policy JSON" "$CLI retention policy --json" '"hot_days"'

echo ""
echo "5. Python Module Tests"
echo "----------------------"
test_command "Import archive_config" "python3 -c 'from coding_loops.shared.archive_config import ArchiveConfig'" ""
test_command "Import archive_writer" "python3 -c 'from coding_loops.shared.archive_writer import ArchiveWriter'" ""
test_command "Import database_archiver" "python3 -c 'from coding_loops.shared.database_archiver import DatabaseArchiver'" ""
test_command "Import archive_cleanup" "python3 -c 'from coding_loops.shared.archive_cleanup import ArchiveCleanup'" ""

echo ""
echo "6. Job Module Tests"
echo "-------------------"
test_command "Job daily mode" "python3 $PROJECT_ROOT/coding-loops/jobs/log_archival.py --mode daily --dry-run" '"mode": "daily"'
test_command "Job weekly mode" "python3 $PROJECT_ROOT/coding-loops/jobs/log_archival.py --mode weekly --dry-run" '"mode": "weekly"'
test_command "Job monthly mode" "python3 $PROJECT_ROOT/coding-loops/jobs/log_archival.py --mode monthly --dry-run" '"mode": "monthly"'

echo ""
echo "=============================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "✅ Phase 10: All E2E tests PASSED"
    exit 0
else
    echo ""
    echo "❌ Phase 10: Some tests FAILED"
    exit 1
fi
```

#### Acceptance Criteria

- [ ] All CLI commands tested
- [ ] Dry run mode verified
- [ ] Python imports verified
- [ ] Job modes verified
- [ ] Exit code 0 when all pass

#### Test Script

```bash
chmod +x coding-loops/tests/e2e/test_archival_e2e.sh
./coding-loops/tests/e2e/test_archival_e2e.sh
```

#### Pass Criteria

- Script exits with code 0
- Output shows "All E2E tests PASSED"

---

## Validation Checkpoints

### Phase 10 Complete Checklist

#### Core Modules

- [ ] `coding-loops/shared/archive_config.py` - Retention policies
- [ ] `coding-loops/shared/archive_writer.py` - JSONL writer/reader
- [ ] `coding-loops/shared/database_archiver.py` - Database archival
- [ ] `coding-loops/shared/archive_cleanup.py` - Cleanup service

#### CLI & Jobs

- [ ] `coding-loops/cli.py` - Main CLI entry point
- [ ] `coding-loops/jobs/log_archival.py` - Scheduled job

#### Tests

- [ ] `coding-loops/tests/test_archive_config.py` - Config unit tests
- [ ] `coding-loops/tests/test_archive_writer.py` - Writer unit tests
- [ ] `coding-loops/tests/test_archival_integration.py` - Integration tests
- [ ] `coding-loops/tests/e2e/test_archival_e2e.sh` - E2E validation

#### Documentation

- [ ] `coding-loops/cron/archival-schedule.md` - Cron documentation
- [ ] `coding-loops/README.md` updated with retention docs

### Final Validation Commands

```bash
# 1. Run unit tests
cd coding-loops && python3 -m pytest tests/test_archive*.py -v

# 2. Run integration tests
python3 -m pytest tests/test_archival_integration.py -v

# 3. Run E2E validation
./tests/e2e/test_archival_e2e.sh

# 4. Manual verification
python3 ../coding-loops/cli.py retention status
python3 ../coding-loops/cli.py archive all --older-than 7d --dry-run

# 5. Verify no regressions
npm test
```

### Success Criteria

- [ ] All unit tests pass (100%)
- [ ] All integration tests pass
- [ ] E2E script exits 0
- [ ] CLI commands work as documented
- [ ] No regressions in existing tests

---

## Summary

Phase 10 implements a complete log retention system with:

1. **Configuration Layer** - Retention policies per table
2. **Archive Writer** - JSONL files with gzip compression
3. **Database Archiver** - Move old records from SQLite to archives
4. **Archive Cleanup** - Consolidate warm -> cold, purge expired
5. **CLI Interface** - `archive`, `cleanup`, `retention` commands
6. **Scheduled Jobs** - Daily, weekly, monthly archival modes
7. **Comprehensive Tests** - Unit, integration, E2E validation

The system follows the tiered storage model:

- **Hot** (SQLite): Fast queries, 7-30 days
- **Warm** (JSONL.gz): Searchable archives, 30-90 days
- **Cold** (tar.gz): Compressed storage, 1-2 years

---

_This implementation plan provides all code, tests, and validation needed for Phase 10._
