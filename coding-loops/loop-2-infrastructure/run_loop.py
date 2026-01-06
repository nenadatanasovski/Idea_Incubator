#!/usr/bin/env python3
"""
Loop 2: Infrastructure Ralph Loop
==================================

Implements: Authentication → Credit System → Hosting

Usage:
    # Config-based (recommended)
    python coding-loops/loop-2-infrastructure/run_loop.py

    # With options
    python coding-loops/loop-2-infrastructure/run_loop.py --max-iterations 10
    python coding-loops/loop-2-infrastructure/run_loop.py --model claude-sonnet-4-20250514

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


class InfrastructureLoop(RalphLoopRunner):
    """
    Infrastructure Loop Runner.

    Handles Authentication, Credit System, and Hosting implementation.
    """

    def get_spec_content(self, test_id: str) -> str:
        """Get the spec content for a given test ID."""
        # Return the full overview which contains all specs
        overview_file = self.specs_dir / "00-overview.md"
        if overview_file.exists():
            content = overview_file.read_text()

            # Add category-specific context
            if test_id.startswith("INFRA-AUTH"):
                content += """

## FOCUS: Authentication

For this test, focus on the Authentication section of the spec.
Key files to create/modify:
- database/migrations/XXX_users.sql
- server/routes/auth.ts
- server/middleware/auth.ts
- utils/password.ts
- utils/jwt.ts
- frontend/src/pages/Login.tsx
- frontend/src/pages/Register.tsx
- frontend/src/components/AuthProvider.tsx
- frontend/src/hooks/useAuth.ts
"""
            elif test_id.startswith("INFRA-CRED"):
                content += """

## FOCUS: Credit System

For this test, focus on the Credit System section of the spec.
Key files to create/modify:
- database/migrations/XXX_credits.sql
- server/routes/credits.ts
- server/middleware/credits.ts
- utils/credit-manager.ts
- utils/stripe.ts
- frontend/src/pages/Credits.tsx
- frontend/src/components/CreditBalance.tsx
- frontend/src/components/CreditUsageAlert.tsx
"""
            elif test_id.startswith("INFRA-HOST"):
                content += """

## FOCUS: Hosting

For this test, focus on the Hosting section of the spec.
Key files to create/modify:
- database/migrations/XXX_apps.sql
- server/routes/apps.ts
- utils/hosting/railway.ts (or chosen provider)
- frontend/src/pages/Apps.tsx
- frontend/src/pages/AppDetail.tsx
- frontend/src/components/DeploymentStatus.tsx
"""
            return content
        else:
            return f"Spec file not found: {overview_file}"

    def build_system_prompt(self) -> str:
        """Build the system prompt for this loop."""
        return """You are an expert software engineer implementing Infrastructure for the Vibe platform.

Infrastructure includes:
1. Authentication - User registration, login, sessions, JWT
2. Credit System - Balance tracking, Stripe integration, consumption
3. Hosting - App deployment to Railway/Render/Vercel

You have deep knowledge of:
- TypeScript and React
- Express.js APIs with authentication
- JWT tokens and bcrypt password hashing
- Stripe payment integration
- Cloud hosting provider APIs (Railway, Render, Vercel)
- SQLite databases

Security best practices:
- Never store plaintext passwords
- Use secure session tokens
- Validate all inputs
- Rate limit authentication endpoints
- Secure Stripe webhook verification

Your goal is to implement each test case correctly, following security best practices.
"""


async def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Loop 2: Infrastructure")
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
            "name": "Loop 2: Infrastructure (Auth -> Credits -> Hosting)",
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
    runner = InfrastructureLoop.from_config(config, max_iterations=args.max_iterations)

    return await runner.run()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
