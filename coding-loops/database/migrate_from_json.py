"""
Migration from test-state.json to Database

Migrates existing test-state.json files to the coordination database.
This is a one-time migration for transitioning to database-only state.

Usage:
    # Migrate all loops
    python -m database.migrate_from_json

    # Migrate specific loop
    python -m database.migrate_from_json --loop loop-1-critical-path

    # Dry run (preview only)
    python -m database.migrate_from_json --dry-run
"""

import json
import argparse
import logging
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from .init_db import init_database, get_db_path, ensure_initialized
from .models import Loop, Test, LoopStatus
from .queries import LoopQueries, TestQueries

logger = logging.getLogger(__name__)

# Base path for coding loops
CODING_LOOPS_DIR = Path(__file__).parent.parent


def discover_loops() -> List[Path]:
    """Discover all loop directories with test-state.json files."""
    loops = []
    for dir_path in CODING_LOOPS_DIR.iterdir():
        if dir_path.is_dir() and dir_path.name.startswith("loop-"):
            test_state = dir_path / "specs" / "test-state.json"
            if test_state.exists():
                loops.append(dir_path)
                logger.info(f"Discovered loop: {dir_path.name}")
    return loops


def read_test_state(loop_dir: Path) -> Optional[dict]:
    """Read test-state.json from a loop directory."""
    test_state_path = loop_dir / "specs" / "test-state.json"
    if not test_state_path.exists():
        logger.warning(f"No test-state.json found in {loop_dir}")
        return None

    try:
        with open(test_state_path, "r") as f:
            data = json.load(f)
            logger.info(f"Read {len(data.get('tests', []))} tests from {test_state_path}")
            return data
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {test_state_path}: {e}")
        return None


def read_loop_config(loop_dir: Path) -> Optional[dict]:
    """Read config.json from a loop directory."""
    config_path = loop_dir / "config.json"
    if not config_path.exists():
        logger.warning(f"No config.json found in {loop_dir}")
        return None

    try:
        with open(config_path, "r") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {config_path}: {e}")
        return None


def migrate_loop(
    loop_dir: Path,
    dry_run: bool = False,
    db_path: Optional[Path] = None
) -> dict:
    """
    Migrate a single loop's test-state.json to the database.

    Returns:
        dict with migration statistics
    """
    loop_id = loop_dir.name
    stats = {
        "loop_id": loop_id,
        "tests_migrated": 0,
        "tests_skipped": 0,
        "errors": []
    }

    # Read test state
    test_state = read_test_state(loop_dir)
    if not test_state:
        stats["errors"].append("Could not read test-state.json")
        return stats

    # Read config for loop metadata
    config = read_loop_config(loop_dir)

    # Create loop record
    loop = Loop(
        id=loop_id,
        name=test_state.get("name", config.get("name", loop_id) if config else loop_id),
        priority=config.get("priority", 5) if config else 5,
        status=LoopStatus.STOPPED.value
    )

    if dry_run:
        logger.info(f"[DRY RUN] Would register loop: {loop.id} ({loop.name})")
    else:
        LoopQueries.register(loop, db_path)
        logger.info(f"Registered loop: {loop.id}")

    # Migrate tests
    for test_data in test_state.get("tests", []):
        try:
            test = Test(
                id=test_data["id"],
                loop_id=loop_id,
                category=test_data.get("category", "unknown"),
                status=test_data.get("status", "pending"),
                attempts=test_data.get("attempts", 0),
                max_attempts=test_data.get("maxAttempts", 3),
                last_result=test_data.get("lastResult"),
                depends_on=test_data.get("dependsOn"),
                automatable=test_data.get("automatable", True),
                notes=test_data.get("notes"),
                spec_content=test_data.get("specContent"),
                last_attempt_at=test_data.get("lastAttemptAt"),
                passed_at=test_data.get("passedAt")
            )

            if dry_run:
                logger.info(f"[DRY RUN] Would migrate test: {test.id} ({test.status})")
            else:
                TestQueries.register(test, db_path)

            stats["tests_migrated"] += 1

        except Exception as e:
            error_msg = f"Failed to migrate test {test_data.get('id', 'unknown')}: {e}"
            logger.error(error_msg)
            stats["errors"].append(error_msg)
            stats["tests_skipped"] += 1

    return stats


