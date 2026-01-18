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
