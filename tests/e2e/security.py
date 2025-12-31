"""
Security Hooks for E2E Testing Agent
====================================

Pre-tool-use hooks that validate bash commands.
Based on auto-build-agent security patterns.
"""

import os
import shlex


# Allowed commands for E2E testing
ALLOWED_COMMANDS = {
    # File inspection
    "ls",
    "cat",
    "head",
    "tail",
    "wc",
    "grep",
    # File operations
    "cp",
    "mkdir",
    "chmod",
    "rm",
    "mv",
    "touch",
    # Directory
    "pwd",
    "cd",
    # Node.js development
    "npm",
    "node",
    "npx",
    # Version control
    "git",
    # Process management
    "ps",
    "lsof",
    "sleep",
    "pkill",
    "kill",
    # Network
    "curl",
    # Database
    "sqlite3",
    # Misc
    "echo",
    "date",
    "jq",
    "md5",
    "md5sum",
    "timeout",
    "true",
    "false",
    # macOS specific
    "open",
}

# Commands needing extra validation
COMMANDS_NEEDING_EXTRA_VALIDATION = {"pkill", "rm", "kill"}


def extract_commands(command_string: str) -> list[str]:
    """
    Extract command names from a shell command string.
    """
    import re

    commands = []
    segments = re.split(r'(?<!["\'])\s*;\s*(?!["\'])', command_string)

    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue

        try:
            tokens = shlex.split(segment)
        except ValueError:
            return []

        if not tokens:
            continue

        expect_command = True

        for token in tokens:
            if token in ("|", "||", "&&", "&"):
                expect_command = True
                continue

            if token in ("if", "then", "else", "elif", "fi", "for", "while",
                        "until", "do", "done", "case", "esac", "in", "!", "{", "}"):
                continue

            if token.startswith("-"):
                continue

            if "=" in token and not token.startswith("="):
                continue

            if expect_command:
                cmd = os.path.basename(token)
                commands.append(cmd)
                expect_command = False

    return commands


def validate_pkill_command(command_string: str) -> tuple[bool, str]:
    """Validate pkill - only allow killing dev processes."""
    allowed_process_names = {"node", "npm", "npx", "vite", "next", "tsx", "server"}

    try:
        tokens = shlex.split(command_string)
    except ValueError:
        return False, "Could not parse pkill command"

    # Check if -f flag is used (full command line matching)
    uses_full_match = "-f" in tokens

    # Get non-flag arguments
    args = [t for t in tokens[1:] if not t.startswith("-")]
    if not args:
        return False, "pkill requires a process name or pattern"

    target = args[-1]

    # For -f patterns like "npm run server", check if any allowed name is in the pattern
    if uses_full_match:
        for allowed in allowed_process_names:
            if allowed in target:
                return True, ""
        return False, f"pkill -f pattern must contain one of: {allowed_process_names}"

    # For regular pkill, check exact match
    if target in allowed_process_names:
        return True, ""
    return False, f"pkill only allowed for dev processes: {allowed_process_names}"


def validate_rm_command(command_string: str) -> tuple[bool, str]:
    """Validate rm - be careful with deletions."""
    try:
        tokens = shlex.split(command_string)
    except ValueError:
        return False, "Could not parse rm command"

    # Block rm -rf / or rm -rf ~
    for token in tokens:
        if token in ("/", "~", os.path.expanduser("~")):
            return False, "Cannot delete root or home directory"

    return True, ""


def validate_kill_command(command_string: str) -> tuple[bool, str]:
    """Validate kill - only allow killing by numeric PID."""
    try:
        tokens = shlex.split(command_string)
    except ValueError:
        return False, "Could not parse kill command"

    # Get non-flag arguments (should be PIDs)
    args = [t for t in tokens[1:] if not t.startswith("-")]

    if not args:
        return False, "kill requires a PID"

    # All arguments must be numeric PIDs
    for arg in args:
        if not arg.isdigit():
            return False, f"kill only allowed with numeric PIDs, got: {arg}"

    return True, ""


async def bash_security_hook(input_data, tool_use_id=None, context=None):
    """
    Pre-tool-use hook that validates bash commands.
    """
    if input_data.get("tool_name") != "Bash":
        return {}

    command = input_data.get("tool_input", {}).get("command", "")
    if not command:
        return {}

    commands = extract_commands(command)

    if not commands:
        return {
            "decision": "block",
            "reason": f"Could not parse command: {command}",
        }

    for cmd in commands:
        if cmd not in ALLOWED_COMMANDS:
            return {
                "decision": "block",
                "reason": f"Command '{cmd}' is not in allowed list",
            }

        if cmd in COMMANDS_NEEDING_EXTRA_VALIDATION:
            if cmd == "pkill":
                allowed, reason = validate_pkill_command(command)
                if not allowed:
                    return {"decision": "block", "reason": reason}
            elif cmd == "rm":
                allowed, reason = validate_rm_command(command)
                if not allowed:
                    return {"decision": "block", "reason": reason}
            elif cmd == "kill":
                allowed, reason = validate_kill_command(command)
                if not allowed:
                    return {"decision": "block", "reason": reason}

    return {}