def migrate_all(
    dry_run: bool = False,
    db_path: Optional[Path] = None
) -> List[dict]:
    """Migrate all discovered loops."""
    results = []
    loops = discover_loops()

    if not loops:
        logger.warning("No loops found to migrate")
        return results

    logger.info(f"Found {len(loops)} loops to migrate")

    for loop_dir in loops:
        result = migrate_loop(loop_dir, dry_run, db_path)
        results.append(result)

    return results


def verify_migration(db_path: Optional[Path] = None) -> dict:
    """Verify migration was successful by comparing database to JSON files."""
    verification = {
        "loops": [],
        "total_tests_db": 0,
        "total_tests_json": 0,
        "match": False
    }

    loops = discover_loops()

    for loop_dir in loops:
        loop_id = loop_dir.name
        test_state = read_test_state(loop_dir)

        if not test_state:
            continue

        json_count = len(test_state.get("tests", []))
        verification["total_tests_json"] += json_count

        # Count in database
        db_tests = TestQueries.get_all_for_loop(loop_id, db_path)
        db_count = len(db_tests)
        verification["total_tests_db"] += db_count

        loop_match = db_count == json_count
        verification["loops"].append({
            "loop_id": loop_id,
            "json_count": json_count,
            "db_count": db_count,
            "match": loop_match
        })

    verification["match"] = (
        verification["total_tests_db"] == verification["total_tests_json"]
    )

    return verification


def generate_backup(loop_dir: Path) -> Path:
    """Create a backup of test-state.json before migration."""
    test_state_path = loop_dir / "specs" / "test-state.json"
    backup_path = loop_dir / "specs" / f"test-state.json.backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    if test_state_path.exists():
        import shutil
        shutil.copy(test_state_path, backup_path)
        logger.info(f"Created backup: {backup_path}")
        return backup_path

    return None


def main():
    """Main entry point for migration."""
    parser = argparse.ArgumentParser(
        description="Migrate test-state.json files to coordination database"
    )
    parser.add_argument(
        "--loop",
        help="Migrate only this loop (e.g., loop-1-critical-path)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview migration without making changes"
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify migration after completion"
    )
    parser.add_argument(
        "--backup",
        action="store_true",
        help="Create backups before migration"
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        help="Path to database file"
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="Initialize database before migration"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    # Configure logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )

    db_path = args.db_path

    # Initialize database if requested
    if args.init:
        logger.info("Initializing database...")
        init_database(db_path)
    else:
        # Ensure database exists
        ensure_initialized(db_path)

    # Create backups if requested
    if args.backup and not args.dry_run:
        logger.info("Creating backups...")
        if args.loop:
            loop_dir = CODING_LOOPS_DIR / args.loop
            if loop_dir.exists():
                generate_backup(loop_dir)
        else:
            for loop_dir in discover_loops():
                generate_backup(loop_dir)

    # Run migration
    if args.loop:
        loop_dir = CODING_LOOPS_DIR / args.loop
        if not loop_dir.exists():
            logger.error(f"Loop directory not found: {loop_dir}")
            return 1

        results = [migrate_loop(loop_dir, args.dry_run, db_path)]
    else:
        results = migrate_all(args.dry_run, db_path)

    # Print results
    print("\n" + "=" * 60)
    print("MIGRATION RESULTS")
    print("=" * 60)

    total_migrated = 0
    total_skipped = 0
    total_errors = 0

    for result in results:
        print(f"\n{result['loop_id']}:")
        print(f"  Tests migrated: {result['tests_migrated']}")
        print(f"  Tests skipped:  {result['tests_skipped']}")
        if result["errors"]:
            print(f"  Errors:")
            for error in result["errors"]:
                print(f"    - {error}")

        total_migrated += result["tests_migrated"]
        total_skipped += result["tests_skipped"]
        total_errors += len(result["errors"])

    print("\n" + "-" * 60)
    print(f"Total tests migrated: {total_migrated}")
    print(f"Total tests skipped:  {total_skipped}")
    print(f"Total errors:         {total_errors}")

    # Verify if requested
    if args.verify and not args.dry_run:
        print("\n" + "=" * 60)
        print("VERIFICATION")
        print("=" * 60)

        verification = verify_migration(db_path)
        print(f"\nTotal tests in JSON:     {verification['total_tests_json']}")
        print(f"Total tests in database: {verification['total_tests_db']}")
        print(f"Overall match:           {verification['match']}")

        for loop in verification["loops"]:
            status = "✓" if loop["match"] else "✗"
            print(f"  {status} {loop['loop_id']}: {loop['db_count']}/{loop['json_count']}")

    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
