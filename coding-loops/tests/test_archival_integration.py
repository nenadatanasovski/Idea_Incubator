# coding-loops/tests/test_archival_integration.py
"""
Integration tests for archival workflow.
"""

import sqlite3
import pytest
from datetime import datetime, timedelta, timezone
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
        CREATE TABLE skill_traces (
            id TEXT PRIMARY KEY,
            execution_id TEXT,
            task_id TEXT,
            skill_name TEXT,
            start_time TEXT,
            end_time TEXT,
            duration_ms INTEGER,
            status TEXT,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE assertion_chains (
            id TEXT PRIMARY KEY,
            task_id TEXT,
            execution_id TEXT,
            chain_type TEXT,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE message_bus_log (
            id TEXT PRIMARY KEY,
            event_type TEXT,
            source TEXT,
            payload TEXT,
            timestamp TEXT,
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
    now = datetime.now(timezone.utc).replace(tzinfo=None)
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
        old_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=45)
        with ArchiveWriter(
            test_config.warm_path, "test_table", old_date
        ) as writer:
            for i in range(10):
                writer.write_record({"id": str(i), "data": f"record {i}"})

        # Create recent archive
        recent_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=5)
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

    def test_purge_expired_archives(self, test_config):
        """Test purging expired cold archives."""
        import tarfile

        # Create a cold archive that should be expired (older than max retention)
        # Max retention is 850 days (assertion_results), so we need to go back ~3 years
        year_dir = test_config.cold_path / "2022"
        year_dir.mkdir(parents=True, exist_ok=True)

        # Create a tar.gz file for an old month
        tar_path = year_dir / "2022-01.tar.gz"
        with tarfile.open(tar_path, "w:gz") as tar:
            # Add a dummy file
            import io
            data = b"dummy data"
            info = tarfile.TarInfo(name="dummy.txt")
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))

        # Also create a recent cold archive that should NOT be purged
        recent_year_dir = test_config.cold_path / "2026"
        recent_year_dir.mkdir(parents=True, exist_ok=True)
        recent_tar_path = recent_year_dir / "2026-01.tar.gz"
        with tarfile.open(recent_tar_path, "w:gz") as tar:
            info = tarfile.TarInfo(name="recent.txt")
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))

        # Run purge
        cleanup = ArchiveCleanup(test_config)
        result = cleanup.purge_expired(dry_run=False)

        # The old archive should be purged
        assert result["status"] == "success"
        assert len(result["purged_files"]) == 1
        assert "2022-01" in result["purged_files"][0]
        assert not tar_path.exists()

        # The recent archive should still exist
        assert recent_tar_path.exists()

    def test_retention_status(self, test_config):
        """Test retention status reporting."""
        # Create some archives
        with ArchiveWriter(
            test_config.warm_path,
            "test_table",
            datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=5)
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
        assert stats["hot"] == 3  # Recent records (< 7 days old)
        # Old records at 10 days are in warm bucket (7-37 days), not stale
        assert stats["warm"] == 5  # Old records in warm range

    def test_all_stats(self, test_config):
        """Test getting statistics for all tables."""
        with DatabaseArchiver(test_config) as archiver:
            all_stats = archiver.get_all_stats()

        table_names = {s["table"] for s in all_stats}
        assert "transcript_entries" in table_names
        assert "tool_uses" in table_names
