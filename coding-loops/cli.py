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
            status_icon = "+" if r.get("status") == "archived" else "o"
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

    print("\n[Retention Status]")
    print("=" * 70)

    # Database stats
    print("\n[HOT STORAGE (SQLite)]")
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
    print("\n[WARM ARCHIVE]")
    print("-" * 70)
    warm = archive_status["warm"]
    print(f"  Files:    {warm['total_files']}")
    print(f"  Size:     {warm['total_size_mb']} MB")
    print(f"  Oldest:   {warm['oldest'] or 'N/A'}")
    print(f"  Newest:   {warm['newest'] or 'N/A'}")
    print(f"  Ready for cold: {warm['eligible_for_cold']} archives")

    print("\n[COLD ARCHIVE]")
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

    print("\n[Retention Policies]")
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
