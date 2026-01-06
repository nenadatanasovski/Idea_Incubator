"""
CLI Command Modules

This package contains the CLI subcommands for the coordination system.

Modules:
- status: Status, health, timeline commands
- control: Pause, resume, skip, reset, rollback, restart
- locks: Lock inspection and force-unlock
- decisions: Decision viewing and responding
- analysis: Summary, conflicts, stuck, regressions

Usage:
    python3 coding-loops/cli.py <command> [options]

Examples:
    python3 coding-loops/cli.py status
    python3 coding-loops/cli.py pause loop-1
    python3 coding-loops/cli.py decisions
    python3 coding-loops/cli.py summary
"""

# Commands registered when implemented
# from .status import status_commands
# from .control import control_commands
# from .locks import lock_commands
# from .decisions import decision_commands
# from .analysis import analysis_commands

__all__ = [
    # 'status_commands',
    # 'control_commands',
    # 'lock_commands',
    # 'decision_commands',
    # 'analysis_commands',
]
