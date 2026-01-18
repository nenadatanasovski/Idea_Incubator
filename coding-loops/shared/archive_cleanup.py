# coding-loops/shared/archive_cleanup.py
"""
Archive cleanup service.

Manages archive lifecycle: warm -> cold -> delete
"""

import gzip
import shutil
import tarfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging

from .archive_config import ArchiveConfig, RETENTION_POLICIES, get_policy
from .archive_writer import list_archives, get_archive_stats, get_cold_storage_stats

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
    ) -> Dict[str, Any]:
        """
        Consolidate warm archives older than threshold into cold storage.

        Creates monthly tar.gz files in cold storage.
        """
        cutoff_date = datetime.now(timezone.utc).replace(tzinfo=None) - older_than

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
    ) -> Dict[str, Any]:
        """
        Delete archives that have exceeded their retention period.

        Checks cold storage against table-specific cold_days policies.
        """
        results = {
            "status": "success",
            "purged_files": [],
            "purged_bytes": 0
        }

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Check cold storage
        if not self.config.cold_path.exists():
            return results

        for year_dir in self.config.cold_path.iterdir():
            if not year_dir.is_dir():
                continue

            for tar_file in year_dir.glob("*.tar.gz"):
                # Parse month from filename (handle double extension .tar.gz)
                # tar_file.stem gives "2025-01.tar", need to remove .tar
                month_str = tar_file.stem.replace(".tar", "")  # e.g., "2025-01"
                try:
                    archive_date = datetime.strptime(month_str, "%Y-%m")
                except ValueError:
                    logger.warning(f"Cannot parse date from archive: {tar_file}")
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
    ) -> Dict[str, Any]:
        """Run full cleanup: consolidate warm -> cold, then purge expired."""
        results = {
            "consolidation": self.consolidate_to_cold(consolidate_older_than, dry_run),
            "purge": self.purge_expired(dry_run)
        }
        return results

    def get_retention_status(self) -> Dict[str, Any]:
        """Get comprehensive retention status across all storage tiers."""
        warm_stats = get_archive_stats(self.config.warm_path)
        cold_stats = get_cold_storage_stats(self.config.cold_path)

        # Calculate what's eligible for cleanup
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        eligible_for_cold = 0

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
