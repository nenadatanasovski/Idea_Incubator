#!/usr/bin/env python3
"""
Loop 1: Critical Path Ralph Loop
=================================

Implements: UFS Completion → Specification Agent → Build Agent

Usage:
    # Config-based (recommended)
    python coding-loops/loop-1-critical-path/run_loop.py

    # With options
    python coding-loops/loop-1-critical-path/run_loop.py --max-iterations 10
    python coding-loops/loop-1-critical-path/run_loop.py --model claude-sonnet-4-20250514

    # Override project directory
    CODING_LOOP_PROJECT_DIR=/path/to/project python run_loop.py
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add shared module to path
sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))

from ralph_loop_base import RalphLoopRunner, load_config


class CriticalPathLoop(RalphLoopRunner):
    """
    Critical Path Loop Runner.

    Handles UFS completion, Specification Agent, and Build Agent implementation.
    """

    def get_spec_content(self, test_id: str) -> str:
        """Get the spec content for a given test ID."""
        # Return the full overview which contains all specs
        overview_file = self.specs_dir / "00-overview.md"
        if overview_file.exists():
            content = overview_file.read_text()

            # Add category-specific context
            if test_id.startswith("CP-UFS"):
                content += """

## FOCUS: Unified File System Completion

For this test, focus on completing the remaining UFS tests.
Key areas:
- Storage Contracts (SC tests)
- Placeholder System (PH tests)
- UI Components (UI tests)

Reference: Check existing implementation in:
- utils/folder-structure.ts
- utils/unified-artifact-store.ts
- templates/unified/
"""
            elif test_id.startswith("CP-SPEC"):
                content += """

## FOCUS: Specification Agent

For this test, focus on building the Specification Agent.
Key files to create/modify:
- agents/specification-agent.ts
- server/routes/specification.ts
- types/specification.ts

The Specification Agent should:
1. Extract requirements from ideation artifacts
2. Generate structured specs for build
3. Create test cases from requirements
"""
            elif test_id.startswith("CP-BUILD"):
                content += """

## FOCUS: Build Agent

For this test, focus on building the Build Agent.
Key files to create/modify:
- agents/build-agent.ts
- server/routes/build.ts
- types/build.ts

The Build Agent should:
1. Take specs from Specification Agent
2. Generate code using Ralph loop pattern
3. Run tests and iterate until passing
"""
            return content
        else:
            return f"Spec file not found: {overview_file}"

    def build_system_prompt(self) -> str:
        """Build the system prompt for this loop."""
        return """You are an expert software engineer implementing the Critical Path for the Vibe platform.

Critical Path includes:
1. Unified File System (UFS) - Complete remaining tests for storage and placeholders
2. Specification Agent - Extract structured specs from ideation
3. Build Agent - Generate code from specs using Ralph loops

You have deep knowledge of:
- TypeScript and React
- Express.js APIs
- File system management
- AI agent design patterns
- Test-driven development

Best practices:
- Follow existing code patterns in the codebase
- Write comprehensive tests
- Use proper TypeScript types
- Keep components modular and reusable

Your goal is to implement each test case correctly, advancing the critical path to production.
"""


async def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Loop 1: Critical Path")
    parser.add_argument("--max-iterations", type=int, default=None, help="Max iterations")
    parser.add_argument("--model", type=str, default=None, help="Claude model (overrides config)")
    parser.add_argument("--config", type=str, default=None, help="Path to config.json")
    args = parser.parse_args()

    # Load config
    config_path = Path(args.config) if args.config else Path(__file__).parent / "config.json"

    try:
        config = load_config(config_path)
    except FileNotFoundError:
        print(f"Config file not found: {config_path}")
        print("Creating with default paths...")
        # Fall back to explicit paths for backward compatibility
        project_dir = Path(__file__).parent.parent.parent
        specs_dir = Path(__file__).parent / "specs"
        config = {
            "name": "Loop 1: Critical Path (UFS -> Spec -> Build)",
            "_resolved": {
                "project_dir": project_dir,
                "specs_dir": specs_dir,
                "test_state_file": specs_dir / "test-state.json",
            },
            "model": args.model or "claude-opus-4-5-20251101",
        }

    # Override model if specified
    if args.model:
        config["model"] = args.model

    # Create runner from config
    runner = CriticalPathLoop.from_config(config, max_iterations=args.max_iterations)

    return await runner.run()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
