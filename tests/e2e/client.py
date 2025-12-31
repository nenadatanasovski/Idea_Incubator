"""
Claude SDK Client Configuration for E2E Testing
================================================

Creates and configures the Claude Agent SDK client for E2E testing.
Based on auto-build-agent patterns.
"""

import json
from pathlib import Path

from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient
from claude_code_sdk.types import HookMatcher

from security import bash_security_hook


# Puppeteer MCP tools for browser automation (use wildcard to allow all)
PUPPETEER_TOOLS = [
    "mcp__puppeteer__*",  # Allow ALL puppeteer tools
]

# Built-in tools
BUILTIN_TOOLS = [
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "Bash",
    "TodoWrite",
]


def create_client(project_dir: Path, model: str) -> ClaudeSDKClient:
    """
    Create a Claude Agent SDK client configured for E2E testing.

    Args:
        project_dir: Project root directory
        model: Claude model to use (e.g., claude-opus-4-5-20251101)

    Returns:
        Configured ClaudeSDKClient
    """

    # Security settings - allow access to project directory
    security_settings = {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                # Allow file operations within project
                "Read(./**)",
                "Write(./**)",
                "Edit(./**)",
                "Glob(./**)",
                "Grep(./**)",
                # Bash with security hook validation
                "Bash(*)",
                # All Puppeteer MCP tools
                "mcp__puppeteer__*",
            ],
        },
    }

    # Write settings to file
    settings_file = project_dir / ".claude_e2e_settings.json"
    with open(settings_file, "w") as f:
        json.dump(security_settings, f, indent=2)

    print(f"Created security settings at {settings_file}")
    print(f"   - Model: {model}")
    print("   - Sandbox enabled")
    print(f"   - Filesystem restricted to: {project_dir.resolve()}")
    print("   - MCP servers: puppeteer")
    print()

    return ClaudeSDKClient(
        options=ClaudeCodeOptions(
            model=model,
            system_prompt="You are an expert E2E testing agent that FIXES CODE to make tests pass.",
            allowed_tools=[
                *BUILTIN_TOOLS,
                *PUPPETEER_TOOLS,
            ],
            mcp_servers={
                "puppeteer": {"command": "npx", "args": ["puppeteer-mcp-server"]}
            },
            hooks={
                "PreToolUse": [
                    HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                ],
            },
            max_turns=1000,  # High ceiling - agent runs until done or context fills
            cwd=str(project_dir.resolve()),
            settings=str(settings_file.resolve()),
        )
    )
