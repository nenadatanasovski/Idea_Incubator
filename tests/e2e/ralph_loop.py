#!/usr/bin/env python3
"""
Ralph Loop E2E Testing Orchestrator
====================================

Main entry point for the E2E testing agent using Claude Agent SDK.
Based on auto-build-agent patterns.

Usage:
    python ralph_loop.py
    python ralph_loop.py --max-iterations 10
    python ralph_loop.py --model claude-opus-4-5-20251101
"""

import argparse
import asyncio
import subprocess
import sys
import time
from pathlib import Path

from agent import run_e2e_agent


# Default to Opus 4.5
DEFAULT_MODEL = "claude-opus-4-5-20251101"

# Project paths
PROJECT_DIR = Path("/Users/nenadatanasovski/idea_incurator")
E2E_DIR = PROJECT_DIR / "tests" / "e2e"
LOGS_DIR = E2E_DIR / "logs"


def check_server(url: str, name: str) -> bool:
    """Check if a server is responding."""
    import urllib.request
    import urllib.error

    try:
        urllib.request.urlopen(url, timeout=5)
        print(f"  {name}: OK")
        return True
    except (urllib.error.URLError, urllib.error.HTTPError):
        print(f"  {name}: DOWN")
        return False


def start_servers() -> bool:
    """
    Start frontend and backend servers if not running.

    Returns:
        True if servers are running, False if startup failed
    """
    print("\n[ORCHESTRATOR] Checking servers...")

    frontend_ok = check_server("http://localhost:3000", "Frontend (3000)")
    backend_ok = check_server("http://localhost:3001/api/profiles", "Backend (3001)")

    if frontend_ok and backend_ok:
        return True

    # Start missing servers
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    if not backend_ok:
        print("\n[ORCHESTRATOR] Starting backend...")
        backend_log = open(LOGS_DIR / "backend.log", "w")
        subprocess.Popen(
            ["npm", "run", "server"],
            cwd=PROJECT_DIR,
            stdout=backend_log,
            stderr=backend_log,
        )
        time.sleep(5)

    if not frontend_ok:
        print("[ORCHESTRATOR] Starting frontend...")
        frontend_log = open(LOGS_DIR / "frontend.log", "w")
        subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=PROJECT_DIR / "frontend",
            stdout=frontend_log,
            stderr=frontend_log,
        )
        time.sleep(8)

    # Verify
    print("\n[ORCHESTRATOR] Verifying servers...")
    frontend_ok = check_server("http://localhost:3000", "Frontend (3000)")
    backend_ok = check_server("http://localhost:3001/api/profiles", "Backend (3001)")

    if not frontend_ok or not backend_ok:
        print("\n[ORCHESTRATOR] ERROR: Servers failed to start")
        print("Please start them manually:")
        print("  Terminal 1: cd frontend && npm run dev")
        print("  Terminal 2: npm run server")
        return False

    return True


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Ralph Loop E2E Testing Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python ralph_loop.py                    # Run with defaults
    python ralph_loop.py --max-iterations 5 # Limit iterations
    python ralph_loop.py --model claude-opus-4-5-20251101
        """,
    )

    parser.add_argument(
        "--max-iterations",
        type=int,
        default=None,
        help="Maximum number of iterations (default: unlimited)",
    )

    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Claude model to use (default: {DEFAULT_MODEL})",
    )

    return parser.parse_args()


async def main() -> int:
    """Main entry point."""
    args = parse_args()

    print("\n" + "=" * 70)
    print("  RALPH LOOP v2.0 - Claude Agent SDK")
    print("=" * 70)
    print(f"\nProject: {PROJECT_DIR}")
    print(f"Model: {args.model}")
    print(f"Max iterations: {args.max_iterations or 'Unlimited'}")

    # Ensure directories exist
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    (E2E_DIR / "prompts").mkdir(parents=True, exist_ok=True)

    # Start servers
    if not start_servers():
        return 1

    # Run the agent loop
    try:
        await run_e2e_agent(
            project_dir=PROJECT_DIR,
            model=args.model,
            max_iterations=args.max_iterations,
        )
        return 0
    except KeyboardInterrupt:
        print("\n\n[ORCHESTRATOR] Interrupted by user")
        return 130
    except Exception as e:
        print(f"\n[ORCHESTRATOR] Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
