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
from datetime import datetime, timedelta, timezone
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
        "timestamp": datetime.now(timezone.utc).isoformat(),
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
        "timestamp": datetime.now(timezone.utc).isoformat(),
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
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
        "consolidation": results["consolidation"],
        "purge": results["purge"]
    }


def run_full_archival(config: ArchiveConfig, dry_run: bool = False) -> dict:
    """Run all archival and cleanup tasks."""
    logger.info("Starting full archival job")

    results = {
        "mode": "full",
        "timestamp": datetime.now(timezone.utc).isoformat(),
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
