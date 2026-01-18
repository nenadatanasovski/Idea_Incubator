# coding-loops/shared/archive_writer.py
"""
Archive writer for JSONL files with gzip compression.

Handles writing database records to archive files.
"""

import gzip
import json
from datetime import datetime, timezone
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
        record["_archived_at"] = datetime.now(timezone.utc).isoformat()

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
    """Get statistics about archives (warm storage with JSONL files)."""
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


def get_cold_storage_stats(base_path: Path) -> Dict[str, Any]:
    """Get statistics about cold storage (monthly tar.gz files)."""
    stats = {
        "total_files": 0,
        "total_size_bytes": 0,
        "by_year": {},
        "by_month": {},
        "oldest_archive": None,
        "newest_archive": None,
    }

    if not base_path.exists():
        return stats

    for year_dir in base_path.iterdir():
        if not year_dir.is_dir():
            continue

        try:
            year = int(year_dir.name)
        except ValueError:
            continue

        for tar_file in year_dir.glob("*.tar.gz"):
            stats["total_files"] += 1
            file_size = tar_file.stat().st_size
            stats["total_size_bytes"] += file_size

            # By year
            if year_dir.name not in stats["by_year"]:
                stats["by_year"][year_dir.name] = {"files": 0, "size_bytes": 0}
            stats["by_year"][year_dir.name]["files"] += 1
            stats["by_year"][year_dir.name]["size_bytes"] += file_size

            # By month (e.g., "2025-01" from "2025-01.tar.gz")
            month_str = tar_file.stem.replace(".tar", "")
            if month_str not in stats["by_month"]:
                stats["by_month"][month_str] = {"files": 0, "size_bytes": 0}
            stats["by_month"][month_str]["files"] += 1
            stats["by_month"][month_str]["size_bytes"] += file_size

            # Track oldest/newest
            if stats["oldest_archive"] is None or month_str < stats["oldest_archive"]:
                stats["oldest_archive"] = month_str
            if stats["newest_archive"] is None or month_str > stats["newest_archive"]:
                stats["newest_archive"] = month_str

    return stats
