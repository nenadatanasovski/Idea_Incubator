#!/usr/bin/env python3
"""
Coding Loop System Verification Script
=======================================

Verifies that all coding loop harnesses are properly configured and ready to run.

Usage:
    python3 coding-loops/verify-system.py
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add paths
sys.path.insert(0, str(Path(__file__).parent / "shared"))
sys.path.insert(0, str(Path(__file__).parent.parent / "tests" / "e2e"))


def print_header(text: str):
    print()
    print("=" * 60)
    print(f"  {text}")
    print("=" * 60)


def print_check(name: str, passed: bool, detail: str = ""):
    status = "PASS" if passed else "FAIL"
    symbol = "[+]" if passed else "[X]"
    if detail:
        print(f"  {symbol} {name}: {status} - {detail}")
    else:
        print(f"  {symbol} {name}: {status}")
    return passed


def check_imports():
    """Check that all required imports work."""
    print_header("Import Checks")
    all_passed = True

    # Core imports
    try:
        from ralph_loop_base import RalphLoopRunner, load_config, validate_json, load_schema, HealthCheck
        all_passed &= print_check("ralph_loop_base", True, "All exports available")
    except Exception as e:
        all_passed &= print_check("ralph_loop_base", False, str(e))

    # Claude SDK
    try:
        from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient
        all_passed &= print_check("claude_code_sdk", True, "SDK installed")
    except Exception as e:
        all_passed &= print_check("claude_code_sdk", False, str(e))

    # Client helper
    try:
        from client import create_client
        all_passed &= print_check("client.create_client", True, "Available")
    except Exception as e:
        all_passed &= print_check("client.create_client", False, str(e))

    return all_passed


def check_schemas():
    """Check that JSON schemas exist and are valid."""
    print_header("Schema Checks")
    all_passed = True

    schema_dir = Path(__file__).parent / "shared"

    for schema_name in ["config_schema.json", "test_state_schema.json"]:
        schema_path = schema_dir / schema_name
        if schema_path.exists():
            try:
                with open(schema_path) as f:
                    schema = json.load(f)
                all_passed &= print_check(schema_name, True, f"{len(schema.get('properties', {}))} properties")
            except Exception as e:
                all_passed &= print_check(schema_name, False, str(e))
        else:
            all_passed &= print_check(schema_name, False, "File not found")

    return all_passed


def check_loop(loop_name: str):
    """Check a single loop configuration."""
    print_header(f"Loop: {loop_name}")
    all_passed = True

    loop_dir = Path(__file__).parent / loop_name
    specs_dir = loop_dir / "specs"

    # Check config.json
    config_path = loop_dir / "config.json"
    if config_path.exists():
        try:
            from ralph_loop_base import load_config
            config = load_config(config_path)
            all_passed &= print_check("config.json", True, config["name"])
        except Exception as e:
            all_passed &= print_check("config.json", False, str(e))
            return all_passed
    else:
        all_passed &= print_check("config.json", False, "File not found")
        return all_passed

    # Check run_loop.py
    run_loop_path = loop_dir / "run_loop.py"
    all_passed &= print_check("run_loop.py", run_loop_path.exists())

    # Check specs directory
    all_passed &= print_check("specs/", specs_dir.exists() and specs_dir.is_dir())

    # Check 00-overview.md
    overview_path = specs_dir / "00-overview.md"
    if overview_path.exists():
        content = overview_path.read_text()
        all_passed &= print_check("00-overview.md", True, f"{len(content)} chars")
    else:
        all_passed &= print_check("00-overview.md", False, "File not found")

    # Check test-state.json
    test_state_path = specs_dir / "test-state.json"
    if test_state_path.exists():
        try:
            with open(test_state_path) as f:
                state = json.load(f)
            summary = state.get("summary", {})
            total = summary.get("total", 0)
            pending = summary.get("pending", 0)
            passed = summary.get("passed", 0)
            all_passed &= print_check(
                "test-state.json",
                True,
                f"{total} tests ({passed} passed, {pending} pending)"
            )

            # Check test structure
            tests = state.get("tests", [])
            if tests:
                first_test = tests[0]
                required_fields = ["id", "category", "status", "attempts", "notes"]
                has_all = all(f in first_test for f in required_fields)
                all_passed &= print_check(
                    "test structure",
                    has_all,
                    f"First test: {first_test.get('id', 'unknown')}"
                )
        except Exception as e:
            all_passed &= print_check("test-state.json", False, str(e))
    else:
        all_passed &= print_check("test-state.json", False, "File not found")

    return all_passed


def check_environment():
    """Check environment configuration."""
    print_header("Environment")
    all_passed = True

    # Check Claude CLI
    import subprocess
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            version = result.stdout.strip().split('\n')[0]
            all_passed &= print_check("Claude CLI", True, version)
        else:
            all_passed &= print_check("Claude CLI", False, "Not working")
    except Exception as e:
        all_passed &= print_check("Claude CLI", False, str(e))

    # Check project directory
    project_dir = Path(__file__).parent.parent
    has_git = (project_dir / ".git").exists()
    has_package = (project_dir / "package.json").exists()
    all_passed &= print_check(
        "Project root",
        has_git or has_package,
        f"{project_dir}"
    )

    # Check env var override
    env_override = os.environ.get("CODING_LOOP_PROJECT_DIR")
    if env_override:
        print_check("CODING_LOOP_PROJECT_DIR", True, env_override)
    else:
        print(f"  [ ] CODING_LOOP_PROJECT_DIR: Not set (using auto-detect)")

    return all_passed


def main():
    print()
    print("=" * 60)
    print("  CODING LOOP SYSTEM VERIFICATION")
    print(f"  {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    results = []

    # Run all checks
    results.append(("Imports", check_imports()))
    results.append(("Schemas", check_schemas()))
    results.append(("Environment", check_environment()))
    results.append(("Loop 1", check_loop("loop-1-critical-path")))
    results.append(("Loop 2", check_loop("loop-2-infrastructure")))
    results.append(("Loop 3", check_loop("loop-3-polish")))

    # Summary
    print_header("SUMMARY")
    all_passed = True
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        symbol = "[+]" if passed else "[X]"
        print(f"  {symbol} {name}: {status}")
        all_passed &= passed

    print()
    if all_passed:
        print("  ALL SYSTEMS OPERATIONAL")
        print()
        print("  To run a loop:")
        print("    python3 coding-loops/loop-1-critical-path/run_loop.py")
        print("    python3 coding-loops/loop-1-critical-path/run_loop.py --max-iterations 1")
        print()
        return 0
    else:
        print("  SOME CHECKS FAILED - See above for details")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
