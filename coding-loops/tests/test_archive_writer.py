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
