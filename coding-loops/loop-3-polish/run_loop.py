#!/usr/bin/env python3
"""
Loop 3: Polish Ralph Loop
=========================

Implements: Error Monitoring → E2E Testing → PWA/Mobile

Usage:
    # Config-based (recommended)
    python coding-loops/loop-3-polish/run_loop.py

    # With options
    python coding-loops/loop-3-polish/run_loop.py --max-iterations 10
    python coding-loops/loop-3-polish/run_loop.py --model claude-sonnet-4-20250514

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


class PolishLoop(RalphLoopRunner):
    """
    Polish Loop Runner.

    Handles Error Monitoring, E2E Testing, and PWA/Mobile implementation.
    """

    def get_spec_content(self, test_id: str) -> str:
        """Get the spec content for a given test ID."""
        # Return the full overview which contains all specs
        overview_file = self.specs_dir / "00-overview.md"
        if overview_file.exists():
            content = overview_file.read_text()

            # Add category-specific context
            if test_id.startswith("POLISH-MON"):
                content += """

## FOCUS: Error Monitoring

For this test, focus on the Error Monitoring section of the spec.
Key files to create/modify:
- utils/error-tracker.ts
- utils/analytics.ts
- server/middleware/error-handler.ts
- frontend/src/components/ErrorBoundary.tsx
- frontend/src/main.tsx (Sentry init)
- server/api.ts (Sentry init)

Install packages:
- npm install @sentry/react @sentry/node

Environment variables needed:
- VITE_SENTRY_DSN (frontend)
- SENTRY_DSN (backend)
"""
            elif test_id.startswith("POLISH-E2E"):
                content += """

## FOCUS: E2E Testing

For this test, focus on the E2E Testing section of the spec.
Key files to create/modify:
- tests/e2e/ideation-journey/*.ts
- .github/workflows/test.yml

Use existing Ralph loop infrastructure as a pattern.
Tests should use the Claude Agent SDK for AI-driven testing.
"""
            elif test_id.startswith("POLISH-PWA"):
                content += """

## FOCUS: PWA/Mobile

For this test, focus on the PWA section of the spec.
Key files to create/modify:
- public/manifest.json
- public/icons/*.png
- frontend/index.html (meta tags)
- frontend/vite.config.ts (PWA plugin)

Install packages:
- npm install vite-plugin-pwa

PWA Requirements:
- Manifest with name, icons, theme color
- Service worker for caching
- iOS meta tags for Add to Home Screen
"""
            return content
        else:
            return f"Spec file not found: {overview_file}"

    def build_system_prompt(self) -> str:
        """Build the system prompt for this loop."""
        return """You are an expert software engineer implementing Polish features for the Vibe platform.

Polish features include:
1. Error Monitoring - Sentry integration for error tracking
2. E2E Testing - Automated journey tests with Claude Agent SDK
3. PWA/Mobile - Progressive Web App setup for mobile

You have deep knowledge of:
- TypeScript and React
- Sentry error tracking
- Service workers and PWA manifest
- Mobile responsive design
- CI/CD with GitHub Actions
- Testing with Claude Agent SDK

Best practices:
- Capture meaningful error context
- Track key user events
- Ensure PWA meets installability criteria
- Test on multiple mobile viewports
- Create maintainable CI workflows

Your goal is to implement each test case correctly, improving platform quality.
"""


async def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Loop 3: Polish")
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
            "name": "Loop 3: Polish (Monitoring -> E2E -> PWA)",
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
    runner = PolishLoop.from_config(config, max_iterations=args.max_iterations)

    return await runner.run()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
