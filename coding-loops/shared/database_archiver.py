# coding-loops/shared/database_archiver.py
"""
Database archiver for observability tables.

Moves old records from SQLite to JSONL archives based on retention policies.
"""

import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
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
    ) -> Dict[str, Any]:
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
        cutoff_date = datetime.now(timezone.utc).replace(tzinfo=None) - threshold
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
        archive_date = datetime.now(timezone.utc).replace(tzinfo=None)
        failed_batches = 0

        try:
            with ArchiveWriter(
                self.config.warm_path,
                table_name,
                archive_date,
                compress=self.config.compress
            ) as writer:

                while archived < count:
                    try:
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

                        # Write to archive first (safer: potential duplicates > data loss)
                        records = [dict(row) for row in rows]
                        writer.write_batch(records)

                        # Delete archived records only after successful write
                        ids = [r["id"] for r in records]
                        placeholders = ",".join("?" * len(ids))
                        delete_sql = f"DELETE FROM {table_name} WHERE id IN ({placeholders})"
                        self._conn.execute(delete_sql, ids)
                        self._conn.commit()

                        archived += len(records)
                        logger.info(f"Archived {archived}/{count} records from {table_name}")

                    except sqlite3.Error as e:
                        # Rollback the current batch on database error
                        self._conn.rollback()
                        logger.error(f"Database error archiving {table_name}: {e}")
                        failed_batches += 1
                        if failed_batches >= 3:
                            logger.error(f"Too many failures, stopping archival of {table_name}")
                            break

        except Exception as e:
            logger.error(f"Failed to archive {table_name}: {e}")
            return {
                "table": table_name,
                "status": "error",
                "records": archived,
                "error": str(e),
                "cutoff_date": cutoff_str
            }

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
    ) -> List[Dict[str, Any]]:
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
    ) -> List[Dict[str, Any]]:
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
    ) -> List[Dict[str, Any]]:
        """Archive assertion-related tables."""
        tables = ["assertion_results", "assertion_chains"]
        results = []

        for table in tables:
            result = self.archive_table(table, older_than, dry_run)
            results.append(result)

        return results

    def get_table_stats(self, table_name: str) -> Dict[str, Any]:
        """Get statistics for a table."""
        policy = get_policy(table_name)
        if not policy:
            return {"table": table_name, "error": "no_policy"}

        # Total count
        total_sql = f"SELECT COUNT(*) as count FROM {table_name}"
        total = self._conn.execute(total_sql).fetchone()["count"]

        # Calculate age buckets
        now = datetime.now(timezone.utc).replace(tzinfo=None)
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

    def get_all_stats(self) -> List[Dict[str, Any]]:
        """Get statistics for all tables."""
        return [
            self.get_table_stats(table)
            for table in RETENTION_POLICIES.keys()
        ]
