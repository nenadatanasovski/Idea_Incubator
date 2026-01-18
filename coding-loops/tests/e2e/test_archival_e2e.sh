#!/bin/bash
# coding-loops/tests/e2e/test_archival_e2e.sh
#
# End-to-end validation for Phase 10: Log Retention & Archival
#
# Usage:
#   ./coding-loops/tests/e2e/test_archival_e2e.sh
#
# Prerequisites:
#   - Database must exist with observability tables
#   - Python 3.9+ with required packages

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI="python3 $PROJECT_ROOT/coding-loops/cli.py"

echo "=============================================="
echo "Phase 10: Log Retention E2E Validation"
echo "=============================================="
echo ""

# Track results
PASSED=0
FAILED=0

# Helper function
test_command() {
    local name="$1"
    local cmd="$2"
    local expect="$3"

    echo -n "Testing: $name... "

    if output=$(eval "$cmd" 2>&1); then
        if [ -z "$expect" ]; then
            echo "PASSED"
            PASSED=$((PASSED + 1))
            return 0
        elif echo "$output" | grep -q "$expect"; then
            echo "PASSED"
            PASSED=$((PASSED + 1))
            return 0
        else
            echo "FAILED (expected: $expect)"
            echo "  Output: ${output:0:200}..."
            FAILED=$((FAILED + 1))
            return 1
        fi
    else
        echo "FAILED (exit code: $?)"
        echo "  Output: ${output:0:200}..."
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "1. CLI Help Tests"
echo "-----------------"
test_command "Main help" "$CLI --help" "Available commands"
test_command "Archive help" "$CLI archive --help" "cli.py archive"
test_command "Cleanup help" "$CLI cleanup --help" "cli.py cleanup"
test_command "Retention help" "$CLI retention --help" "Retention subcommands"

echo ""
echo "2. Archive Commands (Dry Run)"
echo "-----------------------------"
test_command "Archive transcripts" "$CLI archive transcripts --older-than 7d --dry-run" "DRY RUN"
test_command "Archive assertions" "$CLI archive assertions --older-than 30d --dry-run" "DRY RUN"
test_command "Archive all" "$CLI archive all --older-than 7d --dry-run" "DRY RUN"
test_command "Archive JSON output" "$CLI archive all --older-than 7d --dry-run --json" "table"

echo ""
echo "3. Cleanup Commands (Dry Run)"
echo "-----------------------------"
test_command "Cleanup archives" "$CLI cleanup archives --older-than 30d --dry-run" "DRY RUN"
test_command "Cleanup consolidate only" "$CLI cleanup archives --consolidate-only --dry-run" "Cleanup Results"

echo ""
echo "4. Retention Commands"
echo "---------------------"
test_command "Retention status" "$CLI retention status" "HOT STORAGE"
test_command "Retention policy" "$CLI retention policy" "Retention Policies"
test_command "Retention policy JSON" "$CLI retention policy --json" "hot_days"

echo ""
echo "5. Python Module Tests"
echo "----------------------"
test_command "Import archive_config" "cd $PROJECT_ROOT/coding-loops && python3 -c 'from shared.archive_config import ArchiveConfig'" ""
test_command "Import archive_writer" "cd $PROJECT_ROOT/coding-loops && python3 -c 'from shared.archive_writer import ArchiveWriter'" ""
test_command "Import database_archiver" "cd $PROJECT_ROOT/coding-loops && python3 -c 'from shared.database_archiver import DatabaseArchiver'" ""
test_command "Import archive_cleanup" "cd $PROJECT_ROOT/coding-loops && python3 -c 'from shared.archive_cleanup import ArchiveCleanup'" ""

echo ""
echo "6. Job Module Tests"
echo "-------------------"
test_command "Job daily mode" "python3 $PROJECT_ROOT/coding-loops/jobs/log_archival.py --mode daily --dry-run" "daily"
test_command "Job weekly mode" "python3 $PROJECT_ROOT/coding-loops/jobs/log_archival.py --mode weekly --dry-run" "weekly"
test_command "Job monthly mode" "python3 $PROJECT_ROOT/coding-loops/jobs/log_archival.py --mode monthly --dry-run" "monthly"

echo ""
echo "=============================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=============================================="

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "Phase 10: All E2E tests PASSED"
    exit 0
else
    echo ""
    echo "Phase 10: Some tests FAILED"
    exit 1
fi
