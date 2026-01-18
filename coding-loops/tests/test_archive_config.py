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
